import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cleanSearch, formatDate } from "@/lib/format";
import { normalizeItems, RETURN_STATUS_COLOR, RETURN_STATUS_LABEL, type ReturnStatus } from "@/lib/return-note";
import { DocTag, Empty, PageHeader } from "@/components/ui";
import SqlNotice from "./SqlNotice";

export const dynamic = "force-dynamic";

export default async function ReturnsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireProfile();
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("return_notes")
    .select("id, note_no, issue_date, customer_name, status, items")
    .order("issue_date", { ascending: false })
    .order("note_no", { ascending: false })
    .limit(200);
  if (sp.status && sp.status in RETURN_STATUS_LABEL) query = query.eq("status", sp.status);
  const term = cleanSearch(sp.q ?? "");
  if (term) query = query.or(`note_no.ilike.%${term}%,customer_name.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) return <SqlNotice />;

  const rows = (data ?? []).map((r) => ({ ...r, items: normalizeItems(r.items) })) as {
    id: string;
    note_no: string;
    issue_date: string;
    customer_name: string;
    status: ReturnStatus;
    items: ReturnType<typeof normalizeItems>;
  }[];

  return (
    <div>
      <PageHeader
        title="ใบส่งคืนสินค้าชั่วคราว"
        description="ออกใบส่งคืนเครื่องให้ลูกค้าเซ็นรับ พิมพ์ หรือบันทึกเป็น PDF"
        actions={
          <Link href="/returns/new" className="btn btn-primary">
            <FilePlus2 size={16} /> สร้างใบส่งคืน
          </Link>
        }
      />

      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="ค้นหาเลขที่ / ชื่อลูกค้า" className="field w-64" />
        <select name="status" defaultValue={sp.status ?? ""} className="field w-48">
          <option value="">ทุกสถานะ</option>
          {(Object.keys(RETURN_STATUS_LABEL) as ReturnStatus[]).map((s) => (
            <option key={s} value={s}>
              {RETURN_STATUS_LABEL[s]}
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
              <th>รายการ</th>
              <th>งานซ่อม</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/returns/${r.id}`} className="hover:underline">
                    <DocTag>{r.note_no}</DocTag>
                  </Link>
                </td>
                <td className="whitespace-nowrap">{formatDate(r.issue_date)}</td>
                <td>{r.customer_name}</td>
                <td className="max-w-xs truncate text-muted">{r.items.map((i) => i.description).filter(Boolean).join(", ")}</td>
                <td className="font-mono text-xs">{r.items.map((i) => i.doc_no).filter(Boolean).join(", ")}</td>
                <td>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${RETURN_STATUS_COLOR[r.status]}`}>
                    {RETURN_STATUS_LABEL[r.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty>ยังไม่มีใบส่งคืนสินค้า สร้างได้จากปุ่มด้านบน หรือจากคอลัมน์ ซ่อมเสร็จพร้อมส่งคืน ในหน้างานซ่อม</Empty>}
      </div>
    </div>
  );
}
