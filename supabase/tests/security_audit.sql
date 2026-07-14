-- PASS 2 — Adversarial security audit (executable).
-- Last run: 2026-07-14 against the live project via SQL Editor — PASSED (no leaks).
-- Run via MCP execute_sql when the Supabase bridge is up. Creates two
-- throwaway users, attacks the RLS policies and RPCs from each side, raises
-- an exception on ANY leak, and cleans up after itself. All assertions run
-- as `authenticated` role with forged JWT claims — the same view a real
-- client has.
do $$
declare
  atk uuid := '44444444-4444-4444-8444-444444444401'; -- attacker
  vic uuid := '44444444-4444-4444-8444-444444444402'; -- victim
  v_conn uuid; v_req uuid; v_pattern uuid; v_res jsonb; v_cnt int; v_txt text;
begin
  -- setup: two users, victim has pattern + check-in + a private message thread with a demo rider
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data)
  values
    ('00000000-0000-0000-0000-000000000000', atk, 'authenticated','authenticated','sec.atk@cc.invalid','',now(),now(),now(),'','','','','{"provider":"email","providers":["email"]}','{}'),
    ('00000000-0000-0000-0000-000000000000', vic, 'authenticated','authenticated','sec.vic@cc.invalid','',now(),now(),now(),'','','','','{"provider":"email","providers":["email"]}','{}');

  perform set_config('role', 'authenticated', true);

  -- victim: verified, pattern, check-in, connection with Jules, one message
  perform set_config('request.jwt.claims', json_build_object('sub', vic, 'role','authenticated')::text, true);
  perform public.complete_verification();
  update public.profiles set display_name='Victim V', monogram='VV', headline='Target' where id = vic;
  insert into public.trip_patterns (user_id, mode, route_or_line, direction, days_of_week, window_start, window_end)
    values (vic, 'train', 'MARC Penn', 'Toward Washington', array[1,2,3], '07:00','08:00') returning id into v_pattern;
  perform public.check_in(v_pattern);
  perform public.demo_bootstrap();
  select id into v_req from public.connection_requests where to_user = vic and status='pending' limit 1;
  v_conn := public.respond_request(v_req, true);
  v_res := public.send_message(v_conn, 'secret meeting spot is car 3');

  -- attacker: verified but NOT on victim's route, no connection
  perform set_config('request.jwt.claims', json_build_object('sub', atk, 'role','authenticated')::text, true);
  perform public.complete_verification();
  update public.profiles set display_name='Attacker A', monogram='AA' where id = atk;

  -- 1) cannot read victim's profile (no connection, no pending request)
  select count(*) into v_cnt from public.profiles where id = vic;
  if v_cnt > 0 then raise exception 'LEAK: profile visible without relationship'; end if;

  -- 2) cannot read victim's messages, patterns, or check-ins
  select count(*) into v_cnt from public.messages;
  if v_cnt > 0 then raise exception 'LEAK: foreign messages readable'; end if;
  select count(*) into v_cnt from public.trip_patterns where user_id = vic;
  if v_cnt > 0 then raise exception 'LEAK: foreign patterns readable'; end if;
  select count(*) into v_cnt from public.check_ins where user_id = vic;
  if v_cnt > 0 then raise exception 'LEAK: foreign check-ins readable'; end if;

  -- 3) cannot see victim via route_people without sharing the route (attacker has no pattern)
  -- (route_people requires the caller's own pattern id — try using victim's)
  select count(*) into v_cnt from public.route_people(v_pattern);
  if v_cnt > 0 then raise exception 'LEAK: route_people works with someone else''s pattern id'; end if;

  -- 4) cannot send message into a connection they are not a member of
  begin
    v_res := public.send_message(v_conn, 'injected');
    raise exception 'LEAK: non-member sent message into foreign thread';
  exception when others then
    if sqlerrm like 'LEAK:%' then raise; end if; -- expected: not a member
  end;

  -- 5) cannot create/confirm PINs on a foreign connection
  begin
    v_res := public.create_pin(v_conn);
    raise exception 'LEAK: non-member created PIN';
  exception when others then
    if sqlerrm like 'LEAK:%' then raise; end if;
  end;

  -- 6) cannot escalate own profile: strikes/standing/operator/verified-bypass
  begin
    update public.profiles set is_operator = true where id = atk;
    raise exception 'LEAK: self-service operator escalation';
  exception when others then
    if sqlerrm like 'LEAK:%' then raise; end if;
  end;

  -- 7) operator surface refuses non-operators
  v_res := public.operator_overview();
  if not (v_res ? 'error') then raise exception 'LEAK: operator_overview open to all'; end if;

  -- 8) cannot resolve reports
  begin
    perform public.resolve_report(gen_random_uuid(), true);
    raise exception 'LEAK: non-operator resolved a report';
  exception when others then
    if sqlerrm like 'LEAK:%' then raise; end if;
  end;

  -- 9) cannot write rows as someone else (direct insert with forged user_id)
  begin
    insert into public.trip_patterns (user_id, mode, route_or_line, direction, days_of_week, window_start, window_end)
      values (vic, 'train', 'Forged', 'Toward X', array[1], '07:00','08:00');
    raise exception 'LEAK: inserted pattern as another user';
  exception when others then
    if sqlerrm like 'LEAK:%' then raise; end if;
  end;

  -- 10) blocked invisibility: victim blocks attacker after a request exists
  perform set_config('request.jwt.claims', json_build_object('sub', atk, 'role','authenticated')::text, true);
  insert into public.trip_patterns (user_id, mode, route_or_line, direction, days_of_week, window_start, window_end)
    values (atk, 'train', 'MARC Penn', 'Toward Washington', array[1,2,3], '07:00','08:00') returning id into v_pattern;
  perform public.check_in(v_pattern);
  perform set_config('request.jwt.claims', json_build_object('sub', vic, 'role','authenticated')::text, true);
  perform public.block_user(atk);
  perform set_config('request.jwt.claims', json_build_object('sub', atk, 'role','authenticated')::text, true);
  select count(*) into v_cnt from public.route_people(v_pattern) rp where rp.id = vic;
  if v_cnt > 0 then raise exception 'LEAK: blocked user still sees blocker in discovery'; end if;
  v_res := public.send_request(vic, 'industry_peer', 'hi');
  if (v_res->>'ok')::boolean then raise exception 'LEAK: blocked user can send requests'; end if;

  -- 11) storage policies: attacker cannot read the verifications bucket
  --     (objects table read via RLS; no select policy exists for users)
  select count(*) into v_cnt from storage.objects where bucket_id = 'verifications';
  if v_cnt > 0 then raise exception 'LEAK: verification images listable'; end if;

  -- cleanup (as postgres)
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  delete from auth.users where id in (atk, vic);
  raise notice 'SECURITY AUDIT PASSED — no leaks across 11 attack vectors';
end $$;
select 'security audit complete' as result;
