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

  if (!document.getElementById('niv-likepop')) {
    const st = document.createElement('style');
    st.id = 'niv-likepop';
    st.textContent = '@keyframes like-pop{0%{transform:scale(1)}40%{transform:scale(1.35)}100%{transform:scale(1)}}.like-pop svg{animation:like-pop .35s ease}@media (prefers-reduced-motion:reduce){.like-pop svg{animation:none}}';
    document.head.appendChild(st);
  }

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
  // ปุ่มดินสอแก้ไขโพสต์: เห็นเฉพาะเจ้าของโพสต์
  const revealEdit = () => {
    const uid = getUserId();
    if (!uid) return;
    document.querySelectorAll('[data-edit-post]').forEach((a) => {
      if (a.dataset.author === uid) { a.classList.remove('hidden'); a.classList.add('grid'); }
    });
  };
  const loadLiked = async () => {
    revealEdit();
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
      if (!uid) { location.href = '/login?redirect=' + encodeURIComponent(location.pathname + location.search); return; }
      const slug = likeBtn.dataset.like;
      if (likeBtn.dataset.busy) return;
      likeBtn.dataset.busy = '1';
      // อัปเดตหน้าจอทันที (ไม่รอเซิร์ฟเวอร์) แล้วค่อยเทียบผลจริง ถ้าพลาดจะย้อนกลับ
      const was = likeBtn.getAttribute('aria-pressed') === 'true';
      const counters = [...document.querySelectorAll(`[data-like-count="${CSS.escape(slug)}"]`)];
      const before = counters.map((n) => n.textContent);
      const base = parseInt(before[0], 10) || 0;
      paint(slug, !was);
      counters.forEach((n) => (n.textContent = Math.max(0, base + (was ? -1 : 1))));
      if (!was) { likeBtn.classList.add('like-pop'); setTimeout(() => likeBtn.classList.remove('like-pop'), 350); }
      const revert = () => { paint(slug, was); counters.forEach((n, i) => (n.textContent = before[i])); };
      try {
        const r = await fetch(`${API}/api/blog/like`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ slug, userId: uid }),
        });
        const d = await r.json();
        if (!d.success) { revert(); return toast(d.error || 'ทำรายการไม่สำเร็จ'); }
        paint(slug, d.liked);
        counters.forEach((n) => (n.textContent = d.likeCount));
      } catch { revert(); toast('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง'); }
      finally { delete likeBtn.dataset.busy; }
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


  // ---------- กล่อง "เขียนอะไรดี" บนสุดของฟีด ----------
  const composer = document.getElementById('composer');
  if (composer && window.NIV) {
    const { session, el, avatarEl, userUrl } = window.NIV;
    const s = session();
    const loggedIn = !!(s.token && s.userId);
    const card = el('div', 'rounded-2xl bg-white/85 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-md shadow-sm p-3 sm:p-4 flex items-center gap-3');
    if (loggedIn) {
      const av = el('a', 'flex-shrink-0'); av.href = userUrl(s.userId); av.setAttribute('aria-label', 'โปรไฟล์ของฉัน');
      av.append(avatarEl({ id: s.userId, display_name: s.name, avatar_url: s.avatar }, 'w-11 h-11'));
      const go = el('a', 'flex-1 min-w-0 px-4 py-2.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-500 dark:text-neutral-400 hover:border-amber-500/60 hover:text-amber-600 dark:hover:text-amber-400 transition-colors truncate', 'เขียนอะไรดี' + (s.name ? ', ' + s.name : '') + '?');
      go.href = '/write';
      const pen = el('a', 'flex-shrink-0 w-10 h-10 grid place-items-center rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25 hover:brightness-110');
      pen.href = '/write'; pen.setAttribute('aria-label', 'เขียนโพสต์'); pen.title = 'เขียนโพสต์';
      pen.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>';
      card.append(av, go, pen);
    } else {
      const go = el('a', 'flex-1 min-w-0 px-4 py-2.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-500 dark:text-neutral-400 hover:border-amber-500/60 hover:text-amber-600 dark:hover:text-amber-400 transition-colors truncate', 'เข้าสู่ระบบเพื่อเขียนโพสต์ของคุณ');
      go.href = '/login?redirect=/write';
      card.append(go);
    }
    composer.append(card);
  }

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

  // ความคิดเห็น: ย้ายไปอยู่ใน /comments.js แล้ว

  // ปุ่ม "รายงานโพสต์นี้" (หน้าโพสต์เดี่ยว)
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-report-post]');
    if (b && window.NIV) window.NIV.reportDialog('post', b.dataset.reportPost);
  });

  loadLiked();
})();