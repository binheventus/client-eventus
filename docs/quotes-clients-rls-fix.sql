-- Fix loi "new row violates row-level security policy for table clients"
-- khi tao bao gia moi tu /quotes/new.
--
-- Chay file nay trong Supabase SQL Editor cua project dang dung cho app.
-- App can doc danh sach khach hang de goi y va insert khach hang moi khi tao bao gia.

alter table public.clients enable row level security;

grant select, insert on table public.clients to anon, authenticated;

do $$
begin
  if to_regclass('public.clients_id_seq') is not null then
    grant usage, select on sequence public.clients_id_seq to anon, authenticated;
  end if;
end $$;

drop policy if exists "Allow quote app read clients" on public.clients;
create policy "Allow quote app read clients"
  on public.clients
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow quote app insert clients" on public.clients;
create policy "Allow quote app insert clients"
  on public.clients
  for insert
  to anon, authenticated
  with check (true);
