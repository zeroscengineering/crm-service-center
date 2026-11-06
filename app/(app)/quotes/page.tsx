import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cleanSearch, formatDate, formatMoney } from "@/lib/format";
import { QUOTE_STATUS_COLOR, QUOTE_STATUS_LABEL, type QuoteStatus } from "@/lib/quote";
import { DocTag, Empty, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  quote_no: string;
  issue_date: string;
  customer_name: string;
  subject: string | null;
  grand_total: number;
  status: QuoteStatus;
  repair_jobs: { id: string; doc_no: string } | null;
};

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const profile = await requireProfile();
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("quotations")
    .select("id, quote_no, issue_date, customer_name, subject, grand_total, status, repair_jobs(id, doc_no)")
    .order("issue_date", { ascending: false })
    .order("quote_no", { ascending: false })
    .limit(200);
  if (sp.status && sp.status in QUOTE_STATUS_LABEL) query = query.eq("status", sp.status);
  const term = cleanSearch(sp.q ?? "");
  if (term) query = query.or(`quote_no.ilike.%${term}%,customer_name.ilike.%${term}%`);

  const { data, error } = await query;
  if (error) {
    return (
      <div className="mx-auto max-w-xl rounded-[10px] border border-amber/50 bg-[#fff6d6] p-6 text-sm text-[#5c4300]">
        <p className="font-semibold">ยังไม่ได้สร้างตารางใบเสนอราคา</p>
        <p className="mt-1">
          เปิด Supabase › SQL Editor › วางไฟล์ <code>supabase/migrations/0005_quotations.sql</code> › Run แล้วรีเฟรชหน้านี้
        </p>
      </div>
    );
  }
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div>
      <PageHeader
        title="ใบเสนอราคา"
        description="ออกใบเสนอราคาให้ลูกค้า พิมพ์ หรือบันทึกเป็น PDF"
        actions={
          profile.role === "admin" && (
            <Link href="/quotes/new" className="btn btn-primary">
              <FilePlus2 size={16} /> สร้างใบเสนอราคา
            </Link>
          )
        }
      />

      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="ค้นหาเลขที่ / ชื่อลูกค้า" className="field w-64" />
        <select name="status" defaultValue={sp.status ?? ""} className="field w-48">
          <option value="">ทุกสถานะ</option>
          {(Object.keys(QUOTE_STATUS_LABEL) as QuoteStatus[]).map((s) => (
            <option key={s} value={s}>
              {QUOTE_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary">ค้นหา</button>
      </form>

      <div className="panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>เลขที่</th>
              <th>วันที่</th>
              <th>ลูกค้า</th>
              <th>งานซ่อม</th>
              <th className="text-right">ยอดรวม</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/quotes/${r.id}`} className="font-mono text-[13px] font-semibold text-ink hover:text-brand">
                    {r.quote_no}
                  </Link>
                </td>
                <td className="whitespace-nowrap">{formatDate(r.issue_date)}</td>
                <td>
                  {r.customer_name}
                  {r.subject && <span className="block text-xs text-muted">{r.subject}</span>}
                </td>
                <td>{r.repair_jobs && <DocTag>{r.repair_jobs.doc_no}</DocTag>}</td>
                <td className="text-right font-mono tabular-nums">{formatMoney(r.grand_total)}</td>
                <td>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${QUOTE_STATUS_COLOR[r.status]}`}>
                    {QUOTE_STATUS_LABEL[r.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty>ยังไม่มีใบเสนอราคา</Empty>}
      </div>
    </div>
  );
}
