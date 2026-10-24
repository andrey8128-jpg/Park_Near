const ENABLE_PARKING_CLUSTERS = true;
function initMap() {
    console.log('▶️ initMap вызвана');
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('❌ Элемент #map не найден в DOM');
        return;
    }
    // =====================================================
    // ПРОВЕРКА ЗАГРУЗКИ ЯНДЕКС.КАРТ
    // =====================================================
    if (typeof ymaps === 'undefined') {
        mapContainer.innerHTML = '⚠️ API Яндекс.Карт не загружен. Проверьте ключ и интернет.';
        console.error('❌ ymaps не определён – API не загружен');
        return;
    }
    try {
        // 1. Создаём карту с начальным зумом 15
        map = new ymaps.Map("map", {
            center: [55.7558, 37.6173],
            zoom: 16,
            maxZoom: 19,
            controls: [],
            type: 'yandex#map'
        });
        console.log('✅ Карта инициализирована');
        // ===== АВТОМАТИЧЕСКОЕ ОТОБРАЖЕНИЕ ПОЛИГОНОВ ПРИ ЗУМЕ >= 16 =====
map.events.add('zoomchange', function() {
    if (!map) return;
    const currentZoom = map.getZoom();
    const showPolygons = currentZoom >= 16;
    Object.keys(mapMarkers).forEach(function(id) {
        const placemark = mapMarkers[id];
        if (!placemark) return;
        const polygon = placemark.properties.get('polygon');
        if (!polygon) return;
        // Активная парковка должна оставаться видимой,
        // даже если масштаб карты изменился.
        const isActive =
            activePolygon === polygon;
        polygon.options.set(
            'visible',
            isActive || showPolygons
        );
    });
});
        // ===== СОЗДАЁМ КЛАСТЕРИЗАТОР =====
        if (ENABLE_PARKING_CLUSTERS) {
            clusterer = new ymaps.Clusterer({
                gridSize: 64,
                minClusterSize: 2,
                maxZoom: 18,
                clusterDisableClickZoom: false,
                clusterOpenBalloonOnClick: false,
                
              clusterIconLayout:
                ymaps.templateLayoutFactory.createClass(
                '<div style="' +
                    'position:relative;' +
                    'width:48px;' +
                    'height:48px;' +
                    'box-sizing:border-box;' +
                    'border-radius:50%;' +
                    'background-color:#22A447;' +
                    'background-color:$[properties.clusterColor];' +
                    'border:3px solid #ffffff;' +
                    'display:flex;' +
                    'align-items:center;' +
                    'justify-content:center;' +
                    'box-shadow:0 3px 10px rgba(0,0,0,0.35);' +
                    'opacity:1;' +
                    'color:#ffffff;' +
                    'font-weight:700;' +
                    'font-size:16px;' +
                    'text-shadow:0 1px 2px rgba(0,0,0,0.25);' +
                '">' +
                    '$[properties.parkingCount]' +
                '</div>'
            ),
                clusterBalloonContentLayout:
                    ymaps.templateLayoutFactory.createClass(
                        '<div style="' +
                            'max-height:150px;' +
                            'overflow-y:auto;' +
                            'padding:6px 10px;' +
                            'font-size:13px;' +
                        '">' +
                            '{% for geoObject in properties.geoObjects %}' +
                                '<div style="' +
                                    'padding:6px 8px;' +
                                    'border-bottom:1px solid #eee;' +
                                    'cursor:pointer;' +
                                '">' +
                                    '<div style="font-weight:600;">' +
                                        '{{ geoObject.properties.name }}' +
                                    '</div>' +
                                    '<div style="font-size:12px;color:var(--text-secondary);">' +
                                        'Свободно: ' +
                                        '{{ geoObject.properties.freeSpots }}' +
                                        ' / ' +
                                        '{{ geoObject.properties.totalSpots }}' +
                                    '</div>' +
                                '</div>' +
                            '{% endfor %}' +
                        '</div>'
                    )
            });
            // ===== СУММАРНАЯ ЗАГРУЖЕННОСТЬ И ЦВЕТ КЛАСТЕРА =====
            clusterer.events.add('clusterize', function(e) {
                const clusters = e.get('clusters');
                if (!clusters) return;
            clusters.forEach(function(cluster) {
                    const geoObjects = cluster.getGeoObjects();
                    let totalSpots = 0;
                    let freeSpots = 0;
             geoObjects.forEach(function(placemark) {
                        const total = Math.max(
                            0,
                            Number(placemark.properties.get('totalSpots')) || 0
                        );
                        const free = Math.max(
                            0,
                            Number(placemark.properties.get('freeSpots')) || 0
                        );
                        totalSpots += total;
                        freeSpots += Math.min(free, total);
                    });
                    cluster.properties.set('totalSpots', totalSpots);
                    cluster.properties.set('freeSpots', freeSpots);
                    cluster.properties.set('parkingCount', geoObjects.length);
                        let clusterColor = '#808080';
                    if (totalSpots > 0) {
                        const freePercent = freeSpots / totalSpots * 100;
                        if (freePercent >= 50) {
                            clusterColor = '#22A447';
                        } else if (freePercent >= 20) {
                            clusterColor = '#F59E0B';
                        } else {
                            clusterColor = '#E53935';
                        }
                    }
                    cluster.properties.set('clusterColor', clusterColor);
                });
            });
            // Добавляем кластеризатор на карту
            map.geoObjects.add(clusterer);
            // При нажатии на кластер приближаем карту
            clusterer.events.add('click', function(e) {
                const cluster = e.get('target');
                const coords = cluster.geometry.getCoordinates();
                map.setCenter(coords, 16, {
                    duration: 300,
                    checkZoomRange: true
                });
            });
        }
        // ===== Обработчики кнопок =====
        document.getElementById('addBtn').onclick = function() {
            if (!currentUser) showPanel('home');
            else if (isDrawingMode) cancelDrawing();
            else startDrawingMode();
        };
        const layerBtn = document.getElementById('layerSwitcher');
        let pressTimer = null;
        function showLayerMenu() {
            document.getElementById('layerMenu').classList.add('active');
        }
        layerBtn.addEventListener('mousedown', function(e) {
            pressTimer = setTimeout(function() { showLayerMenu(); pressTimer = null; }, 500);
        });
        layerBtn.addEventListener('mouseup', function(e) {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
                const currentType = map.getType();
                const types = ['yandex#map', 'yandex#satellite', 'yandex#hybrid'];
                let idx = types.indexOf(currentType);
                if (idx === -1) idx = 0;
                const nextType = types[(idx + 1) % types.length];
                map.setType(nextType);
                document.querySelectorAll('.layer-option').forEach(function(o) { o.classList.remove('selected'); });
                document.querySelector('.layer-option[data-type="' + nextType + '"]').classList.add('selected');
                updateMapTheme();
            }
        });
        layerBtn.addEventListener('touchstart', function(e) {
            pressTimer = setTimeout(function() { showLayerMenu(); pressTimer = null; }, 500);
        });
        layerBtn.addEventListener('touchend', function(e) {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
                const currentType = map.getType();
                const types = ['yandex#map', 'yandex#satellite', 'yandex#hybrid'];
                let idx = types.indexOf(currentType);
                if (idx === -1) idx = 0;
                const nextType = types[(idx + 1) % types.length];
                map.setType(nextType);
                document.querySelectorAll('.layer-option').forEach(function(o) { o.classList.remove('selected'); });
                document.querySelector('.layer-option[data-type="' + nextType + '"]').classList.add('selected');
                updateMapTheme();
            }
        });
        // ===== Кнопка геолокации =====
        document.getElementById('geoBtn').onclick = function() {
            if (!map) return;
            const btn = this;
            const originalContent = btn.innerHTML;
            btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></div>';
            btn.disabled = true;
            getUserLocation()
                .then(function(coords) {
                    btn.innerHTML = originalContent;
                    btn.disabled = false;
                    if (myLocationPlacemark) map.geoObjects.remove(myLocationPlacemark);
                    myLocationPlacemark = new ymaps.Placemark([coords.lat, coords.lng], {
                        hintContent: 'Вы здесь',
                        balloonContent: '<strong>Ваше местоположение</strong>'
                    }, {
                        preset: 'islands#blueCircleDotIconWithCaption'
                    });
                    myLocationPlacemark.properties.set('caption', 'Вы здесь');
                    map.geoObjects.add(myLocationPlacemark);
                    map.setCenter([coords.lat, coords.lng], 16, { duration: 500 });
                    if (window.Telegram?.WebApp?.HapticFeedback) {
                        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                    }
                })
                .catch(function(err) {
                    btn.innerHTML = originalContent;
                    btn.disabled = false;
                    console.error('Ошибка геолокации:', err);
                    let message = 'Не удалось определить ваше местоположение.';
                    if (err.message) message += ' ' + err.message;
                    if (window.Telegram?.WebApp?.showAlert) {
                        window.Telegram.WebApp.showAlert(message);
                    } else {
                        alert(message);
                    }
                });
        };
        // ===== Загружаем парковки =====
        loadAllParkings(currentCity).catch(function(err) {
            console.warn('Не удалось загрузить парковки:', err);
        });
        // ===== Автогеолокация через 1 секунду =====
        setTimeout(function() {
            getUserLocation()
                .then(function(coords) {
                    if (myLocationPlacemark) map.geoObjects.remove(myLocationPlacemark);
                    myLocationPlacemark = new ymaps.Placemark([coords.lat, coords.lng], {
                        hintContent: 'Вы здесь'
                    }, {
                        preset: 'islands#blueCircleDotIconWithCaption'
                    });
                    myLocationPlacemark.properties.set('caption', 'Вы здесь');
                    map.geoObjects.add(myLocationPlacemark);
                    map.setCenter([coords.lat, coords.lng], 14, { duration: 500 });
                })
                .catch(function() {
                    console.log('Автогеолокация не удалась');
                    showToast('Нажмите 📍, чтобы определить ваше местоположение', 4000);
                });
        }, 1000);
       // ===== Скрываем сплеш-экран =====
setTimeout(function() {
    const splash = document.getElementById('splashScreen');
    if (splash) {
        splash.classList.add('splash-hidden');
        setTimeout(function() {
            splash.remove();
        }, 700);
    }
}, 5000);
    } catch (e) {
    console.error(
        '❌ Ошибка инициализации ParkNear:',
        e
    );
    if (map) {
        console.error(
            '⚠️ Карта уже создана. Ошибка произошла после создания карты.'
        );
        return;
    }
    const container =
        document.getElementById('map');
    if (container) {
        container.innerHTML = `
            <div style="
                color: var(--red);
                text-align: center;
                padding: 20px;
            ">
                ⚠️ Не удалось инициализировать карту.
            </div>
        `;
     }
  }
}
function createParkingClusterer() {
    if (!map) return;
    if (clusterer) {
        try {
            map.geoObjects.remove(clusterer);
        } catch (e) {
            console.warn('Не удалось удалить старый кластеризатор:', e);
        }
        clusterer = null;
    }
    clusterer = new ymaps.Clusterer({
        preset: 'islands#invertedDarkGreenClusterIcons',
        groupByCoordinates: false,
        clusterDisableClickZoom: false,
        clusterOpenBalloonOnClick: false,
        clusterIconLayout: ymaps.templateLayoutFactory.createClass(
            '<div class="parking-cluster">' +
                '<div class="parking-cluster-count">$[properties.clusterCount]</div>' +
                '<div class="parking-cluster-free">🅿️ $[properties.clusterFree]</div>' +
            '</div>'
        ),
        clusterIconShape: {
            type: 'Circle',
            coordinates: [0, 0],
            radius: 32
        }
    });
    map.geoObjects.add(clusterer);
}
function addMarkerToMap(id, data) {
    if (!map || !data || typeof ymaps === 'undefined') {
        return;
    }
    // Удаляем старый маркер, если он существует.
    if (mapMarkers[id]) {
        const oldPlacemark = mapMarkers[id];
        const oldPolygon = oldPlacemark.properties.get('polygon');
        if (clusterer) {
            clusterer.remove(oldPlacemark);
        } else {
            map.geoObjects.remove(oldPlacemark);
        }
        if (oldPolygon) {
            map.geoObjects.remove(oldPolygon);
        }
        delete mapMarkers[id];
    }
    // Нормализуем данные парковки.
    const totalSpots = Number(data.totalSpots) || 0;
    const occupiedSpots = Math.max(
        0,
        Math.min(Number(data.occupiedSpots) || 0, totalSpots)
    );
    const freeSpots = Math.max(0, totalSpots - occupiedSpots);
    const color = getOccupancyColor(occupiedSpots, totalSpots);
    // Определяем координаты центра парковки.
    let centerLat = Number(data.lat);
    let centerLng = Number(data.lng);
    if (Array.isArray(data.coordinates) && data.coordinates.length > 0) {
        let latSum = 0;
        let lngSum = 0;
        let validPoints = 0;
    data.coordinates.forEach(function(point) {
            if (
                Array.isArray(point) &&
                point.length >= 2 &&
                Number.isFinite(Number(point[0])) &&
                Number.isFinite(Number(point[1]))
            ) {
                latSum += Number(point[0]);
                lngSum += Number(point[1]);
                validPoints++;
            }
        });
        if (validPoints > 0) {
            centerLat = latSum / validPoints;
            centerLng = lngSum / validPoints;
        }
    }
    // Не создаём маркер с некорректными координатами.
    if (
        !Number.isFinite(centerLat) ||
        !Number.isFinite(centerLng)
    ) {
        console.warn('Некорректные координаты парковки:', id, data);
        return;
    }
    // Создаём полигон парковочной зоны.
    let polygon = null;
    if (Array.isArray(data.coordinates) && data.coordinates.length >= 3) {
        polygon = new ymaps.Polygon(
            [data.coordinates],
            {},
            {
                fillColor: color + '33',
                strokeColor: color,
                strokeWidth: 2,
                visible: false,
                zIndex: 5
            }
        );
        map.geoObjects.add(polygon);
        polygon.__parkingId = id;
    }
    // Создаём маркер.
    const placemark = new ymaps.Placemark(
        [centerLat, centerLng],
        {
            hintContent: data.name || 'Парковка',
            name: data.name || 'Парковка',
            freeSpots: freeSpots,
            totalSpots: totalSpots,
            occupiedSpots: occupiedSpots,
            parkingId: id,
            polygon: polygon
        },
        {
            preset: 'islands#blueIcon',
            iconColor: color
        }
    );
    // Обработка нажатия на маркер.
    placemark.events.add('click', function() {
        const selectedPolygon = placemark.properties.get('polygon');
        if (activePolygon && activePolygon !== selectedPolygon) {
            activePolygon.options.set('visible', false);
        }
        if (selectedPolygon && selectedPolygon.geometry) {
            activePolygon = selectedPolygon;
         selectedPolygon.options.set({
                visible: true,
                zIndex: 1000
            });
            const bounds = selectedPolygon.geometry.getBounds();
              if (bounds) {
                map.setBounds(bounds, {
                    checkZoomRange: true,
                    zoomMargin: [40, 40, 280, 40],
                    duration: 350
                });
            }
        } else {
            activePolygon = null;
            map.setCenter(
                [centerLat, centerLng],
                18,
                {
                    duration: 350,
                    checkZoomRange: true
                }
            );
        }
 openCenterSheet(id, data);
        if (map.balloon) {
            map.balloon.close();
        }
    });
    // Добавляем маркер в зависимости от режима.
    if (
        typeof ENABLE_PARKING_CLUSTERS !== 'undefined' &&
        ENABLE_PARKING_CLUSTERS &&
        clusterer
    ) {
        clusterer.add(placemark);
    } else {
        map.geoObjects.add(placemark);
    }
    // Сохраняем ссылку на маркер.
    mapMarkers[id] = placemark;
    // Обновляем счётчик свободных мест.
    if (typeof updateTotalFreeCircle === 'function') {
        updateTotalFreeCircle();
    }
}
function updateParkingMarker(id, data) {
    if (!map || !data) return;
      const placemark = mapMarkers[id];
    if (!placemark) {
        addMarkerToMap(id, data);
        return;
    }
    const totalSpots = Number(data.totalSpots) || 0;
    const occupiedSpots = Math.max(
        0,
        Math.min(Number(data.occupiedSpots) || 0, totalSpots)
    );
    const freeSpots = Math.max(0, totalSpots - occupiedSpots);
    const color = getOccupancyColor(
        occupiedSpots,
        totalSpots
    );
    // Обновляем свойства маркера.
    placemark.properties.set({
        name: data.name || 'Парковка',
        hintContent: data.name || 'Парковка',
        freeSpots: freeSpots,
        totalSpots: totalSpots,
        occupiedSpots: occupiedSpots,
        parkingId: id,
        iconContent: String(freeSpots)
    });
    placemark.options.set('iconColor', color);
    // Обновляем координаты маркера.
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
        placemark.geometry.setCoordinates([lat, lng]);
    }
    // Обновляем полигон парковочной зоны.
    const oldPolygon = placemark.properties.get('polygon');
    const newCoords = Array.isArray(data.coordinates)
        ? data.coordinates
        : [];
    const hasValidPolygon = newCoords.length >= 3;
     let oldCoords = null;
    if (oldPolygon && oldPolygon.geometry) {
        const polygonCoordinates =
            oldPolygon.geometry.getCoordinates();
        oldCoords = Array.isArray(polygonCoordinates)
            ? polygonCoordinates[0]
            : null;
    }
    const coordinatesChanged =
        JSON.stringify(oldCoords) !== JSON.stringify(newCoords);
    // Удаляем старый полигон, если координаты изменились
    // или новые координаты отсутствуют.
    if (oldPolygon && (!hasValidPolygon || coordinatesChanged)) {
        map.geoObjects.remove(oldPolygon);
        placemark.properties.set('polygon', null);
    }
    // Создаём новый полигон или обновляем его стиль.
    if (hasValidPolygon) {
        let polygon = placemark.properties.get('polygon');
        if (!polygon) {
            polygon = new ymaps.Polygon(
                [data.coordinates],
                {},
                {
                    fillColor: color + '99',
                    strokeColor: color,
                    strokeWidth: 2,
                    strokeOpacity: 1,
                    fillOpacity: 0.6,
                    visible: false,
                    zIndex: 5
                }
            );
            polygon.__parkingId = id;
            map.geoObjects.add(polygon);
            placemark.properties.set('polygon', polygon);
        } else {
            polygon.options.set({
                fillColor: color + '33',
                strokeColor: color
            });
        }
    }
    // Обновляем кэш парковок.
    if (
        typeof parkingDataCache !== 'undefined' &&
        parkingDataCache[id]
    ) {
        parkingDataCache[id] = {
            ...parkingDataCache[id],
            ...data,
            id: id,
            totalSpots: totalSpots,
            occupiedSpots: occupiedSpots
        };
    }
    // Пересчитываем кластеры после обновления парковки.
    if (
        ENABLE_PARKING_CLUSTERS &&
        typeof refreshParkingClusters === 'function'
    ) {
        refreshParkingClusters();
    }
    // Обновляем общий счётчик свободных мест.
    if (typeof updateTotalFreeCircle === 'function') {
        updateTotalFreeCircle();
    }
}
function refreshParkingMarker(parkingId) {
    const id = parkingId || currentParkingId;
    if (!id) return;
    const data = parkingDataCache[id];
    if (!data) return;
    updateParkingMarker(id, data);
}
function refreshParkingClusters() {
    if (
        !map ||
        !ENABLE_PARKING_CLUSTERS ||
        !clusterer
    ) {
        return;
    }
    const markers = Object.values(mapMarkers).filter(Boolean);
    // Удаляем маркеры из текущих кластеров.
    clusterer.removeAll();
    // Добавляем актуальные маркеры повторно.
    if (markers.length > 0) {
        clusterer.add(markers);
    }
}
function clearAllMarkers() {
    if (clusterer) {
        clusterer.removeAll();
    }
    Object.keys(mapMarkers).forEach(function(id) {
        const placemark = mapMarkers[id];
        if (!placemark) return;
        const polygon = placemark.properties.get('polygon');
        if (polygon) {
            map.geoObjects.remove(polygon);
        }
        // При выключенных кластерах маркер находится прямо на карте.
        if (!clusterer) {
            map.geoObjects.remove(placemark);
        }
    });
    mapMarkers = {};
    if (activePolygon) {
        map.geoObjects.remove(activePolygon);
        activePolygon = null;
    }
    if (typeof updateTotalFreeCircle === 'function') {
        updateTotalFreeCircle();
    }
}
 function loadAllParkings(city = '', force = false) {
    const selectedCity = normalizeCity(
        String(city || currentCity || '').trim()
    );
    // Используем кеш, если он достаточно свежий.
    if (
        !force &&
        Date.now() - lastDataRefresh < 30000 &&
        Object.keys(parkingDataCache).length > 0
    ) {
        clearAllMarkers();
        Object.entries(parkingDataCache).forEach(([id, parking]) => {
            const parkingCity = normalizeCity(
                getParkingCity(parking) || ''
            );
            if (!selectedCity || parkingCity === selectedCity) {
                addMarkerToMap(id, parking);
            }
        });
        updateTotalFreeCircle();
        return Promise.resolve();
    }
        clearAllMarkers();
    return database.ref('parkings').once('value')
        .then(snapshot => {
            const newCache = parseParkingTree(snapshot.val());
            parkingDataCache = newCache;
            lastDataRefresh = Date.now();
            try {
                localStorage.setItem(
                    'parkingCache',
                    JSON.stringify({
                        city: 'all',
                        data: newCache,
                        timestamp: Date.now()
                    })
                );
            } catch (error) {
                console.warn('Не удалось сохранить кеш парковок:', error);
            }
            Object.entries(newCache).forEach(([id, parking]) => {
                const parkingCity = normalizeCity(
                    getParkingCity(parking) || ''
             );
                if (!selectedCity || parkingCity === selectedCity) {
                    addMarkerToMap(id, parking);
                }
            });
        updateTotalFreeCircle();
            console.log(
                'Загружено парковок:',
                Object.keys(newCache).length
            );
        })
        .catch(error => {
            console.error('Ошибка загрузки парковок:', error);
            throw error;
        });
}
  function showParkingsForCity(city) {
    if (!map || !city) return;
    clearAllMarkers();
    const normalizedCity = city.trim().toLowerCase();
    Object.entries(parkingDataCache).forEach(([id, parking]) => {
        const parkingCity = normalizeCity(getParkingCity(parking))
        if (parkingCity === normalizedCity) {
            addMarkerToMap(id, parking);
        }
    });
    updateTotalFreeCircle();
    console.log(`🏙️ Показаны парковки города "${city}":`, Object.values(parkingDataCache).filter(p => String(p.city || '').trim().toLowerCase() === normalizedCity).length);
}
  // ===== Вспомогательная функция для загрузки всех парковок (без фильтра) =====
function loadAllParkingsNoFilter() {
    return database.ref('parkings').once('value')
        .then(snapshot => {
            const newCache = parseParkingTree(snapshot.val());
            parkingDataCache = newCache;
            lastDataRefresh = Date.now();
            try {
                localStorage.setItem(
                    'parkingCache',
                    JSON.stringify({
                        city: 'all',
                        data: newCache,
                        timestamp: Date.now()
                    })
                );
            } catch (error) {
                console.warn('Не удалось сохранить кеш парковок:', error);
            }
            clearAllMarkers();
            Object.entries(newCache).forEach(([id, parking]) => {
                addMarkerToMap(id, parking);
            });
            if (typeof updateTotalFreeCircle === 'function') {
                updateTotalFreeCircle();
            }
            console.log(
                'Загружены все парковки без фильтра:',
                Object.keys(newCache).length
            );
        })
        .catch(error => {
            console.error('Ошибка загрузки всех парковок:', error);
            throw error;
        });
}
