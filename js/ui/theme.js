// ===== Восстановление темы (с сохранением правильных цветов маркеров) =====
    (function restoreTheme() {
        const darkTheme = localStorage.getItem('darkTheme');
        const isDark = (darkTheme === '1');
        if (isDark) {
            document.body.classList.add('dark-theme');
            
            // Накладываем фильтр только на тайлы карты, чтобы не инвертировать цвета маркеров
            const mapStyle = document.createElement('style');
            mapStyle.id = 'dark-map-style';
            mapStyle.innerHTML = `
                .dark-theme #map .ymaps-2-1-game-layer,
                .dark-theme #map [class*="ymaps-2-1-17-events-pane"] {
                    filter: invert(0.9) hue-rotate(180deg) brightness(0.9) contrast(0.9) saturate(0.8) !important;
                }
            `;
            document.head.appendChild(mapStyle);

            if (window.Telegram && window.Telegram.WebApp) {
                try {
                    window.Telegram.WebApp.setHeaderColor('#1C1C1E');
                    window.Telegram.WebApp.setBackgroundColor('#000000');
                } catch(e) {}
            }
        }
        var toggle1 = document.getElementById('settingsThemeToggle');
        var toggle2 = document.getElementById('settingsThemeToggleInline');
        if (toggle1) toggle1.checked = isDark;
        if (toggle2) toggle2.checked = isDark;
    })();