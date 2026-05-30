-- RESET DESTRUCTIVE cho module bao gia Eventus.
-- Chay file nay khi muon xoa toan bo du lieu bao gia cu va doi quotes.id sang ma ngan 7 ky tu.
-- KHONG chay file nay neu can giu lai bao gia cu.

create extension if not exists pgcrypto;

drop view if exists public.active_quotes;
drop view if exists public.trashed_quotes;

drop table if exists public.quote_views cascade;
drop table if exists public.quote_items cascade;
drop table if exists public.quotes cascade;

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

create or replace function public.set_quote_code_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.id is null or new.id = '' then
    new.id := public.generate_quote_share_token();
  end if;

  if new.share_token is null or new.share_token = '' then
    new.share_token := new.id;
  end if;

  return new;
end $$;

create table public.quotes (
  id text primary key default public.generate_quote_share_token(),
  ai_input text,
  client_id text,
  client_name text,
  entity_code text,
  tier_code text,
  event_name text,
  event_date date,
  location text,
  duration_hours numeric,
  validity_days integer not null default 15,
  has_vat boolean not null default true,
  status text not null default 'sent',
  sent_at timestamptz,
  subtotal numeric not null default 0,
  travel_fee_total numeric not null default 0,
  overtime_fee_total numeric not null default 0,
  vat_amount numeric not null default 0,
  total_amount numeric not null default 0,
  share_token text not null unique,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_quote_code_defaults_before_insert
  before insert on public.quotes
  for each row
  execute function public.set_quote_code_defaults();

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id text,
  service_code text,
  service_name text,
  service_name_raw text,
  quantity numeric not null default 1,
  num_sessions numeric not null default 1,
  unit_price numeric not null default 0,
  total_price numeric not null default 0,
  is_overridden boolean not null default false,
  original_unit_price numeric,
  override_reason text,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quote_views (
  id uuid primary key default gen_random_uuid(),
  quote_id text,
  user_agent text,
  viewed_at timestamptz not null default now()
);

create index if not exists quote_items_quote_id_idx on public.quote_items (quote_id);
create index if not exists quote_views_quote_id_idx on public.quote_views (quote_id);

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

grant select, insert, update, delete on table public.quotes to anon, authenticated;
grant select, insert, update, delete on table public.quote_items to anon, authenticated;
grant select, insert, delete on table public.quote_views to anon, authenticated;
grant select, insert on table public.clients to anon, authenticated;
grant select on table public.active_quotes to anon, authenticated;
grant select on table public.trashed_quotes to anon, authenticated;

drop policy if exists "Allow quote app read quotes" on public.quotes;
create policy "Allow quote app read quotes"
  on public.quotes
  for select
  to public
  using (true);

drop policy if exists "Allow quote app insert quotes" on public.quotes;
create policy "Allow quote app insert quotes"
  on public.quotes
  for insert
  to public
  with check (true);

drop policy if exists "Allow quote app update quotes" on public.quotes;
create policy "Allow quote app update quotes"
  on public.quotes
  for update
  to public
  using (true)
  with check (true);

drop policy if exists "Allow quote app delete quotes" on public.quotes;
create policy "Allow quote app delete quotes"
  on public.quotes
  for delete
  to public
  using (true);

drop policy if exists "Allow quote app read quote items" on public.quote_items;
create policy "Allow quote app read quote items"
  on public.quote_items
  for select
  to public
  using (true);

drop policy if exists "Allow quote app insert quote items" on public.quote_items;
create policy "Allow quote app insert quote items"
  on public.quote_items
  for insert
  to public
  with check (true);

drop policy if exists "Allow quote app update quote items" on public.quote_items;
create policy "Allow quote app update quote items"
  on public.quote_items
  for update
  to public
  using (true)
  with check (true);

drop policy if exists "Allow quote app delete quote items" on public.quote_items;
create policy "Allow quote app delete quote items"
  on public.quote_items
  for delete
  to public
  using (true);

drop policy if exists "Allow quote app read quote views" on public.quote_views;
create policy "Allow quote app read quote views"
  on public.quote_views
  for select
  to public
  using (true);

drop policy if exists "Allow quote app insert quote views" on public.quote_views;
create policy "Allow quote app insert quote views"
  on public.quote_views
  for insert
  to public
  with check (true);

drop policy if exists "Allow quote app delete quote views" on public.quote_views;
create policy "Allow quote app delete quote views"
  on public.quote_views
  for delete
  to public
  using (true);

drop policy if exists "Allow quote app read clients" on public.clients;
create policy "Allow quote app read clients"
  on public.clients
  for select
  to public
  using (true);

drop policy if exists "Allow quote app insert clients" on public.clients;
create policy "Allow quote app insert clients"
  on public.clients
  for insert
  to public
  with check (true);

notify pgrst, 'reload schema';
