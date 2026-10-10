// public/posts-feed.js — เลื่อนโหลดเพิ่ม + ไลก์ + แชร์ (ไม่กระทบ SEO เพราะเนื้อหาเรนเดอร์มาจากเซิร์ฟเวอร์แล้ว)
(() => {
  const API = (document.querySelector('meta[name="api-base"]')?.content || '').replace(/\/+$/, '');

  // login.html เก็บ 'userId' และ 'token' ไว้ใน localStorage หลังล็อกอิน
  const getUserId = () => localStorage.getItem('userId') || '';
  const authHeaders = () => {
    const h = { 'Content-Type': 'application/json' };
    const t = localStorage.getItem('token');
    if (t) h.Authorization = 'Bearer ' + t;
    return h;
  };

  const toast = (msg) => {
    const t = document.createElement('div');
    t.textContent = msg;
    t.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm shadow-lg';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  };

  // ---------- สถานะไลก์ ----------
  const paint = (slug, liked) => {
    document.querySelectorAll(`[data-like="${CSS.escape(slug)}"]`).forEach((b) => {
      b.setAttribute('aria-pressed', liked ? 'true' : 'false');
      b.classList.toggle('text-rose-500', liked);
      b.querySelector('svg')?.setAttribute('fill', liked ? 'currentColor' : 'none');
    });
  };
  const loadLiked = async () => {
    const uid = getUserId();
    if (!uid || !API) return;
    try {
      const r = await fetch(`${API}/api/blog/liked?userId=${encodeURIComponent(uid)}`);
      const d = await r.json();
      (d.slugs || []).forEach((s) => paint(s, true));
    } catch {}
  };

  document.addEventListener('click', async (e) => {
    const likeBtn = e.target.closest('[data-like]');
    if (likeBtn) {
      const uid = getUserId();
      if (!uid) { location.href = '/login.html'; return; }
      const slug = likeBtn.dataset.like;
      likeBtn.disabled = true;
      try {
        const r = await fetch(`${API}/api/blog/like`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ slug, userId: uid }),
        });
        const d = await r.json();
        if (!d.success) return toast(d.error || 'ทำรายการไม่สำเร็จ');
        paint(slug, d.liked);
        document.querySelectorAll(`[data-like-count="${CSS.escape(slug)}"]`).forEach((n) => (n.textContent = d.likeCount));
      } catch { toast('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง'); }
      finally { likeBtn.disabled = false; }
      return;
    }

    const shareBtn = e.target.closest('[data-share]');
    if (shareBtn) {
      const { url, title } = shareBtn.dataset;
      if (navigator.share) { try { await navigator.share({ title, url }); } catch {} return; }
      try { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์แล้ว'); }
      catch { prompt('คัดลอกลิงก์นี้', url); }
    }
  });

  // ---------- เลื่อนโหลดเพิ่ม (ใช้ HTML ชิ้นส่วนจากเซิร์ฟเวอร์) ----------
  const feed = document.getElementById('feed');
  const sentinel = document.getElementById('feed-sentinel');
  if (feed && sentinel && 'IntersectionObserver' in window) {
    document.getElementById('pagination-nav')?.classList.add('hidden'); // ลิงก์แบ่งหน้ายังอยู่ใน HTML ให้ Google ใช้
    let loading = false;
    const end = () => { document.getElementById('feed-end')?.classList.remove('hidden'); io.disconnect(); };

    const io = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting || loading) return;
      const next = feed.dataset.nextPage;
      if (!next) return end();
      loading = true;
      try {
        const r = await fetch(`/posts?page=${next}&partial=1`);
        if (!r.ok) throw new Error();
        feed.insertAdjacentHTML('beforeend', await r.text());
        feed.dataset.nextPage = r.headers.get('X-Has-More') === '1' ? String(+next + 1) : '';
        loadLiked();
        if (!feed.dataset.nextPage) end();
      } catch { toast('โหลดโพสต์เพิ่มไม่สำเร็จ'); }
      finally { loading = false; }
    }, { rootMargin: '600px' });

    if (!feed.dataset.nextPage) end(); else io.observe(sentinel);
  }

  loadLiked();
})();