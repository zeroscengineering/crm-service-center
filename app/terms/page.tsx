import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { SHOP } from "@/lib/constants";

export const metadata: Metadata = { title: "ข้อกำหนดการใช้งาน | CRM-SERVICE CENTER" };

export default function TermsPage() {
  return (
    <LegalPage title="ข้อกำหนดการใช้งาน (Terms of Service)">
      <p>
        ระบบ CRM-SERVICE CENTER ใช้สำหรับพนักงานของศูนย์บริการในการจัดการงานซ่อม และสำหรับลูกค้าในการตรวจสอบสถานะงานซ่อม
        ด้วยเลขที่เอกสาร
      </p>
      <h2>เงื่อนไขการรับซ่อม</h2>
      <ul>
        {SHOP.terms.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <h2>การใช้งานระบบ</h2>
      <ul>
        <li>บัญชีพนักงานสร้างโดยผู้ดูแลระบบเท่านั้น ห้ามให้ผู้อื่นใช้บัญชีแทน</li>
        <li>ข้อมูลสถานะที่แสดงเป็นข้อมูลล่าสุดที่ร้านบันทึก อาจมีความล่าช้าเล็กน้อย</li>
      </ul>
      <h2>ติดต่อ</h2>
      <p>zero.scengineering@gmail.com</p>
    </LegalPage>
  );
}
