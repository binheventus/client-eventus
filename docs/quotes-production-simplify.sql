-- Run once in Supabase SQL Editor for the production project.
--
-- Goal: make quote creation resilient. Quotes store snapshot codes for
-- entity/tier/client/service instead of being blocked by strict lookup FKs.
-- Keep the important relationship quote_items.quote_id -> quotes.id intact.

begin;

create table if not exists public.legal_entities (
  entity_code text primary key,
  name text,
  legal_name text,
  display_name text,
  tax_code text,
  is_active boolean default true,
  is_default boolean default false,
  sort_order integer default 0
);

create table if not exists public.customer_tiers (
  tier_code text primary key,
  tier_name text,
  name text,
  is_active boolean default true,
  sort_order integer default 0
);

alter table public.quotes
  add column if not exists entity_code text,
  add column if not exists tier_code text,
  add column if not exists client_name text,
  add column if not exists created_by_name text,
  add column if not exists sales_name text;

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select constraint_record.conname
    from pg_constraint constraint_record
    join pg_class table_record on table_record.oid = constraint_record.conrelid
    join pg_namespace namespace_record on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'public'
      and table_record.relname = 'quotes'
      and constraint_record.contype = 'f'
      and exists (
        select 1
        from unnest(constraint_record.conkey) as constrained_column(attnum)
        join pg_attribute attribute_record
          on attribute_record.attrelid = table_record.oid
         and attribute_record.attnum = constrained_column.attnum
        where attribute_record.attname in ('entity_code', 'tier_code', 'client_id', 'created_by')
      )
  loop
    execute format('alter table public.quotes drop constraint %I', constraint_row.conname);
  end loop;

  for constraint_row in
    select constraint_record.conname
    from pg_constraint constraint_record
    join pg_class table_record on table_record.oid = constraint_record.conrelid
    join pg_namespace namespace_record on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'public'
      and table_record.relname = 'quote_items'
      and constraint_record.contype = 'f'
      and exists (
        select 1
        from unnest(constraint_record.conkey) as constrained_column(attnum)
        join pg_attribute attribute_record
          on attribute_record.attrelid = table_record.oid
         and attribute_record.attnum = constrained_column.attnum
        where attribute_record.attname = 'service_code'
      )
  loop
    execute format('alter table public.quote_items drop constraint %I', constraint_row.conname);
  end loop;
end $$;

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

do $$
begin
  insert into public.legal_entities (
    entity_code,
    name,
    legal_name,
    display_name,
    tax_code,
    is_active,
    is_default,
    sort_order
  ) values
    ('EVENTUS', 'CONG TY TNHH EVENTUS VIET NAM', 'CONG TY TNHH EVENTUS VIET NAM', 'Eventus', '0107929531', true, true, 1),
    ('MEDIAMONSTER', 'CONG TY TNHH MEDIAMONSTER', 'CONG TY TNHH MEDIAMONSTER', 'Mediamonster', '1001255108', true, false, 2)
  on conflict (entity_code) do nothing;
exception when others then
  raise notice 'Skipped legal_entities seed: %', sqlerrm;
end $$;

do $$
begin
  insert into public.customer_tiers (
    tier_code,
    tier_name,
    name,
    is_active,
    sort_order
  ) values
    ('TIER_1', 'Khach VinGroup / Agency dac biet', 'Khach VinGroup / Agency dac biet', true, 1),
    ('TIER_2', 'Khach moi / Khach thong thuong', 'Khach moi / Khach thong thuong', true, 2),
    ('TIER_3', 'Khach giam gia / Nguoi quen', 'Khach giam gia / Nguoi quen', true, 3),
    ('TIER_4', '2res', '2res', true, 4),
    ('TIER_5', 'Tier 5', 'Tier 5', true, 5)
  on conflict (tier_code) do nothing;
exception when others then
  raise notice 'Skipped customer_tiers seed: %', sqlerrm;
end $$;

commit;
