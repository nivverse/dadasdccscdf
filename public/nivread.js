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
    location.href = '/posts';
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

  // การ์ดโพสต์สำหรับหน้าที่เรนเดอร์ฝั่งเบราว์เซอร์ (ค้นหา / โปรไฟล์ผู้ใช้) — หน้าฟีดหลักเรนเดอร์ฝั่งเซิร์ฟเวอร์เพื่อ SEO
  function postCardEl(p) {
    const card = el('article', 'rounded-2xl bg-white/85 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-md shadow-sm overflow-hidden');
    const head = el('div', 'flex items-center gap-3 p-4');
    const who = { id: p.author_id, display_name: p.display_name, avatar_url: p.avatar_url };
    const a1 = el('a', 'flex-shrink-0'); a1.href = userUrl(p.author_id); a1.append(avatarEl(who, 'w-11 h-11')); a1.setAttribute('aria-label', 'โปรไฟล์ ' + (p.display_name || p.author_id));
    const meta = el('div', 'min-w-0');
    const a2 = el('a', 'block font-semibold text-sm truncate hover:text-amber-500', p.display_name || p.author_id); a2.href = userUrl(p.author_id);
    const sub = el('div', 'text-xs text-slate-500 dark:text-neutral-400', ago(p.published_at));
    if (p.category) sub.append(el('span', 'ml-2 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400', p.category));
    meta.append(a2, sub);
    head.append(a1, meta);
    card.append(head);

    const body = el('div', 'px-4 pb-3');
    const h = el('h2', 'text-lg font-bold leading-snug');
    const ha = el('a', 'hover:text-amber-500 transition-colors', p.title); ha.href = '/posts/' + p.slug;
    h.append(ha); body.append(h);
    if (p.excerpt) body.append(el('p', 'mt-1 text-sm text-slate-600 dark:text-neutral-300 line-clamp-3', p.excerpt));
    const more = el('a', 'inline-block mt-2 text-sm font-semibold text-amber-600 dark:text-amber-400 hover:underline', 'อ่านเพิ่มเติม →'); more.href = '/posts/' + p.slug;
    body.append(more);
    card.append(body);

    if (p.cover_url && /^https:\/\//.test(p.cover_url)) {
      const ca = el('a'); ca.href = '/posts/' + p.slug; ca.tabIndex = -1;
      ca.append(Object.assign(el('img', 'w-full aspect-video object-cover'), { src: p.cover_url, alt: p.title, loading: 'lazy', decoding: 'async' }));
      card.append(ca);
    }
    const foot = el('div', 'px-4 py-3 flex items-center gap-4 text-xs text-slate-500 dark:text-neutral-400');
    foot.append(el('span', '', '♥ ' + (p.like_count || 0)));
    const ca2 = el('a', 'hover:underline', (p.comment_count || 0) + ' ความคิดเห็น'); ca2.href = '/posts/' + p.slug + '#comments';
    foot.append(ca2);
    card.append(foot);
    return card;
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

  window.NIV = { API, session, logout, api, el, userUrl, avatarEl, postCardEl, ago, reportDialog, REASONS };

  // ---------- ฟอนต์ Josefin Sans สำหรับชื่อเว็บ ----------
  if (!document.getElementById('niv-font')) {
    const lk = document.createElement('link');
    lk.id = 'niv-font'; lk.rel = 'stylesheet';
    lk.href = 'https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@600;700&display=swap';
    document.head.appendChild(lk);
  }

  // ---------- CSS ของเมนูข้าง ----------
  const CSS = `
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
    posts: '<path d="M4 4h13a1 1 0 011 1v14a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/><path d="M8 8h6M8 12h6M8 16h4"/>',
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
      { href: '/posts', label: 'โพสต์ทั้งหมด', ic: 'posts', on: path === '/posts' || path.startsWith('/posts/') || path === '/' },
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
    <a href="/posts" class="flex items-center gap-2 mr-auto sm:mr-0" aria-label="nivread">
      <img src="/img/nivreadfavon.png" alt="" width="32" height="32" class="w-8 h-8 rounded-lg object-contain">
      <span class="nv-brand text-xl text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-400 to-red-500">nivread</span>
    </a>
    <div class="hidden sm:block flex-1 max-w-md mx-auto">${searchBox('niv-q')}</div>
    <nav class="flex items-center gap-1.5" aria-label="เมนูด่วน">
      <a href="/search" class="sm:hidden w-10 h-10 grid place-items-center rounded-xl text-slate-700 dark:text-neutral-200 hover:bg-slate-200/70 dark:hover:bg-white/10" aria-label="ค้นหา">${svg('search', 'w-5 h-5')}</a>
      ${loggedIn
        ? `<a href="/write" class="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold shadow-md shadow-amber-500/25 hover:brightness-110">${svg('write', 'w-4 h-4')}เขียนโพสต์</a>`
        : `<a href="/login?redirect=${here}" class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold shadow-md shadow-amber-500/25 hover:brightness-110">เข้าสู่ระบบ</a>`}
      <button id="niv-burger" type="button" class="w-10 h-10 grid place-items-center rounded-xl text-slate-700 dark:text-neutral-200 hover:text-amber-500 hover:bg-slate-200/70 dark:hover:bg-white/10 cursor-pointer" aria-label="เมนู" aria-expanded="false" aria-controls="niv-drawer">
        <span class="nv-burger" aria-hidden="true"><i></i><i></i><i></i></span>
      </button>
    </nav>
  </div>
</div>

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
      document.documentElement.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => setOpen(!drawer.classList.contains('is-open')));
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
  © ${new Date().getFullYear()} nivread · <a href="/posts" class="hover:text-amber-500">โพสต์ทั้งหมด</a> · <a href="/search" class="hover:text-amber-500">ค้นหา</a> · <a href="/write" class="hover:text-amber-500">เขียนโพสต์</a>
</div>`;
  }
})();