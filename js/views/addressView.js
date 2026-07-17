import { loadAddresses } from '../models/address.js';
import { getUser } from '../models/user.js';
import { formatDateTime } from '../utils/helpers.js';
import { initSwipeDelete } from '../components/swipeDelete.js';

export function renderAddressList(addresses) {
    let html = '<div class="home-card"><div style="font-size:18px;font-weight:600;margin-bottom:12px;">🏠 Мой дом</div>';
    if (Object.keys(addresses).length > 0) {
        Object.entries(addresses).forEach(([id, addr]) => {
            const label = addr.label || 'Адрес';
            const icon = label === 'Дом' ? '🏠' : label === 'Работа' ? '💼' : label === 'Родственники' ? '👨‍👩‍👧‍👦' : '📍';
            html += `<div class="swipe-container" style="margin-bottom:8px;">
                <div class="swipe-item" style="padding:10px 0;">
                    <span style="flex:1;"><strong>${icon} ${label}</strong><br><span style="font-size:13px;color:var(--text-secondary);">${addr.address}</span></span>
                    <div>
                        <button class="btn-secondary" style="padding:4px 10px;font-size:13px;" onclick="window.findParkingsNearAddress(${addr.lat || 'null'}, ${addr.lng || 'null'}, '${addr.address.replace(/'/g, "\\'")}')">Найти парковку</button>
                    </div>
                </div>
                <div class="swipe-delete" onclick="window.removeHomeAddress('${id}')">Удалить</div>
            </div>`;
        });
    } else {
        html += '<p style="color:var(--text-secondary);">Нет адресов</p>';
    }
    html += Object.keys(addresses).length < 3 ? '<button class="btn-primary" onclick="window.addHomeAddress()">➕ Добавить адрес</button>' : '<p style="color:var(--text-secondary);">Макс. 3 адреса</p>';
    html += '</div>';
    return html;
}

export function renderAddressForm() {
    return `
        <div class="home-card">
            <div style="font-size:18px;font-weight:600;margin-bottom:12px;">➕ Добавить адрес</div>
            <div class="address-toggle">
                <button class="active" onclick="window.switchAddressMethod('manual')">✏️ Вручную</button>
                <button onclick="window.switchAddressMethod('map')">🗺️ На карте</button>
            </div>
            <div class="manual-address-form active" id="manualAddressForm">
                <div class="form-group">
                    <label>Регион</label>
                    <select id="addrRegion" class="input-field" onchange="window.updateAddrCity()">
                        <option value="">Выберите регион</option>
                        ${Object.keys(window.regionsData).sort().map(r => `<option value="${r}">${r}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Город</label>
                    <select id="addrCity" class="input-field">
                        <option value="">Сначала выберите регион</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Улица</label>
                    <input type="text" id="addrStreet" class="input-field" placeholder="ул. Ленина">
                </div>
                <div class="form-group">
                    <label>Номер дома</label>
                    <input type="text" id="addrHouse" class="input-field" placeholder="15">
                </div>
                <button class="btn-primary" onclick="window.saveAddressManually()">🔍 Найти и сохранить</button>
            </div>
            <div class="map-address-form" id="mapAddressForm">
                <p style="text-align:center;color:var(--text-secondary);margin-bottom:16px;">Выберите точку на карте</p>
                <button class="btn-primary" onclick="window.openAddressPicker()">🗺️ Открыть карту</button>
            </div>
            <button class="btn-secondary" style="margin-top:12px;" onclick="window.showPanel('favorites')">Отмена</button>
        </div>
    `;
}

export function renderFavorites(content) {
    const user = getUser();
    if (!user) {
        content.innerHTML = '<div class="empty-state"><div class="icon">🔒</div><p>Войдите</p></div>';
        return;
    }
    content.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Загрузка...</p></div>';
    loadAddresses(user.id).then(addrs => {
        let html = renderAddressList(addrs);
        // Добавляем избранные парковки (заглушка)
        html += '<div class="empty-state"><div class="icon">⭐</div><p>Нет избранных</p></div>';
        content.innerHTML = html;
        initSwipeDelete(content);
    });
}
