
 // ===================== ИНИЦИАЛИЗАЦИЯ КАРТЫ =====================
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
        // 1. Создаём карту с начальным зумом 14
        map = new ymaps.Map("map", {
            center: [55.7558, 37.6173],
            zoom: 14,
            maxZoom: 19,
            controls: ['zoomControl'],
            type: 'yandex#map'
        });
        console.log('✅ Карта инициализирована');

        // ===== АВТОМАТИЧЕСКОЕ ОТОБРАЖЕНИЕ ПОЛИГОНОВ ПРИ ЗУМЕ >= 15 =====
        map.events.add('zoomchange', function() {

    const currentZoom = map.getZoom();

    const showPolygons = currentZoom >= 15;

    Object.keys(mapMarkers).forEach(function(id) {

        const placemark = mapMarkers[id];
        if (!placemark) return;
        const polygon =
            placemark.properties.get('polygon');
        if (!polygon) return;
        // Если парковка сейчас выбрана,
        // её зона остаётся видимой
        if (
            activePolygon === polygon &&
            currentZoom < 15
        ) {
            polygon.options.set(
                'visible',
                true
            );
            return;
        }
        polygon.options.set(
            'visible',
            showPolygons
        );
    });

});

        // ===== СОЗДАЁМ КЛАСТЕРИЗАТОР =====
        clusterer = new ymaps.Clusterer({
            gridSize: 128,
            minClusterSize: 2,
            maxZoom: 17,

            clusterIconLayout:
                ymaps.templateLayoutFactory.createClass(
                    '<div style="' +
                        'width:44px;' +
                        'height:44px;' +
                        'border-radius:50% 50% 50% 0;' +
                        'background:#2B7574;' +
                        'display:flex;' +
                        'align-items:center;' +
                        'justify-content:center;' +
                        'transform:rotate(-45deg);' +
                        'box-shadow:0 2px 8px rgba(0,0,0,0.3);' +
                    '">' +
                        '{{ content }}' +
                    '</div>'
                ),

            clusterIconContentLayout:
                ymaps.templateLayoutFactory.createClass(
                    '<div style="' +
                        'color:#fff;' +
                        'font-weight:700;' +
                        'font-size:15px;' +
                        'line-height:44px;' +
                        'width:44px;' +
                        'height:44px;' +
                        'text-align:center;' +
                        'transform:rotate(45deg);' +
                    '">' +
                        '{{ properties.freeSpots || "0" }}' +
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
                            '" onclick="' +
                                'openCenterSheet(' +
                                '\'{{ geoObject.properties.parkingId }}\',' +
                                'window.parkingDataCache[' +
                                '\'{{ geoObject.properties.parkingId }}\'' +
                                '])' +
                            '">' +

                                '<div style="font-weight:600;">' +
                                    '{{ geoObject.properties.name }}' +
                                '</div>' +

                                '<div style="font-size:12px;color:var(--text-secondary);">' +
                                    '🅿️ Свободно: ' +
                                    '{{ geoObject.properties.freeSpots }}' +
                                    ' / ' +
                                    '{{ geoObject.properties.totalSpots }}' +
                                '</div>' +

                            '</div>' +

                        '{% endfor %}' +

                    '</div>'
                )
        });

        // ===== ОБРАБОТЧИК КЛАСТЕРИЗАЦИИ – суммируем места =====
        clusterer.events.add(
            'clusterize',
            function(e) {
                const clusters = e.get('clusters');
                if (!clusters) return;
                clusters.forEach(function(cluster) {
                    const geoObjects = cluster.getGeoObjects();
                    let totalSpots = 0;
                    let freeSpots = 0;
                    let parkingCount = 0;
                    geoObjects.forEach(function(placemark) {
                        const total = Number(placemark.properties.get('totalSpots')) || 0;
                        const free = Number(placemark.properties.get('freeSpots')) || 0;
                        totalSpots += total;
                        freeSpots += free;
                        parkingCount++;
                    });
                    cluster.properties.set('totalSpots', totalSpots);
                    cluster.properties.set('freeSpots', freeSpots);
                    cluster.properties.set('parkingCount', parkingCount);
                });
            }
        );

        // ===== ДОБАВЛЯЕМ КЛАСТЕРИЗАТОР НА КАРТУ =====
        map.geoObjects.add(clusterer);

        // ===== Обработчик клика на кластер (приближение) =====
        clusterer.events.add('click', function(e) {
            var cluster = e.get('target');
            var coords = cluster.geometry.getCoordinates();
            map.setCenter(coords, 16, { duration: 300, checkZoomRange: true });
        });

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
                splash.style.opacity = '0';
                setTimeout(function() { splash.remove(); }, 300);
            }
        }, 5000);

    } catch (e) {

    console.error(
        '❌ Ошибка инициализации ParkNear:',
        e
    );

    // Если карта уже создана —
    // НЕ уничтожаем её и НЕ показываем
    // сообщение "не удалось загрузить карту"
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
    // ===================== СЛОИ КАРТЫ =====================
    function toggleLayerMenu() { document.getElementById('layerMenu').classList.toggle('active'); }

    function setMapType(option) {
        if (!map) return;
        map.setType(option.dataset.type);
        document.querySelectorAll('.layer-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        document.getElementById('layerMenu').classList.remove('active');
        updateMapTheme();
    }
