// functions/category/[name].js — หน้ารวมโพสต์ตามหมวดหมู่ /category/<ชื่อหมวด>?page=N (SSR) และ ?partial=1 สำหรับเลื่อนโหลดเพิ่ม
import { api, esc, postCard, shell, htmlResponse, categoryBar, catHref } from '../_lib/render.js';

const PER_PAGE = 10;

export async function onRequestGet({ request, env, params }) {
  const url = new URL(request.url);
  const origin = url.origin;
  let name = String(params.name || '');
  try { name = decodeURIComponent(name); } catch {}
  name = name.replace(/\s+/g, ' ').trim().slice(0, 40);
  const page = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1);
  const partial = url.searchParams.get('partial') === '1';
  const base = catHref(name);

  const [data, cats] = await Promise.all([
    api(env, `/api/blog/list?page=${page}&limit=${PER_PAGE}&category=${encodeURIComponent(name)}`),
    partial ? null : api(env, '/api/blog/categories'),
  ]);
  if (!data || data.error || !data.posts) {
    return htmlResponse('<!DOCTYPE html><meta charset="utf-8"><title>ระบบขัดข้อง</title><p>ไม่สามารถโหลดโพสต์ได้ กรุณาลองใหม่</p>', 503, 'no-store');
  }

  const cards = data.posts.map((p, i) => postCard(p, origin, page === 1 && i === 0)).join('\n');
  if (partial) {
    return new Response(cards, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Has-More': data.hasMore ? '1' : '0', 'Cache-Control': 'public, max-age=0, s-maxage=60' },
    });
  }

  // ไม่มีหมวดนี้ → 404 (ไม่ให้ Google เก็บหน้าว่าง)
  if (!name || data.total === 0) {
    return htmlResponse(
      shell({
        origin, apiBase: env.API_BASE, path: base, title: 'ไม่พบหมวดหมู่ | nivread', desc: 'ไม่พบหมวดหมู่ที่ต้องการ', robots: 'noindex, follow',
        body: `<main class="flex-1 max-w-2xl w-full mx-auto px-4 py-16 z-10 text-center"><h1 class="text-2xl font-bold">ไม่พบหมวดหมู่นี้</h1><p class="mt-2 text-slate-500 dark:text-neutral-400">หมวดหมู่นี้ยังไม่มีโพสต์</p><a href="/categories" class="inline-block mt-6 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm">ดูทุกหมวดหมู่</a></main>`,
      }),
      404, 'public, max-age=60'
    );
  }

  const shownName = (cats?.categories || []).find((c) => String(c.name).toLowerCase() === name.toLowerCase())?.name || name;
  const totalPages = Math.max(1, Math.ceil(data.total / PER_PAGE));
  const path = page === 1 ? base : `${base}?page=${page}`;
  const title = page === 1 ? `${shownName} — โพสต์หมวด ${shownName} | nivread` : `${shownName} หน้า ${page} | nivread`;
  const desc = `รวมโพสต์ในหมวด "${shownName}" จาก nivread ทั้งหมด ${data.total} โพสต์ อ่านง่ายเหมือนฟีด พร้อมกดถูกใจและแสดงความคิดเห็น`;

  const jsonld = [
    {
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: origin + path,
      isPartOf: { '@type': 'WebSite', name: 'nivread', url: origin + '/' },
      mainEntity: { '@type': 'ItemList', itemListElement: data.posts.map((p, i) => ({ '@type': 'ListItem', position: (page - 1) * PER_PAGE + i + 1, url: `${origin}/posts/${p.slug}`, name: p.title })) },
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'nivread', item: origin + '/' },
        { '@type': 'ListItem', position: 2, name: 'หมวดหมู่', item: origin + '/categories' },
        { '@type': 'ListItem', position: 3, name: shownName, item: origin + base },
      ],
    },
  ];

  const links = [
    page > 1 ? `<link rel="prev" href="${origin}${page === 2 ? base : `${base}?page=${page - 1}`}">` : '',
    data.hasMore ? `<link rel="next" href="${origin}${base}?page=${page + 1}">` : '',
  ].join('\n');

  const btn = 'px-5 py-2.5 rounded-xl font-medium text-sm shadow-sm flex items-center gap-1';
  const pager = `<nav id="pagination-nav" aria-label="การนำทางหน้าโพสต์" class="flex items-center justify-center gap-4 mt-10">
    ${page > 1 ? `<a rel="prev" href="${page === 2 ? base : `${base}?page=${page - 1}`}" class="${btn} bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/20 transition-all">ก่อนหน้า</a>` : ''}
    <span class="text-sm font-semibold text-slate-700 dark:text-neutral-300 px-3">หน้า ${page} / ${totalPages}</span>
    ${data.hasMore ? `<a rel="next" href="${base}?page=${page + 1}" class="${btn} bg-gradient-to-r from-amber-500 to-orange-500 text-white transition-all shadow-md shadow-amber-500/25">ถัดไป</a>` : ''}
  </nav>`;

  const body = `<main class="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-6 z-10">
  <nav aria-label="breadcrumb" class="mb-3 text-xs text-slate-500 dark:text-neutral-400">
    <a href="/posts" class="hover:text-amber-500">โพสต์</a> / <a href="/categories" class="hover:text-amber-500">หมวดหมู่</a>
  </nav>
  <div class="mb-5 rounded-2xl p-5 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/30">
    <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">${esc(shownName)}</h1>
    <p class="mt-1 text-sm text-slate-600 dark:text-neutral-400">${data.total} โพสต์ในหมวดนี้</p>
  </div>
  ${categoryBar(cats?.categories, shownName)}
  <div id="feed" class="space-y-6" data-base="${esc(base)}" data-next-page="${data.hasMore ? page + 1 : ''}">
${cards}
  </div>
  <div id="feed-sentinel" class="h-10" aria-hidden="true"></div>
  <p id="feed-end" class="hidden text-center text-sm text-slate-500 dark:text-neutral-400 mt-4">ดูครบทุกโพสต์ในหมวดนี้แล้ว</p>
  ${pager}
</main>`;

  return htmlResponse(shell({ origin, apiBase: env.API_BASE, path, title, desc, jsonld, body, head: links, image: data.posts[0]?.cover_url }));
}
