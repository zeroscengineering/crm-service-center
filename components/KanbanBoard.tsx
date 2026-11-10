"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { updateStatus } from "@/app/(app)/jobs/actions";
import { Clock, Wrench } from "lucide-react";
import type { RepairStatus } from "@/lib/constants";
import { useStatuses } from "@/components/StatusProvider";
import { formatDate } from "@/lib/format";

export type BoardJob = {
  id: string;
  doc_no: string;
  status: RepairStatus;
  received_at: string;
  updated_at: string;
  technician_name: string | null;
  customer_name: string;
  tool_label: string;
  total: number;
};

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default function KanbanBoard({ jobs, canEdit }: { jobs: BoardJob[]; canEdit: boolean }) {
  const [optimisticJobs, moveJob] = useOptimistic(
    jobs,
    (state, { id, status }: { id: string; status: RepairStatus }) =>
      state.map((j) => (j.id === id ? { ...j, status } : j)),
  );
  const [, startTransition] = useTransition();
  const st = useStatuses();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<RepairStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  // แสดงการ์ดต่อคอลัมน์ทีละ 10 ใบ กด "ดูเพิ่มเติม" เพื่อแสดงอีก 10
  const PAGE = 10;
  const [shown, setShown] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState<string | null>(null);

  function move(id: string, status: RepairStatus) {
    const job = optimisticJobs.find((j) => j.id === id);
    if (!job || job.status === status) return;
    setError(null);
    startTransition(async () => {
      moveJob({ id, status });
      const res = await updateStatus(id, status);
      if (res.error) setError(`ย้าย ${job.doc_no} ไม่สำเร็จ: ${res.error}`);
      else if (res.info) setNotice(`${job.doc_no}: ${res.info}`);
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>
      )}
      {notice && (
        <p className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">{notice}</p>
      )}
      {canEdit && (
        <p className="text-xs text-muted">
          ลากการ์ดไปคอลัมน์อื่นเพื่อเปลี่ยนสถานะ (บนมือถือ ใช้เมนูเลือกสถานะบนการ์ด)
        </p>
      )}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {st.pipeline.map((col) => {
          const items = optimisticJobs.filter((j) => j.status === col);
          const limit = shown[col] ?? PAGE;
          const visible = items.slice(0, limit);
          const remaining = items.length - visible.length;
          return (
            <section
              key={col}
              onDragOver={(e) => {
                if (!canEdit || !dragId) return;
                e.preventDefault();
                setOverCol(col);
              }}
              onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragId;
                setOverCol(null);
                setDragId(null);
                if (id) move(id, col);
              }}
              style={{ borderTopColor: st.color(col) }}
              className={`flex w-72 shrink-0 flex-col rounded-[10px] border border-t-[3px] border-line bg-[#e4e7ea] ${
                overCol === col ? "ring-2 ring-brand/40" : ""
              }`}
            >
              <header className="flex items-center justify-between px-3 py-2">
                <h2 className="text-sm font-semibold">{st.label(col)}</h2>
                <span className="rounded-full bg-white px-2 font-mono text-xs font-semibold text-ink">{items.length}</span>
              </header>
              <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
                {visible.map((j) => {
                  const idle = daysSince(j.updated_at);
                  const stale = st.isOpen(col) && idle >= 7;
                  return (
                    <article
                      key={j.id}
                      draggable={canEdit}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", j.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(j.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverCol(null);
                      }}
                      className={`rounded-lg border bg-white p-3 text-sm shadow-sm ${
                        canEdit ? "cursor-grab active:cursor-grabbing" : ""
                      } ${dragId === j.id ? "opacity-50" : ""} ${stale ? "border-l-[3px] border-amber border-y-line border-r-line" : "border-line"} hover:shadow-[0_1px_0_rgba(31,35,40,0.08)]`}
                    >
                      <Link href={`/jobs/${j.id}`} className="block">
                        <div className="flex items-center justify-between">
                          <span className="doc-tag">{j.doc_no}</span>
                          <span className="text-xs text-zinc-400">{formatDate(j.received_at)}</span>
                        </div>
                        <p className="mt-1 font-medium">{j.customer_name}</p>
                        <p className="text-muted">{j.tool_label}</p>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted">
                          <span className="flex items-center gap-1">
                            <Wrench size={12} /> {j.technician_name ?? "ยังไม่ระบุช่าง"}
                          </span>
                          {j.total > 0 && <span>฿{j.total.toLocaleString("th-TH")}</span>}
                        </div>
                        {stale && (
                          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-[#8a6100]">
                            <Clock size={12} /> ค้าง {idle} วัน
                          </p>
                        )}
                      </Link>
                      {canEdit && (
                        <select
                          value={j.status}
                          onChange={(e) => move(j.id, e.target.value as RepairStatus)}
                          className="mt-2 w-full rounded-md border border-line bg-steel/50 px-2 py-1 text-xs md:hidden"
                        >
                          {st.selectable.map((s) => (
                            <option key={s} value={s}>
                              {st.label(s)}
                            </option>
                          ))}
                        </select>
                      )}
                    </article>
                  );
                })}
                {items.length === 0 && (
                  <p className="py-6 text-center text-xs text-zinc-400">{canEdit ? "ลากการ์ดมาวางที่นี่" : "ไม่มีงาน"}</p>
                )}
                {remaining > 0 && (
                  <div className="space-y-1 pt-1">
                    <button
                      type="button"
                      onClick={() => setShown((m) => ({ ...m, [col]: limit + PAGE }))}
                      className="w-full rounded-lg border border-dashed border-zinc-400 bg-white/60 py-2 text-xs font-medium text-ink hover:bg-white"
                    >
                      ดูเพิ่มเติม ({Math.min(PAGE, remaining)} จาก {remaining} งานที่เหลือ)
                    </button>
                    <Link
                      href={`/jobs?view=list&status=${encodeURIComponent(col)}`}
                      className="block text-center text-[11px] text-muted hover:text-ink hover:underline"
                    >
                      ดูทั้งหมดในมุมมองตาราง
                    </Link>
                  </div>
                )}
                {remaining <= 0 && items.length > PAGE && (
                  <button
                    type="button"
                    onClick={() => setShown((m) => ({ ...m, [col]: PAGE }))}
                    className="w-full py-1 text-[11px] text-muted hover:text-ink hover:underline"
                  >
                    ย่อเหลือ {PAGE} ใบ
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
