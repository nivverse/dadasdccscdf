// functions/_lib/videos.js — แกลเลอรีวิดีโอ YouTube ในหน้าโพสต์ (SSR)
// โหลด iframe เฉพาะตอนกดเล่น (หน้าเร็ว) ใช้ youtube-nocookie และมีโลโก้ nivread บนกรอบเครื่องเล่น
import { esc } from './render.js';

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const thumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export function cleanIds(list) {
  return (Array.isArray(list) ? list : []).filter((x) => YT_ID.test(x)).slice(0, 15);
}

export function videoLd(ids, { title, desc, uploadDate }) {
  return cleanIds(ids).map((id, i) => ({
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: `${title} — วิดีโอ ${i + 1}`.slice(0, 110),
    description: desc || title,
    thumbnailUrl: [thumb(id)],
    uploadDate,
    embedUrl: `https://www.youtube.com/embed/${id}`,
  }));
}

const CSS = `
@property --vg-a{syntax:'<angle>';initial-value:0deg;inherits:false}
.vg{margin:0 1rem 1.5rem}
.vg-head{display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem;font-weight:700}
.vg-head .vg-dot{width:.5rem;height:.5rem;border-radius:999px;background:#f59e0b;box-shadow:0 0 12px #f59e0b}
.vg-frame{padding:2px;border-radius:20px;background:linear-gradient(135deg,#f59e0b,#ea580c);background:conic-gradient(from var(--vg-a),#f59e0b,#ea580c,#7c2d12,#f59e0b);animation:vg-spin 8s linear infinite;box-shadow:0 18px 50px -18px rgba(245,158,11,.55)}
@keyframes vg-spin{to{--vg-a:360deg}}
.vg-in{border-radius:18px;overflow:hidden;background:#0a0a0a}
.vg-bar{display:flex;align-items:center;gap:.6rem;padding:.55rem .85rem;background:linear-gradient(180deg,#171717,#0f0f0f);border-bottom:1px solid rgba(255,255,255,.07)}
.vg-logo{width:26px;height:26px;border-radius:8px;object-fit:cover;box-shadow:0 0 0 1px rgba(245,158,11,.5),0 0 16px rgba(245,158,11,.55)}
.vg-brand{font-family:'Josefin Sans','Kanit',sans-serif;font-weight:700;letter-spacing:.14em;text-transform:lowercase;font-size:1.02rem;background:linear-gradient(90deg,#fbbf24,#f97316);-webkit-background-clip:text;background-clip:text;color:transparent}
.vg-tag{font-size:.6rem;letter-spacing:.2em;color:#a3a3a3;border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:.1rem .5rem}
.vg-count{margin-left:auto;font-size:.75rem;color:#d4d4d4;font-variant-numeric:tabular-nums}
.vg-stage{position:relative;aspect-ratio:16/9;background:#000}
.vg-stage iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.vg-poster{position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;cursor:pointer;background:#000;overflow:hidden}
.vg-poster img.vg-img{width:100%;height:100%;object-fit:cover;transition:transform .6s ease,filter .3s}
.vg-poster:hover img.vg-img{transform:scale(1.06);filter:brightness(1.08)}
.vg-poster::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 35%,rgba(0,0,0,.55)),linear-gradient(0deg,rgba(0,0,0,.55),transparent 45%);pointer-events:none}
.vg-play{position:absolute;left:50%;top:50%;z-index:1;width:76px;height:76px;margin:-38px 0 0 -38px;border-radius:999px;display:grid;place-items:center;background:linear-gradient(135deg,#fbbf24,#ea580c);box-shadow:0 10px 30px rgba(234,88,12,.6);transition:transform .25s}
.vg-play::before{content:"";position:absolute;inset:0;border-radius:inherit;border:2px solid rgba(251,191,36,.9);animation:vg-ping 1.8s ease-out infinite}
@keyframes vg-ping{to{transform:scale(1.7);opacity:0}}
.vg-poster:hover .vg-play{transform:scale(1.12)}
.vg-play svg{width:30px;height:30px;margin-left:4px;fill:#fff}
.vg-mark{position:absolute;right:.7rem;bottom:.6rem;z-index:1;display:flex;align-items:center;gap:.4rem;padding:.25rem .6rem .25rem .3rem;border-radius:999px;background:rgba(10,10,10,.55);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.12);pointer-events:none}
.vg-mark img{width:20px;height:20px;border-radius:6px}
.vg-mark span{font-family:'Josefin Sans',sans-serif;font-weight:700;letter-spacing:.12em;font-size:.78rem;color:#fff}
.vg-strip{display:flex;gap:.6rem;margin-top:.8rem;padding:.25rem .15rem .6rem;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:thin;scrollbar-color:#f59e0b33 transparent}
.vg-t{position:relative;flex:0 0 auto;width:132px;aspect-ratio:16/9;padding:0;border:0;border-radius:12px;overflow:hidden;cursor:pointer;scroll-snap-align:start;opacity:.62;transform:translateY(0);transition:opacity .2s,transform .2s,box-shadow .2s;background:#111}
.vg-t:hover{opacity:1;transform:translateY(-3px)}
.vg-t img{width:100%;height:100%;object-fit:cover;display:block}
.vg-t b{position:absolute;left:.35rem;bottom:.3rem;font-size:.68rem;font-weight:700;color:#fff;background:rgba(0,0,0,.65);border-radius:6px;padding:0 .35rem;font-variant-numeric:tabular-nums}
.vg-t[aria-current="true"]{opacity:1;box-shadow:0 0 0 2px #f59e0b,0 8px 22px rgba(245,158,11,.45)}
@media (max-width:480px){.vg{margin:0 .75rem 1.25rem}.vg-t{width:112px}.vg-play{width:62px;height:62px;margin:-31px 0 0 -31px}.vg-tag{display:none}}
@media (prefers-reduced-motion:reduce){.vg-frame,.vg-play::before{animation:none}.vg-poster img.vg-img{transition:none}}
`;

const JS = `
(function(){
  var root=document.querySelector('.vg'); if(!root) return;
  var stage=root.querySelector('.vg-stage'), count=root.querySelector('.vg-count'), strip=root.querySelector('.vg-strip');
  var ts=[].slice.call(root.querySelectorAll('.vg-t'));
  var title=root.getAttribute('data-title')||'วิดีโอ';
  function mark(i){ ts.forEach(function(t,k){ if(k===i) t.setAttribute('aria-current','true'); else t.removeAttribute('aria-current'); }); if(count) count.textContent=(i+1)+' / '+ts.length; }
  function play(id,i){
    if(!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
    var f=document.createElement('iframe');
    f.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0&modestbranding=1&playsinline=1';
    f.title=title+' — วิดีโอ '+(i+1);
    f.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen=true; f.setAttribute('referrerpolicy','strict-origin-when-cross-origin');
    stage.replaceChildren(f);
    mark(i);
    if(strip&&ts[i]) strip.scrollTo({left:ts[i].offsetLeft-strip.clientWidth/2+ts[i].clientWidth/2,behavior:'smooth'});
  }
  root.addEventListener('click',function(e){
    var p=e.target.closest('.vg-poster'); if(p){ play(p.getAttribute('data-id'),0); return; }
    var t=e.target.closest('.vg-t'); if(t){ play(t.getAttribute('data-id'),ts.indexOf(t)); }
  });
})();
`;

export function videoGallery(ids, title) {
  const list = cleanIds(ids);
  if (!list.length) return '';
  const first = list[0];
  const strip = list.length > 1
    ? `<div class="vg-strip" role="list" aria-label="เลือกวิดีโอ">${list.map((id, i) =>
        `<button type="button" role="listitem" class="vg-t" data-id="${id}"${i === 0 ? ' aria-current="true"' : ''} aria-label="เล่นวิดีโอที่ ${i + 1}"><img src="${thumb(id)}" alt="" loading="lazy" decoding="async"><b>${String(i + 1).padStart(2, '0')}</b></button>`).join('')}</div>`
    : '';
  return `<section class="vg" data-title="${esc(title)}" aria-label="วิดีโอ">
  <style>${CSS}</style>
  <div class="vg-head"><span class="vg-dot"></span>วิดีโอ <span class="text-xs font-normal text-slate-500 dark:text-neutral-400">${list.length} คลิป</span></div>
  <div class="vg-frame"><div class="vg-in">
    <div class="vg-bar"><img class="vg-logo" src="/img/nivreadfavon.png" alt="" width="26" height="26"><span class="vg-brand">nivread</span><span class="vg-tag">PLAYER</span><span class="vg-count">1 / ${list.length}</span></div>
    <div class="vg-stage">
      <button type="button" class="vg-poster" data-id="${first}" aria-label="เล่นวิดีโอ">
        <img class="vg-img" src="${thumb(first)}" alt="${esc(title)}" fetchpriority="high" decoding="async">
        <span class="vg-play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span>
        <span class="vg-mark"><img src="/img/nivreadfavon.png" alt=""><span>nivread</span></span>
      </button>
    </div>
  </div></div>
  ${strip}
  <script>${JS}</script>
</section>`;
}
