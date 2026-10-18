// functions/_lib/videos.js — แกลเลอรีวิดีโอ YouTube (SSR) — CSS และสคริปต์เล่นอยู่ใน /nivread.js (ใช้ร่วมกับการ์ดที่เรนเดอร์ฝั่งเบราว์เซอร์)
// โหลด iframe เฉพาะตอนกดเล่น (หน้าเร็ว) ใช้ youtube-nocookie
import { esc } from './render.js';

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const thumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export function cleanIds(list) {
  return (Array.isArray(list) ? list : []).filter((x) => YT_ID.test(x)).slice(0, 15);
}

export function videoLd(ids, { title, desc, uploadDate }) {
  return cleanIds(ids).map((id, i) => ({
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: `${title} — วิดีโอ ${i + 1}`.slice(0, 110),
    description: desc || title,
    thumbnailUrl: [thumb(id)],
    uploadDate,
    embedUrl: `https://www.youtube.com/embed/${id}`,
  }));
}

// compact = แบบในฟีด (ไม่มีหัวข้อ "วิดีโอ n คลิป")
export function videoGallery(ids, title, compact = false, eager = false) {
  const list = cleanIds(ids);
  if (!list.length) return '';
  const first = list[0];
  const strip = list.length > 1
    ? `<div class="vg-strip" role="list" aria-label="เลือกวิดีโอ">${list.map((id, i) =>
        `<button type="button" role="listitem" class="vg-t" data-id="${id}"${i === 0 ? ' aria-current="true"' : ''} aria-label="เล่นวิดีโอที่ ${i + 1}"><img src="${thumb(id)}" alt="" loading="lazy" decoding="async"><b>${String(i + 1).padStart(2, '0')}</b></button>`).join('')}</div>`
    : '';
  return `<section class="vg${compact ? ' vg-c' : ''}" data-title="${esc(title)}" aria-label="วิดีโอ">
  ${compact ? '' : `<div class="vg-head"><span class="vg-dot"></span>วิดีโอ <span class="text-xs font-normal text-slate-500 dark:text-neutral-400">${list.length} คลิป</span></div>`}
  <div class="vg-frame"><div class="vg-in">
    <div class="vg-bar"><span class="vg-tag">PLAYER</span><span class="vg-count">1 / ${list.length}</span></div>
    <div class="vg-stage">
      <button type="button" class="vg-poster" data-id="${first}" aria-label="เล่นวิดีโอ">
        <img class="vg-img" src="${thumb(first)}" alt="${esc(title)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
        <span class="vg-play"><img src="/img/nivreadfavon.png" alt=""></span>
        <span class="vg-mark"><img src="/img/nivreadfavon.png" alt=""><span>nivread</span></span>
      </button>
    </div>
  </div></div>
  ${strip}
</section>`;
}