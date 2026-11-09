/**
 * ค้นชื่อ/ที่อยู่ผู้ประกอบการจดทะเบียน VAT จากเลขผู้เสียภาษี
 * ใช้ VAT Service ของกรมสรรพากร (สาธารณะ — username/password = "anonymous")
 * https://www.rd.go.th/42535.html
 */
const ENDPOINT = "https://rdws.rd.go.th/serviceRD3/vatserviceRD3.asmx";
const NS = "https://rdws.rd.go.th/serviceRD3/vatserviceRD3";

export type VatInfo = {
  tin: string;
  branch_no: number;
  /** "สำนักงานใหญ่" หรือ "สาขาที่ 00001" */
  branch_label: string;
  name: string;
  address: string;
  postcode: string;
};

export function isValidTin(tin: string) {
  if (!/^\d{13}$/.test(tin)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(tin[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(tin[12]);
}

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

function envelope(tin: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Service xmlns="${NS}">
      <username>anonymous</username>
      <password>anonymous</password>
      <TIN>${esc(tin)}</TIN>
      <Name></Name>
      <ProvinceCode>0</ProvinceCode>
      <BranchNumber>0</BranchNumber>
      <AmphurCode>0</AmphurCode>
    </Service>
  </soap:Body>
</soap:Envelope>`;
}

function decode(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

/** แยกฟิลด์ใน ServiceResult: <vXxx><anyType ...>ค่า</anyType>...</vXxx> → { vxxx: [ค่า, ...] } */
function parseFields(xml: string) {
  const out: Record<string, string[]> = {};
  const body = xml.match(/<(?:\w+:)?ServiceResult[^>]*>([\s\S]*?)<\/(?:\w+:)?ServiceResult>/)?.[1] ?? xml;
  const re = /<(?:\w+:)?(v\w+)[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?\1>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const key = m[1].toLowerCase();
    const inner = m[2] ?? "";
    const vals = [...inner.matchAll(/<(?:\w+:)?(?:anyType|string)[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?(?:anyType|string)>)/g)].map((x) =>
      decode(x[1] ?? ""),
    );
    out[key] = vals.length ? vals : inner.includes("<") ? [] : [decode(inner)];
  }
  return out;
}

const clean = (v: string | undefined) => {
  const s = (v ?? "").trim();
  return s === "-" || s === "null" ? "" : s;
};

function companyName(title: string, name: string) {
  const t = title.replace(/\s+/g, "");
  if (!t) return name;
  if (name.startsWith(title) || name.startsWith(t)) return name;
  if (t === "บริษัทจำกัด") return `บริษัท ${name} จำกัด`;
  if (t === "บริษัทมหาชนจำกัด") return `บริษัท ${name} จำกัด (มหาชน)`;
  if (t === "ห้างหุ้นส่วนจำกัด" || t === "ห้างหุ้นส่วนสามัญ" || t === "ห้างหุ้นส่วนสามัญนิติบุคคล") return `${t} ${name}`;
  return `${title.trim()} ${name}`.trim();
}

function address(f: Record<string, string>) {
  const bkk = /กรุงเทพ/.test(f.province);
  const parts = [
    f.house,
    f.building && `อาคาร${f.building}`,
    f.room && `ห้อง ${f.room}`,
    f.floor && `ชั้น ${f.floor}`,
    f.village && `หมู่บ้าน${f.village}`,
    f.moo && f.moo !== "0" && `หมู่ ${f.moo}`,
    f.soi && `ซอย${f.soi}`,
    f.street && `ถนน${f.street}`,
    f.tambon && `${bkk ? "แขวง" : "ตำบล"}${f.tambon}`,
    f.amphur && `${bkk ? "เขต" : "อำเภอ"}${f.amphur}`,
    f.province && (bkk ? f.province : `จังหวัด${f.province}`),
    f.postcode,
  ];
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export async function lookupVat(tin: string): Promise<{ results: VatInfo[] } | { error: string }> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `"${NS}/Service"` },
      body: envelope(tin),
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
  } catch {
    return { error: "ติดต่อระบบกรมสรรพากรไม่ได้ (ระบบอาจล่มชั่วคราว) ลองใหม่อีกครั้ง หรือกรอกเอง" };
  }
  const xml = await res.text();
  if (!res.ok) return { error: `ระบบกรมสรรพากรตอบกลับผิดพลาด (${res.status})` };

  const f = parseFields(xml);
  const err = clean(f.vmsgerr?.[0]);
  const nids = f.vnid ?? [];
  if (!nids.length || !clean(nids[0])) {
    return { error: err || "ไม่พบเลขนี้ในรายชื่อผู้ประกอบการจดทะเบียนภาษีมูลค่าเพิ่ม (อาจไม่ได้จด VAT) กรุณากรอกเอง" };
  }

  const get = (k: string, i: number) => clean(f[k]?.[i]);
  const results: VatInfo[] = nids.map((_, i) => {
    const branchNo = Number(get("vbranchnumber", i) || 0) || 0;
    const title = get("vbranchtitlename", i) || get("vtitlename", i);
    const nameRaw = get("vbranchname", i) || [get("vname", i), get("vsurname", i)].filter(Boolean).join(" ");
    const addr = {
      house: get("vhousenumber", i),
      building: get("vbuildingname", i),
      room: get("vroomnumber", i),
      floor: get("vfloornumber", i),
      village: get("vvillagename", i),
      moo: get("vmoonumber", i),
      soi: get("vsoiname", i),
      street: get("vstreetname", i),
      tambon: get("vthambol", i) || get("vtambon", i),
      amphur: get("vamphur", i),
      province: get("vprovince", i),
      postcode: get("vpostcode", i),
    };
    return {
      tin: get("vnid", i) || tin,
      branch_no: branchNo,
      branch_label: branchNo === 0 ? "สำนักงานใหญ่" : `สาขาที่ ${String(branchNo).padStart(5, "0")}`,
      name: companyName(title, nameRaw),
      address: address(addr),
      postcode: addr.postcode,
    };
  });
  results.sort((a, b) => a.branch_no - b.branch_no);
  return { results };
}
