-- Backend §2.3. Deny-all RLS until migration 013 (policies).

create table public.wheel_spins (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  merchant_id uuid not null references public.merchants (id),
  prize_id uuid not null references private.wheel_prizes (id),
  device_hash bytea not null,
  email_hash bytea not null,
  spun_at timestamptz not null default app.now(),
  -- RN-07 / RN-09: one spin per customer, per device and per email hash, per merchant.
  unique (customer_id, merchant_id),
  unique (device_hash, merchant_id),
  unique (email_hash, merchant_id)
);

create table public.push_campaigns (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id),
  idempotency_key uuid not null,
  title text not null check (char_length(title) <= 50),
  body text not null check (char_length(body) <= 150),
  has_coupon boolean not null,
  coupon_title text,
  coupon_description text,
  coupon_terms text,
  coupon_validity_hours smallint check (coupon_validity_hours between 24 and 48),
  local_month date not null,
  status public.campaign_status not null,
  recipients_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default app.now(),
  unique (merchant_id, idempotency_key),
  constraint push_campaigns_coupon_fields_check check (
    not has_coupon
    or (coupon_title is not null and coupon_description is not null and coupon_terms is not null)
  )
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  merchant_id uuid not null references public.merchants (id),
  source public.coupon_source not null,
  cycle_id uuid unique references public.card_cycles (id),
  spin_id uuid unique references public.wheel_spins (id),
  campaign_id uuid references public.push_campaigns (id),
  birthday_year smallint,
  title text not null,
  description text not null,
  terms text,
  -- WHY: TRD 6.5 alphabet (23456789ABCDEFGHJKMNPQRSTUVWXYZ): no 0/O, 1/I/L to avoid misreads at the till.
  code char(6) not null check (code ~ '^[2-9A-HJKMNP-Z]{6}$'),
  status public.coupon_status not null default 'active',
  issued_at timestamptz not null default app.now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  unique (merchant_id, code),
  -- Exactly the origin column matching source is set.
  constraint coupons_origin_check check (
    num_nonnulls(cycle_id, spin_id, campaign_id, birthday_year) = 1
    and case source
      when 'card_reward' then cycle_id is not null
      when 'wheel' then spin_id is not null
      when 'push' then campaign_id is not null
      when 'birthday' then birthday_year is not null
    end
  )
);

create unique index coupons_push_once_idx
  on public.coupons (campaign_id, customer_id) where source = 'push';
create unique index coupons_birthday_once_idx
  on public.coupons (customer_id, merchant_id, birthday_year) where source = 'birthday';

alter table public.wheel_spins enable row level security;
alter table public.push_campaigns enable row level security;
alter table public.coupons enable row level security;
