-- 0016 — Search spans every field, not just your own.
--
-- Before: discover_people always required industry overlap with the caller,
-- so searching "Legal" returned nothing unless YOU were in Legal. Now:
--   · no query  → the feed: people who share ≥1 of your fields (unchanged)
--   · query     → searches ALL profiles by field, headline, or bio
-- Ranking still puts shared-field people first. Anonymity unchanged:
-- monogram only, never the real name.

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

-- 0015 made execute grants explicit; re-grant after create or replace.
grant execute on function public.discover_people(text) to authenticated, service_role;
revoke execute on function public.discover_people(text) from anon;

select has_function_privilege('authenticated', 'public.discover_people(text)', 'execute') as auth_ok;
