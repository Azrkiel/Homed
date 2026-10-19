create table public.alerts (
  id text primary key,
  user_id text not null references public.users (id) on delete cascade,
  triggers text[] not null check (
    cardinality(triggers) > 0 and triggers <@ array['new_listing', 'price_drop', 'few_left']::text[]
  ),
  target jsonb not null,
  created_at timestamptz not null default now()
);
create index alerts_user_id_idx on public.alerts (user_id);

-- property_id / floor_plan_id have no FK: events outlive deleted listings in the JSON store.
create table public.alert_events (
  id text primary key,
  alert_id text not null references public.alerts (id) on delete cascade,
  user_id text not null references public.users (id) on delete cascade,
  trigger text not null check (trigger in ('new_listing', 'price_drop', 'few_left')),
  property_id text not null,
  floor_plan_id text,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index alert_events_alert_id_idx on public.alert_events (alert_id);
create index alert_events_user_id_idx on public.alert_events (user_id, created_at desc);
create index alert_events_property_id_idx on public.alert_events (property_id);
create index alert_events_floor_plan_id_idx on public.alert_events (floor_plan_id);

create table public.reviews (
  id text primary key,
  property_id text not null references public.properties (id) on delete cascade,
  user_id text not null references public.users (id) on delete cascade,
  ratings jsonb not null,
  text text not null,
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  landlord_reply text,
  created_at timestamptz not null default now(),
  unique (property_id, user_id)
);
create index reviews_user_id_idx on public.reviews (user_id);
create index reviews_status_idx on public.reviews (status);
