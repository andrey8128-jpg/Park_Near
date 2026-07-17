import { getMap } from './map.js';
import { getDistanceInMeters } from '../utils/helpers.js';

let currentRoute = null;
let routeData = {};

export function buildRoute(from, to) {
    return ymaps.route([from, to], { mapStateAutoApply: false });
}

export function showRoute(route) {
    const map = getMap();
    if (currentRoute) map.geoObjects.remove(currentRoute);
    map.geoObjects.add(route);
    currentRoute = route;
}

export function clearRoute() {
    if (currentRoute) {
        getMap().geoObjects.remove(currentRoute);
        currentRoute = null;
    }
}

export function getRouteInfo(route) {
    const paths = route.getPaths();
    if (paths && paths.length > 0) {
        const active = paths[0];
        return {
            distance: active.getLength() / 1000,
            time: active.getTime() / 60,
            arrival: new Date(Date.now() + active.getTime() * 1000)
        };
    }
    return null;
}

export function showDirectLine(from, to, data) {
    const map = getMap();
    if (currentRoute) map.geoObjects.remove(currentRoute);
    const line = new ymaps.Polyline([from, to], {}, {
        strokeColor: '#007AFF',
        strokeWidth: 4,
        strokeOpacity: 0.8
    });
    map.geoObjects.add(line);
    currentRoute = line;
    const dist = getDistanceInMeters(from[0], from[1], to[0], to[1]) / 1000;
    const time = Math.round(dist * 2);
    return { distance: dist, time: time };
}

export function openNavigator(lat, lng) {
    window.open(`https://yandex.com/navi/?build=full&lat=${lat}&lon=${lng}`, '_blank');
}
