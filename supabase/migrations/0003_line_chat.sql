-- =====================================================================
-- 0003: หน้าแชทกับลูกค้า (LINE)
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
-- =====================================================================

-- ผู้ติดต่อ LINE (ทุกคนที่ทักเข้ามา — อาจยังไม่ได้ผูกกับลูกค้า)
create table if not exists line_contacts (
  line_user_id       text primary key,
  display_name       text,
  picture_url        text,
  customer_id        uuid references customers(id) on delete set null,
  last_message_at    timestamptz,
  last_message_text  text,
  unread_count       int not null default 0,
  created_at         timestamptz not null default now()
);
create index if not exists line_contacts_last_idx on line_contacts (last_message_at desc nulls last);
create index if not exists line_contacts_customer_idx on line_contacts (customer_id);

-- ข้อความแชท (เข้า/ออก)
create table if not exists chat_messages (
  id               uuid primary key default gen_random_uuid(),
  line_user_id     text not null references line_contacts(line_user_id) on delete cascade,
  direction        text not null check (direction in ('in', 'out')),
  msg_type         text not null default 'text',   -- text / image / sticker / file / video / audio / location
  text             text,
  line_message_id  text,
  drive_file_id    text,                           -- รูปที่ลูกค้าส่ง บันทึกลง Google Drive
  status           text not null default 'sent',   -- sent / mock / failed
  error            text,
  sent_by          uuid references profiles(id),
  created_at       timestamptz not null default now()
);
create index if not exists chat_messages_user_idx on chat_messages (line_user_id, created_at);

-- ผูกลูกค้าเดิมที่เชื่อม LINE แล้ว เข้ากับรายชื่อผู้ติดต่อ
insert into line_contacts (line_user_id, display_name, customer_id)
select line_user_id, name, id from customers where line_user_id is not null
on conflict (line_user_id) do nothing;

-- RLS: พนักงานอ่านได้ / แอดมินเขียนได้ (webhook ใช้ service_role)
alter table line_contacts enable row level security;
alter table chat_messages enable row level security;

drop policy if exists "staff read line_contacts" on line_contacts;
drop policy if exists "admin write line_contacts" on line_contacts;
drop policy if exists "staff read chat_messages" on chat_messages;
drop policy if exists "admin write chat_messages" on chat_messages;

create policy "staff read line_contacts" on line_contacts for select to authenticated using (true);
create policy "admin write line_contacts" on line_contacts for all to authenticated using (is_admin()) with check (is_admin());
create policy "staff read chat_messages" on chat_messages for select to authenticated using (true);
create policy "admin write chat_messages" on chat_messages for all to authenticated using (is_admin()) with check (is_admin());
