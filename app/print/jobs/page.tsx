import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import PrintButton from "../job/[id]/PrintButton";
import { loadReceipts, ReceiptSheet } from "../receipt";

/** พิมพ์ใบรับเครื่องหลายเครื่องพร้อมกัน (หนึ่งเครื่องต่อหนึ่งแผ่น) */
export default async function PrintJobsPage({ searchParams }: { searchParams: Promise<{ ids?: string; new?: string }> }) {
  const sp = await searchParams;
  await requireProfile();
  const ids = (sp.ids ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30);
  if (ids.length === 0) notFound();
  const data = await loadReceipts(ids);
  if (data.jobs.length === 0) notFound();

  return (
    <div className="min-h-screen bg-steel py-6 print:bg-white print:py-0">
      <style>{`@page { size: A5; margin: 8mm; }`}</style>
      <div className="mx-auto mb-4 flex max-w-[148mm] items-center justify-between print:hidden">
        <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft size={15} /> งานซ่อม
        </Link>
        <PrintButton autoPrint={sp.new === "1"} />
      </div>
      {sp.new === "1" && (
        <p className="mx-auto mb-4 max-w-[148mm] rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200 print:hidden">
          บันทึก {data.jobs.length} เครื่องเรียบร้อยแล้ว: {data.jobs.map((j) => j.doc_no).join(", ")}
        </p>
      )}
      <div className="space-y-6 print:space-y-0">
        {data.jobs.map((j, i) => (
          <ReceiptSheet
            key={j.id}
            job={j}
            lineQr={data.lineQr}
            lineId={data.lineId}
            company={data.company}
            index={i + 1}
            total={data.jobs.length}
          />
        ))}
      </div>
    </div>
  );
}
