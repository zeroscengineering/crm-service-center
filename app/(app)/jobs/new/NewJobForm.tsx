"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { Plus, Trash2, UserRound, X } from "lucide-react";
import { createJob, searchCustomers, type CreateJobState, type ToolEntry } from "./actions";
import { ACCESSORY_OPTIONS, BRANDS, DOCUMENT_OPTIONS, WARRANTY_LABEL } from "@/lib/constants";
import { formatPhone } from "@/lib/format";
import type { CustomerWithTools } from "@/lib/types";

type Option = { id: string; name: string };

const input = "field mt-1";
const chip =
  "flex cursor-pointer items-center gap-2 rounded-md border border-line bg-white px-3 py-1.5 text-sm has-[:checked]:border-graphite has-[:checked]:bg-graphite/5";

const blankTool = (): ToolEntry => ({
  tool_id: "",
  brand: "",
  model: "",
  serial_number: "",
  issue_description: "",
  warranty: "unknown",
  accessories: [],
  received_documents: [],
  repair_notes: "",
});

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
      <span className="text-[13px] font-medium text-muted">
        {label}
        {required && <span className="text-brand"> *</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-rose-700">{error}</span>}
    </label>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="panel-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** ช่องกรอกที่แนะนำลูกค้าเดิมขณะพิมพ์ */
function CustomerSuggest({
  value,
  onChange,
  onPick,
  name,
  placeholder,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (c: CustomerWithTools) => void;
  name: string;
  placeholder?: string;
  inputMode?: "tel" | "text";
}) {
  const [results, setResults] = useState<CustomerWithTools[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        setResults(await searchCustomers(value));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={box} className="relative">
      <input
        name={name}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete="off"
        className={input}
      />
      {open && value.trim().length >= 2 && (loading || results.length > 0) && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-line bg-white shadow-[0_8px_24px_rgba(31,35,40,0.12)]">
          <p className="border-b border-line bg-steel/60 px-3 py-1.5 text-xs text-muted">
            {loading ? "กำลังค้นหา..." : `พบลูกค้าเดิม ${results.length} ราย — เลือกเพื่อใช้ข้อมูลเดิม`}
          </p>
          <ul className="max-h-64 overflow-y-auto">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(c);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-steel/60"
                >
                  <UserRound size={16} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {formatPhone(c.phone)}
                      {c.tools.length > 0 && ` · ${c.tools.map((t) => `${t.brand} ${t.model}`).slice(0, 2).join(", ")}`}
                      {c.tools.length > 2 && ` +${c.tools.length - 2}`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CheckGroup({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  // ช่อง "อื่น ๆ" เก็บเป็นข้อความดิบ (เซิร์ฟเวอร์แยกด้วยจุลภาคให้)
  const [other, setOther] = useState(value.filter((v) => !options.includes(v)).join(", "));
  const checked = value.filter((v) => options.includes(v));
  const emit = (c: string[], o: string) => onChange(o.trim() ? [...c, o] : c);
  return (
    <div>
      <p className="text-[13px] font-medium text-muted">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o} className={chip}>
            <input
              type="checkbox"
              checked={checked.includes(o)}
              onChange={(e) => emit(e.target.checked ? [...checked, o] : checked.filter((v) => v !== o), other)}
            />
            {o}
          </label>
        ))}
      </div>
      <input
        value={other}
        onChange={(e) => {
          setOther(e.target.value);
          emit(checked, e.target.value);
        }}
        className={`${input} text-sm`}
        placeholder="อื่น ๆ (คั่นด้วยเครื่องหมายจุลภาค ,)"
      />
    </div>
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
  nextDoc,
}: {
  branches: Option[];
  technicians: Option[];
  today: string;
  carriers?: Option[];
  initialCustomer?: CustomerWithTools | null;
  lineUserId?: string;
  defaultName?: string;
  nextDoc: string;
}) {
  const [state, formAction, pending] = useActionState<CreateJobState, FormData>(createJob, {});
  const fe = state.fieldErrors ?? {};

  const [customer, setCustomer] = useState<CustomerWithTools | null>(initialCustomer);
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [manualDoc, setManualDoc] = useState(false);
  const [tools, setTools] = useState<ToolEntry[]>([
    { ...blankTool(), tool_id: initialCustomer?.tools[0]?.id ?? "" },
  ]);

  function pickCustomer(c: CustomerWithTools) {
    setCustomer(c);
    setTools((ts) => ts.map((t, i) => (i === 0 && !t.model ? { ...t, tool_id: c.tools[0]?.id ?? "" } : t)));
  }
  function clearCustomer() {
    setCustomer(null);
    setTools((ts) => ts.map((t) => ({ ...t, tool_id: "" })));
  }
  function setTool(i: number, patch: Partial<ToolEntry>) {
    setTools((ts) => ts.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("tools", JSON.stringify(tools));
    startTransition(() => formAction(fd));
  }

  const multi = tools.length > 1;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="customer_id" value={customer?.id ?? ""} />
      <input type="hidden" name="line_user_id" value={lineUserId} />
      <input type="hidden" name="doc_mode" value={manualDoc && !multi ? "manual" : "auto"} />

      {/* ---------- เอกสาร ---------- */}
      <Section title="1. ข้อมูลเอกสาร">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-[13px] font-medium text-muted">เลขที่เอกสาร</span>
            {manualDoc && !multi ? (
              <input name="doc_no" autoFocus className={`${input} font-mono uppercase`} placeholder="กรอกเลขที่เอง" />
            ) : (
              <div className="mt-1 flex h-[38px] items-center gap-2 rounded-md border border-dashed border-line bg-steel/50 px-3">
                <span className="font-mono text-sm font-semibold">{nextDoc}</span>
                <span className="text-xs text-muted">{multi ? `ถึง ${tools.length} เลข` : "อัตโนมัติ"}</span>
              </div>
            )}
            {fe.doc_no && <span className="mt-1 block text-xs text-rose-700">{fe.doc_no}</span>}
            {!multi && (
              <label className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" checked={manualDoc} onChange={(e) => setManualDoc(e.target.checked)} />
                กำหนดเลขที่เอง
              </label>
            )}
          </div>
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
              <option value="">ยังไม่ระบุ</option>
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
                <option value="">ไม่ระบุ</option>
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
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50/60 p-4">
            <div>
              <p className="text-xs font-medium text-emerald-800">ลูกค้าเดิม</p>
              <p className="font-semibold">{customer.name}</p>
              <p className="text-sm text-muted">
                {formatPhone(customer.phone)}
                {customer.line_id && ` · LINE ${customer.line_id}`}
              </p>
              {customer.address && <p className="text-sm text-muted">{customer.address}</p>}
            </div>
            <button type="button" onClick={clearCustomer} className="btn btn-ghost btn-sm">
              <X size={14} /> เปลี่ยนลูกค้า
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ชื่อลูกค้า" required error={fe.customer_name}>
              <CustomerSuggest name="customer_name" value={name} onChange={setName} onPick={pickCustomer} />
            </Field>
            <Field label="เบอร์โทร" required error={fe.customer_phone}>
              <CustomerSuggest
                name="customer_phone"
                value={phone}
                onChange={setPhone}
                onPick={pickCustomer}
                placeholder="0812345678"
                inputMode="tel"
              />
            </Field>
            <Field label="LINE ID">
              <input name="customer_line_id" className={input} />
            </Field>
            <Field label="ที่อยู่">
              <input name="customer_address" className={input} />
            </Field>
            <p className="text-xs text-muted sm:col-span-2">
              พิมพ์ชื่อหรือเบอร์โทร ระบบจะแสดงลูกค้าเดิมที่ตรงกันให้เลือก ถ้าไม่เลือก จะบันทึกเป็นลูกค้าใหม่
            </p>
          </div>
        )}
      </Section>

      {/* ---------- เครื่องมือ (หลายเครื่อง) ---------- */}
      {tools.map((t, i) => {
        const err = (k: string) => fe[`t${i}.${k}`];
        return (
          <Section
            key={i}
            title={`3.${i + 1} เครื่องที่ ${i + 1}`}
            action={
              multi && (
                <button
                  type="button"
                  onClick={() => setTools((ts) => ts.filter((_, idx) => idx !== i))}
                  className="btn btn-danger btn-sm"
                >
                  <Trash2 size={14} /> ลบเครื่องนี้
                </button>
              )
            }
          >
            <div className="space-y-5">
              {customer && customer.tools.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {customer.tools.map((ct) => (
                    <label key={ct.id} className={chip}>
                      <input type="radio" checked={t.tool_id === ct.id} onChange={() => setTool(i, { tool_id: ct.id })} />
                      <span className="font-medium">{ct.brand}</span> {ct.model}
                      {ct.serial_number && <span className="font-mono text-xs text-muted">S/N {ct.serial_number}</span>}
                    </label>
                  ))}
                  <label className={`${chip} border-dashed`}>
                    <input type="radio" checked={t.tool_id === ""} onChange={() => setTool(i, { tool_id: "" })} />
                    เครื่องใหม่
                  </label>
                </div>
              )}

              {t.tool_id === "" && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="แบรนด์" required error={err("brand")}>
                    <select value={t.brand} onChange={(e) => setTool(i, { brand: e.target.value })} className={input}>
                      <option value="" disabled>
                        เลือกแบรนด์
                      </option>
                      {BRANDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="รุ่น (Model)" required error={err("model")}>
                    <input
                      value={t.model}
                      onChange={(e) => setTool(i, { model: e.target.value })}
                      className={input}
                      placeholder="เช่น M18 FPD2"
                    />
                  </Field>
                  <Field label="Serial Number">
                    <input
                      value={t.serial_number}
                      onChange={(e) => setTool(i, { serial_number: e.target.value })}
                      className={`${input} font-mono uppercase`}
                    />
                  </Field>
                </div>
              )}

              <Field label="อาการเสียเบื้องต้น" required error={err("issue")}>
                <textarea
                  rows={2}
                  value={t.issue_description}
                  onChange={(e) => setTool(i, { issue_description: e.target.value })}
                  className={input}
                />
              </Field>

              <div>
                <p className="text-[13px] font-medium text-muted">สถานะประกัน</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(WARRANTY_LABEL).map(([value, label]) => (
                    <label key={value} className={chip}>
                      <input type="radio" checked={t.warranty === value} onChange={() => setTool(i, { warranty: value })} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <CheckGroup
                title="อุปกรณ์ที่ลูกค้าฝากมาด้วย"
                options={ACCESSORY_OPTIONS}
                value={t.accessories}
                onChange={(v) => setTool(i, { accessories: v })}
              />
              <CheckGroup
                title="เอกสารที่มากับสินค้า"
                options={DOCUMENT_OPTIONS}
                value={t.received_documents}
                onChange={(v) => setTool(i, { received_documents: v })}
              />

              <Field label="หมายเหตุ / สภาพเครื่องภายนอก">
                <textarea
                  rows={2}
                  value={t.repair_notes}
                  onChange={(e) => setTool(i, { repair_notes: e.target.value })}
                  className={input}
                  placeholder="เช่น มีรอยขีดข่วนด้านข้าง"
                />
              </Field>
            </div>
          </Section>
        );
      })}

      <button
        type="button"
        onClick={() => setTools((ts) => [...ts, blankTool()])}
        className="flex w-full items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-line bg-white/60 py-4 text-sm font-medium text-muted hover:border-graphite/40 hover:text-ink"
      >
        <Plus size={18} /> เพิ่มเครื่อง
      </button>

      {state.error && (
        <p className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">{state.error}</p>
      )}

      <div className="flex items-center justify-end gap-3">
        <span className="text-sm text-muted">
          {multi ? `บันทึก ${tools.length} เครื่อง ได้ ${tools.length} เลขที่เอกสาร` : "บันทึก 1 เครื่อง"}
        </span>
        <button type="submit" disabled={pending} className="btn btn-primary px-6 py-2.5">
          {pending ? "กำลังบันทึก..." : "บันทึกและพิมพ์ใบรับเครื่อง"}
        </button>
      </div>
    </form>
  );
}
