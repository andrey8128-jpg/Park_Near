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
    if (filters.region) {
        filtered = filtered.filter(p =>
            (p.region && p.region.toLowerCase().includes(filters.region.toLowerCase())) ||
            (p.address && p.address.toLowerCase().includes(filters.region.toLowerCase())) ||
            (p.name && p.name.toLowerCase().includes(filters.region.toLowerCase()))
        );
    }
    if (filters.city) {
        filtered = filtered.filter(p =>
            (p.city && p.city.toLowerCase().includes(filters.city.toLowerCase())) ||
            (p.address && p.address.toLowerCase().includes(filters.city.toLowerCase())) ||
            (p.name && p.name.toLowerCase().includes(filters.city.toLowerCase()))
        );
    }
    if (filters.query) {
        const q = filters.query.toLowerCase();
        filtered = filtered.filter(p =>
            (p.name && p.name.toLowerCase().includes(q)) ||
            (p.address && p.address.toLowerCase().includes(q)) ||
            (p.street && p.street.toLowerCase().includes(q)) ||
            (p.houseNumber && p.houseNumber.toLowerCase().includes(q))
        );
    }
    if (filters.nearby) {
        const { lat, lng, radius } = filters.nearby;
        filtered = filtered.filter(p => getDistanceInMeters(lat, lng, p.lat, p.lng) <= radius);
    }
    renderSearchResults(filtered);
}
