import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeItems, type ReturnStatus } from "@/lib/return-note";
import { PageHeader } from "@/components/ui";
import ReturnEditor from "../ReturnEditor";
import { loadReturnableJobs, type ReturnInput } from "../actions";

export const dynamic = "force-dynamic";

export default async function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ data: n }, readyJobs] = await Promise.all([
    supabase.from("return_notes").select("*").eq("id", id).maybeSingle(),
    loadReturnableJobs({ status: "ready" }),
  ]);
  if (!n) notFound();

  const initial: ReturnInput = {
    id: n.id as string,
    note_no: n.note_no as string,
    customer_id: (n.customer_id as string | null) ?? null,
    customer_name: n.customer_name as string,
    customer_address: (n.customer_address as string | null) ?? "",
    customer_phone: (n.customer_phone as string | null) ?? "",
    issue_date: n.issue_date as string,
    status: n.status as ReturnStatus,
    notes: (n.notes as string | null) ?? "",
    items: normalizeItems(n.items),
  };

  return (
    <div>
      <Link href="/returns" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> ใบส่งคืนทั้งหมด
      </Link>
      <PageHeader title={`ใบส่งคืนสินค้า ${initial.note_no}`} />
      <ReturnEditor initial={initial} readyJobs={readyJobs} canDelete={profile.role === "admin"} />
    </div>
  );
}
