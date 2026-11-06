"use client";

import { FileDown, Printer } from "lucide-react";

export default function PrintQuoteButton() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted">บันทึก PDF: กดพิมพ์ แล้วเลือกเครื่องพิมพ์ “บันทึกเป็น PDF / Save as PDF”</span>
      <button onClick={() => window.print()} className="btn btn-secondary">
        <FileDown size={16} /> บันทึก PDF
      </button>
      <button onClick={() => window.print()} className="btn btn-primary">
        <Printer size={16} /> พิมพ์
      </button>
    </div>
  );
}
