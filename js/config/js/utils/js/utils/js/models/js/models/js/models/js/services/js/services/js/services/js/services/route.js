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
    // обновление информации в UI (вызывается из контроллера)
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
