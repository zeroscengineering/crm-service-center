"use client";

import { startTransition, useActionState, useState } from "react";
import { updateCustomer, type SaveState } from "./actions";
import type { Customer } from "@/lib/types";

const input =
  "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-graphite focus:ring-2 focus:ring-graphite/10";

export default function EditCustomerForm({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SaveState, FormData>(updateCustomer, {});

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-secondary btn-sm">
        แก้ไขข้อมูลลูกค้า
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="grid gap-3 panel p-4 sm:grid-cols-2"
    >
      <input type="hidden" name="id" value={customer.id} />
      <label className="text-sm">
        ชื่อ
        <input name="name" defaultValue={customer.name} className={input} />
      </label>
      <label className="text-sm">
        เบอร์โทร
        <input name="phone" defaultValue={customer.phone} className={input} />
      </label>
      <label className="text-sm">
        LINE ID
        <input name="line_id" defaultValue={customer.line_id ?? ""} className={input} />
      </label>
      <label className="text-sm">
        ที่อยู่
        <input name="address" defaultValue={customer.address ?? ""} className={input} />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:underline">
          ปิด
        </button>
        {state.error && <span className="text-sm text-rose-600">{state.error}</span>}
        {state.ok && <span className="text-sm text-emerald-600">บันทึกแล้ว</span>}
      </div>
    </form>
  );
}
