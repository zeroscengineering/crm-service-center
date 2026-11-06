"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import { createJob, searchCustomers, type CreateJobState } from "./actions";
import {
  ACCESSORY_OPTIONS,
  BRANDS,
  DOCUMENT_OPTIONS,
  WARRANTY_LABEL,
} from "@/lib/constants";
import { formatPhone } from "@/lib/format";
import type { CustomerWithTools } from "@/lib/types";

type Option = { id: string; name: string };

const input =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

function Field({
  label,
  error,
  required,
  children,
  className = "",
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-zinc-700">
        {label}
        {required && <span className="text-brand"> *</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function NewJobForm({
  branches,
  technicians,
  today,
  carriers = [],
  initialCustomer = null,
  lineUserId = "",
  defaultName = "",
}: {
  branches: Option[];
  technicians: Option[];
  today: string;
  carriers?: Option[];
  initialCustomer?: CustomerWithTools | null;
  lineUserId?: string;
  defaultName?: string;
}) {
  const [state, formAction, pending] = useActionState<CreateJobState, FormData>(createJob, {});
  const fe = state.fieldErrors ?? {};

  // ----- ลูกค้า -----
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerWithTools[]>([]);
  const [searching, setSearching] = useState(false);
  const [customer, setCustomer] = useState<CustomerWithTools | null>(initialCustomer);
  const [toolId, setToolId] = useState<string>(initialCustomer?.tools[0]?.id ?? ""); // "" = เครื่องใหม่

  useEffect(() => {
    if (customer || query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        setResults(await searchCustomers(query));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, customer]);

  function pickCustomer(c: CustomerWithTools) {
    setCustomer(c);
    setToolId(c.tools[0]?.id ?? "");
    setResults([]);
  }

  function clearCustomer() {
    setCustomer(null);
    setToolId("");
    setQuery("");
  }

  // ส่งฟอร์มด้วย onSubmit เพื่อไม่ให้ React ล้างค่าที่กรอกไว้เมื่อมี error
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="customer_id" value={customer?.id ?? ""} />
      <input type="hidden" name="tool_id" value={toolId} />
      <input type="hidden" name="line_user_id" value={lineUserId} />

      {/* ---------- เอกสาร ---------- */}
      <Section title="1. ข้อมูลเอกสาร">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="เลขที่เอกสาร" required error={fe.doc_no}>
            <input name="doc_no" className={`${input} font-mono uppercase`} placeholder="เช่น SV-0001" />
          </Field>
          <Field label="วันที่รับเครื่อง" required>
            <input name="received_at" type="date" defaultValue={today} className={input} />
          </Field>
          <Field label="สาขา">
            <select name="branch_id" className={input} defaultValue={branches[0]?.id ?? ""}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ช่างผู้รับผิดชอบ">
            <select name="technician_id" className={input} defaultValue="">
              <option value="">— ยังไม่ระบุ —</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          {carriers.length > 0 && (
            <Field label="ขนส่งที่ลูกค้าใช้">
              <select
                key={customer?.id ?? "new"}
                name="carrier_id"
                className={input}
                defaultValue={(customer as { default_carrier_id?: string | null } | null)?.default_carrier_id ?? ""}
              >
                <option value="">— ไม่ระบุ —</option>
                {carriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      </Section>

      {/* ---------- ลูกค้า ---------- */}
      <Section title="2. ลูกค้า">
        {customer ? (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-emerald-50 p-4 ring-1 ring-emerald-200">
            <div>
              <p className="font-semibold">{customer.name}</p>
              <p className="text-sm text-zinc-600">
                {formatPhone(customer.phone)}
                {customer.line_id && ` · LINE: ${customer.line_id}`}
              </p>
              {customer.address && <p className="text-sm text-zinc-500">{customer.address}</p>}
            </div>
            <button type="button" onClick={clearCustomer} className="text-sm text-brand hover:underline">
              เปลี่ยนลูกค้า
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Field label="ค้นหาลูกค้าเก่า (ชื่อ หรือ เบอร์โทร)">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={input}
                  placeholder="พิมพ์อย่างน้อย 2 ตัวอักษร"
                  autoComplete="off"
                />
              </Field>
              {(results.length > 0 || searching) && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
                  {searching && <li className="px-3 py-2 text-sm text-zinc-500">กำลังค้นหา...</li>}
                  {results.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => pickCustomer(c)}
                        className="w-full px-3 py-2 text-left hover:bg-zinc-50"
                      >
                        <span className="font-medium">{c.name}</span>{" "}
                        <span className="text-sm text-zinc-500">
                          {formatPhone(c.phone)} · {c.tools.length} เครื่อง
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-zinc-500">ไม่พบ? กรอกข้อมูลลูกค้าใหม่ด้านล่าง</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ชื่อลูกค้า" required error={fe.customer_name}>
                <input name="customer_name" defaultValue={defaultName} className={input} />
              </Field>
              <Field label="เบอร์โทร" required error={fe.customer_phone}>
                <input name="customer_phone" inputMode="tel" className={input} placeholder="0812345678" />
              </Field>
              <Field label="LINE ID">
                <input name="customer_line_id" className={input} />
              </Field>
              <Field label="ที่อยู่">
                <input name="customer_address" className={input} />
              </Field>
            </div>
          </div>
        )}
      </Section>

      {/* ---------- เครื่องมือ ---------- */}
      <Section title="3. เครื่องมือที่รับซ่อม">
        {customer && customer.tools.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-sm text-zinc-600">เครื่องที่ลูกค้าเคยนำมา:</p>
            {customer.tools.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 has-[:checked]:border-brand has-[:checked]:bg-brand/5">
                <input type="radio" checked={toolId === t.id} onChange={() => setToolId(t.id)} />
                <span className="font-medium">{t.brand}</span> {t.model}
                {t.serial_number && <span className="font-mono text-xs text-zinc-500">S/N {t.serial_number}</span>}
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 has-[:checked]:border-brand has-[:checked]:bg-brand/5">
              <input type="radio" checked={toolId === ""} onChange={() => setToolId("")} />
              + เครื่องใหม่
            </label>
          </div>
        )}

        {toolId === "" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="แบรนด์" required error={fe.brand}>
              <select name="brand" className={input} defaultValue="">
                <option value="" disabled>
                  — เลือก —
                </option>
                {BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="รุ่น (Model)" required error={fe.model}>
              <input name="model" className={input} placeholder="เช่น M18 FPD2" />
            </Field>
            <Field label="Serial Number">
              <input name="serial_number" className={`${input} font-mono uppercase`} />
            </Field>
          </div>
        )}
      </Section>

      {/* ---------- อาการ & ของที่ฝาก ---------- */}
      <Section title="4. อาการเสียและสิ่งที่รับมา">
        <div className="space-y-5">
          <Field label="อาการเสียเบื้องต้น" required error={fe.issue_description}>
            <textarea name="issue_description" rows={3} className={input} />
          </Field>

          <div>
            <p className="text-sm font-medium text-zinc-700">สถานะประกัน</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(WARRANTY_LABEL).map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/5">
                  <input type="radio" name="warranty" value={value} defaultChecked={value === "unknown"} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <CheckGroup
            title="อุปกรณ์ที่ลูกค้าฝากมาด้วย"
            name="accessories"
            otherName="accessories_other"
            options={ACCESSORY_OPTIONS}
          />
          <CheckGroup
            title="เอกสารที่มากับสินค้า"
            name="received_documents"
            otherName="documents_other"
            options={DOCUMENT_OPTIONS}
          />
          <p className="-mt-2 text-xs text-zinc-500">
            อัปโหลดรูปเครื่องและไฟล์เอกสาร ได้ในหน้ารายละเอียดงานหลังบันทึก
          </p>

          <Field label="หมายเหตุ / สภาพเครื่องภายนอก">
            <textarea name="repair_notes" rows={2} className={input} placeholder="เช่น มีรอยขีดข่วนด้านข้าง" />
          </Field>
        </div>
      </Section>

      {state.error && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">{state.error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-6 py-2.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "กำลังบันทึก..." : "บันทึกและพิมพ์ใบรับเครื่อง"}
        </button>
      </div>
    </form>
  );
}

function CheckGroup({
  title,
  name,
  otherName,
  options,
}: {
  title: string;
  name: string;
  otherName: string;
  options: string[];
}) {
  return (
    <div>
      <p className="text-sm font-medium text-zinc-700">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/5">
            <input type="checkbox" name={name} value={o} />
            {o}
          </label>
        ))}
      </div>
      <input
        name={otherName}
        className={`${input} mt-2 text-sm`}
        placeholder="อื่นๆ (คั่นด้วยเครื่องหมายจุลภาค ,)"
      />
    </div>
  );
}
