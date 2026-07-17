import { renderProfile } from '../views/profileView.js';
import { renderSearchPanel } from '../views/searchView.js';
import { renderFavorites } from '../views/addressView.js';

export function showPanel(type) {
    const content = document.getElementById('panelContent');
    document.getElementById('panel').classList.add('active');
    switch (type) {
        case 'profile': renderProfile(content); break;
        case 'search': renderSearchPanel(content); break;
        case 'favorites': renderFavorites(content); break;
        default: break;
    }
}

export function closePanel() {
    document.getElementById('panel').classList.remove('active');
    // сброс выделения и т.д.
}
