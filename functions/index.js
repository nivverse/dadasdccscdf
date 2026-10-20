// functions/index.js — หน้าแรก nivread.com ("ฟีดของฉัน")
//  • ทุกคน/Google: SSR โพสต์ล่าสุด (มี canonical ของตัวเอง) + กล่องชวนกดติดตาม
//  • สมาชิกที่ติดตามอะไรไว้: /home-feed.js สลับเป็นฟีดจากผู้ใช้/หมวดที่ติดตาม (เรนเดอร์ HTML จากเซิร์ฟเวอร์ผ่าน ?feed=1)
//  • ?partial=1 = ชิ้นส่วนโพสต์ล่าสุดสำหรับเลื่อนโหลดเพิ่ม
import { api, esc, postCard, shell, htmlResponse, followBtn, catHref } from './_lib/render.js';

const PER_PAGE = 10;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const origin = url.origin;
  const page = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1);

  // ---------- ฟีดส่วนตัว (ส่ง Bearer token ต่อให้ Worker ตรวจ) ----------
  if (url.searchParams.get('feed') === '1') {
    const userId = String(url.searchParams.get('userId') || '').slice(0, 60);
    const auth = request.headers.get('Authorization') || '';
    const noStore = { 'Cache-Control': 'private, no-store' };
    if (!userId || !auth) return new Response('', { status: 401, headers: noStore });
    const base = String(env.API_BASE || '').replace(/\/+$/, '');
    let d = null, status = 0;
    try {
      const r = await fetch(`${base}/api/blog/feed?userId=${encodeURIComponent(userId)}&page=${page}&limit=${PER_PAGE}`, { headers: { Authorization: auth } });
      status = r.status;
      d = await r.json();
    } catch {}
    if (!d || !d.success) return new Response('', { status: status === 401 ? 401 : 502, headers: noStore });
    const html = (d.posts || []).map((p) => postCard(p, origin, false)).join('\n');
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Has-More': d.hasMore ? '1' : '0',
        'X-Follow-Count': String(d.followCount || 0),
        ...noStore,
      },
    });
  }

  const partial = url.searchParams.get('partial') === '1';
  const [data, cats] = await Promise.all([
    api(env, `/api/blog/list?page=${page}&limit=${PER_PAGE}`),
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

  if (page > 1 && data.posts.length === 0) {
    return htmlResponse('<!DOCTYPE html><meta charset="utf-8"><meta name="robots" content="noindex"><title>ไม่พบหน้านี้</title><p>ไม่พบหน้านี้ <a href="/">กลับหน้าแรก</a></p>', 404, 'public, max-age=60');
  }

  const totalPages = Math.max(1, Math.ceil(data.total / PER_PAGE));
  const path = page === 1 ? '/' : `/?page=${page}`;
  const title = page === 1 ? 'nivread — ฟีดบทความ ข่าว และเรื่องเล่าวงการอนิเมะ' : `nivread — โพสต์ล่าสุด หน้า ${page}`;
  const desc = 'nivread ชุมชนนักอ่านและนักเขียน กดติดตามผู้เขียนและหมวดหมู่ที่ชอบ แล้วอ่านฟีดของคุณได้ทุกวัน พร้อมเขียนโพสต์แชร์เรื่องราวได้ฟรี';

  const jsonld = [
    {
      '@context': 'https://schema.org', '@type': 'WebSite', name: 'nivread', url: origin + '/',
      potentialAction: { '@type': 'SearchAction', target: `${origin}/search?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
    },
    {
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: origin + path,
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: data.posts.map((p, i) => ({ '@type': 'ListItem', position: (page - 1) * PER_PAGE + i + 1, url: `${origin}/posts/${p.slug}`, name: p.title })),
      },
    },
  ];

  const links = [
    page > 1 ? `<link rel="prev" href="${origin}${page === 2 ? '/' : `/?page=${page - 1}`}">` : '',
    data.hasMore ? `<link rel="next" href="${origin}/?page=${page + 1}">` : '',
  ].join('\n');

  const btn = 'px-5 py-2.5 rounded-xl font-medium text-sm shadow-sm flex items-center gap-1';
  const pager = `<nav id="pagination-nav" aria-label="การนำทางหน้าโพสต์" class="flex items-center justify-center gap-4 mt-10">
    ${page > 1 ? `<a rel="prev" href="${page === 2 ? '/' : `/?page=${page - 1}`}" class="${btn} bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/20 transition-all">ก่อนหน้า</a>` : ''}
    <span class="text-sm font-semibold text-slate-700 dark:text-neutral-300 px-3">หน้า ${page} / ${totalPages}</span>
    ${data.hasMore ? `<a rel="next" href="/?page=${page + 1}" class="${btn} bg-gradient-to-r from-amber-500 to-orange-500 text-white transition-all shadow-md shadow-amber-500/25">ถัดไป</a>` : ''}
  </nav>`;

  const topCats = (cats?.categories || []).slice(0, 10);
  const prompt = page === 1 ? `<section id="follow-prompt" class="mb-6 rounded-2xl p-5 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/30">
    <h2 class="text-lg font-bold">ทำให้หน้าแรกเป็นของคุณ</h2>
    <p class="mt-1 text-sm text-slate-600 dark:text-neutral-400">กดติดตามผู้เขียนหรือหมวดหมู่ที่สนใจ โพสต์ใหม่จะมารวมกันที่หน้านี้</p>
    ${topCats.length ? `<div class="mt-3 flex flex-wrap gap-2">${topCats.map((c) => followBtn('category', c.name, 'chip', c.name)).join('')}</div>` : ''}
    <p class="mt-3 text-sm"><a href="/search" class="font-semibold text-amber-600 dark:text-amber-400 hover:opacity-70">ค้นหาผู้เขียนที่น่าสนใจ →</a>
      ${topCats.length ? ` <span class="text-slate-400">·</span> ${topCats.slice(0, 3).map((c) => `<a href="${catHref(c.name)}" class="text-slate-500 dark:text-neutral-400 hover:text-amber-500">${esc(c.name)}</a>`).join(' · ')}` : ''}</p>
  </section>` : '';

  const body = `<main class="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-6 z-10">
  <h1 class="sr-only">nivread — ฟีดบทความและโพสต์ล่าสุด</h1>
  <div id="composer" class="mb-6" data-composer></div>
  ${prompt}
  <div id="my-feed" class="hidden">
    <div class="mb-4 flex items-center justify-between text-sm">
      <h2 class="font-bold text-base">ฟีดของคุณ</h2>
      <a href="/posts" class="font-semibold text-amber-600 dark:text-amber-400 hover:opacity-70">โพสต์ทั้งหมด →</a>
    </div>
    <div id="my-feed-list" class="space-y-6"></div>
    <p id="my-feed-empty" class="hidden text-center text-sm text-slate-500 dark:text-neutral-400 py-10">ยังไม่มีโพสต์ใหม่จากสิ่งที่คุณติดตาม<br><a href="/posts" class="text-amber-600 dark:text-amber-400 font-semibold">ดูโพสต์ทั้งหมด</a></p>
    <div id="my-feed-sentinel" class="h-10" aria-hidden="true"></div>
    <p id="my-feed-end" class="hidden text-center text-sm text-slate-500 dark:text-neutral-400 mt-4">ดูครบทุกโพสต์ในฟีดแล้ว</p>
  </div>
  <div id="public-feed">
    <div id="feed" class="space-y-6" data-base="/" data-next-page="${data.hasMore ? page + 1 : ''}">
${cards}
    </div>
    <div id="feed-sentinel" class="h-10" aria-hidden="true"></div>
    <p id="feed-end" class="hidden text-center text-sm text-slate-500 dark:text-neutral-400 mt-4">ดูครบทุกโพสต์แล้ว</p>
    ${pager}
  </div>
</main>
<script src="/home-feed.js" defer></script>`;

  return htmlResponse(shell({ origin, apiBase: env.API_BASE, path, title, desc, jsonld, body, head: links, image: data.posts[0]?.cover_url }));
}
