// functions/novels/[slug]/index.js — หน้านิยายเรื่องเดียว: ปก เรื่องย่อ สารบัญตอน (SSR + JSON-LD)
import { api, esc, fmtDate, isoDate, shell, htmlResponse } from '../../_lib/render.js';
import { coverImg, novelHref, notFoundPage, unavailable, isMissing, isBroken, STATUS_TH, fmtNum, flat, posInt, CARD, BTN, BTN2 } from '../../_lib/novel.js';

const PER_PAGE = 100;

export async function onRequestGet({ request, env, params }) {
  const url = new URL(request.url);
  const origin = url.origin;
  const slug = String(params.slug || '');
  const path = novelHref(slug);

  const data = await api(env, `/api/novel/get?slug=${encodeURIComponent(slug)}`);
  if (isMissing(data)) return notFoundPage({ origin, env, path });
  if (isBroken(data) || !data.novel) return unavailable();

  const n = data.novel;
  const chapters = Array.isArray(data.chapters) ? data.chapters : [];
  const pages = Math.max(1, Math.ceil(chapters.length / PER_PAGE));
  const cp = Math.min(pages, posInt(url.searchParams.get('cp')) || 1);
  const slice = chapters.slice((cp - 1) * PER_PAGE, cp * PER_PAGE);
  const first = chapters[0];
  const last = chapters[chapters.length - 1];
  const synopsis = flat(n.synopsis);
  const desc = synopsis.slice(0, 155) || `อ่านนิยาย ${n.title} ออนไลน์ที่ nivread`;

  const rows = slice.map((c) => `<li><a href="${novelHref(n.slug, c.no)}" class="flex items-center justify-between gap-3 px-4 py-3 hover:bg-amber-500/10 transition">
      <span class="min-w-0 truncate"><span class="text-slate-400 dark:text-neutral-500 mr-2">ตอนที่ ${fmtNum(c.no)}</span>${esc(c.title)}</span>
      <span class="shrink-0 text-xs ${c.price > 0 ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-400 dark:text-neutral-500'}">${c.price > 0 ? '🔒 ' + fmtNum(c.price) + ' coin' : fmtDate(c.updated_at)}</span></a></li>`).join('');

  const cpHref = (p) => path + (p > 1 ? '?cp=' + p : '');
  const pager = pages > 1
    ? `<nav class="mt-4 flex items-center justify-center gap-3 text-sm" aria-label="เปลี่ยนหน้าสารบัญ">
        ${cp > 1 ? `<a rel="prev" href="${cpHref(cp - 1)}" class="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/15 hover:border-amber-500">← ก่อนหน้า</a>` : ''}
        <span class="text-slate-500 dark:text-neutral-400">หน้า ${cp} / ${pages}</span>
        ${cp < pages ? `<a rel="next" href="${cpHref(cp + 1)}" class="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/15 hover:border-amber-500">ถัดไป →</a>` : ''}
      </nav>` : '';

  const body = `<main class="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 z-10">
  <nav class="text-sm text-slate-500 dark:text-neutral-400" aria-label="เส้นทาง"><a href="/novels" class="hover:text-amber-500">นิยาย</a> <span aria-hidden="true">/</span> <span>${esc(n.title)}</span></nav>
  <section class="mt-4 grid sm:grid-cols-[200px,1fr] gap-6">
    <div class="${CARD} overflow-hidden self-start max-w-[220px] mx-auto sm:mx-0 w-full">${coverImg(n)}</div>
    <div>
      <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">${esc(n.title)}</h1>
      <p class="mt-2 text-sm text-slate-600 dark:text-neutral-400">โดย <a href="/user?id=${encodeURIComponent(n.author_id)}" class="text-amber-600 dark:text-amber-400 hover:underline">${esc(n.display_name || n.author_id)}</a></p>
      <p class="mt-2 text-xs text-slate-500 dark:text-neutral-400">${n.category ? `<a href="/novels?category=${encodeURIComponent(n.category)}" class="px-2 py-0.5 rounded-full border border-slate-300 dark:border-white/15 mr-2 hover:border-amber-500">${esc(n.category)}</a>` : ''}${esc(STATUS_TH[n.status] || '')} · ${fmtNum(n.chapter_count)} ตอน · อัปเดต ${fmtDate(n.updated_at)}</p>
      <div class="mt-4 flex flex-wrap gap-3">
        ${first ? `<a href="${novelHref(n.slug, first.no)}" class="${BTN}">เริ่มอ่านตอนที่ ${fmtNum(first.no)}</a>` : ''}
        ${last && last !== first ? `<a href="${novelHref(n.slug, last.no)}" class="${BTN2}">ตอนล่าสุด</a>` : ''}
      </div>
      ${synopsis ? `<h2 class="mt-6 font-semibold">เรื่องย่อ</h2><div class="mt-1 space-y-2 text-sm leading-7 text-slate-700 dark:text-neutral-300">${String(n.synopsis).split(/\n+/).filter((t) => t.trim()).map((t) => `<p>${esc(t.trim())}</p>`).join('')}</div>` : ''}
    </div>
  </section>
  <section class="mt-8" aria-labelledby="toc"><h2 id="toc" class="text-lg font-bold">สารบัญ</h2>
    ${slice.length ? `<ul class="mt-3 ${CARD} divide-y divide-slate-200 dark:divide-white/10 overflow-hidden">${rows}</ul>${pager}` : `<p class="mt-3 text-slate-500 dark:text-neutral-400">ยังไม่มีตอนที่เผยแพร่</p>`}
  </section>
</main>`;

  const html = shell({
    origin, apiBase: env.API_BASE, path: path + (cp > 1 ? '?cp=' + cp : ''),
    title: `${n.title} | nivread`, desc, image: n.cover_url || undefined, type: 'book',
    robots: n.chapter_count > 0 ? 'index, follow, max-image-preview:large' : 'noindex, follow',
    jsonld: [{
      '@context': 'https://schema.org', '@type': 'Book', name: n.title, description: desc, url: origin + path,
      image: n.cover_url || undefined, inLanguage: 'th', genre: n.category || undefined,
      datePublished: isoDate(n.created_at) || undefined, dateModified: isoDate(n.updated_at) || undefined,
      author: { '@type': 'Person', name: n.display_name || n.author_id, url: origin + '/user?id=' + encodeURIComponent(n.author_id) },
    }],
    body,
  });
  return htmlResponse(html);
}
