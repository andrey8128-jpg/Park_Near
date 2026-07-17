import { regionsData } from './constants.js';

export function formatDateTime(timestamp) {
    if (!timestamp) return 'Неизвестно';
    const d = new Date(timestamp);
    return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

export function getDistanceInMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

export function parseAddress(fullAddress) {
    if (!fullAddress) return { region: '', city: '', street: '', houseNumber: '' };
    let addr = fullAddress.replace(/^Россия,\s*/i, '');
    let region = '', city = '', street = '', houseNumber = '';
    const houseMatch = addr.match(/\b(?:д(?:ом)?\.?\s*)?(\d+[а-я]?(?:\s*\/\s*\d+)?(?:\s*[кк]\.?\s*\d+)?)\b/i);
    if (houseMatch) {
        houseNumber = houseMatch[1].trim();
        addr = addr.replace(houseMatch[0], '').trim();
    }
    for (const reg of Object.keys(regionsData)) {
        if (addr.includes(reg)) { region = reg; break; }
    }
    if (region) {
        const cities = regionsData[region];
        for (const c of cities) {
            if (addr.includes(c)) { city = c; break; }
        }
        if (!city && cities.includes(region)) city = region;
    } else {
        for (const reg of Object.keys(regionsData)) {
            const cities = regionsData[reg];
            for (const c of cities) {
                if (addr.includes(c)) { region = reg; city = c; break; }
            }
            if (region) break;
        }
    }
    let streetPart = addr;
    if (region) streetPart = streetPart.replace(new RegExp(region, 'i'), '').trim();
    if (city && city !== region) streetPart = streetPart.replace(new RegExp(city, 'i'), '').trim();
    streetPart = streetPart.replace(/^[, ]+/, '').replace(/[, ]+$/, '');
    if (streetPart && !streetPart.match(/^\d/)) {
        street = streetPart;
    } else {
        street = streetPart;
    }
    return { region, city, street, houseNumber };
}

export function getOccupancyColor(occupied, total) {
    const ratio = Math.min(1, total > 0 ? occupied / total : 0);
    return '#' + [Math.round(255 * ratio), Math.round(255 * (1 - ratio)), 0].map(c => c.toString(16).padStart(2, '0')).join('');
}

export function checkPolygonSize(coordinates) {
    if (!coordinates || coordinates.length < 3) return { valid: false, error: 'Минимум 3 точки' };
    const lats = coordinates.map(c => c[0]), lngs = coordinates.map(c => c[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const widthM = getDistanceInMeters(minLat, minLng, minLat, maxLng);
    const lengthM = getDistanceInMeters(minLat, minLng, maxLat, minLng);
    const MAX_ZONE_WIDTH = 100, MAX_ZONE_LENGTH = 100;
    if (widthM > MAX_ZONE_WIDTH || lengthM > MAX_ZONE_LENGTH) {
        return { valid: false, error: `Зона слишком большая! Максимум ${MAX_ZONE_WIDTH}×${MAX_ZONE_LENGTH}м. Сейчас: ${Math.round(widthM)}×${Math.round(lengthM)}м` };
    }
    return { valid: true, width: widthM, length: lengthM };
}
