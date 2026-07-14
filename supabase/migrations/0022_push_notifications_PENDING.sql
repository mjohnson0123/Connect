-- 0022 — Push notifications for messages, requests, and accepts.
--
-- Devices register Expo push tokens (push_tokens, own-rows RLS). The RPCs
-- that create activity call notify_user(), which posts to Expo's push API
-- via pg_net (async queue — the user action never waits on delivery, and
-- notification failure never breaks the action). Lock-screen privacy:
-- requests are anonymous ("someone who shares your route"), messages show
-- the sender's first name (post-accept, names are mutual), never content.

create table if not exists public.push_tokens (
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);
alter table public.push_tokens enable row level security;
create policy push_tokens_own on public.push_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.push_tokens to authenticated;

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_user(p_user uuid, p_title text, p_body text, p_url text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_messages jsonb;
begin
  select jsonb_agg(jsonb_build_object(
      'to', t.token,
      'title', p_title,
      'body', p_body,
      'sound', 'default',
      'channelId', 'social',
      'data', jsonb_build_object('url', p_url)))
    into v_messages
  from public.push_tokens t
  where t.user_id = p_user;
  if v_messages is null then return; end if;
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := v_messages,
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb);
exception when others then
  null; -- a failed notification must never fail the user's action
end $$;
revoke execute on function public.notify_user(uuid, text, text, text) from public;
revoke execute on function public.notify_user(uuid, text, text, text) from anon;
revoke execute on function public.notify_user(uuid, text, text, text) from authenticated;
grant execute on function public.notify_user(uuid, text, text, text) to service_role;

-- send_message: unchanged behavior + notify the other member.
create or replace function public.send_message(p_connection_id uuid, p_content text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_viol text[]; v_recent int; v_other uuid; v_name text;
begin
  if not public.is_member(p_connection_id, auth.uid()) then raise exception 'not a member'; end if;
  if not public.standing_ok(auth.uid()) then return jsonb_build_object('ok', false, 'error', 'Your account is restricted.'); end if;
  if exists (select 1 from public.connections where id = p_connection_id and (status <> 'active' or last_activity_at < now() - interval '30 days')) then
    return jsonb_build_object('ok', false, 'error', 'This conversation has expired.');
  end if;
  v_viol := public.msg_violations(p_content);
  if array_length(v_viol, 1) is not null then
    insert into public.filter_violations (user_id, violations) values (auth.uid(), v_viol);
    select count(*) into v_recent from public.filter_violations where user_id = auth.uid() and created_at > now() - interval '30 days';
    if v_recent = 3 then
      insert into public.reports (reporter_id, reported_id, category, context, sla_hours)
        values ('00000000-0000-0000-0000-000000000000', auth.uid(), 'solicitation',
                'Automated: 3 blocked message attempts (contact info / solicitation patterns).', 72);
    end if;
    return jsonb_build_object('ok', false, 'violations', to_jsonb(v_viol));
  end if;
  insert into public.messages (connection_id, sender_id, content) values (p_connection_id, auth.uid(), left(p_content, 2000));
  update public.connections set last_activity_at = now() where id = p_connection_id;

  select case when c.user_a = auth.uid() then c.user_b else c.user_a end into v_other
    from public.connections c where c.id = p_connection_id;
  select split_part(display_name, ' ', 1) into v_name from public.profiles where id = auth.uid();
  perform public.notify_user(v_other, 'New message',
    coalesce(nullif(v_name, ''), 'Your connection') || ' sent you a message.',
    '/chat/' || p_connection_id);

  return jsonb_build_object('ok', true);
end $$;

-- send_request: unchanged behavior + anonymous notify (names stay hidden
-- until accept — the lock screen must not leak them either).
create or replace function public.send_request(p_to uuid, p_reason text, p_intro text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_sent_today int;
begin
  if not public.standing_ok(auth.uid()) then return jsonb_build_object('ok', false, 'error', 'Your account is restricted.'); end if;
  if public.is_blocked(auth.uid(), p_to) then return jsonb_build_object('ok', false, 'error', 'You can''t contact this person.'); end if;
  if array_length(public.msg_violations(coalesce(p_intro,'')), 1) is not null then
    return jsonb_build_object('ok', false, 'error', 'Intros can''t include contact info, links, or pitches.');
  end if;
  select count(*) into v_sent_today from public.connection_requests
    where from_user = auth.uid() and created_at >= date_trunc('day', now());
  if v_sent_today >= 10 then return jsonb_build_object('ok', false, 'error', 'Daily limit reached — up to 10 requests per day.'); end if;
  if exists (select 1 from public.connections c where (c.user_a = least(auth.uid(), p_to) and c.user_b = greatest(auth.uid(), p_to)) and c.status = 'active') then
    return jsonb_build_object('ok', false, 'error', 'You are already connected.');
  end if;
  begin
    insert into public.connection_requests (from_user, to_user, reason_tag, intro_text)
      values (auth.uid(), p_to, p_reason, left(coalesce(p_intro,''), 200));
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'You already have a pending request to this person.');
  end;

  perform public.notify_user(p_to, 'New connection request',
    'Someone who shares your route wants to connect. Review it in Connect.',
    '/connections');

  return jsonb_build_object('ok', true);
end $$;

-- respond_request: unchanged behavior + notify the requester on accept
-- (post-accept, names are mutually revealed — the notification may carry it).
create or replace function public.respond_request(p_request_id uuid, p_accept boolean)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_req public.connection_requests; v_conn_id uuid; v_name text;
begin
  select * into v_req from public.connection_requests where id = p_request_id and to_user = auth.uid() and status = 'pending';
  if v_req is null then raise exception 'request not found'; end if;
  update public.connection_requests set status = case when p_accept then 'accepted' else 'declined' end where id = p_request_id;
  if not p_accept then return null; end if;
  insert into public.connections (user_a, user_b)
    values (least(v_req.from_user, v_req.to_user), greatest(v_req.from_user, v_req.to_user))
    on conflict (user_a, user_b) do update set status = 'active', last_activity_at = now()
    returning id into v_conn_id;

  select display_name into v_name from public.profiles where id = v_req.to_user;
  perform public.notify_user(v_req.from_user, 'You''re connected',
    coalesce(nullif(v_name, ''), 'Your request') || ' accepted — say hello.',
    '/chat/' || v_conn_id);

  return v_conn_id;
end $$;

select
  (select count(*) from pg_proc where proname = 'notify_user') as has_notify,
  (select count(*) from pg_extension where extname = 'pg_net') as has_pg_net,
  has_table_privilege('authenticated', 'public.push_tokens', 'insert') as tokens_writable;
