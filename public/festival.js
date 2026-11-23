// public/festival.js — ธีมเทศกาลแบบมินิมอล (ใช้ได้ทุกเทศกาล) + ปุ่มเปิด/ปิดในเมนูข้าง
// โหลดโดย nivread.js ทุกหน้า (ไฟล์เล็ก) — ไฟล์นี้ตัดสินเองว่าตอนนี้เป็นเทศกาลไหน แล้วค่อยโหลด /festival.css
// ทดสอบนอกช่วงได้ด้วย ?fest=christmas (จำไว้ตลอดแท็บ) / ?fest=halloween , ใช้ ?fest=0 เพื่อเลิกทดสอบ
//
// วิธีเพิ่มเทศกาลใหม่ (แก้แค่ 2 ไฟล์นี้ ไม่ต้องแตะ nivread.js):
//   1) เพิ่มรายการใน FESTIVALS ด้านล่าง: id / name / from / to (เดือน-วัน เวลาไทย รวมวันแรกและวันสุดท้าย ใช้ซ้ำทุกปี)
//      + tc (สี theme-color ของแถบมือถือ) + icon (path ของ svg 24x24) + top (ไม่บังคับ: ของตกแต่งบนสุดของหน้า) + foot (ของตกแต่งท้ายหน้า)
//      + layer (ไม่บังคับ: layer แบบ fixed เช่น หิมะ/ซานต้า)
//   2) เพิ่มบล็อกสีและสไตล์ใน /festival.css โดยขึ้นต้นด้วย html[data-festival="<id>"]
//      (ตั้งตัวแปร --fx-bg, --fx-glow, --fx-glow-a, --fx-rgb, --fx-accent, --fx-scroll, --fx-pill, --fx-pill-bd ให้ครบ)
(() => {
  if (window.__fest) return;
  window.__fest = true;

  // ---------- SVG / HTML ของแต่ละเทศกาล ----------
  // ฮาโลวีน: ใยแมงมุมมุมบนซ้าย (ฝั่งขวาใช้ scaleX(-1) ใน CSS)
  const WEB = `<svg class="hw-web hw-web-%S" viewBox="0 0 100 100" aria-hidden="true">
<path d="M0 0L100 0M0 0L92 34M0 0L70 70M0 0L34 92M0 0L0 100"/>
<path d="M30 0Q26 26 0 30M52 0Q46 46 0 52M76 0Q66 66 0 76M98 0Q84 84 0 98"/>
</svg>`;
  // แมงมุมห้อยด้วยเส้นไหม (เส้นยาวเกินขอบบน ถูกซ่อนนอกจอ)
  const SPIDER = `<svg class="hw-spider" viewBox="0 0 20 100" aria-hidden="true">
<line x1="10" y1="0" x2="10" y2="80"/><circle cx="10" cy="87" r="5"/>
<path d="M5 85L1 81M5 88L0 89M5 91L2 96M15 85L19 81M15 88L20 89M15 91L18 96"/>
</svg>`;
  // ผีตัวเล็ก (โครงจาก "Little Halloween" ของ khadkamhn) — รูปร่าง/สีอยู่ใน festival.css
  const GHOST = `<div class="hw-gm"><div class="hw-g-head"><div class="hw-g-skull"><div class="hw-g-eyes"><div class="hw-g-eye l"></div><div class="hw-g-eye r"></div></div></div></div><div class="hw-g-body"></div><div class="hw-g-legs"></div></div>`;

  // คริสต์มาส (แดง-ทอง): หิมะจางหลังเนื้อหา + ซานต้ากับกวางเรนเดียร์บินผ่านเป็นครั้งคราว + ต้นไม้เล็กท้ายหน้า
  // กวางเรนเดียร์ 1 ตัว (หันขวา) วาดเป็นฟังก์ชัน เรียกซ้ำเพื่อทำเป็นขบวน — lead=true จมูกแดง
  const XM_DEER = (tx, ty, lead) => `<g transform="translate(${tx} ${ty})"><ellipse class="xm-d" cx="16" cy="30" rx="12" ry="6"/><path class="xm-d" d="M24 27L32 16L36 19L28 34z"/><circle class="xm-d" cx="36" cy="16" r="3.6"/><ellipse class="xm-d" cx="40" cy="17.5" rx="3.2" ry="2"/>${lead ? '<circle class="xm-nose" cx="43" cy="17.5" r="1.7"/>' : ''}<path class="xm-ant" d="M34 12.5L32 3M32.3 6L28 4M33.3 8.5L36.5 3"/><path class="xm-leg" d="M26 34L32 43M23 35L19 41M8 35L2 41M11 35L14 43"/></g>`;
  const XM_FLY = () => `<div class="xm-flywrap"><div class="xm-fly"><svg viewBox="0 0 170 56" aria-hidden="true">
<path class="xm-rein" d="M70 24Q92 17 112 26"/>
${XM_DEER(70, 14, false)}${XM_DEER(114, 8, true)}
<path class="xm-run" d="M6 44Q6 49 12 49H58Q66 49 66 41M20 41V49M46 41V49"/>
<path class="xm-sack" d="M13 29Q9 15 20 14Q31 15 27 29z"/>
<path class="xm-sled" d="M10 29H62Q62 41 52 41H20Q10 41 10 29z"/>
<path class="xm-curl" d="M62 29Q70 27 70 20"/>
<path class="xm-coat" d="M28 29V21Q34 17 40 21V29z"/>
<circle class="xm-face" cx="34" cy="17" r="4.6"/>
<path class="xm-beard" d="M29.6 18Q34 28 38.4 18z"/>
<path class="xm-hat" d="M29 15.5Q33 3 41 12L40 15.5z"/>
<rect class="xm-brim" x="28.6" y="14.4" width="11.6" height="2.4" rx="1.2"/>
<circle class="xm-brim" cx="41.5" cy="10.8" r="2.1"/>
</svg></div></div>`;
  // หิมะ 3 ชั้น (ไกล/กลาง/ใกล้) เป็น layer fixed วางหลังเนื้อหา — วาดด้วย gradient ใน CSS ล้วน
  const XM_SNOW = () => '<div class="xm-snowwrap"><div class="xm-snow xm-s1"></div><div class="xm-snow xm-s2"></div><div class="xm-snow xm-s3"></div></div>';
  const XM_TREE = `<svg class="xm-tree" viewBox="0 0 30 44" aria-hidden="true"><path class="xm-tt" d="M15 8L22 19H8zM15 14L24 28H6zM15 23L27 38H3z"/><rect class="xm-trunk" x="13" y="38" width="4" height="6" rx="1"/><path class="xm-gar" d="M10.5 17Q15 20 19.5 17M8 26Q15 30 22 26M5.5 35Q15 40 24.5 35"/><circle class="xm-ob" cx="12" cy="23" r="1.3"/><circle class="xm-og" cx="19" cy="31" r="1.3"/><circle class="xm-ob" cx="10" cy="33" r="1.2"/><path class="xm-star" d="M15 .5l1.5 3.2 3.5.4-2.6 2.4.7 3.5L15 8.2l-3.1 1.8.7-3.5L10 4.1l3.5-.4z"/></svg>`;

  // ---------- รายการเทศกาล (ตัวแรกที่วันนี้อยู่ในช่วงจะถูกใช้) ----------
  const FESTIVALS = [
    {
      id: 'halloween', name: 'ฮาโลวีน', from: '10-20', to: '11-01',
      tc: { dark: '#110b07', light: '#fffaf3' },
      icon: '<path d="M12 3a7 7 0 00-7 7v11l2.5-2 2 2 2.5-2 2.5 2 2-2 2.5 2V10a7 7 0 00-7-7z"/><circle cx="9.5" cy="10.5" r=".8"/><circle cx="14.5" cy="10.5" r=".8"/>',
      top: () => WEB.replace('%S', 'l') + WEB.replace('%S', 'r') + SPIDER,
      foot: GHOST,
    },
    {
      id: 'christmas', name: 'คริสต์มาส', from: '12-01', to: '12-31',
      tc: { dark: '#130909', light: '#fff6f4' },
      icon: '<path d="M12 2v20M4.9 7l14.2 10M19.1 7L4.9 17M9 3.5l3 2 3-2M9 20.5l3-2 3 2"/>',
      layer: () => XM_SNOW() + XM_FLY(),
      foot: XM_TREE,
    },
  ];

  const html = document.documentElement;
  const KEY = 'festival';                        // 'off' = ผู้ใช้ปิดธีมเอง
  const PV = 'fest-preview';

  const getPref = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const setPref = (v) => { try { localStorage.setItem(KEY, v); } catch {} };

  // ---------- เลือกเทศกาลของวันนี้ ----------
  const md = new Date(Date.now() + 7 * 36e5).toISOString().slice(5, 10); // MM-DD เวลาไทย
  const inRange = (f) => (f.from <= f.to ? md >= f.from && md <= f.to : md >= f.from || md <= f.to);
  let preview = '';
  try {
    const m = /[?&]fest=([\w-]+)/.exec(location.search);
    if (m) { if (m[1] === '0') sessionStorage.removeItem(PV); else sessionStorage.setItem(PV, m[1]); }
    preview = sessionStorage.getItem(PV) || '';
  } catch {}
  const fest = FESTIVALS.find((f) => f.id === preview) || FESTIVALS.find(inRange);

  if (!fest) {                                   // ไม่ใช่ช่วงเทศกาล: เก็บกวาดแล้วจบ ไม่โหลด CSS
    html.classList.remove('festival');
    html.removeAttribute('data-festival');
    return;
  }

  if (!document.getElementById('fest-css')) {
    const l = document.createElement('link');
    l.id = 'fest-css'; l.rel = 'stylesheet'; l.href = '/festival.css';
    document.head.appendChild(l);
  }

  // ---------- theme-color (แถบเบราว์เซอร์มือถือ) ----------
  let tc = document.querySelector('meta[name="theme-color"]');
  const origTc = tc ? tc.getAttribute('content') : '#0d0d0d';
  const syncThemeColor = () => {
    const on = html.hasAttribute('data-festival');
    if (!tc) {
      if (!on) return;
      tc = document.createElement('meta'); tc.name = 'theme-color'; document.head.appendChild(tc);
    }
    tc.setAttribute('content', on ? (html.classList.contains('dark') ? fest.tc.dark : fest.tc.light) : origTc);
  };

  // ---------- สร้างตัวตกแต่ง ----------
  let built = false;
  function build() {
    if (built) return;
    built = true;

    const wrap = document.createElement('div');
    wrap.className = 'fx-deco';
    wrap.setAttribute('aria-hidden', 'true');

    // ของตกแต่งบนสุด (ไม่บังคับ): absolute ที่ต้นเอกสาร (height:0 ไม่ดันเนื้อหา)
    if (fest.top) {
      const top = document.createElement('div');
      top.style.cssText = 'position:absolute;top:0;left:0;right:0;height:0;pointer-events:none';
      top.innerHTML = fest.top();
      wrap.appendChild(top);
    }

    // แสงอุ่นจาง ๆ พื้นหลัง (layer fixed เดียว)
    const glow = document.createElement('div');
    glow.className = 'fx-glow';
    wrap.appendChild(glow);
    if (fest.layer) wrap.insertAdjacentHTML('beforeend', fest.layer()); // layer เสริมแบบ fixed (เช่น หิมะ)
    document.body.appendChild(wrap);

    mountFooter();
  }

  // ตัวเล็กท้ายหน้า (footer ถูกเติมโดย nivread.js)
  function mountFooter() {
    const footer = document.getElementById('main-footer');
    if (!footer || footer.querySelector('.fx-ft')) return false;
    const g = document.createElement('div');
    g.className = 'fx-deco fx-ft';
    g.setAttribute('aria-hidden', 'true');
    g.innerHTML = fest.foot;
    footer.insertBefore(g, footer.firstChild);
    return true;
  }

  // ---------- เปิด/ปิดธีม ----------
  function apply(on) {
    html.classList.toggle('festival', on);
    if (on) html.setAttribute('data-festival', fest.id); else html.removeAttribute('data-festival');
    if (on) build();
    syncThemeColor();
    const btn = document.getElementById('fx-toggle');
    if (btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  // ปุ่มในเมนูข้าง วางต่อจากปุ่มสลับโหมดสี
  function mountToggle() {
    const anchor = document.getElementById('niv-theme');
    if (!anchor || document.getElementById('fx-toggle')) return;
    const b = document.createElement('button');
    b.id = 'fx-toggle';
    b.type = 'button';
    b.className = 'nv-link nv-in cursor-pointer';
    b.style.setProperty('--i', '1.5');
    b.setAttribute('aria-label', `เปิดหรือปิดธีม${fest.name}`);
    b.setAttribute('aria-pressed', html.hasAttribute('data-festival') ? 'true' : 'false');
    b.innerHTML = `<svg class="block w-[1.15rem] h-[1.15rem] flex-none" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">${fest.icon}</svg><span>ธีม${fest.name}</span><span class="fx-state"><span class="fx-on">เปิด</span><span class="fx-off">ปิด</span></span>`;
    b.addEventListener('click', () => {
      const on = !html.hasAttribute('data-festival');
      setPref(on ? 'on' : 'off');
      apply(on);
    });
    anchor.insertAdjacentElement('afterend', b);
  }

  // สลับโหมดมืด/สว่าง → theme-color ต้องเปลี่ยนตาม
  new MutationObserver(syncThemeColor).observe(html, { attributes: true, attributeFilter: ['class'] });

  const init = () => {
    apply(getPref() !== 'off');
    // header/footer อาจยังสร้างไม่เสร็จ: รอสูงสุด 8 วินาที แล้วเลิกสังเกต (ไม่ค้างตอน infinite scroll)
    const settle = () => {
      mountToggle();
      if (built) mountFooter();
      return !!document.getElementById('fx-toggle') && (!built || !!document.querySelector('.fx-ft'));
    };
    if (!settle()) {
      const mo = new MutationObserver(() => { if (settle()) mo.disconnect(); });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => mo.disconnect(), 8000);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();