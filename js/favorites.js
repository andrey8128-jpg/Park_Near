// ===================== ИЗБРАННОЕ =====================
// Добавление / удаление парковки из избранного
async function toggleFavorite(parkingId = currentParkingId, parkingData = currentParkingData) {
    if (!currentUser?.id || !parkingId) {
        console.error('Избранное: отсутствует пользователь или ID парковки');
        return;
    }
    const ref = getFavoriteRef(parkingId);
    if (!ref) return;
    try {
        const snap = await ref.once('value');
        if (snap.exists()) {
            // Парковка уже в избранном — удаляем
            await ref.remove();
            console.log('Парковка удалена из избранного:', parkingId);
        } else {
            // Добавляем парковку в избранное
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
            console.log('Парковка добавлена в избранное:', parkingId);
        }
        // Обновляем интерфейс после изменения
        await updateFavoriteCenterButton();
        await loadFavoritesInline(true);
        await refreshProfileFavoritesCount();
    } catch (err) {
        console.error('Ошибка работы с избранным:', err);
        alert('Не удалось изменить избранное');
    }
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
