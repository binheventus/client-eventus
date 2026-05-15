# HR Insights Supabase Setup

Chạy SQL dưới đây trong Supabase SQL Editor để tạo dữ liệu thật cho menu `HR Insights`.

```sql
create extension if not exists "pgcrypto";

create table if not exists public.hr_employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role text,
  birthday date,
  joined_at date,
  hometown text,
  education text,
  interests text,
  analysis text,
  motivate_action text,
  develop_action text,
  avatar_initials text,
  avatar_theme text default 'from-slate-300 via-slate-100 to-teal-100',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hr_employee_insights (
  employee_id uuid primary key references public.hr_employees(id) on delete cascade,
  remember_tags text[] not null default '{}',
  goals text[] not null default '{}',
  overview text,
  updated_at timestamptz not null default now()
);

create table if not exists public.hr_employee_notes (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  note_date date not null default current_date,
  note_type text not null default '1-1 định kỳ',
  author text,
  points text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_hr_employees_updated_at on public.hr_employees;
create trigger set_hr_employees_updated_at
before update on public.hr_employees
for each row execute function public.set_updated_at();

drop trigger if exists set_hr_employee_insights_updated_at on public.hr_employee_insights;
create trigger set_hr_employee_insights_updated_at
before update on public.hr_employee_insights
for each row execute function public.set_updated_at();

drop trigger if exists set_hr_employee_notes_updated_at on public.hr_employee_notes;
create trigger set_hr_employee_notes_updated_at
before update on public.hr_employee_notes
for each row execute function public.set_updated_at();

insert into public.hr_employees (
  full_name,
  role,
  birthday,
  joined_at,
  hometown,
  education,
  interests,
  analysis,
  motivate_action,
  develop_action,
  avatar_initials,
  avatar_theme
) values
  ('An Nguyen', 'Sales Manager', '1995-06-15', '2022-03-01', 'Hải Phòng', 'Đại học Kinh tế Quốc dân', 'Phát triển kỹ năng lãnh đạo, thể thao', 'Chủ động, cầu tiến, chịu áp lực tốt', 'Ghi nhận thành tích trước team (21/05)', 'Tham gia khóa leadership (15/06)', 'AN', 'from-slate-300 via-slate-100 to-teal-100'),
  ('Binh Trần', 'Operations Lead', null, null, null, null, 'Công nghệ, tối ưu quy trình', 'Tư duy logic tốt, ít chia sẻ ý kiến', '1:1 meeting, feedback (20/05)', 'Đào tạo kỹ năng communication (10/06)', 'BT', 'from-orange-200 via-white to-blue-100'),
  ('Linh Phạm', 'HR Specialist', null, null, null, null, 'Môi trường làm việc tích cực', 'Tỉ mỉ, chu đáo, đôi khi quá cầu toàn', 'Thư cảm ơn cá nhân (22/05)', 'Khóa time management (12/06)', 'LP', 'from-slate-200 via-white to-emerald-100'),
  ('Minh Lê', 'Product Owner', null, null, null, null, 'Sản phẩm, người dùng, đổi mới', 'Sáng tạo, nhanh nhạy, đôi khi thiếu kiên nhẫn', 'Chia sẻ feedback khách hàng (19/05)', 'Mentor 1:1 với PO senior (08/06)', 'ML', 'from-slate-400 via-slate-100 to-slate-200'),
  ('Phương Đỗ', 'Marketing Lead', null, null, null, null, 'Thương hiệu, chiến lược marketing', 'Năng động, giao tiếp tốt, cần định hướng rõ hơn', 'Khen trong meeting (18/05)', 'Khóa brand strategy (05/06)', 'PD', 'from-blue-100 via-white to-pink-100')
on conflict do nothing;

insert into public.hr_employee_insights (employee_id, remember_tags, goals, overview)
select
  id,
  array[
    'Thích thử thách, mục tiêu cao',
    'Muốn phát triển kỹ năng leadership',
    'Cần công nhận kịp thời',
    'Quan tâm đến chiến lược & tư duy dài hạn'
  ],
  array[
    'Phát triển kỹ năng leadership, có cơ hội dẫn dắt team.',
    'Học thêm về chiến lược bán hàng & đàm phán.',
    'Được tham gia các dự án lớn, ảnh hưởng nhiều hơn.'
  ],
  'An là nhân sự có xu hướng chủ động, thích mục tiêu rõ ràng và phù hợp với các dự án có độ thử thách cao. Nên tiếp tục giao việc có quyền quyết định để kiểm tra năng lực lead.'
from public.hr_employees
where full_name = 'An Nguyen'
on conflict (employee_id) do nothing;

insert into public.hr_employee_notes (employee_id, note_date, note_type, author, points)
select
  id,
  '2024-05-21',
  '1-1 định kỳ',
  'Hoàng Nguyễn (Bạn)',
  array[
    'Cảm thấy gần đây workload khá cao, nhiều việc dồn lại cùng lúc.',
    'Muốn được học thêm về chiến lược bán hàng & kỹ năng đàm phán.',
    'Rất thích dự án mới với khách hàng ABC, muốn tiếp tục tham gia sâu hơn.',
    'Đề xuất cải thiện quy trình báo cáo để tiết kiệm thời gian.'
  ]
from public.hr_employees
where full_name = 'An Nguyen'
on conflict do nothing;

insert into public.hr_employee_notes (employee_id, note_date, note_type, author, points)
select
  id,
  '2024-04-15',
  '1-1 định kỳ',
  'Hoàng Nguyễn (Bạn)',
  array[
    'Chia sẻ đang hơi áp lực vì KPI quý 2 cao hơn quý 1.',
    'Cần hỗ trợ thêm về data khách hàng để tăng hiệu quả chốt deal.',
    'Muốn được công nhận nhiều hơn khi team đạt kết quả tốt.'
  ]
from public.hr_employees
where full_name = 'An Nguyen'
on conflict do nothing;

insert into public.hr_employee_notes (employee_id, note_date, note_type, author, points)
select
  id,
  '2024-03-18',
  '1-1 định kỳ',
  'Hoàng Nguyễn (Bạn)',
  array[
    'Hào hứng với vị trí hiện tại, cảm thấy phù hợp với định hướng phát triển.',
    'Mong muốn trong 6-12 tháng tới có thể lead một nhóm nhỏ.',
    'Thích môi trường tự do, tin tưởng và ít kiểm soát vi mô.'
  ]
from public.hr_employees
where full_name = 'An Nguyen'
on conflict do nothing;
```

Lưu ý bảo mật: nếu Supabase project đang cho phép anon key đọc/ghi như phần dữ liệu nội bộ hiện tại, dữ liệu HR cũng sẽ dùng cùng mức bảo vệ đó. Nếu dữ liệu HR là nhạy cảm, nên bổ sung Supabase Auth + RLS trước khi đưa vào production rộng rãi.
