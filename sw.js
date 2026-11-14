const CACHE_NAME = 'parknear-shell-v7';
const BASE_PATH = new URL('.', self.location.href).pathname;
const DEFAULT_ICON = `${BASE_PATH}assets/images/logo.png`;

const APP_FILES = [
    './',
    './index.html',
    './manifest.json',
    './assets/images/logo.png',
    './css/style.css',
    './css/splash.css',
    './css/edit.park.css',
    './css/park.card.css?v=20261114-3',
    './css/active-parking.css',
    './css/tab-bar.css',
    './css/favorites.css',
    './css/profile.css',
    './js/offline-storage.js',
    './js/map.js',
    './js/app.js?v=20261114-3',
    './js/push-notifications.js',
    './js/navigation.js',
    './js/city-selector.js',
    './js/car-selector.js',
    './js/active-parking.js',
    './js/parking-creator.js',
    './js/profile.js',
    './js/favorites.js?v=20261114-3',
    './js/settings.js',
    './js/onboarding.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_FILES))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key.startsWith('parknear-') && key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== 'GET' || url.origin !== self.location.origin) {
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put('./index.html', copy);
                        });
                    }
                    return response;
                })
                .catch(async () => {
                    const cache = await caches.open(CACHE_NAME);
                    return await cache.match('./index.html') ||
                        new Response('Park Near временно недоступен. Откройте приложение при подключении к интернету.', {
                            status: 503,
                            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                        });
                })
        );
        return;
    }
    const isAppFile = /\.(css|js|png|jpg|jpeg|svg|webp|woff2?|json)$/i.test(url.pathname);
    if (isAppFile) {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) return cached;

                return fetch(request).then(response => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, copy);
                        });
                    }
                    return response;
                });
            })
        );
    }
});
// Получение push-уведомления
self.addEventListener('push', event => {
    if (!event.data) return;

    let data = {};
    try {
        data = event.data.json();
    } catch {
        data = {
            title: 'ParkNear',
            body: event.data.text(),
            icon: DEFAULT_ICON,
            badge: DEFAULT_ICON
        };
    }
    const options = {
        body: data.body || 'Обновление парковки',
        icon: data.icon || DEFAULT_ICON,
        badge: data.badge || DEFAULT_ICON,
        data: data.data || {},
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
self.addEventListener('notificationclick', event => {
    event.notification.close();

    const parkingId = event.notification.data?.parkingId;
    const url = parkingId
        ? `${BASE_PATH}?parking=${encodeURIComponent(parkingId)}`
        : BASE_PATH;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                for (const client of clientList) {
                    if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                        client.postMessage({ action: 'focusParking', parkingId });
                        return client.focus();
                    }
                }
                return clients.openWindow(url);
            })
    );
});
