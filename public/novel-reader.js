// /novel-reader.js — หน้าอ่านตอน
//  · ตั้งค่าการอ่าน (ธีม ฟอนต์ ขนาด ระยะบรรทัด ความกว้าง) จำไว้ในเครื่อง
//  · แถบความคืบหน้า + แถบเครื่องมือที่ซ่อนเมื่อเลื่อนลง (เขียนแค่ transform, scroll แบบ passive + rAF)
//  · จำตำแหน่งที่อ่านค้าง (ในเครื่อง + ซิงก์ไปบัญชีถ้าล็อกอิน) · นับวิวครั้งเดียวหลังอ่านจริง
//  · คอมเมนต์รายย่อหน้า · สารบัญตอน · ลูกศรซ้าย/ขวาเปลี่ยนตอน
//  · ตอนที่มีราคา: ตรวจสิทธิ์หลังล็อกอิน ปลดล็อกด้วย coin แล้วค่อยแสดงเนื้อหา (ข้อความใส่ด้วย textContent)
(() => {
  const art = document.getElementById('reader');
  if (!art || !window.NIV || !window.NovelSocial) return;
  const NS = NovelSocial, { el, session } = NIV;
  const api = NS.call;      // ตัวห่อที่ตรวจรูปแบบคำตอบ (ดู novel-social.js)
  const enc = encodeURIComponent;
  const root = document.documentElement;
  const slug = art.dataset.slug, no = Number(art.dataset.no);
  const s = session();
  const authed = !!(s.token && s.userId);

  // ================= ตั้งค่าการอ่าน =================
  const FONTS = {
    kanit: { label: 'Kanit', css: "'Kanit', sans-serif" },
    sarabun: { label: 'Sarabun', css: "'Sarabun', 'Kanit', sans-serif", q: 'Sarabun:wght@400;600' },
    serif: { label: 'Noto Serif', css: "'Noto Serif Thai', serif", q: 'Noto+Serif+Thai:wght@400;600' },
    sys: { label: 'ระบบ', css: 'system-ui, -apple-system, sans-serif' },
  };
  const WIDTH = { n: '36rem', m: '48rem', w: '64rem' };
  const DEF = { t: 'auto', f: 'kanit', s: 18, lh: 2, w: 'm', par: 'some' };
  let prefs = { ...DEF };
  try { prefs = { ...DEF, ...JSON.parse(localStorage.getItem('nv:rd') || '{}') }; } catch {}
  function applyPrefs() {
    if (prefs.t === 'auto') root.removeAttribute('data-rt'); else root.setAttribute('data-rt', prefs.t);
    const f = FONTS[prefs.f] || FONTS.kanit;
    if (f.q && !document.querySelector(`link[data-nvf="${f.q}"]`)) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.nvf = f.q;
      l.href = 'https://fonts.googleapis.com/css2?family=' + f.q + '&display=swap'; document.head.append(l);
    }
    root.style.setProperty('--rd-font', f.css);
    root.style.setProperty('--rd-size', prefs.s + 'px');
    root.style.setProperty('--rd-lh', String(prefs.lh));
    root.style.setProperty('--rd-w', WIDTH[prefs.w] || WIDTH.m);
    root.setAttribute('data-par', prefs.par);
  }
  const savePrefs = () => { try { localStorage.setItem('nv:rd', JSON.stringify(prefs)); } catch {} };
  applyPrefs();

  // ================= ความคืบหน้า / แถบเครื่องมือ =================
  const bar = document.getElementById('rd-bar');
  const progI = document.querySelector('#rd-prog i');
  const readP = () => { const r = art.getBoundingClientRect(); return r.height ? Math.max(0, Math.min(1, (innerHeight - r.top) / r.height)) : 0; };
  const scrollToP = (p) => { const r = art.getBoundingClientRect(); window.scrollTo({ top: Math.max(0, scrollY + r.top + p * r.height - innerHeight), behavior: 'auto' }); };
  let contentReady = false, lastY = scrollY, queued = false, lastSave = 0, lastSent = { pct: -10, t: 0 }, prefetched = false, curP = 0;
  const posKey = `nv:pos:${slug}:${no}`;

  function frame() {
    queued = false;
    const y = scrollY, dy = y - lastY;
    curP = readP();
    if (progI) progI.style.transform = `scaleX(${curP.toFixed(4)})`;
    if (bar && Math.abs(dy) > 6) {
      const atEnd = innerHeight + y >= document.documentElement.scrollHeight - 90;
      bar.classList.toggle('hide', dy > 0 && y > 140 && !atEnd);
      lastY = y;
    }
    if (!contentReady) return;
    const now = Date.now();
    if (now - lastSave > 1000) { lastSave = now; savePos(); }
    if (!prefetched && curP > 0.6) {
      prefetched = true;
      const nx = document.querySelector('a[rel="next"]');
      if (nx) { const l = document.createElement('link'); l.rel = 'prefetch'; l.href = nx.href; document.head.append(l); }
    }
    syncProgress(false);
  }
  // บันทึกอีกครั้งหลังหยุดเลื่อน (การบันทึกระหว่างเลื่อนถูกจำกัดความถี่ จึงอาจตกค้างที่จุดที่เลื่อนผ่าน)
  let settleT = 0;
  const settle = () => { if (!contentReady) return; curP = readP(); savePos(); syncProgress(false); };
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } clearTimeout(settleT); settleT = setTimeout(settle, 600); };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });

  function savePos() {
    try {
      const pct = Math.round(curP * 1000) / 10;
      localStorage.setItem(posKey, String(pct));
      localStorage.setItem('nv:last:' + slug, JSON.stringify({ no, pct, t: Date.now() }));
    } catch {}
  }
  function syncProgress(force) {
    if (!authed || !contentReady) return;
    const now = Date.now(), pct = Math.round(curP * 100);
    if (!force && (now - lastSent.t < 20000 || Math.abs(pct - lastSent.pct) < 3)) return;
    if (force && pct === lastSent.pct && now - lastSent.t < 3000) return;
    lastSent = { pct, t: now };
    try {
      fetch(NIV.API + '/api/novel/progress', { method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.token }, body: JSON.stringify({ userId: s.userId, slug, no, pct }) }).catch(() => {});
    } catch {}
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { curP = readP(); savePos(); syncProgress(true); } });
  addEventListener('pagehide', () => { curP = readP(); if (contentReady) savePos(); syncProgress(true); });

  // ================= ฟองคอมเมนต์รายย่อหน้า =================
  const paras = () => [...art.querySelectorAll('.rd-text > p')];
  function injectBubbles() {
    paras().forEach((p, i) => {
      if (p.querySelector('.rd-pb')) return;
      p.dataset.p = String(i + 1);
      const b = el('button', 'rd-pb'); b.type = 'button'; b.dataset.p = String(i + 1);
      b.setAttribute('aria-label', 'ความคิดเห็นย่อหน้าที่ ' + (i + 1));
      p.append(b);
    });
  }
  async function loadCounts() {
    try {
      const r = await fetch(NIV.API + '/api/novel/para-counts?slug=' + enc(slug) + '&no=' + no);
      const d = await r.json(); if (!d.counts) return;
      art.querySelectorAll('.rd-pb').forEach((b) => { const c = d.counts[b.dataset.p]; if (c) { b.dataset.c = String(c); b.textContent = c > 99 ? '99+' : String(c); } });
    } catch {}
  }
  const paraText = (p) => [...p.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
  function openPara(n) {
    const p = art.querySelector(`.rd-text > p[data-p="${n}"]`); if (!p) return;
    const bub = p.querySelector('.rd-pb');
    NS.openSheet({
      title: 'ความคิดเห็นย่อหน้าที่ ' + n,
      dock: true,
      render: (body) => {
        const q = el('blockquote', 'flex-none px-3 py-2 mb-3 rounded-lg border-l-4 border-amber-500 bg-amber-500/10 text-slate-600 dark:text-neutral-300');
        const qt = el('p', 'text-sm leading-6 line-clamp-2'); qt.textContent = paraText(p); q.append(qt); body.append(q);   // ตัดบรรทัดที่ข้อความด้านใน ไม่ใช่กล่องที่มี padding (กันบรรทัดที่สามโผล่)
        const box = el('div'); body.append(box);
        NS.mountComments(box, { slug, no, para: n, dock: true, placeholder: 'พูดถึงย่อหน้านี้…',
          onTotal: (d) => { const c = Math.max(0, (parseInt(bub.dataset.c, 10) || 0) + d); bub.dataset.c = String(c); bub.textContent = c ? (c > 99 ? '99+' : String(c)) : ''; } });
      },
    });
  }
  art.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('.rd-pb'); if (b) { e.preventDefault(); openPara(Number(b.dataset.p)); } });

  // ================= เริ่มทำงานเมื่อมีเนื้อหา =================
  function onContentReady() {
    if (contentReady) return;
    contentReady = true;
    injectBubbles(); loadCounts();
    curP = readP(); if (progI) progI.style.transform = `scaleX(${curP.toFixed(4)})`;
    // นับวิว: อ่านจริงอย่างน้อย 4 วินาทีและแท็บยังเปิดอยู่
    setTimeout(() => { if (document.visibilityState === 'visible') NS.view(slug, no); }, 4000);
    // ลิงก์ย่อหน้า #p12 หรือกลับมาอ่านต่อจากจุดเดิม
    const m = /^#p(\d{1,4})$/.exec(location.hash);
    if (m) {
      const p = art.querySelector(`.rd-text > p[data-p="${m[1]}"]`);
      if (p) setTimeout(() => { p.scrollIntoView({ block: 'center', behavior: 'smooth' }); p.classList.add('rd-flash'); }, 250);
    } else {
      let saved = NaN; try { saved = parseFloat(localStorage.getItem(posKey)); } catch {}
      if (saved > 3 && saved < 97 && scrollY < 60) {
        requestAnimationFrame(() => {
          scrollToP(saved / 100);
          NS.toast('กลับมาอ่านต่อจากเดิม', { label: 'เริ่มใหม่', fn: () => window.scrollTo({ top: 0, behavior: 'smooth' }) });
        });
      }
    }
    schedule();
  }

  // ================= ตอนที่มีราคา =================
  const panel = document.getElementById('lock-panel');
  function renderContent(text) {
    const box = el('div', 'rd-text');
    String(text || '').split(/\n+/).map((t) => t.trim()).filter(Boolean).forEach((t) => box.append(el('p', '', t)));
    art.replaceChildren(box);
    onContentReady();
  }
  if (!panel) onContentReady();
  else {
    const msg = document.getElementById('lock-msg'), btn = document.getElementById('unlock-btn'), login = document.getElementById('login-link');
    const price = Number(panel.dataset.price) || 0;
    const q = `slug=${enc(slug)}&no=${no}&userId=${enc(s.userId || '')}`;
    const show = (text, o = {}) => { msg.textContent = text; btn.classList.toggle('hidden', !o.unlock); login.classList.toggle('hidden', !o.needLogin); };
    const load = async () => {
      if (!authed) return show('ต้องเข้าสู่ระบบก่อนจึงจะปลดล็อกตอนนี้ได้', { needLogin: true });
      const r = await api('/api/novel/chapter?' + q);
      if (r.status === 401) return show('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', { needLogin: true });
      if (!r.ok) return show(r.data.error || 'โหลดตอนนี้ไม่สำเร็จ ลองรีเฟรชหน้านี้');
      if (!r.data.locked) return renderContent(r.data.chapter.content);
      show('ใช้ ' + price.toLocaleString('th-TH') + ' coin เพื่ออ่านตอนนี้ (ปลดล็อกครั้งเดียว อ่านซ้ำได้ตลอด)', { unlock: true });
    };
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const r = await api('/api/novel/unlock', { method: 'POST', body: { userId: s.userId, slug, no } });
      btn.disabled = false;
      if (r.status === 402) return show('Coin ไม่พอสำหรับปลดล็อกตอนนี้');
      if (r.status === 401) return show('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', { needLogin: true });
      if (!r.ok) return show(r.data.error || 'ปลดล็อกไม่สำเร็จ ลองใหม่อีกครั้ง', { unlock: true });
      load();
    });
    load();
  }

  // ================= สารบัญตอน =================
  document.getElementById('rd-toc')?.addEventListener('click', () => {
    NS.openSheet({ title: 'สารบัญ', render: async (body) => {
      const wait = el('p', 'nv-pulse text-sm text-slate-500', 'กำลังโหลดสารบัญ…'); body.append(wait);
      let d; try { d = await (await fetch(NIV.API + '/api/novel/get?slug=' + enc(slug))).json(); } catch {}
      if (!d || !d.chapters) { wait.textContent = 'โหลดสารบัญไม่สำเร็จ'; wait.classList.remove('nv-pulse'); return; }
      const ul = el('ul', 'nv-toc divide-y divide-slate-200 dark:divide-white/10 -mx-2');
      let cur = null;
      d.chapters.forEach((c) => {
        const li = el('li'); const a = el('a', 'flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm');
        a.href = `/novels/${enc(slug)}/${c.no}`;
        const l = el('span', 'min-w-0 truncate'); l.append(el('span', 'text-slate-400 mr-2', String(c.no)), document.createTextNode(c.title));
        const pr = el('span', 'shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400');
        if (c.price > 0) pr.append(NS.ico('lock'), document.createTextNode(String(c.price)));
        a.append(l, pr);
        if (c.no === no) { a.setAttribute('aria-current', 'true'); cur = a; }
        li.append(a); ul.append(li);
      });
      wait.replaceWith(ul);
      if (cur) cur.scrollIntoView({ block: 'center' });
    } });
  });

  // ================= ตั้งค่าการอ่าน =================
  document.getElementById('rd-set')?.addEventListener('click', () => {
    NS.openSheet({ title: 'ตั้งค่าการอ่าน', render: (body) => {
      const wrap = el('div', 'rd-set');
      const sample = el('div', 'rd-sample', 'ตัวอย่างข้อความ — ลมหนาวพัดผ่านทุ่งหญ้า เสียงกระดิ่งดังแว่วมาแต่ไกล');
      const groups = [];
      const change = (key, v) => {
        const p0 = contentReady ? readP() : 0;
        prefs[key] = v; applyPrefs(); savePrefs(); groups.forEach((g) => g());
        if (contentReady && key !== 'par' && key !== 't') requestAnimationFrame(() => scrollToP(p0));   // รักษาตำแหน่งที่อ่านอยู่เมื่อข้อความไหลใหม่
        schedule();
      };
      const group = (title, opts, key) => {
        const h = el('div'); h.append(el('h4', '', title));
        const seg = el('div', 'rd-seg');
        const paint = () => seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(String(prefs[key]) === b.dataset.v)));
        opts.forEach(([v, label, sw]) => {
          const b = el('button'); b.type = 'button'; b.dataset.v = String(v);
          if (sw) { const i = el('span', 'rd-sw'); i.style.background = sw; b.append(i); }
          b.append(document.createTextNode(label));
          b.addEventListener('click', () => change(key, typeof DEF[key] === 'number' ? Number(v) : v));
          seg.append(b);
        });
        h.append(seg); groups.push(paint); paint(); return h;
      };
      wrap.append(
        group('ธีม', [['auto', 'ตามเว็บ'], ['light', 'สว่าง', '#fff'], ['sepia', 'ซีเปีย', '#f4ecd8'], ['dark', 'มืด', '#161616'], ['black', 'ดำสนิท', '#000']], 't'),
        group('ฟอนต์', Object.entries(FONTS).map(([k, f]) => [k, f.label]), 'f'),
        group('ขนาดตัวอักษร', [[15, '15'], [17, '17'], [18, '18'], [20, '20'], [22, '22'], [25, '25']], 's'),
        group('ระยะบรรทัด', [[1.6, 'แน่น'], [1.8, 'ปกติ'], [2, 'โปร่ง'], [2.3, 'โปร่งมาก']], 'lh'),
        group('ความกว้างหน้า', [['n', 'แคบ'], ['m', 'กลาง'], ['w', 'กว้าง']], 'w'),
        group('คอมเมนต์รายย่อหน้า', [['off', 'ปิด'], ['some', 'เฉพาะที่มี'], ['all', 'ทุกย่อหน้า']], 'par'),
        sample,
      );
      const reset = el('button', 'text-sm text-slate-500 dark:text-neutral-400 hover:text-amber-500 justify-self-start', 'คืนค่าเริ่มต้น'); reset.type = 'button';
      reset.addEventListener('click', () => { prefs = { ...DEF }; applyPrefs(); savePrefs(); groups.forEach((g) => g()); schedule(); });
      wrap.append(reset); body.append(wrap);
    } });
  });

  // ================= คอมเมนต์ท้ายตอน (โหลดเมื่อเลื่อนใกล้ถึง) =================
  const cmRoot = document.getElementById('cm-root');
  document.getElementById('rd-cm')?.addEventListener('click', () => document.getElementById('chapter-comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  if (cmRoot) {
    const title = document.getElementById('cm-total');
    let total = 0;
    const mount = () => NS.mountComments(cmRoot, { slug, no, para: 0, placeholder: 'ตอนนี้เป็นยังไงบ้าง? เล่าให้ฟังหน่อย…',
      onTotal: (d) => { total = Math.max(0, total + d); if (title) title.textContent = total ? '(' + NS.num(total) + ')' : ''; } });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { io.disconnect(); mount(); } }, { rootMargin: '500px 0px' });
      io.observe(cmRoot);
    } else mount();
  }

  // ================= คีย์ลัด =================
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    if (document.querySelector('.nv-sheet.open')) return;
    const sel = e.key === 'ArrowLeft' ? 'a[rel="prev"]' : e.key === 'ArrowRight' ? 'a[rel="next"]' : null;
    const a = sel && document.querySelector(sel);
    if (a && a.href) location.href = a.href;
  });
})();