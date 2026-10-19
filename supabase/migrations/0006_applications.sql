-- sensitive_ciphertext / ciphertext hold application-level encrypted envelopes.
create table public.applicant_profiles (
  user_id text primary key references public.users (id) on delete cascade,
  legal_name text not null,
  phone text not null,
  current_address text not null,
  student_status text not null check (student_status in ('undergraduate', 'graduate', 'other')),
  expected_graduation text,
  id_verified boolean not null default false,
  sensitive_ciphertext text not null,
  updated_at timestamptz not null default now()
);

-- floor_plan_id / group_id have no FK: the JSON store leaves applications when those are deleted.
create table public.applications (
  id text primary key,
  user_id text not null references public.users (id) on delete cascade,
  group_id text,
  floor_plan_id text not null,
  batch_id text not null,
  batch_rank integer not null check (batch_rank between 1 and 3),
  status text not null default 'draft' check (status in
    ('draft', 'submitted', 'under_review', 'approved', 'waitlisted', 'denied', 'lease_sent', 'signed', 'withdrawn')),
  status_history jsonb not null default '[]',
  fees jsonb not null,
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index applications_user_id_idx on public.applications (user_id);
create index applications_group_id_idx on public.applications (group_id);
create index applications_floor_plan_id_idx on public.applications (floor_plan_id);
create index applications_batch_id_idx on public.applications (batch_id);

create table public.application_members (
  id text primary key,
  application_id text not null references public.applications (id) on delete cascade,
  kind text not null check (kind in ('leader', 'roommate', 'guarantor')),
  user_id text,
  email text not null,
  name text,
  invite_token text not null unique,
  invite_status text not null default 'pending' check (invite_status in ('pending', 'accepted')),
  done boolean not null default false,
  guarantor_for text,
  updated_at timestamptz not null default now()
);
create index application_members_application_id_idx on public.application_members (application_id);
create index application_members_user_id_idx on public.application_members (user_id);
create index application_members_email_idx on public.application_members (lower(email));
create index application_members_guarantor_for_idx on public.application_members (guarantor_for);

create table public.application_documents (
  id text primary key,
  member_id text not null references public.application_members (id) on delete cascade,
  filename text not null,
  mime text not null,
  storage_key text not null unique,
  delete_after date not null,
  ciphertext text not null,
  created_at timestamptz not null default now()
);
create index application_documents_member_id_idx on public.application_documents (member_id);
create index application_documents_delete_after_idx on public.application_documents (delete_after);

-- Private bucket for future file-based storage; v1 keeps ciphertext in the table.
insert into storage.buckets (id, name, public)
values ('application-docs', 'application-docs', false)
on conflict (id) do nothing;
