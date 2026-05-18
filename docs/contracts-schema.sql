-- Schema cho chuc nang tao hop dong tu bao gia.
-- Chay file nay trong Supabase SQL editor sau khi da co bang quotes/quote_items.
-- Script nay co the chay lai nhieu lan.

create extension if not exists pgcrypto;

create table if not exists public.contract_templates (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  description text,
  title text not null default 'HỢP ĐỒNG CUNG CẤP DỊCH VỤ',
  seller_entity_code text,
  party_role_config jsonb not null default '{}'::jsonb,
  contract_number_pattern text,
  preamble jsonb not null default '[]'::jsonb,
  service_scope text,
  schedule_rows jsonb not null default '[]'::jsonb,
  quote_table_config jsonb not null default '{}'::jsonb,
  payment_config jsonb not null default '{}'::jsonb,
  content_sections jsonb not null default '[]'::jsonb,
  terms_text text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contracts (
  id text primary key default gen_random_uuid()::text,
  quote_id text not null unique,
  quote_number text,
  contract_number text not null,
  status text not null default 'draft',
  template_id text,
  title text not null default 'HỢP ĐỒNG CUNG CẤP DỊCH VỤ',
  seller_entity_code text,
  seller_snapshot jsonb not null default '{}'::jsonb,
  customer_snapshot jsonb not null default '{}'::jsonb,
  party_role_config jsonb not null default '{}'::jsonb,
  contract_number_pattern text,
  preamble jsonb not null default '[]'::jsonb,
  service_scope text,
  schedule_rows jsonb not null default '[]'::jsonb,
  quote_table_config jsonb not null default '{}'::jsonb,
  payment_config jsonb not null default '{}'::jsonb,
  content_sections jsonb not null default '[]'::jsonb,
  terms_text text not null,
  quote_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contract_templates
  add column if not exists seller_entity_code text,
  add column if not exists party_role_config jsonb not null default '{}'::jsonb,
  add column if not exists contract_number_pattern text,
  add column if not exists preamble jsonb not null default '[]'::jsonb,
  add column if not exists service_scope text,
  add column if not exists schedule_rows jsonb not null default '[]'::jsonb,
  add column if not exists quote_table_config jsonb not null default '{}'::jsonb,
  add column if not exists payment_config jsonb not null default '{}'::jsonb,
  add column if not exists content_sections jsonb not null default '[]'::jsonb;

alter table public.contracts
  add column if not exists seller_entity_code text,
  add column if not exists party_role_config jsonb not null default '{}'::jsonb,
  add column if not exists contract_number_pattern text,
  add column if not exists preamble jsonb not null default '[]'::jsonb,
  add column if not exists service_scope text,
  add column if not exists schedule_rows jsonb not null default '[]'::jsonb,
  add column if not exists quote_table_config jsonb not null default '{}'::jsonb,
  add column if not exists payment_config jsonb not null default '{}'::jsonb,
  add column if not exists content_sections jsonb not null default '[]'::jsonb;

create index if not exists contracts_quote_id_idx on public.contracts (quote_id);
create index if not exists contract_templates_active_idx on public.contract_templates (is_active, sort_order);

alter table public.contract_templates enable row level security;
alter table public.contracts enable row level security;

grant select, insert, update, delete on table public.contract_templates to anon, authenticated;
grant select, insert, update, delete on table public.contracts to anon, authenticated;

drop policy if exists "Allow quote app read contract templates" on public.contract_templates;
create policy "Allow quote app read contract templates"
  on public.contract_templates
  for select
  using (true);

drop policy if exists "Allow quote app insert contract templates" on public.contract_templates;
create policy "Allow quote app insert contract templates"
  on public.contract_templates
  for insert
  with check (true);

drop policy if exists "Allow quote app update contract templates" on public.contract_templates;
create policy "Allow quote app update contract templates"
  on public.contract_templates
  for update
  using (true)
  with check (true);

drop policy if exists "Allow quote app delete contract templates" on public.contract_templates;
create policy "Allow quote app delete contract templates"
  on public.contract_templates
  for delete
  using (true);

drop policy if exists "Allow quote app read contracts" on public.contracts;
create policy "Allow quote app read contracts"
  on public.contracts
  for select
  using (true);

drop policy if exists "Allow quote app insert contracts" on public.contracts;
create policy "Allow quote app insert contracts"
  on public.contracts
  for insert
  with check (true);

drop policy if exists "Allow quote app update contracts" on public.contracts;
create policy "Allow quote app update contracts"
  on public.contracts
  for update
  using (true)
  with check (true);

drop policy if exists "Allow quote app delete contracts" on public.contracts;
create policy "Allow quote app delete contracts"
  on public.contracts
  for delete
  using (true);
