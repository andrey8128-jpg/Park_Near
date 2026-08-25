  // ===================== АВТОРИЗАЦИЯ =====================
    function initAuth() {
    const saved = localStorage.getItem('tgUser');
    if (saved) {
        try {
            const user = JSON.parse(saved);
            if (!currentUser || currentUser.id !== user.id) {
                currentUser = user;
                window.currentUser = user;
                hideAuthScreen();
                // Если панель не активна, открываем главную
                const panel = document.getElementById('panel');
                if (!panel.classList.contains('active')) {
                    showPanel('home');
                }
                console.log('✅ Пользователь восстановлен в initAuth()');
            }
            return; // если пользователь уже есть, ничего не делаем
        } catch (e) {
            localStorage.removeItem('tgUser');
        }
    }
    // Если пользователь не найден – показываем экран входа
    showAuthScreen();
}
// Немедленное восстановление сессии (выполняется до загрузки карт)
(function() {
    const saved = localStorage.getItem('tgUser');
    if (saved) {
        try {
            const user = JSON.parse(saved);
            currentUser = user;
            window.currentUser = user;
            hideAuthScreen();
            const panel = document.getElementById('panel');
            if (!panel.classList.contains('active')) {
                showPanel('home');
            }
            console.log('✅ Вход восстановлен (ранний вызов)');
        } catch (e) {
            localStorage.removeItem('tgUser');
        }
    }
})();
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
