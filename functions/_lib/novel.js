// functions/_lib/novel.js — ตัวช่วยเรนเดอร์หน้านิยาย (ใช้ shell/esc/htmlResponse จาก render.js เดิม)
import { esc, shell, htmlResponse } from './render.js';

export const STATUS_TH = { ongoing: 'กำลังเขียน', completed: 'จบแล้ว', hiatus: 'พักการเขียน' };
export const fmtNum = (n) => Number(n || 0).toLocaleString('th-TH');
export const posInt = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 && n < 1e12 ? n : 0; };
export const flat = (s) => String(s || '').replace(/\s+/g, ' ').trim();
// 1234 → 1.2K · 2500000 → 2.5M
export const compact = (n) => {
  n = Number(n) || 0;
  if (n < 1000) return String(n);
  if (n < 1e6) return (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '') + 'K';
  return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
};

// ไอคอน SVG คงที่ (เส้นตาม currentColor · ขนาดตามตัวอักษรด้วยคลาส .nv-i ใน novel.css) — ไม่ใช้อิโมจิ/ตัวอักษรแทนไอคอน
const svg = (d, cls = 'nv-i') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const P_STAR = '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>';
export const ICON = {
  eye: svg('<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>'),
  heart: svg('<path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z"/>'),
  bookmark: svg('<path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>'),
  share: svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'),
  chat: svg('<path d="M21 11.5a8.4 8.4 0 01-12.2 7.5L3 21l2-5.8A8.4 8.4 0 1121 11.5z"/>'),
  star: svg(P_STAR, 'nv-i nv-i-fill'),                       // ดาวทึบ (ข้อความคะแนน)
  starBtn: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + P_STAR + '</svg>',   // ดาวในปุ่มให้คะแนน (CSS เติมสี)
  lock: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>'),
  book: svg('<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>'),
  prev: svg('<path d="M15 18l-6-6 6-6"/>'),
  next: svg('<path d="M9 18l6-6-6-6"/>'),
  arrowRight: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  list: svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
  sliders: svg('<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
};

// <head> ร่วมของหน้านิยาย: สไตล์ + ธง nv-js (เอฟเฟกต์เปิดตัวทำงานเฉพาะเมื่อ JS ทำงาน ไม่ซ่อนเนื้อหาจากคนที่ปิด JS)
export const HEAD_BASE = '<link rel="stylesheet" href="/novel.css">\n<script>document.documentElement.classList.add("nv-js");setTimeout(function(){if(!window.__nvfx)document.documentElement.classList.remove("nv-js")},2500)</script>';

// ใส่ค่าตั้งค่าการอ่านก่อนวาดหน้า กันหน้ากะพริบเปลี่ยนธีม/ฟอนต์ (ต้องตรงกับ novel-reader.js)
export const READER_HEAD = HEAD_BASE + `
<script>(function(){try{var d=document.documentElement,p=JSON.parse(localStorage.getItem('nv:rd')||'{}'),s=d.style;
if(p.t&&p.t!=='auto')d.setAttribute('data-rt',p.t);
d.setAttribute('data-par',p.par||'some');
if(p.s)s.setProperty('--rd-size',p.s+'px');
if(p.lh)s.setProperty('--rd-lh',p.lh);
var W={n:'36rem',m:'48rem',w:'64rem'};if(W[p.w])s.setProperty('--rd-w',W[p.w]);
var F={kanit:["'Kanit', sans-serif"],sarabun:["'Sarabun', 'Kanit', sans-serif","Sarabun:wght@400;600"],serif:["'Noto Serif Thai', serif","Noto+Serif+Thai:wght@400;600"],sys:["system-ui, -apple-system, sans-serif"]}[p.f];
if(F){s.setProperty('--rd-font',F[0]);if(F[1]){var l=document.createElement('link');l.rel='stylesheet';l.setAttribute('data-nvf',F[1]);l.href='https://fonts.googleapis.com/css2?family='+F[1]+'&display=swap';document.head.appendChild(l);}}
}catch(e){}})();</script>`;

const CARD = 'rounded-2xl bg-white/85 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-md shadow-sm';
export const BTN = 'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold text-sm shadow-md shadow-amber-500/25 transition';
export const BTN2 = 'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-300 dark:border-white/15 text-sm font-semibold hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition';
export { CARD };

export const novelHref = (slug, no) => `/novels/${encodeURIComponent(slug)}${no ? '/' + no : ''}`;

export function coverImg(n, cls = '') {
  if (n.cover_url && /^https:\/\//.test(n.cover_url)) {
    return `<img src="${esc(n.cover_url)}" alt="ปกนิยาย ${esc(n.title)}" width="400" height="600" loading="lazy" decoding="async" class="aspect-[2/3] w-full object-cover ${cls}">`;
  }
  const ch = esc(Array.from(String(n.title || '?'))[0] || '?');
  return `<div class="nv-cover-ph aspect-[2/3] w-full flex items-center justify-center bg-gradient-to-br from-amber-500/30 to-orange-600/30 text-5xl font-bold text-amber-700 dark:text-amber-300 ${cls}" role="img" aria-label="ปกนิยาย ${esc(n.title)}">${ch}</div>`;
}

export function novelCard(n, i = 0) {
  const st = (icon, txt, cls = '') => `<span class="inline-flex items-center gap-1 ${cls}">${icon}${txt}</span>`;
  const stats = [
    n.rating_count > 0 ? st(ICON.star, esc(String(n.rating_avg)), 'text-amber-500') : '',
    st(ICON.eye, compact(n.views)),
    n.like_count > 0 ? st(ICON.heart, compact(n.like_count)) : '',
  ].filter(Boolean).join('');
  // การ์ดเป็น flex คอลัมน์สูงเท่ากันทั้งแถว: ชื่อจองที่ไว้ 2 บรรทัดเสมอ (ชื่อสั้นก็ไม่ทำให้บรรทัดถัดไปเลื่อนขึ้น)
  // และแถวสถิติถูกตรึงไว้ล่างสุดของการ์ด จึงเรียงตรงกันทุกใบ
  return `<a href="${novelHref(n.slug)}" class="nv-card nv-reveal group flex flex-col h-full ${CARD} overflow-hidden hover:border-amber-500/60" style="--i:${Math.min(i, 8)}">
  <div class="overflow-hidden flex-none">${coverImg(n)}</div>
  <div class="flex flex-col flex-1 p-2.5 sm:p-3">
    <h3 class="nv-ttl font-semibold text-sm leading-normal line-clamp-2 min-h-[3em] group-hover:text-amber-600 dark:group-hover:text-amber-400">${esc(n.title)}</h3>
    <p class="mt-1 text-xs text-slate-500 dark:text-neutral-400 truncate">${esc(n.display_name || '')}</p>
    <p class="mt-1 text-[11px] text-slate-400 dark:text-neutral-500 truncate">${fmtNum(n.chapter_count)} ตอน · ${esc(STATUS_TH[n.status] || '')}</p>
    <p class="mt-auto pt-2 flex items-center gap-2.5 text-[11px] text-slate-500 dark:text-neutral-400">${stats}</p>
  </div></a>`;
}

// เนื้อหาเป็นข้อความล้วน: หนึ่งบรรทัด = หนึ่งย่อหน้า (escape ทุกครั้ง)
export function paragraphs(content) {
  return String(content || '').split(/\n+/).map((t) => t.trim()).filter(Boolean)
    .map((t) => `<p>${esc(t)}</p>`).join('\n');
}

export function notFoundPage({ origin, env, path, what = 'นิยาย' }) {
  return htmlResponse(shell({
    origin, apiBase: env.API_BASE, path, title: `ไม่พบ${what} | nivread`, desc: `ไม่พบ${what}ที่คุณต้องการ`, robots: 'noindex, follow',
    body: `<main class="flex-1 max-w-2xl w-full mx-auto px-4 py-16 z-10 text-center"><h1 class="text-2xl font-bold">ไม่พบ${what}นี้</h1><p class="mt-2 text-slate-500 dark:text-neutral-400">อาจถูกลบหรือยังไม่เผยแพร่</p><a href="/novels" class="${BTN} mt-6">กลับไปหน้านิยาย</a></main>`,
  }), 404, 'public, max-age=60');
}

export const unavailable = () => htmlResponse('<!DOCTYPE html><meta charset="utf-8"><title>ระบบขัดข้อง</title><p>กรุณาลองใหม่อีกครั้ง</p>', 503, 'no-store');
export const isMissing = (d) => !!(d && (d.notFound || (d.success === false && !String(d.error || '').startsWith('api'))));
export const isBroken = (d) => !d || !!d.error;