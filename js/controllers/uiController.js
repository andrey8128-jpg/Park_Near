function showPanel(type, keepFilter = false) {
            if (type === 'search' && !keepFilter) {
                nearbySearchFilter = null;
            }
            document.getElementById('panel').classList.add('active');
            document.getElementById('panelTitle').textContent = 
                type === 'profile' ? 'Профиль' : 
                type === 'search' ? 'Поиск' : 'Избранное';
            const content = document.getElementById('panelContent');
            if (type === 'profile') renderProfile(content);
            else if (type === 'favorites') {
                content.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Загрузка...</p></div>';
                loadUserData('favorites', content);
            } else if (type === 'search') {
                renderSearchPanel(content);
            }
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            const tabIndex = type === 'profile' ? 3 : (type === 'search' ? 1 : 2);
            document.querySelectorAll('.tab')[tabIndex].classList.add('active');
        }

        function closePanel() {
            nearbySearchFilter = null;
            if (isAddressPickerOpen) cancelAddressPicker();
            closeParkingSheet(); closeRoute();
            document.getElementById('panel').classList.remove('active');
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelector('.tab:first-child').classList.add('active');
            currentParkingId = null; currentParkingData = null;
            if (editingPolygon) { map.geoObjects.remove(editingPolygon); editingPolygon = null; document.getElementById('addBtn').classList.remove('drawing'); document.getElementById('addBtn').textContent = '+'; isDrawingMode = false; const c = document.getElementById('drawingControls'); if (c) c.remove(); }
            if (clickTimeout) { clearTimeout(clickTimeout); clickTimeout = null; }
            lastClickParkingId = null; lastClickTime = 0;
            resetHighlightedParkings();
        }

        function showMap() { closePanel(); }

        function resetHighlightedParkings() {
            Object.keys(highlightedParkings).forEach(id => {
                if (mapMarkers[id]) {
                    const orig = highlightedParkings[id];
                    if (orig.fillColor) mapMarkers[id].options.set({ fillColor: orig.fillColor, strokeColor: orig.strokeColor });
                    else if (orig.preset) mapMarkers[id].options.set('preset', orig.preset);
                }
            });
            highlightedParkings = {};
        }
