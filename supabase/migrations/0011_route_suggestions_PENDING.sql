-- PENDING — apply when the Supabase bridge is back.
-- Route convergence: as users type in add-pattern, suggest routes that
-- already exist so later users land on earlier users' keys. Returns only
-- aggregate route facts (never who rides them).
create or replace function public.route_suggestions(p_mode text, p_query text)
returns table (route_or_line text, direction text, member_count bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  select tp.route_or_line, tp.direction, count(distinct tp.user_id)
  from public.trip_patterns tp
  where tp.mode = p_mode
    and (p_query = '' or tp.route_or_line ilike '%' || p_query || '%')
  group by tp.rkey, tp.route_or_line, tp.direction
  order by count(distinct tp.user_id) desc
  limit 8
$$;
