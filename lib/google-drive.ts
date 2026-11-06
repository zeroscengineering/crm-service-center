/**
 * Google Drive client แบบเบา (REST API ตรง ไม่ใช้ไลบรารี googleapis)
 * ใช้ OAuth refresh token ของบัญชี Gmail ส่วนตัว + scope drive.file
 * (แอปเห็นเฉพาะไฟล์/โฟลเดอร์ที่แอปสร้างเอง ไม่แตะไฟล์อื่นใน Drive)
 *
 * ใช้เฉพาะฝั่ง server เท่านั้น
 */

const ROOT_FOLDER_NAME = "CRM-SERVICE CENTER";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

export function driveConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN,
  );
}

// ---------- access token (cache ในหน่วยความจำของ instance) ----------
let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    const reason = json.error === "invalid_grant" ? "Refresh token หมดอายุหรือถูกยกเลิก — กรุณาสร้างใหม่" : json.error_description ?? json.error;
    throw new Error(`เชื่อม Google ไม่สำเร็จ: ${reason}`);
  }
  cachedToken = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

async function driveFetch(url: string, init: RequestInit = {}) {
  const token = await accessToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`Google Drive error ${res.status}: ${text.slice(0, 300)}`);
  }
  return res;
}

// ---------- folders ----------
function escapeQ(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findFolder(name: string, parentId?: string) {
  const q = [
    `name = '${escapeQ(name)}'`,
    `mimeType = '${FOLDER_MIME}'`,
    "trashed = false",
    parentId ? `'${parentId}' in parents` : null,
  ]
    .filter(Boolean)
    .join(" and ");
  const res = await driveFetch(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`);
  const json = (await res.json()) as { files: { id: string }[] };
  return json.files[0]?.id ?? null;
}

async function createFolder(name: string, parentId?: string) {
  const res = await driveFetch(`${API}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: parentId ? [parentId] : undefined }),
  });
  return ((await res.json()) as { id: string }).id;
}

const folderCache = new Map<string, string>();

async function ensureFolder(name: string, parentId?: string) {
  const key = `${parentId ?? "root"}/${name}`;
  const hit = folderCache.get(key);
  if (hit) return hit;
  const id = (await findFolder(name, parentId)) ?? (await createFolder(name, parentId));
  folderCache.set(key, id);
  return id;
}

/** โฟลเดอร์ของงานซ่อม: CRM-SERVICE CENTER / <เลขที่เอกสาร> */
export async function jobFolder(docNo: string) {
  const root = await ensureFolder(ROOT_FOLDER_NAME);
  return ensureFolder(docNo, root);
}

// ---------- files ----------
export type DriveFile = { id: string; name: string; mimeType: string; webViewLink: string };

export async function uploadFile(opts: { folderId: string; name: string; mimeType: string; data: ArrayBuffer }) {
  const boundary = `crm-${crypto.randomUUID()}`;
  const meta = JSON.stringify({ name: opts.name, parents: [opts.folderId] });
  const enc = new TextEncoder();

  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\nContent-Type: ${opts.mimeType}\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.byteLength + opts.data.byteLength + tail.byteLength);
  body.set(head, 0);
  body.set(new Uint8Array(opts.data), head.byteLength);
  body.set(tail, head.byteLength + opts.data.byteLength);

  const res = await driveFetch(
    `${UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  return (await res.json()) as DriveFile;
}

/** ดาวน์โหลดเนื้อไฟล์ (ใช้ใน proxy เพื่อไม่ต้องเปิดไฟล์เป็นสาธารณะ) */
export async function downloadFile(fileId: string) {
  return driveFetch(`${API}/files/${encodeURIComponent(fileId)}?alt=media`);
}

export async function deleteFile(fileId: string) {
  try {
    await driveFetch(`${API}/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
  } catch (e) {
    // ไฟล์ถูกลบใน Drive ไปแล้ว — ไม่ถือเป็น error
    if (!(e instanceof Error && e.message.includes(" 404"))) throw e;
  }
}
