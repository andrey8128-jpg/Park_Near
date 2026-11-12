 // ===================== ПРОФИЛЬ И ИСТРОРИЯ =====================
function renderProfile(content) {
    if (!content) return;
if (!currentUser) {
    content.innerHTML = `
        <div class="pn-profile-login">
            <div class="pn-profile-login-icon">👤</div>
            <h2>Добро пожаловать</h2>
            <p>Войдите, чтобы сохранять парковки, город и настройки.</p>
                        <button
                type="button"
                onclick="startYandexLogin()"
                style="
                    width:100%;
                    padding:14px;
                    border:0;
                    border-radius:12px;
                    background:#FCE000;
                    color:#111;
                    font-weight:600;
                    cursor:pointer;
                "
            >
                Я  Войти через Яндекс
            </button>
            <button
                type="button"
                class="guest-btn"
                onclick="continueAsGuest()"
            >
                Продолжить как гость
            </button>
           <button
    type="button"
    class="pn-logout-btn"
    onclick="logoutUser()"
>
    Выйти из аккаунта
</button>
        </div>`;
    return;
}
    const isGuest = currentUser.id.startsWith('guest_');
   
    
Promise.all([
    requestUserProfile('GET'),
    currentUser.id.startsWith('guest_')
        ? Promise.resolve({ favorites: [] })
        : favoritesRequest()
]).then(([profileData, favoritesResult]) => {
    const stats = profileData.stats || {};
    const car = profileData.car || {};
    const prefs = profileData.cityPreferences || userCityPrefs || {};
    const favorites = favoritesResult.favorites || [];

        userCityPrefs = prefs;
        currentUser.car = car;
        currentUser.nickname = profileData.nickname || currentUser.nickname || '';
        currentUser.parkingSettings = profileData.parkingSettings || {};
        const created = Number(stats.parkingsCreated || 0);
        const updated = Number(stats.parkingsUpdated || 0);
        const confirmations = Number(stats.confirmations || 0);
        const views = Number(stats.views || 0);
        const favoritesCount = favorites.length;
        const activeDates = Array.isArray(stats.activeDates) ? stats.activeDates : [];
        const score =
            created * 25 +
            updated * 5 +
            confirmations * 5 +
            Math.floor(views / 5) +
            favoritesCount * 5 +
            activeDates.length * 5;
        const levels = [
            {xp:0,name:'Пешеход',emoji:'👣'},
            {xp:1000,name:'Водитель-любитель',emoji:'🚗'},
            {xp:3000,name:'Начинающий парковщик',emoji:'🅿️'},
            {xp:5000,name:'Городской водитель',emoji:'🏙️'},
            {xp:10000,name:'Наблюдатель',emoji:'🔭'},
            {xp:20000,name:'Помощник района',emoji:'🤝'},
            {xp:40000,name:'Картограф',emoji:'🗺️'},
            {xp:70000,name:'Инспектор',emoji:'👮'},
            {xp:110000,name:'Ветеран дорог',emoji:'🏅'},
            {xp:150000,name:'Страж парковки',emoji:'⚖️'},
            {xp:250000,name:'Архитектор города',emoji:'🏗️'},
            {xp:500000,name:'Легенда ParkNear',emoji:'💎'}
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
        const progress = nextLevel.xp > currentLevel.xp
            ? Math.min(100, Math.round(((score - currentLevel.xp) / (nextLevel.xp - currentLevel.xp)) * 100))
            : 100;
        const firstName = escapeHtml(currentUser.firstName || currentUser.first_name || 'Пользователь');
        const username = escapeHtml(currentUser.nickname || currentUser.username || '');
        const city = escapeHtml(prefs.city || currentCity || 'Город не выбран');
        const region = escapeHtml(prefs.region || '');
        const carName = car.brand ? `${escapeHtml(car.brand)} ${escapeHtml(car.model || '')}`.trim() : 'Автомобиль не добавлен';
       const avatar = currentUser.photoUrl
       ? `<img src="${escapeHtml(currentUser.photoUrl)}" alt="Аватар" onerror="this.style.display='none'; this.parentElement.innerHTML='👤';">`
       : '👤';
        content.innerHTML = `
            <div class="pn-profile">
                <section class="pn-profile-hero">
                    <div class="pn-profile-avatar">${avatar}</div>
                    <div class="pn-profile-main">
                        <div class="pn-profile-name">${firstName}</div>
                        ${username ? `<div class="pn-profile-username">@${username}</div>` : ''}
                        <div class="pn-profile-level">
                            <span>${currentLevel.emoji}</span>
                            <span>${currentLevel.name}</span>
                        </div>
                    </div>
                    ${isGuest ? '<span class="pn-profile-guest">Гость</span>' : ''}
                </section>
                <section class="pn-profile-city" onclick="openCityPicker()">
                    <div class="pn-profile-city-icon">📍</div>
                    <div class="pn-profile-city-info">
                        <div class="pn-profile-label">Мой город</div>
                        <div class="pn-profile-city-name">${city}</div>
                        ${region ? `<div class="pn-profile-city-region">${region}</div>` : ''}
                    </div>
                    <div class="pn-profile-arrow">›</div>
                </section>
                <section class="pn-profile-progress">
                    <div class="pn-profile-progress-top">
                        <div>
                            <div class="pn-profile-label">Прогресс</div>
                            <div class="pn-profile-xp">${score} XP</div>
                        </div>
                        <div class="pn-profile-next">
                            ${nextLevel === currentLevel ? 'Максимальный уровень' : `${progress}% до ${nextLevel.name}`}
                        </div>
                    </div>
                    <div class="pn-progress-track">
                        <div class="pn-progress-fill" style="width:${progress}%"></div>
                    </div>
                </section>
                <div class="pn-profile-section-title">Мой ParkNear</div>
                <section class="pn-profile-menu">
                    <button class="pn-profile-row" onclick="toggleProfileSection('car')">
                        <span class="pn-profile-row-icon">🚗</span>
                        <span class="pn-profile-row-content">
                            <strong>Мой автомобиль</strong>
                            <small>${car.brand ? carName : 'Добавьте автомобиль для быстрой отметки парковки'}</small>
                        </span>
                        <span class="pn-profile-row-arrow">›</span>
                    </button>
                    <button class="pn-profile-row" onclick="toggleProfileSection('history')">
                        <span class="pn-profile-row-icon">🕘</span>
                        <span class="pn-profile-row-content">
                            <strong>История</strong>
                            <small>Ваши действия с парковками</small>
                        </span>
                        <span class="pn-profile-row-arrow">›</span>
                    </button>
                    <button class="pn-profile-row" onclick="toggleProfileSection('favorites')">
                        <span class="pn-profile-row-icon">❤️</span>
                        <span class="pn-profile-row-content">
                            <strong>Избранные парковки</strong>
                            <small>${favoritesCount} ${favoritesCount === 1 ? 'парковка' : 'парковок'}</small>
                        </span>
                        <span class="pn-profile-row-arrow">›</span>
                    </button>
                </section>
                <div id="profileSectionCarContent" class="pn-profile-expand">
                    ${car.brand ? `
                        <div class="pn-car-card">
                            <div>
                                <strong>${carName}</strong>
                                <small>${escapeHtml(car.plate || 'Номер не указан')}</small>
                            </div>
                            <div class="pn-car-actions">
                                <button onclick="editCarDataFromSettings()">Изменить</button>
                                <button class="danger" onclick="removeCar()">Удалить</button>
                            </div>
                        </div>
                    ` : `
                        <div class="pn-empty-card">
                            <span>🚗</span>
                            <div>
                                <strong>Автомобиль не добавлен</strong>
                                <small>Добавьте его, чтобы использовать данные при парковке.</small>
                            </div>
                            <button onclick="editCarDataFromSettings()">Добавить</button>
                        </div>
                    `}
                </div>
                <div id="profileSectionHistoryContent" class="pn-profile-expand">
                    <div id="historyListContainer" class="pn-profile-loading">Загрузка...</div>
                </div>
                <div id="profileSectionFavoritesContent" class="pn-profile-expand">
                    <div id="favoritesListContainer" class="pn-profile-loading">Загрузка...</div>
                </div>
                <div class="pn-profile-section-title">Настройки</div>
                <section class="pn-profile-menu">
                    <button class="pn-profile-row" onclick="toggleProfileSection('settings')">
                        <span class="pn-profile-row-icon">⚙️</span>
                        <span class="pn-profile-row-content">
                            <strong>Настройки приложения</strong>
                            <small>Тема, уведомления и другие параметры</small>
                        </span>
                        <span class="pn-profile-row-arrow">›</span>
                    </button>
                </section>
                <div id="profileSectionSettingsContent" class="pn-profile-expand">
                    <div id="settingsContentInline" class="pn-profile-settings"></div>
                </div>
                <section class="pn-profile-stats">
                    <div><strong>${created}</strong><span>Парковок создано</span></div>
                    <div><strong>${confirmations}</strong><span>Подтверждений</span></div>
                    <div><strong>${views}</strong><span>Просмотров</span></div>
                </section>
${isGuest ? `
    <div class="pn-profile-guest-info">
        Вы используете ParkNear как гость
    </div>
    <div class="pn-profile-auth-actions">
                    <button
                type="button"
                onclick="startYandexLogin()"
                style="
                    width:100%;
                    padding:14px;
                    border:0;
                    border-radius:12px;
                    background:#FCE000;
                    color:#111;
                    font-weight:600;
                    cursor:pointer;
                "
            >
                Я  Войти через Яндекс
            </button>
        <button
            type="button"
            class="logout-button"
            onclick="logoutUser()"
        >
            Выйти из аккаунта
        </button>
    </div>
` : `
    <button
    type="button"
    class="pn-logout-btn"
    onclick="logoutUser()"
>
    Выйти из аккаунта
</button>
`}
<div class="pn-profile-version">ParkNear · профиль</div>
</div>
`;
renderSettingsInline();
window._historyLoaded = false;
window._favoritesLoaded = false;
    }).catch(error => {
        console.error('Ошибка загрузки профиля:', error);
        content.innerHTML = `
            <div class="pn-profile-error">
                <div>⚠️</div>
                <strong>Не удалось загрузить профиль</strong>
                <button onclick="renderProfile(document.getElementById('panelContent'))">Повторить</button>
            </div>
        `;
    });
}
// ---- Переключение секций профиля ----
function toggleProfileSection(section) {
    const content = document.getElementById(`profileSection${section.charAt(0).toUpperCase() + section.slice(1)}Content`);
    if (!content) return;
    const isOpen = content.classList.contains('open');
    content.classList.toggle('open', !isOpen);
    if (section === 'history' && !isOpen && !window._historyLoaded) {
        loadUserParkingHistory();
        window._historyLoaded = true;
    }
    if (section === 'favorites' && !isOpen) {
    loadFavoritesInline(true);
  }
}
// ---- Загрузка истории парковок пользователя (только последние 10) ----
async function loadUserParkingHistory() {
    const container = document.getElementById('historyListContainer');
    if (!container) return;
    if (!currentUser?.id) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-secondary);">Войдите в аккаунт</div>';
        return;
    }
    container.innerHTML = '<div style="text-align:center;color:var(--text-secondary);">Загрузка...</div>';
    try {
        const token = localStorage.getItem('parkNearSessionToken');
        if (!token) throw new Error('Не найдена сессия пользователя');
        const response = await fetch(`${window.PARKNEAR_API_URL}/api/users/me/history`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            cache: 'no-store'
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Не удалось загрузить историю');
        }
        const allEntries = Array.isArray(result.history) ? result.history : [];
        if (!allEntries.length) {
            container.innerHTML = '<div style="text-align:center;color:var(--text-secondary);">Нет истории за последние 7 дней</div>';
            return;
        }
        const previewEntries = allEntries.slice(0, 10);
        const remainingEntries = allEntries.slice(10);
        let html = '<div id="historyPreviewList">';
        previewEntries.forEach(entry => {
            html += renderHistoryEntry(entry);
        });
        html += '</div>';
        if (remainingEntries.length) {
            html += '<div id="historyFullList" style="display:none;">';
            remainingEntries.forEach(entry => {
                html += renderHistoryEntry(entry);
            });
            html += '</div>';
            html += `<button id="showAllHistoryBtnProfile" style="background:none;border:0;color:var(--accent);cursor:pointer;font-size:14px;margin-top:8px;">См. все (${remainingEntries.length})</button>`;
            html += '<button id="hideAllHistoryBtnProfile" style="display:none;background:none;border:0;color:var(--accent);cursor:pointer;font-size:14px;margin-top:8px;">Скрыть всё</button>';
        }
        container.innerHTML = html;
        const showAllBtn = document.getElementById('showAllHistoryBtnProfile');
        const hideAllBtn = document.getElementById('hideAllHistoryBtnProfile');
        const previewList = document.getElementById('historyPreviewList');
        const fullList = document.getElementById('historyFullList');
        if (showAllBtn && hideAllBtn && previewList && fullList) {
            showAllBtn.onclick = () => {
                previewList.style.display = 'none';
                fullList.style.display = 'block';
                showAllBtn.style.display = 'none';
                hideAllBtn.style.display = 'inline-block';
            };
            hideAllBtn.onclick = () => {
                fullList.style.display = 'none';
                previewList.style.display = 'block';
                showAllBtn.style.display = 'inline-block';
                hideAllBtn.style.display = 'none';
            };
        }
    } catch (error) {
        console.error('Ошибка загрузки истории:', error);
        container.innerHTML = '<div style="text-align:center;color:var(--red);">Не удалось загрузить историю. Проверьте подключение и попробуйте снова.</div>';
    }
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
function getHomeParkings() {
    const parkings = Object.values(parkingDataCache || {});
    const cityParkings =
        filterParkingsByCurrentCity(parkings);
    return groupParkingsByNameAndStreet(cityParkings);
}
// Сброс флага старой системы
window._favoritesLoaded = false;
window._favoritesLoading = false;
