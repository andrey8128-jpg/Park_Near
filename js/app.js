// ===================== FIREBASE =====================
    const firebaseConfig = {
        apiKey: "AIzaSyATLX5t2lmibbuiSXL_sWu_JnFFTb-nMqU",
        authDomain: "parknear-bef41.firebaseapp.com",
        databaseURL: "https://parknear-bef41-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "parknear-bef41",
        storageBucket: "parknear-bef41.firebasestorage.app",
        messagingSenderId: "1066552333578",
        appId: "1:1066552333578:web:e60e333cf877852eba16f3"handleYandexOAuthReturn
    };
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    // ===== Восстановление темы (с сохранением правильных цветов маркеров) =====// ===== Восстановление темы (с сохранением правильных цветов маркеров) =====
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
    let originalPolyCoords = null;
    let editingParkingId = null;
    let editingPolygon = null;
    let mapCity = null;
    let currentUserId = null;
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
// ===================== ВХОД ЧЕРЕЗ ЯНДЕКС =====================
function startYandexLogin() {
    const clientId = 'a4c1372c585e4962bf9dfef4b5e14bf5';
    const redirectUri =
        'https://andrey8128-jpg.github.io/Park_Near/';
    if (!clientId) {
        alert('Не указан Client ID приложения Яндекс');
        return;
    }
    if (!window.crypto?.randomUUID) {
        alert('Браузер не поддерживает создание OAuth state');
        return;
    }
    const state = crypto.randomUUID();
    sessionStorage.setItem('yandex_oauth_state', state);
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        state: state
    });
    const authUrl =
        'https://oauth.yandex.ru/authorize?' +
        params.toString();
    window.location.assign(authUrl);
}
async function handleYandexOAuthReturn() {
    const params = new URLSearchParams(
        window.location.search
    );
    const code = params.get('code');
    const returnedState = params.get('state');
    const oauthError = params.get('error');
    // Если Яндекс вернул ошибку
    if (oauthError) {
        console.error(
            'Ошибка Яндекс OAuth:',
            oauthError,
            params.get('error_description')
        );
        alert('Яндекс не завершил авторизацию.');
        return;
    }
    // Если это обычная загрузка страницы
    if (!code) return;
    const savedState =
        sessionStorage.getItem('yandex_oauth_state');
    if (!savedState || returnedState !== savedState) {
        console.error('Ошибка проверки OAuth state');
        alert('Не удалось проверить авторизацию.');
        return;
    }
    try {
        // ВАЖНО:
        // /api/yandex-login — это пример адреса.
        // Его нужно реализовать на твоём backend.
        const response = await fetch('/api/yandex-login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: code,
                redirectUri:
                    'https://andrey8128-jpg.github.io/Park_Near/'
            })
        });
        if (!response.ok) {
            throw new Error(
                'Сервер не подтвердил авторизацию: ' +
                response.status
            );
        }
        const user = await response.json();
        if (!user || !user.id) {
            throw new Error(
                'Сервер не вернул подтверждённого пользователя'
            );
        }
        // Здесь должна быть интеграция с твоей
        // существующей системой пользовательских сессий.
        // Не присваивай currentUser напрямую на основании
        // неподтверждённых данных из браузера.
        console.log('Сервер подтвердил пользователя');
    } catch (error) {
        console.error(
            'Ошибка завершения входа через Яндекс:',
            error
        );
        alert(
            'Не удалось войти. Попробуй ещё раз.'
        );
    } finally {
        sessionStorage.removeItem('yandex_oauth_state');
        window.history.replaceState(
            {},
            document.title,
            window.location.pathname
        );
    }
}
// ===================== ВОССТАНОВЛЕНИЕ ГОРОДА =====================
const savedCity = localStorage.getItem('selectedCity');
const savedMapPrefs = localStorage.getItem('parknear_map_city');
if (savedCity) {
    currentCity = savedCity;
    try {
        const prefs = JSON.parse(savedMapPrefs || '{}');
        mapCity = {
            city: prefs.city || savedCity,
            region: prefs.region || ''
        };
    } catch (e) {
        console.warn('⚠️ Не удалось восстановить город карты:', e);
        mapCity = {
            city: savedCity,
            region: ''
        };
    }
} else {
    currentCity = '';
    mapCity = null;
}
console.log('🏙️ Город карты:', currentCity);
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
    const free = Math.max(0, total - occupied);
    const ratio = total > 0 ? free / total : 1;
    let badgeClass = '';
    if (ratio <= 0.2 && total > 0) badgeClass = 'critical';
    else if (ratio <= 0.5 && total > 0) badgeClass = 'low';
    const badgeText = total > 0 ? free : '?';
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
                    <span class="free-badge ${badgeClass}">${safeBadge}</span>
                </div>
                ${distanceHtml}
            </div>
        </div>
    `;
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
                loadUserData('favorites', content);
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
function logoutUser() {
    if (!currentUser) {
        alert('Вы уже вышли из аккаунта.');
        return;
    }
    if (!confirm('Вы действительно хотите выйти из аккаунта?')) {
        return;
    }
    // Выход из Firebase Authentication, если он используется
    if (
        typeof firebase !== 'undefined' &&
        firebase.auth &&
        firebase.auth().currentUser
    ) {
        firebase.auth().signOut()
            .then(() => {
                finishLogout();
            })
            .catch(error => {
                console.error('Ошибка выхода:', error);
                alert('Не удалось выйти из аккаунта. Попробуйте ещё раз.');
            });
    } else {
        // Для авторизации, реализованной без Firebase Authentication
        finishLogout();
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
function initAuth() {
    // Пытаемся восстановить предыдущую сессию
    const restored = restoreSavedUser();
    if (restored) {
        // Пользователь уже авторизован
        hideAuthScreen();
        // Если панель ещё не открыта — открываем главную
        const panel = document.getElementById('panel');
        if (panel && !panel.classList.contains('active')) {
            showPanel('home');
        }
        console.log('✅ Авторизация восстановлена');
        return;
    }
    // Пользователь не найден
    console.log('ℹ️ Пользователь не авторизован');
    showAuthScreen();
}
async function checkTelegramTokenFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (!token) return false;
    // Очищаем URL, чтобы токен не остался в адресной строке
    window.history.replaceState({}, document.title, window.location.pathname);
    try {
        // Ищем токен в Firebase
        const snapshot = await database.ref(`loginTokens/${token}`).once('value');
        const tokenData = snapshot.val();
        if (!tokenData) {
            alert('Ссылка недействительна.');
            return false;
        }
        if (Date.now() > tokenData.expires) {
            alert('Ссылка истекла. Попробуйте войти снова.');
            database.ref(`loginTokens/${token}`).remove();
            return false;
        }
        if (!tokenData.userData || !tokenData.userData.userId) {
            alert('Бот еще не подтвердил вход. Подождите пару секунд и обновите страницу.');
            return false;
        }
        // Успех! Формируем профиль
        const tgUser = tokenData.userData;
        const profile = {
            id: 'tg_' + tgUser.userId,
            username: tgUser.username || 'tg_user',
            firstName: tgUser.firstName || 'Пользователь',
            photoUrl: tgUser.photoUrl || '',
            isGuest: false
        };
        // Сохраняем в Firebase Database
        const userRef = database.ref('users/' + profile.id);
        await userRef.update({
            id: profile.id,
            telegramId: tgUser.userId,
            username: profile.username,
            firstName: profile.firstName,
            photoUrl: profile.photoUrl,
            isGuest: false,
            lastActive: Date.now()
        });
        await userRef.child('stats').transaction(stats => {
            if (stats !== null) return stats;
            return {
                registeredAt: Date.now(), lastActive: Date.now(),
                parkingsCreated: 0, parkingsUpdated: 0, confirmations: 0,
                views: 0, favorites: 0, activeDates: [new Date().toISOString().split('T')[0]]
            };
        });
        // Сохраняем локально и обновляем UI
        currentUser = profile;
        window.currentUser = profile;
        localStorage.setItem('tgUser', JSON.stringify(profile));
        // Удаляем использованный токен
        database.ref(`loginTokens/${token}`).remove();
        hideAuthScreen();
        showPanel('home');
        showToast('✅ Вы успешно вошли через Telegram!', 3000);
        return true;
    } catch (error) {
        console.error('Ошибка проверки токена:', error);
        alert('Не удалось завершить вход. Проверьте интернет.');
        return false;
    }
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
                visible: false,
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
    if (!parkingId || !city) {
        console.error('Не указан ID парковки или город');
        return;
    }
    const parking = parkingDataCache[parkingId];
    if (parking && currentUser && parking.authorId && parking.authorId !== currentUser.id) {
        console.warn('⛔ Попытка изменить город чужой парковки заблокирована на клиенте');
        showToast?.('Можно редактировать только свои парковки', 2000);
        return;
    }
    try {
        await database.ref(`parkings/${parkingId}`).update({
            city: city.trim(),
            region: region ? region.trim() : ''
        });
        console.log('✅ Город парковки обновлён:', { parkingId, city, region });
        if (parkingDataCache[parkingId]) {
            parkingDataCache[parkingId].city = city.trim();
            parkingDataCache[parkingId].region = region ? region.trim() : '';
        }
    } catch (error) {
        console.error('❌ Ошибка изменения города:', error);
    }
}
// ФИКС: проверка авторства перед изменением границ
async function saveEditedPolygon(newCoords) {
    if (!currentParkingId) return;
    if (currentParkingData?.authorId && currentUser && currentParkingData.authorId !== currentUser.id) {
        console.warn('⛔ Попытка изменить границы чужой парковки заблокирована на клиенте');
        alert('Можно редактировать только свои парковки');
        cancelDrawing();
        return;
    }
    const sizeCheck = checkPolygonSize(newCoords);
    if (!sizeCheck.valid) {
        alert(sizeCheck.error);
        cancelDrawing();
        return;
    }
    try {
        const centerLat = newCoords.reduce((sum, c) => sum + Number(c[0]), 0) / newCoords.length;
        const centerLng = newCoords.reduce((sum, c) => sum + Number(c[1]), 0) / newCoords.length;
        await database.ref(`parkings/${currentParkingId}`).update({
            coordinates: newCoords,
            lat: centerLat,
            lng: centerLng,
            lastUpdatedAt: Date.now(),
            lastUpdatedBy: currentUser?.nickname || currentUser?.firstName || ''
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
        currentParkingData.coordinates = newCoords;
        currentParkingData.lat = centerLat;
        currentParkingData.lng = centerLng;
        parkingDataCache[currentParkingId] = currentParkingData;
        refreshParkingMarker();
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
            <div class="parking-secondary-actions">
                <button
                    class="parking-secondary-btn parking-favorite-btn"
                    onclick="toggleFavoriteCenter()"
                >
                    <span>♡</span>
                    <span>Сохранить</span>
                </button>
            </div>
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
    const snapshot = await database
        .ref('parkingSessions')
        .orderByChild('parkingId')
        .equalTo(String(parkingId))
        .once('value');
    const sessions = snapshot.val() || {};
    return Object.values(sessions).filter(session => {
        return session && session.active === true;
    }).length;
}
async function getUserActiveParkingSession(){
    if(!currentUser?.id)return null;
    try{
        const snapshot=await database.ref('parkingSessions')
            .orderByChild('userId')
            .equalTo(String(currentUser.id))
            .once('value');
        const sessions=snapshot.val()||{};
        for(const [sessionId,session] of Object.entries(sessions)){
            if(session&&session.active===true){
                return{
                    id:sessionId,
                    ...session
                };
            }
        }
        return null;
    }catch(error){
        console.error('Ошибка получения активной парковочной сессии:',error);
        return null;
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
    try {
        // 1. Проверяем, нет ли у пользователя активной парковки
        const existingSnapshot = await database
            .ref('parkingSessions')
            .orderByChild('userId')
            .equalTo(String(currentUser.id))
            .once('value');
        const existingSessions = existingSnapshot.val() || {};
        const alreadyParked = Object.values(existingSessions).some(
            session => session && session.active === true
        );
        if (alreadyParked) {
            alert('У вас уже есть активная парковка.');
            return;
        }
        // 2. Загружаем парковку
        const parkingSnapshot = await database
            .ref(`parkings/${parkingId}`)
            .once('value');
        const parking = parkingSnapshot.val();
        if (!parking) {
            alert('Парковка не найдена.');
            return;
        }
        // 3. Проверяем координаты парковки
        const parkingLat = Number(parking.lat ?? parking.latitude);
        const parkingLng = Number(parking.lng ?? parking.longitude);
        if (
            !Number.isFinite(parkingLat) ||
            !Number.isFinite(parkingLng) ||
            Math.abs(parkingLat) > 90 ||
            Math.abs(parkingLng) > 180
        ) {
            alert('Не удалось определить координаты парковки.');
            return;
        }
        // 4. Проверяем местоположение пользователя
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
               `Вы находитесь примерно в ${Math.round(distance)} м ` +
               'от парковки. Подойдите ближе, максимум на 100 метров.'
        );
        return;
      }
        // 5. Проверяем, остались ли свободные места
        const totalSpots = Number(parking.totalSpots) || 0;
        const occupiedSpots = await getParkingOccupancy(parkingId);

        if (totalSpots > 0 && occupiedSpots >= totalSpots) {
            alert('По данным приложения, свободных мест сейчас нет.');
            return;
        }
        // 6. Создаём парковочную сессию        
       const sessionRef = database.ref('parkingSessions').push();
       const startedAt = Date.now();
       await sessionRef.set({
         parkingId: String(parkingId),
         userId: String(currentUser.id),
         startedAt: startedAt,
         endedAt: null,
         active: true
     });
// Сохраняем состояние плашки только после успешной записи в Firebase.
       if (typeof window.setLocalActiveParking === 'function') {
           window.setLocalActiveParking(
            parkingId,
            parking.name || 'Парковка',
            startedAt
       );
   }
        // 7. Обновляем карточку парковки
        currentParkingData = parking;
        parkingDataCache[parkingId] = parking;
        await openCenterSheet(parkingId, parking);
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback
                .notificationOccurred('success');
        }
    } catch (error) {
        console.error('Ошибка начала парковки:', error);
        alert(
            error.message === 'Разрешите доступ к геолокации.'
                ? error.message
                : 'Не удалось начать парковочную сессию. ' +
                  'Проверьте геолокацию и подключение к интернету.'
        );
    }
}
async function endParkingSession(parkingId){
    if(!currentUser?.id)return;
    try{
        const snapshot=await database.ref('parkingSessions')
            .orderByChild('userId')
            .equalTo(String(currentUser.id))
            .once('value');
        const sessions=snapshot.val()||{};
        let sessionKey=null;
        Object.entries(sessions).some(([key,session])=>{
            if(
                session&&
                session.active===true&&
                session.parkingId===parkingId
            ){
                sessionKey=key;
                return true;
            }
            return false;
        });
        if(!sessionKey){
            alert('Активная парковка не найдена.');
            return;
        }

        await database.ref(`parkingSessions/${sessionKey}`).update({
            active:false,
            endedAt:Date.now()
        });
       // Убираем плашку только после успешного завершения сессии.
        if (typeof window.clearLocalActiveParking === 'function') {
             window.clearLocalActiveParking();
        }
        const parking=currentParkingData||parkingDataCache[parkingId];

        if(parking){
            await openCenterSheet(parkingId,parking);
        }

        if(window.Telegram?.WebApp?.HapticFeedback){
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
    }catch(error){
        console.error('Ошибка завершения парковочной сессии:',error);
        alert('Не удалось завершить парковку.');
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
    const totalSpots = Number(data.totalSpots) || 0;
    const isAuthor = currentUser && currentUser.id === data.authorId;
    const currentStreet = data.street || '';
    const streetName = extractStreetName(currentStreet);
    const editPanel = document.getElementById('editPanel');
    if (!editPanel) return;
    editPanel.innerHTML = `
        <div class="edit-parking">
            <div class="edit-parking-header">
                <div class="edit-parking-title">
                    <h3>${data.name || 'Парковка'}</h3>
                    ${streetName ? `<p class="edit-parking-street">${streetName}</p>` : ''}
                </div>
            </div>
            <div class="edit-parking-actions">
                ${isAuthor ? `
                    <button
                        type="button"
                        class="btn-secondary"
                        onclick="window.toggleParkingEditor()"
                    >
                        ✏️ Редактировать данные
                    </button>
                ` : ''}
                <button
                    type="button"
                    class="btn-secondary"
                    onclick="toggleFavorite('${currentParkingId}')"
                >
                    ${isFavorite ? '★ Убрать из избранного' : '☆ В избранное'}
                </button>
            </div>
            <div id="parkingEditorForm" class="edit-parking-form" style="display: none;">
                <h4>Редактирование парковки</h4>
                <label for="editParkingName">Название парковки</label>
                <input
                    type="text"
                    id="editParkingName"
                    value="${(data.name || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"
                    placeholder="Название парковки"
                >
                <label for="editParkingStreet">Адрес</label>
                <input
                    type="text"
                    id="editParkingStreet"
                    value="${(data.street || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"
                    placeholder="Адрес парковки"
                >
                <label for="editParkingTotalSpots">Всего парковочных мест</label>
                <input
                    type="number"
                    id="editParkingTotalSpots"
                    min="0"
                    value="${totalSpots}"
                    placeholder="Количество мест"
                >
                <label for="editParkingDescription">Описание</label>
                <textarea
                    id="editParkingDescription"
                    placeholder="Описание парковки"
                >${(data.description || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                <div class="edit-parking-form-actions">
                    <button
                        type="button"
                        class="btn-primary"
                        onclick="saveParkingDetails()"
                    >
                        Сохранить
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
            <div id="parkingHistoryPreview"></div>
            <div id="parkingHistoryAll" style="display: none;"></div>
            <button
                type="button"
                class="parking-secondary-btn"
                onclick="showAllHistory()"
            >
                Показать историю
            </button>
        </div>
    `;
    window.toggleParkingEditor = function () {
    const form = document.getElementById('parkingEditorForm');
    if (!form) {
        console.error('Форма parkingEditorForm не найдена');
        return;
    }
    form.style.display =
        getComputedStyle(form).display === 'none'
            ? 'block'
            : 'none';
};
    // Загрузка истории парковки
    if (currentUser && currentParkingId) {
        if (typeof loadHistoryPreview === 'function') {
            loadHistoryPreview(currentParkingId);
        }
    }
    // Показать всю историю
    window.showAllHistory = function () {
        const historyAll = document.getElementById('parkingHistoryAll');
        if (!historyAll) return;
        historyAll.style.display = 'block';
        if (typeof loadFullParkingHistory === 'function' && currentParkingId) {
            loadFullParkingHistory(currentParkingId);
        }
    };
    // Скрыть всю историю
    window.hideAllHistory = function () {
        const historyAll = document.getElementById('parkingHistoryAll');
        if (historyAll) {
            historyAll.style.display = 'none';
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
   function saveParkingDetails(){
    if(!currentUser){
        alert('Необходимо авторизоваться');
        return;
    }
    if(!currentParkingId||!currentParkingData)return;
    const streetType=document.getElementById('editStreetType')?.value||'';
    const streetName=document.getElementById('editStreetName')?.value.trim()||'';
    const houseNumber=document.getElementById('editHouseNumber')?.value.trim()||'';
    const parkingName=document.getElementById('editParkingName')?.value.trim()||'';
    const totalSpots=parseInt(document.getElementById('editTotalSpots')?.value)||0;
    const street=streetType&&streetName
        ?`${streetType} ${streetName}`
        :(streetName||currentParkingData.street||'');
    if(!street&&!houseNumber){
        alert('Введите улицу или номер дома');
        return;
    }
    if(!parkingName){
        alert('Введите название парковки');
        return;
    }
    if(totalSpots<1){
        alert('Количество мест должно быть больше 0');
        return;
    }
    if(totalSpots>500){
        alert('Количество мест не может быть больше 500');
        return;
    }
    const updates={
        name:parkingName,
        street,
        houseNumber,
        totalSpots
    };
    database.ref(`parkings/${currentParkingId}`).update(updates).then(()=>{
        if(currentUser.id===currentParkingData.authorId){
            database.ref(`users/${currentUser.id}/stats/parkingsUpdated`)
                .transaction(c=>(c||0)+1);
        }
        currentParkingData={
            ...currentParkingData,
            ...updates
        };
        parkingDataCache[currentParkingId]=currentParkingData;
        refreshParkingMarker();
        if(clusterer)clusterer.reload();
        closePanel();
        showMap();
        if(window.Telegram?.WebApp?.HapticFeedback){
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
    }).catch(err=>{
        console.error('Ошибка сохранения:',err);
        alert('Ошибка: '+err.message);
    });
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
    // ===================== АДРЕСА =====================
    function addHomeAddress() {
        if (!currentUser) { alert('Необходимо войти'); return; }
        database.ref(`users/${currentUser.id}/homeAddresses`).once('value').then(snap => {
            if (Object.keys(snap.val() || {}).length >= 3) { alert('Максимум 3 адреса'); return; }
            openAddressPicker();
        }).catch(err => { console.error(err);
            alert('Ошибка'); });
    }

    function centerMapOnAddress(lat, lng) {
        if (!lat || !lng) return;

        closePanel();

        map.setCenter([lat, lng], 17, { duration: 500 });

        if (window._addressPreviewMarker) {
            map.geoObjects.remove(window._addressPreviewMarker);
        }

        window._addressPreviewMarker = new ymaps.Placemark([lat, lng], {
            hintContent: 'Ваш адрес',
            balloonContent: 'Вы здесь сохранили адрес'
        }, {
            preset: 'islands#redHomeIcon',
            draggable: false
        });

        map.geoObjects.add(window._addressPreviewMarker);

        setTimeout(() => {
            if (window._addressPreviewMarker) {
                map.geoObjects.remove(window._addressPreviewMarker);
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

    function selectLabel(label) {
        if (!pendingAddressData) return;
        const data = pendingAddressData;
        database.ref(`users/${currentUser.id}/homeAddresses`).once('value')
            .then(snap => {
                const count = Object.keys(snap.val() || {}).length;
                if (count >= 3) {
                    alert('Максимум 3 адреса');
                    cancelLabelPicker();
                    return;
                }
                return database.ref(`users/${currentUser.id}/homeAddresses`).push({
                    address: data.address,
                    lat: data.lat || null,
                    lng: data.lng || null,
                    label: label,
                    city: data.city || '',
                    street: data.street || '',
                    houseNumber: data.houseNumber || '',
                    timestamp: Date.now()
                });
            })
            .then(() => {
                cancelLabelPicker();
                alert('Адрес сохранён!');
                showPanel('favorites');
            })
            .catch(err => {
                console.error('Ошибка сохранения адреса:', err);
                alert('Ошибка сохранения: ' + err.message);
                cancelLabelPicker();
            });
    }

    function cancelLabelPicker() {
        document.getElementById('labelPickerOverlay').classList.remove('active');
        pendingAddressData = null;
    }

    function removeHomeAddress(addressId) {
        if (confirm('Удалить адрес?')) {
            database.ref(`users/${currentUser.id}/homeAddresses/${addressId}`).remove()
                .then(() => showPanel('favorites'))
                .catch(err => alert('Ошибка: ' + err.message));
        }
    }

    // ===================== РЕДАКТОР АДРЕСА =====================
  function openAddressEditor(addressId) {
    if (!currentUser || !addressId) return;

    const overlay = document.getElementById('addressEditorOverlay');
    if (!overlay) return;

    document.getElementById('editAddrId').value = addressId;

    database.ref(`users/${currentUser.id}/homeAddresses/${addressId}`).once('value')
        .then(snap => {
            if (!snap.exists()) {
                alert('Адрес не найден');
                return;
            }

            const addr = snap.val() || {};

            document.getElementById('editAddrLabel').value = addr.label || 'Дом';
            document.getElementById('editAddrCity').value = addr.city || '';
            document.getElementById('editAddrStreet').value = addr.street || '';
            document.getElementById('editAddrHouse').value = addr.houseNumber || '';

            overlay.classList.add('active');
        })
        .catch(err => {
            console.error('Ошибка загрузки адреса:', err);
            alert('Не удалось загрузить адрес');
        });
}
    function closeAddressEditor() {
        document.getElementById('addressEditorOverlay').classList.remove('active');
    }

    function saveAddressChanges() {
        if (!currentUser) return;
        const addressId = document.getElementById('editAddrId').value;
        const label = document.getElementById('editAddrLabel').value;
        const city = document.getElementById('editAddrCity').value.trim();
        const street = document.getElementById('editAddrStreet').value.trim();
        const houseNumber = document.getElementById('editAddrHouse').value.trim();

        const fullAddress = [city, street, houseNumber ? `д. ${houseNumber}` : ''].filter(Boolean).join(', ') ||
            'Адрес не указан';

        database.ref(`users/${currentUser.id}/homeAddresses/${addressId}`).update({
            label: label,
            city: city,
            street: street,
            houseNumber: houseNumber,
            address: fullAddress
        }).then(() => {
            closeAddressEditor();
            if (document.getElementById('panel').classList.contains('active')) {
                const content = document.getElementById('panelContent');
                loadUserData('favorites', content);
            }
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
        }).catch(err => alert('Ошибка: ' + err.message));
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
        map.setCenter([lat, lng], 18, { duration: 500 });
        // Небольшая анимация маркера (опционально)
        var marker = mapMarkers[parkingId];
        if (marker) {
            // можно добавить подсветку
        }
        var data = parkingDataCache[parkingId];
        if (data) {
            // Вместо openParkingSheet вызываем центральное окно
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
function saveCityFromSettingsInline() {
    if (!currentUser) return;
    var regionSelect = document.getElementById('settingsRegionInline');
    var citySelect = document.getElementById('settingsCityInline');
    var region = regionSelect ? regionSelect.value : '';
    var city = citySelect ? citySelect.value : '';
    if (!region || !city) return;
    mapCity = null;
    database.ref('users/' + currentUser.id + '/cityPreferences').set({ region: region, city: city })
        .then(function() {
            userCityPrefs = { region: region, city: city };
            // Сохраняем в localStorage
            localStorage.setItem('parknear_city', JSON.stringify({ region, city }));
            // Обновляем координаты города
            ymaps.geocode(city, { results: 1 }).then(function(res) {
                const geo = res.geoObjects.get(0);
                if (geo) {
                    const coords = geo.geometry.getCoordinates();
                    cityCoords = { lat: coords[0], lng: coords[1] };
                    localStorage.setItem('parknear_city_coords', JSON.stringify(cityCoords));
                    if (map) {
                        map.setCenter(coords, 12, { duration: 500 });
                    }
                }
            });
            updateCityDisplay();
            loadAllParkings(city);   // ← передаём city
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.selectionChanged();
            }
        })
        .catch(function(err) {
            alert('Ошибка: ' + err.message);
        });
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
   
    function getSelectedCity() {
        return String(
            userCityPrefs?.city ||
            mapCity?.city ||
            currentCity ||
            ''
        ).trim();
    }

    function normalize(value) {
        return String(value || '').trim().toLowerCase();
    }

    function getFree(parking) {
        const total = Number(parking.totalSpots || 0);
        const occupied = Number(parking.occupiedSpots || 0);
        return Math.max(0, total - occupied);
    }

    function getDistance(parking) {
        if (!lastKnownLocation || !parking?.lat || !parking?.lng) return Infinity;
        return getDistanceInMeters(
            lastKnownLocation.lat,
            lastKnownLocation.lng,
            Number(parking.lat),
            Number(parking.lng)
        );
    }

    function getOccupancyClass(parking) {
        const total = Number(parking.totalSpots || 0);
        if (!total) return 'unknown';
        const free = getFree(parking);
        const ratio = free / total;
        if (ratio <= 0.2) return 'critical';
        if (ratio <= 0.5) return 'low';
        return 'good';
    }

    function getOccupancyText(parking) {
        const total = Number(parking.totalSpots || 0);
        if (!total) return 'Мест нет в данных';
        const free = getFree(parking);
        return `${free} свободно из ${total}`;
    }

    function formatDistance(distance) {
        if (!Number.isFinite(distance)) return '';
        return distance < 1000
            ? `${Math.round(distance)} м`
            : `${(distance / 1000).toFixed(1)} км`;
    }

    function getWalkingTime(distance) {
        if (!Number.isFinite(distance)) return '';
        const minutes = Math.round(distance / 500);
        return minutes < 1 ? '<1 мин' : `${minutes} мин`;
    }
    function renderList() {
        const query = searchValue.trim().toLowerCase();
        let filtered = favorites.filter(item => {
            const parking = item.parking || item;
            // Сохраняем фильтрацию по выбранному городу
            if (city) {
                const parkingCity = normalize(
                    parking.city || item.city
                );
                if (parkingCity !== normalize(city)) {
                    return false;
                }
            }
            if (!query) return true;
            return [
                parking.name,
                parking.address,
                parking.street,
                parking.city
            ].some(value =>
                normalize(value).includes(query)
            );
        });
        filtered.sort((a, b) => {
            const pa = a.parking || a;
            const pb = b.parking || b;
            if (currentSort === 'free') {
                return getFree(pb) - getFree(pa);
            }
            if (currentSort === 'distance') {
                return getDistance(pa) - getDistance(pb);
            }
            return Number(b.timestamp || 0) -
                   Number(a.timestamp || 0);
        });
        subtitle.textContent =
            `${filtered.length} ${
                filtered.length === 1
                    ? 'парковка'
                    : filtered.length < 5
                        ? 'парковки'
                        : 'парковок'
            }`;
        if (!filtered.length) {
            list.innerHTML = `
                <div class="pn-fav-empty">
                    <div class="pn-fav-empty-icon">
                        ${query ? '🔎' : '♡'}
                    </div>
                    <h3>
                        ${query
                            ? 'Ничего не найдено'
                            : 'Избранное пусто'}
                    </h3>
                    <p>
                        ${query
                            ? 'Попробуйте изменить запрос.'
                            : 'Добавляйте парковки в избранное, чтобы быстро находить их снова.'}
                    </p>
                    ${!query
                        ? '<button type="button" id="pnFavShowMap">Найти парковку</button>'
                        : ''}
                </div>
            `;
            const showMapButton =
                list.querySelector('#pnFavShowMap');
            if (showMapButton) {
                showMapButton.addEventListener('click', showMap);
            }
            return;
        }
        list.innerHTML = filtered.map(item => {
            const parking = item.parking || item;
            const id = item.parkingId || parking.id;
            const distance = getDistance(parking);
            const distanceText = formatDistance(distance);
            const walkingText = getWalkingTime(distance);
            const name = escapeHtml(
                parking.name || item.name || 'Без названия'
            );
            const address = escapeHtml(
                parking.address || item.address || ''
            );
            const parkingCity = escapeHtml(
                parking.city || item.city || ''
            );
            return `
                <article class="pn-fav-card"
                    data-parking-id="${escapeHtml(String(id || ''))}">
                    <button class="pn-fav-card-main" type="button">
                        <div class="pn-fav-card-icon">🅿️</div>
                        <div class="pn-fav-card-info">
                            <div class="pn-fav-card-title">${name}</div>
                            ${address ? `
                                <div class="pn-fav-card-address">
                                    ${address}
                                </div>
                            ` : ''}
                            ${parkingCity ? `
                                <div class="pn-fav-card-city">
                                    📍 ${parkingCity}
                                </div>
                            ` : ''}
                            <div class="pn-fav-card-meta">
                                <span class="pn-fav-occupancy ${getOccupancyClass(parking)}">
                                    <i></i>${escapeHtml(getOccupancyText(parking))}
                                </span>
                                ${distanceText ? `
                                    <span>${escapeHtml(distanceText)}</span>
                                ` : ''}
                                ${walkingText ? `
                                    <span>${escapeHtml(walkingText)}</span>
                                ` : ''}
                            </div>
                        </div>
                        <span class="pn-fav-card-arrow">›</span>
                    </button>
                    <button class="pn-fav-remove"
                        type="button"
                        data-remove-id="${escapeHtml(String(id || ''))}"
                        title="Удалить из избранного">
                        ♥
                    </button>
                </article>
            `;
        }).join('');
        list.querySelectorAll('.pn-fav-card-main').forEach(button => {
            button.addEventListener('click', function() {
                const card = this.closest('.pn-fav-card');
                const id = card?.dataset?.parkingId;
                if (id) {
                    highlightAndShowParking(id);
                }
            });
        });
        list.querySelectorAll('.pn-fav-remove').forEach(button => {
            button.addEventListener('click', function(event) {
                event.stopPropagation();
                const id = this.dataset.removeId;
                if (id) {
                    removeFromFavorites(id);
                }
            });
        });
    }
    // Поиск
    searchInput.addEventListener('input', function() {
        searchValue = this.value.trim();
        clearSearch.hidden = !searchValue;
        renderList();
    });
    // Очистка поиска
    clearSearch.addEventListener('click', function() {
        searchInput.value = '';
        searchValue = '';
        clearSearch.hidden = true;
        renderList();
        searchInput.focus();
    });
    // Сортировка
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            filterButtons.forEach(btn =>
                btn.classList.remove('active')
            );
            this.classList.add('active');
            currentSort = this.dataset.sort || 'recent';
            renderList();
        });
    });
    // Загружаем избранное и данные парковок
    Promise.all([
        database.ref(
            `users/${currentUser.id}/favorites`
        ).once('value'),
        database.ref('parkings').once('value')
    ])
    .then(([favSnap, parkingSnap]) => {
        // Не обновляем уже закрытую или заменённую вкладку
        if (!content.isConnected ||
            !content.querySelector('#pnFavList')) {
            return;
        }
        const favData = favSnap.val() || {};
        const parkingData = parkingSnap.val() || {};
        favorites = Object.values(favData)
            .filter(item => item && item.parkingId)
            .map(item => {
                const parking = parkingData[item.parkingId];
                return {
                    ...item,
                    parking: parking
                        ? {
                            ...parking,
                            id: item.parkingId
                        }
                        : {
                            ...item,
                            id: item.parkingId
                        }
                };
            });
        renderList();
         })
    .catch(error => {
        console.error('Ошибка загрузки избранного:', error);
        if (!content.isConnected) return;
        list.innerHTML = `
            <div class="pn-fav-empty">
                <div class="pn-fav-empty-icon">⚠️</div>
                <h3>Не удалось загрузить</h3>
                <p>Проверьте соединение и попробуйте ещё раз.</p>
                <button type="button" id="pnFavRetry">
                    Повторить
                </button>
            </div>
        `;
        list.querySelector('#pnFavRetry')
            ?.addEventListener('click', () => {
                renderFavorites(content);
            });
    });
    function loadUserData(type, content) {
    if (!currentUser) {
        if (content) {
            content.innerHTML = '<div class="empty-state"><div class="icon">🔒</div><p>Войдите</p></div>';
        }
        return;
    }
    database.ref(`users/${currentUser.id}/stats`).once('value').then(snapshot => {
        if (!snapshot.exists()) {
            const initialStats = {
                registeredAt: Date.now(),
                lastActive: Date.now(),
                parkingsCreated: 0,
                parkingsUpdated: 0,
                confirmations: 0,
                views: 0,
                favorites: 0,
                activeDates: [new Date().toISOString().split('T')[0]]
            };
            database.ref(`users/${currentUser.id}/stats`).set(initialStats);
        } else {
            const stats = snapshot.val();
            const today = new Date().toISOString().split('T')[0];
            let activeDates = stats.activeDates || [];
            if (!activeDates.includes(today)) activeDates.push(today);
            database.ref(`users/${currentUser.id}/stats`).update({
                lastActive: Date.now(),
                activeDates: activeDates
            });
        }
    });
    database.ref(`users/${currentUser.id}/cityPreferences`).once('value').then(snap => {
        if (snap.exists()) {
            userCityPrefs = snap.val();
            if (typeof updateCityDisplay === 'function') {
                updateCityDisplay();
            }
        }
    });
    if (type === 'favorites' && content) {
        database.ref(`users/${currentUser.id}/favorites`).once('value').then(favSnap => {
            const favs = favSnap.val() || {};
            const favIds = Object.keys(favs);

            let html = `
                <div class="pn-favorites">
                    <div class="pn-fav-header">
                        <div>
                            <h2>Избранное</h2>
                            <p>${favIds.length ? `${favIds.length} сохранённых парковок` : 'Сохранённые парковки появятся здесь'}</p>
                        </div>
                        <span class="pn-fav-icon">❤️</span>
                    </div>
            `;
            if (!favIds.length) {
                html += `
                    <div class="empty-state">
                        <div class="icon">❤️</div>
                        <p>Избранное пусто</p>
                        <span>Нажмите ❤️ на парковке, чтобы сохранить её здесь</span>
                    </div>
                `;
            } else {
                html += `
                    <div class="fav-search">
                        <input type="text" id="favSearchInput" placeholder="Поиск по избранному..." oninput="filterFavorites()">
                    </div>
                    <div id="favListContainer">
                `;
                Object.values(favs).forEach(item => {
                    if (!item || !item.parkingId) return;
                    const name = escapeHtml(item.name || 'Парковка');
                    const address = escapeHtml(item.address || 'Адрес не указан');
                    html += `
                        <div class="fav-item" data-name="${name}" data-address="${address}" onclick="highlightAndShowParking('${item.parkingId}')">
                            <div class="fav-item-info">
                                <div class="fav-item-name">${name}</div>
                                <div class="fav-item-meta">📍 ${address}</div>
                            </div>
                            <div class="fav-item-right">
                                <span class="occupancy-dot" style="background:var(--accent);"></span>
                                <button class="settings-edit-btn" onclick="event.stopPropagation(); removeFromFavorites('${item.parkingId}')" title="Удалить из избранного">❤️</button>
                            </div>
                        </div>
                    `;
                });
                html += `
                    </div>
                `;
            }
            html += `
                </div>
            `;
            content.innerHTML = html;
            if (typeof attachSwipeToContainers === 'function') {
                attachSwipeToContainers(content);
            }
        }).catch(err => {
            console.error('Ошибка загрузки избранного:', err);
            content.innerHTML = `
                <div class="empty-state">
                    <div class="icon">⚠️</div>
                    <p>Не удалось загрузить избранное</p>
                </div>
            `;
        });
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
   function continueAsGuest() {
    // 1. Пытаемся восстановить существующего гостя
    let guestId = localStorage.getItem('parknear_guest_id');
    let user;
    if (guestId) {
        // Восстанавливаем существующего гостя
        user = {
            id: guestId,
            username: 'guest',
            firstName: 'Гость',
            photoUrl: '',
            isGuest: true
        };
        console.log('👤 Восстановлен гость:', guestId);
    } else {
        // Создаём нового гостя
        guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('parknear_guest_id', guestId);
        user = {
            id: guestId,
            username: 'guest',
            firstName: 'Гость',
            photoUrl: '',
            isGuest: true
        };
        console.log('🆕 Создан новый гость:', guestId);
        // Создаём статистику в Firebase только для нового гостя
        database.ref('users/' + guestId + '/stats').set({
            registeredAt: Date.now(),
            lastActive: Date.now(),
            parkingsCreated: 0,
            parkingsUpdated: 0,
            confirmations: 0,
            views: 0,
            favorites: 0,
            activeDates: [new Date().toISOString().split('T')[0]]
        }).catch(function(err) {
            console.warn('Ошибка создания статистики гостя:', err);
        });
    }

    // 2. Устанавливаем текущего пользователя
    currentUser = user;
    window.currentUser = user;

    // 3. Сохраняем в localStorage (для совместимости с initAuth)
    localStorage.setItem('tgUser', JSON.stringify(user));

    // 4. Обновляем активность (последний вход)
    database.ref('users/' + guestId + '/stats/lastActive').set(Date.now())
        .catch(function(err) {
            console.warn('Не удалось обновить lastActive:', err);
        });

    // 5. Обновляем активные дни (если сегодня ещё не было)
    const today = new Date().toISOString().split('T')[0];
    database.ref('users/' + guestId + '/stats/activeDates').once('value')
        .then(function(snap) {
            var dates = snap.val() || [];
            if (!dates.includes(today)) {
                dates.push(today);
                database.ref('users/' + guestId + '/stats/activeDates').set(dates);
            }
        })
        .catch(function(err) {
            console.warn('Не удалось обновить активные дни:', err);
        });

    // 6. Скрываем экран входа
    hideAuthScreen();

    // 7. Показываем главную панель и онбординг (если ещё не показывали)
    showPanel('home');
    showOnboarding();

    console.log('✅ Гостевой вход выполнен');
}

    function logout() {
        localStorage.removeItem('tgUser');
        currentUser = null;
        showAuthScreen();
    }

    function deleteAccount() {
        if (!currentUser || currentUser.id.startsWith('guest_')) {
            alert('Гостевой аккаунт нельзя удалить');
            return;
        }
        if (!confirm('Безвозвратно удалить аккаунт и все данные?')) return;
        const uid = currentUser.id;
        database.ref('parkings').once('value').then(snap => {
            const updates = {};
            snap.forEach(child => {
                if (child.val().authorId === uid) updates[child.key] = null;
            });
            return database.ref('parkings').update(updates);
        }).then(() => database.ref(`users/${uid}`).remove())
            .then(() => {
                localStorage.removeItem('tgUser');
                currentUser = null;
                showPanel('home');
            }).catch(err => alert('Ошибка: ' + err.message));
    }

    // ===================== ОНБОРДИНГ С ПОДСВЕТКОЙ =====================
    const onboardingSlides = [
    {
        icon: '👋',
        title: 'Добро пожаловать в ParkNear!',
        text: 'Приложение для поиска и отметки парковок, с актуальной занятостью. Давайте познакомимся с главными функциями.',
        highlightSelector: null,
        requiredAction: false
    },
    {
        icon: '➕',
        title: 'Шаг 1: Добавление парковки',
        text: 'Нажмите на синюю кнопку «+» в правом нижнем углу, чтобы обвести зону на карте и указать количество мест.',
        highlightSelector: '#addBtn',
        requiredAction: true
    },
    {
        icon: '📍',
        title: 'Шаг 2: Ваше местоположение',
        text: 'Нажмите на кнопку с эмодзи 📍, чтобы карта переместилась к вам. Это поможет искать парковки рядом.',
        highlightSelector: '#geoBtn',
        requiredAction: true
    },
    // ❌ Удалён шаг с обновлением данных, так как кнопки нет
    {
        icon: '🗺️',
        title: 'Шаг 3: Слои карты',
        text: 'Нажмите на иконку 🗺️ в правом верхнем углу, чтобы переключать вид: схема, спутник или гибрид.',
        highlightSelector: '.layer-switcher',
        requiredAction: true
    },
    {
        icon: '🔍',
        title: 'Шаг 4: Поиск парковок',
        text: 'На главном экране введите адрес или место в поле «куда вы направляетесь?», чтобы найти парковки рядом.',
        highlightSelector: '#homeSearchInput',  // ← исправлено
        requiredAction: true
    },
    {
        icon: '⭐',
        title: 'Шаг 5: Избранное и адреса',
        text: 'Вкладка «Избранное» хранит ваши любимые парковки и домашние адреса. Свайпом влево можно удалить.',
        highlightSelector: '.tab:nth-child(3)',
        requiredAction: true
    },
    {
        icon: '⚙️',
        title: 'Шаг 6: Настройки профиля',
        text: 'В профиле (вкладка «Профиль») можно задать город, добавить автомобиль и включить тёмную тему. Нажмите на вкладку, чтобы заглянуть.',
        highlightSelector: '.tab:nth-child(4)',
        requiredAction: true
    },
    {
        icon: '🎉',
        title: 'Вы готовы!',
        text: 'Теперь вы знаете все основные фишки. Начните с поиска парковки или добавьте свою — удачи на дорогах!',
        highlightSelector: null,
        requiredAction: false
    }
];
    let currentSlide = 0;
    let highlightedElement = null;
    let isOnboardingActive = false;
    let clickHandlerForHighlight = null;
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
            <p style="color:var(--text-secondary, #666); margin-bottom:20px; font-size:15px;">Войдите через Telegram, чтобы сохранять данные и пользоваться всеми функциями</p>
            <script async src="https://telegram.org/js/telegram-widget.js?24&v=1"
                data-telegram-login="parknear_bot"
                data-size="large"
                data-onauth="onTelegramAuth(user)"
                data-request-access="write">
            <\/script>
            <div style="margin:12px 0; color:var(--text-secondary, #666); font-size:14px;">— или —</div>
            <button class="guest-btn" onclick="continueAsGuest()" style="width:100%; padding:16px; border-radius:14px; border:none; font-size:16px; font-weight:600; cursor:pointer; background:var(--bg-secondary, #fff); color:var(--accent, #007AFF); border:1px solid var(--accent, #007AFF);">Продолжить как гость</button>
        </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('authOverlay').style.display = 'flex';
}
    function showOnboarding() {
        if (localStorage.getItem('onboardingSeen') === 'true') return;
        isOnboardingActive = true;
        const overlay = document.getElementById('onboardingOverlay');
        overlay.style.display = 'flex';
        function updateProgress(index) {
            const fill = document.getElementById('onboardingProgressFill');
            if (fill) {
                const percent = ((index + 1) / onboardingSlides.length) * 100;
                fill.style.width = percent + '%';
            }
        }
        function removeHighlight() {
            if (highlightedElement) {
                highlightedElement.classList.remove('onboarding-highlight');
                highlightedElement = null;
            }
            if (clickHandlerForHighlight) {
                document.removeEventListener('click', clickHandlerForHighlight, true);
                clickHandlerForHighlight = null;
            }
        }
        function renderSlide(index) {
            const slide = onboardingSlides[index];
            removeHighlight();
            updateProgress(index);
            document.getElementById('onboardingSlide').innerHTML = `
            <div class="onboarding-icon">${slide.icon}</div>
            <div class="onboarding-title">${slide.title}</div>
            <div class="onboarding-text">${slide.text}</div>
        `;
            const dotsContainer = document.getElementById('onboardingDots');
            dotsContainer.innerHTML = onboardingSlides.map((_, i) =>
                `<div class="onboarding-dot ${i === index ? 'active' : ''}"></div>`
            ).join('');
            const nextBtn = document.getElementById('onboardingNext');
            const prevBtn = document.getElementById('onboardingPrev');
            const skipBtn = document.getElementById('onboardingSkip');
            if (slide.requiredAction) {
                nextBtn.style.display = 'none';
                prevBtn.style.display = 'none';
                skipBtn.textContent = 'Пропустить шаг';
                skipBtn.style.display = 'block';
                const selector = slide.highlightSelector;
                if (selector) {
                    const el = document.querySelector(selector);
                    if (el) {
                        el.classList.add('onboarding-highlight');
                        highlightedElement = el;
                        if (clickHandlerForHighlight) {
                            document.removeEventListener('click', clickHandlerForHighlight, true);
                        }
                        clickHandlerForHighlight = function(e) {
                            const target = e.target.closest(selector);
                            if (target) {
                                e.preventDefault();
                                e.stopPropagation();
                                if (index < onboardingSlides.length - 1) {
                                    currentSlide = index + 1;
                                    renderSlide(currentSlide);
                                } else {
                                    finishOnboarding();
                                }
                            }
                        };
                        document.addEventListener('click', clickHandlerForHighlight, true);
                    } else {
                        console.warn('Элемент не найден:', selector);
                        setTimeout(() => {
                            if (index < onboardingSlides.length - 1) {
                                currentSlide = index + 1;
                                renderSlide(currentSlide);
                            } else {
                                finishOnboarding();
                            }
                        }, 2000);
                    }
                }
            } else {
                nextBtn.style.display = 'block';
                prevBtn.style.display = 'block';
                skipBtn.textContent = '✕';
                skipBtn.style.display = 'block';

                nextBtn.textContent = index === onboardingSlides.length - 1 ? 'Понятно' : 'Далее →';
                prevBtn.style.visibility = index === 0 ? 'hidden' : 'visible';
            }
        }
        function finishOnboarding() {
            localStorage.setItem('onboardingSeen', 'true');
            document.getElementById('onboardingOverlay').style.display = 'none';
            removeHighlight();
            isOnboardingActive = false;
            if (typeof showToast === 'function') {
                showToast('🎉 Добро пожаловать! Теперь вы готовы пользоваться ParkNear.', 4000);
            }
        }
        document.getElementById('onboardingNext').onclick = function() {
            if (currentSlide === onboardingSlides.length - 1) {
                finishOnboarding();
            } else {
                currentSlide++;
                renderSlide(currentSlide);
            }
        };
        document.getElementById('onboardingPrev').onclick = function() {
            if (currentSlide > 0) {
                currentSlide--;
                renderSlide(currentSlide);
            }
        };
        document.getElementById('onboardingSkip').onclick = function() {
            finishOnboarding();
        };
        let touchStartX = 0;
        const modal = document.querySelector('#onboardingOverlay > div');
        if (modal) {
            modal.addEventListener('touchstart', function(e) {
                touchStartX = e.changedTouches[0].screenX;
            }, { passive: true });
            modal.addEventListener('touchend', function(e) {
                const diff = touchStartX - e.changedTouches[0].screenX;
                if (Math.abs(diff) > 50) {
                    if (diff > 0 && currentSlide < onboardingSlides.length - 1) {
                        const slide = onboardingSlides[currentSlide];
                        if (!slide.requiredAction) {
                            currentSlide++;
                            renderSlide(currentSlide);
                        }
                    } else if (diff < 0 && currentSlide > 0) {
                        const slide = onboardingSlides[currentSlide];
                        if (!slide.requiredAction) {
                            currentSlide--;
                            renderSlide(currentSlide);
                        }
                    }
                }
            }, { passive: true });
        }
        currentSlide = 0;
        renderSlide(0);
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
  function loginAsGuest() {
    const userId = 'guest_' + Date.now();
    const user = {
        id: userId,
        username: 'guest',
        firstName: 'Гость',
        photoUrl: '',
        isGuest: true
    };
    currentUser = user;
    localStorage.setItem('tgUser', JSON.stringify(user));
    const userRef = database.ref('users/' + currentUser.id);
    userRef.update({
        username: currentUser.username,
        firstName: currentUser.firstName,
        photoUrl: currentUser.photoUrl,
        lastActive: Date.now()
    }).catch(console.error);
    userRef.child('stats').set({
        registeredAt: Date.now(),
        lastActive: Date.now(),
        parkingsCreated: 0,
        parkingsUpdated: 0,
        confirmations: 0,
        views: 0,
        favorites: 0,
        activeDates: [new Date().toISOString().split('T')[0]]
    }).catch(console.error);

    hideAuthScreen();
    showPanel('home');
    showOnboarding();
}
   function renderHomePanel(content) {
    const cached = localStorage.getItem('parkingCache');
    let cacheData = null;
    if (cached) {
        try {
            const cache = JSON.parse(cached);
            // ✅ Проверяем, что кеш соответствует текущему городу
            if (cache && cache.data) {
                cacheData = cache.data;
                parkingDataCache = cacheData;
                renderHomeContent(content, null);
                const list = document.getElementById('homeParkingList');
                if (list) {
                    list.insertAdjacentHTML('beforeend', '<div class="loading-indicator" style="text-align:center; color:var(--text-secondary); font-size:13px; margin-top:8px;">🔄 Обновление данных...</div>');
                }
            } else {
                // Если город не совпадает – удаляем устаревший кеш
                localStorage.removeItem('parkingCache');
                console.log('🗑️ Удалён устаревший кеш парковок');
            }
        } catch (e) {
            localStorage.removeItem('parkingCache');
        }
    }
    if (!cacheData) {
        content.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Загрузка парковок...</p></div>';
    }
    const needRefresh = (Date.now() - lastDataRefresh > REFRESH_INTERVAL_MS) || !cacheData;
    if (needRefresh) {
        // ✅ Передаём текущий город
        Promise.all([
            loadAllParkings(currentCity, true),
            getUserLocation().catch(() => null)
        ]).then(([, coords]) => {
            userLocationForSearch = coords;
            renderHomeContent(content, coords);
            const indicator = document.querySelector('.loading-indicator');
            if (indicator) indicator.remove();
            console.log('🏠 На главной загружено парковок:', Object.keys(parkingDataCache).length);
        }).catch((err) => {
            console.error('Ошибка загрузки парковок:', err);
            const indicator = document.querySelector('.loading-indicator');
            if (indicator) indicator.textContent = '⚠️ Не удалось обновить данные';
            setTimeout(() => { if (indicator) indicator.remove(); }, 3000);
            renderHomeContent(content, null);
        });
    } else {
        getUserLocation()
            .then(coords => {
                userLocationForSearch = coords;
                renderHomeContent(content, coords);
            })
            .catch(() => {
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
    container.innerHTML = show.map(p => renderParkingItem(p, coords)).join('');
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
    container.innerHTML = filtered.map(p => renderParkingItem(p, userLocationForSearch)).join('');
}
function goHome() {
    if (!currentUser) {
        alert('Войдите, чтобы использовать домашний адрес');
        return;
    }
    database.ref('users/' + currentUser.id + '/homeAddresses').once('value')
        .then(function(snap) {
            var addrs = snap.val() || {};
            var home = null;
            for (var key in addrs) {
                if (addrs.hasOwnProperty(key) && addrs[key].label === 'Дом') {
                    home = addrs[key];
                    break;
                }
            }
            if (!home) {
                alert('Домашний адрес не найден. Добавьте его в избранном.');
                return;
            }
            if (home.lat && home.lng) {
                map.setCenter([home.lat, home.lng], 16, { duration: 500 });
                var coords = { lat: home.lat, lng: home.lng };
                userLocationForSearch = coords;
                var container = document.getElementById('homeParkingList');
                if (container) {
                    showNearbyParkings(coords, 5);
                }
            } else {
                alert('У домашнего адреса нет координат. Добавьте адрес через карту.');
            }
        })
        .catch(function(err) { alert('Ошибка: ' + err.message); });
}
// Вспомогательная функция для отображения списка парковок
function renderParkingList(container, parkings) {
    if (!parkings || parkings.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Нет парковок</p></div>';
        return;
    }
    container.innerHTML = parkings.map(p => renderParkingItem(p, userLocationForSearch)).join('');
}
    // ===================== ИНИЦИАЛИЗАЦИЯ =====================
   // Проверяем URL на наличие данных авторизации от Telegram (редирект)
function checkTelegramAuthFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const authData = urlParams.get('tg_auth_data');
    if (authData) {
        try {
            const userData = JSON.parse(decodeURIComponent(authData));
            if (userData.id) {
                onTelegramAuth(userData);
                // Очищаем URL от параметров
                window.history.replaceState({}, document.title, window.location.pathname);
                return true;
            }
        } catch (e) {
            console.warn('Ошибка разбора данных авторизации:', e);
        }
    }
    return false;
}
// ===================== АВТОРИЗАЦИЯ ЧЕРЕЗ TELEGRAM =====================
async function onTelegramAuth(authData) {
    try {
        if (!authData || !authData.initData) {
            throw new Error(
                'Нет подтверждённых данных Telegram. ' +
                'Для входа требуется серверная проверка.'
            );
        }
        // ВАЖНО:
        // Здесь должен быть вызов твоего backend, который проверяет
        // подпись Telegram initData и возвращает проверенный профиль.
        //
        // Пока backend не подключён, намеренно не записываем
        // непроверенного пользователя в Firebase.
        if (typeof window.verifyTelegramInitData !== 'function') {
            throw new Error(
                'Не подключена серверная проверка Telegram. ' +
                'Нельзя безопасно подтвердить вход только на frontend.'
            );
        }
        const verifiedUser = await window.verifyTelegramInitData(
            authData.initData
        );
        if (!verifiedUser || !verifiedUser.id) {
            throw new Error(
                'Сервер не подтвердил личность пользователя Telegram.'
            );
        }
        // Постоянный ID Park Near сохраняется в прежнем формате.
        const telegramId = String(verifiedUser.id);
        const profile = {
            id: 'tg_' + telegramId,
            username: verifiedUser.username || 'tg_user',
            firstName:
                verifiedUser.first_name ||
                verifiedUser.firstName ||
                'Пользователь',
            photoUrl:
                verifiedUser.photo_url ||
                verifiedUser.photoUrl ||
                '',
            isGuest: false
        };
        if (
            typeof database === 'undefined' ||
            !database ||
            typeof database.ref !== 'function'
        ) {
            throw new Error('Firebase Realtime Database не подключена.');
        }
        const userRef = database.ref('users/' + profile.id);
        const now = Date.now();
        const today = new Date().toISOString().split('T')[0];
        // Сохраняем профиль, не перезаписывая остальные поля пользователя.
        await userRef.update({
            id: profile.id,
            telegramId: telegramId,
            username: profile.username,
            firstName: profile.firstName,
            photoUrl: profile.photoUrl,
            isGuest: false,
            lastActive: now
        });
        // Создаём статистику только при её отсутствии.
        await userRef.child('stats').transaction(stats => {
            if (stats !== null) {
                return stats;
            }
            return {
                registeredAt: now,
                lastActive: now,
                parkingsCreated: 0,
                parkingsUpdated: 0,
                confirmations: 0,
                views: 0,
                favorites: 0,
                activeDates: [today]
            };
        });
        // Обновляем только дату активности.
        await userRef.child('stats/lastActive').set(now);
        // Сохраняем сессию после успешной серверной проверки
        // и успешной записи в Firebase.
        currentUser = profile;
        window.currentUser = profile;
        localStorage.setItem('tgUser', JSON.stringify(profile));
        if (typeof hideAuthScreen === 'function') {
            hideAuthScreen();
        }
        if (typeof showPanel === 'function') {
            showPanel('home');
        }
        if (typeof showOnboarding === 'function') {
            showOnboarding();
        }
        console.log(
            'Вход и сохранение профиля выполнены:',
            profile.id
        );
        return profile;
    } catch (error) {
        console.error(
            'Ошибка авторизации или записи в Firebase:',
            error
        );
        alert(
            'Не удалось выполнить вход через Telegram. ' +
            'Проверьте авторизацию, серверную проверку и подключение Firebase.'
        );
        throw error;
    }
}
async function initApp() {
    // ✅ 1. Проверяем токен из Telegram (для PWA/браузера)
    // Если пользователь вернулся из бота со ссылкой ?token=...
    const isTokenLogin = await checkTelegramTokenFromUrl();
    if (isTokenLogin) return; // Если токен сработал, выходим из функции (интерфейс уже обновлен)
    // 2. Проверяем авторизацию внутри Telegram Mini App или восстанавливаем старую сессию
    if (checkTelegramAuthFromUrl()) {
        showPanel('home');
    } else {
        initAuth();
    }
    // 3. Восстановление выбранного города
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
    // 4. Настройка кнопки добавления парковки
    const addBtn = document.getElementById('addBtn');
    if (addBtn) {
        addBtn.onclick = function() {
            if (!currentUser) showPanel('home');
            else if (isDrawingMode) cancelDrawing();
            else startDrawingMode();
        };
    }
    // 5. Инициализация карты
    if (!map) {
        initMap();
    }
    // 6. Регистрация Service Worker для PWA (офлайн-режим и пуши)
    if ('serviceWorker' in navigator) {
        const swScope = new URL('.', window.location.href).pathname;
        navigator.serviceWorker.register(swScope + 'sw.js', { scope: swScope })
            .then(registration => {
                console.log('✅ Service Worker зарегистрирован:', registration.scope);
            })
            .catch(error => {
                console.error('❌ Ошибка регистрации Service Worker:', error);
            });
    }
    // 7. Загрузка данных
    loadAllParkings();
    initPullToRefresh();
    // 8. Показываем главную панель, если пользователь авторизован
    if (currentUser) {
        showPanel('home');
    }
    // 9. Центрируем карту на сохраненном городе
    if (map && cityCoords) {
        map.setCenter([cityCoords.lat, cityCoords.lng], 12, { duration: 300 });
    }
}
async function openTelegramBot() {
    console.log('openTelegramBot вызвана'); 
    // 1. Если мы внутри Telegram Mini App — используем родную авторизацию
    const webApp = window.Telegram?.WebApp;
    if (webApp && webApp.initData) {
        webApp.ready();
        onTelegramAuth({ initData: webApp.initData }).catch(console.error);
        return;
    }
    // 2. Если мы в браузере или PWA — запускаем авторизацию через бота
    try {
        // Генерируем случайный токен
        const token = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2);
        // Сохраняем токен в Firebase (ждем 5 минут)
        const expires = Date.now() + 5 * 60 * 1000;
        await database.ref(`loginTokens/${token}`).set({
            expires: expires,
            status: 'pending' // Ожидает подтверждения от бота
        });
        // Формируем ссылку на бота с параметром start
        const botUrl = `https://t.me/parknear_bot?start=login_${token}`;
        // Открываем Telegram
        window.open(botUrl, '_blank');
        // Показываем пользователю подсказку
        alert('Пожалуйста, подтвердите вход в открывшемся Telegram. После этого вернитесь в приложение.');
    } catch (error) {
        console.error('Ошибка запуска Telegram-авторизации:', error);
        alert('Не удалось запустить вход через Telegram. Попробуйте позже.');
    }
}
function closeAuthScreen() {
    const overlay = document.getElementById('authOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        if (!currentUser && localStorage.getItem('tgUser')) {
            initAuth();
        }
    }
});
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
