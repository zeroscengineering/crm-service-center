"use client";

import { startTransition, useActionState } from "react";
import { saveLineSettings, type LineSaveState } from "./actions";
import type { RepairStatus } from "@/lib/constants";
import { useStatuses } from "@/components/StatusProvider";

const input =
  "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-graphite focus:ring-2 focus:ring-graphite/10";

export default function LineSettingsForm({
  initial,
}: {
  initial: {
    hasToken: boolean;
    hasSecret: boolean;
    mode: "mock" | "live";
    auto_statuses: RepairStatus[];
    forward_url: string;
    reply_on_link: boolean;
  };
}) {
  const [state, action, pending] = useActionState<LineSaveState, FormData>(saveLineSettings, {});
  const st = useStatuses();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          Channel access token (long-lived)
          <input
            name="access_token"
            type="password"
            autoComplete="off"
            placeholder={initial.hasToken ? "•••••••• (บันทึกแล้ว — เว้นว่างถ้าไม่เปลี่ยน)" : "วางจาก LINE Developers"}
            className={input}
          />
        </label>
        <label className="block text-sm">
          Channel secret
          <input
            name="channel_secret"
            type="password"
            autoComplete="off"
            placeholder={initial.hasSecret ? "•••••••• (บันทึกแล้ว — เว้นว่างถ้าไม่เปลี่ยน)" : "วางจาก LINE Developers"}
            className={input}
          />
        </label>
      </div>

      <div>
        <p className="text-sm font-medium">โหมดการส่ง</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { v: "mock", l: "จำลอง (บันทึกอย่างเดียว ไม่ส่งจริง)" },
            { v: "live", l: "ส่งจริงถึงลูกค้า" },
          ].map((o) => (
            <label
              key={o.v}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm has-[:checked]:border-graphite has-[:checked]:bg-graphite/5"
            >
              <input type="radio" name="mode" value={o.v} defaultChecked={initial.mode === o.v} />
              {o.l}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">ส่งแจ้งเตือนอัตโนมัติเมื่อเปลี่ยนเป็นสถานะ</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {st.selectable.map((s) => (
            <label
              key={s}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm has-[:checked]:border-graphite has-[:checked]:bg-graphite/5"
            >
              <input type="checkbox" name="auto_statuses" value={s} defaultChecked={initial.auto_statuses.includes(s)} />
              {st.label(s)}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">สถานะที่ไม่ติ๊ก ยังกดส่งเองได้จากหน้ารายละเอียดงาน</p>
      </div>

      <label className="block text-sm">
        Webhook URL ของระบบเดิม (ถ้ามี — ระบบจะส่งต่อทุกข้อความ เพื่อให้บอทค้นหาเดิมทำงานต่อได้)
        <input name="forward_url" defaultValue={initial.forward_url} placeholder="https://..." className={input} />
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="reply_on_link" defaultChecked={initial.reply_on_link} className="mt-1" />
        <span>
          ตอบกลับลูกค้าเมื่อพิมพ์เลขที่เอกสารแล้วเชื่อมสำเร็จ
          <span className="block text-xs text-muted">
            ถ้าบอทเดิมตอบเลขที่เอกสารอยู่แล้ว ให้ปิดช่องนี้ (LINE ให้ตอบกลับได้ครั้งเดียวต่อข้อความ)
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={pending}
          className="btn btn-primary disabled:opacity-60"
        >
          {pending ? "กำลังตรวจสอบ..." : "บันทึกการตั้งค่า LINE"}
        </button>
        {state.error && <span className="text-sm text-rose-600">{state.error}</span>}
        {state.ok && <span className="text-sm text-emerald-600">{state.info ?? "บันทึกแล้ว "}</span>}
      </div>
    </form>
  );
}
