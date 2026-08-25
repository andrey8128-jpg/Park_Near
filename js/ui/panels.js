    // ===================== ПАНЕЛЬ ПАРКОВКИ =====================
    function openParkingSheet(parkingId, data) {
    // Получаем элементы bottom-sheet
    var sheet = document.getElementById('parkingSheet');
    var content = document.getElementById('sheetContent');
    if (!sheet || !content) {
        console.error('❌ Bottom-sheet элементы не найдены');
        return;
    }

    var addr = data.address || (data.lat && data.lng ? data.lat.toFixed(6) + ', ' + data.lng.toFixed(6) : 'Адрес не указан');
    var free = data.totalSpots - (data.occupiedSpots || 0);

    // Функция рендеринга содержимого с расстоянием
    function renderContent(distKm, driveTime) {
        var html = '';
        html += '<h3>' + data.name + '</h3>';
        html += '<p>📍 ' + addr + '</p>';
        if (distKm !== undefined) {
            html += '<p>📏 ' + distKm + ' км от вас</p>';
            html += '<p>🚗 На авто: ' + driveTime + ' мин</p>';
        } else {
            html += '<p>📏 Расстояние неизвестно</p>';
        }
        html += '<p>🅿️ Свободно: ' + free + ' / ' + data.totalSpots + '</p>';
        html += '<button class="btn-secondary" onclick="openOccupancyPanel(\'' + parkingId + '\')" style="margin-top:12px;">✏️ Редактировать</button>';
        html += '<button class="btn-secondary" onclick="buildRouteToParking(\'' + parkingId + '\')" style="margin-top:8px;">🧭 Построить маршрут</button>';
        content.innerHTML = html;
        sheet.classList.add('active');
    }

    // Пытаемся получить геолокацию для расчёта расстояния
    getUserLocation().then(function(coords) {
        var dist = getDistanceInMeters(coords.lat, coords.lng, data.lat, data.lng);
        var distKm = (dist / 1000).toFixed(1);
        var driveTime = Math.round(dist / 500);
        renderContent(distKm, driveTime);
    }).catch(function() {
        // Если геолокация недоступна – показываем без расстояния
        renderContent();
    });
} 
// ===================== ЦЕНТРАЛЬНОЕ МОДАЛЬНОЕ ОКНО =====================

async function openCenterSheet(parkingId, data) {
    const sheet = document.getElementById('centerSheet');
    const content = document.getElementById('centerSheetContent');

    if (!sheet || !content) return;

    currentParkingId = parkingId;
    currentParkingData = data;
    parkingDataCache[parkingId] = data;

    const total = Number(data.totalSpots) || 0;
    const status = data.status || 'unknown';

    // Статус парковки
    let statusIcon = '⚪';
    let statusTitle = 'Нет свежих данных';
    let statusClass = 'unknown';

    if (status === 'free') {
        statusIcon = '🟢';
        statusTitle = 'Есть места';
        statusClass = 'free';
    } else if (status === 'limited') {
        statusIcon = '🟡';
        statusTitle = 'Мало мест';
        statusClass = 'limited';
    } else if (status === 'occupied') {
        statusIcon = '🔴';
        statusTitle = 'Мест нет';
        statusClass = 'occupied';
    }

    // Время последнего обновления
    let lastUpdatedText = 'Нет данных';

    if (data.lastUpdatedAt) {
        const diff = Date.now() - Number(data.lastUpdatedAt);
        const minutes = Math.floor(diff / 60000);

        if (minutes < 1) {
            lastUpdatedText = 'только что';
        } else if (minutes < 60) {
            lastUpdatedText = `${minutes} мин назад`;
        } else {
            const hours = Math.floor(minutes / 60);

            if (hours < 24) {
                lastUpdatedText = `${hours} ч назад`;
            } else {
                const days = Math.floor(hours / 24);
                lastUpdatedText = `${days} дн назад`;
            }
        }
    }

    // Количество подтверждений
    const confirmations =
        Number(data.statusConfirmations) || 0;

    // Количество парковочных мест
    const totalText = total > 0
        ? `🅿️ ${total} ${getParkingPlacesWord(total)}`
        : '🅿️ Мест неизвестно';

    // Адрес
    const address = data.address
        ? escapeHtml(data.address)
        : 'Адрес не указан';

    const html = `
        <div class="parking-card-compact">

            <div class="parking-card-top">

    <div class="parking-card-title-block">

        <div class="parking-card-title">
             ${escapeHtml(data.name || 'Парковка')}
        </div>

        <div class="parking-card-street">
            ${address}
        </div>

    </div>

</div>


            <div class="parking-status-compact ${statusClass}">

                <span class="parking-status-dot">
                    ${statusIcon}
                </span>

                <strong>
                    ${statusTitle}
                </strong>

            </div>


            <div class="parking-meta">

                <span>
                    ${totalText}
                </span>

                <span>
                    👥 ${confirmations}
                </span>

                <span>
                    🕐 ${lastUpdatedText}
                </span>

            </div>


            <div class="parking-main-actions">

                <button
    class="parking-route-btn"
    onclick="buildRouteToParking('${parkingId}')">
    🧭 Поехать
</button>

                <button
                    class="parking-update-btn"
                    onclick="reportParkingStatus('${parkingId}')">
                    🔄 Обновить
                </button>

            </div>


            <div class="parking-secondary-actions">

                <button
                    class="parking-secondary-btn"
                    onclick="toggleFavoriteCenter()">
                    ⭐ Избранное
                </button>

                <button
                    class="parking-secondary-btn"
                    onclick="editFromCenter()">
                    ✏️ Редактировать
                </button>

            </div>

        </div>
    `;

    content.innerHTML = html;

    sheet.classList.add('active');
}
function reportParkingStatus(parkingId) {
    const sheet = document.getElementById('centerSheet');
    const content = document.getElementById('centerSheetContent');

    if (!content) return;

    const html = `
        <div class="parking-status-panel">

            <div class="parking-status-panel-title">
                Как сейчас выглядит парковка?
            </div>

            <div class="parking-status-panel-subtitle">
                Выберите наиболее подходящий вариант
            </div>

            <button
                class="status-choice status-choice-free"
                onclick="submitParkingStatus('${parkingId}', 'free')">

                <span class="status-choice-icon">🟢</span>

                <span class="status-choice-content">
                    <strong>Есть места</strong>
                    <small>Свободных мест достаточно</small>
                </span>

            </button>

            <button
                class="status-choice status-choice-limited"
                onclick="submitParkingStatus('${parkingId}', 'limited')">

                <span class="status-choice-icon">🟡</span>

                <span class="status-choice-content">
                    <strong>Мало мест</strong>
                    <small>Парковка почти заполнена</small>
                </span>

            </button>

            <button
                class="status-choice status-choice-occupied"
                onclick="submitParkingStatus('${parkingId}', 'occupied')">

                <span class="status-choice-icon">🔴</span>

                <span class="status-choice-content">
                    <strong>Мест нет</strong>
                    <small>Свободное место найти сложно</small>
                </span>

            </button>

            <button
                class="btn-secondary"
                onclick="openCenterSheet('${parkingId}', currentParkingData)"
                style="margin-top:12px;">

                ← Назад

            </button>

        </div>
    `;

    content.innerHTML = html;
}
async function submitParkingStatus(parkingId, status) {

    if (!parkingId) return;

    if (!currentUser || !currentUser.id) {
        alert('Чтобы обновлять состояние парковки, необходимо войти в аккаунт.');
        return;
    }

    const now = Date.now();

    try {

        const parkingRef = database.ref(`parkings/${parkingId}`);

        const snapshot = await parkingRef.once('value');
        const parking = snapshot.val();

        if (!parking) {
            console.error('Парковка не найдена:', parkingId);
            return;
        }

        // ------------------------------------------------------------
        // Увеличиваем количество подтверждений
        // ------------------------------------------------------------

        const confirmations =
            Number(parking.statusConfirmations) || 0;

        // ------------------------------------------------------------
        // Сохраняем новое состояние
        // ------------------------------------------------------------

        await parkingRef.update({

            status: status,

            lastUpdatedAt: now,

            lastUpdatedBy:
                currentUser.nickname ||
                currentUser.firstName ||
                currentUser.username ||
                'Пользователь',

            statusConfirmations: confirmations + 1

        });

        // ------------------------------------------------------------
        // Сохраняем событие в историю
        // ------------------------------------------------------------

        await parkingRef.child('history').push({

            action: 'status_update',

            status: status,

            timestamp: now,

            userId: currentUser.id,

            username:
                currentUser.username ||
                currentUser.firstName ||
                ''

        });

        // ------------------------------------------------------------
        // Обновляем локальные данные
        // ------------------------------------------------------------

        const updatedData = {
            ...parking,

            status: status,

            lastUpdatedAt: now,

            statusConfirmations: confirmations + 1,

            lastUpdatedBy:
                currentUser.nickname ||
                currentUser.firstName ||
                currentUser.username ||
                'Пользователь'
        };

        currentParkingData = updatedData;
        parkingDataCache[parkingId] = updatedData;

        // ------------------------------------------------------------
        // Обновляем маркер на карте
        // ------------------------------------------------------------

        try {
            refreshParkingMarker();
        } catch (e) {
            console.warn(
                'Не удалось обновить маркер:',
                e
            );
        }

        // ------------------------------------------------------------
        // Показываем обновлённую карточку
        // ------------------------------------------------------------

        await openCenterSheet(
            parkingId,
            updatedData
        );

        // ------------------------------------------------------------
        // Вибрация Telegram
        // ------------------------------------------------------------

        if (
            window.Telegram &&
            window.Telegram.WebApp &&
            window.Telegram.WebApp.HapticFeedback
        ) {

            try {

                window.Telegram.WebApp.HapticFeedback
                    .notificationOccurred('success');

            } catch (e) {}

        }

    } catch (error) {

        console.error(
            'Ошибка обновления состояния парковки:',
            error
        );

        alert(
            'Не удалось обновить состояние парковки.'
        );
    }
}
function getParkingPlacesWord(number) {

    number = Math.abs(Number(number));

    const lastTwo = number % 100;
    const lastOne = number % 10;

    if (
        lastTwo >= 11 &&
        lastTwo <= 19
    ) {
        return 'мест';
    }

    if (lastOne === 1) {
        return 'место';
    }

    if (
        lastOne >= 2 &&
        lastOne <= 4
    ) {
        return 'места';
    }

    return 'мест';
}
function closeCenterSheet() {
    document.getElementById('centerSheet').classList.remove('active');
    currentParkingId = null;
    currentParkingData = null;

    if (activePolygon) {
        activePolygon.options.set('visible', false);
        activePolygon = null;
    }

    // Восстанавливаем центр и зум 16 (если центр сохранён)
    if (map && previousCenter) {
        try {
            map.setCenter(previousCenter, 16, { duration: 300 });
            previousCenter = null;
            previousZoom = null;
        } catch (e) {
            console.warn('Ошибка восстановления:', e);
        }
    } else if (map) {
        // Если центр не сохранён, просто ставим зум 16
        map.setZoom(16, { duration: 300 });
    }
}
function generateForecastText(forecastData, now) {
    if (!forecastData || forecastData.length === 0) {
        return 'Прогноз недоступен';
    }
    // Берём прогноз на 2-й час (индекс 1) – можно настроить
    const index = Math.min(1, forecastData.length - 1);
    const forecast = forecastData[index];
    const timeStr = forecast.time;
    const value = forecast.value;
    // Добавляем окончание для слова "мест"
    const places = value % 10 === 1 && value % 100 !== 11 ? 'место' : (value % 10 >= 2 && value % 10 <= 4 && (value % 100 < 10 || value % 100 >= 20) ? 'места' : 'мест');
    return `Ожидается примерно <b>${value}</b> ${places} к <b>${timeStr}</b>`;
}
async function loadForecastForEdit(parkingId) {
    const container = document.getElementById('forecastContainerInEdit');
    if (!container) return;

    const data = parkingDataCache[parkingId];
    if (!data) return;

    const now = new Date();
    const free = data.totalSpots - (data.occupiedSpots || 0);

    try {
        const forecastData = await generateForecastData(now, free, parkingId);
        const chartHtml = renderForecastChart(forecastData);
        const text = generateForecastText(forecastData, now);

        const textContainer = container.querySelector('.center-forecast-text');
        if (textContainer) textContainer.innerHTML = text;

        const placeholder = document.getElementById('forecastChartPlaceholderInEdit');
        if (placeholder) {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = chartHtml;
            placeholder.parentNode.replaceChild(wrapper.firstElementChild, placeholder);
        }
    } catch (e) {
        console.warn('Ошибка загрузки прогноза:', e);
        const textContainer = container.querySelector('.center-forecast-text');
        if (textContainer) textContainer.innerHTML = 'Прогноз временно недоступен';
        const placeholder = document.getElementById('forecastChartPlaceholderInEdit');
        if (placeholder) {
            placeholder.innerHTML = '<div style="color:var(--text-secondary);">Прогноз недоступен</div>';
        }
    }
}
// Генерация прогноза на основе истории за 7 дней
async function generateForecastData(now, currentFree, parkingId) {
    // Если parkingId не указан, возвращаем заглушку
    if (!parkingId) {
        const data = [];
        for (let i = 1; i <= 5; i++) {
            const future = new Date(now.getTime() + i * 60 * 60 * 1000);
            const timeStr = future.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            const base = currentFree + i * 0.8 + Math.random() * 2 - 1;
            const value = Math.max(0, Math.round(base));
            data.push({ time: timeStr, value });
        }
        return data;
    }

    // Загружаем историю за последние 7 дней (максимум 200 записей)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const snapshot = await database.ref(`parkings/${parkingId}/history`)
        .orderByChild('timestamp')
        .startAt(sevenDaysAgo)
        .limitToLast(200)
        .once('value');
    const history = snapshot.val();

    // Если истории нет или она пуста, используем простой тренд
    if (!history) {
        const data = [];
        for (let i = 1; i <= 5; i++) {
            const future = new Date(now.getTime() + i * 60 * 60 * 1000);
            const timeStr = future.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            const base = currentFree - i * 0.5 + Math.random() * 1.5;
            const value = Math.max(0, Math.round(base));
            data.push({ time: timeStr, value });
        }
        return data;
    }

    // Группируем записи по часам (0-23)
    const hourlyData = {};
    const entries = Object.values(history);
    entries.forEach(entry => {
        const dt = new Date(entry.timestamp);
        const hour = dt.getHours();
        if (!hourlyData[hour]) hourlyData[hour] = [];
        hourlyData[hour].push(entry.newOccupied || entry.occupiedSpots || 0);
    });

    // Вычисляем среднее для каждого часа
    const hourlyAvg = {};
    Object.keys(hourlyData).forEach(hour => {
        const values = hourlyData[hour];
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        hourlyAvg[hour] = Math.round(avg);
    });

    // Получаем общее количество мест
    const totalSpots = parkingDataCache[parkingId]?.totalSpots || 20;

    // Строим прогноз на 5 часов вперёд
    const forecast = [];
    for (let i = 1; i <= 5; i++) {
        const future = new Date(now.getTime() + i * 60 * 60 * 1000);
        const hour = future.getHours();
        const timeStr = future.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        let value;
        if (hourlyAvg[hour] !== undefined) {
            // Используем среднее за этот час
            value = hourlyAvg[hour];
        } else {
            // Если данных для этого часа нет, используем ближайший существующий час
            const hours = Object.keys(hourlyAvg).map(Number).sort((a, b) => a - b);
            let closest = hours[0];
            let minDiff = 24;
            hours.forEach(h => {
                const diff = Math.abs(h - hour);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = h;
                }
            });
            if (closest !== undefined) {
                value = hourlyAvg[closest];
            } else {
                // Совсем нет данных – тренд
                value = Math.max(0, Math.round(currentFree - i * 0.5));
            }
        }
        // Корректируем, чтобы не выходить за пределы
        value = Math.max(0, Math.min(totalSpots, value));
        forecast.push({ time: timeStr, value });
    }

    return forecast;
}
// Отрисовка линейного графика в SVG
function renderForecastChart(data) {
    if (!data || data.length === 0) return '';

    const maxVal = Math.max(...data.map(d => d.value), 1);
    const padding = { top: 10, bottom: 20, left: 5, right: 5 };
    const width = 300;  // базовый размер, масштабируется через viewBox
    const height = 80;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const points = data.map((d, i) => {
        const x = padding.left + (i / (data.length - 1)) * chartWidth;
        const y = padding.top + chartHeight - (d.value / maxVal) * chartHeight;
        return { x, y, value: d.value, time: d.time };
    });

    const linePath = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
    const areaPath = 'M' + points[0].x.toFixed(1) + ',' + (padding.top + chartHeight) + ' ' +
        points.map(p => 'L' + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ') +
        ' L' + points[points.length-1].x.toFixed(1) + ',' + (padding.top + chartHeight) + ' Z';

    // Метки времени (под осью X)
    const labels = points.map(p =>
        `<text x="${p.x}" y="${height - 2}" text-anchor="middle" class="forecast-chart-axis">${p.time}</text>`
    ).join('');

    // Точки
    const dots = points.map(p =>
        `<circle cx="${p.x}" cy="${p.y}" r="3" class="forecast-chart-dot" />`
    ).join('');
    // Подписи значений (над точками)
    const valueLabels = points.map(p =>
        `<text x="${p.x}" y="${p.y - 6}" text-anchor="middle" font-size="8" fill="var(--text-secondary)">${p.value}</text>`
    ).join('');
    return `
        <div class="forecast-chart-container">
            <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
                <!-- Область под графиком -->
                <path d="${areaPath}" class="forecast-chart-area" />
                <!-- Линия -->
                <path d="${linePath}" class="forecast-chart-line" />
                <!-- Точки -->
                ${dots}
                <!-- Подписи значений -->
                ${valueLabels}
                <!-- Метки времени -->
                ${labels}
            </svg>
        </div>
    `;
}
function toggleFavoriteCenter() {
    if (!currentParkingId || !currentParkingData) return;
    const parkingId = currentParkingId;
    const data = currentParkingData;
    toggleFavorite(parkingId, data);
    // Окно не закрываем – кнопка обновится внутри toggleFavorite
}
function buildRouteFromCenter() {
    if (!currentParkingId) return;
    const parkingId = currentParkingId;
    closeCenterSheet();
    buildRouteToParking(parkingId);
}
function editFromCenter() {
    if (!currentParkingId) return;
    const parkingId = currentParkingId;
    closeCenterSheet();
    openOccupancyPanel(parkingId);
}
