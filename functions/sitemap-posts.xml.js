// functions/sitemap-posts.xml.js — sitemap อัตโนมัติ: โพสต์ใหม่โผล่ทันทีที่บันทึกลง D1
import { api, esc } from './_lib/render.js';

export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  const [data, catData] = await Promise.all([api(env, '/api/blog/slugs'), api(env, '/api/blog/categories')]);
  const posts = data?.posts || [];
  const cats = catData?.categories || [];

  const urls = [
    `<url><loc>${origin}/</loc>${posts[0] ? `<lastmod>${new Date(posts[0].updated_at).toISOString()}</lastmod>` : ''}<changefreq>hourly</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${origin}/posts</loc>${posts[0] ? `<lastmod>${new Date(posts[0].updated_at).toISOString()}</lastmod>` : ''}<changefreq>hourly</changefreq><priority>0.8</priority></url>`,
    ...cats.map((c) => `<url><loc>${esc(`${origin}/category/${encodeURIComponent(c.name)}`)}</loc><changefreq>daily</changefreq><priority>0.6</priority></url>`),
    ...posts.map((p) => `<url>
  <loc>${esc(`${origin}/posts/${p.slug}`)}</loc>
  <lastmod>${new Date(p.updated_at).toISOString()}</lastmod>${p.cover_url ? `
  <image:image><image:loc>${esc(p.cover_url)}</image:loc><image:title>${esc(p.title)}</image:title></image:image>` : ''}
</url>`),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=300' },
  });
} 