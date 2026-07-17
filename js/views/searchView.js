import { applyFilters, setNearbyFilter, clearNearbyFilter } from '../controllers/searchController.js';
import { regionsData } from '../utils/constants.js';
import { initSwipeDelete } from '../components/swipeDelete.js';

export function renderSearchPanel(content) {
    let html = `
        <div class="city-selector">
            <label style="font-size:13px;color:var(--text-secondary);margin-bottom:6px;display:block;">Регион</label>
            <select id="regionSelect" class="input-field" onchange="window.updateCitySelect()">
                <option value="">Все регионы</option>
                ${Object.keys(regionsData).sort().map(r => `<option value="${r}">${r}</option>`).join('')}
            </select>
        </div>
        <div class="city-selector">
            <label style="font-size:13px;color:var(--text-secondary);margin-bottom:6px;display:block;">Город</label>
            <select id="citySelect" class="input-field" onchange="window.filterParkings()">
                <option value="">Все города</option>
            </select>
        </div>
        <div class="search-bar">
            <input type="text" id="searchInput" placeholder="Улица, дом..." oninput="window.filterParkings()">
        </div>
        <div id="searchResults" class="list-container">
            <p style="color:var(--text-secondary); text-align:center;">Введите улицу для поиска</p>
        </div>
    `;
    content.innerHTML = html;
    window.filterParkings();
}

export function renderSearchResults(parkings) {
    const container = document.getElementById('searchResults');
    if (!container) return;
    let html = '';
    if (parkings.length === 0) {
        html = '<div class="empty-state"><p>Ничего не найдено</p></div>';
    } else {
        html = '<div class="list-container">';
        parkings.forEach(p => {
            const free = p.totalSpots - (p.occupiedSpots || 0);
            const isAuthor = window.currentUser && window.currentUser.id === p.authorId;
            let addressDisplay = p.address || '';
            if (p.houseNumber) {
                if (!addressDisplay.includes(p.houseNumber)) {
                    addressDisplay = addressDisplay ? addressDisplay + ', д. ' + p.houseNumber : 'д. ' + p.houseNumber;
                }
            }
            html += `
                <div class="swipe-container">
                    <div class="swipe-item" onclick="window.focusMap(${p.lat}, ${p.lng}, '${p.id}')">
                        <div class="list-icon">🅿️</div>
                        <div class="list-info">
                            <div class="list-title">${p.name || 'Без названия'}</div>
                            <div class="list-subtitle">${addressDisplay} · Свободно: ${free}/${p.totalSpots}</div>
                        </div>
                    </div>
                    ${isAuthor ? `<div class="swipe-delete" onclick="window.deleteParking('${p.id}')">Удалить</div>` : ''}
                </div>
            `;
        });
        html += '</div>';
    }
    container.innerHTML = html;
    initSwipeDelete(container);
}
