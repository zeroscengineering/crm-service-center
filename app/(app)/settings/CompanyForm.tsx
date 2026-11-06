"use client";

import { startTransition, useActionState } from "react";
import { saveCompany, type QuoteResult } from "../quotes/actions";
import type { Company } from "@/lib/quote";

export default function CompanyForm({ company }: { company: Company }) {
  const [state, action, pending] = useActionState<QuoteResult, FormData>(saveCompany, {});
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="grid gap-3 sm:grid-cols-2"
    >
      <label className="sm:col-span-2">
        <span className="field-label">ชื่อบริษัท</span>
        <input name="name" defaultValue={company.name} className="field" />
      </label>
      <label>
        <span className="field-label">เลขประจำตัวผู้เสียภาษี</span>
        <input name="tax_id" defaultValue={company.tax_id} className="field font-mono" />
      </label>
      <label>
        <span className="field-label">สาขา</span>
        <input name="branch" defaultValue={company.branch} className="field" />
      </label>
      <label className="sm:col-span-2">
        <span className="field-label">ที่อยู่</span>
        <textarea name="address" rows={2} defaultValue={company.address} className="field" />
      </label>
      <label>
        <span className="field-label">เบอร์โทร</span>
        <input name="phone" defaultValue={company.phone} className="field" />
      </label>
      <label>
        <span className="field-label">อีเมล</span>
        <input name="email" defaultValue={company.email} className="field" />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="btn btn-primary">
          {pending ? "กำลังบันทึก..." : "บันทึกข้อมูลบริษัท"}
        </button>
        {state.error && <span className="text-sm text-rose-700">{state.error}</span>}
        {state.ok && <span className="text-sm text-emerald-700">บันทึกแล้ว</span>}
      </div>
    </form>
  );
}
