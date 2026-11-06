import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { adminConfigured } from "@/lib/supabase/admin";
import { getLineConfig, lineReady } from "@/lib/line";
import { markRead } from "@/lib/chat";
import { formatPhone } from "@/lib/format";
import { PIPELINE, type RepairStatus } from "@/lib/constants";
import StatusBadge from "@/components/StatusBadge";
import { AssignExistingJob, AutoRefresh, Conversation, LinkCustomer, NewCustomerFromChat, type ChatMsg } from "./ChatClient";
import TagPicker, { TagChip, type Tag } from "./TagPicker";
import { StatusControl } from "../jobs/[id]/JobPanels";
import ChatCustomerPanel from "./ChatCustomerPanel";

export const dynamic = "force-dynamic";

type Contact = {
  line_user_id: string;
  display_name: string | null;
  picture_url: string | null;
  customer_id: string | null;
  last_message_at: string | null;
  last_message_text: string | null;
  unread_count: number;
  customers: { id: string; name: string; phone: string } | null;
};

function shortTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return d.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    ...(sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" }),
  });
}

function Avatar({ c, size = 40 }: { c: Contact; size?: number }) {
  const name = c.customers?.name ?? c.display_name ?? "?";
  return c.picture_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={c.picture_url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-[#06C755]/15 font-semibold text-[#06A846]"
      style={{ width: size, height: size }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; q?: string; tag?: string }>;
}) {
  const profile = await requireProfile();
  const { c: selectedId, q = "", tag: tagFilter = "" } = await searchParams;
  const supabase = await createClient();

  const lineCfg = adminConfigured() ? await getLineConfig() : null;
  const mode = lineReady(lineCfg) ? lineCfg.mode : null;

  const { data: contactRows, error: contactErr } = await supabase
    .from("line_contacts")
    .select("*, customers(id, name, phone)")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (contactErr) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-semibold">ยังไม่ได้สร้างตารางแชท</p>
        <p className="mt-1">
          เปิด Supabase › SQL Editor › วางไฟล์ <code>supabase/migrations/0003_line_chat.sql</code> › Run แล้วรีเฟรชหน้านี้
        </p>
      </div>
    );
  }

  let contacts = (contactRows ?? []) as unknown as Contact[];

  // แท็ก (ถ้ายังไม่รัน SQL 0004 = ไม่มีแท็ก)
  const [{ data: tagRows, error: tagErr }, { data: ctRows }] = await Promise.all([
    supabase.from("tags").select("id, name, color").order("name"),
    supabase.from("contact_tags").select("line_user_id, tag_id"),
  ]);
  const tagsReady = !tagErr;
  const allTags = (tagRows ?? []) as Tag[];
  const tagById = new Map(allTags.map((t) => [t.id, t]));
  const tagsOf = new Map<string, string[]>();
  for (const r of ctRows ?? []) {
    const k = r.line_user_id as string;
    tagsOf.set(k, [...(tagsOf.get(k) ?? []), r.tag_id as string]);
  }
  const tagCount = new Map<string, number>();
  for (const ids of tagsOf.values()) for (const id of ids) tagCount.set(id, (tagCount.get(id) ?? 0) + 1);
  if (tagFilter === "none") contacts = contacts.filter((c) => !(tagsOf.get(c.line_user_id)?.length));
  else if (tagFilter) contacts = contacts.filter((c) => tagsOf.get(c.line_user_id)?.includes(tagFilter));

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { c: selectedId, q: q || undefined, tag: tagFilter || undefined, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/chat?${s}` : "/chat";
  };

  const term = q.trim().toLowerCase();
  if (term) {
    contacts = contacts.filter((c) =>
      [c.display_name, c.customers?.name, c.customers?.phone].some((v) => v?.toLowerCase().includes(term)),
    );
  }
  const selected =
    ((contactRows ?? []) as unknown as Contact[]).find((c) => c.line_user_id === selectedId) ?? null;

  let messages: ChatMsg[] = [];
  let jobs: { id: string; doc_no: string; status: RepairStatus; tools: { brand: string; model: string } | null }[] = [];
  if (selected) {
    if (selected.unread_count > 0 && adminConfigured()) await markRead(selected.line_user_id);
    const [{ data: msgRows }, jobRes] = await Promise.all([
      supabase
        .from("chat_messages")
        .select("id, direction, msg_type, text, status, error, created_at, drive_file_id, line_message_id")
        .eq("line_user_id", selected.line_user_id)
        .order("created_at", { ascending: false })
        .limit(300),
      selected.customer_id
        ? supabase
            .from("repair_jobs")
            .select("id, doc_no, status, tools(brand, model)")
            .eq("customer_id", selected.customer_id)
            .order("created_at", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [] }),
    ]);
    messages = (msgRows ?? [])
      .reverse()
      .map((m) => ({
        id: m.id as string,
        direction: m.direction as "in" | "out",
        msg_type: m.msg_type as string,
        text: m.text as string | null,
        status: m.status as string,
        error: m.error as string | null,
        created_at: m.created_at as string,
        has_image: Boolean(m.drive_file_id || m.line_message_id),
      }));
    jobs = (jobRes.data ?? []) as unknown as typeof jobs;
  }

  const name = (c: Contact) => c.customers?.name ?? c.display_name ?? "ผู้ติดต่อ LINE";

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100dvh-64px)] md:-mx-10 md:-my-8 md:h-screen">
      <AutoRefresh seconds={5} />

      {/* ---------- รายชื่อ ---------- */}
      <aside
        className={`w-full shrink-0 flex-col border-r border-line bg-white md:flex md:w-80 ${selected ? "hidden" : "flex"}`}
      >
        <div className="border-b border-line p-3">
          <h1 className="mb-2 text-lg font-bold">แชทลูกค้า</h1>
          <form>
            {selectedId && <input type="hidden" name="c" value={selectedId} />}
            {tagFilter && <input type="hidden" name="tag" value={tagFilter} />}
            <input
              name="q"
              defaultValue={q}
              placeholder="ค้นหาชื่อ / เบอร์โทร"
              className="w-full rounded-lg border border-line bg-steel/50 px-3 py-1.5 text-sm"
            />
          </form>
          {tagsReady && allTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              <Link
                href={qs({ tag: undefined })}
                className={`rounded-full px-2 py-0.5 text-xs ring-1 ${!tagFilter ? "bg-zinc-800 text-white ring-zinc-800" : "ring-zinc-300"}`}
              >
                ทั้งหมด
              </Link>
              {allTags.map((t) => (
                <Link
                  key={t.id}
                  href={qs({ tag: t.id })}
                  className={`rounded-full px-2 py-0.5 text-xs ring-1 ${tagFilter === t.id ? "text-white" : "ring-zinc-300"}`}
                  style={tagFilter === t.id ? { backgroundColor: t.color, borderColor: t.color } : { color: t.color }}
                >
                  {t.name} ({tagCount.get(t.id) ?? 0})
                </Link>
              ))}
              <Link
                href={qs({ tag: "none" })}
                className={`rounded-full px-2 py-0.5 text-xs ring-1 ${tagFilter === "none" ? "bg-zinc-800 text-white ring-zinc-800" : "ring-zinc-300 text-muted"}`}
              >
                ไม่มีแท็ก
              </Link>
            </div>
          )}
          {mode === null && (
            <p className="mt-2 text-xs text-amber-700">
              ยังไม่ได้ตั้งค่า LINE —{" "}
              <Link href="/settings" className="underline">
                ไปที่หน้าตั้งค่า
              </Link>
            </p>
          )}
        </div>
        <ul className="flex-1 overflow-y-auto">
          {contacts.map((c) => (
            <li key={c.line_user_id}>
              <Link
                href={qs({ c: c.line_user_id })}
                className={`flex items-center gap-3 px-3 py-2.5 hover:bg-steel/50 ${
                  c.line_user_id === selectedId ? "bg-[#06C755]/10" : ""
                }`}
              >
                <Avatar c={c} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${c.unread_count ? "font-bold" : "font-medium"}`}>{name(c)}</p>
                    <span className="shrink-0 text-[11px] text-zinc-400">{shortTime(c.last_message_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-xs ${c.unread_count ? "text-zinc-800" : "text-muted"}`}>
                      {c.last_message_text ?? (c.customers ? "" : "ยังไม่ได้ผูกกับลูกค้า")}
                    </p>
                    {c.unread_count > 0 && (
                      <span className="shrink-0 rounded-full bg-[#06C755] px-1.5 text-[11px] font-bold text-white">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                  {(tagsOf.get(c.line_user_id)?.length ?? 0) > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-0.5">
                      {tagsOf.get(c.line_user_id)!.map((id) => tagById.get(id)).filter(Boolean).map((t) => (
                        <TagChip key={t!.id} tag={t!} small />
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
          {contacts.length === 0 && (
            <li className="p-6 text-center text-sm text-zinc-400">
              {term ? "ไม่พบผู้ติดต่อ" : "ยังไม่มีแชท — เมื่อลูกค้าทักมาทาง LINE OA จะแสดงที่นี่"}
            </li>
          )}
        </ul>
      </aside>

      {/* ---------- บทสนทนา ---------- */}
      {selected ? (
        <section className="flex min-w-0 flex-1 flex-col bg-white">
          <header className="flex items-center gap-3 border-b border-line px-4 py-2.5">
            <Link href="/chat" className="text-muted md:hidden">
              <ArrowLeft size={18} />
            </Link>
            <Avatar c={selected} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{name(selected)}</p>
              <p className="truncate text-xs text-muted">
                {selected.display_name && selected.customers ? `LINE: ${selected.display_name} · ` : ""}
                {selected.customers ? formatPhone(selected.customers.phone) : "ยังไม่ได้ผูกกับลูกค้าในระบบ"}
              </p>
              {tagsReady && (
                <div className="mt-1">
                  <TagPicker
                    lineUserId={selected.line_user_id}
                    allTags={allTags}
                    selected={tagsOf.get(selected.line_user_id) ?? []}
                    canEdit={Boolean(profile)}
                  />
                </div>
              )}
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            <Conversation
              lineUserId={selected.line_user_id}
              messages={messages}
              canReply={Boolean(profile) && mode !== null}
              mode={mode}
            />

            {/* ข้อมูลลูกค้า */}
            <aside className="hidden w-80 shrink-0 space-y-4 overflow-y-auto border-l border-line p-4 lg:block">
              <div>
                <p className="mb-1 text-[13px] font-medium text-muted">ลูกค้า</p>
                {selected.customers ? (
                  <Link href={`/customers/${selected.customers.id}`} className="block text-sm font-medium text-brand hover:underline">
                    {selected.customers.name}
                  </Link>
                ) : (
                  <NewCustomerFromChat
                    key={selected.line_user_id}
                    lineUserId={selected.line_user_id}
                    defaultName={selected.display_name ?? ""}
                  />
                )}
                {Boolean(profile) && (
                  <div className="mt-2">
                    <LinkCustomer lineUserId={selected.line_user_id} current={selected.customers} />
                  </div>
                )}
              </div>
              {Boolean(profile) && (
                <Link
                  href={`/jobs/new?line=${encodeURIComponent(selected.line_user_id)}${
                    selected.customers
                      ? `&customer=${selected.customers.id}`
                      : `&name=${encodeURIComponent(selected.display_name ?? "")}`
                  }`}
                  className="block rounded-lg bg-brand px-3 py-2 text-center text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  + สร้างดีล (รับแจ้งซ่อม)
                </Link>
              )}
              {selected.customers && (
                <div>
                  <p className="mb-2 text-[13px] font-medium text-muted">ดีล / งานซ่อม</p>
                  <ul className="space-y-2">
                    {jobs.map((j) => (
                      <li key={j.id} className="rounded-lg border border-line p-2 text-sm">
                        <Link href={`/jobs/${j.id}`} className="block hover:underline">
                          <span className="font-mono font-semibold">{j.doc_no}</span>
                          <span className="block text-xs text-muted">
                            {j.tools?.brand} {j.tools?.model}
                          </span>
                        </Link>
                        <div className="mt-1.5">
                          {Boolean(profile) ? (
                            <div className="[&_button]:hidden [&_select]:w-full [&_select]:py-1 [&_select]:text-xs">
                              <StatusControl jobId={j.id} status={j.status} />
                            </div>
                          ) : (
                            <StatusBadge status={j.status} />
                          )}
                        </div>
                      </li>
                    ))}
                    {jobs.length === 0 && <li className="text-xs text-zinc-400">ยังไม่มีงานซ่อม</li>}
                  </ul>
                  <div className="mt-2">
                    <AssignExistingJob lineUserId={selected.line_user_id} customerId={selected.customers.id} />
                  </div>
                  {jobs.some((j) => PIPELINE.indexOf(j.status) < PIPELINE.indexOf("delivered")) && (
                    <p className="mt-2 text-[11px] text-zinc-400">ส่งข้อความแจ้งสถานะสำเร็จรูปได้จากหน้ารายละเอียดงาน</p>
                  )}
                </div>
              )}
              {selected.customers && (
                <ChatCustomerPanel
                  customerId={selected.customers.id}
                  lineUserId={selected.line_user_id}
                  jobs={jobs.map((j) => ({ id: j.id, doc_no: j.doc_no }))}
                  canEdit={profile.role === "admin" || profile.role === "technician"}
                />
              )}
            </aside>
          </div>
        </section>
      ) : (
        <section className="hidden flex-1 items-center justify-center bg-steel/50 text-sm text-zinc-400 md:flex">
          เลือกแชทจากรายชื่อด้านซ้าย
        </section>
      )}
    </div>
  );
}
