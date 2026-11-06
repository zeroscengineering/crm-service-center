import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { bahtText, calcQuote, type VatMode } from "@/lib/quote";
import { formatDate, formatMoney, formatPhone } from "@/lib/format";
import PrintQuoteButton from "./PrintQuoteButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("quotations").select("quote_no, customer_name").eq("id", id).maybeSingle();
  // ชื่อแท็บ = ชื่อไฟล์ตอนบันทึกเป็น PDF
  return { title: data ? `ใบเสนอราคา ${data.quote_no} ${data.customer_name}` : "ใบเสนอราคา" };
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00+07:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export default async function PrintQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile();
  const supabase = await createClient();

  const [{ data: q }, { data: itemRows }, company] = await Promise.all([
    supabase.from("quotations").select("*, repair_jobs(doc_no)").eq("id", id).maybeSingle(),
    supabase.from("quotation_items").select("description, qty, unit, unit_price").eq("quotation_id", id).order("sort"),
    getCompany(),
  ]);
  if (!q) notFound();

  const items = (itemRows ?? []).map((i) => ({
    description: i.description as string,
    qty: Number(i.qty),
    unit: (i.unit as string | null) ?? "",
    unit_price: Number(i.unit_price),
  }));
  const vatMode = q.vat_mode as VatMode;
  const discount = Number(q.discount);
  const t = calcQuote(items, discount, vatMode, Number(q.vat_rate));
  const jobDoc = (q.repair_jobs as { doc_no: string } | null)?.doc_no;
  const terms = ((q.terms as string | null) ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const minRows = Math.max(0, 8 - items.length);

  return (
    <div className="min-h-screen bg-steel py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 12mm; } @media print { .sheet { box-shadow:none !important; } }`}</style>

      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-2 print:hidden">
        <Link href={`/quotes/${id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft size={15} /> กลับไปแก้ไข
        </Link>
        <PrintQuoteButton />
      </div>

      <article className="sheet mx-auto max-w-[210mm] bg-white p-[14mm] text-[12.5px] leading-relaxed text-ink shadow-[0_1px_3px_rgba(31,35,40,0.12)] print:max-w-none print:p-0">
        {/* หัวกระดาษ */}
        <header className="flex items-start justify-between gap-6 border-b-2 border-graphite pb-4">
          <div className="max-w-[60%]">
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
            <p className="text-[22px] font-bold leading-none tracking-tight">ใบเสนอราคา</p>
            <p className="mt-1 text-[11px] tracking-[0.2em] text-muted">QUOTATION</p>
            <table className="ml-auto mt-3 text-[12px]">
              <tbody>
                <tr>
                  <td className="pr-3 text-muted">เลขที่</td>
                  <td className="font-mono font-semibold">{q.quote_no as string}</td>
                </tr>
                <tr>
                  <td className="pr-3 text-muted">วันที่</td>
                  <td>{formatDate(q.issue_date as string)}</td>
                </tr>
                {Number(q.valid_days) > 0 && (
                  <tr>
                    <td className="pr-3 text-muted">ยืนราคาถึง</td>
                    <td>{formatDate(addDays(q.issue_date as string, Number(q.valid_days)))}</td>
                  </tr>
                )}
                {jobDoc && (
                  <tr>
                    <td className="pr-3 text-muted">อ้างอิงงานซ่อม</td>
                    <td className="font-mono">{jobDoc}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </header>

        {/* ลูกค้า */}
        <section className="mt-4 rounded-md border border-line p-3">
          <p className="text-[11px] text-muted">เสนอราคาให้</p>
          <p className="font-semibold">{q.customer_name as string}</p>
          {q.customer_address && <p className="text-muted">{q.customer_address as string}</p>}
          <p className="text-muted">
            {q.customer_phone && `โทร ${formatPhone(q.customer_phone as string)}`}
            {q.customer_tax_id && `   เลขประจำตัวผู้เสียภาษี ${q.customer_tax_id}`}
            {q.customer_branch && ` (${q.customer_branch})`}
          </p>
          {q.subject && (
            <p className="mt-1">
              <span className="text-muted">เรื่อง </span>
              {q.subject as string}
            </p>
          )}
        </section>

        {/* รายการ */}
        <table className="mt-4 w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-graphite text-white">
              <th className="w-10 px-2 py-1.5 text-center font-medium">ลำดับ</th>
              <th className="px-2 py-1.5 text-left font-medium">รายละเอียด</th>
              <th className="w-16 px-2 py-1.5 text-right font-medium">จำนวน</th>
              <th className="w-14 px-2 py-1.5 text-left font-medium">หน่วย</th>
              <th className="w-24 px-2 py-1.5 text-right font-medium">ราคา/หน่วย</th>
              <th className="w-28 px-2 py-1.5 text-right font-medium">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-b border-line align-top">
                <td className="px-2 py-1.5 text-center">{i + 1}</td>
                <td className="whitespace-pre-wrap px-2 py-1.5">{it.description}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{it.qty.toLocaleString("th-TH")}</td>
                <td className="px-2 py-1.5">{it.unit}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(it.unit_price)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(it.qty * it.unit_price)}</td>
              </tr>
            ))}
            {Array.from({ length: minRows }).map((_, i) => (
              <tr key={`e${i}`} className="border-b border-line">
                <td className="px-2 py-1.5">&nbsp;</td>
                <td colSpan={5} />
              </tr>
            ))}
          </tbody>
        </table>

        {/* ยอดรวม */}
        <section className="mt-3 flex gap-6">
          <div className="flex-1 self-end">
            <p className="rounded-md bg-steel px-3 py-2 text-center font-medium">({bahtText(t.grand)})</p>
          </div>
          <table className="w-64 text-[12.5px]">
            <tbody>
              <tr>
                <td className="py-0.5 text-muted">รวมเป็นเงิน</td>
                <td className="py-0.5 text-right tabular-nums">{formatMoney(t.itemsTotal)}</td>
              </tr>
              {discount > 0 && (
                <tr>
                  <td className="py-0.5 text-muted">ส่วนลด</td>
                  <td className="py-0.5 text-right tabular-nums">{formatMoney(discount)}</td>
                </tr>
              )}
              {vatMode !== "none" && (
                <>
                  <tr>
                    <td className="py-0.5 text-muted">มูลค่าก่อนภาษี</td>
                    <td className="py-0.5 text-right tabular-nums">{formatMoney(t.subtotal)}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-muted">ภาษีมูลค่าเพิ่ม {Number(q.vat_rate)}%</td>
                    <td className="py-0.5 text-right tabular-nums">{formatMoney(t.vat)}</td>
                  </tr>
                </>
              )}
              <tr className="border-t-2 border-graphite">
                <td className="pt-1.5 font-bold">จำนวนเงินทั้งสิ้น</td>
                <td className="pt-1.5 text-right text-[15px] font-bold tabular-nums">{formatMoney(t.grand)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {(q.notes || terms.length > 0) && (
          <section className="mt-5 space-y-2 text-[11.5px]">
            {q.notes && (
              <div>
                <p className="font-semibold">หมายเหตุ</p>
                <p className="whitespace-pre-wrap text-muted">{q.notes as string}</p>
              </div>
            )}
            {terms.length > 0 && (
              <div>
                <p className="font-semibold">เงื่อนไข</p>
                <ol className="list-decimal pl-5 text-muted">
                  {terms.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        )}

        {/* ลายเซ็น */}
        <footer className="mt-14 grid grid-cols-2 gap-12 text-center text-[12px] [break-inside:avoid]">
          <div>
            <div className="mx-auto w-56 border-t border-graphite/60 pt-1.5">ผู้เสนอราคา</div>
            <p className="mt-1 text-muted">วันที่ ......../......../........</p>
          </div>
          <div>
            <div className="mx-auto w-56 border-t border-graphite/60 pt-1.5">ผู้อนุมัติสั่งซ่อม (ลูกค้า)</div>
            <p className="mt-1 text-muted">วันที่ ......../......../........</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
