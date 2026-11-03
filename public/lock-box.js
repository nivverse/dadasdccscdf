// lock-box.js — แสดงกล่องล็อกในหน้าอ่านโพสต์ (ใช้คู่กับ /nivread.js และ blog-api.js ที่เพิ่มระบบกล่องล็อกแล้ว)
//
// วิธีใช้ในหน้าโพสต์ (หลังวาดเนื้อหาลงใน element แล้ว):
//   <script src="/lock-box.js"></script>
//   NIVLocks.mount(contentEl, slug);
//
// ทำอะไร: หาตัวคั่น [[lock:k1]] ในข้อความของ contentEl แล้วแทนด้วยกล่อง
//   • ติดตาม  → ปุ่ม "ติดตามเพื่อปลดล็อก" (ยังไม่ล็อกอิน = พาไปหน้าเข้าสู่ระบบแล้วกลับมา)
//   • รหัส    → ช่องกรอก 4 หลัก (กรอกครบแล้วตรวจให้เอง) · จำรหัสที่ถูกไว้ในเครื่อง
//   • เวลา    → นับถอยหลัง แล้วเปิดเองเมื่อถึงเวลา
// ข้อความที่ซ่อนมาจากเซิร์ฟเวอร์เมื่อผ่านเงื่อนไขเท่านั้น ไม่เคยอยู่ใน HTML ของโพสต์
(function () {
  const MARK = /\[\[lock:(k[1-9])\]\]/g;
  const URL_RE = /https:\/\/[^\s<>"']+/g;
  const BOX = 'my-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-left';
  const BTN = 'px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold shadow-md shadow-amber-500/25 hover:from-amber-600 hover:to-orange-600 transition cursor-pointer disabled:opacity-60';
  const GHOST = 'px-3 py-2 rounded-xl border border-amber-500/40 text-amber-600 dark:text-amber-400 text-xs font-semibold hover:bg-amber-500/15 transition cursor-pointer';
  const INPUT = 'w-28 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-white/10 text-center text-base tracking-[0.5em] focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20';

  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const pinKey = (slug, k) => 'nivlock:' + slug + ':' + k;
  const store = {
    get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
    del: (k) => { try { localStorage.removeItem(k); } catch {} },
  };

  // แปลงข้อความเป็นโหนด: เฉพาะลิงก์ https กลายเป็นลิงก์กดได้ (ไม่ใช้ innerHTML จึงไม่มีทาง inject HTML)
  function linkify(text) {
    const frag = document.createDocumentFragment();
    let last = 0, m;
    URL_RE.lastIndex = 0;
    while ((m = URL_RE.exec(text))) {
      if (m.index > last) frag.append(text.slice(last, m.index));
      const a = mk('a', 'underline text-amber-600 dark:text-amber-400 break-all', m[0]);
      a.href = m[0]; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow ugc';
      frag.append(a); last = m.index + m[0].length;
    }
    if (last < text.length) frag.append(text.slice(last));
    return frag;
  }
  const dur = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return (d ? d + ' วัน ' : '') + (d || h ? h + ' ชม. ' : '') + (d ? '' : m + ' นาที ') + (d || h ? '' : x + ' วินาที');
  };

  async function mount(root, slug) {
    if (!root || !slug || !window.NIV) return;
    // 1) หาตัวคั่นในโหนดข้อความ
    // (ก) ช่องที่เซิร์ฟเวอร์วาดไว้แล้ว <div data-lock="k1"> (หน้า /posts/<slug>)  (ข) ตัวคั่น [[lock:k1]] ที่ยังเป็นข้อความ (หน้าอื่นที่วาดเนื้อหาเอง)
    const pre = [...root.querySelectorAll('[data-lock]')].filter((e) => /^k[1-9]$/.test(e.getAttribute('data-lock')));
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) { MARK.lastIndex = 0; if (MARK.test(n.nodeValue)) nodes.push(n); }
    if (!nodes.length && !pre.length) return;

    const NIV = window.NIV, s = NIV.session ? NIV.session() : {};
    const loggedIn = !!(s && s.token && s.userId);
    let info = { locks: [], now: Date.now(), author_id: '' }, skew = 0;
    const slots = []; // { key, box }

    const load = async () => {
      const q = '/api/blog/locks?slug=' + encodeURIComponent(slug) + (loggedIn ? '&userId=' + encodeURIComponent(s.userId) : '');
      const r = await NIV.api(q);
      if (r.ok && r.data && r.data.success) { info = r.data; skew = info.now - Date.now(); }
      return r.ok;
    };
    const ok = await load().catch(() => false);

    // 2) สร้างกล่อง
    const make = (key) => {
      const box = mk('div', BOX); box.setAttribute('data-lock', key);
      slots.push({ key, box }); return box;
    };
    pre.forEach((e) => { e.className = BOX; slots.push({ key: e.getAttribute('data-lock'), box: e }); });
    for (const n of nodes) {
      const frag = document.createDocumentFragment(), text = n.nodeValue;
      let last = 0, m; MARK.lastIndex = 0;
      while ((m = MARK.exec(text))) {
        const before = text.slice(last, m.index).replace(/\n+$/, '');
        if (before.trim()) frag.append(before);
        frag.append(make(m[1])); last = m.index + m[0].length;
      }
      const after = text.slice(last).replace(/^\n+/, '');
      if (after.trim()) frag.append(after);
      n.replaceWith(frag);
    }

    // 3) วาดแต่ละกล่องตามสถานะล่าสุด
    const timers = [];
    const draw = (slot) => {
      const l = (info.locks || []).find((x) => x.key === slot.key);
      const box = slot.box; box.replaceChildren();
      if (!l) { box.append(mk('div', 'text-sm text-slate-500 dark:text-neutral-400', ok ? 'กล่องนี้ไม่มีอยู่แล้ว' : 'โหลดกล่องล็อกไม่สำเร็จ ลองรีเฟรชหน้านี้')); return; }
      const head = mk('div', 'flex items-center gap-2 text-sm font-semibold');
      head.append(mk('span', '', l.locked ? '🔒' : '🔓'), mk('span', 'min-w-0 break-words', l.label));
      box.append(head);

      if (!l.locked) {
        const body = mk('div', 'mt-2 p-3 rounded-xl bg-white/80 dark:bg-black/30 border border-slate-200 dark:border-white/10 text-sm whitespace-pre-wrap break-words select-all');
        body.append(linkify(l.secret));
        const row = mk('div', 'mt-2 flex items-center gap-2');
        const copy = mk('button', GHOST, 'คัดลอก'); copy.type = 'button';
        copy.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(l.secret); copy.textContent = 'คัดลอกแล้ว'; } catch { copy.textContent = 'กดค้างที่ข้อความเพื่อคัดลอก'; }
          setTimeout(() => { copy.textContent = 'คัดลอก'; }, 1800);
        });
        row.append(copy);
        if (info.owner) row.append(mk('span', 'text-xs text-slate-500 dark:text-neutral-400', 'คุณเห็นข้อความนี้เพราะเป็นเจ้าของโพสต์'));
        box.append(body, row); return;
      }

      const msg = mk('p', 'mt-2 text-xs text-rose-600 dark:text-rose-400 empty:hidden');
      msg.setAttribute('role', 'status');
      const apply = (secret) => { l.locked = false; l.secret = secret; draw(slot); };

      if (l.mode === 'follow') {
        box.append(mk('p', 'mt-1 text-xs text-slate-500 dark:text-neutral-400', 'ติดตามผู้โพสต์เพื่อปลดล็อกข้อความนี้'));
        const b = mk('button', BTN + ' mt-3', loggedIn ? 'ติดตามเพื่อปลดล็อก' : 'เข้าสู่ระบบเพื่อติดตาม'); b.type = 'button';
        b.addEventListener('click', async () => {
          if (!loggedIn) { location.href = '/login?redirect=' + encodeURIComponent(location.pathname + location.search); return; }
          b.disabled = true; msg.textContent = '';
          const r = await NIV.api('/api/blog/lock-open', { method: 'POST', body: { userId: s.userId, slug, key: l.key, follow: true } });
          if (r.ok && r.data.secret) { // ติดตามแล้ว → โหลดสถานะใหม่ เปิดทุกกล่องแบบ "ติดตาม" พร้อมกัน (แต่ละกล่องมีข้อความของตัวเอง)
            const fresh = await load().catch(() => false);
            if (!fresh) apply(r.data.secret); else slots.forEach(draw);
            return;
          }
          msg.textContent = (r.data && r.data.error) || 'ปลดล็อกไม่สำเร็จ'; b.disabled = false;
        });
        box.append(b, msg); return;
      }

      if (l.mode === 'pin') {
        box.append(mk('p', 'mt-1 text-xs text-slate-500 dark:text-neutral-400', 'กรอกรหัสตัวเลข 4 หลักเพื่อปลดล็อก'));
        const row = mk('div', 'mt-3 flex items-center gap-2');
        const inp = mk('input', INPUT); inp.inputMode = 'numeric'; inp.maxLength = 4; inp.autocomplete = 'off'; inp.placeholder = '••••'; inp.setAttribute('aria-label', 'รหัส 4 หลัก');
        const go = mk('button', BTN, 'ปลดล็อก'); go.type = 'button';
        const submit = async (pin, silent) => {
          if (!/^\d{4}$/.test(pin)) { if (!silent) msg.textContent = 'กรอกรหัสตัวเลข 4 หลัก'; return; }
          go.disabled = inp.disabled = true; msg.textContent = '';
          const r = await NIV.api('/api/blog/lock-open', { method: 'POST', body: { slug, key: l.key, pin } });
          if (r.ok && r.data.secret) { store.set(pinKey(slug, l.key), pin); apply(r.data.secret); return; }
          store.del(pinKey(slug, l.key));
          if (!silent) msg.textContent = (r.data && r.data.error) || 'ปลดล็อกไม่สำเร็จ';
          go.disabled = inp.disabled = false; if (!silent) { inp.value = ''; inp.focus(); }
        };
        inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 4); if (inp.value.length === 4) submit(inp.value); });
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(inp.value); } });
        go.addEventListener('click', () => submit(inp.value));
        row.append(inp, go); box.append(row, msg);
        const saved = store.get(pinKey(slug, l.key)); if (saved) submit(saved, true); // เคยปลดล็อกแล้วในเครื่องนี้
        return;
      }

      // time
      const left = mk('p', 'mt-2 text-sm font-medium');
      const when = mk('p', 'mt-1 text-xs text-slate-500 dark:text-neutral-400', 'ปลดล็อก ' + new Date(l.unlock_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }));
      box.append(left, when, msg);
      const tick = async () => {
        const rest = l.unlock_at - (Date.now() + skew);
        if (rest > 0) { left.textContent = 'ปลดล็อกในอีก ' + dur(rest); return; }
        clearInterval(t); left.textContent = 'ถึงเวลาแล้ว กำลังเปิด...';
        const r = await NIV.api('/api/blog/lock-open', { method: 'POST', body: { slug, key: l.key } });
        if (r.ok && r.data.secret) apply(r.data.secret);
        else if (r.data && r.data.unlock_at) { l.unlock_at = r.data.unlock_at; skew = r.data.now - Date.now(); t = setInterval(tick, 1000); tick(); }
        else msg.textContent = (r.data && r.data.error) || 'เปิดไม่สำเร็จ ลองรีเฟรชหน้านี้';
      };
      let t = setInterval(tick, 1000); timers.push(() => clearInterval(t)); tick();
    };
    slots.forEach(draw);
  }

  window.NIVLocks = { mount };
})();