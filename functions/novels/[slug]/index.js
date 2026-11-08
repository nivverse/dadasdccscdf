// functions/novels/[slug]/index.js — หน้านิยายเรื่องเดียว: ปก สถิติ ปุ่มกระทำ คะแนน เรื่องย่อ สารบัญ คอมเมนต์ (SSR + JSON-LD)
// ส่วนที่ต้องรู้ว่าใครเป็นผู้ดู (ไลค์/บุ๊กมาร์กของฉัน อ่านต่อจากตอนไหน) เติมที่ฝั่งเบราว์เซอร์ใน /novel-page.js
import { api, esc, fmtDate, isoDate, shell, htmlResponse } from '../../_lib/render.js';
import { coverImg, novelHref, notFoundPage, unavailable, isMissing, isBroken, STATUS_TH, fmtNum, compact, flat, posInt, CARD, BTN, BTN2, ICON, HEAD_BASE } from '../../_lib/novel.js';

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
  const pageUrl = origin + path;

  const rows = slice.map((c, i) => `<li class="nv-reveal" style="--i:${Math.min(i, 8)}"><a href="${novelHref(n.slug, c.no)}" data-no="${c.no}" class="flex items-center justify-between gap-3 px-4 py-3 hover:bg-amber-500/10">
      <span class="min-w-0 truncate"><span class="text-slate-400 dark:text-neutral-500 mr-2">ตอนที่ ${fmtNum(c.no)}</span>${esc(c.title)}</span>
      <span class="shrink-0 text-xs ${c.price > 0 ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-400 dark:text-neutral-500'}">${c.price > 0 ? '🔒 ' + fmtNum(c.price) + ' coin' : fmtDate(c.updated_at)}</span></a></li>`).join('');

  const cpHref = (p) => path + (p > 1 ? '?cp=' + p : '');
  const pager = pages > 1
    ? `<nav class="mt-4 flex items-center justify-center gap-3 text-sm" aria-label="เปลี่ยนหน้าสารบัญ">
        ${cp > 1 ? `<a rel="prev" href="${cpHref(cp - 1)}" class="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/15 hover:border-amber-500">← ก่อนหน้า</a>` : ''}
        <span class="text-slate-500 dark:text-neutral-400">หน้า ${cp} / ${pages}</span>
        ${cp < pages ? `<a rel="next" href="${cpHref(cp + 1)}" class="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/15 hover:border-amber-500">ถัดไป →</a>` : ''}
      </nav>` : '';

  const stat = (icon, label, val) => `<span class="nv-stat" title="${esc(label)}"><span class="inline-flex w-[.95rem] h-[.95rem]">${icon}</span>${esc(val)}</span>`;
  const stats = `<div class="nv-stats mt-3 text-slate-600 dark:text-neutral-300">
      ${stat(ICON.eye, 'ยอดอ่าน', compact(n.views))}
      ${stat(ICON.heart.replace('<svg', '<svg fill="currentColor"'), 'ถูกใจ', compact(n.like_count))}
      ${stat(ICON.chat.replace('<svg', '<svg fill="none" stroke="currentColor" stroke-width="2"'), 'ความคิดเห็น', compact(n.comment_count))}
      ${stat(ICON.bookmark.replace('<svg', '<svg fill="none" stroke="currentColor" stroke-width="2"'), 'อยู่ในชั้นหนังสือ', compact(n.bookmark_count))}
    </div>`;

  const act = (id, icon, label, count) => `<button type="button" id="${id}" class="nv-act" aria-pressed="false">${icon}<span>${label}</span>${count == null ? '' : `<span class="nv-ct opacity-70 font-normal">${fmtNum(count)}</span>`}</button>`;
  const ratingTxt = n.rating_count > 0 ? `★ ${n.rating_avg} · ${fmtNum(n.rating_count)} คะแนน` : 'ยังไม่มีคะแนน';
  const stars = `<div class="mt-4 flex flex-wrap items-center gap-3">
      <div id="stars" class="nv-stars" role="radiogroup" aria-label="ให้คะแนนนิยายเรื่องนี้">${[5, 4, 3, 2, 1].map((v) => `<button type="button" data-v="${v}" role="radio" aria-checked="false" aria-label="${v} ดาว">${ICON.star}</button>`).join('')}</div>
      <span id="rating-sum" class="text-sm text-slate-500 dark:text-neutral-400">${esc(ratingTxt)}</span>
    </div>`;

  const body = `<main id="novel-page" data-slug="${esc(n.slug)}" data-title="${esc(n.title)}" class="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 z-10">
  <nav class="text-sm text-slate-500 dark:text-neutral-400" aria-label="เส้นทาง"><a href="/novels" class="hover:text-amber-500">นิยาย</a> <span aria-hidden="true">/</span> <span>${esc(n.title)}</span></nav>
  <section class="mt-4 grid sm:grid-cols-[210px_1fr] gap-6">
    <div class="nv-reveal nv-tilt-wrap self-start max-w-[230px] mx-auto sm:mx-0 w-full">
      <div class="nv-tilt ${CARD} !rounded-2xl">${coverImg(n)}<i class="nv-glare"></i></div>
    </div>
    <div>
      <h1 class="nv-reveal text-2xl sm:text-3xl font-extrabold tracking-tight" style="--i:1">${esc(n.title)}</h1>
      <p class="nv-reveal mt-2 text-sm text-slate-600 dark:text-neutral-400" style="--i:2">โดย <a href="/user?id=${encodeURIComponent(n.author_id)}" class="text-amber-600 dark:text-amber-400 hover:underline">${esc(n.display_name || n.author_id)}</a></p>
      <p class="nv-reveal mt-2 text-xs text-slate-500 dark:text-neutral-400" style="--i:2">${n.category ? `<a href="/novels?category=${encodeURIComponent(n.category)}" class="px-2 py-0.5 rounded-full border border-slate-300 dark:border-white/15 mr-2 hover:border-amber-500">${esc(n.category)}</a>` : ''}${esc(STATUS_TH[n.status] || '')} · ${fmtNum(n.chapter_count)} ตอน · อัปเดต ${fmtDate(n.updated_at)}</p>
      <div class="nv-reveal" style="--i:3">${stats}${stars}</div>
      <div class="nv-reveal mt-5 flex flex-wrap gap-3" style="--i:4">
        ${first ? `<a id="btn-start" href="${novelHref(n.slug, first.no)}" data-first="${first.no}" class="${BTN}">เริ่มอ่านตอนที่ ${fmtNum(first.no)}</a>` : ''}
        ${act('act-like', ICON.heart, 'ถูกใจ', n.like_count)}
        ${act('act-bm', ICON.bookmark, 'เก็บเข้าชั้น', n.bookmark_count)}
        ${act('act-share', ICON.share, 'แชร์')}
      </div>
      ${last && last !== first ? `<p class="nv-reveal mt-3 text-sm" style="--i:4"><a href="${novelHref(n.slug, last.no)}" class="text-slate-500 dark:text-neutral-400 hover:text-amber-500">ไปที่ตอนล่าสุด (ตอนที่ ${fmtNum(last.no)}) →</a></p>` : ''}
      ${synopsis ? `<h2 class="nv-reveal mt-6 font-semibold">เรื่องย่อ</h2><div class="nv-reveal mt-1 space-y-2 text-sm leading-7 text-slate-700 dark:text-neutral-300">${String(n.synopsis).split(/\n+/).filter((t) => t.trim()).map((t) => `<p>${esc(t.trim())}</p>`).join('')}</div>` : ''}
    </div>
  </section>
  <section class="mt-8" aria-labelledby="toc"><h2 id="toc" class="nv-reveal text-lg font-bold">สารบัญ</h2>
    ${slice.length ? `<ul class="nv-toc mt-3 ${CARD} divide-y divide-slate-200 dark:divide-white/10 overflow-hidden">${rows}</ul>${pager}` : `<p class="mt-3 text-slate-500 dark:text-neutral-400">ยังไม่มีตอนที่เผยแพร่</p>`}
  </section>
  <section id="novel-comments" class="mt-10" aria-labelledby="cm-h"><h2 id="cm-h" class="nv-reveal text-lg font-bold">ความคิดเห็น <span id="cm-total" class="text-slate-400 font-normal"></span></h2><div id="cm-root" class="mt-3 min-h-[6rem]"></div></section>
</main>
<script src="/novel-fx.js" defer></script><script src="/novel-social.js" defer></script><script src="/novel-page.js" defer></script>`;

  const ld = {
    '@context': 'https://schema.org', '@type': 'Book', name: n.title, description: desc, url: pageUrl,
    image: n.cover_url || undefined, inLanguage: 'th', genre: n.category || undefined,
    datePublished: isoDate(n.created_at) || undefined, dateModified: isoDate(n.updated_at) || undefined,
    author: { '@type': 'Person', name: n.display_name || n.author_id, url: origin + '/user?id=' + encodeURIComponent(n.author_id) },
  };
  if (n.rating_count > 0) ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: n.rating_avg, ratingCount: n.rating_count, bestRating: 5, worstRating: 1 };

  const html = shell({
    origin, apiBase: env.API_BASE, path: path + (cp > 1 ? '?cp=' + cp : ''),
    title: `${n.title} | nivread`, desc, image: n.cover_url || undefined, type: 'book',
    robots: n.chapter_count > 0 ? 'index, follow, max-image-preview:large' : 'noindex, follow',
    head: HEAD_BASE, jsonld: [ld], body,
  });
  return htmlResponse(html);
}
