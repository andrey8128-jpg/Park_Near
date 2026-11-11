
// ===================== ИЗБРАННОЕ: POSTGRESQL =====================

async function favoritesRequest(path = '', method = 'GET') {
    const token = localStorage.getItem('parkNearSessionToken');

    if (!token) {
        throw new Error('Необходимо войти в аккаунт');
    }

    const response = await fetch(
        `${window.PARKNEAR_API_URL}/api/users/me/favorites${path}`,
        {
            method,
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
            result.error || `Ошибка избранного: HTTP ${response.status}`
        );
    }

    return result;
}

async function isFavorite(parkingId) {
    if (!currentUser?.id || !parkingId) return false;

    try {
        const result = await favoritesRequest(
            `/${encodeURIComponent(parkingId)}`
        );

        return Boolean(result.favorite);
    } catch (error) {
        console.error('Ошибка проверки избранного:', error);
        return false;
    }
}

async function updateFavoriteCenterButton() {
    const btn = document.querySelector(
        '#centerSheetContent .parking-favorite-btn'
    );

    if (!btn || !currentParkingId) return;

    const favorite = await isFavorite(currentParkingId);

    btn.innerHTML = favorite
        ? '<span>♥</span><span>Сохранено</span>'
        : '<span>♡</span><span>Сохранить</span>';

    btn.classList.toggle('is-favorite', favorite);
}

async function toggleFavorite(parkingId, parkingData) {
    if (!currentUser?.id || !parkingId) {
        showToast('Необходимо войти в аккаунт');
        return;
    }

    try {
        const favorite = await isFavorite(parkingId);

        if (favorite) {
            await favoritesRequest(
                `/${encodeURIComponent(parkingId)}`,
                'DELETE'
            );
        } else {
            await favoritesRequest(
                `/${encodeURIComponent(parkingId)}`,
                'POST'
            );
        }

        await updateFavoriteCenterButton();
        await loadFavoritesInline(true);
        await refreshProfileFavoritesCount();

        showToast(
            favorite
                ? 'Удалено из избранного'
                : 'Добавлено в избранное'
        );

    } catch (error) {
        console.error('Ошибка изменения избранного:', error);
        alert(error.message || 'Не удалось изменить избранное');
    }
}

async function toggleFavoriteCenter() {
    if (!currentParkingId || !currentParkingData) return;

    await toggleFavorite(
        currentParkingId,
        currentParkingData
    );
}

async function loadFavoritesInline(force = false) {
    const container = document.getElementById(
        'favoritesListContainer'
    );

    if (!container || !currentUser?.id) return;

    if (!force && window._favoritesLoading) return;

    window._favoritesLoading = true;

    container.innerHTML =
        '<div style="text-align:center;padding:20px;color:var(--text-secondary);">Загрузка...</div>';

    try {
        const result = await favoritesRequest();

        const favorites = result.favorites || [];

        if (!favorites.length) {
            container.innerHTML =
                '<div style="text-align:center;padding:25px;color:var(--text-secondary);"><div style="font-size:32px;">♡</div><div>Нет сохранённых парковок</div></div>';

            await refreshProfileFavoritesCount(0);
            return;
        }

        container.innerHTML = favorites.map(item => {
            const data = item.parking || {};
            const id = String(item.parkingId);

            const total = Number(data.totalSpots) || 0;
            const occupied = Number(data.occupiedSpots) || 0;
            const free = Math.max(0, total - occupied);

            let status = 'Неизвестно';
            let cls = 'status-unknown';

            if (total > 0) {
                if (free <= 0) {
                    status = 'Занято';
                    cls = 'status-occupied';
                } else if (free <= Math.ceil(total * 0.3)) {
                    status = 'Мало мест';
                    cls = 'status-limited';
                } else {
                    status = 'Есть места';
                    cls = 'status-free';
                }
            }

            return `
                <div class="favorite-parking-item"
                     data-parking-id="${escapeHtml(id)}">
                    <div class="favorite-parking-info"
                         onclick="openFavoriteParking('${escapeHtml(id)}')">
                        <div class="favorite-parking-title">
                            ${escapeHtml(data.name || 'Парковка')}
                        </div>
                        <div class="favorite-parking-address">
                            ${escapeHtml(data.address || data.street || '')}
                        </div>
                        <div class="favorite-parking-status ${cls}">
                            <span class="favorite-status-dot"></span>
                            <span>${status}</span>
                            ${total > 0
                                ? `<span class="favorite-free-count">${free} свободно</span>`
                                : ''}
                        </div>
                    </div>
                    <button class="favorite-remove-btn"
                            onclick="removeFromFavorites('${escapeHtml(id)}')">♥</button>
                </div>
            `;
        }).join('');

        await refreshProfileFavoritesCount(favorites.length);

    } catch (error) {
        console.error('Ошибка загрузки избранного:', error);

        container.innerHTML =
            '<div style="text-align:center;padding:20px;color:var(--text-secondary);">Не удалось загрузить избранное</div>';

    } finally {
        window._favoritesLoading = false;
    }
}
async function openFavoriteParking(parkingId) {
    if (!parkingId) return;
    try {
        let data = parkingDataCache?.[parkingId];
        if (!data) {
            const response = await fetch(
                `${window.PARKNEAR_API_URL}/api/parkings/${encodeURIComponent(parkingId)}`,
                { cache: 'no-store' }
            );
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(
                    result.error || 'Парковка не найдена'
                );
            }
            data = result.parking;
        }
        if (!data) return;
        currentParkingId = parkingId;
        currentParkingData = data;
        if (data.lat != null && data.lng != null && map) {
            map.setCenter(
                [Number(data.lat), Number(data.lng)],
                17,
                { duration: 300 }
            );
        }
        if (typeof openCenterSheet === 'function') {
            openCenterSheet(parkingId, data);
        }
    } catch (error) {
        console.error('Ошибка открытия избранной парковки:', error);
        showToast(error.message || 'Не удалось открыть парковку');
    }
}
async function removeFromFavorites(parkingId) {
    if (!currentUser?.id || !parkingId) return;
    try {
        await favoritesRequest(
            `/${encodeURIComponent(parkingId)}`,
            'DELETE'
        );
        if (currentParkingId === parkingId) {
            await updateFavoriteCenterButton();
        }
        await loadFavoritesInline(true);
        await refreshProfileFavoritesCount();
        showToast('Удалено из избранного');
    } catch (error) {
        console.error('Ошибка удаления избранного:', error);
        alert(error.message || 'Не удалось удалить парковку');
    }
}
async function getFavoritesCount() {
    if (!currentUser?.id) return 0;
    try {
        const result = await favoritesRequest();
        return Number(result.count) || 0;
    } catch (error) {
        console.error('Ошибка подсчёта избранного:', error);
        return 0;
    }
}
async function refreshProfileFavoritesCount(count = null) {
    if (count === null) {
        count = await getFavoritesCount();
    }
    document.querySelectorAll('.pn-profile-row').forEach(row => {
        const title = row.querySelector('strong');
        const counter = row.querySelector('small');
        if (
            title?.textContent.trim() === 'Избранные парковки' &&
            counter
        ) {
            counter.textContent =
                `${count} ${count === 1 ? 'парковка' : 'парковок'}`;
        }
    });
    return count;
}
// Главная функция рендера (без вложенных дублей!)
function renderFavorites(content) {
    if (!content) return;
    if (!currentUser) {
        content.innerHTML = '<div class="pn-fav-empty"><div class="pn-fav-empty-icon">🔒</div><h3>Войдите в аккаунт</h3><p>После входа здесь будут сохранённые парковки.</p></div>';
        return;
    }
    content.innerHTML = `
        <div class="pn-favorites">
            <div class="pn-fav-header"><div><h2>Избранное</h2><p id="pnFavSubtitle">Загрузка...</p></div><div class="pn-fav-header-icon">♥</div></div>
            <div class="pn-fav-search"><span>⌕</span><input id="pnFavSearch" type="search" placeholder="Поиск парковки..." autocomplete="off"><button id="pnFavClearSearch" type="button">×</button></div>
            <div class="pn-fav-filters">
                <button class="pn-fav-filter active" data-sort="recent">Недавние</button>
                <button class="pn-fav-filter" data-sort="free">Свободные</button>
                <button class="pn-fav-filter" data-sort="distance">Ближайшие</button>
            </div>
            <div id="pnFavList" class="pn-fav-list"><div class="pn-fav-loading"><div class="pn-fav-spinner"></div><span>Загрузка...</span></div></div>
        </div>`;
    const list = document.getElementById('pnFavList');
    const searchInput = document.getElementById('pnFavSearch');
    const clearSearch = document.getElementById('pnFavClearSearch');
    const subtitle = document.getElementById('pnFavSubtitle');
    const filterButtons = document.querySelectorAll('.pn-fav-filter');
    let favorites = [], currentSort = 'recent', searchValue = '';
    const city = userCityPrefs?.city || currentCity || '';
    // Вспомогательные функции избранного
function getFree(parking) {
    const total = Number(parking?.totalSpots) || 0;
    const occupied = Number(parking?.occupiedSpots) || 0;
        return Math.max(0, total - occupied);
}
function getDistance(parking) {
    const location =
        typeof lastKnownLocation !== 'undefined'
            ? lastKnownLocation
            : null;
    if (
        !location ||
        parking?.lat == null ||
        parking?.lng == null ||
        typeof getDistanceInMeters !== 'function'
    ) {
        return Infinity;
    }
    return getDistanceInMeters(
        location.lat,
        location.lng,
        Number(parking.lat),
        Number(parking.lng)
    );
}
function getOccupancyClass(parking) {
        const total = Number(parking?.totalSpots) || 0;
    if (!total) return 'unknown';
        const free = getFree(parking);
        const ratio = free / total;
    if (ratio <= 0.2) return 'critical';
    if (ratio <= 0.5) return 'low';

    return 'good';
}
function getOccupancyText(parking) {
    const total = Number(parking?.totalSpots) || 0;

    if (!total) return 'Мест нет в данных';

    return `${getFree(parking)} свободно из ${total}`;
}
function formatDistance(distance) {
    if (!Number.isFinite(distance)) return '';
    return distance < 1000
        ? `${Math.round(distance)} м`
        : `${(distance / 1000).toFixed(1)} км`;
}
function renderList() {
        if (!list) return;
        const query = searchValue.toLowerCase();
        let filtered = favorites.filter(item => {
            const p = item.parking || item;
            if (city) {
                const pc = String(p.city || item.city || '').toLowerCase();
                if (pc && pc !== city.toLowerCase()) return false;
            }
            if (!query) return true;
            return [p.name, p.address, p.street, p.city].some(v => String(v || '').toLowerCase().includes(query));
        });
        filtered.sort((a, b) => {
            const pa = a.parking || a, pb = b.parking || b;
            if (currentSort === 'free') return getFree(pb) - getFree(pa);
            if (currentSort === 'distance') return getDistance(pa) - getDistance(pb);
            return Number(b.savedAt || 0) - Number(a.savedAt || 0);
        });
        if (subtitle) subtitle.textContent = `${filtered.length} ${filtered.length === 1 ? 'парковка' : filtered.length < 5 ? 'парковки' : 'парковок'}`;
        if (!filtered.length) {
            list.innerHTML = `<div class="pn-fav-empty"><div class="pn-fav-empty-icon">${query ? '🔎' : '♡'}</div><h3>${query ? 'Ничего не найдено' : 'Избранное пусто'}</h3><p>${query ? 'Попробуйте изменить запрос.' : 'Добавляйте парковки в избранное.'}</p>${!query ? '<button type="button" id="pnFavShowMap">Найти парковку</button>' : ''}</div>`;
            list.querySelector('#pnFavShowMap')?.addEventListener('click', showMap);
            return;
        }
        list.innerHTML = filtered.map(item => {
            const p = item.parking || item;
            const id = item.parkingId || p.id;
            const dist = getDistance(p);
            return `<article class="pn-fav-card" data-parking-id="${escapeHtml(String(id))}">
                <button class="pn-fav-card-main" type="button">
                    <div class="pn-fav-card-icon">🅿️</div>
                    <div class="pn-fav-card-info">
                        <div class="pn-fav-card-title">${escapeHtml(p.name || 'Без названия')}</div>
                        ${p.address ? `<div class="pn-fav-card-address">${escapeHtml(p.address)}</div>` : ''}
                        <div class="pn-fav-card-meta">
                            <span class="pn-fav-occupancy ${getOccupancyClass(p)}"><i></i>${escapeHtml(getOccupancyText(p))}</span>
                            ${Number.isFinite(dist) ? `<span>${formatDistance(dist)}</span>` : ''}
                        </div>
                    </div>
                    <span class="pn-fav-card-arrow">›</span>
                </button>
                <button class="pn-fav-remove" data-remove-id="${escapeHtml(String(id))}">♥</button>
            </article>`;
        }).join('');
        list.querySelectorAll('.pn-fav-card-main').forEach(b => b.addEventListener('click', function () {
            const id = this.closest('.pn-fav-card')?.dataset?.parkingId;
            if (id) highlightAndShowParking(id);
        }));
        list.querySelectorAll('.pn-fav-remove').forEach(b => b.addEventListener('click', function (e) {
            e.stopPropagation();
            if (this.dataset.removeId) removeFromFavorites(this.dataset.removeId);
        }));
    }
    searchInput?.addEventListener('input', function () {
        searchValue = this.value.trim();
        if (clearSearch) clearSearch.hidden = !searchValue;
        renderList();
    });
    clearSearch?.addEventListener('click', () => {
        searchInput.value = ''; searchValue = ''; clearSearch.hidden = true; renderList(); searchInput.focus();
    });
    filterButtons.forEach(b => b.addEventListener('click', function () {
        filterButtons.forEach(x => x.classList.remove('active'));
        this.classList.add('active');
        currentSort = this.dataset.sort || 'recent';
        renderList();
    }));
    Promise.all([
        database.ref(`users/${currentUser.id}/favorites`).once('value'),
        database.ref('parkings').once('value')
    ]).then(([favSnap, parkSnap]) => {
        if (!content.isConnected || !content.querySelector('#pnFavList')) return;
        const favData = favSnap.val() || {};
        const parkRaw = parkSnap.val() || {};
        const flat = {};
        Object.keys(parkRaw).forEach(k => {
            const v = parkRaw[k];
            if (!v) return;
            if (v.lat != null) flat[k] = v;
            else if (typeof v === 'object') Object.keys(v).forEach(sk => { if (v[sk]?.lat != null) flat[sk] = v[sk]; });
        });
        favorites = Object.values(favData).filter(i => i?.parkingId).map(i => ({ ...i, parking: flat[i.parkingId] ? { ...flat[i.parkingId], id: i.parkingId } : { ...i, id: i.parkingId } }));
        renderList();
    }).catch(err => {
        console.error(err);
        if (list) list.innerHTML = '<div class="pn-fav-empty"><div class="pn-fav-empty-icon">⚠️</div><h3>Ошибка</h3><button id="pnFavRetry">Повторить</button></div>';
        list?.querySelector('#pnFavRetry')?.addEventListener('click', () => renderFavorites(content));
    });
}
