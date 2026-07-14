-- 0020 — One normalizer, one community per route.
--
-- Found via the test bed: the server's normalize_text never stripped filler
-- words (the client did), so "Penn Line" vs "Penn" — and "Washington DC" vs
-- "Washington" — produced different route keys and silently split the same
-- route into communities that never see each other. This migration:
--   1. Makes normalize_text mirror the client exactly (filler words + "dc",
--      arrow characters dropped).
--   2. Recomputes EVERY pattern's rkey in one shot (no cohort splits) and
--      re-points live check-ins.
--   3. Seeds MARC Camden (toward Washington) riders — the founder's actual
--      line — so the test bed matches their real board.

create or replace function public.normalize_text(s text)
returns text language sql immutable as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(lower(trim(s)),
        '\y(line|route|rte|train|bus|ferry|the|station|stop|terminal|dc)\y', ' ', 'g'),
      '[^a-z0-9]+', '-', 'g'))
$$;

-- Recompute all generated rkeys under the new normalizer (a no-op assignment
-- forces stored generated columns to re-evaluate), then re-point check-ins.
update public.trip_patterns set route_or_line = route_or_line;
update public.check_ins c
set rkey = tp.rkey
from public.trip_patterns tp
where tp.id = c.pattern_id and c.rkey is distinct from tp.rkey;

-- MARC Camden riders (the founder's line). Idempotent.
delete from public.trip_patterns where id in (
  '22222222-2222-4222-8222-222222222214','22222222-2222-4222-8222-222222222215',
  '22222222-2222-4222-8222-222222222216');
insert into public.trip_patterns
  (id, user_id, mode, route_or_line, direction, days_of_week, window_start, window_end, station_or_code, one_off)
values
  ('22222222-2222-4222-8222-222222222214','11111111-1111-4111-8111-111111111107','train','MARC Camden','Toward Washington',array[1,2,3,4,5],'07:00','09:00','',false),
  ('22222222-2222-4222-8222-222222222215','11111111-1111-4111-8111-111111111110','train','MARC Camden','Toward Washington',array[1,3,5],'07:30','09:30','',false),
  ('22222222-2222-4222-8222-222222222216','11111111-1111-4111-8111-111111111114','train','MARC Camden','Toward Washington DC',array[2,4],'08:00','09:30','',false);

delete from public.check_ins where pattern_id in (
  '22222222-2222-4222-8222-222222222214','22222222-2222-4222-8222-222222222216');
insert into public.check_ins (pattern_id, user_id, rkey, active_until)
select tp.id, tp.user_id, tp.rkey, now() + interval '30 days'
from public.trip_patterns tp
where tp.id in ('22222222-2222-4222-8222-222222222214','22222222-2222-4222-8222-222222222216');

select
  public.normalize_text('Toward Washington DC') = 'toward-washington' as dc_ok,          -- want true
  public.normalize_text('Penn Line') = 'penn' as filler_ok,                              -- want true
  (select count(distinct user_id) from public.trip_patterns
     where rkey = 'train:marc-camden:toward-washington') as camden_riders,               -- want 4 (3 demo + you)
  (select count(*) from public.check_ins c join public.trip_patterns tp on tp.id = c.pattern_id
     where c.rkey is distinct from tp.rkey) as stale_checkins;                           -- want 0
