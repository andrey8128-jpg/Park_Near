// sw.js
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Получение push-уведомления
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = {
      title: 'ParkNear',
      body: event.data.text(),
      icon: '/assets/images/logo.png',
      badge: '/assets/images/logo.png'
    };
  }

  const options = {
    body: data.body || 'Обновление парковки',
    icon: data.icon || '/assets/images/logo.png',
    badge: data.badge || '/assets/images/logo.png',
    data: data.data || {}, // может содержать parkingId для перехода
    actions: data.actions || [
      { action: 'open', title: 'Открыть' }
    ],
    vibrate: [200, 100, 200],
    tag: data.tag || 'parking-update',
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'ParkNear', options)
  );
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const parkingId = event.notification.data?.parkingId;
  const url = parkingId
    ? `/?parking=${parkingId}`
    : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Если уже есть открытое окно, переключаемся на него
        for (const client of clientList) {
          if (client.url.includes('/') && 'focus' in client) {
            client.postMessage({ action: 'focusParking', parkingId });
            return client.focus();
          }
        }
        // Иначе открываем новое окно
        return clients.openWindow(url);
      })
  );
});