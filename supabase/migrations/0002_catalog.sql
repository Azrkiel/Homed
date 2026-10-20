-- Catalog tables. All ids are text (fixture ids and crypto.randomUUID() strings).

create table public.landlords (
  id text primary key,
  user_id text,
  name text not null,
  email text,
  phone text,
  website text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index landlords_user_id_key on public.landlords (user_id) where user_id is not null;

create table public.properties (
  id text primary key,
  slug text not null unique,
  name text not null,
  address text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  location extensions.geography(Point, 4326) generated always as
    (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  kind text not null check (kind in ('apartment_complex', 'house', 'on_grounds')),
  on_grounds boolean not null,
  neighborhood text not null,
  year_built integer,
  year_renovated integer,
  landlord_id text references public.landlords (id) on delete set null,
  website text,
  amenities jsonb not null,
  noise_level text check (noise_level in ('quiet', 'moderate', 'social')),
  lit_route_to_grounds boolean,
  on_bus_route boolean not null,
  bus_routes text[] not null default '{}',
  study_abroad_friendly boolean not null,
  no_guarantor_option boolean not null,
  grad_heavy boolean,
  on_grounds_info jsonb,
  source text not null,
  data_status text not null check (data_status in ('verified', 'unverified_seed')),
  last_verified date not null
);
create index properties_landlord_id_idx on public.properties (landlord_id);
create index properties_location_gix on public.properties using gist (location);

create table public.floor_plans (
  id text primary key,
  property_id text not null references public.properties (id) on delete cascade,
  name text not null,
  beds integer not null check (beds >= 0),
  baths numeric not null check (baths >= 0),
  sqft integer,
  rent_amount numeric not null check (rent_amount >= 0),
  rent_basis text not null check (rent_basis in ('per_bed', 'per_unit')),
  lease_start date not null,
  lease_end date not null,
  term_kind text not null check (term_kind in ('12_month', 'academic_year', 'semester', 'other')),
  lease_type text not null check (lease_type in ('individual', 'joint')),
  furnished boolean not null,
  furniture_monthly numeric,
  utilities_included boolean not null,
  utilities_estimate numeric,
  internet_included boolean not null,
  internet_estimate numeric,
  in_unit_laundry boolean not null,
  dishwasher boolean not null,
  ac boolean not null,
  units_available integer check (units_available is null or units_available >= 0),
  total_units integer,
  application_fee numeric,
  screening_cost numeric,
  application_deposit numeric,
  security_deposit numeric,
  floor_plan_image_url text,
  last_verified date not null
);
create index floor_plans_property_id_idx on public.floor_plans (property_id);

create table public.photos (
  id text primary key,
  property_id text not null references public.properties (id) on delete cascade,
  floor_plan_id text references public.floor_plans (id) on delete cascade,
  url text not null,
  alt text not null,
  is_rendering boolean not null,
  credit text,
  looks_rating numeric check (looks_rating is null or looks_rating between 1 and 5),
  rating_count integer not null default 0 check (rating_count >= 0)
);
create index photos_property_id_idx on public.photos (property_id);
create index photos_floor_plan_id_idx on public.photos (floor_plan_id);

-- user_id references public.users (created in 0003); no FK so the catalog stays independent.
create table public.photo_ratings (
  photo_id text not null references public.photos (id) on delete cascade,
  user_id text not null,
  rating integer not null check (rating between 1 and 5),
  primary key (photo_id, user_id)
);
create index photo_ratings_user_id_idx on public.photo_ratings (user_id);

create table public.buildings (
  id text primary key,
  code text not null,
  name text not null,
  entrance_lat double precision not null,
  entrance_lng double precision not null,
  kind text not null check (kind in ('academic', 'library', 'recreation', 'other'))
);

create table public.landmarks (
  id text primary key,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  kind text not null check (kind in ('social', 'library', 'dining', 'gym', 'grocery', 'worship', 'health', 'other')),
  tradition text
);

create table public.majors (
  id text primary key,
  name text not null,
  school text not null,
  meetings_per_week numeric not null check (meetings_per_week >= 0)
);

create table public.major_buildings (
  major_id text not null references public.majors (id) on delete cascade,
  building_id text not null,
  share numeric not null check (share >= 0 and share <= 1),
  primary key (major_id, building_id)
);
create index major_buildings_building_id_idx on public.major_buildings (building_id);

create table public.sections (
  id text primary key,
  term text not null,
  course_number text not null,
  title text,
  days text[] not null default '{}',
  start_time text not null check (start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  end_time text not null check (end_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  building_id text not null
);
create index sections_term_idx on public.sections (term);
create index sections_building_id_idx on public.sections (building_id);

create table public.walk_times (
  property_id text not null references public.properties (id) on delete cascade,
  target_id text not null,
  target_kind text not null check (target_kind in ('building', 'landmark')),
  walk_minutes numeric not null check (walk_minutes >= 0),
  bus_minutes numeric check (bus_minutes is null or bus_minutes >= 0),
  source text not null check (source in ('osrm', 'estimate')),
  primary key (property_id, target_id)
);
create index walk_times_target_id_idx on public.walk_times (target_id);

create table public.accessibility (
  property_id text primary key references public.properties (id) on delete cascade,
  features text[] not null default '{}',
  photo_confirmed text[] not null default '{}',
  accommodation_contact text,
  accommodation_process text,
  typical_response_days integer,
  service_animals_allowed boolean not null,
  esa_allowed boolean not null,
  no_fees boolean not null,
  updated_at date not null
);
