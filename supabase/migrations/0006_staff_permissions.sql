-- =====================================================================
-- 0006: สิทธิ์ใหม่ — ช่างทำงานประจำวันได้ทุกอย่าง, ตั้งค่าระบบเฉพาะแอดมิน
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
-- =====================================================================

-- พนักงาน = มี profile (แอดมินหรือช่าง) · บัญชีที่ถูกปิดใช้งานเข้าระบบไม่ได้อยู่แล้ว
create or replace function is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'technician'));
$$;

-- ตารางงานประจำวัน: แอดมิน + ช่าง เขียนได้
do $$
declare t text;
begin
  foreach t in array array[
    'customers','tools','repair_jobs','repair_parts','repair_images',
    'job_status_history','job_notes','line_messages',
    'line_contacts','chat_messages','tags','contact_tags',
    'shipments','quotations','quotation_items'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;  -- ข้ามตารางที่ยังไม่ได้สร้าง
    execute format('drop policy if exists "admin insert %1$s" on %1$I', t);
    execute format('drop policy if exists "admin update %1$s" on %1$I', t);
    execute format('drop policy if exists "admin delete %1$s" on %1$I', t);
    execute format('drop policy if exists "admin write %1$s" on %1$I', t);
    execute format('drop policy if exists "staff write %1$s" on %1$I', t);
    execute format('create policy "staff write %1$s" on %1$I for all to authenticated using (is_staff()) with check (is_staff())', t);
  end loop;
end $$;

-- ตารางตั้งค่าระบบ (branches, carriers, profiles) ยังเป็นสิทธิ์แอดมินตามเดิม
