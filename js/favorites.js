// ===================== ИЗБРАННОЕ =====================
function getFavoritesRef() {
    if (!currentUser?.id) return null;
    return database.ref(`users/${currentUser.id}/favorites`);
}
function getFavoriteRef(parkingId) {
    const ref = getFavoritesRef();
    return ref && parkingId ? ref.child(String(parkingId)) : null;
}
// Проверка: находится ли парковка в избранном
async function isFavorite(parkingId) {
    const ref = getFavoriteRef(parkingId);
    if (!ref) return false;
    try {
        const snap = await ref.once('value');
        return snap.exists();
    } catch (err) {
        console.error('Ошибка проверки избранного:', err);
        return false;
    }
}
// Обновление кнопки избранного в центральной карточке
async function updateFavoriteCenterButton() {
    const btn = document.querySelector('#centerSheetContent .parking-favorite-btn');
    if (!btn || !currentParkingId) return;
    const favorite = await isFavorite(currentParkingId);
    btn.innerHTML = favorite
        ? '<span>♥</span><span>Сохранено</span>'
        : '<span>♡</span><span>Сохранить</span>';
    btn.classList.toggle('is-favorite', favorite);
}
// Добавить / удалить парковку из избранного
async function toggleFavorite(parkingId, parkingData) {
    if (!currentUser?.id || !parkingId) {
        console.error('Избранное: отсутствует пользователь или parkingId');
        return;
    }
    const ref = getFavoriteRef(parkingId);
    if (!ref) return;
    try {
        const snap = await ref.once('value');
        if (snap.exists()) {
            await ref.remove();
            console.log('❤️ Парковка удалена из избранного:', parkingId);
        } else {
            const data = parkingData || parkingDataCache?.[parkingId] || {};
            const favoriteData = {
                parkingId: String(parkingId),
                name: data.name || 'Парковка',
                address: data.address || data.street || '',
                city: data.city || currentCity || '',
                lat: Number(data.lat ?? data.latitude ?? data.coords?.[0]) || null,
                lng: Number(data.lng ?? data.longitude ?? data.coords?.[1]) || null,
                totalSpots: Number(data.totalSpots) || 0,
                occupiedSpots: Number(data.occupiedSpots) || 0,
                savedAt: firebase.database.ServerValue.TIMESTAMP
            };
            await ref.set(favoriteData);
            console.log('❤️ Парковка добавлена в избранное:', parkingId);
        }
        await updateFavoriteCenterButton();
        await loadFavoritesInline(true);
        await refreshProfileFavoritesCount();
    } catch (err) {
        console.error('Ошибка работы с избранным:', err);
        alert('Не удалось изменить избранное');
    }
}
// Кнопка «Сохранить» в центральной карточке
async function toggleFavoriteCenter() {
    if (!currentParkingId || !currentParkingData) {
        console.error('Избранное: текущая парковка не определена');
        return;
    }
    await toggleFavorite(currentParkingId, currentParkingData);
}
// Загрузка списка избранного
async function loadFavoritesInline(force = false) {
    const container = document.getElementById('favoritesListContainer');
    if (!container || !currentUser?.id) return;
    if (!force && window._favoritesLoading) return;
    window._favoritesLoading = true;
    container.innerHTML =
        '<div style="text-align:center;color:var(--text-secondary);padding:20px;">Загрузка...</div>';
    try {
        const ref = getFavoritesRef();
        if (!ref) throw new Error('Не найден пользователь');
        const snap = await ref.once('value');
        const favorites = snap.val() || {};
        const entries = Object.entries(favorites);
        if (!entries.length) {
            container.innerHTML = `
                <div style="text-align:center;color:var(--text-secondary);padding:25px 15px;">
                    <div style="font-size:32px;margin-bottom:8px;">♡</div>
                    <div>Нет сохранённых парковок</div>
                </div>
            `;
            await refreshProfileFavoritesCount(0);
            return;
        }
        entries.sort((a, b) => {
            const timeA = Number(a[1]?.savedAt) || 0;
            const timeB = Number(b[1]?.savedAt) || 0;
            return timeB - timeA;
        });
        container.innerHTML = entries.map(([parkingId, data]) => {
            const name = escapeHtml(data?.name || 'Парковка');
            const address = escapeHtml(data?.address || data?.street || 'Адрес не указан');
            const total = Number(data?.totalSpots) || 0;
            const occupied = Number(data?.occupiedSpots) || 0;
            const free = Math.max(0, total - occupied);
            let status = 'Неизвестно';
            let statusClass = 'status-unknown';
            if (total > 0) {
                if (free <= 0) {
                    status = 'Занято';
                    statusClass = 'status-occupied';
                } else if (free <= Math.ceil(total * 0.3)) {
                    status = 'Мало мест';
                    statusClass = 'status-limited';
                } else {
                    status = 'Есть места';
                    statusClass = 'status-free';
                }
            }
            return `
                <div class="favorite-parking-item" data-parking-id="${escapeHtml(String(parkingId))}">
                    <div class="favorite-parking-info"
                         onclick="openFavoriteParking('${escapeHtml(String(parkingId))}')">
                        <div class="favorite-parking-title">${name}</div>
                        <div class="favorite-parking-address">${address}</div>
                        <div class="favorite-parking-status ${statusClass}">
                            <span class="favorite-status-dot"></span>
                            <span>${status}</span>
                            ${total > 0 ? `<span class="favorite-free-count">${free} свободно</span>` : ''}
                        </div>
                    </div>
                    <button class="favorite-remove-btn"
                            onclick="removeFromFavorites('${escapeHtml(String(parkingId))}')"
                            aria-label="Удалить из избранного">♥</button>
                </div>
            `;
        }).join('');
        await refreshProfileFavoritesCount(entries.length);
    } catch (err) {
        console.error('Ошибка загрузки избранного:', err);
        container.innerHTML = `
            <div style="text-align:center;color:var(--text-secondary);padding:20px;">
                Не удалось загрузить избранное
            </div>
        `;
    } finally {
        window._favoritesLoading = false;
    }
}
// Открытие парковки из списка избранного
async function openFavoriteParking(parkingId) {
    if (!parkingId) return;
    try {
        const ref = getFavoriteRef(parkingId);
        if (!ref) return;
        const snap = await ref.once('value');
        if (!snap.exists()) {
            await loadFavoritesInline(true);
            return;
        }
        const data = snap.val() || {};
        currentParkingId = parkingId;
        currentParkingData = data;
        if (data.lat != null && data.lng != null && map) {
            map.setCenter([Number(data.lat), Number(data.lng)], 17, {
                duration: 300
            });
        }
        if (typeof openCenterSheet === 'function') {
            openCenterSheet(parkingId, data);
        }
    } catch (err) {
        console.error('Ошибка открытия избранной парковки:', err);
    }
}
// Удаление из избранного
async function removeFromFavorites(parkingId) {
    if (!currentUser?.id || !parkingId) return;
    const ref = getFavoriteRef(parkingId);
    if (!ref) return;
    try {
        await ref.remove();
        console.log('❤️ Парковка удалена из избранного:', parkingId);
        if (currentParkingId === parkingId) {
            await updateFavoriteCenterButton();
        }
        await loadFavoritesInline(true);
        await refreshProfileFavoritesCount();
    } catch (err) {
        console.error('Ошибка удаления из избранного:', err);
        alert('Не удалось удалить парковку');
    }
}
// Реальное количество избранных парковок
async function getFavoritesCount() {
    const ref = getFavoritesRef();
    if (!ref) return 0;
    try {
        const snap = await ref.once('value');
        const favorites = snap.val() || {};
        return Object.keys(favorites).length;
    } catch (err) {
        console.error('Ошибка получения количества избранного:', err);
        return 0;
    }
}
// Обновление счётчика в профиле
async function refreshProfileFavoritesCount(count = null) {
    if (count === null) {
        count = await getFavoritesCount();
    }
    document.querySelectorAll('.pn-profile-row').forEach(row => {
        const title = row.querySelector('strong');
        const countElement = row.querySelector('small');
        if (!title || !countElement) return;
        if (title.textContent.trim() !== 'Избранные парковки') return;
        countElement.textContent =
            `${count} ${count === 1 ? 'парковка' : 'парковок'}`;
    });
    return count;
}
function renderFavorites(content) {
    if (!content) return;
    if (!currentUser) {
        content.innerHTML = `
            <div class="pn-fav-empty">
                <div class="pn-fav-empty-icon">🔒</div>
                <h3>Войдите в аккаунт</h3>
                <p>После входа здесь будут сохранённые парковки.</p>
            </div>`;
        return;
    }

    content.innerHTML = `
        <div class="pn-favorites">
            <div class="pn-fav-header">
                <div>
                    <h2>Избранное</h2>
                    <p id="pnFavSubtitle">Загрузка сохранённых парковок...</p>
                </div>
                <div class="pn-fav-header-icon">♥</div>
            </div>

            <div class="pn-fav-city" id="pnFavCity">
                <span class="pn-fav-city-icon">📍</span>
                <div>
                    <small>Выбранный город</small>
                    <strong>${escapeHtml(userCityPrefs?.city || currentCity || 'Все города')}</strong>
                </div>
            </div>
<div id="pnFavoritesTabContent"></div>
<div id="pnAddressesTabContent" style="display:none;"></div>
            <div class="pn-fav-search">
                <span>⌕</span>
                <input id="pnFavSearch" type="search" placeholder="Поиск парковки или адреса..." autocomplete="off">
                <button id="pnFavClearSearch" type="button">×</button>
            </div>

            <div class="pn-fav-filters">
                <button class="pn-fav-filter active" data-sort="recent">Недавние</button>
                <button class="pn-fav-filter" data-sort="free">Свободные</button>
                <button class="pn-fav-filter" data-sort="distance">Ближайшие</button>
            </div>

            <div id="pnFavList" class="pn-fav-list">
                <div class="pn-fav-loading">
                    <div class="pn-fav-spinner"></div>
                    <span>Загрузка...</span>
                </div>
            </div>
        </div>
    `;

    const list = document.getElementById('pnFavList');
    const searchInput = document.getElementById('pnFavSearch');
    const clearSearch = document.getElementById('pnFavClearSearch');
    const subtitle = document.getElementById('pnFavSubtitle');
    const cityEl = document.getElementById('pnFavCity');
    const filterButtons = document.querySelectorAll('.pn-fav-filter');

    let favorites = [];
    let currentSort = 'recent';
    let searchValue = '';
