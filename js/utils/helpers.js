// ===================== УТИЛИТЫ =====================
   function getOccupancyColor(occupied, total) {
    if (total === 0) return '#0A282C';
    const ratio = occupied / total;
    return (ratio < 0.5) ? '#2B7574' : (document.body.classList.contains('dark-theme') ? '#861211' : '#0E2931');
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
// ===== ОБНОВЛЕНИЕ КРУЖКА =====
// ===================== ОБНОВЛЕНИЕ КРУЖКА С ОБЩИМ КОЛИЧЕСТВОМ =====================
function updateTotalFreeCircle() {
    // 1. Получаем все парковки из кеша (уже отфильтрованы по городу, если выбран)
    var allParkings = Object.values(parkingDataCache);
    // 2. Считаем сумму свободных мест (общее - занятые)
    var totalFree = allParkings.reduce(function(sum, p) {
        var free = (p.totalSpots || 0) - (p.occupiedSpots || 0);
        return sum + Math.max(0, free); // защита от отрицательных
    }, 0);
    // 3. Обновляем текст в кружке
    var countEl = document.getElementById('totalFreeCount');
    if (countEl) {
        countEl.textContent = totalFree;
    }
    // 4. Меняем цвет кружка в зависимости от количества свободных мест
    var circle = document.getElementById('totalFreeCircle');
    if (circle) {
        if (totalFree === 0) {
            circle.style.backgroundColor = '#D32F2F';   // красный – мест нет
        } else if (totalFree < 10) {
            circle.style.backgroundColor = '#ED6C02';   // оранжевый – мало
        } else {
            circle.style.backgroundColor = '#2B7574';   // зелёный/акцент – достаточно
        }
    }
}
   function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
    function getOccupancyDotColor(free, total) {
        if (total === 0) return 'var(--gray)';
        const ratio = free / total;
        if (ratio >= 0.5) return 'var(--green)';
        if (ratio >= 0.2) return 'var(--orange)';
        return 'var(--red)';
    }
    function getDistanceInMeters(lat1, lng1, lat2, lng2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI /
            180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    function renderParkingItem(parking, userCoords) {
    const free = parking.totalSpots - (parking.occupiedSpots || 0);
    const total = parking.totalSpots || 0;
    const ratio = total > 0 ? free / total : 1;
    let badgeClass = '';
    if (ratio <= 0.2) badgeClass = 'critical';
    else if (ratio <= 0.5) badgeClass = 'low';
    let badgeText = free;
    if (total === 0) badgeText = '?';
    let distanceHtml = '';
    if (userCoords && parking.lat && parking.lng) {
        const dist = getDistanceInMeters(userCoords.lat, userCoords.lng, parking.lat, parking.lng);
        const distStr = dist < 1000 ? Math.round(dist) + ' м' : (dist/1000).toFixed(1) + ' км';
        const time = Math.round(dist / 500);
        const timeStr = time < 1 ? '<1 мин' : time + ' мин';
        distanceHtml = `<div class="meta-row"><span>${escapeHtml(distStr)}</span><span class="dot">·</span><span>${escapeHtml(timeStr)}</span></div>`;
    }
    const safeName = escapeHtml(parking.name || 'Без названия');
    const safeBadge = escapeHtml(String(badgeText));
    return `
        <div class="parking-item" onclick="focusMap(${parking.lat}, ${parking.lng}, '${escapeHtml(parking.id)}')">
            <div class="info">
                <div style="display:flex; align-items:center; justify-content:space-between;">
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
        const d = new Date(timestamp);
        return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    }
    function checkPolygonSize(coordinates) {
        if (!coordinates || coordinates.length < 3) return { valid: false, error: 'Минимум 3 точки' };
        const lats = coordinates.map(c => c[0]),
            lngs = coordinates.map(c => c[1]);
        const minLat = Math.min(...lats),
            maxLat = Math.max(...lats),
            minLng = Math.min(...lngs),
            maxLng = Math.max(...lngs);
        const widthM = getDistanceInMeters(minLat, minLng, minLat, maxLng),
            lengthM = getDistanceInMeters(minLat, minLng, maxLat, minLng);
        if (widthM > MAX_ZONE_WIDTH || lengthM > MAX_ZONE_LENGTH) return { valid: false,
            error: `Зона слишком большая! Максимум ${MAX_ZONE_WIDTH}×${MAX_ZONE_LENGTH}м. Сейчас: ${Math.round(widthM)}×${Math.round(lengthM)}м` };
        return { valid: true, width: widthM, length: lengthM };
    }
   // ===================== ТОЧНЫЙ РАСЧЁТ ПАРКОВОЧНЫХ МЕСТ =====================
function calculatePolygonArea(coordinates) {
    const firstLat = coordinates[0][0];
    const firstLng = coordinates[0][1];
    const points = coordinates.map(([lat, lng]) => {
        const dy = (lat - firstLat) * 111320;
        const dx = (lng - firstLng) * 111320 * Math.cos(firstLat * Math.PI / 180);
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
    if (!coordinates || coordinates.length < 3) return 0;
    const settings = getUserParkingSettings();
    const spotArea = settings.spotArea || 12.5;
    const area = calculatePolygonArea(coordinates);
    let spots = Math.floor(area / spotArea);
    return Math.max(0, spots);
}
function getUserParkingSettings() {
    const defaults = { spotArea: 12.5}; // ← объявляем defaults
    if (currentUser && currentUser.parkingSettings) {
        const s = currentUser.parkingSettings;
        return { spotArea: s.spotArea || defaults.spotArea };
    }
    const saved = localStorage.getItem('parkingSettings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            return { spotArea: parsed.spotArea || defaults.spotArea };
        } catch (e) {}
    }
    return defaults;
}
function saveParkingSettings(settings) {
    if (currentUser) {
        database.ref(`users/${currentUser.id}/parkingSettings`).set(settings);
        currentUser.parkingSettings = settings;
    }
    localStorage.setItem('parkingSettings', JSON.stringify(settings));
}
  /**
 * Парсит российский адрес, извлекая регион, город, улицу и номер дома.
 * @param {string} fullAddress - Полный адрес (например, "Россия, Московская область, г. Москва, ул. Тверская, д. 15")
 * @param {Object} [regionsData] - Объект вида { "Регион": ["Город1", "Город2", ...] }.
 *                                  Если не передан, используется глобальная переменная regionsData.
 * @returns {{ region: string, city: string, street: string, houseNumber: string }}
 */
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
    // Дополнительная нормализация улицы: убираем типичные сокращения (опционально)
    // Можно удалить "ул.", "пр-т", "пер.", "бульв." и т.д., но аккуратно, чтобы не сломать названия.
    // Простой вариант: оставляем как есть, т.к. это может быть и "Тверская улица" и "ул. Тверская".
    // Если хотите убрать сокращения, раскомментируйте:
    // street = street.replace(/^(ул\.|улица|проспект|пр-т|пер\.|переулок|бульвар|бульв\.|набережная|наб\.)\s+/i, '').trim();
    return {
        region: foundRegion || '',
        city: foundCity || '',
        street: street,
        houseNumber: houseNumber
    };
}
// ============================================================
// ОПРЕДЕЛЕНИЕ ГОРОДА И РЕГИОНА ПО КООРДИНАТАМ
// ============================================================
async function getLocationDetailsByCoords(lat, lng) {

    if (
        !Number.isFinite(Number(lat)) ||
        !Number.isFinite(Number(lng))
    ) {
        throw new Error('Некорректные координаты');
    }
    const coords = [
        Number(lat),
        Number(lng)
    ];
    try {
        const result = await ymaps.geocode(
            coords,
            {
                kind: 'house',
                results: 1
            }
        );
        const geoObject =
            result.geoObjects.get(0);
        if (!geoObject) {
            throw new Error(
                'Адрес по координатам не найден'
            );
        }
        const address =
            geoObject.getAddressLine() || '';
        const parsed =
            parseAddress(address);
        // Если parseAddress не смог найти город,
        // пробуем получить его из properties Яндекса
        let city = parsed.city || '';
        let region = parsed.region || '';
        try {
            const meta =
                geoObject.properties.get(
                    'metaDataProperty'
                );
            const geocoderMeta =
                meta &&
                meta.GeocoderMetaData;
            const addressDetails =
                geocoderMeta &&
                geocoderMeta.AddressDetails;
            if (
                !city &&
                addressDetails
            ) {
                const country =
                    addressDetails.Country;
                const administrativeArea =
                    country &&
                    country.AdministrativeArea;
                const locality =
                    administrativeArea &&
                    administrativeArea.Locality;
                if (locality) {
                    city =
                        locality.AddressLine ||
                        locality.LocalityName ||
                        '';
                }
            }
        } catch (e) {
            console.warn(
                'Не удалось получить дополнительные данные адреса:',
                e
            );
        }
        return {
            address: address,
            region: region,
            city: city,
            street:
                parsed.street || '',
            houseNumber:
                parsed.houseNumber || '',
            lat: Number(lat),
            lng: Number(lng)
        };
    } catch (error) {
        console.error(
            '❌ Reverse geocoding error:',
            error
        );
        throw error;
    }
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
