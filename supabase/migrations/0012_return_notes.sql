-- =====================================================================
-- 0012: ใบส่งคืนสินค้าชั่วคราว (RN2611-0001)
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
-- =====================================================================
create table if not exists return_notes (
  id                uuid primary key default gen_random_uuid(),
  note_no           text not null unique,
  customer_id       uuid references customers(id) on delete set null,
  customer_name     text not null,
  customer_address  text,
  customer_phone    text,
  issue_date        date not null default (now() at time zone 'Asia/Bangkok')::date,
  -- รายการ: [{ job_id, doc_no, description, serial_no, qty, unit, remark }]
  items             jsonb not null default '[]'::jsonb,
  notes             text,
  status            text not null default 'issued' check (status in ('issued', 'returned', 'cancelled')),
  created_by        uuid references profiles(id) default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists return_notes_date_idx on return_notes (issue_date desc);
create index if not exists return_notes_customer_idx on return_notes (customer_id);
create index if not exists return_notes_items_idx on return_notes using gin (items jsonb_path_ops);

drop trigger if exists return_notes_updated_at on return_notes;
create trigger return_notes_updated_at before update on return_notes
  for each row execute function set_updated_at();

alter table return_notes enable row level security;
drop policy if exists "staff read return_notes" on return_notes;
drop policy if exists "staff insert return_notes" on return_notes;
drop policy if exists "staff update return_notes" on return_notes;
drop policy if exists "admin delete return_notes" on return_notes;
create policy "staff read return_notes"   on return_notes for select to authenticated using (true);
create policy "staff insert return_notes" on return_notes for insert to authenticated with check (is_staff());
create policy "staff update return_notes" on return_notes for update to authenticated using (is_staff()) with check (is_staff());
create policy "admin delete return_notes" on return_notes for delete to authenticated using (is_admin());
