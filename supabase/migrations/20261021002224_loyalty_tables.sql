-- Backend §2.3. Deny-all RLS until migration 013 (policies).

create table public.customer_merchants (
  customer_id uuid not null references public.customers (id),
  merchant_id uuid not null references public.merchants (id),
  origin public.relation_origin not null,
  pending_extra_stamps smallint not null default 0 check (pending_extra_stamps >= 0),
  created_at timestamptz not null default app.now(),
  primary key (customer_id, merchant_id)
);

create table public.card_cycles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  merchant_id uuid not null references public.merchants (id),
  status public.cycle_status not null,
  -- WHY: config is copied when the cycle starts so later edits never change a running card (RN-29).
  stamps_required smallint not null,
  stamps_count smallint not null default 0,
  reward_title text not null,
  reward_description text not null,
  terms text not null,
  started_at timestamptz not null default app.now(),
  expires_at timestamptz not null,
  closed_at timestamptz
);

-- One active cycle per relation (TC-079).
create unique index card_cycles_one_active_idx
  on public.card_cycles (customer_id, merchant_id) where status = 'active';

create table public.visit_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id),
  -- WHY: only the SHA-256 is stored; the plain token never touches the database.
  token_hash bytea not null unique,
  created_at timestamptz not null default app.now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_customer_id uuid references public.customers (id),
  invalidated_at timestamptz
);

create table public.stamps (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.card_cycles (id),
  customer_id uuid not null references public.customers (id),
  merchant_id uuid not null references public.merchants (id),
  qr_token_id uuid references public.visit_qr_tokens (id),
  is_bonus boolean not null default false,
  local_date date not null,
  granted_at timestamptz not null default app.now()
);

-- RN-17: at most one visit stamp per local day; bonus stamps (RN-36) are exempt.
create unique index stamps_one_per_day_idx
  on public.stamps (customer_id, merchant_id, local_date) where is_bonus = false;

alter table public.customer_merchants enable row level security;
alter table public.card_cycles enable row level security;
alter table public.visit_qr_tokens enable row level security;
alter table public.stamps enable row level security;
