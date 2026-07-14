-- 0021 — Venue-wide matching only for people in motion.
--
-- Product decision (founder): a rail-platform regular can't get through
-- security to Gate C — cross-checkpoint matches are unmeetable. So:
--   · ONE-OFF place check-ins (incl. the flight→airport bridge) keep the
--     venue-wide key: travelers passing through BWI today all meet.
--   · RECURRING places go back to spot-exact keys: the food-court regular
--     matches food-court regulars. (Filler normalization still converges
--     "The Amtrak Platform" with "Amtrak platform".)
--   · Trains, buses, ferries, flights: unchanged (route-exact).

create or replace function public.route_key_v3(
  p_mode text, p_route_id text, p_route text, p_direction text, p_code text, p_one_off boolean
) returns text language sql immutable as $$
  select case
    when p_mode = 'place' and p_one_off and coalesce(p_code, '') <> ''
      then 'place:' || public.normalize_text(p_code) || ':regular'
    else p_mode || ':' || coalesce(p_route_id, public.normalize_text(p_route))
      || ':' || public.normalize_text(p_direction)
  end
$$;
grant execute on function public.route_key_v3(text, text, text, text, text, boolean) to authenticated, service_role;

-- Rebuild the generated key on v3 (recomputes every row at once — no cohort
-- splits), re-point live check-ins, retire v2.
drop index if exists trip_patterns_rkey_idx;
alter table public.trip_patterns drop column rkey;
alter table public.trip_patterns add column rkey text generated always as
  (public.route_key_v3(mode, route_id, route_or_line, direction, station_or_code, one_off)) stored;
create index trip_patterns_rkey_idx on public.trip_patterns (rkey);

update public.check_ins c
set rkey = tp.rkey
from public.trip_patterns tp
where tp.id = c.pattern_id and c.rkey is distinct from tp.rkey;

drop function if exists public.route_key_v2(text, text, text, text, text);

-- one_off_check_in referenced route_key_v2 for duplicate reuse — repoint to v3.
create or replace function public.one_off_check_in(p_venue text, p_code text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_route text;
  v_code text := upper(trim(coalesce(p_code, '')));
  v_venue text := trim(coalesce(p_venue, ''));
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.standing_ok(auth.uid()) then raise exception 'account suspended'; end if;
  if v_code = '' and v_venue = '' then
    raise exception 'Enter an airport/station code or a place name.';
  end if;
  v_route := case
    when v_venue <> '' and v_code <> '' then v_venue || ' (' || v_code || ')'
    when v_venue <> '' then v_venue
    else v_code
  end;

  select id into v_id from public.trip_patterns
  where user_id = auth.uid()
    and rkey = public.route_key_v3('place', null, v_route, 'Regular', v_code, true)
  limit 1;

  if v_id is null then
    insert into public.trip_patterns
      (user_id, mode, route_or_line, direction, days_of_week, window_start, window_end, station_or_code, one_off)
    values
      (auth.uid(), 'place', v_route, 'Regular', array[extract(dow from now())::int],
       to_char(now(), 'HH24:MI'), '23:59', v_code, true)
    returning id into v_id;
  end if;

  perform public.check_in(v_id);
  return v_id;
end $$;

select
  (select count(distinct rkey) from public.trip_patterns
     where mode='place' and station_or_code='BWI' and not one_off) as bwi_recurring_spots, -- want 5 (distinct spots again)
  (select count(distinct rkey) from public.trip_patterns
     where mode='place' and station_or_code='BWI' and one_off) as bwi_one_off_keys,        -- want 1 (venue-wide pool)
  (select count(*) from public.check_ins c join public.trip_patterns tp on tp.id = c.pattern_id
     where c.rkey is distinct from tp.rkey) as stale_checkins;                             -- want 0
