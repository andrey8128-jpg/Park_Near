(function () {
    const API = () => `${window.PARKNEAR_API_URL}/api`;
    const token = () => localStorage.getItem('parkNearSessionToken');
    let addressSelectionMap = null;
let addressSelectionMarker = null;
let addressSelectionCoords = null;
let addressSelectionResolvedAddress = '';
let addressGeocodeRequest = 0;
    async function request(path, options = {}) {
        const response = await fetch(`${API()}${path}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token()}`,
                'Content-Type': 'application/json',
                ...(options.headers || {})
            },
            cache: 'no-store'
        });
        let result;
          try {
         result = await response.json();
       } catch (error) {
          throw new Error(`Сервер вернул некорректный ответ (HTTP ${response.status})`);
        }
        if (!response.ok || !result.success) {
            throw new Error(result.error || `Ошибка HTTP ${response.status}`);
        }
        return result;
    }
    function escape(value) {
        const div = document.createElement('div');
        div.textContent = String(value ?? '');
        return div.innerHTML;
    }
    function distanceMeters(lat1, lng1, lat2, lng2) {
        const rad = value => value * Math.PI / 180;
        const dLat = rad(lat2 - lat1);
        const dLng = rad(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(lat1)) * Math.cos(rad(lat2)) *
            Math.sin(dLng / 2) ** 2;
        return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    async function getAddresses() {
    const result = await request('/users/me/profile');
    const saved = result.profile?.homeAddresses;
    if (Array.isArray(saved)) return saved;
    if (saved && typeof saved === 'object') {
        return Object.entries(saved).map(([id, item]) => ({
            ...item,
            id: item.id || id,
            name: item.name || item.label || 'Место'
        }));
    }
    return [];
}
    async function saveAddresses(addresses) {
        await request('/users/me/profile', {
            method: 'PATCH',
            body: JSON.stringify({ homeAddresses: addresses })
        });
    }
    async function getNearbyParkings(address) {
        const result = await request('/parkings');
        const parkings = Array.isArray(result.parkings) ? result.parkings : [];
        return parkings.map(parking => {
            const lat = Number(parking.lat ?? parking.latitude ?? parking.coords?.[0]);
            const lng = Number(parking.lng ?? parking.longitude ?? parking.coords?.[1]);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            const distance = distanceMeters(address.lat, address.lng, lat, lng);
            if (distance > 300) return null;
            return { ...parking, distance };
        }).filter(Boolean).sort((a, b) => a.distance - b.distance);
    }
    window.openMyAddresses = async function () {
        const content = document.getElementById('panelContent');
        if (!content) return;
        if (!currentUser || String(currentUser.id).startsWith('guest_')) {
            content.innerHTML = '<div class="pn-fav-empty"><h3>Войдите в аккаунт</h3><p>Сохранение адресов доступно зарегистрированным пользователям.</p></div>';
            return;
        }
        
content.innerHTML = `
    <div class="pn-addresses">

        <div class="pn-addresses-header">
            <div>
                <h2>Мои адреса</h2>
                <p>Быстрый доступ к парковкам рядом с важными местами</p>
            </div>

            <button type="button"
                onclick="renderProfile(document.getElementById('panelContent'))"
                aria-label="Закрыть">
                ${window.pnIcon('close', {size: 25})}
            </button>
        </div>

        <button type="button"
            class="pn-address-add"
            id="pnAddressAdd">
            ${window.pnIcon('plus', {size: 24})}
            <span>Добавить адрес</span>
        </button>

        <div id="pnAddressesList">
            Загрузка адресов...
        </div>

    </div>`;
        document.getElementById('pnAddressAdd').onclick = openAddressPicker;
        document.getElementById('pnAddressPickerClose').onclick = closeAddressPicker;
        document.getElementById('pnAddressPickerCancel').onclick = closeAddressPicker;
        document.getElementById('pnAddressPickerSave').onclick = saveSelectedAddress;
        await renderAddresses();
    };
    async function openAddressPicker() {
    try {
        const addresses = await getAddresses();
        if (addresses.length >= 3) {
            alert('Можно сохранить не более 3 адресов.');
            return;
        }
        if (!window.ymaps) {
            throw new Error('Яндекс.Карты не загружены.');
        }
        await new Promise(resolve => ymaps.ready(resolve));
        const overlay = document.getElementById('pnAddressPickerOverlay');
        const nameInput = document.getElementById('pnAddressName');
        const saveButton = document.getElementById('pnAddressPickerSave');
        if (!overlay || !nameInput || !saveButton) {
            throw new Error('Не найдено окно выбора адреса.');
        }
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        nameInput.value = '';
        saveButton.disabled = true;
        addressSelectionCoords = null;
        addressSelectionResolvedAddress = '';
        document.getElementById('pnAddressResolved').textContent = 'Выберите точку на карте';
        document.getElementById('pnAddressCoords').textContent = 'Нажмите на нужное место';
        let center = [55.7558, 37.6173];
        if (typeof map !== 'undefined' && map) {
            center = map.getCenter();
        }
        setTimeout(() => {
            const mapElement = document.getElementById('pnAddressPickerMap');
            if (!mapElement) return;
            if (!addressSelectionMap) {
                addressSelectionMap = new ymaps.Map('pnAddressPickerMap', {
                    center,
                    zoom: 16,
                    controls: ['zoomControl']
                });
                addressSelectionMap.events.add('click', event => {
                    selectAddressPoint(event.get('coords'));
                });
            } else {
                addressSelectionMap.container.fitToViewport();
                addressSelectionMap.setCenter(center, 16);
            }
            if (addressSelectionMarker) {
                addressSelectionMap.geoObjects.remove(addressSelectionMarker);
                addressSelectionMarker = null;
            }
            addressSelectionMap.container.fitToViewport();
        }, 150);
    } catch (error) {
        console.error('Ошибка открытия выбора адреса:', error);
        alert(error.message || 'Не удалось открыть карту.');
    }
}
function selectAddressPoint(coords) {
    if (!Array.isArray(coords) || coords.length < 2) return;
    const lat = Number(coords[0]);
    const lng = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    addressSelectionCoords = [lat, lng];
    addressSelectionResolvedAddress = `Точка (${lat.toFixed(6)}, ${lng.toFixed(6)})`;
    const saveButton = document.getElementById('pnAddressPickerSave');
    saveButton.disabled = false;
    document.getElementById('pnAddressResolved').textContent = 'Определяем адрес...';
    document.getElementById('pnAddressCoords').textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    if (addressSelectionMarker) {
        addressSelectionMarker.geometry.setCoordinates(addressSelectionCoords);
    } else {
        addressSelectionMarker = new ymaps.Placemark(addressSelectionCoords, {
            hintContent: 'Выбранное место',
            balloonContent: 'Перетащите метку, чтобы изменить место'
        }, {
            preset: 'islands#redHomeIcon',
            draggable: true
        });
        addressSelectionMap.geoObjects.add(addressSelectionMarker);
        addressSelectionMarker.events.add('dragend', () => {
            selectAddressPoint(addressSelectionMarker.geometry.getCoordinates());
        });
    }
    const requestNumber = ++addressGeocodeRequest;
    ymaps.geocode(addressSelectionCoords, { results: 1 })
        .then(result => {
            if (requestNumber !== addressGeocodeRequest) return;
            const geoObject = result.geoObjects.get(0);
            if (geoObject) {
                addressSelectionResolvedAddress = geoObject.getAddressLine() || addressSelectionResolvedAddress;
            }
            document.getElementById('pnAddressResolved').textContent = addressSelectionResolvedAddress;
        })
        .catch(error => {
            console.warn('Не удалось определить адрес по координатам:', error);
            if (requestNumber === addressGeocodeRequest) {
                document.getElementById('pnAddressResolved').textContent = 'Адрес не определён. Сохраним координаты.';
            }
        });
}
async function saveSelectedAddress() {
    const name = document.getElementById('pnAddressName').value.trim();
    if (!name) {
        alert('Укажи название места, например Дом или Работа.');
        return;
    }
    if (!addressSelectionCoords) {
        alert('Сначала выбери точку на карте.');
        return;
    }
    const button = document.getElementById('pnAddressPickerSave');
    button.disabled = true;
    button.textContent = 'Сохранение...';
    try {
        const addresses = await getAddresses();
        if (addresses.length >= 3) {
            alert('Можно сохранить не более 3 адресов.');
            return;
        }
        const [lat, lng] = addressSelectionCoords;
        const address = {
            id: `address_${Date.now()}`,
            name,
            address: addressSelectionResolvedAddress || `Точка (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
            lat,
            lng,
            createdAt: new Date().toISOString()
        };
        await saveAddresses([...addresses, address]);
        closeAddressPicker();
        await renderAddresses();
        alert('Адрес успешно сохранён!');
    } catch (error) {
        console.error('Ошибка сохранения адреса:', error);
        alert(error.message || 'Не удалось сохранить адрес.');
    } finally {
        button.disabled = false;
        button.textContent = 'Сохранить адрес';
    }
}
function closeAddressPicker() {
    const overlay = document.getElementById('pnAddressPickerOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
    }
    addressSelectionCoords = null;
    addressSelectionResolvedAddress = '';
    addressGeocodeRequest++;
}
    async function deleteAddress(id) {
        if (!confirm('Удалить этот адрес?')) return;
        try {
            const addresses = await getAddresses();
            await saveAddresses(addresses.filter(item => item.id !== id));
            await renderAddresses();
        } catch (error) {
            alert(error.message || 'Не удалось удалить адрес');
        }
    }
    async function renderAddresses() {
        const container = document.getElementById('pnAddressesList');
        if (!container) return;
        try {
            const addresses = await getAddresses();
            if (!addresses.length) {
                container.innerHTML = '<div class="pn-address-empty">Пока нет сохранённых адресов. Добавьте дом, работу или другое место.</div>';
                return;
            }
            
container.innerHTML = addresses.map(address => `
    <section class="pn-address-card"
             data-address-id="${escape(address.id)}">

        <div class="pn-address-card-head">

            <div class="pn-address-icon">
                ${window.pnIcon(
                    /дом|home/i.test(address.name || '')
                        ? 'home'
                        : 'mapPin',
                    {size: 34}
                )}
            </div>

            <div class="pn-address-card-info">
                <strong>${escape(address.name)}</strong>
                <p>${escape(address.address)}</p>
            </div>

            <button
                type="button"
                class="pn-address-delete"
                data-delete="${escape(address.id)}"
                aria-label="Удалить адрес">
                ${window.pnIcon('trash', {size: 21})}
            </button>

        </div>

        <div class="pn-address-divider"></div>

        <button
            type="button"
            class="pn-address-nearby"
            data-nearby="${escape(address.id)}">

            <span class="pn-address-nearby-icon">
                ${window.pnIcon('route', {size: 27})}
            </span>

            <span class="pn-address-nearby-title">
                Парковки рядом
            </span>

            <span class="pn-address-nearby-distance">
                300 м
            </span>

            <span class="pn-address-nearby-arrow">›</span>

        </button>

        <div class="pn-address-results"
             id="pnAddressResults_${escape(address.id)}">
        </div>

    </section>
`).join('');
            container.querySelectorAll('[data-delete]').forEach(button => {
                button.addEventListener('click', () => deleteAddress(button.dataset.delete));
            });
            container.querySelectorAll('[data-nearby]').forEach(button => {
                button.addEventListener('click', () => showNearby(button.dataset.nearby, addresses));
            });
        } catch (error) {
            container.innerHTML = `<div class="pn-address-empty">${escape(error.message)}</div>`;
        }
    }
    async function showNearby(id, addresses) {
        const address = addresses.find(item => item.id === id);
        const container = document.getElementById(`pnAddressResults_${id}`);
        if (!address || !container) return;
        container.innerHTML = 'Ищем парковки поблизости...';
        try {
            const parkings = await getNearbyParkings(address);
            if (!parkings.length) {
                container.innerHTML = '<p>В радиусе 300 метров парковок не найдено.</p>';
                return;
            }
            container.innerHTML = parkings.map(parking => {
                const total = Number(parking.totalSpots) || 0;
                const occupied = Number(parking.occupiedSpots) || 0;
                const free = Math.max(0, total - occupied);
                return `
                    <button type="button" class="pn-address-parking" data-parking-id="${escape(parking.id)}">
                        <span><strong>${escape(parking.name || parking.address || 'Парковка')}</strong><small>${Math.round(parking.distance)} м · ${total > 0 ? `${free} свободно из ${total}` : 'Вместимость неизвестна'}</small></span>
                        <span>›</span>
                    </button>`;
            }).join('');
            container.querySelectorAll('[data-parking-id]').forEach(button => {
                button.addEventListener('click', () => {
                    const parkingId = button.dataset.parkingId;
                    if (typeof openFavoriteParking === 'function') {
                        openFavoriteParking(parkingId);
                    } else {
                        showPanel('map');
                    }
                });
            });
        } catch (error) {
            console.error('Ошибка поиска парковок:', error);
            container.innerHTML = `<p>${escape(error.message || 'Не удалось загрузить парковки')}</p>`;
        }
    }
})();