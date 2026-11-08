// functions/novels/[slug]/index.js — หน้านิยายเรื่องเดียว (SSR + JSON-LD)
// มือถือ: ปกเล็กข้างชื่อเรื่อง · ปุ่มอ่านเต็มความกว้าง · ปุ่มถูกใจ/เก็บ/แชร์เป็นแถวเดียว 3 ช่องเท่ากัน
// ส่วนที่ต้องรู้ว่าใครเป็นผู้ดู (ไลค์/บุ๊กมาร์กของฉัน อ่านต่อจากตอนไหน) เติมที่ฝั่งเบราว์เซอร์ใน /novel-page.js
import { api, esc, fmtDate, isoDate, shell, htmlResponse } from '../../_lib/render.js';
import { coverImg, novelHref, notFoundPage, unavailable, isMissing, isBroken, STATUS_TH, fmtNum, compact, flat, posInt, CARD, ICON, HEAD_BASE } from '../../_lib/novel.js';

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

  const rows = slice.map((c, i) => `<li class="nv-reveal" style="--i:${Math.min(i, 8)}"><a href="${novelHref(n.slug, c.no)}" data-no="${c.no}" class="flex items-center justify-between gap-3 px-4 min-h-[3.25rem] py-2 hover:bg-amber-500/10">
      <span class="min-w-0 flex items-baseline gap-2"><span class="shrink-0 text-xs text-slate-400 dark:text-neutral-500 tabular-nums">${fmtNum(c.no)}</span><span class="truncate">${esc(c.title)}</span></span>
      ${c.price > 0
        ? `<span class="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">${ICON.lock}${fmtNum(c.price)}</span>`
        : `<span class="shrink-0 hidden sm:inline text-xs text-slate-400 dark:text-neutral-500">${fmtDate(c.updated_at)}</span>`}</a></li>`).join('');

  const cpHref = (p) => path + (p > 1 ? '?cp=' + p : '');
  const pgBtn = 'inline-flex items-center gap-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 hover:border-amber-500 transition-colors';
  const pager = pages > 1
    ? `<nav class="mt-4 flex items-center justify-center gap-3 text-sm" aria-label="เปลี่ยนหน้าสารบัญ">
        ${cp > 1 ? `<a rel="prev" href="${cpHref(cp - 1)}" class="${pgBtn}">${ICON.prev}ก่อนหน้า</a>` : ''}
        <span class="text-slate-500 dark:text-neutral-400 tabular-nums">${cp} / ${pages}</span>
        ${cp < pages ? `<a rel="next" href="${cpHref(cp + 1)}" class="${pgBtn}">ถัดไป${ICON.next}</a>` : ''}
      </nav>` : '';

  const st = (icon, label, val) => `<span class="inline-flex items-center gap-1.5" title="${esc(label)}">${icon}<span class="tabular-nums">${esc(val)}</span></span>`;
  const act = (id, icon, label, count) => `<button type="button" id="${id}" class="nv-act" aria-pressed="false">${icon}<span class="nv-tx"><span>${label}</span>${count == null ? '' : `<span class="nv-ct">${fmtNum(count)}</span>`}</span></button>`;
  const ratingTxt = n.rating_count > 0
    ? `<span class="inline-flex items-center gap-1 text-amber-500 font-semibold">${ICON.star}${esc(String(n.rating_avg))}</span><span class="opacity-70">· ${fmtNum(n.rating_count)} คะแนน</span>`
    : '<span class="opacity-70">ยังไม่มีคะแนน</span>';

  const body = `<main id="novel-page" data-slug="${esc(n.slug)}" data-title="${esc(n.title)}" class="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 z-10">
  <nav class="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 truncate" aria-label="เส้นทาง"><a href="/novels" class="hover:text-amber-500">นิยาย</a> <span aria-hidden="true">/</span> <span>${esc(n.title)}</span></nav>

  <section class="mt-4 grid grid-cols-[7rem_1fr] sm:grid-cols-[210px_1fr] gap-x-4 sm:gap-x-7 gap-y-5">
    <div class="nv-reveal nv-tilt-wrap sm:row-span-2 self-start">
      <div class="nv-tilt ${CARD} !rounded-xl sm:!rounded-2xl">${coverImg(n)}<i class="nv-glare"></i></div>
    </div>

    <div class="min-w-0">
      <h1 class="nv-reveal text-xl sm:text-3xl font-extrabold tracking-tight leading-tight break-words" style="--i:1">${esc(n.title)}</h1>
      <p class="nv-reveal mt-1.5 text-sm text-slate-600 dark:text-neutral-400" style="--i:2">โดย <a href="/user?id=${encodeURIComponent(n.author_id)}" class="text-amber-600 dark:text-amber-400 hover:underline">${esc(n.display_name || n.author_id)}</a></p>
      <p class="nv-reveal mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-slate-500 dark:text-neutral-400" style="--i:2">
        ${n.category ? `<a href="/novels?category=${encodeURIComponent(n.category)}" class="px-2.5 py-1 rounded-full border border-slate-300 dark:border-white/15 hover:border-amber-500">${esc(n.category)}</a>` : ''}
        <span>${esc(STATUS_TH[n.status] || '')}</span><span aria-hidden="true">·</span><span>${fmtNum(n.chapter_count)} ตอน</span>
        <span class="hidden sm:contents"><span aria-hidden="true">·</span><span>อัปเดต ${fmtDate(n.updated_at)}</span></span>
      </p>
      <p class="nv-reveal mt-2.5 flex items-center gap-4 text-sm text-slate-600 dark:text-neutral-300" style="--i:3">
        ${st(ICON.eye, 'ยอดอ่าน', compact(n.views))}${st(ICON.chat, 'ความคิดเห็น', compact(n.comment_count))}
      </p>
    </div>

    <div class="col-span-2 sm:col-span-1 sm:col-start-2 min-w-0">
      <div class="nv-reveal flex flex-wrap items-center gap-x-3 gap-y-1" style="--i:3">
        <div id="stars" class="nv-stars" role="radiogroup" aria-label="ให้คะแนนนิยายเรื่องนี้">${[5, 4, 3, 2, 1].map((v) => `<button type="button" data-v="${v}" role="radio" aria-checked="false" aria-label="${v} ดาว">${ICON.starBtn}</button>`).join('')}</div>
        <span id="rating-sum" class="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-neutral-400">${ratingTxt}</span>
      </div>

      <div class="nv-reveal mt-4 flex flex-col gap-3" style="--i:4">
        ${first ? `<a id="btn-start" href="${novelHref(n.slug, first.no)}" data-first="${first.no}" class="nv-cta">${ICON.book}<span>เริ่มอ่านตอนที่ ${fmtNum(first.no)}</span></a>` : ''}
        <div class="nv-actions">
          ${act('act-like', ICON.heart, 'ถูกใจ', n.like_count)}
          ${act('act-bm', ICON.bookmark, 'เก็บเข้าชั้น', n.bookmark_count)}
          ${act('act-share', ICON.share, 'แชร์')}
        </div>
        <a id="shelf-link" href="/novel-library" class="nv-shelf hidden">${ICON.bookmark}<span>อยู่ในชั้นหนังสือของคุณแล้ว</span><span class="ml-auto inline-flex items-center gap-0.5">ดูชั้นหนังสือ${ICON.next}</span></a>
      </div>

      ${synopsis ? `<div class="nv-reveal mt-6" style="--i:4"><h2 class="font-semibold">เรื่องย่อ</h2>
        <div id="syn" class="nv-clamp mt-1.5 space-y-2 text-sm leading-7 text-slate-700 dark:text-neutral-300">${String(n.synopsis).split(/\n+/).filter((t) => t.trim()).map((t) => `<p>${esc(t.trim())}</p>`).join('')}</div>
        <button id="syn-more" type="button" class="hidden sm:hidden mt-1 py-1 text-sm font-semibold text-amber-600 dark:text-amber-400">อ่านเพิ่มเติม</button></div>` : ''}
    </div>
  </section>

  <section class="mt-9" aria-labelledby="toc">
    <div class="nv-reveal flex items-end justify-between gap-3"><h2 id="toc" class="text-lg font-bold">สารบัญ</h2>
      ${last && last !== first ? `<a href="${novelHref(n.slug, last.no)}" class="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-neutral-400 hover:text-amber-500 py-1">ตอนล่าสุด ${fmtNum(last.no)}${ICON.arrowRight}</a>` : ''}</div>
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