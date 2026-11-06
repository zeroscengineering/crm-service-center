import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cleanSearch, formatDate, formatMoney, formatPhone, normalizePhone } from "@/lib/format";
import {
  DIRECTION_LABEL,
  SHIPMENT_STATUS_LABEL,
  trackingLink,
  type Carrier,
  type Shipment,
  type ShipmentStatus,
} from "@/lib/shipping";
import {
  CarrierForm,
  CustomerCarrierSelect,
  SenderNameEditor,
  ShipmentActions,
  ShipmentStatusSelect,
} from "@/components/ShippingUI";

export const dynamic = "force-dynamic";

type Row = Shipment & {
  repair_jobs: { id: string; doc_no: string } | null;
  customers: { id: string; name: string; phone: string } | null;
};

const TABS = [
  { key: "list", label: "รายการขนส่ง" },
  { key: "customers", label: "ลูกค้า × ขนส่ง" },
  { key: "settings", label: "ตั้งค่าขนส่ง" },
] as const;

export default async function ShippingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; carrier?: string; dir?: string; q?: string }>;
}) {
  const profile = await requireProfile();
  const canEdit = true; // งานขนส่งประจำวัน: แอดมินและช่าง
  const isAdmin = profile.role === "admin"; // ตั้งค่ารายชื่อขนส่ง
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "list";
  const supabase = await createClient();

  const { data: carrierRows, error: carrierErr } = await supabase
    .from("carriers")
    .select("*")
    .order("sort")
    .order("name");

  if (carrierErr) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-semibold">ยังไม่ได้สร้างตารางระบบขนส่ง</p>
        <p className="mt-1">
          เปิด Supabase › SQL Editor › วางไฟล์ <code>supabase/migrations/0004_tags_shipping.sql</code> › Run แล้วรีเฟรชหน้านี้
        </p>
      </div>
    );
  }
  const carriers = (carrierRows ?? []) as Carrier[];
  const carrierById = new Map(carriers.map((c) => [c.id, c]));

  const tabBar = (
    <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-white p-1 text-sm">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={`/shipping?tab=${t.key}`}
          className={`rounded-md px-3 py-1.5 ${tab === t.key ? "bg-graphite text-white" : "text-muted hover:bg-steel"}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );

  // ---------------- ตั้งค่าขนส่ง ----------------
  if (tab === "settings") {
    return (
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight">ขนส่ง</h1>
          {tabBar}
        </header>
        <section className="panel p-5">
          <h2 className="font-semibold">รายชื่อขนส่ง</h2>
          <p className="mb-3 text-xs text-muted">
            ลิงก์ติดตาม: ใส่ <code>{"{tracking}"}</code> ตรงตำแหน่งเลขพัสดุ ระบบจะสร้างลิงก์ให้อัตโนมัติ (ส่งให้ลูกค้าทาง LINE ได้) ·
            “ลำดับ” น้อย = แสดงก่อน
          </p>
          {isAdmin ? (
            <>
              <div className="hidden gap-2 pb-1 text-xs text-muted sm:grid sm:grid-cols-[2fr_3fr_1.2fr_60px_auto_auto]">
                <span>ชื่อ</span>
                <span>ลิงก์ติดตามพัสดุ</span>
                <span>เบอร์โทร</span>
                <span>ลำดับ</span>
                <span />
                <span />
              </div>
              {carriers.map((c) => (
                <CarrierForm key={c.id} carrier={c} />
              ))}
              <div className="mt-3">
                <p className="mb-1 text-sm font-medium">เพิ่มขนส่งใหม่</p>
                <CarrierForm />
              </div>
            </>
          ) : (
            <ul className="divide-y divide-line/70 text-sm">
              {carriers.map((c) => (
                <li key={c.id} className="py-2">
                  {c.name} {!c.active && <span className="text-xs text-zinc-400">(ปิดใช้)</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  // ---------------- ลูกค้า × ขนส่ง ----------------
  if (tab === "customers") {
    let query = supabase
      .from("customers")
      .select("id, name, phone, default_carrier_id")
      .order("created_at", { ascending: false })
      .limit(300);
    if (sp.carrier === "none") query = query.is("default_carrier_id", null);
    else if (sp.carrier) query = query.eq("default_carrier_id", sp.carrier);
    const term = cleanSearch(sp.q ?? "");
    if (term) {
      const digits = normalizePhone(term);
      query = query.or([`name.ilike.%${term}%`, ...(digits.length >= 3 ? [`phone.ilike.%${digits}%`] : [])].join(","));
    }
    const { data } = await query;
    const customers = (data ?? []) as { id: string; name: string; phone: string; default_carrier_id: string | null }[];

    const { data: all } = await supabase.from("customers").select("default_carrier_id");
    const counts = new Map<string, number>();
    for (const r of all ?? []) {
      const k = (r.default_carrier_id as string | null) ?? "none";
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }

    return (
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight">ขนส่ง</h1>
          {tabBar}
        </header>

        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/shipping?tab=customers"
            className={`rounded-full px-3 py-1 ring-1 ${!sp.carrier ? "bg-zinc-800 text-white ring-zinc-800" : "bg-white ring-zinc-300"}`}
          >
            ทั้งหมด
          </Link>
          {carriers.map((c) => (
            <Link
              key={c.id}
              href={`/shipping?tab=customers&carrier=${c.id}`}
              className={`rounded-full px-3 py-1 ring-1 ${sp.carrier === c.id ? "bg-zinc-800 text-white ring-zinc-800" : "bg-white ring-zinc-300"}`}
            >
              {c.name} <span className="opacity-60">({counts.get(c.id) ?? 0})</span>
            </Link>
          ))}
          <Link
            href="/shipping?tab=customers&carrier=none"
            className={`rounded-full px-3 py-1 ring-1 ${sp.carrier === "none" ? "bg-zinc-800 text-white ring-zinc-800" : "bg-white ring-zinc-300"}`}
          >
            ยังไม่ระบุ <span className="opacity-60">({counts.get("none") ?? 0})</span>
          </Link>
        </div>

        <form>
          <input type="hidden" name="tab" value="customers" />
          {sp.carrier && <input type="hidden" name="carrier" value={sp.carrier} />}
          <input
            name="q"
            defaultValue={sp.q}
            placeholder="ค้นหาชื่อ / เบอร์โทร"
            className="w-full max-w-sm rounded-lg border border-line bg-white px-3 py-2 text-sm"
          />
        </form>

        <div className="overflow-x-auto panel">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-steel/60 text-left text-[13px] text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">ลูกค้า</th>
                <th className="px-4 py-2 font-medium">เบอร์โทร</th>
                <th className="px-4 py-2 font-medium">ขนส่งที่ใช้ประจำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {customers.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2">
                    <Link href={`/customers/${c.id}`} className="font-medium text-brand hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{formatPhone(c.phone)}</td>
                  <td className="px-4 py-2">
                    <CustomerCarrierSelect customerId={c.id} value={c.default_carrier_id} carriers={carriers} canEdit={canEdit} />
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-zinc-400">
                    ไม่พบลูกค้า
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ---------------- รายการขนส่ง ----------------
  let query = supabase
    .from("shipments")
    .select("*, repair_jobs(id, doc_no), customers(id, name, phone)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (sp.status && sp.status in SHIPMENT_STATUS_LABEL) query = query.eq("status", sp.status);
  if (sp.dir === "inbound" || sp.dir === "outbound") query = query.eq("direction", sp.dir);
  if (sp.carrier) query = query.eq("carrier_id", sp.carrier);
  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  const { data: pendingRows } = await supabase.from("shipments").select("id").eq("status", "pending");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight">ขนส่ง</h1>
          <p className="text-sm text-muted">
            รอส่ง {pendingRows?.length ?? 0} รายการ · เพิ่มรายการได้จากหน้ารายละเอียดงานซ่อม (การ์ด “ขนส่ง”)
          </p>
        </div>
        {tabBar}
      </header>

      <form className="flex flex-wrap gap-2">
        <input type="hidden" name="tab" value="list" />
        <select name="status" defaultValue={sp.status ?? ""} className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
          <option value="">ทุกสถานะ</option>
          {(Object.keys(SHIPMENT_STATUS_LABEL) as ShipmentStatus[]).map((s) => (
            <option key={s} value={s}>
              {SHIPMENT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select name="dir" defaultValue={sp.dir ?? ""} className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
          <option value="">ขาเข้า + ขาออก</option>
          <option value="outbound">{DIRECTION_LABEL.outbound}</option>
          <option value="inbound">{DIRECTION_LABEL.inbound}</option>
        </select>
        <select name="carrier" defaultValue={sp.carrier ?? ""} className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
          <option value="">ทุกขนส่ง</option>
          {carriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary">กรอง</button>
      </form>

      <div className="overflow-x-auto panel">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-steel/60 text-left text-[13px] text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">วันที่</th>
              <th className="px-3 py-2 font-medium">งานซ่อม</th>
              <th className="px-3 py-2 font-medium">ลูกค้า</th>
              <th className="px-3 py-2 font-medium">ทิศทาง</th>
              <th className="px-3 py-2 font-medium">ขนส่ง / เลขพัสดุ</th>
              <th className="px-3 py-2 font-medium">ชื่อคนส่ง</th>
              <th className="px-3 py-2 font-medium">ค่าส่ง</th>
              <th className="px-3 py-2 font-medium">สถานะ</th>
              {canEdit && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {rows.map((r) => {
              const c = r.carrier_id ? carrierById.get(r.carrier_id) : null;
              const link = trackingLink(c, r.tracking_no);
              return (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.shipped_at ?? r.created_at)}</td>
                  <td className="px-3 py-2">
                    {r.repair_jobs && (
                      <Link href={`/jobs/${r.repair_jobs.id}`} className="doc-tag hover:border-graphite/60">
                        {r.repair_jobs.doc_no}
                      </Link>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.customers?.name}
                    <span className="block text-xs text-muted">{formatPhone(r.customers?.phone)}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{DIRECTION_LABEL[r.direction]}</td>
                  <td className="px-3 py-2">
                    {c?.name ?? "-"}
                    {r.tracking_no && (
                      <span className="block font-mono text-xs">
                        {link ? (
                          <a href={link} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">
                            {r.tracking_no}                           </a>
                        ) : (
                          r.tracking_no
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <SenderNameEditor shipment={r} canEdit={canEdit} />
                  </td>
                  <td className="px-3 py-2">{r.cost !== null ? formatMoney(r.cost) : "-"}</td>
                  <td className="px-3 py-2">
                    <ShipmentStatusSelect shipment={r} canEdit={canEdit} />
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2">
                      <ShipmentActions shipment={r} canNotify />
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-zinc-400">
                  ยังไม่มีรายการขนส่ง
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
