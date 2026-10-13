 // ===================== МАРШРУТ =====================
function buildRouteToParking(parkingId) {
    const data =
        parkingDataCache[parkingId] ||
        (currentParkingId === parkingId ? currentParkingData : null);
    if (!data) {
        alert('Не удалось найти данные парковки.');
        return;
    }
    // Преобразуем координаты в числа.
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    if (
        data.lat == null ||
        data.lng == null ||
        data.lat === '' ||
        data.lng === '' ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 || lat > 90 ||
        lng < -180 || lng > 180 ||
        (lat === 0 && lng === 0)
    ) {
        console.error('Некорректные координаты парковки:', data);
        alert('У этой парковки отсутствуют корректные координаты.');
        return;
    }
    // Формируем ссылку на автомобильный маршрут в Яндекс Картах.
    const url = new URL('https://yandex.ru/maps/');
    url.searchParams.set('rtext', `~${lat},${lng}`);
    url.searchParams.set('rtt', 'auto');
    // Открываем карты непосредственно по нажатию кнопки.
    const mapsWindow = window.open(url.toString(), '_blank');
    // Если браузер запретил новую вкладку, открываем в текущей.
    if (!mapsWindow) {
        window.location.href = url.toString();
        return;
    }
    // Закрываем карточку после открытия маршрута.
    closeCenterSheet();
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
    const free = routeParkingData.totalSpots - routeParkingData.occupiedSpots;
    currentRoute = new ymaps.multiRouter.MultiRoute({
        referencePoints: [routeStartCoords, routeEndCoords],
        params: {
            routingMode: 'auto',
            avoidTrafficJams: true
        }
    }, {
        boundsAutoApply: true,
        routeStrokeColor: '#2B7574',
        routeStrokeWidth: 5,
        routeActiveStrokeColor: '#2B7574',
        routeActiveStrokeWidth: 5,
        wayPointVisible: false
    });
    map.geoObjects.add(currentRoute);
    currentRoute.model.events.add('requestsuccess', function() {
        const activeRoute = currentRoute.getActiveRoute();
        if (!activeRoute) return;
        const distance = activeRoute.properties.get('distance');
        const duration = activeRoute.properties.get('duration');
        document.getElementById('routeInfo').innerHTML = `
            <div>🚗 До парковки</div>
            <div>📍 ${distance.text}</div>
            <div>⏱ ${duration.text}</div>
            <div>Свободных мест: ${free}</div>
            <div>🔄 Обновлено: ${formatDateTime(routeParkingData.timestamp)}</div>
        `;

        document.getElementById('routeCard').classList.add('active');
    });
    currentRoute.model.events.add('requestfail', function() {
        document.getElementById('routeInfo').innerHTML = `
            <div>❌ Не удалось построить маршрут</div>
            <div>Проверьте подключение к интернету</div>
            <div>Свободных мест: ${free}</div>
        `;
    });
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
