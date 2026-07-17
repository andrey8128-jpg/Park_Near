import * as parkingModel from '../models/parking.js';
import * as mapService from '../services/map.js';
import * as routeService from '../services/route.js';
import { showPanel, closePanel } from './uiController.js';
import { renderEditPanel, renderParkingSheet } from '../views/parkingView.js';

export function onParkingClick(id) {
    const data = parkingModel.getParking(id);
    if (!data) return;
    // показать нижний лист
    renderParkingSheet(id, data);
}

export function onAddParking(coordinates) {
    // логика рисования зоны, затем открытие панели
}

export function onSaveParkingDetails(id) {
    const name = document.getElementById('editName').value;
    const total = parseInt(document.getElementById('editTotalSpots').value);
    const isPaid = document.getElementById('editIsPaid').checked;
    parkingModel.updateParking(id, { name, totalSpots: total, isPaid })
        .then(() => {
            // обновить маркер
            mapService.addMarker(id, parkingModel.getParking(id));
            closePanel();
        });
}

export function deleteParking(id) {
    // подтверждение
    parkingModel.deleteParking(id).then(() => {
        mapService.removeMarker(id);
        closePanel();
    });
}
