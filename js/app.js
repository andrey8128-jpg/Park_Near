import { initAuth, setUser, getUser } from './models/user.js';
import { loadAllParkings } from './models/parking.js';
import { initMap, getMap, addMarker } from './services/map.js';
import { getUserLocation } from './services/geolocation.js';
import { showPanel, closePanel } from './controllers/uiController.js';
import { setNearbyFilter } from './controllers/searchController.js';
import { deleteParking } from './controllers/parkingController.js';
import { addAddress, removeAddress } from './controllers/addressController.js';
import { initSwipeDelete } from './components/swipeDelete.js';

// Делаем глобальные функции доступными из HTML
window.showPanel = showPanel;
window.closePanel = closePanel;
window.deleteParking = deleteParking;
window.addAddress = addAddress;
window.removeAddress = removeAddress;
window.setNearbyFilter = setNearbyFilter;
window.initSwipeDelete = initSwipeDelete;

// Инициализация пользователя
const user = initAuth();
if (user) {
    console.log('Пользователь:', user.firstName);
} else {
    // Гость
    console.log('Гость');
}

// Загрузка карты после готовности API
ymaps.ready(() => {
    const map = initMap('map', [55.7558, 37.6173], 14);
    window.map = map;

    // Загрузка парковок
    loadAllParkings().then(cache => {
        Object.keys(cache).forEach(id => {
            addMarker(id, cache[id]);
        });
    });

    // Кнопка геолокации
    document.getElementById('geoBtn').addEventListener('click', () => {
        getUserLocation().then(coords => {
            map.setCenter([coords.lat, coords.lng], 16, { duration: 500 });
        }).catch(alert);
    });

    // Кнопка добавления парковки (заглушка)
    document.getElementById('addBtn').addEventListener('click', () => {
        if (!getUser()) {
            showPanel('profile');
        } else {
            alert('Функция рисования зоны будет добавлена позже');
        }
    });
});

// Восстановление тёмной темы
if (localStorage.getItem('darkTheme') === 'true') {
    document.body.classList.add('dark-theme');
}

// Глобальные функции для слоёв
window.toggleLayerMenu = function() {
    document.getElementById('layerMenu').classList.toggle('active');
};
window.setMapType = function(option) {
    const map = getMap();
    if (!map) return;
    map.setType(option.dataset.type);
    document.querySelectorAll('.layer-option').forEach(o => o.classList.remove('selected'));
    option.classList.add('selected');
    document.getElementById('layerMenu').classList.remove('active');
};
window.showMap = function() {
    closePanel();
};
window.closeParkingSheet = function() {
    document.getElementById('parkingSheet').classList.remove('active');
};
window.closeRoute = function() {
    // заглушка
};
window.startNavigation = function() {
    // заглушка
};
window.rebuildRoute = function() {
    // заглушка
};
window.cancelAddressPicker = function() {
    document.getElementById('addressPickerOverlay').style.display = 'none';
};
window.saveAddressFromPicker = function() {
    alert('Функция сохранения адреса будет реализована');
};
window.selectLabel = function(label) {
    alert('Выбрана метка: ' + label);
};
window.cancelLabelPicker = function() {
    document.getElementById('labelPickerOverlay').classList.remove('active');
};

console.log('Приложение ParkNear запущено!');
