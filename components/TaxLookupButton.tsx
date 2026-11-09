"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import type { VatInfo } from "@/lib/rd-vat";

/** ปุ่ม "ดึงข้อมูลจากสรรพากร" — getTin อ่านเลขจากช่อง, onPick ได้ข้อมูลสาขาที่เลือก */
export default function TaxLookupButton({
  getTin,
  onPick,
  disabled,
}: {
  getTin: () => string;
  onPick: (info: VatInfo) => void;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [choices, setChoices] = useState<VatInfo[]>([]);

  function pick(info: VatInfo) {
    onPick(info);
    setChoices([]);
    setMsg({ ok: true, t: `ดึงข้อมูลแล้ว: ${info.name} (${info.branch_label}) ตรวจสอบแล้วกดบันทึก` });
  }

  async function run() {
    const tin = getTin().replace(/\D/g, "");
    setChoices([]);
    if (tin.length !== 13) return setMsg({ ok: false, t: "กรอกเลขผู้เสียภาษี 13 หลักก่อน" });
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/tax-lookup?tin=${tin}`, { cache: "no-store" });
      const data = (await res.json()) as { results?: VatInfo[]; error?: string };
      if (!res.ok || !data.results?.length) setMsg({ ok: false, t: data.error ?? "ไม่พบข้อมูล" });
      else if (data.results.length === 1) pick(data.results[0]);
      else setChoices(data.results);
    } catch {
      setMsg({ ok: false, t: "ดึงข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <button type="button" onClick={run} disabled={disabled || loading} className="btn btn-secondary btn-sm">
        <Search size={13} /> {loading ? "กำลังค้นหา" : "ดึงข้อมูลจากสรรพากร"}
      </button>
      {choices.length > 0 && (
        <div className="space-y-1 rounded-md border border-line bg-white p-2">
          <p className="text-xs text-muted">พบ {choices.length} สาขา เลือกสาขาที่ต้องการ</p>
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {choices.map((c) => (
              <li key={c.branch_no}>
                <button type="button" onClick={() => pick(c)} className="w-full rounded px-2 py-1 text-left text-xs hover:bg-steel">
                  <span className="font-medium">{c.branch_label}</span>
                  <span className="block truncate text-muted">{c.address}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {msg && <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.t}</p>}
    </div>
  );
}
