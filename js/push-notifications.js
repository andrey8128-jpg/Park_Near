// ============================================
// PARK NEAR — WEB PUSH
// ============================================

let isPushSupported = false;

function isPushSupportedBrowser() {
    return (
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    );
}

// ============================================
// ОБЩАЯ ФУНКЦИЯ ЗАПРОСОВ К API
// ============================================
async function pushApiRequest(path, method = 'GET', body = null) {
    const token = localStorage.getItem('parkNearSessionToken');

    if (!token) {
        throw new Error('Необходимо войти в аккаунт');
    }

    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    if (body !== null) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(
        `${window.PARKNEAR_API_URL}${path}`,
        options
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Ошибка запроса push-уведомлений');
    }

    return result;
}

// ============================================
// ПОЛУЧЕНИЕ SERVICE WORKER
// ============================================
async function getPushRegistration() {
    if (!isPushSupportedBrowser()) {
        throw new Error('Браузер не поддерживает Web Push');
    }

    const swScope = new URL('.', window.location.href).pathname;

    const registration = await navigator.serviceWorker.register(
        `${swScope}sw.js`,
        { scope: swScope }
    );

    await navigator.serviceWorker.ready;

    if (!registration.active) {
        throw new Error('Service Worker ещё не активен');
    }

    return registration;
}

// ============================================
// ПОЛУЧЕНИЕ ПУБЛИЧНОГО VAPID-КЛЮЧА
// ============================================
async function getVapidPublicKey() {
    const response = await fetch(
        `${window.PARKNEAR_API_URL}/api/push/vapid-public-key`
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.publicKey) {
        throw new Error(
            result.error || 'Не удалось получить VAPID-ключ'
        );
    }

    return result.publicKey;
}

// ============================================
// ПРЕОБРАЗОВАНИЕ VAPID-КЛЮЧА
// ============================================
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);

    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
}

// ============================================
// ЗАПРОС РАЗРЕШЕНИЯ
// ============================================
async function requestNotificationPermission() {
    if (!isPushSupportedBrowser()) {
        alert('Этот браузер не поддерживает push-уведомления.');
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission === 'denied') {
        alert('Уведомления отключены в настройках браузера.');
        return false;
    }

    const permission = await Notification.requestPermission();

    return permission === 'granted';
}

// ============================================
// СОХРАНЕНИЕ ПОДПИСКИ В POSTGRESQL
// ============================================
async function savePushSubscription(subscription) {
    if (!currentUser || !subscription) {
        throw new Error('Пользователь или подписка не найдены');
    }

    await pushApiRequest(
        '/api/push/subscriptions',
        'POST',
        {
            subscription: subscription.toJSON()
        }
    );
}

// ============================================
// УДАЛЕНИЕ ПОДПИСКИ ИЗ POSTGRESQL
// ============================================
async function removePushSubscription(subscription) {
    if (!subscription) return;

    await pushApiRequest(
        '/api/push/subscriptions',
        'DELETE',
        {
            endpoint: subscription.endpoint
        }
    );
}

// ============================================
// ВКЛЮЧЕНИЕ PUSH-УВЕДОМЛЕНИЙ
// ============================================
async function initPushNotifications() {
    try {
        if (!currentUser) {
            throw new Error('Сначала войдите в аккаунт');
        }

        if (!isPushSupportedBrowser()) {
            throw new Error('Браузер не поддерживает push-уведомления');
        }

        const granted = await requestNotificationPermission();

        if (!granted) {
            return false;
        }
        const registration = await getPushRegistration();
        const publicKey = await getVapidPublicKey();
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });
        }
        await savePushSubscription(subscription);
        console.log('Web Push-подписка сохранена');
        return true;
    } catch (error) {
        console.error('Ошибка включения push-уведомлений:', error);
        alert(error.message || 'Не удалось включить уведомления');
        return false;
    }
}
// ============================================
// ОТКЛЮЧЕНИЕ PUSH-УВЕДОМЛЕНИЙ
// ============================================
async function unsubscribePush() {
    try {
        if (!isPushSupportedBrowser()) {
            return true;
        }
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
            return true;
        }
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            return true;
        }
        // Сначала удаляем подписку с сервера.
        await removePushSubscription(subscription);
        // Затем отключаем её в браузере.
        const result = await subscription.unsubscribe();
        if (!result) {
            throw new Error('Браузер не подтвердил отписку');
        }
        console.log('Web Push-подписка удалена');
        return true;
    } catch (error) {
        console.error('Ошибка отключения push-уведомлений:', error);
        alert(error.message || 'Не удалось отключить уведомления');
        return false;
    }
}
// ============================================
// ОБРАБОТКА СООБЩЕНИЙ ОТ SERVICE WORKER
// ============================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (
            event.data?.action === 'focusParking' &&
            event.data?.parkingId
        ) {
            const data = parkingDataCache?.[event.data.parkingId];
            if (data) {
                openCenterSheet(event.data.parkingId, data);
            }
            if (typeof closePanel === 'function') {
                closePanel();
            }
        }
    });
}
// ============================================
// ГЛОБАЛЬНЫЕ ФУНКЦИИ
// ============================================
window.initPushNotifications = initPushNotifications;
window.unsubscribePush = unsubscribePush;
window.isPushSupportedBrowser = isPushSupportedBrowser;