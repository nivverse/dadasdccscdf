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
  // ปุ่มรีโพสต์: สีเขียวเมื่อรีโพสต์แล้ว
  const paintRepost = (slug, on) => {
    document.querySelectorAll(`[data-repost="${CSS.escape(slug)}"]`).forEach((b) => {
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('text-emerald-500', on);
      if (!b.disabled) b.title = on ? 'ยกเลิกรีโพสต์' : 'รีโพสต์';
    });
  };
  // ปุ่มดินสอแก้ไขโพสต์: เห็นเฉพาะเจ้าของโพสต์
  const revealEdit = () => {
    const uid = getUserId();
    if (!uid) return;
    // รีโพสต์โพสต์ของตัวเองไม่ได้ (เซิร์ฟเวอร์ตรวจอีกชั้น)
    document.querySelectorAll('[data-repost]').forEach((b) => {
      if (b.dataset.author === uid) { b.disabled = true; b.classList.add('opacity-40', 'cursor-not-allowed'); b.title = 'รีโพสต์โพสต์ของตัวเองไม่ได้'; }
    });
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
      (d.reposted || []).forEach((s) => paintRepost(s, true));
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

    const rpBtn = e.target.closest('[data-repost]');
    if (rpBtn) {
      if (!getUserId()) { location.href = '/login?redirect=' + encodeURIComponent(location.pathname + location.search); return; }
      if (rpBtn.disabled) return;
      openRepostMenu(rpBtn);
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


  // ======================= รีโพสต์: เมนู → (เขียนข้อความ) → แอนิเมชันฉลอง =======================
  // กดปุ่ม 🔁 → เมนู "รีโพสต์ / รีโพสต์พร้อมข้อความ" (ถ้ารีโพสต์แล้ว: "ยกเลิกรีโพสต์ / แก้ไขข้อความ")
  // บนมือถือเป็นชีตเลื่อนขึ้นจากด้านล่าง บนจอใหญ่เป็นป๊อปอัปที่ขยายออกจากปุ่ม · สไตล์/คีย์เฟรมอยู่ใน nivread.js (RPCSS)
  const NOTE_MAX = 280;
  const cpLen = (s) => [...s].length;                       // นับเป็นตัวอักษรที่ตามองเห็น (อีโมจิ 1 ตัว = 1) ตรงกับเซิร์ฟเวอร์
  const mk = (tag, cls, text) => { const x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; };
  const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isNarrow = () => typeof matchMedia === 'function' && matchMedia('(max-width: 639px)').matches;
  const RP_ICON = '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>';
  const PEN_ICON = '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>';
  const UNDO_ICON = '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-15-6.7L3 13"/></svg>';

  const toastAction = (msg, label, fn) => {                 // ข้อความแจ้งพร้อมปุ่ม "เลิกทำ" 5 วินาที
    const t = mk('div', 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-3 pl-4 pr-2 py-2 rounded-xl bg-slate-900 text-white text-sm shadow-lg');
    t.append(mk('span', '', msg));
    const b = mk('button', 'px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-semibold cursor-pointer', label); b.type = 'button';
    b.addEventListener('click', () => { t.remove(); fn(); });
    t.append(b); document.body.appendChild(t); setTimeout(() => t.remove(), 5000);
  };

  const rpAll = (slug) => [...document.querySelectorAll(`[data-repost="${CSS.escape(slug)}"]`)];
  const rpCounters = (slug) => [...document.querySelectorAll(`[data-repost-count="${CSS.escape(slug)}"]`)];
  const rpOn = (slug) => { const b = rpAll(slug)[0]; return !!b && b.getAttribute('aria-pressed') === 'true'; };
  const rpBase = (slug) => parseInt((rpCounters(slug)[0] || {}).textContent, 10) || 0;
  function rpApply(slug, on, count, bump) {                 // อัปเดตทุกการ์ดของโพสต์นี้ที่อยู่บนหน้า
    paintRepost(slug, on);
    rpCounters(slug).forEach((n) => {
      n.textContent = count;
      if (bump && !reduced()) { n.classList.remove('rp-bump'); void n.offsetWidth; n.classList.add('rp-bump'); setTimeout(() => n.classList.remove('rp-bump'), 450); }
    });
  }
  function celebrate(btn, on) {                             // ลูกเล่น: ไอคอนหมุน + วงแหวนกระจาย + "+1" ลอยขึ้น + การ์ดเรืองแสง + สั่นเบา ๆ
    if (reduced()) return;
    rpAll(btn.dataset.repost).forEach((b) => {
      b.classList.remove('rp-spin', 'rp-spin-rev', 'rp-ring'); void b.offsetWidth;
      b.classList.add(on ? 'rp-spin' : 'rp-spin-rev'); if (on) b.classList.add('rp-ring');
      setTimeout(() => b.classList.remove('rp-spin', 'rp-spin-rev', 'rp-ring'), 750);
    });
    if (!on) return;
    const r = btn.getBoundingClientRect();
    const plus = mk('div', 'rp-plus', '+1'); plus.style.left = (r.left + r.width / 2) + 'px'; plus.style.top = r.top + 'px';
    document.body.appendChild(plus); setTimeout(() => plus.remove(), 1000);
    const card = btn.closest('article');
    if (card) { card.classList.add('rp-flash'); setTimeout(() => card.classList.remove('rp-flash'), 1000); }
    try { if (navigator.vibrate) navigator.vibrate(12); } catch {}
  }

  async function repostCall(slug, body) {
    const r = await fetch(`${API}/api/blog/repost`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ slug, userId: getUserId(), ...body }) });
    return r.json();
  }
  async function doRepost(btn, slug, note) {                // รีโพสต์ (หรือแก้ข้อความ) — อัปเดตหน้าจอทันที ถ้าพลาดย้อนกลับ
    const was = rpOn(slug), base = rpBase(slug);
    rpApply(slug, true, was ? base : base + 1, !was); if (!was) celebrate(btn, true);
    try {
      const d = await repostCall(slug, { action: 'set', note });
      if (!d.success) { rpApply(slug, was, base, false); toast(d.error || 'ทำรายการไม่สำเร็จ'); return false; }
      rpApply(slug, true, d.repostCount, false);
      if (was) toast('แก้ข้อความแล้ว');
      else if (note) toast('รีโพสต์พร้อมข้อความแล้ว — ผู้ติดตามของคุณจะเห็น');
      else toastAction('รีโพสต์แล้ว — ผู้ติดตามของคุณจะเห็น', 'เลิกทำ', () => doUndo(btn, slug));
      return true;
    } catch { rpApply(slug, was, base, false); toast('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง'); return false; }
  }
  async function doUndo(btn, slug) {
    const was = rpOn(slug), base = rpBase(slug);
    rpApply(slug, false, Math.max(0, base - (was ? 1 : 0)), false); celebrate(btn, false);
    try {
      const d = await repostCall(slug, { action: 'undo' });
      if (!d.success) { rpApply(slug, was, base, false); toast(d.error || 'ทำรายการไม่สำเร็จ'); return; }
      rpApply(slug, false, d.repostCount, false); toast('ยกเลิกรีโพสต์แล้ว');
    } catch { rpApply(slug, was, base, false); toast('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง'); }
  }

  // ---- ชั้นซ้อน (เมนู / ชีตเขียนข้อความ) ----
  let closeOverlay = null;
  function overlay(btn, panel, onBackdrop) {
    const back = mk('div', 'rp-back');
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const close = () => {
      document.removeEventListener('keydown', onKey);
      back.remove(); panel.remove(); closeOverlay = null;
      if (document.body.style) document.body.style.overflow = '';
      try { btn.focus(); } catch {}
    };
    back.addEventListener('click', () => (onBackdrop ? onBackdrop(close) : close()));
    document.addEventListener('keydown', onKey);
    if (document.body.style) document.body.style.overflow = 'hidden';
    document.body.appendChild(back); document.body.appendChild(panel);
    closeOverlay = close;
    return close;
  }

  function openRepostMenu(btn) {
    if (closeOverlay) closeOverlay();
    const slug = btn.dataset.repost, on = btn.getAttribute('aria-pressed') === 'true';
    const narrow = isNarrow();
    const menu = mk('div', (narrow ? 'rp-sheet rounded-t-3xl p-3 pb-6' : 'rp-menu rounded-2xl p-1.5') + ' bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 shadow-2xl');
    menu.setAttribute('role', 'menu');
    if (narrow) menu.append(mk('div', 'mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 dark:bg-white/20'));
    const item = (iconHtml, title, sub, fn, tone) => {
      const b = mk('button', 'w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer'); b.type = 'button'; b.setAttribute('role', 'menuitem');
      const ic = mk('span', 'flex-shrink-0 w-9 h-9 grid place-items-center rounded-full ' + (tone || 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400')); ic.innerHTML = iconHtml;
      const tx = mk('span', 'min-w-0'); tx.append(mk('span', 'block text-sm font-semibold text-slate-900 dark:text-white', title), mk('span', 'block text-xs text-slate-500 dark:text-neutral-400', sub));
      b.append(ic, tx); b.addEventListener('click', () => { close(); fn(); });
      return b;
    };
    const goNote = async (editing) => {
      let note = '';
      if (editing) {
        try { const r = await fetch(`${API}/api/blog/repost-note?slug=${encodeURIComponent(slug)}&userId=${encodeURIComponent(getUserId())}`); const d = await r.json(); note = d.note || ''; } catch {}
      }
      openComposer(btn, { note, editing });
    };
    if (!on) {
      menu.append(item(RP_ICON, 'รีโพสต์', 'แชร์ให้ผู้ติดตามของคุณทันที', () => doRepost(btn, slug, '')));
      menu.append(item(PEN_ICON, 'รีโพสต์พร้อมข้อความ', 'เพิ่มความเห็นของคุณ (ไม่เกิน ' + NOTE_MAX + ' ตัวอักษร)', () => goNote(false), 'bg-amber-500/10 text-amber-600 dark:text-amber-400'));
    } else {
      menu.append(item(PEN_ICON, 'เพิ่ม / แก้ไขข้อความ', 'ปรับความเห็นที่แนบกับรีโพสต์นี้', () => goNote(true), 'bg-amber-500/10 text-amber-600 dark:text-amber-400'));
      menu.append(item(UNDO_ICON, 'ยกเลิกรีโพสต์', 'ลบออกจากโปรไฟล์และฟีดของผู้ติดตาม', () => doUndo(btn, slug), 'bg-rose-500/10 text-rose-500'));
    }
    if (!narrow) {                                           // ป๊อปอัป: วางใกล้ปุ่ม และขยายออกจากจุดที่กด
      const r = btn.getBoundingClientRect(), W = 256, H = 140, vw = typeof innerWidth === 'number' ? innerWidth : 1024, vh = typeof innerHeight === 'number' ? innerHeight : 768;
      const left = Math.max(8, Math.min(r.left, vw - W - 8));
      const above = r.top > H + 16 || r.bottom + H + 16 > vh;
      menu.style.left = left + 'px'; menu.style.top = (above ? Math.max(8, r.top - H - 8) : r.bottom + 8) + 'px';
      menu.style.setProperty('--ox', Math.max(0, r.left + r.width / 2 - left) + 'px'); menu.style.setProperty('--oy', above ? '100%' : '0%');
    }
    const close = overlay(btn, menu);
  }

  function openComposer(btn, { note = '', editing = false } = {}) {
    if (closeOverlay) closeOverlay();
    const slug = btn.dataset.repost;
    const card = btn.closest('article');
    const q = (sel) => { try { const x = card && card.querySelector(sel); return x ? x.textContent.trim() : ''; } catch { return ''; } };
    const pv = { title: q('h1, h2'), author: q('a.font-semibold'), excerpt: q('.line-clamp-3') };

    const sheet = mk('div', 'rp-sheet rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#161616] border border-slate-200 dark:border-white/10 shadow-2xl');
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', 'รีโพสต์พร้อมข้อความ');
    const head = mk('div', 'flex items-center justify-between px-5 pt-4 pb-2');
    const ttl = mk('div', 'flex items-center gap-2 font-bold text-slate-900 dark:text-white'); const ti = mk('span', 'text-emerald-500'); ti.innerHTML = RP_ICON; ttl.append(ti, mk('span', '', editing ? 'แก้ไขข้อความรีโพสต์' : 'รีโพสต์พร้อมข้อความ'));
    const x = mk('button', 'w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'ปิด');
    head.append(ttl, x);

    const body = mk('div', 'px-5 pb-2');
    const ta = mk('textarea', 'w-full resize-none rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:border-emerald-500/70 focus:outline-none px-4 py-3 text-[15px] leading-relaxed text-slate-900 dark:text-white placeholder:text-slate-400 transition-colors');
    ta.rows = 3; ta.placeholder = 'เพิ่มความเห็นของคุณ… (เว้นว่างไว้ก็ได้)'; ta.value = note; ta.setAttribute('aria-label', 'ข้อความรีโพสต์');
    const chips = mk('div', 'mt-2 flex flex-wrap gap-2');
    ['🔥 ต้องอ่านเลย', '😂 ฮาจัด', '🤔 น่าคิด', '👏 เห็นด้วย', '😭 ซึ้ง'].forEach((c) => {
      const b = mk('button', 'rp-chip px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 cursor-pointer', c); b.type = 'button';
      b.addEventListener('click', () => { ta.value = ta.value && !/\s$/.test(ta.value) ? ta.value + ' ' + c : ta.value + c; sync(); try { ta.focus(); } catch {} });
      chips.append(b);
    });
    const prev = mk('div', 'mt-3 rounded-2xl border border-slate-200 dark:border-white/10 border-l-4 border-l-emerald-500 bg-white/60 dark:bg-white/[0.03] px-4 py-3');
    if (pv.author) prev.append(mk('div', 'text-xs font-semibold text-slate-500 dark:text-neutral-400', pv.author));
    if (pv.title) prev.append(mk('div', 'mt-0.5 text-sm font-bold text-slate-900 dark:text-white line-clamp-2', pv.title));
    if (pv.excerpt) prev.append(mk('div', 'mt-1 text-xs text-slate-600 dark:text-neutral-300 line-clamp-2', pv.excerpt));
    body.append(ta, chips, prev);

    const foot = mk('div', 'flex items-center justify-between gap-3 px-5 pt-3 pb-5');
    const meter = mk('div', 'flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400');
    const ring = mk('span', 'inline-block w-6 h-6'); const left = mk('span', 'tabular-nums'); meter.append(ring, left);
    const btns = mk('div', 'flex items-center gap-2');
    const cancel = mk('button', 'px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer', 'ยกเลิก'); cancel.type = 'button';
    const go = mk('button', 'rp-go px-5 py-2 rounded-xl text-sm font-bold text-white shadow-md shadow-emerald-500/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed', editing ? 'บันทึก' : 'รีโพสต์'); go.type = 'button';
    btns.append(cancel, go); foot.append(meter, btns);
    sheet.append(head, body, foot);

    let busy = false;
    function sync() {                                       // วงนับตัวอักษร: เขียว → เหลือง (เหลือ ≤ 40) → แดง (เกิน)
      const n = cpLen(ta.value), rest = NOTE_MAX - n, frac = Math.min(1, n / NOTE_MAX);
      const col = rest < 0 ? '#f43f5e' : rest <= 40 ? '#f59e0b' : '#10b981', C = 62.83;
      ring.innerHTML = `<svg viewBox="0 0 24 24" class="w-6 h-6 -rotate-90"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-opacity=".15" stroke-width="3"/><circle cx="12" cy="12" r="10" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${(C * (1 - frac)).toFixed(2)}"/></svg>`;
      left.textContent = rest <= 40 ? String(rest) : '';
      left.style.color = rest < 0 ? '#f43f5e' : '';
      go.disabled = busy || rest < 0;
    }
    ta.addEventListener('input', sync); sync();
    const submit = async () => {
      if (busy || cpLen(ta.value) > NOTE_MAX) return;
      busy = true; go.textContent = 'กำลังรีโพสต์…'; sync();
      const ok = await doRepost(btn, slug, ta.value.trim());
      busy = false; go.textContent = editing ? 'บันทึก' : 'รีโพสต์';
      if (ok) close(); else sync();
    };
    go.addEventListener('click', submit);
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } });
    const close = overlay(btn, sheet, (cl) => { if (!ta.value.trim() || ta.value === note || confirm('ทิ้งข้อความที่เขียนไว้?')) cl(); });
    x.addEventListener('click', close); cancel.addEventListener('click', close);
    setTimeout(() => { try { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } catch {} }, 60);
  }

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
      const sk = window.NIV && NIV.skel ? NIV.skel(2) : null; if (sk) feed.after(sk);
      try {
        const r = await fetch(`${feed.dataset.base || '/posts'}?page=${next}&partial=1`);
        if (!r.ok) throw new Error();
        feed.insertAdjacentHTML('beforeend', await r.text());
        feed.dataset.nextPage = r.headers.get('X-Has-More') === '1' ? String(+next + 1) : '';
        loadLiked();
        if (!feed.dataset.nextPage) end();
      } catch { toast('โหลดโพสต์เพิ่มไม่สำเร็จ'); }
      finally { loading = false; sk && sk.remove(); }
    }, { rootMargin: '600px' });

    if (!feed.dataset.nextPage) end(); else io.observe(sentinel);
  }

  // ความคิดเห็น: ย้ายไปอยู่ใน /comments.js แล้ว

  // ปุ่ม "รายงานโพสต์นี้" (หน้าโพสต์เดี่ยว)
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-report-post]');
    if (b && window.NIV) window.NIV.reportDialog('post', b.dataset.reportPost);
  });

  window.NIV_refreshFeed = loadLiked; // ให้ /home-feed.js เรียกหลังเติมโพสต์ (ระบายไลก์ + ปุ่มแก้ไข)
  loadLiked();
})();