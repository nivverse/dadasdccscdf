// functions/sitemap-posts.xml.js — sitemap อัตโนมัติ: โพสต์ใหม่โผล่ทันทีที่บันทึกลง D1
import { api, esc } from './_lib/render.js';

// แปลงเวลา (ms / วินาที / ISO string) เป็น ISO 8601 — คืน null ถ้าค่าไม่ถูกต้อง (กัน RangeError: Invalid time value)
function isoOrNull(v) {
  if (v == null || v === '') return null;
  let n = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v;
  if (typeof n === 'number' && n > 0 && n < 1e11) n *= 1000; // เผื่อ API ส่งเป็นวินาที
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const lastmod = (iso) => (iso ? `<lastmod>${iso}</lastmod>` : '');
const down = () =>
  new Response('Sitemap temporarily unavailable', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '300' },
  });

export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  const [data, catData] = await Promise.all([api(env, '/api/blog/slugs'), api(env, '/api/blog/categories')]);

  // API ล่ม → ตอบ 503 (ไม่ส่ง sitemap ว่างที่ทำให้ Google คิดว่าโพสต์ทั้งหมดหายไป)
  if (!data || data.error || !Array.isArray(data.posts)) return down();

  const posts = data.posts.filter((p) => p && p.slug);
  const cats = Array.isArray(catData?.categories) ? catData.categories.filter((c) => c && c.name) : [];

  // เวลาแก้ไขล่าสุดของทั้งเว็บ = โพสต์ที่ใหม่ที่สุด (ไม่พึ่งลำดับของ API)
  const times = posts.map((p) => isoOrNull(p.updated_at) || isoOrNull(p.published_at)).filter(Boolean).sort();
  const newest = times.length ? times[times.length - 1] : null;

  const urls = [
    `<url><loc>${origin}/</loc>${lastmod(newest)}<changefreq>hourly</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${origin}/posts</loc>${lastmod(newest)}<changefreq>hourly</changefreq><priority>0.8</priority></url>`,
    `<url><loc>${origin}/categories</loc><changefreq>daily</changefreq><priority>0.5</priority></url>`,
    ...cats.map((c) => `<url><loc>${esc(`${origin}/category/${encodeURIComponent(c.name)}`)}</loc><changefreq>daily</changefreq><priority>0.6</priority></url>`),
    ...posts.map((p) => {
      const mod = isoOrNull(p.updated_at) || isoOrNull(p.published_at);
      const img = p.cover_url && /^https:\/\//.test(p.cover_url)
        ? `\n  <image:image><image:loc>${esc(p.cover_url)}</image:loc><image:title>${esc(p.title)}</image:title></image:image>`
        : '';
      return `<url>\n  <loc>${esc(`${origin}/posts/${encodeURIComponent(p.slug)}`)}</loc>${mod ? `\n  ${lastmod(mod)}` : ''}${img}\n</url>`;
    }),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=300' },
  });
}
