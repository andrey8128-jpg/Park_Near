 // ===== СОЗДАЁМ КЛАСТЕРИЗАТОР =====
        clusterer = new ymaps.Clusterer({
            gridSize: 128,
            minClusterSize: 2,
            maxZoom: 17,

            clusterIconLayout:
                ymaps.templateLayoutFactory.createClass(
                    '<div style="' +
                        'width:44px;' +
                        'height:44px;' +
                        'border-radius:50% 50% 50% 0;' +
                        'background:#2B7574;' +
                        'display:flex;' +
                        'align-items:center;' +
                        'justify-content:center;' +
                        'transform:rotate(-45deg);' +
                        'box-shadow:0 2px 8px rgba(0,0,0,0.3);' +
                    '">' +
                        '{{ content }}' +
                    '</div>'
                ),

            clusterIconContentLayout:
                ymaps.templateLayoutFactory.createClass(
                    '<div style="' +
                        'color:#fff;' +
                        'font-weight:700;' +
                        'font-size:15px;' +
                        'line-height:44px;' +
                        'width:44px;' +
                        'height:44px;' +
                        'text-align:center;' +
                        'transform:rotate(45deg);' +
                    '">' +
                        '{{ properties.freeSpots || "0" }}' +
                    '</div>'
                ),

            clusterBalloonContentLayout:
                ymaps.templateLayoutFactory.createClass(
                    '<div style="' +
                        'max-height:150px;' +
                        'overflow-y:auto;' +
                        'padding:6px 10px;' +
                        'font-size:13px;' +
                    '">' +

                        '{% for geoObject in properties.geoObjects %}' +

                            '<div style="' +
                                'padding:6px 8px;' +
                                'border-bottom:1px solid #eee;' +
                                'cursor:pointer;' +
                            '" onclick="' +
                                'openCenterSheet(' +
                                '\'{{ geoObject.properties.parkingId }}\',' +
                                'window.parkingDataCache[' +
                                '\'{{ geoObject.properties.parkingId }}\'' +
                                '])' +
                            '">' +

                                '<div style="font-weight:600;">' +
                                    '{{ geoObject.properties.name }}' +
                                '</div>' +

                                '<div style="font-size:12px;color:var(--text-secondary);">' +
                                    '🅿️ Свободно: ' +
                                    '{{ geoObject.properties.freeSpots }}' +
                                    ' / ' +
                                    '{{ geoObject.properties.totalSpots }}' +
                                '</div>' +

                            '</div>' +

                        '{% endfor %}' +

                    '</div>'
                )
        });

        // ===== ОБРАБОТЧИК КЛАСТЕРИЗАЦИИ – суммируем места =====
        clusterer.events.add(
            'clusterize',
            function(e) {
                const clusters = e.get('clusters');
                if (!clusters) return;
                clusters.forEach(function(cluster) {
                    const geoObjects = cluster.getGeoObjects();
                    let totalSpots = 0;
                    let freeSpots = 0;
                    let parkingCount = 0;
                    geoObjects.forEach(function(placemark) {
                        const total = Number(placemark.properties.get('totalSpots')) || 0;
                        const free = Number(placemark.properties.get('freeSpots')) || 0;
                        totalSpots += total;
                        freeSpots += free;
                        parkingCount++;
                    });
                    cluster.properties.set('totalSpots', totalSpots);
                    cluster.properties.set('freeSpots', freeSpots);
                    cluster.properties.set('parkingCount', parkingCount);
                });
            }
        );

        // ===== ДОБАВЛЯЕМ КЛАСТЕРИЗАТОР НА КАРТУ =====
        map.geoObjects.add(clusterer);

        // ===== Обработчик клика на кластер (приближение) =====
        clusterer.events.add('click', function(e) {
            var cluster = e.get('target');
            var coords = cluster.geometry.getCoordinates();
            map.setCenter(coords, 16, { duration: 300, checkZoomRange: true });
        });
