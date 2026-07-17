import { initAuth, setUser, getUser } from './models/user.js';
import { loadAllParkings } from './models/parking.js';
import { initMap, getMap, setMyLocation, addMarker, setMapType } from './services/map.js';
import { getUserLocation } from './services/geolocation.js';
import { showPanel, closePanel } from './controllers/uiController.js';
import { onParkingClick, deleteParking, changeOccupancy, buildRouteToParking } from './controllers/parkingController.js';
import { applyFilters, setNearbyFilter } from './controllers/searchController.js';
import { regionsData, carColors } from './utils/constants.js';
import { parseAddress } from './utils/helpers.js';

// Глобальные переменные для доступа из onclick и других частей
window.currentUser = null;
window.regionsData = regionsData;
window.carColors = carColors;

// Инициализация
initAuth();
window.currentUser = getUser();

// Карта
const map = initMap('map', [55.7558, 37.6173], 14);
window.map = map;

// Загрузка парковок
loadAllParkings().then(cache => {
    Object.keys(cache).forEach(key => addMarker(key, cache[key]));
});

// Геолокация
document.getElementById('geoBtn').addEventListener('click', () => {
    getUserLocation().then(coords => {
        setMyLocation(coords);
        map.setCenter([coords.lat, coords.lng], 16, { duration: 500 });
    }).catch(err => alert('Не удалось определить местоположение'));
});

// Кнопка добавления парковки
document.getElementById('addBtn').addEventListener('click', () => {
    if (!window.currentUser) showPanel('profile');
    else {
        // начало рисования зоны
        // ...
    }
});

// Глобальные функции для onclick
window.toggleLayerMenu = function() {
    document.getElementById('layerMenu').classList.toggle('active');
};
window.setMapType = function(option) {
    setMapType(option.dataset.type);
    document.querySelectorAll('.layer-option').forEach(o => o.classList.remove('selected'));
    option.classList.add('selected');
    document.getElementById('layerMenu').classList.remove('active');
};
window.closePanel = closePanel;
window.showPanel = showPanel;
window.showMap = function() { closePanel(); };
window.deleteParking = deleteParking;
window.changeOccupancy = changeOccupancy;
window.buildRouteToParking = buildRouteToParking;
window.openOccupancyPanel = function(id) {
    onParkingClick(id);
    document.getElementById('parkingSheet').classList.remove('active');
    showPanel('profile'); // временно для теста
};
window.toggleFavorite = function(id) { /* реализовать */ };
window.confirmParking = function(id) { /* реализовать */ };
window.saveParkingDetails = function() { /* реализовать */ };
window.focusMap = function(lat, lng, id) {
    closePanel();
    map.setCenter([lat, lng], 16, { duration: 300 });
};
window.filterParkings = function() {
    const query = document.getElementById('searchInput')?.value.trim() || '';
    const city = document.getElementById('citySelect')?.value || '';
    const region = document.getElementById('regionSelect')?.value || '';
    applyFilters({ query, city, region });
};
window.updateCitySelect = function() {
    const region = document.getElementById('regionSelect').value;
    const citySelect = document.getElementById('citySelect');
    citySelect.innerHTML = '<option value="">Все города</option>';
    if (region && regionsData[region]) {
        regionsData[region].forEach(city => {
            const opt = document.createElement('option');
            opt.value = city;
            opt.textContent = city;
            citySelect.appendChild(opt);
        });
    }
    window.filterParkings();
};
window.findParkingsNearAddress = function(lat, lng, addressText) {
    if (!lat || !lng) {
        if (addressText) {
            ymaps.geocode(addressText, { results: 1 }).then(res => {
                const geo = res.geoObjects.get(0);
                if (geo) {
                    const coords = geo.geometry.getCoordinates();
                    setNearbyFilter(coords[0], coords[1], 300);
                    showPanel('search');
                } else {
                    alert('Не удалось определить координаты по адресу');
                }
            }).catch(() => alert('Ошибка геокодирования'));
        } else {
            alert('Не удалось определить координаты для поиска');
        }
        return;
    }
    setNearbyFilter(lat, lng, 300);
    showPanel('search');
};
window.updateCitySelectInProfile = function(regionSelectId, citySelectId) {
    const region = document.getElementById(regionSelectId).value;
    const citySelect = document.getElementById(citySelectId);
    citySelect.innerHTML = '<option value="">Выберите город</option>';
    if (region && regionsData[region]) {
        regionsData[region].forEach(city => {
            const opt = document.createElement('option');
            opt.value = city;
            opt.textContent = city;
            citySelect.appendChild(opt);
        });
    }
};
window.saveCityPreferences = function() {
    // реализовать сохранение города в Firebase
};
window.toggleTheme = function() {
    const isDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('darkTheme', isDark);
    const mapEl = document.getElementById('map');
    if (isDark && map.getType() === 'yandex#map') {
        mapEl.style.filter = 'invert(0.82) hue-rotate(180deg) brightness(0.95) contrast(0.9) saturate(0.85)';
    } else {
        mapEl.style.filter = 'none';
    }
};
window.updateCarModels = function() {
    const brand = document.getElementById('carBrand').value;
    const modelSelect = document.getElementById('carModel');
    modelSelect.innerHTML = '<option value="">Выберите модель</option>';
    if (brand && window.carBrands[brand]) {
        window.carBrands[brand].forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            modelSelect.appendChild(opt);
        });
    }
};
window.editCarData = function() {
    // реализовать
};
window.saveCarData = function() {
    // реализовать
};
window.addHomeAddress = function() {
    // реализовать
};
window.switchAddressMethod = function(method) {
    document.querySelectorAll('.address-toggle button').forEach(b => b.classList.remove('active'));
    if (method === 'manual') {
        document.querySelector('.address-toggle button:first-child').classList.add('active');
        document.getElementById('manualAddressForm').classList.add('active');
        document.getElementById('mapAddressForm').classList.remove('active');
    } else {
        document.querySelector('.address-toggle button:last-child').classList.add('active');
        document.getElementById('mapAddressForm').classList.add('active');
        document.getElementById('manualAddressForm').classList.remove('active');
    }
};
window.updateAddrCity = function() {
    const region = document.getElementById('addrRegion').value;
    const citySelect = document.getElementById('addrCity');
    citySelect.innerHTML = '<option value="">Выберите город</option>';
    if (region && regionsData[region]) {
        regionsData[region].forEach(city => {
            const opt = document.createElement('option');
            opt.value = city;
            opt.textContent = city;
            citySelect.appendChild(opt);
        });
    }
};
window.saveAddressManually = function() {
    // реализовать
};
window.openAddressPicker = function() {
    // реализовать
};
window.cancelAddressPicker = function() {
    // реализовать
};
window.saveAddressFromPicker = function() {
    // реализовать
};
window.selectLabel = function(label) {
    // реализовать
};
window.cancelLabelPicker = function() {
    // реализовать
};
window.removeHomeAddress = function(id) {
    // реализовать
};
window.openTelegramBot = function() {
    if (window.Telegram?.WebApp?.showAlert) {
        window.Telegram.WebApp.showAlert('Запустите бота @parknear_bot');
    } else {
        window.open('https://t.me/parknear_bot', '_blank');
    }
};
window.continueAsGuest = function() {
    // реализовать
};
window.logout = function() {
    // реализовать
};

// Скрыть меню слоёв при клике вне
document.addEventListener('click', function(e) {
    const menu = document.getElementById('layerMenu');
    const btn = document.getElementById('layerSwitcher');
    if (menu.classList.contains('active') && !btn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('active');
    }
});
