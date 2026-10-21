// functions/_lib/videos.js — แกลเลอรีวิดีโอ YouTube (SSR) — CSS และสคริปต์เล่นอยู่ใน /nivread.js (ใช้ร่วมกับการ์ดที่เรนเดอร์ฝั่งเบราว์เซอร์)
// โหลด iframe เฉพาะตอนกดเล่น (หน้าเร็ว) ใช้ youtube-nocookie
import { esc } from './render.js';

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const thumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

// วิดีโออัปโหลดเอง = URL ของ /api/blog/vid/... (mp4/webm) · โปสเตอร์ = ไฟล์ .jpg ชื่อเดียวกัน
const UP_RE = /^https:\/\/[^\s"'<>]{4,300}\/api\/blog\/vid\/v\/[A-Za-z0-9._~%-]{1,180}\/[a-z0-9]{6,40}\.(mp4|webm)$/;
export const isUp = (x) => UP_RE.test(String(x));
const posterOf = (u) => u.replace(/\.(mp4|webm)$/, '.jpg');

export function cleanIds(list) {
  return (Array.isArray(list) ? list : []).filter((x) => YT_ID.test(x) || UP_RE.test(String(x))).slice(0, 15);
}

const uvBlock = (u, title, eager) => `<div class="uv bp"><video controls playsinline autoplay muted loop preload="metadata" poster="${esc(posterOf(u))}" src="${esc(u)}" aria-label="${esc(title)}"></video></div>`;

export function videoLd(ids, { title, desc, uploadDate }) {
  return cleanIds(ids).map((id, i) => ({
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: `${title} — วิดีโอ ${i + 1}`.slice(0, 110),
    description: desc || title,
    thumbnailUrl: [isUp(id) ? posterOf(id) : thumb(id)],
    uploadDate,
    ...(isUp(id) ? { contentUrl: id } : { embedUrl: `https://www.youtube.com/embed/${id}` }),
  }));
}

// compact = แบบในฟีด: แสดงวิดีโอแรกคลิปเดียว (กดดูคลิปอื่นในหน้าโพสต์) / ปกติ = หน้าโพสต์: เครื่องเล่น + ตารางเลือกคลิป
export function videoGallery(ids, title, compact = false, eager = false, href = '#') {
  const all = cleanIds(ids);
  if (!all.length) return '';
  // ฟีด: แสดงคลิปแรกคลิปเดียว (ถ้าเป็นวิดีโออัปโหลดใช้เครื่องเล่นของเบราว์เซอร์)
  if (compact && isUp(all[0])) {
    return `<section class="vg vg-c" aria-label="วิดีโอ">${uvBlock(all[0], title)}${all.length > 1 ? `<a class="vg-more vg-more-u" href="${esc(href)}">ดูทั้งหมด ${all.length} คลิป</a>` : ''}</section>`;
  }
  // หน้าโพสต์: วิดีโออัปโหลดทุกคลิปก่อน แล้วค่อยตามด้วยแกลเลอรี YouTube
  const ups = compact ? [] : all.filter(isUp);
  const list = all.filter((x) => !isUp(x));
  const upHtml = ups.length ? `<section class="vg" aria-label="วิดีโอ">${ups.map((u) => uvBlock(u, title)).join('')}</section>` : '';
  if (!list.length) return upHtml;
  const first = list[0];
  const grid = !compact && list.length > 1
    ? `<div class="vg-grid" role="list" aria-label="เลือกวิดีโอ">${list.map((id, i) =>
        `<button type="button" role="listitem" class="vg-t" data-id="${id}"${i === 0 ? ' aria-current="true"' : ''} aria-label="เล่นวิดีโอที่ ${i + 1}"><img src="${thumb(id)}" alt="" loading="lazy" decoding="async"><b>${String(i + 1).padStart(2, '0')}</b><i class="vg-eq"><s></s><s></s><s></s></i></button>`).join('')}</div>`
    : '';
  const right = compact
    ? (all.length > 1 ? `<a class="vg-more" href="${esc(href)}">ดูทั้งหมด ${all.length} คลิป</a>` : '')
    : `<span class="vg-count">1 / ${list.length}</span>`;
  return upHtml + `<section class="vg${compact ? ' vg-c' : ''}" data-title="${esc(title)}" aria-label="วิดีโอ">
  ${compact ? '' : `<div class="vg-head"><span class="vg-dot"></span>วิดีโอ <span class="text-xs font-normal text-slate-500 dark:text-neutral-400">${list.length} คลิป</span></div>`}
  <div class="vg-frame"><div class="vg-in">
    <div class="vg-bar"><span class="vg-tag">PLAYER</span>${right}</div>
    <div class="vg-stage">
      <button type="button" class="vg-poster" data-id="${first}" aria-label="เล่นวิดีโอ">
        <img class="vg-img" src="${thumb(first)}" alt="${esc(title)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
        <span class="vg-play"><img src="/img/nivreadfavon.png" alt=""></span>
      </button>
    </div>
  </div></div>
  ${grid}
</section>`;
}