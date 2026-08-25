// ===================== ГЛОБАЛЬНЫЕ ФУНКЦИИ =====================

/**
 * Показывает всплывающее уведомление
 * @param {string} message - Текст уведомления
 * @param {number} duration - Время показа в мс
 */
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
    }, duration);
}

/**
 * Переключение тёмной темы
 */
function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('darkTheme', isDark ? '1' : '0');

    const mapEl = document.getElementById('map');
    if (mapEl && window.map) {
        const currentType = window.map.getType ? window.map.getType() : 'yandex#map';
        if (isDark && currentType === 'yandex#map') {
            mapEl.style.filter = 'invert(0.82) hue-rotate(180deg) brightness(0.95) contrast(0.9) saturate(0.85)';
        } else {
            mapEl.style.filter = 'none';
        }
    }

    const tabBar = document.querySelector('.tabBar');
    if (tabBar) {
        tabBar.style.background = '';
    }

    // Синхронизируем переключатели
    const toggle1 = document.getElementById('settingsThemeToggle');
    const toggle2 = document.getElementById('settingsThemeToggleInline');
    if (toggle1) toggle1.checked = isDark;
    if (toggle2) toggle2.checked = isDark;

    if (window.Telegram && window.Telegram.WebApp) {
        try {
            const tg = window.Telegram.WebApp;
            if (isDark) {
                tg.setHeaderColor('#1C1C1E');
                tg.setBackgroundColor('#000000');
            } else {
                tg.setHeaderColor('#F2F2F7');
                tg.setBackgroundColor('#FFFFFF');
            }
        } catch (e) {}
    }

    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
}

/**
 * Обновление темы карты (при смене слоя)
 */
function updateMapTheme() {
    const mapEl = document.getElementById('map');
    if (!mapEl || !window.map) return;
    const isDark = document.body.classList.contains('dark-theme');
    const currentType = window.map.getType ? window.map.getType() : 'yandex#map';
    if (isDark && currentType === 'yandex#map') {
        mapEl.style.filter = 'invert(0.82) hue-rotate(180deg) brightness(0.95) contrast(0.9) saturate(0.85)';
    } else {
        mapEl.style.filter = 'none';
    }
}

// ===================== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ =====================

/**
 * Главная функция запуска приложения.
 * Вызывается после загрузки всех модулей.
 */
function initApp() {
    // 1. Проверка авторизации через Telegram (редирект)
    if (window.checkTelegramAuthFromUrl && typeof window.checkTelegramAuthFromUrl === 'function') {
        if (window.checkTelegramAuthFromUrl()) {
            window.showPanel('home');
            return;
        }
    }

    // 2. Инициализация авторизации (восстановление сессии)
    if (window.initAuth && typeof window.initAuth === 'function') {
        window.initAuth();
    }

    // 3. Восстановление сохранённого города из localStorage
    const savedCity = localStorage.getItem('parknear_city');
    if (savedCity) {
        try {
            const prefs = JSON.parse(savedCity);
            if (prefs && prefs.city) {
                window.userCityPrefs = {
                    region: prefs.region || '',
                    city: prefs.city || ''
                };
                window.currentCity = prefs.city;
                const savedCoords = localStorage.getItem('parknear_city_coords');
                if (savedCoords) {
                    window.cityCoords = JSON.parse(savedCoords);
                }
                if (window.updateCityDisplay) {
                    window.updateCityDisplay();
                }
            }
        } catch (e) {
            console.warn('⚠️ Ошибка восстановления города:', e);
        }
    }

    // 4. Настройка обработчика кнопки "Добавить парковку"
    const addBtn = document.getElementById('addBtn');
    if (addBtn) {
        addBtn.onclick = function() {
            if (!window.currentUser) {
                window.showPanel('home');
            } else if (window.isDrawingMode) {
                window.cancelDrawing();
            } else {
                window.startDrawingMode();
            }
        };
    }

    // 5. Инициализация карты (если ещё не создана)
    if (!window.map && window.initMap && typeof window.initMap === 'function') {
        window.initMap();
    }

    // 6. Загрузка парковок для текущего города
    if (window.loadAllParkings && typeof window.loadAllParkings === 'function') {
        window.loadAllParkings(window.currentCity);
    }

    // 7. Инициализация Pull-to-Refresh
    if (window.initPullToRefresh && typeof window.initPullToRefresh === 'function') {
        window.initPullToRefresh();
    }

    // 8. Показать главную панель, если пользователь авторизован
    if (window.currentUser) {
        window.showPanel('home');
    }

    // 9. Переместить карту на координаты города (если есть)
    if (window.map && window.cityCoords) {
        window.map.setCenter([window.cityCoords.lat, window.cityCoords.lng], 12, { duration: 300 });
    }

    console.log('✅ ParkNear инициализирован успешно');
}

// ===================== ЗАПУСК =====================

// Запускаем приложение после полной загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
