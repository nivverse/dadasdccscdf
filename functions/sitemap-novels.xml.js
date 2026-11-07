// functions/sitemap-novels.xml.js — sitemap นิยาย: หน้านิยาย + ตอนที่อ่านฟรี (ตอนที่ล็อกไม่ใส่ เพราะ noindex)
import { api, esc } from './_lib/render.js';

function isoOrNull(v) {
  if (v == null || v === '') return null;
  const d = new Date(Number(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
const lastmod = (iso) => (iso ? `<lastmod>${iso}</lastmod>` : '');

export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  const data = await api(env, '/api/novel/slugs');
  if (!data || data.error || !Array.isArray(data.novels)) {
    return new Response('Sitemap temporarily unavailable', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '300' } });
  }
  const urls = [`<url><loc>${origin}/novels</loc><changefreq>hourly</changefreq><priority>0.8</priority></url>`];
  for (const n of data.novels) {
    if (!n || !n.slug) continue;
    const img = n.cover_url && /^https:\/\//.test(n.cover_url) ? `<image:image><image:loc>${esc(n.cover_url)}</image:loc><image:title>${esc(n.title || '')}</image:title></image:image>` : '';
    urls.push(`<url><loc>${esc(`${origin}/novels/${encodeURIComponent(n.slug)}`)}</loc>${lastmod(isoOrNull(n.updated_at))}${img}</url>`);
  }
  for (const c of Array.isArray(data.chapters) ? data.chapters : []) {
    if (!c || !c.slug || !c.no) continue;
    urls.push(`<url><loc>${esc(`${origin}/novels/${encodeURIComponent(c.slug)}/${c.no}`)}</loc>${lastmod(isoOrNull(c.updated_at))}</url>`);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=300' } });
}
