import { database } from './config/firebase.js';
import { initAuth, setUser, getUser } from './models/user.js';
import { loadAllParkings } from './models/parking.js';
import { initMap, getMap } from './services/map.js';
import { getUserLocation } from './services/geolocation.js';
import { showPanel } from './controllers/uiController.js';
import { applyFilters, setNearbyFilter } from './controllers/searchController.js';

// Инициализация
initAuth();
const user = getUser();
if (!user) {
    // попробовать гостя
}

// Загрузка карты
const map = initMap('map', [55.7558, 37.6173], 14);
window.map = map; // для доступа из глобального скоупа (временно)

// Загрузка парковок
loadAllParkings().then(() => {
    // добавить маркеры
});

// Кнопка геолокации
document.getElementById('geoBtn').addEventListener('click', () => {
    getUserLocation().then(coords => {
        // центрировать карту
    });
});

// Кнопка добавления парковки
document.getElementById('addBtn').addEventListener('click', () => {
    if (!user) showPanel('profile');
    else startDrawingMode();
});

// Глобальные функции для onclick (пока оставляем в window)
window.toggleLayerMenu = function() { /* ... */ };
window.setMapType = function(option) { /* ... */ };
window.closePanel = function() { /* ... */ };
window.showPanel = showPanel;
window.showMap = function() { closePanel(); };
// ... остальные глобальные привязки (можно постепенно переносить в модули)
