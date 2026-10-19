// functions/_lib/gallery.js — แกลเลอรีรูปแบบ Facebook (SSR) — CSS และ lightbox อยู่ใน /nivread.js
import { esc } from './render.js';

const IMG_URL = /^https:\/\/[^\s"'<>]{4,500}$/;

// รวมรูปของโพสต์: images ใหม่ ถ้าไม่มี (โพสต์เก่า) ใช้ cover_url
export function postImages(p) {
  const list = (Array.isArray(p.images) ? p.images : []).filter((x) => IMG_URL.test(x)).slice(0, 10);
  if (list.length) return list;
  return p.cover_url && IMG_URL.test(p.cover_url) ? [p.cover_url] : [];
}

// 1 รูป = สัดส่วนจริง (แนวตั้ง/แนวนอน) เห็นเต็มรูป · 2-5+ รูป = กริดแบบ Facebook · กดดูเต็มด้วย lightbox
export function imageGallery(list, title, eager = false) {
  const urls = (list || []).filter((x) => IMG_URL.test(x)).slice(0, 10);
  const n = urls.length;
  if (!n) return '';
  const data = esc(JSON.stringify(urls));
  const alt = esc(title);
  if (n === 1) {
    return `<div class="gal"><div class="gal-s" data-imgs="${data}" data-i="0" role="button" tabindex="0" aria-label="ดูรูปเต็ม">
  <img class="bg" src="${esc(urls[0])}" alt="" aria-hidden="true" decoding="async" ${eager ? '' : 'loading="lazy"'}>
  <img class="fg" src="${esc(urls[0])}" alt="${alt}" decoding="async" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}>
</div></div>`;
  }
  const tiles = urls.slice(0, 5).map((u, i) => {
    const more = i === 4 && n > 5;
    return `<button type="button" class="gal-t${more ? ' gal-more' : ''}" data-i="${i}"${more ? ` data-more="+${n - 5}"` : ''} aria-label="ดูรูปที่ ${i + 1}"><img src="${esc(u)}" alt="${alt} รูปที่ ${i + 1}" decoding="async" ${eager && i < 2 ? '' : 'loading="lazy"'}></button>`;
  }).join('');
  return `<div class="gal"><div class="gal-g gal-${Math.min(n, 5)}" data-imgs="${data}">${tiles}</div></div>`;
}
