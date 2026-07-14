-- 0019 — Test bed: interests spread across riders on the founder's routes.
-- Route-scoped discovery means search only returns people sharing a route
-- with you — so the riders on MARC Penn (toward Washington) and at BWI now
-- cover a wide spread of fields, and four more riders join those routes.
-- Idempotent: fixed pattern ids, plain updates.

-- Interests + matching headlines for riders 106–120 (101–105 keep 0012's).
update public.profiles set industry_tags = array['Software Engineering','Data & AI'],        headline = 'Backend engineer, logistics startup'   where id = '11111111-1111-4111-8111-111111111106';
update public.profiles set industry_tags = array['Finance','Banking & Investment'],           headline = 'VP, municipal bonds'                   where id = '11111111-1111-4111-8111-111111111107';
update public.profiles set industry_tags = array['Transportation & Logistics','Government & Policy'], headline = 'Transit planner, MDOT'         where id = '11111111-1111-4111-8111-111111111108';
update public.profiles set industry_tags = array['Biotech & Pharma','Healthcare'],            headline = 'Clinical trials lead'                  where id = '11111111-1111-4111-8111-111111111109';
update public.profiles set industry_tags = array['Consulting','Operations'],                  headline = 'Ops consultant, federal practice'      where id = '11111111-1111-4111-8111-111111111110';
update public.profiles set industry_tags = array['Marketing','Media & Journalism'],           headline = 'Brand strategist'                      where id = '11111111-1111-4111-8111-111111111111';
update public.profiles set industry_tags = array['Entrepreneurship','Product Management'],    headline = 'Founder, commuter fintech'             where id = '11111111-1111-4111-8111-111111111112';
update public.profiles set industry_tags = array['Design & UX','Arts & Culture'],             headline = 'Product designer'                      where id = '11111111-1111-4111-8111-111111111113';
update public.profiles set industry_tags = array['Legal','Insurance'],                        headline = 'Counsel, insurance group'              where id = '11111111-1111-4111-8111-111111111114';
update public.profiles set industry_tags = array['Education','Nonprofit'],                    headline = 'Program director, education nonprofit' where id = '11111111-1111-4111-8111-111111111115';
update public.profiles set industry_tags = array['Energy','Engineering (non-software)'],      headline = 'Grid reliability engineer'             where id = '11111111-1111-4111-8111-111111111116';
update public.profiles set industry_tags = array['Human Resources','Sales'],                  headline = 'Head of talent'                        where id = '11111111-1111-4111-8111-111111111117';
update public.profiles set industry_tags = array['Real Estate','Construction'],               headline = 'Development manager'                   where id = '11111111-1111-4111-8111-111111111118';
update public.profiles set industry_tags = array['Data & AI','Academia & Research'],          headline = 'Research scientist, NLP'               where id = '11111111-1111-4111-8111-111111111119';
update public.profiles set industry_tags = array['Accounting','Retail & E-commerce'],         headline = 'Controller, retail chain'              where id = '11111111-1111-4111-8111-111111111120';

-- Four more riders onto MARC Penn (toward Washington), two more at BWI.
delete from public.trip_patterns where id in (
  '22222222-2222-4222-8222-222222222208','22222222-2222-4222-8222-222222222209',
  '22222222-2222-4222-8222-222222222210','22222222-2222-4222-8222-222222222211',
  '22222222-2222-4222-8222-222222222212','22222222-2222-4222-8222-222222222213');

insert into public.trip_patterns
  (id, user_id, mode, route_or_line, direction, days_of_week, window_start, window_end, station_or_code, one_off)
values
  ('22222222-2222-4222-8222-222222222208','11111111-1111-4111-8111-111111111113','train','MARC Penn','Toward Washington',array[1,2,3,4,5],'07:00','09:00','',false),
  ('22222222-2222-4222-8222-222222222209','11111111-1111-4111-8111-111111111115','train','MARC Penn','Toward Washington',array[1,2,3],'08:00','09:30','',false),
  ('22222222-2222-4222-8222-222222222210','11111111-1111-4111-8111-111111111117','train','MARC Penn','Toward Washington',array[2,4],'07:30','09:00','',false),
  ('22222222-2222-4222-8222-222222222211','11111111-1111-4111-8111-111111111119','train','MARC Penn','Toward Washington',array[1,2,3,4,5],'06:45','08:30','',false),
  ('22222222-2222-4222-8222-222222222212','11111111-1111-4111-8111-111111111118','place','Terminal A coffee (BWI)','Regular',array[1,2,3,4,5],'09:00','17:00','BWI',false),
  ('22222222-2222-4222-8222-222222222213','11111111-1111-4111-8111-111111111120','place','Observation deck (BWI)','Regular',array[6,0],'10:00','16:00','BWI',false);

-- A few live check-ins so route lists and live counts have bodies in them.
delete from public.check_ins where pattern_id in (
  '22222222-2222-4222-8222-222222222208','22222222-2222-4222-8222-222222222211',
  '22222222-2222-4222-8222-222222222212');
insert into public.check_ins (pattern_id, user_id, rkey, active_until)
select tp.id, tp.user_id, tp.rkey, now() + interval '30 days'
from public.trip_patterns tp
where tp.id in (
  '22222222-2222-4222-8222-222222222208','22222222-2222-4222-8222-222222222211',
  '22222222-2222-4222-8222-222222222212');

select
  (select count(distinct tp.user_id) from public.trip_patterns tp
     where tp.rkey = 'train:marc-penn:toward-washington') as marc_riders,
  (select count(distinct tp.user_id) from public.trip_patterns tp
     where tp.mode = 'place' and tp.station_or_code = 'BWI') as bwi_place_riders,
  (select count(distinct t) from public.profiles p, unnest(p.industry_tags) t where p.is_demo) as distinct_fields;
