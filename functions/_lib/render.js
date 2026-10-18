// functions/_lib/render.js — ตัวช่วยเรนเดอร์ HTML ฝั่งเซิร์ฟเวอร์ (Cloudflare Pages Functions)
import { videoGallery } from './videos.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtDate = (ms) =>
  new Date(ms).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok' });

export function ago(ms) {
  const s = Math.max(1, ((Date.now() - ms) / 1000) | 0);
  if (s < 60) return 'เมื่อสักครู่';
  const m = (s / 60) | 0; if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = (m / 60) | 0; if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  const d = (h / 24) | 0; if (d < 7) return `${d} วันที่แล้ว`;
  return fmtDate(ms);
}

export async function api(env, path) {
  const base = String(env.API_BASE || '').replace(/\/+$/, '');
  if (!base) return { error: 'API_BASE not set' };
  try {
    const r = await fetch(base + path, { cf: { cacheTtl: 60, cacheEverything: true } });
    if (r.status === 404) return { notFound: true };
    if (!r.ok) return { error: `api ${r.status}` };
    return await r.json();
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

const ICON = {
  heart: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>',
  chat: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>',
  share: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>',
};
const icon = (n) => `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

export function avatar(p, size = 'w-11 h-11') {
  const name = p.display_name || 'nivread';
  return p.avatar_url
    ? `<img src="${esc(p.avatar_url)}" alt="${esc(name)}" width="44" height="44" loading="lazy" referrerpolicy="no-referrer" class="${size} rounded-full object-cover ring-2 ring-amber-500/40">`
    : `<div class="${size} rounded-full bg-gradient-to-br from-amber-500 to-orange-500 grid place-items-center text-white font-bold" aria-hidden="true">${esc(name.charAt(0).toUpperCase())}</div>`;
}

function postHead(p) {
  const profile = p.author_id ? `/user?id=${encodeURIComponent(p.author_id)}` : '';
  const who = esc(p.display_name || 'nivread');
  return `<div class="flex items-center gap-3 p-4">
    ${profile ? `<a href="${profile}" class="flex-shrink-0" aria-label="โปรไฟล์ ${who}">${avatar(p)}</a>` : avatar(p)}
    <div class="min-w-0">
      ${profile
        ? `<a href="${profile}" class="block font-semibold text-sm text-slate-900 dark:text-white truncate hover:text-amber-500">${who}</a>`
        : `<div class="font-semibold text-sm text-slate-900 dark:text-white truncate">${who}</div>`}
      <div class="text-xs text-slate-500 dark:text-neutral-400">
        <time datetime="${new Date(p.published_at).toISOString()}">${esc(ago(p.published_at))}</time>
        ${p.category ? `<span class="ml-2 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">${esc(p.category)}</span>` : ''}
      </div>
    </div>
    ${p.author_id && p.slug ? `<a href="/write?edit=${encodeURIComponent(p.slug)}" data-edit-post data-author="${esc(p.author_id)}" class="hidden ml-auto flex-shrink-0 w-9 h-9 place-items-center rounded-full text-slate-500 dark:text-neutral-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors" aria-label="แก้ไขโพสต์" title="แก้ไขโพสต์"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg></a>` : ''}
  </div>`;
}

function postBar(p, origin) {
  const href = `/posts/${p.slug}`;
  const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-500 dark:text-neutral-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 transition-colors';
  return `<div class="px-3 py-2 flex items-center justify-between border-t border-slate-200 dark:border-white/10">
      <div class="flex items-center gap-1">
        <button type="button" data-like="${esc(p.slug)}" class="${btn}" aria-pressed="false" aria-label="ถูกใจ" title="ถูกใจ">${icon('heart')}<span data-like-count="${esc(p.slug)}" class="tabular-nums">${p.like_count || 0}</span></button>
        <a href="${href}#comments" class="${btn}" aria-label="ความคิดเห็น" title="ความคิดเห็น">${icon('chat')}<span class="tabular-nums">${p.comment_count || 0}</span></a>
      </div>
      <button type="button" data-share data-url="${esc(origin + href)}" data-title="${esc(p.title)}" class="${btn}" aria-label="แชร์" title="แชร์">${icon('share')}</button>
    </div>`;
}

// การ์ดโพสต์ในฟีด (สไตล์ Facebook) — ลิงก์ <a href> จริงทุกโพสต์ให้ Google ตามเก็บได้
export function postCard(p, origin, first = false) {
  const href = `/posts/${p.slug}`;
  return `<article class="rounded-2xl bg-white/85 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-md shadow-sm overflow-hidden">
  ${postHead(p)}
  <div class="px-4 pb-3">
    <h2 class="text-lg font-bold text-slate-900 dark:text-white leading-snug"><a href="${href}" class="hover:text-amber-500 transition-colors">${esc(p.title)}</a></h2>
    ${p.excerpt ? `<p class="mt-1 text-sm text-slate-600 dark:text-neutral-300 line-clamp-3">${esc(p.excerpt)}</p>` : ''}
    ${(p.content_len || 0) > 160 ? `<a href="${href}" class="inline-block mt-1 px-2 -ml-2 text-lg leading-none tracking-widest text-amber-600 dark:text-amber-400 hover:text-amber-500" aria-label="อ่านโพสต์ต่อ" title="อ่านโพสต์ต่อ">...</a>` : ''}
  </div>
  ${(p.videos && p.videos.length) ? videoGallery(p.videos, p.title, true, first) : p.cover_url ? `<a href="${href}" tabindex="-1" aria-hidden="true"><img src="${esc(p.cover_url)}" alt="${esc(p.title)}" width="1200" height="675" ${first ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" class="w-full aspect-video object-cover"></a>` : ''}
  ${postBar(p, origin)}
</article>`;
}

export { postBar, postHead };

export function shell({ origin, apiBase, path, title, desc, image, jsonld = [], body, robots = 'index, follow, max-image-preview:large', type = 'website', head = '' }) {
  const canonical = origin + path;
  const img = image || `${origin}/og-image.jpg`;
  const ld = jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n');
  return `<!DOCTYPE html>
<html lang="th" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${robots}">
<meta name="author" content="nivread">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="/img/nivreadfavon.png" type="image/png">
<link rel="apple-touch-icon" href="/img/nivreadfavon.png">
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
<style>body{font-family:'Kanit',sans-serif}</style>
</head>
<body class="bg-[#f3f4f6] text-slate-900 dark:bg-[#0d0d0d] dark:text-white transition-colors duration-300 min-h-screen flex flex-col relative overflow-x-hidden">
<div class="fixed inset-0 pointer-events-none z-0">
  <div class="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/20 opacity-30 dark:opacity-100 rounded-full blur-[128px]"></div>
  <div class="absolute top-1/2 -right-40 w-96 h-96 bg-orange-500/20 opacity-30 dark:opacity-100 rounded-full blur-[128px]"></div>
</div>
<header id="main-header" class="z-20"></header>
${body}
<div id="main-footer" class="z-10"></div>
<script src="/nivread.js"></script>
<script src="/posts-feed.js" defer></script>
</body>
</html>`;
}

export const htmlResponse = (html, status = 200, cache = 'public, max-age=0, s-maxage=300, stale-while-revalidate=600') =>
  new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache } });