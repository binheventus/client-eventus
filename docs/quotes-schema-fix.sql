-- Dong bo schema cho module bao gia Eventus.
-- Chay trong Supabase SQL Editor. Script nay co the chay lai nhieu lan.
--
-- Script xu ly cac loi da gap:
-- - Could not find the table 'public.active_quotes' in the schema cache
-- - new row violates row-level security policy for table "quotes"
-- - new row violates row-level security policy for table "clients"
-- - Could not find the 'ai_input' column of 'quotes' in the schema cache
-- - cannot cast type quote_validity to integer

create extension if not exists pgcrypto;

create or replace function public.generate_quote_share_token(token_length integer default 7)
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := gen_random_bytes(token_length);
  token text := '';
  byte_index integer;
begin
  for byte_index in 0..token_length - 1 loop
    token := token || substr(alphabet, (get_byte(bytes, byte_index) % length(alphabet)) + 1, 1);
  end loop;

  return token;
end $$;

drop view if exists public.active_quotes;
drop view if exists public.trashed_quotes;

create table if not exists public.quotes (
  id text primary key default public.generate_quote_share_token()
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid()
);

create table if not exists public.quote_views (
  id uuid primary key default gen_random_uuid()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid()
);

alter table public.clients
  add column if not exists name text,
  add column if not exists client_name text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists created_at timestamptz;

update public.clients
set created_at = coalesce(created_at, now());

alter table public.clients
  alter column created_at set default now(),
  alter column created_at set not null;

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
  add column if not exists validity_days integer,
  add column if not exists has_vat boolean,
  add column if not exists status text,
  add column if not exists sent_at timestamptz,
  add column if not exists subtotal numeric,
  add column if not exists travel_fee_total numeric,
  add column if not exists overtime_fee_total numeric,
  add column if not exists vat_amount numeric,
  add column if not exists total_amount numeric,
  add column if not exists share_token text,
  add column if not exists deleted_at timestamptz,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

do $$
declare
  validity_type text;
begin
  select format_type(attribute.atttypid, attribute.atttypmod)
    into validity_type
  from pg_attribute attribute
  join pg_class class on class.oid = attribute.attrelid
  join pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = 'quotes'
    and attribute.attname = 'validity_days'
    and not attribute.attisdropped;

  if validity_type is not null and validity_type <> 'integer' then
    alter table public.quotes alter column validity_days drop default;
    alter table public.quotes alter column validity_days drop not null;
    alter table public.quotes alter column validity_days type integer using (
      case
        when validity_days is null then 15
        when substring(validity_days::text from '[0-9]+') is not null
          then substring(validity_days::text from '[0-9]+')::integer
        when lower(validity_days::text) like '%seven%' then 7
        when lower(validity_days::text) like '%week%' then 7
        when lower(validity_days::text) like '%fifteen%' then 15
        when lower(validity_days::text) like '%thirty%' then 30
        when lower(validity_days::text) like '%month%' then 30
        else 15
      end
    );
  end if;
end $$;

update public.quotes
set
  validity_days = coalesce(validity_days, 15),
  has_vat = coalesce(has_vat, true),
  status = coalesce(nullif(status, 'draft'), 'sent'),
  subtotal = coalesce(subtotal, 0),
  travel_fee_total = coalesce(travel_fee_total, 0),
  overtime_fee_total = coalesce(overtime_fee_total, 0),
  vat_amount = coalesce(vat_amount, 0),
  total_amount = coalesce(total_amount, 0),
  share_token = coalesce(nullif(share_token, ''), public.generate_quote_share_token()),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

with duplicate_tokens as (
  select
    ctid,
    row_number() over (partition by share_token order by created_at, id) as duplicate_order
  from public.quotes
  where share_token is not null and share_token <> ''
)
update public.quotes quote_row
set share_token = public.generate_quote_share_token()
from duplicate_tokens
where quote_row.ctid = duplicate_tokens.ctid
  and duplicate_tokens.duplicate_order > 1;

alter table public.quotes
  alter column validity_days set default 15,
  alter column validity_days set not null,
  alter column has_vat set default true,
  alter column has_vat set not null,
  alter column status set default 'sent',
  alter column status set not null,
  alter column subtotal set default 0,
  alter column subtotal set not null,
  alter column travel_fee_total set default 0,
  alter column travel_fee_total set not null,
  alter column overtime_fee_total set default 0,
  alter column overtime_fee_total set not null,
  alter column vat_amount set default 0,
  alter column vat_amount set not null,
  alter column total_amount set default 0,
  alter column total_amount set not null,
  alter column share_token set default public.generate_quote_share_token(),
  alter column share_token set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

create unique index if not exists quotes_share_token_key on public.quotes (share_token);

alter table public.quote_items
  add column if not exists quote_id text,
  add column if not exists service_code text,
  add column if not exists service_name text,
  add column if not exists service_name_raw text,
  add column if not exists quantity numeric,
  add column if not exists num_sessions numeric,
  add column if not exists unit_price numeric,
  add column if not exists total_price numeric,
  add column if not exists is_overridden boolean,
  add column if not exists original_unit_price numeric,
  add column if not exists override_reason text,
  add column if not exists sort_order integer,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.quote_items
set
  quantity = coalesce(quantity, 1),
  num_sessions = coalesce(num_sessions, 1),
  unit_price = coalesce(unit_price, 0),
  total_price = coalesce(total_price, 0),
  is_overridden = coalesce(is_overridden, false),
  sort_order = coalesce(sort_order, 1),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.quote_items
  alter column quantity set default 1,
  alter column quantity set not null,
  alter column num_sessions set default 1,
  alter column num_sessions set not null,
  alter column unit_price set default 0,
  alter column unit_price set not null,
  alter column total_price set default 0,
  alter column total_price set not null,
  alter column is_overridden set default false,
  alter column is_overridden set not null,
  alter column sort_order set default 1,
  alter column sort_order set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.quote_views
  add column if not exists quote_id text,
  add column if not exists user_agent text,
  add column if not exists viewed_at timestamptz;

update public.quote_views
set viewed_at = coalesce(viewed_at, now());

alter table public.quote_views
  alter column viewed_at set default now(),
  alter column viewed_at set not null;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('quotes', 'quote_items', 'quote_views', 'clients')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

create or replace view public.active_quotes as
select *
from public.quotes
where deleted_at is null;

create or replace view public.trashed_quotes as
select *
from public.quotes
where deleted_at is not null;

alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.quote_views enable row level security;
alter table public.clients enable row level security;

alter table public.quotes no force row level security;
alter table public.quote_items no force row level security;
alter table public.quote_views no force row level security;
alter table public.clients no force row level security;

grant select, insert, update, delete on table public.quotes to anon, authenticated;
grant select, insert, update, delete on table public.quote_items to anon, authenticated;
grant select, insert, delete on table public.quote_views to anon, authenticated;
grant select, insert on table public.clients to anon, authenticated;
grant select on table public.active_quotes to anon, authenticated;
grant select on table public.trashed_quotes to anon, authenticated;

do $$
declare
  sequence_name text;
begin
  for sequence_name in
    select pg_get_serial_sequence('public.quotes', 'id')
    union all select pg_get_serial_sequence('public.quote_items', 'id')
    union all select pg_get_serial_sequence('public.quote_views', 'id')
    union all select pg_get_serial_sequence('public.clients', 'id')
  loop
    if sequence_name is not null then
      execute format('grant usage, select on sequence %s to anon, authenticated', sequence_name);
    end if;
  end loop;
end $$;

drop policy if exists "Allow quote app read quotes" on public.quotes;
create policy "Allow quote app read quotes"
  on public.quotes
  for select
  to public
  using (true);

create policy "Allow quote app insert quotes"
  on public.quotes
  for insert
  to public
  with check (true);

create policy "Allow quote app update quotes"
  on public.quotes
  for update
  to public
  using (true)
  with check (true);

create policy "Allow quote app delete quotes"
  on public.quotes
  for delete
  to public
  using (true);

create policy "Allow quote app read quote items"
  on public.quote_items
  for select
  to public
  using (true);

create policy "Allow quote app insert quote items"
  on public.quote_items
  for insert
  to public
  with check (true);

create policy "Allow quote app update quote items"
  on public.quote_items
  for update
  to public
  using (true)
  with check (true);

create policy "Allow quote app delete quote items"
  on public.quote_items
  for delete
  to public
  using (true);

create policy "Allow quote app read quote views"
  on public.quote_views
  for select
  to public
  using (true);

create policy "Allow quote app insert quote views"
  on public.quote_views
  for insert
  to public
  with check (true);

create policy "Allow quote app delete quote views"
  on public.quote_views
  for delete
  to public
  using (true);

create policy "Allow quote app read clients"
  on public.clients
  for select
  to public
  using (true);

create policy "Allow quote app insert clients"
  on public.clients
  for insert
  to public
  with check (true);

notify pgrst, 'reload schema';
