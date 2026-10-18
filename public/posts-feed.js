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
      if (!uid) { location.href = '/login?redirect=' + encodeURIComponent(location.pathname + location.search); return; }
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

  // ---------- ความคิดเห็น (เฉพาะหน้าโพสต์เดี่ยว) ----------
  const cbox = document.querySelector('[data-comments-for]');
  const NIV = window.NIV;
  if (cbox && NIV) {
    const { api, el, session } = NIV;
    const slug = cbox.dataset.commentsFor.replace(/^post:/, '');
    const list = document.getElementById('comment-list');
    const form = document.getElementById('comment-box');
    const countEl = document.getElementById('comment-count');
    const s = session();
    const loggedIn = !!(s.token && s.userId);
    let items = [];
    let isAdmin = false;

    const fmt = (ms) => new Date(ms).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

    const draw = () => {
      countEl.textContent = items.length;
      list.replaceChildren();
      if (!items.length) {
        list.append(el('p', 'text-sm text-slate-500 dark:text-neutral-400', 'ยังไม่มีความคิดเห็น มาเป็นคนแรกได้เลย'));
        return;
      }
      for (const c of items) {
        const row = el('div', 'flex gap-3');
        const av = el('a', 'flex-shrink-0');
        av.href = window.NIV.userUrl(c.user_id);
        av.setAttribute('aria-label', 'โปรไฟล์ ' + (c.display_name || c.user_id));
        av.append(window.NIV.avatarEl({ id: c.user_id, display_name: c.display_name, avatar_url: c.avatar_url }, 'w-9 h-9'));
        const body = el('div', 'min-w-0 flex-1 rounded-2xl bg-slate-100 dark:bg-white/5 px-4 py-2.5');
        const head = el('div', 'flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400');
        const nm = el('a', 'font-semibold text-sm text-slate-900 dark:text-white truncate hover:text-amber-500', c.display_name);
        nm.href = window.NIV.userUrl(c.user_id);
        head.append(nm, el('span', '', fmt(c.created_at)));
        if (c.user_id !== s.userId) {
          const rp = el('button', 'text-slate-400 hover:text-amber-500 hover:underline ml-auto', 'รายงาน');
          rp.type = 'button';
          rp.addEventListener('click', () => NIV.reportDialog('comment', c.id));
          head.append(rp);
        }
        if (loggedIn && (c.user_id === s.userId || isAdmin)) {
          const del = el('button', 'text-rose-500 hover:underline' + (c.user_id === s.userId ? ' ml-auto' : ''), 'ลบ');
          del.type = 'button';
          del.addEventListener('click', async () => {
            if (!confirm('ลบความคิดเห็นนี้ใช่ไหม?')) return;
            const r = await api('/api/blog/comment-delete', { method: 'POST', body: { userId: s.userId, commentId: c.id } });
            if (!r.ok) return toast(r.data.error || 'ลบไม่สำเร็จ');
            items = items.filter((x) => x.id !== c.id);
            draw();
          });
          head.append(del);
        }
        body.append(head, el('p', 'mt-1 text-sm whitespace-pre-wrap break-words', c.content));
        row.append(av, body);
        list.append(row);
      }
    };

    if (!loggedIn) {
      const p = el('p', 'text-sm text-slate-600 dark:text-neutral-300');
      const a = el('a', 'text-amber-600 dark:text-amber-400 font-semibold hover:underline', 'เข้าสู่ระบบ');
      a.href = '/login?redirect=' + encodeURIComponent(location.pathname + '#comments');
      p.append(a, ' เพื่อแสดงความคิดเห็น');
      form.append(p);
    } else {
      const ta = el('textarea', 'w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-white/10 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20');
      ta.rows = 3; ta.maxLength = 1000; ta.placeholder = 'เขียนความคิดเห็น...';
      const btn = el('button', 'mt-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold shadow-md shadow-amber-500/25 disabled:opacity-60', 'ส่งความคิดเห็น');
      btn.type = 'button';
      btn.addEventListener('click', async () => {
        const content = ta.value.trim();
        if (!content) return;
        btn.disabled = true;
        const r = await api('/api/blog/comment', { method: 'POST', body: { slug, userId: s.userId, content } });
        btn.disabled = false;
        if (r.status === 401) { location.href = '/login?redirect=' + encodeURIComponent(location.pathname); return; }
        if (!r.ok) return toast(r.data.error || 'ส่งไม่สำเร็จ');
        ta.value = '';
        items.push(r.data.comment);
        draw();
      });
      form.append(ta, btn);
    }

    (async () => {
      const [r, me] = await Promise.all([
        api('/api/blog/comments?slug=' + encodeURIComponent(slug)),
        loggedIn ? api('/api/blog/me?userId=' + encodeURIComponent(s.userId)) : null,
      ]);
      if (me && me.ok) isAdmin = !!me.data.isAdmin;
      items = r.ok ? r.data.comments : [];
      draw();
    })();
  }

  // ปุ่ม "รายงานโพสต์นี้" (หน้าโพสต์เดี่ยว)
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-report-post]');
    if (b && window.NIV) window.NIV.reportDialog('post', b.dataset.reportPost);
  });

  loadLiked();
})();