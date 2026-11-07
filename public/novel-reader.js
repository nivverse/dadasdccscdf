// /novel-reader.js — หน้าอ่านตอนที่มีราคา: ตรวจสิทธิ์หลังล็อกอิน · ปลดล็อกด้วย coin · แสดงเนื้อหาด้วย textContent (ไม่ใช้ innerHTML)
(() => {
  const art = document.getElementById('reader');
  const panel = document.getElementById('lock-panel');
  if (!art || !panel || !window.NIV) return;
  const { session, api } = NIV;
  const slug = art.dataset.slug, no = art.dataset.no;
  const msg = document.getElementById('lock-msg');
  const btn = document.getElementById('unlock-btn');
  const login = document.getElementById('login-link');
  const price = Number(panel.dataset.price) || 0;
  const s = session();
  const q = `slug=${encodeURIComponent(slug)}&no=${encodeURIComponent(no)}&userId=${encodeURIComponent(s.userId || '')}`;

  const show = (text, { unlock = false, needLogin = false } = {}) => {
    msg.textContent = text;
    btn.classList.toggle('hidden', !unlock);
    login.classList.toggle('hidden', !needLogin);
  };

  function render(content) {
    art.replaceChildren();
    art.className = 'mt-6 space-y-5 text-[17px] rounded-2xl bg-white/85 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-md shadow-sm p-5 sm:p-8';
    String(content || '').split(/\n+/).map((t) => t.trim()).filter(Boolean).forEach((t) => {
      const p = document.createElement('p');
      p.className = 'leading-8 text-slate-800 dark:text-neutral-200';
      p.textContent = t;
      art.append(p);
    });
  }

  async function load() {
    if (!s.token || !s.userId) return show('ต้องเข้าสู่ระบบก่อนจึงจะปลดล็อกตอนนี้ได้', { needLogin: true });
    const r = await api('/api/novel/chapter?' + q);
    if (r.status === 401) return show('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', { needLogin: true });
    if (!r.ok) return show(r.data.error || 'โหลดตอนนี้ไม่สำเร็จ ลองรีเฟรชหน้านี้');
    if (!r.data.locked) return render(r.data.chapter.content);
    show('ใช้ ' + price.toLocaleString('th-TH') + ' coin เพื่ออ่านตอนนี้ (ปลดล็อกครั้งเดียว อ่านซ้ำได้ตลอด)', { unlock: true });
  }

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const r = await api('/api/novel/unlock', { method: 'POST', body: { userId: s.userId, slug, no: Number(no) } });
    btn.disabled = false;
    if (r.status === 402) return show('Coin ไม่พอสำหรับปลดล็อกตอนนี้', { unlock: false });
    if (r.status === 401) return show('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', { needLogin: true });
    if (!r.ok) return show(r.data.error || 'ปลดล็อกไม่สำเร็จ ลองใหม่อีกครั้ง', { unlock: true });
    load();
  });

  load();
})();
