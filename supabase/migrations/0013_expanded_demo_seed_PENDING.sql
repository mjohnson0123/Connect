-- PENDING — apply after 0012, in Supabase → SQL Editor.
-- Expanded demo crowd so discovery (both interest and route) has real volume
-- to test against. 15 additional demo riders with overlapping industry tags
-- and a mix of routes. All are passwordless (can never log in). REMOVE THIS
-- ENTIRE SEED before public launch — delete where is_demo.

-- ── Auth users (passwordless) ────────────────────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change, raw_app_meta_data, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', v.id::uuid, 'authenticated', 'authenticated',
  v.email, '', now(), now(), now(), '', '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
from (values
  ('11111111-1111-4111-8111-111111111106','demo.neil@commuterconnect.invalid'),
  ('11111111-1111-4111-8111-111111111107','demo.tara@commuterconnect.invalid'),
  ('11111111-1111-4111-8111-111111111108','demo.omar@commuterconnect.invalid'),
  ('11111111-1111-4111-8111-111111111109','demo.lena@commuterconnect.invalid'),
  ('11111111-1111-4111-8111-111111111110','demo.raj@commuterconnect.invalid'),
  ('11111111-1111-4111-8111-111111111111','demo.gwen@commuterconnect.invalid'),
  ('11111111-1111-4111-8111-111111111112','demo.theo@commuterconnect.invalid'),
  ('11111111-1111-4111-8111-111111111113','demo.mai@commuterconnect.invalid'),
  ('11111111-1111-4111-8111-111111111114','demo.ben@commuterconnect.invalid'),
  ('11111111-1111-4111-8111-111111111115','demo.sofia@commuterconnect.invalid'),
  ('11111111-1111-4111-8111-111111111116','demo.kai@commuterconnect.invalid'),
  ('11111111-1111-4111-8111-111111111117','demo.nadia@commuterconnect.invalid'),
  ('11111111-1111-4111-8111-111111111118','demo.wes@commuterconnect.invalid'),
  ('11111111-1111-4111-8111-111111111119','demo.iris@commuterconnect.invalid'),
  ('11111111-1111-4111-8111-111111111120','demo.cole@commuterconnect.invalid')
) as v(id, email)
on conflict (id) do nothing;

-- ── Profiles (industry tags drawn from the INDUSTRIES vocab so they match) ───
update public.profiles set (display_name, monogram, headline, bio, industry_tags, reason_tags, verification_status, is_demo) =
  (v.dn, v.mono, v.hl, v.bio, v.ind, v.rsn, v.vs, true)
from (values
  ('11111111-1111-4111-8111-111111111106'::uuid,'Neil Park','NP','Backend engineer, health tech','Distributed systems for a hospital network. Glad to talk system design or breaking into health tech.',array['Software Engineering','Healthcare'],array['industry_peer','mentorship_give'],'verified'),
  ('11111111-1111-4111-8111-111111111107'::uuid,'Tara Voss','TV','Frontend lead, fintech','Design systems and web performance. Career-switched from journalism — happy to compare notes.',array['Software Engineering','Finance'],array['industry_peer','expanding_network'],'verified'),
  ('11111111-1111-4111-8111-111111111108'::uuid,'Omar Reyes','OR','Data scientist','ML for logistics. Always up for a data-modeling chat on the ride in.',array['Data & AI','Software Engineering'],array['industry_peer'],'verified'),
  ('11111111-1111-4111-8111-111111111109'::uuid,'Lena Cho','LC','Strategy consultant','Ex-banker, now advising growth-stage startups. Ask me about the transition.',array['Consulting','Finance'],array['mentorship_give','career_conversation'],'verified'),
  ('11111111-1111-4111-8111-111111111110'::uuid,'Raj Malhotra','RM','Operations consultant','Supply-chain and ops turnarounds. Open to swapping war stories.',array['Consulting','Operations'],array['industry_peer','expanding_network'],'pending'),
  ('11111111-1111-4111-8111-111111111111'::uuid,'Gwen Ellis','GE','Investment analyst','Public equities, healthcare coverage. Happy to talk markets or breaking in.',array['Banking & Investment','Finance'],array['mentorship_give','industry_peer'],'verified'),
  ('11111111-1111-4111-8111-111111111112'::uuid,'Theo Brandt','TB','Corporate accountant','Close cycles and controls. Studying for the CPA — glad to help others on that path.',array['Accounting','Finance'],array['mentorship_receive'],'verified'),
  ('11111111-1111-4111-8111-111111111113'::uuid,'Mai Tran','MT','ER physician','Emergency medicine. Curious about health policy and admin side conversations.',array['Healthcare'],array['career_conversation','expanding_network'],'verified'),
  ('11111111-1111-4111-8111-111111111114'::uuid,'Ben Ackerman','BA','Hospital administrator','Operations for a regional health system. Mentoring anyone eyeing healthcare ops.',array['Healthcare','Operations'],array['mentorship_give'],'verified'),
  ('11111111-1111-4111-8111-111111111115'::uuid,'Sofia Reyes','SR','Brand designer','Identity and campaigns for nonprofits. Love a good craft conversation.',array['Design & UX','Marketing'],array['industry_peer','expanding_network'],'verified'),
  ('11111111-1111-4111-8111-111111111116'::uuid,'Kai Johansson','KJ','Product designer','0-to-1 product design at a fintech. Portfolio reviews welcome.',array['Design & UX','Product Management'],array['mentorship_give','industry_peer'],'pending'),
  ('11111111-1111-4111-8111-111111111117'::uuid,'Nadia Ford','NF','Policy advisor','Federal tech policy. Happy to demystify how the Hill actually works.',array['Government & Policy','Legal'],array['mentorship_give'],'verified'),
  ('11111111-1111-4111-8111-111111111118'::uuid,'Wes Turner','WT','Corporate attorney','Commercial real estate deals. Open to career conversations for aspiring lawyers.',array['Legal','Real Estate'],array['career_conversation'],'verified'),
  ('11111111-1111-4111-8111-111111111119'::uuid,'Iris Bello','IB','University lecturer','Teach economics; research on labor markets. Glad to talk academia vs industry.',array['Education','Academia & Research'],array['expanding_network','career_conversation'],'verified'),
  ('11111111-1111-4111-8111-111111111120'::uuid,'Cole Barnes','CB','Nonprofit director','Run a workforce-development nonprofit. Always expanding the network.',array['Nonprofit','Operations'],array['expanding_network','industry_peer'],'verified')
) as v(id, dn, mono, hl, bio, ind, rsn, vs)
where profiles.id = v.id;

-- ── Trip patterns (mix so route discovery is dense too) ──────────────────────
-- MARC Penn, Toward Washington — the pilot corridor (matches the existing 4).
insert into public.trip_patterns (id, user_id, mode, route_id, route_or_line, direction, days_of_week, window_start, window_end, station_or_code)
values
  ('22222222-2222-4222-8222-222222222206','11111111-1111-4111-8111-111111111106','train',null,'MARC Penn','Toward Washington',array[1,2,3,4,5],'06:50','07:35','BAL'),
  ('22222222-2222-4222-8222-222222222207','11111111-1111-4111-8111-111111111107','train',null,'MARC Penn','Toward Washington',array[1,2,3,4,5],'07:05','07:50','BAL'),
  ('22222222-2222-4222-8222-222222222208','11111111-1111-4111-8111-111111111108','train',null,'MARC Penn','Toward Washington',array[1,2,3,4],'06:40','07:25','BAL'),
  ('22222222-2222-4222-8222-222222222209','11111111-1111-4111-8111-111111111109','train',null,'MARC Penn','Toward Washington',array[2,3,4],'07:00','07:45','BAL'),
  ('22222222-2222-4222-8222-222222222211','11111111-1111-4111-8111-111111111111','train',null,'MARC Penn','Toward Washington',array[1,2,3,4,5],'06:45','07:30','BAL'),
  ('22222222-2222-4222-8222-222222222213','11111111-1111-4111-8111-111111111113','train',null,'MARC Penn','Toward Washington',array[1,3,5],'07:10','07:55','BAL'),
  ('22222222-2222-4222-8222-222222222215','11111111-1111-4111-8111-111111111115','train',null,'MARC Penn','Toward Washington',array[1,2,3,4,5],'06:55','07:40','BAL'),
  ('22222222-2222-4222-8222-222222222217','11111111-1111-4111-8111-111111111117','train',null,'MARC Penn','Toward Washington',array[1,2,3,4],'07:00','07:45','BAL'),
  -- VRE Manassas, Toward Washington
  ('22222222-2222-4222-8222-222222222210','11111111-1111-4111-8111-111111111110','train',null,'VRE Manassas','Toward Washington',array[1,2,3,4,5],'06:30','07:30','MSS'),
  ('22222222-2222-4222-8222-222222222212','11111111-1111-4111-8111-111111111112','train',null,'VRE Manassas','Toward Washington',array[1,2,3,4,5],'06:45','07:45','MSS'),
  -- BWI -> BOS flight
  ('22222222-2222-4222-8222-222222222214','11111111-1111-4111-8111-111111111114','flight',null,'BWI → BOS','One way',array[1],'08:00','10:00','BWI'),
  ('22222222-2222-4222-8222-222222222216','11111111-1111-4111-8111-111111111116','flight',null,'BWI → BOS','One way',array[1],'08:00','10:00','BWI')
  -- Wes/Iris/Cole intentionally have NO route: they only appear via interest discovery.
on conflict (id) do nothing;

-- demo_bootstrap() already checks in every demo rider that has a pattern
-- (except Jules), so these light up on the board on next app open.
