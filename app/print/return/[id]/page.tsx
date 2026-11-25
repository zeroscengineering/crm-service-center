import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { formatDate, formatPhone } from "@/lib/format";
import { normalizeItems } from "@/lib/return-note";
import PrintQuoteButton from "../../quote/[id]/PrintQuoteButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("return_notes").select("note_no, customer_name").eq("id", id).maybeSingle();
  return { title: data ? `ใบส่งคืนสินค้าชั่วคราว ${data.note_no} ${data.customer_name}` : "ใบส่งคืนสินค้าชั่วคราว" };
}

export default async function PrintReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile();
  const supabase = await createClient();
  const [{ data: n }, company] = await Promise.all([
    supabase.from("return_notes").select("*").eq("id", id).maybeSingle(),
    getCompany(),
  ]);
  if (!n) notFound();
  const items = normalizeItems(n.items);
  const minRows = Math.max(0, 8 - items.length);
  const cancelled = n.status === "cancelled";

  return (
    <div className="min-h-screen bg-steel py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 12mm; } @media print { .sheet { box-shadow:none !important; } }`}</style>

      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-2 print:hidden">
        <Link href={`/returns/${id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft size={15} /> กลับไปแก้ไข
        </Link>
        <PrintQuoteButton />
      </div>

      <article className="sheet relative mx-auto max-w-[210mm] bg-white p-[14mm] text-[12.5px] leading-relaxed text-ink shadow-[0_1px_3px_rgba(31,35,40,0.12)] print:max-w-none print:p-0">
        {cancelled && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[90px] font-bold text-rose-600/15 [transform:rotate(-20deg)]">
            ยกเลิก
          </p>
        )}

        {/* หัวกระดาษ */}
        <header className="flex items-start justify-between gap-6 border-b-2 border-graphite pb-4">
          <div className="max-w-[58%]">
            <p className="text-[17px] font-bold leading-snug">{company.name}</p>
            <p className="mt-1 text-[11.5px] text-muted">{company.address}</p>
            <p className="text-[11.5px] text-muted">
              เลขประจำตัวผู้เสียภาษี {company.tax_id}
              {company.branch ? ` (${company.branch})` : ""}
            </p>
            {(company.phone || company.email) && (
              <p className="text-[11.5px] text-muted">
                {company.phone && `โทร ${company.phone}`}
                {company.phone && company.email ? "  " : ""}
                {company.email}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[21px] font-bold leading-none tracking-tight">ใบส่งคืนสินค้าชั่วคราว</p>
            <p className="mt-1 text-[11px] tracking-[0.2em] text-muted">TEMPORARY RETURN NOTE</p>
            <table className="ml-auto mt-3 text-[12px]">
              <tbody>
                <tr>
                  <td className="pr-3 text-muted">เลขที่</td>
                  <td className="font-mono font-semibold">{n.note_no as string}</td>
                </tr>
                <tr>
                  <td className="pr-3 text-muted">วันที่</td>
                  <td>{formatDate(n.issue_date as string)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </header>

        {/* ลูกค้า */}
        <section className="mt-4 rounded-md border border-line p-3">
          <p className="text-[11px] text-muted">ส่งคืนให้</p>
          <p className="font-semibold">{n.customer_name as string}</p>
          {n.customer_address && <p className="text-muted">{n.customer_address as string}</p>}
          {n.customer_phone && <p className="text-muted">โทร {formatPhone(n.customer_phone as string)}</p>}
          {n.attention && (
            <p className="mt-1">
              <span className="font-semibold">Attention: </span>
              {n.attention as string}
            </p>
          )}
        </section>

        {n.destination_note && (
          <section className="mt-3 rounded-md border-l-4 border-graphite bg-steel/60 px-3 py-2 [break-inside:avoid]">
            <p className="text-[11px] font-semibold text-muted">รายละเอียดถึงปลายทาง</p>
            <p className="whitespace-pre-wrap">{n.destination_note as string}</p>
          </section>
        )}

        {/* รายการ */}
        <table className="mt-4 w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-graphite text-white">
              <th className="w-10 px-2 py-1.5 text-center font-medium">ลำดับ</th>
              <th className="px-2 py-1.5 text-left font-medium">รายการ / รุ่น</th>
              <th className="w-32 px-2 py-1.5 text-left font-medium">S/N</th>
              <th className="w-28 px-2 py-1.5 text-left font-medium">เลขที่งานซ่อม</th>
              <th className="w-14 px-2 py-1.5 text-right font-medium">จำนวน</th>
              <th className="w-14 px-2 py-1.5 text-left font-medium">หน่วย</th>
              <th className="w-40 px-2 py-1.5 text-left font-medium">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-b border-line align-top">
                <td className="px-2 py-1.5 text-center">{i + 1}</td>
                <td className="whitespace-pre-wrap px-2 py-1.5">{it.description}</td>
                <td className="px-2 py-1.5 font-mono text-[11.5px]">{it.serial_no}</td>
                <td className="px-2 py-1.5 font-mono text-[11.5px]">{it.doc_no}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{it.qty.toLocaleString("th-TH")}</td>
                <td className="px-2 py-1.5">{it.unit}</td>
                <td className="whitespace-pre-wrap px-2 py-1.5 text-[11.5px]">{it.remark}</td>
              </tr>
            ))}
            {Array.from({ length: minRows }).map((_, i) => (
              <tr key={`e${i}`} className="border-b border-line">
                <td className="px-2 py-1.5">&nbsp;</td>
                <td colSpan={6} />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="px-2 py-1.5 text-right font-medium">
                รวม
              </td>
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                {items.reduce((s, i) => s + i.qty, 0).toLocaleString("th-TH")}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>

        {n.notes && (
          <section className="mt-4 [break-inside:avoid]">
            <p className="font-semibold">หมายเหตุ</p>
            <p className="whitespace-pre-wrap text-muted">{n.notes as string}</p>
          </section>
        )}

        {/* ลงนาม */}
        <footer className="mt-14 grid grid-cols-2 gap-12 text-center text-[12px] [break-inside:avoid]">
          {["ผู้ส่งสินค้า", "ผู้รับสินค้า (ลูกค้า)"].map((label) => (
            <div key={label}>
              <div className="mx-auto w-56 border-t border-graphite/60 pt-1.5">{label}</div>
              <p className="mt-1">( ............................................ )</p>
              <p className="mt-1 text-muted">วันที่ ......../......../........</p>
            </div>
          ))}
        </footer>
      </article>
    </div>
  );
}
