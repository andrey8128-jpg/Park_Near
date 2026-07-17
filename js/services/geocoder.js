export function geocodeAddress(address) {
    return new Promise((resolve, reject) => {
        ymaps.geocode(address, { results: 1 })
            .then(res => {
                const geo = res.geoObjects.get(0);
                if (geo) {
                    const coords = geo.geometry.getCoordinates();
                    resolve({ coords, address: geo.getAddressLine() });
                } else {
                    reject(new Error('Адрес не найден'));
                }
            })
            .catch(reject);
    });
}

export function reverseGeocode(lat, lng) {
    return new Promise((resolve, reject) => {
        ymaps.geocode([lat, lng])
            .then(res => {
                const geo = res.geoObjects.get(0);
                if (geo) resolve(geo.getAddressLine());
                else reject(new Error('Координаты не распознаны'));
            })
            .catch(reject);
    });
}
