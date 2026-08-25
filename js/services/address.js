    // ===================== АДРЕСА =====================
    function addHomeAddress() {
        if (!currentUser) { alert('Необходимо войти'); return; }
        database.ref(`users/${currentUser.id}/homeAddresses`).once('value').then(snap => {
            if (Object.keys(snap.val() || {}).length >= 3) { alert('Максимум 3 адреса'); return; }
            openAddressPicker();
        }).catch(err => { console.error(err);
            alert('Ошибка'); });
    }
    function centerMapOnAddress(lat, lng) {
        if (!lat || !lng) return;

        closePanel();

        map.setCenter([lat, lng], 17, { duration: 500 });

        if (window._addressPreviewMarker) {
            map.geoObjects.remove(window._addressPreviewMarker);
        }

        window._addressPreviewMarker = new ymaps.Placemark([lat, lng], {
            hintContent: 'Ваш адрес',
            balloonContent: 'Вы здесь сохранили адрес'
        }, {
            preset: 'islands#redHomeIcon',
            draggable: false
        });

        map.geoObjects.add(window._addressPreviewMarker);

        setTimeout(() => {
            if (window._addressPreviewMarker) {
                map.geoObjects.remove(window._addressPreviewMarker);
                window._addressPreviewMarker = null;
            }
        }, 8000);
    }
    function openAddressPicker() {
        if (!currentUser) { alert('Необходимо войти'); return; }
        isAddressPickerOpen = true;
        document.getElementById('addressPickerOverlay').style.display = 'block';
        setTimeout(() => {
            if (!addressPickerMap) {
                addressPickerMap = new ymaps.Map('addressPickerMap', {
                    center: map.getCenter() || [55.7558, 37.6173],
                    zoom: 15,
                    controls: ['zoomControl']
                });
                addressPickerMap.events.add('click', e => setAddressPickerCoords(e.get('coords')));
                setAddressPickerCoords(addressPickerMap.getCenter());
            } else {
                addressPickerMap.container.fitToViewport();
            }
        }, 100);
    }
    function setAddressPickerCoords(coords) {
        addressPickerCoords = coords;
        if (addressPickerPlacemark) {
            addressPickerPlacemark.geometry.setCoordinates(coords);
        } else {
            addressPickerPlacemark = new ymaps.Placemark(coords, {
                hintContent: 'Ваш адрес',
                balloonContent: 'Перетащите метку'
            }, {
                preset: 'islands#redHomeIcon',
                draggable: true
            });
            addressPickerMap.geoObjects.add(addressPickerPlacemark);
            addressPickerPlacemark.events.add('dragend', () => {
                addressPickerCoords = addressPickerPlacemark.geometry.getCoordinates();
            });
        }
    }
    function cancelAddressPicker() {
        document.getElementById('addressPickerOverlay').style.display = 'none';
        isAddressPickerOpen = false;
        if (addressPickerPlacemark) {
            addressPickerMap.geoObjects.remove(addressPickerPlacemark);
            addressPickerPlacemark = null;
        }
        addressPickerCoords = null;
        pendingAddressData = null;
    }
    function saveAddressFromPicker() {
        if (!currentUser) { alert('Необходимо войти');
            cancelAddressPicker(); return; }
        if (!addressPickerCoords) { alert('Установите метку на карте'); return; }
        const saveBtn = document.querySelector('#addressPickerContainer .btn-primary');
        const origText = saveBtn.textContent;
        saveBtn.textContent = 'Обработка...';
        saveBtn.disabled = true;

        ymaps.geocode(addressPickerCoords, { kind: 'house', results: 1 })
            .then(res => {
                const geoObject = res.geoObjects.get(0);
                let addressText = '';
                let parsed = { region: '', city: '', street: '', houseNumber: '' };
                if (geoObject) {
                    addressText = geoObject.getAddressLine();
                    parsed = parseAddress(addressText);
                } else {
                    addressText =
                        `Точка (${addressPickerCoords[0].toFixed(6)}, ${addressPickerCoords[1].toFixed(6)})`;
                }
                pendingAddressData = {
                    address: addressText,
                    lat: addressPickerCoords[0],
                    lng: addressPickerCoords[1],
                    city: parsed.city,
                    street: parsed.street,
                    houseNumber: parsed.houseNumber
                };

                document.getElementById('addressPickerOverlay').style.display = 'none';
                document.getElementById('labelPickerOverlay').classList.add('active');
            })
            .catch(err => {
                console.error('Ошибка геокодирования:', err);
                pendingAddressData = {
                    address: `Точка (${addressPickerCoords[0].toFixed(6)}, ${addressPickerCoords[1].toFixed(6)})`,
                    lat: addressPickerCoords[0],
                    lng: addressPickerCoords[1],
                    city: '',
                    street: '',
                    houseNumber: ''
                };
                document.getElementById('addressPickerOverlay').style.display = 'none';
                document.getElementById('labelPickerOverlay').classList.add('active');
            })
            .finally(() => {
                saveBtn.textContent = origText;
                saveBtn.disabled = false;
            });
    }
    function selectLabel(label) {
        if (!pendingAddressData) return;
        const data = pendingAddressData;
        database.ref(`users/${currentUser.id}/homeAddresses`).once('value')
            .then(snap => {
                const count = Object.keys(snap.val() || {}).length;
                if (count >= 3) {
                    alert('Максимум 3 адреса');
                    cancelLabelPicker();
                    return;
                }
                return database.ref(`users/${currentUser.id}/homeAddresses`).push({
                    address: data.address,
                    lat: data.lat || null,
                    lng: data.lng || null,
                    label: label,
                    city: data.city || '',
                    street: data.street || '',
                    houseNumber: data.houseNumber || '',
                    timestamp: Date.now()
                });
            })
            .then(() => {
                cancelLabelPicker();
                alert('Адрес сохранён!');
                showPanel('favorites');
            })
            .catch(err => {
                console.error('Ошибка сохранения адреса:', err);
                alert('Ошибка сохранения: ' + err.message);
                cancelLabelPicker();
            });
    }
    function cancelLabelPicker() {
        document.getElementById('labelPickerOverlay').classList.remove('active');
        pendingAddressData = null;
    }
    function removeHomeAddress(addressId) {
        if (confirm('Удалить адрес?')) {
            database.ref(`users/${currentUser.id}/homeAddresses/${addressId}`).remove()
                .then(() => showPanel('favorites'))
                .catch(err => alert('Ошибка: ' + err.message));
        }
    }
    // ===================== РЕДАКТОР АДРЕСА =====================
    function openAddressEditor(addressId) {
        if (!currentUser) return;
        const overlay = document.getElementById('addressEditorOverlay');
        if (!overlay) return;
        document.getElementById('editAddrId').value = addressId;

        database.ref(`users/${currentUser.id}/homeAddresses/${addressId}`).once('value')
            .then(snap => {
                const addr = snap.val() || {};
                document.getElementById('editAddrLabel').value = addr.label || 'Дом';
                document.getElementById('editAddrCity').value = addr.city || '';
                document.getElementById('editAddrStreet').value = addr.street || '';
                document.getElementById('editAddrHouse').value = addr.houseNumber || '';
                overlay.classList.add('active');
            });
    }
    function closeAddressEditor() {
        document.getElementById('addressEditorOverlay').classList.remove('active');
    }
    function saveAddressChanges() {
        if (!currentUser) return;
        const addressId = document.getElementById('editAddrId').value;
        const label = document.getElementById('editAddrLabel').value;
        const city = document.getElementById('editAddrCity').value.trim();
        const street = document.getElementById('editAddrStreet').value.trim();
        const houseNumber = document.getElementById('editAddrHouse').value.trim();
        const fullAddress = [city, street, houseNumber ? `д. ${houseNumber}` : ''].filter(Boolean).join(', ') ||
            'Адрес не указан';
        database.ref(`users/${currentUser.id}/homeAddresses/${addressId}`).update({
            label: label,
            city: city,
            street: street,
            houseNumber: houseNumber,
            address: fullAddress
        }).then(() => {
            closeAddressEditor();
            if (document.getElementById('panel').classList.contains('active')) {
                const content = document.getElementById('panelContent');
                loadUserData('favorites', content);
            }
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
        }).catch(err => alert('Ошибка: ' + err.message));
    }
    function filterFavorites() {
        const input = document.getElementById('favSearchInput');
        if (!input) return;
        const query = input.value.trim().toLowerCase();
        const items = document.querySelectorAll('#favListContainer .fav-item');
        items.forEach(item => {
            const name = (item.dataset.name || '').toLowerCase();
            const address = (item.dataset.address || '').toLowerCase();
            if (name.includes(query) || address.includes(query)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }
    function findParkingsNearAddress(lat, lng, addressText) {
        if (lat && lng) {
            nearbySearchFilter = { lat: lat, lng: lng, radius: 300 };
            map.setCenter([lat, lng], 18, { duration: 500 });
            showPanel('search', true);
            return;
        }
        if (addressText) {
            ymaps.geocode(addressText, { results: 1 })
                .then(res => {
                    const geo = res.geoObjects.get(0);
                    if (geo) {
                        const coords = geo.geometry.getCoordinates();
                        nearbySearchFilter = { lat: coords[0], lng: coords[1], radius: 300 };
                        map.setCenter(coords, 16, { duration: 500 });
                        showPanel('search', true);
                    } else {
                        alert('Не удалось определить координаты по адресу');
                    }
                })
                .catch(() => alert('Не удалось определить координаты по адресу'));
        } else {
            alert('Не удалось определить координаты для поиска');
        }
    }
