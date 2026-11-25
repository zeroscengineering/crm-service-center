import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayBangkok } from "@/lib/format";
import { DEFAULT_RETURN_NOTES, jobToItem } from "@/lib/return-note";
import { PageHeader } from "@/components/ui";
import ReturnEditor from "../ReturnEditor";
import SqlNotice from "../SqlNotice";
import { loadReturnableJobs, nextReturnNo, type ReturnInput } from "../actions";

export const dynamic = "force-dynamic";

/** /returns/new?job=<id>[,<id>] หรือ ?customer=<id> */
export default async function NewReturnPage({ searchParams }: { searchParams: Promise<{ job?: string; customer?: string }> }) {
  const profile = await requireProfile();
  const sp = await searchParams;
  const supabase = await createClient();

  const probe = await supabase.from("return_notes").select("id", { head: true, count: "exact" }).limit(1);
  if (probe.error) return <SqlNotice />;

  const jobIds = (sp.job ?? "").split(",").filter(Boolean);
  const [picked, readyJobs] = await Promise.all([
    jobIds.length ? loadReturnableJobs({ ids: jobIds }) : Promise.resolve([]),
    loadReturnableJobs({ status: "ready" }),
  ]);

  // ลูกค้า: จากงานที่เลือก หรือ ?customer=
  let cust = picked[0]
    ? { id: picked[0].customer_id, name: picked[0].customer_name, phone: picked[0].customer_phone, address: picked[0].customer_address }
    : null;
  if (!cust && sp.customer) {
    const { data } = await supabase.from("customers").select("*").eq("id", sp.customer).maybeSingle();
    if (data)
      cust = {
        id: data.id as string,
        name: ((data.company_name as string | null) || (data.name as string)) ?? "",
        phone: (data.phone as string | null) ?? "",
        address: (data.address as string | null) ?? "",
      };
  }

  const initial: ReturnInput = {
    note_no: await nextReturnNo(),
    customer_id: cust?.id ?? null,
    customer_name: cust?.name ?? "",
    customer_address: cust?.address ?? "",
    customer_phone: cust?.phone ?? "",
    issue_date: todayBangkok(),
    status: "issued",
    notes: DEFAULT_RETURN_NOTES,
    items: picked.map(jobToItem),
  };

  return (
    <div>
      <Link href="/returns" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> ใบส่งคืนทั้งหมด
      </Link>
      <PageHeader title="สร้างใบส่งคืนสินค้าชั่วคราว" />
      <ReturnEditor initial={initial} readyJobs={readyJobs} canDelete={profile.role === "admin"} />
    </div>
  );
}
