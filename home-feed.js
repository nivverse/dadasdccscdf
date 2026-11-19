// public/home-feed.js — หน้าแรก "/" : สมาชิกที่ล็อกอินทุกคนได้ฟีด "รู้ใจ" (ติดตาม + ตรงความสนใจ + มาแรง + สำรวจ) — HTML เรนเดอร์จากเซิร์ฟเวอร์ผ่าน /?feed=1
// ไม่ได้ล็อกอิน → คงโพสต์ล่าสุดที่ SSR ไว้ (SEO) · ถ้าฟีดรู้ใจใช้ไม่ได้และยังไม่ติดตามใคร → คืนหน้าสาธารณะเดิม
(() => {
  const $ = (id) => document.getElementById(id);
  const uid = localStorage.getItem('userId') || '';
  const token = localStorage.getItem('token') || '';
  if (!uid || !token || !$('my-feed')) return;

  const list = $('my-feed-list');
  // ความสนใจที่เบราว์เซอร์จดไว้ (NIV.interestParam) — จดค่า ณ ตอนเปิดหน้าไว้ชุดเดียว เพื่อให้เลื่อนไปหน้าถัดไปแล้วลำดับไม่เปลี่ยน
  const interest = (window.NIV && NIV.interestParam && NIV.interestParam()) || '';
  // โพสต์ที่เห็นแล้ว (เก็บในเบราว์เซอร์ ไม่เขียนฐานข้อมูล):
  //   shown   = เห็นในเซสชันนี้ → ส่งเป็น x ให้เซิร์ฟเวอร์ตัดออก (เลื่อนหน้าถัดไปไม่ซ้ำ/ไม่ข้าม)
  //   seenOld = เคยเห็นก่อนเปิดหน้านี้ → ส่งเป็น s ให้เซิร์ฟเวอร์ลดอันดับ (รีเฟรชแล้วเห็นของใหม่ก่อน) · จดค่า ณ ตอนเปิดหน้าไว้ชุดเดียว
  const SEEN_KEY = 'fy_seen_v1';
  const readSeen = () => { try { const a = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); return Array.isArray(a) ? a.filter((s) => typeof s === 'string').slice(0, 150) : []; } catch { return []; } };
  const seenOld = readSeen();
  const shown = [];
  // shown = การ์ดที่ถูกใส่ลงหน้าแล้ว (ใช้กันซ้ำตอนเลื่อนหน้าถัดไป)
  const remember = (slugs) => { slugs.forEach((s) => { if (s && !shown.includes(s)) shown.push(s); }); };

  // seen (บันทึกถาวร) = เฉพาะการ์ดที่ "เลื่อนผ่านตาจริง" (เห็น ≥ 50% ค้าง ≥ 0.8 วิ) — ไม่นับการ์ดที่แค่โหลดล่วงหน้าแต่ยังไม่ถึง
  // ครั้งหน้าที่เปิดหน้าแรก เซิร์ฟเวอร์จะซ่อนโพสต์เหล่านี้ (ถ้ายังมีโพสต์ใหม่พอ) · เขียน localStorage แบบรวมชุด ไม่เขียนทุกการ์ด
  let pend = [], flushT = 0;
  const flushSeen = () => {
    clearTimeout(flushT); flushT = 0;
    if (!pend.length) return;
    const add = pend; pend = [];
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...add, ...readSeen()])].slice(0, 150))); } catch {}
  };
  const markSeen = (slug) => { pend.unshift(slug); if (!flushT) flushT = setTimeout(flushSeen, 1500); };
  addEventListener('pagehide', flushSeen);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSeen(); });
  const dwellT = new Map();
  const seenIO = 'IntersectionObserver' in window ? new IntersectionObserver((en) => {
    for (const e of en) {
      const c = e.target;
      const ok = e.isIntersecting && (e.intersectionRatio >= 0.5 || e.intersectionRect.height >= innerHeight * 0.5); // การ์ดสูงกว่าจอ: กินจอเกินครึ่งก็นับ
      if (ok && !dwellT.has(c)) dwellT.set(c, setTimeout(() => { dwellT.delete(c); seenIO.unobserve(c); if (document.visibilityState === 'visible') markSeen(c.dataset.viewSlug); }, 800));
      else if (!ok && dwellT.has(c)) { clearTimeout(dwellT.get(c)); dwellT.delete(c); }
    }
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] }) : null;

  const url = (page) => {
    let u = `/?feed=1&page=${page}&userId=${encodeURIComponent(uid)}`;
    if (interest) u += '&i=' + encodeURIComponent(interest);
    if (shown.length) u += '&x=' + encodeURIComponent(shown.slice(-100).join(','));
    if (seenOld.length) u += '&s=' + encodeURIComponent(seenOld.slice(0, 150).join(','));
    return u;
  };
  const get = (page) => fetch(url(page), { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
  const refresh = () => { window.NIV_refreshFeed && window.NIV_refreshFeed(); };

  // รอผลฟีด: ซ่อนโพสต์สาธารณะชั่วคราวแล้วโชว์ skeleton (ถ้าไม่ได้ติดตามใคร/พลาด จะคืนหน้าเดิม)
  const skel = window.NIV && NIV.skel ? NIV.skel(3) : null;
  if (skel) { $('public-feed').classList.add('hidden'); $('follow-prompt')?.classList.add('hidden'); $('public-feed').before(skel); }
  const restore = () => { skel && skel.remove(); $('public-feed').classList.remove('hidden'); $('follow-prompt')?.classList.remove('hidden'); };
  let next = '';
  let loading = false;
  let io = null;

  const end = () => { $('my-feed-end').classList.remove('hidden'); io && io.disconnect(); };

  // ใส่การ์ดต่อท้ายฟีด โดยข้ามโพสต์ที่แสดงอยู่แล้ว (ลำดับฟีดคำนวณใหม่ทุกหน้า อาจมีโพสต์ซ้ำเล็กน้อยเมื่อข้อมูลเปลี่ยนระหว่างเลื่อน)
  const add = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html;
    t.content.querySelectorAll('[data-view-slug]').forEach((c) => {
      if (list.querySelector(`[data-view-slug="${CSS.escape(c.dataset.viewSlug)}"]`)) c.remove();
    });
    const cards = [...t.content.querySelectorAll('[data-view-slug]')];
    const fresh = cards.map((c) => c.dataset.viewSlug);
    list.append(t.content);
    remember(fresh);
    if (seenIO) cards.forEach((c) => seenIO.observe(c));
  };

  async function more() {
    if (loading || !next) return;
    loading = true;
    let failed = false;
    const sk = window.NIV && NIV.skel ? NIV.skel(2) : null; if (sk) list.after(sk);
    try {
      const r = await get(next);
      if (!r.ok) throw new Error();
      add(await r.text());
      next = r.headers.get('X-Has-More') === '1' ? String(+next + 1) : '';
      refresh();
      if (!next) end();
    } catch { failed = true; } finally {
      loading = false; sk && sk.remove();
      // บังคับให้ observer ตรวจตำแหน่งใหม่ (กันค้างเมื่อเลื่อนลงสุดเร็วระหว่างกำลังโหลด)
      if (next && io) setTimeout(() => { const s = $('my-feed-sentinel'); if (next && io && s) { io.unobserve(s); io.observe(s); } }, failed ? 2500 : 80);
    }
  }

  (async () => {
    try {
      const r = await get(1);
      if (!r.ok) return restore();                             // token หมดอายุ ฯลฯ → คงหน้าสาธารณะ
      const html = await r.text();
      const followCount = parseInt(r.headers.get('X-Follow-Count'), 10) || 0;
      if (!html.trim() && followCount === 0) return restore(); // ไม่มีอะไรให้แสดงและยังไม่ติดตามใคร → โชว์โพสต์ล่าสุดตามเดิม
      skel && skel.remove();
      $('my-feed').classList.remove('hidden');
      if (!html.trim()) { $('my-feed-empty').classList.remove('hidden'); $('my-feed-sentinel').classList.add('hidden'); return; }
      add(html);
      next = r.headers.get('X-Has-More') === '1' ? '2' : '';
      refresh();
      if (!next) return end();
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver((en) => { if (en.some((x) => x.isIntersecting)) more(); }, { rootMargin: '1200px' });
        io.observe($('my-feed-sentinel'));
      }
    } catch { restore(); }
  })();
})();