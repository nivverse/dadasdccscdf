// functions/novels/[slug]/[ch].js — หน้าอ่านตอน (SSR)
// ตอนฟรี: เนื้อหาอยู่ใน HTML เลย (SEO + เร็ว) · ตอนที่มีราคา: SSR ไม่มีเนื้อหา ให้ /novel-reader.js โหลดหลังล็อกอิน
// ส่วนอื่นเติมฝั่งเบราว์เซอร์: ตั้งค่าการอ่าน ความคืบหน้า คอมเมนต์รายย่อหน้า สารบัญ
import { api, esc, shell, htmlResponse } from '../../_lib/render.js';
import { novelHref, notFoundPage, unavailable, isMissing, isBroken, paragraphs, fmtNum, flat, posInt, BTN, ICON, READER_HEAD } from '../../_lib/novel.js';

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

  // ปุ่มเปลี่ยนตอนใต้เนื้อหา: 2 ช่องเท่ากัน (ไม่มีตอนก่อน/ถัดไปก็ยังคงช่องไว้แบบจาง ไม่ให้เลย์เอาต์เด้ง) + ลิงก์สารบัญอยู่ตรงกลางแถวล่าง
  const navBtn = (rel, target, label, icon, primary) => target
    ? `<a rel="${rel}" href="${novelHref(n.slug, target.no)}" class="nv-nav ${primary ? 'nv-nav-primary' : ''}">${rel === 'prev' ? icon + '<span>' + label + '</span>' : '<span>' + label + '</span>' + icon}</a>`
    : `<span class="nv-nav nv-nav-off" aria-disabled="true">${rel === 'prev' ? icon + '<span>' + label + '</span>' : '<span>' + label + '</span>' + icon}</span>`;
  const navBtns = `<nav aria-label="เปลี่ยนตอน">
    <div class="grid grid-cols-2 gap-3">${navBtn('prev', prev, 'ตอนก่อนหน้า', ICON.prev, false)}${navBtn('next', next, 'ตอนถัดไป', ICON.next, true)}</div>
    <a href="${novelHref(n.slug)}" class="mt-3 flex items-center justify-center gap-2 py-2 text-sm text-slate-500 dark:text-neutral-400 hover:text-amber-500">${ICON.list}กลับไปหน้าสารบัญ</a>
  </nav>`;

  const lockPanel = `<div id="lock-panel" data-price="${Number(c.price) || 0}" class="nv-lock">
      <span class="nv-lock-ic">${ICON.lock}</span>
      <p class="text-lg font-bold">ตอนนี้ต้องปลดล็อกก่อนอ่าน</p>
      <p class="nv-lock-price">${fmtNum(c.price)} <span>coin</span></p>
      <p id="lock-msg" class="text-sm opacity-70" role="status">กำลังตรวจสอบสิทธิ์…</p>
      <div class="nv-lock-btns">
        <button id="unlock-btn" type="button" class="${BTN} hidden w-full">${ICON.lock}ปลดล็อกตอนนี้</button>
        <a id="login-link" href="/login?redirect=${encodeURIComponent(path)}" class="${BTN} hidden w-full">เข้าสู่ระบบเพื่ออ่าน</a>
      </div>
    </div>`;

  const barLink = (href, icon, label, on) => on
    ? `<a href="${href}" aria-label="${label}">${icon}</a>`
    : `<a aria-label="${label}" aria-disabled="true" tabindex="-1">${icon}</a>`;
  const toolbar = `<nav id="rd-bar" class="rd-bar" aria-label="เครื่องมือการอ่าน">
    ${barLink(prev ? novelHref(n.slug, prev.no) : '', ICON.prev, 'ตอนก่อนหน้า', !!prev)}
    <button id="rd-toc" type="button" aria-label="สารบัญ">${ICON.list}</button>
    <button id="rd-set" type="button" aria-label="ตั้งค่าการอ่าน">${ICON.sliders}</button>
    <button id="rd-cm" type="button" aria-label="ความคิดเห็น">${ICON.chat}</button>
    ${barLink(next ? novelHref(n.slug, next.no) : '', ICON.next, 'ตอนถัดไป', !!next)}
  </nav>`;

  const body = `<div id="rd-prog" class="rd-prog" aria-hidden="true"><i></i></div>
<main style="max-width:var(--rd-w,48rem)" class="flex-1 w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-36 sm:pb-28 z-10 transition-[max-width] duration-300">
  <nav class="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 truncate" aria-label="เส้นทาง"><a href="/novels" class="hover:text-amber-500">นิยาย</a> <span aria-hidden="true">/</span> <a href="${novelHref(n.slug)}" class="hover:text-amber-500">${esc(n.title)}</a></nav>
  <h1 class="mt-3 text-xl sm:text-2xl font-extrabold tracking-tight leading-snug">${esc(heading)}</h1>
  <p class="mt-1 text-xs text-slate-500 dark:text-neutral-400">${fmtNum(c.chars)} ตัวอักษร</p>
  <article id="reader" data-slug="${esc(n.slug)}" data-no="${c.no}" class="rd-card mt-6">${locked ? lockPanel : `<div class="rd-text">${paragraphs(c.content)}</div>`}</article>
  <div class="mt-6">${navBtns}</div>
  <section id="chapter-comments" class="mt-10" aria-labelledby="cm-h"><h2 id="cm-h" class="text-lg font-bold">ความคิดเห็น <span id="cm-total" class="text-slate-400 font-normal"></span></h2><div id="cm-root" class="mt-3 min-h-[6rem]"></div></section>
</main>
${toolbar}
<script src="/novel-social.js" defer></script><script src="/novel-reader.js" defer></script>`;

  const html = shell({
    origin, apiBase: env.API_BASE, path, title, desc, image: n.cover_url || undefined,
    robots: locked ? 'noindex, follow' : 'index, follow, max-image-preview:large', type: 'article',
    head: READER_HEAD
      + (prev ? `\n<link rel="prev" href="${esc(origin + novelHref(n.slug, prev.no))}">` : '')
      + (next ? `\n<link rel="next" href="${esc(origin + novelHref(n.slug, next.no))}">` : ''),
    jsonld: locked ? [] : [{
      '@context': 'https://schema.org', '@type': 'Chapter', name: heading, url: origin + path, inLanguage: 'th',
      isPartOf: { '@type': 'Book', name: n.title, url: origin + novelHref(n.slug) },
    }],
    body,
  });
  // ตอนที่ล็อกไม่ cache ที่ edge นาน (ผู้เขียนอาจเปลี่ยนราคา) · ตอนฟรี cache ได้ตามปกติ
  return htmlResponse(html, 200, locked ? 'public, max-age=0, s-maxage=60' : undefined);
}