import { getOccupancyColor, formatDateTime } from '../utils/helpers.js';
import { getUser } from '../models/user.js';

export function renderEditPanel(data, isFavorite) {
    const totalSpots = data.totalSpots || 0;
    const occupiedSpots = data.occupiedSpots || 0;
    const freeSpots = totalSpots - occupiedSpots;
    const color = getOccupancyColor(occupiedSpots, totalSpots);
    const occupancyPercent = totalSpots > 0 ? Math.round((occupiedSpots / totalSpots) * 100) : 0;
    const isAuthor = getUser() && getUser().id === data.authorId;
    const status = data.status || 'unknown';
    const statusText = status === 'free' ? 'Свободно' : status === 'occupied' ? 'Занято' : 'Неизвестно';
    const statusClass = status === 'free' ? 'status-free' : status === 'occupied' ? 'status-occupied' : 'status-unknown';
    const isPaid = data.isPaid || false;

    let html = `
        <div class="occupancy-header"><div class="occupancy-title"><span class="status-indicator ${statusClass}"></span>${data.name}</div></div>
        <div class="occupancy-stats">
            <div class="stat-card stat-total"><div class="stat-value" id="statTotal">${totalSpots}</div><div class="stat-label">Всего мест</div></div>
            <div class="stat-card stat-free"><div class="stat-value" id="statFree">${freeSpots}</div><div class="stat-label">Свободно</div></div>
            <div class="stat-card stat-occupied"><div class="stat-value" id="statOccupied">${occupiedSpots}</div><div class="stat-label">Занято</div></div>
        </div>
        <div class="progress-bar"><div class="progress-fill" id="progressFill" style="width:${occupancyPercent}%;background:${color};"></div></div>
        <div style="text-align:center;font-size:13px;color:var(--text-secondary);margin-bottom:20px;" id="occupancyPercentText">Загруженность: ${occupancyPercent}%</div>
        <div class="occupancy-control" style="margin-bottom:15px;">
            <label>Изменить количество занятых мест:</label>
            <div class="counter-row">
                <button class="counter-btn minus" onclick="window.changeOccupancy(-1)">−</button>
                <div class="counter-value" id="currentOccupied">${occupiedSpots}</div>
                <button class="counter-btn plus" onclick="window.changeOccupancy(1)">+</button>
            </div>
        </div>
    `;
    if (getUser()) {
        html += `<button class="btn-secondary" style="margin-bottom:15px;" id="favBtn" onclick="window.toggleFavorite('${data.id}')">${isFavorite ? '✅ В избранном' : '⭐ Добавить в избранное'}</button>`;
    }
    if (isAuthor) {
        html += `
            <div class="form-group"><label>Название</label><input type="text" id="editName" class="input-field" value="${data.name}"></div>
            <div class="form-group"><label>Количество мест</label><input type="number" id="editTotalSpots" class="input-field" value="${totalSpots}" min="1"></div>
            <div class="form-group"><label>Тип парковки</label><div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;border:1px solid var(--input-border);background:var(--input-bg);"><span style="color:var(--text-primary);white-space:nowrap;">Бесплатная</span><label class="theme-switch" style="width:51px;height:31px;display:inline-block;position:relative;"><input type="checkbox" id="editIsPaid" ${isPaid ? 'checked' : ''}><span class="theme-slider" style="position:absolute;top:0;left:0;right:0;bottom:0;background-color:#E5E5EA;border-radius:31px;transition:.3s;"></span></label><span style="color:var(--text-primary);white-space:nowrap;">Платная</span></div></div>
            <button class="btn-primary" onclick="window.saveParkingDetails()">💾 Сохранить изменения</button>
            <button class="btn-danger" onclick="window.deleteParking('${data.id}')">🗑️ Удалить парковку</button>
        `;
    } else {
        html += `<div style="text-align:center;margin:10px 0;font-size:15px;">Статус: <strong>${statusText}</strong> | ${isPaid ? 'Платная' : 'Бесплатная'}</div>`;
        html += `<button class="btn-secondary" style="margin-top:10px;" onclick="window.confirmParking('${data.id}')">👍 Подтвердить актуальность</button>`;
    }
    html += `<button class="btn-secondary" style="margin-top:20px;" onclick="window.closePanel()">Закрыть</button>`;
    return html;
}

export function renderParkingSheet(id, data) {
    const sheet = document.getElementById('parkingSheet');
    const content = document.getElementById('sheetContent');
    const addr = data.address || (data.lat && data.lng ? `${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}` : 'Адрес не указан');
    const free = data.totalSpots - data.occupiedSpots;
    // Используем существующую функцию для получения геолокации
    content.innerHTML = `
        <h3>${data.name}</h3>
        <p>📍 ${addr}</p>
        <p>🅿️ Свободно: ${free} / ${data.totalSpots}</p>
        <button class="btn-primary" onclick="window.buildRouteToParking('${id}')">🗺️ Маршрут</button>
        <button class="btn-secondary" onclick="window.openOccupancyPanel('${id}')">✏️ Редактировать</button>
    `;
    sheet.classList.add('active');
}
