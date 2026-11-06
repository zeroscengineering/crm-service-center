import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { SHOP, STATUS_LABEL, WARRANTY_LABEL, type RepairStatus } from "@/lib/constants";
import { formatDate, formatPhone } from "@/lib/format";
import { siteUrl } from "@/lib/site-url";
import { adminConfigured } from "@/lib/supabase/admin";
import { addFriendUrl, getBotInfo, getLineConfig } from "@/lib/line";
import { getCompany } from "@/lib/company";
import type { Company } from "@/lib/quote";

export type ReceiptJob = {
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

export type ReceiptData = {
  jobs: (ReceiptJob & { qr: string; trackUrl: string })[];
  lineQr: string | null;
  lineId: string | null;
  company: Company;
};

/** โหลดข้อมูลใบรับเครื่อง (หนึ่งหรือหลายงาน) พร้อม QR */
export async function loadReceipts(ids: string[]): Promise<ReceiptData> {
  const supabase = await createClient();
  const [{ data }, base, company] = await Promise.all([
    supabase
      .from("repair_jobs")
      .select(
        "id, doc_no, status, issue_description, warranty, accessories, received_documents, repair_notes, technician_name, received_at, customers(name, phone, line_id, address), tools(brand, model, serial_number), branches(name)",
      )
      .in("id", ids),
    siteUrl(),
    getCompany(),
  ]);
  const rows = ((data ?? []) as unknown as ReceiptJob[]).sort((a, b) => a.doc_no.localeCompare(b.doc_no));

  const jobs = await Promise.all(
    rows.map(async (j) => {
      const trackUrl = `${base}/track?doc=${encodeURIComponent(j.doc_no)}`;
      return { ...j, trackUrl, qr: await QRCode.toDataURL(trackUrl, { margin: 1, width: 240 }) };
    }),
  );

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
  return { jobs, lineQr, lineId, company };
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="w-28 shrink-0 text-muted">{label}</span>
      <span className="font-medium">{value || "-"}</span>
    </div>
  );
}

export function ReceiptSheet({
  job,
  lineQr,
  lineId,
  company,
  index,
  total,
}: {
  job: ReceiptData["jobs"][number];
  lineQr: string | null;
  lineId: string | null;
  company: Company;
  index?: number;
  total?: number;
}) {
  return (
    <article className="mx-auto max-w-[148mm] break-after-page bg-white p-6 text-[13px] leading-relaxed text-ink shadow-[0_1px_3px_rgba(31,35,40,0.12)] last:break-after-auto print:max-w-none print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-4 border-b-2 border-graphite pb-3">
        <div>
          <h1 className="text-[15px] font-bold leading-snug">{company.name}</h1>
          <p className="text-[11px] text-muted">{SHOP.subtitle}</p>
          <p className="text-[11px] text-muted">{company.address}</p>
          {company.phone && <p className="text-[11px] text-muted">โทร {company.phone}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-bold">ใบรับเครื่องซ่อม</p>
          <p className="font-mono text-base font-semibold">{job.doc_no}</p>
          <p className="text-[11px] text-muted">วันที่ {formatDate(job.received_at)}</p>
          {job.branches && <p className="text-[11px] text-muted">สาขา {job.branches.name}</p>}
          {total && total > 1 && (
            <p className="text-[11px] font-medium">
              เครื่องที่ {index} จาก {total}
            </p>
          )}
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

      <section className="mt-3 space-y-1 border-t border-line pt-2">
        <Row label="อาการเสีย" value={job.issue_description} />
        <Row label="อุปกรณ์ที่ฝาก" value={job.accessories.join(", ")} />
        <Row label="เอกสารที่แนบ" value={job.received_documents.join(", ")} />
        <Row label="สภาพ/หมายเหตุ" value={job.repair_notes} />
        <Row label="ช่างผู้รับผิดชอบ" value={job.technician_name} />
        <Row label="สถานะ" value={STATUS_LABEL[job.status]} />
      </section>

      <section className={`mt-3 grid gap-3 ${lineQr ? "grid-cols-2" : ""}`}>
        <div className="flex items-center gap-3 rounded-md border border-line p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={job.qr} alt="QR ติดตามสถานะ" className="h-20 w-20 shrink-0" />
          <div className="text-[11px]">
            <p className="font-bold">สแกนเพื่อติดตามสถานะ</p>
            <p className="text-muted">หรือกรอกเลขที่เอกสาร {job.doc_no} ที่หน้าเว็บ</p>
          </div>
        </div>
        {lineQr && (
          <div className="flex items-center gap-3 rounded-md border border-[#06C755] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lineQr} alt="QR แอด LINE" className="h-20 w-20 shrink-0" />
            <div className="text-[11px]">
              <p className="font-bold text-[#06A846]">แอด LINE รับแจ้งเตือน</p>
              <p className="text-muted">
                แอดเพื่อน {lineId} แล้วพิมพ์ <span className="font-mono font-bold">{job.doc_no}</span>
              </p>
            </div>
          </div>
        )}
      </section>

      <ul className="mt-3 list-disc pl-5 text-[11px] text-muted">
        {SHOP.terms.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>

      <footer className="mt-10 grid grid-cols-2 gap-8 text-center text-xs">
        <div className="border-t border-graphite/50 pt-1">ลงชื่อลูกค้า</div>
        <div className="border-t border-graphite/50 pt-1">ลงชื่อผู้รับเครื่อง</div>
      </footer>
    </article>
  );
}
