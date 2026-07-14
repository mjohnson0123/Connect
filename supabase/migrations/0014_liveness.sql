-- 0014 — Real liveness verification (Rekognition Face Liveness).
-- Run in the SQL Editor (or via MCP) as one batch.
--
-- Architecture: the `liveness` Edge Function is the only component holding
-- AWS credentials. It creates a Face Liveness session for the signed-in user,
-- fetches the scored result, stores the reference image in the private
-- verifications bucket, and calls apply_liveness_result() with the service
-- role. That RPC is the single write-path to verified status; clients can't
-- call it. The old simulated path stays available behind a kill switch so
-- web previews and demo seeds keep working until launch — flipping one row
-- turns it off everywhere.

-- App-level config, readable only by security-definer helpers (RLS with no
-- policies denies all client access; service role bypasses).
create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;

insert into public.app_config (key, value)
values ('allow_simulated_verification', 'true')
on conflict (key) do nothing;

create or replace function public.simulated_verification_allowed()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (select value from public.app_config where key = 'allow_simulated_verification') = 'true',
    false
  );
$$;

-- Score + method audit trail on verification records.
alter table public.verifications add column if not exists confidence numeric;
alter table public.verifications
  add column if not exists method text not null default 'simulated';

-- THE real path: called only by the Edge Function (service role). Records the
-- scored attempt and flips the profile only when Rekognition is confident
-- enough. 80 is AWS's recommended baseline for Face Liveness.
create or replace function public.apply_liveness_result(
  p_user uuid,
  p_confidence numeric,
  p_image_path text
) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_pass boolean := coalesce(p_confidence, 0) >= 80;
begin
  insert into public.verifications (user_id, image_path, status, confidence, method)
  values (
    p_user,
    p_image_path,
    case when v_pass then 'approved' else 'rejected' end,
    p_confidence,
    'rekognition_face_liveness'
  );
  if v_pass then
    perform set_config('app.allow_protected', '1', true);
    update public.profiles set verification_status = 'verified' where id = p_user;
    perform set_config('app.allow_protected', '0', true);
  end if;
  return v_pass;
end $$;

revoke execute on function public.apply_liveness_result(uuid, numeric, text) from public;
revoke execute on function public.apply_liveness_result(uuid, numeric, text) from anon;
revoke execute on function public.apply_liveness_result(uuid, numeric, text) from authenticated;
grant execute on function public.apply_liveness_result(uuid, numeric, text) to service_role;

-- Gate the simulated paths behind the kill switch.
create or replace function public.submit_verification(p_image_path text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.simulated_verification_allowed() then
    raise exception 'Simulated verification is disabled. Use the in-app face check.';
  end if;
  insert into public.verifications (user_id, image_path, method)
  values (auth.uid(), p_image_path, 'simulated');
  perform set_config('app.allow_protected', '1', true);
  update public.profiles set verification_status = 'verified' where id = auth.uid();
  perform set_config('app.allow_protected', '0', true);
end $$;

create or replace function public.complete_verification()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.simulated_verification_allowed() then
    raise exception 'Simulated verification is disabled. Use the in-app face check.';
  end if;
  perform set_config('app.allow_protected', '1', true);
  update public.profiles set verification_status = 'verified' where id = auth.uid();
  perform set_config('app.allow_protected', '0', true);
end $$;

-- LAUNCH DAY: run this one line to close the simulated path for good.
--   update public.app_config set value = 'false', updated_at = now()
--     where key = 'allow_simulated_verification';

select
  (select count(*) from public.app_config where key = 'allow_simulated_verification') as has_kill_switch,
  (select count(*) from pg_proc where proname = 'apply_liveness_result') as has_liveness_rpc;
