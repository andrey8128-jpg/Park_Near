// ---- НАСТРОЙКИ----
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
function saveCityFromSettings() {
    if (!currentUser) {
        console.warn('Пользователь не авторизован');
        return;
    }
    var regionSelect = document.getElementById('settingsRegion');
    var citySelect = document.getElementById('settingsCity');
    var region = regionSelect ? regionSelect.value : '';
    var city = citySelect ? citySelect.value : '';
    if (!region || !city) return;
    mapCity = null;
    database.ref('users/' + currentUser.id + '/cityPreferences').set({ region: region, city: city })
        .then(function() {
            userCityPrefs = { region: region, city: city };
            currentCity = city;
            localStorage.setItem('parknear_city', JSON.stringify({ region, city }));
            // Получаем координаты и сохраняем
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
            console.log('✅ Город сохранён в профиле:', city);
        })
        .catch(function(err) {
            console.error('❌ Ошибка сохранения города:', err);
            alert('Не удалось сохранить город: ' + err.message);
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
