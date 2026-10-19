create table public.groups (
  id text primary key,
  name text not null,
  owner_id text not null references public.users (id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);
create index groups_owner_id_idx on public.groups (owner_id);

create table public.group_members (
  group_id text not null references public.groups (id) on delete cascade,
  user_id text not null references public.users (id) on delete cascade,
  role text not null check (role in ('leader', 'member')),
  budget_max numeric check (budget_max is null or budget_max >= 0),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_id_idx on public.group_members (user_id);

create table public.shortlist_items (
  group_id text not null references public.groups (id) on delete cascade,
  floor_plan_id text not null references public.floor_plans (id) on delete cascade,
  added_by text not null,
  note text,
  created_at timestamptz not null default now(),
  primary key (group_id, floor_plan_id)
);
create index shortlist_items_floor_plan_id_idx on public.shortlist_items (floor_plan_id);
create index shortlist_items_added_by_idx on public.shortlist_items (added_by);

create table public.votes (
  group_id text not null references public.groups (id) on delete cascade,
  user_id text not null references public.users (id) on delete cascade,
  floor_plan_id text not null references public.floor_plans (id) on delete cascade,
  value smallint not null check (value in (-1, 0, 1)),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id, floor_plan_id)
);
create index votes_user_id_idx on public.votes (user_id);
create index votes_floor_plan_id_idx on public.votes (floor_plan_id);
