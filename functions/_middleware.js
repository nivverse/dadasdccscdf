export async function onRequest(context) {
  const { request, next } = context;
  const res = await next();

  // ผ่านปกติถ้าไม่ใช่ 404
  if (res.status !== 404) return res;

  // เปลี่ยนเส้นทางเฉพาะการเปิดหน้าเว็บ (GET/HEAD)
  if (request.method !== 'GET' && request.method !== 'HEAD') return res;

  const url = new URL(request.url);
  const accept = request.headers.get('Accept') || '';

  // ไม่ redirect ไฟล์ (.js .css .png .mp4 ...), API, หรือคำขอที่ไม่ใช่หน้า HTML
  const looksLikeFile = /\.[a-z0-9]{2,5}$/i.test(url.pathname);
  const isApi = url.pathname.startsWith('/api/');
  if (looksLikeFile || isApi || !accept.includes('text/html')) return res;

  return Response.redirect(url.origin + '/', 302);
}