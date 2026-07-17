import * as addressModel from '../models/address.js';
import { getUser } from '../models/user.js';
import { renderAddressList } from '../views/addressView.js';

export function addAddress(addressData) {
    const user = getUser();
    if (!user) return Promise.reject('Не авторизован');
    return addressModel.addAddress(user.id, addressData);
}

export function removeAddress(addressId) {
    const user = getUser();
    if (!user) return;
    return addressModel.removeAddress(user.id, addressId);
}

export function loadAddresses() {
    const user = getUser();
    if (!user) return Promise.resolve({});
    return addressModel.loadAddresses(user.id);
}
