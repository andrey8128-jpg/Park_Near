   // ===================== МАРКЕРЫ НА КАРТЕ =====================
// ===== Вспомогательная функция для загрузки всех парковок (без фильтра) =====
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
    // ===================== РИСОВАНИЕ ЗОНЫ =====================
function startDrawingMode() {
    // Удаляем старые кнопки, если они есть
    const oldControls = document.getElementById('drawingControls');
    if (oldControls) oldControls.remove();

    if (!map || !currentUser) return;
    if (drawingPolygon) { 
        map.geoObjects.remove(drawingPolygon);
        drawingPolygon = null; 
    }
    isDrawingMode = true;
    document.getElementById('addBtn').classList.add('drawing');
    document.getElementById('addBtn').textContent = '✕';

    drawingPolygon = new ymaps.Polygon([[]], {}, {
        editorDrawingCursor: "crosshair",
        fillColor: '#2B757433',
        strokeColor: '#2B7574',
        strokeWidth: 3,
        draggable: false
    });
    map.geoObjects.add(drawingPolygon);
    drawingPolygon.editor.startDrawing();

    showMapHint('Нажимайте на карту для рисования зоны');

    // Создаём кнопки управления над таббаром
    const controls = document.createElement('div');
    controls.className = 'drawing-controls';
    controls.id = 'drawingControls';
    controls.innerHTML = `
        <button class="btn-finish" onclick="finishDrawing()">✅ Готово</button>
        <button class="btn-cancel" onclick="cancelDrawing()">✕ Отменить</button>
    `;
    document.body.appendChild(controls);

    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
}
function finishDrawing() {
    console.log('finishDrawing() вызвана');
    if (!drawingPolygon) return;
    drawingPolygon.editor.stopDrawing();
    const coordinates = drawingPolygon.geometry.getCoordinates()[0];
    newParkingCoords = coordinates.map(c => [parseFloat(c[0]), parseFloat(c[1])]);

    const sizeCheck = checkPolygonSize(newParkingCoords);
    if (!sizeCheck.valid) { 
        alert(sizeCheck.error); 
        cancelDrawing(); 
        return; 
    }

    _parkingFormCoords = newParkingCoords;
    _parkingFormSizeCheck = sizeCheck;
    console.log('Сохранены координаты:', _parkingFormCoords);

    const controls = document.getElementById('drawingControls');
    if (controls) {
        controls.innerHTML = `
            <button class="btn-finish" onclick="openParkingForm()">✅ Готова</button>
            <button class="btn-cancel" onclick="cancelDrawing()">✕ Отменить</button>
        `;
        console.log('Кнопки заменены на "Готова" и "Отменить"');
    }

    document.getElementById('addBtn').classList.remove('drawing');
    document.getElementById('addBtn').textContent = '✕';
    isDrawingMode = false;

    const spots = calculateParkingSpots(newParkingCoords);
    if (spots > 0) {
        showToast(`🚗 Примерно ${spots} машино-мест в этой зоне`, 3000);
    } else {
        showToast('⚠️ Зона слишком мала для парковки', 2000);
    }
}
function openParkingForm() {
    console.log('✅ openParkingForm вызвана');
    console.log('Координаты:', _parkingFormCoords);
    if (!_parkingFormCoords) {
        showToast('Сначала нарисуйте зону парковки', 2000);
        return;
    }
    // Просто открываем панель с формой – без лишних задержек
    openAddPanelWithPolygon(_parkingFormCoords, _parkingFormSizeCheck);
}
    function cancelDrawing() {
    if (editingPolygon) {
        map.geoObjects.remove(editingPolygon);
        editingPolygon = null;
        if (originalPolyCoords && currentParkingId) {
            addMarkerToMap(currentParkingId, { ...currentParkingData, coordinates: originalPolyCoords });
        }
        const controls = document.getElementById('drawingControls');
        if (controls) controls.remove();
        document.getElementById('addBtn').classList.remove('drawing');
        document.getElementById('addBtn').textContent = '+';
        isDrawingMode = false;
        currentParkingId = null;
        currentParkingData = null;
        originalPolyCoords = null;
        _parkingFormCoords = null;
        _parkingFormSizeCheck = null;
        closePanel();
        return;
    }
    if (drawingPolygon) {
        map.geoObjects.remove(drawingPolygon);
        drawingPolygon = null;
    }
    isDrawingMode = false;
    document.getElementById('addBtn').classList.remove('drawing');
    document.getElementById('addBtn').textContent = '+';
    const controls = document.getElementById('drawingControls');
    if (controls) controls.remove();
    _parkingFormCoords = null;
    _parkingFormSizeCheck = null;
}

    function showMapHint(text) {
        const hint = document.createElement('div');
        hint.className = 'map-hint';
        hint.textContent = text;
        document.body.appendChild(hint);
        setTimeout(() => hint.remove(), 3000);
    }
function openAddPanelWithPolygon(coordinates, sizeCheck) {
    try {
        console.log('openAddPanelWithPolygon вызвана');
        const panel = document.getElementById('panel');
        const panelContent = document.getElementById('panelContent');
        if (!panel || !panelContent) {
            console.error('Элементы панели не найдены');
            return;
        }

        panel.classList.add('active');
        document.getElementById('panelTitle').textContent = 'Новая парковка';

        // Вычисляем примерное количество мест
        const suggestedSpots = calculateParkingSpots(coordinates);
        const spotsPlaceholder = suggestedSpots > 0 ? `Например: ${suggestedSpots}` : 'Например: 10';

        panelContent.innerHTML = `
            <div class="form-group">
                <label>Область парковки</label>
                <div id="miniMapContainer" style="width:100%; height:200px; border-radius:12px; overflow:hidden; margin-top:8px; box-shadow: var(--card-shadow);"></div>
                <p style="font-size:12px; color:var(--text-secondary); margin-top:6px;">Выделенная зона отображается на карте</p>
            </div>

            <div class="form-group">
                <label>Тип улицы</label>
                <select id="parkStreetType" class="input-field">
                    <option value="">-- выберите --</option>
                    <option value="ул.">улица</option>
                    <option value="пер.">переулок</option>
                    <option value="бульв.">бульвар</option>
                    <option value="просп.">проспект</option>
                    <option value="пр-д">проезд</option>
                    <option value="ш.">шоссе</option>
                    <option value="наб.">набережная</option>
                    <option value="алл.">аллея</option>
                    <option value="тракт">тракт</option>
                </select>
            </div>
            <div class="form-group">
                <label>Название улицы</label>
                <input type="text" id="parkStreetName" class="input-field" placeholder="Ленина">
            </div>
            <div class="form-group">
                <label>Номер дома</label>
                <input type="text" id="parkHouseNumber" class="input-field" placeholder="15">
            </div>

            <div class="form-group">
                <label>Количество парковочных мест *</label>
                <input type="number" id="parkSpots" class="input-field" placeholder="${spotsPlaceholder}" min="1" max="500">
                <small style="color:var(--text-secondary); font-size:12px; display:block; margin-top:4px;">
                    Автоматически рассчитано по площади зоны (можно изменить)
                </small>
            </div>
            <button class="btn-primary" id="saveParkBtn" onclick="submitParkingWithPolygon()">Сохранить парковку</button>
            <button class="btn-secondary" onclick="cancelDrawing(); closePanel();">Отмена</button>
        `;

        // Инициализация мини-карты
        setTimeout(() => {
            initMiniMap(coordinates);
            // Автозаполнение адреса
            if (coordinates && coordinates.length > 0) {
                const center = coordinates[0];
                ymaps.geocode(center, { results: 1 })
                    .then(res => {
                        const geo = res.geoObjects.get(0);
                        if (geo) {
                            const address = geo.getAddressLine();
                            const parsed = parseAddress(address);
                            const streetInput = document.getElementById('parkStreetName');
                            const houseInput = document.getElementById('parkHouseNumber');
                            if (streetInput) streetInput.value = parsed.street || '';
                            if (houseInput) houseInput.value = parsed.houseNumber || '';
                        }
                    })
                    .catch(err => console.warn('Геокодирование не удалось:', err));
            }
        }, 100);
    } catch (e) {
        console.error('Ошибка в openAddPanelWithPolygon:', e);
        showToast('Ошибка при открытии формы', 2000);
    }
}
    function initMiniMap(coords) {
        if (!coords || coords.length < 3) return;

        const container = document.getElementById('miniMapContainer');
        if (!container) return;

        const miniMap = new ymaps.Map(container, {
            center: coords[0],
            zoom: 17,
            controls: []
        });

        const polygon = new ymaps.Polygon([coords], {}, {
            fillColor: '#2B757433',
            strokeColor: '#2B7574',
            strokeWidth: 2
        });
        miniMap.geoObjects.add(polygon);
        miniMap.setBounds(polygon.geometry.getBounds(), { checkZoomRange: true });
    }

    function submitParkingWithPolygon() {
    // 1. Получаем данные из формы
    const streetType = document.getElementById('parkStreetType').value;
    const streetName = document.getElementById('parkStreetName').value.trim();
    const houseNumber = document.getElementById('parkHouseNumber').value.trim();
    const totalSpots = parseInt(document.getElementById('parkSpots').value);

    // 2. Проверки (без alert – только логи в консоль)
    if (!currentUser) {
        console.error('Ошибка: пользователь не авторизован');
        return;
    }
    if (!totalSpots || totalSpots < 1) {
        console.error('Пожалуйста, укажите количество парковочных мест');
        return;
    }
    if (!streetType && !streetName && !houseNumber) {
        console.error('Введите хотя бы улицу или номер дома');
        return;
    }

    // 3. Получаем координаты зоны
    let coordsToSave = window.newParkingCoords;
    if (!coordsToSave && drawingPolygon && drawingPolygon.geometry) {
        const raw = drawingPolygon.geometry.getCoordinates()[0];
        coordsToSave = raw.map(c => [parseFloat(c[0]), parseFloat(c[1])]);
    }
    if (!coordsToSave || coordsToSave.length < 3) {
        console.error('Ошибка: координаты зоны не найдены. Нарисуйте заново.');
        return;
    }

    // 4. Блокируем кнопку
    const btn = document.getElementById('saveParkBtn');
    btn.textContent = 'Сохранение...';
    btn.disabled = true;
    const saveBtn = btn;

    // 5. Вычисляем центр
    const centerLat = coordsToSave.reduce((s, c) => s + c[0], 0) / coordsToSave.length;
    const centerLng = coordsToSave.reduce((s, c) => s + c[1], 0) / coordsToSave.length;

    // 6. Формируем название
    const fullStreet = streetType && streetName ? `${streetType} ${streetName}` : (streetName || '');
    let name = fullStreet;
    if (houseNumber) {
        name = name ? `${name}, ${houseNumber}` : houseNumber;
    }
    if (!name) {
        name = `${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}`;
    }

    // 7. Сохраняем парковку (с геокодированием или без)
  async function saveParkingData(parkingData, centerLat, centerLng) {
    const newRef = database.ref('parkings').push();
    await newRef.set(parkingData);
    await database
        .ref(`users/${currentUser.id}/stats/parkingsCreated`)
        .transaction(count => (count || 0) + 1);
    await database
        .ref(`parkings/${newRef.key}/history`)
        .push({
            action: 'created',
            timestamp: Date.now(),
            userId: currentUser.id,
            username: currentUser.username || ''
        });
    // Добавляем маркер.
    // Кластеризатор здесь НЕ перезагружаем.
    addMarkerToMap(newRef.key, parkingData);
    if (drawingPolygon) {
        map.geoObjects.remove(drawingPolygon);
        drawingPolygon = null;
    }
    window.newParkingCoords = null;
    if (
        Number.isFinite(centerLat) &&
        Number.isFinite(centerLng)
    ) {
        map.setCenter(
            [centerLat, centerLng],
            17,
            { duration: 500 }
        );
    }
    if (document.getElementById('searchResults')) {
        filterParkings();
    }
    return newRef.key;
}
      ymaps.geocode(
    [centerLat, centerLng],
    {
        kind: 'house',
        results: 1
    }
)
.then(res => {
    const geo = res.geoObjects.get(0);

    let address = geo
        ? geo.getAddressLine()
        : '';

    if (address.length > 80) {
        address = address.substring(0, 77) + '...';
    }

    const parsed = parseAddress(address);

    if (fullStreet) {
        parsed.street = fullStreet;
    }

    if (houseNumber) {
        parsed.houseNumber = houseNumber;
    }

    if (!parsed.city) {
        parsed.city = currentCity || '';
        parsed.region =
            userCityPrefs.region || '';
    }

    const parkingData = {
        lat: centerLat,
        lng: centerLng,
        coordinates: coordsToSave,
        totalSpots,
        occupiedSpots: 0,
        name,
        isPaid: false,
        address:
            address ||
            `${centerLat.toFixed(6)}, ${centerLng.toFixed(6)}`,
        region: parsed.region || '',
        city: parsed.city || '',
        street: parsed.street || '',
        houseNumber: parsed.houseNumber || '',

        authorId: currentUser.id,
        authorName: currentUser.firstName || '',
        authorUsername: currentUser.username || '',
        lastUpdatedAt: Date.now(),
        lastUpdatedBy:
            currentUser.nickname ||
            currentUser.firstName ||
            '',
        timestamp: Date.now(),
        status: 'unknown'
    };
    return saveParkingData(
        parkingData,
        centerLat,
        centerLng
    );
})
.catch(error => {
    console.warn(
        'Геокодирование не удалось:',
        error
    );

    // Геокодер не ответил.
    // Но парковку всё равно сохраняем.

    const parkingData = {
        lat: centerLat,
        lng: centerLng,
        coordinates: coordsToSave,
        totalSpots,
        occupiedSpots: 0,
        name,
        isPaid: false,
        address:
        `${centerLat.toFixed(6)}, ${centerLng.toFixed(6)}`,
        region:
        userCityPrefs.region || '',
        city:
        currentCity || '',
        street:
        fullStreet || '',
        houseNumber:
        houseNumber || '',
        authorId: currentUser.id,
        authorName: currentUser.firstName || '',
        authorUsername: currentUser.username || '',
        lastUpdatedAt: Date.now(),
        lastUpdatedBy:
            currentUser.nickname ||
            currentUser.firstName ||
            '',
        timestamp: Date.now(),
        status: 'unknown'
    };
    return saveParkingData(
        parkingData,
        centerLat,
        centerLng
    );
});
    function saveEditedPolygon(newCoords) {
        if (!currentParkingId) return;
        const sizeCheck = checkPolygonSize(newCoords);
        if (!sizeCheck.valid) { alert(sizeCheck.error);
            cancelDrawing(); return; }
        database.ref(`parkings/${currentParkingId}/coordinates`).set(newCoords).then(() => {
            map.geoObjects.remove(editingPolygon);
            editingPolygon = null;
            document.getElementById('addBtn').classList.remove('drawing');
            document.getElementById('addBtn').textContent = '+';
            isDrawingMode = false;
            const controls = document.getElementById('drawingControls');
            if (controls) controls.remove();
            currentParkingData.coordinates = newCoords;
            parkingDataCache[currentParkingId] = currentParkingData;
            refreshParkingMarker();
            if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback
                .notificationOccurred('success');
            alert('Границы обновлены');
        }).catch(err => { console.error('Ошибка обновления полигона:', err);
            alert('Ошибка: ' + err.message);
            cancelDrawing(); });
    }
   
    // ===================== РЕДАКТИРОВАНИЕ ПАРКОВКИ =====================
    function openOccupancyPanel(parkingId) {
        database.ref(`parkings/${parkingId}`).once('value').then(snapshot => {
            const data = snapshot.val();
            if (!data) return;
            if (currentUser && currentUser.id !== data.authorId) {
                database.ref(`parkings/${parkingId}/views`).transaction(v => (v || 0) + 1);
                database.ref(`users/${data.authorId}/stats/views`).transaction(v => (v || 0) + 1);
            }
            currentParkingId = parkingId;
            currentParkingData = data;
            parkingDataCache[parkingId] = data;

            if (currentUser) {
                Promise.all([
                    database.ref(`users/${currentUser.id}/car`).once('value'),
                    database.ref(`users/${currentUser.id}/favorites/${parkingId}`).once('value')
                ]).then(([carSnap, favSnap]) => {
                    currentUser.car = carSnap.val() || {};
                    const isFavorite = favSnap.exists();
                    renderEditPanel(data, isFavorite);
                });
            } else {
                renderEditPanel(data, false);
            }
        });
    }

   function renderEditPanel(data, isFavorite) {
    const totalSpots = data.totalSpots || 0;
    const occupiedSpots = data.occupiedSpots || 0;
    const freeSpots = totalSpots - occupiedSpots;
    const color = getOccupancyColor(occupiedSpots, totalSpots);
    const occupancyPercent = totalSpots > 0 ? Math.round((occupiedSpots / totalSpots) * 100) : 0;
    const isAuthor = currentUser && currentUser.id === data.authorId;
    const status = data.status || 'unknown';
    const statusClass = status === 'free' ? 'status-free' : status === 'occupied' ? 'status-occupied' : 'status-unknown';

    document.getElementById('panel').classList.add('active');
    document.getElementById('panelTitle').textContent = 'Редактирование';

    let html = `
    <div class="occupancy-header">
        <div class="occupancy-title">
            <span class="status-indicator ${statusClass}"></span>
            ${escapeHtml(data.name || 'Без названия')}
        </div>
    </div>
    <div class="occupancy-stats">
        <div class="stat-card stat-total"><div class="stat-value" id="statTotal">${totalSpots}</div><div class="stat-label">Всего мест</div></div>
        <div class="stat-card stat-free"><div class="stat-value" id="statFree">${freeSpots}</div><div class="stat-label">Свободно</div></div>
        <div class="stat-card stat-occupied"><div class="stat-value" id="statOccupied">${occupiedSpots}</div><div class="stat-label">Занято</div></div>
    </div>
    <div class="progress-bar"><div class="progress-fill" id="progressFill" style="width:${occupancyPercent}%;background:${color};"></div></div>
    <div style="text-align:center;font-size:13px;color:var(--text-secondary);margin-bottom:20px;" id="occupancyPercentText">Загруженность: ${occupancyPercent}%</div>
    <div class="occupancy-control" style="margin-bottom:15px;">
        <label>Изменить количество занятых мест:</label>
        <div class="counter-row">
            <button class="counter-btn minus" onclick="changeOccupancy(-1, '${currentParkingId}')">−</button>
            <div class="counter-value" id="currentOccupied">${occupiedSpots}</div>
            <button class="counter-btn plus" onclick="changeOccupancy(1, '${currentParkingId}')">+</button>
        </div>
    </div>

    <!-- ===== ИСТОРИЯ ИЗМЕНЕНИЙ ===== -->
    <div id="historyContainer" style="margin-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-weight:600; font-size:16px;">📋 История изменений</span>
            <span style="font-size:12px; color:var(--text-secondary);" id="historyCount"></span>
            <button id="showAllHistoryBtn" style="background:none; border:none; color:var(--accent); cursor:pointer; font-size:14px; display:none;">См. все</button>
        </div>
        <div id="historyList" style="max-height:200px; overflow-y:auto;"></div>
        <div id="historyFullList" style="display:none; max-height:200px; overflow-y:auto; margin-top:8px;"></div>
        <button id="hideAllHistoryBtn" style="display:none; background:none; border:none; color:var(--accent); cursor:pointer; font-size:14px; margin-top:4px;">Скрыть всё</button>
    </div>

    <!-- ===== ПРОГНОЗ (добавлен) ===== -->
    <div id="forecastContainerInEdit" style="margin-top:20px; background:var(--bg-secondary); border-radius:16px; padding:16px; box-shadow:var(--card-shadow);">
        <div class="center-forecast-title">📊 Прогноз</div>
        <div class="center-forecast-text" style="font-size:14px; margin-bottom:8px;">Загрузка прогноза...</div>
        <div id="forecastChartPlaceholderInEdit" style="text-align:center; padding:10px; color:var(--text-secondary);">
            <div class="spinner" style="width:24px;height:24px;border-width:2px;"></div>
            <p>Загрузка прогноза...</p>
        </div>
    </div>

    <!-- ===== ТРИ КНОПКИ В РЯД ===== -->
    <div style="display:flex; gap:8px; margin-top:16px;">
        <button class="btn-secondary" style="flex:1; margin:0;" onclick="toggleParkingEditor()">✏️ Изменить</button>
        <button class="btn-secondary" style="flex:1; margin:0;" onclick="buildRouteToParking('${currentParkingId}')">🧭 Маршрут</button>
        <button class="btn-danger" style="flex:1; margin:0; padding:10px;" onclick="deleteParkingWithConfirm('${currentParkingId}')">🗑️ Удалить</button>
    </div>
    `;

    // ===== ПАНЕЛЬ РЕДАКТИРОВАНИЯ (скрыта по умолчанию) =====
    if (currentUser && isAuthor) {
        const currentStreet = data.street || '';
        const streetName = extractStreetName(currentStreet);
        html += `
        <div id="editPanel" style="display:none; margin-top:16px; background:var(--bg-secondary); border-radius:16px; padding:16px; box-shadow:var(--card-shadow);">
            <div class="form-group">
                <label>Название / улица</label>
                <select id="editStreetType" class="input-field" style="margin-bottom:8px;">
                    <option value="">-- выберите --</option>
                    <option value="ул." ${currentStreet.startsWith('ул.') ? 'selected' : ''}>улица</option>
                    <option value="пер." ${currentStreet.startsWith('пер.') ? 'selected' : ''}>переулок</option>
                    <option value="бульв." ${currentStreet.startsWith('бульв.') ? 'selected' : ''}>бульвар</option>
                    <option value="просп." ${currentStreet.startsWith('просп.') ? 'selected' : ''}>проспект</option>
                    <option value="пр-д" ${currentStreet.startsWith('пр-д') ? 'selected' : ''}>проезд</option>
                    <option value="ш." ${currentStreet.startsWith('ш.') ? 'selected' : ''}>шоссе</option>
                    <option value="наб." ${currentStreet.startsWith('наб.') ? 'selected' : ''}>набережная</option>
                    <option value="алл." ${currentStreet.startsWith('алл.') ? 'selected' : ''}>аллея</option>
                    <option value="тракт" ${currentStreet.startsWith('тракт') ? 'selected' : ''}>тракт</option>
                </select>
                <input type="text" id="editStreetName" class="input-field" value="${escapeHtml(streetName)}" placeholder="Название улицы">
            </div>
            <div class="form-group">
                <label>Номер дома</label>
                <input type="text" id="editHouseNumber" class="input-field" value="${escapeHtml(data.houseNumber || '')}" placeholder="15">
            </div>
            <div class="form-group">
                <label>Количество мест</label>
                <input type="number" id="editTotalSpots" class="input-field" value="${totalSpots}" min="1" max="500">
            </div>
            <button class="btn-primary" onclick="saveParkingDetails()">💾 Сохранить</button>
            <button class="btn-secondary" style="margin-top:8px;" onclick="toggleParkingEditor()">Отмена</button>
        </div>
        `;
    } else if (!isAuthor && currentUser) {
        html += `<div style="text-align:center; margin-top:16px; font-size:14px; color:var(--text-secondary);">Вы не можете редактировать эту парковку</div>`;
    }

    document.getElementById('panelContent').innerHTML = html;

    // ===== ЗАГРУЗКА ИСТОРИИ =====
    if (currentUser && currentParkingId) {
        loadHistoryPreview(currentParkingId);
    }

    // ===== ЗАГРУЗКА ПРОГНОЗА =====
    if (currentParkingId) {
        loadForecastForEdit(currentParkingId);
    }

    // ===== ОБРАБОТЧИКИ КНОПОК =====
    window.showAllHistory = function() {
        document.getElementById('historyList').style.display = 'none';
        document.getElementById('historyFullList').style.display = 'block';
        document.getElementById('showAllHistoryBtn').style.display = 'none';
        document.getElementById('hideAllHistoryBtn').style.display = 'inline-block';
    };
    window.hideAllHistory = function() {
        document.getElementById('historyFullList').style.display = 'none';
        document.getElementById('historyList').style.display = 'block';
        document.getElementById('showAllHistoryBtn').style.display = 'inline-block';
        document.getElementById('hideAllHistoryBtn').style.display = 'none';
    };
    window.toggleParkingEditor = function() {
        const panel = document.getElementById('editPanel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    };
    window.deleteParkingWithConfirm = function(parkingId) {
        if (confirm('Вы уверены, что хотите удалить эту парковку? Это действие необратимо!')) {
            deleteParking(parkingId);
        }
    };
}
function loadHistoryPreview(parkingId) {
    const container = document.getElementById('historyList');
    const fullContainer = document.getElementById('historyFullList');
    const countEl = document.getElementById('historyCount');
    const showAllBtn = document.getElementById('showAllHistoryBtn');
    const hideAllBtn = document.getElementById('hideAllHistoryBtn');

    if (!container || !currentParkingId) return;

    database.ref(`parkings/${parkingId}/history`)
        .orderByChild('timestamp')
        .limitToLast(100)
        .once('value')
        .then(snapshot => {
            const history = snapshot.val();
            if (!history) {
                container.innerHTML = '<div style="color:var(--text-secondary); font-size:13px;">История пуста</div>';
                if (countEl) countEl.textContent = '';
                return;
            }

            const entries = Object.entries(history)
                .map(([key, val]) => ({ key, ...val }))
                .sort((a, b) => b.timestamp - a.timestamp);

            if (countEl) countEl.textContent = `(${entries.length})`;

            // Функция рендеринга одной записи (без чисел и госномера)
            const renderEntry = (entry) => {
                const date = new Date(entry.timestamp);
                const timeStr = date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                const action = entry.action === 'occupied' ? 'Занял' : 'Освободил';
                const actionColor = entry.action === 'occupied' ? 'var(--history-occupied)' : 'var(--history-freed)';
                const username = entry.username || 'Неизвестный';
                const car = entry.car || {};
                let carStr = '';
                if (car.brand || car.model) {
                    carStr = `${car.brand} ${car.model}`;
                } else {
                    carStr = 'без авто';
                }
                return `
                    <div style="padding:8px 12px; background:var(--bg-primary); border-radius:8px; margin-bottom:4px; font-size:13px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:4px;">
                        <div><span style="font-weight:500; color:${actionColor};">${action}</span></div>
                        <div style="color:var(--text-secondary); font-size:12px;">${escapeHtml(username)} • ${escapeHtml(carStr)}</div>
                        <div style="color:var(--text-secondary); font-size:11px;">${timeStr}</div>
                    </div>
                `;
            };

            // Показываем первые 3 в основном контейнере
            const showCount = 3;
            const previewEntries = entries.slice(0, showCount);
            const remainingEntries = entries.slice(showCount);

            container.innerHTML = previewEntries.map(renderEntry).join('');

            if (remainingEntries.length > 0) {
                showAllBtn.style.display = 'inline-block';
                fullContainer.innerHTML = remainingEntries.map(renderEntry).join('');
                fullContainer.style.display = 'none';
                hideAllBtn.style.display = 'none';
            } else {
                showAllBtn.style.display = 'none';
                fullContainer.style.display = 'none';
                hideAllBtn.style.display = 'none';
            }

            // Обработчики кнопок
            showAllBtn.onclick = function() {
                container.style.display = 'none';
                fullContainer.style.display = 'block';
                showAllBtn.style.display = 'none';
                hideAllBtn.style.display = 'inline-block';
            };
            hideAllBtn.onclick = function() {
                fullContainer.style.display = 'none';
                container.style.display = 'block';
                showAllBtn.style.display = 'inline-block';
                hideAllBtn.style.display = 'none';
            };
        })
        .catch(err => {
            console.error('Ошибка загрузки истории:', err);
            container.innerHTML = '<div style="color:var(--red);">Ошибка загрузки</div>';
        });
}
    function loadHistory(parkingId, limit = 10, days = 3) {
        const container = document.getElementById('historyList');
        const countEl = document.getElementById('historyCount');
        const loadMoreBtn = document.getElementById('loadMoreHistory');
        if (!container) return;

        const now = Date.now();
        const cutoff = now - days * 24 * 60 * 60 * 1000;

        database.ref(`parkings/${parkingId}/history`).orderByChild('timestamp').limitToLast(limit).once('value',
        snapshot => {
            const history = snapshot.val();
            if (!history) {
                container.innerHTML = '<div style="color:var(--text-secondary); font-size:13px;">История пуста</div>';
                if (countEl) countEl.textContent = '';
                return;
            }

            let entries = Object.entries(history).map(([key, val]) => ({ key, ...val }))
                .sort((a, b) => b.timestamp - a.timestamp)
                .filter(entry => entry.timestamp >= cutoff);

            if (countEl) countEl.textContent = `(${entries.length})`;

            if (entries.length === 0) {
                container.innerHTML =
                    `<div style="color:var(--text-secondary); font-size:13px;">Нет изменений за последние ${days} дней</div>`;
                if (loadMoreBtn) loadMoreBtn.style.display = 'none';
                return;
            }

            let html = '';
            entries.forEach(entry => {
                const date = new Date(entry.timestamp);
                const timeStr = date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit',
                    year: 'numeric', hour: '2-digit', minute: '2-digit' });
                const action = entry.action === 'occupied' ? '🚗 Занял' : '🚗 Освободил';
                const username = entry.username || 'Неизвестный';
                const car = entry.car || {};
                let carStr = '';
                if (car.brand || car.model) {
                    carStr = `${car.brand} ${car.model}`;
                    if (car.plate) carStr += ` (${car.plate})`;
                } else {
                    carStr = 'машина не указана';
                }
                html += `
            <div style="padding:8px 12px; background:var(--bg-primary); border-radius:8px; margin-bottom:4px; font-size:13px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:4px;">
                <div><span style="font-weight:500;">${action}</span> (${entry.previousOccupied} → ${entry.newOccupied})</div>
                <div style="color:var(--text-secondary); font-size:12px;">${username} • ${carStr}</div>
                <div style="color:var(--text-secondary); font-size:11px;">${timeStr}</div>
            </div>
            `;
            });
            container.innerHTML = html;

            if (loadMoreBtn) {
                database.ref(`parkings/${parkingId}/history`).once('value', totalSnap => {
                    const total = totalSnap.numChildren ? totalSnap.numChildren() : 0;
                    if (total > limit) {
                        loadMoreBtn.style.display = 'block';
                        loadMoreBtn.onclick = function() {
                            loadHistory(parkingId, 100, days);
                            this.style.display = 'none';
                        };
                    } else {
                        loadMoreBtn.style.display = 'none';
                    }
                });
            }
        });
    }

    function saveParkingDetails() {
    if (!currentUser) { alert('Необходимо авторизоваться'); return; }
    if (!currentParkingId || !currentParkingData) return;

    const streetType = document.getElementById('editStreetType')?.value || '';
    const streetName = document.getElementById('editStreetName')?.value.trim() || '';
    const houseNumber = document.getElementById('editHouseNumber')?.value.trim() || '';
    const totalSpots = parseInt(document.getElementById('editTotalSpots')?.value) || 0;

    const street = streetType && streetName ? `${streetType} ${streetName}` : (streetName || currentParkingData.street || '');
    if (!street && !houseNumber) { alert('Введите улицу или номер дома'); return; }

    let newName = street;
    if (houseNumber) {
        newName = newName ? `${newName}, ${houseNumber}` : houseNumber;
    }
    if (!newName) {
        newName = 'Адрес не указан';
    }

    if (isNaN(totalSpots) || totalSpots < 1) { alert('Количество мест должно быть больше 0'); return; }
    if (totalSpots < currentParkingData.occupiedSpots) { alert('Общее число мест не может быть меньше занятых.'); return; }

    const updates = { name: newName, street, houseNumber, totalSpots };

    database.ref(`parkings/${currentParkingId}`).update(updates).then(() => {
        if (currentUser.id === currentParkingData.authorId) database.ref(`users/${currentUser.id}/stats/parkingsUpdated`).transaction(c => (c || 0) + 1);
        currentParkingData = { ...currentParkingData, ...updates };
        parkingDataCache[currentParkingId] = currentParkingData;
        updateOccupancyDisplay(currentParkingData.occupiedSpots);
        refreshParkingMarker();

        // ✅ Пересчитываем кластеры
        if (clusterer) clusterer.reload();

        // ... остальной код (закрытие панели, обновление интерфейса)
        closePanel();
        showMap();
        if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }).catch(err => { console.error('Ошибка сохранения:', err); alert('Ошибка: ' + err.message); });
}
    function updateOccupancyDisplay(newOccupied) {
        if (!currentParkingData) return;
        const total = currentParkingData.totalSpots || 0,
            free = total - newOccupied,
            color = getOccupancyColor(newOccupied, total),
            percent = total > 0 ? Math.round((newOccupied / total) * 100) : 0;
        ['statTotal', 'statFree', 'statOccupied', 'currentOccupied'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = id === 'statTotal' ? total : (id === 'statFree' ? free : (id ===
                'statOccupied' ? newOccupied : newOccupied));
        });
        const progress = document.getElementById('progressFill');
        if (progress) { progress.style.width = percent + '%';
            progress.style.background = color; }
        const percentText = document.getElementById('occupancyPercentText');
        if (percentText) percentText.textContent = `Загруженность: ${percent}%`;
        currentParkingData.occupiedSpots = newOccupied;
    }
  async function changeOccupancy(delta, parkingId) {
    if (!currentUser) {
        showToast('Необходимо авторизоваться');
        return;
    }
    const id = parkingId || currentParkingId;
    if (!id) {
        showToast('ID парковки не найден');
        return;
    }
    const parkingRef = database.ref(`parkings/${id}`);
    try {
        const snapshot = await parkingRef.once('value');
        const data = snapshot.val();
        if (!data) {
            showToast('Парковка не найдена');
            return;
        }
        const total = Number(data.totalSpots || 0);
        let previousOccupied = 0;
        let newOccupied = 0;
        const result = await parkingRef.child('occupiedSpots').transaction(
            currentValue => {
                previousOccupied = Number(currentValue || 0);
                newOccupied = previousOccupied + delta;
                if (newOccupied < 0 || newOccupied > total) return;
                return newOccupied;
            }
        );
        if (!result.committed) {
            showToast('Количество мест уже изменилось');
            return;
        }
        const now = Date.now();
        await parkingRef.update({
            lastUpdatedAt: now,
            lastUpdatedBy: currentUser.nickname || currentUser.firstName || 'Пользователь'
        });
        await parkingRef.child('history').push({
            action: delta < 0 ? 'freed' : 'occupied',
            timestamp: now,
            userId: currentUser.id,
            username: currentUser.username || currentUser.nickname || 'Пользователь',
            previousOccupied,
            newOccupied
        });
        if (parkingDataCache[id]) parkingDataCache[id].occupiedSpots = newOccupied;
        if (id === currentParkingId && currentParkingData) currentParkingData.occupiedSpots = newOccupied;
        updateOccupancyDisplay(newOccupied);
        refreshParkingMarker();
        // ✅ Пересчитываем кластеры, чтобы обновить сумму на иконках
        if (clusterer) clusterer.reload();
        if (document.getElementById('historyList')) loadHistoryPreview(id);
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.selectionChanged();
        }
    } catch (error) {
        console.error('Ошибка обновления занятости:', error);
        showToast('Не удалось изменить количество мест');
    }
}
async function deleteParking(parkingId) {
    if (!currentUser) {
        showToast('Необходимо авторизоваться');
        return;
    }
    if (!parkingId) {
        showToast('ID парковки не найден');
        return;
    }
    if (!confirm('Вы уверены, что хотите удалить эту парковку?')) return;
    try {
        const ref = database.ref(`parkings/${parkingId}`);
        const snapshot = await ref.once('value');
        const data = snapshot.val();
        if (!data) {
            showToast('Парковка уже удалена');
            return;
        }
        if (data.authorId !== currentUser.id) {
            showToast('Удалять парковку может только её автор');
            return;
        }
        await ref.remove();
        // ✅ Удаляем Placemark и Polygon корректно
        const placemark = mapMarkers[parkingId];
        if (placemark) {
            // Удаляем полигон
            const polygon = placemark.properties.get('polygon');
            if (polygon) {
                map.geoObjects.remove(polygon);
            }
            // Удаляем маркер из кластера
            if (clusterer) {
                clusterer.remove(placemark);
            }
            delete mapMarkers[parkingId];
        }
        // Если удаляется активный полигон
        if (activePolygon && activePolygon.__parkingId === parkingId) {
            map.geoObjects.remove(activePolygon);
            activePolygon = null;
        }
        delete parkingDataCache[parkingId];
        // ✅ Пересчитываем кластеры
        if (clusterer) clusterer.reload();
        closePanel();
        showMap();
        if (document.getElementById('searchResults')) filterParkings();
        showToast('Парковка удалена');
    } catch (error) {
        console.error('Ошибка удаления:', error);
        showToast('Не удалось удалить парковку');
    }
}
    function confirmParking(parkingId) {
        if (!currentUser) return;
        database.ref(`parkings/${parkingId}`).once('value').then(snapshot => {
            const data = snapshot.val();
            if (data && data.authorId !== currentUser.id) {
                database.ref(`users/${data.authorId}/stats/confirmations`).transaction(c => (c || 0) + 1);
                alert('Спасибо за подтверждение!');
            }
        });
    }
    function toggleFavorite(parkingId, parkingData) {
    if (!currentUser || !parkingId) return;
    const data = parkingData || parkingDataCache[parkingId] || null;
    if (!data) return;
    const favRef = database.ref(`users/${currentUser.id}/favorites/${parkingId}`);
    favRef.once('value').then(snap => {
        if (snap.exists()) {
            favRef.remove();
            // Обновляем текст кнопки в центральном окне
            const btn = document.querySelector('.center-actions .btn-secondary:first-child');
            if (btn) btn.innerHTML = '⭐ Избранное';
            if (data.authorId) {
                database.ref(`users/${data.authorId}/stats/favorites`).transaction(c => Math.max(0, (c || 1) - 1));
            }
        } else {
            const favData = {
                parkingId: parkingId,
                name: data.name || data.address || data.street || 'Парковка',
                lat: data.lat || 0,
                lng: data.lng || 0,
                address: data.address || '',
                timestamp: Date.now()
            };
            favRef.set(favData);
            const btn = document.querySelector('.center-actions .btn-secondary:first-child');
            if (btn) btn.innerHTML = '✅ В избранном';
            if (data.authorId) {
                database.ref(`users/${data.authorId}/stats/favorites`).transaction(c => (c || 0) + 1);
            }
        }
    });
}
