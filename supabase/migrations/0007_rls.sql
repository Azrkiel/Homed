-- Row level security on every public table. The server uses the service role (bypasses RLS);
-- these policies protect direct client access with the anon key / a user JWT.
-- Identity: JWT email -> public.users.email (lower-cased).

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- Helpers are security definer so policies never recurse through RLS.
create function private.current_user_id() returns text
language sql stable security definer set search_path = '' as $$
  select u.id from public.users u
  where u.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1
$$;

create function private.is_group_member(gid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = gid and m.user_id = private.current_user_id()
  )
$$;

create function private.is_group_leader(gid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = gid and m.user_id = private.current_user_id() and m.role = 'leader'
  )
$$;

-- Leader (applications.user_id) or any application member linked by user id or email.
create function private.is_application_party(aid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.applications a
    where a.id = aid and a.user_id = private.current_user_id()
  ) or exists (
    select 1 from public.application_members m
    where m.application_id = aid
      and (m.user_id = private.current_user_id()
           or lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
$$;

create function private.is_application_leader(aid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.applications a
    where a.id = aid and a.user_id = private.current_user_id()
  )
$$;

-- Landlord who owns the property behind the application's floor plan; drafts are hidden.
create function private.landlord_sees_application(aid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.applications a
    join public.floor_plans f on f.id = a.floor_plan_id
    join public.properties p on p.id = f.property_id
    join public.landlords l on l.id = p.landlord_id
    where a.id = aid and a.status <> 'draft' and l.user_id = private.current_user_id()
  )
$$;

create function private.landlord_owns_property(pid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.properties p
    join public.landlords l on l.id = p.landlord_id
    where p.id = pid and l.user_id = private.current_user_id()
  )
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users u
    where u.id = private.current_user_id() and u.role = 'admin'
  )
$$;

grant execute on all functions in schema private to anon, authenticated, service_role;

-- Enable RLS everywhere.
alter table public.landlords enable row level security;
alter table public.properties enable row level security;
alter table public.floor_plans enable row level security;
alter table public.photos enable row level security;
alter table public.photo_ratings enable row level security;
alter table public.buildings enable row level security;
alter table public.landmarks enable row level security;
alter table public.majors enable row level security;
alter table public.major_buildings enable row level security;
alter table public.sections enable row level security;
alter table public.walk_times enable row level security;
alter table public.accessibility enable row level security;
alter table public.users enable row level security;
alter table public.user_schedules enable row level security;
alter table public.saves enable row level security;
alter table public.swipes enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.shortlist_items enable row level security;
alter table public.votes enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_events enable row level security;
alter table public.reviews enable row level security;
alter table public.applicant_profiles enable row level security;
alter table public.applications enable row level security;
alter table public.application_members enable row level security;
alter table public.application_documents enable row level security;

-- Catalog: readable by everyone.
create policy landlords_read on public.landlords for select to anon, authenticated using (true);
create policy properties_read on public.properties for select to anon, authenticated using (true);
create policy floor_plans_read on public.floor_plans for select to anon, authenticated using (true);
create policy photos_read on public.photos for select to anon, authenticated using (true);
create policy buildings_read on public.buildings for select to anon, authenticated using (true);
create policy landmarks_read on public.landmarks for select to anon, authenticated using (true);
create policy majors_read on public.majors for select to anon, authenticated using (true);
create policy major_buildings_read on public.major_buildings for select to anon, authenticated using (true);
create policy sections_read on public.sections for select to anon, authenticated using (true);
create policy walk_times_read on public.walk_times for select to anon, authenticated using (true);
create policy accessibility_read on public.accessibility for select to anon, authenticated using (true);

-- Landlords manage their own catalog rows.
create policy landlords_update_own on public.landlords for update to authenticated
  using (user_id = private.current_user_id()) with check (user_id = private.current_user_id());
create policy properties_landlord_write on public.properties for all to authenticated
  using (private.landlord_owns_property(id)) with check (private.landlord_owns_property(id));
create policy floor_plans_landlord_write on public.floor_plans for all to authenticated
  using (private.landlord_owns_property(property_id)) with check (private.landlord_owns_property(property_id));
create policy photos_landlord_write on public.photos for all to authenticated
  using (private.landlord_owns_property(property_id)) with check (private.landlord_owns_property(property_id));
create policy accessibility_landlord_write on public.accessibility for all to authenticated
  using (private.landlord_owns_property(property_id)) with check (private.landlord_owns_property(property_id));

-- Photo ratings: owner only.
create policy photo_ratings_own on public.photo_ratings for all to authenticated
  using (user_id = private.current_user_id()) with check (user_id = private.current_user_id());

-- Users: self only (admins read all).
create policy users_select_self on public.users for select to authenticated
  using (id = private.current_user_id() or private.is_admin());
create policy users_update_self on public.users for update to authenticated
  using (id = private.current_user_id()) with check (id = private.current_user_id());

create policy user_schedules_own on public.user_schedules for all to authenticated
  using (user_id = private.current_user_id()) with check (user_id = private.current_user_id());
create policy saves_own on public.saves for all to authenticated
  using (user_id = private.current_user_id()) with check (user_id = private.current_user_id());
create policy swipes_own on public.swipes for all to authenticated
  using (user_id = private.current_user_id()) with check (user_id = private.current_user_id());

-- Groups: members read; owner creates; leaders update/delete.
create policy groups_select_member on public.groups for select to authenticated
  using (private.is_group_member(id) or owner_id = private.current_user_id());
create policy groups_insert_owner on public.groups for insert to authenticated
  with check (owner_id = private.current_user_id());
create policy groups_update_leader on public.groups for update to authenticated
  using (private.is_group_leader(id)) with check (private.is_group_leader(id));
create policy groups_delete_leader on public.groups for delete to authenticated
  using (private.is_group_leader(id));

create policy group_members_select on public.group_members for select to authenticated
  using (private.is_group_member(group_id));
create policy group_members_update_self on public.group_members for update to authenticated
  using (user_id = private.current_user_id()) with check (user_id = private.current_user_id());
create policy group_members_delete on public.group_members for delete to authenticated
  using (user_id = private.current_user_id() or private.is_group_leader(group_id));

create policy shortlist_select on public.shortlist_items for select to authenticated
  using (private.is_group_member(group_id));
create policy shortlist_insert on public.shortlist_items for insert to authenticated
  with check (private.is_group_member(group_id) and added_by = private.current_user_id());
create policy shortlist_update on public.shortlist_items for update to authenticated
  using (private.is_group_member(group_id)) with check (private.is_group_member(group_id));
create policy shortlist_delete on public.shortlist_items for delete to authenticated
  using (private.is_group_member(group_id));

create policy votes_select on public.votes for select to authenticated
  using (private.is_group_member(group_id));
create policy votes_write_own on public.votes for all to authenticated
  using (user_id = private.current_user_id() and private.is_group_member(group_id))
  with check (user_id = private.current_user_id() and private.is_group_member(group_id));

-- Alerts: owner only.
create policy alerts_own on public.alerts for all to authenticated
  using (user_id = private.current_user_id()) with check (user_id = private.current_user_id());
create policy alert_events_select_own on public.alert_events for select to authenticated
  using (user_id = private.current_user_id());
create policy alert_events_update_own on public.alert_events for update to authenticated
  using (user_id = private.current_user_id()) with check (user_id = private.current_user_id());

-- Reviews: published are public; authors see their own; landlords see their property's; admins all.
create policy reviews_select on public.reviews for select to anon, authenticated
  using (
    status = 'published'
    or user_id = private.current_user_id()
    or private.landlord_owns_property(property_id)
    or private.is_admin()
  );
create policy reviews_insert_own on public.reviews for insert to authenticated
  with check (user_id = private.current_user_id() and status = 'pending');
create policy reviews_update_landlord on public.reviews for update to authenticated
  using (private.landlord_owns_property(property_id)) with check (private.landlord_owns_property(property_id));
create policy reviews_admin_all on public.reviews for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Applicant profiles: owner only.
create policy applicant_profiles_own on public.applicant_profiles for all to authenticated
  using (user_id = private.current_user_id()) with check (user_id = private.current_user_id());

-- Applications: leader / members; landlords see non-draft applications to their properties.
create policy applications_select on public.applications for select to authenticated
  using (private.is_application_party(id) or private.landlord_sees_application(id));
create policy applications_insert_leader on public.applications for insert to authenticated
  with check (user_id = private.current_user_id() and status = 'draft');
create policy applications_update_leader on public.applications for update to authenticated
  using (user_id = private.current_user_id()) with check (user_id = private.current_user_id());
create policy applications_update_landlord on public.applications for update to authenticated
  using (private.landlord_sees_application(id)) with check (private.landlord_sees_application(id));

-- Members: parties see each other (invite_token column is revoked below); leader manages.
create policy application_members_select on public.application_members for select to authenticated
  using (private.is_application_party(application_id) or private.landlord_sees_application(application_id));
create policy application_members_insert_leader on public.application_members for insert to authenticated
  with check (private.is_application_leader(application_id));
create policy application_members_update on public.application_members for update to authenticated
  using (
    private.is_application_leader(application_id)
    or user_id = private.current_user_id()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    private.is_application_leader(application_id)
    or user_id = private.current_user_id()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Documents: metadata visible to the member who owns it and to the leader; ciphertext never.
create policy application_documents_select on public.application_documents for select to authenticated
  using (exists (
    select 1 from public.application_members m
    where m.id = member_id
      and (m.user_id = private.current_user_id()
           or lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
           or private.is_application_leader(m.application_id))
  ));
create policy application_documents_delete_own on public.application_documents for delete to authenticated
  using (exists (
    select 1 from public.application_members m
    where m.id = member_id and m.user_id = private.current_user_id()
  ));

-- Explicit table grants (idempotent with Supabase defaults); RLS policies then narrow access.
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- Column privileges: sensitive columns are not selectable through the API by anyone but service_role.
revoke select on public.applicant_profiles from anon, authenticated;
grant select (user_id, legal_name, phone, current_address, student_status, expected_graduation, id_verified, updated_at)
  on public.applicant_profiles to authenticated;

revoke select on public.application_documents from anon, authenticated;
grant select (id, member_id, filename, mime, storage_key, delete_after, created_at)
  on public.application_documents to authenticated;

-- Invite tokens are secrets of the invitee; only the server resolves them.
revoke select on public.application_members from anon, authenticated;
grant select (id, application_id, kind, user_id, email, name, invite_status, done, guarantor_for, updated_at)
  on public.application_members to authenticated;

-- Anonymous visitors get nothing beyond catalog and published reviews.
revoke all on public.users, public.user_schedules, public.saves, public.swipes, public.groups,
  public.group_members, public.shortlist_items, public.votes, public.alerts, public.alert_events,
  public.applicant_profiles, public.applications, public.application_members,
  public.application_documents, public.photo_ratings from anon;
revoke insert, update, delete on public.landlords, public.properties, public.floor_plans, public.photos,
  public.buildings, public.landmarks, public.majors, public.major_buildings, public.sections,
  public.walk_times, public.accessibility, public.reviews from anon;
