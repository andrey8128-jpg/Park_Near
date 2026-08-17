// js/push-notifications.js
const PUSH_CONFIG = {
  vapidKey: 'BJ_JmNo-zXnnE-N0Gl1SGiVUHAAoqNdCP0MTihuMwTHXM-oPeRPujAWAkX7Zvhl2NmIfDgeJT7v1Jd43c5A6o_Y', // Получить в консоли Firebase → Project Settings → Cloud Messaging → Web push certificates
  firebaseMessagingSenderId: firebaseConfig.messagingSenderId
};

let isPushSupported = false;

// Проверка поддержки
function isPushSupportedBrowser() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Запрос разрешения
async function requestNotificationPermission() {
  if (!isPushSupportedBrowser()) {
    console.warn('Push уведомления не поддерживаются');
    return false;
  }

  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') {
    alert('Уведомления отключены. Включите их в настройках браузера.');
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

// Получение токена FCM
async function getFCMToken() {
  try {
    const registration = await navigator.serviceWorker.ready;
    // Используем firebase.messaging для получения токена
    // Загружаем Firebase Messaging (если ещё не загружена)
    const messaging = firebase.messaging();
    const token = await messaging.getToken({
      vapidKey: PUSH_CONFIG.vapidKey,
      serviceWorkerRegistration: registration
    });
    return token;
  } catch (error) {
    console.error('Ошибка получения токена FCM:', error);
    return null;
  }
}

// Сохранение токена в Firebase
async function savePushToken(token) {
  if (!currentUser || !token) return;
 let deviceId = localStorage.getItem('parknear_device_id');

if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('parknear_device_id', deviceId);
}
  await database.ref(`users/${currentUser.id}/pushSubscriptions/${deviceId}`).set({
    token: token,
    userAgent: navigator.userAgent,
    timestamp: Date.now()
  });
}

// Удаление токена (при отписке)
async function removePushToken(token) {
  if (!currentUser) return;
  const snapshot = await database.ref(`users/${currentUser.id}/pushSubscriptions`)
    .orderByChild('token').equalTo(token).once('value');
  if (snapshot.exists()) {
    const key = Object.keys(snapshot.val())[0];
    await database.ref(`users/${currentUser.id}/pushSubscriptions/${key}`).remove();
  }
}

// Инициализация уведомлений
async function initPushNotifications() {
  if (!isPushSupportedBrowser()) {
    console.warn('Push не поддерживается');
    return;
  }

  // Регистрируем Service Worker
try {
    const registration = await navigator.serviceWorker.register(
        '/Park_Near/sw.js',
        {
            scope: '/Park_Near/'
        }
    );
    await registration.update();

    console.log('Service Worker зарегистрирован:', registration.scope);
} catch (err) {
    console.error('Ошибка регистрации Service Worker:', err);
    return;
}

  // Проверяем разрешение
  const granted = await requestNotificationPermission();
  if (!granted) {
    console.warn('Уведомления запрещены');
    return;
  }

  // Получаем токен
  const token = await getFCMToken();
  if (token) {
    await savePushToken(token);
    console.log('Push-токен сохранён:', token);
  }
}

// Отписка от уведомлений
async function unsubscribePush() {
  const token = await getFCMToken();
  if (token) {
    await removePushToken(token);
  }
  // Также можно отписаться от push-менеджера
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
  }
  console.log('Отписка от уведомлений выполнена');
}

// Обработка сообщений от Service Worker
navigator.serviceWorker.addEventListener('message', (event) => {
  if (event.data.action === 'focusParking' && event.data.parkingId) {
    // Открыть карточку парковки
    const data = parkingDataCache[event.data.parkingId];
    if (data) {
      openCenterSheet(event.data.parkingId, data);
    }
    // Закрываем панель, чтобы показать карту
    closePanel();
  }
});

// Экспортируем функции глобально
window.initPushNotifications = initPushNotifications;
window.unsubscribePush = unsubscribePush;
