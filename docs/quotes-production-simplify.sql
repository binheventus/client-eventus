-- Run once in Supabase SQL Editor for the production project.
--
-- Goal: make quote creation resilient.
-- Quotes should store snapshot codes for entity/tier/client/service instead of
-- being blocked by strict lookup FKs. Keep quote_items.quote_id -> quotes.id.
--
-- This version intentionally avoids DO $$ blocks so it is easy to paste/run in
-- the Supabase dashboard.

begin;

alter table public.quotes
  add column if not exists entity_code text,
  add column if not exists tier_code text,
  add column if not exists client_name text,
  add column if not exists created_by_name text,
  add column if not exists sales_name text;

alter table if exists public.quotes drop constraint if exists quotes_entity_code_fkey;
alter table if exists public.quotes drop constraint if exists quotes_tier_code_fkey;
alter table if exists public.quotes drop constraint if exists quotes_client_id_fkey;
alter table if exists public.quotes drop constraint if exists quotes_created_by_fkey;
alter table if exists public.quote_items drop constraint if exists quote_items_service_code_fkey;

update public.quotes
set
  entity_code = coalesce(nullif(trim(entity_code), ''), 'EVENTUS'),
  tier_code = coalesce(nullif(trim(tier_code), ''), 'TIER_2'),
  created_by_name = coalesce(nullif(trim(created_by_name), ''), nullif(trim(sales_name), ''), 'Eventus'),
  sales_name = coalesce(nullif(trim(sales_name), ''), nullif(trim(created_by_name), ''), 'Eventus')
where
  entity_code is null or trim(entity_code) = ''
  or tier_code is null or trim(tier_code) = ''
  or created_by_name is null or trim(created_by_name) = ''
  or sales_name is null or trim(sales_name) = '';

alter table public.quotes
  alter column entity_code set default 'EVENTUS',
  alter column entity_code set not null,
  alter column tier_code set default 'TIER_2',
  alter column tier_code set not null;

commit;
