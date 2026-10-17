// functions/posts/[slug].js — หน้าโพสต์เดี่ยว /posts/<slug> (SSR + meta + JSON-LD)
import { api, esc, fmtDate, shell, htmlResponse, postHead, postBar, postCard } from '../_lib/render.js';

const stripText = (s) => String(s || '').replace(/\s+/g, ' ').trim();

export async function onRequestGet({ request, env, params }) {
  const origin = new URL(request.url).origin;
  const slug = String(params.slug || '');

  const data = await api(env, `/api/blog/post?slug=${encodeURIComponent(slug)}`);

  if (data?.notFound || (data && data.success === false && !data.error?.startsWith('api'))) {
    return htmlResponse(
      shell({
        origin, apiBase: env.API_BASE, path: `/posts/${slug}`, title: 'ไม่พบโพสต์ | nivread', desc: 'ไม่พบโพสต์ที่คุณต้องการ',
        robots: 'noindex, follow',
        body: '<main class="flex-1 max-w-2xl w-full mx-auto px-4 py-16 z-10 text-center"><h1 class="text-2xl font-bold">ไม่พบโพสต์นี้</h1><p class="mt-2 text-slate-500 dark:text-neutral-400">โพสต์อาจถูกลบหรือย้ายแล้ว</p><a href="/posts" class="inline-block mt-6 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm">กลับไปหน้าโพสต์</a></main>',
      }),
      404, 'public, max-age=60'
    );
  }
  if (!data || data.error || !data.post) {
    return htmlResponse('<!DOCTYPE html><meta charset="utf-8"><title>ระบบขัดข้อง</title><p>กรุณาลองใหม่อีกครั้ง</p>', 503, 'no-store');
  }

  const p = data.post;
  const path = `/posts/${p.slug}`;
  const url = origin + path;
  const desc = stripText(p.excerpt) || stripText(p.content).slice(0, 155);
  const title = `${p.title} | nivread`;
  const author = p.display_name || 'nivread';

  const paragraphs = String(p.content).split(/\n{2,}/).map((t) => t.trim()).filter(Boolean)
    .map((t) => `<p class="leading-8 text-slate-800 dark:text-neutral-200">${esc(t).replace(/\n/g, '<br>')}</p>`).join('\n');

  // โพสต์ล่าสุดอื่น ๆ — ลิงก์ภายในช่วยให้ Google เจอโพสต์ใหม่เร็วขึ้น
  const latest = await api(env, '/api/blog/list?page=1&limit=6');
  const more = (latest?.posts || []).filter((x) => x.slug !== p.slug).slice(0, 5);

  const jsonld = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: p.title.slice(0, 110),
      description: desc,
      url,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      image: p.cover_url ? [p.cover_url] : undefined,
      datePublished: new Date(p.published_at).toISOString(),
      dateModified: new Date(p.updated_at || p.published_at).toISOString(),
      inLanguage: 'th',
      articleSection: p.category || undefined,
      author: { '@type': 'Person', name: author },
      publisher: { '@type': 'Organization', name: 'nivread', url: origin + '/', logo: { '@type': 'ImageObject', url: origin + '/favicon.svg' } },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'nivread', item: origin + '/' },
        { '@type': 'ListItem', position: 2, name: 'โพสต์', item: origin + '/posts' },
        { '@type': 'ListItem', position: 3, name: p.title, item: url },
      ],
    },
  ];

  const body = `<main class="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-6 z-10">
  <nav aria-label="breadcrumb" class="mb-4 text-xs text-slate-500 dark:text-neutral-400">
    <a href="/" class="hover:text-amber-500">หน้าแรก</a> / <a href="/posts" class="hover:text-amber-500">โพสต์</a>
  </nav>
  <article class="rounded-2xl bg-white/85 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-md shadow-sm overflow-hidden">
    ${postHead(p)}
    <div class="px-4 pb-4">
      <h1 class="text-2xl md:text-3xl font-extrabold leading-tight text-slate-900 dark:text-white">${esc(p.title)}</h1>
      <p class="mt-1 text-xs text-slate-500 dark:text-neutral-400">เผยแพร่ ${esc(fmtDate(p.published_at))}${p.updated_at - p.published_at > 86400000 ? ` · อัปเดต ${esc(fmtDate(p.updated_at))}` : ''}</p>
    </div>
    ${p.cover_url ? `<img src="${esc(p.cover_url)}" alt="${esc(p.title)}" width="1200" height="675" fetchpriority="high" decoding="async" class="w-full aspect-video object-cover">` : ''}
    <div class="px-4 py-6 space-y-5 text-[15px]">
${paragraphs}
    </div>
    ${postBar(p, origin)}
  </article>

  <section id="comments" class="mt-6 rounded-2xl bg-white/85 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-md shadow-sm p-4" data-comments-for="post:${esc(p.slug)}">
    <h2 class="font-bold">ความคิดเห็น (<span id="comment-count">${p.comment_count || 0}</span>)</h2>
    <div id="comment-box" class="mt-3"></div>
    <div id="comment-list" class="mt-4 space-y-4"></div>
  </section>

  ${more.length ? `<section class="mt-10" aria-labelledby="more-h">
    <h2 id="more-h" class="text-lg font-bold mb-4">โพสต์อื่น ๆ</h2>
    <div class="space-y-6">${more.map((x) => postCard(x, origin)).join('\n')}</div>
  </section>` : ''}
</main>`;

  return htmlResponse(shell({
    origin, apiBase: env.API_BASE, path, title, desc, image: p.cover_url, type: 'article', jsonld, body,
    head: `<meta property="article:published_time" content="${new Date(p.published_at).toISOString()}">
<meta property="article:modified_time" content="${new Date(p.updated_at || p.published_at).toISOString()}">${p.category ? `\n<meta property="article:section" content="${esc(p.category)}">` : ''}`,
  }));
}