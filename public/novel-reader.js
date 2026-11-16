// /novel-reader.js — หน้าอ่านตอน
//  · ตั้งค่าการอ่าน (ธีม ฟอนต์ ขนาด ระยะบรรทัด ความกว้าง) จำไว้ในเครื่อง
//  · แถบความคืบหน้า + แถบเครื่องมือที่ซ่อนเมื่อเลื่อนลง (เขียนแค่ transform, scroll แบบ passive + rAF)
//  · จำตำแหน่งที่อ่านค้าง (ในเครื่อง + ซิงก์ไปบัญชีถ้าล็อกอิน) · นับวิวครั้งเดียวหลังอ่านจริง
//  · คอมเมนต์รายย่อหน้า · สารบัญตอน · ลูกศรซ้าย/ขวาเปลี่ยนตอน
//  · เสียงประกอบตอน (ถ้าแอดมินอัปโหลดไว้): ตัวเล่นเหนือเนื้อหา · จำตำแหน่ง/ความเร็ว · ฟังจบแล้วมีปุ่มไปตอนถัดไป
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
    if (!prefetched && curP > 0.9) {
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
  // ซิงก์ความคืบหน้าเข้าบัญชีเฉพาะนิยายที่ "เก็บเข้าชั้น" (ชั้นหนังสือ/อ่านต่อข้ามเครื่องใช้เฉพาะเรื่องที่เก็บ)
  // เรื่องอื่นจำในเครื่องอย่างเดียว → ลดการเขียน D1 ลงมาก · ธงเก็บในเครื่อง 24 ชม. ถ้าไม่มีถามเซิร์ฟเวอร์ครั้งเดียว
  let bm = false;
  if (authed) {
    let c = null; try { c = JSON.parse(localStorage.getItem('nv:bm:' + slug) || 'null'); } catch {}
    if (c && Date.now() - c.t < 86400000) bm = c.v === 1;
    else NS.me(slug).then((d) => { bm = !!(d && d.bookmarked); try { localStorage.setItem('nv:bm:' + slug, JSON.stringify({ v: bm ? 1 : 0, t: Date.now() })); } catch {} });
  }
  function syncProgress(force) {
    if (!authed || !contentReady || !bm) return;
    const now = Date.now(), pct = Math.round(curP * 100);
    if (!force && (now - lastSent.t < 90000 || Math.abs(pct - lastSent.pct) < 5)) return;
    if (force && Math.abs(pct - lastSent.pct) < 2) return;
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
  let countsLoaded = false;
  async function loadCounts() {
    if (countsLoaded) return; countsLoaded = true;
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


  // ================= เสียงประกอบตอน (แสดงเฉพาะตอนที่แอดมินอัปโหลดไว้ · ไฟล์เสิร์ฟจากโดเมน R2/CDN ตรง ๆ ไม่ผ่าน Worker) =================
  //  · ตอนที่มีราคา: เรียกหลังเนื้อหาแสดงแล้วเท่านั้น (onContentReady) จึงไม่โผล่ตัวเล่นให้คนที่ยังไม่ปลดล็อก
  //  · preload="none" ไม่โหลดไฟล์จนกว่าจะกดเล่น · จำตำแหน่งที่ฟังค้าง + ความเร็ว · ปุ่มบนหน้าจอล็อก (Media Session)
  let audioMounted = false, fabAudio = false;   // fabAudio = ปุ่มลอย (#rd-cm) ถูกเปลี่ยนจากคอมเมนต์เป็นปุ่มเสียงแล้ว
  const AUD_RATES = [1, 1.25, 1.5, 1.75, 2, 0.75];
  const fmtT = (t) => { t = Math.max(0, Math.floor(t || 0)); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), x = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  function audioCss() {
    if (document.getElementById('nv-aud-css')) return;
    const st = document.createElement('style'); st.id = 'nv-aud-css';
    st.textContent = `
.nv-ap{position:fixed;z-index:60;width:min(20rem,calc(100vw - 1.5rem));box-sizing:border-box;padding:.875rem 1rem .75rem;border-radius:1.375rem;display:grid;gap:.625rem;color:#f4f4f5;background:rgba(24,24,27,.92);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.12);box-shadow:0 16px 48px rgba(0,0,0,.4);font-family:var(--rd-font,inherit);opacity:0;visibility:hidden;transform:translateY(12px) scale(.94);transform-origin:100% 100%;transition:opacity .2s,transform .32s cubic-bezier(.2,.9,.3,1.25),visibility 0s .32s}
.nv-ap.show{opacity:1;visibility:visible;transform:none;transition-delay:0s}
.nv-ap .h{display:flex;align-items:center;gap:.75rem}
.nv-ap .t{flex:1;min-width:0;font-size:.8125rem;line-height:1.3}.nv-ap .t b{display:block;font-weight:700}.nv-ap .t span{opacity:.7;font-variant-numeric:tabular-nums}
.nv-ap .c{display:flex;align-items:center;justify-content:center;gap:.75rem}
.nv-ap button{display:inline-flex;align-items:center;justify-content:center;min-width:2.5rem;height:2.5rem;padding:0 .5rem;border-radius:999px;font-size:.75rem;font-weight:700;color:inherit;background:rgba(255,255,255,.1);cursor:pointer;border:0;-webkit-tap-highlight-color:transparent;transition:background .15s,transform .15s}
.nv-ap button:hover{background:rgba(255,255,255,.18)}.nv-ap button:active{transform:scale(.9)}
.nv-ap button.play{width:3.25rem;height:3.25rem;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#fff;box-shadow:0 6px 18px rgba(245,158,11,.45)}
.nv-ap button.play:hover{filter:brightness(1.08)}
.nv-ap button.rate{background:rgba(245,158,11,.18);color:#fbbf24;min-width:3rem}
.nv-ap svg{width:1.25rem;height:1.25rem}.nv-ap button.play svg{width:1.5rem;height:1.5rem}
.nv-ap button:focus-visible,.nv-ap input:focus-visible{outline:2px solid #fbbf24;outline-offset:2px}
.nv-ap .spinb svg{animation:nv-spin .5s ease-out reverse}.nv-ap .spinf svg{animation:nv-spin .5s ease-out}
@keyframes nv-spin{to{transform:rotate(360deg)}}
.nv-ap input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:1.5rem;margin:0;background:transparent;cursor:pointer}
.nv-ap input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:99px;background:linear-gradient(90deg,#f59e0b var(--p,0%),rgba(255,255,255,.18) var(--p,0%))}
.nv-ap input[type=range]::-moz-range-track{height:6px;border-radius:99px;background:linear-gradient(90deg,#f59e0b var(--p,0%),rgba(255,255,255,.18) var(--p,0%))}
.nv-ap input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;margin-top:-5px;border-radius:50%;background:#fff;border:3px solid #f59e0b;box-shadow:0 2px 6px rgba(0,0,0,.4);transition:transform .15s}
.nv-ap input[type=range]::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:#fff;border:3px solid #f59e0b}
.nv-ap input[type=range]:active::-webkit-slider-thumb{transform:scale(1.25)}
.nv-eq{display:inline-flex;align-items:flex-end;gap:3px;height:1.5rem;width:1.75rem}
.nv-eq i{flex:1;height:100%;border-radius:2px;background:linear-gradient(#fbbf24,#f59e0b);transform-origin:bottom;transform:scaleY(.22);transition:transform .3s}
.nv-ap.playing .nv-eq i{animation:nv-eq 1s ease-in-out infinite}
.nv-ap.playing .nv-eq i:nth-child(2){animation-duration:.75s;animation-delay:-.3s}
.nv-ap.playing .nv-eq i:nth-child(3){animation-duration:1.15s;animation-delay:-.6s}
.nv-ap.playing .nv-eq i:nth-child(4){animation-duration:.9s;animation-delay:-.15s}
@keyframes nv-eq{0%,100%{transform:scaleY(.22)}50%{transform:scaleY(1)}}
.nv-ring{position:absolute;left:-5px;top:-5px;width:calc(100% + 10px);height:calc(100% + 10px);transform:rotate(-90deg);pointer-events:none;overflow:visible}
.nv-ring circle{fill:none;stroke-width:4}
.nv-ring .bg{stroke:rgba(245,158,11,.22)}
.nv-ring .fg{stroke:#f59e0b;stroke-linecap:round;stroke-dasharray:289;stroke-dashoffset:289;transition:stroke-dashoffset .4s linear}
.nv-halo{position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0}
.nv-fab-on .nv-halo{animation:nv-halo 1.8s ease-out infinite}
@keyframes nv-halo{0%{opacity:.6;box-shadow:0 0 0 0 rgba(245,158,11,.55)}100%{opacity:0;box-shadow:0 0 0 16px rgba(245,158,11,0)}}
.nv-fab-idle>svg:not(.nv-ring){animation:nv-wig 5s ease-in-out infinite;transform-origin:50% 60%}
@keyframes nv-wig{0%,84%,100%{transform:rotate(0)}88%{transform:rotate(-14deg)}92%{transform:rotate(12deg)}96%{transform:rotate(-6deg)}}
.nv-fab-pop{animation:nv-pop .35s cubic-bezier(.2,.9,.3,1.5)}
@keyframes nv-pop{50%{transform:scale(1.14)}}
@media (prefers-reduced-motion:reduce){.nv-ap,.nv-ap *,.nv-halo,.nv-fab-idle>svg,.nv-fab-pop,.nv-ring .fg{animation:none!important;transition:none!important}}`;
    document.head.append(st);
  }
  async function mountAudio() {
    if (audioMounted) return; audioMounted = true;
    let a = null;
    try { const d = await (await fetch(NIV.API + '/api/blog/novel-audio?slug=' + enc(slug) + '&no=' + no)).json(); a = d && d.success && d.audio; } catch { return; }
    if (!a || !a.url) return;
    audioCss();
    const ICON = {
      play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z"/></svg>',
      pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
      back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8"/><path d="M3 3v5h5"/></svg>',
      fwd: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 11-9-9 9 9 0 016.4 2.6L21 8"/><path d="M21 3v5h-5"/></svg>',
    };
    // แผงควบคุมลอย (ไม่อยู่บนสุดของหน้าแล้ว): เด้งขึ้นเหนือปุ่มลอยเมื่อกดเล่น/หยุด แล้วหุบเองใน 5 วินาที
    const panel = el('div', 'nv-ap'); panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'ควบคุมเสียงประกอบตอนนี้');
    const au = el('audio'); au.preload = 'none'; au.src = a.url;
    const mk = (cls, icon, label) => { const b = el('button', cls); b.type = 'button'; b.setAttribute('aria-label', label); b.innerHTML = icon; return b; };
    const play = mk('play', ICON.play, 'เล่นเสียง'), back = mk('', ICON.back, 'ย้อนกลับ 15 วินาที'), fwd = mk('', ICON.fwd, 'ข้ามไปข้างหน้า 15 วินาที');
    const rate = el('button', 'rate', '1×'); rate.type = 'button'; rate.setAttribute('aria-label', 'ความเร็วในการเล่น');
    const eq = el('span', 'nv-eq'); eq.setAttribute('aria-hidden', 'true'); eq.innerHTML = '<i></i><i></i><i></i><i></i>';
    const head = el('div', 'h'), txt = el('div', 't'), time = el('span', '', '0:00 / ' + fmtT(a.duration));
    txt.append(el('b', '', 'ฟังตอนที่ ' + no), time);
    head.append(eq, txt, rate);
    const seek = el('input'); seek.type = 'range'; seek.min = '0'; seek.max = '1000'; seek.value = '0'; seek.setAttribute('aria-label', 'ตำแหน่งเสียง');
    const ctr = el('div', 'c'); ctr.append(back, play, fwd);
    panel.append(head, seek, ctr, au);
    document.body.append(panel);

    const fab = document.getElementById('rd-cm');
    let ringFg = null;
    // ปุ่มลอยเดิม = ไปคอมเมนต์ → ตอนที่มีเสียงเปลี่ยนเป็นปุ่มเสียง: หูฟัง = เล่น · ขีดคู่ = หยุด + วงแหวนบอกความคืบหน้า + คลื่นเรืองแสงตอนเล่น
    let setFab = () => {};
    if (fab) {
      const old = fab.querySelector('svg'), cls = old ? old.getAttribute('class') : '';
      if (getComputedStyle(fab).position === 'static') fab.style.position = 'relative';
      setFab = (on) => {
        const ic = NS.ico(on ? 'pause' : 'headphones', cls), cur = fab.querySelector('svg:not(.nv-ring)');
        if (cur) cur.replaceWith(ic); else fab.prepend(ic);
        const t = on ? 'หยุดเสียงชั่วคราว' : 'ฟังเสียงตอนนี้'; fab.setAttribute('aria-label', t); fab.title = t;
        fab.classList.toggle('nv-fab-on', on); if (on) fab.classList.remove('nv-fab-idle');
        fab.classList.remove('nv-fab-pop'); void fab.offsetWidth; fab.classList.add('nv-fab-pop');
      };
      fabAudio = true; setFab(false); fab.classList.add('nv-fab-idle');
      fab.insertAdjacentHTML('beforeend', '<svg class="nv-ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="bg" cx="50" cy="50" r="46"/><circle class="fg" cx="50" cy="50" r="46"/></svg><span class="nv-halo"></span>');
      ringFg = fab.querySelector('.nv-ring .fg');
      fab.addEventListener('animationend', (e) => { if (e.animationName === 'nv-pop') fab.classList.remove('nv-fab-pop'); });
    }

    // ---- แสดง/ซ่อนแผง ----
    let hideT = 0, over = false, dragging = false;
    const place = () => {
      if (!fab) { panel.style.right = '1rem'; panel.style.bottom = '5rem'; return; }
      const r = fab.getBoundingClientRect();
      panel.style.right = Math.max(12, innerWidth - r.right) + 'px';
      panel.style.bottom = Math.max(12, innerHeight - r.top + 14) + 'px';
    };
    const hidePanel = () => { clearTimeout(hideT); panel.classList.remove('show'); };
    const arm = () => { clearTimeout(hideT); if (!fab) return; hideT = setTimeout(() => (over || dragging ? arm() : hidePanel()), 5000); };
    const showPanel = () => { place(); panel.classList.add('show'); arm(); };
    panel.addEventListener('pointerenter', () => { over = true; }); panel.addEventListener('pointerleave', () => { over = false; arm(); });
    panel.addEventListener('focusin', () => { over = true; }); panel.addEventListener('focusout', () => { over = false; arm(); });
    panel.addEventListener('pointerdown', arm);
    document.addEventListener('pointerdown', (e) => { if (fab && !panel.contains(e.target) && !fab.contains(e.target)) hidePanel(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePanel(); });
    addEventListener('resize', () => { if (panel.classList.contains('show')) place(); });
    if (!fab) showPanel();

    // ---- เครื่องเล่น ----
    const dur = () => (isFinite(au.duration) && au.duration > 0 ? au.duration : a.duration || 0);
    const ratio = (t) => { const d = dur(); return d ? Math.min(1, Math.max(0, t / d)) : 0; };
    const paint = () => {
      const d = dur(), r = ratio(au.currentTime);
      time.textContent = fmtT(au.currentTime) + ' / ' + fmtT(d);
      if (!dragging) { seek.value = String(Math.round(r * 1000)); seek.style.setProperty('--p', (r * 100).toFixed(1) + '%'); }
      if (ringFg) ringFg.style.strokeDashoffset = String((289 * (1 - r)).toFixed(1));
    };
    let lastSave = 0, rIdx = 0;
    const posKeyA = `nv:aud:${slug}:${no}`;
    try { const r = parseFloat(localStorage.getItem('nv:aud:rate')); const i = AUD_RATES.indexOf(r); if (i >= 0) rIdx = i; } catch {}
    const setRate = () => { au.playbackRate = AUD_RATES[rIdx]; rate.textContent = AUD_RATES[rIdx] + '×'; try { localStorage.setItem('nv:aud:rate', String(AUD_RATES[rIdx])); } catch {} };
    setRate();
    let saved = NaN; try { saved = parseFloat(localStorage.getItem(posKeyA)); } catch {}
    if (saved > 3 && saved < (a.duration || Infinity) - 5) {
      au.addEventListener('loadedmetadata', () => { if (au.currentTime < 1) au.currentTime = saved; }, { once: true });
      time.textContent = fmtT(saved) + ' / ' + fmtT(a.duration);
      const r0 = a.duration ? saved / a.duration : 0; seek.value = String(Math.round(r0 * 1000)); seek.style.setProperty('--p', (r0 * 100).toFixed(1) + '%');
      if (ringFg) ringFg.style.strokeDashoffset = String((289 * (1 - r0)).toFixed(1));
    }
    const save = (force) => { const n = Date.now(); if (!force && n - lastSave < 3000) return; lastSave = n; try { au.currentTime > 3 && au.currentTime < dur() - 5 ? localStorage.setItem(posKeyA, String(Math.floor(au.currentTime))) : localStorage.removeItem(posKeyA); } catch {} };

    const toggle = () => { if (au.paused) au.play().catch(() => NS.toast('เล่นเสียงไม่สำเร็จ ลองอีกครั้ง')); else au.pause(); };
    const kick = (b, c) => { b.classList.remove('spinb', 'spinf'); void b.offsetWidth; b.classList.add(c); };
    play.addEventListener('click', toggle);
    back.addEventListener('click', () => { au.currentTime = Math.max(0, au.currentTime - 15); kick(back, 'spinb'); paint(); });
    fwd.addEventListener('click', () => { au.currentTime = Math.min(dur(), au.currentTime + 15); kick(fwd, 'spinf'); paint(); });
    rate.addEventListener('click', () => { rIdx = (rIdx + 1) % AUD_RATES.length; setRate(); });
    seek.addEventListener('input', () => { dragging = true; seek.style.setProperty('--p', (seek.value / 10) + '%'); time.textContent = fmtT(dur() * seek.value / 1000) + ' / ' + fmtT(dur()); });
    seek.addEventListener('change', () => { au.currentTime = dur() * seek.value / 1000; dragging = false; paint(); save(true); });
    au.addEventListener('timeupdate', () => { paint(); save(false); });
    au.addEventListener('loadedmetadata', paint);
    au.addEventListener('play', () => { panel.classList.add('playing'); play.innerHTML = ICON.pause; play.setAttribute('aria-label', 'หยุดเสียงชั่วคราว'); setFab(true); });
    au.addEventListener('pause', () => { panel.classList.remove('playing'); play.innerHTML = ICON.play; play.setAttribute('aria-label', 'เล่นเสียง'); setFab(false); save(true); });
    au.addEventListener('error', () => { if (au.error && au.currentSrc) NS.toast('โหลดเสียงไม่สำเร็จ ลองรีเฟรชหน้านี้'); });
    au.addEventListener('ended', () => {
      try { localStorage.removeItem(posKeyA); } catch {}
      const nx = document.querySelector('a[rel="next"]');
      if (nx && nx.href) NS.toast('ฟังจบตอนนี้แล้ว', { label: 'ตอนถัดไป', fn: () => { location.href = nx.href; } });
    });
    addEventListener('pagehide', () => save(true));
    if (fab) fab.addEventListener('click', (e) => { e.preventDefault(); toggle(); showPanel(); });
    if ('mediaSession' in navigator && window.MediaMetadata) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: 'ตอนที่ ' + no, artist: document.title.split('|')[0].trim() });
        navigator.mediaSession.setActionHandler('play', toggle); navigator.mediaSession.setActionHandler('pause', toggle);
        navigator.mediaSession.setActionHandler('seekbackward', () => back.click()); navigator.mediaSession.setActionHandler('seekforward', () => fwd.click());
      } catch {}
    }
  }

  // ================= เริ่มทำงานเมื่อมีเนื้อหา =================
  function onContentReady() {
    if (contentReady) return;
    contentReady = true;
    injectBubbles(); if (prefs.par !== 'off') loadCounts();
    mountAudio();
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

  // ================= สารบัญตอน (โหลดเป็นช่วงรอบตอนที่อ่านอยู่ ไม่ดึงทั้งเรื่อง) =================
  document.getElementById('rd-toc')?.addEventListener('click', () => {
    NS.openSheet({ title: 'สารบัญ', render: async (body) => {
      const wait = el('p', 'nv-pulse text-sm text-slate-500', 'กำลังโหลดสารบัญ…'); body.append(wait);
      const get = async (qs) => { try { const d = await (await fetch(NIV.API + '/api/novel/get?slug=' + enc(slug) + '&' + qs)).json(); return d && d.chapters ? d : null; } catch { return null; } };
      const [d, aNos] = await Promise.all([get(`from=${Math.max(1, no - 40)}&limit=100`), NS.audioNos(slug)]);
      if (!d) { wait.textContent = 'โหลดสารบัญไม่สำเร็จ'; wait.classList.remove('nv-pulse'); return; }
      const meta = d.meta || {};
      const ul = el('ul', 'nv-toc divide-y divide-slate-200 dark:divide-white/10 -mx-2');
      const btn = (label) => { const b = el('button', 'w-full mt-2 mb-2 py-3 rounded-xl border border-slate-300 dark:border-white/15 text-sm hover:border-amber-500 transition-colors', label); b.type = 'button'; return b; };
      const prevBtn = btn('โหลดตอนก่อนหน้า'), nextBtn = btn('โหลดตอนถัดไป');
      let firstShown = 0, lastShown = 0, cur = null;
      const row = (c) => {
        const li = el('li'); const a = el('a', 'flex items-center justify-between gap-3 px-3 min-h-[3rem] py-2 rounded-lg text-sm');
        a.href = `/novels/${enc(slug)}/${c.no}`;
        const l = el('span', 'min-w-0 truncate'); l.append(el('span', 'text-slate-400 mr-2', String(c.no)), document.createTextNode(c.title));
        const pr = el('span', 'shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400');
        if (aNos.has(c.no)) pr.append(NS.audioIco());   // ตอนที่มีเสียงประกอบ
        if (c.price > 0) pr.append(NS.ico('lock'), document.createTextNode(String(c.price)));
        a.append(l, pr);
        if (c.no === no) { a.setAttribute('aria-current', 'true'); cur = a; }
        li.append(a); return li;
      };
      const sync = () => { prevBtn.classList.toggle('hidden', !(firstShown > (meta.first_no || 1))); nextBtn.classList.toggle('hidden', !(lastShown < (meta.last_no || 0))); };
      const add = (chs, atTop) => {
        if (!chs.length) return;
        const frag = document.createDocumentFragment(); chs.forEach((c) => frag.append(row(c)));
        if (atTop) ul.prepend(frag); else ul.append(frag);
        firstShown = firstShown ? Math.min(firstShown, chs[0].no) : chs[0].no; lastShown = Math.max(lastShown, chs[chs.length - 1].no); sync();
      };
      add(d.chapters, false);
      wait.replaceWith(prevBtn); prevBtn.after(ul); ul.after(nextBtn); sync();
      prevBtn.addEventListener('click', async () => { prevBtn.disabled = true; const r = await get(`to=${firstShown - 1}&limit=100`); prevBtn.disabled = false; if (r) add(r.chapters, true); });
      nextBtn.addEventListener('click', async () => { nextBtn.disabled = true; const r = await get(`from=${lastShown + 1}&limit=100`); nextBtn.disabled = false; if (r) add(r.chapters, false); });
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
        if (key === 'par' && v !== 'off' && contentReady) loadCounts();
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
  document.getElementById('rd-cm')?.addEventListener('click', () => { if (fabAudio) return; document.getElementById('chapter-comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
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