(function () {
    'use strict';
    const DB_NAME = 'ParkNearOfflineDB';
    const DB_VERSION = 1;
    let dbPromise = null;

    function openDB() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) {
                reject(new Error('IndexedDB не поддерживается'));
                return;
            }
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('parkingCache')) {
                    db.createObjectStore('parkingCache', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('syncQueue')) {
                    const store = db.createObjectStore('syncQueue', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    store.createIndex('createdAt', 'createdAt');
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error('База данных заблокирована другой вкладкой'));
        });
        return dbPromise;
    }
    async function saveParkings(parkings) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('parkingCache', 'readwrite');
            const store = transaction.objectStore('parkingCache');
            store.clear();
            Object.entries(parkings || {}).forEach(([id, parking]) => {
                store.put({
                    id: String(id),
                    data: parking,
                    savedAt: Date.now()
                });
            });
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    }
    async function getParkings() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const request = db.transaction('parkingCache', 'readonly')
                .objectStore('parkingCache').getAll();
            request.onsuccess = () => {
                const result = {};
                request.result.forEach(item => {
                    result[item.id] = item.data;
                });
                resolve(result);
            };
            request.onerror = () => reject(request.error);
        });
    }
    async function addToQueue(operation) {
        if (!operation || !operation.type || !operation.payload) {
            throw new Error('Некорректная операция для очереди');
        }
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('syncQueue', 'readwrite');
            const request = transaction.objectStore('syncQueue').add({
                type: operation.type,
                payload: operation.payload,
                createdAt: Date.now(),
                attempts: 0,
                status: 'pending'
            });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    async function getQueue() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const request = db.transaction('syncQueue', 'readonly')
                .objectStore('syncQueue').getAll();
            request.onsuccess = () => {
                resolve(request.result.sort((a, b) => a.createdAt - b.createdAt));
            };
            request.onerror = () => reject(request.error);
        });
    }
    async function removeFromQueue(id) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('syncQueue', 'readwrite');
            transaction.objectStore('syncQueue').delete(id);
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    }
    async function updateQueueItem(id, updates) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('syncQueue', 'readwrite');
            const store = transaction.objectStore('syncQueue');
            const request = store.get(id);
            request.onsuccess = () => {
                if (!request.result) return;
                store.put({ ...request.result, ...updates, id });
            };
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    }
    window.ParkNearOffline = {
        saveParkings,
        getParkings,
        addToQueue,
        getQueue,
        removeFromQueue,
        updateQueueItem
    };
})();
