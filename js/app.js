// ===================== FIREBASE =====================
    const firebaseConfig = {
        apiKey: "AIzaSyATLX5t2lmibbuiSXL_sWu_JnFFTb-nMqU",
        authDomain: "parknear-bef41.firebaseapp.com",
        databaseURL: "https://parknear-bef41-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "parknear-bef41",
        storageBucket: "parknear-bef41.firebasestorage.app",
        messagingSenderId: "1066552333578",
        appId: "1:1066552333578:web:e60e333cf877852eba16f3"
    };
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
// API Park Near на Timeweb
window.PARKNEAR_API_URL =
    'https://andrey8128-jpg-park-near-3eb7.twc1.net';
async function patchParkingInPostgres(parkingId, updates) {
    const token = localStorage.getItem('parkNearSessionToken');
    if (!token) {
        throw new Error('Необходимо авторизоваться');
    }
    const response = await fetch(
        `${window.PARKNEAR_API_URL}/api/parkings/${encodeURIComponent(parkingId)}`,
        {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updates)
        }
    );
    const result = await response.json();
    if (!response.ok || !result.success) {
        throw new Error(result.error || 'Ошибка обновления парковки');
    }
    return result.parking;
}
    // ===== Восстановление темы (с сохранением правильных цветов маркеров) =====
   (function restoreTheme() {
    const darkTheme = localStorage.getItem('darkTheme');
    const isDark = darkTheme === '1';
    if (isDark) {
        document.body.classList.add('dark-theme');
        if (!document.getElementById('dark-map-style')) {
            const mapStyle = document.createElement('style');
            mapStyle.id = 'dark-map-style';
            mapStyle.textContent = `
                .dark-theme #map .ymaps-2-1-game-layer,
                .dark-theme #map [class*="ymaps-2-1-17-events-pane"] {
                    filter: invert(0.9) hue-rotate(180deg) brightness(0.9) contrast(0.9) saturate(0.8) !important;
                }
            `;
            document.head.appendChild(mapStyle);
        }
        if (window.Telegram?.WebApp) {
            try {
                window.Telegram.WebApp.setHeaderColor('#1C1C1E');
                window.Telegram.WebApp.setBackgroundColor('#000000');
            } catch (e) {
                console.warn('Не удалось изменить цвета Telegram:', e);
            }
        }
    }
    const toggle1 = document.getElementById('settingsThemeToggle');
    const toggle2 = document.getElementById('settingsThemeToggleInline');
    if (toggle1) toggle1.checked = isDark;
    if (toggle2) toggle2.checked = isDark;
})();
    // ===================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====================
    let map = null;
    let currentCity = null; // или 'Москва' по умолчанию
    let currentUser = null;
    let lastKnownLocation = null;
    let mapMarkers = {};
    let myLocationPlacemark = null;
    let addressPreviewMarker = null;
    let _parkingFormCoords = null;
    let _parkingFormSizeCheck = null;
    let previousZoom = null;
    let previousCenter = null;
    let drawingPolygon = null;
    let clusterer = null;
    let activePolygon = null; 
    let isDrawingMode = false;
    let currentParkingId = null;
    let currentParkingData = null;
    // Защита от повторного запуска парковочной сессии
    let isStartingParkingSession = false;
    let originalPolyCoords = null;
    let editingParkingId = null;
    let editingPolygon = null;
    let mapCity = null;
    let Id = null;
    let parkingDataCache = {};
    let highlightedParkings = {};
    let lastClickTime = 0;
    let lastDataRefresh = 0;
    const REFRESH_INTERVAL_MS = 60000;
    let lastClickParkingId = null;
    let clickTimeout = null;
    const MAX_ZONE_WIDTH = 100;
    const MAX_ZONE_LENGTH = 100;
    let addressPickerMap = null;
    let addressPickerPlacemark = null;
    let addressPickerCoords = null;
    let isAddressPickerOpen = false;
    let currentRoute = null;
    let routeStartCoords = null;
    let routeEndCoords = null;
    let routeParkingData = null;
    let userCityPrefs = { region: '', city: '' };
    let cityCoords = null;
    const CITY_RADIUS = 3000;
    let nearbySearchFilter = null;
    let userLocationForSearch = null;
    let pendingAddressData = null;
    let newParkingCoords = null;

function getParkingRef(parkingId) {
    const parking = parkingDataCache?.[parkingId];
    // Предпочитаем полный путь, сохранённый при загрузке
    if (parking?._dbPath) {
        return database.ref(parking._dbPath);
    }
    // Совместимость со старой структурой базы
    if (parking?.groupId) {
        return database.ref(
            `parkings/${parking.groupId}/${parkingId}`
        );
    }
    return database.ref(`parkings/${parkingId}`);
}
// ===================== ВОССТАНОВЛЕНИЕ ГОРОДА =====================
const savedCity = localStorage.getItem('selectedCity');
const savedMapPrefs = localStorage.getItem('parknear_map_city');
const savedUserCity = localStorage.getItem('parknear_city');
let mapPrefs = {};
let userPrefs = {};
try {
    mapPrefs = JSON.parse(savedMapPrefs || '{}');
} catch (e) {
    console.warn('Не удалось восстановить настройки города карты:', e);
}
try {
    userPrefs = JSON.parse(savedUserCity || '{}');
} catch (e) {
    console.warn('Не удалось восстановить настройки города пользователя:', e);
}
currentCity = String(
    savedCity ||
    mapPrefs.city ||
    userPrefs.city ||
    ''
).trim();
mapCity = currentCity
    ? {
        city: currentCity,
        region: mapPrefs.region || userPrefs.region || ''
    }
    : null;
console.log('🏙️ Восстановленный город карты:', currentCity);
    // ===================== УТИЛИТЫ =====================
  function getOccupancyColor(occupied, total) {
    const occupiedCount = Number(occupied) || 0;
    const totalCount = Number(total) || 0;
    if (totalCount <= 0) return getComputedStyle(document.body).getPropertyValue('--gray').trim() || '#8E8E93';
    const ratio = Math.max(0, Math.min(1, occupiedCount / totalCount));
    if (ratio < 0.5) return getComputedStyle(document.body).getPropertyValue('--green').trim() || '#30D158';
    if (ratio < 0.9) return getComputedStyle(document.body).getPropertyValue('--orange').trim() || '#FF9F0A';
    return getComputedStyle(document.body).getPropertyValue('--red').trim() || '#FF453A';
}
// ===== ВИДИМЫЕ ПАРКОВКИ (для кружка) =====
function getVisibleParkings() {
    if (!map) return Object.values(parkingDataCache);
    var bounds = map.getBounds();
    if (!bounds) return Object.values(parkingDataCache);
    var southWest = bounds[0];
    var northEast = bounds[1];
    return Object.values(parkingDataCache).filter(function(p) {
        if (!p.lat || !p.lng) return false;
        return p.lat >= southWest[0] && p.lat <= northEast[0] &&
               p.lng >= southWest[1] && p.lng <= northEast[1];
    });
}
// ===================== ОБНОВЛЕНИЕ КРУЖКА С ОБЩИМ КОЛИЧЕСТВОМ =====================
function updateTotalFreeCircle() {
    const allParkings = Object.values(parkingDataCache);
    const totalFree = allParkings.reduce((sum, p) => {
        const total = Number(p.totalSpots) || 0;
        const occupied = Number(p.occupiedSpots) || 0;
        const free = Math.max(0, total - occupied);
        return sum + free;
    }, 0);
    const countEl = document.getElementById('totalFreeCount');
    if (countEl) countEl.textContent = totalFree;
    const circle = document.getElementById('totalFreeCircle');
    if (circle) {
        if (totalFree === 0) {
            circle.style.backgroundColor = 'var(--red)';
        } else if (totalFree < 10) {
            circle.style.backgroundColor = 'var(--orange)';
        } else {
            circle.style.backgroundColor = 'var(--accent)';
        }
    }
}
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}
function getOccupancyDotColor(free, total) {
    const freeCount = Number(free) || 0;
    const totalCount = Number(total) || 0;
    if (totalCount <= 0) return 'var(--gray)';
    const ratio = Math.max(0, Math.min(1, freeCount / totalCount));
    if (ratio >= 0.5) return 'var(--green)';
    if (ratio >= 0.2) return 'var(--orange)';
    return 'var(--red)';
}
function getDistanceInMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (Number(lat2) - Number(lat1)) * Math.PI / 180;
    const dLng = (Number(lng2) - Number(lng1)) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(Number(lat1) * Math.PI / 180) * Math.cos(Number(lat2) * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function renderParkingItem(parking, userCoords) {
const total = Number(parking.totalSpots) || 0;
const occupied = Number(parking.occupiedSpots) || 0;
let status = 'unknown';
if (total > 0) {
    const ratio = occupied / total;
    if (ratio >= 0.9) {
        status = 'occupied';
    } else if (ratio >= 0.6) {
        status = 'limited';
    } else {
        status = 'free';
    }
}
const statusLabels = {
    free: 'Есть места',
    limited: 'Мало мест',
    occupied: 'Мест нет',
    unknown: 'Нет данных'
};
const badgeClass = status;
const badgeText = statusLabels[status];
    let distanceHtml = '';
    const lat = Number(parking.lat);
    const lng = Number(parking.lng);
    if (userCoords && Number.isFinite(lat) && Number.isFinite(lng)) {
        const dist = getDistanceInMeters(userCoords.lat, userCoords.lng, lat, lng);
        const distStr = dist < 1000 ? `${Math.round(dist)} м` : `${(dist / 1000).toFixed(1)} км`;
        const time = Math.max(1, Math.round(dist / 500));
        const timeStr = dist < 500 ? '<1 мин' : `${time} мин`;
        distanceHtml = `<div class="meta-row"><span>${escapeHtml(distStr)}</span><span class="dot">·</span><span>${escapeHtml(timeStr)}</span></div>`;
    }
    const safeName = escapeHtml(parking.name || 'Без названия');
    const safeBadge = escapeHtml(String(badgeText));
    const parkingId = escapeHtml(parking.id || '');
    return `
        <div class="parking-item" onclick="focusMap(${lat}, ${lng}, '${parkingId}')">
            <div class="info">
                <div class="parking-item-header">
                    <div class="name">${safeName}</div>
                    <span class="parking-status-badge ${badgeClass}">${safeBadge}</span>
                </div>
                ${distanceHtml}
            </div>
        </div>
    `;
}

function getParkingAddressParts(parking) {
    const parsed = typeof parseAddress === 'function'
        ? (parseAddress(parking.address || '') || {})
        : {};

    const street = String(
        parking.street || parsed.street || ''
    ).trim();

    const houseNumber = String(
        parking.houseNumber || parsed.houseNumber || ''
    ).trim();

    return {
        street: street || 'Улица не указана',
        houseNumber: houseNumber || 'Дом не указан'
    };
}

function getParkingGroupStatus(parkings) {
    let total = 0;
    let occupied = 0;

    parkings.forEach(function(parking) {
        total += Number(parking.totalSpots) || 0;
        occupied += Number(parking.occupiedSpots) || 0;
    });

    if (total <= 0) return 'Нет данных';
    const ratio = occupied / total;

    if (ratio >= 0.9) return 'Мест нет';
    if (ratio >= 0.6) return 'Мало мест';

    return 'Есть места';
}

function toggleParkingGroup(groupId) {
    const group = document.getElementById(groupId);
    const button = document.getElementById(groupId + '-button');

    if (!group || !button) return;

    const isHidden = group.hidden;
    group.hidden = !isHidden;
    button.setAttribute('aria-expanded', String(isHidden));
}

function renderGroupedParkingList(container, parkings, userCoords) {
    if (!parkings || parkings.length === 0) {
        container.innerHTML =
            '<div class="empty-state"><p>Нет парковок</p></div>';
        return;
    }

    const groups = new Map();

    parkings.forEach(function(parking) {
        const address = getParkingAddressParts(parking);
        const key = [
            address.street.toLocaleLowerCase('ru'),
            address.houseNumber.toLocaleLowerCase('ru')
        ].join('|');

        if (!groups.has(key)) {
            groups.set(key, {
                street: address.street,
                houseNumber: address.houseNumber,
                parkings: []
            });
        }
        groups.get(key).parkings.push(parking);
    });
    let html = '';
    let index = 0;
    groups.forEach(function(group) {
        const groupId = 'parking-group-' + index++;
        const title = group.street + ', ' + group.houseNumber;
        const status = getParkingGroupStatus(group.parkings);
        const count = group.parkings.length;

        html += `
            <section class="parking-address-group">
                <button
                    type="button"
                    class="parking-address-heading"
                    id="${groupId}-button"
                    aria-expanded="false"
                    aria-controls="${groupId}"
                    onclick="toggleParkingGroup('${groupId}')"
                >
                    <span class="parking-address-info">
                        <span class="parking-address-title">
                            ${escapeHtml(title)}
                        </span>
                        <span class="parking-address-meta">
                            ${count} парковок · ${escapeHtml(status)}
                        </span>
                    </span>
                    <span class="parking-address-arrow">⌄</span>
                </button>
                <div id="${groupId}" hidden>
                    ${group.parkings.map(function(parking) {
                        return renderParkingItem(parking, userCoords);
                    }).join('')}
                </div>
            </section>
        `;
    });
    container.innerHTML = html;
}
function formatDateTime(timestamp) {
    if (!timestamp) return 'Неизвестно';
    const d = new Date(Number(timestamp));
    if (Number.isNaN(d.getTime())) return 'Неизвестно';
    return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth() + 1).toString().padStart(2,'0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}
   // ===================== ТОЧНЫЙ РАСЧЁТ ПАРКОВОЧНЫХ МЕСТ =====================
function calculatePolygonArea(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length < 3) return 0;
    const validCoords = coordinates.filter(c =>
        Array.isArray(c) &&
        c.length >= 2 &&
        Number.isFinite(Number(c[0])) &&
        Number.isFinite(Number(c[1]))
    );
    if (validCoords.length < 3) return 0;
    const firstLat = Number(validCoords[0][0]);
    const firstLng = Number(validCoords[0][1]);
    const latMeter = 111320;
    const points = validCoords.map(c => {
        const lat = Number(c[0]);
        const lng = Number(c[1]);
        const dy = (lat - firstLat) * latMeter;
        const dx = (lng - firstLng) * latMeter * Math.cos(firstLat * Math.PI / 180);
        return { x: dx, y: dy };
    });
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
}
function calculateParkingSpots(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length < 3) return 0;
    const settings = getUserParkingSettings() || {};
    const spotArea = Number(settings.spotArea) > 0 ? Number(settings.spotArea) : 12.5;
    const area = calculatePolygonArea(coordinates);
    if (!Number.isFinite(area) || area <= 0) return 0;
    return Math.max(0, Math.floor(area / spotArea));
}
function parseAddress(fullAddress, regionsData = window.regionsData) {
    // Результат по умолчанию
    const defaultResult = { region: '', city: '', street: '', houseNumber: '' };
    if (!fullAddress || typeof fullAddress !== 'string') {
        return defaultResult;
    }
    if (!regionsData || typeof regionsData !== 'object') {
        console.warn('parseAddress: regionsData не определён или не является объектом');
        return defaultResult;
    }
    // Нормализация: убираем "Россия", лишние пробелы, приводим к нижнему регистру для сравнения
    let addr = fullAddress
        .replace(/^Россия,\s*/i, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    // Если после удаления "Россия" ничего не осталось
    if (!addr) return defaultResult;
    // 1. Извлечение номера дома (ищем в конце строки, после запятой или после "д.")
    let houseNumber = '';
    const houseRegex = /(?:^|,\s*|[дД]\.?\s*|[Дд]ом\s*)(\d+[а-я]?(?:\s*[/\\]\s*\d+)?(?:\s*[кК]\.?\s*\d+)?)\s*(?:$|,|$)/;
    const houseMatch = addr.match(houseRegex);
    if (houseMatch) {
        houseNumber = houseMatch[1].trim();
        // Удаляем найденный номер дома из строки, включая возможный разделитель
        addr = addr.replace(houseMatch[0], '').trim();
        // Убираем лишние запятые в конце/начале
        addr = addr.replace(/^,\s*/, '').replace(/\s*,$/, '');
    }
    // Экранирование специальных символов для RegExp
    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    // 2. Построение индекса "город → регион" для быстрого поиска
    const cityToRegion = new Map();
    for (const [region, cities] of Object.entries(regionsData)) {
        if (Array.isArray(cities)) {
            cities.forEach(city => {
                // Если город уже есть в индексе, возможно, он принадлежит нескольким регионам.
                // Мы запоминаем первый найденный регион, но можно хранить массив.
                if (!cityToRegion.has(city)) {
                    cityToRegion.set(city, region);
                }
            });
        }
    }
    // 3. Поиск города (с учётом границ слова)
    let foundCity = '';
    let foundRegion = '';
    // Сортируем города по длине (сначала самые длинные) для избежания частичных совпадений
    const sortedCities = [...cityToRegion.keys()].sort((a, b) => b.length - a.length);
    // Ищем город в адресе
    for (const city of sortedCities) {
        const escapedCity = escapeRegex(city);
        const cityRegex = new RegExp(`\\b${escapedCity}\\b`, 'i');
        if (cityRegex.test(addr)) {
            foundCity = city;
            foundRegion = cityToRegion.get(city);
            break;
        }
    }
    // Если город найден, удаляем его из адреса
    if (foundCity) {
        const escapedCity = escapeRegex(foundCity);
        const cityRegex = new RegExp(`\\b${escapedCity}\\b`, 'i');
        addr = addr.replace(cityRegex, '').trim();
        addr = addr.replace(/^,\s*/, '').replace(/\s*,$/, '');
    }
    // 4. Поиск региона, если город не дал однозначного региона или регион не найден
    if (!foundRegion) {
        // Пытаемся найти регион напрямую (например, "Московская область")
        const sortedRegions = Object.keys(regionsData).sort((a, b) => b.length - a.length);
        for (const region of sortedRegions) {
            const escapedRegion = escapeRegex(region);
            const regionRegex = new RegExp(`\\b${escapedRegion}\\b`, 'i');
            if (regionRegex.test(addr)) {
                foundRegion = region;
                // Удаляем регион из адреса
                addr = addr.replace(regionRegex, '').trim();
                addr = addr.replace(/^,\s*/, '').replace(/\s*,$/, '');
                break;
            }
        }
    }
    // 5. Оставшаяся часть — улица (очищаем от лишних слов)
    let street = addr
        .replace(/^[,.\s]+/, '')   // удаляем запятые и точки в начале
        .replace(/[,.\s]+$/, '')   // удаляем в конце
        .replace(/\s{2,}/g, ' ')   // схлопываем пробелы
        .trim();
    return {
        region: foundRegion || '',
        city: foundCity || '',
        street: street,
        houseNumber: houseNumber
    };
}
    function extractStreetName(fullStreet) {
        if (!fullStreet) return '';
        const types = ['ул.', 'пер.', 'бульв.', 'просп.', 'пр-д', 'ш.', 'наб.', 'алл.', 'тракт'];
        for (const t of types) {
            if (fullStreet.startsWith(t + ' ')) {
                return fullStreet.substring(t.length + 1);
            }
        }
        return fullStreet;
    }
    // ===================== PULL-TO-REFRESH =====================
    let pullStartY = 0;
    let pullCurrentY = 0;
    let pullIsDragging = false;
    let pullThreshold = 70;
    let pullPanelType = null;
    function initPullToRefresh() {
        const panelContent = document.getElementById('panelContent');
        if (!panelContent) return;
        panelContent.addEventListener('touchstart', function(e) {
            if (this.scrollTop === 0) {
                pullStartY = e.touches[0].clientY;
                pullIsDragging = true;
                pullPanelType = getCurrentPanelType();
            } else {
                pullIsDragging = false;
            }
        });
        panelContent.addEventListener('touchmove', function(e) {
            if (!pullIsDragging) return;
            pullCurrentY = e.touches[0].clientY;
            const delta = pullCurrentY - pullStartY;
            if (delta > 0 && this.scrollTop === 0) {
                const indicator = document.getElementById('pullIndicator');
                if (indicator) {
                    const height = Math.min(delta, pullThreshold);
                    indicator.style.height = height + 'px';
                }
            }
        });
        panelContent.addEventListener('touchend', function() {
            if (!pullIsDragging) return;
            pullIsDragging = false;
            const delta = pullCurrentY - pullStartY;
            const indicator = document.getElementById('pullIndicator');
            if (delta >= pullThreshold && this.scrollTop === 0) {
                indicator.style.height = '50px';
                indicator.classList.add('visible');
                refreshCurrentPanel();
                setTimeout(() => {
                    indicator.style.height = '0px';
                    indicator.classList.remove('visible');
                }, 1500);
            } else {
                indicator.style.height = '0px';
                indicator.classList.remove('visible');
            }
            pullStartY = 0;
            pullCurrentY = 0;
        });
    }
    function getCurrentPanelType() {
        const title = document.getElementById('panelTitle').textContent;
        if (title === 'Поиск') return 'search';
        if (title === 'Избранное') return 'favorites';
        if (title === 'Профиль') return 'profile';
        return null;
    }
    function refreshCurrentPanel() {
        const content = document.getElementById('panelContent');
        switch (pullPanelType) {
            case 'search':
                filterParkings();
                break;
            case 'favorites':
            renderFavorites(content);
                break;
            case 'profile':
                renderProfile(content);
                break;
            default:
                break;
        }
    }
// ============================================
// ВОССТАНОВЛЕНИЕ ПОЛЬЗОВАТЕЛЯ
// ============================================
function restoreSavedUser() {
    const saved = localStorage.getItem('tgUser');
    if (!saved) {
        return false;
    }
    try {
        const user = JSON.parse(saved);
        // Проверяем, что в сохранённых данных действительно есть ID
        if (!user || !user.id) {
            throw new Error('Некорректные данные пользователя');
        }
        currentUser = user;
        window.currentUser = user;
        console.log('✅ Пользователь восстановлен:', user.id);
        return true;
    } catch (e) {
        console.warn('⚠️ Не удалось восстановить пользователя:', e);
        localStorage.removeItem('tgUser');
        currentUser = null;
        window.currentUser = null;
        return false;
    }
}
async function restorePostgresSession() {
    const sessionToken = localStorage.getItem('parkNearSessionToken');
    if (!sessionToken) {
        return false;
    }
    try {
        const response = await fetch(
            `${window.PARKNEAR_API_URL}/auth/me`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${sessionToken}`
                },
                cache: 'no-store'
            }
        );
        // Токен действительно недействителен.
        // Только в этом случае очищаем локальную авторизацию.
        if (response.status === 401 || response.status === 403) {
            throw new Error('INVALID_SESSION');
        }
        // Сервер временно недоступен.
        // Сохраняем локальный профиль и разрешаем офлайн-режим.
        if (!response.ok) {
            throw new Error('SERVER_UNAVAILABLE');
        }
        const result = await response.json();
        if (!result.success || !result.user || !result.user.id) {
            throw new Error('SERVER_UNAVAILABLE');
        }
        const profile = {
            ...result.user,
            id: String(result.user.id),
            username: result.user.username || 'user',
            firstName: result.user.firstName || 'Пользователь',
            photoUrl: result.user.photoUrl || '',
            isGuest: Boolean(result.user.isGuest)
        };
        currentUser = profile;
        window.currentUser = profile;
        localStorage.setItem('tgUser', JSON.stringify(profile));
        // Серверная сессия подтверждена.
        window.isOfflineSession = false;
        // Восстанавливаем активную парковку.
        const activeParkingSession = await getUserActiveParkingSession();
        if (activeParkingSession) {
            const parkingId = String(activeParkingSession.parkingId);
            const parking = parkingDataCache[parkingId];

            if (typeof window.setLocalActiveParking === 'function') {
                window.setLocalActiveParking(
                    parkingId,
                    parking?.name || 'Парковка',
                    activeParkingSession.startedAt
                );
            }
        } else if (
            activeParkingSession === null &&
            typeof window.clearLocalActiveParking === 'function'
        ) {
            // Очищаем локальную парковку только после успешного
            // ответа сервера, что активной парковки нет.
            window.clearLocalActiveParking();
        }
        console.log('Серверная сессия восстановлена:', profile.id);
        return true;
    } catch (error) {
        console.warn('Ошибка восстановления сессии:', error.message);
        if (error.message === 'INVALID_SESSION') {
            localStorage.removeItem('parkNearSessionToken');
            localStorage.removeItem('parkNearSessionExpiresAt');
            localStorage.removeItem('tgUser');
            currentUser = null;
            window.currentUser = null;
            window.isOfflineSession = false;
            return false;
        }
        // При временной ошибке сети не удаляем токен.
        const savedUser = localStorage.getItem('tgUser');
        if (savedUser) {
            try {
                const profile = JSON.parse(savedUser);
                if (profile && profile.id) {
                    currentUser = profile;
                    window.currentUser = profile;
                    window.isOfflineSession = true;

                    console.log(
                        'Восстановлен локальный профиль. Работаем офлайн:',
                        profile.id
                    );
                    return true;
                }
            } catch (parseError) {
                console.error('Ошибка чтения локального профиля:', parseError);
            }
        }
        currentUser = null;
        window.currentUser = null;
        window.isOfflineSession = false;
        return false;
    }
}
async function logoutUser() {
    if (!currentUser) {
        alert('Вы уже вышли из аккаунта.');
        return;
    }
    // Проверяем локальную активную парковку.
    const activeParking =
        typeof window.getLocalActiveParking === 'function'
            ? window.getLocalActiveParking()
            : null;
    // Если парковка активна, сначала предлагаем её завершить.
    if (activeParking) {
        const shouldFinish = confirm(
            'У вас есть активная парковка.\n\n' +
            'Перед выходом из аккаунта необходимо её завершить.\n\n' +
            'Завершить парковку и выйти?'
        );
        if (!shouldFinish) {
            return;
        }
        const finished = await endParkingSession(
            activeParking.parkingId
        );
        // Если сервер не подтвердил завершение,
        // не выходим и сохраняем локальную парковку.
        if (!finished) {
            alert(
                'Выход отменён. Активная парковка не завершена.\n' +
                'Проверьте подключение к интернету и попробуйте снова.'
            );
            return;
        }
    } else {
        if (!confirm('Вы действительно хотите выйти из аккаунта?')) {
            return;
        }
    }
    const sessionToken = localStorage.getItem(
        'parkNearSessionToken'
    );
    try {
        if (sessionToken) {
            const response = await fetch(
                `${window.PARKNEAR_API_URL}/auth/logout`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${sessionToken}`
                    }
                }
            );
            if (!response.ok && response.status !== 401) {
                throw new Error(
                    'Сервер не смог завершить сессию.'
                );
            }
        }
        localStorage.removeItem('parkNearSessionToken');
        localStorage.removeItem('parkNearSessionExpiresAt');
        window.isOfflineSession = false;
        finishLogout();
        console.log('Сессия PostgreSQL завершена.');
    } catch (error) {
        console.error('Ошибка выхода:', error);
        alert(
            'Не удалось завершить сессию на сервере. ' +
            'Проверьте подключение к интернету и попробуйте ещё раз.'
        );
    }
}
function finishLogout() {
    currentUser = null;
    window.currentUser = null;
    localStorage.removeItem('tgUser');
    const panel = document.getElementById('panelContent');
    if (panel) {
        panel.innerHTML = '';
    }
    if (typeof updateAuthUI === 'function') {
        updateAuthUI();
    }
    showAuthScreen();
}
// ============================================
// ИНИЦИАЛИЗАЦИЯ АВТОРИЗАЦИИ
// ============================================
async function initAuth() {
    // Сначала проверяем серверную сессию в PostgreSQL.
    const restored = await restorePostgresSession();
    if (restored) {
        hideAuthScreen();
        const panel = document.getElementById('panel');
        if (panel && !panel.classList.contains('active')) {
            showPanel('home');
        }
        console.log('Авторизация PostgreSQL восстановлена');
        return true;
    }
    // Нет действующей серверной сессии.
    currentUser = null;
    window.currentUser = null;
    console.log('Пользователь не авторизован');
    showAuthScreen();
    return false;
}
// ============================================
// БЫСТРОЕ ВОССТАНОВЛЕНИЕ СЕССИИ
// Выполняется сразу, не дожидаясь загрузки карты
// ============================================
(function() {
    const restored = restoreSavedUser();
    if (restored) {
        hideAuthScreen();
        const panel = document.getElementById('panel');
        if (panel && !panel.classList.contains('active')) {
            showPanel('home');
        }
        console.log('✅ Вход восстановлен (ранний вызов)');
    }
})();
    // ===================== ГЕОЛОКАЦИЯ =====================
    function getUserLocation() {
    return new Promise((resolve, reject) => {
        // Если запущено внутри Telegram WebApp
        if (window.Telegram && window.Telegram.WebApp && typeof window.Telegram.WebApp.getLocation === 'function') {
            window.Telegram.WebApp.getLocation(function(position) {
                if (position && position.latitude && position.longitude) {
                    resolve({ lat: position.latitude, lng: position.longitude });
                } else {
                    reject(new Error('Telegram геолокация не удалась'));
                }
            });
            return;
        }
        // Стандартный браузерный метод
        if (!navigator.geolocation) {
            return reject(new Error('Геолокация не поддерживается вашим устройством'));
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
            },
            (error) => {
                reject(error);
            },
            { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
        );
    });
}
async function detectCityByUserLocation() {
    if (currentCity) return currentCity;
    if (!navigator.geolocation) {
        console.warn('Геолокация браузера недоступна');
        return '';
    }
    return new Promise(resolve => {
        navigator.geolocation.getCurrentPosition(async position => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            try {
                const result = await ymaps.geocode([lat, lng], { results: 1 });
                const geo = result.geoObjects.get(0);
                if (!geo) {
                    resolve('');
                    return;
                }
                const localities = geo.getLocalities ? geo.getLocalities() : [];
                const areas = geo.getAdministrativeAreas ? geo.getAdministrativeAreas() : [];
                const city = localities[0] || '';
                const region = areas[areas.length - 1] || '';
                if (city) {
                    currentCity = city;
                    userCityPrefs.city = city;
                    userCityPrefs.region = region;
                    localStorage.setItem('selectedCity', city);
                    localStorage.setItem('parknear_city', JSON.stringify({ city, region }));
                    if (typeof updateCityDisplay === 'function') updateCityDisplay();
                }
                resolve(city);
            } catch (error) {
                console.error('Ошибка определения города:', error);
                resolve('');
            }
        }, error => {
            console.warn('Не удалось получить геолокацию:', error.message);
            resolve('');
        }, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000
        });
    });
}
function tryYandexGeolocation(resolve, reject) {
    if (typeof ymaps === 'undefined' || !ymaps.geolocation) {
        reject(new Error('Геолокация не поддерживается'));
        return;
    }
    ymaps.geolocation.get({ provider: 'browser', timeout: 10000 })
        .then(async function(result) {
            const coords = result.geoObjects.get(0).geometry.getCoordinates();
            const location = { lat: coords[0], lng: coords[1] };
            lastKnownLocation = location;
            console.log('✅ Геолокация получена через Яндекс:', location);
            try {
                const geoResult = await ymaps.geocode(coords, { results: 1 });
                const geo = geoResult.geoObjects.get(0);
                if (geo) {
                    const localities = geo.getLocalities ? geo.getLocalities() : [];
                    const areas = geo.getAdministrativeAreas ? geo.getAdministrativeAreas() : [];
                    const city = localities[0] || '';
                    const region = areas[areas.length - 1] || '';
                    if (city) {
                        currentCity = city;
                        userCityPrefs.city = city;
                        userCityPrefs.region = region;
                        localStorage.setItem('selectedCity', city);
                        localStorage.setItem('parknear_city', JSON.stringify({ city, region }));
                        if (typeof updateCityDisplay === 'function') updateCityDisplay();
                        console.log('✅ Город определён:', city, region);
                    }
                }
            } catch (error) {
                console.warn('⚠️ Не удалось определить город:', error);
            }
            resolve(location);
        })
        .catch(function(err) {
            console.error('❌ Яндекс.Геолокация не удалась:', err);
            reject(new Error('Геолокация недоступна'));
        });
}
    function tryBrowserGeolocation(resolve, reject) {
        if (typeof ymaps !== 'undefined') {
            ymaps.geolocation.get({ provider: 'browser', timeout: 10000 })
                .then(function(result) {
                    const coords = result.geoObjects.get(0).geometry.getCoordinates();
                    lastKnownLocation = { lat: coords[0], lng: coords[1] };
                    resolve(lastKnownLocation);
                })
                .catch(function() { fallbackToNavigator(resolve, reject); });
        } else {
            fallbackToNavigator(resolve, reject);
        }
    }
    function fallbackToNavigator(resolve, reject) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function(pos) {
                    lastKnownLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    resolve(lastKnownLocation);
                },
                function(err) { reject(err); }, { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            reject(new Error('Геолокация не поддерживается'));
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
async function getAddressByCoordinates(lat, lng) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        console.error('❌ Некорректные координаты:', lat, lng);
        return null;
    }
    if (typeof ymaps === 'undefined' || typeof ymaps.geocode !== 'function') {
        console.warn('⚠️ Яндекс.Геокодер недоступен');
        return null;
    }
    try {
        await new Promise(resolve => ymaps.ready(resolve));
        const result = await ymaps.geocode([latitude, longitude], { results: 1 });
        const geo = result.geoObjects.get(0);
        if (!geo) return null;
        const address = geo.getAddressLine?.() || '';
        const localities = typeof geo.getLocalities === 'function' ? geo.getLocalities() : [];
        const areas = typeof geo.getAdministrativeAreas === 'function' ? geo.getAdministrativeAreas() : [];
        let city = localities?.[localities.length - 1] || '';
        let region = areas?.[areas.length - 1] || '';
        let street = '';
        let houseNumber = '';
        const meta = geo.properties.get('metaDataProperty.GeocoderMetaData');
        const components = meta?.Address?.Components || [];
        components.forEach(component => {
            const kind = component.kind;
            const name = String(component.name || '').trim();
            if (!name) return;
            if (!city && (kind === 'locality' || kind === 'area')) city = name;
            if (!region && (kind === 'province' || kind === 'region')) region = name;
            if (!street && kind === 'street') street = name;
            if (!houseNumber && kind === 'house') houseNumber = name;
        });
        if ((!city || !region || !street || !houseNumber) && address && typeof parseAddress === 'function') {
            try {
                const parsed = parseAddress(address) || {};
                if (!city) city = String(parsed.city || '').trim();
                if (!region) region = String(parsed.region || '').trim();
                if (!street) street = String(parsed.street || '').trim();
                if (!houseNumber) houseNumber = String(parsed.houseNumber || '').trim();
            } catch (e) {}
        }
        return { address, city, region, street, houseNumber };
    } catch (error) {
        console.warn('⚠️ Геокодирование не удалось:', error);
        return null;
    }
}
// ФИКС: проверка авторства перед изменением города
async function fixParkingCity(parkingId, city, region) {
    if (!currentUser || !currentUser.id) {
        showToast?.('Необходимо авторизоваться', 2000);
        return;
    }
    if (!parkingId || !city || !city.trim()) {
        showToast?.('Не указан город парковки', 2000);
        return;
    }
    try {
        const updates = {
            city: city.trim(),
            region: region ? region.trim() : '',
            lastUpdatedAt: Date.now(),
            lastUpdatedBy:
                currentUser.nickname ||
                currentUser.firstName ||
                ''
        };
        const parking = await patchParkingInPostgres(parkingId, updates);
        if (parkingDataCache[parkingId]) {
            Object.assign(parkingDataCache[parkingId], parking);
        }
        if (currentParkingId === parkingId && currentParkingData) {
            Object.assign(currentParkingData, parking);
        }
        console.log('Город парковки обновлён:', {
            parkingId,
            city: updates.city,
            region: updates.region
        });
        showToast?.('Город парковки обновлён', 2000);
    } catch (error) {
        console.error('Ошибка изменения города:', error);
        showToast?.(
            error.message || 'Не удалось изменить город парковки',
            3000
        );
    }
}
// ФИКС: проверка авторства перед изменением границ
async function saveEditedPolygon(newCoords) {
    if (!currentUser || !currentUser.id) {
        alert('Необходимо авторизоваться');
        cancelDrawing();
        return;
    }
    if (!currentParkingId) {
        alert('Не выбрана парковка');
        cancelDrawing();
        return;
    }
    try {
        if (!Array.isArray(newCoords) || newCoords.length < 3) {
            alert('Для парковочной зоны необходимо минимум 3 точки');
            cancelDrawing();
            return;
        }
        const validCoordinates = newCoords.every(point =>
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
            alert('Обнаружены некорректные координаты');
            cancelDrawing();
            return;
        }
        const sizeCheck = checkPolygonSize(newCoords);
        if (!sizeCheck.valid) {
            alert(sizeCheck.error);
            cancelDrawing();
            return;
        }
        const centerLat = newCoords.reduce(
            (sum, point) => sum + Number(point[0]), 0
        ) / newCoords.length;
        const centerLng = newCoords.reduce(
            (sum, point) => sum + Number(point[1]), 0
        ) / newCoords.length;
        const updatedAt = Date.now();
        const parking = await patchParkingInPostgres(currentParkingId, {
            coordinates: newCoords,
            lat: centerLat,
            lng: centerLng,
            lastUpdatedAt: updatedAt,
            lastUpdatedBy:
                currentUser.nickname ||
                currentUser.firstName ||
                ''
        });
        if (editingPolygon) {
            map.geoObjects.remove(editingPolygon);
            editingPolygon = null;
        }
        const addBtn = document.getElementById('addBtn');
        if (addBtn) {
            addBtn.classList.remove('drawing');
            addBtn.textContent = '+';
        }
        isDrawingMode = false;
        const controls = document.getElementById('drawingControls');
        if (controls) controls.remove();
        currentParkingData = {
            ...currentParkingData,
            ...parking
        };
        parkingDataCache[currentParkingId] = {
            ...currentParkingData,
            _dbPath: parkingDataCache[currentParkingId]?._dbPath
        };
        refreshParkingMarker(currentParkingId);
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        alert('Границы обновлены');
    } catch (err) {
        console.error('Ошибка обновления полигона:', err);
        alert('Ошибка: ' + (err.message || 'неизвестная ошибка'));
        cancelDrawing();
    }
}
// ===================== checkPolygonSize =====================
function checkPolygonSize(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length < 3) {
        return { valid: false, error: 'Минимум 3 точки' };
    }
    const validCoords = coordinates.filter(c =>
        Array.isArray(c) &&
        c.length >= 2 &&
        Number.isFinite(Number(c[0])) &&
        Number.isFinite(Number(c[1]))
    );
    if (validCoords.length < 3) {
        return { valid: false, error: 'Некорректные координаты зоны' };
    }
    const lats = validCoords.map(c => Number(c[0]));
    const lngs = validCoords.map(c => Number(c[1]));
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const widthM = getDistanceInMeters(minLat, minLng, minLat, maxLng);
    const lengthM = getDistanceInMeters(minLat, minLng, maxLat, minLng);
    const maxDiagonal = Math.sqrt(MAX_ZONE_WIDTH ** 2 + MAX_ZONE_LENGTH ** 2);
    let maxPairDistance = 0;
    for (let i = 0; i < validCoords.length; i++) {
        for (let j = i + 1; j < validCoords.length; j++) {
            const d = getDistanceInMeters(
                Number(validCoords[i][0]), Number(validCoords[i][1]),
                Number(validCoords[j][0]), Number(validCoords[j][1])
            );
            if (d > maxPairDistance) maxPairDistance = d;
        }
    }
    const maxArea = MAX_ZONE_WIDTH * MAX_ZONE_LENGTH;
    const area = typeof calculatePolygonArea === 'function' ? calculatePolygonArea(validCoords) : null;
    const failsBoundingBox = widthM > MAX_ZONE_WIDTH || lengthM > MAX_ZONE_LENGTH;
    const failsDiagonal = maxPairDistance > maxDiagonal;
    const failsArea = area !== null && area > maxArea;
    if (failsBoundingBox || failsDiagonal || failsArea) {
        return {
            valid: false,
            error: `Зона слишком большая! Максимум ${MAX_ZONE_WIDTH}×${MAX_ZONE_LENGTH} м. ` +
                   `Сейчас: ${Math.round(widthM)}×${Math.round(lengthM)} м, диагональ ${Math.round(maxPairDistance)} м` +
                   (area !== null ? `, площадь ${Math.round(area)} м²` : '')
        };
    }
    return { valid: true, width: widthM, length: lengthM };
}
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
async function openCenterSheet(parkingId,data){
    const sheet=document.getElementById('centerSheet');
    const content=document.getElementById('centerSheetContent');
    if(!sheet||!content)return;
    currentParkingId=parkingId;
    currentParkingData=data;
    parkingDataCache[parkingId]=data;
    const totalSpots=Number(data.totalSpots)||0;
    let occupiedSpots=0;
    try{
        occupiedSpots=await getParkingOccupancy(parkingId);
    }catch(error){
        console.error('Ошибка получения занятости:',error);
    }
    const freeSpots=Math.max(0,totalSpots-occupiedSpots);
    let status='unknown';
    if(totalSpots>0){
        const occupancy=occupiedSpots/totalSpots;
        if(occupancy>=0.9){
            status='occupied';
        }else if(occupancy>=0.6){
            status='limited';
        }else{
            status='free';
        }
    }
    let statusIcon='⚪';
    let statusTitle='Нет данных';
    let statusClass='unknown';
    if(status==='free'){
        statusIcon='🟢';
        statusTitle='Есть места';
        statusClass='free';
    }else if(status==='limited'){
        statusIcon='🟡';
        statusTitle='Мало мест';
        statusClass='limited';
    }else if(status==='occupied'){
        statusIcon='🔴';
        statusTitle='Мест нет';
        statusClass='occupied';
    }
    const address=data.address
        ?escapeHtml(data.address)
        :escapeHtml(data.street||'Адрес не указан');
    const safeId=escapeHtml(parkingId);
    let userSession=null;
    if(currentUser?.id){
        try{
            userSession=await getUserActiveParkingSession();
        }catch(error){
            console.error('Ошибка проверки парковочной сессии:',error);
        }
    }
    const isParked=
        userSession&&
        userSession.parkingId===parkingId;
    let parkingButton='';
    if (isParked) {
    parkingButton = `
        <button
            class="parking-park-btn parking-leave-btn is-active-parking"
            onclick="endParkingSession('${safeId}')"
        >
            <span>🚗</span>
            <span>Я уехал</span>
        </button>
    `;
   }
    else if(currentUser?.id){
        parkingButton=`
            <button
                class="parking-park-btn"
                onclick="startParkingSession('${safeId}')"
            >
                <span>🅿️</span>
                <span>Припарковаться</span>
            </button>
        `;
    }
    content.innerHTML=`
        <div class="parking-card-compact">
            <div class="parking-card-handle"></div>
            <div class="parking-card-header">
                <div>
                    <div class="parking-card-title">
                        🅿️ ${escapeHtml(data.name||'Парковка')}
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
                <div class="parking-meta-item">
                    <strong>${totalSpots||'—'}</strong>
                    <span>всего мест</span>
                </div>
                <div class="parking-meta-item">
                    <strong>${occupiedSpots}</strong>
                    <span>занято примерно</span>
                </div>
                <div class="parking-meta-item">
                    <strong>${freeSpots}</strong>
                    <span>свободно примерно</span>
                </div>
            </div>
            ${parkingButton}
            <button
                class="parking-route-btn"
                onclick="buildRouteToParking('${safeId}')"
            >
                <span>🧭</span>
                <span>Поехать</span>
            </button>
            
           <div class="parking-bottom-actions">
    <button
        class="parking-secondary-btn parking-favorite-btn"
        onclick="toggleFavoriteCenter()"
    >
        <span>♡</span>
        <span>Сохранить</span>
    </button>
    <button
        class="parking-edit-btn"
        onclick="editFromCenter()"
    >
        ✎ Редактировать
          </button>
        </div>
    `;
    sheet.classList.add('active');
}

async function getParkingOccupancy(parkingId) {
    if (!parkingId) {
        throw new Error('Не указан идентификатор парковки.');
    }

    const response = await fetch(
        `${window.PARKNEAR_API_URL}/api/parkings/${encodeURIComponent(parkingId)}`,
        { cache: 'no-store' }
    );

    const result = await response.json();

    if (!response.ok || !result.success || !result.parking) {
        throw new Error(
            result.error || 'Не удалось получить парковку'
        );
    }

    const parking = result.parking;

    const total = Math.max(
        0,
        Number(parking.totalSpots) || 0
    );
    const occupied = Math.min(
        total,
        Math.max(0, Number(parking.occupiedSpots) || 0)
    );
    return occupied;
}
async function getUserActiveParkingSession() {
    const token = localStorage.getItem('parkNearSessionToken');
    if (!token || !currentUser?.id) return undefined;
    try {
        const response = await fetch(
            `${window.PARKNEAR_API_URL}/api/parking-sessions/active`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                cache: 'no-store'
            }
        );
        if (!response.ok) {
            throw new Error(`Ошибка сервера: ${response.status}`);
        }
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Не удалось получить активную парковку');
        }
        return result.session || null;
    } catch (error) {
    console.warn('Не удалось проверить активную парковку:', error.message);
    return undefined;
}
}
function getCurrentUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(
                new Error('Геолокация не поддерживается браузером.')
            );
            return;
        }
        function handleSuccess(position) {
            resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            });
        }
        function handleError(error, isRetry) {
            // Если точное определение не удалось,
            // пробуем получить координаты другим способом.
            if (!isRetry && (error.code === 2 || error.code === 3)) {
                navigator.geolocation.getCurrentPosition(
                    handleSuccess,
                    retryError => {
                        let message =
                            'Не удалось определить местоположение.';
                        if (retryError.code === 1) {
                            message =
                                'Разрешите доступ к геолокации.';
                        } else if (retryError.code === 2) {
                            message =
                                'Местоположение недоступно. ' +
                                'Проверьте настройки геолокации.';
                        } else if (retryError.code === 3) {
                            message =
                                'Не удалось получить координаты вовремя. ' +
                                'Попробуйте ещё раз на открытом месте.';
                        }
                        reject(new Error(message));
                    },
                    {
                        enableHighAccuracy: false,
                        timeout: 15000,
                        maximumAge: 60000
                    }
                );
                return;
            }
            let message = 'Не удалось определить местоположение.';
            if (error.code === 1) {
                message = 'Разрешите доступ к геолокации.';
            } else if (error.code === 2) {
                message = 'Местоположение сейчас недоступно.';
            } else if (error.code === 3) {
                message = 'Истекло время ожидания геолокации.';
            }
            reject(new Error(message));
        }
        navigator.geolocation.getCurrentPosition(
            handleSuccess,
            error => handleError(error, false),
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 30000
            }
        );
    });
}
async function startParkingSession(parkingId) {

    if (!currentUser?.id) {

        alert('Чтобы припарковаться, необходимо войти в аккаунт.');

        return;

    }

    if (!parkingId) {

        alert('Не удалось определить парковку.');

        return;

    }

    if (isStartingParkingSession) return;

    isStartingParkingSession = true;

    try {

        const token = localStorage.getItem('parkNearSessionToken');

        if (!token) {

            throw new Error('Сессия пользователя не найдена. Войдите заново.');

        }

        const parking = parkingDataCache[parkingId];

        if (!parking) {

            throw new Error('Парковка не найдена в загруженных данных.');

        }

        const parkingLat = Number(parking.lat ?? parking.latitude);

        const parkingLng = Number(parking.lng ?? parking.longitude);

        if (

            !Number.isFinite(parkingLat) ||

            !Number.isFinite(parkingLng) ||

            Math.abs(parkingLat) > 90 ||

            Math.abs(parkingLng) > 180

        ) {

            throw new Error('Не удалось определить координаты парковки.');

        }

        const position = await getCurrentUserLocation();

        const distance = getDistanceInMeters(

            position.latitude,

            position.longitude,

            parkingLat,

            parkingLng

        );

        const radius = 170;

        const accuracy = Number(position.accuracy) || 0;

        if (distance > radius + accuracy) {

            alert(

                `Вы находитесь примерно в ${Math.round(distance)} м от парковки. ` +

                'Подойдите ближе, чтобы отметить парковку.'

            );

            return;

        }

        const response = await fetch(

            `${window.PARKNEAR_API_URL}/api/parking-sessions`,

            {

                method: 'POST',

                headers: {

                    'Content-Type': 'application/json',

                    'Authorization': `Bearer ${token}`

                },

                body: JSON.stringify({

                    parkingId: String(parkingId)

                })

            }

        );

        const result = await response.json();

        if (!response.ok || !result.success) {

            throw new Error(

                result.error || 'Не удалось начать парковочную сессию'

            );

        }

        const session = result.session;

        const updatedParking = result.parking || parking;

        if (typeof window.setLocalActiveParking === 'function') {

            window.setLocalActiveParking(

                parkingId,

                updatedParking.name || parking.name || 'Парковка',

                session.startedAt

            );

        }

        parkingDataCache[parkingId] = {

            ...parking,

            ...updatedParking,

            id: String(parkingId),

            _dbPath: null

        };

        currentParkingData = parkingDataCache[parkingId];

        await openCenterSheet(

            parkingId,

            parkingDataCache[parkingId]

        );

        if (typeof refreshParkingMarker === 'function') {

            refreshParkingMarker(parkingId);

        }

        if (typeof refreshParkingClusters === 'function') {

            refreshParkingClusters();

        }

        if (window.Telegram?.WebApp?.HapticFeedback) {

            window.Telegram.WebApp.HapticFeedback

                .notificationOccurred('success');

        }

        console.log('Парковочная сессия создана в PostgreSQL:', session);

    } catch (error) {
        console.error('Ошибка начала парковки:', error);
        alert(
            error.message ||
            'Не удалось начать парковочную сессию.'
        );
    } finally {
        isStartingParkingSession = false;
    }
}
async function endParkingSession(parkingId) {
    if (!currentUser?.id || !parkingId) return false;
    try {
        const token = localStorage.getItem('parkNearSessionToken');
        if (!token) {
            throw new Error('Сессия пользователя не найдена.');
        }
        const response = await fetch(
            `${window.PARKNEAR_API_URL}/api/parking-sessions/active/${encodeURIComponent(parkingId)}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(
                result.error || 'Не удалось завершить парковку'
            );
        }
        // Очищаем локальную активную парковку
        // только после подтверждения сервера.
        if (typeof window.clearLocalActiveParking === 'function') {
            window.clearLocalActiveParking();
        }
        const updatedParking = result.parking;
        if (updatedParking) {
            parkingDataCache[parkingId] = {
                ...parkingDataCache[parkingId],
                ...updatedParking,
                id: String(parkingId),
                _dbPath: null
            };
            currentParkingData = parkingDataCache[parkingId];
            await openCenterSheet(
                parkingId,
                parkingDataCache[parkingId]
            );
        }
        if (typeof refreshParkingMarker === 'function') {
            refreshParkingMarker(parkingId);
        }
        if (typeof refreshParkingClusters === 'function') {
            refreshParkingClusters();
        }
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback
                .notificationOccurred('success');
        }
        console.log('Парковочная сессия завершена в PostgreSQL.');
        return true;
    } catch (error) {
        console.error(
            'Ошибка завершения парковочной сессии:',
            error
        );
        alert(
            error.message ||
            'Не удалось завершить парковку.'
        );
        return false;
    }
}
function getParkingPlacesWord(number) {
    number = Math.abs(Number(number));
    const lastTwo = number % 100;
    const lastOne = number % 10;
    if (lastTwo >= 11 && lastTwo <= 19) return 'мест';
    if (lastOne === 1) return 'место';
    if (lastOne >= 2 && lastOne <= 4) return 'места';
    return 'мест';
}
function closeCenterSheet() {
    const sheet = document.getElementById('centerSheet');
    if (sheet) sheet.classList.remove('active');
    currentParkingId = null;
    currentParkingData = null;
    if (activePolygon) {
        activePolygon.options.set('visible', false);
        activePolygon = null;
    }
    if (map && previousCenter) {
        try {
            map.setCenter(previousCenter, 16, { duration: 300 });
        } catch (e) {
            console.warn('Ошибка восстановления центра:', e);
        }
        previousCenter = null;
        previousZoom = null;
    } else if (map) {
        map.setZoom(16, { duration: 300 });
    }
}

function buildRouteFromCenter() {
    if (!currentParkingData) {
        console.error('Маршрут: данные выбранной парковки отсутствуют');
        return;
    }
    const data = currentParkingData;
    const lat = Number(data.lat ?? data.latitude ?? data.coords?.[0]);
    const lng = Number(data.lng ?? data.longitude ?? data.coords?.[1]);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        alert('Не удалось определить координаты парковки');
        return;
    }
    closeCenterSheet();
    const openRoute = (userLat = null, userLng = null) => {
        let url = `https://yandex.ru/maps/?rtext=~${lat},${lng}&rtt=auto`;

        if (userLat !== null && userLng !== null) {
            url = `https://yandex.ru/maps/?rtext=${userLat},${userLng}~${lat},${lng}&rtt=auto`;
        }
        window.open(url, '_blank');
    };
    if (!navigator.geolocation) {
        openRoute();
        return;
    }
    navigator.geolocation.getCurrentPosition(
        position => {
            openRoute(
                position.coords.latitude,
                position.coords.longitude
            );
        },
        error => {
            console.warn('Не удалось получить геолокацию:', error);
            openRoute();
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000
        }
    );
}
function editFromCenter() {
    if (!currentParkingId) return;
    const parkingId = currentParkingId;
    closeCenterSheet();
    openOccupancyPanel(parkingId);
}
    // ===================== РЕДАКТИРОВАНИЕ ПАРКОВКИ =====================

async function openOccupancyPanel(parkingId) {
    if (!parkingId) return;

    const panel = document.getElementById('panel');
    const content = document.getElementById('panelContent');

    if (!panel || !content) {
        console.error('Нет #panel или #panelContent');
        return;
    }

    document.getElementById('panelTitle').textContent = 'Парковка';
    panel.classList.add('active');

    const donateBtn = document.getElementById('donateBtn');
    if (donateBtn) donateBtn.style.display = 'none';

    content.innerHTML =
        '<div class="loading-state"><div class="spinner"></div><p>Загрузка...</p></div>';

    try {
        const response = await fetch(
            `${window.PARKNEAR_API_URL}/api/parkings/${encodeURIComponent(parkingId)}`,
            { cache: 'no-store' }
        );

        const result = await response.json();

        if (!response.ok || !result.success || !result.parking) {
            throw new Error(
                result.error || 'Парковка не найдена'
            );
        }

        const data = result.parking;

        currentParkingId = parkingId;
        currentParkingData = data;
        parkingDataCache[parkingId] = data;

        const token = localStorage.getItem('parkNearSessionToken');

        // Учитываем просмотр только для авторизованного
        // пользователя, который не является автором парковки.
        if (
            currentUser &&
            String(currentUser.id) !== String(data.authorId) &&
            token
        ) {
            fetch(
                `${window.PARKNEAR_API_URL}/api/parkings/${encodeURIComponent(parkingId)}/view`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            ).catch(error =>
                console.warn('Не удалось учесть просмотр:', error)
            );
        }
               // Загружаем профиль автомобиля из PostgreSQL
        // и проверяем избранное через PostgreSQL API.
        const profilePromise = currentUser
            ? requestUserProfile('GET')
            : Promise.resolve({});
        const favoritePromise = currentUser
            ? isFavorite(parkingId)
            : Promise.resolve(false);
        const [profile, favoriteResult] = await Promise.all([
            profilePromise,
            favoritePromise
        ]);
        if (currentUser) {
            currentUser.car = profile.car || {};
        }
        const favoriteStatus = Boolean(favoriteResult);
        renderEditPanel(data, favoriteStatus, content);
    } catch (error) {
        console.error('Ошибка загрузки парковки:', error);
        content.innerHTML =
            `<div class="empty-state"><p>${escapeHtml(error.message || 'Не удалось загрузить парковку')}</p></div>`;
    }
}
function renderEditPanel(data, isFavorite, content) {
    if (!content) {
        content = document.getElementById('panelContent');
    }
    if (!content) {
        console.error('Не найден контейнер panelContent');
        return;
    }
    const totalSpots = Math.max(
        0,
        Math.floor(Number(data.totalSpots) || 0)
    );
    const isAuthor =
        !!currentUser &&
        currentUser.id != null &&
        data.authorId != null &&
        String(currentUser.id) === String(data.authorId);
    const safeVal = value =>
        String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    const street = data.street || '';
    const house = data.houseNumber || '';
    const parkingId = String(currentParkingId ?? '');
    content.innerHTML = `
        <div class="edit-parking">

            <!-- Заголовок парковки -->
            <div class="edit-parking-header">
                <div class="edit-parking-title">
                    <h3>${safeVal(data.name || 'Парковка')}</h3>

                    ${
                        street
                            ? `<p class="edit-parking-street">
                                ${safeVal(street)}${
                                    house ? ', ' + safeVal(house) : ''
                                }
                            </p>`
                            : ''
                    }
                </div>
            </div>

            <!-- Действия -->
            <div class="edit-parking-actions">

                ${
                    isAuthor
                        ? `
                            <button
                                type="button"
                                class="btn-secondary"
                                onclick="window.toggleParkingEditor()"
                            >
                                ✏️ Редактировать данные
                            </button>
                        `
                        : ''
                }

                <button
                    type="button"
                    class="btn-secondary"
                    onclick="toggleFavorite('${safeVal(parkingId)}')"
                >
                    ${
                        isFavorite
                            ? '★ Убрать из избранного'
                            : '☆ В избранное'
                    }
                </button>

            </div>

            <!-- Форма редактирования -->
            <div
                id="parkingEditorForm"
                class="edit-parking-form"
                style="display: none;"
            >
                <h4>Редактирование парковки</h4>

                <label for="editParkingName">
                    Название парковки
                </label>

                <input
                    type="text"
                    id="editParkingName"
                    value="${safeVal(data.name || '')}"
                    placeholder="Название парковки"
                >

                <label for="editParkingStreet">
                    Улица
                </label>

                <input
                    type="text"
                    id="editParkingStreet"
                    value="${safeVal(street)}"
                    placeholder="ул. Ленина"
                >

                <label for="editHouseNumber">
                    Номер дома
                </label>

                <input
                    type="text"
                    id="editHouseNumber"
                    value="${safeVal(house)}"
                    placeholder="15"
                >

                <!-- Общая вместимость -->
                <div class="edit-parking-capacity">

                    <h4 class="edit-parking-capacity-title">
                        Вместимость парковки
                    </h4>

                    <p class="edit-parking-capacity-description">
                        Укажи общее количество парковочных мест.
                    </p>

                    <label for="editParkingTotalSpots">
                        Всего парковочных мест
                    </label>

                    <input
                        type="number"
                        id="editParkingTotalSpots"
                        name="totalSpots"
                        min="0"
                        step="1"
                        inputmode="numeric"
                        value="${totalSpots}"
                        placeholder="Например, 120"
                    >

                    <small class="edit-parking-capacity-hint">
                        Общее количество мест, включая занятые.
                    </small>

                </div>

                <label for="editParkingDescription">
                    Описание
                </label>

                <textarea
                    id="editParkingDescription"
                    placeholder="Описание парковки"
                >${safeVal(data.description || '')}</textarea>

                <!-- Кнопки формы -->
                <div class="edit-parking-form-actions">

                    <button
                        type="button"
                        class="btn-primary"
                        onclick="saveParkingDetails()"
                    >
                        Сохранить изменения
                    </button>

                    <button
                        type="button"
                        class="btn-secondary"
                        onclick="window.toggleParkingEditor()"
                    >
                        Отмена
                    </button>

                </div>
            </div>

            <!-- История изменений -->
            <div id="parkingHistoryPreview"></div>

            <div
                id="parkingHistoryAll"
                style="display: none;"
            ></div>

            <button
                type="button"
                class="parking-secondary-btn"
                onclick="window.showAllHistory()"
            >
                Показать историю
            </button>

        </div>
    `;
    // Открытие и закрытие формы редактирования
    window.toggleParkingEditor = function () {
        const form = document.getElementById('parkingEditorForm');
        if (!form) {
            return;
        }
        const isHidden = getComputedStyle(form).display === 'none';
        form.style.display = isHidden ? 'block' : 'none';
    };
    // Показ истории изменений
    window.showAllHistory = function () {
        const historyAll = document.getElementById('parkingHistoryAll');
        if (!historyAll) {
            return;
        }
        historyAll.style.display = 'block';
        if (
            typeof loadHistoryPreview === 'function' &&
            currentParkingId
        ) {
            loadHistoryPreview(currentParkingId);
        }
    };
    // Загрузка истории
    if (
        currentUser &&
        currentParkingId &&
        typeof loadHistoryPreview === 'function'
    ) {
        loadHistoryPreview(currentParkingId);
    }
}

async function loadHistoryPreview(parkingId) {
    const previewBox = document.getElementById('parkingHistoryPreview');

    if (!previewBox || !parkingId) return;

    if (!document.getElementById('historyList')) {
        previewBox.innerHTML = `
            <div id="historyList"></div>
            <div id="historyFullList" style="display:none;"></div>
        `;
    }

    const list = document.getElementById('historyList');
    if (!list) return;

    try {
        const response = await fetch(
            `${window.PARKNEAR_API_URL}/api/parkings/${encodeURIComponent(parkingId)}/history?limit=100`,
            { cache: 'no-store' }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Не удалось загрузить историю');
        }

        const entries = result.history || [];

        if (!entries.length) {
            list.innerHTML =
                '<div style="color:var(--text-secondary);font-size:13px;">История пуста</div>';
            return;
        }

        list.innerHTML = entries.slice(0, 5).map(entry => {
            const date = new Date(Number(entry.timestamp) || 0);

            const time = date.toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            const action =
                entry.action === 'occupied'
                    ? 'Занял'
                    : entry.action === 'freed'
                        ? 'Освободил'
                        : 'Изменил';

            return `
                <div style="padding:6px 10px;background:var(--bg-primary);border-radius:8px;margin-bottom:4px;font-size:12px;display:flex;justify-content:space-between;gap:6px;">
                    <span>${action}</span>
                    <span>${escapeHtml(entry.username || '')}</span>
                    <span>${time}</span>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Ошибка загрузки истории:', error);
        list.textContent = 'Не удалось загрузить историю';
    }
}

async function loadHistory(parkingId, limit = 10, days = 3) {
    const container = document.getElementById('historyList');
    const countEl = document.getElementById('historyCount');
    const loadMoreBtn = document.getElementById('loadMoreHistory');

    if (!container || !parkingId) return;

    try {
        const response = await fetch(
            `${window.PARKNEAR_API_URL}/api/parkings/${encodeURIComponent(parkingId)}/history?limit=100`,
            { cache: 'no-store' }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Не удалось загрузить историю');
        }

        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

        const entries = (result.history || [])
            .filter(entry =>
                Number(entry.timestamp) >= cutoff
            );

        if (countEl) {
            countEl.textContent = `(${entries.length})`;
        }

        if (!entries.length) {
            container.innerHTML =
                `<div style="color:var(--text-secondary);font-size:13px;">Нет изменений за последние ${days} дней</div>`;

            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            return;
        }

        container.innerHTML = entries.slice(0, limit).map(entry => {
            const date = new Date(Number(entry.timestamp) || 0);

            const time = date.toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const action =
                entry.action === 'occupied'
                    ? 'Занял'
                    : entry.action === 'freed'
                        ? 'Освободил'
                        : 'Изменил';

            const car = entry.car || {};
            const carName = [car.brand, car.model]
                .filter(Boolean)
                .join(' ') || 'машина не указана';

            return `
                <div style="padding:8px 12px;background:var(--bg-primary);border-radius:8px;margin-bottom:4px;font-size:13px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;">
                    <div>${action} (${entry.previousOccupied ?? '—'} → ${entry.newOccupied ?? '—'})</div>
                    <div style="color:var(--text-secondary);font-size:12px;">${escapeHtml(entry.username || 'Неизвестный')} • ${escapeHtml(carName)}</div>
                    <div style="color:var(--text-secondary);font-size:11px;">${time}</div>
                </div>
            `;
        }).join('');

        if (loadMoreBtn) {
            loadMoreBtn.style.display =
                (result.total || 0) > limit ? 'block' : 'none';

            loadMoreBtn.onclick = () => {
                loadHistory(parkingId, 100, days);
                loadMoreBtn.style.display = 'none';
            };
        }

    } catch (error) {
        console.error('Ошибка загрузки истории:', error);
        container.textContent = 'Не удалось загрузить историю';
    }
}
async function saveParkingDetails() {
    if (!currentUser) {
        alert('Необходимо авторизоваться');
        return;
    }
    if (!currentParkingId || !currentParkingData) return;
    const parkingName =
        document.getElementById('editParkingName')?.value.trim() || '';
    const street =
        document.getElementById('editParkingStreet')?.value.trim() || '';
    const houseNumber =
        document.getElementById('editHouseNumber')?.value.trim() || '';
    const totalSpots =
        parseInt(document.getElementById('editParkingTotalSpots')?.value, 10) || 0;
    const description =
        document.getElementById('editParkingDescription')?.value.trim() || '';
    if (!parkingName) {
        alert('Введите название парковки');
        return;
    }
    if (!street && !houseNumber) {
        alert('Введите улицу или номер дома');
        return;
    }
    if (totalSpots < 1 || totalSpots > 500) {
        alert('Количество мест должно быть от 1 до 500');
        return;
    }
    if (
        !currentParkingData.authorId ||
        String(currentParkingData.authorId) !== String(currentUser.id)
    ) {
        alert('Можно редактировать только свои парковки');
        return;
    }
    const sessionToken = localStorage.getItem('parkNearSessionToken');
    if (!sessionToken) {
        alert('Нет активной серверной сессии. Войдите через Telegram.');
        return;
    }
    const updates = {
        name: parkingName,
        street,
        houseNumber,
        totalSpots,
        description
    };
    try {
        const response = await fetch(
            `${window.PARKNEAR_API_URL}/api/parkings/${encodeURIComponent(currentParkingId)}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify(updates)
            }
        );
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(
                result.error || 'Не удалось обновить парковку'
            );
        }
        currentParkingData = {
            ...currentParkingData,
            ...(result.parking || updates)
        };
        parkingDataCache[currentParkingId] = currentParkingData;
        try {
            refreshParkingMarker(currentParkingId);
        } catch (error) {
            console.warn('Не удалось обновить маркер парковки:', error);
        }
        if (typeof refreshParkingClusters === 'function') {
            refreshParkingClusters();
        }
        closePanel();
        showMap();
        showToast('Парковка обновлена', 2000);
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('Ошибка: ' + (error.message || 'неизвестная'));
    }
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

    const token = localStorage.getItem('parkNearSessionToken');

    if (!token) {
        showToast('Нет активной серверной сессии. Войдите заново.');
        return;
    }

    if (delta !== 1 && delta !== -1) {
        showToast('Недопустимое изменение занятости');
        return;
    }

    try {
        const response = await fetch(
            `${window.PARKNEAR_API_URL}/api/parkings/${encodeURIComponent(id)}/occupancy`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ delta })
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.error || 'Не удалось изменить занятость'
            );
        }

        const updatedParking = result.parking;

        parkingDataCache[id] = {
            ...parkingDataCache[id],
            ...updatedParking,
            id
        };

        if (id === currentParkingId) {
            currentParkingData = parkingDataCache[id];
        }

        updateOccupancyDisplay(result.occupiedSpots);

        if (typeof refreshParkingMarker === 'function') {
            refreshParkingMarker(id);
        }

        if (typeof refreshParkingClusters === 'function') {
            refreshParkingClusters();
        }

        if (document.getElementById('historyList')) {
            loadHistoryPreview(id);
        }
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.selectionChanged();
        }
    } catch (error) {
        console.error('Ошибка обновления занятости:', error);
        showToast(error.message || 'Не удалось изменить количество мест');
    }
}
    
async function confirmParking(parkingId) {
    if (!currentUser) {
        showToast('Необходимо авторизоваться');
        return;
    }

    const token = localStorage.getItem('parkNearSessionToken');

    if (!token) {
        showToast('Нет активной серверной сессии');
        return;
    }

    try {
        const response = await fetch(
            `${window.PARKNEAR_API_URL}/api/parkings/${encodeURIComponent(parkingId)}/confirm`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.error || 'Не удалось подтвердить парковку'
            );
        }
        showToast('Спасибо за подтверждение!');
    } catch (error) {
        console.error('Ошибка подтверждения парковки:', error);
        showToast(error.message || 'Ошибка подтверждения');
    }
}
    // ===================== АДРЕСА =====================
// ============================================
// ДОМАШНИЕ АДРЕСА — POSTGRESQL
// ============================================
async function getHomeAddresses() {
    const profile = await requestUserProfile('GET');
    const addresses = profile.homeAddresses || {};
    return Array.isArray(addresses)
        ? Object.fromEntries(
            addresses.map((address, index) => [
                String(address.id || `address_${index}`),
                address
            ])
        )
        : addresses;
}
async function saveHomeAddresses(addresses) {
    await requestUserProfile('PATCH', {
        homeAddresses: addresses
    });
    if (currentUser) {
        currentUser.homeAddresses = addresses;
    }
    return addresses;
}
   async function addHomeAddress() {
    if (!currentUser) {
        alert('Необходимо войти');
        return;
    }
    try {
        const addresses = await getHomeAddresses();
        if (Object.keys(addresses).length >= 3) {
            alert('Максимум 3 адреса');
            return;
        }
        openAddressPicker();
    } catch (error) {
        console.error('Ошибка загрузки домашних адресов:', error);
        alert('Не удалось загрузить домашние адреса');
    }
}
async function centerMapOnAddress(lat, lng) {
    if (!Number.isFinite(Number(lat)) ||
        !Number.isFinite(Number(lng))) {
        return;
    }
    lat = Number(lat);
    lng = Number(lng);
    closePanel();
    if (!map || typeof ymaps === 'undefined') return;
    map.setCenter([lat, lng], 17, { duration: 500 });
    if (window._addressPreviewMarker) {
        map.geoObjects.remove(window._addressPreviewMarker);
        window._addressPreviewMarker = null;
    }
    const marker = new ymaps.Placemark(
        [lat, lng],
        {
            hintContent: 'Дом',
            balloonContent: 'Определяем адрес...'
        },
        {
            preset: 'islands#redHomeIcon',
            draggable: false
        }
    );
    window._addressPreviewMarker = marker;
    map.geoObjects.add(marker);
    marker.events.add('click', function() {
        marker.balloon.open();
    });
    const addressData = await getAddressByCoordinates(lat, lng);
    // Проверяем, что за время запроса не выбрали другой адрес.
    if (window._addressPreviewMarker !== marker) return;
    const street = String(addressData?.street || '').trim();
    const house = String(addressData?.houseNumber || '').trim();
    const address = [street, house].filter(Boolean).join(', ');
    const safeAddress = escapeHtml(
        address || addressData?.address || 'Адрес не определён'
    );
    marker.properties.set({
        hintContent: safeAddress,
        balloonContent: safeAddress
    });
    marker.balloon.open();
    setTimeout(function() {
        if (window._addressPreviewMarker === marker) {
            map.geoObjects.remove(marker);
            window._addressPreviewMarker = null;
        }
    }, 8000);
}
  function openAddressPicker() {
    if (!currentUser) {
        alert('Необходимо войти');
        return;
    }

    isAddressPickerOpen = true;
    const overlay = document.getElementById('addressPickerOverlay');
    if (!overlay) return;

    overlay.style.display = 'block';

    setTimeout(() => {
        const center = map?.getCenter?.() || [55.7558, 37.6173];

        if (!addressPickerMap) {
            addressPickerMap = new ymaps.Map('addressPickerMap', {
                center,
                zoom: 15,
                controls: ['zoomControl']
            });
            addressPickerMap.events.add('click', e => {
                setAddressPickerCoords(e.get('coords'));
            });
            setAddressPickerCoords(center);
        } else {
            addressPickerMap.container.fitToViewport();
            addressPickerMap.setCenter(center, 15, { duration: 300 });
        }
    }, 100);
}
function setAddressPickerCoords(coords) {
    if (!Array.isArray(coords) || coords.length < 2) return;

    addressPickerCoords = [Number(coords[0]), Number(coords[1])];

    if (addressPickerPlacemark) {
        addressPickerPlacemark.geometry.setCoordinates(addressPickerCoords);
        return;
    }
    addressPickerPlacemark = new ymaps.Placemark(addressPickerCoords, {
        hintContent: 'Ваш адрес',
        balloonContent: 'Перетащите метку'
    }, {
        preset: 'islands#redHomeIcon',
        draggable: true
    });
    addressPickerMap.geoObjects.add(addressPickerPlacemark);

    addressPickerPlacemark.events.add('dragend', () => {
        const coords = addressPickerPlacemark.geometry.getCoordinates();
        addressPickerCoords = [Number(coords[0]), Number(coords[1])];
    });
}
    function cancelAddressPicker() {
        document.getElementById('addressPickerOverlay').style.display = 'none';
        isAddressPickerOpen = false;
        if (addressPickerPlacemark) {
            addressPickerMap.geoObjects.remove(addressPickerPlacemark);
            addressPickerPlacemark = null;
        }
        addressPickerCoords = null;
        pendingAddressData = null;
    }

    function saveAddressFromPicker() {
        if (!currentUser) { alert('Необходимо войти');
            cancelAddressPicker(); return; }
        if (!addressPickerCoords) { alert('Установите метку на карте'); return; }

        const saveBtn = document.querySelector('#addressPickerContainer .btn-primary');
        const origText = saveBtn.textContent;
        saveBtn.textContent = 'Обработка...';
        saveBtn.disabled = true;

        ymaps.geocode(addressPickerCoords, { kind: 'house', results: 1 })
            .then(res => {
                const geoObject = res.geoObjects.get(0);
                let addressText = '';
                let parsed = { region: '', city: '', street: '', houseNumber: '' };
                if (geoObject) {
                    addressText = geoObject.getAddressLine();
                    parsed = parseAddress(addressText);
                } else {
                    addressText =
                        `Точка (${addressPickerCoords[0].toFixed(6)}, ${addressPickerCoords[1].toFixed(6)})`;
                }

                pendingAddressData = {
                    address: addressText,
                    lat: addressPickerCoords[0],
                    lng: addressPickerCoords[1],
                    city: parsed.city,
                    street: parsed.street,
                    houseNumber: parsed.houseNumber
                };

                document.getElementById('addressPickerOverlay').style.display = 'none';
                document.getElementById('labelPickerOverlay').classList.add('active');
            })
            .catch(err => {
                console.error('Ошибка геокодирования:', err);
                pendingAddressData = {
                    address: `Точка (${addressPickerCoords[0].toFixed(6)}, ${addressPickerCoords[1].toFixed(6)})`,
                    lat: addressPickerCoords[0],
                    lng: addressPickerCoords[1],
                    city: '',
                    street: '',
                    houseNumber: ''
                };
                document.getElementById('addressPickerOverlay').style.display = 'none';
                document.getElementById('labelPickerOverlay').classList.add('active');
            })
            .finally(() => {
                saveBtn.textContent = origText;
                saveBtn.disabled = false;
            });
    }

  async function selectLabel(label) {
    if (!pendingAddressData || !currentUser) return;
    const data = pendingAddressData;
    try {
        const addresses = await getHomeAddresses();
        if (Object.keys(addresses).length >= 3) {
            alert('Максимум 3 адреса');
            cancelLabelPicker();
            return;
        }
        const addressId = (
            typeof crypto !== 'undefined' &&
            typeof crypto.randomUUID === 'function'
        )
            ? crypto.randomUUID()
            : `address_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        addresses[addressId] = {
            address: data.address,
            lat: data.lat ?? null,
            lng: data.lng ?? null,
            label,
            city: data.city || '',
            street: data.street || '',
            houseNumber: data.houseNumber || '',
            timestamp: Date.now()
        };
        await saveHomeAddresses(addresses);
        cancelLabelPicker();
        alert('Адрес сохранён!');
        showPanel('favorites');
    } catch (error) {
        console.error('Ошибка сохранения адреса:', error);
        alert('Ошибка сохранения: ' + error.message);
        cancelLabelPicker();
    }
}
    function cancelLabelPicker() {
        document.getElementById('labelPickerOverlay').classList.remove('active');
        pendingAddressData = null;
    }
    async function removeHomeAddress(addressId) {
    if (!currentUser || !addressId) return;
    if (!confirm('Удалить адрес?')) return;
    try {
        const addresses = await getHomeAddresses();
        if (!addresses[addressId]) {
            alert('Адрес не найден');
            return;
        }
        delete addresses[addressId];
        await saveHomeAddresses(addresses);
        showPanel('favorites');
    } catch (error) {
        console.error('Ошибка удаления адреса:', error);
        alert('Ошибка: ' + error.message);
    }
}
    // ===================== РЕДАКТОР АДРЕСА =====================
 async function openAddressEditor(addressId) {
    if (!currentUser || !addressId) return;
    const overlay = document.getElementById('addressEditorOverlay');
    if (!overlay) return;
    try {
        const addresses = await getHomeAddresses();
        const addr = addresses[addressId];
        if (!addr) {
            alert('Адрес не найден');
            return;
        }
        document.getElementById('editAddrId').value = addressId;
        document.getElementById('editAddrLabel').value = addr.label || 'Дом';
        document.getElementById('editAddrCity').value = addr.city || '';
        document.getElementById('editAddrStreet').value = addr.street || '';
        document.getElementById('editAddrHouse').value = addr.houseNumber || '';
        overlay.classList.add('active');
    } catch (error) {
        console.error('Ошибка загрузки адреса:', error);
        alert('Не удалось загрузить адрес');
    }
}
    function closeAddressEditor() {
        document.getElementById('addressEditorOverlay').classList.remove('active');
    }
  async function saveAddressChanges() {
    if (!currentUser) return;
    const addressId = document.getElementById('editAddrId').value;
    const label = document.getElementById('editAddrLabel').value;
    const city = document.getElementById('editAddrCity').value.trim();
    const street = document.getElementById('editAddrStreet').value.trim();
    const houseNumber = document.getElementById('editAddrHouse').value.trim();
    const fullAddress = [
        city,
        street,
        houseNumber ? `д. ${houseNumber}` : ''
    ].filter(Boolean).join(', ') || 'Адрес не указан';
    try {
        const addresses = await getHomeAddresses();
        if (!addresses[addressId]) {
            alert('Адрес не найден');
            return;
        }
        addresses[addressId] = {
            ...addresses[addressId],
            label,
            city,
            street,
            houseNumber,
            address: fullAddress
        };
        await saveHomeAddresses(addresses);
        closeAddressEditor();
        if (document.getElementById('panel')?.classList.contains('active')) {
            const content = document.getElementById('panelContent');
            loadUserData('favorites', content);
        }
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
    } catch (error) {
        console.error('Ошибка обновления адреса:', error);
        alert('Ошибка: ' + error.message);
    }
}
    function findParkingsNearAddress(lat, lng, addressText) {
        if (lat && lng) {
            nearbySearchFilter = { lat: lat, lng: lng, radius: 300 };
            map.setCenter([lat, lng], 18, { duration: 500 });
            showPanel('search', true);
            return;
        }
        if (addressText) {
            ymaps.geocode(addressText, { results: 1 })
                .then(res => {
                    const geo = res.geoObjects.get(0);
                    if (geo) {
                        const coords = geo.geometry.getCoordinates();
                        nearbySearchFilter = { lat: coords[0], lng: coords[1], radius: 300 };
                        map.setCenter(coords, 16, { duration: 500 });
                        showPanel('search', true);
                    } else {
                        alert('Не удалось определить координаты по адресу');
                    }
                })
                .catch(() => alert('Не удалось определить координаты по адресу'));
        } else {
            alert('Не удалось определить координаты для поиска');
        }
    }

    // ===================== ПОИСК =====================
    function searchNearMe() {
    // Показываем индикатор загрузки в блоке "Рядом с вами"
    var container = document.getElementById('homeParkingList');
    if (container) {
        container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Поиск парковок рядом...</p></div>';
    }

    getUserLocation().then(function(coords) {
        userLocationForSearch = coords;
        // Обновляем список на главной
        if (container) {
            showNearbyParkings(coords, 5);
        }
        // Также обновляем фильтр в поиске (если он открыт)
        if (document.getElementById('searchResults')) {
            nearbySearchFilter = { lat: coords.lat, lng: coords.lng, radius: 1000 };
            filterParkings();
        }
        // Обновляем слайдер радиуса (если есть)
        var radiusSlider = document.getElementById('radiusSlider');
        if (radiusSlider) {
            radiusSlider.value = 1;
            var radiusLabel = document.getElementById('radiusLabel');
            if (radiusLabel) radiusLabel.textContent = '1 км';
        }
    }).catch(function(err) {
        console.error('Ошибка геолокации:', err);
        alert('Не удалось определить ваше местоположение. Проверьте разрешения для геолокации в браузере.');
        // Если геолокация не удалась, показываем все парковки (без сортировки)
        if (container) {
            var allParkings = Object.values(parkingDataCache).filter(function(p) { return p.lat && p.lng; });
            renderParkingList(container, allParkings);
        }
    });
}

    function clearFilters() {
        nearbySearchFilter = {
            city: userCityPrefs.city || '',
            region: userCityPrefs.region || ''
        };
        userLocationForSearch = null;
        document.getElementById('searchInput').value = '';
        document.getElementById('radiusSlider').value = 1;
        document.getElementById('radiusLabel').textContent = '1 км';
        if (document.getElementById('showWithFreeOnly')) document.getElementById('showWithFreeOnly').checked = false;
        if (document.getElementById('sortSelect')) document.getElementById('sortSelect').value = 'name';
        filterParkings();
    }

    function renderSearchPanel(content) {
    const now = Date.now();
    const needRefresh = (now - lastDataRefresh > REFRESH_INTERVAL_MS) || lastDataRefresh === 0;
    if (needRefresh) {
        const searchInput = document.getElementById('searchInput');
        const sortSelect = document.getElementById('sortSelect');
        const radiusSlider = document.getElementById('radiusSlider');
        const freeOnlyCheck = document.getElementById('showWithFreeOnly');
        const savedSearch = searchInput ? searchInput.value : '';
        const savedSort = sortSelect ? sortSelect.value : 'name';
        const savedRadius = radiusSlider ? radiusSlider.value : '1';
        const savedFreeOnly = freeOnlyCheck ? freeOnlyCheck.checked : false;

        content.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Обновление данных...</p>
            </div>
        `;

        // ✅ ИСПРАВЛЕНО: передаём currentCity
        loadAllParkings(currentCity).then(function() {
            renderSearchPanel(content, {
                searchQuery: savedSearch,
                sortBy: savedSort,
                radius: savedRadius,
                freeOnly: savedFreeOnly
            });
        }).catch(function() {
            renderSearchPanel(content, {
                searchQuery: savedSearch,
                sortBy: savedSort,
                radius: savedRadius,
                freeOnly: savedFreeOnly
            });
        });
        return;
    }

    var state = arguments[1] || {};
    var defaultCity = userCityPrefs.city || '';
    var searchQuery = state.searchQuery || '';
    var sortBy = state.sortBy || 'name';
    var radius = state.radius || '1';
    var freeOnly = state.freeOnly !== undefined ? state.freeOnly : false;

    var html = `
    <div class="search-bar">
        <input type="text" id="searchInput" placeholder="Улица, дом..." oninput="filterParkings()" value="${searchQuery}">
    </div>
    <div style="display:flex; gap:8px; margin-bottom:12px;">
        <button class="btn-secondary" style="flex:1;" onclick="searchNearMe()">📍 Рядом со мной</button>
        <button class="btn-outline" style="flex:1;" onclick="clearFilters()">↺ Сбросить</button>
    </div>
    <div style="position: relative; margin: 12px 0;">
        <div id="radiusTooltip" style="position: absolute; top: -24px; left: 50%; transform: translateX(-50%); background: var(--text-primary); color: var(--bg-primary); padding: 2px 8px; border-radius: 8px; font-size: 12px; display: none; white-space: nowrap;"></div>
        <div style="display: flex; align-items: center; gap: 10px;">
            <input type="range" id="radiusSlider" min="0.1" max="5" step="0.1" value="${radius}" style="flex:1;" oninput="updateRadiusLabel(); filterParkings();">
            <span id="radiusLabel" style="min-width: 40px;">${radius} км</span>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 6px; justify-content: center;">
            <button class="preset-btn" onclick="setRadiusPreset(0.5)">500 м</button>
            <button class="preset-btn" onclick="setRadiusPreset(1)">1 км</button>
            <button class="preset-btn" onclick="setRadiusPreset(2)">2 км</button>
            <button class="preset-btn" onclick="setRadiusPreset(5)">5 км</button>
        </div>
    </div>
    <div class="theme-toggle-row" style="margin-top: 12px; justify-content: space-between;">
        <div class="theme-toggle-label" style="font-size: 14px;">Только свободные</div>
        <label class="theme-switch">
            <input type="checkbox" id="showWithFreeOnly" onchange="filterParkings()" ${freeOnly ? 'checked' : ''}>
            <span class="theme-slider"></span>
        </label>
    </div>
    <div style="margin-top: 8px;">
        <label style="font-size:13px; color:var(--text-secondary);">Сортировка:</label>
        <select id="sortSelect" class="input-field" onchange="filterParkings()" style="margin-top:4px;">
            <option value="name" ${sortBy === 'name' ? 'selected' : ''}>По названию</option>
            <option value="free" ${sortBy === 'free' ? 'selected' : ''}>По возрастанию свободных мест</option>
            <option value="distance" ${sortBy === 'distance' ? 'selected' : ''}>По расстоянию (если известна геопозиция)</option>
        </select>
    </div>
    <div id="searchResults" class="list-container">
        <p style="color:var(--text-secondary); text-align:center;">Введите улицу для поиска</p>
    </div>
    `;
    content.innerHTML = html;

    getUserLocation().then(function(coords) { userLocationForSearch = coords; }).catch(function() { userLocationForSearch = null; });
    filterParkings();

    setTimeout(function() {
        var slider = document.getElementById('radiusSlider');
        if (slider) {
            slider.addEventListener('pointerdown', function() {
                var tooltip = document.getElementById('radiusTooltip');
                if (tooltip) tooltip.style.display = 'block';
            });
            slider.addEventListener('pointerup', function() {
                setTimeout(function() {
                    var tooltip = document.getElementById('radiusTooltip');
                    if (tooltip) tooltip.style.display = 'none';
                }, 800);
            });
        }
    }, 100);

    var freeToggle = document.getElementById('showWithFreeOnly');
    if (freeToggle) {
        freeToggle.addEventListener('change', function() {
            setTimeout(filterParkings, 50);
        });
    }

    var radiusLabel = document.getElementById('radiusLabel');
    if (radiusLabel) {
        radiusLabel.textContent = radius + ' км';
    }
}
    function openCityPicker() {
        const overlay = document.getElementById('cityPickerOverlay');
        if (!overlay) return;
        overlay.style.display = 'flex';

        const regionSelect = document.getElementById('cityPickerRegion');
        if (regionSelect) {
            regionSelect.innerHTML = '<option value="">Выберите регион</option>';
            Object.keys(regionsData).sort().forEach(r => {
                const opt = document.createElement('option');
                opt.value = r;
                opt.textContent = r;
                if (r === mapCity?.region) opt.selected = true;
                regionSelect.appendChild(opt);
            });
            updateCityPickerCities();
        }
    }

    function closeCityPicker() {
        const overlay = document.getElementById('cityPickerOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    function updateCityPickerCities() {
        const region = document.getElementById('cityPickerRegion')?.value;
        const citySelect = document.getElementById('cityPickerCity');
        if (!citySelect) return;
        citySelect.innerHTML = '<option value="">Выберите город</option>';
        if (region && regionsData[region]) {
            regionsData[region].forEach(city => {
                const opt = document.createElement('option');
                opt.value = city;
                opt.textContent = city;
                if (city === currentCity) opt.selected = true;
                citySelect.appendChild(opt);
            });
        }
    }
function applyCityFromPicker() {
    const regionSelect = document.getElementById('cityPickerRegion');
    const citySelect = document.getElementById('cityPickerCity');
    const region = regionSelect?.value?.trim() || '';
    const city = citySelect?.value?.trim() || '';
    if (!region || !city) {
        alert('Выберите регион и город');
        return;
    }
    // Сохраняем именно выбранный город для карты
    currentCity = city;
    mapCity = {
        region: region,
        city: city
    };
    // Сохраняем выбор пользователя
    localStorage.setItem('selectedCity', city);
    localStorage.setItem(
        'parknear_map_city',
        JSON.stringify({
            region: region,
            city: city
        })
    );
    updateCityDisplay();
    closeCityPicker();
    // Сбрасываем старые координаты города
    cityCoords = null;
    // Пытаемся получить координаты города
    const coords = getCityCoordinates(city);
    if (map && coords) {
        map.setCenter(coords, 12, {
            duration: 500
        });
        cityCoords = {
            lat: coords[0],
            lng: coords[1]
        };
        localStorage.setItem(
            'parknear_map_city_coords',
            JSON.stringify(cityCoords)
        );
    } else if (
        typeof ymaps !== 'undefined' &&
        ymaps.geocode
    ) {
        ymaps.geocode(
            `${region}, ${city}`,
            {
                results: 1
            }
        ).then(res => {
            const geo = res.geoObjects.get(0);
            if (!geo) {
                console.warn(
                    'Не удалось найти координаты города:',
                    city
                );
                return;
            }
            const coords =
                geo.geometry.getCoordinates();
            cityCoords = {
                lat: coords[0],
                lng: coords[1]
            };
            localStorage.setItem(
                'parknear_map_city_coords',
                JSON.stringify(cityCoords)
            );
            if (map) {
                map.setCenter(
                    coords,
                    12,
                    {
                        duration: 500
                    }
                );
            }
        }).catch(err => {
            console.warn(
                'Не удалось определить координаты города:',
                err
            );
        });
    }
   loadAllParkings(city, true).catch(error => {
    console.error('Ошибка загрузки парковок выбранного города:', error);
});
}
function getCityCoordinates(city) {
    if (cityCoords && cityCoords.lat && cityCoords.lng) {
        return [cityCoords.lat, cityCoords.lng];
    }
    const coordsMap = {
        'Москва': [55.7558, 37.6173],
        'Санкт-Петербург': [59.9343, 30.3351],
        'Новосибирск': [55.0302, 82.9204],
        'Екатеринбург': [56.8389, 60.6057],
        'Казань': [55.8304, 49.0661],
        'Нижний Новгород': [56.2965, 43.9361],
        'Челябинск': [55.1602, 61.4026],
        'Омск': [54.9885, 73.3242],
        'Самара': [53.1959, 50.1008],
        'Ростов-на-Дону': [47.2221, 39.7203],
        'Уфа': [54.7351, 55.9587],
        'Красноярск': [56.0106, 92.8526],
        'Пермь': [58.0104, 56.2294],
        'Воронеж': [51.6606, 39.2003],
        'Волгоград': [48.7071, 44.5169],
        'Краснодар': [45.0355, 38.9753],
        'Саратов': [51.5336, 46.0342],
        'Тюмень': [57.1522, 65.5412],
        'Тольятти': [53.5078, 49.4204],
        'Ижевск': [56.8528, 53.2115],
        'Барнаул': [53.3561, 83.7898],
        'Ульяновск': [54.3179, 48.4024],
        'Иркутск': [52.2864, 104.2807],
        'Хабаровск': [48.4802, 135.0719],
        'Владивосток': [43.1152, 131.8855],
        'Якутск': [62.0276, 129.7323],
        'Севастополь': [44.6167, 33.5254],
        'Симферополь': [44.9484, 34.1003],
    };
    return coordsMap[city] || null;
}

function createMarkersAndCluster(parkings) {
    // Удаляем старый кластер
    if (clustererInstance) {
        mapInstance.geoObjects.remove(clustererInstance);
        clustererInstance = null;
    }

    // Создаём метки
    const newPlacemarks = parkings.map(parking => {
        const coords = [parking.latitude, parking.longitude];
        return new ymaps.Placemark(coords, {
            balloonContent: `<b>${parking.name}</b><br>${parking.address}`
        });
    });

    // Создаём кластер
    clustererInstance = new ymaps.Clusterer({
        clusterDisableClickZoom: false,
        clusterOpenBalloonOnClick: true,
        gridSize: 32,
        minClusterSize: 3
    });
    clustererInstance.add(newPlacemarks);
    mapInstance.geoObjects.add(clustererInstance);
    placemarks = newPlacemarks; // сохраняем для очистки
}
    function updateCityDisplay() {
    const cityName = currentCity || userCityPrefs.city || mapCity?.city || 'Не указан';
    const displayEl = document.getElementById('cityDisplayName');
    if (displayEl) displayEl.textContent = cityName;
}
// Восстанавливаем город в плашке при запуске приложения
function restoreCityDisplay() {
    const savedCity = localStorage.getItem('selectedCity');
    if (savedCity) {
        currentCity = savedCity;
    }
    updateCityDisplay();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreCityDisplay);
} else {
    restoreCityDisplay();
}
    function changeSearchCity() {
        openCityPicker();
    }

    function updateRadiusLabel() {
        const slider = document.getElementById('radiusSlider');
        if (!slider) return;
        const val = parseFloat(slider.value);
        document.getElementById('radiusLabel').textContent = val + ' км';

        const tooltip = document.getElementById('radiusTooltip');
        if (tooltip) {
            tooltip.textContent = val + ' км';
            tooltip.style.display = 'block';
        }

        if (userLocationForSearch) {
            nearbySearchFilter = { lat: userLocationForSearch.lat, lng: userLocationForSearch.lng, radius: val *
                    1000 };
        }
    }

    function setRadiusPreset(km) {
        const slider = document.getElementById('radiusSlider');
        if (!slider) return;
        slider.value = km;
        updateRadiusLabel();
        filterParkings();
    }

    function updateCitySelect() {
        const region = document.getElementById('regionSelect').value;
        const citySelect = document.getElementById('citySelect');
        citySelect.innerHTML = '<option value="">Все города</option>';
        if (region && regionsData[region]) {
            regionsData[region].forEach(city => {
                const opt = document.createElement('option');
                opt.value = city;
                opt.textContent = city;
                citySelect.appendChild(opt);
            });
        }
        filterParkings();
    }

    function filterParkings() {
    var searchInput = document.getElementById('searchInput');
    var query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    var resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) return;

    var filterRegion = (nearbySearchFilter ? nearbySearchFilter.region : '') || (mapCity ? mapCity.region : '') || userCityPrefs.region || '';
    var filterCity = (nearbySearchFilter ? nearbySearchFilter.city : '') || (mapCity ? mapCity.city : '') || userCityPrefs.city || '';
    var parkings = Object.entries(parkingDataCache).map(function(entry) {
        return { id: entry[0], ...entry[1] };
    });
    var hasNearbyFilter = nearbySearchFilter && nearbySearchFilter.lat && nearbySearchFilter.lng;

    if (!hasNearbyFilter) {
        var cityFilter = mapCity ? mapCity.city.toLowerCase() : (userCityPrefs.city ? userCityPrefs.city.toLowerCase() : '');
        if (cityFilter) {
            parkings = parkings.filter(function(p) {
                var pCity = (p.city || '').toLowerCase();
                var pAddr = (p.address || '').toLowerCase();
                var pName = (p.name || '').toLowerCase();
                return pCity.indexOf(cityFilter) !== -1 || pAddr.indexOf(cityFilter) !== -1 || pName.indexOf(cityFilter) !== -1;
            });
        }
    }

    if (filterRegion) {
        parkings = parkings.filter(function(p) {
            return (p.region && p.region.toLowerCase().indexOf(filterRegion.toLowerCase()) !== -1) ||
                   (p.address && p.address.toLowerCase().indexOf(filterRegion.toLowerCase()) !== -1) ||
                   (p.name && p.name.toLowerCase().indexOf(filterRegion.toLowerCase()) !== -1);
        });
    }

    if (filterCity) {
        parkings = parkings.filter(function(p) {
            return (p.city && p.city.toLowerCase().indexOf(filterCity.toLowerCase()) !== -1) ||
                   (p.address && p.address.toLowerCase().indexOf(filterCity.toLowerCase()) !== -1) ||
                   (p.name && p.name.toLowerCase().indexOf(filterCity.toLowerCase()) !== -1);
        });
    }

    if (query) {
        parkings = parkings.filter(function(p) {
            return (p.name && p.name.toLowerCase().indexOf(query) !== -1) ||
                   (p.address && p.address.toLowerCase().indexOf(query) !== -1) ||
                   (p.street && p.street.toLowerCase().indexOf(query) !== -1) ||
                   (p.houseNumber && p.houseNumber.toLowerCase().indexOf(query) !== -1);
        });
    }

    if (nearbySearchFilter && nearbySearchFilter.lat && nearbySearchFilter.lng) {
        var lat = nearbySearchFilter.lat;
        var lng = nearbySearchFilter.lng;
        var radius = nearbySearchFilter.radius;
        parkings = parkings.filter(function(p) {
            var dist = getDistanceInMeters(lat, lng, p.lat, p.lng);
            return dist <= radius;
        });
    }

    var freeOnlyCheck = document.getElementById('showWithFreeOnly');
    var showFreeOnly = freeOnlyCheck ? freeOnlyCheck.checked : false;
    if (showFreeOnly) {
        parkings = parkings.filter(function(p) {
            return (p.totalSpots - (p.occupiedSpots || 0)) > 0;
        });
    }

    var sortSelect = document.getElementById('sortSelect');
    var sortBy = sortSelect ? sortSelect.value : 'name';
    switch (sortBy) {
        case 'free':
            parkings.sort(function(a, b) {
                return (a.totalSpots - (a.occupiedSpots || 0)) - (b.totalSpots - (b.occupiedSpots || 0));
            });
            break;
        case 'distance':
            if (userLocationForSearch) {
                parkings.sort(function(a, b) {
                    var distA = getDistanceInMeters(userLocationForSearch.lat, userLocationForSearch.lng, a.lat, a.lng);
                    var distB = getDistanceInMeters(userLocationForSearch.lat, userLocationForSearch.lng, b.lat, b.lng);
                    return distA - distB;
                });
            }
            break;
        default:
            parkings.sort(function(a, b) {
                return (a.name || '').localeCompare(b.name || '');
            });
    }

    var html = '';
    if (parkings.length === 0) {
        html = '<div class="empty-state"><p>Ничего не найдено' + (filterCity ? ' в ' + filterCity : '') + '</p>' +
               (filterCity ? '<p style="font-size:13px; margin-top:8px;">Попробуйте изменить город в настройках</p>' : '') +
               '</div>';
    } else {
        var grouped = {};
        parkings.forEach(function(p) {
            var key = (p.street || p.name || 'Без названия').trim();
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(p);
        });
        html = '<div class="list-container">';
        for (var street in grouped) {
            if (grouped.hasOwnProperty(street)) {
                var items = grouped[street];
                html += '<div class="group-header" onclick="toggleGroup(this)">' +
                        '<span class="group-icon">▼</span>' +
                        '<span>' + street + ' (' + items.length + ')</span>' +
                        '</div>';
                html += '<div class="group-items">';
                items.forEach(function(p) {
                    var free = p.totalSpots - (p.occupiedSpots || 0);
                    var isAuthor = currentUser && currentUser.id === p.authorId;
                    var subtitle = '';
                    if (userLocationForSearch && p.lat && p.lng) {
                        var dist = getDistanceInMeters(userLocationForSearch.lat, userLocationForSearch.lng, p.lat, p.lng);
                        subtitle = (dist < 1000) ? Math.round(dist) + ' м от вас' : (dist/1000).toFixed(1) + ' км от вас';
                    } else {
                        subtitle = p.address || (p.lat ? p.lat.toFixed(4) + ', ' + p.lng.toFixed(4) : '');
                    }
                    subtitle += ' · Свободно: ' + free + '/' + p.totalSpots;
                    html += '<div class="swipe-container">' +
                            '<div class="swipe-item" onclick="focusMap(' + p.lat + ', ' + p.lng + ', \'' + p.id + '\')">' +
                            '<span class="occupancy-dot" style="background: ' + getOccupancyDotColor(free, p.totalSpots) + ';"></span>' +
                            '<div class="list-info">' +
                            '<div class="list-title">' + (p.name || 'Без названия') + '</div>' +
                            '<div class="list-subtitle">' + subtitle + '</div>' +
                            '</div>' +
                            '</div>' +
                            (isAuthor ? '<div class="swipe-delete" onclick="deleteParking(\'' + p.id + '\')">Удалить</div>' : '') +
                            '</div>';
                });
                html += '</div>';
            }
        }
        html += '</div>';
    }
    resultsContainer.innerHTML = html;
    attachSwipeToContainers(resultsContainer);
}
function focusMap(lat, lng, parkingId) {
    closeCenterSheet();
    setTimeout(function() {
        if (!map) return;
        const data = parkingDataCache[parkingId];
        const marker = mapMarkers[parkingId];
        if (marker) {
            const polygon = marker.properties.get('polygon');
            if (activePolygon && activePolygon !== polygon) {
                activePolygon.options.set('visible', false);
            }
            if (polygon) {
                activePolygon = polygon;
                polygon.options.set({
                    visible: true,
                    zIndex: 1000
                });
                const bounds = polygon.geometry.getBounds();
                if (bounds) {
                    map.setBounds(bounds, {
                        checkZoomRange: true,
                        zoomMargin: [40, 40, 280, 40],
                        duration: 350
                    });
                }
            } else {
                map.setCenter(
                    [Number(lat), Number(lng)],
                    18,
                    { duration: 350, checkZoomRange: true }
                );
            }
        } else {
            map.setCenter(
                [Number(lat), Number(lng)],
                18,
                { duration: 350, checkZoomRange: true }
            );
        }
        if (data) {
            openCenterSheet(parkingId, data);
        }
    }, 350);
}
    function highlightAndShowParking(parkingId) {
        const data = parkingDataCache[parkingId];
        if (!data) return;
        const marker = mapMarkers[parkingId];
        if (marker && marker.geometry) {
            let bounds;
            if (marker.geometry.getType() === 'Polygon' && data.coordinates && data.coordinates.length > 0) {
                const coords = data.coordinates;
                let minLat = coords[0][0],
                    maxLat = coords[0][0],
                    minLng = coords[0][1],
                    maxLng = coords[0][1];
                coords.forEach(c => { if (c[0] < minLat) minLat = c[0]; if (c[0] > maxLat) maxLat = c[0]; if (c[
                        1] < minLng) minLng = c[1]; if (c[1] > maxLng) maxLng = c[1]; });
                bounds = [
                    [minLat, minLng],
                    [maxLat, maxLng]
                ];
            } else {
                bounds = [
                    [data.lat - 0.001, data.lng - 0.001],
                    [data.lat + 0.001, data.lng + 0.001]
                ];
            }
            map.setBounds(bounds, { duration: 300 }).then(() => {
                if (map.getZoom() > 17) map.setZoom(17);
            });
        }
        if (marker) {
            const origFillColor = marker.options.get('fillColor');
            const origStrokeColor = marker.options.get('strokeColor');
            marker.options.set({ fillColor: '#2B757466', strokeColor: '#2B7574' });
            let opacity = 0.3;
            let direction = 1;
            const interval = setInterval(() => {
                opacity += direction * 0.1;
                if (opacity >= 1) { opacity = 1;
                    direction = -1; }
                if (opacity <= 0.3) { opacity = 0.3;
                    direction = 1; }
                marker.options.set({ fillColor: `rgba(43,117,116,${opacity.toFixed(1)})` });
            }, 150);
            setTimeout(() => {
                clearInterval(interval);
                marker.options.set({ fillColor: origFillColor, strokeColor: origStrokeColor });
            }, 3000);
        }
        closePanel();
    }
// ===================== ФИЛЬТР И ГРУППИРОВКА ПАРКОВОК =====================

function normalizeCity(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/\s+/g, ' ');
}

function normalizeStreet(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/\s+/g, ' ');
}

function getParkingCity(parking) {
    return parking?.city ||
           parking?.addressCity ||
           parking?.regionCity ||
           '';
}

function getParkingStreet(parking) {
    return parking?.street ||
           parking?.addressStreet ||
           '';
}
function getParkingHouse(parking) {
    return parking?.houseNumber ||
           parking?.house ||
           '';
}
function filterParkingsByCurrentCity(parkings) {
    const list = Array.isArray(parkings)
        ? parkings
        : Object.values(parkings || {});
    if (!currentCity) return list;
    const selectedCity = normalizeCity(currentCity);
    return list.filter(parking => {
        const parkingCity = normalizeCity(getParkingCity(parking));
        return parkingCity === selectedCity;
    });
}
function groupParkingsByNameAndStreet(parkings) {
    const groups = new Map();
    parkings.forEach(parking => {
        const name = String(parking?.name || 'Без названия').trim();
        const street = getParkingStreet(parking).trim();
        const key =
            `${normalizeCity(name)}|${normalizeStreet(street)}`;
        if (!groups.has(key)) {
            groups.set(key, {
                id: `group_${key}`,
                name,
                street,
                parkings: [],
                totalSpots: 0,
                occupiedSpots: 0,
                freeSpots: 0
            });
        }
        const group = groups.get(key);
        group.parkings.push(parking);
        const total = Number(parking?.totalSpots) || 0;
        const occupied = Math.min(
            Number(parking?.occupiedSpots) || 0,
            total
        );
        group.totalSpots += total;
        group.occupiedSpots += occupied;
        group.freeSpots += Math.max(0, total - occupied);
    });
    return Array.from(groups.values());
}
// ---- Вспомогательные функции для настроек инлайн ----
function updateCitySelectInSettingsInline() {
    var regionSelect = document.getElementById('settingsRegionInline');
    var region = regionSelect ? regionSelect.value : '';
    var citySelect = document.getElementById('settingsCityInline');
    if (!citySelect) return;
    citySelect.innerHTML = '<option value="">Выберите город</option>';
    if (region && regionsData[region]) {
        regionsData[region].forEach(function(city) {
            var opt = document.createElement('option');
            opt.value = city;
            opt.textContent = city;
            if (city === userCityPrefs.city) opt.selected = true;
            citySelect.appendChild(opt);
        });
    }
}
async function saveCityFromSettingsInline() {
    if (!currentUser) return;
    const regionSelect = document.getElementById('settingsRegionInline');
    const citySelect = document.getElementById('settingsCityInline');
    const region = regionSelect ? regionSelect.value : '';
    const city = citySelect ? citySelect.value : '';
    if (!region || !city) return;
    try {
        await requestUserProfile('PATCH', {
            cityPreferences: { region, city }
        });
        userCityPrefs = { region, city };
        currentCity = city;
        mapCity = null;
        localStorage.setItem(
            'parknear_city',
            JSON.stringify({ region, city })
        );
        localStorage.setItem('selectedCity', city);
        const result = await ymaps.geocode(city, { results: 1 });
        const geo = result.geoObjects.get(0);
        if (geo) {
            const coords = geo.geometry.getCoordinates();
            cityCoords = {
                lat: coords[0],
                lng: coords[1]
            };
            localStorage.setItem(
                'parknear_city_coords',
                JSON.stringify(cityCoords)
            );
            if (map) {
                map.setCenter(coords, 12, { duration: 500 });
            }
        }
        updateCityDisplay();
        loadAllParkings(city);
        if (
            window.Telegram &&
            window.Telegram.WebApp &&
            window.Telegram.WebApp.HapticFeedback
        ) {
            window.Telegram.WebApp.HapticFeedback.selectionChanged();
        }
    } catch (err) {
        alert('Ошибка сохранения города: ' + err.message);
    }
}
    function updateCitySelectInSettings() {
        const region = document.getElementById('settingsRegion')?.value;
        const citySelect = document.getElementById('settingsCity');
        if (!citySelect) return;

        citySelect.innerHTML = '<option value="">Выберите город</option>';

        if (region && regionsData[region]) {
            regionsData[region].forEach(city => {
                const opt = document.createElement('option');
                opt.value = city;
                opt.textContent = city;
                if (city === userCityPrefs.city) opt.selected = true;
                citySelect.appendChild(opt);
            });
        }
    }
async function loadUserData(type, content) {
    if (!currentUser || !content) return;

    const token = localStorage.getItem('parkNearSessionToken');

    if (!token) {
        content.innerHTML =
            '<div class="empty-state">Необходимо войти в аккаунт</div>';
        return;
    }
    content.innerHTML =
        '<div class="loading-state">Загрузка...</div>';
    try {
        const response = await fetch(
            `${window.PARKNEAR_API_URL}/api/users/me/profile`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                },
                cache: 'no-store'
            }
        );
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.error || 'Не удалось загрузить профиль'
            );
        }
        const profile = result.profile || {};
        currentUser.car = profile.car || {};
        currentUser.nickname = profile.nickname || '';
        currentUser.parkingSettings = profile.parkingSettings || {};
        userCityPrefs = profile.cityPreferences || userCityPrefs || {};

        if (type === 'favorites') {
            // Избранное будет подключено к PostgreSQL
            // на третьем этапе миграции.
            if (typeof loadFavoritesInline === 'function') {
                await loadFavoritesInline(true);
            }
            return;
        }
        content.innerHTML = '';
        if (type === 'profile') {
            renderProfile(content);
            return;
        }
        if (type === 'settings') {
            renderSettingsInline();
            return;
        }
        console.warn('Неизвестный тип пользовательских данных:', type);
    } catch (error) {
        console.error('Ошибка загрузки данных пользователя:', error);
        content.innerHTML =
            `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
}
    // ===================== UI КОНТРОЛЛЕРЫ =====================
    function attachSwipeToContainers(container) {
        container.querySelectorAll('.swipe-container').forEach(cnt => {
            const item = cnt.querySelector('.swipe-item');
            if (!item) return;
            let startX = 0,
                curX = 0,
                dragging = false;
            item.addEventListener('touchstart', e => {
                startX = e.touches[0].clientX;
                dragging = true;
                item.style.transition = 'none';
            });
            item.addEventListener('touchmove', e => {
                if (!dragging) return;
                curX = e.touches[0].clientX - startX;
                if (curX < 0) item.style.transform = `translateX(${Math.max(curX, -80)}px)`;
            });
            item.addEventListener('touchend', () => {
                dragging = false;
                item.style.transition = 'transform 0.2s';
                if (curX < -40) item.style.transform = 'translateX(-80px)';
                else item.style.transform = 'translateX(0)';
                curX = 0;
            });
            const deleteBtn = cnt.querySelector('.swipe-delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    item.style.transform = 'translateX(0)';
                });
            }
        });
    }
function showPanel(type, keepFilter = false) {
       // Скрываем кнопку доната при открытии любой панели
    const donateBtn = document.getElementById('donateBtn');
    if (donateBtn) {
        donateBtn.style.display = 'none';
    }
    if (type === 'search' && !keepFilter) {
        nearbySearchFilter = null;
    }
    document.getElementById('panel').classList.add('active');
    const content = document.getElementById('panelContent');
    const titles = {
        profile: 'Профиль',
        favorites: 'Избранное',
        search: 'Поиск',
        home: 'Главная',
        mycar: 'Моя машина'
    };
    document.getElementById('panelTitle').textContent = titles[type] || 'Главная';
    // Рендерим нужный контент
    switch (type) {
        case 'profile':
            renderProfile(content);
            break;
        case 'favorites':
         renderFavorites(content);
         break;
        case 'search':
            renderSearchPanel(content);
            break;
        case 'mycar':
            if (typeof renderMyCarPanel === 'function') {
                renderMyCarPanel(content);
            } else {
                content.innerHTML = '<div class="empty-state"><p>Функция "Моя машина" ещё не добавлена</p></div>';
            }
            break;
        default: // home
            renderHomePanel(content);
    }
    // Обновляем активную вкладку в нижнем меню
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const tabIndex = { home: 0, search: 1, favorites: 2, profile: 3, mycar: 1 };
    const idx = tabIndex[type] !== undefined ? tabIndex[type] : 0;
    const tabs = document.querySelectorAll('.tab');
    if (tabs[idx]) tabs[idx].classList.add('active');
}
    function toggleGroup(header) {
        const items = header.nextElementSibling;
        if (items) {
            items.style.display = items.style.display === 'none' ? 'block' : 'none';
            header.classList.toggle('collapsed');
        }
    }
    function closePanel() {
    nearbySearchFilter = null;
    if (isAddressPickerOpen) cancelAddressPicker();
    closeCenterSheet();
    closeRoute();
    document.getElementById('panel').classList.remove('active');
   // Показываем кнопку доната при возврате на карту
    const donateBtn = document.getElementById('donateBtn');
    if (donateBtn) {
    donateBtn.style.display = 'flex';
}
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab')[1].classList.add('active');
    currentParkingId = null;
    currentParkingData = null;
    // Если мы редактируем полигон существующей парковки – сбрасываем
    if (editingPolygon) {
        map.geoObjects.remove(editingPolygon);
        editingPolygon = null;
        document.getElementById('addBtn').classList.remove('drawing');
        document.getElementById('addBtn').textContent = '+';
        isDrawingMode = false;
        const c = document.getElementById('drawingControls');
        if (c) c.remove();
    }
    // ⚠️ НЕ УДАЛЯЕМ drawingControls для нового рисования
    // Они остаются на карте, чтобы пользователь мог продолжить
    if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
    }
    lastClickParkingId = null;
    lastClickTime = 0;
    resetHighlightedParkings();
}
   function showMap() {
    closePanel();
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab')[1].classList.add('active');
}
    function resetHighlightedParkings() {
        Object.keys(highlightedParkings).forEach(id => {
            if (mapMarkers[id]) {
                const orig = highlightedParkings[id];
                if (orig.fillColor) mapMarkers[id].options.set({ fillColor: orig.fillColor, strokeColor: orig
                        .strokeColor });
                else if (orig.preset) mapMarkers[id].options.set('preset', orig.preset);
            }
        });
        highlightedParkings = {};
    }
    // ===================== АУТЕНТИФИКАЦИЯ =====================
function getGuestId() {
    let guestId = localStorage.getItem('parknear_guest_id');
    if (!guestId) {
        guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('parknear_guest_id', guestId);
    }
    return guestId;
}   
async function continueAsGuest() {
    const guestButton = document.querySelector('.guest-btn');
    if (guestButton) {
        guestButton.disabled = true;
        guestButton.textContent = 'Выполняется вход...';
    }
    try {
        const response = await fetch(
            `${window.PARKNEAR_API_URL}/auth/guest`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            }
        );
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(
                result.error || 'Не удалось войти как гость'
            );
        }
        if (!result.sessionToken || !result.user) {
            throw new Error(
                'Сервер вернул неполные данные гостя'
            );
        }
        const user = {
            id: result.user.id,
            username: 'guest',
            firstName: 'Гость',
            photoUrl: '',
            isGuest: true
        };
        // Сохраняем серверную сессию.
        localStorage.setItem(
            'parkNearSessionToken',
            result.sessionToken
        );
        if (result.expiresAt) {
            localStorage.setItem(
                'parkNearSessionExpiresAt',
                result.expiresAt
            );
        }
        // Сохраняем профиль гостя.
        currentUser = user;
        window.currentUser = user;
        localStorage.setItem(
            'tgUser',
            JSON.stringify(user)
        );
        localStorage.setItem(
            'parknear_guest_id',
            user.id
        );
        hideAuthScreen();
        showPanel('home');
        showOnboarding();
        console.log(
            'Гостевой вход через PostgreSQL выполнен:',
            user.id
        );
        if (typeof showToast === 'function') {
            showToast('Вы вошли как гость', 3000);
        }
    } catch (error) {
        console.error(
            'Ошибка гостевого входа:',
            error
        );
        alert(
            'Не удалось войти как гость: ' +
            (error.message || 'Ошибка соединения')
        );
    } finally {
        if (guestButton) {
            guestButton.disabled = false;
            guestButton.textContent = 'Продолжить как гость';
        }
    }
}
    function logout() {
        localStorage.removeItem('tgUser');
        currentUser = null;
        showAuthScreen();
    }
async function deleteAccount() {
    if (!currentUser || currentUser.id.startsWith('guest_')) {
        alert('Гостевой аккаунт нельзя удалить');
        return;
    }
    if (typeof window.getLocalActiveParking === 'function' && window.getLocalActiveParking()) {
        alert('Перед удалением аккаунта необходимо завершить активную парковку.');
        return;
    }
    if (!confirm('Безвозвратно удалить аккаунт, созданные вами парковки и все связанные данные?')) return;
    const token = localStorage.getItem('parkNearSessionToken');
    if (!token) {
        alert('Не найдена сессия пользователя. Войдите в аккаунт заново.');
        return;
    }
    try {
        const response = await fetch(`${window.PARKNEAR_API_URL}/api/users/me/account`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Не удалось удалить аккаунт');
        }
        localStorage.removeItem('parkNearSessionToken');
        localStorage.removeItem('parkNearSessionExpiresAt');
        localStorage.removeItem('tgUser');
        localStorage.removeItem('parknear_guest_id');
        currentUser = null;
        window.currentUser = null;
        window.isOfflineSession = false;
        if (typeof window.clearLocalActiveParking === 'function') {
            window.clearLocalActiveParking();
        }
        showAuthScreen();
        alert(`Аккаунт и созданные вами парковки удалены. Удалено парковок: ${result.deletedParkings || 0}.`);
    } catch (error) {
        console.error('Ошибка удаления аккаунта:', error);
        alert(error.message || 'Не удалось удалить аккаунт. Проверьте подключение.');
    }
}
function showAuthScreen() {
    const overlay = document.getElementById('authOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        // Сбрасываем анимацию, если она была
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
    } else {
        console.error('Элемент #authOverlay не найден в DOM');
        // Создаём оверлей на лету (запасной вариант)
        createAuthScreenFallback();
    }
}
// Скрывает экран входа
function hideAuthScreen() {
    const overlay = document.getElementById('authOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}
function createAuthScreenFallback() {
    // Удаляем старый, если есть
    const old = document.getElementById('authOverlay');
    if (old) old.remove();
    const overlay = document.createElement('div');
    overlay.id = 'authOverlay';
    overlay.style.cssText = `
        display: flex;
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: var(--overlay-bg, rgba(14,41,49,0.8));
        z-index: 6000;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        padding: 20px;
    `;
    overlay.innerHTML = `
        <div style="background: var(--bg-secondary, #fff); border-radius: 24px; padding: 30px 20px; width: 90%; max-width: 380px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.4); position: relative;">
            <button onclick="closeAuthScreen()" style="position:absolute; top:12px; right:16px; background:none; border:none; font-size:24px; color:var(--text-secondary, #888); cursor:pointer; line-height:1; padding:4px; z-index:10;">✕</button>
            <div style="font-size:48px; margin-bottom:12px;">🚗</div>
            <h2 style="margin:0 0 8px; font-size:22px; font-weight:700;">Добро пожаловать в ParkNear</h2>
           <p style="color:var(--text-secondary, #666); margin-bottom:20px; font-size:15px;">
            Войдите через Яндекс или продолжите как гость,
                чтобы сохранять парковки, город и настройки.
            </p>
                       <button
                type="button"
                onclick="startYandexLogin()"
                style="
                    width:100%;
                    padding:15px;
                    margin-bottom:12px;
                    border:0;
                    border-radius:12px;
                    background:#FCE000;
                    color:#111;
                    font-size:16px;
                    font-weight:600;
                    cursor:pointer;
                "
            >
                <span style="font-weight:800; margin-right:8px;">Я</span>
                Войти через Яндекс
            </button>
            <div style="margin:12px 0; color:var(--text-secondary, #666); font-size:14px;">— или —</div>
            <button class="guest-btn" onclick="continueAsGuest()" style="width:100%; padding:16px; border-radius:14px; border:none; font-size:16px; font-weight:600; cursor:pointer; background:var(--bg-secondary, #fff); color:var(--accent, #007AFF); border:1px solid var(--accent, #007AFF);">Продолжить как гость</button>
        </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('authOverlay').style.display = 'flex';
}
    
    // ===================== НАСТРОЙКИ =====================
   function syncThemeToggles() {
    const isDark = document.body.classList.contains('dark-theme');
    const toggle1 = document.getElementById('settingsThemeToggle');
    const toggle2 = document.getElementById('settingsThemeToggleInline');
    if (toggle1) toggle1.checked = isDark;
    if (toggle2) toggle2.checked = isDark;
}
     function toggleTheme() {
    var isDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('darkTheme', isDark ? '1' : '0');
    var mapEl = document.getElementById('map');
    if (mapEl && map) {
        var currentType = map.getType ? map.getType() : 'yandex#map';
        if (isDark && currentType === 'yandex#map') {
            mapEl.style.filter = 'invert(0.82) hue-rotate(180deg) brightness(0.95) contrast(0.9) saturate(0.85)';
        } else {
            mapEl.style.filter = 'none';
        }
    }
    var tabBar = document.querySelector('.tabBar');
    if (tabBar) {
        tabBar.style.background = '';
    }
    syncThemeToggles();
    if (window.Telegram && window.Telegram.WebApp) {
        try {
            var tg = window.Telegram.WebApp;
            if (isDark) {
                tg.setHeaderColor('#1C1C1E');
                tg.setBackgroundColor('#000000');
            } else {
                tg.setHeaderColor('#F2F2F7');
                tg.setBackgroundColor('#FFFFFF');
            }
        } catch (e) {}
    }
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
}
    function updateMapTheme() {
        const mapEl = document.getElementById('map');
        if (!mapEl || !map) return;
        const isDark = document.body.classList.contains('dark-theme');
        const currentType = map.getType ? map.getType() : 'yandex#map';
        if (isDark && currentType === 'yandex#map') {
            mapEl.style.filter = 'invert(0.82) hue-rotate(180deg) brightness(0.95) contrast(0.9) saturate(0.85)';
        } else {
            mapEl.style.filter = 'none';
        }
    }
    function showToast(message, duration = 3000) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-20px)';
        }, duration);
    }
   function renderHomePanel(content) {
    // 1. Проверка контейнера (если content не передан или удален)
    if (!content) {
        content = document.getElementById('panelContent');
        if (!content) {
            console.error('❌ renderHomePanel: контейнер panelContent не найден');
            return;
        }
    }
        console.log(
    'ПРОВЕРКА renderHomePanel:',
    'loadAllParkings =', typeof loadAllParkings,
    'window.loadAllParkings =', typeof window.loadAllParkings
  );
   const parkingLoader =
    typeof window.loadAllParkings === 'function'
        ? window.loadAllParkings
        : typeof loadAllParkings === 'function'
            ? loadAllParkings
            : null;

if (!parkingLoader) {
    console.error('❌ loadAllParkings действительно отсутствует', {
        local: typeof loadAllParkings,
        global: typeof window.loadAllParkings,
        scripts: [...document.scripts].map(script => script.src).filter(Boolean)
    });

    content.innerHTML =
        '<div class="empty-state"><p>Не удалось найти функцию загрузки парковок.</p></div>';
    return;
}
    if (typeof renderHomeContent !== 'function') {
        content.innerHTML = '<div class="empty-state"><p>⚠️ Ошибка: функция отрисовки главной не найдена</p></div>';
        console.error('❌ renderHomeContent не определена.');
        return;
    }
    // 3. Работа с кешем
    const cached = localStorage.getItem('parkingCache');
    let cacheData = null;
    if (cached) {
        try {
            const cache = JSON.parse(cached);
            if (cache && cache.data) {
                cacheData = cache.data;
                parkingDataCache = cacheData;
                renderHomeContent(content, null);
                const list = document.getElementById('homeParkingList');
                if (list) {
                    list.insertAdjacentHTML('beforeend', '<div class="loading-indicator" style="text-align:center; color:var(--text-secondary); font-size:13px; margin-top:8px;">🔄 Обновление данных...</div>');
                }
            } else {
                localStorage.removeItem('parkingCache');
                console.log('🗑️ Удалён устаревший кеш парковок');
            }
        } catch (e) {
            console.warn('Ошибка парсинга кеша:', e);
            localStorage.removeItem('parkingCache');
        }
    }
    if (!cacheData) {
        content.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Загрузка парковок...</p></div>';
    }
    // 4. Обновление данных
const lastRefresh = Number(
    typeof lastDataRefresh !== 'undefined' ? lastDataRefresh : 0
);
const refreshInterval =
    typeof REFRESH_INTERVAL_MS !== 'undefined'
        ? Number(REFRESH_INTERVAL_MS)
        : 5 * 60 * 1000;
const needRefresh =
    (Date.now() - lastRefresh > refreshInterval) || !cacheData;
    if (needRefresh) {
        // Проверяем, есть ли функция геолокации, иначе просто пропускаем её
        const getCoordsPromise = (async () => {
    try {
        if (typeof getUserLocation !== 'function') {
            return null;
        }
        return await getUserLocation();
    } catch (error) {
        console.warn('Геолокация недоступна:', error);
        return null;
    }
})();
        Promise.all([
            parkingLoader(currentCity, true),
            getCoordsPromise
        ]).then(([, coords]) => {
            userLocationForSearch = coords;
            renderHomeContent(content, coords);
            const indicator = document.querySelector('.loading-indicator');
            if (indicator) indicator.remove();
            console.log('🏠 На главной загружено парковок:', Object.keys(parkingDataCache).length);
        }).catch((err) => {
            console.error('❌ Ошибка загрузки парковок:', err);
            const indicator = document.querySelector('.loading-indicator');
            if (indicator) indicator.textContent = '⚠️ Не удалось обновить данные';
        
            // Если загрузка упала, все равно показываем кеш (если он есть) или пустое состояние
            if (cacheData) {
                renderHomeContent(content, null);
            } else {
                content.innerHTML = '<div class="empty-state"><p>Не удалось загрузить данные. Проверьте интернет.</p></div>';
            }
        });
    } else {
        const getCoordsPromise = typeof getUserLocation === 'function' 
            ? getUserLocation().catch(() => null) 
            : Promise.resolve(null);

        getCoordsPromise.then(coords => {
            userLocationForSearch = coords;
            renderHomeContent(content, coords);
        }).catch(() => {
            renderHomeContent(content, null);
        });
    }
}
function renderHomeContent(content, coords) {
    var html = `
        <div class="home-header">
            <div class="home-title">Парковка без забот</div>
            <div class="home-subtitle">найдите свободное место рядом с домом</div>
        </div>
        <div class="home-search">
            <input type="text" id="homeSearchInput" placeholder="куда вы направляетесь?" oninput="filterHomeParkings()">
        </div>
        <div class="home-actions">
            <button class="btn-home btn-home-primary" onclick="goHome()">🏠 Еду домой</button>
            <button class="btn-home btn-home-secondary" onclick="searchNearMe()">📍 Рядом со мной</button>
        </div>
        <div class="section-header">
            <span>Рядом с вами</span>
            <button class="see-all" onclick="showAllNearby()">См. все</button>
        </div>
        <div id="homeParkingList" class="parking-list">
            <div class="loading-state"><div class="spinner"></div><p>Загрузка...</p></div>
        </div>
    `;
    content.innerHTML = html;
    // Получаем список парковок из кеша
    var allParkings = Object.values(parkingDataCache).filter(function(p) { return p.lat && p.lng; });
    console.log('📊 Всего парковок в кеше:', allParkings.length);
    // Если данных нет – показываем сообщение
    if (allParkings.length === 0) {
        var container = document.getElementById('homeParkingList');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>😕 Нет парковок в городе <strong>${currentCity || 'не выбран'}</strong></p>
                    <p style="font-size:13px; margin-top:8px; color:var(--text-secondary);">
                        Попробуйте изменить город в настройках профиля
                    </p>
                </div>
            `;
        }
        return;
    }
    // Если координаты есть – показываем ближайшие
    if (coords) {
        showNearbyParkings(coords, 5);
    } else {
        // Иначе показываем все (без сортировки по расстоянию)
        var container = document.getElementById('homeParkingList');
        if (container) {
            renderParkingList(container, allParkings);
        }
    }
}
function showNearbyParkings(coords, limit) {
    const container = document.getElementById('homeParkingList');
    if (!container) return;
    const radius = 1000;
    const parkings = Object.entries(parkingDataCache)
        .map(([id, data]) => ({ id, ...data, distance: getDistanceInMeters(coords.lat, coords.lng, data.lat, data.lng) }))
        .filter(p => p.lat && p.lng && p.distance <= radius)
        .sort((a,b) => a.distance - b.distance);
    if (parkings.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Нет парковок поблизости</p></div>';
        return;
    }
    const show = parkings.slice(0, limit);
renderGroupedParkingList(
    container,
    show,
    coords
);
}
function showAllNearby() {
    var coords = userLocationForSearch;
    if (!coords) {
        alert('Геолокация не определена');
        return;
    }
    var container = document.getElementById('homeParkingList');
    if (container) {
        showNearbyParkings(coords, 9999);
        var seeAll = document.querySelector('.section-header .see-all');
        if (seeAll) {
            seeAll.textContent = 'Скрыть';
            seeAll.onclick = function() {
                showNearbyParkings(coords, 5);
                this.textContent = 'См. все →';
                this.onclick = showAllNearby;
            };
        }
    }
}
function filterHomeParkings() {
    const query = document.getElementById('homeSearchInput').value.trim().toLowerCase();
    const container = document.getElementById('homeParkingList');
    if (!container) return;
    if (!query) {
        if (userLocationForSearch) {
            showNearbyParkings(userLocationForSearch, 5);
        } else {
            const all = Object.values(parkingDataCache).filter(p => p.lat && p.lng);
            renderParkingList(container, all);
        }
        return;
    }
    const filtered = Object.entries(parkingDataCache)
        .map(([id, data]) => ({ id, ...data }))
        .filter(p => {
            const name = (p.name || '').toLowerCase();
            const addr = (p.address || '').toLowerCase();
            return name.includes(query) || addr.includes(query);
        });
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Ничего не найдено</p></div>';
        return;
    }
   renderGroupedParkingList(
    container,
    filtered,
    userLocationForSearch
);
}
async function goHome() {
    if (!currentUser) {
        alert('Войдите, чтобы использовать домашний адрес');
        return;
    }
    try {
        const profile = await requestUserProfile('GET');
        const addresses = profile.homeAddresses || {};
        const addressList = Array.isArray(addresses)
            ? addresses
            : Object.values(addresses);
        const home = addressList.find(address => address.label === 'Дом');
        if (!home) {
            alert('Домашний адрес не найден. Добавьте его в избранном.');
            return;
        }
        if (home.lat == null || home.lng == null) {
            alert('У домашнего адреса нет координат. Добавьте адрес через карту.');
            return;
        }
        const coords = {
            lat: Number(home.lat),
            lng: Number(home.lng)
        };
        if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
            alert('Координаты домашнего адреса некорректны.');
            return;
        }
        if (map) {
            map.setCenter([coords.lat, coords.lng], 16, { duration: 500 });
        }
        userLocationForSearch = coords;
        const container = document.getElementById('homeParkingList');
        if (container) {
            showNearbyParkings(coords, 5);
        }
    } catch (error) {
        console.error('Ошибка получения домашнего адреса:', error);
        alert('Не удалось загрузить домашний адрес: ' + error.message);
    }
}
// Вспомогательная функция для отображения списка парковок
function renderParkingList(container, parkings) {
    renderGroupedParkingList(
        container,
        parkings,
        userLocationForSearch
    );
}
// ============================================
// ЯНДЕКС ID — НАЧАЛО ВХОДА
// ============================================
function startYandexLogin() {
    const apiUrl = String(window.PARKNEAR_API_URL || '').replace(/\/+$/, '');

    if (!apiUrl) {
        alert('Не указан адрес сервера Park Near');
        return;
    }

    window.location.href = `${apiUrl}/auth/yandex`;
}
// ============================================
// ЯНДЕКС ID — ЗАВЕРШЕНИЕ ВХОДА
// ============================================
async function completeYandexLogin() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('yandex_code');
    const error = params.get('yandex_error');
    if (!code && !error) {
        return false;
    }
    // Убираем одноразовый код из адресной строки.
    window.history.replaceState(
        {},
        document.title,
        window.location.pathname + window.location.hash
    );
    if (error) {
        console.error('Ошибка входа через Яндекс:', error);
        alert('Не удалось войти через Яндекс. Попробуйте ещё раз.');
        return false;
    }
    try {
        const apiUrl = String(window.PARKNEAR_API_URL || '').replace(/\/+$/, '');
        const response = await fetch(`${apiUrl}/auth/yandex/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code }),
            cache: 'no-store'
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Ошибка завершения авторизации');
        }
        if (
            !result.sessionToken ||
            !result.user ||
            !result.user.id
        ) {
            throw new Error('Сервер вернул неполные данные пользователя');
        }
        const profile = {
            id: String(result.user.id),
            yandexId: String(result.user.yandexId || ''),
            username: result.user.username || 'yandex_user',
            firstName: result.user.firstName || 'Пользователь',
            lastName: result.user.lastName || '',
            photoUrl: result.user.photoUrl || '',
            email: result.user.email || '',
            isGuest: false
        };
        localStorage.setItem(
            'parkNearSessionToken',
            result.sessionToken
        );
        if (result.expiresAt) {
            localStorage.setItem(
                'parkNearSessionExpiresAt',
                result.expiresAt
            );
        } else {
            localStorage.removeItem('parkNearSessionExpiresAt');
        }
        currentUser = profile;
        window.currentUser = profile;
        localStorage.setItem('tgUser', JSON.stringify(profile));
        if (typeof hideAuthScreen === 'function') {
            hideAuthScreen();
        }
        console.log('Вход через Яндекс выполнен:', profile.id);
        if (typeof showToast === 'function') {
            showToast('Вы успешно вошли через Яндекс!', 3000);
        }
        return true;
    } catch (error) {
        console.error('Ошибка завершения входа через Яндекс:', error);
        localStorage.removeItem('parkNearSessionToken');
        localStorage.removeItem('parkNearSessionExpiresAt');
        localStorage.removeItem('tgUser');
        alert(
            'Не удалось завершить вход через Яндекс: ' +
            (error.message || 'Ошибка соединения')
        );
        return false;
    }
}
async function initApp() {
    // Проверяем возврат после входа через Яндекс.
    const yandexLoginCompleted = await completeYandexLogin();

    if (yandexLoginCompleted) {
        showPanel('home');
    } else {
        await initAuth();
    }
    // Восстановление выбранного города
    const savedCity = localStorage.getItem('parknear_city');
    if (savedCity) {
        try {
            const prefs = JSON.parse(savedCity);
            userCityPrefs = prefs;
            const savedCoords = localStorage.getItem('parknear_city_coords');
            if (savedCoords) {
                cityCoords = JSON.parse(savedCoords);
            }
            updateCityDisplay();
        } catch (e) {
            console.warn('Ошибка восстановления города:', e);
        }
    }
    // Настройка кнопки добавления парковки
    const addBtn = document.getElementById('addBtn');
    if (addBtn) {
        addBtn.onclick = function() {
            if (!currentUser) showPanel('home');
            else if (isDrawingMode) cancelDrawing();
            else startDrawingMode();
        };
    }
    // Инициализация карты
    if (!map) {
        initMap();
    }
    // Регистрация Service Worker для PWA
    if ('serviceWorker' in navigator) {
        const swScope = new URL('.', window.location.href).pathname;
        navigator.serviceWorker.register(swScope + 'sw.js', { scope: swScope })
            .then(registration => console.log('✅ SW зарегистрирован'))
            .catch(error => console.error('❌ Ошибка SW:', error));
    }
   // Инициализация обновления данных
initPullToRefresh();
if (currentUser) {
    showPanel('home');
} else {
    loadAllParkings().catch(error => {
        console.error(
            'Ошибка первоначальной загрузки парковок:',
            error
        );
    });
}
    if (map && cityCoords) {
        map.setCenter([cityCoords.lat, cityCoords.lng], 12, { duration: 300 });
    }
}
function closeAuthScreen() {
    const overlay = document.getElementById('authOverlay');
    if (overlay) overlay.style.display = 'none';
}
    function rebuildRoute() {
        if (!routeStartCoords || !routeEndCoords) {
            alert('Сначала постройте маршрут');
            return;
        }
        if (currentRoute) {
            map.geoObjects.remove(currentRoute);
            currentRoute = null;
        }
        var mode = document.getElementById('routeTypeSelect')?.value || 'driving';
        try {
            currentRoute = new ymaps.multiRouter.MultiRoute({
                referencePoints: [routeStartCoords, routeEndCoords],
                params: { mode: mode, avoidTrafficJams: false, results: 1 }
            }, {
                routeStrokeColor: '#2B7574',
                routeStrokeWidth: 5,
                routeStrokeOpacity: 0.8,
                animation: false
            });
            map.geoObjects.add(currentRoute);
            updateRouteInfoFromMultiRoute(currentRoute);
            map.setBounds(currentRoute.getBounds(), { duration: 300 });
        } catch (e) {
            console.error('Ошибка перестроения:', e);
            alert('Не удалось перестроить маршрут');
        }
    }
    function editCarDataFromSettings() {
        // Заполняем поля и открываем редактор
        if (!currentUser) return;
        const car = currentUser.car || {};
        const overlay = document.getElementById('carEditorOverlay');

        // Заполняем марки
        const brandSelect = document.getElementById('carBrandSelect');
        brandSelect.innerHTML = '<option value="">Выберите марку</option>';
        Object.keys(carBrands).sort().forEach(b => {
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = b;
            if (b === car.brand) opt.selected = true;
            brandSelect.appendChild(opt);
        });
        updateCarModelSelect();
        // Устанавливаем значения
        if (car.model) {
            const modelSelect = document.getElementById('carModelSelect');
            for (let opt of modelSelect.options) {
                if (opt.value === car.model) { opt.selected = true; break; }
            }
        }
        document.getElementById('carColorSelect').value = car.color || '';
        document.getElementById('carPlateInput').value = car.plate || '';

        overlay.classList.add('active');
    }
    function updateCarModelSelect() {
        const brand = document.getElementById('carBrandSelect').value;
        const modelSelect = document.getElementById('carModelSelect');
        modelSelect.innerHTML = '<option value="">Выберите модель</option>';
        if (brand && carBrands[brand]) {
            carBrands[brand].forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                modelSelect.appendChild(opt);
            });
        }
    }
    function closeCarEditor() {
        document.getElementById('carEditorOverlay').classList.remove('active');
    }
    function editNickname() {
        const currentNick = currentUser.nickname || '';
        const newNick = prompt('Введите новый никнейм:', currentNick);
        if (newNick !== null && newNick.trim() !== '') {
            saveNickname(newNick.trim());
        }
    }
    function resetOnboarding() {
        localStorage.removeItem('onboardingSeen');
        showOnboarding();
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
    }
    // Заполняем цвета для редактора автомобиля
    (function initCarColors() {
        const colorSelect = document.getElementById('carColorSelect');
        if (!colorSelect) return;
        // Цвета автомобилей
        const carColors = {
            'Белый': '#FFFFFF',
            'Чёрный': '#000000',
            'Серый': '#808080',
            'Серебристый': '#C0C0C0',
            'Красный': '#FF0000',
            'Бордовый': '#800020',
            'Синий': '#0000FF',
            'Голубой': '#87CEEB',
            'Зелёный': '#008000',
            'Коричневый': '#8B4513',
            'Бежевый': '#F5F5DC',
            'Жёлтый': '#FFFF00',
            'Оранжевый': '#FFA500',
            'Фиолетовый': '#800080',
            'Другой': '#D3D3D3'
        };
        colorSelect.innerHTML =
            '<option value="">Выберите цвет</option>';
        Object.entries(carColors).forEach(([name, color]) => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            opt.style.backgroundColor = color;

            colorSelect.appendChild(opt);
        });
    })();
    console.log('✅ ParkNear загружен. Код исправлен.');
// ===== ВСПЛЫВАЮЩЕЕ ОКНО ДОНАТА =====
(function initDonatePopup() {
    function setupDonatePopup() {
        const donateBtn = document.getElementById('donateBtn');
        const popup = document.getElementById('donatePopup');
        const closeBtn = document.getElementById('donatePopupClose');

        if (!donateBtn || !popup || !closeBtn) {
            console.warn('Окно доната: не найдены необходимые элементы');
            return;
        }

        function openDonatePopup() {
            popup.hidden = false;
            donateBtn.setAttribute('aria-expanded', 'true');
        }

        function closeDonatePopup() {
            popup.hidden = true;
            donateBtn.setAttribute('aria-expanded', 'false');
        }

        donateBtn.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();

            if (popup.hidden) {
                openDonatePopup();
            } else {
                closeDonatePopup();
            }
        });
        closeBtn.addEventListener('click', function(event) {
            event.stopPropagation();
            closeDonatePopup();
        });
        // Закрытие при нажатии за пределами окна
        document.addEventListener('click', function(event) {
            if (
                !popup.hidden &&
                !popup.contains(event.target) &&
                !donateBtn.contains(event.target)
            ) {
                closeDonatePopup();
            }
        });
        // Закрытие клавишей Escape
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape' && !popup.hidden) {
                closeDonatePopup();
                donateBtn.focus();
            }
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            setupDonatePopup
        );
    } else {
        setupDonatePopup();
    }
})();
