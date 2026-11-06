"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type JobFile = {
  id: string;
  category: "before" | "after" | "document";
  file_name: string | null;
  mime_type: string | null;
  image_url: string;
  created_at: string;
};

const SECTIONS: { key: JobFile["category"]; label: string; accept: string }[] = [
  { key: "before", label: "รูปก่อนซ่อม", accept: "image/*" },
  { key: "after", label: "รูปหลังซ่อม", accept: "image/*" },
  { key: "document", label: "เอกสาร (ใบเสร็จ / บัตรรับประกัน / PDF)", accept: "image/*,application/pdf" },
];

const MAX_SIDE = 1600;
const MAX_BYTES = 4 * 1024 * 1024;

/** ย่อรูปในเบราว์เซอร์ก่อนอัปโหลด (ประหยัดเวลา + พื้นที่ Drive) */
async function compress(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file; // เบราว์เซอร์อ่านไฟล์ไม่ได้ (เช่น HEIC บางเครื่อง) — ส่งไฟล์เดิม
  }
}

export default function FileGallery({
  jobId,
  files,
  canEdit,
  configured,
}: {
  jobId: string;
  files: JobFile[];
  canEdit: boolean;
  configured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<JobFile | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function upload(category: JobFile["category"], list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    const all = Array.from(list);
    try {
      for (let i = 0; i < all.length; i++) {
        setBusy(`กำลังอัปโหลด ${i + 1}/${all.length}...`);
        const f = await compress(all[i]);
        if (f.size > MAX_BYTES) throw new Error(`${all[i].name} ใหญ่เกิน 4MB`);
        const fd = new FormData();
        fd.append("file", f);
        fd.append("category", category);
        const res = await fetch(`/api/jobs/${jobId}/files`, { method: "POST", body: fd });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? `อัปโหลดไม่สำเร็จ (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
      router.refresh();
    } finally {
      setBusy(null);
      const el = inputs.current[category];
      if (el) el.value = "";
    }
  }

  async function remove(f: JobFile) {
    if (!confirm(`ลบไฟล์ ${f.file_name ?? ""}? (จะลบออกจาก Google Drive ด้วย)`)) return;
    setBusy("กำลังลบ...");
    setError(null);
    const res = await fetch(`/api/files/${f.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setError(json.error ?? "ลบไม่สำเร็จ");
    setBusy(null);
    setPreview(null);
    router.refresh();
  }

  if (!configured) {
    return (
      <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
        ยังไม่ได้เชื่อมต่อ Google Drive —{" "}
        {canEdit ? (
          <a href="/settings" className="font-semibold underline">
            ไปที่หน้าตั้งค่าเพื่อเชื่อมต่อ
          </a>
        ) : (
          "แจ้งแอดมินให้เชื่อมต่อในหน้าตั้งค่า"
        )}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {busy && <p className="text-sm text-zinc-600">⏳ {busy}</p>}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}

      {SECTIONS.map((s) => {
        const items = files.filter((f) => f.category === s.key);
        return (
          <div key={s.key}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-700">
                {s.label} <span className="text-zinc-400">({items.length})</span>
              </h3>
              {canEdit && (
                <>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => inputs.current[s.key]?.click()}
                    className="rounded-lg border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 disabled:opacity-50"
                  >
                    + อัปโหลด
                  </button>
                  <input
                    ref={(el) => {
                      inputs.current[s.key] = el;
                    }}
                    type="file"
                    multiple
                    accept={s.accept}
                    className="hidden"
                    onChange={(e) => upload(s.key, e.target.files)}
                  />
                </>
              )}
            </div>
            {items.length === 0 ? (
              <p className="text-xs text-zinc-400">ยังไม่มีไฟล์</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {items.map((f) => {
                  const src = `/api/files/${f.id}`;
                  const isImage = f.mime_type?.startsWith("image/");
                  return (
                    <div key={f.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => (isImage ? setPreview(f) : window.open(src, "_blank"))}
                      className="block aspect-square w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50"
                      title={f.file_name ?? ""}
                    >
                      {isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt={f.file_name ?? ""} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full flex-col items-center justify-center p-1 text-center text-xs text-zinc-600">
                          <span className="text-2xl">📄</span>
                          <span className="line-clamp-2 break-all">{f.file_name}</span>
                        </span>
                      )}
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => remove(f)}
                        disabled={!!busy}
                        title="ลบ"
                        className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white group-hover:flex"
                      >
                        ✕
                      </button>
                    )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {preview && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/80 p-4"
          onClick={() => setPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/files/${preview.id}`}
            alt={preview.file_name ?? ""}
            className="max-h-[80vh] max-w-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <a
              href={preview.image_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-white px-3 py-1.5 text-sm"
            >
              เปิดใน Google Drive
            </a>
            {canEdit && (
              <button onClick={() => remove(preview)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm text-white">
                ลบ
              </button>
            )}
            <button onClick={() => setPreview(null)} className="rounded-lg bg-zinc-700 px-3 py-1.5 text-sm text-white">
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
