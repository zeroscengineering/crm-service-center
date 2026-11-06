"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Printer, Trash2 } from "lucide-react";
import { deleteJobs } from "@/app/(app)/jobs/delete-actions";
import StatusBadge from "@/components/StatusBadge";
import { formatDate, formatPhone } from "@/lib/format";
import type { RepairStatus } from "@/lib/constants";

export type JobsTableRow = {
  id: string;
  doc_no: string;
  status: RepairStatus;
  received_at: string;
  technician_name: string | null;
  customers: { name: string; phone: string } | null;
  tools: { brand: string; model: string; serial_number: string | null } | null;
};

export default function JobsTable({ rows, canDelete }: { rows: JobsTableRow[]; canDelete: boolean }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const allOn = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  function removeSelected() {
    const ids = [...sel];
    const docs = rows.filter((r) => sel.has(r.id)).map((r) => r.doc_no);
    if (
      !confirm(
        `ลบงานซ่อม ${ids.length} งาน?\n${docs.slice(0, 10).join(", ")}${docs.length > 10 ? " ..." : ""}\n\nจะลบโน้ต ไทม์ไลน์ ขนส่ง ใบเสนอราคา และรูปของงานเหล่านี้ด้วย กู้คืนไม่ได้`,
      )
    )
      return;
    start(async () => {
      const r = await deleteJobs(ids);
      if (r.error) setMsg({ ok: false, t: r.error });
      else {
        setMsg({ ok: true, t: `ลบแล้ว ${r.deleted} งาน` });
        setSel(new Set());
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {canDelete && (sel.size > 0 || msg) && (
        <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-white px-4 py-2.5">
          {sel.size > 0 && (
            <>
              <span className="text-sm font-medium">เลือกแล้ว {sel.size} งาน</span>
              <button onClick={removeSelected} disabled={pending} className="btn btn-danger btn-sm">
                <Trash2 size={14} /> {pending ? "กำลังลบ..." : "ลบที่เลือก"}
              </button>
              <button onClick={() => setSel(new Set())} className="btn btn-ghost btn-sm">
                ยกเลิกการเลือก
              </button>
            </>
          )}
          {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.t}</span>}
        </div>
      )}

      <div className="panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {canDelete && (
                <th className="w-10">
                  <input
                    type="checkbox"
                    aria-label="เลือกทั้งหมด"
                    checked={allOn}
                    onChange={() => setSel(allOn ? new Set() : new Set(rows.map((r) => r.id)))}
                  />
                </th>
              )}
              <th>เลขที่เอกสาร</th>
              <th>วันที่รับ</th>
              <th>ลูกค้า</th>
              <th>เครื่องมือ</th>
              <th>ช่าง</th>
              <th>สถานะ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((j) => (
              <tr key={j.id} className={sel.has(j.id) ? "bg-rose-50/50" : ""}>
                {canDelete && (
                  <td>
                    <input type="checkbox" aria-label={`เลือก ${j.doc_no}`} checked={sel.has(j.id)} onChange={() => toggle(j.id)} />
                  </td>
                )}
                <td>
                  <Link href={`/jobs/${j.id}`} className="doc-tag hover:border-graphite/60">
                    {j.doc_no}
                  </Link>
                </td>
                <td className="whitespace-nowrap">{formatDate(j.received_at)}</td>
                <td>
                  {j.customers?.name}
                  <span className="block text-xs text-muted">{formatPhone(j.customers?.phone)}</span>
                </td>
                <td>
                  {j.tools?.brand} {j.tools?.model}
                  {j.tools?.serial_number && (
                    <span className="block font-mono text-xs text-muted">S/N {j.tools.serial_number}</span>
                  )}
                </td>
                <td>{j.technician_name ?? "-"}</td>
                <td>
                  <StatusBadge status={j.status} />
                </td>
                <td className="text-right">
                  <Link href={`/print/job/${j.id}`} className="btn btn-ghost btn-sm" title="พิมพ์ใบรับเครื่อง">
                    <Printer size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">ไม่พบงานซ่อม</p>}
      </div>
    </div>
  );
}
