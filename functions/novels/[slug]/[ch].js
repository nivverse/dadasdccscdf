// functions/novels/[slug]/[ch].js — หน้าอ่านตอน (SSR) · ตอนฟรีมีเนื้อหาใน HTML เลย · ตอนที่มีราคา SSR ไม่มีเนื้อหา ให้ /novel-reader.js โหลดหลังล็อกอิน
import { api, esc, shell, htmlResponse } from '../../_lib/render.js';
import { novelHref, notFoundPage, unavailable, isMissing, isBroken, paragraphs, fmtNum, flat, posInt, CARD, BTN, BTN2 } from '../../_lib/novel.js';

export async function onRequestGet({ request, env, params }) {
  const origin = new URL(request.url).origin;
  const slug = String(params.slug || '');
  const no = posInt(params.ch);
  const path = novelHref(slug, no || '');
  if (!no) return notFoundPage({ origin, env, path, what: 'ตอน' });

  const data = await api(env, `/api/novel/chapter?slug=${encodeURIComponent(slug)}&no=${no}`);
  if (isMissing(data)) return notFoundPage({ origin, env, path, what: 'ตอน' });
  if (isBroken(data) || !data.chapter || !data.novel) return unavailable();

  const { novel: n, chapter: c, prev, next } = data;
  const locked = !!data.locked;
  const heading = `ตอนที่ ${fmtNum(c.no)} ${c.title}`;
  const title = `${n.title} ${heading} | nivread`;
  const desc = locked ? `${n.title} ${heading} — ปลดล็อกด้วย ${fmtNum(c.price)} coin` : (flat(c.content).slice(0, 155) || heading);

  const navBtns = `<nav class="flex items-center justify-between gap-3" aria-label="เปลี่ยนตอน">
    ${prev ? `<a rel="prev" href="${novelHref(n.slug, prev.no)}" class="${BTN2}">← ตอนก่อนหน้า</a>` : '<span></span>'}
    <a href="${novelHref(n.slug)}" class="text-sm text-slate-500 dark:text-neutral-400 hover:text-amber-500">สารบัญ</a>
    ${next ? `<a rel="next" href="${novelHref(n.slug, next.no)}" class="${BTN}">ตอนถัดไป →</a>` : '<span></span>'}
  </nav>`;

  const lockPanel = `<div id="lock-panel" data-price="${Number(c.price) || 0}" class="${CARD} p-6 text-center">
      <p class="text-lg font-semibold">🔒 ตอนนี้ราคา ${fmtNum(c.price)} coin</p>
      <p id="lock-msg" class="mt-2 text-sm text-slate-500 dark:text-neutral-400" role="status">กำลังตรวจสอบสิทธิ์…</p>
      <div class="mt-4 flex justify-center gap-3">
        <button id="unlock-btn" type="button" class="${BTN} hidden">ปลดล็อกตอนนี้</button>
        <a id="login-link" href="/login?redirect=${encodeURIComponent(path)}" class="${BTN} hidden">เข้าสู่ระบบเพื่ออ่าน</a>
      </div>
    </div>`;

  const body = `<main class="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 z-10">
  <nav class="text-sm text-slate-500 dark:text-neutral-400" aria-label="เส้นทาง"><a href="/novels" class="hover:text-amber-500">นิยาย</a> <span aria-hidden="true">/</span> <a href="${novelHref(n.slug)}" class="hover:text-amber-500">${esc(n.title)}</a></nav>
  <h1 class="mt-3 text-2xl font-extrabold tracking-tight">${esc(heading)}</h1>
  <p class="mt-1 text-xs text-slate-500 dark:text-neutral-400">${fmtNum(c.chars)} ตัวอักษร</p>
  <div class="mt-6">${navBtns}</div>
  <article id="reader" data-slug="${esc(n.slug)}" data-no="${c.no}" class="mt-6 space-y-5 text-[17px] ${locked ? '' : CARD + ' p-5 sm:p-8'}">${locked ? lockPanel : paragraphs(c.content)}</article>
  <div class="mt-6">${navBtns}</div>
</main>
<script src="/novel-reader.js" defer></script>`;

  const html = shell({
    origin, apiBase: env.API_BASE, path, title, desc, image: n.cover_url || undefined,
    robots: locked ? 'noindex, follow' : 'index, follow, max-image-preview:large', type: 'article',
    jsonld: locked ? [] : [{
      '@context': 'https://schema.org', '@type': 'Chapter', name: heading, url: origin + path, inLanguage: 'th',
      isPartOf: { '@type': 'Book', name: n.title, url: origin + novelHref(n.slug) },
    }],
    body,
  });
  // ตอนที่ล็อกไม่ cache ที่ edge นาน (ผู้เขียนอาจเปลี่ยนราคา) · ตอนฟรี cache ได้ตามปกติ
  return htmlResponse(html, 200, locked ? 'public, max-age=0, s-maxage=60' : undefined);
}
