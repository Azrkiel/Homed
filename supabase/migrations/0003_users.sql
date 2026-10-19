-- Users. Linked to auth.users by lower(email) only (no FK).
create table public.users (
  id text primary key,
  email text not null check (email = lower(email)),
  name text not null,
  role text not null check (role in ('student', 'landlord', 'admin')),
  class_year text check (class_year in ('first', 'second', 'third', 'fourth', 'grad', 'phd')),
  school text,
  major_id text,
  budget_max numeric check (budget_max is null or budget_max >= 0),
  weight_price numeric not null default 0.4 check (weight_price between 0 and 1),
  weight_location numeric not null default 0.4 check (weight_location between 0 and 1),
  weight_looks numeric not null default 0.2 check (weight_looks between 0 and 1),
  extras text[] not null default '{}',
  created_at timestamptz not null default now()
);
create unique index users_email_key on public.users (lower(email));
create index users_major_id_idx on public.users (major_id);

create table public.user_schedules (
  user_id text primary key references public.users (id) on delete cascade,
  mode text not null check (mode in ('major', 'schedule')),
  major_id text,
  entries jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
create index user_schedules_major_id_idx on public.user_schedules (major_id);

create table public.saves (
  user_id text not null references public.users (id) on delete cascade,
  floor_plan_id text not null references public.floor_plans (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  primary key (user_id, floor_plan_id)
);
create index saves_floor_plan_id_idx on public.saves (floor_plan_id);

-- No FK on floor_plan_id / group_id: the JSON store keeps swipes when a floor plan is deleted.
create table public.swipes (
  user_id text not null references public.users (id) on delete cascade,
  floor_plan_id text not null,
  direction text not null check (direction in ('right', 'left')),
  group_id text,
  created_at timestamptz not null default now()
);
create unique index swipes_user_plan_group_key
  on public.swipes (user_id, floor_plan_id, coalesce(group_id, ''));
create index swipes_floor_plan_id_idx on public.swipes (floor_plan_id);
create index swipes_group_id_idx on public.swipes (group_id);
