// /novel-fx.js — เอฟเฟกต์เปิดตัวทีละชิ้นตอนเลื่อนมาถึง (.nv-reveal → .in) ใช้ร่วมกันทุกหน้านิยาย
// ถ้าไฟล์นี้โหลดไม่ขึ้น <head> จะเลิกซ่อนเนื้อหาเองภายใน 2.5 วินาที (ดู HEAD_BASE ใน _lib/novel.js)
(() => {
  window.__nvfx = true;
  const rv = [...document.querySelectorAll('.nv-reveal')];
  if (!rv.length) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduce) { rv.forEach((n) => n.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    let i = 0;
    entries.forEach((e) => { if (e.isIntersecting) { e.target.style.setProperty('--i', String(Math.min(i++, 8))); e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
  rv.forEach((n) => io.observe(n));
})();
