// functions/_lib/novel.js — ตัวช่วยเรนเดอร์หน้านิยาย (ใช้ shell/esc/htmlResponse จาก render.js เดิม)
import { esc, shell, htmlResponse } from './render.js';

export const STATUS_TH = { ongoing: 'กำลังเขียน', completed: 'จบแล้ว', hiatus: 'พักการเขียน' };
export const fmtNum = (n) => Number(n || 0).toLocaleString('th-TH');
export const posInt = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 && n < 1e12 ? n : 0; };
export const flat = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const CARD = 'rounded-2xl bg-white/85 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-md shadow-sm';
export const BTN = 'inline-block px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold text-sm shadow-md shadow-amber-500/25 transition';
export const BTN2 = 'inline-block px-5 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 text-sm font-semibold hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition';
export { CARD };

export const novelHref = (slug, no) => `/novels/${encodeURIComponent(slug)}${no ? '/' + no : ''}`;

export function coverImg(n, cls = '') {
  if (n.cover_url && /^https:\/\//.test(n.cover_url)) {
    return `<img src="${esc(n.cover_url)}" alt="ปกนิยาย ${esc(n.title)}" width="400" height="600" loading="lazy" decoding="async" class="aspect-[2/3] w-full object-cover ${cls}">`;
  }
  const ch = esc(Array.from(String(n.title || '?'))[0] || '?');
  return `<div class="aspect-[2/3] w-full flex items-center justify-center bg-gradient-to-br from-amber-500/30 to-orange-600/30 text-5xl font-bold text-amber-700 dark:text-amber-300 ${cls}" role="img" aria-label="ปกนิยาย ${esc(n.title)}">${ch}</div>`;
}

export function novelCard(n) {
  return `<a href="${novelHref(n.slug)}" class="group block ${CARD} overflow-hidden hover:border-amber-500/60 transition">
  <div class="overflow-hidden">${coverImg(n, 'group-hover:scale-[1.03] transition duration-300')}</div>
  <div class="p-3">
    <h3 class="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-amber-600 dark:group-hover:text-amber-400">${esc(n.title)}</h3>
    <p class="mt-1 text-xs text-slate-500 dark:text-neutral-400 truncate">${esc(n.display_name || '')}</p>
    <p class="mt-1 text-[11px] text-slate-400 dark:text-neutral-500">${fmtNum(n.chapter_count)} ตอน · ${esc(STATUS_TH[n.status] || '')}</p>
  </div></a>`;
}

// เนื้อหาเป็นข้อความล้วน: หนึ่งบรรทัด = หนึ่งย่อหน้า (escape ทุกครั้ง)
export function paragraphs(content) {
  return String(content || '').split(/\n+/).map((t) => t.trim()).filter(Boolean)
    .map((t) => `<p class="leading-8 text-slate-800 dark:text-neutral-200">${esc(t)}</p>`).join('\n');
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
