// public/nivread.js — header/footer ของ nivread + ตัวช่วยกลางสำหรับหน้า login / write / admin
(() => {
  const API = 'https://api.fnnz.art';

  const ls = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
  const session = () => ({ token: ls('token'), userId: ls('userId'), name: ls('userName') });
  const logout = () => {
    ['token', 'userId', 'userEmail', 'userName'].forEach((k) => { try { localStorage.removeItem(k); } catch {} });
    location.href = '/posts';
  };

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

  window.NIV = { API, session, logout, api, el };

  // ---------- header ----------
  const header = document.getElementById('main-header');
  if (header) {
    const s = session();
    const loggedIn = !!(s.token && s.userId);
    const here = encodeURIComponent(location.pathname + location.search);
    const link = 'px-3 py-1.5 rounded-lg text-slate-700 dark:text-neutral-300 hover:bg-slate-200/70 dark:hover:bg-white/10 transition-colors';
    header.innerHTML = `
<div class="sticky top-0 z-30 border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#0d0d0d]/80 backdrop-blur-md">
  <div class="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
    <a href="/posts" class="text-xl font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-400 to-red-500">nivread</a>
    <nav class="flex items-center gap-1 text-sm font-medium" aria-label="เมนูหลัก">
      <a href="/posts" class="${link}">โพสต์</a>
      ${loggedIn
        ? `<a id="niv-admin" href="/admin" class="hidden ${link}">อนุมัติโพสต์</a>
           <a href="/write" class="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold shadow-md shadow-amber-500/25">เขียนโพสต์</a>
           <span id="niv-user" class="hidden sm:inline px-2 text-slate-500 dark:text-neutral-400 max-w-[8rem] truncate"></span>
           <button id="niv-logout" type="button" class="${link}">ออกจากระบบ</button>`
        : `<a href="/login?redirect=${here}" class="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold shadow-md shadow-amber-500/25">เข้าสู่ระบบ</a>`}
    </nav>
  </div>
</div>`;
    if (loggedIn) {
      document.getElementById('niv-user').textContent = s.name || s.userId;
      document.getElementById('niv-logout').addEventListener('click', logout);
      // แอดมินเท่านั้นที่เห็นลิงก์อนุมัติโพสต์ (สิทธิ์จริงตรวจที่เซิร์ฟเวอร์ทุกครั้ง)
      api('/api/blog/me?userId=' + encodeURIComponent(s.userId)).then((r) => {
        if (r.status === 401) { logout(); return; }
        if (r.ok && r.data.isAdmin) document.getElementById('niv-admin')?.classList.remove('hidden');
      }).catch(() => {});
    }
  }

  // ---------- footer ----------
  const footer = document.getElementById('main-footer');
  if (footer) {
    footer.innerHTML = `
<div class="mt-12 border-t border-slate-200 dark:border-white/10 py-6 text-center text-xs text-slate-500 dark:text-neutral-400">
  © ${new Date().getFullYear()} nivread · <a href="/posts" class="hover:text-amber-500">โพสต์ทั้งหมด</a> · <a href="/write" class="hover:text-amber-500">เขียนโพสต์</a>
</div>`;
  }
})();