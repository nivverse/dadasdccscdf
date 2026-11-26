// functions/_lib/gallery.js — แกลเลอรีรูปแบบ X (SSR) — CSS และ lightbox อยู่ใน /nivread.js
import { esc } from './render.js';

const IMG_URL = /^https:\/\/[^\s"'<>]{4,500}$/;

// รวมรูปของโพสต์: images ใหม่ ถ้าไม่มี (โพสต์เก่า) ใช้ cover_url
export function postImages(p, max = 10) { // max: โพสต์ตัวละครส่ง 100 (รูปของตัวละครเก็บในรายการ images เดียวกัน)
  const list = (Array.isArray(p.images) ? p.images : []).filter((x) => IMG_URL.test(x)).slice(0, max);
  if (list.length) return list;
  return p.cover_url && IMG_URL.test(p.cover_url) ? [p.cover_url] : [];
}

const CHEV = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

// สัดส่วนรูป (กว้าง/สูง) เก็บเป็น fragment ต่อท้าย URL ตอนอัปโหลด: https://…/x.webp#r=0.800 (fragment ไม่ถูกส่งไปเซิร์ฟเวอร์รูป)
// ใช้ "รูปแรก" เป็นมาตรฐานของทั้งโพสต์ → จองกรอบตั้งแต่ SSR (class rk + --gr) ไม่ต้องรอรูปโหลด
// โพสต์เก่า/ลิงก์ที่วางเอง ไม่มีค่า → ไม่ใส่ rk = ทำงานแบบเดิมทุกอย่าง (ขนาดตามรูปจริง)
export const stripFrag = (u) => String(u).replace(/#.*$/, '');
export function imgRatio(u) {
  const m = /#r=(\d+(?:\.\d+)?)$/.exec(String(u));
  const r = m ? parseFloat(m[1]) : 0;
  return r > 0 ? Math.min(1.91, Math.max(0.5625, r)) : 0;
}

// 1 รูป = สัดส่วนจริง (แนวตั้ง/แนวนอน) เห็นเต็มรูป · 2+ รูป = แถวรูปเลื่อนแนวนอนแบบ X (2 รูปเต็มแถว · 3+ รูปเห็นรูปถัดไปโผล่ขอบขวา · ไม่มีเลขลำดับ/ป้าย +N) · กดดูเต็มด้วย lightbox
// href = โหมดฟีด: แตะรูปแล้วเข้าหน้าโพสต์ (ยังไม่ขยายรูป) · ไม่ใส่ href = หน้าโพสต์: แตะแล้วเปิดดูรูปเต็ม
// ลูกศรเลื่อน (.gal-nav) และสไตล์อยู่ที่ /niv.css + /nivread.js
export function imageGallery(list, title, eager = false, href = '') {
  const raw = (list || []).filter((x) => IMG_URL.test(x)).slice(0, 10);
  const n = raw.length;
  if (!n) return '';
  const gr = imgRatio(raw[0]);
  const urls = raw.map(stripFrag);
  const st = gr ? ` style="--gr:${gr.toFixed(3)}"` : '';
  const rk = gr ? ' rk' : '';
  const data = esc(JSON.stringify(urls));
  const feed = !!href;
  const alt = esc(title);
  if (n === 1) {
    const open = feed ? `<a class="gal-s${rk}"${st} href="${esc(href)}" aria-label="เปิดโพสต์ ${alt}">` : `<div class="gal-s${rk}"${st} data-imgs="${data}" data-i="0" role="button" tabindex="0" aria-label="ดูรูปเต็ม">`;
    const bg = gr ? '' : `\n  <img class="bg" src="${esc(urls[0])}" alt="" aria-hidden="true" decoding="async" ${eager ? '' : 'loading="lazy"'}>`;
    return `<div class="gal${feed ? ' gal-l' : ''}">${open}${bg}
  <img class="fg" src="${esc(urls[0])}" alt="${alt}" decoding="async" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}>
${feed ? '</a>' : '</div>'}</div>`;
  }
  const tiles = urls.map((u, i) => {
    const img = `<img src="${esc(u)}" alt="${alt}" decoding="async" ${eager && i < 2 ? '' : 'loading="lazy"'}>`;
    return feed
      ? `<a class="gal-t" href="${esc(href)}" aria-label="เปิดโพสต์ ${alt}">${img}</a>`
      : `<button type="button" class="gal-t" data-i="${i}" aria-label="ดูรูปเต็ม">${img}</button>`;
  }).join('');
  const nav = `<button type="button" class="gal-nav gal-p" aria-label="รูปก่อนหน้า" hidden>${CHEV('M15 5l-7 7 7 7')}</button><button type="button" class="gal-nav gal-nx" aria-label="รูปถัดไป">${CHEV('M9 5l7 7-7 7')}</button>`;
  const dots = `<div class="gal-dots" aria-hidden="true">${urls.map((_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</div>`;
  return `<div class="gal gal-xw${gr && n === 2 ? ' nv-fit' : ''}${feed ? ' gal-l' : ''}">${dots}<div class="gal-x gal-x-${n === 2 ? '2' : 'm'}${rk}"${st}${feed ? '' : ` data-imgs="${data}"`}>${tiles}</div>${nav}</div>`;
}
