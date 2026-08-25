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
                if (r === userCityPrefs.region) opt.selected = true;
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
                if (city === userCityPrefs.city) opt.selected = true;
                citySelect.appendChild(opt);
            });
        }
    }
function applyCityFromPicker(city) {
    if (!city) return;
    // 1. Сохраняем город
    currentCity = city;
    localStorage.setItem('selectedCity', city);
    userCityPrefs.city = city;   // синхронизация для остальных модулей
    // 2. Загружаем парковки (очистка карты происходит внутри loadAllParkings)
    loadAllParkings(city, true);
    // 3. Перемещаем карту на город
    const coords = getCityCoordinates(city);
    if (map && coords) {
        map.setCenter(coords, 12, { duration: 500 });
    } else if (typeof ymaps !== 'undefined' && ymaps.geocode) {
        ymaps.geocode(city, { results: 1 }).then(function(res) {
            const geo = res.geoObjects.get(0);
            if (geo) {
                const coords = geo.geometry.getCoordinates();
                cityCoords = { lat: coords[0], lng: coords[1] };
                localStorage.setItem('parknear_city_coords', JSON.stringify(cityCoords));
                if (map) map.setCenter(coords, 12, { duration: 500 });
            }
        }).catch(function() {});
    }

    // 4. Обновляем отображение города в интерфейсе
    updateCityDisplay();
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
    function updateCityDisplay() {
        const cityName = mapCity ? mapCity.city : (userCityPrefs.city || 'Не указан');
        const displayEl = document.getElementById('cityDisplayName');
        if (displayEl) {
            displayEl.textContent = cityName;
        }
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
