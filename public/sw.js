// public/sw.js — service worker ของ nivread: รับ Web Push แม้ปิดเว็บ/แอป แล้วแสดงการแจ้งเตือน
// ไม่แคชไฟล์ใด ๆ และไม่ดักคำขอเครือข่าย (ไม่มี fetch handler) จึงไม่กระทบการโหลดหน้าเว็บเดิมเลย
'use strict';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: 'nivread', body: event.data ? event.data.text() : '' }; }
  const title = String(d.title || 'nivread').slice(0, 120);
  // ต้องแสดงการแจ้งเตือนทุกครั้งที่ได้รับ push (ข้อกำหนดของเบราว์เซอร์ โดยเฉพาะ Safari/iOS)
  event.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body: String(d.body || '').slice(0, 240),
      icon: '/img/icon-192.png',
      badge: '/img/icon-96.png',
      tag: d.tag || undefined,            // tag เดียวกัน = แทนที่การแจ้งเตือนเดิม ไม่กองซ้อน
      renotify: false,
      lang: 'th',
      data: { url: typeof d.url === 'string' && d.url.startsWith('/') ? d.url : '/notifications' },
    });
    // บอกหน้าที่เปิดอยู่ให้บวกตัวเลขบนกระดิ่งเอง (ไม่ต้องยิงถามเซิร์ฟเวอร์)
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) w.postMessage({ type: 'push', kind: d.type || '' });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/notifications', self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin !== self.location.origin) continue;
      try { await w.focus(); if (w.url !== url) await w.navigate(url); return; } catch { /* ใช้เปิดหน้าต่างใหม่แทน */ }
    }
    await self.clients.openWindow(url);
  })());
});
