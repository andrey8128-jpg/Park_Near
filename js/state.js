// ===================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====================
    let map = null;
    let currentCity = null; // или 'Москва' по умолчанию
    let currentUser = null;
    let lastKnownLocation = null;
    let mapMarkers = {};
    let myLocationPlacemark = null;
    let addressPreviewMarker = null;
    let _parkingFormCoords = null;
    let _parkingFormSizeCheck = null;
    let previousZoom = null;
    let previousCenter = null;
    let drawingPolygon = null;
    let clusterer = null;
    let activePolygon = null; 
    let isDrawingMode = false;
    let currentParkingId = null;
    let currentParkingData = null;
    let originalPolyCoords = null;
    let editingParkingId = null;
    let editingPolygon = null;
    let mapCity = null;
    let currentUserId = null;
    let parkingDataCache = {};
    let highlightedParkings = {};
    let lastClickTime = 0;
    let lastDataRefresh = 0;
    const REFRESH_INTERVAL_MS = 60000;
    let lastClickParkingId = null;
    let clickTimeout = null;
    const MAX_ZONE_WIDTH = 100;
    const MAX_ZONE_LENGTH = 100;
    let addressPickerMap = null;
    let addressPickerPlacemark = null;
    let addressPickerCoords = null;
    let isAddressPickerOpen = false;
    let currentRoute = null;
    let routeStartCoords = null;
    let routeEndCoords = null;
    let routeParkingData = null;
    let userCityPrefs = { region: '', city: '' };
    let cityCoords = null;
    const CITY_RADIUS = 3000;
    let nearbySearchFilter = null;
    let userLocationForSearch = null;
    let pendingAddressData = null;
    let newParkingCoords = null;

// ===================== ВОССТАНОВЛЕНИЕ ГОРОДА =====================
const savedCity = localStorage.getItem('selectedCity');
if (savedCity) {
    currentCity = savedCity;
} else {
    currentCity = null;
}
const savedCityPrefs = localStorage.getItem('parknear_city');
if (savedCityPrefs) {
    try {
        const parsed = JSON.parse(savedCityPrefs);
        if (parsed && parsed.city) {
            userCityPrefs = {
                region: parsed.region || '',
                city: parsed.city || ''
            };
            currentCity = parsed.city;
        }
    } catch (e) {
        console.warn('⚠️ Не удалось восстановить город:', e);
    }
}
const savedCityCoords = localStorage.getItem('parknear_city_coords');
if (savedCityCoords) {
    try {
        cityCoords = JSON.parse(savedCityCoords);
    } catch (e) {
        cityCoords = null;
    }
}
console.log('🏙️ Восстановленный город:', currentCity);
console.log('🗺️ Восстановленный регион:', userCityPrefs.region);
