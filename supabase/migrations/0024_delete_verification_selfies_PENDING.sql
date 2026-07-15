-- 0024 — Honor the privacy promise: verification selfies are deleted.
--
-- The verify screen and Safety Center promise the selfie is "deleted as soon
-- as it completes." It wasn't — 12 had accumulated in the private bucket.
-- This makes the promise literally true:
--   1. apply_liveness_result deletes the image the instant it records the
--      outcome (the real path). The metadata row keeps only confidence /
--      status / method — never the image or its path.
--   2. retention_sweep sweeps any straggler within the hour (the simulated
--      path, or an Edge Function that crashed between upload and delete).
--   3. One-time cleanup of everything already stored.
-- The verified selfie a user opts to show as their avatar is a SEPARATE copy
-- in the public 'avatars' bucket — untouched by this.

create or replace function public.apply_liveness_result(
  p_user uuid,
  p_confidence numeric,
  p_image_path text
) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_pass boolean := coalesce(p_confidence, 0) >= 80;
begin
  -- Record the outcome without retaining the image or its path — the selfie
  -- is biometric data we promise to delete once the check completes.
  insert into public.verifications (user_id, image_path, status, confidence, method)
  values (
    p_user,
    null,
    case when v_pass then 'approved' else 'rejected' end,
    p_confidence,
    'rekognition_face_liveness'
  );
  if p_image_path is not null then
    delete from storage.objects where bucket_id = 'verifications' and name = p_image_path;
  end if;
  if v_pass then
    perform set_config('app.allow_protected', '1', true);
    update public.profiles set verification_status = 'verified' where id = p_user;
    perform set_config('app.allow_protected', '0', true);
  end if;
  return v_pass;
end $$;

create or replace function public.retention_sweep()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.check_ins where active_until < now() - interval '1 day';
  update public.connection_requests set status = 'expired' where status = 'pending' and created_at < now() - interval '7 days';
  update public.connections set status = 'expired' where status = 'active' and last_activity_at < now() - interval '30 days';
  delete from public.messages m using public.connections c where m.connection_id = c.id and c.status = 'expired';
  delete from public.meetup_pins where expires_at < now() - interval '1 day' and verified_at is null;
  delete from public.trip_patterns tp
  where tp.one_off
    and tp.created_at < now() - interval '3 hours'
    and not exists (select 1 from public.check_ins c where c.pattern_id = tp.id and c.active_until > now());
  -- Safety net for the verification-selfie promise: nothing lingers past an hour.
  delete from storage.objects where bucket_id = 'verifications' and created_at < now() - interval '1 hour';
  update public.verifications set image_path = null
    where image_path is not null and created_at < now() - interval '1 hour';
end $$;

-- One-time cleanup of everything already stored.
delete from storage.objects where bucket_id = 'verifications';
update public.verifications set image_path = null where image_path is not null;

select
  (select count(*) from storage.objects where bucket_id = 'verifications') as remaining_selfies, -- want 0
  (select count(*) from public.verifications where image_path is not null) as rows_with_path;     -- want 0
