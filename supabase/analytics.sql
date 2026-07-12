-- Commuter Connect — founder stats pack.
-- Paste any block into Supabase → SQL Editor and run. Real users only
-- (is_demo excluded) unless noted. These map to the PRD §12 success metrics.

-- ── Top-line snapshot ────────────────────────────────────────────────────────
select
  (select count(*) from public.profiles where not is_demo) as total_users,
  (select count(*) from public.profiles where not is_demo and verification_status = 'verified') as verified_users,
  (select count(*) from public.profiles where not is_demo and avatar_url is not null) as with_photo,
  (select count(*) from public.check_ins where active_until > now()) as live_now,
  (select count(*) from public.connections where status = 'active') as active_connections,
  (select count(*) from public.meetup_pins where verified_at is not null) as verified_meetups;

-- ── Signups per day (last 30d) ───────────────────────────────────────────────
select date_trunc('day', created_at)::date as day, count(*) as signups
from public.profiles
where not is_demo and created_at > now() - interval '30 days'
group by 1 order by 1 desc;

-- ── DENSITY by route (the number that decides if this works, §12) ────────────
-- Members = distinct people with a pattern; live = checked in right now.
select
  split_part(tp.rkey, ':', 1) as mode,
  tp.route_or_line, tp.direction,
  count(distinct tp.user_id) as members,
  count(distinct ci.user_id) filter (where ci.active_until > now()) as live_now
from public.trip_patterns tp
left join public.check_ins ci on ci.rkey = tp.rkey
join public.profiles p on p.id = tp.user_id and not p.is_demo
group by tp.rkey, tp.route_or_line, tp.direction
order by members desc, live_now desc;

-- ── Funnel: request → accept rate (double opt-in conversion, §12) ────────────
select
  count(*) as requests_sent,
  count(*) filter (where status = 'accepted') as accepted,
  round(100.0 * count(*) filter (where status = 'accepted') / nullif(count(*), 0), 1) as accept_rate_pct
from public.connection_requests
where from_user in (select id from public.profiles where not is_demo);

-- ── % of check-ins that drew ≥1 request (§12 headline funnel metric) ─────────
-- Approximate: check-ins whose user received a request during the window.
with ci as (
  select c.user_id, c.active_from, c.active_until
  from public.check_ins c join public.profiles p on p.id = c.user_id and not p.is_demo
)
select
  count(*) as total_checkins,
  count(*) filter (where exists (
    select 1 from public.connection_requests r
    where r.to_user = ci.user_id and r.created_at between ci.active_from and ci.active_until
  )) as checkins_with_request,
  round(100.0 * count(*) filter (where exists (
    select 1 from public.connection_requests r
    where r.to_user = ci.user_id and r.created_at between ci.active_from and ci.active_until
  )) / nullif(count(*), 0), 1) as pct
from ci;

-- ── Reports per 1,000 messages (solicitation health, §12) ────────────────────
select
  (select count(*) from public.messages) as messages,
  (select count(*) from public.reports) as reports,
  round(1000.0 * (select count(*) from public.reports) / nullif((select count(*) from public.messages), 0), 2) as reports_per_1k_msgs;

-- ── Meetup pulse: did real meetings happen and go well? ──────────────────────
select rating, count(*) from public.meetup_feedback group by rating;

-- ── Moderation: open reports past or nearing SLA ─────────────────────────────
select r.id, r.category, r.sla_hours, r.created_at,
  round(extract(epoch from now() - r.created_at) / 3600, 1) as hours_open,
  (extract(epoch from now() - r.created_at) / 3600) > r.sla_hours as breached,
  p.display_name as reported, p.strikes, p.standing
from public.reports r join public.profiles p on p.id = r.reported_id
where r.status = 'open'
order by breached desc, hours_open desc;

-- ── Retention: users who checked in again ≥24h after their first check-in ────
with firsts as (
  select user_id, min(active_from) as first_ci
  from public.check_ins group by user_id
)
select
  count(*) as users_who_checked_in,
  count(*) filter (where exists (
    select 1 from public.check_ins c
    where c.user_id = firsts.user_id and c.active_from > firsts.first_ci + interval '24 hours'
  )) as returned,
  round(100.0 * count(*) filter (where exists (
    select 1 from public.check_ins c
    where c.user_id = firsts.user_id and c.active_from > firsts.first_ci + interval '24 hours'
  )) / nullif(count(*), 0), 1) as retention_pct
from firsts join public.profiles p on p.id = firsts.user_id and not p.is_demo;
