-- Lockdown: clients never write through the Data API.
--
-- Homed's server reaches Postgres only with the service role, and the adapter enforces every rule
-- (state machine, roles, invite flow, moderation). Browsers and the mobile app never call PostgREST
-- with a user JWT. 0007 still granted table-wide insert/update/delete to `authenticated`, so a user
-- holding their own JWT could, for example, set users.role = 'admin', mark their application part
-- done, promote themselves to group leader, forge an application status, or publish a review as a
-- landlord. Revoke all client writes; RLS policies remain as a second layer for reads.
-- If a client ever needs to write directly, grant it narrow column privileges in a new migration.

revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;

-- Peers must not read each other's budgets (members see only "over budget" in the app).
revoke select on public.group_members from authenticated;
grant select (group_id, user_id, role, joined_at) on public.group_members to authenticated;

-- Roommates see only done / not done for each other: no emails or names of co-members or guarantors.
revoke select on public.application_members from authenticated;
grant select (id, application_id, kind, user_id, invite_status, done, guarantor_for, updated_at)
  on public.application_members to authenticated;

-- Anonymous visitors don't learn who wrote a review or a landlord's login and contact email.
revoke select on public.reviews from anon;
grant select (id, property_id, ratings, text, status, landlord_reply, created_at) on public.reviews to anon;
revoke select on public.landlords from anon;
grant select (id, name, phone, website, verified, created_at) on public.landlords to anon;
