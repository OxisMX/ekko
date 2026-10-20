-- NOTE: supabase_vault is preinstalled on Supabase (verified locally), so it is not created here.
create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
