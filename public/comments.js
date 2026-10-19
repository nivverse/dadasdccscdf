// public/comments.js — ระบบคอมเมนต์ของ nivread (หน้าโพสต์เดี่ยว)
// เธรดตอบกลับแบบ X · ไลก์/ดับเบิลแตะ/อีโมจิด่วนแบบ IG · GIF (พิมพ์ /gif) · ดูเพิ่มเติม · พับ/คลี่การตอบกลับ · โหลดทีละชุด
// ต้องโหลดหลัง /nivread.js (ใช้ window.NIV) — เรนเดอร์ด้วย DOM/textContent ทั้งหมด (กัน XSS)
(() => {
  const box = document.querySelector('[data-comments-for]');
  const NIV = window.NIV;
  if (!box || !NIV) return;
  const { api, el, session, avatarEl, userUrl, ago, reportDialog } = NIV;

  // 🔑 GIPHY API Key (คีย์ฝั่งหน้าเว็บ ใช้ค้นหา GIF เท่านั้น)
  const GIPHY_KEY = 'UOHcUKp4uOyQpu9M03XhGjaFHwCp7euN';
  const PAGE_SIZE = 10;      // คอมเมนต์หลักต่อ 1 ชุด
  const LONG_TEXT = 220;     // ยาวกว่านี้พับ "ดูเพิ่มเติม"
  const MAX_LEN = 1000;
  const EMOJIS = ['😂', '❤️', '🔥', '👏', '😮', '😢', '🙌', '😍'];
  const GIF_MD = /!\[gif\]\(([^)\s]*)\)/g;
  const GIPHY_URL = /^https:\/\/(?:media\d*|i)\.giphy\.com\/[A-Za-z0-9_\-./?=&%]{4,400}$/;

  const slug = box.dataset.commentsFor.replace(/^post:/, '');
  const list = document.getElementById('comment-list');
  const formBox = document.getElementById('comment-box');
  const countEl = document.getElementById('comment-count');
  const s = session();
  const loggedIn = !!(s.token && s.userId);

  let items = [];
  let byId = new Map();
  let liked = new Set();
  let isAdmin = false;
  let postAuthor = box.dataset.author || '';
  let sort = 'new';
  let shown = PAGE_SIZE;
  const open = new Set();      // เธรดที่คลี่การตอบกลับอยู่
  let replyForm = null;        // { id, node }

  // ---------- สไตล์เล็ก ๆ ----------
  if (!document.getElementById('niv-cm')) {
    const st = document.createElement('style');
    st.id = 'niv-cm';
    st.textContent =
      '@keyframes cm-pop{0%{transform:scale(1)}40%{transform:scale(1.5)}100%{transform:scale(1)}}.cm-pop{animation:cm-pop .35s ease}' +
      '@keyframes cm-float{0%{opacity:1;transform:translate(-50%,0) scale(.6)}100%{opacity:0;transform:translate(-50%,-56px) scale(1.5)}}' +
      '.cm-float{position:absolute;left:50%;top:40%;pointer-events:none;font-size:30px;animation:cm-float .8s ease-out forwards;z-index:5}' +
      '@keyframes cm-flash{0%{background:rgba(245,158,11,.3)}100%{background:transparent}}.cm-flash{animation:cm-flash 2s ease-out;border-radius:1rem}' +
      '@keyframes cm-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.cm-in{animation:cm-in .25s ease both}' +
      '.cm-clamp{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}' +
      '@media (prefers-reduced-motion:reduce){.cm-pop,.cm-in,.cm-flash{animation:none}}';
    document.head.appendChild(st);
  }

  // ---------- ตัวช่วย ----------
  const toast = (t) => {
    const d = el('div', 'fixed left-1/2 -translate-x-1/2 bottom-6 z-[60] px-4 py-2 rounded-full bg-neutral-900/90 text-white text-sm shadow-lg', t);
    document.body.append(d);
    setTimeout(() => d.remove(), 2400);
  };
  const loginUrl = (hash) => '/login?redirect=' + encodeURIComponent(location.pathname + (hash || '#comments'));
  const svg = (d, cls = 'w-4 h-4', fill = 'none') =>
    `<svg class="${cls}" fill="${fill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const HEART = '<path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z"/>';
  const rootOf = (c) => c.parent_id || c.id;

  function setCount() { if (countEl) countEl.textContent = items.length; }

  // เนื้อหา: ข้อความล้วน + GIF (เฉพาะ giphy https)
  function contentEl(text) {
    const wrap = el('div', 'text-[15px] leading-6 whitespace-pre-wrap break-words');
    let last = 0, plain = 0, m;
    GIF_MD.lastIndex = 0;
    while ((m = GIF_MD.exec(text))) {
      const seg = text.slice(last, m.index);
      if (seg.trim()) { wrap.append(seg.trim()); plain += seg.length; }
      if (GIPHY_URL.test(m[1])) {
        const img = Object.assign(el('img', 'mt-2 block max-w-full sm:max-w-xs max-h-60 rounded-xl object-contain border border-slate-200 dark:border-white/10'),
          { src: m[1], alt: 'GIF', loading: 'lazy', decoding: 'async', referrerPolicy: 'no-referrer' });
        wrap.append(img);
      }
      last = m.index + m[0].length;
    }
    const tail = text.slice(last);
    if (tail.trim()) { wrap.append(tail.trim()); plain += tail.length; }
    return { wrap, long: plain > LONG_TEXT };
  }

  // ---------- GIF (GIPHY) ----------
  async function fetchGiphy(q) {
    const u = q.trim()
      ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=18&rating=g`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=18&rating=g`;
    try { const r = await fetch(u); const d = await r.json(); return d.data || []; } catch { return []; }
  }

  // ---------- ช่องพิมพ์ (ใช้ทั้งคอมเมนต์หลักและตอบกลับ) ----------
  function composer({ placeholder, rows = 2, compact = false, submitLabel = 'ส่ง', onSubmit, onCancel }) {
    const root = el('div', 'min-w-0 flex-1');
    const ta = el('textarea', 'w-full px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[15px] leading-6 resize-none focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 placeholder-slate-400 dark:placeholder-neutral-500');
    ta.rows = rows; ta.maxLength = MAX_LEN; ta.placeholder = placeholder;
    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 220) + 'px'; };

    // GIF ที่เลือกไว้ (แสดงตัวอย่าง + ลบได้)
    let gif = null;
    const prev = el('div', 'hidden relative mt-2 w-fit');
    const prevImg = el('img', 'max-h-32 rounded-xl border border-slate-200 dark:border-white/10');
    prevImg.alt = 'GIF';
    const prevX = el('button', 'absolute -top-2 -right-2 w-6 h-6 rounded-full bg-neutral-900 text-white text-xs grid place-items-center shadow', '✕');
    prevX.type = 'button'; prevX.setAttribute('aria-label', 'เอา GIF ออก');
    prev.append(prevImg, prevX);
    const setGif = (g) => {
      gif = g;
      prev.classList.toggle('hidden', !g);
      if (g) prevImg.src = g.thumb || g.url;
    };
    prevX.addEventListener('click', () => setGif(null));

    // แผง GIF
    const picker = el('div', 'hidden mt-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#161616] p-3 shadow-lg');
    const pHead = el('div', 'flex items-center justify-between mb-2');
    pHead.append(el('span', 'text-xs font-semibold text-slate-500 dark:text-neutral-400', '🎬 ค้นหา GIF'));
    const pClose = el('button', 'text-xs text-slate-400 hover:text-amber-500 px-1', '✕'); pClose.type = 'button'; pClose.setAttribute('aria-label', 'ปิด');
    pHead.append(pClose);
    const pSearch = el('input', 'w-full text-sm rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-2 mb-2 focus:outline-none focus:border-amber-500');
    pSearch.type = 'search'; pSearch.placeholder = 'พิมพ์คำค้นหา...'; pSearch.autocomplete = 'off';
    const pGrid = el('div', 'grid grid-cols-3 gap-2 max-h-52 overflow-y-auto');
    const pCredit = el('div', 'mt-2 text-[10px] text-right text-slate-400 dark:text-neutral-500', 'Powered by GIPHY');
    picker.append(pHead, pSearch, pGrid, pCredit);
    let t;
    const loadGifs = async (q = '') => {
      pGrid.replaceChildren(el('p', 'col-span-3 text-xs text-center text-slate-400 py-6', 'กำลังโหลด...'));
      const res = await fetchGiphy(q);
      pGrid.replaceChildren();
      if (!res.length) { pGrid.append(el('p', 'col-span-3 text-xs text-center text-slate-400 py-6', 'ไม่พบ GIF')); return; }
      res.forEach((g) => {
        const url = g.images?.fixed_height?.url, th = g.images?.fixed_height_small?.url || url;
        if (!url || !GIPHY_URL.test(url)) return;
        const im = Object.assign(el('img', 'w-full h-20 object-cover rounded-lg cursor-pointer hover:opacity-80 transition'),
          { src: th, alt: g.title || 'GIF', loading: 'lazy', referrerPolicy: 'no-referrer' });
        im.addEventListener('click', () => { setGif({ url, thumb: th }); closePicker(); ta.focus(); });
        pGrid.append(im);
      });
    };
    const openPicker = () => { picker.classList.remove('hidden'); pSearch.value = ''; loadGifs(''); pSearch.focus(); };
    const closePicker = () => picker.classList.add('hidden');
    pClose.addEventListener('click', closePicker);
    pSearch.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => loadGifs(pSearch.value), 400); });

    // แถบปุ่ม: อีโมจิด่วน + GIF + ส่ง
    const bar = el('div', 'mt-2 flex items-center gap-1 flex-wrap');
    EMOJIS.forEach((e) => {
      const b = el('button', 'w-8 h-8 rounded-full text-lg hover:bg-amber-500/15 transition', e); b.type = 'button'; b.setAttribute('aria-label', 'แทรก ' + e);
      b.addEventListener('click', () => {
        const a = ta.selectionStart ?? ta.value.length, z = ta.selectionEnd ?? a;
        if (ta.value.length + e.length > MAX_LEN) return;
        ta.value = ta.value.slice(0, a) + e + ta.value.slice(z);
        ta.focus(); ta.setSelectionRange(a + e.length, a + e.length); grow(); sync();
      });
      bar.append(b);
    });
    const gifBtn = el('button', 'ml-1 px-2.5 h-8 rounded-full border border-slate-300 dark:border-white/15 text-xs font-bold text-slate-600 dark:text-neutral-300 hover:border-amber-500 hover:text-amber-500 transition', 'GIF');
    gifBtn.type = 'button'; gifBtn.title = 'แทรก GIF (หรือพิมพ์ /gif)';
    gifBtn.addEventListener('click', () => (picker.classList.contains('hidden') ? openPicker() : closePicker()));
    bar.append(gifBtn);

    const right = el('div', 'ml-auto flex items-center gap-2');
    const counter = el('span', 'hidden text-xs text-slate-400 tabular-nums');
    if (onCancel) {
      const c = el('button', 'px-3 py-1.5 rounded-full text-xs font-medium text-slate-500 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-white/10', 'ยกเลิก');
      c.type = 'button'; c.addEventListener('click', onCancel); right.append(counter, c);
    } else right.append(counter);
    const send = el('button', 'px-5 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold shadow-md shadow-amber-500/25 disabled:opacity-40 disabled:shadow-none transition', submitLabel);
    send.type = 'button'; send.disabled = true;
    right.append(send); bar.append(right);

    const err = el('div', 'hidden mt-1 text-xs text-rose-500');
    const compose = () => ta.value.trim() + (gif ? (ta.value.trim() ? '\n' : '') + `![gif](${gif.url})` : '');
    function sync() {
      const n = ta.value.length;
      counter.textContent = (MAX_LEN - n) + '';
      counter.classList.toggle('hidden', n < MAX_LEN - 200);
      send.disabled = !(ta.value.trim() || gif);
    }
    ta.addEventListener('input', () => {
      if (/\/gif\b/i.test(ta.value)) { ta.value = ta.value.replace(/\/gif\b/gi, '').replace(/ {2,}/g, ' '); openPicker(); }
      grow(); sync(); err.classList.add('hidden');
    });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !send.disabled) go(); });
    async function go() {
      const text = compose();
      if (!text) return;
      send.disabled = true; const old = send.textContent; send.textContent = 'กำลังส่ง...';
      const r = await onSubmit(text);
      send.textContent = old;
      if (r && r.ok) { ta.value = ''; setGif(null); closePicker(); grow(); sync(); }
      else { err.textContent = (r && r.error) || 'ส่งไม่สำเร็จ'; err.classList.remove('hidden'); sync(); }
    }
    send.addEventListener('click', go);

    root.append(ta, prev, picker, bar, err);
    return { root, focus: () => ta.focus() };
  }

  // ---------- ไลก์ ----------
  function paintLike(id) {
    const c = byId.get(id); if (!c) return;
    const on = liked.has(id);
    document.querySelectorAll(`[data-like="${id}"]`).forEach((b) => {
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.className = 'inline-flex items-center gap-1 text-xs font-medium transition-colors ' + (on ? 'text-rose-500' : 'text-slate-500 dark:text-neutral-400 hover:text-rose-500');
      b.innerHTML = svg(HEART, 'w-4 h-4', on ? 'currentColor' : 'none') + `<span class="tabular-nums">${c.like_count > 0 ? c.like_count : ''}</span>`;
    });
  }
  async function toggleLike(id, burstAt) {
    if (!loggedIn) { location.href = loginUrl('#c-' + id); return; }
    const c = byId.get(id); if (!c) return;
    const was = liked.has(id);
    if (was) { liked.delete(id); c.like_count = Math.max(0, (c.like_count || 0) - 1); }
    else {
      liked.add(id); c.like_count = (c.like_count || 0) + 1;
      document.querySelectorAll(`[data-like="${id}"]`).forEach((b) => { b.classList.add('cm-pop'); setTimeout(() => b.classList.remove('cm-pop'), 400); });
      if (burstAt) { const h = el('span', 'cm-float', '❤️'); burstAt.append(h); setTimeout(() => h.remove(), 850); }
    }
    paintLike(id);
    const r = await api('/api/blog/comment-like', { method: 'POST', body: { userId: s.userId, commentId: id } });
    if (r.ok) {
      c.like_count = r.data.like_count;
      if (r.data.liked) liked.add(id); else liked.delete(id);
    } else {
      if (was) { liked.add(id); c.like_count++; } else { liked.delete(id); c.like_count = Math.max(0, c.like_count - 1); }
      toast(r.data.error || 'ทำรายการไม่สำเร็จ');
    }
    paintLike(id);
  }

  // ---------- รายการเดียว ----------
  const ADMIN_BADGE = '<svg class="w-4 h-4 text-sky-500 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-label="ผู้ดูแลระบบ"><title>ผู้ดูแลระบบ</title><path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a.75.75 0 00-1.214-.882l-3.236 4.53L7.53 10.53a.75.75 0 00-1.06 1.061l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clip-rule="evenodd"/></svg>';

  function itemEl(c, isReply) {
    const row = el('div', 'flex gap-3 cm-in');
    row.id = 'c-' + c.id;
    const who = { id: c.user_id, display_name: c.display_name, avatar_url: c.avatar_url };
    const av = el('a', 'flex-shrink-0 self-start'); av.href = userUrl(c.user_id);
    av.setAttribute('aria-label', 'โปรไฟล์ ' + (c.display_name || c.user_id));
    av.append(avatarEl(who, isReply ? 'w-8 h-8' : 'w-10 h-10'));
    const col = el('div', 'min-w-0 flex-1');
    const bubble = el('div', 'relative rounded-2xl bg-slate-100 dark:bg-white/5 px-4 py-2.5');

    const head = el('div', 'flex items-center gap-1.5 flex-wrap');
    const nm = el('a', 'font-semibold text-sm truncate max-w-[60%] hover:text-amber-500', c.display_name || c.user_id); nm.href = userUrl(c.user_id);
    head.append(nm);
    if (c.is_admin) { const b = el('span', 'inline-flex'); b.innerHTML = ADMIN_BADGE; head.append(b); }
    if (postAuthor && c.user_id === postAuthor) head.append(el('span', 'px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30', 'ผู้เขียน'));
    head.append(el('span', 'text-xs text-slate-400 dark:text-neutral-500', '· ' + ago(c.created_at)));
    bubble.append(head);

    if (isReply && c.reply_to_name) {
      const rt = el('a', 'block text-xs font-medium text-amber-600 dark:text-amber-400 mt-0.5 hover:opacity-70', 'ตอบกลับ @' + c.reply_to_name);
      rt.href = '#c-' + c.reply_to;
      rt.addEventListener('click', (e) => { e.preventDefault(); focusComment(c.reply_to); });
      bubble.append(rt);
    }

    const { wrap, long } = contentEl(c.content);
    wrap.classList.add('mt-1');
    bubble.append(wrap);
    if (long) {
      wrap.classList.add('cm-clamp');
      const more = el('button', 'mt-1 text-xs font-medium text-slate-500 dark:text-neutral-400 hover:text-amber-500', 'ดูเพิ่มเติม'); more.type = 'button';
      more.addEventListener('click', () => {
        const clamped = wrap.classList.toggle('cm-clamp');
        more.textContent = clamped ? 'ดูเพิ่มเติม' : 'ย่อลง';
      });
      bubble.append(more);
    }
    bubble.addEventListener('dblclick', (e) => { if (e.target.closest('a,button,textarea,input')) return; if (!liked.has(c.id)) toggleLike(c.id, bubble); });

    const acts = el('div', 'mt-1 ml-2 flex items-center gap-4');
    const lk = el('button'); lk.type = 'button'; lk.dataset.like = c.id;
    lk.addEventListener('click', () => toggleLike(c.id));
    const rp = el('button', 'text-xs font-medium text-slate-500 dark:text-neutral-400 hover:text-amber-500', 'ตอบกลับ'); rp.type = 'button';
    rp.addEventListener('click', () => openReply(c));
    acts.append(lk, rp);
    if (c.user_id !== s.userId) {
      const rb = el('button', 'text-xs text-slate-400 hover:text-amber-500', 'รายงาน'); rb.type = 'button';
      rb.addEventListener('click', () => reportDialog('comment', c.id));
      acts.append(rb);
    }
    if (loggedIn && (c.user_id === s.userId || isAdmin)) {
      const del = el('button', 'text-xs text-rose-500 hover:opacity-70', 'ลบ'); del.type = 'button';
      del.addEventListener('click', () => removeComment(c));
      acts.append(del);
    }
    const slot = el('div'); slot.dataset.slot = c.id;
    col.append(bubble, acts, slot);
    row.append(av, col);
    queueMicrotask(() => paintLike(c.id));
    return row;
  }

  // ---------- วาดรายการทั้งหมด ----------
  const repliesOf = (id) => items.filter((x) => x.parent_id === id);
  function rootsSorted() {
    const roots = items.filter((x) => !x.parent_id);
    if (sort === 'top') {
      const score = (c) => (c.like_count || 0) * 2 + repliesOf(c.id).length;
      return roots.sort((a, b) => score(b) - score(a) || b.id - a.id);
    }
    return roots.sort((a, b) => b.id - a.id);
  }

  let tabs = null, moreWrap = null;
  function renderList() {
    replyForm = null;
    setCount();
    list.replaceChildren();
    const roots = rootsSorted();
    if (tabs) tabs.classList.toggle('hidden', roots.length < 2);
    if (!roots.length) {
      list.append(el('p', 'text-sm text-slate-500 dark:text-neutral-400 py-4 text-center', 'ยังไม่มีความคิดเห็น มาเป็นคนแรกได้เลย'));
      moreWrap.classList.add('hidden');
      return;
    }
    roots.slice(0, shown).forEach((c) => {
      const th = el('div', 'space-y-2'); th.dataset.thread = c.id;
      th.append(itemEl(c, false));
      const reps = repliesOf(c.id);
      if (reps.length) {
        const wrap = el('div', 'ml-6 sm:ml-12');
        const tg = el('button', 'text-xs font-semibold text-amber-600 dark:text-amber-400 hover:opacity-70 flex items-center gap-1 mb-2'); tg.type = 'button';
        const body = el('div', 'space-y-3 border-l-2 border-slate-200 dark:border-white/10 pl-3 sm:pl-4');
        reps.forEach((r) => body.append(itemEl(r, true)));
        const paint = () => {
          const on = open.has(c.id);
          body.classList.toggle('hidden', !on);
          tg.innerHTML = svg(on ? '<path d="M18 15l-6-6-6 6"/>' : '<path d="M6 9l6 6 6-6"/>', 'w-3.5 h-3.5') + `<span>${on ? 'ซ่อนการตอบกลับ' : 'ดูการตอบกลับ ' + reps.length + ' รายการ'}</span>`;
        };
        tg.addEventListener('click', () => { if (open.has(c.id)) open.delete(c.id); else open.add(c.id); paint(); });
        paint();
        wrap.append(tg, body);
        th.append(wrap);
      }
      list.append(th);
    });
    const remain = roots.length - shown;
    moreWrap.classList.toggle('hidden', remain <= 0);
    if (remain > 0) moreWrap.firstChild.textContent = `แสดงความคิดเห็นเพิ่มเติม (เหลืออีก ${remain} รายการ)`;
  }

  function focusComment(id) {
    const c = byId.get(id); if (!c) return;
    const rid = rootOf(c);
    if (c.parent_id) open.add(rid);
    const idx = rootsSorted().findIndex((x) => x.id === rid);
    if (idx >= shown) shown = Math.ceil((idx + 1) / PAGE_SIZE) * PAGE_SIZE;
    renderList();
    const node = document.getElementById('c-' + id);
    if (node) { node.scrollIntoView({ behavior: 'smooth', block: 'center' }); node.classList.add('cm-flash'); setTimeout(() => node.classList.remove('cm-flash'), 2100); }
  }

  // ---------- ตอบกลับ ----------
  function openReply(c) {
    if (!loggedIn) { location.href = loginUrl('#c-' + c.id); return; }
    const slot = document.querySelector(`[data-slot="${c.id}"]`); if (!slot) return;
    if (replyForm && replyForm.id === c.id) { slot.replaceChildren(); replyForm = null; return; }
    if (replyForm) replyForm.node.replaceChildren();
    const wrap = el('div', 'flex gap-2 mt-2');
    wrap.append(avatarEl({ id: s.userId, display_name: s.name, avatar_url: s.avatar }, 'w-8 h-8'));
    const cm = composer({
      placeholder: 'ตอบกลับ @' + (c.display_name || c.user_id) + '...',
      compact: true,
      submitLabel: 'ตอบกลับ',
      onCancel: () => { slot.replaceChildren(); replyForm = null; },
      onSubmit: async (text) => {
        const r = await api('/api/blog/comment', { method: 'POST', body: { slug, userId: s.userId, content: text, parentId: rootOf(c), replyTo: c.id } });
        if (r.status === 401) { location.href = loginUrl('#c-' + c.id); return { ok: false, error: 'กรุณาเข้าสู่ระบบ' }; }
        if (!r.ok) return { ok: false, error: r.data.error };
        add(r.data.comment);
        open.add(rootOf(c));
        renderList();
        focusComment(r.data.comment.id);
        return { ok: true };
      },
    });
    wrap.append(cm.root);
    slot.replaceChildren(wrap);
    replyForm = { id: c.id, node: slot };
    cm.focus();
  }

  function add(c) { items.push(c); byId.set(c.id, c); }

  async function removeComment(c) {
    if (!confirm(c.parent_id ? 'ลบการตอบกลับนี้ใช่ไหม?' : 'ลบความคิดเห็นนี้ (รวมการตอบกลับทั้งหมด) ใช่ไหม?')) return;
    const r = await api('/api/blog/comment-delete', { method: 'POST', body: { userId: s.userId, commentId: c.id } });
    if (!r.ok) return toast(r.data.error || 'ลบไม่สำเร็จ');
    items = items.filter((x) => x.id !== c.id && x.parent_id !== c.id);
    byId = new Map(items.map((x) => [x.id, x]));
    renderList();
    toast('ลบแล้ว');
  }

  // ---------- โครงหน้า ----------
  if (!loggedIn) {
    const p = el('div', 'rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-4 py-3 text-sm text-slate-600 dark:text-neutral-300 flex items-center justify-between gap-3 flex-wrap');
    p.append(el('span', '', 'เข้าสู่ระบบเพื่อแสดงความคิดเห็น ตอบกลับ และกดถูกใจ'));
    const a = el('a', 'px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold', 'เข้าสู่ระบบ');
    a.href = loginUrl();
    p.append(a); formBox.append(p);
  } else {
    const wrap = el('div', 'flex gap-3');
    wrap.append(avatarEl({ id: s.userId, display_name: s.name, avatar_url: s.avatar }, 'w-10 h-10'));
    const cm = composer({
      placeholder: 'แสดงความคิดเห็นของคุณ... (พิมพ์ /gif เพื่อแทรก GIF)',
      rows: 2,
      submitLabel: 'ส่งความคิดเห็น',
      onSubmit: async (text) => {
        const r = await api('/api/blog/comment', { method: 'POST', body: { slug, userId: s.userId, content: text } });
        if (r.status === 401) { location.href = loginUrl(); return { ok: false, error: 'กรุณาเข้าสู่ระบบ' }; }
        if (!r.ok) return { ok: false, error: r.data.error };
        add(r.data.comment);
        sort = 'new'; shown = Math.max(shown, PAGE_SIZE);
        syncTabs();
        renderList();
        focusComment(r.data.comment.id);
        return { ok: true };
      },
    });
    wrap.append(cm.root);
    formBox.append(wrap);
  }

  // แท็บเรียง: ล่าสุด / ยอดนิยม
  tabs = el('div', 'hidden mt-5 mb-3 flex gap-1 p-1 rounded-full bg-slate-100 dark:bg-white/5 w-fit');
  const tabBtns = {};
  [['new', 'ล่าสุด'], ['top', 'ยอดนิยม']].forEach(([k, label]) => {
    const b = el('button', 'px-4 py-1 rounded-full text-xs font-semibold transition', label); b.type = 'button';
    b.addEventListener('click', () => { sort = k; shown = PAGE_SIZE; syncTabs(); renderList(); });
    tabBtns[k] = b; tabs.append(b);
  });
  function syncTabs() {
    Object.entries(tabBtns).forEach(([k, b]) => {
      b.className = 'px-4 py-1 rounded-full text-xs font-semibold transition ' +
        (k === sort ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow' : 'text-slate-500 dark:text-neutral-400 hover:text-amber-500');
    });
  }
  syncTabs();
  list.before(tabs);

  moreWrap = el('div', 'mt-5 text-center hidden');
  const moreBtn = el('button', 'px-6 py-2 rounded-full bg-slate-200/80 dark:bg-white/10 hover:bg-amber-500 hover:text-white text-slate-700 dark:text-neutral-200 text-xs font-semibold transition shadow-sm');
  moreBtn.type = 'button';
  moreBtn.addEventListener('click', () => { shown += PAGE_SIZE; renderList(); });
  moreWrap.append(moreBtn);
  list.after(moreWrap);

  // ---------- โหลดข้อมูล ----------
  list.replaceChildren(el('p', 'text-sm text-slate-500 dark:text-neutral-400', 'กำลังโหลดความคิดเห็น...'));
  (async () => {
    const [r, me, lk] = await Promise.all([
      api('/api/blog/comments?slug=' + encodeURIComponent(slug)),
      loggedIn ? api('/api/blog/me?userId=' + encodeURIComponent(s.userId)) : null,
      loggedIn ? api('/api/blog/comment-liked?userId=' + encodeURIComponent(s.userId) + '&slug=' + encodeURIComponent(slug)) : null,
    ]);
    if (!r.ok) { list.replaceChildren(el('p', 'text-sm text-rose-500', 'โหลดความคิดเห็นไม่สำเร็จ ลองรีเฟรชหน้า')); return; }
    if (me && me.ok) isAdmin = !!me.data.isAdmin;
    if (lk && lk.ok) liked = new Set(lk.data.ids || []);
    if (r.data.post_author) postAuthor = r.data.post_author;
    items = r.data.comments || [];
    byId = new Map(items.map((x) => [x.id, x]));
    renderList();
    const m = location.hash.match(/^#c-(\d+)$/);
    if (m) focusComment(Number(m[1]));
  })();
})();
