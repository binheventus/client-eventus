# Supabase setup cho 30-Day Review

Module `30-Day Review` hiện dùng chung Supabase project với Eventus Handbook.

Nếu đã xóa Supabase project cũ của app 30-Day Review, cần tạo lại bảng `responses` trong Supabase project hiện tại.

Vào Supabase hiện tại -> SQL Editor -> New query -> paste toàn bộ SQL dưới đây -> Run.

```sql
create table if not exists public.responses (
  id bigserial primary key,
  access_token text not null unique,
  ho_ten text not null,
  sdt text not null,
  vi_tri text,
  ngay_gia_nhap date,
  question_version text,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists responses_sdt_created_at_idx
  on public.responses (sdt, created_at desc);

create index if not exists responses_access_token_idx
  on public.responses (access_token);

create or replace function public.set_responses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_responses_updated_at on public.responses;

create trigger set_responses_updated_at
before update on public.responses
for each row
execute function public.set_responses_updated_at();

alter table public.responses disable row level security;

grant select, insert, update on public.responses to anon;
grant usage, select on sequence public.responses_id_seq to anon;
```

Gợi ý kiểm tra:

- Mở `/30dayreview`.
- Nhập đủ họ tên, số điện thoại, vị trí, ngày gia nhập.
- Nếu vào được form câu hỏi và URL có dạng `?r=...` là bảng đã hoạt động.
