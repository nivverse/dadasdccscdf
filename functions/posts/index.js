// functions/posts/index.js — หน้าฟีด /posts?page=N (SSR) และ ?partial=1 สำหรับเลื่อนโหลดเพิ่ม
import { api, esc, postCard, shell, htmlResponse } from '../_lib/render.js';

const PER_PAGE = 10;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const origin = url.origin;
  const page = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1);
  const partial = url.searchParams.get('partial') === '1';

  const data = await api(env, `/api/blog/list?page=${page}&limit=${PER_PAGE}`);
  if (!data || data.error || !data.posts) {
    return htmlResponse('<!DOCTYPE html><meta charset="utf-8"><title>ระบบขัดข้อง</title><p>ไม่สามารถโหลดโพสต์ได้ กรุณาลองใหม่</p>', 503, 'no-store');
  }

  const cards = data.posts.map((p, i) => postCard(p, origin, page === 1 && i === 0)).join('\n');

  // ชิ้นส่วนสำหรับ infinite scroll
  if (partial) {
    return new Response(cards, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Has-More': data.hasMore ? '1' : '0',
        'Cache-Control': 'public, max-age=0, s-maxage=60',
      },
    });
  }

  // หน้าเกินจำนวนจริง → 404
  if (page > 1 && data.posts.length === 0) {
    return htmlResponse('<!DOCTYPE html><meta charset="utf-8"><meta name="robots" content="noindex"><title>ไม่พบหน้านี้</title><p>ไม่พบหน้านี้ <a href="/posts">กลับไปหน้าโพสต์</a></p>', 404, 'public, max-age=60');
  }

  const totalPages = Math.max(1, Math.ceil(data.total / PER_PAGE));
  const path = page === 1 ? '/posts' : `/posts?page=${page}`;
  const title = page === 1 ? 'โพสต์ล่าสุด ข่าวและบทความอนิเมะ | nivread' : `โพสต์ล่าสุด หน้า ${page} | nivread`;
  const desc = 'รวมโพสต์ บทความ และข่าวอนิเมะอัปเดตใหม่ล่าสุดจาก nivread อ่านง่ายเหมือนฟีด พร้อมกดถูกใจและแสดงความคิดเห็น';

  const jsonld = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      url: origin + path,
      isPartOf: { '@type': 'WebSite', name: 'nivread', url: origin + '/' },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: data.posts.map((p, i) => ({
          '@type': 'ListItem',
          position: (page - 1) * PER_PAGE + i + 1,
          url: `${origin}/posts/${p.slug}`,
          name: p.title,
        })),
      },
    },
  ];

  const links = [
    page > 1 ? `<link rel="prev" href="${origin}${page === 2 ? '/posts' : `/posts?page=${page - 1}`}">` : '',
    data.hasMore ? `<link rel="next" href="${origin}/posts?page=${page + 1}">` : '',
  ].join('\n');

  const btn = 'px-5 py-2.5 rounded-xl font-medium text-sm shadow-sm flex items-center gap-1';
  const pager = `<nav id="pagination-nav" aria-label="การนำทางหน้าโพสต์" class="flex items-center justify-center gap-4 mt-10">
    ${page > 1 ? `<a rel="prev" href="${page === 2 ? '/posts' : `/posts?page=${page - 1}`}" class="${btn} bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/20 transition-all">ก่อนหน้า</a>` : ''}
    <span class="text-sm font-semibold text-slate-700 dark:text-neutral-300 px-3">หน้า ${page} / ${totalPages}</span>
    ${data.hasMore ? `<a rel="next" href="/posts?page=${page + 1}" class="${btn} bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white transition-all shadow-md shadow-amber-500/25">ถัดไป</a>` : ''}
  </nav>`;

  const body = `<main class="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-6 z-10">
  <div class="mb-8">
    <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold mb-3 backdrop-blur-md shadow-sm">
      <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> nivread Feed
    </div>
    <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
      โพสต์ <span class="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-400 to-red-500">ล่าสุด</span>
    </h1>
    <p class="text-slate-600 dark:text-neutral-400 text-sm mt-1">บทความ ข่าวสาร และเรื่องเล่าวงการอนิเมะ อัปเดตทุกวัน</p>
  </div>
  <div id="feed" class="space-y-6" data-next-page="${data.hasMore ? page + 1 : ''}">
${cards}
  </div>
  <div id="feed-sentinel" class="h-10" aria-hidden="true"></div>
  <p id="feed-end" class="hidden text-center text-sm text-slate-500 dark:text-neutral-400 mt-4">ดูครบทุกโพสต์แล้ว</p>
  ${pager}
</main>`;

  return htmlResponse(shell({
    origin, apiBase: env.API_BASE, path, title, desc, jsonld, body, head: links,
    image: data.posts[0]?.cover_url,
  }));
}