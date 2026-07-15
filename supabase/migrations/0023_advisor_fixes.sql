-- 0023 — Advisor fixes (applied via MCP).
-- 1. one_off_check_in was re-exposed to anon when 0021's create-or-replace
--    reset its grants — re-lock to authenticated/service_role.
-- 2. Pin route_key_v3's search_path (was flagged mutable).

revoke execute on function public.one_off_check_in(text, text) from public, anon;
grant execute on function public.one_off_check_in(text, text) to authenticated, service_role;

create or replace function public.route_key_v3(
  p_mode text, p_route_id text, p_route text, p_direction text, p_code text, p_one_off boolean
) returns text language sql immutable set search_path = public, pg_temp as $$
  select case
    when p_mode = 'place' and p_one_off and coalesce(p_code, '') <> ''
      then 'place:' || public.normalize_text(p_code) || ':regular'
    else p_mode || ':' || coalesce(p_route_id, public.normalize_text(p_route))
      || ':' || public.normalize_text(p_direction)
  end
$$;
