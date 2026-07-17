import { renderProfile } from '../views/profileView.js';
import { renderSearchPanel } from '../views/searchView.js';
import { renderFavorites } from '../views/addressView.js';

export function showPanel(type) {
    const content = document.getElementById('panelContent');
    document.getElementById('panel').classList.add('active');
    document.getElementById('panelTitle').textContent =
        type === 'profile' ? 'Профиль' :
        type === 'search' ? 'Поиск' : 'Избранное';
    switch (type) {
        case 'profile': renderProfile(content); break;
        case 'search': renderSearchPanel(content); break;
        case 'favorites': renderFavorites(content); break;
        default: break;
    }
    // Подсветка таба
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const tabIndex = type === 'profile' ? 3 : (type === 'search' ? 1 : 2);
    document.querySelectorAll('.tab')[tabIndex].classList.add('active');
}

export function closePanel() {
    document.getElementById('panel').classList.remove('active');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.tab:first-child').classList.add('active');
    // сброс текущих данных
    // ...
}
