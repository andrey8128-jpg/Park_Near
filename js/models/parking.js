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

export function changeOccupancy(id, delta, userId) {
    return new Promise((resolve, reject) => {
        const parking = parkingCache[id];
        if (!parking) return reject('Парковка не найдена');
        const total = parking.totalSpots || 0;
        const cur = parking.occupiedSpots || 0;
        const newOcc = cur + delta;
        if (newOcc < 0 || newOcc > total) return reject('Некорректное значение');
        const now = Date.now();
        database.ref(`users/${userId}/car`).once('value').then(carSnap => {
            const carData = carSnap.val() || {};
            return database.ref(`parkings/${id}/occupiedSpots`).set(newOcc)
                .then(() => database.ref(`parkings/${id}/history`).push({
                    action: delta < 0 ? 'freed' : 'occupied',
                    timestamp: now,
                    userId: userId,
                    username: 'user',
                    carBrand: carData.brand || '',
                    carModel: carData.model || '',
                    carPlate: carData.plate || '',
                    previousOccupied: cur,
                    newOccupied: newOcc
                }))
                .then(() => {
                    parking.occupiedSpots = newOcc;
                    resolve(newOcc);
                });
        }).catch(reject);
    });
}

export function confirmParking(id, userId) {
    const parking = parkingCache[id];
    if (!parking) return Promise.reject('Парковка не найдена');
    if (parking.authorId !== userId) {
        return database.ref(`users/${parking.authorId}/stats/confirmations`).transaction(c => (c || 0) + 1);
    }
    return Promise.resolve();
}
