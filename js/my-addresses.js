
(function () {
    const API = () => `${window.PARKNEAR_API_URL}/api`;
    const token = () => localStorage.getItem('parkNearSessionToken');
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
        const result = await response.json();
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
        return Array.isArray(result.profile?.homeAddresses)
            ? result.profile.homeAddresses
            : [];
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
                    <h2>Мои адреса</h2>
                    <button type="button" onclick="renderProfile(document.getElementById('panelContent'))">Закрыть</button>
                </div>
                <button type="button" class="pn-address-add" id="pnAddressAdd">＋ Добавить адрес</button>
                <div id="pnAddressesList">Загрузка адресов...</div>
            </div>`;
        document.getElementById('pnAddressAdd').addEventListener('click', addAddress);
        await renderAddresses();
    };
    async function addAddress() {
        const name = prompt('Название адреса, например: Дом или Работа');
        if (!name || !name.trim()) return;
        const addressText = prompt('Введите полный адрес');
        if (!addressText || !addressText.trim()) return;
        if (!window.ymaps || !ymaps.geocode) {
            alert('Карты ещё загружаются. Попробуйте немного позже.');
            return;
        }
        try {
            const result = await ymaps.geocode(addressText.trim(), { results: 1 });
            const geoObject = result.geoObjects.get(0);
            if (!geoObject) {
                alert('Адрес не найден. Проверьте правильность написания.');
                return;
            }
            const coords = geoObject.geometry.getCoordinates();
            const addresses = await getAddresses();
            addresses.push({
                id: `address_${Date.now()}`,
                name: name.trim(),
                address: geoObject.getAddressLine(),
                lat: Number(coords[0]),
                lng: Number(coords[1]),
                createdAt: new Date().toISOString()
            });
            await saveAddresses(addresses);
            await renderAddresses();
        } catch (error) {
            console.error('Ошибка добавления адреса:', error);
            alert(error.message || 'Не удалось сохранить адрес');
        }
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
                <section class="pn-address-card" data-address-id="${escape(address.id)}">
                    <div class="pn-address-card-head">
                        <div>
                            <strong>${escape(address.name)}</strong>
                            <p>${escape(address.address)}</p>
                        </div>
                        <button type="button" class="pn-address-delete" data-delete="${escape(address.id)}">Удалить</button>
                    </div>
                    <button type="button" class="pn-address-nearby" data-nearby="${escape(address.id)}">Показать парковки в радиусе 300 м</button>
                    <div class="pn-address-results" id="pnAddressResults_${escape(address.id)}"></div>
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