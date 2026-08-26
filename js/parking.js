function loadAllParkings(city, force = false) {
    if (!city) city = currentCity;
    console.log('🔍 Загрузка парковок для города:', city);
    // Если город не выбран – загружаем все парковки (запасной вариант)
    if (!city) {
        console.warn('⚠️ Город не выбран, загружаем все парковки');
        return loadAllParkingsNoFilter(); // вызов fallback-функции
    }
    // Проверка кеша (только если force=false и кеш актуален)
    if (!force && Date.now() - lastDataRefresh < 30000 && parkingDataCache && Object.keys(parkingDataCache).length > 0) {
        const cached = localStorage.getItem('parkingCache');
        if (cached) {
            try {
                const cache = JSON.parse(cached);
                if (cache && cache.city === city && cache.data) {
                    console.log('⏳ Используем кеш для города', city);
                    return Promise.resolve();
                }
            } catch (e) {}
        }
        // Если кеш не соответствует городу – игнорируем
    }
    // Очищаем карту перед загрузкой
    clearAllMarkers();
    return new Promise(function(resolve, reject) {
        // ✅ Загружаем ВСЕ парковки без фильтра (сначала все, потом фильтруем на клиенте)
        database.ref('parkings').once('value').then(function(snapshot) {
            const data = snapshot.val();
            const newCache = {};
            if (data) {
                Object.keys(data).forEach(function(key) {
                    const parking = data[key];
                    if (!parking || parking.lat == null || parking.lng == null) return;

                    // ✅ Фильтрация по городу на клиенте
                    // Если у парковки есть поле city, и оно НЕ равно текущему городу – пропускаем
                    if (parking.city) {
    const parkingCity =
        String(parking.city)
            .trim()
            .toLowerCase();
    const selectedCity =
        String(city)
            .trim()
            .toLowerCase();
    if (
        parkingCity !== selectedCity &&
        !String(parking.address || '')
            .toLowerCase()
            .includes(selectedCity)
    ) {
        return;
    }
}
                    // Если поле city отсутствует – считаем, что парковка принадлежит текущему городу (включаем)
                    parking.totalSpots = Number(parking.totalSpots) || 0;
                    parking.occupiedSpots = Number(parking.occupiedSpots) || 0;
                    parking.occupiedSpots = Math.max(0, Math.min(parking.occupiedSpots, parking.totalSpots));
                    newCache[key] = parking;
                });
            }
            parkingDataCache = newCache;
            lastDataRefresh = Date.now();
            // Сохраняем кеш с указанием города
            try {
                localStorage.setItem('parkingCache', JSON.stringify({ city: city, data: newCache, timestamp: Date.now() }));
            } catch (e) {}
            // Добавляем маркеры
            Object.keys(newCache).forEach(function(id) {
                addMarkerToMap(id, newCache[id]);
            });
            if (typeof updateTotalFreeCircle === 'function') {
                updateTotalFreeCircle();
            }
            console.log('✅ Загружено парковок для города', city, ':', Object.keys(newCache).length);
            resolve();
        }).catch(function(error) {
            console.error('❌ Ошибка запроса к Firebase:', error);
            // Пытаемся загрузить из кеша
            const cached = localStorage.getItem('parkingCache');
            if (cached) {
                try {
                    const cache = JSON.parse(cached);
                    if (cache && cache.city === city && cache.data) {
                        parkingDataCache = cache.data;
                        lastDataRefresh = Date.now();
                        Object.keys(parkingDataCache).forEach(function(id) {
                            addMarkerToMap(id, parkingDataCache[id]);
                        });
                        if (typeof updateTotalFreeCircle === 'function') {
                            updateTotalFreeCircle();
                        }
                        console.log('⚠️ Использован локальный кеш для города', city);
                        resolve();
                        return;
                    }
                } catch (e) {}
            }
            reject(error);
        });
    });
}
function loadAllParkingsNoFilter() {
    return new Promise(function(resolve, reject) {
        database.ref('parkings').once('value').then(function(snapshot) {
            const data = snapshot.val();
            const newCache = {};
            if (data) {
                Object.keys(data).forEach(function(key) {
                    const parking = data[key];
                    if (!parking || parking.lat == null || parking.lng == null) return;
                    parking.totalSpots = Number(parking.totalSpots) || 0;
                    parking.occupiedSpots = Number(parking.occupiedSpots) || 0;
                    parking.occupiedSpots = Math.max(0, Math.min(parking.occupiedSpots, parking.totalSpots));
                    newCache[key] = parking;
                });
            }
            parkingDataCache = newCache;
            lastDataRefresh = Date.now();
            try {
                localStorage.setItem('parkingCache', JSON.stringify({ city: 'all', data: newCache, timestamp: Date.now() }));
            } catch (e) {}
            Object.keys(newCache).forEach(function(id) {
                addMarkerToMap(id, newCache[id]);
            });
            if (typeof updateTotalFreeCircle === 'function') {
                updateTotalFreeCircle();
            }
            console.log('⚠️ Загружены ВСЕ парковки (без фильтра) –', Object.keys(newCache).length);
            resolve();
        }).catch(function(error) {
            console.error('❌ Ошибка загрузки всех парковок:', error);
            reject(error);
        });
    });
}
