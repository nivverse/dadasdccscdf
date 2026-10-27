// public/halloween.js — ตัวตกแต่งธีมฮาโลวีน (ใยแมงมุม ค้างคาว ฟักทอง) + ปุ่มเปิด/ปิดธีมในเมนูข้าง
// โหลดโดย nivread.js เฉพาะช่วงเทศกาล (หรือ ?hw=1 ตอนทดสอบ) — สไตล์อยู่ใน /halloween.css
(() => {
  if (window.__hw) return;
  window.__hw = true;

  const html = document.documentElement;
  const KEY = 'halloween';                       // 'off' = ผู้ใช้ปิดธีมเอง
  const DARK_TC = '#110a05', LIGHT_TC = '#fff5ea';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const getPref = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const setPref = (v) => { try { localStorage.setItem(KEY, v); } catch {} };

  // ---------- theme-color (แถบเบราว์เซอร์มือถือ) ----------
  let tc = document.querySelector('meta[name="theme-color"]');
  const origTc = tc ? tc.getAttribute('content') : '#0d0d0d';
  const syncThemeColor = () => {
    const on = html.classList.contains('halloween');
    if (!tc) {
      if (!on) return;
      tc = document.createElement('meta'); tc.name = 'theme-color'; document.head.appendChild(tc);
    }
    tc.setAttribute('content', on ? (html.classList.contains('dark') ? DARK_TC : LIGHT_TC) : origTc);
  };

  // ---------- SVG ----------
  // ใยแมงมุมมุมบนซ้าย (ฝั่งขวาใช้ scaleX(-1) ใน CSS): เส้นรัศมี + เส้นโค้งขวาง
  const WEB = `<svg class="hw-web hw-web-%S" viewBox="0 0 100 100" aria-hidden="true">
<path d="M0 0L100 0M0 0L92 34M0 0L70 70M0 0L34 92M0 0L0 100"/>
<path d="M30 0Q26 26 0 30M52 0Q46 46 0 52M76 0Q66 66 0 76M98 0Q84 84 0 98"/>
</svg>`;
  const BAT = `<svg viewBox="0 0 64 32" aria-hidden="true"><path d="M32 10C30 10 29 8 28 5L27 9C24 7 20 6 15 8 10 10 5 14 1 19 6 18 9 18 12 20 14 18 17 17 20 18 22 19 24 22 26 25 28 24 30 22 32 21 34 22 36 24 38 25 40 22 42 19 44 18 47 17 50 18 52 20 55 18 58 18 63 19 59 14 54 10 49 8 44 6 40 7 37 9L36 5C35 8 34 10 32 10Z"/></svg>`;
  const PUMPKIN = `<svg viewBox="0 0 80 70" aria-hidden="true">
<path class="stem" d="M37 12C37 6 39 3 43 1 42 6 44 9 46 12Z"/>
<ellipse class="body" cx="22" cy="42" rx="17" ry="24"/><ellipse class="body" cx="58" cy="42" rx="17" ry="24"/>
<ellipse class="body" cx="40" cy="40" rx="21" ry="27"/>
<path class="rib" d="M40 13C33 25 33 55 40 67M22 20C14 32 14 52 22 64M58 20C66 32 66 52 58 64"/>
<g class="lit"><ellipse cx="40" cy="46" rx="22" ry="14" fill="url(#hw-glow)"/><g class="face"><path d="M26 31L35 38 24 40ZM54 31L45 38 56 40Z"/><path d="M24 50L30 47 35 53 40 47 45 53 50 47 56 50C52 60 28 60 24 50Z"/></g></g>
</svg>`;
  const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<linearGradient id="hw-pk-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fb923c"/><stop offset="1" stop-color="#c2410c"/></linearGradient>
<radialGradient id="hw-glow"><stop offset="0" stop-color="#fbbf24" stop-opacity=".85"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0"/></radialGradient>
</defs></svg>`;

  // ---------- สร้างตัวตกแต่ง (ครั้งเดียว ตอนเปิดธีมครั้งแรก) ----------
  let built = false;
  function build() {
    if (built) return;
    built = true;

    const wrap = document.createElement('div');
    wrap.className = 'hw-deco';
    wrap.setAttribute('aria-hidden', 'true');

    // ใยแมงมุมอยู่ที่ต้นเอกสาร (absolute) — ใส่ใน body ที่ไม่ต้องเป็น relative ก็ยึดมุมบนของหน้า
    const webs = document.createElement('div');
    webs.style.cssText = 'position:absolute;top:0;left:0;right:0;height:0;pointer-events:none';
    webs.innerHTML = WEB.replace('%S', 'l') + WEB.replace('%S', 'r');
    wrap.appendChild(webs);

    // แสงอุ่นพื้นหลัง (layer fixed เดียว ไม่ repaint ตอนเลื่อน)
    const glow = document.createElement('div');
    glow.className = 'hw-glow';
    wrap.appendChild(glow);

    if (!reduce) {
      const bats = document.createElement('div');
      bats.className = 'hw-bats';
      // [ความสูง%, ขนาดpx, ระยะเวลาs, หน่วงs, กลับทิศ]
      [[12, 34, 28, 1, 0], [30, 26, 34, 14, 1]].forEach(([y, s, d, t, r]) => {
        const b = document.createElement('div');
        b.className = 'hw-bat' + (r ? ' rev' : '');
        b.style.cssText = `--y:${y}%;--s:${s}px;--d:${d}s;--t:${t}s`;
        b.innerHTML = BAT;
        bats.appendChild(b);
      });
      wrap.appendChild(bats);
    }
    document.body.appendChild(wrap);

    // ฟักทองเหนือท้ายหน้า (footer ถูกเติมโดย nivread.js ก่อนสคริปต์นี้ทำงาน)
    const footer = document.getElementById('main-footer');
    if (footer) {
      const pk = document.createElement('div');
      pk.className = 'hw-deco hw-pk';
      pk.setAttribute('aria-hidden', 'true');
      pk.innerHTML = DEFS + PUMPKIN + PUMPKIN + PUMPKIN;
      footer.insertBefore(pk, footer.firstChild);
    }
  }

  // ---------- เปิด/ปิดธีม ----------
  function apply(on) {
    html.classList.toggle('halloween', on);
    if (on) build();
    syncThemeColor();
    const btn = document.getElementById('hw-toggle');
    if (btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  // ปุ่มในเมนูข้าง วางต่อจากปุ่มสลับโหมดสี
  function mountToggle() {
    const anchor = document.getElementById('niv-theme');
    if (!anchor || document.getElementById('hw-toggle')) return;
    const b = document.createElement('button');
    b.id = 'hw-toggle';
    b.type = 'button';
    b.className = 'nv-link nv-in cursor-pointer';
    b.style.setProperty('--i', '1.5');
    b.setAttribute('aria-label', 'เปิดหรือปิดธีมฮาโลวีน');
    b.setAttribute('aria-pressed', html.classList.contains('halloween') ? 'true' : 'false');
    b.innerHTML = `<svg class="block w-[1.15rem] h-[1.15rem] flex-none" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a7 7 0 00-7 7v11l2.5-2 2 2 2.5-2 2.5 2 2-2 2.5 2V10a7 7 0 00-7-7z"/><circle cx="9.5" cy="10.5" r=".8"/><circle cx="14.5" cy="10.5" r=".8"/></svg><span>ธีมฮาโลวีน</span><span class="hw-state"><span class="hw-on">เปิด</span><span class="hw-off">ปิด</span></span>`;
    b.addEventListener('click', () => {
      const on = !html.classList.contains('halloween');
      setPref(on ? 'on' : 'off');
      apply(on);
    });
    anchor.insertAdjacentElement('afterend', b);
  }

  // สลับโหมดมืด/สว่าง → theme-color ต้องเปลี่ยนตาม
  new MutationObserver(syncThemeColor).observe(html, { attributes: true, attributeFilter: ['class'] });

  const init = () => {
    mountToggle();
    // nivread.js ตัดสินใจเรื่องคลาสไว้แล้ว (ช่วงวันที่ + ค่าที่ผู้ใช้ปิดเอง) — ที่นี่แค่สร้างของตกแต่งตามนั้น
    apply(html.classList.contains('halloween') && getPref() !== 'off');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();