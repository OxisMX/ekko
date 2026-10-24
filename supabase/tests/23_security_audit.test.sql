begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- S14 audit (QA plan TC-203..TC-207). Everything is read from the catalogs, so tables and functions added
-- in later sprints are covered without touching this file. When a check fails for an intentional new
-- object, add it to the allowlist below with a WHY; otherwise fix the object.

create temp table app_functions as
select p.oid, n.nspname::text as schema_name, p.proname::text as name, p.prosecdef, p.provolatile, p.proconfig, p.prosrc, p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'app', 'private', 'rls')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');

create temp table app_relations as
select c.oid, n.nspname::text as schema_name, c.relname::text as name, c.relkind
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'private', 'app', 'rls') and c.relkind in ('r', 'p', 'v', 'm');

-- "Callable" = EXECUTE on the function and USAGE on its schema.
create function pg_temp.callable_by(p_role text) returns setof app_functions language sql as $$
  select f.* from app_functions f
  where has_function_privilege(p_role, f.oid, 'execute') and has_schema_privilege(p_role, f.schema_name, 'usage')
$$;

-- 1. RLS everywhere. No exceptions: private tables are also closed by schema privileges, RLS is the second lock.
select is_empty(
  $$ select schema_name || '.' || name from app_relations r join pg_class c on c.oid = r.oid
     where r.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'every table in public/private/app/rls has RLS enabled'
);

-- 2. anon: no privileges at all on any table/view of our schemas (the app requires a session for everything).
select is_empty(
  $$ select name from app_relations
     where has_any_column_privilege('anon', oid, 'select,insert,update,references')
        or has_table_privilege('anon', oid, 'delete,truncate,trigger') $$,
  'anon has no privilege on any table or view'
);
select is_empty(
  $$ select schema_name from (values ('private'), ('app')) s(schema_name)
     where has_schema_privilege('anon', schema_name, 'usage') or has_schema_privilege('authenticated', schema_name, 'usage') $$,
  'private and app schemas are closed to API roles'
);

-- 3. authenticated never writes tables directly (RN-66, TC-204): all writes go through RPCs.
select is_empty(
  $$ select name from app_relations
     where has_any_column_privilege('authenticated', oid, 'insert,update,references')
        or has_table_privilege('authenticated', oid, 'delete,truncate,trigger') $$,
  'authenticated has no write privilege on any table'
);

-- WHY allowlist: these are read through policies (catalog, Realtime for the panel QR). Everything else
-- (customers, coupons, stamps, wheel_spins, ...) is RPC-only.
select is_empty(
  $$ select name from app_relations
     where has_any_column_privilege('authenticated', oid, 'select')
       and not (schema_name = 'public' and name in
         ('merchants', 'loyalty_programs', 'menu_categories', 'products', 'weekly_offers', 'visit_qr_tokens')) $$,
  'authenticated can only read the catalog tables and visit_qr_tokens'
);

-- Column privileges (RN-38, RN-66, RN-70): secrets and billing never reach API roles.
select is_empty(
  $$ select t.tbl || '.' || t.col
     from (values ('coupons', 'code'), ('wheel_spins', 'email_hash'), ('wheel_spins', 'device_hash'),
                  ('customer_devices', 'expo_push_token'), ('customer_devices', 'device_hash'),
                  ('visit_qr_tokens', 'token_hash'), ('visit_qr_tokens', 'used_by_customer_id'),
                  ('visit_qr_tokens', 'claim_result'), ('merchants', 'billing_period'),
                  ('merchants', 'paid_until'), ('merchants', 'subscription_status'),
                  ('customers', 'birth_date'), ('customers', 'last_name')) t(tbl, col)
     where has_column_privilege('authenticated', ('public.' || t.tbl)::regclass, t.col, 'select')
        or has_column_privilege('anon', ('public.' || t.tbl)::regclass, t.col, 'select') $$,
  'sensitive columns are not selectable by API roles'
);

-- 4. Functions: fixed search_path everywhere (SECURITY DEFINER included), no invoker-safe exceptions needed.
select is_empty(
  $$ select schema_name || '.' || name from app_functions
     where not exists (select 1 from unnest(proconfig) c where c like 'search_path=%') $$,
  'every function has a fixed search_path'
);
select is_empty(
  $$ select name from app_functions where schema_name = 'public' and not prosecdef $$,
  'every public (API) function is SECURITY DEFINER'
);

-- 5. Execute grants.
select is_empty(
  $$ select schema_name || '.' || name from pg_temp.callable_by('anon') $$,
  'anon cannot execute any function (public allowlist is empty)'
);
-- WHY allowlist: RLS policies are evaluated with the caller's privileges, so authenticated needs the rls helpers.
select is_empty(
  $$ select schema_name || '.' || name from pg_temp.callable_by('authenticated')
     where schema_name <> 'public' and schema_name || '.' || name not in ('rls.readable_merchant_ids', 'rls.can_write_merchant_media') $$,
  'authenticated only executes the rls policy helpers outside public'
);
select is_empty(
  $$ select schema_name || '.' || name from pg_temp.callable_by('authenticated')
     where schema_name = 'public' and name in ('create_push_campaign', 'get_push_recipients', 'record_push_result', 'anonymize_customer') $$,
  'internal RPCs are not executable by authenticated'
);
select is(
  (select array_agg(name order by name) from app_functions f
   where schema_name = 'public' and not has_function_privilege('authenticated', oid, 'execute')),
  array['anonymize_customer', 'create_push_campaign', 'get_push_recipients', 'record_push_result', 'revoke_user_sessions'],
  'the only public functions closed to authenticated are the five internal RPCs'
);
select is(
  (select count(*)::int from app_functions
   where schema_name = 'public' and name in ('create_push_campaign', 'get_push_recipients', 'record_push_result', 'anonymize_customer')
     and has_function_privilege('service_role', oid, 'execute')
     and (proacl is not null and not exists (select 1 from aclexplode(proacl) a where a.grantee = 0))),
  4,
  'internal RPCs are executable by service_role and not by PUBLIC'
);

-- 6. Volatility: a function that writes must be VOLATILE (a STABLE writer ran in read-only mode and broke in S13).
select is_empty(
  $$ select schema_name || '.' || name from app_functions
     where provolatile in ('s', 'i')
       and prosrc ~* '(require_admin_session|roll_cycle|grant_stamps|ensure_birthday_coupons|insert[[:space:]]+into|update[[:space:]]+[^[:space:]]+[[:space:]]+set|delete[[:space:]]+from|set_config)' $$,
  'no STABLE/IMMUTABLE function writes or opens an admin session'
);

-- 7. Storage: merchant-media is public (anon reads the images), capped, images only; clients can insert
-- and delete under their own folder but never update or list-manage.
select results_eq(
  $$ select public, file_size_limit, allowed_mime_types::text[] from storage.buckets where id = 'merchant-media' $$,
  $$ select true, 307200::bigint, array['image/webp', 'image/jpeg'] $$,
  'merchant-media: public, 300 KB limit, webp/jpeg only'
);
select is(
  (select array_agg(distinct cmd order by cmd) from pg_policies where schemaname = 'storage' and tablename = 'objects'),
  array['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
  'storage.objects policies: update exists only for customer-avatars (replace own avatar)'
);
select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'storage' and tablename = 'objects' and cmd in ('INSERT', 'DELETE') and 'anon' = any (roles) $$,
  'anon cannot insert or delete storage objects'
);

select * from finish();
rollback;
