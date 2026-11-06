# ตั้งค่า Google Drive (Gmail ส่วนตัว)

ระบบจะอัปโหลดรูป/เอกสารลง Google Drive ของบัญชีคุณ ในโฟลเดอร์
`CRM-SERVICE CENTER / <เลขที่เอกสาร>` (ระบบสร้างให้อัตโนมัติ)

ใช้สิทธิ์ `drive.file` = แอปเห็น **เฉพาะไฟล์ที่แอปสร้างเอง** ไม่สามารถอ่านไฟล์อื่นใน Drive ของคุณ
ไฟล์ไม่ถูกเปิดเป็นสาธารณะ — พนักงานดูผ่านเว็บ CRM ที่ล็อกอินแล้วเท่านั้น

ใช้เวลาประมาณ 10–15 นาที ทำครั้งเดียว

---

## ส่วน A — สร้างโปรเจกต์ Google Cloud
1. เปิด https://console.cloud.google.com แล้วล็อกอินด้วย **zero.scengineering@gmail.com**
   (ครั้งแรกอาจให้ยอมรับเงื่อนไข → ติ๊ก แล้ว Agree — ไม่ต้องใส่บัตรเครดิต)
2. แถบบนสุด กดช่องเลือกโปรเจกต์ (ข้างโลโก้ Google Cloud) → **New Project**
3. Project name: `CRM Service Center` → **Create**
4. รอสักครู่ แล้วกดช่องเลือกโปรเจกต์อีกครั้ง → เลือก **CRM Service Center** (ต้องเห็นชื่อนี้บนแถบบน)

## ส่วน B — เปิดใช้ Google Drive API
1. เมนูซ้าย ☰ → **APIs & Services → Library**
2. ค้นหา `Google Drive API` → คลิก → **Enable**

## ส่วน C — ตั้งค่าหน้าขออนุญาต (OAuth consent screen)
1. เมนูซ้าย ☰ → **APIs & Services → OAuth consent screen** (หรือ **Google Auth Platform**) → **Get started**
2. กรอก
   - App name: `CRM Service Center`
   - User support email: zero.scengineering@gmail.com → **Next**
3. Audience: เลือก **External** → **Next**
4. Contact information: zero.scengineering@gmail.com → **Next**
5. ติ๊กยอมรับนโยบาย → **Continue** → **Create**
6. ⚠️ **สำคัญมาก:** ไปที่เมนู **Audience** → กด **Publish app** → **Confirm**
   ให้สถานะเป็น **In production**
   (ถ้าค้างไว้ที่ *Testing* — token จะหมดอายุทุก 7 วัน และการอัปโหลดจะหยุดทำงาน)
   ไม่ต้องส่งตรวจสอบ (verification) เพราะสิทธิ์ drive.file ไม่ใช่สิทธิ์อ่อนไหว

## ส่วน D — สร้าง OAuth Client
1. เมนู **Clients** (หรือ APIs & Services → Credentials → Create credentials → OAuth client ID) → **Create client**
2. Application type: **Web application**
3. Name: `CRM Vercel`
4. **Authorized redirect URIs** → **Add URI** → วาง
   ```
   https://developers.google.com/oauthplayground
   ```
5. **Create**
6. จะมีหน้าต่างแสดง **Client ID** และ **Client secret**
   → คัดลอกทั้งสองค่าเก็บไว้ (หรือกด **Download JSON**)
   ⚠️ Client secret อาจแสดงครั้งเดียว — ห้ามส่งให้ใครหรือวางในแชท

## ส่วน E — สร้าง Refresh Token (ผ่าน OAuth Playground)
1. เปิด https://developers.google.com/oauthplayground
2. มุมขวาบน กด ⚙️ (OAuth 2.0 configuration)
   - ติ๊ก ✅ **Use your own OAuth credentials**
   - OAuth Client ID: วางจากส่วน D
   - OAuth Client secret: วางจากส่วน D
   - กด **Close**
3. ด้านซ้าย **Step 1** — ช่องล่างสุด *Input your own scopes* พิมพ์
   ```
   https://www.googleapis.com/auth/drive.file
   ```
   → กด **Authorize APIs**
4. เลือกบัญชี **zero.scengineering@gmail.com**
5. จะขึ้นคำเตือน *"Google hasn't verified this app"* (ปกติ เพราะเป็นแอปของคุณเอง)
   → กด **Advanced** → **Go to CRM Service Center (unsafe)** → **Continue**
6. กลับมาที่ Playground → **Step 2** → กด **Exchange authorization code for tokens**
7. คัดลอกค่า **Refresh token** (ขึ้นต้นด้วย `1//`) เก็บไว้

## ส่วน F — ใส่ค่าใน Vercel
1. Vercel → โปรเจกต์ crm-service-center → **Settings → Environment Variables**
2. เพิ่ม 3 ค่า (Environments: Production and Preview)

   | Key | Value |
   |---|---|
   | `GOOGLE_CLIENT_ID` | Client ID จากส่วน D |
   | `GOOGLE_CLIENT_SECRET` | Client secret จากส่วน D |
   | `GOOGLE_REFRESH_TOKEN` | Refresh token จากส่วน E |

   ⚠️ ห้ามใส่ `NEXT_PUBLIC_` นำหน้า (ค่าลับต้องอยู่ฝั่ง server เท่านั้น)
3. **Save**
4. ไปที่ **Deployments** → รายการบนสุด → ⋯ → **Redeploy** (ค่าใหม่จะมีผลหลัง redeploy)

## ส่วน G — ทดสอบ
1. เปิดงานซ่อมใดก็ได้ในเว็บ → การ์ด **รูปภาพ & เอกสาร** → **+ อัปโหลด**
2. เลือกรูป → รอขึ้น thumbnail
3. เปิด Google Drive ของคุณ → ควรเห็นโฟลเดอร์ `CRM-SERVICE CENTER` → โฟลเดอร์เลขที่เอกสาร → รูปที่อัปโหลด

---

## แก้ปัญหา
| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| ยังขึ้น "ยังไม่ได้เชื่อม Google Drive" | ยังไม่ได้ Redeploy หลังใส่ค่า หรือชื่อ Key สะกดผิด |
| "Refresh token หมดอายุหรือถูกยกเลิก" | ลืม Publish app (ส่วน C ข้อ 6) หรือไปกดยกเลิกสิทธิ์ใน Google Account → ทำส่วน E ใหม่ แล้วอัปเดตค่าใน Vercel |
| `redirect_uri_mismatch` ตอนทำส่วน E | URI ในส่วน D ข้อ 4 ไม่ตรง ต้องเป็น `https://developers.google.com/oauthplayground` เป๊ะ ๆ (ไม่มี / ท้าย) |
| "ไฟล์ใหญ่เกิน 4MB" | รูปถูกย่ออัตโนมัติแล้ว — ปัญหานี้มักเกิดกับ PDF ขนาดใหญ่ ให้บีบอัด PDF ก่อน |
| ย้าย/ลบโฟลเดอร์ใน Drive เอง | ระบบจะสร้างโฟลเดอร์ใหม่ให้อัตโนมัติ แต่ไฟล์ที่ลบใน Drive จะแสดงไม่ได้ในเว็บ |
