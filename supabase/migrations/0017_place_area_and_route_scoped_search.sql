-- 0017 — Whole-venue matching for places + route-scoped discovery.
-- (Supersedes 0016: this file contains the final discover_people — if 0016
--  wasn't applied yet, running this alone covers it.)
--
-- 1) PLACES MATCH THE WHOLE VENUE. A pattern's matching key (rkey) for
--    mode='place' now derives from the airport/station code alone: a bar at
--    BWI and Gate B12 (BWI) share one key, so travelers meet across
--    terminals. Every matching surface — board counts, on-this-route people,
--    check-ins — joins on rkey, so this single change widens them all.
--    Trains, buses, ferries, and flights keep exact-route matching.
--
-- 2) DISCOVERY IS ROUTE-SCOPED. Search results and the interest feed only
--    show people who share at least one declared route/place with you
--    (across ALL your trip patterns) — not the whole platform.

-- Key function v2: place patterns pivot on their station/venue code.
create or replace function public.route_key_v2(
  p_mode text, p_route_id text, p_route text, p_direction text, p_code text
) returns text language sql immutable as $$
  select case
    when p_mode = 'place' and coalesce(p_code, '') <> ''
      then 'place:' || public.normalize_text(p_code) || ':regular'
    else p_mode || ':' || coalesce(p_route_id, public.normalize_text(p_route))
      || ':' || public.normalize_text(p_direction)
  end
$$;

-- Rebuild the generated column on the new function (recomputes every row).
drop index if exists trip_patterns_rkey_idx;
alter table public.trip_patterns drop column rkey;
alter table public.trip_patterns add column rkey text generated always as
  (public.route_key_v2(mode, route_id, route_or_line, direction, station_or_code)) stored;
create index trip_patterns_rkey_idx on public.trip_patterns (rkey);

-- Live check-ins carry a copy of the key — re-point them.
update public.check_ins c
set rkey = tp.rkey
from public.trip_patterns tp
where tp.id = c.pattern_id and c.rkey is distinct from tp.rkey;

-- Discovery: route-scoped, all-fields search (final form).
create or replace function public.discover_people(p_query text default '')
returns table (id uuid, monogram text, headline text, bio text,
               industry_tags text[], reason_tags text[], verification_status text,
               avatar_url text, shared_tags int)
language sql stable security definer set search_path = public, pg_temp as $$
  with me as (select industry_tags from public.profiles where id = auth.uid())
  select pr.id, pr.monogram,
         pr.headline, pr.bio, pr.industry_tags, pr.reason_tags, pr.verification_status, pr.avatar_url,
         cardinality(array(
           select unnest(pr.industry_tags) intersect select unnest(me.industry_tags)
         )) as shared_tags
  from public.profiles pr, me
  where pr.id <> auth.uid()
    and pr.standing in ('good','warned')
    and not public.is_blocked(auth.uid(), pr.id)
    -- Route-scoped: at least one shared route/place across all my patterns.
    and exists (
      select 1 from public.trip_patterns mine
      join public.trip_patterns theirs on theirs.rkey = mine.rkey
      where mine.user_id = auth.uid() and theirs.user_id = pr.id)
    and not exists (
      select 1 from public.connections c where c.status = 'active'
        and ((c.user_a = auth.uid() and c.user_b = pr.id) or (c.user_b = auth.uid() and c.user_a = pr.id)))
    and not exists (
      select 1 from public.connection_requests r where r.status = 'pending'
        and ((r.from_user = auth.uid() and r.to_user = pr.id) or (r.to_user = auth.uid() and r.from_user = pr.id)))
    and (case
      when p_query = '' then pr.industry_tags && me.industry_tags
      else pr.headline ilike '%' || p_query || '%'
        or pr.bio ilike '%' || p_query || '%'
        or exists (select 1 from unnest(pr.industry_tags) t where t ilike '%' || p_query || '%')
    end)
  order by shared_tags desc, pr.created_at desc
  limit 30
$$;

grant execute on function public.discover_people(text) to authenticated, service_role;
revoke execute on function public.discover_people(text) from anon;
grant execute on function public.route_key_v2(text, text, text, text, text) to authenticated, service_role;

select
  (select count(*) from public.trip_patterns where rkey is null) as null_keys, -- want 0
  (select count(*) from public.check_ins c join public.trip_patterns tp on tp.id = c.pattern_id
     where c.rkey is distinct from tp.rkey) as stale_checkins,                 -- want 0
  has_function_privilege('authenticated', 'public.discover_people(text)', 'execute') as auth_ok;
