// ============================================================
// coin-icon.js — เหรียญทอง 3D ใช้ซ้ำได้ทุกหน้า (ฉบับ nivread — โครงเดียวกับ fnnz ต่างที่โลโก้กลางเหรียญ)
//
// วิธีใช้: ใส่ <script src="/coin-icon.js"></script> ในหน้านั้น 1 บรรทัด
// แล้วใช้ tag ตรงไหนก็ได้:
//   <fnnz-coin></fnnz-coin>                  ขนาดเริ่มต้น 20px หมุนได้
//   <fnnz-coin size="32"></fnnz-coin>        กำหนดขนาด (px)
//   <fnnz-coin size="20" static></fnnz-coin> ไม่หมุน (นิ่ง หันหน้า)
//   <fnnz-coin size="140" float></fnnz-coin> ลอยขึ้นลงด้วย (เหมาะกับขนาดใหญ่)
//   <fnnz-coin src="/img/อื่น.svg">          เปลี่ยนโลโก้ (ค่าเริ่มต้น /img/coin-logo.svg)
//
// อยากแก้หน้าตาเหรียญ แก้ที่ไฟล์นี้ไฟล์เดียว ทุกหน้าเปลี่ยนตาม
// ใช้ Shadow DOM จึงไม่ชนกับ Tailwind / style.css
//
// รายละเอียดจะเพิ่มตามขนาด: เล็ก (<24px) เบาและเรียบ / กลาง (24px+) มีขอบนูนและแสงสะท้อน /
// ใหญ่ (40px+) มีขอบหยัก ขอบข้างลายเฟือง ประกายแสง และออร่า
// ============================================================
(() => {
  if (customElements.get('fnnz-coin')) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  class FnnzCoin extends HTMLElement {
    static get observedAttributes() { return ['size', 'src', 'static', 'float']; }

    connectedCallback() { this.render(); }
    attributeChangedCallback() { if (this.isConnected) this.render(); }

    render() {
      const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
      const s = Math.max(12, parseInt(this.getAttribute('size'), 10) || 20);
      const src = this.getAttribute('src') || '/img/coin-logo.svg';
      const spin = !this.hasAttribute('static') && !reduceMotion;
      const float = this.hasAttribute('float') && spin;

      const mid = s >= 24;   // ขอบนูน + แสงสะท้อน
      const big = s >= 40;   // ขอบหยัก + ประกาย + ออร่า
      const t = s * 0.13;                                // ความหนาเหรียญ
      const layers = s >= 80 ? 24 : s >= 40 ? 12 : 6;    // ชั้นขอบข้าง (เล็ก = เบา)
      const border = Math.max(1, s * 0.03);
      const logo = s * 0.54;
      const g = Math.max(0.8, s * 0.014);                // ความลึกร่องวงใน
      const tick = s * 0.05;                             // ความกว้างแถบขอบหยัก
      const groove = tick + s * 0.035;                   // ระยะวงในจากขอบ

      // ขอบข้างเหรียญ: เหรียญใหญ่ใส่ลายเฟือง (milled edge) เป็นริ้วแนวตั้ง
      const edgeBg = big
        ? 'repeating-conic-gradient(#f6c64a 0 3deg,#8a5300 3deg 6deg)'
        : 'linear-gradient(135deg,#fce074 0%,#b87b00 50%,#613e00 100%)';
      let edges = '';
      for (let i = 0; i < layers; i++) {
        const z = -t / 2 + (i / (layers - 1)) * t;
        edges += `<i class="edge" style="transform:translateZ(${z.toFixed(2)}px)"></i>`;
      }

      const face = (cls) => `
        <div class="face ${cls}">
          ${mid ? '<span class="lit"></span>' : ''}
          ${big && spin ? '<span class="shine"></span><span class="glint"></span>' : ''}
          <img src="${src}" alt="" draggable="false">
        </div>`;

      const tilt = mid ? 'rotateZ(-6deg) ' : '';

      root.innerHTML = `
        <style>
          :host { display:inline-block; width:${s}px; height:${s}px; vertical-align:middle;
                  perspective:${s * 6}px; flex-shrink:0; line-height:0; position:relative;
                  ${big ? `filter:drop-shadow(0 ${s * 0.04}px ${s * 0.1}px rgba(255,170,30,.5));` : ''} }
          .coin { width:100%; height:100%; position:relative; transform-style:preserve-3d;
                  ${spin ? `animation:${float ? 'spinFloat' : 'spin'} 6s linear infinite;` : `transform:${tilt}rotateX(8deg) rotateY(-14deg);`} }

          /* หน้าเหรียญ: ทองโลหะแบบ conic + ขอบนูนไล่แสงบน-ล่าง */
          .face { position:absolute; inset:0; border-radius:50%; overflow:hidden;
                  display:flex; align-items:center; justify-content:center; backface-visibility:hidden;
                  background:
                    radial-gradient(circle at 50% 50%, rgba(255,246,190,.55) 0%, rgba(255,246,190,0) 58%),
                    conic-gradient(from 200deg,#a86b00,#ffe27a,#d79a1c,#fff5b8,#b97a05,#ffd966,#9a6200,#ffe27a,#a86b00);
                  border:${border}px solid; border-color:#fff6bf #d9a021 #8f5a00 #ffe58a;
                  box-shadow:inset 0 0 ${s * 0.06}px rgba(255,255,255,.85), inset 0 ${-s * 0.02}px ${s * 0.08}px rgba(90,50,0,.55); }
          .front { transform:translateZ(${t / 2 + 0.5}px); }
          .back  { transform:translateZ(${-t / 2 - 0.5}px) rotateY(180deg); }

          ${mid ? `
          /* ร่องวงในแบบแกะสลัก: เงามืดด้านใน + ขอบสว่างด้านนอก */
          .face::before { content:''; position:absolute; inset:${groove}px; border-radius:50%;
                  box-shadow:inset 0 0 0 ${g}px rgba(120,70,0,.5), 0 0 0 ${g}px rgba(255,244,170,.85), inset ${g}px ${g}px ${g * 2}px rgba(255,255,255,.35);
                  background:radial-gradient(circle at 35% 30%, rgba(255,255,255,.3), rgba(255,255,255,0) 60%); }` : ''}
          ${big ? `
          /* ขอบหยักรอบเหรียญ */
          .face::after { content:''; position:absolute; inset:0; border-radius:50%; pointer-events:none;
                  background:repeating-conic-gradient(rgba(120,70,0,.4) 0 2.5deg, transparent 2.5deg 5deg);
                  -webkit-mask:radial-gradient(farthest-side, transparent calc(100% - ${tick}px), #000 calc(100% - ${tick}px));
                  mask:radial-gradient(farthest-side, transparent calc(100% - ${tick}px), #000 calc(100% - ${tick}px)); }` : ''}

          .edges { position:absolute; inset:0; transform-style:preserve-3d; }
          .edge  { position:absolute; inset:0; border-radius:50%; background:${edgeBg}; }

          /* โลโก้ทองดุนนูน: คงสีทองของไฟล์ SVG ไว้ ใส่ขอบน้ำตาลเข้มรอบตัว (ให้อ่านออกบนหน้าเหรียญทอง)
                 + เงามืดล่างขวา / ขอบสว่างบนซ้าย ให้ดูเป็นรอยปั๊มนูน */
          img { width:${logo}px; height:auto; max-height:${logo * 1.2}px; object-fit:contain; position:relative; z-index:2;
                filter:
                  drop-shadow(0 0 ${Math.max(0.4, s * 0.008)}px #3d2000)
                  drop-shadow(0 0 ${Math.max(0.4, s * 0.008)}px #3d2000)
                  drop-shadow(${Math.max(0.5, s * 0.014)}px ${Math.max(0.5, s * 0.016)}px ${Math.max(0.5, s * 0.014)}px rgba(60,30,0,.65))
                  drop-shadow(${-Math.max(0.3, s * 0.006)}px ${-Math.max(0.3, s * 0.006)}px 0 rgba(255,246,190,.7));
                user-select:none; }

          /* แสงสะท้อนบนหน้าเหรียญ: สว่างเมื่อหันเข้าหาแสง จางเมื่อเฉียง */
          .lit { position:absolute; inset:0; z-index:3; pointer-events:none; opacity:.55;
                 background:linear-gradient(115deg,rgba(255,255,255,.7),rgba(255,255,255,0) 45%,rgba(0,0,0,.2) 100%);
                 ${spin ? 'animation:lit 6s linear infinite;' : ''} }
          .back .lit, .back .glint { animation-delay:-3s; }
          .shine { position:absolute; top:-50%; left:-50%; width:200%; height:200%; z-index:3; pointer-events:none;
                   background:linear-gradient(45deg,rgba(255,255,255,0) 42%,rgba(255,255,255,.65) 50%,rgba(255,255,255,0) 58%);
                   animation:shine 4s infinite ease-in-out; }
          .glint { position:absolute; top:13%; left:17%; width:${s * 0.2}px; height:${s * 0.2}px; z-index:4; pointer-events:none; opacity:0;
                   background:
                     linear-gradient(90deg,transparent 35%,#fff 50%,transparent 65%) center/100% 9% no-repeat,
                     linear-gradient(0deg,transparent 35%,#fff 50%,transparent 65%) center/9% 100% no-repeat,
                     radial-gradient(circle,#fff 0,rgba(255,255,255,0) 45%);
                   animation:twinkle 6s linear infinite; }

          ${float && s >= 60 ? `
          .shadow { position:absolute; left:12%; right:12%; bottom:${-s * 0.22}px; height:${s * 0.14}px; border-radius:50%;
                    background:radial-gradient(ellipse,rgba(0,0,0,.35),transparent 70%); filter:blur(${s * 0.03}px);
                    animation:shadowPulse 6s ease-in-out infinite; }
          @keyframes shadowPulse { 0%,100% { transform:scale(1); opacity:.9; } 50% { transform:scale(.7); opacity:.5; } }` : ''}

          @keyframes spin { from { transform:${tilt}rotateX(8deg) rotateY(0deg); } to { transform:${tilt}rotateX(8deg) rotateY(360deg); } }
          @keyframes spinFloat {
            0%   { transform:translateY(0) ${tilt}rotateY(0deg) rotateX(10deg); }
            25%  { transform:translateY(${-s * .14}px) ${tilt}rotateY(90deg) rotateX(-5deg); }
            50%  { transform:translateY(${-s * .22}px) ${tilt}rotateY(180deg) rotateX(10deg); }
            75%  { transform:translateY(${-s * .11}px) ${tilt}rotateY(270deg) rotateX(-5deg); }
            100% { transform:translateY(0) ${tilt}rotateY(360deg) rotateX(10deg); } }
          @keyframes lit { 0%,100% { opacity:.6; } 8% { opacity:.95; } 25% { opacity:.05; } 50% { opacity:0; } 75% { opacity:.05; } 92% { opacity:.8; } }
          @keyframes twinkle { 0%,68%,100% { transform:scale(0) rotate(0); opacity:0; } 78% { transform:scale(1) rotate(45deg); opacity:1; } 90% { transform:scale(.2) rotate(90deg); opacity:0; } }
          @keyframes shine { 0% { transform:translateY(-100%) rotate(30deg); } 20%,100% { transform:translateY(100%) rotate(30deg); } }
        </style>
        <div class="coin" role="img" aria-label="FNNZ Coin">
          ${face('front')}
          <div class="edges">${edges}</div>
          ${face('back')}
        </div>
        ${float && s >= 60 ? '<div class="shadow"></div>' : ''}`;
    }
  }

  customElements.define('fnnz-coin', FnnzCoin);

  // ใช้ใน JS ที่สร้าง HTML เอง: FNNZCoin.html(20) → '<fnnz-coin size="20"></fnnz-coin>'
  window.FNNZCoin = { html: (size = 20, extra = '') => `<fnnz-coin size="${size}" ${extra}></fnnz-coin>` };
})();