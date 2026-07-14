-- PENDING — apply when the Supabase connector is back.
-- The no-contact-info policy applies to profiles, not just messages: without
-- this trigger a user could put a phone number in their bio via direct API
-- call, bypassing the client check.
create or replace function public.guard_profile_content()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if array_length(public.msg_violations(
       coalesce(new.display_name,'') || ' ' || coalesce(new.headline,'') || ' ' ||
       coalesce(new.bio,'') || ' ' || array_to_string(coalesce(new.industry_tags,'{}'), ' ')), 1) is not null then
    raise exception 'profiles cannot include contact info, links, or solicitation';
  end if;
  return new;
end $$;

create trigger guard_profile_content before insert or update on public.profiles
  for each row execute function public.guard_profile_content();
