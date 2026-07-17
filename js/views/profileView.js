import { getUser, getUserStats, getCar } from '../models/user.js';
import { carBrands, carColors } from '../utils/constants.js';
import { formatDateTime } from '../utils/helpers.js';

export function renderProfile(content) {
    const user = getUser();
    if (!user) {
        content.innerHTML = `
            <div class="profile-header">
                <div class="profile-avatar">👤</div>
                <div class="profile-name">Добро пожаловать</div>
                <div class="profile-username">Войдите, чтобы сохранять данные</div>
            </div>
            <button class="telegram-btn" onclick="window.openTelegramBot()">Войти через Telegram</button>
            <button class="guest-btn" onclick="window.continueAsGuest()">Продолжить как гость</button>
        `;
        return;
    }
    const isGuest = user.id.startsWith('guest_');
    const isDark = document.body.classList.contains('dark-theme');
    getUserStats(user.id).then(stats => {
        getCar(user.id).then(car => {
            const brand = car.brand || '';
            const model = car.model || '';
            const plate = car.plate || '';
            const color = car.color || '';
            // Расчёт репутации
            const created = stats.parkingsCreated || 0;
            const updated = stats.parkingsUpdated || 0;
            const confirmations = stats.confirmations || 0;
            const views = stats.views || 0;
            const favorites = stats.favorites || 0;
            const activeDates = stats.activeDates || [];
            const score = (created * 25) + (updated * 5) + (confirmations * 5) + Math.floor(views / 5) + (favorites * 5) + (activeDates.length * 5);
            // Определение уровня
            const levels = [
                { xp: 0, name: "Пешеход", emoji: "👣" },
                { xp: 1000, name: "Водитель-любитель", emoji: "🚗" },
                { xp: 3000, name: "Начинающий парковщик", emoji: "🅿️" },
                { xp: 5000, name: "Городской водитель", emoji: "🏙️" },
                { xp: 10000, name: "Наблюдатель", emoji: "👁️" },
                { xp: 20000, name: "Помощник района", emoji: "🤝" },
                { xp: 40000, name: "Картограф", emoji: "🗺️" },
                { xp: 70000, name: "Инспектор", emoji: "🕵️‍♂️" },
                { xp: 110000, name: "Ветеран дорог", emoji: "🛣️" },
                { xp: 150000, name: "Страж парковки", emoji: "⚖️" },
                { xp: 250000, name: "Архитектор города", emoji: "🏗️" },
                { xp: 500000, name: "Легенда ParkNear", emoji: "💎" }
            ];
            let level = 1, levelName = "Пешеход", levelEmoji = "👣";
            for (let i = levels.length - 1; i >= 0; i--) {
                if (score >= levels[i].xp) {
                    level = i + 1;
                    levelName = levels[i].name;
                    levelEmoji = levels[i].emoji;
                    break;
                }
            }
            const nextLevel = levels.find(l => l.xp > score);
            let progressPercent = 100;
            let xpForNext = 0;
            if (nextLevel) {
                const prevLevelXp = levels[level - 2] ? levels[level - 2].xp : 0;
                const range = nextLevel.xp - prevLevelXp;
                const currentInRange = score - prevLevelXp;
                progressPercent = Math.min(100, Math.round((currentInRange / range) * 100));
                xpForNext = nextLevel.xp - score;
            }
            let html = `
                <div class="profile-header">
                    <div class="profile-avatar">${user.photoUrl ? `<img src="${user.photoUrl}" alt="Profile">` : '👤'}</div>
                    <div class="profile-name">${user.firstName}</div>
                    <div class="profile-username">@${user.username}</div>
                    ${isGuest ? '<span class="badge">Гость</span>' : '<span class="badge">Telegram</span>'}
                </div>
                <div class="theme-toggle-row">
                    <div class="theme-toggle-label">🌙 Тёмная тема</div>
                    <label class="theme-switch">
                        <input type="checkbox" id="themeToggle" ${isDark ? 'checked' : ''} onchange="window.toggleTheme()">
                        <span class="theme-slider"></span>
                    </label>
                </div>
                <div class="city-pref-card">
                    <div class="city-pref-title">🏙️ Мой город</div>
                    <div class="city-pref-row">
                        <div class="form-group">
                            <label>Регион</label>
                            <select id="profileRegionSelect" class="input-field" onchange="window.updateCitySelectInProfile('profileRegionSelect','profileCitySelect')">
                                <option value="">Выберите регион</option>
                                ${Object.keys(window.regionsData).sort().map(r => `<option value="${r}">${r}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Город</label>
                            <select id="profileCitySelect" class="input-field">
                                <option value="">Выберите город</option>
                            </select>
                        </div>
                    </div>
                    <button class="btn-secondary" style="margin-top:8px;" onclick="window.saveCityPreferences()">Сохранить город</button>
                </div>
            `;
            if (brand && model && plate) {
                html += `
                    <div class="car-section">
                        <div class="car-section-title">🚗 Мой автомобиль</div>
                        <div class="car-summary">
                            <div class="car-summary-info">
                                <div class="car-summary-title">${brand} ${model}</div>
                                <div class="car-summary-subtitle">${plate}</div>
                            </div>
                            <div class="car-summary-color" style="background:${window.carColors[color] || '#808080'};"></div>
                        </div>
                        <button class="btn-secondary" onclick="window.editCarData()">✏️ Редактировать</button>
                    </div>
                `;
            } else {
                html += `
                    <div class="car-section" id="carEditSection">
                        <div class="car-section-title">🚗 Мой автомобиль</div>
                        <div class="form-group">
                            <label>Марка</label>
                            <select id="carBrand" class="input-field" onchange="window.updateCarModels()">
                                ${Object.keys(carBrands).map(b => `<option value="${b}">${b}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Модель</label>
                            <select id="carModel" class="input-field">
                                <option value="">Выберите модель</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Цвет кузова</label>
                            <select id="carColor" class="input-field">
                                ${Object.keys(carColors).map(c => `<option value="${c}">${c}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Гос номер</label>
                            <input type="text" id="carPlate" class="input-field" placeholder="А123БВ777" maxlength="10">
                        </div>
                        <button class="btn-primary" onclick="window.saveCarData()">💾 Сохранить данные авто</button>
                    </div>
                `;
            }
            html += `
                <div class="reputation-card">
                    <div class="reputation-title" onclick="var b=document.getElementById('repBody');b.classList.toggle('collapsed');this.querySelector('span:last-child').textContent=b.classList.contains('collapsed')?'▶':'▼';">
                        <span>🏆 Репутация</span><span>▼</span>
                    </div>
                    <div class="reputation-body" id="repBody">
                        <div class="reputation-full">
                            <div class="stats-row"><span class="stats-label">🎖 Уровень</span><span class="stats-value">${levelEmoji} ${levelName} (${level}/12)</span></div>
                            <div class="stats-row"><span class="stats-label">✨ Опыт (XP)</span><span class="stats-value">${score.toLocaleString()}</span></div>
                            ${nextLevel ? `<div class="stats-row"><span class="stats-label">🚀 До след. уровня</span><span class="stats-value">${xpForNext.toLocaleString()} XP</span></div>` : ''}
                            <div class="progress-bar" style="margin-top:10px;"><div class="progress-fill" style="width:${progressPercent}%;background:var(--accent);"></div></div>
                        </div>
                        <div class="reputation-mini">
                            <div class="reputation-circle">
                                <svg width="80" height="80" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E5E5EA" stroke-width="3"/>
                                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#34C759" stroke-width="3" stroke-dasharray="${progressPercent} 100" stroke-linecap="round" transform="rotate(-90 18 18)"/>
                                    <text x="18" y="21" text-anchor="middle" fill="currentColor" font-size="10">${levelEmoji}</text>
                                </svg>
                                <div style="margin-top:8px;font-weight:600;">Ур. ${level}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div style="padding:0 20px;">
                    <p style="font-size:14px;color:var(--text-secondary);text-align:center;margin-bottom:20px;">${isGuest ? 'Данные сохраняются локально' : 'Данные синхронизированы'}</p>
                    <button class="btn-danger" onclick="window.logout()">🚪 Выйти</button>
                </div>
            `;
            content.innerHTML = html;
        });
    });
}
