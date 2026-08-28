importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyATLX5t2lmibbuiSXL_sWu_JnFFTb-nMqU",
    authDomain: "parknear-bef41.firebaseapp.com",
    databaseURL: "https://parknear-bef41-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "parknear-bef41",
    storageBucket: "parknear-bef41.firebasestorage.app",
    messagingSenderId: "1066552333578",
    appId: "1:1066552333578:web:e60e333cf877852eba16f3"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
    console.log('🔔 Фоновое уведомление:', payload);

    const notification = payload.notification || {};
    const data = payload.data || {};

    self.registration.showNotification(notification.title || 'ParkNear', {
        body: notification.body || 'Обновление парковки',
        icon: '/Park_Near/assets/images/logo.png',
        badge: '/Park_Near/assets/images/logo.png',
        tag: data.parkingId || 'parking-update',
        data: {
            parkingId: data.parkingId || ''
        }
    });
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();

    const parkingId = event.notification.data?.parkingId;
    const url = parkingId
        ? `/Park_Near/?parking=${encodeURIComponent(parkingId)}`
        : '/Park_Near/';

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(function(clientList) {
            for (const client of clientList) {
                if (client.url.includes('/Park_Near/') && 'focus' in client) {
                    if (parkingId) {
                        client.postMessage({
                            action: 'focusParking',
                            parkingId
                        });
                    }
                    return client.focus();
                }
            }

            return clients.openWindow(url);
        })
    );
});