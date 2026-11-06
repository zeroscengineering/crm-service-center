-- =====================================================================
-- 0002: ตารางเก็บการตั้งค่าระบบ (เช่น การเชื่อมต่อ Google Drive)
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันครั้งเดียว)
-- =====================================================================
create table if not exists app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- เปิด RLS โดยไม่มี policy = ผู้ใช้ทั่วไป (แม้แต่แอดมิน) อ่านตรงไม่ได้
-- เฉพาะเซิร์ฟเวอร์ที่ใช้ service_role key เท่านั้นที่อ่าน/เขียนได้ (เก็บ token อย่างปลอดภัย)
alter table app_settings enable row level security;
