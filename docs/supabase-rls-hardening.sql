-- Chay file nay SAU KHI da deploy code dung backend API route.
-- Muc tieu: khoa truy cap truc tiep tu Supabase anon key cho cac bang nhay cam.
-- Service role trong backend API van doc/ghi duoc.

alter table public.responses enable row level security;

revoke all on table public.responses from anon;

revoke all on table public.responses from authenticated;

revoke all on sequence public.responses_id_seq from anon;
revoke all on sequence public.responses_id_seq from authenticated;
