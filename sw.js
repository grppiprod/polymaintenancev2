// sw.js - Service Worker for PolyMaintenance

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  // Push event handler placeholder
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
});