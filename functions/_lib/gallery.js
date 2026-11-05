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
// href = โหมดฟีด: แตะรูปแล้วเข้าหน้าโพสต์ (ยังไม่ขยายรูป) · ไม่ใส่ href = หน้าโพสต์: แตะแล้วเปิดดูรูปเต็ม
export function imageGallery(list, title, eager = false, href = '') {
  const urls = (list || []).filter((x) => IMG_URL.test(x)).slice(0, 10);
  const n = urls.length;
  if (!n) return '';
  const data = esc(JSON.stringify(urls));
  const feed = !!href;
  const alt = esc(title);
  if (n === 1) {
    const open = feed ? `<a class="gal-s" href="${esc(href)}" aria-label="เปิดโพสต์ ${alt}">` : `<div class="gal-s" data-imgs="${data}" data-i="0" role="button" tabindex="0" aria-label="ดูรูปเต็ม">`;
    return `<div class="gal${feed ? ' gal-l' : ''}">${open}
  <img class="bg" src="${esc(urls[0])}" alt="" aria-hidden="true" decoding="async" ${eager ? '' : 'loading="lazy"'}>
  <img class="fg" src="${esc(urls[0])}" alt="${alt}" decoding="async" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}>
${feed ? '</a>' : '</div>'}</div>`;
  }
  const tiles = urls.slice(0, 5).map((u, i) => {
    const more = i === 4 && n > 5;
    const img = `<img src="${esc(u)}" alt="${alt} รูปที่ ${i + 1}" decoding="async" ${eager && i < 2 ? '' : 'loading="lazy"'}>`;
    const cls = `gal-t${more ? ' gal-more' : ''}`, mo = more ? ` data-more="+${n - 5}"` : '';
    return feed
      ? `<a class="${cls}" href="${esc(href)}"${mo} aria-label="เปิดโพสต์ ${alt}">${img}</a>`
      : `<button type="button" class="${cls}" data-i="${i}"${mo} aria-label="ดูรูปที่ ${i + 1}">${img}</button>`;
  }).join('');
  return `<div class="gal${feed ? ' gal-l' : ''}"><div class="gal-g gal-${Math.min(n, 5)}"${feed ? '' : ` data-imgs="${data}"`}>${tiles}</div></div>`;
}