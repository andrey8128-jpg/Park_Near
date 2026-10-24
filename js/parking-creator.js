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
    if (!parkingId) return showToast('ID парковки не найден');
    if (!confirm('Вы уверены, что хотите удалить эту парковку?')) return;
    try {
        const parking = parkingDataCache[parkingId];
        if (!parking) return showToast('Парковка не найдена в кэше');
        if (parking.authorId !== currentUser.id) {
            return showToast('Удалять парковку может только её автор');
        }
        // ✅ Используем groupId для правильного пути
        const groupId = parking.groupId;
        if (!groupId) throw new Error('Не найден ID группы парковки');
        const ref = database.ref(`parkings/${groupId}/${parkingId}`);
        await ref.remove();
        // Удаляем Placemark и Polygon корректно
        const placemark = mapMarkers[parkingId];
        if (placemark) {
            const polygon = placemark.properties.get('polygon');
            if (polygon) map.geoObjects.remove(polygon);
            if (clusterer) clusterer.remove(placemark);
            delete mapMarkers[parkingId];
        }
        if (activePolygon && activePolygon.__parkingId === parkingId) {
            map.geoObjects.remove(activePolygon);
            activePolygon = null;
        }
        delete parkingDataCache[parkingId];
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
    const totalSpots = parseInt(document.getElementById('parkSpots')?.value, 10);
    if (!currentUser) {
        console.error('❌ Пользователь не авторизован');
        return;
    }
    if (!totalSpots || totalSpots < 1) {
        alert('Укажите количество парковочных мест');
        return;
    }
    let coordsToSave = window.newParkingCoords || newParkingCoords;
    if (!coordsToSave && drawingPolygon?.geometry) {
        const raw = drawingPolygon.geometry.getCoordinates()[0];
        coordsToSave = raw.map(c => [Number(c[0]), Number(c[1])]);
    }
    if (!coordsToSave || coordsToSave.length < 3) {
        console.error('❌ Координаты парковки не найдены');
        alert('Не найдены координаты парковочной зоны');
        return;
    }
    const btn = document.getElementById('saveParkBtn');
    const originalText = btn?.textContent || 'Сохранить парковку';
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Определяем адрес...';
    }
    try {
        const centerLat = coordsToSave.reduce((sum, c) => sum + Number(c[0]), 0) / coordsToSave.length;
        const centerLng = coordsToSave.reduce((sum, c) => sum + Number(c[1]), 0) / coordsToSave.length;
        if (btn) btn.textContent = 'Определяем город...';
        const geoData = await getAddressByCoordinates(centerLat, centerLng);
        let detectedCity = String(geoData?.city || currentCity || mapCity?.city || userCityPrefs?.city || '').trim();
        const detectedRegion = String(geoData?.region || mapCity?.region || userCityPrefs?.region || '').trim();
        const detectedAddress = String(geoData?.address || '').trim();
        const detectedStreet = String(geoData?.street || '').trim();
        const detectedHouseNumber = String(geoData?.houseNumber || '').trim();
        if (!detectedCity) {
            detectedCity = String(currentCity || mapCity?.city || userCityPrefs?.city || '').trim();
        }
        const fullStreet = streetType && streetName ? `${streetType} ${streetName}` : streetName;
        const finalStreet = fullStreet || detectedStreet;
        const finalHouseNumber = houseNumber || detectedHouseNumber;
        const finalAddress = detectedAddress || [detectedCity, finalStreet, finalHouseNumber].filter(Boolean).join(', ');
        const name = fullStreet && houseNumber ? `${fullStreet}, ${houseNumber}` : finalAddress || `Парковка ${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}`;
        const now = Date.now();
        // Функция для очистки ключей (убирает запрещенные символы)
        const cleanKeyPart = value => String(value || '').trim().replace(/[.#$\/\[\]]/g, '').replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        // Формируем ключи пути: город / улица / дом
        const cityKey = cleanKeyPart(detectedCity) || 'Неизвестный_город';
        const streetKey = cleanKeyPart(finalStreet) || 'Неизвестная_улица';
        const houseKey = cleanKeyPart(finalHouseNumber) || 'Без_дома';
        // Ключ для конкретной уникальной парковки (город + улица + дом)
        const cityKey = cleanKeyPart(detectedCity);
        const streetKey = cleanKeyPart(finalStreet) || 'Неизвестная_улица';
        const houseKey = cleanKeyPart(finalHouseNumber) || 'Без_дома';
        const baseKey = `${cityKey}_${streetKey}_${houseKey}`;
        const parkingData = {
            lat: centerLat,
            lng: centerLng,
            coordinates: coordsToSave,
            totalSpots,
            occupiedSpots: 0,
            name,
            groupId: cityKey, // ✅ Сохраняем ID группы внутри данных!
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
            lastUpdatedBy: currentUser.nickname || currentUser.firstName || currentUser.username || 'Пользователь',
            timestamp: now,
            status: 'unknown',
            statusConfirmations: 0
        };
       
let number = 1;
let parkingKey = '';
let committed = false;
let parkingPath = '';
let parkingRef = null;
const MAX_ATTEMPTS = 50;
    if (btn) btn.textContent = 'Сохраняем...';
while (!committed && number <= MAX_ATTEMPTS) {
    parkingKey = `${houseKey}(${number})`;

    parkingPath =
        `parkings/${cityKey}/${streetKey}/${houseKey}/${parkingKey}`;
        parkingRef = database.ref(parkingPath);
    const txResult = await parkingRef.transaction(currentData => {
        if (currentData !== null) return undefined;
        return parkingData;
    });
    committed = txResult.committed;
        if (!committed) number++;
}
if (!committed || !parkingRef) {
    throw new Error(
        'Не удалось подобрать свободный идентификатор парковки. Попробуйте ещё раз.'
    );
}
        console.log('Путь парковки:', parkingPath);
        console.log('Ключ парковки:', parkingKey);
        console.log('🔑 Группа:', groupNameKey, '| Ключ парковки:', parkingKey);
        try {
            await database.ref(`users/${currentUser.id}/stats/parkingsCreated`).transaction(count => (count || 0) + 1);
        } catch (error) {
            console.warn('⚠️ Не удалось обновить статистику:', error);
        }
        try {
            await parkingRef.child('history').push({
                action: 'created',
                timestamp: now,
                userId: currentUser.id,
                username: currentUser.username || ''
            });
        } catch (error) {
            console.warn('⚠️ Не удалось сохранить history:', error);
        }
        parkingDataCache[parkingKey] = { ...parkingData, id: parkingKey, _dbPath: parkingPath};
        try {
            addMarkerToMap(parkingKey, parkingData);
        } catch (error) {
            console.warn('⚠️ Маркер не добавлен:', error);
        }
        if (drawingPolygon) {
            try {
                map.geoObjects.remove(drawingPolygon);
            } catch (error) {
                console.warn('⚠️ Не удалось удалить полигон:', error);
            }
            drawingPolygon = null;
        }
        window.newParkingCoords = null;
        newParkingCoords = null;
        if (map) {
            map.setCenter([centerLat, centerLng], 17, { duration: 500 });
        }
        try {
            if (clusterer) {
                clusterer.removeAll();
                Object.entries(parkingDataCache).forEach(([id, parking]) => {
                    const parkingCity = String(parking.city || '').trim().toLowerCase();
                    if (parkingCity === detectedCity.trim().toLowerCase()) {
                        addMarkerToMap(id, parking);
                    }
                });
            }
        } catch (error) {
            console.warn('⚠️ Ошибка обновления кластера:', error);
        }
        try {
            if (typeof filterParkings === 'function' && document.getElementById('searchResults')) {
                filterParkings();
            }
        } catch (error) {
            console.warn('⚠️ Ошибка обновления списка:', error);
        }
        console.log('✅ ПАРКОВКА ПОЛНОСТЬЮ СОХРАНЕНА');
        if (typeof closePanel === 'function') closePanel();
        if (typeof showMap === 'function') showMap();
    } catch (error) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА СОХРАНЕНИЯ:', error);
        alert(`Не удалось сохранить парковку.\n${error.message || 'Неизвестная ошибка'}`);
    } finally {
        if (btn) {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }
}
window.startDrawingMode = startDrawingMode;
