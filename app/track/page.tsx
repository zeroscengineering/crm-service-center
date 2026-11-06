import type { Metadata } from "next";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PIPELINE, SHOP, STATUS_LABEL, type RepairStatus } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "ติดตามสถานะการซ่อม | CRM-SERVICE CENTER" };
export const dynamic = "force-dynamic";

type TrackResult = {
  doc_no: string;
  brand: string;
  model: string;
  status: RepairStatus;
  received_at: string;
  updated_at: string;
  customer_name_masked: string;
  history: { status: RepairStatus; at: string }[];
};

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const { doc = "" } = await searchParams;
  const docNo = doc.trim().slice(0, 50);

  let result: TrackResult | null = null;
  if (docNo) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("public_track_job", { p_doc_no: docNo });
    result = ((data as TrackResult[] | null) ?? [])[0] ?? null;
  }

  const currentIndex = result ? PIPELINE.indexOf(result.status) : -1;
  const reachedAt = (s: RepairStatus) =>
    result?.history.filter((h) => h.status === s).at(-1)?.at;

  return (
    <main className="min-h-screen bg-steel/50 px-4 py-10">
      <div className="mx-auto max-w-lg space-y-6">
        <header className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-xl font-bold text-white">
            SC
          </div>
          <h1 className="text-xl font-bold">ติดตามสถานะการซ่อม</h1>
          <p className="text-sm text-muted">{SHOP.subtitle}</p>
        </header>

        <form className="flex gap-2">
          <input
            name="doc"
            defaultValue={docNo}
            required
            placeholder="กรอกเลขที่เอกสาร"
            className="flex-1 rounded-lg border border-line bg-white px-4 py-3 font-mono uppercase outline-none focus:border-graphite focus:ring-2 focus:ring-graphite/10"
          />
          <button className="rounded-lg bg-brand px-5 font-semibold text-white hover:bg-brand-dark">ค้นหา</button>
        </form>

        {docNo && !result && (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-center text-sm text-amber-800 ring-1 ring-amber-200">
            ไม่พบเลขที่เอกสาร “{docNo}” กรุณาตรวจสอบจากใบรับเครื่องอีกครั้ง
          </p>
        )}

        {result && (
          <section className="panel p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-lg font-bold">{result.doc_no}</p>
                <p className="text-sm text-muted">
                  {result.brand} {result.model}
                </p>
                <p className="text-xs text-muted">
                  คุณ {result.customer_name_masked} · รับเครื่อง {formatDate(result.received_at)}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  result.status === "cancelled" ? "bg-rose-50 text-rose-700" : "bg-brand/10 text-brand"
                }`}
              >
                {STATUS_LABEL[result.status]}
              </span>
            </div>

            {result.status === "cancelled" ? (
              <p className="text-sm text-muted">งานซ่อมนี้ถูกยกเลิก กรุณาติดต่อร้านเพื่อรับเครื่องคืน</p>
            ) : (
              <ol className="space-y-0">
                {PIPELINE.map((s, i) => {
                  const done = i <= currentIndex;
                  const current = i === currentIndex;
                  const at = reachedAt(s);
                  return (
                    <li key={s} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            done ? "bg-brand text-white" : "bg-zinc-200 text-muted"
                          } ${current ? "ring-4 ring-brand/20" : ""}`}
                        >
                          {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                        </span>
                        {i < PIPELINE.length - 1 && (
                          <span className={`w-0.5 flex-1 ${i < currentIndex ? "bg-brand" : "bg-zinc-200"}`} />
                        )}
                      </div>
                      <div className="pb-5">
                        <p className={`text-sm ${done ? "font-semibold" : "text-zinc-400"}`}>{STATUS_LABEL[s]}</p>
                        {done && at && <p className="text-xs text-muted">{formatDateTime(at)}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            <p className="mt-2 text-right text-xs text-zinc-400">อัปเดตล่าสุด {formatDateTime(result.updated_at)}</p>
          </section>
        )}
      </div>
    </main>
  );
}
