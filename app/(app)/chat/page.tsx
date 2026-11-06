import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { adminConfigured } from "@/lib/supabase/admin";
import { getLineConfig, lineReady } from "@/lib/line";
import { markRead } from "@/lib/chat";
import { formatPhone } from "@/lib/format";
import { PIPELINE, type RepairStatus } from "@/lib/constants";
import StatusBadge from "@/components/StatusBadge";
import { AutoRefresh, Conversation, LinkCustomer, type ChatMsg } from "./ChatClient";

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

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ c?: string; q?: string }> }) {
  const profile = await requireProfile();
  const { c: selectedId, q = "" } = await searchParams;
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
          เปิด Supabase → SQL Editor → วางไฟล์ <code>supabase/migrations/0003_line_chat.sql</code> → Run แล้วรีเฟรชหน้านี้
        </p>
      </div>
    );
  }

  let contacts = (contactRows ?? []) as unknown as Contact[];
  const term = q.trim().toLowerCase();
  if (term) {
    contacts = contacts.filter((c) =>
      [c.display_name, c.customers?.name, c.customers?.phone].some((v) => v?.toLowerCase().includes(term)),
    );
  }
  const selected = contacts.find((c) => c.line_user_id === selectedId) ?? null;

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
    <div className="-m-4 flex h-[calc(100vh-0px)] md:-m-8">
      <AutoRefresh seconds={5} />

      {/* ---------- รายชื่อ ---------- */}
      <aside
        className={`w-full shrink-0 flex-col border-r border-zinc-200 bg-white md:flex md:w-80 ${selected ? "hidden" : "flex"}`}
      >
        <div className="border-b border-zinc-200 p-3">
          <h1 className="mb-2 text-lg font-bold">แชทลูกค้า</h1>
          <form>
            {selectedId && <input type="hidden" name="c" value={selectedId} />}
            <input
              name="q"
              defaultValue={q}
              placeholder="ค้นหาชื่อ / เบอร์โทร"
              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm"
            />
          </form>
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
                href={`/chat?c=${encodeURIComponent(c.line_user_id)}`}
                className={`flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 ${
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
                    <p className={`truncate text-xs ${c.unread_count ? "text-zinc-800" : "text-zinc-500"}`}>
                      {c.last_message_text ?? (c.customers ? "" : "ยังไม่ได้ผูกกับลูกค้า")}
                    </p>
                    {c.unread_count > 0 && (
                      <span className="shrink-0 rounded-full bg-[#06C755] px-1.5 text-[11px] font-bold text-white">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
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
          <header className="flex items-center gap-3 border-b border-zinc-200 px-4 py-2.5">
            <Link href="/chat" className="text-zinc-500 md:hidden">
              ←
            </Link>
            <Avatar c={selected} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{name(selected)}</p>
              <p className="truncate text-xs text-zinc-500">
                {selected.display_name && selected.customers ? `LINE: ${selected.display_name} · ` : ""}
                {selected.customers ? formatPhone(selected.customers.phone) : "ยังไม่ได้ผูกกับลูกค้าในระบบ"}
              </p>
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            <Conversation
              lineUserId={selected.line_user_id}
              messages={messages}
              canReply={profile.role === "admin" && mode !== null}
              mode={mode}
            />

            {/* ข้อมูลลูกค้า */}
            <aside className="hidden w-72 shrink-0 space-y-4 overflow-y-auto border-l border-zinc-200 p-4 lg:block">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-zinc-400">ลูกค้า</p>
                {selected.customers ? (
                  <Link href={`/customers/${selected.customers.id}`} className="block text-sm font-medium text-brand hover:underline">
                    {selected.customers.name}
                  </Link>
                ) : (
                  <p className="text-sm text-zinc-500">ยังไม่ได้ผูก</p>
                )}
                {profile.role === "admin" && (
                  <div className="mt-2">
                    <LinkCustomer lineUserId={selected.line_user_id} current={selected.customers} />
                  </div>
                )}
              </div>
              {selected.customers && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-zinc-400">งานซ่อม</p>
                  <ul className="space-y-2">
                    {jobs.map((j) => (
                      <li key={j.id}>
                        <Link href={`/jobs/${j.id}`} className="block rounded-lg border border-zinc-200 p-2 text-sm hover:bg-zinc-50">
                          <span className="font-mono font-semibold">{j.doc_no}</span>
                          <span className="block text-xs text-zinc-500">
                            {j.tools?.brand} {j.tools?.model}
                          </span>
                          <span className="mt-1 block">
                            <StatusBadge status={j.status} />
                          </span>
                        </Link>
                      </li>
                    ))}
                    {jobs.length === 0 && <li className="text-xs text-zinc-400">ยังไม่มีงานซ่อม</li>}
                  </ul>
                  {jobs.some((j) => PIPELINE.indexOf(j.status) < PIPELINE.indexOf("delivered")) && (
                    <p className="mt-2 text-[11px] text-zinc-400">ส่งข้อความแจ้งสถานะสำเร็จรูปได้จากหน้ารายละเอียดงาน</p>
                  )}
                </div>
              )}
            </aside>
          </div>
        </section>
      ) : (
        <section className="hidden flex-1 items-center justify-center bg-zinc-50 text-sm text-zinc-400 md:flex">
          เลือกแชทจากรายชื่อด้านซ้าย
        </section>
      )}
    </div>
  );
}
