// ===================== ИЗБРАННОЕ =====================
    function loadUserData(type, content) {
        if (!currentUser) {
            if (content) {
                content.innerHTML = '<div class="empty-state"><div class="icon">🔒</div><p>Войдите</p></div>';
            }
            return;
        }
        database.ref(`users/${currentUser.id}/stats`).once('value').then(snapshot => {
            if (!snapshot.exists()) {
                const initialStats = {
                    registeredAt: Date.now(),
                    lastActive: Date.now(),
                    parkingsCreated: 0,
                    parkingsUpdated: 0,
                    confirmations: 0,
                    views: 0,
                    favorites: 0,
                    activeDates: [new Date().toISOString().split('T')[0]]
                };
                database.ref(`users/${currentUser.id}/stats`).set(initialStats);
            } else {
                const stats = snapshot.val();
                const today = new Date().toISOString().split('T')[0];
                let activeDates = stats.activeDates || [];
                if (!activeDates.includes(today)) activeDates.push(today);
                database.ref(`users/${currentUser.id}/stats`).update({
                    lastActive: Date.now(),
                    activeDates: activeDates
                });
            }
        });
        database.ref(`users/${currentUser.id}/cityPreferences`).once('value').then(snap => {
            if (snap.exists()) {
                userCityPrefs = snap.val();
                if (typeof updateCityDisplay === 'function') {
                    updateCityDisplay();
                }
            }
        });
        if (type === 'favorites' && content) {
            Promise.all([
                database.ref(`users/${currentUser.id}/favorites`).once('value'),
                database.ref(`users/${currentUser.id}/homeAddresses`).once('value')
            ]).then(([favSnap, homeSnap]) => {
                let html = '';
                const addrs = homeSnap.val() || {};
                const addrEntries = Object.entries(addrs);
                html += `<div class="fav-section-title" style="display:flex; justify-content:space-between; align-items:center;">
                <span>🏠 Мои адреса</span>
                <button class="add-address-btn" onclick="addHomeAddress()" title="Добавить адрес">+</button>
            </div>`;
                html += `<div class="addresses-list">`;
                addrEntries.forEach(([id, addr]) => {
                    const label = addr.label || 'Адрес';
                    let icon = '📍';
                    if (label === 'Дом') icon = '🏠';
                    else if (label === 'Работа') icon = '💼';
                    else if (label === 'Родственники') icon = '👨‍👩‍👧‍👦';
                    const addressText = addr.city && addr.street && addr.houseNumber ?
                        `${addr.city}, ${addr.street}, ${addr.houseNumber}` :
                        (addr.address || 'Без адреса');
                    html += `
                <div class="swipe-container" style="border-radius:14px; margin-bottom:6px;">
                    <div class="swipe-item" onclick="centerMapOnAddress(${addr.lat || 'null'}, ${addr.lng || 'null'})" style="display:flex; align-items:center; gap:12px; padding:12px 16px;">
                        <span style="font-size:20px;">${icon}</span>
                        <div class="fav-item-info">
                            <div class="fav-item-name">${label}</div>
                            <div class="fav-item-meta">${addressText}</div>
                        </div>
                        <button class="settings-edit-btn" onclick="event.stopPropagation(); openAddressEditor('${id}')" title="Редактировать адрес" style="flex-shrink:0; margin-left:auto;">✏️</button>
                    </div>
                    <div class="swipe-delete" onclick="event.stopPropagation(); removeHomeAddress('${id}')">Удалить</div>
                </div>`;
                });
                if (addrEntries.length === 0) {
                    html += `<div class="address-tile" onclick="addHomeAddress()" style="opacity:0.5; padding:20px; text-align:center;">
                        <div class="address-tile-icon">➕</div>
                        <div class="address-tile-label">Добавить</div>
                    </div>`;
                }
                html += `</div>`;
                const favs = favSnap.val();
                html += `<div class="fav-section-title">⭐ Избранные парковки</div>`;

                if (!favs) {
                    html += '<div class="empty-state"><p>Нет избранных парковок</p></div>';
                } else {
                    html += `<div class="fav-search">
                    <input type="text" id="favSearchInput" placeholder="Поиск по избранному..." oninput="filterFavorites()">
                </div>`;
                    html += '<div id="favListContainer">';
                    Object.values(favs).forEach(item => {
                        if (!item || !item.parkingId) return;
                        html += `<div class="fav-item" data-name="${item.name||''}" data-address="${item.address||''}" onclick="highlightAndShowParking('${item.parkingId}')">
                        <div class="fav-item-info">
                            <div class="fav-item-name">${item.name || 'Без названия'}</div>
                            <div class="fav-item-meta">
                                <span>${item.address || ''}</span>
                            </div>
                        </div>
                        <div class="fav-item-right">
                            <span class="occupancy-dot" style="background: var(--accent);"></span>
                            <button class="settings-edit-btn" onclick="event.stopPropagation(); removeFromFavorites('${item.parkingId}')" title="Удалить из избранного">✕</button>
                        </div>
                    </div>`;
                    });
                    html += '</div>';
                }

                content.innerHTML = html;
                attachSwipeToContainers(content);
            });
        }
    }
    function removeFromFavorites(parkingId) {
        if (!currentUser || !parkingId) return;
        const favRef = database.ref(`users/${currentUser.id}/favorites/${parkingId}`);
        favRef.remove().then(() => {
            const content = document.getElementById('panelContent');
            if (content && document.getElementById('panel').classList.contains('active')) {
                loadUserData('favorites', content);
            }
        }).catch(err => console.error('Ошибка удаления из избранного:', err));
    }
