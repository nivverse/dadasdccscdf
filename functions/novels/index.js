// functions/novels/index.js — /novels รายการนิยาย (SSR) รองรับ ?page= และ ?category=
import { api, esc, shell, htmlResponse } from '../_lib/render.js';
import { novelCard, fmtNum, unavailable, isBroken, posInt, CARD, HEAD_BASE } from '../_lib/novel.js';

const SORTS = [['updated', 'อัปเดตล่าสุด'], ['new', 'มาใหม่'], ['popular', 'ยอดนิยม'], ['rating', 'คะแนนสูง'], ['liked', 'ถูกใจมากสุด']];

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const origin = url.origin;
  const page = Math.min(1000, posInt(url.searchParams.get('page')) || 1);
  const category = String(url.searchParams.get('category') || '').slice(0, 40);
  const sort = SORTS.some(([k]) => k === url.searchParams.get('sort')) ? url.searchParams.get('sort') : 'updated';
  const qs = (p, c, so = sort) => { const s = new URLSearchParams(); if (c) s.set('category', c); if (so !== 'updated') s.set('sort', so); if (p > 1) s.set('page', String(p)); const t = s.toString(); return '/novels' + (t ? '?' + t : ''); };

  const [data, cats] = await Promise.all([
    api(env, `/api/novel/list?page=${page}&limit=24&sort=${sort}${category ? '&category=' + encodeURIComponent(category) : ''}`),
    api(env, '/api/novel/categories'),
  ]);
  if (isBroken(data) || !Array.isArray(data.novels)) return unavailable();

  const chip = (href, label, on) => `<a href="${esc(href)}" class="shrink-0 px-3.5 py-1.5 rounded-full text-sm border transition ${on ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300 dark:border-white/15 hover:border-amber-500'}">${esc(label)}</a>`;
  const catList = Array.isArray(cats?.categories) ? cats.categories : [];
  const chips = catList.length
    ? `<nav aria-label="หมวดหมู่นิยาย" class="mt-5 flex gap-2 overflow-x-auto pb-1">${chip('/novels', 'ทั้งหมด', !category)}${catList.map((c) => chip(qs(1, c.name), c.name, c.name.toLowerCase() === category.toLowerCase())).join('')}</nav>`
    : '';

  const grid = data.novels.length
    ? `<div class="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">${data.novels.map((n, i) => novelCard(n, i)).join('')}</div>`
    : `<div class="${CARD} mt-6 p-10 text-center text-slate-500 dark:text-neutral-400">ยังไม่มีนิยายในหมวดนี้</div>`;

  const tabs = `<nav aria-label="เรียงลำดับ" class="mt-4 flex gap-2 overflow-x-auto pb-1 text-sm">${SORTS.map(([k, label]) =>
    `<a href="${esc(qs(1, category, k))}" ${k === sort ? 'aria-current="true"' : ''} class="shrink-0 px-3 py-1.5 rounded-lg transition-colors ${k === sort ? 'bg-slate-900 text-white dark:bg-white dark:text-black font-semibold' : 'text-slate-500 dark:text-neutral-400 hover:text-amber-500'}">${esc(label)}</a>`).join('')}</nav>`;

  const pager = (page > 1 || data.hasMore)
    ? `<nav class="mt-8 flex items-center justify-center gap-3 text-sm" aria-label="เปลี่ยนหน้า">
        ${page > 1 ? `<a rel="prev" href="${esc(qs(page - 1, category))}" class="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/15 hover:border-amber-500">← ก่อนหน้า</a>` : ''}
        <span class="text-slate-500 dark:text-neutral-400">หน้า ${fmtNum(page)}</span>
        ${data.hasMore ? `<a rel="next" href="${esc(qs(page + 1, category))}" class="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/15 hover:border-amber-500">ถัดไป →</a>` : ''}
      </nav>` : '';

  const title = category ? `นิยายหมวด ${category} | nivread` : 'นิยายทั้งหมด | nivread';
  const desc = category ? `รวมนิยายหมวด ${category} อ่านออนไลน์ที่ nivread` : 'รวมนิยายออนไลน์ อัปเดตตอนใหม่ทุกวัน อ่านได้ทันทีที่ nivread';
  const html = shell({
    origin, apiBase: env.API_BASE, path: qs(page, category), title, desc,
    robots: page > 1 || sort !== 'updated' ? 'noindex, follow' : 'index, follow, max-image-preview:large',
    head: HEAD_BASE,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: origin + qs(page, category), inLanguage: 'th' }],
    body: `<main class="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 z-10">
  <h1 class="text-3xl font-extrabold tracking-tight">${category ? 'นิยายหมวด ' + esc(category) : 'นิยาย'}</h1>
  <p class="text-sm text-slate-600 dark:text-neutral-400 mt-1">${fmtNum(data.total)} เรื่อง</p>
  ${chips}${tabs}${grid}${pager}
</main>
<script src="/novel-fx.js" defer></script>`,
  });
  return htmlResponse(html);
}
