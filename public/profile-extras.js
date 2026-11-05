// profile-extras.js — อัปโหลดรูปโปรไฟล์/ภาพปก ใช้ร่วมกันทั้ง fnnz และ nivread (ตาราง users + API เดียวกัน)
// ขั้นตอน: เลือกไฟล์ → ครอป/ซูม → บีบเป็น WebP → ตรวจภาพลามก (nsfwjs) → POST /api/blog/upload → บันทึกลิงก์ผ่าน /api/update-profile
// รูปเก่าถูกลบออกจาก R2 โดยเซิร์ฟเวอร์ตอน update-profile (ไม่ต้องทำที่หน้าเว็บ)
//
// วิธีใช้ (ต่อจากโค้ดที่เติมรูปโปรไฟล์ของหน้า):
//   <script src="/profile-extras.js"></script>
//   ProfileImage.init({
//     userId, apiBase, getToken: () => token, theme: 'cyan' | 'amber',
//     coverSlot, avatarImg, avatarPh,           // element: ช่องภาพปก / <img> รูปโปรไฟล์ / ตัวอักษรแทนเมื่อไม่มีรูป
//     onAvatarChange: (url) => {}               // ไม่บังคับ: เรียกหลังเปลี่ยนรูปโปรไฟล์
//   });
(() => {
    const UPLOAD_PATH = '/api/blog/upload';
    const MAX_RAW = 15 * 1024 * 1024;   // ไฟล์ต้นฉบับใหญ่สุด (ก่อนบีบ)
    const TARGET = 480 * 1024;          // เป้าขนาดหลังบีบ
    const HARD_MAX = 1400000;           // เซิร์ฟเวอร์รับไม่เกิน 1.5MB

    // คลาส Tailwind ต้องเขียนเต็มทั้งชุด (Tailwind CDN สแกนข้อความ) จึงแยกเป็นธีมสำเร็จรูป
    const THEMES = {
        cyan: {
            tint: 'bg-cyan-500/15 text-cyan-500', hover: 'hover:border-cyan-500 hover:text-cyan-500',
            primary: 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20',
            range: 'accent-cyan-500', pencil: 'bg-cyan-600 hover:bg-cyan-500', coverBg: 'from-cyan-600/40 via-blue-600/30 to-indigo-600/40', toastOk: 'text-cyan-400',
        },
        amber: {
            tint: 'bg-amber-500/15 text-amber-500', hover: 'hover:border-amber-500 hover:text-amber-500',
            primary: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25',
            range: 'accent-amber-500', pencil: 'bg-amber-500 hover:bg-amber-600', coverBg: 'from-amber-500/60 via-orange-500/50 to-red-500/40', toastOk: 'text-amber-400',
        },
    };

    const PATHS = {
        image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
        pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
        x: '<path d="M18 6L6 18M6 6l12 12"/>',
        trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/>',
        check: '<path d="M20 6L9 17l-5-5"/>',
        alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>',
        arrowLeft: '<path d="M19 12H5m7-7l-7 7 7 7"/>',
        undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-15-6.7L3 13"/>',
        upload: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
    };
    const ic = (name, cls = 'w-4 h-4') =>
        `<svg class="${cls} shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name]}</svg>`;
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
    const iconBtn = (cls, icon, text) => {
        const b = el('button', 'inline-flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50 ' + cls);
        b.type = 'button'; b.innerHTML = ic(icon) + (text ? `<span>${text}</span>` : ''); return b;
    };
    const sub = 'text-xs text-slate-500 dark:text-neutral-400';

    // ---------- บีบรูป (WebP → JPEG ถ้าเบราว์เซอร์ไม่รองรับ) ----------
    const toBlob = (cv, type, q) => new Promise(ok => cv.toBlob(ok, type, q));
    async function compressCanvas(cv) {
        let best = null;
        for (const q of [0.86, 0.78, 0.7, 0.62, 0.5]) {
            let b = await toBlob(cv, 'image/webp', q);
            if (!b || b.type !== 'image/webp') {
                const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height;
                const x2 = c2.getContext('2d'); x2.fillStyle = '#fff'; x2.fillRect(0, 0, c2.width, c2.height); x2.drawImage(cv, 0, 0);
                b = await toBlob(c2, 'image/jpeg', q);
            }
            if (!b) throw new Error('compress');
            best = b;
            if (b.size <= TARGET) break;
        }
        return best;
    }

    // ---------- ตรวจภาพลามกในเบราว์เซอร์ (nsfwjs) — โหลด/ตรวจไม่ได้จะข้าม ด่านจริงอยู่ที่เซิร์ฟเวอร์ ----------
    const loadScript = src => new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = src; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); });
    let nsfwP = null;
    const nsfwModel = () => nsfwP || (nsfwP = (async () => {
        const B = 'https://cdn.jsdelivr.net/npm/nsfwjs@4.2.1/dist/';
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
        await loadScript(B + 'models/mobilenet_v2/model.min.js');
        await loadScript(B + 'models/mobilenet_v2/group1-shard1of1.min.js');
        await loadScript(B + 'browser/nsfwjs.min.js');
        return await window.nsfwjs.load();
    })().catch(() => null));
    async function looksNsfw(blob) {
        try {
            const m = await Promise.race([nsfwModel(), new Promise(r => setTimeout(() => r(null), 12000))]);
            if (!m) return false;
            const url = URL.createObjectURL(blob), im = new Image();
            im.src = url; await im.decode();
            const pr = await m.classify(im); URL.revokeObjectURL(url);
            const g = n => (pr.find(x => x.className === n) || {}).probability || 0;
            return g('Porn') >= 0.6 || g('Hentai') >= 0.75;
        } catch (e) { return false; }
    }

    function init(opts) {
        const uid = opts.userId;
        if (!uid) return;
        const T = THEMES[opts.theme] || THEMES.cyan;
        const API = String(opts.apiBase || '').replace(/\/+$/, '');
        const getToken = opts.getToken || (() => '');
        const authHdr = () => (getToken() ? { Authorization: 'Bearer ' + getToken() } : {});

        const toast = (msg, ok = true) => {
            const t = el('div', 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm shadow-xl max-w-[90vw] border border-white/10');
            t.innerHTML = ic(ok ? 'check' : 'alert', 'w-4 h-4 ' + (ok ? T.toastOk : 'text-amber-400'));
            t.append(el('span', '', msg));
            document.body.append(t); setTimeout(() => t.remove(), 3500);
        };

        // ---------- เรียก API ----------
        async function saveRemote(extra) {
            try {
                const r = await fetch(API + '/api/update-profile', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHdr() },
                    body: JSON.stringify({ oldId: uid, newId: uid, ...extra })
                });
                const d = await r.json().catch(() => ({}));
                return { ...d, success: !!(r.ok && d.success) };
            } catch (e) { return { success: false, error: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' }; }
        }
        let profile = null;   // ข้อมูลล่าสุดจาก get-profile
        async function loadProfile() {
            try {
                const r = await fetch(`${API}/api/get-profile?id=${encodeURIComponent(uid)}&_=${Date.now()}`, { headers: authHdr() });
                const d = await r.json();
                profile = (d && d.user) || profile;
            } catch (e) {}
            return profile;
        }
        async function uploadBlob(blob) {
            if (!getToken()) throw new Error('หมดอายุการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่');
            const r = await fetch(API + UPLOAD_PATH + '?userId=' + encodeURIComponent(uid), {
                method: 'POST', headers: { ...authHdr(), 'Content-Type': blob.type }, body: blob
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok || !d.success || !d.url) throw new Error(d.error || (r.status === 401 ? 'หมดอายุการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่' : 'อัปโหลดไม่สำเร็จ'));
            return d.url;
        }
        // อัปโหลดแล้วแต่บันทึกลงโปรไฟล์ไม่สำเร็จ → ลบไฟล์ที่เพิ่งอัปโหลดทิ้ง (ไม่ให้ค้างใน R2)
        const discard = url => fetch(API + '/api/blog/img-discard', {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...authHdr() }, body: JSON.stringify({ userId: uid, url })
        }).catch(() => {});

        // ---------- แสดงผล ----------
        let coverSet = () => {};
        const avatarSet = url => {
            const { avatarImg: img, avatarPh: ph } = opts;
            if (img && url) { img.src = url; img.classList.remove('hidden'); if (ph) ph.classList.add('hidden'); }
            if (opts.onAvatarChange) opts.onAvatarChange(url || '');
        };

        async function applyUploaded(kind, url) {
            const isAv = kind === 'avatar';
            const d = await saveRemote(isAv ? { avatarUrl: url } : { coverUrl: url });
            if (!d.success) { discard(url); throw new Error(d.error || 'เซิร์ฟเวอร์ไม่ได้บันทึกค่านี้'); }
            const finalUrl = (isAv ? d.avatarUrl : d.coverUrl) || url;
            isAv ? avatarSet(finalUrl) : coverSet(finalUrl);
            if (profile) { profile[isAv ? 'avatar_url' : 'cover_url'] = finalUrl; if (isAv) profile.avatar_custom = 1; }
            toast('บันทึกลงบัญชีแล้ว');
        }

        // ---------- หน้าต่างอัปโหลด + ปรับตำแหน่ง ----------
        function openPicker(kind) {
            const isAv = kind === 'avatar';
            const FW = isAv ? 280 : 300, FH = isAv ? 280 : 100;      // กรอบที่เห็นบนจอ
            const OW = isAv ? 512 : 1200, OH = isAv ? 512 : 400;     // ขนาดไฟล์ที่ส่งขึ้น
            const prevOv = document.body.style.overflow; document.body.style.overflow = 'hidden';
            const ov = el('div', 'fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-sm');
            const panel = el('div', 'w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#121212] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 shadow-2xl p-5');
            ov.append(panel); document.body.append(ov);
            let busy = false, objUrl = '';
            const onKey = e => { if (e.key === 'Escape' && !busy) close(); };
            const close = () => { document.removeEventListener('keydown', onKey); if (objUrl) URL.revokeObjectURL(objUrl); ov.remove(); document.body.style.overflow = prevOv; };
            ov.onclick = e => { if (e.target === ov && !busy) close(); };
            document.addEventListener('keydown', onKey);

            const file = el('input'); file.type = 'file'; file.accept = 'image/jpeg,image/png,image/webp'; file.className = 'hidden';

            const header = (title, desc) => {
                const wrap = el('div', 'flex items-start gap-3 mb-4');
                const badge = el('div', 'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ' + T.tint);
                badge.innerHTML = ic(isAv ? 'pencil' : 'image', 'w-5 h-5');
                const txt = el('div', 'flex-1 min-w-0');
                txt.append(el('h2', 'font-bold text-lg leading-tight', title), el('p', sub + ' mt-0.5', desc));
                const x = el('button', 'w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 cursor-pointer');
                x.type = 'button'; x.title = 'ปิด'; x.innerHTML = ic('x', 'w-4 h-4'); x.onclick = () => { if (!busy) close(); };
                wrap.append(badge, txt, x);
                return wrap;
            };

            function start(note) {
                const drop = el('button', 'w-full flex flex-col items-center justify-center gap-2 py-10 rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/15 text-slate-600 dark:text-neutral-300 cursor-pointer transition-colors ' + T.hover);
                drop.type = 'button';
                drop.innerHTML = ic('upload', 'w-8 h-8');
                drop.append(el('span', 'text-sm font-semibold', 'เลือกรูปจากเครื่อง'), el('span', sub, 'JPG / PNG / WebP · ระบบจะบีบรูปให้อัตโนมัติ'));
                drop.onclick = () => { nsfwModel(); file.click(); };   // เริ่มโหลดโมเดลตรวจภาพรอไว้
                const parts = [header(isAv ? 'อัปโหลดรูปโปรไฟล์' : 'อัปโหลดภาพปก', isAv ? 'ภาพจะถูกครอปเป็นรูปสี่เหลี่ยมจัตุรัส' : 'ภาพจะถูกครอปเป็นแถบกว้าง 3:1'), drop];
                if (note) parts.push(el('p', 'text-xs text-rose-500 text-center mt-3', note));
                panel.replaceChildren(file, ...parts);
                if (isAv) addRevert();
            }

            // ปุ่มกลับไปใช้รูปเดิมของบัญชี (เช่นรูป Google) — เฉพาะรูปโปรไฟล์ที่เคยเปลี่ยนแล้ว
            async function addRevert() {
                const u = profile || await loadProfile();
                if (!u || !panel.isConnected || panel.querySelector('[data-revert]')) return;
                if (!(u.avatar_custom || (u.avatar_original && u.avatar_original !== u.avatar_url))) return;
                const rb = iconBtn('mt-4 w-full px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-300 dark:border-white/15 text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-white/10', 'undo', 'กลับไปใช้รูปเดิม');
                rb.dataset.revert = '1';
                rb.onclick = async () => {
                    rb.disabled = true;
                    const d = await saveRemote({ avatarUrl: '' });
                    if (!d.success) { toast(d.error || 'คืนรูปเดิมไม่สำเร็จ', false); rb.disabled = false; return; }
                    if (opts.onAvatarChange) opts.onAvatarChange(d.avatarUrl || '');
                    location.reload();
                };
                panel.append(rb);
            }

            function edit(f) {
                if (objUrl) URL.revokeObjectURL(objUrl);
                objUrl = URL.createObjectURL(f);
                let iw, ih, s0 = 1, z = 1, ox = 0, oy = 0, drag = null;
                const frame = el('div', 'relative mx-auto overflow-hidden bg-black touch-none select-none ring-1 ring-white/10 ' + (isAv ? 'rounded-2xl' : 'rounded-xl'));
                frame.style.cssText = `width:${FW}px;height:${FH}px;max-width:100%;cursor:grab`;
                const im = new Image(); im.draggable = false; im.className = 'absolute max-w-none'; im.alt = 'รูปที่เลือก';
                frame.append(im);
                if (isAv) { const m = el('div', 'absolute inset-0 rounded-full pointer-events-none'); m.style.boxShadow = '0 0 0 999px rgba(0,0,0,.55)'; frame.append(m); }
                const layout = () => {
                    const sc = s0 * z, w = iw * sc, h = ih * sc;
                    ox = Math.min(0, Math.max(FW - w, ox)); oy = Math.min(0, Math.max(FH - h, oy));
                    im.style.cssText = `left:${ox}px;top:${oy}px;width:${w}px;height:${h}px`;
                };
                im.onload = () => { iw = im.naturalWidth; ih = im.naturalHeight; s0 = Math.max(FW / iw, FH / ih); ox = (FW - iw * s0) / 2; oy = (FH - ih * s0) / 2; layout(); ok.disabled = false; };
                im.onerror = () => start('เปิดรูปนี้ไม่ได้ (ไฟล์อาจเสียหรือรูปแบบไม่รองรับ)');
                im.src = objUrl;
                frame.onpointerdown = e => { if (busy) return; drag = { x: e.clientX, y: e.clientY, ox, oy }; frame.setPointerCapture(e.pointerId); frame.style.cursor = 'grabbing'; };
                frame.onpointermove = e => { if (!drag) return; ox = drag.ox + e.clientX - drag.x; oy = drag.oy + e.clientY - drag.y; layout(); };
                frame.onpointerup = frame.onpointercancel = () => { drag = null; frame.style.cursor = 'grab'; };

                const rng = el('input', 'w-full mt-5 ' + T.range); rng.type = 'range'; rng.min = 1; rng.max = 3; rng.step = 0.01; rng.value = 1; rng.setAttribute('aria-label', 'ซูม');
                rng.oninput = () => {
                    const old = s0 * z, cx = (FW / 2 - ox) / old, cy = (FH / 2 - oy) / old;
                    z = +rng.value; const sc = s0 * z; ox = FW / 2 - cx * sc; oy = FH / 2 - cy * sc; layout();
                };
                const status = el('p', sub + ' text-center mt-4 min-h-[1rem]', 'ลากภาพเพื่อเลื่อนตำแหน่ง และใช้แถบด้านล่างเพื่อซูม');
                const row = el('div', 'flex gap-2 mt-5');
                const back = iconBtn('flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20', 'arrowLeft', 'เลือกรูปอื่น');
                const ok = iconBtn('flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold ' + T.primary, 'check', 'ใช้ภาพนี้');
                ok.disabled = true;   // รอให้ภาพโหลดเสร็จก่อนจึงกดได้
                back.onclick = () => { if (!busy) start(); };
                ok.onclick = async () => {
                    busy = true; ok.disabled = back.disabled = rng.disabled = true;
                    const setStatus = (t, bad) => { status.textContent = t; status.className = (bad ? 'text-xs text-rose-500' : sub) + ' text-center mt-4 min-h-[1rem]'; };
                    try {
                        setStatus('กำลังบีบรูป ...');
                        const c = document.createElement('canvas'); c.width = OW; c.height = OH;
                        const cx = c.getContext('2d'); cx.imageSmoothingQuality = 'high';
                        const sc = s0 * z; cx.drawImage(im, -ox / sc, -oy / sc, FW / sc, FH / sc, 0, 0, OW, OH);
                        const blob = await compressCanvas(c);
                        if (blob.size > HARD_MAX) throw new Error('ไฟล์ใหญ่เกินไป ลองรูปอื่น');
                        setStatus('กำลังตรวจสอบเนื้อหา ...');
                        if (await looksNsfw(blob)) throw new Error('รูปไม่ผ่านการตรวจสอบเนื้อหา (ไม่อนุญาตภาพลามก)');
                        setStatus('กำลังอัปโหลด ' + (blob.size / 1024).toFixed(0) + ' KB ...');
                        const url = await uploadBlob(blob);
                        setStatus('กำลังบันทึกลงบัญชี ...');
                        await applyUploaded(kind, url);
                        busy = false; close();
                    } catch (e) {
                        busy = false; ok.disabled = back.disabled = rng.disabled = false;
                        setStatus(e.name === 'SecurityError' ? 'ประมวลผลรูปนี้ไม่ได้' : (e.message || 'อัปโหลดไม่สำเร็จ'), true);
                    }
                };
                row.append(back, ok);
                panel.replaceChildren(file, header(isAv ? 'ปรับตำแหน่งรูปโปรไฟล์' : 'ปรับตำแหน่งภาพปก', f.name), frame, status, rng, row);
            }

            file.onchange = () => {
                const f = file.files[0]; file.value = '';
                if (!f) return;
                if (f.type === 'image/gif') return start('ไม่รองรับ GIF — ใช้ JPG / PNG / WebP');
                if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return start('รองรับเฉพาะรูป JPG / PNG / WebP');
                if (f.size > MAX_RAW) return start('ไฟล์ใหญ่เกิน 15 MB');
                edit(f);
            };
            start();
        }

        // ---------- ภาพปก + ปุ่มเปลี่ยนรูปโปรไฟล์ ----------
        const slot = opts.coverSlot;
        if (slot) {
            const wrap = el('div', 'relative w-full h-full overflow-hidden bg-gradient-to-br ' + T.coverBg);
            const img = el('img', 'absolute inset-0 w-full h-full object-cover hidden'); img.alt = 'ภาพปก'; img.decoding = 'async';
            const hint = el('div', 'absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70 text-sm');
            hint.innerHTML = ic('image', 'w-7 h-7') + '<span>ยังไม่มีภาพปก</span>';
            const shade = el('div', 'absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/50 to-transparent pointer-events-none');
            const bar = el('div', 'absolute top-3 right-3 flex gap-2');
            const cls = 'px-3 py-1.5 rounded-lg bg-black/55 hover:bg-black/75 backdrop-blur text-white text-xs font-medium';
            const pick = iconBtn(cls, 'upload', 'เปลี่ยนภาพปก'), del = iconBtn(cls + ' hidden', 'trash', 'ลบ');
            bar.append(pick, del); wrap.append(img, hint, shade, bar);
            coverSet = url => {
                if (url && /^https?:\/\//.test(url)) { img.src = url; img.classList.remove('hidden'); hint.classList.add('hidden'); del.classList.remove('hidden'); }
                else { img.removeAttribute('src'); img.classList.add('hidden'); hint.classList.remove('hidden'); del.classList.add('hidden'); }
            };
            pick.onclick = () => openPicker('cover');
            del.onclick = async () => {
                del.disabled = true;
                const d = await saveRemote({ coverUrl: '' });
                del.disabled = false;
                if (d.success) { coverSet(''); if (profile) profile.cover_url = null; toast('ลบภาพปกแล้ว'); }
                else toast(d.error || 'ลบภาพปกไม่สำเร็จ', false);
            };
            slot.replaceChildren(wrap);
        }

        const av = opts.avatarImg && opts.avatarImg.parentElement;
        if (av) {
            const ab = el('button', 'absolute bottom-0 right-0 w-8 h-8 rounded-full text-white flex items-center justify-center shadow-lg cursor-pointer ring-2 ring-white dark:ring-[#121212] transition-colors ' + T.pencil);
            ab.type = 'button'; ab.title = 'เปลี่ยนรูปโปรไฟล์'; ab.setAttribute('aria-label', 'เปลี่ยนรูปโปรไฟล์'); ab.innerHTML = ic('pencil', 'w-4 h-4'); ab.onclick = () => openPicker('avatar'); av.append(ab);
        }

        // โหลดภาพปกจากเซิร์ฟเวอร์ (ให้ภาพไปตามบัญชีทุกเครื่อง/ทั้งสองเว็บ)
        loadProfile().then(u => { if (u) coverSet(u.cover_url || ''); });
    }

    window.ProfileImage = { init };
})();
