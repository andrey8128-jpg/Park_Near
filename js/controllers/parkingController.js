import * as parkingModel from '../models/parking.js';
import * as mapService from '../services/map.js';
import * as routeService from '../services/route.js';
import { showPanel, closePanel } from './uiController.js';
import { renderEditPanel, renderParkingSheet } from '../views/parkingView.js';
import { getUser } from '../models/user.js';
import { getDistanceInMeters } from '../utils/helpers.js';

let currentParkingId = null;
let currentParkingData = null;

export function onParkingClick(id) {
    const data = parkingModel.getParking(id);
    if (!data) return;
    currentParkingId = id;
    currentParkingData = data;
    renderParkingSheet(id, data);
    // открыть bottom sheet
    document.getElementById('parkingSheet').classList.add('active');
}

export function onAddParking(coordinates) {
    // Логика рисования зоны
    // ...
}

export function onSaveParkingDetails() {
    if (!currentParkingId || !currentParkingData) return;
    const name = document.getElementById('editName').value.trim();
    const totalSpots = parseInt(document.getElementById('editTotalSpots').value);
    const isPaid = document.getElementById('editIsPaid').checked;
    if (!name) { alert('Введите название'); return; }
    if (isNaN(totalSpots) || totalSpots < 1) { alert('Количество мест должно быть больше 0'); return; }
    if (totalSpots < currentParkingData.occupiedSpots) {
        alert('Общее число мест не может быть меньше занятых.');
        return;
    }
    const updates = { name, totalSpots, isPaid };
    parkingModel.updateParking(currentParkingId, updates).then(() => {
        currentParkingData = { ...currentParkingData, ...updates };
        mapService.addMarker(currentParkingId, currentParkingData);
        closePanel();
    }).catch(err => alert('Ошибка: ' + err.message));
}

export function deleteParking(id) {
    if (!confirm('Вы уверены, что хотите удалить эту парковку?')) return;
    parkingModel.deleteParking(id).then(() => {
        mapService.removeMarker(id);
        closePanel();
    }).catch(err => alert('Ошибка: ' + err.message));
}

export function changeOccupancy(delta) {
    if (!currentParkingId || !currentParkingData) return;
    const user = getUser();
    if (!user) { alert('Необходимо авторизоваться'); return; }
    parkingModel.changeOccupancy(currentParkingId, delta, user.id)
        .then(newOcc => {
            currentParkingData.occupiedSpots = newOcc;
            mapService.addMarker(currentParkingId, currentParkingData);
            // обновить отображение
            renderEditPanel(currentParkingData, false);
        })
        .catch(err => alert(err));
}

export function buildRouteToParking(parkingId) {
    const data = parkingModel.getParking(parkingId);
    if (!data || typeof data.lat !== 'number' || typeof data.lng !== 'number') {
        alert('Ошибка: данные парковки не содержат координат');
        return;
    }
    // Получение геолокации и построение маршрута
    // ...
}
