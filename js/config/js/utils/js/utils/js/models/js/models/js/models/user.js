import { database } from '../config/firebase.js';
import { carBrands, carColors } from '../utils/constants.js';

let currentUser = null;

export function setUser(user) { currentUser = user; }
export function getUser() { return currentUser; }

export function initAuth() { /* ... обёртка над Telegram и localStorage ... */ }

export function getUserStats(userId) {
    return database.ref(`users/${userId}/stats`).once('value').then(snap => snap.val() || {});
}

export function updateStats(userId, updates) {
    return database.ref(`users/${userId}/stats`).update(updates);
}

export function saveCar(userId, carData) {
    return database.ref(`users/${userId}/car`).set(carData);
}

export function getCar(userId) {
    return database.ref(`users/${userId}/car`).once('value').then(snap => snap.val() || {});
}
