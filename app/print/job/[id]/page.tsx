import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { SHOP, STATUS_LABEL, WARRANTY_LABEL, type RepairStatus } from "@/lib/constants";
import { formatDate, formatPhone } from "@/lib/format";
import { siteUrl } from "@/lib/site-url";
import PrintButton from "./PrintButton";
import { adminConfigured } from "@/lib/supabase/admin";
import { addFriendUrl, getBotInfo, getLineConfig } from "@/lib/line";

type Job = {
  id: string;
  doc_no: string;
  status: RepairStatus;
  issue_description: string;
  warranty: keyof typeof WARRANTY_LABEL;
  accessories: string[];
  received_documents: string[];
  repair_notes: string | null;
  technician_name: string | null;
  received_at: string;
  customers: { name: string; phone: string; line_id: string | null; address: string | null } | null;
  tools: { brand: string; model: string; serial_number: string | null } | null;
  branches: { name: string } | null;
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="w-28 shrink-0 text-zinc-500">{label}</span>
      <span className="font-medium">{value || "-"}</span>
    </div>
  );
}

export default async function PrintJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("repair_jobs")
    .select(
      "id, doc_no, status, issue_description, warranty, accessories, received_documents, repair_notes, technician_name, received_at, customers(name, phone, line_id, address), tools(brand, model, serial_number), branches(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const job = data as unknown as Job;

  const trackUrl = `${await siteUrl()}/track?doc=${encodeURIComponent(job.doc_no)}`;
  const qr = await QRCode.toDataURL(trackUrl, { margin: 1, width: 240 });

  // QR แอด LINE OA (ถ้าตั้งค่า LINE แล้ว)
  let lineQr: string | null = null;
  let lineId: string | null = null;
  if (adminConfigured()) {
    const cfg = await getLineConfig();
    if (cfg?.access_token) {
      try {
        const bot = await getBotInfo(cfg.access_token);
        lineId = bot.basicId;
        lineQr = await QRCode.toDataURL(addFriendUrl(bot.basicId), { margin: 1, width: 240 });
      } catch {}
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100 py-6 print:bg-white print:py-0">
      <style>{`@page { size: A5; margin: 8mm; }`}</style>

      <div className="mx-auto mb-4 flex max-w-[148mm] items-center justify-between print:hidden">
        <Link href={`/jobs/${job.id}`} className="text-sm text-zinc-600 hover:underline">
          ← ไปหน้ารายละเอียดงาน
        </Link>
        <PrintButton autoPrint={sp.new === "1"} />
      </div>
      {sp.new === "1" && (
        <p className="mx-auto mb-4 max-w-[148mm] rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200 print:hidden">
          ✅ บันทึกงานซ่อม {job.doc_no} เรียบร้อยแล้ว
        </p>
      )}

      <article className="mx-auto max-w-[148mm] bg-white p-6 text-[13px] leading-relaxed shadow print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-zinc-900 pb-3">
          <div>
            <h1 className="text-lg font-bold">{SHOP.name}</h1>
            <p className="text-xs text-zinc-600">{SHOP.subtitle}</p>
            {SHOP.address && <p className="text-xs text-zinc-600">{SHOP.address}</p>}
            {SHOP.phone && <p className="text-xs text-zinc-600">โทร {SHOP.phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-base font-bold">ใบรับเครื่องซ่อม</p>
            <p className="font-mono text-base font-bold">{job.doc_no}</p>
            <p className="text-xs text-zinc-600">วันที่ {formatDate(job.received_at)}</p>
            {job.branches && <p className="text-xs text-zinc-600">สาขา {job.branches.name}</p>}
          </div>
        </header>

        <section className="mt-3 grid grid-cols-2 gap-x-4">
          <div>
            <h2 className="mb-1 font-bold">ลูกค้า</h2>
            <Row label="ชื่อ" value={job.customers?.name} />
            <Row label="โทร" value={formatPhone(job.customers?.phone)} />
            <Row label="LINE ID" value={job.customers?.line_id} />
            <Row label="ที่อยู่" value={job.customers?.address} />
          </div>
          <div>
            <h2 className="mb-1 font-bold">เครื่องมือ</h2>
            <Row label="แบรนด์" value={job.tools?.brand} />
            <Row label="รุ่น" value={job.tools?.model} />
            <Row label="S/N" value={<span className="font-mono">{job.tools?.serial_number}</span>} />
            <Row label="ประกัน" value={WARRANTY_LABEL[job.warranty]} />
          </div>
        </section>

        <section className="mt-3 space-y-1 border-t border-zinc-300 pt-2">
          <Row label="อาการเสีย" value={job.issue_description} />
          <Row label="อุปกรณ์ที่ฝาก" value={job.accessories.join(", ")} />
          <Row label="เอกสารที่แนบ" value={job.received_documents.join(", ")} />
          <Row label="สภาพ/หมายเหตุ" value={job.repair_notes} />
          <Row label="ช่างผู้รับผิดชอบ" value={job.technician_name} />
          <Row label="สถานะ" value={STATUS_LABEL[job.status]} />
        </section>

        <section className={`mt-3 grid gap-3 ${lineQr ? "grid-cols-2" : ""}`}>
          <div className="flex items-center gap-3 rounded-lg border border-zinc-300 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR ติดตามสถานะ" className="h-20 w-20 shrink-0" />
            <div className="text-[11px]">
              <p className="font-bold">สแกนเพื่อติดตามสถานะ</p>
              <p className="text-zinc-600">หรือกรอกเลขที่เอกสาร {job.doc_no} ที่หน้าเว็บ</p>
              {!lineQr && <p className="break-all font-mono text-[10px] text-zinc-500">{trackUrl}</p>}
            </div>
          </div>
          {lineQr && (
            <div className="flex items-center gap-3 rounded-lg border border-[#06C755] p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lineQr} alt="QR แอด LINE" className="h-20 w-20 shrink-0" />
              <div className="text-[11px]">
                <p className="font-bold text-[#06A846]">แอด LINE รับแจ้งเตือน</p>
                <p className="text-zinc-600">
                  แอดเพื่อน {lineId} แล้วพิมพ์ <span className="font-mono font-bold">{job.doc_no}</span>
                </p>
              </div>
            </div>
          )}
        </section>

        <ul className="mt-3 list-disc pl-5 text-[11px] text-zinc-600">
          {SHOP.terms.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        <footer className="mt-10 grid grid-cols-2 gap-8 text-center text-xs">
          <div>
            <div className="border-t border-zinc-400 pt-1">ลงชื่อลูกค้า</div>
          </div>
          <div>
            <div className="border-t border-zinc-400 pt-1">ลงชื่อผู้รับเครื่อง</div>
          </div>
        </footer>
      </article>
    </div>
  );
}
