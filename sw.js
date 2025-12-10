// sw.js - Service Worker for PolyMaintenance

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate worker immediately
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim()); // Become available to all pages
});

// Handle incoming Push messages (from Server if configured, or local testing)
self.addEventListener('push', (event) => {
  if (!(self.Notification && self.Notification.permission === 'granted')) {
    return;
  }

  const data = event.data ? event.data.json() : {};
  const title = data.title || 'PolyMaintenance Update';
  const message = data.body || 'New activity detected.';
  const icon = 'https://aistudiocdn.com/lucide-react/wrench.png';
  const logId = data.logId || null;

  const options = {
    body: message,
    icon: icon,
    badge: icon, // Small icon for android status bar
    vibrate: [200, 100, 200],
    data: {
      url: self.location.origin,
      logId: logId
    },
    actions: [
      { action: 'view', title: 'View Log' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle Notification Click (Open the app and navigate to log)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. Try to find an existing open tab
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then((focusedClient) => {
            // Send a message to the React App to open the specific log
            if (event.notification.data && event.notification.data.logId) {
               focusedClient.postMessage({
                 type: 'OPEN_LOG',
                 logId: event.notification.data.logId
               });
            }
          });
        }
      }
      
      // 2. If no tab is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});