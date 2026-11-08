// /novel-page.js — หน้านิยายเรื่องเดียว
//  · ปกเอียงตามเมาส์ (เฉพาะอุปกรณ์ที่มีเมาส์และไม่ได้ตั้งลดการเคลื่อนไหว)
//  · ถูกใจ / เก็บเข้าชั้น / แชร์ / ให้คะแนนดาว (อัปเดตทันที ถ้าพลาดย้อนกลับ)
//  · ปุ่ม "อ่านต่อ" จากตำแหน่งที่อ่านค้าง (บัญชี + ในเครื่อง) · คอมเมนต์ทั้งเรื่อง (โหลดตอนเลื่อนใกล้ถึง)
(() => {
  const page = document.getElementById('novel-page');
  if (!page) return;
  const slug = page.dataset.slug, title = page.dataset.title;
  const NS = window.NovelSocial;
  const $ = (id) => document.getElementById(id);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const digits = (t) => parseInt(String(t).replace(/[^\d]/g, ''), 10) || 0;

  // ---------- ปกเอียงตามเมาส์ (อ่านตำแหน่งจากกรอบด้านนอกที่ไม่เอียง กันสั่น) ----------
  const tilt = document.querySelector('.nv-tilt');
  if (tilt && !reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const wrap = tilt.parentElement; let raf = 0, ev = null;
    wrap.addEventListener('pointermove', (e) => {
      ev = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = wrap.getBoundingClientRect();
        const x = (ev.clientX - r.left) / r.width - 0.5, y = (ev.clientY - r.top) / r.height - 0.5;
        tilt.classList.add('moving');
        tilt.style.setProperty('--ry', (x * 14).toFixed(2) + 'deg');
        tilt.style.setProperty('--rx', (-y * 14).toFixed(2) + 'deg');
        tilt.style.setProperty('--gx', (x * 120).toFixed(1) + '%');
      });
    });
    wrap.addEventListener('pointerleave', () => {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      tilt.classList.remove('moving');
      tilt.style.removeProperty('--rx'); tilt.style.removeProperty('--ry'); tilt.style.removeProperty('--gx');
    });
  }

  if (!NS) return;

  // ---------- แชร์ ----------
  $('act-share')?.addEventListener('click', () => NS.share({ title, url: location.origin + location.pathname }));

  // ลิงก์ "ดูในชั้นหนังสือของฉัน" ค้างอยู่ใต้ปุ่มตลอดเมื่อเรื่องนี้อยู่ในชั้น (ไม่หายไปเหมือนทอสต์)
  const showShelfLink = (on) => $('shelf-link')?.classList.toggle('hidden', !on);

  // ---------- ถูกใจ / เก็บเข้าชั้น ----------
  function wire(id, kind, key) {
    const btn = $(id); if (!btn) return;
    const ct = btn.querySelector('.nv-ct');
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      if (!NS.authed()) { NS.toggle(kind, slug, true); return; }          // แสดงทอสต์ให้เข้าสู่ระบบ
      const was = btn.getAttribute('aria-pressed') === 'true', cur = ct ? digits(ct.textContent) : 0;
      btn.setAttribute('aria-pressed', String(!was)); if (ct) ct.textContent = NS.num(Math.max(0, cur + (was ? -1 : 1)));
      btn.disabled = true;
      const d = await NS.toggle(kind, slug, !was);
      btn.disabled = false;
      if (!d) { btn.setAttribute('aria-pressed', String(was)); if (ct) ct.textContent = NS.num(cur); return; }
      btn.setAttribute('aria-pressed', String(!!d[key])); if (ct) ct.textContent = NS.num(d.count);
      if (kind === 'bookmark') {
        showShelfLink(d.bookmarked);
        NS.toast(d.bookmarked ? 'เพิ่มเข้าชั้นหนังสือแล้ว' : 'เอาออกจากชั้นหนังสือแล้ว',
          d.bookmarked ? { label: 'ไปที่ชั้นหนังสือ', fn: () => { location.href = '/novel-library'; } } : undefined);
      }
    });
  }
  wire('act-like', 'like', 'liked');
  wire('act-bm', 'bookmark', 'bookmarked');

  // ---------- ดาวให้คะแนน ----------
  const setRatingText = (d) => {                      // ใช้ DOM + ไอคอน SVG (ค่าเป็นตัวเลขจาก API)
    const box = $('rating-sum'); if (!box) return; box.replaceChildren();
    const mk = (cls, txt) => { const e = document.createElement('span'); e.className = cls; if (txt) e.textContent = txt; return e; };
    if (!d.rating_count) { box.append(mk('opacity-70', 'ยังไม่มีคะแนน')); return; }
    const a = mk('inline-flex items-center gap-1 text-amber-500 font-semibold'); a.append(NS.ico('star', 'nv-i nv-i-fill'), document.createTextNode(String(Number(d.rating_avg))));
    box.append(a, mk('opacity-70', '· ' + NS.num(d.rating_count) + ' คะแนน'));
  };
  const stars = $('stars');
  let mine = 0;
  const paintStars = () => stars && stars.querySelectorAll('button').forEach((b) => {
    const on = Number(b.dataset.v) === mine; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on));
  });
  stars?.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const v = Number(b.dataset.v), next = v === mine ? 0 : v, prev = mine;   // กดซ้ำดาวเดิม = ถอนคะแนน
    if (!NS.authed()) { NS.rate(slug, next); return; }
    mine = next; paintStars();
    const d = await NS.rate(slug, next);
    if (!d) { mine = prev; paintStars(); return; }
    setRatingText(d);
    NS.toast(next ? 'ขอบคุณสำหรับคะแนน' : 'ถอนคะแนนแล้ว');
  });

  // ---------- อ่านต่อ ----------
  const start = $('btn-start');
  const tocNos = new Set([...document.querySelectorAll('.nv-toc a[data-no]')].map((a) => Number(a.dataset.no)));
  function setResume(no, pct) {
    if (!start || !no) return;
    const done = pct >= 95 && tocNos.has(no + 1);
    const target = done ? no + 1 : no;
    start.href = `/novels/${encodeURIComponent(slug)}/${target}`;
    const label = start.querySelector('span') || start;     // เก็บไอคอนไว้ เปลี่ยนเฉพาะข้อความ
    label.textContent = done ? `อ่านต่อ ตอนที่ ${target}` : (pct > 2 && pct < 95 ? `อ่านต่อ ตอนที่ ${no} · ${pct}%` : `อ่านต่อ ตอนที่ ${no}`);
    document.querySelectorAll('.nv-toc a[data-no]').forEach((a) => {
      const n = Number(a.dataset.no);
      if (n < no || (n === no && pct >= 95)) { if (!a.querySelector('.nv-read-dot')) { const d = document.createElement('span'); d.className = 'nv-read-dot'; d.setAttribute('aria-label', 'อ่านแล้ว'); a.firstElementChild.prepend(d); } }
      if (n === target) a.setAttribute('aria-current', 'true');
    });
  }
  let local = null;
  try { local = JSON.parse(localStorage.getItem('nv:last:' + slug) || 'null'); } catch {}
  if (local && local.no) setResume(local.no, Math.round(local.pct || 0));

  if (NS.authed()) {
    NS.me(slug).then((d) => {
      if (!d) return;
      const set = (id, on) => $(id)?.setAttribute('aria-pressed', String(!!on));
      set('act-like', d.liked); set('act-bm', d.bookmarked); showShelfLink(d.bookmarked);
      mine = d.rating || 0; paintStars();
      if (d.progress && (!local || d.progress.updated_at >= (local.t || 0))) setResume(d.progress.chapter_no, d.progress.pct);
    });
  }

  // ---------- เรื่องย่อ: มือถือย่อ 4 บรรทัด + ปุ่มอ่านเพิ่มเติม (โชว์ปุ่มเฉพาะเมื่อข้อความยาวเกินจริง) ----------
  const syn = $('syn'), synMore = $('syn-more');
  if (syn && synMore && matchMedia('(max-width: 639px)').matches && syn.scrollHeight > syn.clientHeight + 2) {
    synMore.classList.remove('hidden');
    synMore.addEventListener('click', () => { const open = syn.classList.toggle('open'); synMore.textContent = open ? 'ย่อเรื่องย่อ' : 'อ่านเพิ่มเติม'; });
  }

  // ---------- คอมเมนต์ทั้งเรื่อง ----------
  const cm = $('cm-root');
  if (cm) {
    let total = 0; const label = $('cm-total');
    const mount = () => NS.mountComments(cm, { slug, no: 0, para: 0, placeholder: 'พูดคุยเกี่ยวกับนิยายเรื่องนี้…',
      onTotal: (d) => { total = Math.max(0, total + d); if (label) label.textContent = total ? '(' + NS.num(total) + ')' : ''; } });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { io.disconnect(); mount(); } }, { rootMargin: '500px 0px' });
      io.observe(cm);
    } else mount();
  }
})();