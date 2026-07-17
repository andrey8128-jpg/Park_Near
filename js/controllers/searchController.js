import { getCache } from '../models/parking.js';
import { getDistanceInMeters } from '../utils/helpers.js';
import { renderSearchResults } from '../views/searchView.js';

let filters = { query: '', city: '', region: '', nearby: null };

export function applyFilters(newFilters) {
    Object.assign(filters, newFilters);
    updateResults();
}

export function setNearbyFilter(lat, lng, radius = 300) {
    filters.nearby = { lat, lng, radius };
    updateResults();
}

export function clearNearbyFilter() {
    filters.nearby = null;
    updateResults();
}

function updateResults() {
    const parkings = Object.entries(getCache()).map(([id, data]) => ({ id, ...data }));
    let filtered = parkings;
    // фильтрация по region, city, query, nearby
    if (filters.region) { /* ... */ }
    if (filters.city) { /* ... */ }
    if (filters.query) { /* ... */ }
    if (filters.nearby) {
        const { lat, lng, radius } = filters.nearby;
        filtered = filtered.filter(p => getDistanceInMeters(lat, lng, p.lat, p.lng) <= radius);
    }
    renderSearchResults(filtered);
}
