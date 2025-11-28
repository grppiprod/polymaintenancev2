// sw.js - Service Worker for PolyMaintenance

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate worker immediately
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim()); // Become available to all pages
});

// Handle incoming Push messages (from Server)
self.addEventListener('push', (event) => {
  if (!(self.Notification && self.Notification.permission === 'granted')) {
    return;
  }

  const data = event.data ? event.data.json() : {};
  const title = data.title || 'PolyMaintenance Update';
  const message = data.body || 'New activity detected.';
  const icon = 'https://aistudiocdn.com/lucide-react/wrench.png';

  const options = {
    body: message,
    icon: icon,
    badge: icon,
    vibrate: [100, 50, 100],
    data: {
      url: self.location.origin
    },
    actions: [
      { action: 'view', title: 'View Log' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle Notification Click (Open the app)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});