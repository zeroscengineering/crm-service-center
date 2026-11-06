# ตั้งค่า Google Drive (Gmail ส่วนตัว)

หลังตั้งค่าครั้งแรก (ทำครั้งเดียว ~10 นาที) การเชื่อมต่อ/เปลี่ยนบัญชี/ยกเลิก ทำได้ที่เมนู **⚙️ ตั้งค่า** ในโปรแกรม

สิ่งที่เก็บใน Drive (โฟลเดอร์ `CRM-SERVICE CENTER` สร้างให้อัตโนมัติ):
- `CRM-SERVICE CENTER / <เลขที่เอกสาร>` — รูปก่อน/หลังซ่อม และไฟล์เอกสาร
- `CRM-SERVICE CENTER / สำรองข้อมูล (Backups)` — สำรองข้อมูลแชท/โน้ต ลูกค้า งานซ่อม อะไหล่ (JSON + CSV)

ระบบใช้สิทธิ์ `drive.file` = เห็น **เฉพาะไฟล์ที่ระบบสร้างเอง** ไม่อ่านไฟล์อื่นใน Drive ของคุณ
ไฟล์ไม่ถูกเปิดสาธารณะ — ดูได้ผ่านเว็บ CRM ที่ล็อกอินแล้วเท่านั้น

---

## ขั้นที่ 1 — Supabase (2 อย่าง)
1. **SQL Editor** → วางไฟล์ `supabase/migrations/0002_app_settings.sql` → **Run**
2. **Project Settings → API Keys** → คัดลอก **service_role** key (secret)
   ⚠️ คีย์นี้มีสิทธิ์เต็ม — ใส่ใน Vercel เท่านั้น ห้ามแชร์

## ขั้นที่ 2 — Google Cloud Console
1. เปิด https://console.cloud.google.com ล็อกอินด้วยบัญชีที่จะใช้เก็บไฟล์ (ไม่ต้องใส่บัตรเครดิต)
2. แถบบน → ช่องเลือกโปรเจกต์ → **New Project** → ชื่อ `CRM Service Center` → **Create** → เลือกโปรเจกต์นี้
3. ☰ → **APIs & Services → Library** → ค้นหา `Google Drive API` → **Enable**
4. ☰ → **APIs & Services → OAuth consent screen** (Google Auth Platform) → **Get started**
   - App name: `CRM Service Center` · Support email: อีเมลคุณ → Next
   - Audience: **External** → Next
   - Contact: อีเมลคุณ → Next → ติ๊กยอมรับ → **Create**
5. ⚠️ เมนู **Audience** → **Publish app** → Confirm → ต้องเป็น **In production**
   (ถ้าค้าง *Testing* การเชื่อมต่อจะหลุดทุก 7 วัน · ไม่ต้องส่ง verification)
6. เมนู **Clients** → **Create client**
   - Application type: **Web application** · Name: `CRM Vercel`
   - **Authorized redirect URIs** → Add URI → วางลิงก์ที่แสดงในหน้า **⚙️ ตั้งค่า** ของโปรแกรม
     (รูปแบบ `https://<ชื่อเว็บ>.vercel.app/api/google/callback` — มีปุ่มคัดลอกให้)
   - **Create** → คัดลอก **Client ID** และ **Client secret** (กด Download JSON เก็บไว้ด้วย)

## ขั้นที่ 3 — Vercel
**Settings → Environment Variables** → เพิ่ม (Production and Preview)

| Key | Value |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | จากขั้นที่ 1 |
| `GOOGLE_CLIENT_ID` | จากขั้นที่ 2 |
| `GOOGLE_CLIENT_SECRET` | จากขั้นที่ 2 |
| `CRON_SECRET` | ตั้งเองเป็นข้อความสุ่มยาว ๆ (เช่น `crm-backup-8f3k2m9x7q`) — ใช้เปิดสำรองข้อมูลอัตโนมัติทุกคืน |

⚠️ ห้ามใส่ `NEXT_PUBLIC_` นำหน้า → **Save** → **Deployments** → รายการบนสุด → ⋯ → **Redeploy**

## ขั้นที่ 4 — กดเชื่อมต่อในโปรแกรม
1. ล็อกอินเว็บ CRM → เมนู **⚙️ ตั้งค่า** (เช็กลิสต์ต้องเป็น ✅ ครบ)
2. กด **เชื่อมต่อ Google Drive** → เลือกบัญชี
3. หน้า *"Google hasn't verified this app"* (ปกติ เพราะเป็นแอปของคุณเอง) → **Advanced** → **Go to CRM Service Center (unsafe)**
4. ✅ ติ๊กช่องอนุญาต **Google Drive** → **Continue**
5. กลับมาหน้าตั้งค่า → จะเห็นบัญชี พื้นที่คงเหลือ (GB) จำนวนไฟล์ → กด **💾 สำรองข้อมูลตอนนี้** เพื่อทดสอบ

---

## แก้ปัญหา
| อาการ | วิธีแก้ |
|---|---|
| เช็กลิสต์ไม่ ✅ ทั้งที่ใส่ค่าแล้ว | ยังไม่ได้ Redeploy หรือชื่อ Key สะกดผิด |
| `redirect_uri_mismatch` | Redirect URI ใน Google Cloud ไม่ตรงกับที่หน้าตั้งค่าแสดง — คัดลอกใหม่ (ต้องเป็นโดเมน production) |
| `Error 403: access_denied` | ยังไม่ได้ Publish app (ขั้นที่ 2 ข้อ 5) |
| "ไม่ได้ติ๊กอนุญาตสิทธิ์ Google Drive" | ตอนเชื่อมต่อต้องติ๊กช่อง Drive ด้วย — กดเชื่อมต่อใหม่ |
| "สิทธิ์การเชื่อมต่อหมดอายุ" | กด **เปลี่ยนบัญชี / เชื่อมต่อใหม่** ในหน้าตั้งค่า |
| "ไฟล์ใหญ่เกิน 4MB" | รูปถูกย่ออัตโนมัติแล้ว — มักเกิดกับ PDF ใหญ่ ให้บีบอัดก่อน |
