-- =====================================================================
-- 0008: หน้าข้อมูลลูกค้า — ข้อมูลติดต่อเพิ่มเติม ผู้ดูแล โน้ตภายใน แท็ก
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
-- =====================================================================
alter table customers add column if not exists company_name   text;
alter table customers add column if not exists contact_person text;
alter table customers add column if not exists email          text;
alter table customers add column if not exists tax_id         text;
alter table customers add column if not exists tax_branch     text;
alter table customers add column if not exists owner_id       uuid references profiles(id) on delete set null;

-- โน้ตภายในของลูกค้า (ลูกค้าไม่เห็น)
create table if not exists customer_notes (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers(id) on delete cascade,
  body         text not null,
  author_id    uuid references profiles(id) default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists customer_notes_idx on customer_notes (customer_id, created_at desc);

-- แท็กของลูกค้า (ใช้รายการแท็กเดียวกับหน้าแชท)
create table if not exists customer_tags (
  customer_id  uuid not null references customers(id) on delete cascade,
  tag_id       uuid not null references tags(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (customer_id, tag_id)
);
create index if not exists customer_tags_tag_idx on customer_tags (tag_id);

do $$
declare t text;
begin
  foreach t in array array['customer_notes', 'customer_tags'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "staff read %1$s" on %1$I', t);
    execute format('drop policy if exists "staff write %1$s" on %1$I', t);
    execute format('create policy "staff read %1$s" on %1$I for select to authenticated using (true)', t);
    execute format('create policy "staff write %1$s" on %1$I for all to authenticated using (is_staff()) with check (is_staff())', t);
  end loop;
end $$;
