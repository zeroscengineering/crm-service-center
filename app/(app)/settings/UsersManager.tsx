"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from "react";
import { KeyRound, Power, UserPlus, X } from "lucide-react";
import { createStaff, resetStaffPassword, setStaffActive, updateStaff, type UserResult } from "./users-actions";
import { formatDateTime } from "@/lib/format";

export type StaffRow = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "technician";
  active: boolean;
  last_sign_in_at: string | null;
};

const ROLE_HELP = {
  admin: "แอดมิน: รับแจ้งซ่อม แก้ไขทุกอย่าง ตอบแชท ตั้งค่าระบบ",
  technician: "ช่าง: ดูได้ทุกหน้า แต่แก้ไขข้อมูลไม่ได้",
};

function Row({ u, isMe }: { u: StaffRow; isMe: boolean }) {
  const [name, setName] = useState(u.full_name);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const run = (fn: () => Promise<UserResult>, okText: string) =>
    start(async () => {
      const r = await fn();
      setMsg(r.error ? { ok: false, t: r.error } : { ok: true, t: okText });
    });

  return (
    <tr className={u.active ? "" : "opacity-60"}>
      <td>
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field w-44 py-1.5"
            aria-label="ชื่อที่แสดง"
          />
          {name.trim() !== u.full_name && (
            <button
              disabled={pending}
              onClick={() => run(() => updateStaff(u.id, { full_name: name }), "บันทึกชื่อแล้ว")}
              className="btn btn-dark btn-sm"
            >
              บันทึก
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          {u.email}
          {isMe && <span className="ml-1 font-medium text-ink">(คุณ)</span>}
        </p>
      </td>
      <td>
        <select
          defaultValue={u.role}
          disabled={pending || isMe}
          title={isMe ? "เปลี่ยนสิทธิ์ของตัวเองไม่ได้" : undefined}
          onChange={(e) => {
            const role = e.target.value as StaffRow["role"];
            run(() => updateStaff(u.id, { role }), role === "admin" ? "ตั้งเป็นแอดมินแล้ว" : "ตั้งเป็นช่างแล้ว");
          }}
          className="field w-36 py-1.5"
        >
          <option value="admin">แอดมิน</option>
          <option value="technician">ช่าง</option>
        </select>
      </td>
      <td className="whitespace-nowrap text-xs text-muted">
        {u.active ? (
          <span className="mb-0.5 block font-medium text-emerald-700">ใช้งานอยู่</span>
        ) : (
          <span className="mb-0.5 block font-medium text-rose-700">ปิดใช้งาน</span>
        )}
        {u.last_sign_in_at ? `เข้าระบบล่าสุด ${formatDateTime(u.last_sign_in_at)}` : "ยังไม่เคยเข้าระบบ"}
      </td>
      <td>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {pwOpen ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => resetStaffPassword(u.id, pw), "ตั้งรหัสผ่านใหม่แล้ว");
                setPw("");
                setPwOpen(false);
              }}
            >
              <input
                type="password"
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="รหัสผ่านใหม่ (6+ ตัว)"
                className="field w-44 py-1.5"
                autoFocus
              />
              <button disabled={pending || pw.length < 6} className="btn btn-dark btn-sm">
                ตั้ง
              </button>
              <button type="button" onClick={() => setPwOpen(false)} className="btn btn-ghost btn-sm px-1.5" title="ยกเลิก">
                <X size={14} />
              </button>
            </form>
          ) : (
            <button onClick={() => setPwOpen(true)} className="btn btn-secondary btn-sm">
              <KeyRound size={13} /> รหัสผ่าน
            </button>
          )}
          {!isMe && (
            <button
              disabled={pending}
              onClick={() => {
                if (u.active && !confirm(`ปิดการใช้งาน ${u.full_name}? (เข้าระบบไม่ได้ แต่ประวัติงานยังอยู่)`)) return;
                run(() => setStaffActive(u.id, !u.active), u.active ? "ปิดใช้งานแล้ว" : "เปิดใช้งานแล้ว");
              }}
              className={`btn btn-sm ${u.active ? "btn-danger" : "btn-secondary"}`}
            >
              <Power size={13} /> {u.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
            </button>
          )}
        </div>
        {msg && <p className={`mt-1 text-right text-xs ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.t}</p>}
      </td>
    </tr>
  );
}

function AddStaffForm() {
  const [state, action, pending] = useActionState<UserResult, FormData>(createStaff, {});
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<StaffRow["role"]>("technician");
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      setRole("technician");
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button onClick={() => setOpen(true)} className="btn btn-primary">
          <UserPlus size={16} /> เพิ่มผู้ใช้งาน
        </button>
        {state.ok && <span className="text-sm text-emerald-700">เพิ่มผู้ใช้งานแล้ว แจ้งอีเมลและรหัสผ่านให้พนักงานเพื่อเข้าระบบ</span>}
      </div>
    );
  }

  return (
    <form
      ref={ref}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-3 rounded-[10px] border border-line bg-steel/40 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="field-label">ชื่อที่แสดง</span>
          <input name="full_name" className="field" placeholder="เช่น ช่างเอ" />
        </label>
        <label>
          <span className="field-label">อีเมล (ใช้เข้าระบบ)</span>
          <input name="email" type="email" autoComplete="off" className="field" />
        </label>
        <label>
          <span className="field-label">รหัสผ่านเริ่มต้น</span>
          <input name="password" type="password" autoComplete="new-password" className="field" placeholder="อย่างน้อย 6 ตัวอักษร" />
        </label>
        <div>
          <span className="field-label">สิทธิ์</span>
          <div className="flex gap-2">
            {(["technician", "admin"] as const).map((r) => (
              <label
                key={r}
                className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm has-[:checked]:border-graphite has-[:checked]:bg-graphite/5"
              >
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} />
                {r === "admin" ? "แอดมิน" : "ช่าง"}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">{ROLE_HELP[role]}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn btn-primary">
          {pending ? "กำลังสร้าง..." : "สร้างผู้ใช้งาน"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">
          ยกเลิก
        </button>
        {state.error && <span className="text-sm text-rose-700">{state.error}</span>}
      </div>
    </form>
  );
}

export default function UsersManager({ users, meId }: { users: StaffRow[]; meId: string }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p className="rounded-md bg-steel/60 px-3 py-2">
          <span className="font-semibold">แอดมิน</span> <span className="text-muted">รับแจ้งซ่อม แก้ไขทุกอย่าง ตอบแชท และตั้งค่าระบบ</span>
        </p>
        <p className="rounded-md bg-steel/60 px-3 py-2">
          <span className="font-semibold">ช่าง</span> <span className="text-muted">ดูได้ทุกหน้า แต่แก้ไขข้อมูลไม่ได้</span>
        </p>
      </div>
      <div className="overflow-x-auto rounded-[10px] border border-line">
        <table className="data-table">
          <thead>
            <tr>
              <th>ผู้ใช้งาน</th>
              <th>สิทธิ์</th>
              <th>สถานะ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <Row key={u.id} u={u} isMe={u.id === meId} />
            ))}
          </tbody>
        </table>
      </div>
      <AddStaffForm />
    </div>
  );
}
