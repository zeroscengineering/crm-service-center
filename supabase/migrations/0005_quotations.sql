-- =====================================================================
-- 0005: ใบเสนอราคา
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
-- =====================================================================
create table if not exists quotations (
  id                uuid primary key default gen_random_uuid(),
  quote_no          text not null unique,
  repair_job_id     uuid references repair_jobs(id) on delete set null,
  customer_id       uuid references customers(id) on delete set null,
  -- ข้อมูลลูกค้า ณ วันที่ออกใบ (แก้ได้ ไม่กระทบทะเบียนลูกค้า)
  customer_name     text not null default '',
  customer_address  text,
  customer_phone    text,
  customer_tax_id   text,
  customer_branch   text,
  subject           text,
  issue_date        date not null default current_date,
  valid_days        int not null default 30,
  status            text not null default 'draft' check (status in ('draft','sent','accepted','rejected')),
  discount          numeric(12,2) not null default 0,
  vat_mode          text not null default 'exclude' check (vat_mode in ('exclude','include','none')),
  vat_rate          numeric(5,2) not null default 7,
  subtotal          numeric(12,2) not null default 0,
  vat_amount        numeric(12,2) not null default 0,
  grand_total       numeric(12,2) not null default 0,
  notes             text,
  terms             text,
  created_by        uuid references profiles(id) default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists quotations_job_idx on quotations (repair_job_id);
create index if not exists quotations_date_idx on quotations (issue_date desc);

create table if not exists quotation_items (
  id            uuid primary key default gen_random_uuid(),
  quotation_id  uuid not null references quotations(id) on delete cascade,
  sort          int not null default 0,
  description   text not null,
  qty           numeric(12,2) not null default 1,
  unit          text,
  unit_price    numeric(12,2) not null default 0
);
create index if not exists quotation_items_q_idx on quotation_items (quotation_id, sort);

drop trigger if exists quotations_updated_at on quotations;
create trigger quotations_updated_at before update on quotations
  for each row execute function set_updated_at();

do $$
declare t text;
begin
  foreach t in array array['quotations', 'quotation_items'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "staff read %1$s" on %1$I', t);
    execute format('drop policy if exists "admin write %1$s" on %1$I', t);
    execute format('create policy "staff read %1$s" on %1$I for select to authenticated using (true)', t);
    execute format('create policy "admin write %1$s" on %1$I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;
