// ===================== ИЗБРАННОЕ =====================
function getFavoritesRef() {
    if (!currentUser?.id) return null;
    return database.ref(`users/${currentUser.id}/favorites`);
}
function getFavoriteRef(parkingId) {
    const ref = getFavoritesRef();
    return ref && parkingId ? ref.child(String(parkingId)) : null;
}
async function isFavorite(parkingId) {
    const ref = getFavoriteRef(parkingId);
    if (!ref) return false;
    try { return (await ref.once('value')).exists(); } catch { return false; }
}
async function updateFavoriteCenterButton() {
    const btn = document.querySelector('#centerSheetContent .parking-favorite-btn');
    if (!btn || !currentParkingId) return;
    const favorite = await isFavorite(currentParkingId);
    btn.innerHTML = favorite ? '<span>♥</span><span>Сохранено</span>' : '<span>♡</span><span>Сохранить</span>';
    btn.classList.toggle('is-favorite', favorite);
}
async function toggleFavorite(parkingId, parkingData) {
    if (!currentUser?.id || !parkingId) return;
    const ref = getFavoriteRef(parkingId);
    if (!ref) return;
    try {
        const snap = await ref.once('value');
        if (snap.exists()) await ref.remove();
        else {
            const data = parkingData || parkingDataCache?.[parkingId] || {};
            await ref.set({
                parkingId: String(parkingId),
                name: data.name || 'Парковка',
                address: data.address || data.street || '',
                city: data.city || currentCity || '',
                lat: Number(data.lat) || null,
                lng: Number(data.lng) || null,
                totalSpots: Number(data.totalSpots) || 0,
                occupiedSpots: Number(data.occupiedSpots) || 0,
                savedAt: firebase.database.ServerValue.TIMESTAMP
            });
        }
        await updateFavoriteCenterButton();
        await loadFavoritesInline(true);
        await refreshProfileFavoritesCount();
    } catch (err) { console.error(err); alert('Не удалось изменить избранное'); }
}
async function toggleFavoriteCenter() {
    if (!currentParkingId || !currentParkingData) return;
    await toggleFavorite(currentParkingId, currentParkingData);
}
async function loadFavoritesInline(force = false) {
    const container = document.getElementById('favoritesListContainer');
    if (!container || !currentUser?.id) return;
    if (!force && window._favoritesLoading) return;
    window._favoritesLoading = true;
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-secondary);">Загрузка...</div>';
    try {
        const ref = getFavoritesRef();
        if (!ref) throw new Error('Нет пользователя');
        const snap = await ref.once('value');
        const favorites = snap.val() || {};
        const entries = Object.entries(favorites).sort((a, b) => (b[1]?.savedAt || 0) - (a[1]?.savedAt || 0));
        if (!entries.length) {
            container.innerHTML = '<div style="text-align:center;padding:25px;color:var(--text-secondary);"><div style="font-size:32px;">♡</div><div>Нет сохранённых парковок</div></div>';
            await refreshProfileFavoritesCount(0);
            return;
        }
        container.innerHTML = entries.map(([id, data]) => {
            const total = Number(data?.totalSpots) || 0;
            const free = Math.max(0, total - (Number(data?.occupiedSpots) || 0));
            let status = 'Неизвестно', cls = 'status-unknown';
            if (total > 0) {
                if (free <= 0) { status = 'Занято'; cls = 'status-occupied'; }
                else if (free <= Math.ceil(total * 0.3)) { status = 'Мало мест'; cls = 'status-limited'; }
                else { status = 'Есть места'; cls = 'status-free'; }
            }
            return `<div class="favorite-parking-item" data-parking-id="${escapeHtml(String(id))}">
                <div class="favorite-parking-info" onclick="openFavoriteParking('${escapeHtml(String(id))}')">
                    <div class="favorite-parking-title">${escapeHtml(data?.name || 'Парковка')}</div>
                    <div class="favorite-parking-address">${escapeHtml(data?.address || data?.street || '')}</div>
                    <div class="favorite-parking-status ${cls}"><span class="favorite-status-dot"></span><span>${status}</span>${total > 0 ? `<span class="favorite-free-count">${free} свободно</span>` : ''}</div>
                </div>
                <button class="favorite-remove-btn" onclick="removeFromFavorites('${escapeHtml(String(id))}')">♥</button>
            </div>`;
        }).join('');
        await refreshProfileFavoritesCount(entries.length);
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-secondary);">Не удалось загрузить</div>';
    } finally { window._favoritesLoading = false; }
}
async function openFavoriteParking(parkingId) {
    if (!parkingId) return;
    try {
        const data = parkingDataCache[parkingId] || (await getFavoriteRef(parkingId)?.once('value'))?.val();
        if (!data) return;
        currentParkingId = parkingId;
        currentParkingData = data;
        if (data.lat != null && data.lng != null && map) map.setCenter([Number(data.lat), Number(data.lng)], 17, { duration: 300 });
        if (typeof openCenterSheet === 'function') openCenterSheet(parkingId, data);
    } catch (err) { console.error(err); }
}
async function removeFromFavorites(parkingId) {
    if (!currentUser?.id || !parkingId) return;
    try {
        await getFavoriteRef(parkingId)?.remove();
        if (currentParkingId === parkingId) await updateFavoriteCenterButton();
        await loadFavoritesInline(true);
        await refreshProfileFavoritesCount();
    } catch (err) { alert('Не удалось удалить'); }
}
async function getFavoritesCount() {
    const ref = getFavoritesRef();
    if (!ref) return 0;
    try { return Object.keys((await ref.once('value')).val() || {}).length; } catch { return 0; }
}
async function refreshProfileFavoritesCount(count = null) {
    if (count === null) count = await getFavoritesCount();
    document.querySelectorAll('.pn-profile-row').forEach(row => {
        const t = row.querySelector('strong'), c = row.querySelector('small');
        if (t?.textContent.trim() === 'Избранные парковки' && c) c.textContent = `${count} ${count === 1 ? 'парковка' : 'парковок'}`;
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
