// functions/categories.js — หน้ารวมหมวดหมู่ทั้งหมด /categories (SSR)
import { api, esc, shell, htmlResponse, catHref } from './_lib/render.js';

export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  const data = await api(env, '/api/blog/categories');
  if (!data || data.error || !data.categories) {
    return htmlResponse('<!DOCTYPE html><meta charset="utf-8"><title>ระบบขัดข้อง</title><p>กรุณาลองใหม่อีกครั้ง</p>', 503, 'no-store');
  }
  const cats = data.categories;
  const title = 'หมวดหมู่ทั้งหมด | nivread';
  const desc = 'รวมหมวดหมู่โพสต์ทั้งหมดบน nivread เลือกอ่านตามหัวข้อที่คุณสนใจ';

  const grid = cats.length
    ? `<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">${cats.map((c) => `<a href="${catHref(c.name)}" class="group rounded-2xl p-4 bg-white/85 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-amber-500/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/10 transition-all">
      <div class="font-semibold text-sm truncate group-hover:text-amber-500 transition-colors">${esc(c.name)}</div>
      <div class="mt-1 text-xs text-slate-500 dark:text-neutral-400">${c.n} โพสต์</div></a>`).join('')}</div>`
    : '<p class="text-sm text-slate-500 dark:text-neutral-400">ยังไม่มีหมวดหมู่ เมื่อมีคนใส่หมวดหมู่ในโพสต์ จะแสดงที่นี่</p>';

  const body = `<main class="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-6 z-10">
  <h1 class="text-3xl font-extrabold tracking-tight">หมวดหมู่ทั้งหมด</h1>
  <p class="mt-1 mb-6 text-sm text-slate-600 dark:text-neutral-400">เลือกอ่านตามหัวข้อที่สนใจ</p>
  ${grid}
</main>`;

  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: origin + '/categories',
    mainEntity: { '@type': 'ItemList', itemListElement: cats.slice(0, 50).map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: origin + catHref(c.name), name: c.name })) },
  }];
  return htmlResponse(shell({ origin, apiBase: env.API_BASE, path: '/categories', title, desc, jsonld, body }));
}
