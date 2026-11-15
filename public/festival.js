// public/festival.js — ธีมเทศกาลแบบมินิมอล (ใช้ได้ทุกเทศกาล) + ปุ่มเปิด/ปิดในเมนูข้าง
// โหลดโดย nivread.js ทุกหน้า (ไฟล์เล็ก) — ไฟล์นี้ตัดสินเองว่าตอนนี้เป็นเทศกาลไหน แล้วค่อยโหลด /festival.css
// ทดสอบนอกช่วงได้ด้วย ?fest=christmas (จำไว้ตลอดแท็บ) / ?fest=halloween , ใช้ ?fest=0 เพื่อเลิกทดสอบ
//
// วิธีเพิ่มเทศกาลใหม่ (แก้แค่ 2 ไฟล์นี้ ไม่ต้องแตะ nivread.js):
//   1) เพิ่มรายการใน FESTIVALS ด้านล่าง: id / name / from / to (เดือน-วัน เวลาไทย รวมวันแรกและวันสุดท้าย ใช้ซ้ำทุกปี)
//      + tc (สี theme-color ของแถบมือถือ) + icon (path ของ svg 24x24) + top (ของตกแต่งบนสุดของหน้า) + foot (ของตกแต่งท้ายหน้า)
//      + layer (ไม่บังคับ: layer แบบ fixed เช่น หิมะ)
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

  // คริสต์มาส (แดง-ทอง): กิ่งไม้ประดับทองมีผลเบอร์รี่ที่มุมบน + ลูกบอลแขวนแกว่งเบา ๆ + หิมะจางหลังเนื้อหา + ต้นไม้เล็กท้ายหน้า
  // กิ่งไม้สร้างด้วยการคำนวณ (ก้านตรงเฉียง + ใบเข็มเป็นคู่ ยาวลดลงทางปลาย) จะได้ไม่ต้องเขียน path ยาว ๆ มือ
  const XM_SPRIG = (side) => {
    const x0 = -4, y0 = 6, x1 = 152, y1 = 52, th = Math.atan2(y1 - y0, x1 - x0), f = (n) => n.toFixed(1);
    let n = '', bs = '';
    for (let i = 1; i <= 9; i++) {
      const t = i / 10, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, L = 26 * (1 - 0.62 * t);
      for (const s of [-1, 1]) {
        const a = th + s * 0.87;
        n += `M${f(x)} ${f(y)}L${f(x + Math.cos(a) * L)} ${f(y + Math.sin(a) * L)}`;
      }
    }
    for (const [t, o] of [[0.2, 6], [0.26, 11], [0.3, 4], [0.52, -7], [0.57, -11]]) {
      const x = x0 + (x1 - x0) * t - Math.sin(th) * o, y = y0 + (y1 - y0) * t + Math.cos(th) * o;
      bs += `<circle class="xm-b" cx="${f(x)}" cy="${f(y)}" r="3.4"/><circle class="xm-bh" cx="${f(x - 1)}" cy="${f(y - 1.1)}" r="1"/>`;
    }
    return `<svg class="xm-sprig xm-sprig-${side}" viewBox="0 0 160 100" aria-hidden="true"><path class="xm-stem" d="M${x0} ${y0}L${x1} ${y1}"/><path class="xm-n" d="${n}"/>${bs}</svg>`;
  };
  const XM_BAUBLE = (side, len, delay) => {
    const cy = len + 13;
    return `<svg class="xm-bauble xm-bauble-${side}" style="--d:${delay}s" viewBox="0 0 20 ${len + 25}" aria-hidden="true"><line class="xm-bl" x1="10" y1="0" x2="10" y2="${len}"/><rect class="xm-bc" x="7.5" y="${len}" width="5" height="3" rx="1"/><circle class="xm-bb" cx="10" cy="${cy}" r="9.5"/><path class="xm-bg" d="M1 ${cy + 1}Q10 ${cy + 5} 19 ${cy + 1}"/><path class="xm-bs" d="M4.6 ${cy - 2}A6 6 0 0 1 9 ${cy - 7}"/></svg>`;
  };
  const XM_TOP = () => XM_SPRIG('l') + XM_SPRIG('r') + XM_BAUBLE('l', 34, 0) + XM_BAUBLE('r', 52, 1.3);
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
      top: XM_TOP,
      layer: XM_SNOW,
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

    // ของตกแต่งบนสุด: absolute ที่ต้นเอกสาร (height:0 ไม่ดันเนื้อหา)
    const top = document.createElement('div');
    top.style.cssText = 'position:absolute;top:0;left:0;right:0;height:0;pointer-events:none';
    top.innerHTML = fest.top();
    wrap.appendChild(top);

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