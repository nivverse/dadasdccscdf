// public/home-feed.js — หน้าแรก "/" : ถ้าสมาชิกติดตามอะไรไว้ สลับเป็นฟีดของฉัน (HTML เรนเดอร์จากเซิร์ฟเวอร์ผ่าน /?feed=1)
// ไม่ได้ล็อกอิน หรือยังไม่ติดตามใคร → คงโพสต์ล่าสุดที่ SSR ไว้ + กล่องชวนติดตาม
(() => {
  const $ = (id) => document.getElementById(id);
  const uid = localStorage.getItem('userId') || '';
  const token = localStorage.getItem('token') || '';
  if (!uid || !token || !$('my-feed')) return;

  const list = $('my-feed-list');
  const url = (page) => `/?feed=1&page=${page}&userId=${encodeURIComponent(uid)}`;
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

  async function more() {
    if (loading || !next) return;
    loading = true;
    const sk = window.NIV && NIV.skel ? NIV.skel(2) : null; if (sk) list.after(sk);
    try {
      const r = await get(next);
      if (!r.ok) throw new Error();
      list.insertAdjacentHTML('beforeend', await r.text());
      next = r.headers.get('X-Has-More') === '1' ? String(+next + 1) : '';
      refresh();
      if (!next) end();
    } catch {} finally { loading = false; sk && sk.remove(); }
  }

  (async () => {
    try {
      const r = await get(1);
      if (!r.ok) return restore();                             // token หมดอายุ ฯลฯ → คงหน้าสาธารณะ
      if ((parseInt(r.headers.get('X-Follow-Count'), 10) || 0) === 0) return restore(); // ยังไม่ติดตามใคร → โชว์โพสต์ล่าสุด
      const html = await r.text();
      skel && skel.remove();
      $('my-feed').classList.remove('hidden');
      if (!html.trim()) { $('my-feed-empty').classList.remove('hidden'); $('my-feed-sentinel').classList.add('hidden'); return; }
      list.insertAdjacentHTML('beforeend', html);
      next = r.headers.get('X-Has-More') === '1' ? '2' : '';
      refresh();
      if (!next) return end();
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver((en) => { if (en[0].isIntersecting) more(); }, { rootMargin: '600px' });
        io.observe($('my-feed-sentinel'));
      }
    } catch { restore(); }
  })();
})();