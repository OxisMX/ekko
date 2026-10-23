-- LOCAL ONLY. Server-side latency of the hot RPCs on the scale dataset (seed-scale.sql).
--   docker exec -i supabase_db_ekko psql -U postgres -v ON_ERROR_STOP=1 < scripts/perf/bench-rpcs.sql
-- Each call runs as the real role (authenticated + JWT claims, like the pgTAP helpers) and is timed with
-- clock_timestamp(), so it measures the function body (planning + execution), not HTTP/PostgREST.
-- Everything is rolled back at the end; writes inside an iteration are undone by a subtransaction.
begin;

create temp table bench_res (name text, ms double precision);
create temp table bench_ctx as
select (select count(*) from public.visit_qr_tokens t where t.merchant_id = m.id) as tokens, m.id as merchant_id, m.auth_user_id
from public.merchants m where m.name like 'Perf %' order by 1 desc limit 1;

-- Admin session of the busiest merchant (get_metrics / list_qr_log require it, RN-64).
insert into private.merchant_admin_sessions (merchant_id, auth_session_id, expires_at)
select merchant_id, '99999999-9999-9999-9999-999999999999', now() + interval '1 hour' from bench_ctx;

-- Customers with a real Auth user and at least one relation.
create temp table bench_cust as
select row_number() over (order by c.auth_user_id) as k, c.id as customer_id, c.auth_user_id
from public.customers c where c.auth_user_id::text like '12000000-%';

-- Reads --------------------------------------------------------------------------------------
do $$
declare
  n constant int := 200;
  v_cust record; v_mid uuid; t0 timestamptz; r jsonb; v_code text;
  v_merchant record := (select b from bench_ctx b);
  v_times jsonb := '{}';
begin
  for i in 1..n loop
    select * into v_cust from bench_cust where bench_cust.k = 1 + (i - 1) % 200;
    select merchant_id into v_mid from public.customer_merchants where customer_id = v_cust.customer_id limit 1;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_cust.auth_user_id, 'role', 'authenticated',
      'app_metadata', '{"role":"customer"}'::jsonb)::text, true);
    set local role authenticated;

    t0 := clock_timestamp(); perform public.list_my_cards();
    reset role; insert into bench_res values ('list_my_cards', extract(epoch from clock_timestamp() - t0) * 1000); set local role authenticated;

    t0 := clock_timestamp(); perform public.get_merchant_detail(v_mid);
    reset role; insert into bench_res values ('get_merchant_detail', extract(epoch from clock_timestamp() - t0) * 1000); set local role authenticated;

    t0 := clock_timestamp(); perform public.list_merchants('seed' || i, null, null, 0, 10);
    reset role; insert into bench_res values ('list_merchants (page 1)', extract(epoch from clock_timestamp() - t0) * 1000); set local role authenticated;

    t0 := clock_timestamp(); perform public.list_merchants('seed' || i, 'cafeteria', null, 0, 10);
    reset role; insert into bench_res values ('list_merchants (search)', extract(epoch from clock_timestamp() - t0) * 1000); set local role authenticated;

    t0 := clock_timestamp(); perform public.list_my_coupons();
    reset role; insert into bench_res values ('list_my_coupons', extract(epoch from clock_timestamp() - t0) * 1000);
  end loop;

  -- Merchant side: busiest merchant, JWT with session_id.
  select c.code into v_code from public.coupons c
  where c.merchant_id = v_merchant.merchant_id and c.status = 'active' and c.expires_at > now() limit 1;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_merchant.auth_user_id, 'role', 'authenticated',
    'session_id', '99999999-9999-9999-9999-999999999999',
    'app_metadata', jsonb_build_object('role', 'merchant', 'merchant_id', v_merchant.merchant_id))::text, true);
  for i in 1..n loop
    set local role authenticated;
    t0 := clock_timestamp(); perform public.get_metrics('all');
    reset role; insert into bench_res values ('get_metrics(all)', extract(epoch from clock_timestamp() - t0) * 1000); set local role authenticated;

    t0 := clock_timestamp(); perform public.get_metrics('30d');
    reset role; insert into bench_res values ('get_metrics(30d)', extract(epoch from clock_timestamp() - t0) * 1000); set local role authenticated;

    t0 := clock_timestamp(); perform public.list_qr_log(0, 20);
    reset role; insert into bench_res values ('list_qr_log (offset 0)', extract(epoch from clock_timestamp() - t0) * 1000); set local role authenticated;

    t0 := clock_timestamp(); perform public.list_qr_log(5000, 20);
    reset role; insert into bench_res values ('list_qr_log (offset 5000)', extract(epoch from clock_timestamp() - t0) * 1000); set local role authenticated;

    if v_code is not null then
      t0 := clock_timestamp(); perform public.lookup_redemption(v_code);
      reset role; insert into bench_res values ('lookup_redemption (hit)', extract(epoch from clock_timestamp() - t0) * 1000);
    else
      reset role;
    end if;
  end loop;
end $$;

-- lookup_redemption miss: updates the anti-guessing counter, undone per iteration.
do $$
declare v_merchant record := (select b from bench_ctx b); t0 timestamptz; v_ms double precision;
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_merchant.auth_user_id, 'role', 'authenticated',
    'session_id', '99999999-9999-9999-9999-999999999999',
    'app_metadata', jsonb_build_object('role', 'merchant', 'merchant_id', v_merchant.merchant_id))::text, true);
  for i in 1..200 loop
    begin
      set local role authenticated;
      t0 := clock_timestamp(); perform public.lookup_redemption('ZZZZZ' || (i % 9 + 2)::text);
      v_ms := extract(epoch from clock_timestamp() - t0) * 1000;
      reset role;
      raise exception using errcode = 'XRBCK';
    exception when sqlstate 'XRBCK' then null;
    end;
    insert into bench_res values ('lookup_redemption (miss)', v_ms);
  end loop;
end $$;

-- claim_visit: a fresh token per iteration, undone by a subtransaction so the dataset stays intact.
-- 'completing' forces the stamp that closes the card (coupon + roll_cycle).
do $$
declare
  v_cust record; v_mid uuid; v_token text; t0 timestamptz; v_ms double precision;
  v_digest constant text := repeat('ab', 32);
  v_completing boolean;
begin
  for i in 1..300 loop
    v_completing := i > 200;
    select * into v_cust from bench_cust where bench_cust.k = 1 + (i - 1) % 200;
    select cm.merchant_id into v_mid from public.customer_merchants cm
    where cm.customer_id = v_cust.customer_id
      and not exists (select 1 from public.stamps s where s.customer_id = cm.customer_id and s.merchant_id = cm.merchant_id
                      and not s.is_bonus and s.local_date = app.local_today())
    order by md5(cm.merchant_id::text || i) limit 1;
    continue when v_mid is null; -- every relation already stamped today (e.g. after claim-load.ts runs)
    v_token := 'bench-token-' || i;
    begin
      insert into public.visit_qr_tokens (merchant_id, token_hash, expires_at)
      values (v_mid, sha256(convert_to(v_token, 'UTF8')), now() + interval '1 hour');
      if v_completing then
        update public.card_cycles set stamps_count = stamps_required - 1
        where customer_id = v_cust.customer_id and merchant_id = v_mid and status = 'active';
      end if;
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_cust.auth_user_id, 'role', 'authenticated',
        'app_metadata', '{"role":"customer"}'::jsonb)::text, true);
      set local role authenticated;
      t0 := clock_timestamp(); perform public.claim_visit(v_token, v_digest);
      v_ms := extract(epoch from clock_timestamp() - t0) * 1000;
      reset role;
      raise exception using errcode = 'XRBCK';
    exception when sqlstate 'XRBCK' then null;
    end;
    insert into bench_res values (case when v_completing then 'claim_visit (completing stamp)' else 'claim_visit' end, v_ms);
  end loop;
end $$;

select name, count(*) as n,
       round(percentile_cont(0.5) within group (order by ms)::numeric, 2) as p50_ms,
       round(percentile_cont(0.95) within group (order by ms)::numeric, 2) as p95_ms,
       round(max(ms)::numeric, 2) as max_ms
from bench_res group by name order by name;
select tokens as busiest_merchant_tokens from bench_ctx;

rollback;
