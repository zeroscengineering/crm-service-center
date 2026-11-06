-- =====================================================================
-- CRM-SERVICE CENTER : Initial schema (Phase 1)
-- วิธีใช้: เปิด Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันครั้งเดียว)
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- ENUMS ----------
create type user_role as enum ('admin', 'technician');

create type tool_brand as enum ('Milwaukee', 'Skil', 'Workpro');

create type repair_status as enum (
  'received',    -- รับเรื่องซ่อม
  'quoting',     -- กำลังประเมินราคา/อะไหล่
  'approved',    -- ลูกค้าอนุมัติซ่อม
  'repairing',   -- กำลังซ่อม
  'ready',       -- ซ่อมเสร็จพร้อมส่งคืน
  'delivered',   -- ส่งมอบเรียบร้อย
  'cancelled'    -- ยกเลิก/ลูกค้าไม่ซ่อม
);

create type warranty_status as enum ('in_warranty', 'out_of_warranty', 'unknown');

create type file_category as enum ('before', 'after', 'document');

-- ---------- HELPERS ----------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- PROFILES (พนักงาน) ----------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  role        user_role not null default 'technician',
  created_at  timestamptz not null default now()
);

-- สร้าง profile อัตโนมัติเมื่อมีผู้ใช้ใหม่ (ค่าเริ่มต้น = ช่าง)
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- BRANCHES (สาขา) ----------
create table branches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);
insert into branches (name) values ('สำนักงานใหญ่');

-- ---------- CUSTOMERS ----------
create table customers (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  phone            text not null,
  line_id          text,          -- LINE ID ที่ลูกค้าแจ้ง (ไว้อ้างอิง)
  line_user_id     text,          -- userId จริงจาก LINE Webhook (ใช้ส่ง push)
  address          text,
  created_at       timestamptz not null default now()
);
create index customers_phone_idx on customers (phone);
create index customers_name_idx on customers (name);

-- ---------- TOOLS ----------
create table tools (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references customers(id) on delete cascade,
  brand          tool_brand not null,
  model          text not null,
  serial_number  text,
  created_at     timestamptz not null default now()
);
create index tools_customer_idx on tools (customer_id);
create index tools_serial_idx on tools (serial_number);

-- ---------- REPAIR JOBS ----------
create table repair_jobs (
  id                  uuid primary key default gen_random_uuid(),
  doc_no              text not null unique,         -- เลขที่เอกสาร (กรอกเอง)
  tool_id             uuid not null references tools(id) on delete restrict,
  customer_id         uuid not null references customers(id) on delete restrict,
  branch_id           uuid references branches(id),
  issue_description   text not null,
  status              repair_status not null default 'received',
  warranty            warranty_status not null default 'unknown',
  accessories         text[] not null default '{}',  -- อุปกรณ์ที่ฝากมา เช่น แบต, ที่ชาร์จ, กล่อง
  received_documents  text[] not null default '{}',  -- เอกสารที่มากับสินค้า เช่น ใบเสร็จ, บัตรรับประกัน
  quotation_price     numeric(12,2),
  labor_cost          numeric(12,2) not null default 0,
  repair_notes        text,
  technician_id       uuid references profiles(id),
  technician_name     text,
  received_at         date not null default current_date,
  completed_at        timestamptz,
  delivered_at        timestamptz,
  created_by          uuid references profiles(id) default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index repair_jobs_status_idx on repair_jobs (status);
create index repair_jobs_customer_idx on repair_jobs (customer_id);
create index repair_jobs_created_idx on repair_jobs (created_at desc);

create trigger repair_jobs_updated_at
  before update on repair_jobs
  for each row execute function set_updated_at();

-- ---------- PARTS (อะไหล่ที่ใช้) ----------
create table repair_parts (
  id             uuid primary key default gen_random_uuid(),
  repair_job_id  uuid not null references repair_jobs(id) on delete cascade,
  part_name      text not null,
  part_code      text,
  quantity       numeric(10,2) not null default 1 check (quantity > 0),
  unit_price     numeric(12,2) not null default 0,
  created_at     timestamptz not null default now()
);
create index repair_parts_job_idx on repair_parts (repair_job_id);

-- ---------- IMAGES / FILES (Google Drive) ----------
create table repair_images (
  id             uuid primary key default gen_random_uuid(),
  repair_job_id  uuid not null references repair_jobs(id) on delete cascade,
  category       file_category not null default 'before',
  drive_file_id  text not null,
  image_url      text not null,
  file_name      text,
  mime_type      text,
  created_at     timestamptz not null default now()
);
create index repair_images_job_idx on repair_images (repair_job_id);

-- ---------- STATUS HISTORY ----------
create table job_status_history (
  id             uuid primary key default gen_random_uuid(),
  repair_job_id  uuid not null references repair_jobs(id) on delete cascade,
  from_status    repair_status,
  to_status      repair_status not null,
  changed_by     uuid references profiles(id) default auth.uid(),
  created_at     timestamptz not null default now()
);
create index job_status_history_job_idx on job_status_history (repair_job_id, created_at);

create or replace function log_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into job_status_history (repair_job_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into job_status_history (repair_job_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
    if new.status = 'ready' and new.completed_at is null then new.completed_at = now(); end if;
    if new.status = 'delivered' and new.delivered_at is null then new.delivered_at = now(); end if;
  end if;
  return new;
end $$;

-- BEFORE UPDATE เพื่อเซ็ต completed_at/delivered_at ได้, AFTER INSERT เพื่อให้ FK มีอยู่แล้ว
create trigger repair_jobs_status_update
  before update on repair_jobs
  for each row execute function log_status_change();
create trigger repair_jobs_status_insert
  after insert on repair_jobs
  for each row execute function log_status_change();

-- ---------- NOTES / CHAT ----------
create table job_notes (
  id             uuid primary key default gen_random_uuid(),
  repair_job_id  uuid not null references repair_jobs(id) on delete cascade,
  body           text not null,
  author_id      uuid references profiles(id) default auth.uid(),
  created_at     timestamptz not null default now()
);
create index job_notes_job_idx on job_notes (repair_job_id, created_at);

-- ---------- LINE MESSAGE LOG ----------
create table line_messages (
  id             uuid primary key default gen_random_uuid(),
  repair_job_id  uuid references repair_jobs(id) on delete set null,
  customer_id    uuid references customers(id) on delete set null,
  message        text not null,
  mode           text not null default 'mock' check (mode in ('mock', 'live')),
  success        boolean not null default true,
  error          text,
  sent_by        uuid references profiles(id) default auth.uid(),
  created_at     timestamptz not null default now()
);

-- ---------- VIEW: ยอดรวมต่องาน ----------
create or replace view repair_job_totals with (security_invoker = true) as
select
  j.id as repair_job_id,
  coalesce(sum(p.quantity * p.unit_price), 0)::numeric(12,2) as parts_total,
  j.labor_cost,
  (coalesce(sum(p.quantity * p.unit_price), 0) + j.labor_cost)::numeric(12,2) as grand_total
from repair_jobs j
left join repair_parts p on p.repair_job_id = j.id
group by j.id;

-- =====================================================================
-- ROW LEVEL SECURITY
-- พนักงานที่ล็อกอิน (admin + ช่าง) อ่านได้ทุกอย่าง / เฉพาะ admin เขียนได้
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'branches','customers','tools','repair_jobs','repair_parts',
    'repair_images','job_status_history','job_notes','line_messages'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "staff read %1$s" on %1$I for select to authenticated using (true)', t);
    execute format('create policy "admin insert %1$s" on %1$I for insert to authenticated with check (is_admin())', t);
    execute format('create policy "admin update %1$s" on %1$I for update to authenticated using (is_admin()) with check (is_admin())', t);
    execute format('create policy "admin delete %1$s" on %1$I for delete to authenticated using (is_admin())', t);
  end loop;
end $$;

alter table profiles enable row level security;
create policy "staff read profiles" on profiles for select to authenticated using (true);
create policy "admin update profiles" on profiles for update to authenticated using (is_admin()) with check (is_admin());

-- =====================================================================
-- PUBLIC TRACKING (ลูกค้าเช็กสถานะด้วยเลขที่เอกสาร ไม่ต้องล็อกอิน)
-- คืนเฉพาะข้อมูลที่ปลอดภัย ไม่เปิดเบอร์โทร/ที่อยู่
-- =====================================================================
create or replace function public_track_job(p_doc_no text)
returns table (
  doc_no text, brand tool_brand, model text, status repair_status,
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
