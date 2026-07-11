-- Selfie verification pipeline: private storage + verification records.
-- Applied to project voqberiubbodifcctahi via MCP; kept here as the versioned
-- source of truth.
--
-- PRD §5.1/§7 note: images live in a PRIVATE bucket that only the service
-- role (the verification pipeline) can read — users can write only into
-- their own folder and cannot read anyone's images, including their own.
-- The pilot auto-approves after upload; production replaces the approval
-- with a liveness vendor webhook, and the retention job should then delete
-- images post-verification per the stated privacy policy.

insert into storage.buckets (id, name, public)
values ('verifications', 'verifications', false)
on conflict (id) do nothing;

create policy "verif_upload_own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'verifications'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  image_path text,
  status text not null default 'approved' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
alter table public.verifications enable row level security;
create policy verif_own_select on public.verifications for select using (user_id = auth.uid());

create or replace function public.submit_verification(p_image_path text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.verifications (user_id, image_path) values (auth.uid(), p_image_path);
  -- PILOT: auto-approve once a capture is recorded. Production: a liveness
  -- vendor webhook sets status and flips the profile instead.
  perform set_config('app.allow_protected', '1', true);
  update public.profiles set verification_status = 'verified' where id = auth.uid();
  perform set_config('app.allow_protected', '0', true);
end $$;
