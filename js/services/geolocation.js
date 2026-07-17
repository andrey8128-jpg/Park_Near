export function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (window.Telegram?.WebApp?.Geolocation?.getLocation) {
            window.Telegram.WebApp.Geolocation.getLocation()
                .then(loc => resolve({ lat: loc.latitude, lng: loc.longitude }))
                .catch(() => browserGeolocation(resolve, reject));
        } else {
            browserGeolocation(resolve, reject);
        }
    });
}

function browserGeolocation(resolve, reject) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            reject,
            { enableHighAccuracy: true, timeout: 10000 }
        );
    } else {
        reject(new Error('Геолокация не поддерживается'));
    }
}
