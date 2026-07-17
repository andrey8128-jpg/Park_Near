import { database } from '../config/firebase.js';

export function loadAddresses(userId) {
    return database.ref(`users/${userId}/homeAddresses`).once('value')
        .then(snap => snap.val() || {});
}

export function addAddress(userId, addressData) {
    return database.ref(`users/${userId}/homeAddresses`).push(addressData)
        .then(ref => ({ id: ref.key, ...addressData }));
}

export function removeAddress(userId, addressId) {
    return database.ref(`users/${userId}/homeAddresses/${addressId}`).remove();
}
