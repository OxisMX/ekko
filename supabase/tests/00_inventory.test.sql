begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

-- TC-206: written over pg_tables so future tables are covered automatically.
select is_empty(
  $$ select tablename from pg_tables where schemaname = 'public' and not rowsecurity $$,
  'every table in public has RLS enabled'
);

-- ADR-13 inventory: only app.now() may read the real clock.
select is_empty(
  $$
    select n.nspname || '.' || p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app', 'private')
      and not (n.nspname = 'app' and p.proname = 'now')
      and p.prosrc ~* '(?<!app\.)\m(now\s*\(|current_(date|time|timestamp)\M|localtimestamp\M|clock_timestamp\s*\(|statement_timestamp\s*\(|transaction_timestamp\s*\()'
  $$,
  'no function reads the real clock directly (ADR-13)'
);

-- TC-207
select is_empty(
  $$
    select n.nspname || '.' || p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app', 'private', 'rls')
      and p.prosecdef
      and not coalesce('search_path=""' = any (p.proconfig), false)
  $$,
  'every SECURITY DEFINER function has a fixed empty search_path'
);

select * from finish();
rollback;
