-- WHY: defaults use app.now() instead of now() so the controllable clock (ADR-13) also covers created_at.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  first_name text check (char_length(first_name) between 2 and 50),
  last_name text check (char_length(last_name) between 2 and 50),
  -- WHY: no 18+ CHECK on birth_date. It would need current_date, which is volatile, ignores
  -- app.now() (ADR-13) and breaks TC-002/TC-003. 18+ is enforced in complete_profile (migration 010).
  birth_date date,
  email_verified_at timestamptz,
  auth_provider text not null,
  status public.customer_status not null default 'active',
  deleted_at timestamptz,
  created_at timestamptz not null default app.now(),
  updated_at timestamptz not null default app.now()
);

create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id),
  name text not null check (char_length(name) <= 40),
  category public.merchant_category not null,
  description text not null check (char_length(description) <= 140),
  address text not null,
  logo_path text not null,
  cover_path text not null,
  maps_url text not null,
  reviews_url text not null,
  birthday_benefit text,
  push_coupon_validity_hours smallint not null default 48
    check (push_coupon_validity_hours between 24 and 48),
  is_active boolean not null default false,
  is_visible boolean not null default false,
  subscription_status public.subscription_status not null,
  billing_period public.billing_period not null,
  paid_until date not null,
  created_at timestamptz not null default app.now(),
  updated_at timestamptz not null default app.now()
);

create table public.loyalty_programs (
  merchant_id uuid primary key references public.merchants (id),
  stamps_required smallint not null default 6 check (stamps_required between 4 and 10),
  cycle_months smallint not null default 6 check (cycle_months between 3 and 12),
  reward_title text not null check (char_length(reward_title) <= 60),
  reward_description text not null check (char_length(reward_description) <= 200),
  terms text not null check (char_length(terms) <= 1000),
  card_background_path text,
  updated_at timestamptz not null default app.now()
);

create table private.merchant_security (
  merchant_id uuid primary key references public.merchants (id) on delete cascade,
  pin_hash text not null,
  pin_failed_count smallint not null default 0,
  pin_locked_until timestamptz,
  code_failed_count smallint not null default 0,
  code_window_started_at timestamptz,
  validator_locked_until timestamptz,
  updated_at timestamptz not null default app.now()
);

create table private.merchant_admin_sessions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  auth_session_id uuid not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default app.now()
);

create table private.wheel_prizes (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  label text not null check (char_length(label) <= 30),
  prize_type public.wheel_prize_type not null,
  benefit_title text not null,
  benefit_description text not null,
  weight integer not null check (weight > 0),
  position smallint not null,
  is_active boolean not null default true,
  created_at timestamptz not null default app.now(),
  updated_at timestamptz not null default app.now()
);

-- private.email_verification_tokens is intentionally absent: own email verification is pending SP-7.

create trigger set_updated_at before update on public.customers
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.merchants
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.loyalty_programs
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on private.merchant_security
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on private.wheel_prizes
  for each row execute function app.set_updated_at();

-- Deny-all until the policies of migration 013.
alter table public.customers enable row level security;
alter table public.merchants enable row level security;
alter table public.loyalty_programs enable row level security;
