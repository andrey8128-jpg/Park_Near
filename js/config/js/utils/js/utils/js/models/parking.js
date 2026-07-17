import { database } from '../config/firebase.js';
import { getDistanceInMeters } from '../utils/helpers.js';

let parkingCache = {};

export function loadAllParkings() {
    return database.ref('parkings').once('value').then(snapshot => {
        const data = snapshot.val();
        parkingCache = {};
        if (data) {
            Object.keys(data).forEach(key => {
                const p = data[key];
                if (p && p.lat && p.lng) parkingCache[key] = p;
            });
        }
        return parkingCache;
    });
}

export function getParking(id) { return parkingCache[id]; }
export function getCache() { return parkingCache; }

export function createParking(parkingData) {
    const newRef = database.ref('parkings').push();
    return newRef.set(parkingData).then(() => {
        parkingCache[newRef.key] = parkingData;
        return newRef.key;
    });
}

export function updateParking(id, updates) {
    return database.ref(`parkings/${id}`).update(updates).then(() => {
        if (parkingCache[id]) Object.assign(parkingCache[id], updates);
    });
}

export function deleteParking(id) {
    return database.ref(`parkings/${id}`).remove().then(() => {
        delete parkingCache[id];
    });
}

export function changeOccupancy(id, delta) {
    // реализация с учётом текущего occupiedSpots и totalSpots
    // ...
}

export function confirmParking(id, userId) {
    // ...
}
