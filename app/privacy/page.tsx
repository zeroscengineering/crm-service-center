import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = { title: "นโยบายความเป็นส่วนตัว | CRM-SERVICE CENTER" };

export default function PrivacyPage() {
  return (
    <LegalPage title="นโยบายความเป็นส่วนตัว (Privacy Policy)">
      <p>
        CRM-SERVICE CENTER เป็นระบบภายในของศูนย์บริการซ่อมเครื่องมือช่าง ใช้เพื่อรับแจ้งซ่อม ติดตามสถานะ
        และแจ้งผลการซ่อมให้ลูกค้า
      </p>

      <h2>ข้อมูลที่เก็บ</h2>
      <ul>
        <li>ข้อมูลลูกค้า: ชื่อ เบอร์โทรศัพท์ ที่อยู่ และ LINE ID</li>
        <li>ข้อมูลเครื่องมือ: แบรนด์ รุ่น หมายเลขเครื่อง อาการเสีย</li>
        <li>รูปภาพสภาพเครื่องและเอกสารประกอบการซ่อม</li>
        <li>บันทึกการซ่อม ค่าอะไหล่ และค่าบริการ</li>
      </ul>

      <h2>วัตถุประสงค์</h2>
      <p>ใช้เพื่อให้บริการซ่อม ติดต่อลูกค้า แจ้งสถานะ และเก็บประวัติการซ่อมเท่านั้น ไม่ขายหรือเปิดเผยข้อมูลแก่บุคคลภายนอก</p>

      <h2>การใช้ Google Drive</h2>
      <p>
        ระบบเชื่อมต่อ Google Drive ของร้านด้วยสิทธิ์ <code>drive.file</code> เพื่อเก็บรูปภาพ เอกสาร และไฟล์สำรองข้อมูล
        ระบบเข้าถึงได้เฉพาะไฟล์ที่ระบบสร้างขึ้นเองเท่านั้น ไม่อ่าน แก้ไข หรือลบไฟล์อื่นใน Google Drive
        และไม่ส่งข้อมูลจาก Google ไปให้บุคคลภายนอก การใช้ข้อมูลที่ได้รับจาก Google API เป็นไปตาม{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          className="font-medium text-brand hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Google API Services User Data Policy
        </a>{" "}
        รวมถึงข้อกำหนด Limited Use
      </p>

      <h2>การเข้าถึงและความปลอดภัย</h2>
      <p>
        เฉพาะพนักงานที่ได้รับอนุญาตเท่านั้นที่เข้าถึงข้อมูลได้ หน้าติดตามสถานะสำหรับลูกค้าแสดงเฉพาะสถานะงานและชื่อแบบปิดบางส่วน
        ไม่แสดงเบอร์โทรศัพท์หรือที่อยู่
      </p>

      <h2>สิทธิ์ของลูกค้า</h2>
      <p>ลูกค้าสามารถขอดู แก้ไข หรือลบข้อมูลของตนได้ โดยติดต่อร้านโดยตรง</p>

      <h2>ติดต่อ</h2>
      <p>zero.scengineering@gmail.com</p>
    </LegalPage>
  );
}
