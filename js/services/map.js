import { getParking, getCache } from '../models/parking.js';
import { getDistanceInMeters, getOccupancyColor } from '../utils/helpers.js';

let mapInstance = null;
let markers = {};
let myLocationPlacemark = null;

export function initMap(containerId, center, zoom) {
    mapInstance = new ymaps.Map(containerId, { center, zoom, controls: ['zoomControl'] });
    return mapInstance;
}

export function getMap() { return mapInstance; }

export function addMarker(id, data) {
    if (markers[id]) return;
    const totalSpots = data.totalSpots || 0, occupiedSpots = data.occupiedSpots || 0, freeSpots = totalSpots - occupiedSpots;
    const color = getOccupancyColor(occupiedSpots, totalSpots);
    let placemark;
    if (data.coordinates && data.coordinates.length >= 3) {
        placemark = new ymaps.Polygon([data.coordinates], {
            hintContent: `${data.name} (${freeSpots} св.)`
        }, {
            fillColor: color + '55',
            strokeColor: color,
            strokeWidth: 2
        });
    } else {
        placemark = new ymaps.Placemark([data.lat, data.lng], {
            hintContent: `${data.name} (${freeSpots} св.)`
        }, {
            preset: 'islands#blueParkingIcon'
        });
    }
    // Сохраняем обработчик клика отдельно, чтобы можно было удалить
    const clickHandler = (e) => {
        // Здесь будет вызов контроллера, пока оставляем заглушку
        // window.openParkingPanel(id);
    };
    placemark.events.add('click', clickHandler);
    mapInstance.geoObjects.add(placemark);
    markers[id] = placemark;
    return placemark;
}

export function removeMarker(id) {
    if (markers[id]) {
        mapInstance.geoObjects.remove(markers[id]);
        delete markers[id];
    }
}

export function setMyLocation(coords) {
    if (myLocationPlacemark) mapInstance.geoObjects.remove(myLocationPlacemark);
    myLocationPlacemark = new ymaps.Placemark([coords.lat, coords.lng], {
        hintContent: 'Вы здесь',
        balloonContent: '<strong>Ваше местоположение</strong>'
    }, {
        preset: 'islands#blueCircleDotIconWithCaption'
    });
    myLocationPlacemark.properties.set('caption', 'Вы здесь');
    mapInstance.geoObjects.add(myLocationPlacemark);
}

export function setMapType(type) {
    if (!mapInstance) return;
    mapInstance.setType(type);
    const mapEl = document.getElementById('map');
    if (type === 'yandex#map' && document.body.classList.contains('dark-theme')) {
        mapEl.style.filter = 'invert(0.82) hue-rotate(180deg) brightness(0.95) contrast(0.9) saturate(0.85)';
    } else {
        mapEl.style.filter = 'none';
    }
}

export function highlightNearby(lat, lng, radius) {
    // Реализация подсветки парковок в радиусе
    // ...
}
