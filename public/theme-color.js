// public/theme-color.js — ทำให้ theme-color (แถบสถานะ/แถบนำทางของมือถือ และ TWA) สลับตามโหมดสว่าง/มืดของเว็บ
// ต้องโหลดใน <head> ทุกหน้า หลังสคริปต์ที่ตั้งคลาส .dark
(function () {
  'use strict';
  var DARK = '#0d0d0d', LIGHT = '#f3f4f6';
  var html = document.documentElement;
  function apply() {
    var c = html.classList.contains('dark') ? DARK : LIGHT;
    // ลบ meta theme-color เดิมทั้งหมด (รวมแบบ media=...) แล้วสร้างอันเดียวที่ตรงกับธีมจริง
    var olds = document.querySelectorAll('meta[name="theme-color"]');
    var m = olds[0];
    for (var i = 1; i < olds.length; i++) olds[i].remove();
    if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
    m.removeAttribute('media');
    if (m.getAttribute('content') !== c) m.setAttribute('content', c);
    html.style.colorScheme = html.classList.contains('dark') ? 'dark' : 'light';
  }
  apply();
  new MutationObserver(apply).observe(html, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('storage', function (e) {
    if (e.key === 'theme') {
      html.classList.toggle('dark', e.newValue !== 'light');
    }
  });
})();
