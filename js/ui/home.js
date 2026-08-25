
   function renderHomePanel(content) {
    const cached = localStorage.getItem('parkingCache');
    let cacheData = null;
    if (cached) {
        try {
            const cache = JSON.parse(cached);
            // ✅ Проверяем, что кеш соответствует текущему городу
            if (cache && cache.city === currentCity && cache.data) {
                cacheData = cache.data;
                parkingDataCache = cacheData;
                renderHomeContent(content, null);
                const list = document.getElementById('homeParkingList');
                if (list) {
                    list.insertAdjacentHTML('beforeend', '<div class="loading-indicator" style="text-align:center; color:var(--text-secondary); font-size:13px; margin-top:8px;">🔄 Обновление данных...</div>');
                }
            } else {
                // Если город не совпадает – удаляем устаревший кеш
                localStorage.removeItem('parkingCache');
                console.log('🗑️ Удалён устаревший кеш парковок');
            }
        } catch (e) {
            localStorage.removeItem('parkingCache');
        }
    }

    if (!cacheData) {
        content.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Загрузка парковок...</p></div>';
    }

    const needRefresh = (Date.now() - lastDataRefresh > REFRESH_INTERVAL_MS) || !cacheData;
    if (needRefresh) {
        // ✅ Передаём текущий город
        Promise.all([
            loadAllParkings(currentCity, true),
            getUserLocation().catch(() => null)
        ]).then(([, coords]) => {
            userLocationForSearch = coords;
            renderHomeContent(content, coords);
            const indicator = document.querySelector('.loading-indicator');
            if (indicator) indicator.remove();
            console.log('🏠 На главной загружено парковок:', Object.keys(parkingDataCache).length);
        }).catch((err) => {
            console.error('Ошибка загрузки парковок:', err);
            const indicator = document.querySelector('.loading-indicator');
            if (indicator) indicator.textContent = '⚠️ Не удалось обновить данные';
            setTimeout(() => { if (indicator) indicator.remove(); }, 3000);
            renderHomeContent(content, null);
        });
    } else {
        getUserLocation()
            .then(coords => {
                userLocationForSearch = coords;
                renderHomeContent(content, coords);
            })
            .catch(() => {
                renderHomeContent(content, null);
            });
    }
}
function renderHomeContent(content, coords) {
    var html = `
        <div class="home-header">
            <div class="home-title">Парковка без забот</div>
            <div class="home-subtitle">найдите свободное место рядом с домом</div>
        </div>
        <div class="home-search">
            <input type="text" id="homeSearchInput" placeholder="куда вы направляетесь?" oninput="filterHomeParkings()">
        </div>
        <div class="home-actions">
            <button class="btn-home btn-home-primary" onclick="goHome()">🏠 Еду домой</button>
            <button class="btn-home btn-home-secondary" onclick="searchNearMe()">📍 Рядом со мной</button>
        </div>
        <div class="section-header">
            <span>Рядом с вами</span>
            <button class="see-all" onclick="showAllNearby()">См. все</button>
        </div>
        <div id="homeParkingList" class="parking-list">
            <div class="loading-state"><div class="spinner"></div><p>Загрузка...</p></div>
        </div>
    `;
    content.innerHTML = html;

    // Получаем список парковок из кеша
    var allParkings = Object.values(parkingDataCache).filter(function(p) { return p.lat && p.lng; });
    console.log('📊 Всего парковок в кеше:', allParkings.length);
    // Если данных нет – показываем сообщение
    if (allParkings.length === 0) {
        var container = document.getElementById('homeParkingList');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>😕 Нет парковок в городе <strong>${currentCity || 'не выбран'}</strong></p>
                    <p style="font-size:13px; margin-top:8px; color:var(--text-secondary);">
                        Попробуйте изменить город в настройках профиля
                    </p>
                </div>
            `;
        }
        return;
    }

    // Если координаты есть – показываем ближайшие
    if (coords) {
        showNearbyParkings(coords, 5);
    } else {
        // Иначе показываем все (без сортировки по расстоянию)
        var container = document.getElementById('homeParkingList');
        if (container) {
            renderParkingList(container, allParkings);
        }
    }
}
function showNearbyParkings(coords, limit) {
    const container = document.getElementById('homeParkingList');
    if (!container) return;
    const radius = 1000;
    const parkings = Object.entries(parkingDataCache)
        .map(([id, data]) => ({ id, ...data, distance: getDistanceInMeters(coords.lat, coords.lng, data.lat, data.lng) }))
        .filter(p => p.lat && p.lng && p.distance <= radius)
        .sort((a,b) => a.distance - b.distance);

    if (parkings.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Нет парковок поблизости</p></div>';
        return;
    }
    const show = parkings.slice(0, limit);
    container.innerHTML = show.map(p => renderParkingItem(p, coords)).join('');
}
function showAllNearby() {
    var coords = userLocationForSearch;
    if (!coords) {
        alert('Геолокация не определена');
        return;
    }
    var container = document.getElementById('homeParkingList');
    if (container) {
        showNearbyParkings(coords, 9999);
        var seeAll = document.querySelector('.section-header .see-all');
        if (seeAll) {
            seeAll.textContent = 'Скрыть';
            seeAll.onclick = function() {
                showNearbyParkings(coords, 5);
                this.textContent = 'См. все →';
                this.onclick = showAllNearby;
            };
        }
    }
}
function filterHomeParkings() {
    const query = document.getElementById('homeSearchInput').value.trim().toLowerCase();
    const container = document.getElementById('homeParkingList');
    if (!container) return;
    if (!query) {
        if (userLocationForSearch) {
            showNearbyParkings(userLocationForSearch, 5);
        } else {
            const all = Object.values(parkingDataCache).filter(p => p.lat && p.lng);
            renderParkingList(container, all);
        }
        return;
    }
    const filtered = Object.entries(parkingDataCache)
        .map(([id, data]) => ({ id, ...data }))
        .filter(p => {
            const name = (p.name || '').toLowerCase();
            const addr = (p.address || '').toLowerCase();
            return name.includes(query) || addr.includes(query);
        });
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Ничего не найдено</p></div>';
        return;
    }
    container.innerHTML = filtered.map(p => renderParkingItem(p, userLocationForSearch)).join('');
}
function goHome() {
    if (!currentUser) {
        alert('Войдите, чтобы использовать домашний адрес');
        return;
    }
    database.ref('users/' + currentUser.id + '/homeAddresses').once('value')
        .then(function(snap) {
            var addrs = snap.val() || {};
            var home = null;
            for (var key in addrs) {
                if (addrs.hasOwnProperty(key) && addrs[key].label === 'Дом') {
                    home = addrs[key];
                    break;
                }
            }
            if (!home) {
                alert('Домашний адрес не найден. Добавьте его в избранном.');
                return;
            }
            if (home.lat && home.lng) {
                map.setCenter([home.lat, home.lng], 16, { duration: 500 });
                var coords = { lat: home.lat, lng: home.lng };
                userLocationForSearch = coords;
                var container = document.getElementById('homeParkingList');
                if (container) {
                    showNearbyParkings(coords, 5);
                }
            } else {
                alert('У домашнего адреса нет координат. Добавьте адрес через карту.');
            }
        })
        .catch(function(err) { alert('Ошибка: ' + err.message); });
}
// Вспомогательная функция для отображения списка парковок
function renderParkingList(container, parkings) {
    if (!parkings || parkings.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Нет парковок</p></div>';
        return;
    }
    container.innerHTML = parkings.map(p => renderParkingItem(p, userLocationForSearch)).join('');
}
    // ===================== ИНИЦИАЛИЗАЦИЯ =====================
   // Проверяем URL на наличие данных авторизации от Telegram (редирект)
function checkTelegramAuthFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const authData = urlParams.get('tg_auth_data');
    if (authData) {
        try {
            const userData = JSON.parse(decodeURIComponent(authData));
            if (userData.id) {
                onTelegramAuth(userData);
                // Очищаем URL от параметров
                window.history.replaceState({}, document.title, window.location.pathname);
                return true;
            }
        } catch (e) {
            console.warn('Ошибка разбора данных авторизации:', e);
        }
    }
    return false;
}
// ===================== АВТОРИЗАЦИЯ ЧЕРЕЗ TELEGRAM =====================
function onTelegramAuth(user) {
    try {
        currentUser = {
            id: 'tg_' + user.id,
            username: user.username || 'tg_user',
            firstName: user.first_name || 'Пользователь',
            photoUrl: user.photo_url || '',
            isGuest: false
        };
        localStorage.setItem('tgUser', JSON.stringify(currentUser));

        const userRef = database.ref('users/' + currentUser.id);
        userRef.update({
            username: currentUser.username,
            firstName: currentUser.firstName,
            photoUrl: currentUser.photoUrl,
            lastActive: Date.now()
        }).catch(console.error);
        // ✅ Проверяем, есть ли статистика, и создаём только если её нет
        userRef.child('stats').once('value').then(function(snap) {
            if (snap.exists()) {
                // Статистика есть – обновляем только lastActive
                userRef.child('stats/lastActive').set(Date.now());
            } else {
                // Статистики нет – создаём начальную
                userRef.child('stats').set({
                    registeredAt: Date.now(),
                    lastActive: Date.now(),
                    parkingsCreated: 0,
                    parkingsUpdated: 0,
                    confirmations: 0,
                    views: 0,
                    favorites: 0,
                    activeDates: [new Date().toISOString().split('T')[0]]
                });
            }
        }).catch(console.error);

        hideAuthScreen();
        showPanel('home');
        showOnboarding();
        console.log('✅ Пользователь авторизован:', user.first_name);
    } catch (e) {
        console.error('❌ Ошибка в onTelegramAuth:', e);
        continueAsGuest();
    }
}
