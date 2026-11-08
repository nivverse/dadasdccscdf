// /novel-social.js — ส่วนโซเชียลที่หน้านิยายกับหน้าอ่านใช้ร่วมกัน (window.NovelSocial)
// ความปลอดภัย: ข้อความผู้ใช้ทุกชิ้นใส่ด้วย textContent เท่านั้น (ไม่ใช้ innerHTML กับข้อมูลผู้ใช้)
(() => {
  if (!window.NIV || window.NovelSocial) return;
  const { api, el, session, avatarEl, userUrl } = NIV;
  const enc = encodeURIComponent;
  const num = (n) => Number(n || 0).toLocaleString('th-TH');
  const loginHref = () => '/login?redirect=' + enc(location.pathname + location.search);

  // ---------- ไอคอน (SVG คงที่ ไม่มีข้อมูลผู้ใช้) ----------
  const PATHS = {
    heart: '<path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z"/>',
    reply: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 016 6v3"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  };
  const ico = (name, cls) => { const t = document.createElement('span'); t.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${PATHS[name]}</svg>`; const s = t.firstChild; if (cls) s.setAttribute('class', cls); return s; };

  function ago(ms) {
    const d = Math.max(0, Date.now() - ms) / 1000;
    if (d < 45) return 'เมื่อครู่';
    if (d < 3600) return Math.round(d / 60) + ' นาทีที่แล้ว';
    if (d < 86400) return Math.round(d / 3600) + ' ชั่วโมงที่แล้ว';
    if (d < 86400 * 30) return Math.round(d / 86400) + ' วันที่แล้ว';
    return new Date(ms).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // ---------- ทอสต์ ----------
  let toastEl, toastT;
  function toast(msg, action) {
    if (!toastEl) { toastEl = el('div', 'nv-toast'); toastEl.setAttribute('role', 'status'); document.body.append(toastEl); }
    const hide = () => toastEl.classList.remove('show');
    toastEl.replaceChildren(document.createTextNode(msg));
    if (action) { const b = el('button', '', action.label); b.type = 'button'; b.onclick = () => { action.fn(); hide(); }; toastEl.append(b); }
    requestAnimationFrame(() => toastEl.classList.add('show'));
    clearTimeout(toastT); toastT = setTimeout(hide, action ? 6000 : 2600);
  }

  // ---------- แผงเลื่อนใช้ร่วมกัน ----------
  let sh = null, lastFocus = null, onCloseCb = null;
  function ensureSheet() {
    if (sh) return sh;
    const bg = el('div', 'nv-sheet-bg');
    const box = el('div', 'nv-sheet'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    const head = el('div', 'nv-sheet-head'); const title = el('h3', 'font-bold text-base truncate');
    const x = el('button', 'nv-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'ปิด');
    head.append(title, x);
    const body = el('div', 'nv-sheet-body');
    box.append(head, body); document.body.append(bg, box);
    sh = { bg, box, title, body, x };
    bg.addEventListener('click', closeSheet); x.addEventListener('click', closeSheet);
    document.addEventListener('keydown', (e) => {
      if (!box.classList.contains('open')) return;
      if (e.key === 'Escape') return closeSheet();
      if (e.key !== 'Tab') return;
      const f = [...box.querySelectorAll('a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])')].filter((n) => n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    return sh;
  }
  function openSheet({ title, render, onClose }) {
    const s = ensureSheet();
    s.title.textContent = title; s.body.replaceChildren(); s.body.scrollTop = 0;
    onCloseCb = onClose || null; render(s.body);
    lastFocus = document.activeElement;
    s.bg.classList.add('open'); s.box.classList.add('open');
    setTimeout(() => s.x.focus({ preventScroll: true }), 50);
  }
  function closeSheet() {
    if (!sh || !sh.box.classList.contains('open')) return;
    sh.bg.classList.remove('open'); sh.box.classList.remove('open');
    const cb = onCloseCb; onCloseCb = null; if (cb) cb();
    if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch {}
  }

  // ---------- ตัวห่อ API ----------
  const uid = () => session().userId || '';
  const authed = () => { const s = session(); return !!(s.token && s.userId); };
  async function toggle(kind, slug, on) {      // kind: 'like' | 'bookmark'
    if (!authed()) { toast('เข้าสู่ระบบก่อนนะ', { label: 'เข้าสู่ระบบ', fn: () => { location.href = loginHref(); } }); return null; }
    const r = await api('/api/novel/' + kind, { method: 'POST', body: { userId: uid(), slug, on } });
    if (!r.ok) { toast(r.data.error || 'ทำรายการไม่สำเร็จ'); return null; }
    return r.data;
  }
  async function rate(slug, stars) {
    if (!authed()) { toast('เข้าสู่ระบบก่อนให้คะแนนนะ', { label: 'เข้าสู่ระบบ', fn: () => { location.href = loginHref(); } }); return null; }
    const r = await api('/api/novel/rate', { method: 'POST', body: { userId: uid(), slug, stars } });
    if (!r.ok) { toast(r.data.error || 'ให้คะแนนไม่สำเร็จ'); return null; }
    return r.data;
  }
  async function me(slug) {
    if (!authed()) return null;
    const r = await api('/api/novel/me?slug=' + enc(slug) + '&userId=' + enc(uid()));
    return r.ok ? r.data : null;
  }
  function view(slug, no) {                    // text/plain = ไม่ต้อง preflight
    try {
      const body = new Blob([JSON.stringify({ slug, no })], { type: 'text/plain' });
      if (!(navigator.sendBeacon && navigator.sendBeacon(NIV.API + '/api/novel/view', body))) fetch(NIV.API + '/api/novel/view', { method: 'POST', body, keepalive: true }).catch(() => {});
    } catch {}
  }
  async function share({ title, url }) {
    try { if (navigator.share) { await navigator.share({ title, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์แล้ว'); } catch { toast(url); }
  }

  // ---------- คอมเมนต์ ----------
  const TA = 'w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-white/10 text-sm leading-6 resize-none focus:outline-none focus:border-amber-500 transition-colors';
  const GOBTN = 'px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold disabled:opacity-50 transition-transform active:scale-95';

  function buildComposer({ placeholder, onSend }) {
    const root = el('div', 'nv-composer');
    if (!authed()) {
      const a = el('a', 'block text-center text-sm px-4 py-3 rounded-xl border border-dashed border-slate-300 dark:border-white/15 text-slate-500 dark:text-neutral-400 hover:border-amber-500 hover:text-amber-600 transition-colors', 'เข้าสู่ระบบเพื่อแสดงความคิดเห็น');
      a.href = loginHref(); root.append(a);
      return { el: root, setReply() {}, focus() {} };
    }
    let reply = null;
    const bar = el('div', 'hidden items-center justify-between text-xs text-slate-500 dark:text-neutral-400 mb-1.5 px-1');
    const barTxt = el('span'); const barX = el('button', 'nv-mini', 'ยกเลิก'); barX.type = 'button';
    bar.append(barTxt, barX);
    const ta = el('textarea', TA); ta.rows = 2; ta.maxLength = 1000; ta.placeholder = placeholder;
    const foot = el('div', 'flex items-center justify-between mt-2');
    const cnt = el('span', 'text-xs text-slate-400', '0 / 1000');
    const btn = el('button', GOBTN, 'ส่ง'); btn.type = 'button'; btn.disabled = true;
    foot.append(cnt, btn); root.append(bar, ta, foot);
    const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 220) + 'px'; };
    ta.addEventListener('input', () => { cnt.textContent = ta.value.length + ' / 1000'; btn.disabled = !ta.value.trim(); fit(); });
    const setReply = (t) => {
      reply = t;
      bar.classList.toggle('hidden', !t); bar.classList.toggle('flex', !!t);
      if (t) { barTxt.textContent = 'ตอบกลับ ' + t.name; ta.focus({ preventScroll: false }); }
    };
    barX.addEventListener('click', () => setReply(null));
    btn.addEventListener('click', async () => {
      const text = ta.value.trim(); if (!text) return;
      btn.disabled = true; btn.textContent = 'กำลังส่ง…';
      const ok = await onSend(text, reply);
      btn.textContent = 'ส่ง';
      if (ok) { ta.value = ''; cnt.textContent = '0 / 1000'; fit(); setReply(null); } else btn.disabled = !ta.value.trim();
    });
    ta.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !btn.disabled) btn.click(); });
    return { el: root, setReply, focus: () => ta.focus() };
  }

  function mountComments(root, { slug, no = 0, para = 0, onTotal, placeholder }) {
    root.replaceChildren();
    const st = { before: 0, hasMore: false, loading: false, viewer: null, gen: 0 };
    const list = el('div', 'mt-4 space-y-5');
    const more = el('button', 'mt-4 w-full py-2 rounded-xl border border-slate-300 dark:border-white/15 text-sm hover:border-amber-500 transition-colors hidden', 'ดูความคิดเห็นเพิ่มเติม');
    more.type = 'button';
    const empty = el('p', 'mt-4 text-sm text-center text-slate-500 dark:text-neutral-400 hidden', 'ยังไม่มีความคิดเห็น มาเป็นคนแรกกันเลย');
    const comp = buildComposer({
      placeholder: placeholder || 'แสดงความคิดเห็น…',
      onSend: async (text, reply) => {
        const r = await api('/api/novel/comment', { method: 'POST', body: { userId: uid(), slug, no, para, content: text, replyTo: reply ? reply.id : undefined } });
        if (!r.ok) { toast(r.data.error || 'ส่งความคิดเห็นไม่สำเร็จ'); return false; }
        const c = r.data.comment; empty.classList.add('hidden');
        if (c.parent_id) {
          const box = list.querySelector(`[data-thread="${c.parent_id}"] [data-replies]`);
          if (box) box.append(itemEl(c, true));
          else list.prepend(itemEl({ ...c, replies: [] }, false));
        } else list.prepend(itemEl(c, false));
        if (onTotal) onTotal(+1);
        return true;
      },
    });
    root.append(comp.el, list, empty, more);

    const canDelete = (c) => st.viewer && (st.viewer.id === c.user_id || st.viewer.can_moderate);

    function itemEl(c, isReply) {
      const wrap = el('div', 'nv-in flex gap-3'); wrap.dataset.cid = c.id;
      if (!isReply) wrap.dataset.thread = c.id;
      wrap.append(avatarEl({ id: c.user_id, display_name: c.display_name, avatar_url: c.avatar_url }, isReply ? 'w-7 h-7 text-xs' : 'w-9 h-9'));
      const col = el('div', 'min-w-0 flex-1');
      const head = el('div', 'flex flex-wrap items-center gap-x-2 text-xs');
      const nm = el('a', 'font-semibold text-sm hover:text-amber-500', c.display_name || c.user_id); nm.href = userUrl(c.user_id);
      head.append(nm);
      if (c.is_author) head.append(el('span', 'px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-semibold', 'ผู้เขียน'));
      head.append(el('span', 'text-slate-400', ago(c.created_at)));
      const text = el('p', 'nv-cm-text mt-0.5 text-sm leading-6');
      if (c.reply_to_name && isReply) { text.append(el('span', 'text-amber-600 dark:text-amber-400 mr-1', '@' + c.reply_to_name)); }
      text.append(document.createTextNode(c.content));
      const acts = el('div', 'mt-1 flex items-center gap-3 text-slate-500 dark:text-neutral-400');
      const like = el('button', 'nv-mini'); like.type = 'button'; like.setAttribute('aria-pressed', c.liked ? 'true' : 'false');
      const lc = el('span', '', c.like_count ? num(c.like_count) : ''); like.append(ico('heart'), lc); like.setAttribute('aria-label', 'ถูกใจ');
      like.addEventListener('click', async () => {
        if (!authed()) return toast('เข้าสู่ระบบก่อนนะ', { label: 'เข้าสู่ระบบ', fn: () => { location.href = loginHref(); } });
        const was = like.getAttribute('aria-pressed') === 'true', cur = parseInt(lc.textContent.replace(/[^\d]/g, ''), 10) || 0;
        like.setAttribute('aria-pressed', String(!was)); lc.textContent = Math.max(0, cur + (was ? -1 : 1)) || '';
        const r = await api('/api/novel/comment-like', { method: 'POST', body: { userId: uid(), commentId: c.id, on: !was } });
        if (!r.ok) { like.setAttribute('aria-pressed', String(was)); lc.textContent = cur || ''; toast(r.data.error || 'ไม่สำเร็จ'); }
        else { like.setAttribute('aria-pressed', String(r.data.liked)); lc.textContent = r.data.like_count || ''; }
      });
      acts.append(like);
      const rp = el('button', 'nv-mini'); rp.type = 'button'; rp.append(ico('reply'), document.createTextNode('ตอบกลับ'));
      rp.addEventListener('click', () => { if (!authed()) return toast('เข้าสู่ระบบก่อนนะ', { label: 'เข้าสู่ระบบ', fn: () => { location.href = loginHref(); } }); comp.setReply({ id: c.id, name: c.display_name || c.user_id }); root.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
      acts.append(rp);
      if (canDelete(c)) {
        const del = el('button', 'nv-mini hover:text-rose-500', ''); del.type = 'button'; del.append(ico('trash'), document.createTextNode('ลบ'));
        del.addEventListener('click', async () => {
          if (!confirm('ลบความคิดเห็นนี้?' + (isReply ? '' : ' (การตอบกลับทั้งหมดจะถูกลบด้วย)'))) return;
          const r = await api('/api/novel/comment-delete', { method: 'POST', body: { userId: uid(), commentId: c.id } });
          if (!r.ok) return toast(r.data.error || 'ลบไม่สำเร็จ');
          wrap.remove(); if (onTotal) onTotal(-(r.data.removed || 1));
          if (!list.children.length) empty.classList.remove('hidden');
        });
        acts.append(del);
      }
      col.append(head, text, acts);
      if (!isReply) {
        const box = el('div', 'mt-3 space-y-3'); box.dataset.replies = '1';
        const rs = c.replies || [], fold = rs.length > 3;
        rs.forEach((x, i) => { const n = itemEl(x, true); if (fold && i >= 2) n.classList.add('hidden'); box.append(n); });
        col.append(box);
        if (fold) {
          const t = el('button', 'nv-mini mt-2', `ดูการตอบกลับอีก ${rs.length - 2} รายการ`); t.type = 'button';
          t.addEventListener('click', () => { box.querySelectorAll('.hidden').forEach((n) => n.classList.remove('hidden')); t.remove(); });
          col.append(t);
        }
      }
      wrap.append(col);
      return wrap;
    }

    async function load(append) {
      if (st.loading) return; st.loading = true;
      const gen = ++st.gen;
      if (!append) {
        list.replaceChildren();
        for (let i = 0; i < 2; i++) { const sk = el('div', 'nv-pulse flex gap-3'); sk.append(el('div', 'w-9 h-9 rounded-full bg-slate-300/60 dark:bg-white/10'), (() => { const c = el('div', 'flex-1 space-y-2'); c.append(el('div', 'h-3 w-1/4 rounded bg-slate-300/60 dark:bg-white/10'), el('div', 'h-3 w-3/4 rounded bg-slate-300/60 dark:bg-white/10')); return c; })()); list.append(sk); }
      }
      more.disabled = true;
      const r = await api(`/api/novel/comments?slug=${enc(slug)}&no=${no}&para=${para}${authed() ? '&userId=' + enc(uid()) : ''}${append && st.before ? '&before=' + st.before : ''}`);
      if (gen !== st.gen) return;
      st.loading = false; more.disabled = false;
      if (!append) list.replaceChildren();
      if (!r.ok) { list.append(el('p', 'text-sm text-center text-slate-500', r.data.error || 'โหลดความคิดเห็นไม่สำเร็จ')); return; }
      st.viewer = r.data.viewer; st.hasMore = r.data.hasMore; st.before = r.data.next_before;
      r.data.comments.forEach((c) => list.append(itemEl(c, false)));
      empty.classList.toggle('hidden', !!list.children.length);
      more.classList.toggle('hidden', !st.hasMore);
    }
    more.addEventListener('click', () => load(true));
    load(false);
    return { reload: () => load(false), focus: comp.focus };
  }

  window.NovelSocial = { toast, openSheet, closeSheet, mountComments, toggle, rate, me, view, share, ago, num, loginHref, authed, ico };
})();
