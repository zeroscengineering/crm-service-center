-- =====================================================================
-- 0010: สถานะงานซ่อมกำหนดเองได้ (เพิ่ม / แก้ชื่อ / สี / ลำดับ / ซ่อน / ข้อความ LINE)
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
-- =====================================================================

-- ---------- ตารางสถานะ ----------
create table if not exists job_statuses (
  key           text primary key,
  label         text not null,
  color         text not null default '#64748B',
  sort          int  not null default 100,
  -- open = งานยังไม่ปิด · done = ปิดงานสำเร็จ (ส่งมอบ) · cancelled = ยกเลิก
  kind          text not null default 'open' check (kind in ('open', 'done', 'cancelled')),
  is_system     boolean not null default false,
  hidden        boolean not null default false,
  line_message  text,
  created_at    timestamptz not null default now()
);

insert into job_statuses (key, label, color, sort, kind, is_system) values
  ('received',  'รับเรื่องซ่อม',              '#64748B', 10, 'open',      true),
  ('quoting',   'กำลังประเมินราคา/อะไหล่',     '#D97706', 20, 'open',      true),
  ('approved',  'ลูกค้าอนุมัติซ่อม',           '#0284C7', 30, 'open',      true),
  ('repairing', 'กำลังซ่อม',                  '#4F46E5', 40, 'open',      true),
  ('ready',     'ซ่อมเสร็จพร้อมส่งคืน',        '#059669', 50, 'open',      true),
  ('delivered', 'ส่งมอบเรียบร้อย',            '#71717A', 60, 'done',      true),
  ('cancelled', 'ยกเลิก',                     '#E11D48', 70, 'cancelled', true)
on conflict (key) do nothing;

alter table job_statuses enable row level security;
drop policy if exists "read job_statuses" on job_statuses;
drop policy if exists "admin write job_statuses" on job_statuses;
-- หน้า /track (ไม่ล็อกอิน) ต้องอ่านชื่อสถานะได้ — ไม่มีข้อมูลลับ
create policy "read job_statuses" on job_statuses for select to anon, authenticated using (true);
create policy "admin write job_statuses" on job_statuses for all to authenticated using (is_admin()) with check (is_admin());

-- ---------- เปลี่ยนคอลัมน์สถานะจาก enum เป็น text ----------
drop function if exists public_track_job(text);

alter table repair_jobs alter column status drop default;
alter table repair_jobs alter column status type text using status::text;
alter table repair_jobs alter column status set default 'received';

alter table job_status_history alter column from_status type text using from_status::text;
alter table job_status_history alter column to_status   type text using to_status::text;

-- สถานะของงานต้องมีอยู่ในตาราง (ลบสถานะที่ยังมีงานใช้อยู่ไม่ได้)
alter table repair_jobs drop constraint if exists repair_jobs_status_fkey;
alter table repair_jobs add constraint repair_jobs_status_fkey
  foreign key (status) references job_statuses(key) on update cascade on delete restrict;

-- ---------- หน้าติดตามสถานะสาธารณะ ----------
create or replace function public_track_job(p_doc_no text)
returns table (
  doc_no text, brand tool_brand, model text, status text,
  received_at date, updated_at timestamptz, customer_name_masked text,
  history jsonb
)
language sql stable security definer set search_path = public as $$
  select
    j.doc_no, t.brand, t.model, j.status, j.received_at, j.updated_at,
    left(c.name, 2) || repeat('*', greatest(char_length(c.name) - 2, 2)),
    coalesce((
      select jsonb_agg(jsonb_build_object('status', h.to_status, 'at', h.created_at) order by h.created_at)
      from job_status_history h where h.repair_job_id = j.id
    ), '[]'::jsonb)
  from repair_jobs j
  join tools t on t.id = j.tool_id
  join customers c on c.id = j.customer_id
  where upper(trim(j.doc_no)) = upper(trim(p_doc_no))
  limit 1;
$$;
revoke all on function public_track_job(text) from public;
grant execute on function public_track_job(text) to anon, authenticated;

-- ชนิด enum repair_status เดิมไม่ได้ใช้แล้ว (ปล่อยไว้ ไม่มีผล)
