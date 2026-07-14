-- 0018 — Transient travelers: one-off "I'm here now" check-ins + BWI demo seed.
-- REQUIRES 0017 (route_key_v2) — run that first.
--
-- A one-off is a real trip_pattern flagged one_off=true, created and checked
-- in atomically by one_off_check_in(). Because it IS a pattern, every
-- matching surface works unchanged (board, who's-here, route-scoped search).
-- The retention sweep deletes one-offs once their check-in lapses, so
-- "discoverable" never outlives "actually there" and boards stay clean.

alter table public.trip_patterns add column if not exists one_off boolean not null default false;

-- Create + check in, in one call. If the caller already has a pattern at
-- this venue (same rkey), reuse it instead of duplicating.
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
    and rkey = public.route_key_v2('place', null, v_route, 'Regular', v_code)
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

grant execute on function public.one_off_check_in(text, text) to authenticated, service_role;
revoke execute on function public.one_off_check_in(text, text) from anon;

-- Sweep: one-offs self-clean once no check-in is active on them.
create or replace function public.retention_sweep()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.check_ins where active_until < now() - interval '1 day';
  update public.connection_requests set status = 'expired' where status = 'pending' and created_at < now() - interval '7 days';
  update public.connections set status = 'expired' where status = 'active' and last_activity_at < now() - interval '30 days';
  delete from public.messages m using public.connections c where m.connection_id = c.id and c.status = 'expired';
  delete from public.meetup_pins where expires_at < now() - interval '1 day' and verified_at is null;
  -- One-off presence expires by construction: pattern goes when its check-in does.
  delete from public.trip_patterns tp
  where tp.one_off
    and tp.created_at < now() - interval '3 hours'
    and not exists (select 1 from public.check_ins c where c.pattern_id = tp.id and c.active_until > now());
end $$;

-- ── BWI demo seed: the airport as a hub, recurring + one-off ────────────────
-- Different venues, same code — venue-wide matching means they all meet.
-- Demo check-ins run 30 days so the board stays alive for testing.
-- Deterministic: delete-then-insert (a guarded insert...select silently
-- no-op'd in the SQL Editor; plain VALUES surfaces real errors).
delete from public.check_ins where pattern_id in (
  '22222222-2222-4222-8222-222222222201','22222222-2222-4222-8222-222222222202',
  '22222222-2222-4222-8222-222222222203','22222222-2222-4222-8222-222222222204',
  '22222222-2222-4222-8222-222222222205','22222222-2222-4222-8222-222222222206',
  '22222222-2222-4222-8222-222222222207');
delete from public.trip_patterns where id in (
  '22222222-2222-4222-8222-222222222201','22222222-2222-4222-8222-222222222202',
  '22222222-2222-4222-8222-222222222203','22222222-2222-4222-8222-222222222204',
  '22222222-2222-4222-8222-222222222205','22222222-2222-4222-8222-222222222206',
  '22222222-2222-4222-8222-222222222207');

insert into public.trip_patterns
  (id, user_id, mode, route_or_line, direction, days_of_week, window_start, window_end, station_or_code, one_off)
values
  ('22222222-2222-4222-8222-222222222201','11111111-1111-4111-8111-111111111106','place','Gate B lounge (BWI)','Regular',array[1,2,3,4,5],'15:00','20:00','BWI',false),
  ('22222222-2222-4222-8222-222222222202','11111111-1111-4111-8111-111111111107','place','Food court (BWI)','Regular',array[1,3,5],'11:00','14:00','BWI',false),
  ('22222222-2222-4222-8222-222222222203','11111111-1111-4111-8111-111111111108','place','Amtrak platform (BWI)','Regular',array[1,2,3,4,5],'07:00','09:30','BWI',false),
  ('22222222-2222-4222-8222-222222222204','11111111-1111-4111-8111-111111111109','flight','BWI → BOS','One way',array[1],'06:00','09:00','BWI',false),
  ('22222222-2222-4222-8222-222222222205','11111111-1111-4111-8111-111111111110','flight','BWI → ATL','One way',array[4],'16:00','19:00','BWI',false),
  ('22222222-2222-4222-8222-222222222206','11111111-1111-4111-8111-111111111111','place','Passing through (BWI)','Regular',array[2],'12:00','23:59','BWI',true),
  ('22222222-2222-4222-8222-222222222207','11111111-1111-4111-8111-111111111112','place','Layover (BWI)','Regular',array[2],'13:00','23:59','BWI',true);

-- Live presence at BWI: two recurring + both one-offs are checked in now.
insert into public.check_ins (pattern_id, user_id, rkey, active_until)
select tp.id, tp.user_id, tp.rkey, now() + interval '30 days'
from public.trip_patterns tp
where tp.id in (
  '22222222-2222-4222-8222-222222222201','22222222-2222-4222-8222-222222222202',
  '22222222-2222-4222-8222-222222222206','22222222-2222-4222-8222-222222222207');

select
  (select count(*) from public.trip_patterns where one_off) as one_off_patterns,  -- want 2
  (select count(distinct rkey) from public.trip_patterns
     where mode='place' and station_or_code='BWI') as bwi_place_keys,             -- want 1 (venue-wide!)
  (select count(*) from public.check_ins c join public.trip_patterns tp on tp.id = c.pattern_id
     where tp.station_or_code = 'BWI' and c.active_until > now()) as live_at_bwi; -- want 4+
