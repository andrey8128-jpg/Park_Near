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
