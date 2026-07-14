-- 0015 — Security-advisor hardening (applied via MCP).
--
-- 1) RPC surface: functions were executable by `anon` via the default PUBLIC
--    grant. Every RPC already rejects signed-out callers internally
--    (auth.uid() checks — proven by the adversarial audit), but the calls
--    shouldn't reach the function at all. Flip to explicit grants:
--    authenticated + service_role only, and internal helpers not even that.
-- 2) Storage: the avatars bucket is public (objects served by CDN URL), but a
--    broad SELECT policy also allowed LISTING the bucket via the API. The app
--    only uses getPublicUrl, so the listing policy goes.

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Future functions: no execute for PUBLIC by default (grants become explicit).
alter default privileges in schema public revoke execute on functions from public;

-- Internal machinery — not callable by clients at all:
revoke execute on function public.apply_liveness_result(uuid, numeric, text) from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.guard_profile_content() from authenticated;
revoke execute on function public.guard_protected_profile_cols() from authenticated;
revoke execute on function public.retention_sweep() from authenticated;
-- NOTE: is_member / is_blocked / standing_ok must REMAIN granted to
-- authenticated — they're called from RLS policy expressions, which run with
-- the CALLER's privileges (revoking them broke message reads; caught by
-- re-running the adversarial audit). Only definer-context helpers can be
-- locked down:
revoke execute on function public.simulated_verification_allowed() from authenticated;

-- Avatars: keep objects publicly fetchable by URL, remove API listing.
drop policy if exists avatar_read_all on storage.objects;

select
  has_function_privilege('anon', 'public.board_summary()', 'execute') as anon_can_rpc,          -- want false
  has_function_privilege('authenticated', 'public.board_summary()', 'execute') as auth_can_rpc, -- want true
  has_function_privilege('authenticated', 'public.apply_liveness_result(uuid,numeric,text)', 'execute') as auth_can_verify; -- want false
