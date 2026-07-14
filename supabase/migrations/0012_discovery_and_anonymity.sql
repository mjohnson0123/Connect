-- PENDING — apply in Supabase → SQL Editor.
-- Interest-based discovery + anonymized-until-accept identity.
--
-- Product change: people are now discoverable two ways —
--   (1) shared route + active check-in (existing), and
--   (2) shared industry/field (new discover_people), surfaced in Connect.
-- In both, the real NAME never leaves the DB until a request is mutually
-- accepted; only the monogram (initials), photo, and profile are returned so
-- people can decide. Once accepted, the connections join reveals the full
-- name under RLS. Anonymization here is initials-only — the real display_name
-- is never selected by these functions.

-- Route discovery: return monogram in place of the name (no real-name leak).
create or replace function public.route_people(p_pattern_id uuid)
returns table (id uuid, display_name text, monogram text, headline text, bio text,
               industry_tags text[], reason_tags text[], verification_status text, avatar_url text)
language sql stable security definer set search_path = public, pg_temp as $$
  select distinct pr.id, pr.monogram as display_name, pr.monogram,
         pr.headline, pr.bio, pr.industry_tags, pr.reason_tags, pr.verification_status, pr.avatar_url
  from public.trip_patterns mine
  join public.check_ins c on c.rkey = mine.rkey and c.active_until > now() and c.user_id <> auth.uid()
  join public.profiles pr on pr.id = c.user_id
  where mine.id = p_pattern_id and mine.user_id = auth.uid()
    and pr.standing in ('good','warned')
    and not public.is_blocked(auth.uid(), pr.id)
$$;

-- Interest-based discovery: people who share ≥1 industry tag with me,
-- anonymized (monogram only), excluding self / connected / pending / blocked.
drop function if exists public.discover_people(text);
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
    and pr.industry_tags && me.industry_tags
    and not public.is_blocked(auth.uid(), pr.id)
    and not exists (
      select 1 from public.connections c where c.status = 'active'
        and ((c.user_a = auth.uid() and c.user_b = pr.id) or (c.user_b = auth.uid() and c.user_a = pr.id)))
    and not exists (
      select 1 from public.connection_requests r where r.status = 'pending'
        and ((r.from_user = auth.uid() and r.to_user = pr.id) or (r.to_user = auth.uid() and r.from_user = pr.id)))
    and (p_query = ''
         or pr.headline ilike '%' || p_query || '%'
         or exists (select 1 from unnest(pr.industry_tags) t where t ilike '%' || p_query || '%'))
  order by shared_tags desc, pr.created_at desc
  limit 30
$$;

-- Point the demo riders' industry tags at the controlled vocabulary so they
-- surface in interest-based discovery when a tester picks a matching field.
update public.profiles set industry_tags = array['Government & Policy','Healthcare'] where id = '11111111-1111-4111-8111-111111111101';
update public.profiles set industry_tags = array['Software Engineering','Finance']    where id = '11111111-1111-4111-8111-111111111102';
update public.profiles set industry_tags = array['Design & UX','Arts & Culture']       where id = '11111111-1111-4111-8111-111111111103';
update public.profiles set industry_tags = array['Consulting']                          where id = '11111111-1111-4111-8111-111111111104';
update public.profiles set industry_tags = array['Legal']                               where id = '11111111-1111-4111-8111-111111111105';
