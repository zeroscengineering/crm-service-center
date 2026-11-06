# CRM-SERVICE CENTER

ระบบรับแจ้งซ่อมและติดตามสถานะเครื่องมือช่าง (Milwaukee · Skil · Workpro)
Next.js (App Router) + TypeScript + Tailwind CSS + Supabase

## สถานะเฟส

| เฟส | เนื้อหา | สถานะ |
|---|---|---|
| 1 | โครงโปรเจกต์ ฐานข้อมูล ล็อกอิน สิทธิ์ (แอดมินแก้ไขได้ / ช่างดูอย่างเดียว) | ✅ |
| 2 | ฟอร์มรับแจ้งซ่อม + ทะเบียนลูกค้าและเครื่องมือ + ใบรับเครื่องพิมพ์ได้ (QR) + หน้าเช็กสถานะ `/track` | ✅ |
| 3 | Pipeline (Kanban ลากเปลี่ยนสถานะ) + หน้ารายละเอียดงาน + อะไหล่/ค่าใช้จ่าย + ไทม์ไลน์ + โน้ต | ✅ |
| 4 | หน้าตั้งค่า + ปุ่มเชื่อมต่อ Google Drive ในโปรแกรม + พื้นที่คงเหลือ/จำนวนไฟล์ + อัปโหลดรูป/เอกสาร + สำรองข้อมูล (มือ/อัตโนมัติทุกคืน) — ดู `docs/google-drive-setup.md` | ✅ |
| 5 | LINE OA แจ้งเตือน (โหมดจำลอง → ใช้งานจริง) | ⏳ |
| 6 | Dashboard สรุปรายเดือน | ⏳ |

## ตั้งค่าครั้งแรก (ทำครั้งเดียว ไม่ต้องใช้ Terminal)

### 1) Supabase
1. สร้างโปรเจกต์ใหม่ที่ supabase.com (Region: Singapore)
2. เมนู **SQL Editor** → วางไฟล์ `supabase/migrations/0001_init.sql` ทั้งไฟล์ → **Run**
3. เมนู **Authentication → Users → Add user** สร้างบัญชีพนักงาน (ติ๊ก Auto Confirm)
4. ตั้งตัวเองเป็นแอดมิน: กลับไป SQL Editor แล้วรัน
   ```sql
   insert into profiles (id, full_name, role)
   select id, 'ชื่อของคุณ', 'admin' from auth.users where email = 'อีเมลของคุณ'
   on conflict (id) do update set role = 'admin', full_name = excluded.full_name;
   ```
   ผู้ใช้ที่สร้างใหม่จะเป็น **ช่าง (ดูอย่างเดียว)** โดยอัตโนมัติ
5. เมนู **Project Settings → API** คัดลอก `Project URL` และ `anon public key`

### ข้อมูลร้านบนใบรับเครื่อง
แก้ชื่อร้าน ที่อยู่ เบอร์โทร และเงื่อนไข ได้ที่ `SHOP` ในไฟล์ `lib/constants.ts` (หรือสั่งผ่านแชท)

### 2) Vercel
1. Add New → Project → Import repo นี้จาก GitHub
2. ใส่ Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy — หลังจากนี้ทุกการ push ขึ้น `main` จะ deploy อัตโนมัติ

## โครงสร้างโปรเจกต์

```
app/
  (app)/            # หน้าที่ต้องล็อกอิน (มี sidebar)
    dashboard/
  login/            # หน้าล็อกอินพนักงาน
  auth/signout/     # ออกจากระบบ
components/         # UI ที่ใช้ซ้ำ
lib/
  supabase/         # Supabase client (browser / server / middleware)
  auth.ts           # requireProfile(), requireAdmin()
  constants.ts      # แบรนด์ สถานะ ป้ายภาษาไทย
middleware.ts       # กันหน้าที่ต้องล็อกอิน
supabase/migrations # SQL ฐานข้อมูล
```

## ความปลอดภัย
- สิทธิ์บังคับที่ระดับฐานข้อมูล (Row Level Security): ช่างแก้ข้อมูลไม่ได้แม้จะเรียก API ตรง
- หน้าเช็กสถานะสาธารณะใช้ฟังก์ชัน `public_track_job()` ซึ่งคืนเฉพาะสถานะ/รุ่น/ชื่อแบบปิดบางส่วน ไม่เปิดเบอร์โทรหรือที่อยู่
