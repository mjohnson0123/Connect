-- PENDING — apply when the Supabase MCP connection is back.
-- The catalog was replaced by structured route input; demo riders must use
-- the same structured keys or new users won't match them.
-- Expected key after update: train:marc-penn:toward-washington

update public.trip_patterns set route_id = null, route_or_line = 'MARC Penn', direction = 'Toward Washington'
where user_id in (select id from public.profiles where is_demo) and mode = 'train';

update public.trip_patterns set route_id = null, route_or_line = 'BWI → BOS', direction = 'One way'
where user_id in (select id from public.profiles where is_demo) and mode = 'flight';

update public.trip_patterns set route_id = null, route_or_line = 'Gate C concourse (BWI)', direction = 'Regular'
where user_id in (select id from public.profiles where is_demo) and mode = 'place';
