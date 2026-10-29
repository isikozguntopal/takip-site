// Service worker: shows the reminder notifications and brings the app to the front when one is tapped.
// It does not cache pages, so the app always loads the latest version.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// The server sends an empty push at 21:00. The text is fixed, so no client data is ever sent to the server.
self.addEventListener('push', (event) => {
  event.waitUntil(self.registration.showNotification('Yarın seanslarınız var ♥', {
    body: 'Ayrıntılar için uygulamayı açın. İyi akşamlar, yarın da harika bir gün olacak.',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: 'yarin-seanslar',
    renotify: true,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (windows.length) return windows[0].focus();
    return self.clients.openWindow('./');
  })());
});
