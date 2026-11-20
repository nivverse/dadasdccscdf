// functions/_lib/render.js — ตัวช่วยเรนเดอร์ HTML ฝั่งเซิร์ฟเวอร์ (Cloudflare Pages Functions)
import { videoGallery } from './videos.js';
import { imageGallery, postImages } from './gallery.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// แปลงเวลา (ms / ตัวเลขในรูปข้อความ / ISO string) เป็น ISO 8601 — คืน null ถ้าไม่มีค่าหรือค่าไม่ถูกต้อง (กัน RangeError: Invalid time value)
export const isoDate = (v) => {
  if (v == null || v === '') return null;
  const d = new Date(typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export const fmtDate = (ms) => {
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok' });
};

// แท็กเวลาในการ์ด: ถ้าวันที่ใช้ไม่ได้ก็ข้ามไป (ไม่ให้ทั้งหน้าล่ม)
const timeTag = (v) => {
  const iso = isoDate(v);
  return iso ? `<time datetime="${iso}">${esc(ago(v))}</time>` : '';
};

export const catHref = (name) => `/category/${encodeURIComponent(name)}`;

// แถบเลือกหมวดหมู่ (เลื่อนซ้ายขวาได้) — active = ชื่อหมวดที่เปิดอยู่ ('' = ทั้งหมด)
export function categoryBar(cats, active = '') {
  const list = (cats || []).slice(0, 24);
  if (!list.length) return '';
  const on = 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-transparent shadow-md shadow-amber-500/25';
  const off = 'bg-white/85 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-neutral-300 hover:border-amber-500/60 hover:text-amber-600 dark:hover:text-amber-400';
  const chip = (href, label, n, isOn) => `<a href="${href}"${isOn ? ' aria-current="page"' : ''} class="whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${isOn ? on : off}">${label}${n != null ? ` <span class="opacity-60 text-xs">${n}</span>` : ''}</a>`;
  const act = String(active).toLowerCase();
  return `<nav aria-label="หมวดหมู่" class="mb-5 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto" style="scrollbar-width:none">
  <div class="flex gap-2 w-max sm:w-auto sm:flex-wrap">
    ${chip('/posts', 'ทั้งหมด', null, !active)}
    ${list.map((c) => chip(catHref(c.name), esc(c.name), c.n, String(c.name).toLowerCase() === act)).join('\n    ')}
    <a href="/categories" class="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-amber-600 dark:text-amber-400 hover:opacity-70">ดูทุกหมวด →</a>
  </div>
</nav>`;
}

export function ago(ms) {
  if (Number.isNaN(Date.now() - ms)) return '';
  const s = Math.max(1, ((Date.now() - ms) / 1000) | 0);
  if (s < 60) return 'เมื่อสักครู่';
  const m = (s / 60) | 0; if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = (m / 60) | 0; if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  const d = (h / 24) | 0; if (d < 7) return `${d} วันที่แล้ว`;
  return fmtDate(ms);
}

export async function api(env, path) {
  const base = String(env.API_BASE || '').replace(/\/+$/, '');
  if (!base) { console.error('[api] API_BASE not set'); return { error: 'API_BASE not set' }; }
  let last = 'unknown';
  for (let i = 0; i < 2; i++) { // ลองซ้ำ 1 ครั้งเมื่อเป็น 5xx / 429 / เชื่อมต่อไม่ได้
    const t0 = Date.now();
    try {
      const r = await fetch(base + path, { cf: { cacheTtl: 60, cacheEverything: true } });
      if (r.status === 404) return { notFound: true };
      if (r.ok) {
        try { return await r.json(); }
        catch (e) { last = 'bad json: ' + String(e.message || e); break; }
      }
      let body = ''; try { body = (await r.text()).replace(/\s+/g, ' ').slice(0, 200); } catch {}
      last = `api ${r.status}`;
      console.error(`[api] ${path.split('?')[0]} -> ${r.status} (try ${i + 1}, ${Date.now() - t0}ms, cf-ray=${r.headers.get('cf-ray') || '-'}) ${body}`);
      if (r.status < 500 && r.status !== 429) break; // 4xx อื่นๆ ไม่ต้องลองซ้ำ
    } catch (e) {
      last = String(e.message || e);
      console.error(`[api] ${path.split('?')[0]} fetch failed (try ${i + 1}, ${Date.now() - t0}ms): ${last}`);
    }
    if (i === 0) await new Promise((res) => setTimeout(res, 150));
  }
  console.error(`[api] giving up: ${path.split('?')[0]} (${last})`);
  return { error: last };
}

const ICON = {
  heart: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>',
  chat: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>',
  repost: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 1l4 4-4 4"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 11V9a4 4 0 014-4h14"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 23l-4-4 4-4"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13v2a4 4 0 01-4 4H3"/>',
  eye: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>',
  share: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>',
};
const icon = (n) => `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

export function avatar(p, size = 'w-11 h-11') {
  const name = p.display_name || 'nivread';
  return p.avatar_url
    ? `<img src="${esc(p.avatar_url)}" alt="${esc(name)}" width="44" height="44" loading="lazy" referrerpolicy="no-referrer" class="${size} rounded-full object-cover ring-2 ring-amber-500/40">`
    : `<div class="${size} rounded-full bg-gradient-to-br from-amber-500 to-orange-500 grid place-items-center text-white font-bold" aria-hidden="true">${esc(name.charAt(0).toUpperCase())}</div>`;
}

// ปุ่มติดตาม (ผู้ใช้/หมวดหมู่) — สถานะ/คลิกจัดการโดย /nivread.js ทั้งเว็บ (variant: link | pill | chip)
export function followBtn(type, target, variant = 'link', label = '') {
  return `<button type="button" class="fb fb-${variant}" data-follow-type="${type}" data-follow-target="${esc(target)}"${label ? ` data-follow-name="${esc(label)}"` : ''} aria-pressed="false"${variant === 'plus' ? ` title="ติดตาม" aria-label="ติดตาม ${esc(label || target)}"` : ''}>${variant === 'plus' ? '+' : 'ติดตาม'}</button>`;
}

// CSS ปุ่มติดตาม (ฝังใน <head> กันปุ่มกระพริบก่อนโหลด nivread.js — ชุดเดียวกับใน nivread.js)
export const FBCSS = `.fb{cursor:pointer;font-weight:600;transition:color .2s,background .2s,border-color .2s,opacity .2s;white-space:nowrap}
.fb[hidden]{display:none}
.fb-link{font-size:.75rem;color:#d97706;padding:.1rem .45rem;border-radius:999px}
.fb-link:hover{background:rgba(245,158,11,.14)}
.fb-link[aria-pressed=true]{color:#94a3b8;font-weight:500}
.fb-pill{padding:.5rem 1.1rem;border-radius:.75rem;font-size:.875rem;color:#fff;background:linear-gradient(to right,#f59e0b,#f97316);box-shadow:0 6px 16px -6px rgba(245,158,11,.55)}
.fb-pill:hover{filter:brightness(1.08)}
.fb-pill[aria-pressed=true]{background:transparent;color:#64748b;border:1px solid rgba(148,163,184,.55);box-shadow:none}
.fb-chip{padding:.3rem .8rem;border-radius:999px;font-size:.8rem;color:#d97706;border:1px solid rgba(245,158,11,.4);background:rgba(245,158,11,.08)}
.fb-chip[aria-pressed=true]{color:#fff;border-color:transparent;background:linear-gradient(to right,#f59e0b,#f97316)}
.fb-plus{display:inline-flex;align-items:center;justify-content:center;height:1.5rem;padding:0 .2rem;margin-left:.1rem;border:0;background:none;font-size:1.6rem;font-weight:500;line-height:1;color:#d97706;flex-shrink:0}
.fb-plus:hover{color:#f59e0b}
.fb[disabled]{opacity:.6;cursor:default}`;

function postHead(p) {
  const profile = p.author_id ? `/user?id=${encodeURIComponent(p.author_id)}` : '';
  const who = esc(p.display_name || 'nivread');
  return `<div class="flex items-center gap-3 p-4">
    ${profile ? `<a href="${profile}" class="flex-shrink-0" aria-label="โปรไฟล์ ${who}">${avatar(p)}</a>` : avatar(p)}
    <div class="min-w-0">
      ${profile
        ? `<div class="flex items-center gap-1 min-w-0"><a href="${profile}" class="font-semibold text-sm text-slate-900 dark:text-white truncate hover:text-amber-500">${who}</a></div>`
        : `<div class="font-semibold text-sm text-slate-900 dark:text-white truncate">${who}</div>`}
      <div class="text-xs text-slate-500 dark:text-neutral-400">
        ${timeTag(p.published_at || p.updated_at)}
        ${p.category ? `<a href="${catHref(p.category)}" class="ml-2 text-amber-600 dark:text-amber-400 hover:text-amber-500 transition-colors">${esc(p.category)}</a>` : ''}
      </div>
    </div>
    ${p.author_id && p.slug ? `<a href="/write?edit=${encodeURIComponent(p.slug)}" data-edit-post data-author="${esc(p.author_id)}" class="hidden ml-auto flex-shrink-0 w-9 h-9 place-items-center rounded-full text-slate-500 dark:text-neutral-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors" aria-label="แก้ไขโพสต์" title="แก้ไขโพสต์"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg></a>` : ''}
  </div>`;
}

function postBar(p, origin) {
  const href = `/posts/${p.slug}`;
  const btn = 'inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-xl text-sm font-medium text-slate-500 dark:text-neutral-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 transition-colors';
  return `<div class="px-2 sm:px-3 py-2 flex items-center justify-between gap-1 border-t border-slate-200 dark:border-white/10">
      <div class="flex flex-wrap items-center gap-x-0.5 sm:gap-x-1 min-w-0">
        <button type="button" data-like="${esc(p.slug)}" class="${btn}" aria-pressed="false" aria-label="ถูกใจ" title="ถูกใจ">${icon('heart')}<span data-like-count="${esc(p.slug)}" class="tabular-nums">${p.like_count || 0}</span></button>
        <a href="${href}#comments" class="${btn}" aria-label="ความคิดเห็น" title="ความคิดเห็น">${icon('chat')}<span class="tabular-nums">${p.comment_count || 0}</span></a>
        <button type="button" data-repost="${esc(p.slug)}" data-author="${esc(p.author_id || '')}" class="${btn}" aria-pressed="false" aria-label="รีโพสต์" title="รีโพสต์">${icon('repost')}<span data-repost-count="${esc(p.slug)}" class="tabular-nums">${p.repost_count || 0}</span></button>
        ${p.view_count != null ? `<span class="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 text-sm font-medium text-slate-500 dark:text-neutral-400" title="ยอดวิว" aria-label="ยอดวิว ${Number(p.view_count || 0)}">${icon('eye')}<span class="tabular-nums">${Number(p.view_count || 0).toLocaleString('th-TH')}</span></span>` : ''}
      </div>
      <button type="button" data-share data-url="${esc(origin + href)}" data-title="${esc(p.title)}" class="${btn} flex-shrink-0" aria-label="แชร์" title="แชร์">${icon('share')}</button>
    </div>`;
}

// รีโพสต์: ห่อการ์ดต้นฉบับด้วยหัว "ใครรีโพสต์" + ข้อความของผู้รีโพสต์ (ถ้ามี) — หน้าตาเดียวกับ NIV.repostWrap() ฝั่งเบราว์เซอร์ใน nivread.js
// p.repost = { by, by_name, by_avatar, at, note, others } · viewerId = ผู้ที่กำลังดู (ถ้าเป็นเจ้าของโพสต์ จะขึ้นว่า "รีโพสต์โพสต์ของคุณ")
export function repostWrap(p, innerHtml, viewerId = '') {
  const r = p.repost;
  if (!r || !r.by) return innerHtml;
  const who = esc(r.by_name || r.by);
  const profile = `/user?id=${encodeURIComponent(r.by)}`;
  const what = viewerId && p.author_id === viewerId ? 'รีโพสต์โพสต์ของคุณ' : 'รีโพสต์';
  const more = r.others > 0 ? ` และอีก ${Number(r.others)} คน` : '';
  return `<div class="rp-card rounded-2xl border border-orange-500/25 bg-gradient-to-b from-orange-500/[0.07] to-transparent overflow-hidden shadow-sm">
  <div class="rp-bar"></div>
  <div class="flex items-center gap-2.5 px-4 pt-3">
    <a href="${profile}" class="relative flex-shrink-0" aria-label="โปรไฟล์ ${who}">${avatar({ display_name: r.by_name || r.by, avatar_url: r.by_avatar }, 'w-9 h-9')}<span class="rp-badge" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${ICON.repost}</svg></span></a>
    <div class="min-w-0 text-sm text-slate-600 dark:text-neutral-300 leading-tight"><a href="${profile}" class="font-semibold text-slate-900 dark:text-white hover:text-amber-500">${who}</a> ${what}${more} <span class="text-xs text-slate-400 dark:text-neutral-500">· ${esc(ago(r.at))}</span></div>
  </div>
  ${r.note ? `<p class="rp-note px-4 pt-2 text-[15px] leading-relaxed text-slate-800 dark:text-neutral-100 whitespace-pre-line break-words">${esc(r.note)}</p>` : ''}
  <div class="p-3">${innerHtml}</div>
</div>`;
}

// การ์ดโพสต์ในฟีด (สไตล์ Facebook) — ลิงก์ <a href> จริงทุกโพสต์ให้ Google ตามเก็บได้
export function postCard(p, origin, first = false, viewerId = '') {
  return repostWrap(p, cardHtml(p, origin, first), viewerId);
}
function cardHtml(p, origin, first = false) {
  const href = `/posts/${p.slug}`;
  if (isCharacter(p)) return charCardHtml(p, origin, first, href);
  return `<article data-view-slug="${esc(p.slug)}" class="rounded-2xl bg-white/85 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-md shadow-sm overflow-hidden">
  ${postHead(p)}
  <div class="px-4 pb-3">
    <h2 class="text-lg font-bold text-slate-900 dark:text-white leading-snug"><a href="${href}" class="hover:text-amber-500 transition-colors">${esc(p.title)}</a></h2>
    ${p.excerpt ? `<p class="mt-1 text-sm text-slate-600 dark:text-neutral-300 line-clamp-3"><a href="${href}" class="block hover:text-amber-500 transition-colors">${esc(p.excerpt)}</a></p>` : ''}
    ${(p.content_len || 0) > 160 ? `<a href="${href}" class="inline-block mt-1 px-2 -ml-2 text-lg leading-none tracking-widest text-amber-600 dark:text-amber-400 hover:text-amber-500" aria-label="อ่านโพสต์ต่อ" title="อ่านโพสต์ต่อ">...</a>` : ''}
    ${(p.lock_count || 0) > 0 ? `<div class="mt-2"><a href="${href}" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors">🔒 มีเนื้อหาที่ถูกล็อก${Number(p.lock_count) > 1 ? ' ' + Number(p.lock_count) + ' กล่อง' : ''} · กดเพื่อปลดล็อก</a></div>` : ''}
  </div>
  ${(p.videos && p.videos.length) ? videoGallery(p.videos, p.title, true, first, href) : imageGallery(postImages(p), p.title, first, href)}
  ${postBar(p, origin)}
</article>`;
}

// ---------- ตัวละคร: ข้อมูลต่อตัว (ใช้ร่วมกันทั้งฟีดและหน้าโพสต์เดี่ยว) ----------
// meta ใหม่: { kind:'character', characters:[{ name, orig, role, gender, age, cv, desc, credit, image }] }
// meta เก่า (ตัวเดียว): { kind:'character', orig, role, gender, age, credit } → ชื่อ = หัวข้อโพสต์ รูป = รูปแรกของโพสต์
// รูปของตัวละครอ่านจาก c.image ก่อน (ผูกกับตัวละครตรง ๆ) ถ้าไม่มี (โพสต์ที่สร้างก่อนหน้านี้) ค่อยใช้ลำดับรูปของโพสต์
const CHAR_IMG = /^https:\/\/[^\s"'<>]{4,500}$/;
export function charList(p) {
  const m = postMeta(p) || {};
  const multi = Array.isArray(m.characters) && m.characters.length > 0;
  const raw = multi ? m.characters.slice(0, 100) : [m];
  const imgs = postImages(p, 100);
  return raw.map((c, i) => {
    c = c && typeof c === 'object' ? c : {};
    const own = typeof c.image === 'string' && CHAR_IMG.test(c.image) ? c.image : '';
    const fallback = multi ? (imgs[i] || (i === 0 ? p.cover_url : '') || '') : (imgs[0] || p.cover_url || '');
    return {
      name: metaText(c.name, 150) || (multi ? `ตัวละครที่ ${i + 1}` : metaText(p.title, 150)),
      orig: metaText(c.orig, 80), role: metaText(c.role, 80), gender: metaText(c.gender, 40), age: metaText(c.age, 40),
      cv: metaText(c.cv, 80), desc: metaText(c.desc, 1200), credit: c.credit,
      image: CHAR_IMG.test(own || fallback) ? (own || fallback) : '',
    };
  });
}
const CHEV = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

// การ์ดตัวละครในฟีด (สไตล์เดียวกับ X): แถวรูปเลื่อนแนวนอน เห็นรูปถัดไปโผล่ขอบขวา ปัดนิ้วหรือกดลูกศรได้
// แถวเลื่อนอยู่ "ในการ์ด" (overflow-x ของแถวเอง · การ์ดยัง overflow-hidden) จึงไม่ล้นการ์ด · สไตล์อยู่ที่ /niv.css (.cx-*) · ลูกศรอยู่ที่ /nivread.js
// ลิงก์ <a href> จริงทุกสไลด์ (พาไปหน้าโพสต์ตรงตัวละครนั้น #cN) ให้ Google ตามเก็บได้
// ฟีดแสดงแค่ที่จำเป็น: รูป + ชื่อ + เลขลำดับ · จำกัด FEED_MAX สไลด์ (ที่เหลือรวมเป็นสไลด์ "ดูทั้งหมด +N") · ข้อมูลเต็มดูที่หน้าโพสต์เดี่ยว
const FEED_MAX = 8;
function charCardHtml(p, origin, first, href) {
  const full = charList(p);
  const total = full.length;
  const list = full.slice(0, FEED_MAX);
  const slides = list.map((c, i) => {
    const pic = c.image
      ? `<img class="cx-img" src="${esc(c.image)}" alt="${esc(c.name)}${p.category ? ' - ' + esc(p.category) : ''}" loading="${first && i === 0 ? 'eager' : 'lazy'}" decoding="async" draggable="false">`
      : '<span class="cx-noimg">ไม่มีรูป</span>';
    return `<a href="${href}#c${i + 1}" class="cx-slide" aria-label="${esc(c.name)}"><span class="cx-frame">${pic}<span class="cx-shade"></span>${total > 1 ? `<span class="cx-idx">${i + 1}/${total}</span>` : ''}<span class="cx-cap"><b>${esc(c.name)}</b></span></span></a>`;
  }).join('') + (total > list.length ? `<a href="${href}" class="cx-slide" aria-label="ดูตัวละครทั้งหมด"><span class="cx-frame cx-rest">+${total - list.length}<br>ดูทั้งหมด</span></a>` : '');
  const multi = total > 1;
  const nav = multi ? `<button type="button" class="cx-nav cx-prev" aria-label="ตัวละครก่อนหน้า" hidden>${CHEV('M15 5l-7 7 7 7')}</button><button type="button" class="cx-nav cx-next" aria-label="ตัวละครถัดไป">${CHEV('M9 5l7 7-7 7')}</button>` : '';
  return `<article data-view-slug="${esc(p.slug)}" class="rounded-2xl bg-white/85 dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
  ${postHead(p)}
  <div class="px-4 pb-3">
    <h2 class="text-lg font-bold text-slate-900 dark:text-white leading-snug"><a href="${href}" class="hover:text-amber-500 transition-colors">${esc(p.title)}</a></h2>
    ${p.excerpt ? `<p class="mt-1 text-sm text-slate-600 dark:text-neutral-300 line-clamp-2"><a href="${href}" class="block hover:text-amber-500 transition-colors">${esc(p.excerpt)}</a></p>` : ''}
  </div>
  <div class="cx-feed${multi ? ' cx-multi' : ''}"><div class="cx-track" role="region" aria-label="ตัวละครในโพสต์ ปัดเพื่อดูตัวถัดไป">${slides}</div>${nav}</div>
  ${postBar(p, origin)}
</article>`;
}

// หน้าโพสต์เดี่ยวสไตล์เว็บตัวละครทางการ: แถบเลือกตัวละคร (roster) → แผงโปรไฟล์ใหญ่ รูปแนวตั้ง + ชื่อ + ชื่อต้นฉบับตัวใหญ่ + ตารางข้อมูล + เรื่องราว
// สลับตัวละครด้วย radio + label ล้วน (ไม่ต้องใช้ JS) · /posts/slug#c3 เปิดตัวที่ 3 ได้ด้วยสคริปต์เล็ก ๆ ท้ายส่วนนี้ · สไตล์ถาวรอยู่ที่ /niv.css (.cs-*)
export function characterCarousel(p, eager = true) {
  const list = charList(p);
  const n = list.length;
  if (!n) return '';
  const id = (i) => `cz-${i + 1}`;
  const pad = (i) => String(i + 1).padStart(2, '0');
  const sel = list.map((_, i) => `#${id(i)}:checked~.cs-stage .cs-p${i + 1}`).join(',');
  const css = `<style>${sel}{display:block}@media(min-width:768px){${sel}{display:grid}}
${list.map((_, i) => `#${id(i)}:checked~.cs-roster label[for="${id(i)}"] .cs-thi{border-color:#f59e0b;opacity:1;transform:translateY(-3px);box-shadow:0 8px 20px -8px rgba(245,158,11,.7)}
#${id(i)}:checked~.cs-roster label[for="${id(i)}"] small{color:#f59e0b;font-weight:600}
#${id(i)}:focus-visible~.cs-roster label[for="${id(i)}"] .cs-thi{outline:2px solid #f59e0b;outline-offset:2px}`).join('\n')}</style>`;
  const radios = list.map((_, i) => `<input type="radio" name="cz" id="${id(i)}" class="cs-r" aria-label="ตัวละครที่ ${i + 1}"${i === 0 ? ' checked' : ''}>`).join('');
  const roster = n > 1 ? `<nav class="cs-roster" aria-label="เลือกตัวละคร">${list.map((c, i) =>
    `<label for="${id(i)}" class="cs-th" title="${esc(c.name)}"><span class="cs-thi">${c.image ? `<img src="${esc(c.image)}" alt="" loading="${i < 6 ? 'eager' : 'lazy'}" decoding="async">` : ''}</span><small>${esc(c.name)}</small></label>`).join('')}</nav>` : '';
  const arrow = (side, target, label, d) => `<label for="${target}" role="button" aria-label="${label}" class="cs-arrow cs-a${side}">${CHEV(d)}</label>`;
  const panels = list.map((c, i) => {
    const pic = c.image
      ? `<img src="${esc(c.image)}" alt="${esc(c.name)}${p.category ? ' - ' + esc(p.category) : ''}" ${eager && i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`
      : '<span class="cs-noimg">ไม่มีรูป</span>';
    const credit = creditHtml(c.credit);
    const rows = [['บทบาท', c.role], ['เพศ', c.gender], ['อายุ', c.age], ['CV', c.cv]].filter(([, v]) => v)
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
    return `<div class="cs-p cs-p${i + 1}" data-c="${i + 1}">
  <div class="cs-fig"><div class="cs-pic">${pic}<span class="cs-num" aria-hidden="true">${pad(i)}</span>
    ${n > 1 && i > 0 ? arrow('l', id(i - 1), 'ตัวละครก่อนหน้า', 'M15 5l-7 7 7 7') : ''}${n > 1 && i < n - 1 ? arrow('r', id(i + 1), 'ตัวละครถัดไป', 'M9 5l7 7-7 7') : ''}
  </div>${credit ? `<p class="cs-credit">เครดิตภาพ: ${credit}</p>` : ''}</div>
  <div class="cs-info">
    <span class="cs-wm" aria-hidden="true">${esc(c.orig || c.name)}</span>
    <p class="cs-eyebrow">CHARACTER${n > 1 ? ` · ${pad(i)} / ${pad(n - 1)}` : ''}</p>
    <h2 class="cs-name">${esc(c.name)}</h2>
    ${c.orig ? `<p class="cs-orig">${esc(c.orig)}</p>` : ''}
    ${rows ? `<dl class="cs-dl">${rows}</dl>` : ''}
    ${c.desc ? `<div class="cs-desc"><h3>PROFILE</h3><p>${esc(c.desc)}</p></div>` : ''}
  </div>
</div>`;
  }).join('');
  // เปิดตัวละครตาม #cN (ลิงก์จากฟีด) และตามเมื่อ hash เปลี่ยน
  const js = n > 1 ? `<script>(function(){function go(){var m=/^#c(\\d{1,3})$/.exec(location.hash);if(!m)return;var r=document.getElementById('cz-'+m[1]);if(r)r.checked=true;}go();addEventListener('hashchange',go);})();</script>` : '';
  return `${css}<section class="cs" aria-label="ตัวละคร">${radios}${roster}<div class="cs-stage">${panels}</div></section>${js}`;
}

export { postBar, postHead };

// ธีมเทศกาล: ตัดสินและโหลดฝั่งเบราว์เซอร์โดย /festival.js (ช่วงวันที่อยู่ที่ public/festival.js ที่เดียว)

export function shell({ origin, apiBase, path, title, desc, image, jsonld = [], body, robots = 'index, follow, max-image-preview:large', type = 'website', head = '' }) {
  const canonical = origin + path;
  const img = image || `${origin}/og-image.jpg?v=20261120`;
  const ld = jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n');
  return `<!DOCTYPE html>
<html lang="th" class="dark">
<head>
<meta charset="UTF-8">
<script src="/i18n.js"></script>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${robots}">
<meta name="author" content="nivread">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="/favicon.ico?v=20261120" sizes="any">
<link rel="icon" href="/img/icon-48.png?v=20261120" type="image/png" sizes="48x48">
<link rel="icon" href="/img/icon-192.png?v=20261120" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png?v=20261120">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#0d0d0d">
<meta name="api-base" content="${esc(apiBase)}">
<meta property="og:site_name" content="nivread">
<meta property="og:type" content="${type}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:locale" content="th_TH">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
${head}
${ld}
<script>
  if (localStorage.getItem('theme') === 'light') document.documentElement.classList.remove('dark');
  else document.documentElement.classList.add('dark');
</script>
<script src="https://cdn.tailwindcss.com"></script>
<script>tailwind.config = { darkMode: 'class' }</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>body{font-family:'Kanit',sans-serif}.uv,.uv.bp{padding:0!important;background:transparent!important;border:0!important;box-shadow:none!important}.uv video{background:transparent!important;border:0!important}</style>
<link id="niv-css" rel="stylesheet" href="/niv.css?v=20261120i">
</head>
<body class="bg-[#f3f4f6] text-slate-900 dark:bg-[#0d0d0d] dark:text-white transition-colors duration-300 min-h-screen flex flex-col relative overflow-x-hidden">
<div class="fixed inset-0 pointer-events-none z-0">
  <div class="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/20 opacity-30 dark:opacity-100 rounded-full blur-[128px]"></div>
  <div class="absolute top-1/2 -right-40 w-96 h-96 bg-orange-500/20 opacity-30 dark:opacity-100 rounded-full blur-[128px]"></div>
</div>
<header id="main-header" class="z-20"></header>
${body}
<script src="/nivread.js?v=20261120i"></script>
<script src="/posts-feed.js" defer></script>
</body>
</html>`;
}

export const htmlResponse = (html, status = 200, cache = 'public, max-age=0, s-maxage=300, stale-while-revalidate=600') =>
  new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache } });


// ======================= ข้อมูลตัวละคร (ใช้เฉพาะหน้าโพสต์เดี่ยว) =======================
// เพิ่มใหม่ล้วน ๆ ไม่แก้ฟังก์ชันเดิม · โพสต์ทั่วไปไม่มี meta → postMeta() = null / characterInfo() = '' จึงไม่กระทบอะไร
// p.meta = { kind: 'character', orig, role, gender, age, credit } (ออบเจ็กต์ หรือสตริง JSON ก็ได้)
// จากเรื่อง = p.category (ใช้ช่องหมวดหมู่เดิม) · รูป/เรื่องย่อ = รูปและเนื้อหาของโพสต์ตามปกติ
const CHAR_FIELDS = [['orig', 'ชื่อต้นฉบับ'], ['role', 'บทบาท'], ['gender', 'เพศ'], ['age', 'อายุ']];
const metaText = (v, n = 80) => String(v ?? '').trim().slice(0, n);

export function postMeta(p) {
  let m = p && p.meta;
  if (typeof m === 'string') { try { m = JSON.parse(m); } catch { m = null; } }
  return m && typeof m === 'object' && m.kind === 'character' ? m : null;
}
export const isCharacter = (p) => !!postMeta(p);

// เครดิตภาพ: ถ้าเป็นลิงก์ http(s) ทำเป็นลิงก์ (nofollow) ไม่งั้นแสดงเป็นข้อความ
function creditHtml(raw) {
  const t = metaText(raw, 200);
  if (!t) return '';
  try {
    const u = new URL(t);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return `<a href="${esc(u.href)}" target="_blank" rel="nofollow noopener noreferrer ugc" class="text-amber-600 dark:text-amber-400 hover:text-amber-500 break-all">${esc(u.hostname.replace(/^www\./, ''))}</a>`;
    }
  } catch {}
  return esc(t);
}

// รูปภาพตัวละคร: รูปหลักสัดส่วนแนวตั้ง 4:5 ตรงกลาง + แถบรูปย่อ (ถ้ามีหลายรูป) · ไม่มีรูปเลยคืน '' (โพสต์ทั่วไปไม่ใช้ฟังก์ชันนี้)
export function characterHero(images, cover, title) {
  const srcs = [...(Array.isArray(images) ? images : []), cover]
    .map((x) => (typeof x === 'string' ? x : x && x.url))
    .filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u) || (typeof u === 'string' && u.startsWith('/')));
  const uniq = [...new Set(srcs)].slice(0, 5);
  if (!uniq.length) return '';
  const alt = esc(String(title || '').slice(0, 120));
  const main = `<figure class="px-4 pt-4"><div class="mx-auto w-full max-w-[360px] aspect-[4/5] overflow-hidden rounded-2xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10"><img src="${esc(uniq[0])}" alt="${alt}" class="w-full h-full object-cover" loading="eager" decoding="async"></div>`;
  const thumbs = uniq.length > 1 ? `<ul class="mx-auto mt-3 max-w-[360px] flex gap-2 overflow-x-auto" aria-label="รูปเพิ่มเติม">${uniq.map((u, k) => `<li class="flex-shrink-0"><a href="${esc(u)}" target="_blank" rel="noopener" class="block w-12 h-12 overflow-hidden rounded-lg border ${k ? 'border-slate-200 dark:border-white/10' : 'border-amber-500'}"><img src="${esc(u)}" alt="" class="w-full h-full object-cover" loading="lazy" decoding="async"></a></li>`).join('')}</ul>` : '';
  return main + thumbs + '</figure>';
}

// กล่องข้อมูลตัวละคร (ตามแบบ): ชื่อต้นฉบับ · จากเรื่อง / แถวบทบาท-เพศ-อายุ / เครดิตภาพ · วางต่อจากรูปหลัก
export function characterInfo(p) {
  const m = postMeta(p);
  if (!m) return '';
  const sub = [];
  const orig = metaText(m.orig);
  if (orig) sub.push(esc(orig));
  if (p.category) sub.push(`จาก <a href="${catHref(p.category)}" class="font-medium text-amber-600 dark:text-amber-400 hover:text-amber-500">${esc(p.category)}</a>`);
  const rows = [];
  [['role', 'บทบาท'], ['gender', 'เพศ'], ['age', 'อายุ']].forEach(([k, label]) => { const v = metaText(m[k]); if (v) rows.push([label, esc(v)]); });
  const credit = creditHtml(m.credit);
  if (!sub.length && !rows.length && !credit) return '';
  return `<section aria-label="ข้อมูลตัวละคร" class="mx-4 mt-4 rounded-2xl bg-white/85 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-md shadow-sm px-4 py-3">
  ${sub.length ? `<p class="text-xs text-slate-500 dark:text-neutral-400">${sub.join(' · ')}</p>` : ''}
  ${rows.length ? `<dl class="mt-2 text-sm">${rows.map(([k, v]) => `<div class="flex items-baseline justify-between gap-4 py-2 border-t border-slate-200 dark:border-white/10"><dt class="text-slate-500 dark:text-neutral-400">${k}</dt><dd class="font-medium text-slate-900 dark:text-white text-right min-w-0 break-words">${v}</dd></div>`).join('')}</dl>` : ''}
  ${credit ? `<p class="mt-2 text-xs text-slate-500 dark:text-neutral-400">เครดิตภาพ: ${credit}</p>` : ''}
</section>`;
}