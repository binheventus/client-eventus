-- Chay file nay SAU KHI da deploy code dung Vercel API route.
-- Muc tieu: khoa truy cap truc tiep tu Supabase anon key cho cac bang nhay cam.
-- Service role trong Vercel API van doc/ghi duoc.

alter table public.hr_employees enable row level security;
alter table public.hr_employee_insights enable row level security;
alter table public.hr_employee_notes enable row level security;
alter table public.responses enable row level security;

revoke all on table public.hr_employees from anon;
revoke all on table public.hr_employee_insights from anon;
revoke all on table public.hr_employee_notes from anon;
revoke all on table public.responses from anon;

revoke all on table public.hr_employees from authenticated;
revoke all on table public.hr_employee_insights from authenticated;
revoke all on table public.hr_employee_notes from authenticated;
revoke all on table public.responses from authenticated;

revoke all on sequence public.responses_id_seq from anon;
revoke all on sequence public.responses_id_seq from authenticated;

