const ENABLE_PARKING_CLUSTERS = true;
// Защита от повторных одновременных запросов парковок
let parkingsLoadPromise = null;
function showMapInitError(message) {
    const container = document.getElementById('map');
    if (!container) return;
       let error = document.getElementById('parkNearMapError');
    if (!error) {
        error = document.createElement('div');
        error.id = 'parkNearMapError';
        error.style.cssText = 'position:absolute;top:12px;left:12px;right:12px;z-index:1000;padding:12px;background:#b91c1c;color:white;border-radius:10px;text-align:center;font-size:13px;';
        container.appendChild(error);
    }
    error.textContent = message;
}
function clearMapInitError() {
    const error = document.getElementById('parkNearMapError');
    if (error) error.remove();
}
function refreshParkingOccupancyStatuses() {
    if (!map || !mapMarkers || !parkingDataCache) return;
    let hasMarkers = false;
    Object.keys(mapMarkers).forEach(function(id) {
        const placemark = mapMarkers[id];
        const parking = parkingDataCache[id];
        if (!placemark || !parking) return;
        const occupancy = getParkingMarkerOccupancy(parking);
        const markerContent =
            occupancy.status === 'unknown' ||
            occupancy.status === 'stale'
                ? '–'
                : String(occupancy.freeSpots);
        placemark.properties.set({
            freeSpots: occupancy.freeSpots,
            totalSpots: occupancy.totalSpots,
            occupiedSpots: occupancy.occupiedSpots,
            occupancyStatus: occupancy.status,
            iconContent: markerContent
        });
        placemark.options.set('iconColor', occupancy.color);
        // Обновляем цвет полигона, если он существует.
        const polygon = placemark.properties.get('polygon');
        if (polygon) {
            polygon.options.set({
                fillColor: occupancy.color + '33',
                strokeColor: occupancy.color
            });
        }
        hasMarkers = true;
    });
    // Пересчитываем цвета и показатели кластеров один раз.
    if (hasMarkers && typeof refreshParkingClusters === 'function') {
        refreshParkingClusters();
    }
}
function startParkingOccupancyRefresh() {
    if (window.parkNearOccupancyRefreshTimer) {
        clearInterval(window.parkNearOccupancyRefreshTimer);
    }
    // Обновляем статусы каждую минуту.
    window.parkNearOccupancyRefreshTimer = setInterval(function() {
        refreshParkingOccupancyStatuses();
    }, 60 * 1000);
    // При возвращении в приложение сразу пересчитываем статусы.
    if (!window.parkNearOccupancyVisibilityHandler) {
        window.parkNearOccupancyVisibilityHandler = true;
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) {
                refreshParkingOccupancyStatuses();
            }
        });
    }
}
function initMap() {
    console.log('▶️ initMap вызвана');
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('❌ Элемент #map не найден в DOM');
        return;
    }
    if (typeof map !== 'undefined' && map) {
        console.log('Карта уже создана — повторная инициализация пропущена');
        return;
    }
    // =====================================================
    // ПРОВЕРКА ЗАГРУЗКИ ЯНДЕКС.КАРТ
    // =====================================================
   if (typeof ymaps === 'undefined') {
    console.error('❌ API Яндекс.Карт ещё не загружен');
    showMapInitError('API Яндекс.Карт не загружен. Проверьте подключение к интернету.');
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

/* ===== СИНХРОНИЗАЦИЯ РАЗМЕРА ЯНДЕКС.КАРТЫ ===== */
function resizeParkNearMap() {
    if (!map || !map.container) return;

    requestAnimationFrame(() => {
        try {
            map.container.fitToViewport();
        } catch (error) {
            console.warn(
                'Park Near: ошибка пересчёта карты',
                error
            );
        }
    });
}
// После первичной отрисовки
setTimeout(resizeParkNearMap, 100);
setTimeout(resizeParkNearMap, 500);
setTimeout(resizeParkNearMap, 1000);
/* ===== ОБРАБОТКА ИЗМЕНЕНИЯ РАЗМЕРОВ КАРТЫ ===== */

// Резервное обновление при изменении окна.
window.addEventListener('resize', resizeParkNearMap, {
    passive: true
});
window.addEventListener('orientationchange', function () {
    setTimeout(resizeParkNearMap, 150);
}, {
    passive: true
});
// Отслеживание динамической видимой области браузера.
if (window.visualViewport) {
    window.visualViewport.addEventListener(
        'resize',
        resizeParkNearMap,
        { passive: true }
    );
}
// Основной механизм контроля фактического размера контейнера карты.
if (window.ResizeObserver) {
    const mapResizeObserver = new window.ResizeObserver(function () {
        resizeParkNearMap();
    });
    mapResizeObserver.observe(mapContainer);
}
// После возвращения приложения на экран
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        setTimeout(resizeParkNearMap, 100);
    }
});
clearMapInitError();
// Убираем сообщение об ошибке после успешного запуска карты.
if (typeof window.clearParkNearInitError === 'function') {
    window.clearParkNearInitError();
}
// Автоматическое определение местоположения при запуске приложения
setTimeout(() => {
    if (typeof getUserLocation !== 'function') {
        console.error('Функция getUserLocation не найдена');
        return;
    }
    getUserLocation()
        .then(coords => {
            if (!map) return;

            if (myLocationPlacemark) {
                map.geoObjects.remove(myLocationPlacemark);
            }
            myLocationPlacemark = new ymaps.Placemark(
                [coords.lat, coords.lng],
                {
                    hintContent: 'Вы здесь'
                },
                {
                    preset: 'islands#blueCircleDotIcon'
                }
            );
            map.geoObjects.add(myLocationPlacemark);
            map.setCenter(
                [coords.lat, coords.lng],
                16,
                { duration: 500 }
            );
        })
        .catch(error => {
            console.warn('Не удалось определить геолокацию:', error);
        });
}, 500);
        // ===== АВТОМАТИЧЕСКОЕ ОТОБРАЖЕНИЕ ПОЛИГОНОВ ПРИ ЗУМЕ >= 18 =====
map.events.add('zoomchange', function() {
    if (!map) return;
     Object.keys(mapMarkers).forEach(function(id) {
        const placemark = mapMarkers[id];
    if (!placemark) return;
        const polygon = placemark.properties.get('polygon');
     if (!polygon) return;
        // Показываем только полигон выбранной парковки.
        const isActive = activePolygon === polygon;
        polygon.options.set('visible', isActive);
    });
});
        // ===== СОЗДАЁМ КЛАСТЕРИЗАТОР =====
        if (ENABLE_PARKING_CLUSTERS) {
            clusterer = new ymaps.Clusterer({
                gridSize: 120,
                minClusterSize: 2,
                maxZoom: 19,
                clusterDisableClickZoom: false,
                clusterOpenBalloonOnClick: false,
                
                // Кластер показывает суммарное количество свободных мест
                clusterIconLayout: ymaps.templateLayoutFactory.createClass(
    '<div style="' +
        'width:42px;' +
        'height:42px;' +
        'box-sizing:border-box;' +
        'border-radius:50%;' +
        'background-color:#1877E8;' +
        'border:3px solid #FFFFFF;' +
        'display:flex;' +
        'align-items:center;' +
        'justify-content:center;' +
        'color:#FFFFFF;' +
        'font-family:Arial,sans-serif;' +
        'font-size:18px;' +
        'font-weight:800;' +
        'line-height:1;' +
        'text-align:center;' +
        'opacity:1;' +
        'box-shadow:0 3px 10px rgba(0,0,0,0.55);' +
        'text-shadow:0 1px 2px rgba(0,0,0,0.35);' +
    '">' +
        '$[properties.parkingCount]' +
    '</div>'
),
                clusterIconShape: {
                    type: 'Circle',
                    coordinates: [0, 0],
                    radius: 32
                },

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
        let validParkingCount = 0;
        geoObjects.forEach(function(placemark) {
            const status = placemark.properties.get(
                'occupancyStatus'
            );
            // Не учитываем парковки без актуальных данных.
            if (
                !['free', 'limited', 'occupied'].includes(status)
            ) {
                return;
            }
            const total = Math.max(
                0,
                Number(
                    placemark.properties.get('totalSpots')
                ) || 0
            );
            const free = Math.max(
                0,
                Number(
                    placemark.properties.get('freeSpots')
                ) || 0
            );
            if (total <= 0) return;
            totalSpots += total;
            freeSpots += Math.min(free, total);
            validParkingCount++;
        });
        const unknownParkingCount =
            geoObjects.length - validParkingCount;

        cluster.properties.set('totalSpots', totalSpots);
        cluster.properties.set('freeSpots', freeSpots);
        cluster.properties.set('parkingCount', geoObjects.length);
        cluster.properties.set(
            'validParkingCount',
            validParkingCount
        );
        cluster.properties.set(
            'unknownParkingCount',
            unknownParkingCount
        );
// Цвет и размер зависят от количества парковок.
const parkingCount = geoObjects.length;
let clusterColor;
let clusterColorDark;
let clusterGlow;
let clusterSize;

if (parkingCount < 10) {
    clusterColor = '#20C982';
    clusterColorDark = '#087F59';
    clusterGlow = 'rgba(32,201,130,0.30)';
    clusterSize = 38;
} else if (parkingCount < 30) {
    clusterColor = '#F5CE45';
    clusterColorDark = '#C18B16';
    clusterGlow = 'rgba(245,206,69,0.30)';
    clusterSize = 42;
} else if (parkingCount < 50) {
    clusterColor = '#FF923D';
    clusterColorDark = '#DB541F';
    clusterGlow = 'rgba(255,146,61,0.30)';
    clusterSize = 46;
} else {
    clusterColor = '#A879FF';
    clusterColorDark = '#6941C6';
    clusterGlow = 'rgba(168,121,255,0.35)';
    clusterSize = 52;
}
cluster.properties.set('parkingCount', parkingCount);
cluster.properties.set('clusterColor', clusterColor);
cluster.properties.set('clusterColorDark', clusterColorDark);
cluster.properties.set('clusterGlow', clusterGlow);
cluster.properties.set('clusterSize', clusterSize);
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
       
 // ===== Обработчик кнопки добавления парковки =====
const addBtn = document.getElementById('addBtn');
if (addBtn) {
    addBtn.onclick = function() {
        if (!currentUser) {
            showPanel('home');
            return;
        }
        if (isDrawingMode) {
            cancelDrawing();
            return;
        }
        if (typeof window.startDrawingMode === 'function') {
            window.startDrawingMode();
        } else {
            console.error(
                'startDrawingMode не найдена. Проверь parking-creator.js'
            );
            if (typeof showToast === 'function') {
                showToast('Не удалось включить режим рисования');
            }
        }
    };
}
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
                })
                .catch(function(err) {
                    btn.innerHTML = originalContent;
                    btn.disabled = false;
                    console.error('Ошибка геолокации:', err);
                    let message = 'Не удалось определить ваше местоположение.';
                    if (err.message) message += ' ' + err.message;
                    alert(message);
                });
        };
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
                    showToast(
                        'Нажмите кнопку местоположения, чтобы определить ваше местоположение',
                        4000
                        );
                });
        }, 1000);
// ============================================
// ЗАГРУЗКА ПАРКОВОК ПОСЛЕ ПОЛНОЙ ИНИЦИАЛИЗАЦИИ КАРТЫ
// ============================================
console.log('Загружаем парковки после инициализации карты');
loadAllParkings(
    currentCity || '',
    false
).then(() => {
    console.log(
        'Парковки обработаны:',
        Object.keys(parkingDataCache).length
    );
    console.log(
        'Создано маркеров:',
        Object.keys(mapMarkers).length
    );
}).catch(error => {
    console.error(
        'Не удалось загрузить парковки:',
        error
    );
});
// Запускаем автоматическое обновление статусов парковок.
startParkingOccupancyRefresh();
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
    console.error('❌ Ошибка инициализации ParkNear:', e);
    if (map) {
        console.error('Карта создана, но произошла ошибка при настройке.');
        return;
    }
    showMapInitError('Не удалось инициализировать карту. Проверьте подключение к интернету.');
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
function getParkingMarkerOccupancy(data) {
    const result = typeof window.getParkingOccupancyStatus === 'function'
        ? window.getParkingOccupancyStatus(data)
        : {
            status: 'unknown',
            totalSpots: 0,
            occupiedSpots: 0,
            freeSpots: 0
        };
    const colors = {
        free: '--green',
        limited: '--orange',
        occupied: '--red',
        unknown: '--gray',
        stale: '--gray'
    };
    const variable = colors[result.status] || '--gray';
    const color = getComputedStyle(document.body)
        .getPropertyValue(variable)
        .trim() || '#8E8E93';
    return {
        ...result,
        color
    };
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
    // Получаем занятость по общей логике приложения.
      const occupancy = getParkingMarkerOccupancy(data);
      const totalSpots = occupancy.totalSpots;
      const occupiedSpots = occupancy.occupiedSpots;
      const freeSpots = occupancy.freeSpots;
      const status = occupancy.status;
      const color = occupancy.color;

      const markerContent =
        status === 'unknown' || status === 'stale'
        ? '–'
        : String(freeSpots);
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
               zIndex: 5,
               interactivityModel: 'default#transparent',
               openBalloonOnClick: false,
               openHintOnHover: false
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
             occupancyStatus: status,
             parkingId: id,
             polygon: polygon,
             iconContent: markerContent
        },
          {
             preset: 'islands#blueCircleIcon',
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
    const occupancy = getParkingMarkerOccupancy(data);
    const totalSpots = occupancy.totalSpots;
    const occupiedSpots = occupancy.occupiedSpots;
    const freeSpots = occupancy.freeSpots;
    const status = occupancy.status;
    const color = occupancy.color;

    const markerContent =
        status === 'unknown' || status === 'stale'
          ? '–'
          : String(freeSpots);
    // Обновляем свойства маркера.
    placemark.properties.set({
        name: data.name || 'Парковка',
        hintContent: data.name || 'Парковка',
        freeSpots: freeSpots,
        totalSpots: totalSpots,
        occupiedSpots: occupiedSpots,
        occupancyStatus: status,
        parkingId: id,
        iconContent: markerContent
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
                     zIndex: 5,
                     interactivityModel: 'default#transparent',
                     openBalloonOnClick: false,
                     openHintOnHover: false
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
    const selectedCity = String(
        city || currentCity || ''
    ).trim();
    function renderMarkers(data) {
        // Если карта ещё не готова, сохраняем данные.
        // Маркеры будут добавлены после повторного вызова функции.
        if (!map) {
            console.warn(
                'Карта ещё не инициализирована. Данные сохранены в кэше.'
            );
            return false;
        }
        clearAllMarkers();
        const entries = Object.entries(data || {});
        const matching = selectedCity
    ? entries.filter(([, parking]) => {
        return normalizeCity(getParkingCity(parking)) === normalizeCity(selectedCity);
    })
    : entries;
        const visibleEntries = matching;
        if (selectedCity && matching.length === 0) {
           console.warn('Для выбранного города парковки не найдены:', {
        selectedCity,
        parkingCities: [...new Set(entries.map(([, parking]) => parking.city).filter(Boolean))]
    });
}
let markerCount = 0;
        visibleEntries.forEach(([id, parking]) => {
            try {
                addMarkerToMap(id, parking);
                markerCount++;
            } catch (error) {
                console.error(
                    'Ошибка создания маркера:',
                    id,
                    error
                );
            }
        });
        updateTotalFreeCircle();
        console.log('Отображение парковок:', {
            total: entries.length,
            visible: visibleEntries.length,
            markers: markerCount,
            city: selectedCity || 'все города'
        });
        return true;
    }
    // Если загрузка уже выполняется, используем тот же запрос.
if (parkingsLoadPromise) {
    return parkingsLoadPromise.then(() => {
        renderMarkers(parkingDataCache);
        return true;
    });
}
    // Используем кэш, если он актуален.
    if (
        !force &&
        Date.now() - lastDataRefresh < 30000 &&
        Object.keys(parkingDataCache).length > 0
    ) {
        renderMarkers(parkingDataCache);
        return Promise.resolve(true);
    }
    if (!window.PARKNEAR_API_URL) {
        return Promise.reject(
            new Error('Не задан адрес API Park Near')
        );
    }
    const url = new URL(
        '/api/parkings',
        window.PARKNEAR_API_URL
    );
    const requestPromise = (async () => {
    const newCache = {};
    const pageSize = 500;
    let offset = 0;
    let total = null;
    while (total === null || offset < total) {
        const url = new URL('/api/parkings', window.PARKNEAR_API_URL);
        url.searchParams.set('limit', String(pageSize));
        url.searchParams.set('offset', String(offset));
        const response = await fetch(url.toString(), {
            method: 'GET',
            cache: 'no-store',
            headers: {
                'Accept': 'application/json'
            }
        });
        const responseText = await response.text();
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (error) {
            throw new Error(
                `Некорректный ответ сервера HTTP ${response.status}: ` +
                responseText.slice(0, 300)
            );
        }
        if (!response.ok) {
            throw new Error(
                result.error || `Ошибка сервера: ${response.status}`
            );
        }
        if (
            !result.success ||
            !Array.isArray(result.parkings) ||
            !Number.isSafeInteger(Number(result.total)) ||
            Number(result.total) < 0
        ) {
            throw new Error('Сервер вернул некорректный список парковок');
        }
        if (total === null) {
            total = Number(result.total);
        }
        if (result.parkings.length === 0 && offset < total) {
            throw new Error('Сервер вернул пустую страницу парковок');
        }
        result.parkings.forEach(node => {
            if (!node) return;
            const id = String(node.id || '');
            if (!id) return;
            const lat = Number(node.lat);
            const lng = Number(node.lng);
            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lng) ||
                Math.abs(lat) > 90 ||
                Math.abs(lng) > 180
            ) {
                console.warn('Некорректные координаты парковки:', id, node);
                return;
            }
            const totalSpots = Math.max(0, Number(node.totalSpots) || 0);
            const occupiedSpots = Math.min(
                totalSpots,
                Math.max(0, Number(node.occupiedSpots) || 0)
            );
            newCache[id] = {
                ...node,
                id,
                lat,
                lng,
                totalSpots,
                occupiedSpots,
                _dbPath: null
            };
        });
        offset += result.parkings.length;
    }
    // Сохраняем данные только после загрузки всех страниц.
    parkingDataCache = newCache;
    lastDataRefresh = Date.now();
    window.isOfflineMode = false;
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
        console.warn('Не удалось сохранить кэш парковок:', error);
    }
    if (window.ParkNearOffline) {
        window.ParkNearOffline.saveParkings(newCache)
            .then(() => {
                console.log(
                    'Парковки сохранены в IndexedDB:',
                    Object.keys(newCache).length
                );
            })
            .catch(error => {
                console.warn('Ошибка сохранения парковок в IndexedDB:', error);
            });
    }
    renderMarkers(newCache);
    console.log(
        'Парковки загружены из PostgreSQL:',
        Object.keys(newCache).length
    );
    return true;
})()
.catch(async error => {
    console.warn('Не удалось загрузить парковки из PostgreSQL:', error);
    const browserReportsOffline =
        typeof navigator !== 'undefined' &&
        navigator.onLine === false;
    if (!browserReportsOffline) {
        window.isOfflineMode = false;
        throw error;
    }
    window.isOfflineMode = true;
    try {
        let cachedParkings = {};
        // Сначала пробуем восстановить парковки из IndexedDB.
        if (window.ParkNearOffline) {
            cachedParkings = await window.ParkNearOffline.getParkings();
        }
        // Если IndexedDB пуста, используем localStorage.
        if (!Object.keys(cachedParkings).length) {
            const savedCache = localStorage.getItem('parkingCache');
            if (savedCache) {
                const parsedCache = JSON.parse(savedCache);
                cachedParkings = parsedCache.data || {};
                lastDataRefresh = Number(parsedCache.timestamp) || 0;
            }
        }
        if (!Object.keys(cachedParkings).length) {
            throw new Error('Сохранённые парковки не найдены');
        }
        parkingDataCache = cachedParkings;
        renderMarkers(cachedParkings);
        console.log(
            'Офлайн-режим: восстановлено парковок:',
            Object.keys(cachedParkings).length
        );
        if (typeof showToast === 'function') {
            showToast('Нет интернета. Показаны сохранённые парковки.');
        }
        return true;
    } catch (cacheError) {
        console.warn('Не удалось восстановить парковки:', cacheError);
        throw error;
    }
});
    parkingsLoadPromise = requestPromise.finally(() => {
        parkingsLoadPromise = null;
    });
    return parkingsLoadPromise;
}
function showParkingsForCity(city) {
    if (!map || !city) return;
    clearAllMarkers();
    const normalizedCity = normalizeCity(city);
    let markerCount = 0;
    Object.entries(parkingDataCache).forEach(([id, parking]) => {
        if (normalizeCity(getParkingCity(parking)) === normalizedCity) {
            addMarkerToMap(id, parking);
            markerCount++;
        }
    });
    updateTotalFreeCircle();
    console.log('Показаны парковки выбранного города:', {
        city,
        markers: markerCount
    });
}
 function loadAllParkingsNoFilter() {
    return loadAllParkings('', true);
}
// Делаем загрузчик парковок доступным для app.js.
window.loadAllParkings = loadAllParkings;
window.loadAllParkingsNoFilter = loadAllParkingsNoFilter;
