-- Backend §2.3. Deny-all RLS until migration 013 (policies).

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id),
  name text not null check (char_length(name) <= 30),
  position smallint not null
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id),
  category_id uuid not null references public.menu_categories (id) on delete restrict,
  name text not null check (char_length(name) <= 60),
  description text check (char_length(description) <= 200),
  price numeric(10, 2) not null check (price >= 0),
  image_path text,
  is_featured boolean not null default false,
  -- WHY: sold out only for the local day it was marked (RN-56), so it resets without a job.
  sold_out_on date,
  position smallint not null,
  created_at timestamptz not null default app.now(),
  updated_at timestamptz not null default app.now()
);

create table public.weekly_offers (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id),
  title text not null check (char_length(title) <= 60),
  description text not null check (char_length(description) <= 200),
  weekday smallint not null check (weekday between 1 and 7), -- ISO: 1 = Monday
  image_path text,
  position smallint not null
);

create table public.customer_devices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  device_hash bytea not null,
  platform public.device_platform not null,
  expo_push_token text,
  push_enabled boolean not null default false,
  last_seen_at timestamptz not null default app.now(),
  signed_out_at timestamptz,
  unique (customer_id, device_hash)
);

create trigger set_updated_at before update on public.products
  for each row execute function app.set_updated_at();

alter table public.menu_categories enable row level security;
alter table public.products enable row level security;
alter table public.weekly_offers enable row level security;
alter table public.customer_devices enable row level security;
