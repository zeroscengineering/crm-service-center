"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
import { updateCustomer, type SaveState } from "./actions";

export type EditableCustomer = {
  id: string;
  name: string;
  phone: string;
  line_id: string | null;
  address: string | null;
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
  tax_id: string | null;
  tax_branch: string | null;
  owner_id: string | null;
};

function F({ name, label, value, mono, span }: { name: string; label: string; value: string | null; mono?: boolean; span?: boolean }) {
  return (
    <label className={span ? "sm:col-span-2" : ""}>
      <span className="field-label">{label}</span>
      <input name={name} defaultValue={value ?? ""} className={`field ${mono ? "font-mono" : ""}`} />
    </label>
  );
}

export default function EditCustomerForm({
  customer,
  staff,
}: {
  customer: EditableCustomer;
  staff: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SaveState, FormData>(updateCustomer, {});
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button onClick={() => setOpen(true)} className="btn btn-secondary btn-sm">
          <Pencil size={13} /> แก้ไขข้อมูลติดต่อ
        </button>
        {state.error && <span className="text-xs text-rose-700">{state.error}</span>}
      </div>
    );
  }


  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-3 rounded-[10px] border border-line bg-steel/40 p-4"
    >
      <input type="hidden" name="id" value={customer.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <F name="name" label="ชื่อลูกค้า" value={customer.name} />
        <F name="phone" label="เบอร์โทร" value={customer.phone} />
        <F name="company_name" label="ชื่อบริษัท / ร้าน" value={customer.company_name} />
        <F name="contact_person" label="ผู้ติดต่อ (ฝั่งลูกค้า)" value={customer.contact_person} />
        <F name="email" label="อีเมล" value={customer.email} />
        <F name="line_id" label="LINE ID" value={customer.line_id} />
        <F name="tax_id" label="เลขประจำตัวผู้เสียภาษี" value={customer.tax_id} mono />
        <F name="tax_branch" label="สาขา (สำหรับใบกำกับ/ใบเสนอราคา)" value={customer.tax_branch} />
        <F name="address" label="ที่อยู่" value={customer.address} span />
        <label className="sm:col-span-2">
          <span className="field-label">ผู้ดูแลลูกค้า (พนักงาน)</span>
          <select name="owner_id" defaultValue={customer.owner_id ?? ""} className="field">
            <option value="">ยังไม่กำหนด</option>
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn btn-primary">
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">
          <X size={14} /> ยกเลิก
        </button>
        {state.error && <span className="text-sm text-rose-700">{state.error}</span>}
      </div>
    </form>
  );
}
