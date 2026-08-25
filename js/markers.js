function updateParkingMarker(id, data) {
    if (!map || !clusterer) return;

    const placemark = mapMarkers[id];
    if (!placemark) {
        addMarkerToMap(id, data);
        return;
    }

    const totalSpots = Number(data.totalSpots) || 0;
    const occupiedSpots = Number(data.occupiedSpots) || 0;
    const freeSpots = Math.max(0, totalSpots - occupiedSpots);
    const color = getOccupancyColor(occupiedSpots, totalSpots);

    // Обновляем свойства маркера
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

    // ✅ Обновляем Polygon только если изменились координаты
    const oldPolygon = placemark.properties.get('polygon');
    const newCoords = data.coordinates;

    // Функция для сравнения двух массивов координат (примитивная, но работает)
    function coordsChanged(oldCoord, newCoord) {
        if (!oldCoord || !newCoord) return true;
        if (oldCoord.length !== newCoord.length) return true;
        for (let i = 0; i < oldCoord.length; i++) {
            if (oldCoord[i][0] !== newCoord[i][0] || oldCoord[i][1] !== newCoord[i][1]) {
                return true;
            }
        }
        return false;
    }

    if (newCoords && Array.isArray(newCoords) && newCoords.length >= 3) {
        if (!oldPolygon || coordsChanged(oldPolygon.geometry.getCoordinates()[0], newCoords)) {
            // Удаляем старый полигон
            if (oldPolygon) map.geoObjects.remove(oldPolygon);
            // Создаём новый
            const newPolygon = new ymaps.Polygon([newCoords], {}, {
    fillColor: color + '33',
    strokeColor: color,
    strokeWidth: 2,
    visible: map ? map.getZoom() >= 15 : false,
    zIndex: 5
});
            map.geoObjects.add(newPolygon);
            placemark.properties.set('polygon', newPolygon);
            newPolygon.__parkingId = id;
        } else {
            // Координаты не изменились – просто обновляем цвет
            oldPolygon.options.set({
                fillColor: color + '33',
                strokeColor: color
            });
        }
    } else {
        // Зоны больше нет
        if (oldPolygon) {
            map.geoObjects.remove(oldPolygon);
            placemark.properties.set('polygon', null);
        }
    }

    // Обновляем общий счётчик
    if (typeof updateTotalFreeCircle === 'function') {
        updateTotalFreeCircle();
    }
}
function refreshParkingMarker(parkingId) {

    const id =
        parkingId || currentParkingId;

    if (!id) {
        return;
    }

    const data =
        parkingDataCache[id];

    if (!data) {
        return;
    }

    updateParkingMarker(
        id,
        data
    );

    // Обновляем общий счётчик
    if (
        typeof updateTotalFreeCircle ===
        'function'
    ) {
        updateTotalFreeCircle();
    }
}
function addMarkerToMap(id, data) {
    if (!map || !clusterer) {
        return;
    }
    // ============================================
    // Если маркер уже существует — сначала
    // полностью удаляем старый
    // ============================================
    if (mapMarkers[id]) {
        const oldPlacemark =
            mapMarkers[id];
        const oldPolygon =
            oldPlacemark.properties.get(
                'polygon'
            );
        // Удаляем маркер из кластера
        clusterer.remove(
            oldPlacemark
        );
        // Удаляем полигон
        if (oldPolygon) {
            map.geoObjects.remove(
                oldPolygon
            );
        }
        delete mapMarkers[id];
    }
    // ============================================
    // Нормализуем данные
    // ============================================
    const totalSpots =
        Number(data.totalSpots) || 0;
    const occupiedSpots =
        Number(data.occupiedSpots) || 0;
    const freeSpots = Math.max(
        0,
        totalSpots - occupiedSpots
    );
    const color =
        getOccupancyColor(
            occupiedSpots,
            totalSpots
        );
    // ============================================
    // Определяем центр парковочной зоны
    // ============================================
    let centerLat =
        Number(data.lat);
    let centerLng =
        Number(data.lng);
    if (
        Array.isArray(data.coordinates) &&
        data.coordinates.length > 0
    ) {
        let latSum = 0;
        let lngSum = 0;
        let validPoints = 0;
        data.coordinates.forEach(
            function(point) {
                if (
                    Array.isArray(point) &&
                    point.length >= 2 &&
                    Number.isFinite(
                        Number(point[0])
                    ) &&
                    Number.isFinite(
                        Number(point[1])
                    )
                ) {
                    latSum +=
                        Number(point[0]);
                    lngSum +=
                        Number(point[1]);
                    validPoints++;
                }
            }
        );
        if (validPoints > 0) {
            centerLat =
                latSum / validPoints;
            centerLng =
                lngSum / validPoints;
        }
    }
    // ============================================
    // Создаём полигон
    // ============================================
    let polygon = null;
    if (
        Array.isArray(data.coordinates) &&
        data.coordinates.length >= 3
    ) {
        polygon =
            new ymaps.Polygon(
                [data.coordinates],
                {},
                {
                    fillColor:color + '33',
                    strokeColor:color,
                    strokeWidth: 2,
                    visible: map ? map.getZoom() >= 15 : false,
                    zIndex: 5
                }
            );
        map.geoObjects.add(
            polygon
        );
        // Чтобы можно было определить,
        // к какой парковке относится полигон
        polygon.__parkingId = id;
    }
    // ============================================
    // Создаём маркер
    // ============================================

    const placemark =
        new ymaps.Placemark(
            [
                centerLat,
                centerLng
            ],
            {
                hintContent:
                    data.name ||
                    'Парковка',

                name:
                    data.name ||
                    'Парковка',

                freeSpots:
                    freeSpots,

                totalSpots:
                    totalSpots,

                occupiedSpots:
                    occupiedSpots,

                parkingId:
                    id,   
                polygon:
                    polygon
            },
            {
                preset:
                    'islands#blueIcon',
                iconColor:
                    color,
            }
        );
    // ============================================
    // Клик по парковке
    // ============================================
   placemark.events.add('click', function() {
    // ===== ПРИБЛИЖАЕМ КАРТУ =====
    if (map) {
        map.setCenter([centerLat, centerLng], 18, { duration: 300, checkZoomRange: true });
    }
    // Скрываем предыдущий полигон
    if (activePolygon) {
        activePolygon.options.set('visible', false);
        activePolygon = null;
    }
    const poly = placemark.properties.get('polygon');
    if (poly) {
        poly.options.set('visible', true);
        activePolygon = poly;
    }
    openCenterSheet(id, data);
    if (map.balloon) map.balloon.close();
});
    // ============================================
    // Добавляем в кластер
    // ============================================
    clusterer.add(
        placemark
    );
    // ============================================
    // Сохраняем ссылку
    // ============================================
    mapMarkers[id] =
        placemark;
    // ============================================
    // Обновляем общий счётчик
    // ============================================
    if (
        typeof updateTotalFreeCircle ===
        'function'
    ) {
        updateTotalFreeCircle();
    }
}
function clearAllMarkers() {
    // Удаляем все маркеры из кластера
    if (clusterer) {
        clusterer.removeAll();
    }
    // Удаляем полигоны, привязанные к маркерам
    Object.keys(mapMarkers).forEach(function(id) {
        const placemark = mapMarkers[id];
        const polygon = placemark.properties.get('polygon');
        if (polygon) {
            map.geoObjects.remove(polygon);
        }
    });
    // Очищаем объект mapMarkers
    mapMarkers = {};
    // Удаляем активный полигон (если есть)
    if (activePolygon) {
        map.geoObjects.remove(activePolygon);
        activePolygon = null;
    }
    // Обновляем счётчик свободных мест (обнуляем)
    if (typeof updateTotalFreeCircle === 'function') {
        updateTotalFreeCircle();
    }
}
