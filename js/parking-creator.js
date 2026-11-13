// ===================== РИСОВАНИЕ ЗОНЫ =====================
function startDrawingMode() {
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
        controls.remove();
}
    // ФИКС: возвращаем иконку "+", т.к. режим рисования завершён
    const addBtn = document.getElementById('addBtn');
    if (addBtn) {
        addBtn.classList.remove('drawing');
        addBtn.textContent = '+';
    }
    isDrawingMode = false;
const spots = calculateParkingSpots(newParkingCoords);
if (spots > 0) {
    showToast(
        `🚗 Примерно ${spots} машино-мест в этой зоне`,
        3000
    );
} else {
    showToast('⚠️ Зона слишком мала для парковки', 2000);
}
    openParkingForm();
}
function openParkingForm() {
    console.log('✅ openParkingForm вызвана');
    console.log('Координаты:', _parkingFormCoords);
    if (!_parkingFormCoords) {
        showToast('Сначала нарисуйте зону парковки', 2000);
        return;
    }
    openAddPanelWithPolygon(_parkingFormCoords, _parkingFormSizeCheck);
}
function cancelDrawing() {
    if (editingPolygon) {
        map.geoObjects.remove(editingPolygon);
        editingPolygon = null;
        if (originalPolyCoords && currentParkingId) {
            addMarkerToMap(currentParkingId, {
                ...currentParkingData,
                coordinates: originalPolyCoords
            });
        }
        const controls = document.getElementById('drawingControls');
        if (controls) controls.remove();
        const addBtn = document.getElementById('addBtn');
        if (addBtn) {
            addBtn.classList.remove('drawing');
            addBtn.textContent = '+';
        }
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
    const addBtn = document.getElementById('addBtn');
    if (addBtn) {
        addBtn.classList.remove('drawing');
        addBtn.textContent = '+';
    }
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
        setTimeout(() => {
            initMiniMap(coordinates);
            if (coordinates && coordinates.length > 0) {
                const centerLat = coordinates.reduce((sum, c) => sum + Number(c[0]), 0) / coordinates.length;
                const centerLng = coordinates.reduce((sum, c) => sum + Number(c[1]), 0) / coordinates.length;
                getAddressByCoordinates(centerLat, centerLng).then(data => {
                    if (!data) return;
                    const streetInput = document.getElementById('parkStreetName');
                    const houseInput = document.getElementById('parkHouseNumber');
                    if (streetInput && data.street) streetInput.value = data.street;
                    if (houseInput && data.houseNumber) houseInput.value = data.houseNumber;
                }).catch(() => {});
            }
        }, 100);
    } catch (e) {
        console.error('Ошибка в openAddPanelWithPolygon:', e);
        showToast('Ошибка при открытии формы', 2000);
    }
}
// ФИКС: держим ссылку на мини-карту и уничтожаем предыдущий инстанс
let _miniMapInstance = null;
function initMiniMap(coords) {
    if (!coords || coords.length < 3) return;
    const container = document.getElementById('miniMapContainer');
    if (!container) return;
    if (_miniMapInstance) {
        try { _miniMapInstance.destroy(); } catch (e) {}
        _miniMapInstance = null;
    }
    const miniMap = new ymaps.Map(container, {
        center: coords[0],
        zoom: 17,
        controls: []
    });
    _miniMapInstance = miniMap;
    const polygon = new ymaps.Polygon([coords], {}, {
        fillColor: '#2B757433',
        strokeColor: '#2B7574',
        strokeWidth: 2
    });
    miniMap.geoObjects.add(polygon);
    miniMap.setBounds(polygon.geometry.getBounds(), { checkZoomRange: true });
}
async function deleteParking(parkingId) {
    if (!currentUser) {
        showToast('Необходимо авторизоваться');
        return;
    }
    if (!parkingId) {
        return showToast('ID парковки не найден');
    }
    if (!confirm('Вы уверены, что хотите удалить эту парковку?')) {
        return;
    }
    try {
        const parking = parkingDataCache[parkingId];
        if (!parking) {
            return showToast('Парковка не найдена в кэше');
        }
        if (parking.authorId !== currentUser.id) {
            return showToast('Удалять парковку может только её автор');
        }
        const sessionToken = localStorage.getItem('parkNearSessionToken');
        if (!sessionToken) {
            throw new Error('Нет активной серверной сессии. Войдите через Telegram.');
        }
        const response = await fetch(
            `${window.PARKNEAR_API_URL}/api/parkings/${encodeURIComponent(parkingId)}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${sessionToken}`
                }
            }
        );
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Не удалось удалить парковку');
        }
        // Удаляем Placemark и Polygon
        const placemark = mapMarkers[parkingId];
        if (placemark) {
            const polygon = placemark.properties.get('polygon');
            if (polygon) {
                map.geoObjects.remove(polygon);
            }
            if (clusterer) {
                clusterer.remove(placemark);
            }
            delete mapMarkers[parkingId];
        }
        if (activePolygon && activePolygon.__parkingId === parkingId) {
            map.geoObjects.remove(activePolygon);
            activePolygon = null;
        }
        delete parkingDataCache[parkingId];
        if (clusterer) {
            clusterer.reload();
        }
        closePanel();
        showMap();
        if (document.getElementById('searchResults')) {
            filterParkings();
        }
        showToast('Парковка удалена');
    } catch (error) {
        console.error('Ошибка удаления:', error);
        showToast(error.message || 'Не удалось удалить парковку');
    }
}
function cleanParkingPathPart(value, fallback) {
    const cleaned = String(value || '')
        .trim()
        .replace(/[.#$\/\[\]]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

    return cleaned || fallback;
}
async function submitParkingWithPolygon() {
    const streetType = document.getElementById('parkStreetType')?.value?.trim() || '';
    const streetName = document.getElementById('parkStreetName')?.value?.trim() || '';
    const houseNumber = document.getElementById('parkHouseNumber')?.value?.trim() || '';

    const btn = document.getElementById('saveParkBtn');
    const originalText = btn?.textContent || 'Сохранить парковку';

    if (!currentUser || !currentUser.id) {
        alert('Необходимо авторизоваться');
        return;
    }

    const pendingStorageKey = `parkNearPendingCreate:${currentUser.id}`;

    let pendingOperation = null;

    // 1. СНАЧАЛА проверяем сохранённую операцию — до геокодирования.
    try {
        const savedPending = localStorage.getItem(pendingStorageKey);

        if (savedPending) {
            pendingOperation = JSON.parse(savedPending);
        }
    } catch (storageError) {
        alert('Не удалось прочитать сохранённую операцию. Повторите попытку.');
        return;
    }

    // Проверяем структуру сохранённой операции.
    if (pendingOperation) {
        if (
            !pendingOperation.operationId ||
            !pendingOperation.fingerprint ||
            !pendingOperation.payload ||
            !Array.isArray(pendingOperation.payload.coordinates)
        ) {
            alert('Сохранённая операция повреждена. Необходимо разобраться с ней перед новой отправкой.');
            return;
        }
    }

    // 2. Получаем данные формы или восстанавливаем их из сохранённой операции.
    const spotsValue = document.getElementById('parkSpots')?.value;

const totalSpots = pendingOperation
    ? Number(pendingOperation.payload.totalSpots)
    : Number(spotsValue);

let coordsToSave = pendingOperation
    ? pendingOperation.payload.coordinates
    : (window.newParkingCoords || newParkingCoords);

    if (
        (!Array.isArray(coordsToSave) || coordsToSave.length < 3) &&
        pendingOperation?.payload?.coordinates
    ) {
        coordsToSave = pendingOperation.payload.coordinates;
    }

    if (
        !Number.isInteger(totalSpots) ||
        totalSpots < 1 ||
        totalSpots > 500
    ) {
        alert('Количество парковочных мест должно быть целым числом от 1 до 500');
        return;
    }

    if (!Array.isArray(coordsToSave) || coordsToSave.length < 3) {
        alert('Не найдены координаты парковочной зоны');
        return;
    }

    const validCoordinates = coordsToSave.every(point =>
        Array.isArray(point) &&
        point.length >= 2 &&
        Number.isFinite(Number(point[0])) &&
        Number.isFinite(Number(point[1])) &&
        Number(point[0]) >= -90 &&
        Number(point[0]) <= 90 &&
        Number(point[1]) >= -180 &&
        Number(point[1]) <= 180
    );

    if (!validCoordinates) {
        alert('Координаты парковки некорректны. Нарисуйте зону заново.');
        return;
    }

    const fingerprint = JSON.stringify({
        userId: currentUser.id,
        coordinates: coordsToSave,
        totalSpots,
        streetType,
        streetName,
        houseNumber
    });
    const sessionToken = localStorage.getItem('parkNearSessionToken');
    if (!sessionToken) {
        alert('Нет активной серверной сессии. Войдите через Telegram.');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = pendingOperation
            ? 'Повторно сохраняем...'
            : 'Определяем адрес...';
    }

    try {
        let operationId;
        let requestParkingData;
        let centerLat;
        let centerLng;
        let detectedCity;

        // 3. Если операция уже существует — используем её без геокодирования.
        if (pendingOperation) {
            operationId = pendingOperation.operationId;
            requestParkingData = pendingOperation.payload;

            centerLat = Number(requestParkingData.lat);
            centerLng = Number(requestParkingData.lng);
            detectedCity = String(requestParkingData.city || '').trim();

            if (
                !Number.isFinite(centerLat) ||
                !Number.isFinite(centerLng)
            ) {
                throw new Error('В сохранённой операции некорректные координаты.');
            }
        } else {
            // 4. Геокодирование выполняется только для новой операции.
            centerLat = coordsToSave.reduce(
                (sum, c) => sum + Number(c[0]), 0
            ) / coordsToSave.length;

            centerLng = coordsToSave.reduce(
                (sum, c) => sum + Number(c[1]), 0
            ) / coordsToSave.length;

            if (btn) btn.textContent = 'Определяем адрес...';

            const geoData = await getAddressByCoordinates(centerLat, centerLng);

            detectedCity = String(
                geoData?.city ||
                currentCity ||
                mapCity?.city ||
                userCityPrefs?.city ||
                ''
            ).trim();

            const detectedRegion = String(
                geoData?.region ||
                mapCity?.region ||
                userCityPrefs?.region ||
                ''
            ).trim();

            const detectedAddress = String(geoData?.address || '').trim();
            const detectedStreet = String(geoData?.street || '').trim();
            const detectedHouseNumber = String(geoData?.houseNumber || '').trim();

            const fullStreet =
                streetType && streetName
                    ? `${streetType} ${streetName}`
                    : streetName;

            const finalStreet = fullStreet || detectedStreet;
            const finalHouseNumber = houseNumber || detectedHouseNumber;

            const finalAddress = detectedAddress ||
                [
                    detectedCity,
                    finalStreet,
                    finalHouseNumber
                ].filter(Boolean).join(', ');

            const name =
                fullStreet && houseNumber
                    ? `${fullStreet}, ${houseNumber}`
                    : finalAddress ||
                      `Парковка ${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}`;

            const now = Date.now();

            const cleanKeyPart = value =>
                String(value || '')
                    .trim()
                    .replace(/[.#$\/\[\]]/g, '')
                    .replace(/\s+/g, '_')
                    .replace(/_+/g, '_')
                    .replace(/^_|_$/g, '');

            const cityKey =
                cleanKeyPart(detectedCity) || 'Неизвестный_город';

            const parkingData = {
                lat: centerLat,
                lng: centerLng,
                coordinates: coordsToSave,
                totalSpots,
                occupiedSpots: 0,
                name,
                groupId: cityKey,
                isPaid: false,
                address: finalAddress,
                city: detectedCity,
                region: detectedRegion,
                street: finalStreet,
                houseNumber: finalHouseNumber,
                authorId: currentUser.id,
                authorName: currentUser.firstName || currentUser.username || '',
                authorUsername: currentUser.username || '',
                lastUpdatedAt: now,
                lastUpdatedBy:
                    currentUser.nickname ||
                    currentUser.firstName ||
                    currentUser.username ||
                    'Пользователь',
                timestamp: now,
                status: 'unknown',
                statusConfirmations: 0
            };

            if (btn) btn.textContent = 'Подготавливаем сохранение...';

            if (typeof crypto?.randomUUID !== 'function') {
                throw new Error(
                    'Браузер не поддерживает создание безопасного идентификатора операции.'
                );
            }

            operationId = crypto.randomUUID();
            requestParkingData = parkingData;

            // Сначала сохраняем операцию локально, только потом отправляем серверу.
            localStorage.setItem(
                pendingStorageKey,
                JSON.stringify({
                    operationId,
                    fingerprint,
                    payload: requestParkingData
                })
            );
        }

        // 5. Отправляем запрос. При повторе operationId и payload не меняются.
        if (btn) btn.textContent = 'Сохраняем парковку...';

        const response = await fetch(
            `${window.PARKNEAR_API_URL}/api/parkings`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`,
                    'Idempotency-Key': operationId
                },
                body: JSON.stringify(requestParkingData)
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success || !result.id) {
            throw new Error(
                result.error || 'Не удалось сохранить парковку'
            );
        }

        // 6. Удаляем незавершённую операцию только после подтверждения сервера.
        localStorage.removeItem(pendingStorageKey);

        const parkingKey = result.id;
        const savedParkingData = result.parking || {
            ...requestParkingData,
            id: parkingKey
        };

        console.log('Парковка сохранена в PostgreSQL:', parkingKey);

        // Обновляем локальный кэш.
        parkingDataCache[parkingKey] = {
            ...savedParkingData,
            id: parkingKey
        };

        // Добавляем маркер на карту.
        try {
            addMarkerToMap(parkingKey, savedParkingData);
        } catch (error) {
            console.warn('Маркер не добавлен:', error);
        }

        // Удаляем нарисованный полигон.
        if (drawingPolygon) {
            try {
                map.geoObjects.remove(drawingPolygon);
            } catch (error) {
                console.warn('Не удалось удалить полигон:', error);
            }

            drawingPolygon = null;
        }

        // Очищаем временные координаты.
        window.newParkingCoords = null;
        newParkingCoords = null;

        if (map) {
            map.setCenter(
                [centerLat, centerLng],
                17,
                { duration: 500 }
            );
        }

        // Обновляем кластер карты.
        try {
            if (clusterer) {
                clusterer.removeAll();

                Object.entries(parkingDataCache).forEach(([id, parking]) => {
                    const parkingCity = String(
                        parking.city || ''
                    ).trim().toLowerCase();

                    if (
                        parkingCity === detectedCity.trim().toLowerCase()
                    ) {
                        addMarkerToMap(id, parking);
                    }
                });
            }
        } catch (error) {
            console.warn('Ошибка обновления кластера:', error);
        }

        // Обновляем результаты поиска.
        try {
            if (
                typeof filterParkings === 'function' &&
                document.getElementById('searchResults')
            ) {
                filterParkings();
            }
        } catch (error) {
            console.warn('Ошибка обновления списка:', error);
        }

        console.log('ПАРКОВКА УСПЕШНО СОХРАНЕНА');

        if (typeof closePanel === 'function') closePanel();
        if (typeof showMap === 'function') showMap();

    } catch (error) {
        console.error('Критическая ошибка сохранения:', error);

        alert(
            `Не удалось сохранить парковку.\n${error.message || 'Неизвестная ошибка'}`
        );
    } finally {
        if (btn) {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }
}