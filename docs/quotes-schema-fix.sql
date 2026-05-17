-- Dong bo schema cho module bao gia.
-- Chay trong Supabase SQL Editor neu app bao loi dang:
-- "Could not find the '...' column of 'quotes' in the schema cache".
--
-- Sau khi chay xong, vao Supabase Dashboard > Project Settings > API
-- va reload schema cache neu Dashboard chua tu cap nhat ngay.

create extension if not exists pgcrypto;

alter table public.quotes
  add column if not exists ai_input text,
  add column if not exists client_id text,
  add column if not exists client_name text,
  add column if not exists entity_code text,
  add column if not exists tier_code text,
  add column if not exists event_name text,
  add column if not exists event_date date,
  add column if not exists location text,
  add column if not exists duration_hours numeric,
  add column if not exists validity_days integer not null default 15,
  add column if not exists has_vat boolean not null default true,
  add column if not exists status text not null default 'draft',
  add column if not exists sent_at timestamptz,
  add column if not exists subtotal numeric not null default 0,
  add column if not exists travel_fee_total numeric not null default 0,
  add column if not exists overtime_fee_total numeric not null default 0,
  add column if not exists vat_amount numeric not null default 0,
  add column if not exists total_amount numeric not null default 0,
  add column if not exists share_token text not null default replace(gen_random_uuid()::text, '-', ''),
  add column if not exists deleted_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists quotes_share_token_key on public.quotes (share_token);

alter table public.quote_items
  add column if not exists quote_id text,
  add column if not exists service_code text,
  add column if not exists service_name text,
  add column if not exists service_name_raw text,
  add column if not exists quantity numeric not null default 1,
  add column if not exists num_sessions numeric not null default 1,
  add column if not exists unit_price numeric not null default 0,
  add column if not exists total_price numeric not null default 0,
  add column if not exists is_overridden boolean not null default false,
  add column if not exists original_unit_price numeric,
  add column if not exists override_reason text,
  add column if not exists sort_order integer not null default 1,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
