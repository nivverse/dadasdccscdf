// public/i18n.js — ระบบหลายภาษาของ nivread (โหลดเป็นสคริปต์แรกในทุกหน้า ก่อน /nivread.js)
//
// หลักการ
//  • ภาษาต้นฉบับของเว็บคือ "ไทย" — ข้อความไทยในโค้ด/HTML คือ key ของพจนานุกรม (แบบ gettext)
//  • เลือกภาษาอัตโนมัติจากภาษาของเครื่อง (navigator.languages) · ผู้ใช้เปลี่ยนเองได้จากเมนู (จำไว้ใน localStorage 'nv_lang')
//  • ภาษาที่เครื่องใช้แต่เว็บยังไม่รองรับ → ใช้อังกฤษ (ดีกว่าแสดงไทยให้คนที่อ่านไม่ออก)
//  • ภาษาไทย = ไม่ต้องทำอะไรเลย (ไม่โหลดพจนานุกรม ไม่มีค่าใช้จ่ายเพิ่ม)
//  • ภาษาอื่น = โหลด /locales/<lang>.js แล้วแปลข้อความบนหน้าทั้งหมด รวมถึงที่เรนเดอร์ทีหลัง (MutationObserver),
//    placeholder/title/aria-label/alt, <title>, และกล่องข้อความ alert/confirm/prompt
//  • ข้อความของผู้ใช้ (โพสต์/คอมเมนต์) ไม่ถูกแปล เพราะจะแปลเฉพาะข้อความที่ "ตรงทั้งก้อน" กับพจนานุกรมเท่านั้น
//
// เพิ่มภาษาใหม่: สร้าง /locales/<รหัส>.js (ดู en.js) แล้วเพิ่มรหัสใน LANGS ด้านล่าง
(() => {
  'use strict';

  // รหัสภาษา → ชื่อที่แสดงในตัวเลือก (เขียนด้วยภาษานั้นเอง) / locale สำหรับ Intl
  const LANGS = {
    th: { name: 'ไทย', locale: 'th-TH' },
    en: { name: 'English', locale: 'en-US' },
  };
  const SOURCE = 'th';      // ภาษาของข้อความในโค้ด
  const FALLBACK = 'en';    // ภาษาที่ใช้เมื่อเครื่องใช้ภาษาที่เว็บยังไม่รองรับ
  const KEY = 'nv_lang';    // ค่าที่ผู้ใช้เลือกเอง ('' หรือ 'auto' = ตามเครื่อง)

  const getStored = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
  const setStored = (v) => { try { if (v && v !== 'auto') localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch {} };

  // ภาษาจากเครื่อง: ไล่ตามลำดับความชอบของผู้ใช้ (th-TH → th, en-GB → en, zh-Hant → zh ...)
  const detectDevice = () => {
    const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']).filter(Boolean);
    for (const tag of list) {
      const base = String(tag).toLowerCase().split('-')[0];
      if (LANGS[base]) return base;
    }
    return FALLBACK;
  };

  const pref = getStored();
  const lang = LANGS[pref] ? pref : detectDevice();
  const locale = LANGS[lang].locale;

  const root = document.documentElement;
  root.lang = lang;
  root.dataset.lang = lang;

  // ---------- พจนานุกรม ----------
  const exact = new Map();   // 'ข้อความไทย' → translation
  const patterns = [];       // [{re, out}] จาก key ที่มี {0} {1} ...
  const byKey = new Map();   // key ดิบ (รวมที่มี {0}) → คำแปล ใช้กับ t('{0} วัน', 2)
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const register = (code, dict) => {
    if (code !== lang) return;
    for (const k of Object.keys(dict)) {
      const v = dict[k];
      byKey.set(norm(k), v);
      if (/\{\d\}/.test(k)) {
        const parts = norm(k).split(/\{\d\}/);
        const re = new RegExp('^' + parts.map(esc).join('(.+?)') + '$');
        // ลำดับเลข {n} ในต้นฉบับ ใช้จับคู่กับ {n} ในคำแปล
        const order = (norm(k).match(/\{\d\}/g) || []).map((m) => +m[1]);
        patterns.push({ re, out: v, order, len: k.length });
      } else {
        exact.set(norm(k), v);
      }
    }
    patterns.sort((a, b) => b.len - a.len); // key ยาว/เจาะจงกว่าก่อน
    if (ready) { translateTree(document.documentElement); }
  };

  // ---------- วันที่แบบไทย (พ.ศ.) → รูปแบบของภาษาปัจจุบัน ----------
  const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const TH_MONTHS_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const monthAlt = TH_MONTHS.concat(TH_MONTHS_S).map(esc).join('|');
  const DATE_RE = new RegExp('(\\d{1,2})\\s+(' + monthAlt + ')\\s+(\\d{4})', 'g');
  const dateRule = (s) => s.replace(DATE_RE, (m, d, mon, y) => {
    let mi = TH_MONTHS.indexOf(mon); if (mi < 0) mi = TH_MONTHS_S.indexOf(mon);
    let yr = +y; if (yr > 2400) yr -= 543;
    const dt = new Date(Date.UTC(yr, mi, +d, 12));
    if (Number.isNaN(dt.getTime())) return m;
    try { return new Intl.DateTimeFormat(locale, { day: 'numeric', month: mon.length > 5 ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' }).format(dt); } catch { return m; }
  });

  // ---------- แปลสตริงหนึ่งก้อน (คืนค่าเดิมถ้าไม่เจอ) ----------
  const hasThai = (s) => /[\u0E00-\u0E7F]/.test(s);
  const t = (s, ...args) => {
    if (s == null) return s;
    s = String(s);
    if (args.length) { // t('{0} วัน', 2) — ใช้ key ตรง ๆ แล้วแทนค่า
      const v = lang !== SOURCE ? byKey.get(norm(s)) : undefined;
      return (v !== undefined ? v : s).replace(/\{(\d)\}/g, (_, n) => (args[+n] != null ? args[+n] : ''));
    }
    let out = s;
    if (lang !== SOURCE && hasThai(s)) {
      const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
      const core = norm(m[2]);
      let res = exact.get(core);
      if (res === undefined) {
        for (const p of patterns) {
          const r = p.re.exec(core);
          if (r) { res = p.out.replace(/\{(\d)\}/g, (_, n) => { const i = p.order.indexOf(+n); if (i < 0) return ''; const v = r[i + 1]; const x = exact.get(norm(v)); return x !== undefined ? x : v; }); break; }
        }
      }
      if (res !== undefined) {
        // ถ้าก้อนที่จับได้มีตัวเลข/ข้อความไทยซ้อนอยู่ (เช่น วันที่) แปลซ้ำอีกชั้น
        out = m[1] + (hasThai(res) ? dateRule(res) : res) + m[3];
      } else if (hasThai(s)) {
        out = dateRule(s);
      }
    }
    return out;
  };

  // ---------- แปลทั้งหน้า ----------
  const SKIP_TAG = /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE|NOSCRIPT)$/;
  const skipEl = (el) => !el || SKIP_TAG.test(el.tagName) || (el.closest && el.closest('[data-no-i18n],[contenteditable=""],[contenteditable="true"]'));
  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];

  const doText = (node) => {
    const v = node.nodeValue;
    if (!v || !hasThai(v) || skipEl(node.parentElement)) return;
    const n = t(v);
    if (n !== v) node.nodeValue = n;
  };
  const doAttrs = (el) => {
    if (skipEl(el)) return;
    for (const a of ATTRS) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v && hasThai(v)) { const n = t(v); if (n !== v) el.setAttribute(a, n); }
    }
    if (el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type) && hasThai(el.value)) el.value = t(el.value);
  };
  const translateTree = (node) => {
    if (lang === SOURCE || !node) return;
    if (node.nodeType === 3) { doText(node); return; }
    if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return;
    if (node.nodeType === 1) doAttrs(node);
    const w = document.createTreeWalker(node, 1 | 4, null);
    let n = w.nextNode();
    while (n) { if (n.nodeType === 3) doText(n); else doAttrs(n); n = w.nextNode(); }
  };

  let ready = false;
  let mo = null;
  const observe = () => {
    if (mo || lang === SOURCE) return;
    mo = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'childList') m.addedNodes.forEach((n) => translateTree(n));
        else if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doAttrs(m.target);
      }
    });
    mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };

  // กล่องข้อความของเบราว์เซอร์
  if (lang !== SOURCE) {
    for (const fn of ['alert', 'confirm', 'prompt']) {
      const orig = window[fn];
      if (typeof orig === 'function') window[fn] = function (msg, ...rest) { return orig.call(window, t(msg), ...rest); };
    }
  }

  // ---------- ตัวเลือกภาษา (วางในเมนูข้าง) ----------
  const mountSwitcher = (slot) => {
    if (!slot || slot.dataset.mounted) return;
    slot.dataset.mounted = '1';
    slot.setAttribute('data-no-i18n', '');
    const label = document.createElement('label');
    label.className = 'block text-xs font-medium text-slate-500 dark:text-neutral-400 mb-1.5';
    label.htmlFor = 'niv-lang-sel';
    label.setAttribute('data-i18n-label', '');
    label.textContent = '🌐 ' + t('ภาษา');
    const sel = document.createElement('select');
    sel.id = 'niv-lang-sel';
    sel.className = 'w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-neutral-900 text-slate-800 dark:text-white text-sm px-3 py-2 cursor-pointer';
    const opt = (v, txt) => { const o = document.createElement('option'); o.value = v; o.textContent = txt; sel.appendChild(o); };
    opt('auto', t('อัตโนมัติ (ตามภาษาของอุปกรณ์)'));
    Object.keys(LANGS).forEach((c) => opt(c, LANGS[c].name));
    sel.value = LANGS[pref] ? pref : 'auto';
    sel.addEventListener('change', () => { setStored(sel.value); location.reload(); });
    slot.append(label, sel);
  };

  // ---------- เริ่มทำงาน ----------
  const start = () => {
    ready = true;
    translateTree(document.documentElement);
    observe();
  };

  // โหลดพจนานุกรมของภาษาที่เลือก (ไทย = ไม่ต้องโหลด)
  if (lang !== SOURCE) {
    if (document.readyState === 'loading') {
      document.write('<script src="/locales/' + lang + '.js"><\/script>'); // บล็อกสั้น ๆ เพื่อให้ข้อความแรกที่วาดเป็นภาษาที่ถูกต้องเลย
    } else {
      const s = document.createElement('script'); s.src = '/locales/' + lang + '.js'; document.head.appendChild(s);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    // กันกรณีสคริปต์อื่นสร้างหน้าเสร็จก่อนพจนานุกรมมา
    window.addEventListener('load', () => translateTree(document.documentElement));
  }

  window.NIV_I18N = {
    lang, locale, languages: LANGS, source: SOURCE,
    t, register, mountSwitcher,
    setLang: (v) => { setStored(v); location.reload(); },
    // ตัวช่วยจัดรูปแบบตามภาษาของผู้ใช้ (ใช้แทน toLocaleString('th-TH') ที่ฝังไว้)
    fmtNum: (n, o) => Number(n || 0).toLocaleString(locale, o),
    fmtDate: (d, o) => new Date(d).toLocaleDateString(locale, o || { year: 'numeric', month: 'short', day: 'numeric' }),
    fmtDateTime: (d, o) => new Date(d).toLocaleString(locale, o || { dateStyle: 'medium', timeStyle: 'short' }),
    translate: translateTree,
  };
})();
