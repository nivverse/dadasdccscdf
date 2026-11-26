// functions/_lib/gallery.js — แกลเลอรีรูปแบบ X (SSR) — CSS และ lightbox อยู่ใน /nivread.js
import { esc } from './render.js';
import { getDim } from './dims.js';

const IMG_URL = /^https:\/\/[^\s"'<>]{4,500}$/;

// รวมรูปของโพสต์: images ใหม่ ถ้าไม่มี (โพสต์เก่า) ใช้ cover_url
export function postImages(p, max = 10) { // max: โพสต์ตัวละครส่ง 100 (รูปของตัวละครเก็บในรายการ images เดียวกัน)
  const list = (Array.isArray(p.images) ? p.images : []).filter((x) => IMG_URL.test(x)).slice(0, max);
  if (list.length) return list;
  return p.cover_url && IMG_URL.test(p.cover_url) ? [p.cover_url] : [];
}

// สัดส่วนจริง (กว้าง/สูง) ของรูปที่รู้ขนาดแล้ว · 0 = ไม่รู้ · จำกัดช่วงเหมือน layoutX ใน /nivread.js (ยาวมาก/กว้างมากถูกครอปเล็กน้อยแบบ X)
export const ratioOf = (u, lo = 0.5625, hi = 1.91) => { const d = getDim(u); return d ? Math.min(hi, Math.max(lo, d[0] / d[1])) : 0; };

// ความสูงแถวรูป (สูตร CSS ตามความกว้างแถวจริงด้วยหน่วย cqw) ตรงกับ layoutX ใน /nivread.js: ทุกรูป "สูงเท่ากัน" เห็นครบไม่ครอป สูงสุด 420px · แถวผสมสูง/กว้างมาก ยอมครอปรูปกว้างเล็กน้อย
// ต้องใช้คู่กับ container-type:inline-size บนแถว (ดู .gal-x[data-sr] / .cx-track[data-sr] ใน /niv.css)
export function rowGh(rs) {
  const cap = 294; // ความกว้างรูปสูงสุดโดยประมาณบนมือถือ (88% ของแถว) ใช้ตัดสินแถวผสมเท่านั้น
  const his = rs.map((r) => Math.min(420, cap / r));
  const mixed = Math.max.apply(null, his) / Math.min.apply(null, his) > 1.5;
  const lo = `min(420px,calc(min(340px,88cqw)/${Math.max.apply(null, rs).toFixed(4)}))`;
  return mixed ? `max(${lo},294px)` : lo;
}

const CHEV = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

// 1 รูป = สัดส่วนจริง (แนวตั้ง/แนวนอน) เห็นเต็มรูป · 2+ รูป = แถวรูปเลื่อนแนวนอนแบบ X (2 รูปเต็มแถว · 3+ รูปเห็นรูปถัดไปโผล่ขอบขวา · ไม่มีเลขลำดับ/ป้าย +N) · กดดูเต็มด้วย lightbox
// href = โหมดฟีด: แตะรูปแล้วเข้าหน้าโพสต์ (ยังไม่ขยายรูป) · ไม่ใส่ href = หน้าโพสต์: แตะแล้วเปิดดูรูปเต็ม
// ลูกศรเลื่อน (.gal-nav) และสไตล์อยู่ที่ /niv.css + /nivread.js
export function imageGallery(list, title, eager = false, href = '') {
  const urls = (list || []).filter((x) => IMG_URL.test(x)).slice(0, 10);
  const n = urls.length;
  if (!n) return '';
  const data = esc(JSON.stringify(urls));
  const feed = !!href;
  const alt = esc(title);
  if (n === 1) {
    const r = ratioOf(urls[0]);
    const cls = r ? 'gal-s ar' : 'gal-s nd'; // ar = รู้สัดส่วนจริง จองกรอบตั้งแต่ SSR · nd = ไม่รู้ ใช้กรอบสำรองคงที่ (ดู /niv.css)
    const st = r ? ` style="aspect-ratio:${r.toFixed(4)};min-height:0"` : '';
    const open = feed ? `<a class="${cls}"${st} href="${esc(href)}" aria-label="เปิดโพสต์ ${alt}">` : `<div class="${cls}"${st} data-imgs="${data}" data-i="0" role="button" tabindex="0" aria-label="ดูรูปเต็ม">`;
    return `<div class="gal${feed ? ' gal-l' : ''}">${open}
  <img class="bg" src="${esc(urls[0])}" alt="" aria-hidden="true" decoding="async" ${eager ? '' : 'loading="lazy"'}>
  <img class="fg" src="${esc(urls[0])}" alt="${alt}" decoding="async" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}>
${feed ? '</a>' : '</div>'}</div>`;
  }
  // แถวหลายรูป: ทุกรูปรู้ขนาด → ใส่ --tr ต่อรูป + --gh (ความสูงแถว) เป็นสูตร CSS ตามความกว้างแถว (cqw) ตรงกับ layoutX ใน /nivread.js · ไม่งั้นใช้กรอบสำรอง .nd
  const rs = urls.map((u) => ratioOf(u, 0.2, 1.91));
  const sr = rs.every((r) => r > 0);
  let rowStyle = '';
  if (sr) {
    rowStyle = ` style="--gh:${rowGh(rs)}"`;
  }
  const tiles = urls.map((u, i) => {
    const img = `<img src="${esc(u)}" alt="${alt}" decoding="async" ${eager && i < 2 ? '' : 'loading="lazy"'}>`;
    const tr = sr ? ` style="--tr:${rs[i].toFixed(4)}"` : '';
    return feed
      ? `<a class="gal-t"${tr} href="${esc(href)}" aria-label="เปิดโพสต์ ${alt}">${img}</a>`
      : `<button type="button" class="gal-t"${tr} data-i="${i}" aria-label="ดูรูปเต็ม">${img}</button>`;
  }).join('');
  const nav = n > 1 ? `<button type="button" class="gal-nav gal-p" aria-label="รูปก่อนหน้า" hidden>${CHEV('M15 5l-7 7 7 7')}</button><button type="button" class="gal-nav gal-nx" aria-label="รูปถัดไป">${CHEV('M9 5l7 7-7 7')}</button>` : '';
  const dots = n > 1 ? `<div class="gal-dots" aria-hidden="true">${urls.map((_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</div>` : '';
  return `<div class="gal gal-xw${feed ? ' gal-l' : ''}">${dots}<div class="gal-x gal-x-${n === 2 ? '2' : 'm'}${sr ? '' : ' nd'}"${sr ? ' data-sr="1"' : ''}${rowStyle}${feed ? '' : ` data-imgs="${data}"`}>${tiles}</div>${nav}</div>`;
}
