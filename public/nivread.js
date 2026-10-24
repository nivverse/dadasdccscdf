// public/nivread.js — header (แถบบน + ปุ่มแฮมเบอร์เกอร์ + เมนูข้าง + ค้นหา) / footer
// และตัวช่วยกลาง window.NIV สำหรับทุกหน้าของ nivread
(() => {
  const API = 'https://api.fnnz.art';

  const ls = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const session = () => ({ token: ls('token'), userId: ls('userId'), name: ls('userName'), avatar: ls('userAvatar') });
  const logout = () => {
    ['token', 'userId', 'userEmail', 'userName', 'userAvatar'].forEach((k) => { try { localStorage.removeItem(k); } catch {} });
    try { window.google?.accounts?.id?.disableAutoSelect(); } catch {}
    location.href = '/';
  };
  const userUrl = (id) => '/user?id=' + encodeURIComponent(id);
  const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // เรียก API พร้อมแนบ token อัตโนมัติ
  async function api(path, opts = {}) {
    const s = session();
    const headers = { 'Content-Type': 'application/json' };
    if (s.token) headers.Authorization = 'Bearer ' + s.token;
    const res = await fetch(API + path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch {}
    return { ok: res.ok && data.success !== false, status: res.status, data };
  }

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // รูปโปรไฟล์ (หรืออักษรตัวแรก) ใช้ซ้ำทั้งเว็บ — ไม่ใช้ innerHTML จึงไม่เสี่ยง XSS
  function avatarEl(user, size = 'w-9 h-9') {
    const name = String(user?.display_name || user?.id || '?');
    const ok = user?.avatar_url && /^https?:\/\//.test(user.avatar_url);
    if (ok) {
      return Object.assign(el('img', `${size} rounded-full object-cover flex-shrink-0 ring-2 ring-amber-500/40`),
        { src: user.avatar_url, alt: name, loading: 'lazy', referrerPolicy: 'no-referrer' });
    }
    return el('div', `${size} rounded-full bg-gradient-to-br from-amber-500 to-orange-500 grid place-items-center text-white font-bold flex-shrink-0`, name.charAt(0).toUpperCase());
  }

  const ago = (ms) => {
    const sec = Math.max(1, ((Date.now() - ms) / 1000) | 0);
    if (sec < 60) return 'เมื่อสักครู่';
    const m = (sec / 60) | 0; if (m < 60) return `${m} นาทีที่แล้ว`;
    const h = (m / 60) | 0; if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
    const d = (h / 24) | 0; if (d < 7) return `${d} วันที่แล้ว`;
    return new Date(ms).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // ---------- ปุ่มติดตาม (ผู้ใช้ / หมวดหมู่) ใช้ร่วมกันทั้งเว็บ ----------
  // ปุ่มใดก็ตามที่มี data-follow-type + data-follow-target จะถูกระบายสถานะและกดได้เอง (รวมปุ่มที่เพิ่มเข้ามาภายหลัง)
  const FBCSS = `.fb{cursor:pointer;font-weight:600;transition:color .2s,background .2s,border-color .2s,opacity .2s;white-space:nowrap}
.fb[hidden]{display:none}
.fb-link{font-size:.75rem;color:#d97706;padding:.1rem .45rem;border-radius:999px}
.fb-link:hover{background:rgba(245,158,11,.14)}
.fb-link[aria-pressed=true]{color:#94a3b8;font-weight:500}
.fb-pill{padding:.5rem 1.1rem;border-radius:.75rem;font-size:.875rem;color:#fff;background:linear-gradient(to right,#f59e0b,#f97316);box-shadow:0 6px 16px -6px rgba(245,158,11,.55)}
.fb-pill:hover{filter:brightness(1.08)}
.fb-pill[aria-pressed=true]{background:transparent;color:#64748b;border:1px solid rgba(148,163,184,.55);box-shadow:none}
.fb-chip{padding:.3rem .8rem;border-radius:999px;font-size:.8rem;color:#d97706;border:1px solid rgba(245,158,11,.4);background:rgba(245,158,11,.08)}
.fb-chip[aria-pressed=true]{color:#fff;border-color:transparent;background:linear-gradient(to right,#f59e0b,#f97316)}
.fb-plus{display:inline-flex;align-items:center;justify-content:center;height:1.5rem;padding:0 .2rem;margin-left:.1rem;border:0;background:none;font-size:1.6rem;font-weight:500;line-height:1;color:#d97706;flex-shrink:0}
.fb-plus:hover{color:#f59e0b}
.fb[disabled]{opacity:.6;cursor:default}`;
  if (!document.getElementById('niv-fb')) {
    const st = document.createElement('style'); st.id = 'niv-fb'; st.textContent = FBCSS; document.head.appendChild(st);
  }

  // ---------- skeleton โหลด (แทนข้อความ "กำลังโหลด...") ----------
  const SKCSS = `.sk-b{position:relative;overflow:hidden;background:#ecece7;border-radius:12px}
.dark .sk-b{background:rgba(255,255,255,.07)}
.sk-b::after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.65),transparent);animation:sk-sh 1.4s ease-in-out infinite}
.dark .sk-b::after{background:linear-gradient(90deg,transparent,rgba(255,255,255,.09),transparent)}
@keyframes sk-sh{100%{transform:translateX(100%)}}
.sk-card{border-radius:16px;overflow:hidden;padding:1rem;border:1px solid rgba(148,163,184,.25);background:rgba(255,255,255,.6)}
.dark .sk-card{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.03)}
@media (prefers-reduced-motion:reduce){.sk-b::after{animation:none}}`;
  if (!document.getElementById('niv-sk')) {
    const st = document.createElement('style'); st.id = 'niv-sk'; st.textContent = SKCSS; document.head.appendChild(st);
  }
  const skB = (cls) => `<div class="sk-b ${cls}"></div>`;
  // kind: 'card' = โพสต์ในฟีด, 'comment' = ความคิดเห็น
  const skelHtml = (n = 3, kind = 'card') => Array.from({ length: n }, (_, i) => kind === 'comment'
    ? `<div class="flex gap-3">${skB('w-9 h-9 !rounded-full flex-shrink-0')}<div class="flex-1 space-y-2">${skB('h-3 w-1/3')}${skB('h-3 w-full')}${skB('h-3 w-2/3')}</div></div>`
    : `<div class="sk-card"><div class="flex items-center gap-3">${skB('w-11 h-11 !rounded-full flex-shrink-0')}<div class="flex-1 space-y-2">${skB('h-3 w-1/3')}${skB('h-3 w-1/5')}</div></div>
<div class="mt-4 space-y-2">${skB('h-4 w-4/5')}${skB('h-3 w-full')}${skB('h-3 w-3/5')}</div>${i % 2 === 0 ? skB('mt-4 w-full aspect-[4/3]') : ''}</div>`).join('');
  const skel = (n = 3, kind = 'card') => {
    const d = el('div', kind === 'comment' ? 'space-y-5' : 'space-y-6');
    d.setAttribute('aria-hidden', 'true'); d.dataset.skel = '1'; d.innerHTML = skelHtml(n, kind);
    return d;
  };

  const F = { users: new Set(), cats: new Set(), loading: null };
  const fbBtn = (type, target, variant = 'link', name = '') => {
    const b = el('button', 'fb fb-' + variant, variant === 'plus' ? '+' : 'ติดตาม');
    if (variant === 'plus') { b.title = 'ติดตาม'; b.setAttribute('aria-label', 'ติดตาม ' + (name || target)); }
    b.type = 'button'; b.dataset.followType = type; b.dataset.followTarget = target;
    if (name) b.dataset.followName = name;
    b.setAttribute('aria-pressed', 'false');
    return b;
  };
  const fKey = (type, t) => (type === 'user' ? String(t) : String(t).toLowerCase());
  const fSet = (type) => (type === 'user' ? F.users : F.cats);
  function paintFollows(root = document) {
    const me = session().userId;
    root.querySelectorAll('[data-follow-type]').forEach((b) => {
      const type = b.dataset.followType, t = b.dataset.followTarget;
      if (type === 'user' && me && t === me) { b.hidden = true; return; } // ติดตามตัวเองไม่ได้
      const on = fSet(type).has(fKey(type, t));
      if (b.classList.contains('fb-plus')) { b.hidden = on; b.setAttribute('aria-pressed', on ? 'true' : 'false'); if (!b.textContent) b.textContent = '+'; return; } // ปุ่ม + ในฟีด: กดแล้วหายไป
      b.hidden = false;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      const label = b.classList.contains('fb-chip')
        ? (on ? '✓ ' : '+ ') + (b.dataset.followName || t)
        : (on ? 'กำลังติดตาม' : 'ติดตาม');
      if (b.textContent !== label) b.textContent = label;
    });
  }
  function loadFollows() {
    const s = session();
    if (!s.token || !s.userId) return Promise.resolve();
    if (!F.loading) {
      F.loading = api('/api/blog/following?userId=' + encodeURIComponent(s.userId)).then((r) => {
        if (r.ok) {
          F.users = new Set(r.data.users || []);
          F.cats = new Set((r.data.categories || []).map((x) => String(x).toLowerCase()));
        }
        paintFollows();
      }).catch(() => {});
    }
    return F.loading;
  }
  const countEls = (type, key) => [...document.querySelectorAll('[data-follower-count]')].filter((n) => n.dataset.followerCount === type + ':' + key);
  const setCount = (type, key, v) => countEls(type, key).forEach((n) => { n.textContent = Math.max(0, v).toLocaleString('th-TH'); });
  const bumpCount = (type, key, d) => countEls(type, key).forEach((n) => { n.textContent = Math.max(0, (parseInt(String(n.textContent).replace(/[^\d]/g, ''), 10) || 0) + d).toLocaleString('th-TH'); });

  function toast(msg) {
    const t = el('div', 'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm shadow-lg', msg);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-follow-type]');
    if (!b) return;
    e.preventDefault();
    const s = session();
    if (!s.token || !s.userId) { location.href = '/login?redirect=' + encodeURIComponent(location.pathname + location.search); return; }
    if (b.dataset.busy) return;
    const type = b.dataset.followType, target = b.dataset.followTarget, key = fKey(type, target);
    await loadFollows();
    const set = fSet(type);
    const was = set.has(key);
    // อัปเดตหน้าจอทันที แล้วค่อยเทียบผลจริง ถ้าพลาดจะย้อนกลับ
    if (was) set.delete(key); else set.add(key);
    paintFollows(); bumpCount(type, key, was ? -1 : 1);
    b.dataset.busy = '1';
    const revert = () => { if (was) set.add(key); else set.delete(key); paintFollows(); bumpCount(type, key, was ? 1 : -1); };
    try {
      const r = await api('/api/blog/follow', { method: 'POST', body: { userId: s.userId, type, target } });
      if (!r.ok) { revert(); toast(r.data.error || 'ทำรายการไม่สำเร็จ'); }
      else {
        if (r.data.following) set.add(key); else set.delete(key);
        paintFollows(); setCount(type, key, r.data.followers || 0);
      }
    } catch { revert(); toast('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง'); }
    finally { delete b.dataset.busy; }
  });

  // ปุ่มที่ถูกเพิ่มเข้าหน้าภายหลัง (เลื่อนโหลดเพิ่ม / การ์ดที่เรนเดอร์ฝั่งเบราว์เซอร์) ระบายสถานะให้อัตโนมัติ
  // ตัวเฝ้า DOM ตัวเดียวของทั้งหน้า สำหรับงานสแกน "โหนดใหม่" ทุกชนิด (ปุ่มติดตาม / วิดีโอ / แถบความคืบหน้า / นับวิว)
  // เดิมแต่ละงานมี MutationObserver ของตัวเอง และถูกปลุกทุกเฟรมจากตัวเลขเวลาของวิดีโอที่กำลังเล่น → querySelectorAll ทั้งเอกสารซ้ำ ๆ ยิ่งเลื่อนโหลดโพสต์เพิ่มยิ่งหนัก
  // ตอนนี้: ทำงานเฉพาะเมื่อมี "Element ใหม่" เข้ามาใน DOM จริง ๆ และรวมเป็นรอบละเฟรม
  const domScans = [];
  let domScanQueued = false;
  const runDomScans = () => { domScanQueued = false; domScans.forEach((fn) => { try { fn(); } catch {} }); };
  function onNewNodes(fn) {
    domScans.push(fn);
    if (domScans.length > 1) return;
    new MutationObserver((recs) => {
      if (domScanQueued) return;
      for (const m of recs) {
        for (const x of m.addedNodes) if (x.nodeType === 1) { domScanQueued = true; requestAnimationFrame(runDomScans); return; }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  onNewNodes(paintFollows);
  paintFollows();
  loadFollows();

  // การ์ดโพสต์สำหรับหน้าที่เรนเดอร์ฝั่งเบราว์เซอร์ (ค้นหา / โปรไฟล์ผู้ใช้) — หน้าฟีดหลักเรนเดอร์ฝั่งเซิร์ฟเวอร์เพื่อ SEO
  function postCardEl(p) {
    const card = el('article', 'rounded-2xl bg-white/85 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-md shadow-sm overflow-hidden');
    card.dataset.viewSlug = p.slug;
    const head = el('div', 'flex items-center gap-3 p-4');
    const who = { id: p.author_id, display_name: p.display_name, avatar_url: p.avatar_url };
    const a1 = el('a', 'flex-shrink-0'); a1.href = userUrl(p.author_id); a1.append(avatarEl(who, 'w-11 h-11')); a1.setAttribute('aria-label', 'โปรไฟล์ ' + (p.display_name || p.author_id));
    const meta = el('div', 'min-w-0');
    const nameRow = el('div', 'flex items-center gap-1 min-w-0');
    const a2 = el('a', 'font-semibold text-sm truncate hover:text-amber-500', p.display_name || p.author_id); a2.href = userUrl(p.author_id);
    nameRow.append(a2);
    const sub = el('div', 'text-xs text-slate-500 dark:text-neutral-400', ago(p.published_at));
    if (p.category) { const ca = el('a', 'ml-2 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors', p.category); ca.href = '/category/' + encodeURIComponent(p.category); sub.append(ca); }
    meta.append(nameRow, sub);
    head.append(a1, meta);
    if (session().userId && session().userId === p.author_id) {
      const pen = el('a', 'ml-auto flex-shrink-0 w-9 h-9 grid place-items-center rounded-full text-slate-500 dark:text-neutral-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors');
      pen.href = '/write?edit=' + encodeURIComponent(p.slug); pen.title = 'แก้ไขโพสต์'; pen.setAttribute('aria-label', 'แก้ไขโพสต์');
      pen.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>';
      head.append(pen);
    }
    card.append(head);

    const body = el('div', 'px-4 pb-3');
    const h = el('h2', 'text-lg font-bold leading-snug');
    const ha = el('a', 'hover:text-amber-500 transition-colors', p.title); ha.href = '/posts/' + p.slug;
    h.append(ha); body.append(h);
    if (p.excerpt) {
      const ex = el('p', 'mt-1 text-sm text-slate-600 dark:text-neutral-300 line-clamp-3');
      const exa = el('a', 'block hover:text-amber-500 transition-colors', p.excerpt); exa.href = '/posts/' + p.slug;
      ex.append(exa); body.append(ex);
    }
    if ((p.content_len || 0) > 160) {
      const more = el('a', 'inline-block mt-1 px-2 -ml-2 text-lg leading-none tracking-widest text-amber-600 dark:text-amber-400 hover:text-amber-500', '...'); more.href = '/posts/' + p.slug; more.setAttribute('aria-label', 'อ่านโพสต์ต่อ'); more.title = 'อ่านโพสต์ต่อ';
      body.append(more);
    }
    card.append(body);

    const imgs = (Array.isArray(p.images) && p.images.length ? p.images : (p.cover_url ? [p.cover_url] : []));
    const vid = videoEl(p.videos, p.title, '/posts/' + p.slug);
    if (vid) card.append(vid);
    else { const gal = galleryEl(imgs, p.title, '/posts/' + p.slug); if (gal) card.append(gal); }
    const foot = el('div', 'px-4 py-3 flex items-center gap-4 text-xs text-slate-500 dark:text-neutral-400');
    foot.append(el('span', '', '♥ ' + (p.like_count || 0)));
    if (p.view_count != null) foot.append(el('span', '', '👁 ' + Number(p.view_count || 0).toLocaleString('th-TH')));
    const ca2 = el('a', 'hover:opacity-70', (p.comment_count || 0) + ' ความคิดเห็น'); ca2.href = '/posts/' + p.slug + '#comments';
    foot.append(ca2);
    card.append(foot);
    return card;
  }


  const VGCSS = `
.uv video{display:block;width:100%;height:auto;max-height:36rem;background:#000;border-radius:16px;object-fit:contain}
.uv+.uv{margin-top:.75rem}
.vg-more-u{display:inline-block;margin-top:.5rem;font-size:.8rem;color:#d97706}
.vg{margin:0 1rem 1.5rem}
.vg.vg-c{margin:0 0 .25rem;padding:0 1rem}
.vg-frame{border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.08)}
.vg-head{display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem;font-weight:700}
.vg-head .vg-dot{width:.5rem;height:.5rem;border-radius:999px;background:#f59e0b;box-shadow:0 0 12px #f59e0b}
.vg-in{background:#0a0a0a}
.vg-bar{display:flex;align-items:center;gap:.6rem;padding:.5rem .85rem;background:linear-gradient(180deg,#171717,#0f0f0f);border-bottom:1px solid rgba(255,255,255,.07)}
.vg-tag{font-size:.6rem;letter-spacing:.2em;color:#a3a3a3;border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:.1rem .5rem}
.vg-count{margin-left:auto;font-size:.75rem;color:#d4d4d4;font-variant-numeric:tabular-nums}
.vg-stage{position:relative;aspect-ratio:16/9;background:#000}
.vg-stage iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.vg-poster{position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;cursor:pointer;background:#000;overflow:hidden}
.vg-poster img.vg-img{width:100%;height:100%;object-fit:cover;transition:transform .6s ease,filter .3s}
.vg-poster:hover img.vg-img{transform:scale(1.06);filter:brightness(1.08)}
.vg-poster::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 35%,rgba(0,0,0,.55)),linear-gradient(0deg,rgba(0,0,0,.55),transparent 45%);pointer-events:none}
.vg-play{position:absolute;left:50%;top:50%;z-index:1;width:84px;height:84px;margin:-42px 0 0 -42px;display:grid;place-items:center;transition:transform .25s}
.vg-play img{width:100%;height:100%;object-fit:contain;background:none;border-radius:0;filter:drop-shadow(0 4px 14px rgba(0,0,0,.6)) drop-shadow(0 0 16px rgba(245,158,11,.75));animation:vg-beat 1.8s ease-in-out infinite}
@keyframes vg-beat{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
.vg-poster:hover .vg-play{transform:scale(1.12)}
.vg-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.7rem;margin-top:.9rem}
@media (min-width:560px){.vg-grid{grid-template-columns:repeat(3,1fr)}}
.vg-grid .vg-t{width:auto;opacity:.75;border-radius:14px}
.vg-grid .vg-t::before{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(0deg,rgba(0,0,0,.6),transparent 55%);pointer-events:none}
.vg-grid .vg-t b{z-index:2}
.vg-eq{position:absolute;right:.45rem;bottom:.4rem;z-index:2;display:none;align-items:flex-end;gap:2px;height:14px}
.vg-eq s{display:block;width:3px;background:#fbbf24;border-radius:2px;animation:vg-eq 1s ease-in-out infinite}
.vg-eq s:nth-child(2){animation-delay:.2s}.vg-eq s:nth-child(3){animation-delay:.4s}
@keyframes vg-eq{0%,100%{height:3px}50%{height:14px}}
.vg-t[aria-current="true"] .vg-eq{display:flex}
.vg-more{margin-left:auto;font-size:.72rem;font-weight:600;color:#fbbf24;padding:.15rem .6rem;border-radius:999px;border:1px solid rgba(251,191,36,.45);background:rgba(245,158,11,.1);transition:background .2s}
.vg-more:hover{background:rgba(245,158,11,.25)}
.vg-strip{display:flex;gap:.6rem;margin-top:.8rem;padding:.25rem .15rem .6rem;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:thin;scrollbar-color:#f59e0b33 transparent}
.vg-t{position:relative;flex:0 0 auto;width:132px;aspect-ratio:16/9;padding:0;border:0;border-radius:12px;overflow:hidden;cursor:pointer;scroll-snap-align:start;opacity:.62;transform:translateY(0);transition:opacity .2s,transform .2s,box-shadow .2s;background:#111}
.vg-t:hover{opacity:1;transform:translateY(-3px)}
.vg-t img{width:100%;height:100%;object-fit:cover;display:block}
.vg-t b{position:absolute;left:.35rem;bottom:.3rem;font-size:.68rem;font-weight:700;color:#fff;background:rgba(0,0,0,.65);border-radius:6px;padding:0 .35rem;font-variant-numeric:tabular-nums}
.vg-t[aria-current="true"]{opacity:1;box-shadow:0 0 0 2px #f59e0b,0 8px 22px rgba(245,158,11,.45)}
@media (max-width:480px){.vg{margin:0 .75rem 1.25rem}.vg-t{width:112px}.vg-play{width:68px;height:68px;margin:-34px 0 0 -34px}}
@media (prefers-reduced-motion:reduce){.vg-play img{animation:none}.vg-poster img.vg-img{transition:none}}
`;


  // ---------- แกลเลอรีรูปแบบ Facebook + ดูรูปเต็ม (lightbox) ----------
  const IMG_OK = /^https:\/\/[^\s"'<>]{4,500}$/;
  function galleryEl(list, title, href) {
    const urls = (Array.isArray(list) ? list : []).filter((x) => IMG_OK.test(x)).slice(0, 10);
    const n = urls.length;
    if (!n) return null;
    const root = el('div', 'gal' + (href ? ' gal-l' : ''));
    const feed = !!href;
    const data = escHtml(JSON.stringify(urls)), alt = escHtml(title || '');
    if (n === 1) {
      root.innerHTML = (feed ? '<a class="gal-s" href="' + escHtml(href) + '" aria-label="เปิดโพสต์ ' + alt + '">' : '<div class="gal-s" data-imgs="' + data + '" data-i="0" role="button" tabindex="0" aria-label="ดูรูปเต็ม">') +
        '<img class="bg" src="' + escHtml(urls[0]) + '" alt="" aria-hidden="true" loading="lazy" decoding="async">' +
        '<img class="fg" src="' + escHtml(urls[0]) + '" alt="' + alt + '" loading="lazy" decoding="async">' + (feed ? '</a>' : '</div>');
    } else {
      root.innerHTML = '<div class="gal-g gal-' + Math.min(n, 5) + '"' + (feed ? '' : ' data-imgs="' + data + '"') + '>' + urls.slice(0, 5).map((u, i) => {
        const more = i === 4 && n > 5;
        const im = '<img src="' + escHtml(u) + '" alt="' + alt + ' รูปที่ ' + (i + 1) + '" loading="lazy" decoding="async">';
        const mo = more ? ' data-more="+' + (n - 5) + '"' : '';
        return feed
          ? '<a class="gal-t' + (more ? ' gal-more' : '') + '" href="' + escHtml(href) + '"' + mo + ' aria-label="เปิดโพสต์ ' + alt + '">' + im + '</a>'
          : '<button type="button" class="gal-t' + (more ? ' gal-more' : '') + '" data-i="' + i + '"' + mo + ' aria-label="ดูรูปที่ ' + (i + 1) + '">' + im + '</button>';
      }).join('') + '</div>';
    }
    return root;
  }

  const GALCSS = `
.gal{margin:.25rem 1rem .75rem}
.gal-s{position:relative;display:flex;justify-content:center;border-radius:16px;overflow:hidden;background:#0a0a0a;cursor:zoom-in}
.gal-s .bg{position:absolute;inset:-24px;width:calc(100% + 48px);height:calc(100% + 48px);object-fit:cover;filter:blur(26px) brightness(.5);pointer-events:none}
.gal-s .fg{position:relative;display:block;width:auto;height:auto;max-width:100%;max-height:36rem;transition:transform .4s ease}
.gal-s:hover .fg{transform:scale(1.015)}
.gal-g{display:grid;gap:4px;border-radius:16px;overflow:hidden}
.gal-t{position:relative;min-height:0;padding:0;border:0;background:#111;cursor:zoom-in;overflow:hidden}
.gal-t img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;transition:transform .45s ease,filter .3s}
.gal-t:hover img{transform:scale(1.05);filter:brightness(1.08)}
.gal-2{grid-template-columns:1fr 1fr;aspect-ratio:4/3}
.gal-3{grid-template-columns:2fr 1fr;grid-template-rows:1fr 1fr;aspect-ratio:4/3}
.gal-3 .gal-t:first-child{grid-row:span 2}
.gal-4{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;aspect-ratio:1/1}
.gal-5{grid-template-columns:repeat(6,1fr);grid-template-rows:3fr 2fr;aspect-ratio:1/1}
.gal-5 .gal-t:nth-child(-n+2){grid-column:span 3}.gal-5 .gal-t:nth-child(n+3){grid-column:span 2}
.gal-s:not(.ok){min-height:11rem}
.gal-s:not(.ok)::before,.gal-t:not(.ok)::before{content:"";position:absolute;inset:0;z-index:0;background:linear-gradient(90deg,#e4e4de 25%,#f2f2ed 50%,#e4e4de 75%) 0 0/200% 100%;animation:gal-sh 1.3s linear infinite}
.dark .gal-s:not(.ok)::before,.dark .gal-t:not(.ok)::before{background:linear-gradient(90deg,#1a1a1a 25%,#262626 50%,#1a1a1a 75%) 0 0/200% 100%}
@keyframes gal-sh{to{background-position:-200% 0}}
@media (prefers-reduced-motion:reduce){.gal-s:not(.ok)::before,.gal-t:not(.ok)::before{animation:none}}
.gal-l .gal-t,.gal-l .gal-s{cursor:pointer}
.gal-more::after{content:attr(data-more);position:absolute;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.55);color:#fff;font-size:1.9rem;font-weight:700;font-family:'Josefin Sans','Kanit',sans-serif}
#niv-lb{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.94);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);animation:lb-in .2s ease}
@keyframes lb-in{from{opacity:0}to{opacity:1}}
#niv-lb img{max-width:100vw;max-height:100dvh;object-fit:contain;padding:3.25rem .5rem;user-select:none;-webkit-user-drag:none;touch-action:pan-y}
#niv-lb button{position:absolute;display:grid;place-items:center;width:44px;height:44px;border-radius:999px;border:0;background:rgba(255,255,255,.12);color:#fff;font-size:1.3rem;cursor:pointer;transition:background .2s}
#niv-lb button:hover{background:rgba(245,158,11,.6)}
#niv-lb .x{top:.75rem;right:.75rem}#niv-lb .p{left:.75rem;top:50%;margin-top:-22px}#niv-lb .n{right:.75rem;top:50%;margin-top:-22px}
#niv-lb .c{position:absolute;top:1.1rem;left:50%;transform:translateX(-50%);color:#e5e5e5;font-size:.85rem;font-variant-numeric:tabular-nums}
@media (max-width:640px){#niv-lb .p,#niv-lb .n{display:none}}
`;
  if (!document.getElementById('niv-gal')) {
    const st = document.createElement('style');
    st.id = 'niv-gal';
    st.textContent = GALCSS;
    if (!document.getElementById('niv-css')) document.head.appendChild(st); // หน้า SSR โหลด /niv.css ใน <head> แล้ว

    // รูปโหลดเสร็จ/พลาด → เอา skeleton ออก
    const markOk = (img) => { const c = img.closest && img.closest('.gal-s,.gal-t'); if (c) c.classList.add('ok'); };
    document.addEventListener('load', (e) => { if (e.target.tagName === 'IMG') markOk(e.target); }, true);
    document.addEventListener('error', (e) => { if (e.target.tagName === 'IMG') markOk(e.target); }, true);
    document.querySelectorAll('.gal img').forEach((im) => { if (im.complete && im.naturalWidth > 0) markOk(im); });

    let lb = null, urls = [], idx = 0;
    const show = () => {
      lb.querySelector('img').src = urls[idx];
      lb.querySelector('.c').textContent = urls.length > 1 ? (idx + 1) + ' / ' + urls.length : '';
      lb.querySelectorAll('.p,.n').forEach((b) => (b.style.display = urls.length > 1 ? '' : 'none'));
      const pre = new Image(); pre.src = urls[(idx + 1) % urls.length];
    };
    const step = (d) => { idx = (idx + d + urls.length) % urls.length; show(); };
    const close = () => { if (!lb) return; lb.remove(); lb = null; document.documentElement.style.overflow = ''; document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); };
    function openLb(list, i) {
      urls = list; idx = i;
      lb = el('div'); lb.id = 'niv-lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'ดูรูปภาพ');
      lb.innerHTML = '<img alt=""><span class="c"></span><button class="x" type="button" aria-label="ปิด">✕</button><button class="p" type="button" aria-label="รูปก่อนหน้า">‹</button><button class="n" type="button" aria-label="รูปถัดไป">›</button>';
      lb.addEventListener('click', (e) => {
        if (e.target.closest('.x') || e.target === lb) return close();
        if (e.target.closest('.p')) return step(-1);
        if (e.target.closest('.n')) return step(1);
      });
      let sx = null;
      lb.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
      lb.addEventListener('touchend', (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 50 && urls.length > 1) step(dx < 0 ? 1 : -1); });
      document.body.append(lb);
      document.documentElement.style.overflow = 'hidden';
      document.addEventListener('keydown', onKey);
      show();
    }
    document.addEventListener('click', (e) => {
      const g = e.target.closest && e.target.closest('[data-imgs]');
      if (!g) return;
      let list; try { list = JSON.parse(g.getAttribute('data-imgs')); } catch { return; }
      list = (Array.isArray(list) ? list : []).filter((x) => IMG_OK.test(x));
      if (!list.length) return;
      const t = e.target.closest('[data-i]');
      openLb(list, Math.min(list.length - 1, parseInt(t ? t.getAttribute('data-i') : g.getAttribute('data-i'), 10) || 0));
    });
    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('gal-s')) { e.preventDefault(); e.target.click(); }
    });
  }

  // ---------- วิดีโอ YouTube (การ์ดในฟีด / หน้าโปรไฟล์ / ค้นหา) — ใช้ CSS ชุดเดียวกับหน้าโพสต์ ----------
  const YT_ID = /^[A-Za-z0-9_-]{11}$/;
  const ytThumb = (id) => 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
  const UP_RE = /^https:\/\/[^\s"'<>]{4,300}\/(?:api\/blog\/vid\/)?v\/[A-Za-z0-9._~%-]{1,180}\/[a-z0-9]{6,40}\.(mp4|webm)$/; // /api/blog/vid/<key> (ผ่าน Worker) หรือ /<key> (โดเมน R2)
  const upPoster = (u) => u.replace(/\.(mp4|webm)$/, '.jpg');
  function uvEl(u, title) {
    const d = el('div', 'uv bp'); const v = document.createElement('video');
    v.controls = true; 
    v.playsInline = true; 
    // ไม่ใส่ autoplay: ให้ IntersectionObserver (ด้านล่าง) สั่งเล่นตอนการ์ดเข้าจอเท่านั้น การ์ดที่ยังไม่ถึงจะไม่โหลดไฟล์วิดีโอ (ประหยัด request ของ Worker/R2)
    v.muted = true;      // <--- จำเป็นต้องปิดเสียงเพื่อให้เบราว์เซอร์ยอมเล่นออโต
    v.loop = true;       // <--- เล่นวนซ้ำ
    v.preload = 'none';     // โหลดแค่ poster ไฟล์วิดีโอจะถูกขอเมื่อเริ่มเล่นจริง
    v.poster = upPoster(u); 
    v.src = u; 
    v.setAttribute('aria-label', title || 'วิดีโอ');
    d.append(v); return d;
  }
  function videoEl(ids, title, href) {
    const list = (Array.isArray(ids) ? ids : []).filter((x) => YT_ID.test(x) || UP_RE.test(String(x))).slice(0, 15);
    if (!list.length) return null;
    if (UP_RE.test(list[0])) {
      const root = el('section', 'vg vg-c'); root.setAttribute('aria-label', 'วิดีโอ'); root.append(uvEl(list[0], title));
      if (list.length > 1) { const m = el('a', 'vg-more vg-more-u', 'ดูทั้งหมด ' + list.length + ' คลิป'); m.href = href || '#'; root.append(m); }
      return root;
    }
    const root = el('section', 'vg vg-c');
    root.dataset.title = title || '';
    root.setAttribute('aria-label', 'วิดีโอ');
    root.innerHTML =
      '<div class="vg-frame"><div class="vg-in"><div class="vg-bar"><span class="vg-tag">PLAYER</span>' +
      (list.length > 1 ? '<a class="vg-more">ดูทั้งหมด ' + list.length + ' คลิป</a>' : '') + '</div>' +
      '<div class="vg-stage"><button type="button" class="vg-poster" data-id="' + list[0] + '" aria-label="เล่นวิดีโอ">' +
      '<img class="vg-img" src="' + ytThumb(list[0]) + '" alt="" loading="lazy" decoding="async">' +
      '<span class="vg-play"><img src="/img/nivreadfavon.png" alt=""></span>' +
      '</button></div></div></div>';
    root.querySelector('.vg-img').alt = title || '';
    const more = root.querySelector('.vg-more'); if (more) more.href = href || '#';
    return root;
  }

  if (!document.getElementById('niv-vg')) {
    const st = document.createElement('style');
    st.id = 'niv-vg';
    st.textContent = VGCSS;
    if (!document.getElementById('niv-css')) document.head.appendChild(st);
    document.addEventListener('click', (e) => {
      const root = e.target.closest && e.target.closest('.vg'); if (!root) return;
      const p = e.target.closest('.vg-poster'), t = e.target.closest('.vg-t');
      if (!p && !t) return;
      const ts = [].slice.call(root.querySelectorAll('.vg-t'));
      const id = (p || t).getAttribute('data-id'), i = t ? ts.indexOf(t) : 0;
      if (!YT_ID.test(id)) return;
      const stage = root.querySelector('.vg-stage'), strip = root.querySelector('.vg-strip'), count = root.querySelector('.vg-count');
      const grid = root.querySelector('.vg-grid');
      const f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
      f.title = (root.dataset.title || 'วิดีโอ') + ' — วิดีโอ ' + (i + 1);
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true; f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      stage.replaceChildren(f);
      ts.forEach((x, k) => { if (k === i) x.setAttribute('aria-current', 'true'); else x.removeAttribute('aria-current'); });
      if (count) count.textContent = (i + 1) + ' / ' + (ts.length || 1);
      if (grid && t) stage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (strip && ts[i]) strip.scrollTo({ left: ts[i].offsetLeft - strip.clientWidth / 2 + ts[i].clientWidth / 2, behavior: 'smooth' });
    });
  }

  // ---------- ตัวเล่นวิดีโออัตโนมัติในฟีด (.uv video) ----------
  // • เล่นทีละคลิป: เลือกคลิปที่อยู่ใกล้กลางจอที่สุดในกลุ่มที่เห็น ≥50% และ "รอให้นิ่ง 300ms" ก่อนเริ่ม → เลื่อนเร็วไม่สั่งโหลดรัวทุกคลิปที่ผ่าน
  // • คลิปที่ออกจากจอถูกหยุดทันที · คลิปที่ไกลเกิน ~1.5 จอ ถูกปล่อย (เอา src ออก + load()) คืนตัวถอดรหัส/บัฟเฟอร์/แบนด์วิดท์ แล้วคืน src เมื่อกลับมาใกล้
  // • ผู้ใช้กดหยุดเอง (dataset.up) = ไม่เล่นให้ใหม่ · แท็บถูกซ่อน = หยุด
  if (!document.getElementById('niv-video-observer')) {
    const observerStyle = document.createElement('style');
    observerStyle.id = 'niv-video-observer';
    document.head.appendChild(observerStyle);

    const PICK_DELAY = 300, FAR_MARGIN = '150% 0px';
    const seenVideos = new Set();   // คลิปที่เห็น ≥ 50% ตอนนี้
    let current = null;             // คลิปที่กำลังเล่นอยู่ (มีได้คลิปเดียว)
    let pickT = 0;
    const setSrc = (v) => { if (!v.getAttribute('src') && v.dataset.src) v.setAttribute('src', v.dataset.src); };
    const playIt = (v) => { setSrc(v); v.play().catch(() => { if (!v.muted) { v.muted = true; v.play().catch(() => {}); } }); }; // เล่นแบบมีเสียงไม่ได้ = ถอยเป็นปิดเสียง
    const schedulePick = () => { clearTimeout(pickT); pickT = setTimeout(pick, PICK_DELAY); };

    function pick() {
      pickT = 0;
      if (document.visibilityState !== 'visible') return;
      const mid = innerHeight / 2;
      let best = null, bestD = Infinity;
      seenVideos.forEach((v) => {
        if (!v.isConnected) { seenVideos.delete(v); return; }
        if (v.dataset.up) return; // ผู้ใช้กดหยุดเองแล้ว
        const r = v.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) { bestD = d; best = v; }
      });
      if (!best || (best === current && !best.paused)) return;
      playIt(best);
    }

    // เล่นทีละคลิป: คลิปใดเริ่มเล่น (อัตโนมัติ หรือผู้ใช้กดเอง) → หยุดคลิปก่อนหน้า (เหตุการณ์ media ไม่ bubble จึงดักตอน capture)
    document.addEventListener('play', (e) => {
      const v = e.target;
      if (!(v instanceof HTMLVideoElement) || !v.closest('.uv')) return;
      if (current && current !== v && !current.paused) current.pause();
      current = v;
    }, true);
    // ขนาดจริงของคลิปรู้แล้ว → ล็อกอัตราส่วนไว้ กันความสูงกระโดดตอนโหลดเสร็จ / ตอนปล่อยคลิป
    document.addEventListener('loadedmetadata', (e) => {
      const v = e.target;
      if (v instanceof HTMLVideoElement && v.videoWidth && v.videoHeight && v.closest('.uv')) v.style.aspectRatio = v.videoWidth + ' / ' + v.videoHeight;
    }, true);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') { if (current && !current.paused) current.pause(); }
      else if (seenVideos.size) schedulePick();
    });

    const near = new IntersectionObserver((entries) => {
      let changed = false;
      for (const e of entries) {
        const v = e.target;
        const seen = e.isIntersecting && (e.intersectionRatio >= 0.5 || e.intersectionRect.height >= innerHeight * 0.5); // คลิปสูงกว่าจอ: ขอแค่กินจอเกินครึ่ง
        if (seen) { if (!seenVideos.has(v)) { seenVideos.add(v); changed = true; } }
        else if (seenVideos.delete(v)) { changed = true; if (!v.paused) v.pause(); if (v === current) current = null; }
      }
      if (changed) schedulePick(); // รีเซ็ตทุกครั้งที่กลุ่มที่เห็นเปลี่ยน = ต้องนิ่งครบ 300ms ถึงเริ่มเล่น
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });

    function release(v) {
      if (!v.paused) v.pause();
      if (v === current) current = null;
      if (v.videoWidth && v.videoHeight) v.style.aspectRatio = v.videoWidth + ' / ' + v.videoHeight; // รักษาความสูงเดิม ไม่ให้หน้ากระโดด
      v.removeAttribute('src');
      v.load(); // ยกเลิกการดาวน์โหลดที่ค้าง + คืนตัวถอดรหัส/บัฟเฟอร์ (โปสเตอร์ยังอยู่)
    }
    const far = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const v = e.target;
        if (e.isIntersecting) setSrc(v); // กลับมาใกล้จอ (preload=none จึงยังไม่โหลดจนกว่าจะสั่งเล่น)
        else if (v.dataset.src && (v.readyState > 0 || v.networkState === 2)) release(v); // ไกลจอและเคยโหลด/กำลังโหลด → ปล่อย
      }
    }, { rootMargin: FAR_MARGIN, threshold: 0 });

    const observeVideos = () => {
      document.querySelectorAll('.uv video:not([data-observed])').forEach((v) => {
        v.dataset.observed = 'true';
        if (v.getAttribute('src')) v.dataset.src = v.getAttribute('src'); // จำ src ไว้คืนหลังถูกปล่อย
        near.observe(v);
        far.observe(v);
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeVideos);
    else observeVideos();
    onNewNodes(observeVideos);
  }

  // ---------- Progress bar วิ่งตามขอบกรอบวิดีโอ (.uv = วิดีโออัปโหลดเอง ทั้ง SSR และการ์ดฝั่งเบราว์เซอร์) ----------
  // ถ้า JS ไม่ทำงาน จะยังเหลือ controls เดิมของเบราว์เซอร์ (ลบทิ้งตอน enhance เท่านั้น)
  if (!document.getElementById('niv-bp')) {
    const BP_R = 18, BP_SW = 2, BP_PAD = 5;
    const bpStyle = document.createElement('style');
    bpStyle.id = 'niv-bp';
    bpStyle.textContent = `
.uv.bp{position:relative;padding:${BP_PAD}px;border-radius:${BP_R}px;background:#0b1020;cursor:pointer;touch-action:manipulation;outline:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.uv.bp video{-webkit-touch-callout:none}
.uv.bp video{display:block;width:100%;border-radius:${BP_R - BP_PAD}px;background:#000}
.uv.bp:focus-visible{box-shadow:0 0 0 2px #f59e0b}
.bp-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.bp-svg rect,.bp-svg path{fill:none}
.bp-track{stroke:rgba(255,255,255,.08);stroke-width:${BP_SW}}
.bp-fill{stroke:#f59e0b;stroke-opacity:.55;stroke-width:${BP_SW};stroke-linecap:butt;transition:stroke-width .15s,stroke-opacity .15s}
.bp-hit{stroke:transparent;stroke-width:${BP_PAD * 2 + 6};pointer-events:stroke;cursor:pointer;touch-action:none}
.uv.bp:hover .bp-fill,.uv.bp.bp-drag .bp-fill{stroke-width:${BP_SW + 1};stroke-opacity:.85}
.bp-play{position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border:0;border-radius:50%;background:rgba(15,23,42,.72);cursor:pointer;display:grid;place-items:center;opacity:0;transform:scale(.85);transition:.2s;pointer-events:none}
.uv.bp.bp-paused .bp-play{opacity:1;transform:none;pointer-events:auto}
.bp-play::before{content:"";border-style:solid;border-width:11px 0 11px 18px;border-color:transparent transparent transparent #fff;margin-left:4px}
.bp-bar{position:absolute;left:${BP_PAD + 10}px;bottom:${BP_PAD + 10}px;display:flex;gap:8px;align-items:center;padding:4px 10px;border-radius:999px;background:rgba(15,23,42,.72);color:#fff;font:600 12px/1.4 ui-monospace,monospace;opacity:0;transition:opacity .2s}
.uv.bp:hover .bp-bar,.uv.bp.bp-paused .bp-bar,.uv.bp:focus-visible .bp-bar{opacity:1}
.bp-fast-tag{position:absolute;top:${BP_PAD + 10}px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:5px;padding:4px 12px;border-radius:999px;background:rgba(15,23,42,.72);color:#fff;font:700 12px/1.4 ui-monospace,monospace;opacity:0;pointer-events:none;transition:opacity .15s}
.uv.bp.bp-fast .bp-fast-tag{opacity:1}
.bp-fast-tag svg{width:14px;height:14px;fill:#f59e0b}
.bp-mute{all:unset;cursor:pointer;display:grid;place-items:center;width:18px;height:18px;border-radius:4px}
.bp-mute:focus-visible{box-shadow:0 0 0 2px #f59e0b}
.bp-mute svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
@media (hover:none){.bp-bar{opacity:1}}
@media (prefers-reduced-motion:reduce){.bp-fill,.bp-play,.bp-bar,.bp-fast-tag{transition:none}}`;
    if (!document.getElementById("niv-css")) document.head.appendChild(bpStyle); // หน้า SSR โหลด /niv.css แล้ว
    // หน้า SSR ใช้ CSS จาก /niv.css (ที่ยังมี backdrop-filter) → ทับด้วยกฎเบาแทน: เบลอทับวิดีโอที่กำลังเล่นทุกเฟรมหนักมากบนมือถือ ใช้พื้นทึบกึ่งโปร่งแทน
    if (!document.getElementById('niv-bp-lite')) {
      const lite = document.createElement('style'); lite.id = 'niv-bp-lite';
      lite.textContent = '.bp-play,.bp-bar,.bp-fast-tag{-webkit-backdrop-filter:none!important;backdrop-filter:none!important;background:rgba(15,23,42,.72)}';
      document.head.appendChild(lite);
    }

    const IC_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>';
    const IC_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/></svg>';
    const fmtT = (s) => (isFinite(s) ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '0:00');

    // เสียงกลาง: เปิดเสียงคลิปใดคลิปหนึ่ง = เปิดทุกคลิป (และปิดก็ปิดทุกคลิป) จำค่าไว้ใน localStorage
    let bpMuted = ls('niv_vsound') !== '1';
    const bpActive = () => !!(navigator.userActivation && navigator.userActivation.hasBeenActive);
    const bpSetAllMuted = (m) => {
      bpMuted = m; lsSet('niv_vsound', m ? '0' : '1');
      document.querySelectorAll('.uv video').forEach((x) => { x.muted = m; });
    };
    // เปิดหน้าใหม่แล้วเบราว์เซอร์ยังไม่ให้เล่นเสียงจนกว่าผู้ใช้จะแตะ → แตะครั้งแรกแล้วค่อยเปิดเสียงให้ทุกคลิป
    if (!bpMuted && !bpActive()) {
      const evs = ['pointerdown', 'keydown', 'touchstart'];
      const onFirst = () => {
        evs.forEach((n) => removeEventListener(n, onFirst, true));
        if (!bpMuted) document.querySelectorAll('.uv video').forEach((x) => { x.muted = false; });
      };
      evs.forEach((n) => addEventListener(n, onFirst, { capture: true, passive: true }));
    }

    // ตำแหน่งเมาส์ (x,y ภายในกรอบ) → สัดส่วนบนเส้นรอบกรอบมุมโค้ง (เริ่มบนซ้าย วนตามเข็มนาฬิกา)
    function bpFrac(x, y, w, h, r) {
      const s = w - 2 * r, t = h - 2 * r, a = (Math.PI * r) / 2, L = 2 * s + 2 * t + 4 * a;
      let d;
      if (x > w - r && y < r) d = s + (Math.atan2(y - r, x - (w - r)) + Math.PI / 2) * r;
      else if (x > w - r && y > h - r) d = s + a + t + Math.atan2(y - (h - r), x - (w - r)) * r;
      else if (x < r && y > h - r) d = 2 * s + 2 * a + t + (Math.atan2(y - (h - r), x - r) - Math.PI / 2) * r;
      else if (x < r && y < r) d = 2 * s + 3 * a + 2 * t + (Math.atan2(y - r, x - r) + Math.PI) * r;
      else {
        const m = Math.min(y, w - x, h - y, x);
        if (m === y) d = x - r;
        else if (m === w - x) d = s + a + (y - r);
        else if (m === h - y) d = s + 2 * a + t + (w - r - x);
        else d = 2 * s + 3 * a + t + (h - r - y);
      }
      const dc = (d + a / 2) % L; // ระยะตามเข็มจากกึ่งกลางมุมซ้ายบน
      return Math.min(1, Math.max(0, 1 - Math.abs(1 - (2 * dc) / L)));
    }

    // ResizeObserver ตัวเดียวสำหรับทุกกรอบ: อ่านขนาดทั้งหมดก่อน แล้วค่อยเขียน (กัน layout thrashing ตอนมีหลายคลิปเข้ามาพร้อมกัน)
    const bpRO = new ResizeObserver((entries) => {
      const sizes = entries.map((e) => [e.target, e.target.clientWidth, e.target.clientHeight]);
      sizes.forEach(([b, w, h]) => b._bpLayout && b._bpLayout(w, h));
    });

    function bpEnhance(box) {
      const v = box.querySelector('video');
      if (!v || box.dataset.bp) return;
      box.dataset.bp = '1';
      v.removeAttribute('controls');
      if (!bpMuted && bpActive()) v.muted = false;
      box.classList.add('bp');
      box.tabIndex = 0;
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', v.getAttribute('aria-label') || 'วิดีโอ');
      box.insertAdjacentHTML('beforeend',
        '<svg class="bp-svg" aria-hidden="true"><rect class="bp-track"/><path class="bp-fill"/><path class="bp-fill"/><rect class="bp-hit"/></svg>' +
        '<div class="bp-fast-tag" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m13 19 9-7-9-7z"/><path d="m2 19 9-7-9-7z"/></svg>2x</div>' +
        '<button class="bp-play" type="button" aria-label="เล่น"></button>' +
        '<div class="bp-bar"><span class="bp-time">0:00</span><button class="bp-mute" type="button" aria-label="เสียง"></button></div>');
      const svg = box.querySelector('.bp-svg'), rects = svg.querySelectorAll('rect'), fills = svg.querySelectorAll('.bp-fill');
      const hit = box.querySelector('.bp-hit');
      const time = box.querySelector('.bp-time'), mute = box.querySelector('.bp-mute');
      const I = BP_SW / 2 + 2;
      let len = 1, W = 0, H = 0, drag = false, raf = 0;

      let lastD = -1, lastKey = '', lastM = null;
      function draw() {
        const f = isFinite(v.duration) && v.duration ? v.currentTime / v.duration : 0;
        const d = f * len;
        if (Math.abs(d - lastD) > 0.8) { // ขยับไม่ถึง ~1 พิกเซล ไม่ต้องเขียนสไตล์ซ้ำ (เส้นรอบกรอบยาวหลายร้อยพิกเซล สายตาแยกไม่ออก)
          lastD = d;
          fills.forEach((p) => { p.style.strokeDasharray = d + ' ' + len; p.style.opacity = f > 0 ? '' : '0'; });
        }
        const key = (v.currentTime | 0) + '/' + (isFinite(v.duration) ? v.duration | 0 : -1);
        if (key !== lastKey) { // เปลี่ยนวินาทีละครั้ง และเขียนผ่าน nodeValue (characterData) → ไม่ปลุกตัวเฝ้า DOM แบบ childList ทุกเฟรมเหมือนเดิม
          lastKey = key;
          const t = fmtT(v.currentTime) + ' / ' + fmtT(v.duration);
          if (time.firstChild) time.firstChild.nodeValue = t; else time.textContent = t;
        }
      }
      function layout(w0, h0) {
        W = w0; H = h0;
        if (!W || !H) return;
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        rects.forEach((r) => {
          r.setAttribute('x', I); r.setAttribute('y', I);
          r.setAttribute('width', Math.max(0, W - 2 * I)); r.setAttribute('height', Math.max(0, H - 2 * I));
          r.setAttribute('rx', BP_R - I);
        });
        // แขน A: ซ้ายบน → ขอบบน → ขอบขวา → ขวาล่าง · แขน B: ซ้ายบน → ขอบซ้าย → ขอบล่าง → ขวาล่าง (ยาวเท่ากัน มาบรรจบที่ขวาล่าง)
        const x0 = I, y0 = I, w = W - 2 * I, h = H - 2 * I, r = BP_R - I, o = r * (1 - Math.SQRT1_2);
        const mx = x0 + o, my = y0 + o, ex = x0 + w - o, ey = y0 + h - o;
        fills[0].setAttribute('d', `M${mx} ${my}A${r} ${r} 0 0 1 ${x0 + r} ${y0}H${x0 + w - r}A${r} ${r} 0 0 1 ${x0 + w} ${y0 + r}V${y0 + h - r}A${r} ${r} 0 0 1 ${ex} ${ey}`);
        fills[1].setAttribute('d', `M${mx} ${my}A${r} ${r} 0 0 0 ${x0} ${y0 + r}V${y0 + h - r}A${r} ${r} 0 0 0 ${x0 + r} ${y0 + h}H${x0 + w - r}A${r} ${r} 0 0 0 ${ex} ${ey}`);
        // ความยาวแขนข้างละ = (w−2r) + (h−2r) + πr — คำนวณเองแทน getTotalLength() ที่บังคับให้เบราว์เซอร์คำนวณเลย์เอาต์ซ้ำทุกกล่อง
        len = (W - 2 * I) + (H - 2 * I) - 4 * (BP_R - I) + Math.PI * (BP_R - I);
        if (!(len > 1)) len = 1;
        lastD = -1; draw();
      }
      box._bpLayout = layout;
      function seekFrom(e) {
        const b = svg.getBoundingClientRect();
        const f = bpFrac(e.clientX - b.left - I, e.clientY - b.top - I, W - 2 * I, H - 2 * I, BP_R - I);
        if (isFinite(v.duration)) v.currentTime = f * v.duration;
        draw();
      }
      hit.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); drag = true; box.classList.add('bp-drag');
        hit.setPointerCapture(e.pointerId); seekFrom(e);
      });
      hit.addEventListener('pointermove', (e) => { if (drag) seekFrom(e); });
      const endDrag = () => { drag = false; box.classList.remove('bp-drag'); };
      hit.addEventListener('pointerup', endDrag);
      hit.addEventListener('pointercancel', endDrag);

      // คลิกวิดีโอ = เล่น/หยุด (จำว่าผู้ใช้หยุดเอง เพื่อไม่ให้ตัวเล่นอัตโนมัติตอนเลื่อนกลับมาเล่นซ้ำ)
      const toggle = () => {
        if (v.paused) { delete v.dataset.up; v.play().catch(() => { if (!v.muted) { v.muted = true; v.play().catch(() => {}); } }); }
        else { v.dataset.up = '1'; v.pause(); }
      };
      let holdT = 0, held = false;
      const endHold = () => {
        clearTimeout(holdT);
        if (box.classList.contains('bp-fast')) { v.playbackRate = 1; box.classList.remove('bp-fast'); }
      };
      box.addEventListener('pointerdown', (e) => {
        held = false; clearTimeout(holdT);
        if (e.button > 0 || e.target.closest('.bp-bar,.bp-hit,.bp-play')) return;
        holdT = setTimeout(() => {
          if (v.paused) return;
          held = true; v.playbackRate = 2; box.classList.add('bp-fast');
        }, 350);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => box.addEventListener(n, endHold));
      box.addEventListener('contextmenu', (e) => { if (held) e.preventDefault(); }); // กดค้างบนมือถือ ไม่ให้เมนูโผล่
      box.addEventListener('click', (e) => {
        if (held) { held = false; return; }
        if (!e.target.closest('.bp-bar,.bp-hit')) toggle();
      });
      mute.addEventListener('click', (e) => { e.stopPropagation(); bpSetAllMuted(!v.muted); });
      const syncUi = () => {
        box.classList.toggle('bp-paused', v.paused);
        if (v.paused) { v.playbackRate = 1; box.classList.remove('bp-fast'); }
        if (lastM !== v.muted) { // เขียน DOM เฉพาะตอนสถานะเสียงเปลี่ยนจริง
          lastM = v.muted;
          mute.innerHTML = v.muted ? IC_OFF : IC_ON;
          mute.setAttribute('aria-label', v.muted ? 'เปิดเสียง' : 'ปิดเสียง');
        }
      };
      // วนอัปเดตเฉพาะตอนกำลังเล่น (ไม่กิน CPU ตอนหยุด/อยู่นอกจอ)
      const tick = () => { draw(); raf = v.paused ? 0 : requestAnimationFrame(tick); };
      v.addEventListener('play', () => { syncUi(); if (!raf) raf = requestAnimationFrame(tick); });
      ['pause', 'volumechange', 'loadedmetadata'].forEach((n) => v.addEventListener(n, syncUi));
      ['timeupdate', 'seeked', 'loadedmetadata', 'durationchange'].forEach((n) => v.addEventListener(n, draw));
      box.addEventListener('keydown', (e) => {
        if (e.target !== box) return;
        if (e.key === 'ArrowRight') v.currentTime += 5;
        else if (e.key === 'ArrowLeft') v.currentTime -= 5;
        else if (e.key === ' ') toggle();
        else return;
        e.preventDefault();
      });
      bpRO.observe(box); // layout() จะถูกเรียกจาก ResizeObserver ตอนกรอบมีขนาด (ไม่อ่านขนาดในลูปสแกน)
      syncUi();
      if (!v.paused && !raf) raf = requestAnimationFrame(tick);
    }

    const bpScan = () => document.querySelectorAll('.uv:not([data-bp])').forEach(bpEnhance);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bpScan);
    else bpScan();
    onNewNodes(bpScan);
  }

  // ---------- กล่องรายงาน (โพสต์ / ความคิดเห็น / ผู้ใช้) ----------
  const REASONS = {
    spam: 'สแปม / โฆษณา',
    abuse: 'ล่วงละเมิด / คำหยาบคาย',
    misleading: 'ข้อมูลเท็จ / ทำให้เข้าใจผิด',
    inappropriate: 'เนื้อหาไม่เหมาะสม',
    copyright: 'ละเมิดลิขสิทธิ์',
    other: 'อื่น ๆ',
  };
  const TYPE_TH = { post: 'โพสต์', comment: 'ความคิดเห็น', user: 'ผู้ใช้' };

  function reportDialog(type, target) {
    const s = session();
    if (!s.token || !s.userId) { location.href = '/login?redirect=' + encodeURIComponent(location.pathname + location.search); return; }
    if (document.getElementById('niv-report')) return;

    const wrap = el('div', 'fixed inset-0 z-[60] flex items-center justify-center p-4');
    wrap.id = 'niv-report';
    const bd = el('div', 'absolute inset-0 bg-black/60 backdrop-blur-sm');
    const box = el('form', 'relative w-full max-w-md rounded-3xl bg-white dark:bg-[#161616] border border-slate-200 dark:border-white/10 shadow-2xl p-6 text-slate-900 dark:text-white');
    box.append(el('h2', 'text-lg font-bold', 'รายงาน' + TYPE_TH[type]));
    box.append(el('p', 'text-sm text-slate-500 dark:text-neutral-400 mt-1', 'เลือกเหตุผล แอดมินจะตรวจสอบให้'));

    const list = el('div', 'mt-4 space-y-2');
    Object.entries(REASONS).forEach(([k, label], i) => {
      const row = el('label', 'flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 cursor-pointer hover:border-amber-500/60 text-sm');
      const r = el('input'); r.type = 'radio'; r.name = 'reason'; r.value = k; r.className = 'accent-amber-500'; if (i === 0) r.checked = true;
      row.append(r, el('span', '', label));
      list.append(row);
    });
    const detail = el('textarea', 'mt-3 w-full px-4 py-3 rounded-xl text-sm bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20');
    detail.rows = 3; detail.maxLength = 300; detail.placeholder = 'รายละเอียดเพิ่มเติม (ไม่บังคับ)';
    const msg = el('p', 'mt-3 text-sm font-medium min-h-[1.25rem]'); msg.setAttribute('role', 'status');
    const btns = el('div', 'mt-4 flex gap-3');
    const cancel = el('button', 'w-1/2 py-2.5 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-sm font-semibold cursor-pointer', 'ยกเลิก'); cancel.type = 'button';
    const ok = el('button', 'w-1/2 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold shadow-md shadow-amber-500/25 disabled:opacity-60 cursor-pointer', 'ส่งรายงาน'); ok.type = 'submit';
    btns.append(cancel, ok);
    box.append(list, detail, msg, btns);
    wrap.append(bd, box);
    document.body.append(wrap);

    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    bd.addEventListener('click', close);
    cancel.addEventListener('click', close);

    box.addEventListener('submit', async (e) => {
      e.preventDefault();
      ok.disabled = true; msg.textContent = 'กำลังส่ง...'; msg.className = 'mt-3 text-sm font-medium min-h-[1.25rem] text-amber-600 dark:text-amber-400';
      const reason = box.querySelector('input[name=reason]:checked').value;
      const r = await api('/api/blog/report', { method: 'POST', body: { userId: s.userId, type, target: String(target), reason, detail: detail.value } });
      if (r.status === 401) { logout(); return; }
      if (!r.ok) {
        ok.disabled = false;
        msg.textContent = r.data.error || 'ส่งรายงานไม่สำเร็จ';
        msg.className = 'mt-3 text-sm font-medium min-h-[1.25rem] text-rose-500';
        return;
      }
      msg.textContent = r.data.already ? 'คุณรายงานเรื่องนี้ไว้แล้ว แอดมินกำลังตรวจสอบ' : 'ส่งรายงานแล้ว ขอบคุณที่ช่วยดูแลชุมชน';
      msg.className = 'mt-3 text-sm font-medium min-h-[1.25rem] text-emerald-500';
      setTimeout(close, 1400);
    });
  }

  // ---------- นับยอดวิวแบบประหยัด request (ตัวเลขเดียว: เห็นการ์ดในฟีด หรือเปิดหน้าโพสต์ ก็นับครั้งเดียวต่อ 6 ชม.) ----------
  // • หน้าโพสต์: NIV.countView(slug) = อยู่หน้านั้น 5 วิ (แท็บมองเห็น) แล้วนับ
  // • ฟีด/ค้นหา/โปรไฟล์: การ์ดที่มี data-view-slug โผล่ในจอ ≥50% (หรือกินจอเกินครึ่ง) ค้างอยู่ 1.5 วิ แล้วนับ
  // • ทุกอย่างเข้าคิวเดียว ส่งเป็น beacon เดียวรวมหลาย slug (สูงสุด 20) ทุก ~10 วิ และตอนออกจากหน้า · ใช้คีย์ niv_v_<slug> ร่วมกัน กันนับซ้ำ
  // • sendBeacon + text/plain = simple request ไม่มี CORS preflight · ไม่แตะ videoObserver (คนละหน้าที่ คนละ observer)
  const VIEW_TTL = 6 * 3600 * 1000, VIEW_BATCH = 20, VIEW_EVERY = 10000, VIEW_DWELL = 1500;
  const SLUG_OK = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const viewQ = new Set();
  let viewTimer = 0;
  const viewFresh = (slug) => Date.now() - (parseInt(ls('niv_v_' + slug), 10) || 0) >= VIEW_TTL;
  // ความสนใจ (ใช้จัดฟีดหน้าแรกแบบ "รู้ใจ"): เก็บ slug ล่าสุดที่ผู้ใช้ค้างอ่านจริง ไว้ในเครื่องเท่านั้น (ไม่เขียน D1) อายุ 30 วัน สูงสุด 12 โพสต์
  const INT_KEY = 'niv_int', INT_MAX = 12;
  function interestList() {
    try {
      const a = JSON.parse(ls(INT_KEY) || '[]'), cut = Date.now() - 30 * 86400000;
      return Array.isArray(a) ? a.filter((x) => x && SLUG_OK.test(String(x.s || '')) && x.t > cut) : [];
    } catch { return []; }
  }
  function recordInterest(slug) {
    slug = String(slug || '');
    if (!SLUG_OK.test(slug) || slug.length > 80) return;
    const a = interestList().filter((x) => x.s !== slug);
    a.unshift({ s: slug, t: Date.now() });
    lsSet(INT_KEY, JSON.stringify(a.slice(0, INT_MAX)));
  }
  const interestParam = () => interestList().map((x) => x.s).join(','); // ใหม่สุดก่อน — ส่งเป็น ?i= ไปกับคำขอฟีดหน้าแรก

  function viewFlush() {
    clearTimeout(viewTimer); viewTimer = 0;
    while (viewQ.size) {
      const slugs = [...viewQ].slice(0, VIEW_BATCH);
      slugs.forEach((x) => viewQ.delete(x));
      const body = new Blob([JSON.stringify({ slugs })], { type: 'text/plain' });
      const url = API + '/api/blog/view';
      let ok = false;
      try { ok = !!(navigator.sendBeacon && navigator.sendBeacon(url, body)); } catch {}
      if (!ok) fetch(url, { method: 'POST', body, keepalive: true }).catch(() => {});
    }
  }
  function viewQueue(slug) {
    slug = String(slug || '');
    if (!SLUG_OK.test(slug) || slug.length > 80 || !viewFresh(slug)) return;
    lsSet('niv_v_' + slug, String(Date.now())); // ตีตราตอนเข้าคิว กันการ์ดเดิม/แท็บอื่นเข้าคิวซ้ำ
    viewQ.add(slug);
    if (viewQ.size >= VIEW_BATCH) viewFlush();
    else if (!viewTimer) viewTimer = setTimeout(viewFlush, VIEW_EVERY);
  }
  function countView(slug) { // หน้าโพสต์เดี่ยว
    if (!SLUG_OK.test(String(slug || ''))) return;
    setTimeout(() => {
      if (document.visibilityState !== 'visible') return;
      recordInterest(slug);
      if (viewFresh(slug)) { viewQueue(slug); viewFlush(); }
    }, 5000);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') viewFlush(); });
  addEventListener('pagehide', viewFlush);

  if ('IntersectionObserver' in window && !document.getElementById('niv-view-observer')) {
    const mark = document.createElement('meta'); mark.id = 'niv-view-observer'; document.head.appendChild(mark);
    const dwell = new Map(); // การ์ด -> { v: ตัวจับเวลานับวิว, i: ตัวจับเวลาความสนใจ }
    const INTEREST_DWELL = 4000; // ค้างที่การ์ดนานกว่านี้ = สนใจ (ใช้จัดฟีด "รู้ใจ")
    const stop = (card) => { const d = dwell.get(card); if (d) { clearTimeout(d.v); clearTimeout(d.i); dwell.delete(card); } };
    const cardObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const card = e.target;
        const seen = e.isIntersecting && (e.intersectionRatio >= 0.5 || e.intersectionRect.height >= innerHeight * 0.5); // การ์ดสูงกว่าจอ: ขอแค่กินจอเกินครึ่ง
        if (seen && !dwell.has(card)) {
          const slug = card.dataset.viewSlug, d = {};
          if (viewFresh(slug)) d.v = setTimeout(() => { if (document.visibilityState === 'visible') viewQueue(slug); }, VIEW_DWELL);
          d.i = setTimeout(() => { dwell.delete(card); cardObserver.unobserve(card); if (document.visibilityState === 'visible') recordInterest(slug); }, INTEREST_DWELL);
          dwell.set(card, d);
        } else if (!seen && dwell.has(card)) stop(card); // เลื่อนผ่านเร็ว ๆ = ไม่นับ ไม่ถือว่าสนใจ
      }
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    const scanCards = () => document.querySelectorAll('[data-view-slug]:not([data-vw])').forEach((c) => {
      c.dataset.vw = '1';
      if (SLUG_OK.test(c.dataset.viewSlug || '')) cardObserver.observe(c);
    });
    onNewNodes(scanCards); // การ์ดที่เพิ่มทีหลัง (เลื่อนโหลดเพิ่ม / ค้นหา / โปรไฟล์)
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scanCards); else scanCards();
  }

  window.NIV = { skel, skelHtml, API, session, logout, api, el, userUrl, avatarEl, postCardEl, videoEl, galleryEl, ago, reportDialog, REASONS, fbBtn, paintFollows, loadFollows, toast, countView, recordInterest, interestParam };

  // ---------- กันเบราว์เซอร์มือถือซูมเองตอนแตะช่องกรอก (ต้องไม่เล็กกว่า 16px) ----------
  if (!document.getElementById('niv-nozoom')) {
    const st = document.createElement('style');
    st.id = 'niv-nozoom';
    st.textContent = 'html{-webkit-text-size-adjust:100%;touch-action:manipulation}@media (max-width:1024px){input,textarea,select{font-size:16px!important}}';
    document.head.appendChild(st);
  }

  // ---------- ฟอนต์ Josefin Sans สำหรับชื่อเว็บ ----------
  if (!document.getElementById('niv-font')) {
    const lk = document.createElement('link');
    lk.id = 'niv-font'; lk.rel = 'stylesheet';
    lk.href = 'https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@600;700&display=swap';
    document.head.appendChild(lk);
  }

  // ---------- CSS ของเมนูข้าง ----------
  const CSS = `
#niv-tabbar{position:fixed;left:0;right:0;bottom:0;z-index:40;display:flex;align-items:stretch;justify-content:space-around;padding-bottom:env(safe-area-inset-bottom);background:rgba(255,255,255,.92);border-top:1px solid rgba(148,163,184,.3);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
.dark #niv-tabbar{background:rgba(13,13,13,.92);border-top-color:rgba(255,255,255,.1)}
#niv-tabbar .tb{flex:1;height:3.5rem;display:grid;place-items:center;color:#64748b;background:none;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.dark #niv-tabbar .tb{color:#a3a3a3}
#niv-tabbar .tb.on{color:#f59e0b}
@media (min-width:640px){#niv-tabbar{display:none}}
@media (max-width:639px){body{padding-bottom:calc(3.5rem + env(safe-area-inset-bottom))}}
#niv-drawer{position:fixed;inset:0;z-index:50;visibility:hidden;pointer-events:none;transition:visibility 0s linear .3s}
#niv-drawer.is-open{visibility:visible;pointer-events:auto;transition:visibility 0s}
#niv-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.6);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);opacity:0;transition:opacity .3s ease}
#niv-drawer.is-open #niv-backdrop{opacity:1}
#niv-drawer aside{position:absolute;top:0;right:0;width:20rem;max-width:88vw;height:100%;max-height:100dvh;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .3s ease-in-out;
  background:radial-gradient(120% 55% at 100% 0%,rgba(245,158,11,.16),transparent 60%),rgba(255,255,255,.88);-webkit-backdrop-filter:blur(22px) saturate(160%);backdrop-filter:blur(22px) saturate(160%)}
.dark #niv-drawer aside{background:radial-gradient(120% 55% at 100% 0%,rgba(245,158,11,.18),transparent 60%),rgba(18,18,18,.86)}
#niv-drawer.is-open aside{transform:none}
.nv-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:.75rem 1rem 1rem;scrollbar-width:none}
.nv-scroll::-webkit-scrollbar{display:none}
.nv-link{display:flex;align-items:center;gap:.75rem;padding:.65rem .75rem;border-radius:.75rem;font-size:.95rem;text-decoration:none;width:100%;text-align:left;color:#475569;transition:background .2s,color .2s}
.dark .nv-link{color:#a3a3a3}
.nv-link:hover{background:rgba(148,163,184,.16);color:#0f172a}
.dark .nv-link:hover{background:rgba(255,255,255,.07);color:#fff}
.nv-link.is-active{background:rgba(245,158,11,.14);color:#d97706;font-weight:500}
.dark .nv-link.is-active{background:rgba(245,158,11,.2);color:#fbbf24}
.nv-link svg{width:1.15rem;height:1.15rem;flex:none;transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
.nv-link:hover svg{transform:translateX(2px) rotate(-8deg) scale(1.12)}
.nv-brand{font-family:'Josefin Sans',sans-serif;font-weight:700;letter-spacing:.04em;line-height:1}
.nv-in{opacity:0;transform:translateX(18px);transition:background .2s,color .2s,opacity .35s ease,transform .4s cubic-bezier(.22,1,.36,1)}
#niv-drawer.is-open .nv-in{opacity:1;transform:none;transition-delay:0s,0s,calc(.08s + var(--i,0)*.05s),calc(.08s + var(--i,0)*.05s)}
.nv-burger{position:relative;display:block;width:1.3rem;height:.95rem}
.nv-burger i{position:absolute;left:0;width:100%;height:2px;border-radius:2px;background:currentColor;transition:width .25s ease}
.nv-burger i:nth-child(1){top:0}.nv-burger i:nth-child(2){top:calc(50% - 1px);width:70%}.nv-burger i:nth-child(3){top:calc(100% - 2px)}
#niv-burger:hover .nv-burger i:nth-child(2){width:100%}
.nv-theme .sun{display:none}html:not(.dark) .nv-theme .sun{display:block}html:not(.dark) .nv-theme .moon{display:none}
.nv-mode-d{display:none}html:not(.dark) .nv-mode-d{display:inline}html:not(.dark) .nv-mode-n{display:none}
html.theme-anim,html.theme-anim *{transition:background-color .4s ease,color .4s ease,border-color .4s ease!important}
@media (prefers-reduced-motion:reduce){.nv-in,#niv-drawer.is-open .nv-in{opacity:1;transform:none;transition-delay:0s}#niv-drawer aside{transition-duration:.01ms}}
`;

  // ---------- ไอคอน ----------
  const IC = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    posts: '<path d="M4 4h13a1 1 0 011 1v14a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/><path d="M8 8h6M8 12h6M8 16h4"/>',
    tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    write: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    moon: '<path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>',
    sun: '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>',
    out: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    close: '<path d="M18 6L6 18M6 6l12 12"/>',
  };
  const svg = (n, cls = '') => `<svg class="${cls}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;

  // ---------- header ----------
  const header = document.getElementById('main-header');
  if (header) {
    const s = session();
    const loggedIn = !!(s.token && s.userId);
    const path = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
    const here = encodeURIComponent(location.pathname + location.search);
    const params = new URLSearchParams(location.search);
    const q0 = path === '/search' ? (params.get('q') || '') : '';

    const nav = [
      { href: '/', label: 'หน้าแรก', ic: 'home', on: path === '/' },
      { href: '/posts', label: 'โพสต์ทั้งหมด', ic: 'posts', on: path === '/posts' || path.startsWith('/posts/') },
      { href: '/search', label: 'ค้นหา', ic: 'search', on: path === '/search' },
      ...(loggedIn ? [
        { href: '/write', label: 'เขียนโพสต์', ic: 'write', on: path === '/write' },
        { href: userUrl(s.userId), label: 'โปรไฟล์ของฉัน', ic: 'user', on: path === '/user' && params.get('id') === s.userId },
        { href: '/profile', label: 'ตั้งค่าบัญชี', ic: 'cog', on: path === '/profile' },
      ] : []),
    ];

    const searchBox = (id) => `
      <form data-search action="/search" method="get" role="search" class="relative">
        <label for="${id}" class="sr-only">ค้นหาโพสต์หรือไอดีผู้ใช้</label>
        ${svg('search', 'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none')}
        <input id="${id}" name="q" type="search" value="${escHtml(q0)}" maxlength="40" autocomplete="off" placeholder="ค้นหาโพสต์ หรือไอดีผู้ใช้"
          class="w-full pl-9 pr-3 py-2 rounded-full text-sm bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20">
      </form>`;

    header.innerHTML = `
<style id="niv-style">${CSS}</style>
<div class="sticky top-0 z-30 border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#0d0d0d]/80 backdrop-blur-md">
  <div class="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
    <a href="/" class="flex items-center gap-2 mr-auto sm:mr-0" aria-label="nivread">
      <img src="/img/nivreadfavon.png" alt="" width="32" height="32" class="w-8 h-8 rounded-lg object-contain">
      <span class="nv-brand text-xl text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-400 to-red-500">nivread</span>
    </a>
    <div class="hidden sm:block flex-1 max-w-md mx-auto">${searchBox('niv-q')}</div>
    <nav class="flex items-center gap-1.5" aria-label="เมนูด่วน">
      <a href="/search" class="hidden w-10 h-10 place-items-center rounded-xl text-slate-700 dark:text-neutral-200 hover:bg-slate-200/70 dark:hover:bg-white/10" aria-label="ค้นหา">${svg('search', 'w-5 h-5')}</a>
      ${loggedIn
        ? `<a href="/write" class="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold shadow-md shadow-amber-500/25 hover:brightness-110">${svg('write', 'w-4 h-4')}เขียนโพสต์</a>`
        : `<a href="/login?redirect=${here}" class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold shadow-md shadow-amber-500/25 hover:brightness-110">เข้าสู่ระบบ</a>`}
      <button id="niv-burger" type="button" class="hidden sm:grid w-10 h-10 place-items-center rounded-xl text-slate-700 dark:text-neutral-200 hover:text-amber-500 hover:bg-slate-200/70 dark:hover:bg-white/10 cursor-pointer" aria-label="เมนู" aria-expanded="false" aria-controls="niv-drawer">
        <span class="nv-burger" aria-hidden="true"><i></i><i></i><i></i></span>
      </button>
    </nav>
  </div>
</div>

<nav id="niv-tabbar" class="sm:hidden" aria-label="เมนูหลัก">
  ${[
    { href: '/', label: 'หน้าแรก', ic: 'home', on: path === '/' },
    { href: '/posts', label: 'โพสต์ทั้งหมด', ic: 'posts', on: path === '/posts' || path.startsWith('/posts/') },
    { href: loggedIn ? userUrl(s.userId) : '/login?redirect=' + here, label: 'โปรไฟล์', ic: 'user', on: loggedIn && path === '/user' && params.get('id') === s.userId },
    { href: '/search', label: 'ค้นหา', ic: 'search', on: path === '/search' },
  ].map((t) => `<a href="${t.href}" class="tb${t.on ? ' on' : ''}" aria-label="${t.label}"${t.on ? ' aria-current="page"' : ''}>${svg(t.ic, 'w-6 h-6')}</a>`).join('')}
  <button id="niv-burger-m" type="button" class="tb" aria-label="เมนู" aria-expanded="false" aria-controls="niv-drawer"><span class="nv-burger" aria-hidden="true"><i></i><i></i><i></i></span></button>
</nav>

<div id="niv-drawer" aria-hidden="true">
  <div id="niv-backdrop"></div>
  <aside class="shadow-2xl border-l border-slate-200 dark:border-white/10 text-slate-800 dark:text-white" role="dialog" aria-label="เมนู">
    <div class="flex items-center justify-between px-5 h-14 border-b border-slate-200 dark:border-white/10 flex-none">
      <span class="flex items-center gap-2"><img src="/img/nivreadfavon.png" alt="" width="32" height="32" class="w-8 h-8 rounded-lg object-contain"><span class="nv-brand text-xl text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-400 to-red-500">nivread</span></span>
      <button id="niv-close" type="button" class="w-9 h-9 grid place-items-center rounded-xl hover:bg-slate-200/70 dark:hover:bg-white/10 cursor-pointer" aria-label="ปิดเมนู">${svg('close', 'w-5 h-5')}</button>
    </div>
    <div class="nv-scroll">
      <button id="niv-theme" type="button" class="nv-link nv-in nv-theme cursor-pointer" style="--i:1" aria-label="สลับโหมดสี">
        <span class="block w-[1.15rem] h-[1.15rem] flex-none"><span class="moon">${svg('moon', 'w-full h-full')}</span><span class="sun">${svg('sun', 'w-full h-full')}</span></span>
        <span><span class="nv-mode-n">โหมดกลางคืน</span><span class="nv-mode-d">โหมดกลางวัน</span></span>
      </button>
      <nav class="mt-1 flex flex-col gap-1" aria-label="เมนูหลัก">
        ${nav.map((it, i) => `<a ${it.id ? `id="${it.id}"` : ''} href="${it.href}" class="nv-link nv-in${it.on ? ' is-active' : ''}${it.hidden ? ' hidden' : ''}" style="--i:${i + 2}"${it.on ? ' aria-current="page"' : ''}>${svg(it.ic)}<span>${it.label}</span></a>`).join('')}
      </nav>
    </div>
    <div class="flex-none border-t border-slate-200 dark:border-white/10 p-4" style="padding-bottom:calc(1rem + env(safe-area-inset-bottom,0px))">
      ${loggedIn ? `
        <a id="niv-me" href="${userUrl(s.userId)}" class="flex items-center gap-3 p-1.5 -m-1.5 rounded-xl hover:bg-slate-200/60 dark:hover:bg-white/5" aria-label="ไปที่โปรไฟล์ของฉัน">
          <span id="niv-me-av"></span>
          <span class="min-w-0"><span id="niv-me-name" class="block text-sm font-semibold truncate"></span><span id="niv-me-id" class="block text-xs text-slate-500 dark:text-neutral-400 truncate"></span></span>
        </a>
        <button id="niv-logout" type="button" class="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer">${svg('out', 'w-4 h-4')}ออกจากระบบ</button>`
      : `<a href="/login?redirect=${here}" class="w-full inline-flex items-center justify-center py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold shadow-md shadow-amber-500/25">เข้าสู่ระบบ / สมัครสมาชิก</a>`}
      <p class="mt-3 text-center text-[11px] opacity-50">© ${new Date().getFullYear()} nivread</p>
    </div>
  </aside>
</div>`;

    // ---- เปิด/ปิดเมนู ----
    const drawer = document.getElementById('niv-drawer');
    const burger = document.getElementById('niv-burger');
    const setOpen = (open) => {
      drawer.classList.toggle('is-open', open);
      drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.getElementById('niv-burger-m')?.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.documentElement.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => setOpen(!drawer.classList.contains('is-open')));
    document.getElementById('niv-burger-m')?.addEventListener('click', () => setOpen(!drawer.classList.contains('is-open')));
    document.getElementById('niv-backdrop').addEventListener('click', () => setOpen(false));
    document.getElementById('niv-close').addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    window.addEventListener('pageshow', (e) => { if (e.persisted) setOpen(false); });

    // ---- ค้นหา: ต้องมีอย่างน้อย 2 ตัวอักษร ----
    header.querySelectorAll('form[data-search]').forEach((f) => f.addEventListener('submit', (e) => {
      if (f.q.value.trim().length < 2) { e.preventDefault(); f.q.focus(); }
    }));

    // ---- สลับธีม ----
    const html = document.documentElement;
    let tt;
    document.getElementById('niv-theme').addEventListener('click', () => {
      html.classList.add('theme-anim');
      const dark = html.classList.toggle('dark');
      try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
      clearTimeout(tt);
      tt = setTimeout(() => html.classList.remove('theme-anim'), 550);
    });

    // ---- ข้อมูลผู้ใช้ในเมนู ----
    if (loggedIn) {
      const fill = (u) => {
        document.getElementById('niv-me-av').replaceChildren(avatarEl(u, 'w-11 h-11'));
        document.getElementById('niv-me-name').textContent = u.display_name || u.id;
        document.getElementById('niv-me-id').textContent = '@' + u.id;
      };
      fill({ id: s.userId, display_name: s.name, avatar_url: s.avatar });
      document.getElementById('niv-logout').addEventListener('click', logout);
      // ดึงชื่อ/รูปล่าสุดมาอัปเดตในเมนู
      api('/api/blog/me?userId=' + encodeURIComponent(s.userId)).then((r) => {
        if (r.status === 401) { logout(); return; }
        if (!r.ok) return;
        const u = r.data.user || {};
        fill({ id: s.userId, display_name: u.display_name || s.name, avatar_url: u.avatar_url });
        if (u.avatar_url) lsSet('userAvatar', u.avatar_url);
        if (u.display_name) lsSet('userName', u.display_name);
      }).catch(() => {});
    }
  }

  // ---------- footer ----------
  const footer = document.getElementById('main-footer');
  if (footer) {
    footer.innerHTML = `
<div class="mt-12 border-t border-slate-200 dark:border-white/10 py-6 text-center text-xs text-slate-500 dark:text-neutral-400">
  © ${new Date().getFullYear()} nivread · <a href="/" class="hover:text-amber-500">หน้าแรก</a> · <a href="/posts" class="hover:text-amber-500">โพสต์ทั้งหมด</a> · <a href="/search" class="hover:text-amber-500">ค้นหา</a> · <a href="/write" class="hover:text-amber-500">เขียนโพสต์</a>
</div>`;
  }
})();