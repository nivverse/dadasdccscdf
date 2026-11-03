// public/halloween.js — ธีมฮาโลวีนแบบมินิมอล (ใยแมงมุม + แมงมุมห้อย + ผีตัวเล็กท้ายหน้า) + ปุ่มเปิด/ปิดในเมนูข้าง
// โหลดโดย nivread.js เฉพาะช่วงเทศกาล (หรือ ?hw=1 ตอนทดสอบ) — สไตล์อยู่ใน /halloween.css
// ไม่ทับสีคอมโพเนนต์ของเว็บ และไม่มีตัวละครลอยบนเนื้อหา
(() => {
  if (window.__hw) return;
  window.__hw = true;

  const html = document.documentElement;
  const KEY = 'halloween';                       // 'off' = ผู้ใช้ปิดธีมเอง
  const DARK_TC = '#110b07', LIGHT_TC = '#fffaf3';

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

  // ---------- SVG / HTML ----------
  // ใยแมงมุมมุมบนซ้าย (ฝั่งขวาใช้ scaleX(-1) ใน CSS)
  const WEB = `<svg class="hw-web hw-web-%S" viewBox="0 0 100 100" aria-hidden="true">
<path d="M0 0L100 0M0 0L92 34M0 0L70 70M0 0L34 92M0 0L0 100"/>
<path d="M30 0Q26 26 0 30M52 0Q46 46 0 52M76 0Q66 66 0 76M98 0Q84 84 0 98"/>
</svg>`;
  // แมงมุมห้อยด้วยเส้นไหม (เส้นยาวเกินขอบบน ถูกซ่อนนอกจอ)
  const SPIDER = `<svg class="hw-spider" viewBox="0 0 20 100" aria-hidden="true">
<line x1="10" y1="0" x2="10" y2="80"/><circle cx="10" cy="87" r="5"/>
<path d="M5 85L1 81M5 88L0 89M5 91L2 96M15 85L19 81M15 88L20 89M15 91L18 96"/>
</svg>`;
  // ผีตัวเล็ก (โครงจาก "Little Halloween" ของ khadkamhn) — รูปร่าง/สีอยู่ใน halloween.css
  const GHOST = `<div class="hw-gm"><div class="hw-g-head"><div class="hw-g-skull"><div class="hw-g-eyes"><div class="hw-g-eye l"></div><div class="hw-g-eye r"></div></div></div></div><div class="hw-g-body"></div><div class="hw-g-legs"></div></div>`;

  // ---------- สร้างตัวตกแต่ง (ครั้งเดียว ตอนเปิดธีมครั้งแรก) ----------
  let built = false;
  function build() {
    if (built) return;
    built = true;

    const wrap = document.createElement('div');
    wrap.className = 'hw-deco';
    wrap.setAttribute('aria-hidden', 'true');

    // ใยแมงมุม + แมงมุม: absolute ที่ต้นเอกสาร (height:0 ไม่ดันเนื้อหา)
    const top = document.createElement('div');
    top.style.cssText = 'position:absolute;top:0;left:0;right:0;height:0;pointer-events:none';
    top.innerHTML = WEB.replace('%S', 'l') + WEB.replace('%S', 'r') + SPIDER;
    wrap.appendChild(top);

    // แสงอุ่นจาง ๆ พื้นหลัง (layer fixed เดียว)
    const glow = document.createElement('div');
    glow.className = 'hw-glow';
    wrap.appendChild(glow);
    document.body.appendChild(wrap);

    // ผีตัวเล็กที่ท้ายหน้า (footer ถูกเติมโดย nivread.js ก่อนสคริปต์นี้ทำงาน)
    const footer = document.getElementById('main-footer');
    if (footer) {
      const g = document.createElement('div');
      g.className = 'hw-deco hw-ft';
      g.setAttribute('aria-hidden', 'true');
      g.innerHTML = GHOST;
      footer.insertBefore(g, footer.firstChild);
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