-- =====================================================================
-- 0004: แท็กแชท + ระบบขนส่ง
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
-- =====================================================================

-- ---------- แท็ก ----------
create table if not exists tags (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  color       text not null default '#64748b',
  created_at  timestamptz not null default now()
);

create table if not exists contact_tags (
  line_user_id  text not null references line_contacts(line_user_id) on delete cascade,
  tag_id        uuid not null references tags(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (line_user_id, tag_id)
);
create index if not exists contact_tags_tag_idx on contact_tags (tag_id);

-- ---------- ขนส่ง ----------
create table if not exists carriers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  tracking_url  text,              -- ลิงก์ติดตามพัสดุ ใช้ {tracking} แทนเลขพัสดุ
  phone         text,
  active        boolean not null default true,
  sort          int not null default 100,
  created_at    timestamptz not null default now()
);

insert into carriers (name, tracking_url, sort) values
  ('ลูกค้ามาส่ง/รับเองที่ร้าน', null, 1),
  ('ไปรษณีย์ไทย (EMS)', 'https://track.thailandpost.co.th/?trackNumber={tracking}', 10),
  ('Flash Express', null, 20),
  ('KEX (Kerry)', null, 30),
  ('J&T Express', null, 40),
  ('Lalamove', null, 50),
  ('รถส่งของร้าน', null, 60)
on conflict (name) do nothing;

alter table customers add column if not exists default_carrier_id uuid references carriers(id) on delete set null;

create table if not exists shipments (
  id             uuid primary key default gen_random_uuid(),
  repair_job_id  uuid references repair_jobs(id) on delete cascade,
  customer_id    uuid references customers(id) on delete set null,
  direction      text not null default 'outbound' check (direction in ('inbound', 'outbound')),
  carrier_id     uuid references carriers(id) on delete set null,
  tracking_no    text,
  sender_name    text,             -- ชื่อคนส่ง / พนักงานขนส่ง (กรอกภายหลังได้)
  status         text not null default 'pending' check (status in ('pending', 'shipped', 'delivered')),
  shipped_at     date,
  cost           numeric(12,2),
  note           text,
  created_by     uuid references profiles(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists shipments_job_idx on shipments (repair_job_id);
create index if not exists shipments_status_idx on shipments (status, created_at desc);

drop trigger if exists shipments_updated_at on shipments;
create trigger shipments_updated_at before update on shipments
  for each row execute function set_updated_at();

-- ---------- RLS: พนักงานอ่านได้ / แอดมินเขียนได้ ----------
do $$
declare t text;
begin
  foreach t in array array['tags', 'contact_tags', 'carriers', 'shipments'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "staff read %1$s" on %1$I', t);
    execute format('drop policy if exists "admin write %1$s" on %1$I', t);
    execute format('create policy "staff read %1$s" on %1$I for select to authenticated using (true)', t);
    execute format('create policy "admin write %1$s" on %1$I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;
