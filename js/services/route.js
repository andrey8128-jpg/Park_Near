   // ===================== МАРШРУТ =====================
    function buildRouteToParking(parkingId) {
        closeCenterSheet();
        const data = parkingDataCache[parkingId];
        if (!data || typeof data.lat !== 'number' || typeof data.lng !== 'number') {
            alert('Ошибка: данные парковки не содержат координат');
            return;
        }
        getUserLocation()
            .then(coords => {
                routeStartCoords = [coords.lat, coords.lng];
                routeEndCoords = [data.lat, data.lng];
                routeParkingData = data;
                buildAndShowRoute();
            })
            .catch(err => {
                console.warn('Не удалось получить геолокацию, используем центр карты:', err);
                const center = map.getCenter();
                routeStartCoords = center;
                routeEndCoords = [data.lat, data.lng];
                routeParkingData = data;
                buildAndShowRoute();
            });
    }
    function buildAndShowRoute() {
        if (currentRoute) {
            map.geoObjects.remove(currentRoute);
            currentRoute = null;
        }
        if (!routeStartCoords || !routeEndCoords) {
            alert('Не удалось определить точки маршрута');
            return;
        }
        const mode = document.getElementById('routeTypeSelect')?.value || 'auto';
        try {
            // Создаем маршрут Яндекс.Карт
            currentRoute = new ymaps.multiRouter.MultiRoute({
                referencePoints: [routeStartCoords, routeEndCoords],
                params: {
                    routingMode: mode === 'walking' ? 'pedestrian' : 'auto',
                    avoidTrafficJams: true
                }
            }, {
                boundsAutoApply: true,
                wayPointVisible: true
            });
            // Подписываемся на успешное построение маршрута
            currentRoute.model.events.add('requestsuccess', function () {
                const activeRoute = currentRoute.getActiveRoute();
                if (activeRoute) {
                    const distance = activeRoute.properties.get("distance").text;
                    const duration = activeRoute.properties.get("duration").text;
                    const infoEl = document.getElementById('routeInfo');
                    if (infoEl) {
                        infoEl.innerHTML = `
                            <div class="route-summary">
                                📍 До объекта: <strong>${distance}</strong> (${duration})
                            </div>
                        `;
                    }
                }
            });
            // Обработка ошибки построения
            currentRoute.model.events.add('requestfail', function (event) {
                console.error('Ошибка построения маршрута:', event.get('error'));
                const infoEl = document.getElementById('routeInfo');
                if (infoEl) {
                    infoEl.innerHTML = '<div class="route-error">Не удалось проложить маршрут.</div>';
                }
            });
            map.geoObjects.add(currentRoute);
            // Показываем плашку маршрута, если она есть в DOM
            const routePanel = document.getElementById('routePanel');
            if (routePanel) routePanel.classList.add('active');

        } catch (e) {
            console.error('Ошибка при вызове MultiRoute:', e);
            alert('Не удалось построить маршрут');
        }
    }
    function updateRouteInfoFromMultiRoute(route) {
        route.model.events.add('update', function() {
            var activeRoute = route.getActiveRoute();
            if (!activeRoute) return;
            var distance = activeRoute.getLength();
            var time = activeRoute.getTime();
            var distKm = (distance / 1000).toFixed(1);
            var timeMin = Math.round(time / 60);
            var instructions = activeRoute.getWayPoints();
            var stepsHtml = '';
            instructions.forEach(function(item, index) {
                if (index > 0 && index < 10) {
                    stepsHtml +=
                        `<div style="font-size:12px; color:var(--text-secondary);">${item.getName()}</div>`;
                }
            });
            var free = routeParkingData.totalSpots - routeParkingData.occupiedSpots;
            document.getElementById('routeInfo').innerHTML = `
            <div style="margin-bottom:8px;">
                <div style="font-weight:600; font-size:18px;">🚗 До парковки</div>
                <div>📏 Расстояние: <b>${distKm}</b> км</div>
                <div>⏱ Время в пути: <b>${timeMin}</b> мин</div>
                <div>🅿️ Свободных мест: <b>${free}</b> / ${routeParkingData.totalSpots}</div>
                <div style="font-size:12px; color:var(--text-secondary);">Обновлено: ${formatDateTime(routeParkingData.timestamp)}</div>
            </div>
            <div style="margin-top:8px; border-top:0.5px solid var(--border-color); padding-top:8px; max-height:120px; overflow-y:auto;">
                <div style="font-size:13px; font-weight:500;">📋 Основные точки маршрута:</div>
                ${stepsHtml || '<div style="font-size:12px; color:var(--text-secondary);">Инструкции не доступны</div>'}
            </div>
        `;
        });
    }
    function showDirectLine() {
        if (!routeStartCoords || !routeEndCoords) return;
        if (currentRoute) {
            map.geoObjects.remove(currentRoute);
            currentRoute = null;
        }
        const line = new ymaps.Polyline([routeStartCoords, routeEndCoords], {}, {
            strokeColor: '#2B7574',
            strokeWidth: 4,
            strokeOpacity: 0.8
        });
        map.geoObjects.add(line);
        currentRoute = line;
        const dist = getDistanceInMeters(
            routeStartCoords[0], routeStartCoords[1],
            routeEndCoords[0], routeEndCoords[1]
        ) / 1000;
        const time = Math.round(dist * 2);
        const free = routeParkingData.totalSpots - routeParkingData.occupiedSpots;
        document.getElementById('routeInfo').innerHTML = `
        <div>🚗 До парковки (по прямой)</div>
        <div> ${dist.toFixed(1)} км</div>
        <div>⏱ ~${time} мин (приблизительно)</div>
        <div> Свободных мест: ${free}</div>
        <div>🔄 Обновлено: ${formatDateTime(routeParkingData.timestamp)}</div>
    `;
        document.getElementById('routeCard').classList.add('active');
        map.setBounds([
            [Math.min(routeStartCoords[0], routeEndCoords[0]), Math.min(routeStartCoords[1], routeEndCoords[1])],
            [Math.max(routeStartCoords[0], routeEndCoords[0]), Math.max(routeStartCoords[1], routeEndCoords[1])]
        ], { duration: 500 });
    }
    function startNavigation() {
        if (!routeEndCoords) {
            alert('Сначала постройте маршрут');
            return;
        }
        getUserLocation()
            .then(coords => {
                const fromLat = coords.lat;
                const fromLng = coords.lng;
                const toLat = routeEndCoords[0];
                const toLng = routeEndCoords[1];
                const url = `https://yandex.ru/maps/?rtext=${fromLat},${fromLng}~${toLat},${toLng}&rtt=auto`;
                window.open(url, '_blank');
            })
            .catch(() => {
                const toLat = routeEndCoords[0];
                const toLng = routeEndCoords[1];
                const url = `https://yandex.ru/maps/?rtext=~${toLat},${toLng}&rtt=auto`;
                window.open(url, '_blank');
            });
    }
    function closeRoute() {
        if (currentRoute) { map.geoObjects.remove(currentRoute);
            currentRoute = null; }
        document.getElementById('routeCard').classList.remove('active');
        routeStartCoords = null;
        routeEndCoords = null;
        routeParkingData = null;
    }
