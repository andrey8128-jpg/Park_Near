// ---- НАСТРОЙКИ----
async function requestUserProfile(method = 'GET', updates = null) {
    const token = localStorage.getItem('parkNearSessionToken');
    if (!token) {
        throw new Error('Сессия пользователя не найдена. Войдите заново.');
    }
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        },
        cache: 'no-store'
    };
    if (updates !== null) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(updates);
    }
    const response = await fetch(
        `${window.PARKNEAR_API_URL}/api/users/me/profile`,
        options
    );
    const result = await response.json();
    if (!response.ok || !result.success) {
        throw new Error(
            result.error || `Ошибка профиля: HTTP ${response.status}`
        );
    }
    return result.profile || {};
}
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
              // Web Push
        const notificationsGranted =
            'Notification' in window &&
            Notification.permission === 'granted';

        html += `
            <div class="settings-row">
                <span class="settings-label">🔔 Уведомления о парковках</span>
                <label class="theme-switch" style="width: 51px; height: 31px;">
                    <input
                        type="checkbox"
                        id="pushToggle"
                        ${notificationsGranted ? 'checked' : ''}
                        onchange="togglePushNotifications()"
                    >
                    <span class="theme-slider"></span>
                </label>
            </div>
        `;
        window.togglePushNotifications = async function() {
            const toggle = document.getElementById('pushToggle');
            if (!toggle) return;
            toggle.disabled = true;
            try {
                if (toggle.checked) {
                    const success = await initPushNotifications();
                    if (!success) {
                        toggle.checked = false;
                    }
                } else {
                    const success = await unsubscribePush();
                    if (!success) {
                        toggle.checked = true;
                    }
                }
            } finally {
                toggle.disabled = false;
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
        syncThemeToggles();
}

async function saveCityFromSettings() {
    if (!currentUser) return;

    const region = document.getElementById('settingsRegion')?.value || '';
    const city = document.getElementById('settingsCity')?.value || '';

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

        ymaps.geocode(city, { results: 1 })
            .then(result => {
                const geo = result.geoObjects.get(0);
                if (!geo) return;
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
            })
            .catch(error => {
                console.warn('Не удалось определить координаты города:', error);
            });
        updateCityDisplay();
        if (typeof window.loadAllParkings === 'function') {
            await window.loadAllParkings(city, true);
        }
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.selectionChanged();
        }
        console.log('Город сохранён в PostgreSQL:', city);
    } catch (error) {
        console.error('Ошибка сохранения города:', error);
        alert('Не удалось сохранить город: ' + error.message);
    }
}
async function saveNickname(newNickname) {
    if (!currentUser) return;
    const nick = String(
        newNickname ||
        document.getElementById('settingsNickname')?.value ||
        ''
    ).trim();
    if (!nick) {
        alert('Введите никнейм');
        return;
    }
    try {
        const profile = await requestUserProfile('PATCH', {
            nickname: nick
        });
        currentUser.nickname = profile.nickname || nick;
        localStorage.setItem(
            'tgUser',
            JSON.stringify(currentUser)
        );
        if (
            document.getElementById('settingsOverlay')
                ?.style?.display === 'flex'
        ) {
            renderSettings();
        }
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback
                .notificationOccurred('success');
        }
        showToast('Никнейм сохранён');
    } catch (error) {
        console.error('Ошибка сохранения никнейма:', error);
        alert('Ошибка: ' + error.message);
    }
}
async function saveCarData() {
    if (!currentUser) {
        alert('Необходимо авторизоваться');
        return;
    }
    const brand = document.getElementById('carBrandSelect')?.value;
    const model = document.getElementById('carModelSelect')?.value;
    const color = document.getElementById('carColorSelect')?.value;
    const plate = document.getElementById('carPlateInput')
        ?.value?.trim()?.toUpperCase();
    if (!brand || !model) {
        alert('Пожалуйста, выберите марку и модель');
        return;
    }
    const car = {
        brand,
        model,
        color: color || null,
        plate: plate || null
    };
    try {
        await requestUserProfile('PATCH', { car });
        currentUser.car = car;
        closeCarEditor();
        const panel = document.getElementById('panel');
        if (
            panel?.classList.contains('active') &&
            document.getElementById('panelTitle')?.textContent === 'Профиль'
        ) {
            renderProfile(document.getElementById('panelContent'));
        }
        if (
            document.getElementById('settingsOverlay')
                ?.style?.display === 'flex'
        ) {
            renderSettings();
        }
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback
                .notificationOccurred('success');
        }
        showToast('Автомобиль сохранён');
    } catch (error) {
        console.error('Ошибка сохранения автомобиля:', error);
        alert('Ошибка сохранения: ' + error.message);
    }
}
async function removeCar() {
    if (!currentUser) {
        alert('Необходимо авторизоваться');
        return;
    }
    if (!confirm('Удалить данные об автомобиле?')) return;
    try {
        await requestUserProfile('PATCH', {
            car: {}
        });
        currentUser.car = {};
        const panel = document.getElementById('panel');
        if (
            panel?.classList.contains('active') &&
            document.getElementById('panelTitle')?.textContent === 'Профиль'
        ) {
            renderProfile(document.getElementById('panelContent'));
        }
        showToast('Автомобиль удалён');
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback
                .notificationOccurred('success');
        }
    } catch (error) {
        console.error('Ошибка удаления автомобиля:', error);
        alert('Не удалось удалить автомобиль: ' + error.message);
    }
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
async function saveParkingSettings(settings) {
    if (!settings || typeof settings !== 'object') return;
    try {
        if (currentUser) {
            await requestUserProfile('PATCH', {
                parkingSettings: settings
            });
            currentUser.parkingSettings = settings;
            localStorage.setItem(
                'parkingSettings',
                JSON.stringify(settings)
            );
        } else {
            localStorage.setItem(
                'parkingSettings',
                JSON.stringify(settings)
            );
        }
    } catch (error) {
        console.error('Ошибка сохранения настроек парковки:', error);
        alert('Не удалось сохранить настройки: ' + error.message);
    }
}
