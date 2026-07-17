import { database } from '../config/firebase.js';

let currentUser = null;

export function setUser(user) { currentUser = user; }
export function getUser() { return currentUser; }

export function initAuth() {
    if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready(); tg.expand();
        if (tg.initDataUnsafe?.user) {
            const user = tg.initDataUnsafe.user;
            currentUser = {
                id: 'tg_' + user.id,
                username: user.username || 'tg_user',
                firstName: user.first_name || 'Пользователь',
                photoUrl: user.photo_url || '',
                isGuest: false
            };
            localStorage.setItem('tgUser', JSON.stringify(currentUser));
        }
    }
    if (!currentUser) {
        const saved = localStorage.getItem('tgUser');
        if (saved) currentUser = JSON.parse(saved);
    }
    if (currentUser) {
        const userStatsRef = database.ref(`users/${currentUser.id}/stats`);
        userStatsRef.once('value').then(snapshot => {
            if (!snapshot.exists()) {
                const initialStats = {
                    registeredAt: Date.now(),
                    lastActive: Date.now(),
                    parkingsCreated: 0,
                    parkingsUpdated: 0,
                    confirmations: 0,
                    views: 0,
                    favorites: 0,
                    activeDates: [new Date().toISOString().split('T')[0]]
                };
                userStatsRef.set(initialStats);
            } else {
                const stats = snapshot.val();
                const today = new Date().toISOString().split('T')[0];
                let activeDates = stats.activeDates || [];
                if (!activeDates.includes(today)) activeDates.push(today);
                userStatsRef.update({ lastActive: Date.now(), activeDates: activeDates });
            }
        });
    }
    const savedTheme = localStorage.getItem('darkTheme');
    if (savedTheme === 'true') document.body.classList.add('dark-theme');
}

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
