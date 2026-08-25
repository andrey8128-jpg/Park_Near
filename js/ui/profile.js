   // ===================== ПРОФИЛЬ =====================
function renderProfile(content) {
    if (!currentUser) {
        content.innerHTML = `
            <div class="profile-header">
                <div class="profile-avatar">👤</div>
                <div class="profile-name">Добро пожаловать</div>
                <div class="profile-username">Войдите, чтобы сохранять данные</div>
            </div>
            <button class="telegram-btn" onclick="openTelegramBot()">Войти через Telegram</button>
            <button class="guest-btn" onclick="continueAsGuest()">Продолжить как гость</button>
        `;
        return;
    }

    const isGuest = currentUser.id.startsWith('guest_');

    database.ref(`users/${currentUser.id}/stats`).once('value').then(statsSnap => {
        const stats = statsSnap.val() || {};
        database.ref(`users/${currentUser.id}/car`).once('value').then(carSnap => {
            const car = carSnap.val() || {};
            database.ref(`users/${currentUser.id}/cityPreferences`).once('value').then(prefSnap => {
                const prefs = prefSnap.val() || { region: '', city: '' };
                userCityPrefs = prefs;

                // ---- Расчёт XP и уровня ----
                const created = stats.parkingsCreated || 0;
                const updated = stats.parkingsUpdated || 0;
                const confirmations = stats.confirmations || 0;
                const views = stats.views || 0;
                const favorites = stats.favorites || 0;
                const activeDates = stats.activeDates || [];
                const score = (created * 25) + (updated * 5) + (confirmations * 5) + Math.floor(views / 5) + (favorites * 5) + (activeDates.length * 5);

                const levels = [
                    { xp: 0, name: "Пешеход", emoji: "👣" },
                    { xp: 1000, name: "Водитель-любитель", emoji: "🚗" },
                    { xp: 3000, name: "Начинающий парковщик", emoji: "🅿️" },
                    { xp: 5000, name: "Городской водитель", emoji: "🏙️" },
                    { xp: 10000, name: "Наблюдатель", emoji: "🔭" },
                    { xp: 20000, name: "Помощник района", emoji: "🤝" },
                    { xp: 40000, name: "Картограф", emoji: "🗺️" },
                    { xp: 70000, name: "Инспектор", emoji: "👮" },
                    { xp: 110000, name: "Ветеран дорог", emoji: "🏅" },
                    { xp: 150000, name: "Страж парковки", emoji: "⚖️" },
                    { xp: 250000, name: "Архитектор города", emoji: "🏗️" },
                    { xp: 500000, name: "Легенда ParkNear", emoji: "💎" }
                ];

                let currentLevel = levels[0];
                let nextLevel = levels[1];
                for (let i = levels.length - 1; i >= 0; i--) {
                    if (score >= levels[i].xp) {
                        currentLevel = levels[i];
                        nextLevel = levels[i + 1] || levels[i];
                        break;
                    }
                }

                const xpForCurrent = currentLevel.xp;
                const xpForNext = nextLevel.xp;
                const xpProgress = xpForNext > xpForCurrent ? (score - xpForCurrent) / (xpForNext - xpForCurrent) : 1;
                const progressPercent = Math.min(100, Math.round(xpProgress * 100));
                const circumference = 2 * Math.PI * 45;
                const strokeDashoffset = circumference * (1 - progressPercent / 100);

                // ---- Шапка профиля с круговым индикатором ----
                let html = `
                    <div style="display: flex; align-items: center; padding: 20px 0 16px; gap: 16px;">
                        <div style="font-size: 64px; flex-shrink: 0;">
                            ${currentUser.photoUrl ? `<img src="${currentUser.photoUrl}" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover;">` : '👤'}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 20px; font-weight: 700;">${currentUser.firstName}</div>
                            <div style="font-size: 15px; color: var(--text-secondary);">@${currentUser.nickname || currentUser.username}</div>
                            <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                                <span style="font-size: 14px; background: var(--accent); color: #E2E2E0; padding: 2px 12px; border-radius: 12px; font-weight: 600;">
                                    ${currentLevel.emoji} ${currentLevel.name}
                                </span>
                                ${isGuest ? '<span class="badge" style="font-size: 12px;">Гость</span>' : ''}
                            </div>
                        </div>
                        <div style="position: relative; width: 64px; height: 64px; flex-shrink: 0;">
                            <svg viewBox="0 0 100 100" style="transform: rotate(-90deg); width: 64px; height: 64px;">
                                <circle cx="50" cy="50" r="45" fill="none" stroke="var(--bg-primary)" stroke-width="8"/>
                                <circle cx="50" cy="50" r="45" fill="none" stroke="url(#repGradient)" stroke-width="8"
                                        stroke-linecap="round"
                                        stroke-dasharray="${circumference}"
                                        stroke-dashoffset="${strokeDashoffset}"
                                        style="transition: stroke-dashoffset 0.8s ease;"/>
                            </svg>
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; font-size: 11px; font-weight: 600; color: var(--text-primary); line-height: 1.2;">
                                ${score}<br>
                                <span style="font-size: 8px; color: var(--text-secondary);">XP</span>
                            </div>
                        </div>
                    </div>
                `;

                // ---- Секция "Мой автомобиль" (исправлена: убрано дублирование) ----
                html += `
                    <div class="profile-section-header" onclick="toggleProfileSection('car')">
                      <span>Мой автомобиль</span>
                       <span style="font-size:12px; color:var(--text-secondary);">${car.brand ? '✅ Добавлен' : '➕ Не добавлен'}</span>
                         <span class="arrow-span">▶</span>
                            </div>
                        <div class="profile-section-content" id="profileSectionCarContent">
                            ${car.brand ? `
                                <div style="padding: 4px 0;">
                                    <div><strong>${car.brand} ${car.model || ''}</strong></div>
                                    <div style="color: var(--text-secondary); font-size: 14px;">${car.plate || 'без номера'}</div>
                                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                                        <button class="btn-secondary" style="flex:1;" onclick="editCarDataFromSettings()">Редактировать</button>
                                        <button class="btn-danger" style="flex:1; padding:10px; margin:0;" onclick="removeCar()">🗑️ Удалить</button>
                                    </div>
                                </div>
                            ` : `
                                <div style="padding: 4px 0; color: var(--text-secondary);">
                                    Автомобиль не добавлен
                                    <button class="btn-secondary" style="width:100%; margin-top:8px;" onclick="editCarDataFromSettings()">➕ Добавить</button>
                                </div>
                            `}
                        </div>
                    </div>
                `;

                // ---- Остальные секции ----
                html += `
                    <div class="profile-section" id="profileSectionHistory">
                        <div class="profile-section-header" onclick="toggleProfileSection('history')">
                            <span>История парковок</span>
                            <span>▶</span>
                        </div>
                        <div class="profile-section-content" id="profileSectionHistoryContent">
                            <div id="historyListContainer" style="padding: 4px 0;">
                                <div style="text-align:center; color:var(--text-secondary);">Загрузка...</div>
                            </div>
                        </div>
                    </div>

                    <div class="profile-section" id="profileSectionFavorites">
                        <div class="profile-section-header" onclick="toggleProfileSection('favorites')">
                            <span>Избранные парковки</span>
                            <span>▶</span>
                        </div>
                        <div class="profile-section-content" id="profileSectionFavoritesContent">
                            <div id="favoritesListContainer" style="padding: 4px 0;">
                                <div style="text-align:center; color:var(--text-secondary);">Загрузка...</div>
                            </div>
                        </div>
                    </div>

                    <div class="profile-section" id="profileSectionSettings">
                        <div class="profile-section-header" onclick="toggleProfileSection('settings')">
                            <span>Настройки</span>
                            <span>▶</span>
                        </div>
                        <div class="profile-section-content" id="profileSectionSettingsContent">
                            <div id="settingsContentInline" style="padding: 4px 0;"></div>
                        </div>
                    </div>
                `;

                content.innerHTML = html;
                renderSettingsInline();
                window._historyLoaded = false;
                window._favoritesLoaded = false;
            });
        });
    });
}
// ---- Переключение секций профиля ----
function toggleProfileSection(section) {
    const content = document.getElementById(`profileSection${section.charAt(0).toUpperCase() + section.slice(1)}Content`);
    if (!content) return;
    const isOpen = content.classList.contains('open');
    if (isOpen) {
        content.classList.remove('open');
    } else {
        content.classList.add('open');
    }
    // Обновляем стрелку
    const header = document.getElementById(`profileSection${section.charAt(0).toUpperCase() + section.slice(1)}`);
    if (header) {
        const arrow = header.querySelector('.arrow-span');
if (arrow) {
    arrow.textContent = isOpen ? '▶' : '▼';
}
    }

    // Загружаем данные, если секция открыта
    if (section === 'history' && !window._historyLoaded) {
        loadUserParkingHistory();
        window._historyLoaded = true;
    } else if (section === 'favorites' && !window._favoritesLoaded) {
        loadFavoritesInline();
        window._favoritesLoaded = true;
    }
}

// ---- Загрузка истории парковок пользователя ----
// ---- Загрузка истории парковок пользователя (только последние 10) ----
function loadUserParkingHistory() {
    const container = document.getElementById('historyListContainer');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; color:var(--text-secondary);">Загрузка...</div>';

    const userId = currentUser.id;
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    database.ref('parkings').once('value').then(snapshot => {
        const parkings = snapshot.val() || {};
        let allEntries = [];

        Object.keys(parkings).forEach(parkingId => {
            const parking = parkings[parkingId];
            if (!parking.history) return;
            const history = parking.history;
            Object.keys(history).forEach(entryKey => {
                const entry = history[entryKey];
                if (entry.userId === userId) {
                    // Удаляем записи старше 7 дней
                    if (entry.timestamp < weekAgo) {
                        database.ref(`parkings/${parkingId}/history/${entryKey}`).remove();
                        return;
                    }
                    allEntries.push({
                        parkingId: parkingId,
                        parkingName: parking.name || 'Без названия',
                        address: parking.address || '',
                        action: entry.action || 'unknown',
                        timestamp: entry.timestamp,
                        car: entry.car || {},
                        previousOccupied: entry.previousOccupied,
                        newOccupied: entry.newOccupied
                    });
                }
            });
        });

        allEntries.sort((a, b) => b.timestamp - a.timestamp);

        if (allEntries.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:var(--text-secondary);">Нет истории</div>';
            return;
        }

        // Ограничиваем показ до 10 записей
        const showCount = 10;
        const previewEntries = allEntries.slice(0, showCount);
        const remainingEntries = allEntries.slice(showCount);

        let html = '';

        // Основной список (первые 10)
        html += '<div id="historyPreviewList">';
        previewEntries.forEach(entry => {
            html += renderHistoryEntry(entry);
        });
        html += '</div>';

        // Полный список (скрыт) и кнопки
        if (remainingEntries.length > 0) {
            html += '<div id="historyFullList" style="display:none;">';
            remainingEntries.forEach(entry => {
                html += renderHistoryEntry(entry);
            });
            html += '</div>';
            html += `<button id="showAllHistoryBtnProfile" style="background:none; border:none; color:var(--accent); cursor:pointer; font-size:14px; margin-top:8px;">См. все (${remainingEntries.length})</button>`;
            html += `<button id="hideAllHistoryBtnProfile" style="display:none; background:none; border:none; color:var(--accent); cursor:pointer; font-size:14px; margin-top:8px;">Скрыть всё</button>`;
        }

        container.innerHTML = html;

        // Обработчики кнопок
        const showAllBtn = document.getElementById('showAllHistoryBtnProfile');
        const hideAllBtn = document.getElementById('hideAllHistoryBtnProfile');
        const previewList = document.getElementById('historyPreviewList');
        const fullList = document.getElementById('historyFullList');

        if (showAllBtn) {
            showAllBtn.onclick = function() {
                previewList.style.display = 'none';
                fullList.style.display = 'block';
                showAllBtn.style.display = 'none';
                hideAllBtn.style.display = 'inline-block';
            };
        }
        if (hideAllBtn) {
            hideAllBtn.onclick = function() {
                fullList.style.display = 'none';
                previewList.style.display = 'block';
                showAllBtn.style.display = 'inline-block';
                hideAllBtn.style.display = 'none';
            };
        }
    }).catch(err => {
        console.error('Ошибка загрузки истории:', err);
        container.innerHTML = '<div style="text-align:center; color:var(--red);">Ошибка загрузки</div>';
    });
}
// ---- Вспомогательная функция для отрисовки одной записи истории ----
function renderHistoryEntry(entry) {
    const date = new Date(entry.timestamp);
    const dateStr = date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const actionText = entry.action === 'occupied' ? 'Занял' : 'Освободил';
    const actionColor = entry.action === 'occupied' ? 'var(--history-occupied)' : 'var(--history-freed)';
    const carStr = entry.car.brand ? `${entry.car.brand} ${entry.car.model || ''}` : 'без авто';
    return `
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 0.5px solid var(--border-color); font-size: 14px;">
            <div>
                <div style="font-weight: 500;">${escapeHtml(entry.parkingName)}</div>
                <div style="color: var(--text-secondary); font-size: 12px;">${escapeHtml(entry.address)}</div>
            </div>
            <div style="text-align: right;">
                <div style="color: ${actionColor}; font-weight: 600;">${actionText}</div>
                <div style="color: var(--text-secondary); font-size: 12px;">${carStr}</div>
                <div style="color: var(--text-secondary); font-size: 11px;">${dateStr}</div>
            </div>
        </div>
    `;
}
// ---- Загрузка избранного (для инлайн отображения) ----
function loadFavoritesInline() {
    const container = document.getElementById('favoritesListContainer');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; color:var(--text-secondary);">Загрузка...</div>';

    database.ref(`users/${currentUser.id}/favorites`).once('value').then(snap => {
        const favs = snap.val() || {};
        const entries = Object.values(favs).filter(f => f.parkingId);
        if (entries.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:var(--text-secondary);">Нет избранных парковок</div>';
            return;
        }
        let html = '';
        entries.forEach(item => {
            // Получаем актуальные данные о парковке из кеша или из базы
            const parking = parkingDataCache[item.parkingId];
            const free = parking ? (parking.totalSpots - parking.occupiedSpots) : '?';
            html += `
                <div class="parking-item" style="margin-bottom: 6px;" onclick="focusMap(${item.lat || 0}, ${item.lng || 0}, '${item.parkingId}')">
                    <div class="info">
                        <div class="name">${item.name || 'Без названия'}</div>
                        <div class="addr">${item.address || ''}</div>
                    </div>
                    <div class="free">${free} мест</div>
                </div>
            `;
        });
        container.innerHTML = html;
    }).catch(err => {
        container.innerHTML = '<div style="text-align:center; color:var(--red);">Ошибка загрузки</div>';
    });
}

// ---- Рендер настроек (инлайн) ----
function renderSettingsInline() {
    const container = document.getElementById('settingsContentInline');
    if (!container) return;
    if (!currentUser) {
        container.innerHTML = '<p>Войдите для доступа к настройкам</p>';
        return;
    }

    const isDark = document.body.classList.contains('dark-theme');
    const isGuest = currentUser.id.startsWith('guest_');

    let html = '';

    // Тема
    html += `
        <div class="settings-row">
            <span class="settings-label">Тёмная тема</span>
            <label class="theme-switch" style="width: 51px; height: 31px;">
               <input type="checkbox" id="settingsThemeToggleInline" ${isDark ? 'checked' : ''} onchange="toggleTheme()">
                <span class="theme-slider"></span>
            </label>
        </div>
    `;

    if (!isGuest) {
      // Добавьте в html настроек
html += `
  <div class="settings-row">
    <span class="settings-label">🔔 Уведомления о парковках</span>
    <label class="theme-switch" style="width: 51px; height: 31px;">
      <input type="checkbox" id="pushToggle" ${Notification.permission === 'granted' ? 'checked' : ''} onchange="togglePushNotifications()">
      <span class="theme-slider"></span>
    </label>
  </div>
`;

// Функция для переключения
window.togglePushNotifications = async function() {
  const isChecked = document.getElementById('pushToggle').checked;
  if (isChecked) {
    await initPushNotifications();
  } else {
    await unsubscribePush();
  }
};
        // Город
        html += `
            <div class="settings-row" style="flex-direction: column; align-items: stretch; gap: 6px;">
                <span class="settings-label">Мой город</span>
                <div style="display: flex; gap: 8px;">
                    <select id="settingsRegionInline" class="input-field" onchange="updateCitySelectInSettingsInline()" style="flex:1; margin:0;">
                        <option value="">Регион</option>
                        ${Object.keys(regionsData).sort().map(r => `<option value="${r}" ${r===userCityPrefs.region?'selected':''}>${r}</option>`).join('')}
                    </select>
                    <select id="settingsCityInline" class="input-field" onchange="saveCityFromSettingsInline()" style="flex:1; margin:0;">
                        <option value="">Город</option>
                        ${userCityPrefs.region && regionsData[userCityPrefs.region] ? regionsData[userCityPrefs.region].map(c => `<option value="${c}" ${c===userCityPrefs.city?'selected':''}>${c}</option>`).join('') : ''}
                    </select>
                </div>
            </div>
        `;
        // Удалить аккаунт
        html += `
            <div class="settings-row" style="border-bottom: none;">
                <button class="btn-danger-text" onclick="deleteAccount()" style="padding: 8px 0;">Удалить аккаунт</button>
            </div>
        `;
    } else {
        html += `<div class="settings-row"><span style="color: var(--text-secondary);">Гостевой режим — настройки ограничены</span></div>`;
    }

    container.innerHTML = html;
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
    // ===================== НАСТРОЙКИ =====================

    function closeSettings() {
        document.getElementById('settingsOverlay').style.display = 'none';
    }

    function renderSettings() {
        const contentEl = document.getElementById('settingsContent');
        if (!contentEl) {
            console.error('Элемент settingsContent не найден!');
            return;
        }

        if (!currentUser) {
            contentEl.innerHTML = '<p style="text-align:center;color:var(--text-secondary);">Пожалуйста, войдите в аккаунт</p>';
            return;
        }

        const isDark = document.body.classList.contains('dark-theme');
        const isGuest = currentUser.id.startsWith('guest_');

        let html = '';

        html += `<div class="settings-section">
        <div class="settings-section-header">Основные</div>
        <div class="settings-row">
            <span class="settings-label">Тёмная тема</span>
            <label class="theme-switch" style="width: 51px; height: 31px;">
                <input type="checkbox" id="settingsThemeToggle" ${isDark ? 'checked' : ''} onchange="toggleTheme()">
                <span class="theme-slider"></span>
            </label>
        </div>
    </div>`;

        if (!isGuest) {
            html += `<div class="settings-section">
            <div class="settings-section-header">Мой город</div>
            <div class="settings-picker-row">
                <select id="settingsRegion" class="input-field" onchange="updateCitySelectInSettings()" style="margin:0;">
                    <option value="">Регион</option>
                    ${Object.keys(regionsData).sort().map(r => `<option value="${r}" ${r===userCityPrefs.region?'selected':''}>${r}</option>`).join('')}
                </select>
                <select id="settingsCity" class="input-field" onchange="saveCityFromSettings()" style="margin:0;">
                    <option value="">Город</option>
                    ${userCityPrefs.region && regionsData[userCityPrefs.region] ? regionsData[userCityPrefs.region].map(c => `<option value="${c}" ${c===userCityPrefs.city?'selected':''}>${c}</option>`).join('') : ''}
                </select>
            </div>
        </div>`;

            const car = currentUser.car || {};
            html += `<div class="settings-section">
            <div class="settings-section-header">Автомобиль</div>
            <div class="settings-row">
                <span class="settings-label">Моё авто</span>
                <span class="settings-value">
                    ${(car.brand || car.model) ? `${car.brand || ''} ${car.model || ''}` : 'Не указан'}
                    <button class="settings-edit-btn" onclick="event.stopPropagation(); editCarDataFromSettings()">✏️</button>
                </span>
            </div>
        </div>`;

            html += `<div class="settings-section">
            <div class="settings-section-header">Профиль</div>
            <div class="settings-row">
                <span class="settings-label">Никнейм</span>
                <span class="settings-value">
                    ${currentUser.nickname || 'Не указан'}
                    <button class="settings-edit-btn" onclick="event.stopPropagation(); editNickname()">✏️</button>
                </span>
            </div>
            <div class="settings-row" onclick="resetOnboarding()">
                <span class="settings-label">Обучение</span>
                <span class="settings-value">Показать ещё раз <span class="settings-arrow">›</span></span>
            </div>
        </div>`;

            html += `<div class="settings-section">
            <button class="btn-danger-text" onclick="deleteAccount()">Удалить аккаунт</button>
        </div>`;
        } else {
            html += `<div class="settings-section">
            <div class="settings-row">
                <span class="settings-label" style="color: var(--text-secondary);">Гостевой режим — настройки ограничены</span>
            </div>
        </div>`;
        }

        contentEl.innerHTML = html;
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

   function saveCityFromSettings() {

    if (!currentUser) {
        console.warn(
            'Пользователь не авторизован'
        );
        return;
    }

    const regionSelect =
        document.getElementById('settingsRegion');

    const citySelect =
        document.getElementById('settingsCity');

    const region =
        regionSelect
            ? regionSelect.value.trim()
            : '';

    const city =
        citySelect
            ? citySelect.value.trim()
            : '';

    if (!region || !city) {
        return;
    }

    const prefs = {
        region: region,
        city: city
    };

    // ------------------------------------------------------------
    // 1. Сохраняем в Firebase
    // ------------------------------------------------------------

    database
        .ref(
            `users/${currentUser.id}/cityPreferences`
        )
        .set(prefs)

        .then(async function() {

            // ----------------------------------------------------
            // 2. Сохраняем локально
            // ----------------------------------------------------

            userCityPrefs = prefs;

            currentCity = city;

            localStorage.setItem(
                'selectedCity',
                city
            );

            localStorage.setItem(
                'parknear_city',
                JSON.stringify(prefs)
            );

            // ----------------------------------------------------
            // 3. Получаем координаты города
            // ----------------------------------------------------

            try {

                const result =
                    await ymaps.geocode(
                        `${city}, ${region}`,
                        {
                            results: 1
                        }
                    );

                const geo =
                    result.geoObjects.get(0);

                if (geo) {

                    const coords =
                        geo.geometry.getCoordinates();

                    cityCoords = {
                        lat: coords[0],
                        lng: coords[1]
                    };

                    localStorage.setItem(
                        'parknear_city_coords',
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
                }

            } catch (error) {

                console.warn(
                    '⚠️ Не удалось получить координаты города:',
                    error
                );
            }

            // ----------------------------------------------------
            // 4. Обновляем интерфейс
            // ----------------------------------------------------
            updateCityDisplay();
            // ----------------------------------------------------
            // 5. Загружаем парковки выбранного города
            // ----------------------------------------------------
            await loadAllParkings(
                currentCity,
                true
            );
            console.log(
                '✅ Город сохранён:',
                region,
                city
            );
            if (
                window.Telegram &&
                window.Telegram.WebApp &&
                window.Telegram.WebApp.HapticFeedback
            ) {
                window.Telegram.WebApp.HapticFeedback
                    .selectionChanged();
            }
        })
        .catch(function(error) {
            console.error(
                '❌ Ошибка сохранения города:',
                error
            );
            alert(
                'Не удалось сохранить город: ' +
                error.message
            );

        });
}
    function saveNickname(newNickname) {
        if (!currentUser) return;
        const nick = newNickname || (document.getElementById('settingsNickname')?.value?.trim());
        if (!nick) { alert('Введите никнейм'); return; }
        database.ref(`users/${currentUser.id}/nickname`).set(nick)
            .then(() => {
                currentUser.nickname = nick;
                localStorage.setItem('tgUser', JSON.stringify(currentUser));
                if (document.getElementById('settingsOverlay')?.style?.display === 'flex') {
                    renderSettings();
                }
                if (window.Telegram?.WebApp?.HapticFeedback) {
                    window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                }
            })
            .catch(err => alert('Ошибка: ' + err.message));
    }

    function saveCarData() {
        if (!currentUser) {
            alert('Необходимо авторизоваться');
            return;
        }
        const brand = document.getElementById('carBrandSelect')?.value;
        const model = document.getElementById('carModelSelect')?.value;
        const color = document.getElementById('carColorSelect')?.value;
        const plate = document.getElementById('carPlateInput')?.value?.trim()?.toUpperCase();

        if (!brand || !model) {
            alert('Пожалуйста, выберите марку и модель');
            return;
        }

        database.ref(`users/${currentUser.id}/car`).set({
            brand: brand,
            model: model,
            color: color || null,
            plate: plate || null
        }).then(() => {
            closeCarEditor();
            // Перерисовываем профиль, если он открыт
const panel = document.getElementById('panel');
if (panel && panel.classList.contains('active')) {
    const title = document.getElementById('panelTitle');
    if (title && title.textContent === 'Профиль') {
        const content = document.getElementById('panelContent');
        renderProfile(content);
    }
}
            if (document.getElementById('settingsOverlay')?.style?.display === 'flex') {
                renderSettings();
            }
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
        }).catch(err => {
            alert('Ошибка сохранения: ' + err.message);
        });
    }
function removeCar() {
    if (!currentUser) {
        alert('Необходимо авторизоваться');
        return;
    }
    if (!confirm('Удалить данные об автомобиле?')) return;
    database.ref(`users/${currentUser.id}/car`).remove()
        .then(() => {
            // Обновляем объект пользователя
            if (currentUser) {
                currentUser.car = {};
            }
            // Перерисовываем профиль, если он открыт
            const panel = document.getElementById('panel');
            if (panel && panel.classList.contains('active')) {
                const title = document.getElementById('panelTitle');
                if (title && title.textContent === 'Профиль') {
                    const content = document.getElementById('panelContent');
                    renderProfile(content);
                }
            }
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
            showToast('🚗 Автомобиль удалён');
        })
        .catch(err => {
            console.error('Ошибка удаления автомобиля:', err);
            alert('Не удалось удалить автомобиль: ' + err.message);
        });
}
