    // ===================== ГЕОЛОКАЦИЯ =====================
    function getUserLocation() {
    return new Promise((resolve, reject) => {
        // Если запущено внутри Telegram WebApp
        if (window.Telegram && window.Telegram.WebApp && typeof window.Telegram.WebApp.getLocation === 'function') {
            window.Telegram.WebApp.getLocation(function(position) {
                if (position && position.latitude && position.longitude) {
                    resolve({ lat: position.latitude, lng: position.longitude });
                } else {
                    reject(new Error('Telegram геолокация не удалась'));
                }
            });
            return;
        }

        // Стандартный браузерный метод
        if (!navigator.geolocation) {
            return reject(new Error('Геолокация не поддерживается вашим устройством'));
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
            },
            (error) => {
                reject(error);
            },
            { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
        );
    });
}
function tryYandexGeolocation(resolve, reject) {
    if (typeof ymaps !== 'undefined' && ymaps.geolocation) {
        ymaps.geolocation.get({ provider: 'browser', timeout: 10000 })
            .then(function(result) {
                var coords = result.geoObjects.get(0).geometry.getCoordinates();
                var location = { lat: coords[0], lng: coords[1] };
                lastKnownLocation = location;
                console.log('✅ Геолокация получена через Яндекс:', location);
                resolve(location);
            })
            .catch(function(err) {
                console.error('❌ Яндекс.Геолокация не удалась:', err);
                reject(new Error('Геолокация недоступна'));
            });
    } else {
        // Ни один метод не сработал
        reject(new Error('Геолокация не поддерживается браузером'));
    }
}
    function tryBrowserGeolocation(resolve, reject) {
        if (typeof ymaps !== 'undefined') {
            ymaps.geolocation.get({ provider: 'browser', timeout: 10000 })
                .then(function(result) {
                    const coords = result.geoObjects.get(0).geometry.getCoordinates();
                    lastKnownLocation = { lat: coords[0], lng: coords[1] };
                    resolve(lastKnownLocation);
                })
                .catch(function() { fallbackToNavigator(resolve, reject); });
        } else {
            fallbackToNavigator(resolve, reject);
        }
    }

    function fallbackToNavigator(resolve, reject) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function(pos) {
                    lastKnownLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    resolve(lastKnownLocation);
                },
                function(err) { reject(err); }, { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            reject(new Error('Геолокация не поддерживается'));
        }
    }
