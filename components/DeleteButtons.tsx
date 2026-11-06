"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteCustomer, deleteJobs } from "@/app/(app)/jobs/delete-actions";

/** ปุ่มลบงานซ่อมเดียว (หน้ารายละเอียดงาน) */
export function DeleteJobButton({ jobId, docNo }: { jobId: string; docNo: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        disabled={pending}
        onClick={() => {
          if (
            !confirm(
              `ลบงานซ่อม ${docNo}?\n\nจะลบโน้ต ไทม์ไลน์ ขนส่ง ใบเสนอราคา และรูปใน Google Drive ของงานนี้ด้วย\nกู้คืนไม่ได้`,
            )
          )
            return;
          start(async () => {
            const r = await deleteJobs([jobId]);
            if (r.error) setError(r.error);
            else router.push("/jobs");
          });
        }}
        className="btn btn-danger btn-sm"
      >
        <Trash2 size={14} /> {pending ? "กำลังลบ..." : "ลบงานนี้"}
      </button>
      {error && <span className="text-xs text-rose-700">{error}</span>}
    </div>
  );
}

/** ปุ่มลบลูกค้า (เฉพาะเมื่อไม่มีงานซ่อมเหลือ) */
export function DeleteCustomerButton({ customerId, name, jobCount }: { customerId: string; name: string; jobCount: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const disabled = jobCount > 0;
  return (
    <div className="flex items-center gap-2">
      <button
        disabled={pending || disabled}
        title={disabled ? "ลบงานซ่อมของลูกค้าก่อน จึงจะลบลูกค้าได้" : undefined}
        onClick={() => {
          if (!confirm(`ลบลูกค้า ${name} และเครื่องมือทั้งหมดของลูกค้านี้? กู้คืนไม่ได้`)) return;
          start(async () => {
            const r = await deleteCustomer(customerId);
            if (r.error) setError(r.error);
            else router.push("/customers");
          });
        }}
        className="btn btn-danger btn-sm"
      >
        <Trash2 size={14} /> {pending ? "กำลังลบ..." : "ลบลูกค้า"}
      </button>
      {disabled && <span className="text-xs text-muted">ลบได้เมื่อไม่มีงานซ่อมเหลือ</span>}
      {error && <span className="text-xs text-rose-700">{error}</span>}
    </div>
  );
}
