// functions/_lib/dims.js — อ่านขนาด (กว้าง×สูง) ของรูปที่อัปโหลดเอง จาก header ของไฟล์ (แค่ ~96KB แรก) เพื่อให้ SSR จองกรอบสัดส่วนจริงของรูป/โปสเตอร์วิดีโอไว้ก่อนรูปโหลด
// → หน้าไม่กระโดด เล็ก↔ใหญ่ (แบบ X) · ผลเก็บใน cache ของ Cloudflare 30 วัน + หน่วยความจำของ isolate
// ปลอดภัย: ตรวจเฉพาะ URL ที่เป็นไฟล์อัปโหลดของเว็บเอง (OWN) ไม่ fetch ลิงก์ภายนอกที่ผู้ใช้ใส่

const OWN = /^https:\/\/[^\s"'<>]{4,300}\/(?:api\/blog\/(?:img\/u|vid)\/[^\s"'<>]{1,300}|(?:u|v)\/[A-Za-z0-9._~%-]{1,180}\/[a-z0-9]{6,40}\.(?:webp|jpg|jpeg|png|gif))$/;
const HEAD_BYTES = 98304;
const OK = new Map();   // url -> [w, h]
const FAIL = new Map(); // url -> เวลาที่พลาด (ลองใหม่หลัง 60 วิ)

export const getDim = (u) => OK.get(u) || null;

const u32 = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const ascii = (b, s, e) => String.fromCharCode.apply(null, b.subarray(s, e));

export function parseDims(b) {
  const n = b.length;
  if (n > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return [u32(b, 16), u32(b, 20)]; // PNG
  if (n > 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return [b[6] | (b[7] << 8), b[8] | (b[9] << 8)]; // GIF
  if (n > 30 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') { // WebP
    const t = ascii(b, 12, 16);
    if (t === 'VP8X') return [1 + (b[24] | (b[25] << 8) | (b[26] << 16)), 1 + (b[27] | (b[28] << 8) | (b[29] << 16))];
    if (t === 'VP8L') { const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0; return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1]; }
    if (t === 'VP8 ') return [(b[26] | (b[27] << 8)) & 0x3fff, (b[28] | (b[29] << 8)) & 0x3fff];
    return null;
  }
  if (n > 4 && b[0] === 0xff && b[1] === 0xd8) { // JPEG: หา SOF
    let i = 2;
    while (i + 9 < n) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m === 0x01 || (m >= 0xd0 && m <= 0xd9)) { i += 2; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [(b[i + 7] << 8) | b[i + 8], (b[i + 5] << 8) | b[i + 6]];
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
  }
  return null;
}

async function readHead(res, limit) {
  const rd = res.body && res.body.getReader ? res.body.getReader() : null;
  if (!rd) return new Uint8Array((await res.arrayBuffer()).slice(0, limit));
  const parts = []; let got = 0;
  while (got < limit) {
    const { done, value } = await rd.read();
    if (done) break;
    parts.push(value); got += value.length;
  }
  try { await rd.cancel(); } catch {}
  const out = new Uint8Array(Math.min(got, limit)); let o = 0;
  for (const p of parts) { const t = p.subarray(0, Math.min(p.length, out.length - o)); out.set(t, o); o += t.length; if (o >= out.length) break; }
  return out;
}

async function one(u) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request('https://dims.nivread.invalid/?u=' + encodeURIComponent(u));
  try {
    if (cache) {
      const hit = await cache.match(key);
      if (hit) { const j = await hit.json(); if (j && j.w > 0 && j.h > 0) { OK.set(u, [j.w, j.h]); return; } }
    }
    const r = await fetch(u, { headers: { Range: `bytes=0-${HEAD_BYTES - 1}` }, cf: { cacheTtl: 86400, cacheEverything: true } });
    if (!r.ok) { FAIL.set(u, Date.now()); return; }
    const d = parseDims(await readHead(r, HEAD_BYTES));
    if (!d || !(d[0] > 0) || !(d[1] > 0) || d[0] > 20000 || d[1] > 20000) { FAIL.set(u, Date.now()); return; }
    OK.set(u, d);
    if (cache) await cache.put(key, new Response(JSON.stringify({ w: d[0], h: d[1] }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=2592000' } }));
  } catch { FAIL.set(u, Date.now()); }
}

// รอไม่เกิน budgetMs — ที่ยังไม่เสร็จจะตกไปใช้กรอบสำรอง (ไม่ทำให้หน้าช้า)
export async function probeDims(urls, budgetMs = 2500) {
  const now = Date.now();
  const todo = [...new Set(urls)].filter((u) => OWN.test(u) && !OK.has(u) && !(FAIL.has(u) && now - FAIL.get(u) < 60000)).slice(0, 80);
  if (!todo.length) return;
  let t;
  await Promise.race([Promise.all(todo.map(one)), new Promise((r) => { t = setTimeout(r, budgetMs); })]);
  clearTimeout(t);
}
