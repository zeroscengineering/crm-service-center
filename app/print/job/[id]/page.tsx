import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import PrintButton from "./PrintButton";
import { loadReceipts, ReceiptSheet } from "../../receipt";

export default async function PrintJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  await requireProfile();
  const data = await loadReceipts([id]);
  const job = data.jobs[0];
  if (!job) notFound();

  return (
    <div className="min-h-screen bg-steel py-6 print:bg-white print:py-0">
      <style>{`@page { size: A5; margin: 8mm; }`}</style>
      <div className="mx-auto mb-4 flex max-w-[148mm] items-center justify-between print:hidden">
        <Link href={`/jobs/${job.id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft size={15} /> ไปหน้ารายละเอียดงาน
        </Link>
        <PrintButton autoPrint={sp.new === "1"} />
      </div>
      {sp.new === "1" && (
        <p className="mx-auto mb-4 max-w-[148mm] rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200 print:hidden">
          บันทึกงานซ่อม {job.doc_no} เรียบร้อยแล้ว
        </p>
      )}
      <ReceiptSheet job={job} lineQr={data.lineQr} lineId={data.lineId} company={data.company} />
    </div>
  );
}
