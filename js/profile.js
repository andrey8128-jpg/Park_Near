 // ===================== ПРОФИЛЬ И ИСТРОРИЯ =====================
function renderProfile(content) {
    if (!content) return;

    if (!currentUser) {
        content.innerHTML = `
            <div class="pn-profile-login">
               <div class="pn-profile-login-icon">
                 ${window.pnIcon('user', {size:28})}
                   </div>
                <h2>Добро пожаловать</h2>
                <p>Войдите, чтобы сохранять парковки, город и настройки.</p>
                <button type="button" onclick="startYandexLogin()" style="width:100%;padding:14px;border:0;border-radius:12px;background:#FCE000;color:#111;font-weight:600;cursor:pointer;">
                    Я Войти через Яндекс
                </button>
                <button type="button" class="guest-btn" onclick="continueAsGuest()">
                    Продолжить как гость
                </button>
                <button type="button" class="pn-logout-btn" onclick="logoutUser()">
                    Выйти из аккаунта
                </button>
            </div>`;
        return;
    }

    const profileUserId = String(currentUser.id);
    const profileCacheKey = `profile_${profileUserId}`;
    const favoritesCacheKey = `favorites_${profileUserId}`;
    const isGuest = profileUserId.startsWith('guest_');
 // Доступ к модерации только по серверной роли
const canModerate =
    !isGuest &&
    !window.isOfflineSession &&
    String(currentUser.id) === 'ya_607486351' &&
    ['moderator', 'admin'].includes(currentUser.role);
const loadProfileData = async () => {
    if (isGuest) {
        return { profileData: {}, favorites: [] };
    }
    // Офлайн: сразу используем локальный кэш
    if (!navigator.onLine || window.isOfflineSession) {
        if (!window.ParkNearOffline) {
            throw new Error('Локальное хранилище недоступно');
        }
        const [cachedProfile, cachedFavorites] = await Promise.all([
            ParkNearOffline.getUserData(profileCacheKey),
            ParkNearOffline.getUserData(favoritesCacheKey)
        ]);
        if (!cachedProfile) {
            throw new Error('Нет сохранённых данных профиля для офлайн-режима');
        }
        return {
            profileData: cachedProfile,
            favorites: Array.isArray(cachedFavorites)
                ? cachedFavorites
                : []
        };
    }
    // Онлайн: загружаем данные с сервера
    try {
        const [profileData, favoritesResult] = await Promise.all([
            requestUserProfile('GET'),
            favoritesRequest()
        ]);
        const safeProfile = profileData || {};
        const safeFavorites = Array.isArray(favoritesResult?.favorites)
            ? favoritesResult.favorites
            : [];
        if (window.ParkNearOffline) {
            await Promise.all([
                ParkNearOffline.saveUserData(profileCacheKey, safeProfile),
                ParkNearOffline.saveUserData(favoritesCacheKey, safeFavorites)
            ]);
        }
        return {
            profileData: safeProfile,
            favorites: safeFavorites
        };
    } catch (error) {
        console.warn('Не удалось загрузить профиль с сервера:', error);
        if (!window.ParkNearOffline) throw error;
        const [cachedProfile, cachedFavorites] = await Promise.all([
            ParkNearOffline.getUserData(profileCacheKey),
            ParkNearOffline.getUserData(favoritesCacheKey)
        ]);
        if (!cachedProfile) throw error;
        return {
            profileData: cachedProfile,
            favorites: Array.isArray(cachedFavorites) ? cachedFavorites : []
        };
    }
};
    loadProfileData().then(({ profileData, favorites }) => {
        const stats = profileData.stats || {};
        const car = profileData.car || {};
        const prefs = profileData.cityPreferences || userCityPrefs || {};

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
        const parkingSessionsCompleted = Number(stats.parkingSessionsCompleted || 0);
           const score =
    created * 25 +
    updated * 5 +
    confirmations * 5 +
    Math.floor(views / 5) +
    favoritesCount * 5 +
    activeDates.length * 5 +
    parkingSessionsCompleted * 5;
       const levels = [
         {xp:0,name:'Пешеход',icon:'walking'},
         {xp:1000,name:'Водитель-любитель',icon:'car'},
         {xp:3000,name:'Начинающий парковщик',icon:'parking'},
         {xp:5000,name:'Городской водитель',icon:'map'},
         {xp:10000,name:'Наблюдатель',icon:'compass'},
         {xp:20000,name:'Помощник района',icon:'people'},
         {xp:40000,name:'Картограф',icon:'map'},
         {xp:70000,name:'Инспектор',icon:'shield'},
         {xp:110000,name:'Ветеран дорог',icon:'trophy'},
         {xp:150000,name:'Страж парковки',icon:'shield'},
         {xp:250000,name:'Архитектор города',icon:'briefcase'},
         {xp:500000,name:'Легенда ParkNear',icon:'star'}
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
       ? `<img src="${escapeHtml(currentUser.photoUrl)}" alt="Аватар" onerror="this.style.display='none'; this.parentElement.innerHTML=window.pnIcon('user', {size:28});">`
       : window.pnIcon('user', {size:28});
        content.innerHTML = `
            <div class="pn-profile">
                <section class="pn-profile-hero">
                    <div class="pn-profile-avatar">${avatar}</div>
                    <div class="pn-profile-main">
                        <div class="pn-profile-name">${firstName}</div>
                        ${username ? `<div class="pn-profile-username">@${username}</div>` : ''}
                        <div class="pn-profile-level">
                            <span>${window.pnIcon(currentLevel.icon, {size:24})}</span>
                            <span>${currentLevel.name}</span>
                        </div>
                    </div>
                    ${isGuest ? '<span class="pn-profile-guest">Гость</span>' : ''}
                </section>
                <section class="pn-profile-city" onclick="openCityPicker()">
                    <div class="pn-profile-city-icon">
                     ${window.pnIcon('mapPin', {size:18})}
                     </div>
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
                       <span class="pn-profile-row-icon">
                       ${window.pnIcon('car', {size:20})}
                         </span>
                        <span class="pn-profile-row-content">
                            <strong>Мой автомобиль</strong>
                            <small>${car.brand ? carName : 'Добавьте автомобиль для быстрой отметки парковки'}</small>
                        </span>
                        <span class="pn-profile-row-arrow">›</span>
                    </button>
                    <button class="pn-profile-row" onclick="openMyAddresses()">
                     <span class="pn-profile-row-icon">
                     ${window.pnIcon('mapPin', {size:20})}
                    </span>
    <span class="pn-profile-row-content">
        <strong>Мои адреса</strong>
        <small>Сохранённые места и парковки поблизости</small>
    </span>
    <span class="pn-profile-row-arrow">›</span>
</button>
                    <button class="pn-profile-row" onclick="toggleProfileSection('history')">
                        <span class="pn-profile-row-icon">
                         ${window.pnIcon('clock', {size:20})}
                         </span>
                        <span class="pn-profile-row-content">
                            <strong>История</strong>
                            <small>Ваши действия с парковками</small>
                        </span>
                        <span class="pn-profile-row-arrow">›</span>
                    </button>
                    <button class="pn-profile-row" onclick="toggleProfileSection('favorites')">
                        <span class="pn-profile-row-icon">
                         ${window.pnIcon('heart', {size:20})}
                          </span>
                        <span class="pn-profile-row-content">
                            <strong>Избранные парковки</strong>
                            <small>${favoritesCount} ${favoritesCount === 1 ? 'парковка' : 'парковок'}</small>
                        </span>
                        <span class="pn-profile-row-arrow">›</span>
                    </button>
                    
                <button
                       type="button"
                          class="pn-profile-row"
                            onclick="resetOnboarding()"
                           >
                       <span class="pn-profile-row-icon">
                       ${window.pnIcon('book', {size:20})}
                       </span>
    <span class="pn-profile-row-content">
        <strong>Обучение ParkNear</strong>
        <small>Как пользоваться приложением</small>
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
                            <span>
                            ${window.pnIcon('car', {size:18})}
                             </span>
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
                        <span class="pn-profile-row-icon">
                        ${window.pnIcon('settings', {size:20})}
                          </span>
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
                
${canModerate ? `
    <div class="pn-profile-section-title">Инструменты модератора</div>
    <section class="pn-profile-menu">
        <button
            type="button"
            class="pn-profile-row"
            onclick="toggleProfileSection('moderation')"
        >
            <span class="pn-profile-row-icon">
              ${window.pnIcon('shield', {size:20})}
             </span>
            <span class="pn-profile-row-content">
                <strong>Модерация парковок</strong>
                <small>Проверка новых заявок пользователей</small>
            </span>
            <span class="pn-profile-row-arrow">›</span>
        </button>
    </section>

    <div id="profileSectionModerationContent" class="pn-profile-expand">
        <div id="moderationListContainer" class="pn-profile-loading">
            Нажмите, чтобы загрузить заявки
        </div>
    </div>
` : ''}
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
    const content = document.getElementById(
        `profileSection${section.charAt(0).toUpperCase() + section.slice(1)}Content`
    );
    if (!content) return;
    const isOpen = content.classList.contains('open');
    content.classList.toggle('open', !isOpen);
    // История парковок
    if (
        section === 'history' &&
        !isOpen &&
        !window._historyLoaded
    ) {
        loadUserParkingHistory();
        window._historyLoaded = true;
    }
    // Избранное
    if (section === 'favorites' && !isOpen) {
        loadFavoritesInline(true);
    }
    // Модерация парковок
    if (section === 'moderation' && !isOpen) {
        loadModerationQueue();
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
    const carStr = entry.car?.brand
    ? `${escapeHtml(entry.car.brand)} ${escapeHtml(entry.car.model || '')}`
    : 'без авто';
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
// ============================================
// МОДЕРАЦИЯ ПАРКОВОК В ПРОФИЛЕ
// ============================================
async function loadModerationQueue() {
    const container = document.getElementById('moderationListContainer');
    if (!container) return;
    const token = localStorage.getItem('parkNearSessionToken');
    if (!token || window.isOfflineSession) {
        container.textContent = 'Для модерации необходимо войти в аккаунт онлайн.';
        return;
    }
    container.textContent = 'Загрузка заявок...';
    try {
        const response = await fetch(
            `${window.PARKNEAR_API_URL}/api/moderation/queue?limit=50`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                cache: 'no-store'
            }
        );
        const result = await response.json();
        if (response.status === 403) {
            container.textContent = 'У вашего аккаунта нет прав модератора.';
            return;
        }
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Не удалось загрузить заявки');
        }
        const items = Array.isArray(result.items) ? result.items : [];
        if (!items.length) {
            container.textContent = 'Новых заявок на модерацию нет.';
            return;
        }
        container.innerHTML = items.map(item => {
            const data = item.proposedData || {};
            const address = [
                data.city,
                data.street,
                data.houseNumber
            ].filter(Boolean).join(', ');
            const safeId = escapeHtml(item.id);
            const safeName = escapeHtml(data.name || 'Новая парковка');
            const safeAddress = escapeHtml(
                address || data.address || 'Адрес не указан'
            );
            const safeAuthor = escapeHtml(
                item.author?.firstName || item.author?.username || 'Пользователь'
            );
            return `
                <div class="pn-address-card">
                    <div class="pn-address-card-head">
                        <strong>${safeName}</strong>
                        <small>Новая заявка</small>
                    </div>
                    <p>${safeAddress}</p>
                    <p>
                        Мест: ${Number(data.totalSpots) || 0}
                    </p>
                    <small>Автор: ${safeAuthor}</small>
                   <div class="pn-car-actions">
    <button
        type="button"
        data-moderation-id="${safeId}"
        data-moderation-action="view"
    >
        Посмотреть
    </button>
    <button
        type="button"
        data-moderation-id="${safeId}"
        data-moderation-action="edit"
    >
        Исправить
    </button>
    <button
        type="button"
        data-moderation-id="${safeId}"
        data-moderation-action="approve"
    >
        Одобрить
    </button>
    <button
        type="button"
        class="danger"
        data-moderation-id="${safeId}"
        data-moderation-action="reject"
    >
        Отклонить
    </button>
</div>
                </div>
            `;
        }).join('');
       container.querySelectorAll('[data-moderation-action]')
    .forEach(button => {
        button.addEventListener('click', () => {
            const id = button.dataset.moderationId;
            const action = button.dataset.moderationAction;
            if (!id) return;
            const item = items.find(
                entry => String(entry.id) === String(id)
            );
            if (!item) return;
            if (action === 'view') {
                viewModerationRequest(item);
                return;
            }
            if (action === 'edit') {
                editModerationRequest(item);
                return;
            }
            if (
                !['approve', 'reject'].includes(action)
            ) {
                return;
            }
            moderateParkingRequest(id, action);
        });
    });
    } catch (error) {
        console.error('Ошибка очереди модерации:', error);
        container.textContent = error.message ||
            'Не удалось загрузить заявки.';
    }
}
// ============================================
// ПРОСМОТР ЗАЯВКИ МОДЕРАТОРОМ
// ============================================
function viewModerationRequest(item) {
    const data = item.proposedData || {};
    const author = item.author || {};
    const address = [
        data.city,
        data.region,
        data.street,
        data.houseNumber
    ].filter(Boolean).join(', ');
    const details = [
        `Название: ${data.name || 'Не указано'}`,
        `Адрес: ${address || data.address || 'Не указан'}`,
        `Количество мест: ${data.totalSpots ?? 'Не указано'}`,
        `Занято: ${data.occupiedSpots ?? 0}`,
        `Широта: ${data.lat ?? 'Не указана'}`,
        `Долгота: ${data.lng ?? 'Не указана'}`,
        `Автор: ${author.firstName || author.username || 'Неизвестен'}`,
        `ID заявки: ${item.id}`
    ];
    alert(details.join('\n\n'));
}
// ============================================
// РЕДАКТИРОВАНИЕ ЗАЯВКИ МОДЕРАТОРОМ
// ============================================
async function editModerationRequest(item) {
    const data = item.proposedData || {};
    const name = prompt(
        'Название парковки:',
        data.name || ''
    );
    if (name === null) return;
    const city = prompt(
        'Город:',
        data.city || ''
    );
    if (city === null) return;
    const street = prompt(
        'Улица:',
        data.street || ''
    );
    if (street === null) return;
    const houseNumber = prompt(
        'Номер дома:',
        data.houseNumber || ''
    );
    if (houseNumber === null) return;
    const totalSpotsInput = prompt(
        'Общее количество парковочных мест:',
        String(data.totalSpots ?? 1)
    );
    if (totalSpotsInput === null) return;
    const totalSpots = Number(totalSpotsInput);
    if (
        !Number.isInteger(totalSpots) ||
        totalSpots < 1 ||
        totalSpots > 500
    ) {
        alert('Количество мест должно быть от 1 до 500.');
        return;
    }
    if (
        !name.trim() ||
        !city.trim() ||
        !street.trim()
    ) {
        alert('Название, город и улица обязательны.');
        return;
    }
    if (
        totalSpots < (Number(data.occupiedSpots) || 0)
    ) {
        alert(
            'Количество мест не может быть меньше количества занятых мест.'
        );
        return;
    }
    if (!confirm('Сохранить исправления заявки?')) {
        return;
    }
    const token = localStorage.getItem('parkNearSessionToken');
    if (!token || window.isOfflineSession) {
        alert('Необходима активная авторизация.');
        return;
    }
    try {
        const response = await fetch(
            `${window.PARKNEAR_API_URL}/api/moderation/${encodeURIComponent(item.id)}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name.trim(),
                    city: city.trim(),
                    street: street.trim(),
                    houseNumber: houseNumber.trim(),
                    totalSpots
                })
            }
        );
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(
                result.error || 'Не удалось сохранить изменения'
            );
        }
        alert('Исправления успешно сохранены.');
        await loadModerationQueue();
    } catch (error) {
        console.error(
            'Ошибка редактирования заявки:',
            error
        );
        alert(
            error.message || 'Ошибка сохранения изменений.'
        );
    }
}
// ============================================
// ОБРАБОТКА ЗАЯВКИ МОДЕРАТОРОМ
// ============================================
async function moderateParkingRequest(moderationId, action) {
    const token = localStorage.getItem('parkNearSessionToken');
    if (!token || window.isOfflineSession) {
        alert('Для этого действия необходима активная авторизация.');
        return;
    }
    let comment = '';
    if (action === 'reject') {
        comment = prompt('Укажи причину отклонения парковки:')?.trim() || '';
        if (!comment) {
            alert('Для отклонения необходимо указать причину.');
            return;
        }
    }
    const actionText = action === 'approve' ? 'одобрить' : 'отклонить';
    if (!confirm(`Вы действительно хотите ${actionText} эту заявку?`)) {
        return;
    }
    try {
        const response = await fetch(
            `${window.PARKNEAR_API_URL}/api/moderation/${encodeURIComponent(moderationId)}/${action}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ comment })
            }
        );
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Не удалось обработать заявку');
        }
        alert(result.message || 'Заявка обработана.');
        await loadModerationQueue();
    } catch (error) {
        console.error('Ошибка обработки заявки:', error);
        alert(error.message || 'Ошибка обработки заявки.');
    }
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
