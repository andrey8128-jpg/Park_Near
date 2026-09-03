  // ===================== FIREBASE =====================
    const firebaseConfig = {
        apiKey: "AIzaSyATLX5t2lmibbuiSXL_sWu_JnFFTb-nMqU",
        authDomain: "parknear-bef41.firebaseapp.com",
        databaseURL: "https://parknear-bef41-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "parknear-bef41",
        storageBucket: "parknear-bef41.firebasestorage.app",
        messagingSenderId: "1066552333578",
        appId: "1:1066552333578:web:e60e333cf877852eba16f3"
    };
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    // ===== Восстановление темы (с сохранением правильных цветов маркеров) =====
   (function restoreTheme() {
    const darkTheme = localStorage.getItem('darkTheme');
    const isDark = darkTheme === '1';
    if (isDark) {
        document.body.classList.add('dark-theme');
        if (!document.getElementById('dark-map-style')) {
            const mapStyle = document.createElement('style');
            mapStyle.id = 'dark-map-style';
            mapStyle.textContent = `
                .dark-theme #map .ymaps-2-1-game-layer,
                .dark-theme #map [class*="ymaps-2-1-17-events-pane"] {
                    filter: invert(0.9) hue-rotate(180deg) brightness(0.9) contrast(0.9) saturate(0.8) !important;
                }
            `;
            document.head.appendChild(mapStyle);
        }
        if (window.Telegram?.WebApp) {
            try {
                window.Telegram.WebApp.setHeaderColor('#1C1C1E');
                window.Telegram.WebApp.setBackgroundColor('#000000');
            } catch (e) {
                console.warn('Не удалось изменить цвета Telegram:', e);
            }
        }
    }
    const toggle1 = document.getElementById('settingsThemeToggle');
    const toggle2 = document.getElementById('settingsThemeToggleInline');
    if (toggle1) toggle1.checked = isDark;
    if (toggle2) toggle2.checked = isDark;
})();
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
const savedMapPrefs = localStorage.getItem('parknear_map_city');
if (savedCity) {
    currentCity = savedCity;
    try {
        const prefs = JSON.parse(savedMapPrefs || '{}');
        mapCity = {
            city: prefs.city || savedCity,
            region: prefs.region || ''
        };
    } catch (e) {
        console.warn('⚠️ Не удалось восстановить город карты:', e);
        mapCity = {
            city: savedCity,
            region: ''
        };
    }
} else {
    currentCity = '';
    mapCity = null;
}
console.log('🏙️ Город карты:', currentCity);
    // ===================== КОНСТАНТЫ =====================
    const carBrands = {
        'Lada': ['Vesta', 'Vesta Cross', 'Vesta SW', 'Vesta SW Cross', 'Granta', 'Granta Cross', 'Niva Legend',
            'Niva Travel', 'Largus', 'Largus Cross', 'XRAY', 'XRAY Cross', 'Priora', 'Kalina', '2114', '2107', '4x4'
        ],
        'УАЗ': ['Patriot', 'Patriot Expedition', 'Patriot Profi', 'Pickup', 'Hunter', 'Bukhanka', 'Profi'],
        'ГАЗ': ['Gazelle Next', 'Gazelle NN', 'Sobol NN', 'Sobol', 'Gazelle Business', 'Sadko Next', 'Vepr Next'],
        'Audi': ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron', 'e-tron GT', 'R8',
            'TT'
        ],
        'BMW': ['1 Series', '2 Series', '3 Series', '4 Series', '5 Series', '6 Series', '7 Series', '8 Series', 'X1',
            'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'i3', 'i4', 'iX', 'i7', 'Z4', 'M2', 'M3', 'M4', 'M5', 'M8'
        ],
        'Mercedes-Benz': ['A-Class', 'AMG GT', 'B-Class', 'C-Class', 'CLA', 'CLS', 'E-Class', 'EQA', 'EQB', 'EQC',
            'EQE', 'EQS', 'G-Class', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'S-Class', 'SL', 'V-Class'
        ],
        'Volkswagen': ['Arteon', 'Atlas', 'Caddy', 'Golf', 'ID.3', 'ID.4', 'ID.5', 'ID.6', 'ID.Buzz', 'Jetta',
            'Multivan', 'Passat', 'Polo', 'Taos', 'T-Cross', 'Teramont', 'Tiguan', 'Touareg', 'Touran', 'Transporter'
        ],
        'Toyota': ['4Runner', 'Alphard', 'Avalon', 'Camry', 'Corolla', 'Corolla Cross', 'Crown', 'Fortuner', 'GR86',
            'Harrier', 'Highlander', 'Hilux', 'Land Cruiser', 'Land Cruiser Prado', 'Mirai', 'Prius', 'RAV4',
            'Sequoia', 'Sienna', 'Supra', 'Tundra', 'Venza', 'Yaris', 'bZ4X'
        ],
        'Honda': ['Accord', 'Civic', 'CR-V', 'Fit', 'HR-V', 'Insight', 'Odyssey', 'Passport', 'Pilot', 'Ridgeline',
            'Stepwgn', 'Vezel'
        ],
        'Nissan': ['Almera', 'Altima', 'Ariya', 'Juke', 'Kicks', 'Leaf', 'Murano', 'Navara', 'Note', 'NV200',
            'Pathfinder', 'Patrol', 'Qashqai', 'Rogue', 'Sentra', 'Skyline', 'Terrano', 'Tiida', 'X-Trail', 'Z'
        ],
        'Hyundai': ['Bayon', 'Creta', 'Elantra', 'Ioniq 5', 'Ioniq 6', 'Kona', 'Palisade', 'Santa Cruz', 'Santa Fe',
            'Solaris', 'Sonata', 'Staria', 'Tucson', 'Venue'
        ],
        'Kia': ['Carnival', 'Ceed', 'Cerato', 'EV6', 'K5', 'K900', 'Mohave', 'Niro', 'Optima', 'Picanto', 'Rio',
            'Seltos', 'Sorento', 'Soul', 'Sportage', 'Stinger', 'Telluride', 'Xceed'
        ],
        'Renault': ['Arkana', 'Captur', 'Clio', 'Dokker', 'Duster', 'Fluence', 'Kangoo', 'Kaptur', 'Kiger', 'Koleos',
            'Laguna', 'Logan', 'Master', 'Megane', 'Sandero', 'Symbol', 'Taliant', 'Trafic', 'Twingo', 'Zoe'
        ],
        'Skoda': ['Enyaq iV', 'Fabia', 'Kamiq', 'Karoq', 'Kodiaq', 'Octavia', 'Rapid', 'Scala', 'Superb'],
        'Mazda': ['CX-3', 'CX-30', 'CX-5', 'CX-50', 'CX-60', 'CX-9', 'Mazda2', 'Mazda3', 'Mazda6', 'MX-5'],
        'Ford': ['Bronco', 'EcoSport', 'Escape', 'Everest', 'Explorer', 'F-150', 'Fiesta', 'Focus', 'Fusion',
            'Galaxy', 'Kuga', 'Maverick', 'Mondeo', 'Mustang', 'Mustang Mach-E', 'Ranger', 'S-MAX', 'Territory',
            'Tourneo', 'Transit'
        ],
        'Chevrolet': ['Aveo', 'Camaro', 'Captiva', 'Cobalt', 'Corvette', 'Cruze', 'Equinox', 'Lacetti', 'Malibu',
            'Niva', 'Orlando', 'Spark', 'Suburban', 'Tahoe', 'Trailblazer', 'Traverse', 'Tracker', 'Trax'
        ],
        'Chery': ['Arrizo 8', 'Tiggo 4', 'Tiggo 7 Pro', 'Tiggo 8 Pro', 'OMODA 5', 'Tiggo 8 Pro Max'],
        'Geely': ['Atlas Pro', 'Atlas', 'Coolray', 'Emgrand GT', 'Monjaro', 'Okavango', 'Preface', 'Tugella'],
        'Haval': ['Dargo', 'F7', 'F7x', 'H9', 'Jolion', 'M6'],
        'Exeed': ['LX', 'TXL', 'VX', 'RX'],
        'Changan': ['CS35 Plus', 'CS55 Plus', 'CS75 Plus', 'UNI-K', 'UNI-T', 'UNI-V', 'Eado Plus'],
        'Jetour': ['Dashing', 'X70', 'X90', 'X95'],
        'GAC': ['GS3', 'GS5', 'GS8', 'M8', 'GN8'],
        'Mitsubishi': ['ASX', 'Colt', 'Eclipse Cross', 'L200', 'Lancer X', 'Lancer IX', 'Outlander', 'Pajero',
            'Pajero Sport', 'Xpander'
        ],
        'Subaru': ['Ascent', 'BRZ', 'Forester', 'Impreza', 'Legacy', 'Levorg', 'Outback', 'Solterra', 'WRX', 'XV'],
        'Suzuki': ['Alto', 'Baleno', 'Celerio', 'Grand Vitara', 'Ignis', 'Jimny', 'S-Cross', 'Swift', 'Vitara',
            'Wagon R', 'XL7'
        ],
        'Lexus': ['ES', 'GX', 'IS', 'LC', 'LS', 'LX', 'NX', 'RC', 'RX', 'RZ', 'UX'],
        'Infiniti': ['Q50', 'QX50', 'QX55', 'QX60', 'QX80'],
        'Genesis': ['G70', 'G80', 'G90', 'GV60', 'GV70', 'GV80'],
        'Porsche': ['718 Boxster', '718 Cayman', '911', 'Cayenne', 'Macan', 'Panamera', 'Taycan'],
        'Jaguar': ['E-Pace', 'F-Pace', 'F-Type', 'I-Pace', 'XE', 'XF'],
        'Land Rover': ['Defender', 'Discovery', 'Discovery Sport', 'Range Rover', 'Range Rover Evoque',
            'Range Rover Sport', 'Range Rover Velar'
        ],
        'Volvo': ['C40', 'EX30', 'EX90', 'S60', 'S90', 'V60', 'V90', 'XC40', 'XC60', 'XC90'],
        'Tesla': ['Cybertruck', 'Model 3', 'Model S', 'Model X', 'Model Y'],
        'Ferrari': ['296 GTB', '488', '812 Superfast', 'F8 Tributo', 'Portofino', 'Roma', 'SF90 Stradale'],
        'Lamborghini': ['Aventador', 'Huracan', 'Urus'],
        'Bentley': ['Bentayga', 'Continental GT', 'Flying Spur', 'Mulsanne'],
        'Rolls-Royce': ['Cullinan', 'Dawn', 'Ghost', 'Phantom', 'Wraith'],
        'Maserati': ['Ghibli', 'Grecale', 'Levante', 'MC20', 'Quattroporte'],
        'Mini': ['Clubman', 'Convertible', 'Countryman', 'Hatch', 'John Cooper Works'],
        'Jeep': ['Cherokee', 'Compass', 'Gladiator', 'Grand Cherokee', 'Renegade', 'Wagoneer', 'Wrangler'],
        'Dodge': ['Challenger', 'Charger', 'Durango', 'Journey', 'Ram'],
        'Chrysler': ['300', 'Pacifica', 'Voyager'],
        'Cadillac': ['CT4', 'CT5', 'Escalade', 'XT4', 'XT5', 'XT6'],
        'Peugeot': ['2008', '3008', '308', '408', '5008', '508', 'Boxer', 'Expert', 'Landtrek', 'Partner', 'Rifter',
            'Traveller'
        ],
        'Citroen': ['C3', 'C4', 'C5 Aircross', 'Berlingo', 'C-Elysee'],
        'Opel': ['Astra', 'Combo', 'Corsa', 'Crossland', 'Grandland', 'Insignia', 'Mokka', 'Zafira'],
        'Fiat': ['500', 'Doblo', 'Ducato', 'Punto', 'Tipo'],
        'Alfa Romeo': ['Giulia', 'Stelvio', 'Tonale'],
        'SEAT': ['Alhambra', 'Arona', 'Ateca', 'Ibiza', 'Leon', 'Tarraco'],
        'Smart': ['Fortwo', 'Forfour'],
        'SsangYong': ['Korando', 'Rexton', 'Tivoli', 'Torres'],
        'Zotye': ['T600', 'Z300'],
        'Brilliance': ['H230', 'H530', 'V5'],
        'Lifan': ['Myway', 'Solano', 'X50', 'X60', 'X70'],
        'Другая': ['Другая модель']
    };
    const carColors = {
        'Белый': '#FFFFFF',
        'Чёрный': '#000000',
        'Серебристый': '#C0C0C0',
        'Серый': '#808080',
        'Красный': '#FF0000',
        'Синий': '#0000FF',
        'Тёмно-синий': '#00008B',
        'Зелёный': '#008000',
        'Тёмно-зелёный': '#006400',
        'Жёлтый': '#FFFF00',
        'Оранжевый': '#FFA500',
        'Коричневый': '#8B4513',
        'Бежевый': '#F5F5DC',
        'Золотой': '#FFD700',
        'Бронзовый': '#CD7F32',
        'Бордовый': '#800020',
        'Фиолетовый': '#800080',
        'Голубой': '#87CEEB',
        'Розовый': '#FFC0CB',
        'Другой': '#808080'
    };
    const regionsData = {
        "Москва": ["Москва", "Зеленоград", "Троицк", "Щербинка", "Московский", "Внуково", "Кокошкино", "Киевский",
            "Первомайское", "Коммунарка"
        ],
        "Санкт-Петербург": ["Санкт-Петербург", "Пушкин", "Петергоф", "Колпино", "Кронштадт", "Сестрорецк", "Ломоносов",
            "Павловск", "Красное Село", "Шушары"
        ],
        "Севастополь": ["Севастополь", "Инкерман", "Балаклава", "Кача", "Орлиное"],
        "Московская область": ["Балашиха", "Подольск", "Химки", "Мытищи", "Королёв", "Люберцы", "Красногорск",
            "Электросталь", "Коломна", "Одинцово", "Домодедово", "Серпухов", "Раменское", "Жуковский", "Пушкино",
            "Ногинск", "Долгопрудный", "Реутов", "Видное", "Лобня", "Ивантеевка", "Дубна", "Егорьевск", "Чехов",
            "Дмитров", "Ступино", "Павловский Посад", "Клин", "Фрязино", "Лыткарино", "Воскресенск", "Солнечногорск",
            "Наро-Фоминск", "Истра", "Шатура", "Луховицы", "Кашира", "Краснознаменск", "Протвино", "Пущино", "Озёры",
            "Черноголовка", "Электрогорск", "Куровское", "Волоколамск", "Зарайск", "Серебряные Пруды", "Талдом",
            "Рошаль", "Бронницы", "Можайск", "Дзержинский", "Котельники", "Лосино-Петровский", "Апрелевка",
            "Голицыно", "Дедовск", "Кубинка", "Белоозёрский", "Яхрома", "Пересвет", "Красноармейск", "Хотьково",
            "Барвиха", "Усово", "Нахабино", "Томилино", "Малаховка", "Красково", "Быково", "Софрино", "Правдинский",
            "Монино"
        ],
        "Ленинградская область": ["Гатчина", "Выборг", "Всеволожск", "Сосновый Бор", "Тихвин", "Кириши", "Кингисепп",
            "Волхов", "Сертолово", "Луга", "Тосно", "Сланцы", "Приозерск", "Коммунар", "Никольское", "Бокситогорск",
            "Подпорожье", "Лодейное Поле", "Пикалёво", "Шлиссельбург", "Сясьстрой", "Волосово", "Ивангород",
            "Новая Ладога", "Каменногорск", "Кудрово", "Мурино", "Янино-1", "Сиверский", "Вырица"
        ],
        "Республика Крым": ["Симферополь", "Керчь", "Ялта", "Евпатория", "Феодосия", "Алушта", "Бахчисарай", "Саки",
            "Джанкой", "Красноперекопск", "Армянск", "Судак", "Белогорск", "Щёлкино", "Черноморское", "Гурзуф",
            "Ливадия", "Массандра", "Форос", "Симеиз", "Алупка", "Кореиз", "Гаспра", "Партенит", "Николаевка",
            "Оленевка"
        ],
        "Краснодарский край": ["Краснодар", "Сочи", "Новороссийск", "Армавир", "Анапа", "Геленджик", "Туапсе", "Ейск",
            "Кропоткин", "Славянск-на-Кубани", "Тихорецк", "Лабинск", "Крымск", "Тимашёвск", "Белореченск",
            "Курганинск", "Усть-Лабинск", "Кореновск", "Апшеронск", "Горячий Ключ", "Темрюк", "Приморско-Ахтарск",
            "Гулькевичи", "Абинск", "Адлер", "Лазаревское", "Дагомыс", "Красная Поляна", "Витязево", "Джубга",
            "Кабардинка", "Дивноморское", "Архипо-Осиповка", "Небуг", "Ольгинка", "Варениковская", "Раевская",
            "Каневская", "Павловская", "Ленинградская"
        ],
        "Республика Адыгея": ["Майкоп", "Яблоновский", "Энем", "Гиагинская", "Кошехабль", "Красногвардейское",
            "Тахтамукай", "Адыгейск"
        ],
        "Ростовская область": ["Ростов-на-Дону", "Таганрог", "Шахты", "Волгодонск", "Новочеркасск", "Батайск",
            "Новошахтинск", "Азов", "Каменск-Шахтинский", "Миллерово", "Сальск", "Аксай", "Чалтырь", "Кулешовка",
            "Самарское"
        ],
        "Ставропольский край": ["Ставрополь", "Пятигорск", "Кисловодск", "Ессентуки", "Невинномысск", "Михайловск",
            "Железноводск", "Будённовск", "Георгиевск", "Изобильный", "Светлоград", "Зеленокумск", "Благодарный",
            "Ипатово", "Новоалександровск", "Минеральные Воды"
        ],
        "Волгоградская область": ["Волгоград", "Волжский", "Камышин", "Михайловка", "Урюпинск", "Фролово",
            "Калач-на-Дону", "Котово", "Городище", "Дубовка", "Николаевск", "Средняя Ахтуба"
        ],
        "Саратовская область": ["Саратов", "Энгельс", "Балаково", "Балашов", "Вольск", "Пугачёв", "Ртищево", "Маркс",
            "Красноармейск", "Петровск", "Ершов", "Аткарск", "Калининск"
        ],
        "Самарская область": ["Самара", "Тольятти", "Сызрань", "Новокуйбышевск", "Чапаевск", "Жигулёвск", "Отрадный",
            "Кинель", "Похвистнево", "Октябрьск", "Безенчук", "Суходол"
        ],
        "Нижегородская область": ["Нижний Новгород", "Дзержинск", "Арзамас", "Саров", "Бор", "Кстово", "Павлово",
            "Выкса", "Балахна", "Заволжье", "Кулебаки", "Богородск", "Семёнов", "Лысково", "Городец"
        ],
        "Республика Татарстан": ["Казань", "Набережные Челны", "Нижнекамск", "Альметьевск", "Зеленодольск",
            "Бугульма", "Елабуга", "Лениногорск", "Чистополь", "Заинск", "Азнакаево", "Нурлат", "Бавлы",
            "Менделеевск", "Кукмор", "Васильево"
        ],
        "Республика Башкортостан": ["Уфа", "Стерлитамак", "Салават", "Нефтекамск", "Октябрьский", "Туймазы",
            "Белорецк", "Ишимбай", "Кумертау", "Сибай", "Белебей", "Бирск", "Учалы", "Янаул", "Чишмы", "Мелеуз"
        ],
        "Пермский край": ["Пермь", "Березники", "Соликамск", "Чайковский", "Кунгур", "Лысьва", "Краснокамск",
            "Чусовой", "Добрянка", "Чернушка", "Кудымкар", "Оса", "Губаха", "Верещагино"
        ],
        "Свердловская область": ["Екатеринбург", "Нижний Тагил", "Каменск-Уральский", "Первоуральск", "Серов",
            "Новоуральск", "Асбест", "Ревда", "Верхняя Пышма", "Краснотурьинск", "Берёзовский", "Лесной",
            "Полевской", "Верхняя Салда", "Среднеуральск"
        ],
        "Челябинская область": ["Челябинск", "Магнитогорск", "Златоуст", "Миасс", "Копейск", "Озёрск", "Троицк",
            "Снежинск", "Сатка", "Чебаркуль", "Кыштым", "Южноуральск", "Коркино", "Еманжелинск", "Верхний Уфалей"
        ],
        "Тюменская область": ["Тюмень", "Тобольск", "Ишим", "Ялуторовск", "Заводоуковск", "Голышманово",
            "Богандинский", "Винзили", "Боровский"
        ],
        "ХМАО — Югра": ["Ханты-Мансийск", "Сургут", "Нижневартовск", "Нефтеюганск", "Когалым", "Мегион", "Лангепас",
            "Радужный", "Урай", "Пыть-Ях", "Лянтор", "Югорск", "Пойковский", "Фёдоровский"
        ],
        "ЯНАО": ["Салехард", "Новый Уренгой", "Ноябрьск", "Надым", "Губкинский", "Муравленко", "Тарко-Сале",
            "Пангоды"
        ],
        "Омская область": ["Омск", "Тара", "Калачинск", "Исилькуль", "Называевск", "Тюкалинск", "Черлак", "Крутинка",
            "Любинский"
        ],
        "Новосибирская область": ["Новосибирск", "Бердск", "Искитим", "Куйбышев", "Обь", "Барабинск", "Карасук",
            "Черепаново", "Татарск", "Краснообск", "Кольцово"
        ],
        "Кемеровская область": ["Кемерово", "Новокузнецк", "Прокопьевск", "Междуреченск", "Ленинск-Кузнецкий",
            "Юрга", "Киселёвск", "Белово", "Анжеро-Судженск", "Мариинск", "Тайга", "Топки", "Осинники", "Полысаево"
        ],
        "Красноярский край": ["Красноярск", "Норильск", "Ачинск", "Канск", "Железногорск", "Минусинск",
            "Зеленогорск", "Лесосибирск", "Назарово", "Сосновоборск", "Дивногорск", "Дудинка", "Шарыпово",
            "Боготол", "Енисейск"
        ],
        "Иркутская область": ["Иркутск", "Братск", "Ангарск", "Усть-Илимск", "Усолье-Сибирское", "Черемхово",
            "Шелехов", "Саянск", "Тулун", "Нижнеудинск", "Тайшет", "Зима", "Железногорск-Илимский"
        ],
        "Приморский край": ["Владивосток", "Уссурийск", "Находка", "Артём", "Арсеньев", "Большой Камень",
            "Спасск-Дальний", "Партизанск", "Лесозаводск", "Дальнегорск", "Фокино", "Славянка", "Чугуевка"
        ],
        "Хабаровский край": ["Хабаровск", "Комсомольск-на-Амуре", "Амурск", "Советская Гавань",
            "Николаевск-на-Амуре", "Бикин", "Вяземский", "Чегдомын", "Эльбан"
        ],
        "Калининградская область": ["Калининград", "Советск", "Черняховск", "Балтийск", "Гусев", "Зеленоградск",
            "Светлый", "Гурьевск", "Пионерский", "Мамоново", "Неман", "Светлогорск", "Янтарный"
        ],
        "Воронежская область": ["Воронеж", "Борисоглебск", "Россошь", "Лиски", "Нововоронеж", "Острогожск",
            "Павловск", "Бутурлиновка", "Семилуки", "Калач", "Бобров", "Новая Усмань", "Рамонь"
        ],
        "Белгородская область": ["Белгород", "Старый Оскол", "Губкин", "Шебекино", "Алексеевка", "Валуйки",
            "Строитель", "Новый Оскол", "Чернянка", "Борисовка"
        ],
        "Тульская область": ["Тула", "Новомосковск", "Узловая", "Алексин", "Щёкино", "Ефремов", "Донской", "Кимовск",
            "Богородицк", "Киреевск", "Плавск", "Ленинский"
        ],
        "Калужская область": ["Калуга", "Обнинск", "Людиново", "Киров", "Малоярославец", "Балабаново", "Козельск",
            "Жуков", "Кондрово", "Сухиничи", "Боровск"
        ],
        "Ярославская область": ["Ярославль", "Рыбинск", "Тутаев", "Переславль-Залесский", "Углич", "Ростов",
            "Гаврилов-Ям", "Данилов", "Пошехонье", "Мышкин"
        ],
        "Тверская область": ["Тверь", "Ржев", "Вышний Волочёк", "Кимры", "Торжок", "Бологое", "Осташков", "Конаково",
            "Удомля", "Бежецк", "Кашин", "Лихославль"
        ],
        "Республика Карелия": ["Петрозаводск", "Кондопога", "Костомукша", "Сегежа", "Сортавала", "Медвежьегорск",
            "Кемь", "Питкяранта", "Беломорск", "Суоярви"
        ],
        "Республика Коми": ["Сыктывкар", "Ухта", "Воркута", "Печора", "Усинск", "Инта", "Сосногорск", "Емва",
            "Вуктыл"
        ],
        "Архангельская область": ["Архангельск", "Северодвинск", "Котлас", "Новодвинск", "Коряжма", "Мирный",
            "Вельск", "Няндома", "Онега", "Каргополь", "Шенкурск"
        ],
        "Мурманская область": ["Мурманск", "Апатиты", "Североморск", "Мончегорск", "Кандалакша", "Кировск",
            "Оленегорск", "Ковдор", "Полярный", "Заозёрск", "Снежногорск", "Гаджиево"
        ],
        "Вологодская область": ["Вологда", "Череповец", "Сокол", "Великий Устюг", "Грязовец", "Бабаево", "Тотьма",
            "Кириллов", "Вытегра"
        ],
        "Псковская область": ["Псков", "Великие Луки", "Остров", "Невель", "Опочка", "Печоры", "Порхов", "Дно",
            "Себеж", "Гдов"
        ],
        "Новгородская область": ["Великий Новгород", "Боровичи", "Старая Русса", "Чудово", "Малая Вишера", "Валдай",
            "Окуловка", "Сольцы", "Пестово", "Холм"
        ],
        "Смоленская область": ["Смоленск", "Вязьма", "Рославль", "Ярцево", "Сафоново", "Гагарин", "Десногорск",
            "Дорогобуж", "Рудня", "Ельня", "Починок"
        ],
        "Брянская область": ["Брянск", "Клинцы", "Новозыбков", "Дятьково", "Унеча", "Стародуб", "Карачев", "Жуковка",
            "Сельцо", "Почеп", "Трубчевск"
        ],
        "Курская область": ["Курск", "Железногорск", "Курчатов", "Льгов", "Щигры", "Рыльск", "Обоянь", "Суджа",
            "Дмитриев", "Фатеж"
        ],
        "Орловская область": ["Орёл", "Ливны", "Мценск", "Болхов", "Дмитровск", "Малоархангельск", "Новосиль"],
        "Липецкая область": ["Липецк", "Елец", "Грязи", "Усмань", "Лебедянь", "Данков", "Чаплыгин", "Задонск"],
        "Тамбовская область": ["Тамбов", "Мичуринск", "Рассказово", "Моршанск", "Котовск", "Уварово", "Кирсанов",
            "Жердевка", "Первомайский"
        ],
        "Рязанская область": ["Рязань", "Касимов", "Скопин", "Сасово", "Ряжск", "Новомичуринск", "Шилово",
            "Михайлов", "Кораблино"
        ],
        "Владимирская область": ["Владимир", "Ковров", "Муром", "Александров", "Гусь-Хрустальный", "Кольчугино",
            "Вязники", "Киржач", "Юрьев-Польский", "Суздаль", "Покров", "Лакинск"
        ],
        "Ивановская область": ["Иваново", "Кинешма", "Шуя", "Вичуга", "Фурманов", "Тейково", "Кохма", "Родники",
            "Юрьевец", "Пучеж"
        ],
        "Костромская область": ["Кострома", "Шарья", "Буй", "Нерехта", "Мантурово", "Галич", "Волгореченск",
            "Красное-на-Волге"
        ],
        "Кировская область": ["Киров", "Кирово-Чепецк", "Вятские Поляны", "Слободской", "Котельнич", "Омутнинск",
            "Яранск", "Советск", "Уржум", "Малмыж", "Луза"
        ],
        "Удмуртская Республика": ["Ижевск", "Воткинск", "Глазов", "Сарапул", "Можга", "Игра", "Ува", "Балезино",
            "Кизнер"
        ],
        "Республика Марий Эл": ["Йошкар-Ола", "Волжск", "Козьмодемьянск", "Медведево", "Звенигово", "Советский",
            "Морки"
        ],
        "Чувашская Республика": ["Чебоксары", "Новочебоксарск", "Канаш", "Алатырь", "Шумерля", "Цивильск",
            "Козловка", "Мариинский Посад", "Ядрин"
        ],
        "Республика Мордовия": ["Саранск", "Рузаевка", "Ковылкино", "Темников", "Ардатов", "Инсар", "Краснослободск"],
        "Пензенская область": ["Пенза", "Кузнецк", "Заречный", "Каменка", "Сердобск", "Нижний Ломов", "Никольск",
            "Белинский", "Городище"
        ],
        "Ульяновская область": ["Ульяновск", "Димитровград", "Инза", "Барыш", "Новоульяновск", "Сенгилей", "Карсун",
            "Майна"
        ],
        "Астраханская область": ["Астрахань", "Ахтубинск", "Знаменск", "Харабали", "Камызяк", "Нариманов",
            "Икряное", "Красный Яр"
        ],
        "Республика Калмыкия": ["Элиста", "Лагань", "Городовиковск", "Яшкуль", "Приютное", "Троицкое",
            "Малые Дербеты"
        ],
        "Чеченская Республика": ["Грозный", "Урус-Мартан", "Шали", "Гудермес", "Аргун", "Курчалой", "Ачхой-Мартан",
            "Цоци-Юрт"
        ],
        "Республика Ингушетия": ["Магас", "Назрань", "Малгобек", "Карабулак", "Сунжа", "Экажево", "Троицкая"],
        "Республика Северная Осетия — Алания": ["Владикавказ", "Моздок", "Беслан", "Алагир", "Ардон", "Дигора",
            "Чикола"
        ],
        "Кабардино-Балкарская Республика": ["Нальчик", "Прохладный", "Баксан", "Майский", "Нарткала", "Тырныауз",
            "Чегем"
        ],
        "Карачаево-Черкесская Республика": ["Черкесск", "Карачаевск", "Усть-Джегута", "Зеленчукская", "Теберда",
            "Преградная"
        ],
        "Республика Дагестан": ["Махачкала", "Дербент", "Хасавюрт", "Каспийск", "Буйнакск", "Кизляр", "Избербаш",
            "Кизилюрт", "Дагестанские Огни", "Карабудахкент"
        ],
        "Республика Саха (Якутия)": ["Якутск", "Нерюнгри", "Мирный", "Ленск", "Алдан", "Удачный", "Вилюйск", "Нюрба",
            "Покровск", "Олёкминск", "Томмот", "Жатай"
        ],
        "Камчатский край": ["Петропавловск-Камчатский", "Елизово", "Вилючинск", "Мильково", "Усть-Камчатск",
            "Ключи", "Палана"
        ],
        "Сахалинская область": ["Южно-Сахалинск", "Корсаков", "Холмск", "Оха", "Поронайск", "Долинск", "Невельск",
            "Анива", "Ноглики"
        ],
        "Магаданская область": ["Магадан", "Ола", "Сусуман", "Ягодное", "Усть-Омчуг", "Сеймчан"],
        "Амурская область": ["Благовещенск", "Белогорск", "Свободный", "Тында", "Зея", "Шимановск", "Райчихинск",
            "Прогресс", "Серышево", "Екатеринославка"
        ],
        "Забайкальский край": ["Чита", "Краснокаменск", "Борзя", "Петровск-Забайкальский", "Агинское", "Могоча",
            "Шилка", "Нерчинск", "Горный"
        ],
        "Республика Бурятия": ["Улан-Удэ", "Северобайкальск", "Гусиноозёрск", "Кяхта", "Закаменск", "Бабушкин",
            "Иволгинск", "Кабанск", "Курумкан"
        ],
        "Республика Хакасия": ["Абакан", "Черногорск", "Саяногорск", "Сорск", "Абаза", "Усть-Абакан", "Шира",
            "Белый Яр"
        ],
        "Республика Тыва": ["Кызыл", "Ак-Довурак", "Шагонар", "Чадан", "Туран", "Сарыг-Сеп", "Хову-Аксы"],
        "Республика Алтай": ["Горно-Алтайск", "Майма", "Усть-Кокса", "Онгудай", "Турочак", "Шебалино", "Кош-Агач",
            "Чемал"
        ],
        "Алтайский край": ["Барнаул", "Бийск", "Рубцовск", "Новоалтайск", "Заринск", "Камень-на-Оби", "Славгород",
            "Алейск", "Яровое", "Белокуриха", "Павловск", "Тальменка", "Кулунда"
        ],
        "Курганская область": ["Курган", "Шадринск", "Шумиха", "Куртамыш", "Далматово", "Петухово", "Макушино",
            "Кетово"
        ],
        "Оренбургская область": ["Оренбург", "Орск", "Новотроицк", "Бузулук", "Бугуруслан", "Гай", "Сорочинск",
            "Кувандык", "Соль-Илецк", "Ясный", "Медногорск"
        ],
        "Другое": ["Прочие населённые пункты"]
    };

    // ===================== УТИЛИТЫ =====================
  function getOccupancyColor(occupied, total) {
    const occupiedCount = Number(occupied) || 0;
    const totalCount = Number(total) || 0;
    if (totalCount <= 0) return getComputedStyle(document.body).getPropertyValue('--gray').trim() || '#8E8E93';
    const ratio = Math.max(0, Math.min(1, occupiedCount / totalCount));
    if (ratio < 0.5) return getComputedStyle(document.body).getPropertyValue('--green').trim() || '#30D158';
    if (ratio < 0.9) return getComputedStyle(document.body).getPropertyValue('--orange').trim() || '#FF9F0A';
    return getComputedStyle(document.body).getPropertyValue('--red').trim() || '#FF453A';
}
// ===== ВИДИМЫЕ ПАРКОВКИ (для кружка) =====
function getVisibleParkings() {
    if (!map) return Object.values(parkingDataCache);
    var bounds = map.getBounds();
    if (!bounds) return Object.values(parkingDataCache);
    var southWest = bounds[0];
    var northEast = bounds[1];
    return Object.values(parkingDataCache).filter(function(p) {
        if (!p.lat || !p.lng) return false;
        return p.lat >= southWest[0] && p.lat <= northEast[0] &&
               p.lng >= southWest[1] && p.lng <= northEast[1];
    });
}
// ===================== ОБНОВЛЕНИЕ КРУЖКА С ОБЩИМ КОЛИЧЕСТВОМ =====================
function updateTotalFreeCircle() {
    const allParkings = Object.values(parkingDataCache);
    const totalFree = allParkings.reduce((sum, p) => {
        const total = Number(p.totalSpots) || 0;
        const occupied = Number(p.occupiedSpots) || 0;
        const free = Math.max(0, total - occupied);
        return sum + free;
    }, 0);
    const countEl = document.getElementById('totalFreeCount');
    if (countEl) countEl.textContent = totalFree;
    const circle = document.getElementById('totalFreeCircle');
    if (circle) {
        if (totalFree === 0) {
            circle.style.backgroundColor = 'var(--red)';
        } else if (totalFree < 10) {
            circle.style.backgroundColor = 'var(--orange)';
        } else {
            circle.style.backgroundColor = 'var(--accent)';
        }
    }
}
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}
function getOccupancyDotColor(free, total) {
    const freeCount = Number(free) || 0;
    const totalCount = Number(total) || 0;
    if (totalCount <= 0) return 'var(--gray)';
    const ratio = Math.max(0, Math.min(1, freeCount / totalCount));
    if (ratio >= 0.5) return 'var(--green)';
    if (ratio >= 0.2) return 'var(--orange)';
    return 'var(--red)';
}
function getDistanceInMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (Number(lat2) - Number(lat1)) * Math.PI / 180;
    const dLng = (Number(lng2) - Number(lng1)) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(Number(lat1) * Math.PI / 180) * Math.cos(Number(lat2) * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function renderParkingItem(parking, userCoords) {
    const total = Number(parking.totalSpots) || 0;
    const occupied = Number(parking.occupiedSpots) || 0;
    const free = Math.max(0, total - occupied);
    const ratio = total > 0 ? free / total : 1;
    let badgeClass = '';
    if (ratio <= 0.2 && total > 0) badgeClass = 'critical';
    else if (ratio <= 0.5 && total > 0) badgeClass = 'low';
    const badgeText = total > 0 ? free : '?';
    let distanceHtml = '';
    const lat = Number(parking.lat);
    const lng = Number(parking.lng);
    if (userCoords && Number.isFinite(lat) && Number.isFinite(lng)) {
        const dist = getDistanceInMeters(userCoords.lat, userCoords.lng, lat, lng);
        const distStr = dist < 1000 ? `${Math.round(dist)} м` : `${(dist / 1000).toFixed(1)} км`;
        const time = Math.max(1, Math.round(dist / 500));
        const timeStr = dist < 500 ? '<1 мин' : `${time} мин`;
        distanceHtml = `<div class="meta-row"><span>${escapeHtml(distStr)}</span><span class="dot">·</span><span>${escapeHtml(timeStr)}</span></div>`;
    }
    const safeName = escapeHtml(parking.name || 'Без названия');
    const safeBadge = escapeHtml(String(badgeText));
    const parkingId = escapeHtml(parking.id || '');
    return `
        <div class="parking-item" onclick="focusMap(${lat}, ${lng}, '${parkingId}')">
            <div class="info">
                <div class="parking-item-header">
                    <div class="name">${safeName}</div>
                    <span class="free-badge ${badgeClass}">${safeBadge}</span>
                </div>
                ${distanceHtml}
            </div>
        </div>
    `;
}
function formatDateTime(timestamp) {
    if (!timestamp) return 'Неизвестно';
    const d = new Date(Number(timestamp));
    if (Number.isNaN(d.getTime())) return 'Неизвестно';
    return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth() + 1).toString().padStart(2,'0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}
   function checkPolygonSize(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length < 3) {
        return {
            valid: false,
            error: 'Минимум 3 точки'
        };
    }
    const validCoords = coordinates.filter(c =>
        Array.isArray(c) &&
        c.length >= 2 &&
        Number.isFinite(Number(c[0])) &&
        Number.isFinite(Number(c[1]))
    );
    if (validCoords.length < 3) {
        return {
            valid: false,
            error: 'Некорректные координаты зоны'
        };
    }
    const lats = validCoords.map(c => Number(c[0]));
    const lngs = validCoords.map(c => Number(c[1]));
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const widthM = getDistanceInMeters(minLat, minLng, minLat, maxLng);
    const lengthM = getDistanceInMeters(minLat, minLng, maxLat, minLng);
    if (widthM > MAX_ZONE_WIDTH || lengthM > MAX_ZONE_LENGTH) {
        return {
            valid: false,
            error: `Зона слишком большая! Максимум ${MAX_ZONE_WIDTH}×${MAX_ZONE_LENGTH} м. Сейчас: ${Math.round(widthM)}×${Math.round(lengthM)} м`
        };
    }
    return {
        valid: true,
        width: widthM,
        length: lengthM
    };
}
   // ===================== ТОЧНЫЙ РАСЧЁТ ПАРКОВОЧНЫХ МЕСТ =====================
function calculatePolygonArea(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length < 3) return 0;
    const validCoords = coordinates.filter(c =>
        Array.isArray(c) &&
        c.length >= 2 &&
        Number.isFinite(Number(c[0])) &&
        Number.isFinite(Number(c[1]))
    );
    if (validCoords.length < 3) return 0;
    const firstLat = Number(validCoords[0][0]);
    const firstLng = Number(validCoords[0][1]);
    const latMeter = 111320;
    const points = validCoords.map(c => {
        const lat = Number(c[0]);
        const lng = Number(c[1]);
        const dy = (lat - firstLat) * latMeter;
        const dx = (lng - firstLng) * latMeter * Math.cos(firstLat * Math.PI / 180);
        return { x: dx, y: dy };
    });
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
}
function calculateParkingSpots(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length < 3) return 0;
    const settings = getUserParkingSettings() || {};
    const spotArea = Number(settings.spotArea) > 0 ? Number(settings.spotArea) : 12.5;
    const area = calculatePolygonArea(coordinates);
    if (!Number.isFinite(area) || area <= 0) return 0;
    return Math.max(0, Math.floor(area / spotArea));
}
function getUserParkingSettings() {
    const defaults = { spotArea: 12.5}; // ← объявляем defaults
    if (currentUser && currentUser.parkingSettings) {
        const s = currentUser.parkingSettings;
        return { spotArea: s.spotArea || defaults.spotArea };
    }
    const saved = localStorage.getItem('parkingSettings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            return { spotArea: parsed.spotArea || defaults.spotArea };
        } catch (e) {}
    }
    return defaults;
}

function saveParkingSettings(settings) {
    if (currentUser) {
        database.ref(`users/${currentUser.id}/parkingSettings`).set(settings);
        currentUser.parkingSettings = settings;
    }
    localStorage.setItem('parkingSettings', JSON.stringify(settings));
}

  /**
 * Парсит российский адрес, извлекая регион, город, улицу и номер дома.
 * @param {string} fullAddress - Полный адрес (например, "Россия, Московская область, г. Москва, ул. Тверская, д. 15")
 * @param {Object} [regionsData] - Объект вида { "Регион": ["Город1", "Город2", ...] }.
 *                                  Если не передан, используется глобальная переменная regionsData.
 * @returns {{ region: string, city: string, street: string, houseNumber: string }}
 */
function parseAddress(fullAddress, regionsData = window.regionsData) {
    // Результат по умолчанию
    const defaultResult = { region: '', city: '', street: '', houseNumber: '' };

    if (!fullAddress || typeof fullAddress !== 'string') {
        return defaultResult;
    }

    if (!regionsData || typeof regionsData !== 'object') {
        console.warn('parseAddress: regionsData не определён или не является объектом');
        return defaultResult;
    }

    // Нормализация: убираем "Россия", лишние пробелы, приводим к нижнему регистру для сравнения
    let addr = fullAddress
        .replace(/^Россия,\s*/i, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

    // Если после удаления "Россия" ничего не осталось
    if (!addr) return defaultResult;

    // 1. Извлечение номера дома (ищем в конце строки, после запятой или после "д.")
    let houseNumber = '';
    const houseRegex = /(?:^|,\s*|[дД]\.?\s*|[Дд]ом\s*)(\d+[а-я]?(?:\s*[/\\]\s*\d+)?(?:\s*[кК]\.?\s*\d+)?)\s*(?:$|,|$)/;
    const houseMatch = addr.match(houseRegex);
    if (houseMatch) {
        houseNumber = houseMatch[1].trim();
        // Удаляем найденный номер дома из строки, включая возможный разделитель
        addr = addr.replace(houseMatch[0], '').trim();
        // Убираем лишние запятые в конце/начале
        addr = addr.replace(/^,\s*/, '').replace(/\s*,$/, '');
    }

    // Экранирование специальных символов для RegExp
    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // 2. Построение индекса "город → регион" для быстрого поиска
    const cityToRegion = new Map();
    for (const [region, cities] of Object.entries(regionsData)) {
        if (Array.isArray(cities)) {
            cities.forEach(city => {
                // Если город уже есть в индексе, возможно, он принадлежит нескольким регионам.
                // Мы запоминаем первый найденный регион, но можно хранить массив.
                if (!cityToRegion.has(city)) {
                    cityToRegion.set(city, region);
                }
            });
        }
    }

    // 3. Поиск города (с учётом границ слова)
    let foundCity = '';
    let foundRegion = '';

    // Сортируем города по длине (сначала самые длинные) для избежания частичных совпадений
    const sortedCities = [...cityToRegion.keys()].sort((a, b) => b.length - a.length);

    // Ищем город в адресе
    for (const city of sortedCities) {
        const escapedCity = escapeRegex(city);
        const cityRegex = new RegExp(`\\b${escapedCity}\\b`, 'i');
        if (cityRegex.test(addr)) {
            foundCity = city;
            foundRegion = cityToRegion.get(city);
            break;
        }
    }

    // Если город найден, удаляем его из адреса
    if (foundCity) {
        const escapedCity = escapeRegex(foundCity);
        const cityRegex = new RegExp(`\\b${escapedCity}\\b`, 'i');
        addr = addr.replace(cityRegex, '').trim();
        addr = addr.replace(/^,\s*/, '').replace(/\s*,$/, '');
    }

    // 4. Поиск региона, если город не дал однозначного региона или регион не найден
    if (!foundRegion) {
        // Пытаемся найти регион напрямую (например, "Московская область")
        const sortedRegions = Object.keys(regionsData).sort((a, b) => b.length - a.length);
        for (const region of sortedRegions) {
            const escapedRegion = escapeRegex(region);
            const regionRegex = new RegExp(`\\b${escapedRegion}\\b`, 'i');
            if (regionRegex.test(addr)) {
                foundRegion = region;
                // Удаляем регион из адреса
                addr = addr.replace(regionRegex, '').trim();
                addr = addr.replace(/^,\s*/, '').replace(/\s*,$/, '');
                break;
            }
        }
    }

    // 5. Оставшаяся часть — улица (очищаем от лишних слов)
    let street = addr
        .replace(/^[,.\s]+/, '')   // удаляем запятые и точки в начале
        .replace(/[,.\s]+$/, '')   // удаляем в конце
        .replace(/\s{2,}/g, ' ')   // схлопываем пробелы
        .trim();

    // Дополнительная нормализация улицы: убираем типичные сокращения (опционально)
    // Можно удалить "ул.", "пр-т", "пер.", "бульв." и т.д., но аккуратно, чтобы не сломать названия.
    // Простой вариант: оставляем как есть, т.к. это может быть и "Тверская улица" и "ул. Тверская".
    // Если хотите убрать сокращения, раскомментируйте:
    // street = street.replace(/^(ул\.|улица|проспект|пр-т|пер\.|переулок|бульвар|бульв\.|набережная|наб\.)\s+/i, '').trim();

    return {
        region: foundRegion || '',
        city: foundCity || '',
        street: street,
        houseNumber: houseNumber
    };
}

    function extractStreetName(fullStreet) {
        if (!fullStreet) return '';
        const types = ['ул.', 'пер.', 'бульв.', 'просп.', 'пр-д', 'ш.', 'наб.', 'алл.', 'тракт'];
        for (const t of types) {
            if (fullStreet.startsWith(t + ' ')) {
                return fullStreet.substring(t.length + 1);
            }
        }
        return fullStreet;
    }

    // ===================== PULL-TO-REFRESH =====================
    let pullStartY = 0;
    let pullCurrentY = 0;
    let pullIsDragging = false;
    let pullThreshold = 70;
    let pullPanelType = null;

    function initPullToRefresh() {
        const panelContent = document.getElementById('panelContent');
        if (!panelContent) return;

        panelContent.addEventListener('touchstart', function(e) {
            if (this.scrollTop === 0) {
                pullStartY = e.touches[0].clientY;
                pullIsDragging = true;
                pullPanelType = getCurrentPanelType();
            } else {
                pullIsDragging = false;
            }
        });

        panelContent.addEventListener('touchmove', function(e) {
            if (!pullIsDragging) return;
            pullCurrentY = e.touches[0].clientY;
            const delta = pullCurrentY - pullStartY;
            if (delta > 0 && this.scrollTop === 0) {
                const indicator = document.getElementById('pullIndicator');
                if (indicator) {
                    const height = Math.min(delta, pullThreshold);
                    indicator.style.height = height + 'px';
                }
            }
        });

        panelContent.addEventListener('touchend', function() {
            if (!pullIsDragging) return;
            pullIsDragging = false;
            const delta = pullCurrentY - pullStartY;
            const indicator = document.getElementById('pullIndicator');
            if (delta >= pullThreshold && this.scrollTop === 0) {
                indicator.style.height = '50px';
                indicator.classList.add('visible');
                refreshCurrentPanel();
                setTimeout(() => {
                    indicator.style.height = '0px';
                    indicator.classList.remove('visible');
                }, 1500);
            } else {
                indicator.style.height = '0px';
                indicator.classList.remove('visible');
            }
            pullStartY = 0;
            pullCurrentY = 0;
        });
    }

    function getCurrentPanelType() {
        const title = document.getElementById('panelTitle').textContent;
        if (title === 'Поиск') return 'search';
        if (title === 'Избранное') return 'favorites';
        if (title === 'Профиль') return 'profile';
        return null;
    }

    function refreshCurrentPanel() {
        const content = document.getElementById('panelContent');
        switch (pullPanelType) {
            case 'search':
                filterParkings();
                break;
            case 'favorites':
                loadUserData('favorites', content);
                break;
            case 'profile':
                renderProfile(content);
                break;
            default:
                break;
        }
    }

    // ===================== АВТОРИЗАЦИЯ =====================
    function initAuth() {
    const saved = localStorage.getItem('tgUser');
    if (saved) {
        try {
            const user = JSON.parse(saved);
            if (!currentUser || currentUser.id !== user.id) {
                currentUser = user;
                window.currentUser = user;
                hideAuthScreen();
                // Если панель не активна, открываем главную
                const panel = document.getElementById('panel');
                if (!panel.classList.contains('active')) {
                    showPanel('home');
                }
                console.log('✅ Пользователь восстановлен в initAuth()');
            }
            return; // если пользователь уже есть, ничего не делаем
        } catch (e) {
            localStorage.removeItem('tgUser');
        }
    }
    // Если пользователь не найден – показываем экран входа
    showAuthScreen();
}
// Немедленное восстановление сессии (выполняется до загрузки карт)
(function() {
    const saved = localStorage.getItem('tgUser');
    if (saved) {
        try {
            const user = JSON.parse(saved);
            currentUser = user;
            window.currentUser = user;
            hideAuthScreen();
            const panel = document.getElementById('panel');
            if (!panel.classList.contains('active')) {
                showPanel('home');
            }
            console.log('✅ Вход восстановлен (ранний вызов)');
        } catch (e) {
            localStorage.removeItem('tgUser');
        }
    }
})();
    // ===================== ГЕОЛОКАЦИЯ =====================
    function getUserLocation() {
    return new Promise((resolve, reject) => {
        // Если запущено внутри Telegram WebApp
        if (window.Telegram && window.Telegram.WebApp && typeof window.Telegram.WebApp.getLocation === 'function') {
            window.Telegram.WebApp.getLocation(function(position) {
                if (position && position.latitude && position.longitude) {
                    resolve({ lat: position.latitude, lng: position.longitude });
                } else {
                    reject(new Error('Telegram геолокация не удалась'));
                }
            });
            return;
        }

        // Стандартный браузерный метод
        if (!navigator.geolocation) {
            return reject(new Error('Геолокация не поддерживается вашим устройством'));
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
            },
            (error) => {
                reject(error);
            },
            { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
        );
    });
}
async function detectCityByUserLocation() {
    if (currentCity) return currentCity;
    if (!navigator.geolocation) {
        console.warn('Геолокация браузера недоступна');
        return '';
    }
    return new Promise(resolve => {
        navigator.geolocation.getCurrentPosition(async position => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            try {
                const result = await ymaps.geocode([lat, lng], { results: 1 });
                const geo = result.geoObjects.get(0);
                if (!geo) {
                    resolve('');
                    return;
                }
                const localities = geo.getLocalities ? geo.getLocalities() : [];
                const areas = geo.getAdministrativeAreas ? geo.getAdministrativeAreas() : [];
                const city = localities[0] || '';
                const region = areas[areas.length - 1] || '';
                if (city) {
                    currentCity = city;
                    userCityPrefs.city = city;
                    userCityPrefs.region = region;
                    localStorage.setItem('selectedCity', city);
                    localStorage.setItem('parknear_city', JSON.stringify({ city, region }));
                    if (typeof updateCityDisplay === 'function') updateCityDisplay();
                }
                resolve(city);
            } catch (error) {
                console.error('Ошибка определения города:', error);
                resolve('');
            }
        }, error => {
            console.warn('Не удалось получить геолокацию:', error.message);
            resolve('');
        }, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000
        });
    });
}
function tryYandexGeolocation(resolve, reject) {
    if (typeof ymaps === 'undefined' || !ymaps.geolocation) {
        reject(new Error('Геолокация не поддерживается'));
        return;
    }
    ymaps.geolocation.get({ provider: 'browser', timeout: 10000 })
        .then(async function(result) {
            const coords = result.geoObjects.get(0).geometry.getCoordinates();
            const location = { lat: coords[0], lng: coords[1] };
            lastKnownLocation = location;
            console.log('✅ Геолокация получена через Яндекс:', location);
            try {
                const geoResult = await ymaps.geocode(coords, { results: 1 });
                const geo = geoResult.geoObjects.get(0);
                if (geo) {
                    const localities = geo.getLocalities ? geo.getLocalities() : [];
                    const areas = geo.getAdministrativeAreas ? geo.getAdministrativeAreas() : [];
                    const city = localities[0] || '';
                    const region = areas[areas.length - 1] || '';
                    if (city) {
                        currentCity = city;
                        userCityPrefs.city = city;
                        userCityPrefs.region = region;
                        localStorage.setItem('selectedCity', city);
                        localStorage.setItem('parknear_city', JSON.stringify({ city, region }));
                        if (typeof updateCityDisplay === 'function') updateCityDisplay();
                        console.log('✅ Город определён:', city, region);
                    }
                }
            } catch (error) {
                console.warn('⚠️ Не удалось определить город:', error);
            }
            resolve(location);
        })
        .catch(function(err) {
            console.error('❌ Яндекс.Геолокация не удалась:', err);
            reject(new Error('Геолокация недоступна'));
        });
}

    function tryBrowserGeolocation(resolve, reject) {
        if (typeof ymaps !== 'undefined') {
            ymaps.geolocation.get({ provider: 'browser', timeout: 10000 })
                .then(function(result) {
                    const coords = result.geoObjects.get(0).geometry.getCoordinates();
                    lastKnownLocation = { lat: coords[0], lng: coords[1] };
                    resolve(lastKnownLocation);
                })
                .catch(function() { fallbackToNavigator(resolve, reject); });
        } else {
            fallbackToNavigator(resolve, reject);
        }
    }

    function fallbackToNavigator(resolve, reject) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function(pos) {
                    lastKnownLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    resolve(lastKnownLocation);
                },
                function(err) { reject(err); }, { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            reject(new Error('Геолокация не поддерживается'));
        }
    }
    // ===================== МАРКЕРЫ НА КАРТЕ =====================
function loadAllParkings(city = '', force = false) {
    console.log('🔍 Загрузка парковок');
    const selectedCity = String(city || currentCity || '').trim().toLowerCase();
    if (!force && Date.now() - lastDataRefresh < 30000 && Object.keys(parkingDataCache).length > 0) {
        clearAllMarkers();
        Object.entries(parkingDataCache).forEach(([id, parking]) => {
            const parkingCity = String(parking.city || '').trim().toLowerCase();
            if (!selectedCity || parkingCity === selectedCity) {
                addMarkerToMap(id, parking);
            }
        });
        updateTotalFreeCircle();
        console.log('✅ Использован кэш парковок');
        return Promise.resolve();
    }
    clearAllMarkers();
    return database.ref('parkings').once('value')
        .then(snapshot => {
            const data = snapshot.val() || {};
            const newCache = {};
            Object.keys(data).forEach(key => {
                const parking = data[key];
                if (!parking || parking.lat == null || parking.lng == null) {
                    return;
                }
                parking.id = key;
                parking.lat = Number(parking.lat);
                parking.lng = Number(parking.lng);
                parking.totalSpots = Number(parking.totalSpots) || 0;
                parking.occupiedSpots = Number(parking.occupiedSpots) || 0;
                parking.occupiedSpots = Math.max(
                    0,
                    Math.min(
                        parking.occupiedSpots,
                        parking.totalSpots
                    )
                );
                newCache[key] = parking;
            });
            parkingDataCache = newCache;
            lastDataRefresh = Date.now();
            try {
                localStorage.setItem(
                    'parkingCache',
                    JSON.stringify({
                        city: 'all',
                        data: newCache,
                        timestamp: Date.now()
                    })
                );
            } catch (e) {
                console.warn('⚠️ Не удалось сохранить кэш парковок');
            }
            const cityToShow = String(
                currentCity || city || ''
            ).trim().toLowerCase();
            let visibleCount = 0;
            Object.entries(newCache).forEach(([id, parking]) => {
                const parkingCity = String(
                    parking.city || ''
                ).trim().toLowerCase();
                if (
                    !cityToShow ||
                    parkingCity === cityToShow
                ) {
                    addMarkerToMap(id, parking);
                    visibleCount++;
                }
            });
            updateTotalFreeCircle();
            console.log(
                '✅ Загружено парковок в кэш:',
                Object.keys(newCache).length
            );
            console.log(
                '🏙️ Показывается парковок города:',
                cityToShow || 'все',
                visibleCount
            );
        })
        .catch(error => {
            console.error(
                '❌ Ошибка загрузки парковок:',
                error
            );
            throw error;
        });
}
function showParkingsForCity(city) {
    if (!map || !city) return;
    clearAllMarkers();
    const normalizedCity = city.trim().toLowerCase();
    Object.entries(parkingDataCache).forEach(([id, parking]) => {
        const parkingCity = String(parking.city || '').trim().toLowerCase();
        if (parkingCity === normalizedCity) {
            addMarkerToMap(id, parking);
        }
    });
    updateTotalFreeCircle();
    console.log(`🏙️ Показаны парковки города "${city}":`, Object.values(parkingDataCache).filter(p => String(p.city || '').trim().toLowerCase() === normalizedCity).length);
}
// ===== Вспомогательная функция для загрузки всех парковок (без фильтра) =====
function loadAllParkingsNoFilter() {
    return new Promise(function(resolve, reject) {
        database.ref('parkings').once('value').then(function(snapshot) {
            const data = snapshot.val();
            const newCache = {};
            if (data) {
                Object.keys(data).forEach(function(key) {
                    const parking = data[key];
                    if (!parking || parking.lat == null || parking.lng == null) return;
                    parking.totalSpots = Number(parking.totalSpots) || 0;
                    parking.occupiedSpots = Number(parking.occupiedSpots) || 0;
                    parking.occupiedSpots = Math.max(0, Math.min(parking.occupiedSpots, parking.totalSpots));
                    newCache[key] = parking;
                });
            }
            parkingDataCache = newCache;
            lastDataRefresh = Date.now();
            try {
                localStorage.setItem('parkingCache', JSON.stringify({ city: 'all', data: newCache, timestamp: Date.now() }));
            } catch (e) {}
            Object.keys(newCache).forEach(function(id) {
                addMarkerToMap(id, newCache[id]);
            });
            if (typeof updateTotalFreeCircle === 'function') {
                updateTotalFreeCircle();
            }
            console.log('⚠️ Загружены ВСЕ парковки (без фильтра) –', Object.keys(newCache).length);
            resolve();
        }).catch(function(error) {
            console.error('❌ Ошибка загрузки всех парковок:', error);
            reject(error);
        });
    });
}
function updateParkingMarker(id, data) {
    if (!map || !clusterer) return;

    const placemark = mapMarkers[id];
    if (!placemark) {
        addMarkerToMap(id, data);
        return;
    }

    const totalSpots = Number(data.totalSpots) || 0;
    const occupiedSpots = Number(data.occupiedSpots) || 0;
    const freeSpots = Math.max(0, totalSpots - occupiedSpots);
    const color = getOccupancyColor(occupiedSpots, totalSpots);

    // Обновляем свойства маркера
    placemark.properties.set({
        name: data.name || 'Парковка',
        hintContent: data.name || 'Парковка',
        freeSpots: freeSpots,
        totalSpots: totalSpots,
        occupiedSpots: occupiedSpots,
        parkingId: id,
        iconContent: String(freeSpots)
    });

    placemark.options.set('iconColor', color);

    // ✅ Обновляем Polygon только если изменились координаты
    const oldPolygon = placemark.properties.get('polygon');
    const newCoords = data.coordinates;

    // Функция для сравнения двух массивов координат (примитивная, но работает)
    function coordsChanged(oldCoord, newCoord) {
        if (!oldCoord || !newCoord) return true;
        if (oldCoord.length !== newCoord.length) return true;
        for (let i = 0; i < oldCoord.length; i++) {
            if (oldCoord[i][0] !== newCoord[i][0] || oldCoord[i][1] !== newCoord[i][1]) {
                return true;
            }
        }
        return false;
    }

    if (newCoords && Array.isArray(newCoords) && newCoords.length >= 3) {
        if (!oldPolygon || coordsChanged(oldPolygon.geometry.getCoordinates()[0], newCoords)) {
            // Удаляем старый полигон
            if (oldPolygon) map.geoObjects.remove(oldPolygon);
            // Создаём новый
            const newPolygon = new ymaps.Polygon([newCoords], {}, {
                fillColor: color + '33',
                strokeColor: color,
                strokeWidth: 2,
                visible: false,
                zIndex: 5
            });
            map.geoObjects.add(newPolygon);
            placemark.properties.set('polygon', newPolygon);
            newPolygon.__parkingId = id;
        } else {
            // Координаты не изменились – просто обновляем цвет
            oldPolygon.options.set({
                fillColor: color + '33',
                strokeColor: color
            });
        }
    } else {
        // Зоны больше нет
        if (oldPolygon) {
            map.geoObjects.remove(oldPolygon);
            placemark.properties.set('polygon', null);
        }
    }

    // Обновляем общий счётчик
    if (typeof updateTotalFreeCircle === 'function') {
        updateTotalFreeCircle();
    }
}
function refreshParkingMarker(parkingId) {

    const id =
        parkingId || currentParkingId;

    if (!id) {
        return;
    }

    const data =
        parkingDataCache[id];

    if (!data) {
        return;
    }

    updateParkingMarker(
        id,
        data
    );

    // Обновляем общий счётчик
    if (
        typeof updateTotalFreeCircle ===
        'function'
    ) {
        updateTotalFreeCircle();
    }
}
function addMarkerToMap(id, data) {

    if (!map || !clusterer) {
        return;
    }

    // ============================================
    // Если маркер уже существует — сначала
    // полностью удаляем старый
    // ============================================

    if (mapMarkers[id]) {

        const oldPlacemark =
            mapMarkers[id];

        const oldPolygon =
            oldPlacemark.properties.get(
                'polygon'
            );

        // Удаляем маркер из кластера
        clusterer.remove(
            oldPlacemark
        );

        // Удаляем полигон
        if (oldPolygon) {
            map.geoObjects.remove(
                oldPolygon
            );
        }

        delete mapMarkers[id];
    }

    // ============================================
    // Нормализуем данные
    // ============================================

    const totalSpots =
        Number(data.totalSpots) || 0;

    const occupiedSpots =
        Number(data.occupiedSpots) || 0;

    const freeSpots = Math.max(
        0,
        totalSpots - occupiedSpots
    );

    const color =
        getOccupancyColor(
            occupiedSpots,
            totalSpots
        );

    // ============================================
    // Определяем центр парковочной зоны
    // ============================================

    let centerLat =
        Number(data.lat);

    let centerLng =
        Number(data.lng);

    if (
        Array.isArray(data.coordinates) &&
        data.coordinates.length > 0
    ) {

        let latSum = 0;
        let lngSum = 0;
        let validPoints = 0;

        data.coordinates.forEach(
            function(point) {

                if (
                    Array.isArray(point) &&
                    point.length >= 2 &&
                    Number.isFinite(
                        Number(point[0])
                    ) &&
                    Number.isFinite(
                        Number(point[1])
                    )
                ) {

                    latSum +=
                        Number(point[0]);

                    lngSum +=
                        Number(point[1]);

                    validPoints++;
                }
            }
        );

        if (validPoints > 0) {

            centerLat =
                latSum / validPoints;

            centerLng =
                lngSum / validPoints;
        }
    }

    // ============================================
    // Создаём полигон
    // ============================================

    let polygon = null;

    if (
        Array.isArray(data.coordinates) &&
        data.coordinates.length >= 3
    ) {

        polygon =
            new ymaps.Polygon(
                [data.coordinates],
                {},
                {
                    fillColor:
                        color + '33',

                    strokeColor:
                        color,

                    strokeWidth: 2,

                    visible: false,

                    zIndex: 5
                }
            );

        map.geoObjects.add(
            polygon
        );

        // Чтобы можно было определить,
        // к какой парковке относится полигон
        polygon.__parkingId = id;
    }

    // ============================================
    // Создаём маркер
    // ============================================

    const placemark =
        new ymaps.Placemark(
            [
                centerLat,
                centerLng
            ],
            {
                hintContent:
                    data.name ||
                    'Парковка',

                name:
                    data.name ||
                    'Парковка',

                freeSpots:
                    freeSpots,

                totalSpots:
                    totalSpots,

                occupiedSpots:
                    occupiedSpots,

                parkingId:
                    id,
                    
                polygon:
                    polygon
            },
            {
                preset:
                    'islands#blueIcon',

                iconColor:
                    color,
            }
        );

    // ============================================
    // Клик по парковке
    // ============================================

   placemark.events.add('click', function() {
    // ===== ПРИБЛИЖАЕМ КАРТУ =====
    if (map) {
        map.setCenter([centerLat, centerLng], 18, { duration: 300, checkZoomRange: true });
    }

    // Скрываем предыдущий полигон
    if (activePolygon) {
        activePolygon.options.set('visible', false);
        activePolygon = null;
    }

    const poly = placemark.properties.get('polygon');
    if (poly) {
        poly.options.set('visible', true);
        activePolygon = poly;
    }

    openCenterSheet(id, data);
    if (map.balloon) map.balloon.close();
});
    // ============================================
    // Добавляем в кластер
    // ============================================

    clusterer.add(
        placemark
    );

    // ============================================
    // Сохраняем ссылку
    // ============================================

    mapMarkers[id] =
        placemark;

    // ============================================
    // Обновляем общий счётчик
    // ============================================

    if (
        typeof updateTotalFreeCircle ===
        'function'
    ) {
        updateTotalFreeCircle();
    }
}
function clearAllMarkers() {
    // Удаляем все маркеры из кластера
    if (clusterer) {
        clusterer.removeAll();
    }
    // Удаляем полигоны, привязанные к маркерам
    Object.keys(mapMarkers).forEach(function(id) {
        const placemark = mapMarkers[id];
        const polygon = placemark.properties.get('polygon');
        if (polygon) {
            map.geoObjects.remove(polygon);
        }
    });
    // Очищаем объект mapMarkers
    mapMarkers = {};
    // Удаляем активный полигон (если есть)
    if (activePolygon) {
        map.geoObjects.remove(activePolygon);
        activePolygon = null;
    }
    // Обновляем счётчик свободных мест (обнуляем)
    if (typeof updateTotalFreeCircle === 'function') {
        updateTotalFreeCircle();
    }
}
  // ===================== ИНИЦИАЛИЗАЦИЯ КАРТЫ =====================
function createParkingClusterer() {
    if (!map) return;
    if (clusterer) {
        try {
            map.geoObjects.remove(clusterer);
        } catch (e) {
            console.warn('Не удалось удалить старый кластеризатор:', e);
        }
        clusterer = null;
    }
    clusterer = new ymaps.Clusterer({
        preset: 'islands#invertedDarkGreenClusterIcons',
        groupByCoordinates: false,
        clusterDisableClickZoom: false,
        clusterOpenBalloonOnClick: false,
        clusterIconLayout: ymaps.templateLayoutFactory.createClass(
            '<div class="parking-cluster">' +
                '<div class="parking-cluster-count">$[properties.clusterCount]</div>' +
                '<div class="parking-cluster-free">🅿️ $[properties.clusterFree]</div>' +
            '</div>'
        ),
        clusterIconShape: {
            type: 'Circle',
            coordinates: [0, 0],
            radius: 32
        }
    });
    map.geoObjects.add(clusterer);
}
function initMap() {
    console.log('▶️ initMap вызвана');
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('❌ Элемент #map не найден в DOM');
        return;
    }
    // =====================================================
    // ПРОВЕРКА ЗАГРУЗКИ ЯНДЕКС.КАРТ
    // =====================================================
    if (typeof ymaps === 'undefined') {
        mapContainer.innerHTML = '⚠️ API Яндекс.Карт не загружен. Проверьте ключ и интернет.';
        console.error('❌ ymaps не определён – API не загружен');
        return;
    }

    try {
        // 1. Создаём карту с начальным зумом 14
        map = new ymaps.Map("map", {
            center: [55.7558, 37.6173],
            zoom: 14,
            maxZoom: 19,
            controls: ['zoomControl'],
            type: 'yandex#map'
        });
        console.log('✅ Карта инициализирована');

        // ===== АВТОМАТИЧЕСКОЕ ОТОБРАЖЕНИЕ ПОЛИГОНОВ ПРИ ЗУМЕ >= 15 =====
        map.events.add('zoomchange', function() {
            var currentZoom = map.getZoom();
            var showPolygons = (currentZoom >= 15);
            Object.keys(mapMarkers).forEach(function(id) {
                var placemark = mapMarkers[id];
                if (!placemark) return;
                var poly = placemark.properties.get('polygon');
                if (poly) {
                    poly.options.set('visible', showPolygons);
                }
            });
        });

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
                        '{{ properties.parkingCount || "0" }}' +
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

        // ===== Обработчики кнопок =====
        document.getElementById('addBtn').onclick = function() {
            if (!currentUser) showPanel('home');
            else if (isDrawingMode) cancelDrawing();
            else startDrawingMode();
        };

        const layerBtn = document.getElementById('layerSwitcher');
        let pressTimer = null;
        function showLayerMenu() {
            document.getElementById('layerMenu').classList.add('active');
        }
        layerBtn.addEventListener('mousedown', function(e) {
            pressTimer = setTimeout(function() { showLayerMenu(); pressTimer = null; }, 500);
        });
        layerBtn.addEventListener('mouseup', function(e) {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
                const currentType = map.getType();
                const types = ['yandex#map', 'yandex#satellite', 'yandex#hybrid'];
                let idx = types.indexOf(currentType);
                if (idx === -1) idx = 0;
                const nextType = types[(idx + 1) % types.length];
                map.setType(nextType);
                document.querySelectorAll('.layer-option').forEach(function(o) { o.classList.remove('selected'); });
                document.querySelector('.layer-option[data-type="' + nextType + '"]').classList.add('selected');
                updateMapTheme();
            }
        });
        layerBtn.addEventListener('touchstart', function(e) {
            pressTimer = setTimeout(function() { showLayerMenu(); pressTimer = null; }, 500);
        });
        layerBtn.addEventListener('touchend', function(e) {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
                const currentType = map.getType();
                const types = ['yandex#map', 'yandex#satellite', 'yandex#hybrid'];
                let idx = types.indexOf(currentType);
                if (idx === -1) idx = 0;
                const nextType = types[(idx + 1) % types.length];
                map.setType(nextType);
                document.querySelectorAll('.layer-option').forEach(function(o) { o.classList.remove('selected'); });
                document.querySelector('.layer-option[data-type="' + nextType + '"]').classList.add('selected');
                updateMapTheme();
            }
        });

        // ===== Кнопка геолокации =====
        document.getElementById('geoBtn').onclick = function() {
            if (!map) return;
            const btn = this;
            const originalContent = btn.innerHTML;
            btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></div>';
            btn.disabled = true;

            getUserLocation()
                .then(function(coords) {
                    btn.innerHTML = originalContent;
                    btn.disabled = false;
                    if (myLocationPlacemark) map.geoObjects.remove(myLocationPlacemark);
                    myLocationPlacemark = new ymaps.Placemark([coords.lat, coords.lng], {
                        hintContent: 'Вы здесь',
                        balloonContent: '<strong>Ваше местоположение</strong>'
                    }, {
                        preset: 'islands#blueCircleDotIconWithCaption'
                    });
                    myLocationPlacemark.properties.set('caption', 'Вы здесь');
                    map.geoObjects.add(myLocationPlacemark);
                    map.setCenter([coords.lat, coords.lng], 16, { duration: 500 });
                    if (window.Telegram?.WebApp?.HapticFeedback) {
                        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                    }
                })
                .catch(function(err) {
                    btn.innerHTML = originalContent;
                    btn.disabled = false;
                    console.error('Ошибка геолокации:', err);
                    let message = 'Не удалось определить ваше местоположение.';
                    if (err.message) message += ' ' + err.message;
                    if (window.Telegram?.WebApp?.showAlert) {
                        window.Telegram.WebApp.showAlert(message);
                    } else {
                        alert(message);
                    }
                });
        };

        // ===== Загружаем парковки =====
        loadAllParkings(currentCity).catch(function(err) {
            console.warn('Не удалось загрузить парковки:', err);
        });

        // ===== Автогеолокация через 1 секунду =====
        setTimeout(function() {
            getUserLocation()
                .then(function(coords) {
                    if (myLocationPlacemark) map.geoObjects.remove(myLocationPlacemark);
                    myLocationPlacemark = new ymaps.Placemark([coords.lat, coords.lng], {
                        hintContent: 'Вы здесь'
                    }, {
                        preset: 'islands#blueCircleDotIconWithCaption'
                    });
                    myLocationPlacemark.properties.set('caption', 'Вы здесь');
                    map.geoObjects.add(myLocationPlacemark);
                    map.setCenter([coords.lat, coords.lng], 14, { duration: 500 });
                })
                .catch(function() {
                    console.log('Автогеолокация не удалась');
                    showToast('Нажмите 📍, чтобы определить ваше местоположение', 4000);
                });
        }, 1000);

       // ===== Скрываем сплеш-экран =====
setTimeout(function() {
    const splash = document.getElementById('splashScreen');
    if (splash) {
        splash.classList.add('splash-hidden');
        setTimeout(function() {
            splash.remove();
        }, 700);
    }
}, 5000);

    } catch (e) {

    console.error(
        '❌ Ошибка инициализации ParkNear:',
        e
    );

    // Если карта уже создана —
    // НЕ уничтожаем её и НЕ показываем
    // сообщение "не удалось загрузить карту"
    if (map) {
        console.error(
            '⚠️ Карта уже создана. Ошибка произошла после создания карты.'
        );
        return;
    }

    const container =
        document.getElementById('map');

    if (container) {
        container.innerHTML = `
            <div style="
                color: var(--red);
                text-align: center;
                padding: 20px;
            ">
                ⚠️ Не удалось инициализировать карту.
            </div>
        `;
    }
}
}
    // ===================== СЛОИ КАРТЫ =====================
    function toggleLayerMenu() { document.getElementById('layerMenu').classList.toggle('active'); }

    function setMapType(option) {
        if (!map) return;
        map.setType(option.dataset.type);
        document.querySelectorAll('.layer-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        document.getElementById('layerMenu').classList.remove('active');
        updateMapTheme();
    }

    // ===================== РИСОВАНИЕ ЗОНЫ =====================

function startDrawingMode() {
    const oldControls = document.getElementById('drawingControls');
    if (oldControls) oldControls.remove();

    if (!map || !currentUser) return;
    if (drawingPolygon) {
        map.geoObjects.remove(drawingPolygon);
        drawingPolygon = null;
    }
    isDrawingMode = true;
    document.getElementById('addBtn').classList.add('drawing');
    document.getElementById('addBtn').textContent = '✕';

    drawingPolygon = new ymaps.Polygon([[]], {}, {
        editorDrawingCursor: "crosshair",
        fillColor: '#2B757433',
        strokeColor: '#2B7574',
        strokeWidth: 3,
        draggable: false
    });
    map.geoObjects.add(drawingPolygon);
    drawingPolygon.editor.startDrawing();

    showMapHint('Нажимайте на карту для рисования зоны');

    const controls = document.createElement('div');
    controls.className = 'drawing-controls';
    controls.id = 'drawingControls';
    controls.innerHTML = `
        <button class="btn-finish" onclick="finishDrawing()">✅ Готово</button>
        <button class="btn-cancel" onclick="cancelDrawing()">✕ Отменить</button>
    `;
    document.body.appendChild(controls);

    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
}

function finishDrawing() {
    console.log('finishDrawing() вызвана');
    if (!drawingPolygon) return;
    drawingPolygon.editor.stopDrawing();
    const coordinates = drawingPolygon.geometry.getCoordinates()[0];
    newParkingCoords = coordinates.map(c => [parseFloat(c[0]), parseFloat(c[1])]);

    const sizeCheck = checkPolygonSize(newParkingCoords);
    if (!sizeCheck.valid) {
        alert(sizeCheck.error);
        cancelDrawing();
        return;
    }

    _parkingFormCoords = newParkingCoords;
    _parkingFormSizeCheck = sizeCheck;
    console.log('Сохранены координаты:', _parkingFormCoords);

    const controls = document.getElementById('drawingControls');
    if (controls) {
        controls.innerHTML = `
            <button class="btn-finish" onclick="openParkingForm()">✅ Готова</button>
            <button class="btn-cancel" onclick="cancelDrawing()">✕ Отменить</button>
        `;
        console.log('Кнопки заменены на "Готова" и "Отменить"');
    }

    // ФИКС: возвращаем иконку "+", т.к. режим рисования завершён
    const addBtn = document.getElementById('addBtn');
    if (addBtn) {
        addBtn.classList.remove('drawing');
        addBtn.textContent = '+';
    }
    isDrawingMode = false;

    const spots = calculateParkingSpots(newParkingCoords);
    if (spots > 0) {
        showToast(`🚗 Примерно ${spots} машино-мест в этой зоне`, 3000);
    } else {
        showToast('⚠️ Зона слишком мала для парковки', 2000);
    }
}

function openParkingForm() {
    console.log('✅ openParkingForm вызвана');
    console.log('Координаты:', _parkingFormCoords);
    if (!_parkingFormCoords) {
        showToast('Сначала нарисуйте зону парковки', 2000);
        return;
    }
    openAddPanelWithPolygon(_parkingFormCoords, _parkingFormSizeCheck);
}

function cancelDrawing() {
    if (editingPolygon) {
        map.geoObjects.remove(editingPolygon);
        editingPolygon = null;

        if (originalPolyCoords && currentParkingId) {
            addMarkerToMap(currentParkingId, {
                ...currentParkingData,
                coordinates: originalPolyCoords
            });
        }

        const controls = document.getElementById('drawingControls');
        if (controls) controls.remove();

        const addBtn = document.getElementById('addBtn');
        if (addBtn) {
            addBtn.classList.remove('drawing');
            addBtn.textContent = '+';
        }

        isDrawingMode = false;
        currentParkingId = null;
        currentParkingData = null;
        originalPolyCoords = null;
        _parkingFormCoords = null;
        _parkingFormSizeCheck = null;

        closePanel();
        return;
    }

    if (drawingPolygon) {
        map.geoObjects.remove(drawingPolygon);
        drawingPolygon = null;
    }

    isDrawingMode = false;

    const addBtn = document.getElementById('addBtn');
    if (addBtn) {
        addBtn.classList.remove('drawing');
        addBtn.textContent = '+';
    }
    const controls = document.getElementById('drawingControls');
    if (controls) controls.remove();

    _parkingFormCoords = null;
    _parkingFormSizeCheck = null;
}

function showMapHint(text) {
    const hint = document.createElement('div');
    hint.className = 'map-hint';
    hint.textContent = text;
    document.body.appendChild(hint);
    setTimeout(() => hint.remove(), 3000);
}

function openAddPanelWithPolygon(coordinates, sizeCheck) {
    try {
        console.log('openAddPanelWithPolygon вызвана');
        const panel = document.getElementById('panel');
        const panelContent = document.getElementById('panelContent');
        if (!panel || !panelContent) {
            console.error('Элементы панели не найдены');
            return;
        }

        panel.classList.add('active');
        document.getElementById('panelTitle').textContent = 'Новая парковка';

        const suggestedSpots = calculateParkingSpots(coordinates);
        const spotsPlaceholder = suggestedSpots > 0 ? `Например: ${suggestedSpots}` : 'Например: 10';

        panelContent.innerHTML = `
            <div class="form-group">
                <label>Область парковки</label>
                <div id="miniMapContainer" style="width:100%; height:200px; border-radius:12px; overflow:hidden; margin-top:8px; box-shadow: var(--card-shadow);"></div>
                <p style="font-size:12px; color:var(--text-secondary); margin-top:6px;">Выделенная зона отображается на карте</p>
            </div>

            <div class="form-group">
                <label>Тип улицы</label>
                <select id="parkStreetType" class="input-field">
                    <option value="">-- выберите --</option>
                    <option value="ул.">улица</option>
                    <option value="пер.">переулок</option>
                    <option value="бульв.">бульвар</option>
                    <option value="просп.">проспект</option>
                    <option value="пр-д">проезд</option>
                    <option value="ш.">шоссе</option>
                    <option value="наб.">набережная</option>
                    <option value="алл.">аллея</option>
                    <option value="тракт">тракт</option>
                </select>
            </div>
            <div class="form-group">
                <label>Название улицы</label>
                <input type="text" id="parkStreetName" class="input-field" placeholder="Ленина">
            </div>
            <div class="form-group">
                <label>Номер дома</label>
                <input type="text" id="parkHouseNumber" class="input-field" placeholder="15">
            </div>

            <div class="form-group">
                <label>Количество парковочных мест *</label>
                <input type="number" id="parkSpots" class="input-field" placeholder="${spotsPlaceholder}" min="1" max="500">
                <small style="color:var(--text-secondary); font-size:12px; display:block; margin-top:4px;">
                    Автоматически рассчитано по площади зоны (можно изменить)
                </small>
            </div>
            <button class="btn-primary" id="saveParkBtn" onclick="submitParkingWithPolygon()">Сохранить парковку</button>
            <button class="btn-secondary" onclick="cancelDrawing(); closePanel();">Отмена</button>
        `;

        setTimeout(() => {
            initMiniMap(coordinates);
            if (coordinates && coordinates.length > 0) {
                const centerLat = coordinates.reduce((sum, c) => sum + Number(c[0]), 0) / coordinates.length;
                const centerLng = coordinates.reduce((sum, c) => sum + Number(c[1]), 0) / coordinates.length;
                getAddressByCoordinates(centerLat, centerLng).then(data => {
                    if (!data) return;
                    const streetInput = document.getElementById('parkStreetName');
                    const houseInput = document.getElementById('parkHouseNumber');
                    if (streetInput && data.street) streetInput.value = data.street;
                    if (houseInput && data.houseNumber) houseInput.value = data.houseNumber;
                }).catch(() => {});
            }
        }, 100);
    } catch (e) {
        console.error('Ошибка в openAddPanelWithPolygon:', e);
        showToast('Ошибка при открытии формы', 2000);
    }
}

// ФИКС: держим ссылку на мини-карту и уничтожаем предыдущий инстанс
let _miniMapInstance = null;

function initMiniMap(coords) {
    if (!coords || coords.length < 3) return;

    const container = document.getElementById('miniMapContainer');
    if (!container) return;

    if (_miniMapInstance) {
        try { _miniMapInstance.destroy(); } catch (e) {}
        _miniMapInstance = null;
    }

    const miniMap = new ymaps.Map(container, {
        center: coords[0],
        zoom: 17,
        controls: []
    });
    _miniMapInstance = miniMap;

    const polygon = new ymaps.Polygon([coords], {}, {
        fillColor: '#2B757433',
        strokeColor: '#2B7574',
        strokeWidth: 2
    });
    miniMap.geoObjects.add(polygon);
    miniMap.setBounds(polygon.geometry.getBounds(), { checkZoomRange: true });
}

async function getAddressByCoordinates(lat, lng) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        console.error('❌ Некорректные координаты:', lat, lng);
        return null;
    }
    if (typeof ymaps === 'undefined' || typeof ymaps.geocode !== 'function') {
        console.warn('⚠️ Яндекс.Геокодер недоступен');
        return null;
    }
    try {
        await new Promise(resolve => ymaps.ready(resolve));
        const result = await ymaps.geocode([latitude, longitude], { results: 1 });
        const geo = result.geoObjects.get(0);
        if (!geo) return null;
        const address = geo.getAddressLine?.() || '';
        const localities = typeof geo.getLocalities === 'function' ? geo.getLocalities() : [];
        const areas = typeof geo.getAdministrativeAreas === 'function' ? geo.getAdministrativeAreas() : [];
        let city = localities?.[localities.length - 1] || '';
        let region = areas?.[areas.length - 1] || '';
        let street = '';
        let houseNumber = '';
        const meta = geo.properties.get('metaDataProperty.GeocoderMetaData');
        const components = meta?.Address?.Components || [];
        components.forEach(component => {
            const kind = component.kind;
            const name = String(component.name || '').trim();
            if (!name) return;
            if (!city && (kind === 'locality' || kind === 'area')) city = name;
            if (!region && (kind === 'province' || kind === 'region')) region = name;
            if (!street && kind === 'street') street = name;
            if (!houseNumber && kind === 'house') houseNumber = name;
        });
        if ((!city || !region || !street || !houseNumber) && address && typeof parseAddress === 'function') {
            try {
                const parsed = parseAddress(address) || {};
                if (!city) city = String(parsed.city || '').trim();
                if (!region) region = String(parsed.region || '').trim();
                if (!street) street = String(parsed.street || '').trim();
                if (!houseNumber) houseNumber = String(parsed.houseNumber || '').trim();
            } catch (e) {}
        }
        return { address, city, region, street, houseNumber };
    } catch (error) {
        console.warn('⚠️ Геокодирование не удалось:', error);
        return null;
    }
}

// ФИКС: проверка авторства перед изменением города
async function fixParkingCity(parkingId, city, region) {
    if (!parkingId || !city) {
        console.error('Не указан ID парковки или город');
        return;
    }
    const parking = parkingDataCache[parkingId];
    if (parking && currentUser && parking.authorId && parking.authorId !== currentUser.id) {
        console.warn('⛔ Попытка изменить город чужой парковки заблокирована на клиенте');
        showToast?.('Можно редактировать только свои парковки', 2000);
        return;
    }
    try {
        await database.ref(`parkings/${parkingId}`).update({
            city: city.trim(),
            region: region ? region.trim() : ''
        });
        console.log('✅ Город парковки обновлён:', { parkingId, city, region });
        if (parkingDataCache[parkingId]) {
            parkingDataCache[parkingId].city = city.trim();
            parkingDataCache[parkingId].region = region ? region.trim() : '';
        }
    } catch (error) {
        console.error('❌ Ошибка изменения города:', error);
    }
}

async function submitParkingWithPolygon() {
    const streetType = document.getElementById('parkStreetType')?.value?.trim() || '';
    const streetName = document.getElementById('parkStreetName')?.value?.trim() || '';
    const houseNumber = document.getElementById('parkHouseNumber')?.value?.trim() || '';
    const totalSpots = parseInt(document.getElementById('parkSpots')?.value, 10);
    if (!currentUser) {
        console.error('❌ Пользователь не авторизован');
        return;
    }
    if (!totalSpots || totalSpots < 1) {
        alert('Укажите количество парковочных мест');
        return;
    }
    let coordsToSave = window.newParkingCoords || newParkingCoords;
    if (!coordsToSave && drawingPolygon?.geometry) {
        const raw = drawingPolygon.geometry.getCoordinates()[0];
        coordsToSave = raw.map(c => [Number(c[0]), Number(c[1])]);
    }
    if (!coordsToSave || coordsToSave.length < 3) {
        console.error('❌ Координаты парковки не найдены');
        alert('Не найдены координаты парковочной зоны');
        return;
    }
    const btn = document.getElementById('saveParkBtn');
    const originalText = btn?.textContent || 'Сохранить парковку';
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Определяем адрес...';
    }
    try {
        const centerLat = coordsToSave.reduce((sum, c) => sum + Number(c[0]), 0) / coordsToSave.length;
        const centerLng = coordsToSave.reduce((sum, c) => sum + Number(c[1]), 0) / coordsToSave.length;
        console.log('📍 Координаты парковки:', centerLat, centerLng);
        if (btn) btn.textContent = 'Определяем город...';
        const geoData = await getAddressByCoordinates(centerLat, centerLng);

        // ФИКС: было const detectedCity → бросало TypeError при переприсваивании
        let detectedCity = String(geoData?.city || currentCity || mapCity?.city || userCityPrefs?.city || '').trim();
        const detectedRegion = String(geoData?.region || mapCity?.region || userCityPrefs?.region || '').trim();
        const detectedAddress = String(geoData?.address || '').trim();
        const detectedStreet = String(geoData?.street || '').trim();
        const detectedHouseNumber = String(geoData?.houseNumber || '').trim();
        console.log('🏙️ Город:', detectedCity);
        console.log('🗺️ Регион:', detectedRegion);
        console.log('📬 Адрес:', detectedAddress);

        if (!detectedCity) {
            console.warn('⚠️ Яндекс не определил город, используем выбранный город карты');
            detectedCity = String(currentCity || mapCity?.city || userCityPrefs?.city || '').trim();
        }
        if (!detectedCity) {
            console.warn('⚠️ Город не определён, парковка будет сохранена без города');
        }

        const fullStreet = streetType && streetName ? `${streetType} ${streetName}` : streetName;
        const finalStreet = fullStreet || detectedStreet;
        const finalHouseNumber = houseNumber || detectedHouseNumber;
        const finalAddress = detectedAddress || [detectedCity, finalStreet, finalHouseNumber].filter(Boolean).join(', ');
        const name = fullStreet && houseNumber ? `${fullStreet}, ${houseNumber}` : finalAddress || `Парковка ${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}`;
        const now = Date.now();
        const parkingData = {
            lat: centerLat,
            lng: centerLng,
            coordinates: coordsToSave,
            totalSpots,
            occupiedSpots: 0,
            name,
            isPaid: false,
            address: finalAddress,
            city: detectedCity,
            region: detectedRegion,
            street: finalStreet,
            houseNumber: finalHouseNumber,
            authorId: currentUser.id,
            authorName: currentUser.firstName || currentUser.username || '',
            authorUsername: currentUser.username || '',
            lastUpdatedAt: now,
            lastUpdatedBy: currentUser.nickname || currentUser.firstName || currentUser.username || 'Пользователь',
            timestamp: now,
            status: 'unknown',
            statusConfirmations: 0
        };
        console.log('💾 Парковка перед сохранением:', parkingData);

        const cleanKeyPart = value => String(value || '').trim().replace(/[.#$/[\]]/g, '').replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        const cityKey = cleanKeyPart(detectedCity);
        const streetKey = cleanKeyPart(finalStreet) || 'Неизвестная_улица';
        const houseKey = cleanKeyPart(finalHouseNumber) || 'Без_дома';
        const baseKey = `${cityKey}_${streetKey}_${houseKey}`;

        // ФИКС: генерация ключа через transaction() вместо exists()+set() —
        // убирает гонку при одновременных сохранениях
        let number = 1;
        let parkingKey = `${baseKey}_(${number})`;
        let committed = false;
        const MAX_ATTEMPTS = 50;
        if (btn) btn.textContent = 'Сохраняем...';

        while (!committed && number <= MAX_ATTEMPTS) {
            parkingKey = `${baseKey}_(${number})`;
            const parkingRef = database.ref(`parkings/${parkingKey}`);
            const txResult = await parkingRef.transaction(currentData => {
                if (currentData !== null) return undefined;
                return parkingData;
            });
            committed = txResult.committed;
            if (!committed) number++;
        }

        if (!committed) {
            throw new Error('Не удалось подобрать свободный идентификатор парковки, попробуйте ещё раз');
        }

        console.log('🔑 Ключ Firebase:', parkingKey);
        console.log('✅ Основные данные парковки записаны в Firebase');

        const parkingRef = database.ref(`parkings/${parkingKey}`);
        try {
            await database.ref(`users/${currentUser.id}/stats/parkingsCreated`).transaction(count => (count || 0) + 1);
        } catch (error) {
            console.warn('⚠️ Не удалось обновить статистику:', error);
        }
        try {
            await parkingRef.child('history').push({
                action: 'created',
                timestamp: now,
                userId: currentUser.id,
                username: currentUser.username || ''
            });
        } catch (error) {
            console.warn('⚠️ Не удалось сохранить history:', error);
        }

        parkingDataCache[parkingKey] = { ...parkingData, id: parkingKey };
        try {
            addMarkerToMap(parkingKey, parkingData);
        } catch (error) {
            console.warn('⚠️ Маркер не добавлен:', error);
        }
        if (drawingPolygon) {
            try {
                map.geoObjects.remove(drawingPolygon);
            } catch (error) {
                console.warn('⚠️ Не удалось удалить полигон:', error);
            }
            drawingPolygon = null;
        }
        window.newParkingCoords = null;
        newParkingCoords = null;
        if (map) {
            map.setCenter([centerLat, centerLng], 17, { duration: 500 });
        }
        try {
            if (clusterer) {
                clusterer.removeAll();
                Object.entries(parkingDataCache).forEach(([id, parking]) => {
                    const parkingCity = String(parking.city || '').trim().toLowerCase();
                    if (parkingCity === detectedCity.trim().toLowerCase()) {
                        addMarkerToMap(id, parking);
                    }
                });
            }
        } catch (error) {
            console.warn('⚠️ Ошибка обновления кластера:', error);
        }
        try {
            if (typeof filterParkings === 'function' && document.getElementById('searchResults')) {
                filterParkings();
            }
        } catch (error) {
            console.warn('⚠️ Ошибка обновления списка:', error);
        }

        console.log('✅ ПАРКОВКА ПОЛНОСТЬЮ СОХРАНЕНА');
        console.log('🏙️ Город:', detectedCity);
        console.log('🗺️ Регион:', detectedRegion);
        console.log('🔑 ID:', parkingKey);
        if (typeof closePanel === 'function') closePanel();
        if (typeof showMap === 'function') showMap();
    } catch (error) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА СОХРАНЕНИЯ:', error);
        alert(`Не удалось сохранить парковку.\n${error.message || 'Неизвестная ошибка'}`);
    } finally {
        if (btn) {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }
}

// ФИКС: проверка авторства перед изменением границ
async function saveEditedPolygon(newCoords) {
    if (!currentParkingId) return;

    if (currentParkingData?.authorId && currentUser && currentParkingData.authorId !== currentUser.id) {
        console.warn('⛔ Попытка изменить границы чужой парковки заблокирована на клиенте');
        alert('Можно редактировать только свои парковки');
        cancelDrawing();
        return;
    }

    const sizeCheck = checkPolygonSize(newCoords);
    if (!sizeCheck.valid) {
        alert(sizeCheck.error);
        cancelDrawing();
        return;
    }
    try {
        const centerLat = newCoords.reduce((sum, c) => sum + Number(c[0]), 0) / newCoords.length;
        const centerLng = newCoords.reduce((sum, c) => sum + Number(c[1]), 0) / newCoords.length;
        await database.ref(`parkings/${currentParkingId}`).update({
            coordinates: newCoords,
            lat: centerLat,
            lng: centerLng,
            lastUpdatedAt: Date.now(),
            lastUpdatedBy: currentUser?.nickname || currentUser?.firstName || ''
        });
        if (editingPolygon) {
            map.geoObjects.remove(editingPolygon);
            editingPolygon = null;
        }
        const addBtn = document.getElementById('addBtn');
        if (addBtn) {
            addBtn.classList.remove('drawing');
            addBtn.textContent = '+';
        }
        isDrawingMode = false;
        const controls = document.getElementById('drawingControls');
        if (controls) controls.remove();
        currentParkingData.coordinates = newCoords;
        currentParkingData.lat = centerLat;
        currentParkingData.lng = centerLng;
        parkingDataCache[currentParkingId] = currentParkingData;
        refreshParkingMarker();
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        alert('Границы обновлены');
    } catch (err) {
        console.error('Ошибка обновления полигона:', err);
        alert('Ошибка: ' + (err.message || 'неизвестная ошибка'));
        cancelDrawing();
    }
}

// ===================== checkPolygonSize =====================
function checkPolygonSize(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length < 3) {
        return { valid: false, error: 'Минимум 3 точки' };
    }
    const validCoords = coordinates.filter(c =>
        Array.isArray(c) &&
        c.length >= 2 &&
        Number.isFinite(Number(c[0])) &&
        Number.isFinite(Number(c[1]))
    );
    if (validCoords.length < 3) {
        return { valid: false, error: 'Некорректные координаты зоны' };
    }

    const lats = validCoords.map(c => Number(c[0]));
    const lngs = validCoords.map(c => Number(c[1]));
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const widthM = getDistanceInMeters(minLat, minLng, minLat, maxLng);
    const lengthM = getDistanceInMeters(minLat, minLng, maxLat, minLng);

    const maxDiagonal = Math.sqrt(MAX_ZONE_WIDTH ** 2 + MAX_ZONE_LENGTH ** 2);

    let maxPairDistance = 0;
    for (let i = 0; i < validCoords.length; i++) {
        for (let j = i + 1; j < validCoords.length; j++) {
            const d = getDistanceInMeters(
                Number(validCoords[i][0]), Number(validCoords[i][1]),
                Number(validCoords[j][0]), Number(validCoords[j][1])
            );
            if (d > maxPairDistance) maxPairDistance = d;
        }
    }

    const maxArea = MAX_ZONE_WIDTH * MAX_ZONE_LENGTH;
    const area = typeof calculatePolygonArea === 'function' ? calculatePolygonArea(validCoords) : null;

    const failsBoundingBox = widthM > MAX_ZONE_WIDTH || lengthM > MAX_ZONE_LENGTH;
    const failsDiagonal = maxPairDistance > maxDiagonal;
    const failsArea = area !== null && area > maxArea;

    if (failsBoundingBox || failsDiagonal || failsArea) {
        return {
            valid: false,
            error: `Зона слишком большая! Максимум ${MAX_ZONE_WIDTH}×${MAX_ZONE_LENGTH} м. ` +
                   `Сейчас: ${Math.round(widthM)}×${Math.round(lengthM)} м, диагональ ${Math.round(maxPairDistance)} м` +
                   (area !== null ? `, площадь ${Math.round(area)} м²` : '')
        };
    }

    return { valid: true, width: widthM, length: lengthM };
}
    // ===================== ПАНЕЛЬ ПАРКОВКИ =====================
    function openParkingSheet(parkingId, data) {
    // Получаем элементы bottom-sheet
    var sheet = document.getElementById('parkingSheet');
    var content = document.getElementById('sheetContent');
    if (!sheet || !content) {
        console.error('❌ Bottom-sheet элементы не найдены');
        return;
    }

    var addr = data.address || (data.lat && data.lng ? data.lat.toFixed(6) + ', ' + data.lng.toFixed(6) : 'Адрес не указан');
    var free = data.totalSpots - (data.occupiedSpots || 0);

    // Функция рендеринга содержимого с расстоянием
    function renderContent(distKm, driveTime) {
        var html = '';
        html += '<h3>' + data.name + '</h3>';
        html += '<p>📍 ' + addr + '</p>';
        if (distKm !== undefined) {
            html += '<p>📏 ' + distKm + ' км от вас</p>';
            html += '<p>🚗 На авто: ' + driveTime + ' мин</p>';
        } else {
            html += '<p>📏 Расстояние неизвестно</p>';
        }
        html += '<p>🅿️ Свободно: ' + free + ' / ' + data.totalSpots + '</p>';
        html += '<button class="btn-secondary" onclick="openOccupancyPanel(\'' + parkingId + '\')" style="margin-top:12px;">✏️ Редактировать</button>';
        html += '<button class="btn-secondary" onclick="buildRouteToParking(\'' + parkingId + '\')" style="margin-top:8px;">🧭 Построить маршрут</button>';
        content.innerHTML = html;
        sheet.classList.add('active');
    }

    // Пытаемся получить геолокацию для расчёта расстояния
    getUserLocation().then(function(coords) {
        var dist = getDistanceInMeters(coords.lat, coords.lng, data.lat, data.lng);
        var distKm = (dist / 1000).toFixed(1);
        var driveTime = Math.round(dist / 500);
        renderContent(distKm, driveTime);
    }).catch(function() {
        // Если геолокация недоступна – показываем без расстояния
        renderContent();
    });
} 
// ===================== ЦЕНТРАЛЬНОЕ МОДАЛЬНОЕ ОКНО =====================
async function openCenterSheet(parkingId, data) {
    const sheet = document.getElementById('centerSheet');
    const content = document.getElementById('centerSheetContent');
    if (!sheet || !content) return;
    currentParkingId = parkingId;
    currentParkingData = data;
    parkingDataCache[parkingId] = data;
    const total = Number(data.totalSpots) || 0;
    const available = Number(data.availableSpots);
    const status = data.status || 'unknown';

    let statusIcon = '⚪', statusTitle = 'Нет свежих данных', statusClass = 'unknown';
    if (status === 'free') {
        statusIcon = '🟢';
        statusTitle = 'Есть места';
        statusClass = 'free';
    } else if (status === 'limited') {
        statusIcon = '🟡';
        statusTitle = 'Мало мест';
        statusClass = 'limited';
    } else if (status === 'occupied') {
        statusIcon = '🔴';
        statusTitle = 'Мест нет';
        statusClass = 'occupied';
    }
    const availableText = Number.isFinite(available) && total > 0
    ? ` · Свободно: ${Math.max(0, Math.min(available, total))} из ${total}`
    : '';
    let lastUpdatedText = 'Нет данных';
    if (data.lastUpdatedAt) {
        const diff = Math.max(0, Date.now() - Number(data.lastUpdatedAt));
        const minutes = Math.floor(diff / 60000);

        if (minutes < 1) lastUpdatedText = 'только что';
        else if (minutes < 60) lastUpdatedText = `${minutes} мин назад`;
        else {
            const hours = Math.floor(minutes / 60);
            lastUpdatedText = hours < 24 ? `${hours} ч назад` : `${Math.floor(hours / 24)} дн назад`;
        }
    }
    const confirmations = Number(data.statusConfirmations) || 0;
    const address = data.address ? escapeHtml(data.address) : 'Адрес не указан';
    const safeId = escapeHtml(parkingId);

    content.innerHTML = `
        <div class="parking-card-compact">
            <div class="parking-card-handle"></div>
            <div class="parking-card-header">
                <div class="parking-card-title">
                    🅿️ ${escapeHtml(data.name || 'Парковка')}
                </div>
                <div class="parking-card-street">
                    ${address}
                </div>
            </div>
            <div class="parking-status-compact ${statusClass}">
    <span class="parking-status-dot">${statusIcon}</span>
    <strong>${statusTitle}</strong>
    <span class="parking-status-available">${availableText}</span>
</div>
            <div class="parking-meta">
                <div class="parking-meta-item">
                    <strong>${total || '—'}</strong>
                    <span>мест всего</span>
                </div>
                <div class="parking-meta-item">
                    <strong>${confirmations}</strong>
                    <span>подтверждений</span>
                </div>
                <div class="parking-meta-item">
                    <strong>${lastUpdatedText}</strong>
                    <span>обновлено</span>
                </div>
            </div>
            <button class="parking-route-btn" onclick="buildRouteToParking('${safeId}')">
                <span>🧭</span>
                <span>Поехать</span>
            </button>
            <div class="parking-secondary-actions">
                <button class="parking-secondary-btn parking-update-btn" onclick="reportParkingStatus('${safeId}')">
                    <span>↻</span>
                    <span>Обновить</span>
                </button>

                <button class="parking-secondary-btn parking-favorite-btn" onclick="toggleFavoriteCenter()">
                    <span>♡</span>
                    <span>Сохранить</span>
                </button>
            </div>
            <button class="parking-edit-btn" onclick="editFromCenter()">
                ✎ Редактировать
            </button>
        </div>`;
    sheet.classList.add('active');
}
function reportParkingStatus(parkingId) {
    const content = document.getElementById('centerSheetContent');
    if (!content) return;
    const safeId = escapeHtml(parkingId);
    content.innerHTML = `
        <div class="parking-status-panel">
            <div class="parking-status-panel-title">Как сейчас выглядит парковка?</div>
            <div class="parking-status-panel-subtitle">Выберите наиболее подходящий вариант</div>
            <button class="status-choice status-choice-free" onclick="submitParkingStatus('${safeId}','free')">
                <span class="status-choice-icon">🟢</span>
                <span class="status-choice-content"><strong>Есть места</strong><small>Свободных мест достаточно</small></span>
            </button>
            <button class="status-choice status-choice-limited" onclick="submitParkingStatus('${safeId}','limited')">
                <span class="status-choice-icon">🟡</span>
                <span class="status-choice-content"><strong>Мало мест</strong><small>Парковка почти заполнена</small></span>
            </button>
            <button class="status-choice status-choice-occupied" onclick="submitParkingStatus('${safeId}','occupied')">
                <span class="status-choice-icon">🔴</span>
                <span class="status-choice-content"><strong>Мест нет</strong><small>Свободное место найти сложно</small></span>
            </button>
            <button class="btn-secondary" onclick="openCenterSheet('${safeId}', currentParkingData)" style="margin-top:12px;">← Назад</button>
        </div>`;
}
async function submitParkingStatus(parkingId, status) {
    if (!parkingId) return;
    if (!currentUser?.id) {
        alert('Чтобы обновлять состояние парковки, необходимо войти в аккаунт.');
        return;
    }
    const allowedStatuses = ['free', 'limited', 'occupied'];
    if (!allowedStatuses.includes(status)) {
        console.error('Недопустимый статус:', status);
        return;
    }
    try {
        const parkingRef = database.ref(`parkings/${parkingId}`);
        const snapshot = await parkingRef.once('value');
        const parking = snapshot.val();
        if (!parking) {
            console.error('Парковка не найдена:', parkingId);
            return;
        }
        const now = Date.now();
        const userName = currentUser.nickname || currentUser.firstName || currentUser.username || 'Пользователь';
        const confirmations = Number(parking.statusConfirmations) || 0;
        const updatedData = {
            ...parking,
            status,
            lastUpdatedAt: now,
            lastUpdatedBy: userName,
            statusConfirmations: confirmations + 1
        };
        await parkingRef.update({
            status,
            lastUpdatedAt: now,
            lastUpdatedBy: userName,
            statusConfirmations: confirmations + 1
        });
        await parkingRef.child('history').push({
            action: 'status_update',
            status,
            timestamp: now,
            userId: currentUser.id,
            username: currentUser.username || currentUser.firstName || ''
        });
        currentParkingData = updatedData;
        parkingDataCache[parkingId] = updatedData;
        try {
            refreshParkingMarker();
        } catch (e) {
            console.warn('Не удалось обновить маркер:', e);
        }
        await openCenterSheet(parkingId, updatedData);
        if (window.Telegram?.WebApp?.HapticFeedback) {
            try {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            } catch (e) {}
        }
    } catch (error) {
        console.error('Ошибка обновления состояния парковки:', error);
        alert('Не удалось обновить состояние парковки.');
    }
}
function getParkingPlacesWord(number) {
    number = Math.abs(Number(number));
    const lastTwo = number % 100;
    const lastOne = number % 10;
    if (lastTwo >= 11 && lastTwo <= 19) return 'мест';
    if (lastOne === 1) return 'место';
    if (lastOne >= 2 && lastOne <= 4) return 'места';
    return 'мест';
}
function closeCenterSheet() {
    const sheet = document.getElementById('centerSheet');
    if (sheet) sheet.classList.remove('active');
    currentParkingId = null;
    currentParkingData = null;
    if (activePolygon) {
        activePolygon.options.set('visible', false);
        activePolygon = null;
    }
    if (map && previousCenter) {
        try {
            map.setCenter(previousCenter, 16, { duration: 300 });
        } catch (e) {
            console.warn('Ошибка восстановления центра:', e);
        }
        previousCenter = null;
        previousZoom = null;
    } else if (map) {
        map.setZoom(16, { duration: 300 });
    }
}

function buildRouteFromCenter() {
    if (!currentParkingData) {
        console.error('Маршрут: данные выбранной парковки отсутствуют');
        return;
    }
    const data = currentParkingData;
    const lat = Number(data.lat ?? data.latitude ?? data.coords?.[0]);
    const lng = Number(data.lng ?? data.longitude ?? data.coords?.[1]);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        alert('Не удалось определить координаты парковки');
        return;
    }
    closeCenterSheet();
    const openRoute = (userLat = null, userLng = null) => {
        let url = `https://yandex.ru/maps/?rtext=~${lat},${lng}&rtt=auto`;

        if (userLat !== null && userLng !== null) {
            url = `https://yandex.ru/maps/?rtext=${userLat},${userLng}~${lat},${lng}&rtt=auto`;
        }
        window.open(url, '_blank');
    };
    if (!navigator.geolocation) {
        openRoute();
        return;
    }
    navigator.geolocation.getCurrentPosition(
        position => {
            openRoute(
                position.coords.latitude,
                position.coords.longitude
            );
        },
        error => {
            console.warn('Не удалось получить геолокацию:', error);
            openRoute();
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000
        }
    );
}
function editFromCenter() {
    if (!currentParkingId) return;
    const parkingId = currentParkingId;
    closeCenterSheet();
    openOccupancyPanel(parkingId);
}
    // ===================== РЕДАКТИРОВАНИЕ ПАРКОВКИ =====================
    function openOccupancyPanel(parkingId) {
        database.ref(`parkings/${parkingId}`).once('value').then(snapshot => {
            const data = snapshot.val();
            if (!data) return;
            if (currentUser && currentUser.id !== data.authorId) {
                database.ref(`parkings/${parkingId}/views`).transaction(v => (v || 0) + 1);
                database.ref(`users/${data.authorId}/stats/views`).transaction(v => (v || 0) + 1);
            }
            currentParkingId = parkingId;
            currentParkingData = data;
            parkingDataCache[parkingId] = data;

            if (currentUser) {
                Promise.all([
                    database.ref(`users/${currentUser.id}/car`).once('value'),
                    database.ref(`users/${currentUser.id}/favorites/${parkingId}`).once('value')
                ]).then(([carSnap, favSnap]) => {
                    currentUser.car = carSnap.val() || {};
                    const isFavorite = favSnap.exists();
                    renderEditPanel(data, isFavorite);
                });
            } else {
                renderEditPanel(data, false);
            }
        });
    }

   function renderEditPanel(data, isFavorite) {
    const totalSpots = Number(data.totalSpots) || 0;
    const occupiedSpots = Math.min(Number(data.occupiedSpots) || 0, totalSpots);
    const freeSpots = Math.max(0, totalSpots - occupiedSpots);
    const status = data.status || 'unknown';
    const statusClass = status === 'free' ? 'status-free' : status === 'occupied' ? 'status-occupied' : 'status-unknown';
    const isAuthor = currentUser && currentUser.id === data.authorId;
    const currentStreet = data.street || '';
    const streetName = extractStreetName(currentStreet);

    document.getElementById('panel').classList.add('active');
    document.getElementById('panelTitle').textContent = 'Парковка';

    let html = `
        <div class="edit-parking">
            <div class="edit-parking-header">
                <div>
                    <div class="edit-parking-title">
                        <span class="status-indicator ${statusClass}"></span>
                        ${escapeHtml(data.name || 'Без названия')}
                    </div>
                    <div class="edit-parking-address">📍 ${escapeHtml(currentStreet || 'Адрес не указан')}</div>
                </div>
            </div>
            <div class="edit-parking-stats">
                <div class="edit-stat">
                    <strong id="statTotal">${totalSpots}</strong>
                    <span>Всего мест</span>
                </div>
                <div class="edit-stat">
                    <strong id="statFree">${freeSpots}</strong>
                    <span>Свободно</span>
                </div>
                <div class="edit-stat">
                    <strong id="statOccupied">${occupiedSpots}</strong>
                    <span>Занято</span>
                </div>
            </div>
            <div class="edit-section">
                <div class="edit-section-title">🅿️ Занятые места</div>
                <div class="edit-counter">
                    <button class="edit-counter-btn" onclick="changeOccupancy(-1,'${currentParkingId}')">−</button>
                    <div class="edit-counter-value" id="currentOccupied">${occupiedSpots}</div>
                    <button class="edit-counter-btn" onclick="changeOccupancy(1,'${currentParkingId}')">+</button>
                </div>
            </div>
            <div class="edit-section">
                <div class="edit-section-title">📋 История изменений</div>
                <div id="historyContainer">
                    <div id="historyList"></div>
                    <div id="historyFullList" style="display:none;"></div>
                    <button id="showAllHistoryBtn" class="edit-history-btn" style="display:none;">См. все</button>
                    <button id="hideAllHistoryBtn" class="edit-history-btn" style="display:none;">Скрыть</button>
                </div>
                <span id="historyCount"></span>
            </div>
            <div class="edit-actions">
                <button class="btn-primary" onclick="buildRouteToParking('${currentParkingId}')">🧭 Построить маршрут</button>
                ${isAuthor ? `<button class="btn-secondary" onclick="toggleParkingEditor()">✏️ Редактировать данные</button>` : ''}
                <button class="btn-danger" onclick="deleteParkingWithConfirm('${currentParkingId}')">🗑️ Удалить парковку</button>
            </div>
    `;
    if (isAuthor) {
        html += `
            <div id="editPanel" class="edit-form" style="display:none;">
                <div class="edit-form-title">✏️ Данные парковки</div>

                <label>Тип улицы</label>
                <select id="editStreetType" class="input-field">
                    <option value="">-- выберите --</option>
                    <option value="ул." ${currentStreet.startsWith('ул.') ? 'selected' : ''}>улица</option>
                    <option value="пер." ${currentStreet.startsWith('пер.') ? 'selected' : ''}>переулок</option>
                    <option value="бульв." ${currentStreet.startsWith('бульв.') ? 'selected' : ''}>бульвар</option>
                    <option value="просп." ${currentStreet.startsWith('просп.') ? 'selected' : ''}>проспект</option>
                    <option value="пр-д" ${currentStreet.startsWith('пр-д') ? 'selected' : ''}>проезд</option>
                    <option value="ш." ${currentStreet.startsWith('ш.') ? 'selected' : ''}>шоссе</option>
                    <option value="наб." ${currentStreet.startsWith('наб.') ? 'selected' : ''}>набережная</option>
                    <option value="алл." ${currentStreet.startsWith('алл.') ? 'selected' : ''}>аллея</option>
                    <option value="тракт" ${currentStreet.startsWith('тракт') ? 'selected' : ''}>тракт</option>
                </select>

                <label>Название улицы</label>
                <input type="text" id="editStreetName" class="input-field" value="${escapeHtml(streetName)}" placeholder="Название улицы">

                <label>Номер дома</label>
                <input type="text" id="editHouseNumber" class="input-field" value="${escapeHtml(data.houseNumber || '')}" placeholder="15">

                <label>Количество парковочных мест</label>
                <input type="number" id="editTotalSpots" class="input-field" value="${totalSpots}" min="1" max="500">

                <button class="btn-primary" onclick="saveParkingDetails()">💾 Сохранить изменения</button>
                <button class="btn-secondary" onclick="toggleParkingEditor()">Отмена</button>
            </div>
        `;
    } else if (currentUser) {
        html += `<div class="edit-no-access">Вы не являетесь автором этой парковки</div>`;
    }
    html += `</div>`;
    document.getElementById('panelContent').innerHTML = html;
    if (currentUser && currentParkingId) {
        loadHistoryPreview(currentParkingId);
    }
    window.showAllHistory = function() {
        document.getElementById('historyList').style.display = 'none';
        document.getElementById('historyFullList').style.display = 'block';
        document.getElementById('showAllHistoryBtn').style.display = 'none';
        document.getElementById('hideAllHistoryBtn').style.display = 'inline-block';
    };
    window.hideAllHistory = function() {
        document.getElementById('historyFullList').style.display = 'none';
        document.getElementById('historyList').style.display = 'block';
        document.getElementById('showAllHistoryBtn').style.display = 'inline-block';
        document.getElementById('hideAllHistoryBtn').style.display = 'none';
    };
    window.toggleParkingEditor = function() {
        const panel = document.getElementById('editPanel');
        if (!panel) return;
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    };
    window.deleteParkingWithConfirm = function(parkingId) {
        if (confirm('Вы уверены, что хотите удалить эту парковку? Это действие необратимо!')) {
            deleteParking(parkingId);
        }
    };
}
function loadHistoryPreview(parkingId) {
    const container = document.getElementById('historyList');
    const fullContainer = document.getElementById('historyFullList');
    const countEl = document.getElementById('historyCount');
    const showAllBtn = document.getElementById('showAllHistoryBtn');
    const hideAllBtn = document.getElementById('hideAllHistoryBtn');

    if (!container || !currentParkingId) return;

    database.ref(`parkings/${parkingId}/history`)
        .orderByChild('timestamp')
        .limitToLast(100)
        .once('value')
        .then(snapshot => {
            const history = snapshot.val();
            if (!history) {
                container.innerHTML = '<div style="color:var(--text-secondary); font-size:13px;">История пуста</div>';
                if (countEl) countEl.textContent = '';
                return;
            }

            const entries = Object.entries(history)
                .map(([key, val]) => ({ key, ...val }))
                .sort((a, b) => b.timestamp - a.timestamp);

            if (countEl) countEl.textContent = `(${entries.length})`;

            // Функция рендеринга одной записи (без чисел и госномера)
            const renderEntry = (entry) => {
                const date = new Date(entry.timestamp);
                const timeStr = date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                const action = entry.action === 'occupied' ? 'Занял' : 'Освободил';
                const actionColor = entry.action === 'occupied' ? 'var(--history-occupied)' : 'var(--history-freed)';
                const username = entry.username || 'Неизвестный';
                const car = entry.car || {};
                let carStr = '';
                if (car.brand || car.model) {
                    carStr = `${car.brand} ${car.model}`;
                } else {
                    carStr = 'без авто';
                }
                return `
                    <div style="padding:8px 12px; background:var(--bg-primary); border-radius:8px; margin-bottom:4px; font-size:13px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:4px;">
                        <div><span style="font-weight:500; color:${actionColor};">${action}</span></div>
                        <div style="color:var(--text-secondary); font-size:12px;">${escapeHtml(username)} • ${escapeHtml(carStr)}</div>
                        <div style="color:var(--text-secondary); font-size:11px;">${timeStr}</div>
                    </div>
                `;
            };

            // Показываем первые 3 в основном контейнере
            const showCount = 3;
            const previewEntries = entries.slice(0, showCount);
            const remainingEntries = entries.slice(showCount);

            container.innerHTML = previewEntries.map(renderEntry).join('');

            if (remainingEntries.length > 0) {
                showAllBtn.style.display = 'inline-block';
                fullContainer.innerHTML = remainingEntries.map(renderEntry).join('');
                fullContainer.style.display = 'none';
                hideAllBtn.style.display = 'none';
            } else {
                showAllBtn.style.display = 'none';
                fullContainer.style.display = 'none';
                hideAllBtn.style.display = 'none';
            }

            // Обработчики кнопок
            showAllBtn.onclick = function() {
                container.style.display = 'none';
                fullContainer.style.display = 'block';
                showAllBtn.style.display = 'none';
                hideAllBtn.style.display = 'inline-block';
            };
            hideAllBtn.onclick = function() {
                fullContainer.style.display = 'none';
                container.style.display = 'block';
                showAllBtn.style.display = 'inline-block';
                hideAllBtn.style.display = 'none';
            };
        })
        .catch(err => {
            console.error('Ошибка загрузки истории:', err);
            container.innerHTML = '<div style="color:var(--red);">Ошибка загрузки</div>';
        });
}
    function loadHistory(parkingId, limit = 10, days = 3) {
        const container = document.getElementById('historyList');
        const countEl = document.getElementById('historyCount');
        const loadMoreBtn = document.getElementById('loadMoreHistory');
        if (!container) return;

        const now = Date.now();
        const cutoff = now - days * 24 * 60 * 60 * 1000;

        database.ref(`parkings/${parkingId}/history`).orderByChild('timestamp').limitToLast(limit).once('value',
        snapshot => {
            const history = snapshot.val();
            if (!history) {
                container.innerHTML = '<div style="color:var(--text-secondary); font-size:13px;">История пуста</div>';
                if (countEl) countEl.textContent = '';
                return;
            }

            let entries = Object.entries(history).map(([key, val]) => ({ key, ...val }))
                .sort((a, b) => b.timestamp - a.timestamp)
                .filter(entry => entry.timestamp >= cutoff);

            if (countEl) countEl.textContent = `(${entries.length})`;

            if (entries.length === 0) {
                container.innerHTML =
                    `<div style="color:var(--text-secondary); font-size:13px;">Нет изменений за последние ${days} дней</div>`;
                if (loadMoreBtn) loadMoreBtn.style.display = 'none';
                return;
            }

            let html = '';
            entries.forEach(entry => {
                const date = new Date(entry.timestamp);
                const timeStr = date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit',
                    year: 'numeric', hour: '2-digit', minute: '2-digit' });
                const action = entry.action === 'occupied' ? '🚗 Занял' : '🚗 Освободил';
                const username = entry.username || 'Неизвестный';
                const car = entry.car || {};
                let carStr = '';
                if (car.brand || car.model) {
                    carStr = `${car.brand} ${car.model}`;
                    if (car.plate) carStr += ` (${car.plate})`;
                } else {
                    carStr = 'машина не указана';
                }
                html += `
            <div style="padding:8px 12px; background:var(--bg-primary); border-radius:8px; margin-bottom:4px; font-size:13px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:4px;">
                <div><span style="font-weight:500;">${action}</span> (${entry.previousOccupied} → ${entry.newOccupied})</div>
                <div style="color:var(--text-secondary); font-size:12px;">${username} • ${carStr}</div>
                <div style="color:var(--text-secondary); font-size:11px;">${timeStr}</div>
            </div>
            `;
            });
            container.innerHTML = html;

            if (loadMoreBtn) {
                database.ref(`parkings/${parkingId}/history`).once('value', totalSnap => {
                    const total = totalSnap.numChildren ? totalSnap.numChildren() : 0;
                    if (total > limit) {
                        loadMoreBtn.style.display = 'block';
                        loadMoreBtn.onclick = function() {
                            loadHistory(parkingId, 100, days);
                            this.style.display = 'none';
                        };
                    } else {
                        loadMoreBtn.style.display = 'none';
                    }
                });
            }
        });
    }

    function saveParkingDetails() {
    if (!currentUser) { alert('Необходимо авторизоваться'); return; }
    if (!currentParkingId || !currentParkingData) return;

    const streetType = document.getElementById('editStreetType')?.value || '';
    const streetName = document.getElementById('editStreetName')?.value.trim() || '';
    const houseNumber = document.getElementById('editHouseNumber')?.value.trim() || '';
    const totalSpots = parseInt(document.getElementById('editTotalSpots')?.value) || 0;

    const street = streetType && streetName ? `${streetType} ${streetName}` : (streetName || currentParkingData.street || '');
    if (!street && !houseNumber) { alert('Введите улицу или номер дома'); return; }

    let newName = street;
    if (houseNumber) {
        newName = newName ? `${newName}, ${houseNumber}` : houseNumber;
    }
    if (!newName) {
        newName = 'Адрес не указан';
    }

    if (isNaN(totalSpots) || totalSpots < 1) { alert('Количество мест должно быть больше 0'); return; }
    if (totalSpots < currentParkingData.occupiedSpots) { alert('Общее число мест не может быть меньше занятых.'); return; }

    const updates = { name: newName, street, houseNumber, totalSpots };

    database.ref(`parkings/${currentParkingId}`).update(updates).then(() => {
        if (currentUser.id === currentParkingData.authorId) database.ref(`users/${currentUser.id}/stats/parkingsUpdated`).transaction(c => (c || 0) + 1);
        currentParkingData = { ...currentParkingData, ...updates };
        parkingDataCache[currentParkingId] = currentParkingData;
        updateOccupancyDisplay(currentParkingData.occupiedSpots);
        refreshParkingMarker();

        // ✅ Пересчитываем кластеры
        if (clusterer) clusterer.reload();

        // ... остальной код (закрытие панели, обновление интерфейса)
        closePanel();
        showMap();
        if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }).catch(err => { console.error('Ошибка сохранения:', err); alert('Ошибка: ' + err.message); });
}

    function updateOccupancyDisplay(newOccupied) {
        if (!currentParkingData) return;
        const total = currentParkingData.totalSpots || 0,
            free = total - newOccupied,
            color = getOccupancyColor(newOccupied, total),
            percent = total > 0 ? Math.round((newOccupied / total) * 100) : 0;
        ['statTotal', 'statFree', 'statOccupied', 'currentOccupied'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = id === 'statTotal' ? total : (id === 'statFree' ? free : (id ===
                'statOccupied' ? newOccupied : newOccupied));
        });
        const progress = document.getElementById('progressFill');
        if (progress) { progress.style.width = percent + '%';
            progress.style.background = color; }
        const percentText = document.getElementById('occupancyPercentText');
        if (percentText) percentText.textContent = `Загруженность: ${percent}%`;
        currentParkingData.occupiedSpots = newOccupied;
    }

  async function changeOccupancy(delta, parkingId) {
    if (!currentUser) {
        showToast('Необходимо авторизоваться');
        return;
    }

    const id = parkingId || currentParkingId;
    if (!id) {
        showToast('ID парковки не найден');
        return;
    }

    const parkingRef = database.ref(`parkings/${id}`);

    try {
        const snapshot = await parkingRef.once('value');
        const data = snapshot.val();

        if (!data) {
            showToast('Парковка не найдена');
            return;
        }

        const total = Number(data.totalSpots || 0);
        let previousOccupied = 0;
        let newOccupied = 0;

        const result = await parkingRef.child('occupiedSpots').transaction(
            currentValue => {
                previousOccupied = Number(currentValue || 0);
                newOccupied = previousOccupied + delta;
                if (newOccupied < 0 || newOccupied > total) return;
                return newOccupied;
            }
        );

        if (!result.committed) {
            showToast('Количество мест уже изменилось');
            return;
        }

        const now = Date.now();
        await parkingRef.update({
            lastUpdatedAt: now,
            lastUpdatedBy: currentUser.nickname || currentUser.firstName || 'Пользователь'
        });

        await parkingRef.child('history').push({
            action: delta < 0 ? 'freed' : 'occupied',
            timestamp: now,
            userId: currentUser.id,
            username: currentUser.username || currentUser.nickname || 'Пользователь',
            previousOccupied,
            newOccupied
        });

        if (parkingDataCache[id]) parkingDataCache[id].occupiedSpots = newOccupied;
        if (id === currentParkingId && currentParkingData) currentParkingData.occupiedSpots = newOccupied;

        updateOccupancyDisplay(newOccupied);
        refreshParkingMarker();

        // ✅ Пересчитываем кластеры, чтобы обновить сумму на иконках
        if (clusterer) clusterer.reload();

        if (document.getElementById('historyList')) loadHistoryPreview(id);
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.selectionChanged();
        }

    } catch (error) {
        console.error('Ошибка обновления занятости:', error);
        showToast('Не удалось изменить количество мест');
    }
}
async function deleteParking(parkingId) {
    if (!currentUser) {
        showToast('Необходимо авторизоваться');
        return;
    }
    if (!parkingId) {
        showToast('ID парковки не найден');
        return;
    }
    if (!confirm('Вы уверены, что хотите удалить эту парковку?')) return;

    try {
        const ref = database.ref(`parkings/${parkingId}`);
        const snapshot = await ref.once('value');
        const data = snapshot.val();

        if (!data) {
            showToast('Парковка уже удалена');
            return;
        }

        if (data.authorId !== currentUser.id) {
            showToast('Удалять парковку может только её автор');
            return;
        }

        await ref.remove();

        // ✅ Удаляем Placemark и Polygon корректно
        const placemark = mapMarkers[parkingId];
        if (placemark) {
            // Удаляем полигон
            const polygon = placemark.properties.get('polygon');
            if (polygon) {
                map.geoObjects.remove(polygon);
            }
            // Удаляем маркер из кластера
            if (clusterer) {
                clusterer.remove(placemark);
            }
            delete mapMarkers[parkingId];
        }

        // Если удаляется активный полигон
        if (activePolygon && activePolygon.__parkingId === parkingId) {
            map.geoObjects.remove(activePolygon);
            activePolygon = null;
        }

        delete parkingDataCache[parkingId];

        // ✅ Пересчитываем кластеры
        if (clusterer) clusterer.reload();

        closePanel();
        showMap();
        if (document.getElementById('searchResults')) filterParkings();
        showToast('Парковка удалена');

    } catch (error) {
        console.error('Ошибка удаления:', error);
        showToast('Не удалось удалить парковку');
    }
}
    function confirmParking(parkingId) {
        if (!currentUser) return;
        database.ref(`parkings/${parkingId}`).once('value').then(snapshot => {
            const data = snapshot.val();
            if (data && data.authorId !== currentUser.id) {
                database.ref(`users/${data.authorId}/stats/confirmations`).transaction(c => (c || 0) + 1);
                alert('Спасибо за подтверждение!');
            }
        });
    }
   // ===================== МАРШРУТ =====================
    function buildRouteToParking(parkingId) {
        closeCenterSheet();
        const data = parkingDataCache[parkingId];
        if (!data || typeof data.lat !== 'number' || typeof data.lng !== 'number') {
            alert('Ошибка: данные парковки не содержат координат');
            return;
        }

        getUserLocation()
            .then(coords => {
                routeStartCoords = [coords.lat, coords.lng];
                routeEndCoords = [data.lat, data.lng];
                routeParkingData = data;
                buildAndShowRoute();
            })
            .catch(err => {
                console.warn('Не удалось получить геолокацию, используем центр карты:', err);
                const center = map.getCenter();
                routeStartCoords = center;
                routeEndCoords = [data.lat, data.lng];
                routeParkingData = data;
                buildAndShowRoute();
            });
    }

    function buildAndShowRoute() {
        if (currentRoute) {
            map.geoObjects.remove(currentRoute);
            currentRoute = null;
        }
        if (!routeStartCoords || !routeEndCoords) {
            alert('Не удалось определить точки маршрута');
            return;
        }

        const mode = document.getElementById('routeTypeSelect')?.value || 'auto';

        try {
            // Создаем маршрут Яндекс.Карт
            currentRoute = new ymaps.multiRouter.MultiRoute({
                referencePoints: [routeStartCoords, routeEndCoords],
                params: {
                    routingMode: mode === 'walking' ? 'pedestrian' : 'auto',
                    avoidTrafficJams: true
                }
            }, {
                boundsAutoApply: true,
                wayPointVisible: true
            });

            // Подписываемся на успешное построение маршрута
            currentRoute.model.events.add('requestsuccess', function () {
                const activeRoute = currentRoute.getActiveRoute();
                if (activeRoute) {
                    const distance = activeRoute.properties.get("distance").text;
                    const duration = activeRoute.properties.get("duration").text;

                    const infoEl = document.getElementById('routeInfo');
                    if (infoEl) {
                        infoEl.innerHTML = `
                            <div class="route-summary">
                                📍 До объекта: <strong>${distance}</strong> (${duration})
                            </div>
                        `;
                    }
                }
            });

            // Обработка ошибки построения
            currentRoute.model.events.add('requestfail', function (event) {
                console.error('Ошибка построения маршрута:', event.get('error'));
                const infoEl = document.getElementById('routeInfo');
                if (infoEl) {
                    infoEl.innerHTML = '<div class="route-error">Не удалось проложить маршрут.</div>';
                }
            });

            map.geoObjects.add(currentRoute);

            // Показываем плашку маршрута, если она есть в DOM
            const routePanel = document.getElementById('routePanel');
            if (routePanel) routePanel.classList.add('active');

        } catch (e) {
            console.error('Ошибка при вызове MultiRoute:', e);
            alert('Не удалось построить маршрут');
        }
    }
    function updateRouteInfoFromMultiRoute(route) {
        route.model.events.add('update', function() {
            var activeRoute = route.getActiveRoute();
            if (!activeRoute) return;

            var distance = activeRoute.getLength();
            var time = activeRoute.getTime();

            var distKm = (distance / 1000).toFixed(1);
            var timeMin = Math.round(time / 60);

            var instructions = activeRoute.getWayPoints();
            var stepsHtml = '';
            instructions.forEach(function(item, index) {
                if (index > 0 && index < 10) {
                    stepsHtml +=
                        `<div style="font-size:12px; color:var(--text-secondary);">${item.getName()}</div>`;
                }
            });

            var free = routeParkingData.totalSpots - routeParkingData.occupiedSpots;

            document.getElementById('routeInfo').innerHTML = `
            <div style="margin-bottom:8px;">
                <div style="font-weight:600; font-size:18px;">🚗 До парковки</div>
                <div>📏 Расстояние: <b>${distKm}</b> км</div>
                <div>⏱ Время в пути: <b>${timeMin}</b> мин</div>
                <div>🅿️ Свободных мест: <b>${free}</b> / ${routeParkingData.totalSpots}</div>
                <div style="font-size:12px; color:var(--text-secondary);">Обновлено: ${formatDateTime(routeParkingData.timestamp)}</div>
            </div>
            <div style="margin-top:8px; border-top:0.5px solid var(--border-color); padding-top:8px; max-height:120px; overflow-y:auto;">
                <div style="font-size:13px; font-weight:500;">📋 Основные точки маршрута:</div>
                ${stepsHtml || '<div style="font-size:12px; color:var(--text-secondary);">Инструкции не доступны</div>'}
            </div>
        `;
        });
    }

   function showDirectLine() {
    if (!routeStartCoords || !routeEndCoords) return;

    if (currentRoute) {
        map.geoObjects.remove(currentRoute);
        currentRoute = null;
    }

    const free = routeParkingData.totalSpots - routeParkingData.occupiedSpots;

    currentRoute = new ymaps.multiRouter.MultiRoute({
        referencePoints: [routeStartCoords, routeEndCoords],
        params: {
            routingMode: 'auto',
            avoidTrafficJams: true
        }
    }, {
        boundsAutoApply: true,
        routeStrokeColor: '#2B7574',
        routeStrokeWidth: 5,
        routeActiveStrokeColor: '#2B7574',
        routeActiveStrokeWidth: 5,
        wayPointVisible: false
    });

    map.geoObjects.add(currentRoute);

    currentRoute.model.events.add('requestsuccess', function() {
        const activeRoute = currentRoute.getActiveRoute();
        if (!activeRoute) return;

        const distance = activeRoute.properties.get('distance');
        const duration = activeRoute.properties.get('duration');

        document.getElementById('routeInfo').innerHTML = `
            <div>🚗 До парковки</div>
            <div>📍 ${distance.text}</div>
            <div>⏱ ${duration.text}</div>
            <div>Свободных мест: ${free}</div>
            <div>🔄 Обновлено: ${formatDateTime(routeParkingData.timestamp)}</div>
        `;

        document.getElementById('routeCard').classList.add('active');
    });

    currentRoute.model.events.add('requestfail', function() {
        document.getElementById('routeInfo').innerHTML = `
            <div>❌ Не удалось построить маршрут</div>
            <div>Проверьте подключение к интернету</div>
            <div>Свободных мест: ${free}</div>
        `;
    });
}

function startNavigation() {
    if (!routeEndCoords) {
        alert('Сначала постройте маршрут');
        return;
    }

    getUserLocation()
        .then(coords => {
            const fromLat = coords.lat;
            const fromLng = coords.lng;
            const toLat = routeEndCoords[0];
            const toLng = routeEndCoords[1];

            const url = `https://yandex.ru/maps/?rtext=${fromLat},${fromLng}~${toLat},${toLng}&rtt=auto`;
            window.open(url, '_blank');
        })
        .catch(() => {
            const toLat = routeEndCoords[0];
            const toLng = routeEndCoords[1];

            const url = `https://yandex.ru/maps/?rtext=~${toLat},${toLng}&rtt=auto`;
            window.open(url, '_blank');
        });
}
    function closeRoute() {
        if (currentRoute) { map.geoObjects.remove(currentRoute);
            currentRoute = null; }
        document.getElementById('routeCard').classList.remove('active');
        routeStartCoords = null;
        routeEndCoords = null;
        routeParkingData = null;
    }

    // ===================== АДРЕСА =====================
    function addHomeAddress() {
        if (!currentUser) { alert('Необходимо войти'); return; }
        database.ref(`users/${currentUser.id}/homeAddresses`).once('value').then(snap => {
            if (Object.keys(snap.val() || {}).length >= 3) { alert('Максимум 3 адреса'); return; }
            openAddressPicker();
        }).catch(err => { console.error(err);
            alert('Ошибка'); });
    }

    function centerMapOnAddress(lat, lng) {
        if (!lat || !lng) return;

        closePanel();

        map.setCenter([lat, lng], 17, { duration: 500 });

        if (window._addressPreviewMarker) {
            map.geoObjects.remove(window._addressPreviewMarker);
        }

        window._addressPreviewMarker = new ymaps.Placemark([lat, lng], {
            hintContent: 'Ваш адрес',
            balloonContent: 'Вы здесь сохранили адрес'
        }, {
            preset: 'islands#redHomeIcon',
            draggable: false
        });

        map.geoObjects.add(window._addressPreviewMarker);

        setTimeout(() => {
            if (window._addressPreviewMarker) {
                map.geoObjects.remove(window._addressPreviewMarker);
                window._addressPreviewMarker = null;
            }
        }, 8000);
    }

  function openAddressPicker() {
    if (!currentUser) {
        alert('Необходимо войти');
        return;
    }

    isAddressPickerOpen = true;
    const overlay = document.getElementById('addressPickerOverlay');
    if (!overlay) return;

    overlay.style.display = 'block';

    setTimeout(() => {
        const center = map?.getCenter?.() || [55.7558, 37.6173];

        if (!addressPickerMap) {
            addressPickerMap = new ymaps.Map('addressPickerMap', {
                center,
                zoom: 15,
                controls: ['zoomControl']
            });
            addressPickerMap.events.add('click', e => {
                setAddressPickerCoords(e.get('coords'));
            });
            setAddressPickerCoords(center);
        } else {
            addressPickerMap.container.fitToViewport();
            addressPickerMap.setCenter(center, 15, { duration: 300 });
        }
    }, 100);
}
function setAddressPickerCoords(coords) {
    if (!Array.isArray(coords) || coords.length < 2) return;

    addressPickerCoords = [Number(coords[0]), Number(coords[1])];

    if (addressPickerPlacemark) {
        addressPickerPlacemark.geometry.setCoordinates(addressPickerCoords);
        return;
    }
    addressPickerPlacemark = new ymaps.Placemark(addressPickerCoords, {
        hintContent: 'Ваш адрес',
        balloonContent: 'Перетащите метку'
    }, {
        preset: 'islands#redHomeIcon',
        draggable: true
    });
    addressPickerMap.geoObjects.add(addressPickerPlacemark);

    addressPickerPlacemark.events.add('dragend', () => {
        const coords = addressPickerPlacemark.geometry.getCoordinates();
        addressPickerCoords = [Number(coords[0]), Number(coords[1])];
    });
}
    function cancelAddressPicker() {
        document.getElementById('addressPickerOverlay').style.display = 'none';
        isAddressPickerOpen = false;
        if (addressPickerPlacemark) {
            addressPickerMap.geoObjects.remove(addressPickerPlacemark);
            addressPickerPlacemark = null;
        }
        addressPickerCoords = null;
        pendingAddressData = null;
    }

    function saveAddressFromPicker() {
        if (!currentUser) { alert('Необходимо войти');
            cancelAddressPicker(); return; }
        if (!addressPickerCoords) { alert('Установите метку на карте'); return; }

        const saveBtn = document.querySelector('#addressPickerContainer .btn-primary');
        const origText = saveBtn.textContent;
        saveBtn.textContent = 'Обработка...';
        saveBtn.disabled = true;

        ymaps.geocode(addressPickerCoords, { kind: 'house', results: 1 })
            .then(res => {
                const geoObject = res.geoObjects.get(0);
                let addressText = '';
                let parsed = { region: '', city: '', street: '', houseNumber: '' };
                if (geoObject) {
                    addressText = geoObject.getAddressLine();
                    parsed = parseAddress(addressText);
                } else {
                    addressText =
                        `Точка (${addressPickerCoords[0].toFixed(6)}, ${addressPickerCoords[1].toFixed(6)})`;
                }

                pendingAddressData = {
                    address: addressText,
                    lat: addressPickerCoords[0],
                    lng: addressPickerCoords[1],
                    city: parsed.city,
                    street: parsed.street,
                    houseNumber: parsed.houseNumber
                };

                document.getElementById('addressPickerOverlay').style.display = 'none';
                document.getElementById('labelPickerOverlay').classList.add('active');
            })
            .catch(err => {
                console.error('Ошибка геокодирования:', err);
                pendingAddressData = {
                    address: `Точка (${addressPickerCoords[0].toFixed(6)}, ${addressPickerCoords[1].toFixed(6)})`,
                    lat: addressPickerCoords[0],
                    lng: addressPickerCoords[1],
                    city: '',
                    street: '',
                    houseNumber: ''
                };
                document.getElementById('addressPickerOverlay').style.display = 'none';
                document.getElementById('labelPickerOverlay').classList.add('active');
            })
            .finally(() => {
                saveBtn.textContent = origText;
                saveBtn.disabled = false;
            });
    }

    function selectLabel(label) {
        if (!pendingAddressData) return;
        const data = pendingAddressData;
        database.ref(`users/${currentUser.id}/homeAddresses`).once('value')
            .then(snap => {
                const count = Object.keys(snap.val() || {}).length;
                if (count >= 3) {
                    alert('Максимум 3 адреса');
                    cancelLabelPicker();
                    return;
                }
                return database.ref(`users/${currentUser.id}/homeAddresses`).push({
                    address: data.address,
                    lat: data.lat || null,
                    lng: data.lng || null,
                    label: label,
                    city: data.city || '',
                    street: data.street || '',
                    houseNumber: data.houseNumber || '',
                    timestamp: Date.now()
                });
            })
            .then(() => {
                cancelLabelPicker();
                alert('Адрес сохранён!');
                showPanel('favorites');
            })
            .catch(err => {
                console.error('Ошибка сохранения адреса:', err);
                alert('Ошибка сохранения: ' + err.message);
                cancelLabelPicker();
            });
    }

    function cancelLabelPicker() {
        document.getElementById('labelPickerOverlay').classList.remove('active');
        pendingAddressData = null;
    }

    function removeHomeAddress(addressId) {
        if (confirm('Удалить адрес?')) {
            database.ref(`users/${currentUser.id}/homeAddresses/${addressId}`).remove()
                .then(() => showPanel('favorites'))
                .catch(err => alert('Ошибка: ' + err.message));
        }
    }

    // ===================== РЕДАКТОР АДРЕСА =====================
  function openAddressEditor(addressId) {
    if (!currentUser || !addressId) return;

    const overlay = document.getElementById('addressEditorOverlay');
    if (!overlay) return;

    document.getElementById('editAddrId').value = addressId;

    database.ref(`users/${currentUser.id}/homeAddresses/${addressId}`).once('value')
        .then(snap => {
            if (!snap.exists()) {
                alert('Адрес не найден');
                return;
            }

            const addr = snap.val() || {};

            document.getElementById('editAddrLabel').value = addr.label || 'Дом';
            document.getElementById('editAddrCity').value = addr.city || '';
            document.getElementById('editAddrStreet').value = addr.street || '';
            document.getElementById('editAddrHouse').value = addr.houseNumber || '';

            overlay.classList.add('active');
        })
        .catch(err => {
            console.error('Ошибка загрузки адреса:', err);
            alert('Не удалось загрузить адрес');
        });
}
    function closeAddressEditor() {
        document.getElementById('addressEditorOverlay').classList.remove('active');
    }

    function saveAddressChanges() {
        if (!currentUser) return;
        const addressId = document.getElementById('editAddrId').value;
        const label = document.getElementById('editAddrLabel').value;
        const city = document.getElementById('editAddrCity').value.trim();
        const street = document.getElementById('editAddrStreet').value.trim();
        const houseNumber = document.getElementById('editAddrHouse').value.trim();

        const fullAddress = [city, street, houseNumber ? `д. ${houseNumber}` : ''].filter(Boolean).join(', ') ||
            'Адрес не указан';

        database.ref(`users/${currentUser.id}/homeAddresses/${addressId}`).update({
            label: label,
            city: city,
            street: street,
            houseNumber: houseNumber,
            address: fullAddress
        }).then(() => {
            closeAddressEditor();
            if (document.getElementById('panel').classList.contains('active')) {
                const content = document.getElementById('panelContent');
                loadUserData('favorites', content);
            }
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
        }).catch(err => alert('Ошибка: ' + err.message));
    }

    function filterFavorites() {
        const input = document.getElementById('favSearchInput');
        if (!input) return;
        const query = input.value.trim().toLowerCase();
        const items = document.querySelectorAll('#favListContainer .fav-item');
        items.forEach(item => {
            const name = (item.dataset.name || '').toLowerCase();
            const address = (item.dataset.address || '').toLowerCase();
            if (name.includes(query) || address.includes(query)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    function findParkingsNearAddress(lat, lng, addressText) {
        if (lat && lng) {
            nearbySearchFilter = { lat: lat, lng: lng, radius: 300 };
            map.setCenter([lat, lng], 18, { duration: 500 });
            showPanel('search', true);
            return;
        }
        if (addressText) {
            ymaps.geocode(addressText, { results: 1 })
                .then(res => {
                    const geo = res.geoObjects.get(0);
                    if (geo) {
                        const coords = geo.geometry.getCoordinates();
                        nearbySearchFilter = { lat: coords[0], lng: coords[1], radius: 300 };
                        map.setCenter(coords, 16, { duration: 500 });
                        showPanel('search', true);
                    } else {
                        alert('Не удалось определить координаты по адресу');
                    }
                })
                .catch(() => alert('Не удалось определить координаты по адресу'));
        } else {
            alert('Не удалось определить координаты для поиска');
        }
    }

    // ===================== ПОИСК =====================
    function searchNearMe() {
    // Показываем индикатор загрузки в блоке "Рядом с вами"
    var container = document.getElementById('homeParkingList');
    if (container) {
        container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Поиск парковок рядом...</p></div>';
    }

    getUserLocation().then(function(coords) {
        userLocationForSearch = coords;
        // Обновляем список на главной
        if (container) {
            showNearbyParkings(coords, 5);
        }
        // Также обновляем фильтр в поиске (если он открыт)
        if (document.getElementById('searchResults')) {
            nearbySearchFilter = { lat: coords.lat, lng: coords.lng, radius: 1000 };
            filterParkings();
        }
        // Обновляем слайдер радиуса (если есть)
        var radiusSlider = document.getElementById('radiusSlider');
        if (radiusSlider) {
            radiusSlider.value = 1;
            var radiusLabel = document.getElementById('radiusLabel');
            if (radiusLabel) radiusLabel.textContent = '1 км';
        }
    }).catch(function(err) {
        console.error('Ошибка геолокации:', err);
        alert('Не удалось определить ваше местоположение. Проверьте разрешения для геолокации в браузере.');
        // Если геолокация не удалась, показываем все парковки (без сортировки)
        if (container) {
            var allParkings = Object.values(parkingDataCache).filter(function(p) { return p.lat && p.lng; });
            renderParkingList(container, allParkings);
        }
    });
}

    function clearFilters() {
        nearbySearchFilter = {
            city: userCityPrefs.city || '',
            region: userCityPrefs.region || ''
        };
        userLocationForSearch = null;
        document.getElementById('searchInput').value = '';
        document.getElementById('radiusSlider').value = 1;
        document.getElementById('radiusLabel').textContent = '1 км';
        if (document.getElementById('showWithFreeOnly')) document.getElementById('showWithFreeOnly').checked = false;
        if (document.getElementById('sortSelect')) document.getElementById('sortSelect').value = 'name';
        filterParkings();
    }

    function renderSearchPanel(content) {
    const now = Date.now();
    const needRefresh = (now - lastDataRefresh > REFRESH_INTERVAL_MS) || lastDataRefresh === 0;
    if (needRefresh) {
        const searchInput = document.getElementById('searchInput');
        const sortSelect = document.getElementById('sortSelect');
        const radiusSlider = document.getElementById('radiusSlider');
        const freeOnlyCheck = document.getElementById('showWithFreeOnly');
        const savedSearch = searchInput ? searchInput.value : '';
        const savedSort = sortSelect ? sortSelect.value : 'name';
        const savedRadius = radiusSlider ? radiusSlider.value : '1';
        const savedFreeOnly = freeOnlyCheck ? freeOnlyCheck.checked : false;

        content.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Обновление данных...</p>
            </div>
        `;

        // ✅ ИСПРАВЛЕНО: передаём currentCity
        loadAllParkings(currentCity).then(function() {
            renderSearchPanel(content, {
                searchQuery: savedSearch,
                sortBy: savedSort,
                radius: savedRadius,
                freeOnly: savedFreeOnly
            });
        }).catch(function() {
            renderSearchPanel(content, {
                searchQuery: savedSearch,
                sortBy: savedSort,
                radius: savedRadius,
                freeOnly: savedFreeOnly
            });
        });
        return;
    }

    var state = arguments[1] || {};
    var defaultCity = userCityPrefs.city || '';
    var searchQuery = state.searchQuery || '';
    var sortBy = state.sortBy || 'name';
    var radius = state.radius || '1';
    var freeOnly = state.freeOnly !== undefined ? state.freeOnly : false;

    var html = `
    <div class="search-bar">
        <input type="text" id="searchInput" placeholder="Улица, дом..." oninput="filterParkings()" value="${searchQuery}">
    </div>
    <div style="display:flex; gap:8px; margin-bottom:12px;">
        <button class="btn-secondary" style="flex:1;" onclick="searchNearMe()">📍 Рядом со мной</button>
        <button class="btn-outline" style="flex:1;" onclick="clearFilters()">↺ Сбросить</button>
    </div>
    <div style="position: relative; margin: 12px 0;">
        <div id="radiusTooltip" style="position: absolute; top: -24px; left: 50%; transform: translateX(-50%); background: var(--text-primary); color: var(--bg-primary); padding: 2px 8px; border-radius: 8px; font-size: 12px; display: none; white-space: nowrap;"></div>
        <div style="display: flex; align-items: center; gap: 10px;">
            <input type="range" id="radiusSlider" min="0.1" max="5" step="0.1" value="${radius}" style="flex:1;" oninput="updateRadiusLabel(); filterParkings();">
            <span id="radiusLabel" style="min-width: 40px;">${radius} км</span>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 6px; justify-content: center;">
            <button class="preset-btn" onclick="setRadiusPreset(0.5)">500 м</button>
            <button class="preset-btn" onclick="setRadiusPreset(1)">1 км</button>
            <button class="preset-btn" onclick="setRadiusPreset(2)">2 км</button>
            <button class="preset-btn" onclick="setRadiusPreset(5)">5 км</button>
        </div>
    </div>
    <div class="theme-toggle-row" style="margin-top: 12px; justify-content: space-between;">
        <div class="theme-toggle-label" style="font-size: 14px;">Только свободные</div>
        <label class="theme-switch">
            <input type="checkbox" id="showWithFreeOnly" onchange="filterParkings()" ${freeOnly ? 'checked' : ''}>
            <span class="theme-slider"></span>
        </label>
    </div>
    <div style="margin-top: 8px;">
        <label style="font-size:13px; color:var(--text-secondary);">Сортировка:</label>
        <select id="sortSelect" class="input-field" onchange="filterParkings()" style="margin-top:4px;">
            <option value="name" ${sortBy === 'name' ? 'selected' : ''}>По названию</option>
            <option value="free" ${sortBy === 'free' ? 'selected' : ''}>По возрастанию свободных мест</option>
            <option value="distance" ${sortBy === 'distance' ? 'selected' : ''}>По расстоянию (если известна геопозиция)</option>
        </select>
    </div>
    <div id="searchResults" class="list-container">
        <p style="color:var(--text-secondary); text-align:center;">Введите улицу для поиска</p>
    </div>
    `;
    content.innerHTML = html;

    getUserLocation().then(function(coords) { userLocationForSearch = coords; }).catch(function() { userLocationForSearch = null; });
    filterParkings();

    setTimeout(function() {
        var slider = document.getElementById('radiusSlider');
        if (slider) {
            slider.addEventListener('pointerdown', function() {
                var tooltip = document.getElementById('radiusTooltip');
                if (tooltip) tooltip.style.display = 'block';
            });
            slider.addEventListener('pointerup', function() {
                setTimeout(function() {
                    var tooltip = document.getElementById('radiusTooltip');
                    if (tooltip) tooltip.style.display = 'none';
                }, 800);
            });
        }
    }, 100);

    var freeToggle = document.getElementById('showWithFreeOnly');
    if (freeToggle) {
        freeToggle.addEventListener('change', function() {
            setTimeout(filterParkings, 50);
        });
    }

    var radiusLabel = document.getElementById('radiusLabel');
    if (radiusLabel) {
        radiusLabel.textContent = radius + ' км';
    }
}
    function openCityPicker() {
        const overlay = document.getElementById('cityPickerOverlay');
        if (!overlay) return;
        overlay.style.display = 'flex';

        const regionSelect = document.getElementById('cityPickerRegion');
        if (regionSelect) {
            regionSelect.innerHTML = '<option value="">Выберите регион</option>';
            Object.keys(regionsData).sort().forEach(r => {
                const opt = document.createElement('option');
                opt.value = r;
                opt.textContent = r;
                if (r === mapCity?.region) opt.selected = true;
                regionSelect.appendChild(opt);
            });
            updateCityPickerCities();
        }
    }

    function closeCityPicker() {
        const overlay = document.getElementById('cityPickerOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    function updateCityPickerCities() {
        const region = document.getElementById('cityPickerRegion')?.value;
        const citySelect = document.getElementById('cityPickerCity');
        if (!citySelect) return;
        citySelect.innerHTML = '<option value="">Выберите город</option>';
        if (region && regionsData[region]) {
            regionsData[region].forEach(city => {
                const opt = document.createElement('option');
                opt.value = city;
                opt.textContent = city;
                if (city === currentCity) opt.selected = true;
                citySelect.appendChild(opt);
            });
        }
    }
function applyCityFromPicker() {
    const regionSelect = document.getElementById('cityPickerRegion');
    const citySelect = document.getElementById('cityPickerCity');
    const region = regionSelect?.value?.trim() || '';
    const city = citySelect?.value?.trim() || '';
    if (!region || !city) {
        alert('Выберите регион и город');
        return;
    }
    // Сохраняем именно выбранный город для карты
    currentCity = city;
    mapCity = {
        region: region,
        city: city
    };
    // Сохраняем выбор пользователя
    localStorage.setItem('selectedCity', city);
    localStorage.setItem(
        'parknear_map_city',
        JSON.stringify({
            region: region,
            city: city
        })
    );
    updateCityDisplay();
    closeCityPicker();
    // Сбрасываем старые координаты города
    cityCoords = null;
    // Пытаемся получить координаты города
    const coords = getCityCoordinates(city);
    if (map && coords) {
        map.setCenter(coords, 12, {
            duration: 500
        });
        cityCoords = {
            lat: coords[0],
            lng: coords[1]
        };
        localStorage.setItem(
            'parknear_map_city_coords',
            JSON.stringify(cityCoords)
        );
    } else if (
        typeof ymaps !== 'undefined' &&
        ymaps.geocode
    ) {
        ymaps.geocode(
            `${region}, ${city}`,
            {
                results: 1
            }
        ).then(res => {
            const geo = res.geoObjects.get(0);
            if (!geo) {
                console.warn(
                    'Не удалось найти координаты города:',
                    city
                );
                return;
            }
            const coords =
                geo.geometry.getCoordinates();
            cityCoords = {
                lat: coords[0],
                lng: coords[1]
            };
            localStorage.setItem(
                'parknear_map_city_coords',
                JSON.stringify(cityCoords)
            );
            if (map) {
                map.setCenter(
                    coords,
                    12,
                    {
                        duration: 500
                    }
                );
            }
        }).catch(err => {
            console.warn(
                'Не удалось определить координаты города:',
                err
            );
        });
    }
   showParkingsForCity(city);
}
function getCityCoordinates(city) {
    if (cityCoords && cityCoords.lat && cityCoords.lng) {
        return [cityCoords.lat, cityCoords.lng];
    }
    const coordsMap = {
        'Москва': [55.7558, 37.6173],
        'Санкт-Петербург': [59.9343, 30.3351],
        'Новосибирск': [55.0302, 82.9204],
        'Екатеринбург': [56.8389, 60.6057],
        'Казань': [55.8304, 49.0661],
        'Нижний Новгород': [56.2965, 43.9361],
        'Челябинск': [55.1602, 61.4026],
        'Омск': [54.9885, 73.3242],
        'Самара': [53.1959, 50.1008],
        'Ростов-на-Дону': [47.2221, 39.7203],
        'Уфа': [54.7351, 55.9587],
        'Красноярск': [56.0106, 92.8526],
        'Пермь': [58.0104, 56.2294],
        'Воронеж': [51.6606, 39.2003],
        'Волгоград': [48.7071, 44.5169],
        'Краснодар': [45.0355, 38.9753],
        'Саратов': [51.5336, 46.0342],
        'Тюмень': [57.1522, 65.5412],
        'Тольятти': [53.5078, 49.4204],
        'Ижевск': [56.8528, 53.2115],
        'Барнаул': [53.3561, 83.7898],
        'Ульяновск': [54.3179, 48.4024],
        'Иркутск': [52.2864, 104.2807],
        'Хабаровск': [48.4802, 135.0719],
        'Владивосток': [43.1152, 131.8855],
        'Якутск': [62.0276, 129.7323],
        'Севастополь': [44.6167, 33.5254],
        'Симферополь': [44.9484, 34.1003],
    };
    return coordsMap[city] || null;
}

function createMarkersAndCluster(parkings) {
    // Удаляем старый кластер
    if (clustererInstance) {
        mapInstance.geoObjects.remove(clustererInstance);
        clustererInstance = null;
    }

    // Создаём метки
    const newPlacemarks = parkings.map(parking => {
        const coords = [parking.latitude, parking.longitude];
        return new ymaps.Placemark(coords, {
            balloonContent: `<b>${parking.name}</b><br>${parking.address}`
        });
    });

    // Создаём кластер
    clustererInstance = new ymaps.Clusterer({
        clusterDisableClickZoom: false,
        clusterOpenBalloonOnClick: true,
        gridSize: 32,
        minClusterSize: 3
    });
    clustererInstance.add(newPlacemarks);
    mapInstance.geoObjects.add(clustererInstance);
    placemarks = newPlacemarks; // сохраняем для очистки
}
    function updateCityDisplay() {
    const cityName = currentCity || userCityPrefs.city || mapCity?.city || 'Не указан';
    const displayEl = document.getElementById('cityDisplayName');
    if (displayEl) displayEl.textContent = cityName;
}
    function changeSearchCity() {
        openCityPicker();
    }

    function updateRadiusLabel() {
        const slider = document.getElementById('radiusSlider');
        if (!slider) return;
        const val = parseFloat(slider.value);
        document.getElementById('radiusLabel').textContent = val + ' км';

        const tooltip = document.getElementById('radiusTooltip');
        if (tooltip) {
            tooltip.textContent = val + ' км';
            tooltip.style.display = 'block';
        }

        if (userLocationForSearch) {
            nearbySearchFilter = { lat: userLocationForSearch.lat, lng: userLocationForSearch.lng, radius: val *
                    1000 };
        }
    }

    function setRadiusPreset(km) {
        const slider = document.getElementById('radiusSlider');
        if (!slider) return;
        slider.value = km;
        updateRadiusLabel();
        filterParkings();
    }

    function updateCitySelect() {
        const region = document.getElementById('regionSelect').value;
        const citySelect = document.getElementById('citySelect');
        citySelect.innerHTML = '<option value="">Все города</option>';
        if (region && regionsData[region]) {
            regionsData[region].forEach(city => {
                const opt = document.createElement('option');
                opt.value = city;
                opt.textContent = city;
                citySelect.appendChild(opt);
            });
        }
        filterParkings();
    }

    function filterParkings() {
    var searchInput = document.getElementById('searchInput');
    var query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    var resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) return;

    var filterRegion = (nearbySearchFilter ? nearbySearchFilter.region : '') || (mapCity ? mapCity.region : '') || userCityPrefs.region || '';
    var filterCity = (nearbySearchFilter ? nearbySearchFilter.city : '') || (mapCity ? mapCity.city : '') || userCityPrefs.city || '';
    var parkings = Object.entries(parkingDataCache).map(function(entry) {
        return { id: entry[0], ...entry[1] };
    });
    var hasNearbyFilter = nearbySearchFilter && nearbySearchFilter.lat && nearbySearchFilter.lng;

    if (!hasNearbyFilter) {
        var cityFilter = mapCity ? mapCity.city.toLowerCase() : (userCityPrefs.city ? userCityPrefs.city.toLowerCase() : '');
        if (cityFilter) {
            parkings = parkings.filter(function(p) {
                var pCity = (p.city || '').toLowerCase();
                var pAddr = (p.address || '').toLowerCase();
                var pName = (p.name || '').toLowerCase();
                return pCity.indexOf(cityFilter) !== -1 || pAddr.indexOf(cityFilter) !== -1 || pName.indexOf(cityFilter) !== -1;
            });
        }
    }

    if (filterRegion) {
        parkings = parkings.filter(function(p) {
            return (p.region && p.region.toLowerCase().indexOf(filterRegion.toLowerCase()) !== -1) ||
                   (p.address && p.address.toLowerCase().indexOf(filterRegion.toLowerCase()) !== -1) ||
                   (p.name && p.name.toLowerCase().indexOf(filterRegion.toLowerCase()) !== -1);
        });
    }

    if (filterCity) {
        parkings = parkings.filter(function(p) {
            return (p.city && p.city.toLowerCase().indexOf(filterCity.toLowerCase()) !== -1) ||
                   (p.address && p.address.toLowerCase().indexOf(filterCity.toLowerCase()) !== -1) ||
                   (p.name && p.name.toLowerCase().indexOf(filterCity.toLowerCase()) !== -1);
        });
    }

    if (query) {
        parkings = parkings.filter(function(p) {
            return (p.name && p.name.toLowerCase().indexOf(query) !== -1) ||
                   (p.address && p.address.toLowerCase().indexOf(query) !== -1) ||
                   (p.street && p.street.toLowerCase().indexOf(query) !== -1) ||
                   (p.houseNumber && p.houseNumber.toLowerCase().indexOf(query) !== -1);
        });
    }

    if (nearbySearchFilter && nearbySearchFilter.lat && nearbySearchFilter.lng) {
        var lat = nearbySearchFilter.lat;
        var lng = nearbySearchFilter.lng;
        var radius = nearbySearchFilter.radius;
        parkings = parkings.filter(function(p) {
            var dist = getDistanceInMeters(lat, lng, p.lat, p.lng);
            return dist <= radius;
        });
    }

    var freeOnlyCheck = document.getElementById('showWithFreeOnly');
    var showFreeOnly = freeOnlyCheck ? freeOnlyCheck.checked : false;
    if (showFreeOnly) {
        parkings = parkings.filter(function(p) {
            return (p.totalSpots - (p.occupiedSpots || 0)) > 0;
        });
    }

    var sortSelect = document.getElementById('sortSelect');
    var sortBy = sortSelect ? sortSelect.value : 'name';
    switch (sortBy) {
        case 'free':
            parkings.sort(function(a, b) {
                return (a.totalSpots - (a.occupiedSpots || 0)) - (b.totalSpots - (b.occupiedSpots || 0));
            });
            break;
        case 'distance':
            if (userLocationForSearch) {
                parkings.sort(function(a, b) {
                    var distA = getDistanceInMeters(userLocationForSearch.lat, userLocationForSearch.lng, a.lat, a.lng);
                    var distB = getDistanceInMeters(userLocationForSearch.lat, userLocationForSearch.lng, b.lat, b.lng);
                    return distA - distB;
                });
            }
            break;
        default:
            parkings.sort(function(a, b) {
                return (a.name || '').localeCompare(b.name || '');
            });
    }

    var html = '';
    if (parkings.length === 0) {
        html = '<div class="empty-state"><p>Ничего не найдено' + (filterCity ? ' в ' + filterCity : '') + '</p>' +
               (filterCity ? '<p style="font-size:13px; margin-top:8px;">Попробуйте изменить город в настройках</p>' : '') +
               '</div>';
    } else {
        var grouped = {};
        parkings.forEach(function(p) {
            var key = (p.street || p.name || 'Без названия').trim();
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(p);
        });
        html = '<div class="list-container">';
        for (var street in grouped) {
            if (grouped.hasOwnProperty(street)) {
                var items = grouped[street];
                html += '<div class="group-header" onclick="toggleGroup(this)">' +
                        '<span class="group-icon">▼</span>' +
                        '<span>' + street + ' (' + items.length + ')</span>' +
                        '</div>';
                html += '<div class="group-items">';
                items.forEach(function(p) {
                    var free = p.totalSpots - (p.occupiedSpots || 0);
                    var isAuthor = currentUser && currentUser.id === p.authorId;
                    var subtitle = '';
                    if (userLocationForSearch && p.lat && p.lng) {
                        var dist = getDistanceInMeters(userLocationForSearch.lat, userLocationForSearch.lng, p.lat, p.lng);
                        subtitle = (dist < 1000) ? Math.round(dist) + ' м от вас' : (dist/1000).toFixed(1) + ' км от вас';
                    } else {
                        subtitle = p.address || (p.lat ? p.lat.toFixed(4) + ', ' + p.lng.toFixed(4) : '');
                    }
                    subtitle += ' · Свободно: ' + free + '/' + p.totalSpots;
                    html += '<div class="swipe-container">' +
                            '<div class="swipe-item" onclick="focusMap(' + p.lat + ', ' + p.lng + ', \'' + p.id + '\')">' +
                            '<span class="occupancy-dot" style="background: ' + getOccupancyDotColor(free, p.totalSpots) + ';"></span>' +
                            '<div class="list-info">' +
                            '<div class="list-title">' + (p.name || 'Без названия') + '</div>' +
                            '<div class="list-subtitle">' + subtitle + '</div>' +
                            '</div>' +
                            '</div>' +
                            (isAuthor ? '<div class="swipe-delete" onclick="deleteParking(\'' + p.id + '\')">Удалить</div>' : '') +
                            '</div>';
                });
                html += '</div>';
            }
        }
        html += '</div>';
    }
    resultsContainer.innerHTML = html;
    attachSwipeToContainers(resultsContainer);
}
function focusMap(lat, lng, parkingId) {
    closeCenterSheet();
    setTimeout(function() {
        if (!map) return;
        map.setCenter([lat, lng], 18, { duration: 500 });
        // Небольшая анимация маркера (опционально)
        var marker = mapMarkers[parkingId];
        if (marker) {
            // можно добавить подсветку
        }
        var data = parkingDataCache[parkingId];
        if (data) {
            // Вместо openParkingSheet вызываем центральное окно
            openCenterSheet(parkingId, data);
        }
    }, 350);
}
    function highlightAndShowParking(parkingId) {
        const data = parkingDataCache[parkingId];
        if (!data) return;
        const marker = mapMarkers[parkingId];
        if (marker && marker.geometry) {
            let bounds;
            if (marker.geometry.getType() === 'Polygon' && data.coordinates && data.coordinates.length > 0) {
                const coords = data.coordinates;
                let minLat = coords[0][0],
                    maxLat = coords[0][0],
                    minLng = coords[0][1],
                    maxLng = coords[0][1];
                coords.forEach(c => { if (c[0] < minLat) minLat = c[0]; if (c[0] > maxLat) maxLat = c[0]; if (c[
                        1] < minLng) minLng = c[1]; if (c[1] > maxLng) maxLng = c[1]; });
                bounds = [
                    [minLat, minLng],
                    [maxLat, maxLng]
                ];
            } else {
                bounds = [
                    [data.lat - 0.001, data.lng - 0.001],
                    [data.lat + 0.001, data.lng + 0.001]
                ];
            }
            map.setBounds(bounds, { duration: 300 }).then(() => {
                if (map.getZoom() > 17) map.setZoom(17);
            });
        }
        if (marker) {
            const origFillColor = marker.options.get('fillColor');
            const origStrokeColor = marker.options.get('strokeColor');
            marker.options.set({ fillColor: '#2B757466', strokeColor: '#2B7574' });
            let opacity = 0.3;
            let direction = 1;
            const interval = setInterval(() => {
                opacity += direction * 0.1;
                if (opacity >= 1) { opacity = 1;
                    direction = -1; }
                if (opacity <= 0.3) { opacity = 0.3;
                    direction = 1; }
                marker.options.set({ fillColor: `rgba(43,117,116,${opacity.toFixed(1)})` });
            }, 150);
            setTimeout(() => {
                clearInterval(interval);
                marker.options.set({ fillColor: origFillColor, strokeColor: origStrokeColor });
            }, 3000);
        }
        closePanel();
    }

    // ===================== ПРОФИЛЬ =====================
function renderProfile(content) {
    if (!content) return;
    if (!currentUser) {
        content.innerHTML = `
            <div class="pn-profile-login">
                <div class="pn-profile-login-icon">👤</div>
                <h2>Добро пожаловать</h2>
                <p>Войдите, чтобы сохранять парковки, город и настройки.</p>
                <button class="telegram-btn" onclick="openTelegramBot()">Войти через Telegram</button>
                <button class="guest-btn" onclick="continueAsGuest()">Продолжить как гость</button>
            </div>`;
        return;
    }

    const isGuest = currentUser.id.startsWith('guest_');

    Promise.all([
        database.ref(`users/${currentUser.id}/stats`).once('value'),
        database.ref(`users/${currentUser.id}/car`).once('value'),
        database.ref(`users/${currentUser.id}/cityPreferences`).once('value'),
        database.ref(`users/${currentUser.id}/favorites`).once('value')
    ]).then(([statsSnap, carSnap, citySnap, favSnap]) => {
        const stats = statsSnap.val() || {};
        const car = carSnap.val() || {};
        const prefs = citySnap.val() || userCityPrefs || {};
        const favorites = favSnap.val() || {};

        userCityPrefs = prefs;

        const created = Number(stats.parkingsCreated || 0);
        const updated = Number(stats.parkingsUpdated || 0);
        const confirmations = Number(stats.confirmations || 0);
        const views = Number(stats.views || 0);
        const favoritesCount = Object.keys(favorites || {}).length;
        const activeDates = Array.isArray(stats.activeDates) ? stats.activeDates : [];

        const score =
            created * 25 +
            updated * 5 +
            confirmations * 5 +
            Math.floor(views / 5) +
            favoritesCount * 5 +
            activeDates.length * 5;

        const levels = [
            {xp:0,name:'Пешеход',emoji:'👣'},
            {xp:1000,name:'Водитель-любитель',emoji:'🚗'},
            {xp:3000,name:'Начинающий парковщик',emoji:'🅿️'},
            {xp:5000,name:'Городской водитель',emoji:'🏙️'},
            {xp:10000,name:'Наблюдатель',emoji:'🔭'},
            {xp:20000,name:'Помощник района',emoji:'🤝'},
            {xp:40000,name:'Картограф',emoji:'🗺️'},
            {xp:70000,name:'Инспектор',emoji:'👮'},
            {xp:110000,name:'Ветеран дорог',emoji:'🏅'},
            {xp:150000,name:'Страж парковки',emoji:'⚖️'},
            {xp:250000,name:'Архитектор города',emoji:'🏗️'},
            {xp:500000,name:'Легенда ParkNear',emoji:'💎'}
        ];

        let currentLevel = levels[0];
        let nextLevel = levels[1];

        for (let i = levels.length - 1; i >= 0; i--) {
            if (score >= levels[i].xp) {
                currentLevel = levels[i];
                nextLevel = levels[i + 1] || levels[i];
                break;
            }
        }

        const progress = nextLevel.xp > currentLevel.xp
            ? Math.min(100, Math.round(((score - currentLevel.xp) / (nextLevel.xp - currentLevel.xp)) * 100))
            : 100;

        const firstName = escapeHtml(currentUser.firstName || currentUser.first_name || 'Пользователь');
        const username = escapeHtml(currentUser.nickname || currentUser.username || '');
        const city = escapeHtml(prefs.city || currentCity || 'Город не выбран');
        const region = escapeHtml(prefs.region || '');
        const carName = car.brand ? `${escapeHtml(car.brand)} ${escapeHtml(car.model || '')}`.trim() : 'Автомобиль не добавлен';

        const avatar = currentUser.photoUrl
            ? `<img src="${escapeHtml(currentUser.photoUrl)}" alt="">`
            : '👤';

        content.innerHTML = `
            <div class="pn-profile">

                <section class="pn-profile-hero">
                    <div class="pn-profile-avatar">${avatar}</div>
                    <div class="pn-profile-main">
                        <div class="pn-profile-name">${firstName}</div>
                        ${username ? `<div class="pn-profile-username">@${username}</div>` : ''}
                        <div class="pn-profile-level">
                            <span>${currentLevel.emoji}</span>
                            <span>${currentLevel.name}</span>
                        </div>
                    </div>
                    ${isGuest ? '<span class="pn-profile-guest">Гость</span>' : ''}
                </section>

                <section class="pn-profile-city" onclick="openCityPicker()">
                    <div class="pn-profile-city-icon">📍</div>
                    <div class="pn-profile-city-info">
                        <div class="pn-profile-label">Мой город</div>
                        <div class="pn-profile-city-name">${city}</div>
                        ${region ? `<div class="pn-profile-city-region">${region}</div>` : ''}
                    </div>
                    <div class="pn-profile-arrow">›</div>
                </section>

                <section class="pn-profile-progress">
                    <div class="pn-profile-progress-top">
                        <div>
                            <div class="pn-profile-label">Прогресс</div>
                            <div class="pn-profile-xp">${score} XP</div>
                        </div>
                        <div class="pn-profile-next">
                            ${nextLevel === currentLevel ? 'Максимальный уровень' : `${progress}% до ${nextLevel.name}`}
                        </div>
                    </div>
                    <div class="pn-progress-track">
                        <div class="pn-progress-fill" style="width:${progress}%"></div>
                    </div>
                </section>

                <div class="pn-profile-section-title">Мой ParkNear</div>

                <section class="pn-profile-menu">
                    <button class="pn-profile-row" onclick="toggleProfileSection('car')">
                        <span class="pn-profile-row-icon">🚗</span>
                        <span class="pn-profile-row-content">
                            <strong>Мой автомобиль</strong>
                            <small>${car.brand ? carName : 'Добавьте автомобиль для быстрой отметки парковки'}</small>
                        </span>
                        <span class="pn-profile-row-arrow">›</span>
                    </button>

                    <button class="pn-profile-row" onclick="toggleProfileSection('history')">
                        <span class="pn-profile-row-icon">🕘</span>
                        <span class="pn-profile-row-content">
                            <strong>История</strong>
                            <small>Ваши действия с парковками</small>
                        </span>
                        <span class="pn-profile-row-arrow">›</span>
                    </button>

                    <button class="pn-profile-row" onclick="toggleProfileSection('favorites')">
                        <span class="pn-profile-row-icon">❤️</span>
                        <span class="pn-profile-row-content">
                            <strong>Избранные парковки</strong>
                            <small>${favoritesCount} ${favoritesCount === 1 ? 'парковка' : 'парковок'}</small>
                        </span>
                        <span class="pn-profile-row-arrow">›</span>
                    </button>
                </section>

                <div id="profileSectionCarContent" class="pn-profile-expand">
                    ${car.brand ? `
                        <div class="pn-car-card">
                            <div>
                                <strong>${carName}</strong>
                                <small>${escapeHtml(car.plate || 'Номер не указан')}</small>
                            </div>
                            <div class="pn-car-actions">
                                <button onclick="editCarDataFromSettings()">Изменить</button>
                                <button class="danger" onclick="removeCar()">Удалить</button>
                            </div>
                        </div>
                    ` : `
                        <div class="pn-empty-card">
                            <span>🚗</span>
                            <div>
                                <strong>Автомобиль не добавлен</strong>
                                <small>Добавьте его, чтобы использовать данные при парковке.</small>
                            </div>
                            <button onclick="editCarDataFromSettings()">Добавить</button>
                        </div>
                    `}
                </div>

                <div id="profileSectionHistoryContent" class="pn-profile-expand">
                    <div id="historyListContainer" class="pn-profile-loading">Загрузка...</div>
                </div>

                <div id="profileSectionFavoritesContent" class="pn-profile-expand">
                    <div id="favoritesListContainer" class="pn-profile-loading">Загрузка...</div>
                </div>

                <div class="pn-profile-section-title">Настройки</div>

                <section class="pn-profile-menu">
                    <button class="pn-profile-row" onclick="toggleProfileSection('settings')">
                        <span class="pn-profile-row-icon">⚙️</span>
                        <span class="pn-profile-row-content">
                            <strong>Настройки приложения</strong>
                            <small>Тема, уведомления и другие параметры</small>
                        </span>
                        <span class="pn-profile-row-arrow">›</span>
                    </button>
                </section>

                <div id="profileSectionSettingsContent" class="pn-profile-expand">
                    <div id="settingsContentInline" class="pn-profile-settings"></div>
                </div>

                <section class="pn-profile-stats">
                    <div><strong>${created}</strong><span>Парковок создано</span></div>
                    <div><strong>${confirmations}</strong><span>Подтверждений</span></div>
                    <div><strong>${views}</strong><span>Просмотров</span></div>
                </section>

                ${!isGuest ? `
                    <button class="pn-profile-delete" onclick="deleteAccount()">Удалить аккаунт</button>
                ` : `
                    <div class="pn-profile-guest-info">Вы используете ParkNear как гость</div>
                `}

                <div class="pn-profile-version">ParkNear · профиль</div>
            </div>
        `;

        renderSettingsInline();

        window._historyLoaded = false;
        window._favoritesLoaded = false;
    }).catch(error => {
        console.error('Ошибка загрузки профиля:', error);
        content.innerHTML = `
            <div class="pn-profile-error">
                <div>⚠️</div>
                <strong>Не удалось загрузить профиль</strong>
                <button onclick="renderProfile(document.getElementById('panelContent'))">Повторить</button>
            </div>
        `;
    });
}
// ---- Переключение секций профиля ----
function toggleProfileSection(section) {
    const content = document.getElementById(`profileSection${section.charAt(0).toUpperCase() + section.slice(1)}Content`);
    if (!content) return;

    const isOpen = content.classList.contains('open');
    content.classList.toggle('open', !isOpen);

    if (section === 'history' && !isOpen && !window._historyLoaded) {
        loadUserParkingHistory();
        window._historyLoaded = true;
    }

    if (section === 'favorites' && !isOpen) {
    loadFavoritesInline(true);
}
}
// ---- Загрузка истории парковок пользователя (только последние 10) ----
function loadUserParkingHistory() {
    const container = document.getElementById('historyListContainer');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; color:var(--text-secondary);">Загрузка...</div>';

    const userId = currentUser.id;
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    database.ref('parkings').once('value').then(snapshot => {
        const parkings = snapshot.val() || {};
        let allEntries = [];

        Object.keys(parkings).forEach(parkingId => {
            const parking = parkings[parkingId];
            if (!parking.history) return;
            const history = parking.history;
            Object.keys(history).forEach(entryKey => {
                const entry = history[entryKey];
                if (entry.userId === userId) {
                    // Удаляем записи старше 7 дней
                    if (entry.timestamp < weekAgo) {
                        database.ref(`parkings/${parkingId}/history/${entryKey}`).remove();
                        return;
                    }
                    allEntries.push({
                        parkingId: parkingId,
                        parkingName: parking.name || 'Без названия',
                        address: parking.address || '',
                        action: entry.action || 'unknown',
                        timestamp: entry.timestamp,
                        car: entry.car || {},
                        previousOccupied: entry.previousOccupied,
                        newOccupied: entry.newOccupied
                    });
                }
            });
        });

        allEntries.sort((a, b) => b.timestamp - a.timestamp);

        if (allEntries.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:var(--text-secondary);">Нет истории</div>';
            return;
        }

        // Ограничиваем показ до 10 записей
        const showCount = 10;
        const previewEntries = allEntries.slice(0, showCount);
        const remainingEntries = allEntries.slice(showCount);

        let html = '';

        // Основной список (первые 10)
        html += '<div id="historyPreviewList">';
        previewEntries.forEach(entry => {
            html += renderHistoryEntry(entry);
        });
        html += '</div>';

        // Полный список (скрыт) и кнопки
        if (remainingEntries.length > 0) {
            html += '<div id="historyFullList" style="display:none;">';
            remainingEntries.forEach(entry => {
                html += renderHistoryEntry(entry);
            });
            html += '</div>';
            html += `<button id="showAllHistoryBtnProfile" style="background:none; border:none; color:var(--accent); cursor:pointer; font-size:14px; margin-top:8px;">См. все (${remainingEntries.length})</button>`;
            html += `<button id="hideAllHistoryBtnProfile" style="display:none; background:none; border:none; color:var(--accent); cursor:pointer; font-size:14px; margin-top:8px;">Скрыть всё</button>`;
        }

        container.innerHTML = html;

        // Обработчики кнопок
        const showAllBtn = document.getElementById('showAllHistoryBtnProfile');
        const hideAllBtn = document.getElementById('hideAllHistoryBtnProfile');
        const previewList = document.getElementById('historyPreviewList');
        const fullList = document.getElementById('historyFullList');

        if (showAllBtn) {
            showAllBtn.onclick = function() {
                previewList.style.display = 'none';
                fullList.style.display = 'block';
                showAllBtn.style.display = 'none';
                hideAllBtn.style.display = 'inline-block';
            };
        }
        if (hideAllBtn) {
            hideAllBtn.onclick = function() {
                fullList.style.display = 'none';
                previewList.style.display = 'block';
                showAllBtn.style.display = 'inline-block';
                hideAllBtn.style.display = 'none';
            };
        }
    }).catch(err => {
        console.error('Ошибка загрузки истории:', err);
        container.innerHTML = '<div style="text-align:center; color:var(--red);">Ошибка загрузки</div>';
    });
}
// ===================== ФИЛЬТР И ГРУППИРОВКА ПАРКОВОК =====================

function normalizeCity(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/\s+/g, ' ');
}

function normalizeStreet(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/\s+/g, ' ');
}

function getParkingCity(parking) {
    return parking?.city ||
           parking?.addressCity ||
           parking?.regionCity ||
           '';
}

function getParkingStreet(parking) {
    return parking?.street ||
           parking?.addressStreet ||
           '';
}
function getParkingHouse(parking) {
    return parking?.houseNumber ||
           parking?.house ||
           '';
}
function filterParkingsByCurrentCity(parkings) {
    const list = Array.isArray(parkings)
        ? parkings
        : Object.values(parkings || {});

    if (!currentCity) return list;

    const selectedCity = normalizeCity(currentCity);

    return list.filter(parking => {
        const parkingCity = normalizeCity(getParkingCity(parking));
        return parkingCity === selectedCity;
    });
}
function groupParkingsByNameAndStreet(parkings) {
    const groups = new Map();

    parkings.forEach(parking => {
        const name = String(parking?.name || 'Без названия').trim();
        const street = getParkingStreet(parking).trim();

        const key =
            `${normalizeCity(name)}|${normalizeStreet(street)}`;

        if (!groups.has(key)) {
            groups.set(key, {
                id: `group_${key}`,
                name,
                street,
                parkings: [],
                totalSpots: 0,
                occupiedSpots: 0,
                freeSpots: 0
            });
        }
        const group = groups.get(key);

        group.parkings.push(parking);

        const total = Number(parking?.totalSpots) || 0;
        const occupied = Math.min(
            Number(parking?.occupiedSpots) || 0,
            total
        );
        group.totalSpots += total;
        group.occupiedSpots += occupied;
        group.freeSpots += Math.max(0, total - occupied);
    });

    return Array.from(groups.values());
}

function getHomeParkings() {
    const parkings = Object.values(parkingDataCache || {});

    const cityParkings =
        filterParkingsByCurrentCity(parkings);

    return groupParkingsByNameAndStreet(cityParkings);
}
// ===================== ИЗБРАННОЕ =====================
function getFavoritesRef() {
    if (!currentUser?.id) return null;
    return database.ref(`users/${currentUser.id}/favorites`);
}

function getFavoriteRef(parkingId) {
    const ref = getFavoritesRef();
    return ref && parkingId ? ref.child(String(parkingId)) : null;
}

// Проверка: находится ли парковка в избранном
async function isFavorite(parkingId) {
    const ref = getFavoriteRef(parkingId);
    if (!ref) return false;
    try {
        const snap = await ref.once('value');
        return snap.exists();
    } catch (err) {
        console.error('Ошибка проверки избранного:', err);
        return false;
    }
}

// Обновление кнопки избранного в центральной карточке
async function updateFavoriteCenterButton() {
    const btn = document.querySelector('#centerSheetContent .parking-favorite-btn');
    if (!btn || !currentParkingId) return;
    const favorite = await isFavorite(currentParkingId);
    btn.innerHTML = favorite
        ? '<span>♥</span><span>Сохранено</span>'
        : '<span>♡</span><span>Сохранить</span>';
    btn.classList.toggle('is-favorite', favorite);
}

// Добавить / удалить парковку из избранного
async function toggleFavorite(parkingId, parkingData) {
    if (!currentUser?.id || !parkingId) {
        console.error('Избранное: отсутствует пользователь или parkingId');
        return;
    }

    const ref = getFavoriteRef(parkingId);
    if (!ref) return;

    try {
        const snap = await ref.once('value');

        if (snap.exists()) {
            await ref.remove();
            console.log('❤️ Парковка удалена из избранного:', parkingId);
        } else {
            const data = parkingData || parkingDataCache?.[parkingId] || {};
            const favoriteData = {
                parkingId: String(parkingId),
                name: data.name || 'Парковка',
                address: data.address || data.street || '',
                city: data.city || currentCity || '',
                lat: Number(data.lat ?? data.latitude ?? data.coords?.[0]) || null,
                lng: Number(data.lng ?? data.longitude ?? data.coords?.[1]) || null,
                totalSpots: Number(data.totalSpots) || 0,
                occupiedSpots: Number(data.occupiedSpots) || 0,
                savedAt: firebase.database.ServerValue.TIMESTAMP
            };

            await ref.set(favoriteData);
            console.log('❤️ Парковка добавлена в избранное:', parkingId);
        }

        await updateFavoriteCenterButton();
        await loadFavoritesInline(true);
        await refreshProfileFavoritesCount();

    } catch (err) {
        console.error('Ошибка работы с избранным:', err);
        alert('Не удалось изменить избранное');
    }
}

// Кнопка «Сохранить» в центральной карточке
async function toggleFavoriteCenter() {
    if (!currentParkingId || !currentParkingData) {
        console.error('Избранное: текущая парковка не определена');
        return;
    }

    await toggleFavorite(currentParkingId, currentParkingData);
}

// Загрузка списка избранного
async function loadFavoritesInline(force = false) {
    const container = document.getElementById('favoritesListContainer');
    if (!container || !currentUser?.id) return;

    if (!force && window._favoritesLoading) return;
    window._favoritesLoading = true;

    container.innerHTML =
        '<div style="text-align:center;color:var(--text-secondary);padding:20px;">Загрузка...</div>';

    try {
        const ref = getFavoritesRef();
        if (!ref) throw new Error('Не найден пользователь');

        const snap = await ref.once('value');
        const favorites = snap.val() || {};
        const entries = Object.entries(favorites);

        if (!entries.length) {
            container.innerHTML = `
                <div style="text-align:center;color:var(--text-secondary);padding:25px 15px;">
                    <div style="font-size:32px;margin-bottom:8px;">♡</div>
                    <div>Нет сохранённых парковок</div>
                </div>
            `;
            await refreshProfileFavoritesCount(0);
            return;
        }

        entries.sort((a, b) => {
            const timeA = Number(a[1]?.savedAt) || 0;
            const timeB = Number(b[1]?.savedAt) || 0;
            return timeB - timeA;
        });

        container.innerHTML = entries.map(([parkingId, data]) => {
            const name = escapeHtml(data?.name || 'Парковка');
            const address = escapeHtml(data?.address || data?.street || 'Адрес не указан');
            const total = Number(data?.totalSpots) || 0;
            const occupied = Number(data?.occupiedSpots) || 0;
            const free = Math.max(0, total - occupied);

            let status = 'Неизвестно';
            let statusClass = 'status-unknown';

            if (total > 0) {
                if (free <= 0) {
                    status = 'Занято';
                    statusClass = 'status-occupied';
                } else if (free <= Math.ceil(total * 0.3)) {
                    status = 'Мало мест';
                    statusClass = 'status-limited';
                } else {
                    status = 'Есть места';
                    statusClass = 'status-free';
                }
            }

            return `
                <div class="favorite-parking-item" data-parking-id="${escapeHtml(String(parkingId))}">
                    <div class="favorite-parking-info"
                         onclick="openFavoriteParking('${escapeHtml(String(parkingId))}')">
                        <div class="favorite-parking-title">${name}</div>
                        <div class="favorite-parking-address">${address}</div>
                        <div class="favorite-parking-status ${statusClass}">
                            <span class="favorite-status-dot"></span>
                            <span>${status}</span>
                            ${total > 0 ? `<span class="favorite-free-count">${free} свободно</span>` : ''}
                        </div>
                    </div>
                    <button class="favorite-remove-btn"
                            onclick="removeFromFavorites('${escapeHtml(String(parkingId))}')"
                            aria-label="Удалить из избранного">♥</button>
                </div>
            `;
        }).join('');

        await refreshProfileFavoritesCount(entries.length);

    } catch (err) {
        console.error('Ошибка загрузки избранного:', err);
        container.innerHTML = `
            <div style="text-align:center;color:var(--text-secondary);padding:20px;">
                Не удалось загрузить избранное
            </div>
        `;
    } finally {
        window._favoritesLoading = false;
    }
}

// Открытие парковки из списка избранного
async function openFavoriteParking(parkingId) {
    if (!parkingId) return;

    try {
        const ref = getFavoriteRef(parkingId);
        if (!ref) return;

        const snap = await ref.once('value');
        if (!snap.exists()) {
            await loadFavoritesInline(true);
            return;
        }

        const data = snap.val() || {};
        currentParkingId = parkingId;
        currentParkingData = data;

        if (data.lat != null && data.lng != null && map) {
            map.setCenter([Number(data.lat), Number(data.lng)], 17, {
                duration: 300
            });
        }

        if (typeof openCenterSheet === 'function') {
            openCenterSheet(parkingId, data);
        }

    } catch (err) {
        console.error('Ошибка открытия избранной парковки:', err);
    }
}

// Удаление из избранного
async function removeFromFavorites(parkingId) {
    if (!currentUser?.id || !parkingId) return;

    const ref = getFavoriteRef(parkingId);
    if (!ref) return;

    try {
        await ref.remove();

        console.log('❤️ Парковка удалена из избранного:', parkingId);

        if (currentParkingId === parkingId) {
            await updateFavoriteCenterButton();
        }

        await loadFavoritesInline(true);
        await refreshProfileFavoritesCount();

    } catch (err) {
        console.error('Ошибка удаления из избранного:', err);
        alert('Не удалось удалить парковку');
    }
}

// Реальное количество избранных парковок
async function getFavoritesCount() {
    const ref = getFavoritesRef();
    if (!ref) return 0;

    try {
        const snap = await ref.once('value');
        const favorites = snap.val() || {};
        return Object.keys(favorites).length;
    } catch (err) {
        console.error('Ошибка получения количества избранного:', err);
        return 0;
    }
}

// Обновление счётчика в профиле
async function refreshProfileFavoritesCount(count = null) {
    if (count === null) {
        count = await getFavoritesCount();
    }

    document.querySelectorAll('.pn-profile-row').forEach(row => {
        const title = row.querySelector('strong');
        const countElement = row.querySelector('small');

        if (!title || !countElement) return;
        if (title.textContent.trim() !== 'Избранные парковки') return;

        countElement.textContent =
            `${count} ${count === 1 ? 'парковка' : 'парковок'}`;
    });

    return count;
}

// Сброс флага старой системы
window._favoritesLoaded = false;
window._favoritesLoading = false;

// ---- Вспомогательная функция для отрисовки одной записи истории ----
function renderHistoryEntry(entry) {
    const date = new Date(entry.timestamp);
    const dateStr = date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const actionText = entry.action === 'occupied' ? 'Занял' : 'Освободил';
    const actionColor = entry.action === 'occupied' ? 'var(--history-occupied)' : 'var(--history-freed)';
    const carStr = entry.car.brand ? `${entry.car.brand} ${entry.car.model || ''}` : 'без авто';
    return `
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 0.5px solid var(--border-color); font-size: 14px;">
            <div>
                <div style="font-weight: 500;">${escapeHtml(entry.parkingName)}</div>
                <div style="color: var(--text-secondary); font-size: 12px;">${escapeHtml(entry.address)}</div>
            </div>
            <div style="text-align: right;">
                <div style="color: ${actionColor}; font-weight: 600;">${actionText}</div>
                <div style="color: var(--text-secondary); font-size: 12px;">${carStr}</div>
                <div style="color: var(--text-secondary); font-size: 11px;">${dateStr}</div>
            </div>
        </div>
    `;
}

// ---- Рендер настроек (инлайн) ----
function renderSettingsInline() {
    const container = document.getElementById('settingsContentInline');
    if (!container) return;
    if (!currentUser) {
        container.innerHTML = '<p>Войдите для доступа к настройкам</p>';
        return;
    }

    const isDark = document.body.classList.contains('dark-theme');
    const isGuest = currentUser.id.startsWith('guest_');

    let html = '';

    // Тема
    html += `
        <div class="settings-row">
            <span class="settings-label">Тёмная тема</span>
            <label class="theme-switch" style="width: 51px; height: 31px;">
               <input type="checkbox" id="settingsThemeToggleInline" ${isDark ? 'checked' : ''} onchange="toggleTheme()">
                <span class="theme-slider"></span>
            </label>
        </div>
    `;

    if (!isGuest) {
      // Добавьте в html настроек
html += `
  <div class="settings-row">
    <span class="settings-label">🔔 Уведомления о парковках</span>
    <label class="theme-switch" style="width: 51px; height: 31px;">
      <input type="checkbox" id="pushToggle" ${Notification.permission === 'granted' ? 'checked' : ''} onchange="togglePushNotifications()">
      <span class="theme-slider"></span>
    </label>
  </div>
`;

// Функция для переключения
window.togglePushNotifications = async function() {
  const isChecked = document.getElementById('pushToggle').checked;
  if (isChecked) {
    await initPushNotifications();
  } else {
    await unsubscribePush();
  }
};
        // Город
        html += `
            <div class="settings-row" style="flex-direction: column; align-items: stretch; gap: 6px;">
                <span class="settings-label">Мой город</span>
                <div style="display: flex; gap: 8px;">
                    <select id="settingsRegionInline" class="input-field" onchange="updateCitySelectInSettingsInline()" style="flex:1; margin:0;">
                        <option value="">Регион</option>
                        ${Object.keys(regionsData).sort().map(r => `<option value="${r}" ${r===userCityPrefs.region?'selected':''}>${r}</option>`).join('')}
                    </select>
                    <select id="settingsCityInline" class="input-field" onchange="saveCityFromSettingsInline()" style="flex:1; margin:0;">
                        <option value="">Город</option>
                        ${userCityPrefs.region && regionsData[userCityPrefs.region] ? regionsData[userCityPrefs.region].map(c => `<option value="${c}" ${c===userCityPrefs.city?'selected':''}>${c}</option>`).join('') : ''}
                    </select>
                </div>
            </div>
        `;
        // Удалить аккаунт
        html += `
            <div class="settings-row" style="border-bottom: none;">
                <button class="btn-danger-text" onclick="deleteAccount()" style="padding: 8px 0;">Удалить аккаунт</button>
            </div>
        `;
    } else {
        html += `<div class="settings-row"><span style="color: var(--text-secondary);">Гостевой режим — настройки ограничены</span></div>`;
    }

    container.innerHTML = html;
}


// ---- Вспомогательные функции для настроек инлайн ----
function updateCitySelectInSettingsInline() {
    var regionSelect = document.getElementById('settingsRegionInline');
    var region = regionSelect ? regionSelect.value : '';
    var citySelect = document.getElementById('settingsCityInline');
    if (!citySelect) return;
    citySelect.innerHTML = '<option value="">Выберите город</option>';
    if (region && regionsData[region]) {
        regionsData[region].forEach(function(city) {
            var opt = document.createElement('option');
            opt.value = city;
            opt.textContent = city;
            if (city === userCityPrefs.city) opt.selected = true;
            citySelect.appendChild(opt);
        });
    }
}
function saveCityFromSettingsInline() {
    if (!currentUser) return;
    var regionSelect = document.getElementById('settingsRegionInline');
    var citySelect = document.getElementById('settingsCityInline');
    var region = regionSelect ? regionSelect.value : '';
    var city = citySelect ? citySelect.value : '';
    if (!region || !city) return;
    mapCity = null;
    database.ref('users/' + currentUser.id + '/cityPreferences').set({ region: region, city: city })
        .then(function() {
            userCityPrefs = { region: region, city: city };
            // Сохраняем в localStorage
            localStorage.setItem('parknear_city', JSON.stringify({ region, city }));
            // Обновляем координаты города
            ymaps.geocode(city, { results: 1 }).then(function(res) {
                const geo = res.geoObjects.get(0);
                if (geo) {
                    const coords = geo.geometry.getCoordinates();
                    cityCoords = { lat: coords[0], lng: coords[1] };
                    localStorage.setItem('parknear_city_coords', JSON.stringify(cityCoords));
                    if (map) {
                        map.setCenter(coords, 12, { duration: 500 });
                    }
                }
            });
            updateCityDisplay();
            loadAllParkings(city);   // ← передаём city
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.selectionChanged();
            }
        })
        .catch(function(err) {
            alert('Ошибка: ' + err.message);
        });
}
    // ===================== НАСТРОЙКИ =====================

    function closeSettings() {
        document.getElementById('settingsOverlay').style.display = 'none';
    }

    function renderSettings() {
        const contentEl = document.getElementById('settingsContent');
        if (!contentEl) {
            console.error('Элемент settingsContent не найден!');
            return;
        }

        if (!currentUser) {
            contentEl.innerHTML = '<p style="text-align:center;color:var(--text-secondary);">Пожалуйста, войдите в аккаунт</p>';
            return;
        }

        const isDark = document.body.classList.contains('dark-theme');
        const isGuest = currentUser.id.startsWith('guest_');

        let html = '';

        html += `<div class="settings-section">
        <div class="settings-section-header">Основные</div>
        <div class="settings-row">
            <span class="settings-label">Тёмная тема</span>
            <label class="theme-switch" style="width: 51px; height: 31px;">
                <input type="checkbox" id="settingsThemeToggle" ${isDark ? 'checked' : ''} onchange="toggleTheme()">
                <span class="theme-slider"></span>
            </label>
        </div>
    </div>`;

        if (!isGuest) {
            html += `<div class="settings-section">
            <div class="settings-section-header">Мой город</div>
            <div class="settings-picker-row">
                <select id="settingsRegion" class="input-field" onchange="updateCitySelectInSettings()" style="margin:0;">
                    <option value="">Регион</option>
                    ${Object.keys(regionsData).sort().map(r => `<option value="${r}" ${r===userCityPrefs.region?'selected':''}>${r}</option>`).join('')}
                </select>
                <select id="settingsCity" class="input-field" onchange="saveCityFromSettings()" style="margin:0;">
                    <option value="">Город</option>
                    ${userCityPrefs.region && regionsData[userCityPrefs.region] ? regionsData[userCityPrefs.region].map(c => `<option value="${c}" ${c===userCityPrefs.city?'selected':''}>${c}</option>`).join('') : ''}
                </select>
            </div>
        </div>`;

            const car = currentUser.car || {};
            html += `<div class="settings-section">
            <div class="settings-section-header">Автомобиль</div>
            <div class="settings-row">
                <span class="settings-label">Моё авто</span>
                <span class="settings-value">
                    ${(car.brand || car.model) ? `${car.brand || ''} ${car.model || ''}` : 'Не указан'}
                    <button class="settings-edit-btn" onclick="event.stopPropagation(); editCarDataFromSettings()">✏️</button>
                </span>
            </div>
        </div>`;

            html += `<div class="settings-section">
            <div class="settings-section-header">Профиль</div>
            <div class="settings-row">
                <span class="settings-label">Никнейм</span>
                <span class="settings-value">
                    ${currentUser.nickname || 'Не указан'}
                    <button class="settings-edit-btn" onclick="event.stopPropagation(); editNickname()">✏️</button>
                </span>
            </div>
            <div class="settings-row" onclick="resetOnboarding()">
                <span class="settings-label">Обучение</span>
                <span class="settings-value">Показать ещё раз <span class="settings-arrow">›</span></span>
            </div>
        </div>`;

            html += `<div class="settings-section">
            <button class="btn-danger-text" onclick="deleteAccount()">Удалить аккаунт</button>
        </div>`;
        } else {
            html += `<div class="settings-section">
            <div class="settings-row">
                <span class="settings-label" style="color: var(--text-secondary);">Гостевой режим — настройки ограничены</span>
            </div>
        </div>`;
        }

        contentEl.innerHTML = html;
syncThemeToggles();
}
    function updateCitySelectInSettings() {
        const region = document.getElementById('settingsRegion')?.value;
        const citySelect = document.getElementById('settingsCity');
        if (!citySelect) return;

        citySelect.innerHTML = '<option value="">Выберите город</option>';

        if (region && regionsData[region]) {
            regionsData[region].forEach(city => {
                const opt = document.createElement('option');
                opt.value = city;
                opt.textContent = city;
                if (city === userCityPrefs.city) opt.selected = true;
                citySelect.appendChild(opt);
            });
        }
    }

   function saveCityFromSettings() {
    if (!currentUser) {
        console.warn('Пользователь не авторизован');
        return;
    }
    var regionSelect = document.getElementById('settingsRegion');
    var citySelect = document.getElementById('settingsCity');
    var region = regionSelect ? regionSelect.value : '';
    var city = citySelect ? citySelect.value : '';
    if (!region || !city) return;
    mapCity = null;
    database.ref('users/' + currentUser.id + '/cityPreferences').set({ region: region, city: city })
        .then(function() {
            userCityPrefs = { region: region, city: city };
            currentCity = city;
            localStorage.setItem('parknear_city', JSON.stringify({ region, city }));
            // Получаем координаты и сохраняем
            ymaps.geocode(city, { results: 1 }).then(function(res) {
                const geo = res.geoObjects.get(0);
                if (geo) {
                    const coords = geo.geometry.getCoordinates();
                    cityCoords = { lat: coords[0], lng: coords[1] };
                    localStorage.setItem('parknear_city_coords', JSON.stringify(cityCoords));
                    if (map) {
                        map.setCenter(coords, 12, { duration: 500 });
                    }
                }
            });
            updateCityDisplay();
            loadAllParkings(city);   // ← передаём city
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.selectionChanged();
            }
            console.log('✅ Город сохранён в профиле:', city);
        })
        .catch(function(err) {
            console.error('❌ Ошибка сохранения города:', err);
            alert('Не удалось сохранить город: ' + err.message);
        });
}
    function saveNickname(newNickname) {
        if (!currentUser) return;
        const nick = newNickname || (document.getElementById('settingsNickname')?.value?.trim());
        if (!nick) { alert('Введите никнейм'); return; }
        database.ref(`users/${currentUser.id}/nickname`).set(nick)
            .then(() => {
                currentUser.nickname = nick;
                localStorage.setItem('tgUser', JSON.stringify(currentUser));
                if (document.getElementById('settingsOverlay')?.style?.display === 'flex') {
                    renderSettings();
                }
                if (window.Telegram?.WebApp?.HapticFeedback) {
                    window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                }
            })
            .catch(err => alert('Ошибка: ' + err.message));
    }

    function saveCarData() {
        if (!currentUser) {
            alert('Необходимо авторизоваться');
            return;
        }
        const brand = document.getElementById('carBrandSelect')?.value;
        const model = document.getElementById('carModelSelect')?.value;
        const color = document.getElementById('carColorSelect')?.value;
        const plate = document.getElementById('carPlateInput')?.value?.trim()?.toUpperCase();

        if (!brand || !model) {
            alert('Пожалуйста, выберите марку и модель');
            return;
        }

        database.ref(`users/${currentUser.id}/car`).set({
            brand: brand,
            model: model,
            color: color || null,
            plate: plate || null
        }).then(() => {
            closeCarEditor();
            // Перерисовываем профиль, если он открыт
const panel = document.getElementById('panel');
if (panel && panel.classList.contains('active')) {
    const title = document.getElementById('panelTitle');
    if (title && title.textContent === 'Профиль') {
        const content = document.getElementById('panelContent');
        renderProfile(content);
    }
}
            if (document.getElementById('settingsOverlay')?.style?.display === 'flex') {
                renderSettings();
            }
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
        }).catch(err => {
            alert('Ошибка сохранения: ' + err.message);
        });
    }
function removeCar() {
    if (!currentUser) {
        alert('Необходимо авторизоваться');
        return;
    }
    if (!confirm('Удалить данные об автомобиле?')) return;
    database.ref(`users/${currentUser.id}/car`).remove()
        .then(() => {
            // Обновляем объект пользователя
            if (currentUser) {
                currentUser.car = {};
            }
            // Перерисовываем профиль, если он открыт
            const panel = document.getElementById('panel');
            if (panel && panel.classList.contains('active')) {
                const title = document.getElementById('panelTitle');
                if (title && title.textContent === 'Профиль') {
                    const content = document.getElementById('panelContent');
                    renderProfile(content);
                }
            }
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
            showToast('🚗 Автомобиль удалён');
        })
        .catch(err => {
            console.error('Ошибка удаления автомобиля:', err);
            alert('Не удалось удалить автомобиль: ' + err.message);
        });
}
    // ===================== ИЗБРАННОЕ =====================
function renderFavorites(content) {
    if (!content) return;
    if (!currentUser) {
        content.innerHTML = `
            <div class="pn-fav-empty">
                <div class="pn-fav-empty-icon">🔒</div>
                <h3>Войдите в аккаунт</h3>
                <p>После входа здесь будут сохранённые парковки.</p>
            </div>`;
        return;
    }

    content.innerHTML = `
        <div class="pn-favorites">
            <div class="pn-fav-header">
                <div>
                    <h2>Избранное</h2>
                    <p id="pnFavSubtitle">Загрузка сохранённых парковок...</p>
                </div>
                <div class="pn-fav-header-icon">♥</div>
            </div>

            <div class="pn-fav-city" id="pnFavCity">
                <span class="pn-fav-city-icon">📍</span>
                <div>
                    <small>Выбранный город</small>
                    <strong>${escapeHtml(userCityPrefs?.city || currentCity || 'Все города')}</strong>
                </div>
            </div>
<div class="pn-fav-tabs">
    <button class="pn-fav-tab active" id="pnFavTabFavorites" onclick="switchFavoritesTab('favorites')">
        ♥ Избранное
    </button>
    <button class="pn-fav-tab" id="pnFavTabAddresses" onclick="switchFavoritesTab('addresses')">
        📍 Мои адреса
    </button>
</div>

<div id="pnFavoritesTabContent"></div>
<div id="pnAddressesTabContent" style="display:none;"></div>
            <div class="pn-fav-search">
                <span>⌕</span>
                <input id="pnFavSearch" type="search" placeholder="Поиск парковки или адреса..." autocomplete="off">
                <button id="pnFavClearSearch" type="button">×</button>
            </div>

            <div class="pn-fav-filters">
                <button class="pn-fav-filter active" data-sort="recent">Недавние</button>
                <button class="pn-fav-filter" data-sort="free">Свободные</button>
                <button class="pn-fav-filter" data-sort="distance">Ближайшие</button>
            </div>

            <div id="pnFavList" class="pn-fav-list">
                <div class="pn-fav-loading">
                    <div class="pn-fav-spinner"></div>
                    <span>Загрузка...</span>
                </div>
            </div>
        </div>
    `;

    const list = document.getElementById('pnFavList');
    const searchInput = document.getElementById('pnFavSearch');
    const clearSearch = document.getElementById('pnFavClearSearch');
    const subtitle = document.getElementById('pnFavSubtitle');
    const cityEl = document.getElementById('pnFavCity');
    const filterButtons = document.querySelectorAll('.pn-fav-filter');

    let favorites = [];
    let currentSort = 'recent';
    let searchValue = '';

    function getSelectedCity() {
        return String(
            userCityPrefs?.city ||
            mapCity?.city ||
            currentCity ||
            ''
        ).trim();
    }

    function normalize(value) {
        return String(value || '').trim().toLowerCase();
    }

    function getFree(parking) {
        const total = Number(parking.totalSpots || 0);
        const occupied = Number(parking.occupiedSpots || 0);
        return Math.max(0, total - occupied);
    }

    function getDistance(parking) {
        if (!lastKnownLocation || !parking?.lat || !parking?.lng) return Infinity;
        return getDistanceInMeters(
            lastKnownLocation.lat,
            lastKnownLocation.lng,
            Number(parking.lat),
            Number(parking.lng)
        );
    }

    function getOccupancyClass(parking) {
        const total = Number(parking.totalSpots || 0);
        if (!total) return 'unknown';
        const free = getFree(parking);
        const ratio = free / total;
        if (ratio <= 0.2) return 'critical';
        if (ratio <= 0.5) return 'low';
        return 'good';
    }

    function getOccupancyText(parking) {
        const total = Number(parking.totalSpots || 0);
        if (!total) return 'Мест нет в данных';
        const free = getFree(parking);
        return `${free} свободно из ${total}`;
    }

    function formatDistance(distance) {
        if (!Number.isFinite(distance)) return '';
        return distance < 1000
            ? `${Math.round(distance)} м`
            : `${(distance / 1000).toFixed(1)} км`;
    }

    function getWalkingTime(distance) {
        if (!Number.isFinite(distance)) return '';
        const minutes = Math.round(distance / 500);
        return minutes < 1 ? '<1 мин' : `${minutes} мин`;
    }

    function renderList() {
        const city = getSelectedCity();
        const query = normalize(searchValue);

        let filtered = favorites.filter(item => {
            const parking = item.parking || item;

            if (city) {
                const parkingCity = normalize(parking.city);
                if (!parkingCity || parkingCity !== normalize(city)) return false;
            }

            if (!query) return true;

            return [
                parking.name,
                parking.address,
                parking.street,
                parking.city
            ].some(value => normalize(value).includes(query));
        });

        filtered.sort((a, b) => {
            const pa = a.parking || a;
            const pb = b.parking || b;

            if (currentSort === 'free') {
                return getFree(pb) - getFree(pa);
            }

            if (currentSort === 'distance') {
                return getDistance(pa) - getDistance(pb);
            }

            return Number(b.timestamp || 0) - Number(a.timestamp || 0);
        });

        subtitle.textContent = `${filtered.length} ${filtered.length === 1 ? 'парковка' : filtered.length < 5 ? 'парковки' : 'парковок'}`;

        if (cityEl) {
            cityEl.querySelector('strong').textContent = city || 'Все города';
        }

        if (!filtered.length) {
            list.innerHTML = `
                <div class="pn-fav-empty">
                    <div class="pn-fav-empty-icon">${query ? '🔎' : '♡'}</div>
                    <h3>${query ? 'Ничего не найдено' : 'Избранное пусто'}</h3>
                    <p>
                        ${query
                            ? 'Попробуйте изменить запрос.'
                            : city
                                ? `В городе «${escapeHtml(city)}» пока нет сохранённых парковок.`
                                : 'Добавляйте парковки в избранное, чтобы быстро находить их снова.'}
                    </p>
                    ${!query ? `<button onclick="showMap()">Найти парковку</button>` : ''}
                </div>`;
            return;
        }

        list.innerHTML = filtered.map(item => {
            const parking = item.parking || item;
            const id = item.parkingId || parking.id;
            const free = getFree(parking);
            const total = Number(parking.totalSpots || 0);
            const distance = getDistance(parking);
            const distanceText = formatDistance(distance);
            const walkingText = getWalkingTime(distance);
            const occupancyClass = getOccupancyClass(parking);

            const name = escapeHtml(
                parking.name ||
                item.name ||
                'Без названия'
            );

            const address = escapeHtml(
                parking.address ||
                item.address ||
                ''
            );

            const parkingCity = escapeHtml(
                parking.city ||
                item.city ||
                ''
            );

            return `
                <article class="pn-fav-card" data-parking-id="${escapeHtml(String(id))}">
                    <button class="pn-fav-card-main" type="button">
                        <div class="pn-fav-card-icon">🅿️</div>

                        <div class="pn-fav-card-info">
                            <div class="pn-fav-card-title">${name}</div>

                            ${address ? `
                                <div class="pn-fav-card-address">
                                    ${address}
                                </div>
                            ` : ''}

                            ${parkingCity ? `
                                <div class="pn-fav-card-city">
                                    📍 ${parkingCity}
                                </div>
                            ` : ''}

                            <div class="pn-fav-card-meta">
                                <span class="pn-fav-occupancy ${occupancyClass}">
                                    <i></i>${escapeHtml(getOccupancyText(parking))}
                                </span>

                                ${distanceText ? `
                                    <span class="pn-fav-meta-separator">·</span>
                                    <span>${escapeHtml(distanceText)}</span>
                                ` : ''}

                                ${walkingText ? `
                                    <span class="pn-fav-meta-separator">·</span>
                                    <span>${escapeHtml(walkingText)}</span>
                                ` : ''}
                            </div>
                        </div>

                        <span class="pn-fav-card-arrow">›</span>
                    </button>

                    <button
                        class="pn-fav-remove"
                        type="button"
                        title="Удалить из избранного"
                        data-remove-id="${escapeHtml(String(id))}">
                        ♥
                    </button>
                </article>
            `;
        }).join('');

        list.querySelectorAll('.pn-fav-card-main').forEach(button => {
            button.addEventListener('click', function() {
                const card = this.closest('.pn-fav-card');
                const id = card?.dataset?.parkingId;
                if (!id) return;
                highlightAndShowParking(id);
            });
        });

        list.querySelectorAll('.pn-fav-remove').forEach(button => {
            button.addEventListener('click', function(event) {
                event.stopPropagation();

                const id = this.dataset.removeId;
                if (!id) return;

                removeFromFavorites(id);
            });
        });
    }

    Promise.all([
        database.ref(`users/${currentUser.id}/favorites`).once('value'),
        database.ref('parkings').once('value')
    ]).then(([favSnap, parkingSnap]) => {
        const favData = favSnap.val() || {};
        const parkingData = parkingSnap.val() || {};

        favorites = Object.values(favData)
            .filter(item => item && item.parkingId)
            .map(item => {
                const parking = parkingData[item.parkingId];

                return {
                    ...item,
                    parking: parking
                        ? {
                            ...parking,
                            id: item.parkingId
                        }
                        : {
                            ...item,
                            id: item.parkingId
                        }
                };
            });

        renderList();
    }).catch(error => {
        console.error('Ошибка загрузки избранного:', error);

        list.innerHTML = `
            <div class="pn-fav-empty">
                <div class="pn-fav-empty-icon">⚠️</div>
                <h3>Не удалось загрузить</h3>
                <p>Проверьте соединение и попробуйте ещё раз.</p>
                <button onclick="renderFavorites(document.getElementById('panelContent'))">
                    Повторить
                </button>
            </div>
        `;
    });

    searchInput.addEventListener('input', function() {
        searchValue = this.value.trim();
        clearSearch.classList.toggle('visible', !!searchValue);
        renderList();
    });

    clearSearch.addEventListener('click', function() {
        searchInput.value = '';
        searchValue = '';
        this.classList.remove('visible');
        searchInput.focus();
        renderList();
    });

    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            currentSort = this.dataset.sort || 'recent';
            renderList();
        });
    });
}
    function loadUserData(type, content) {
    if (!currentUser) {
        if (content) {
            content.innerHTML = '<div class="empty-state"><div class="icon">🔒</div><p>Войдите</p></div>';
        }
        return;
    }

    database.ref(`users/${currentUser.id}/stats`).once('value').then(snapshot => {
        if (!snapshot.exists()) {
            const initialStats = {
                registeredAt: Date.now(),
                lastActive: Date.now(),
                parkingsCreated: 0,
                parkingsUpdated: 0,
                confirmations: 0,
                views: 0,
                favorites: 0,
                activeDates: [new Date().toISOString().split('T')[0]]
            };
            database.ref(`users/${currentUser.id}/stats`).set(initialStats);
        } else {
            const stats = snapshot.val();
            const today = new Date().toISOString().split('T')[0];
            let activeDates = stats.activeDates || [];
            if (!activeDates.includes(today)) activeDates.push(today);
            database.ref(`users/${currentUser.id}/stats`).update({
                lastActive: Date.now(),
                activeDates: activeDates
            });
        }
    });

    database.ref(`users/${currentUser.id}/cityPreferences`).once('value').then(snap => {
        if (snap.exists()) {
            userCityPrefs = snap.val();
            if (typeof updateCityDisplay === 'function') {
                updateCityDisplay();
            }
        }
    });

    if (type === 'favorites' && content) {
        database.ref(`users/${currentUser.id}/favorites`).once('value').then(favSnap => {
            const favs = favSnap.val() || {};
            const favIds = Object.keys(favs);

            let html = `
                <div class="pn-favorites">
                    <div class="pn-fav-header">
                        <div>
                            <h2>Избранное</h2>
                            <p>${favIds.length ? `${favIds.length} сохранённых парковок` : 'Сохранённые парковки появятся здесь'}</p>
                        </div>
                        <span class="pn-fav-icon">❤️</span>
                    </div>
            `;

            if (!favIds.length) {
                html += `
                    <div class="empty-state">
                        <div class="icon">❤️</div>
                        <p>Избранное пусто</p>
                        <span>Нажмите ❤️ на парковке, чтобы сохранить её здесь</span>
                    </div>
                `;
            } else {
                html += `
                    <div class="fav-search">
                        <input type="text" id="favSearchInput" placeholder="Поиск по избранному..." oninput="filterFavorites()">
                    </div>
                    <div id="favListContainer">
                `;

                Object.values(favs).forEach(item => {
                    if (!item || !item.parkingId) return;

                    const name = escapeHtml(item.name || 'Парковка');
                    const address = escapeHtml(item.address || 'Адрес не указан');

                    html += `
                        <div class="fav-item" data-name="${name}" data-address="${address}" onclick="highlightAndShowParking('${item.parkingId}')">
                            <div class="fav-item-info">
                                <div class="fav-item-name">${name}</div>
                                <div class="fav-item-meta">📍 ${address}</div>
                            </div>
                            <div class="fav-item-right">
                                <span class="occupancy-dot" style="background:var(--accent);"></span>
                                <button class="settings-edit-btn" onclick="event.stopPropagation(); removeFromFavorites('${item.parkingId}')" title="Удалить из избранного">❤️</button>
                            </div>
                        </div>
                    `;
                });

                html += `
                    </div>
                `;
            }

            html += `
                </div>
            `;

            content.innerHTML = html;

            if (typeof attachSwipeToContainers === 'function') {
                attachSwipeToContainers(content);
            }
        }).catch(err => {
            console.error('Ошибка загрузки избранного:', err);
            content.innerHTML = `
                <div class="empty-state">
                    <div class="icon">⚠️</div>
                    <p>Не удалось загрузить избранное</p>
                </div>
            `;
        });
    }
}
    // ===================== UI КОНТРОЛЛЕРЫ =====================
    function attachSwipeToContainers(container) {
        container.querySelectorAll('.swipe-container').forEach(cnt => {
            const item = cnt.querySelector('.swipe-item');
            if (!item) return;

            let startX = 0,
                curX = 0,
                dragging = false;
            item.addEventListener('touchstart', e => {
                startX = e.touches[0].clientX;
                dragging = true;
                item.style.transition = 'none';
            });
            item.addEventListener('touchmove', e => {
                if (!dragging) return;
                curX = e.touches[0].clientX - startX;
                if (curX < 0) item.style.transform = `translateX(${Math.max(curX, -80)}px)`;
            });
            item.addEventListener('touchend', () => {
                dragging = false;
                item.style.transition = 'transform 0.2s';
                if (curX < -40) item.style.transform = 'translateX(-80px)';
                else item.style.transform = 'translateX(0)';
                curX = 0;
            });

            const deleteBtn = cnt.querySelector('.swipe-delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    item.style.transform = 'translateX(0)';
                });
            }
        });
    }
function showPanel(type, keepFilter = false) {
    if (type === 'search' && !keepFilter) {
        nearbySearchFilter = null;
    }
    document.getElementById('panel').classList.add('active');
    const content = document.getElementById('panelContent');
    
    const titles = {
        profile: 'Профиль',
        favorites: 'Избранное',
        search: 'Поиск',
        home: 'Главная',
        mycar: 'Моя машина'
    };
    document.getElementById('panelTitle').textContent = titles[type] || 'Главная';

    // Рендерим нужный контент
    switch (type) {
        case 'profile':
            renderProfile(content);
            break;
        case 'favorites':
         renderFavorites(content);
         break;
        case 'search':
            renderSearchPanel(content);
            break;
        case 'mycar':
            if (typeof renderMyCarPanel === 'function') {
                renderMyCarPanel(content);
            } else {
                content.innerHTML = '<div class="empty-state"><p>Функция "Моя машина" ещё не добавлена</p></div>';
            }
            break;
        default: // home
            renderHomePanel(content);
    }

    // Обновляем активную вкладку в нижнем меню
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const tabIndex = { home: 0, search: 1, favorites: 2, profile: 3, mycar: 1 };
    const idx = tabIndex[type] !== undefined ? tabIndex[type] : 0;
    const tabs = document.querySelectorAll('.tab');
    if (tabs[idx]) tabs[idx].classList.add('active');
}
    function toggleGroup(header) {
        const items = header.nextElementSibling;
        if (items) {
            items.style.display = items.style.display === 'none' ? 'block' : 'none';
            header.classList.toggle('collapsed');
        }
    }
    
    function closePanel() {
    nearbySearchFilter = null;
    if (isAddressPickerOpen) cancelAddressPicker();
    closeCenterSheet();
    closeRoute();
    document.getElementById('panel').classList.remove('active');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab')[1].classList.add('active');
    currentParkingId = null;
    currentParkingData = null;

    // Если мы редактируем полигон существующей парковки – сбрасываем
    if (editingPolygon) {
        map.geoObjects.remove(editingPolygon);
        editingPolygon = null;
        document.getElementById('addBtn').classList.remove('drawing');
        document.getElementById('addBtn').textContent = '+';
        isDrawingMode = false;
        const c = document.getElementById('drawingControls');
        if (c) c.remove();
    }

    // ⚠️ НЕ УДАЛЯЕМ drawingControls для нового рисования
    // Они остаются на карте, чтобы пользователь мог продолжить

    if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
    }
    lastClickParkingId = null;
    lastClickTime = 0;
    resetHighlightedParkings();
}

   function showMap() {
    closePanel();
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab')[1].classList.add('active');
}


    function resetHighlightedParkings() {
        Object.keys(highlightedParkings).forEach(id => {
            if (mapMarkers[id]) {
                const orig = highlightedParkings[id];
                if (orig.fillColor) mapMarkers[id].options.set({ fillColor: orig.fillColor, strokeColor: orig
                        .strokeColor });
                else if (orig.preset) mapMarkers[id].options.set('preset', orig.preset);
            }
        });
        highlightedParkings = {};
    }

    // ===================== АУТЕНТИФИКАЦИЯ =====================
function getGuestId() {
    let guestId = localStorage.getItem('parknear_guest_id');
    if (!guestId) {
        guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('parknear_guest_id', guestId);
    }
    return guestId;
}
   function continueAsGuest() {
    // 1. Пытаемся восстановить существующего гостя
    let guestId = localStorage.getItem('parknear_guest_id');
    let user;

    if (guestId) {
        // Восстанавливаем существующего гостя
        user = {
            id: guestId,
            username: 'guest',
            firstName: 'Гость',
            photoUrl: '',
            isGuest: true
        };
        console.log('👤 Восстановлен гость:', guestId);
    } else {
        // Создаём нового гостя
        guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('parknear_guest_id', guestId);
        user = {
            id: guestId,
            username: 'guest',
            firstName: 'Гость',
            photoUrl: '',
            isGuest: true
        };
        console.log('🆕 Создан новый гость:', guestId);

        // Создаём статистику в Firebase только для нового гостя
        database.ref('users/' + guestId + '/stats').set({
            registeredAt: Date.now(),
            lastActive: Date.now(),
            parkingsCreated: 0,
            parkingsUpdated: 0,
            confirmations: 0,
            views: 0,
            favorites: 0,
            activeDates: [new Date().toISOString().split('T')[0]]
        }).catch(function(err) {
            console.warn('Ошибка создания статистики гостя:', err);
        });
    }

    // 2. Устанавливаем текущего пользователя
    currentUser = user;
    window.currentUser = user;

    // 3. Сохраняем в localStorage (для совместимости с initAuth)
    localStorage.setItem('tgUser', JSON.stringify(user));

    // 4. Обновляем активность (последний вход)
    database.ref('users/' + guestId + '/stats/lastActive').set(Date.now())
        .catch(function(err) {
            console.warn('Не удалось обновить lastActive:', err);
        });

    // 5. Обновляем активные дни (если сегодня ещё не было)
    const today = new Date().toISOString().split('T')[0];
    database.ref('users/' + guestId + '/stats/activeDates').once('value')
        .then(function(snap) {
            var dates = snap.val() || [];
            if (!dates.includes(today)) {
                dates.push(today);
                database.ref('users/' + guestId + '/stats/activeDates').set(dates);
            }
        })
        .catch(function(err) {
            console.warn('Не удалось обновить активные дни:', err);
        });

    // 6. Скрываем экран входа
    hideAuthScreen();

    // 7. Показываем главную панель и онбординг (если ещё не показывали)
    showPanel('home');
    showOnboarding();

    console.log('✅ Гостевой вход выполнен');
}

    function logout() {
        localStorage.removeItem('tgUser');
        currentUser = null;
        showAuthScreen();
    }

    function deleteAccount() {
        if (!currentUser || currentUser.id.startsWith('guest_')) {
            alert('Гостевой аккаунт нельзя удалить');
            return;
        }
        if (!confirm('Безвозвратно удалить аккаунт и все данные?')) return;
        const uid = currentUser.id;
        database.ref('parkings').once('value').then(snap => {
            const updates = {};
            snap.forEach(child => {
                if (child.val().authorId === uid) updates[child.key] = null;
            });
            return database.ref('parkings').update(updates);
        }).then(() => database.ref(`users/${uid}`).remove())
            .then(() => {
                localStorage.removeItem('tgUser');
                currentUser = null;
                showPanel('home');
            }).catch(err => alert('Ошибка: ' + err.message));
    }

    // ===================== ОНБОРДИНГ С ПОДСВЕТКОЙ =====================
    const onboardingSlides = [
    {
        icon: '👋',
        title: 'Добро пожаловать в ParkNear!',
        text: 'Приложение для поиска и отметки парковок, с актуальной занятостью. Давайте познакомимся с главными функциями.',
        highlightSelector: null,
        requiredAction: false
    },
    {
        icon: '➕',
        title: 'Шаг 1: Добавление парковки',
        text: 'Нажмите на синюю кнопку «+» в правом нижнем углу, чтобы обвести зону на карте и указать количество мест.',
        highlightSelector: '#addBtn',
        requiredAction: true
    },
    {
        icon: '📍',
        title: 'Шаг 2: Ваше местоположение',
        text: 'Нажмите на кнопку с эмодзи 📍, чтобы карта переместилась к вам. Это поможет искать парковки рядом.',
        highlightSelector: '#geoBtn',
        requiredAction: true
    },
    // ❌ Удалён шаг с обновлением данных, так как кнопки нет
    {
        icon: '🗺️',
        title: 'Шаг 3: Слои карты',
        text: 'Нажмите на иконку 🗺️ в правом верхнем углу, чтобы переключать вид: схема, спутник или гибрид.',
        highlightSelector: '.layer-switcher',
        requiredAction: true
    },
    {
        icon: '🔍',
        title: 'Шаг 4: Поиск парковок',
        text: 'На главном экране введите адрес или место в поле «куда вы направляетесь?», чтобы найти парковки рядом.',
        highlightSelector: '#homeSearchInput',  // ← исправлено
        requiredAction: true
    },
    {
        icon: '⭐',
        title: 'Шаг 5: Избранное и адреса',
        text: 'Вкладка «Избранное» хранит ваши любимые парковки и домашние адреса. Свайпом влево можно удалить.',
        highlightSelector: '.tab:nth-child(3)',
        requiredAction: true
    },
    {
        icon: '⚙️',
        title: 'Шаг 6: Настройки профиля',
        text: 'В профиле (вкладка «Профиль») можно задать город, добавить автомобиль и включить тёмную тему. Нажмите на вкладку, чтобы заглянуть.',
        highlightSelector: '.tab:nth-child(4)',
        requiredAction: true
    },
    {
        icon: '🎉',
        title: 'Вы готовы!',
        text: 'Теперь вы знаете все основные фишки. Начните с поиска парковки или добавьте свою — удачи на дорогах!',
        highlightSelector: null,
        requiredAction: false
    }
];
    let currentSlide = 0;
    let highlightedElement = null;
    let isOnboardingActive = false;
    let clickHandlerForHighlight = null;

   function showAuthScreen() {
    const overlay = document.getElementById('authOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        // Сбрасываем анимацию, если она была
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
    } else {
        console.error('Элемент #authOverlay не найден в DOM');
        // Создаём оверлей на лету (запасной вариант)
        createAuthScreenFallback();
    }
}
// Скрывает экран входа
function hideAuthScreen() {
    const overlay = document.getElementById('authOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}
function createAuthScreenFallback() {
    // Удаляем старый, если есть
    const old = document.getElementById('authOverlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'authOverlay';
    overlay.style.cssText = `
        display: flex;
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: var(--overlay-bg, rgba(14,41,49,0.8));
        z-index: 6000;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        padding: 20px;
    `;

    overlay.innerHTML = `
        <div style="background: var(--bg-secondary, #fff); border-radius: 24px; padding: 30px 20px; width: 90%; max-width: 380px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.4); position: relative;">
            <button onclick="closeAuthScreen()" style="position:absolute; top:12px; right:16px; background:none; border:none; font-size:24px; color:var(--text-secondary, #888); cursor:pointer; line-height:1; padding:4px; z-index:10;">✕</button>
            <div style="font-size:48px; margin-bottom:12px;">🚗</div>
            <h2 style="margin:0 0 8px; font-size:22px; font-weight:700;">Добро пожаловать в ParkNear</h2>
            <p style="color:var(--text-secondary, #666); margin-bottom:20px; font-size:15px;">Войдите через Telegram, чтобы сохранять данные и пользоваться всеми функциями</p>
            <script async src="https://telegram.org/js/telegram-widget.js?24&v=1"
                data-telegram-login="parknear_bot"
                data-size="large"
                data-onauth="onTelegramAuth(user)"
                data-request-access="write">
            <\/script>
            <div style="margin:12px 0; color:var(--text-secondary, #666); font-size:14px;">— или —</div>
            <button class="guest-btn" onclick="continueAsGuest()" style="width:100%; padding:16px; border-radius:14px; border:none; font-size:16px; font-weight:600; cursor:pointer; background:var(--bg-secondary, #fff); color:var(--accent, #007AFF); border:1px solid var(--accent, #007AFF);">Продолжить как гость</button>
        </div>
    `;

    document.body.appendChild(overlay);
    document.getElementById('authOverlay').style.display = 'flex';
}
    function showOnboarding() {
        if (localStorage.getItem('onboardingSeen') === 'true') return;
        isOnboardingActive = true;
        const overlay = document.getElementById('onboardingOverlay');
        overlay.style.display = 'flex';

        function updateProgress(index) {
            const fill = document.getElementById('onboardingProgressFill');
            if (fill) {
                const percent = ((index + 1) / onboardingSlides.length) * 100;
                fill.style.width = percent + '%';
            }
        }

        function removeHighlight() {
            if (highlightedElement) {
                highlightedElement.classList.remove('onboarding-highlight');
                highlightedElement = null;
            }
            if (clickHandlerForHighlight) {
                document.removeEventListener('click', clickHandlerForHighlight, true);
                clickHandlerForHighlight = null;
            }
        }

        function renderSlide(index) {
            const slide = onboardingSlides[index];
            removeHighlight();
            updateProgress(index);

            document.getElementById('onboardingSlide').innerHTML = `
            <div class="onboarding-icon">${slide.icon}</div>
            <div class="onboarding-title">${slide.title}</div>
            <div class="onboarding-text">${slide.text}</div>
        `;

            const dotsContainer = document.getElementById('onboardingDots');
            dotsContainer.innerHTML = onboardingSlides.map((_, i) =>
                `<div class="onboarding-dot ${i === index ? 'active' : ''}"></div>`
            ).join('');

            const nextBtn = document.getElementById('onboardingNext');
            const prevBtn = document.getElementById('onboardingPrev');
            const skipBtn = document.getElementById('onboardingSkip');

            if (slide.requiredAction) {
                nextBtn.style.display = 'none';
                prevBtn.style.display = 'none';
                skipBtn.textContent = 'Пропустить шаг';
                skipBtn.style.display = 'block';

                const selector = slide.highlightSelector;
                if (selector) {
                    const el = document.querySelector(selector);
                    if (el) {
                        el.classList.add('onboarding-highlight');
                        highlightedElement = el;
                        if (clickHandlerForHighlight) {
                            document.removeEventListener('click', clickHandlerForHighlight, true);
                        }
                        clickHandlerForHighlight = function(e) {
                            const target = e.target.closest(selector);
                            if (target) {
                                e.preventDefault();
                                e.stopPropagation();
                                if (index < onboardingSlides.length - 1) {
                                    currentSlide = index + 1;
                                    renderSlide(currentSlide);
                                } else {
                                    finishOnboarding();
                                }
                            }
                        };
                        document.addEventListener('click', clickHandlerForHighlight, true);
                    } else {
                        console.warn('Элемент не найден:', selector);
                        setTimeout(() => {
                            if (index < onboardingSlides.length - 1) {
                                currentSlide = index + 1;
                                renderSlide(currentSlide);
                            } else {
                                finishOnboarding();
                            }
                        }, 2000);
                    }
                }
            } else {
                nextBtn.style.display = 'block';
                prevBtn.style.display = 'block';
                skipBtn.textContent = '✕';
                skipBtn.style.display = 'block';

                nextBtn.textContent = index === onboardingSlides.length - 1 ? 'Понятно' : 'Далее →';
                prevBtn.style.visibility = index === 0 ? 'hidden' : 'visible';
            }
        }
        function finishOnboarding() {
            localStorage.setItem('onboardingSeen', 'true');
            document.getElementById('onboardingOverlay').style.display = 'none';
            removeHighlight();
            isOnboardingActive = false;
            if (typeof showToast === 'function') {
                showToast('🎉 Добро пожаловать! Теперь вы готовы пользоваться ParkNear.', 4000);
            }
        }

        document.getElementById('onboardingNext').onclick = function() {
            if (currentSlide === onboardingSlides.length - 1) {
                finishOnboarding();
            } else {
                currentSlide++;
                renderSlide(currentSlide);
            }
        };

        document.getElementById('onboardingPrev').onclick = function() {
            if (currentSlide > 0) {
                currentSlide--;
                renderSlide(currentSlide);
            }
        };

        document.getElementById('onboardingSkip').onclick = function() {
            finishOnboarding();
        };

        let touchStartX = 0;
        const modal = document.querySelector('#onboardingOverlay > div');
        if (modal) {
            modal.addEventListener('touchstart', function(e) {
                touchStartX = e.changedTouches[0].screenX;
            }, { passive: true });
            modal.addEventListener('touchend', function(e) {
                const diff = touchStartX - e.changedTouches[0].screenX;
                if (Math.abs(diff) > 50) {
                    if (diff > 0 && currentSlide < onboardingSlides.length - 1) {
                        const slide = onboardingSlides[currentSlide];
                        if (!slide.requiredAction) {
                            currentSlide++;
                            renderSlide(currentSlide);
                        }
                    } else if (diff < 0 && currentSlide > 0) {
                        const slide = onboardingSlides[currentSlide];
                        if (!slide.requiredAction) {
                            currentSlide--;
                            renderSlide(currentSlide);
                        }
                    }
                }
            }, { passive: true });
        }

        currentSlide = 0;
        renderSlide(0);
    }
    // ===================== НАСТРОЙКИ =====================
   function syncThemeToggles() {
    const isDark = document.body.classList.contains('dark-theme');
    const toggle1 = document.getElementById('settingsThemeToggle');
    const toggle2 = document.getElementById('settingsThemeToggleInline');
    if (toggle1) toggle1.checked = isDark;
    if (toggle2) toggle2.checked = isDark;
}
     function toggleTheme() {
    var isDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('darkTheme', isDark ? '1' : '0');

    var mapEl = document.getElementById('map');
    if (mapEl && map) {
        var currentType = map.getType ? map.getType() : 'yandex#map';
        if (isDark && currentType === 'yandex#map') {
            mapEl.style.filter = 'invert(0.82) hue-rotate(180deg) brightness(0.95) contrast(0.9) saturate(0.85)';
        } else {
            mapEl.style.filter = 'none';
        }
    }

    var tabBar = document.querySelector('.tabBar');
    if (tabBar) {
        tabBar.style.background = '';
    }

    syncThemeToggles();

    if (window.Telegram && window.Telegram.WebApp) {
        try {
            var tg = window.Telegram.WebApp;
            if (isDark) {
                tg.setHeaderColor('#1C1C1E');
                tg.setBackgroundColor('#000000');
            } else {
                tg.setHeaderColor('#F2F2F7');
                tg.setBackgroundColor('#FFFFFF');
            }
        } catch (e) {}
    }

    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
}
    function updateMapTheme() {
        const mapEl = document.getElementById('map');
        if (!mapEl || !map) return;
        const isDark = document.body.classList.contains('dark-theme');
        const currentType = map.getType ? map.getType() : 'yandex#map';
        if (isDark && currentType === 'yandex#map') {
            mapEl.style.filter = 'invert(0.82) hue-rotate(180deg) brightness(0.95) contrast(0.9) saturate(0.85)';
        } else {
            mapEl.style.filter = 'none';
        }
    }
    function showToast(message, duration = 3000) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-20px)';
        }, duration);
    }
  function loginAsGuest() {
    const userId = 'guest_' + Date.now();
    const user = {
        id: userId,
        username: 'guest',
        firstName: 'Гость',
        photoUrl: '',
        isGuest: true
    };
    currentUser = user;
    localStorage.setItem('tgUser', JSON.stringify(user));
    const userRef = database.ref('users/' + currentUser.id);
    userRef.update({
        username: currentUser.username,
        firstName: currentUser.firstName,
        photoUrl: currentUser.photoUrl,
        lastActive: Date.now()
    }).catch(console.error);

    userRef.child('stats').set({
        registeredAt: Date.now(),
        lastActive: Date.now(),
        parkingsCreated: 0,
        parkingsUpdated: 0,
        confirmations: 0,
        views: 0,
        favorites: 0,
        activeDates: [new Date().toISOString().split('T')[0]]
    }).catch(console.error);

    hideAuthScreen();
    showPanel('home');
    showOnboarding();
}
   function renderHomePanel(content) {
    const cached = localStorage.getItem('parkingCache');
    let cacheData = null;
    if (cached) {
        try {
            const cache = JSON.parse(cached);
            // ✅ Проверяем, что кеш соответствует текущему городу
            if (cache && cache.data) {
                cacheData = cache.data;
                parkingDataCache = cacheData;
                renderHomeContent(content, null);
                const list = document.getElementById('homeParkingList');
                if (list) {
                    list.insertAdjacentHTML('beforeend', '<div class="loading-indicator" style="text-align:center; color:var(--text-secondary); font-size:13px; margin-top:8px;">🔄 Обновление данных...</div>');
                }
            } else {
                // Если город не совпадает – удаляем устаревший кеш
                localStorage.removeItem('parkingCache');
                console.log('🗑️ Удалён устаревший кеш парковок');
            }
        } catch (e) {
            localStorage.removeItem('parkingCache');
        }
    }

    if (!cacheData) {
        content.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Загрузка парковок...</p></div>';
    }

    const needRefresh = (Date.now() - lastDataRefresh > REFRESH_INTERVAL_MS) || !cacheData;
    if (needRefresh) {
        // ✅ Передаём текущий город
        Promise.all([
            loadAllParkings(currentCity, true),
            getUserLocation().catch(() => null)
        ]).then(([, coords]) => {
            userLocationForSearch = coords;
            renderHomeContent(content, coords);
            const indicator = document.querySelector('.loading-indicator');
            if (indicator) indicator.remove();
            console.log('🏠 На главной загружено парковок:', Object.keys(parkingDataCache).length);
        }).catch((err) => {
            console.error('Ошибка загрузки парковок:', err);
            const indicator = document.querySelector('.loading-indicator');
            if (indicator) indicator.textContent = '⚠️ Не удалось обновить данные';
            setTimeout(() => { if (indicator) indicator.remove(); }, 3000);
            renderHomeContent(content, null);
        });
    } else {
        getUserLocation()
            .then(coords => {
                userLocationForSearch = coords;
                renderHomeContent(content, coords);
            })
            .catch(() => {
                renderHomeContent(content, null);
            });
    }
}
function renderHomeContent(content, coords) {
    var html = `
        <div class="home-header">
            <div class="home-title">Парковка без забот</div>
            <div class="home-subtitle">найдите свободное место рядом с домом</div>
        </div>
        <div class="home-search">
            <input type="text" id="homeSearchInput" placeholder="куда вы направляетесь?" oninput="filterHomeParkings()">
        </div>
        <div class="home-actions">
            <button class="btn-home btn-home-primary" onclick="goHome()">🏠 Еду домой</button>
            <button class="btn-home btn-home-secondary" onclick="searchNearMe()">📍 Рядом со мной</button>
        </div>
        <div class="section-header">
            <span>Рядом с вами</span>
            <button class="see-all" onclick="showAllNearby()">См. все</button>
        </div>
        <div id="homeParkingList" class="parking-list">
            <div class="loading-state"><div class="spinner"></div><p>Загрузка...</p></div>
        </div>
    `;
    content.innerHTML = html;

    // Получаем список парковок из кеша
    var allParkings = Object.values(parkingDataCache).filter(function(p) { return p.lat && p.lng; });
    console.log('📊 Всего парковок в кеше:', allParkings.length);
    // Если данных нет – показываем сообщение
    if (allParkings.length === 0) {
        var container = document.getElementById('homeParkingList');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>😕 Нет парковок в городе <strong>${currentCity || 'не выбран'}</strong></p>
                    <p style="font-size:13px; margin-top:8px; color:var(--text-secondary);">
                        Попробуйте изменить город в настройках профиля
                    </p>
                </div>
            `;
        }
        return;
    }

    // Если координаты есть – показываем ближайшие
    if (coords) {
        showNearbyParkings(coords, 5);
    } else {
        // Иначе показываем все (без сортировки по расстоянию)
        var container = document.getElementById('homeParkingList');
        if (container) {
            renderParkingList(container, allParkings);
        }
    }
}
function showNearbyParkings(coords, limit) {
    const container = document.getElementById('homeParkingList');
    if (!container) return;
    const radius = 1000;
    const parkings = Object.entries(parkingDataCache)
        .map(([id, data]) => ({ id, ...data, distance: getDistanceInMeters(coords.lat, coords.lng, data.lat, data.lng) }))
        .filter(p => p.lat && p.lng && p.distance <= radius)
        .sort((a,b) => a.distance - b.distance);

    if (parkings.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Нет парковок поблизости</p></div>';
        return;
    }
    const show = parkings.slice(0, limit);
    container.innerHTML = show.map(p => renderParkingItem(p, coords)).join('');
}
function showAllNearby() {
    var coords = userLocationForSearch;
    if (!coords) {
        alert('Геолокация не определена');
        return;
    }
    var container = document.getElementById('homeParkingList');
    if (container) {
        showNearbyParkings(coords, 9999);
        var seeAll = document.querySelector('.section-header .see-all');
        if (seeAll) {
            seeAll.textContent = 'Скрыть';
            seeAll.onclick = function() {
                showNearbyParkings(coords, 5);
                this.textContent = 'См. все →';
                this.onclick = showAllNearby;
            };
        }
    }
}
function filterHomeParkings() {
    const query = document.getElementById('homeSearchInput').value.trim().toLowerCase();
    const container = document.getElementById('homeParkingList');
    if (!container) return;
    if (!query) {
        if (userLocationForSearch) {
            showNearbyParkings(userLocationForSearch, 5);
        } else {
            const all = Object.values(parkingDataCache).filter(p => p.lat && p.lng);
            renderParkingList(container, all);
        }
        return;
    }
    const filtered = Object.entries(parkingDataCache)
        .map(([id, data]) => ({ id, ...data }))
        .filter(p => {
            const name = (p.name || '').toLowerCase();
            const addr = (p.address || '').toLowerCase();
            return name.includes(query) || addr.includes(query);
        });
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Ничего не найдено</p></div>';
        return;
    }
    container.innerHTML = filtered.map(p => renderParkingItem(p, userLocationForSearch)).join('');
}
function goHome() {
    if (!currentUser) {
        alert('Войдите, чтобы использовать домашний адрес');
        return;
    }
    database.ref('users/' + currentUser.id + '/homeAddresses').once('value')
        .then(function(snap) {
            var addrs = snap.val() || {};
            var home = null;
            for (var key in addrs) {
                if (addrs.hasOwnProperty(key) && addrs[key].label === 'Дом') {
                    home = addrs[key];
                    break;
                }
            }
            if (!home) {
                alert('Домашний адрес не найден. Добавьте его в избранном.');
                return;
            }
            if (home.lat && home.lng) {
                map.setCenter([home.lat, home.lng], 16, { duration: 500 });
                var coords = { lat: home.lat, lng: home.lng };
                userLocationForSearch = coords;
                var container = document.getElementById('homeParkingList');
                if (container) {
                    showNearbyParkings(coords, 5);
                }
            } else {
                alert('У домашнего адреса нет координат. Добавьте адрес через карту.');
            }
        })
        .catch(function(err) { alert('Ошибка: ' + err.message); });
}
// Вспомогательная функция для отображения списка парковок
function renderParkingList(container, parkings) {
    if (!parkings || parkings.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Нет парковок</p></div>';
        return;
    }
    container.innerHTML = parkings.map(p => renderParkingItem(p, userLocationForSearch)).join('');
}
    // ===================== ИНИЦИАЛИЗАЦИЯ =====================
   // Проверяем URL на наличие данных авторизации от Telegram (редирект)
function checkTelegramAuthFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const authData = urlParams.get('tg_auth_data');
    if (authData) {
        try {
            const userData = JSON.parse(decodeURIComponent(authData));
            if (userData.id) {
                onTelegramAuth(userData);
                // Очищаем URL от параметров
                window.history.replaceState({}, document.title, window.location.pathname);
                return true;
            }
        } catch (e) {
            console.warn('Ошибка разбора данных авторизации:', e);
        }
    }
    return false;
}
// ===================== АВТОРИЗАЦИЯ ЧЕРЕЗ TELEGRAM =====================

function onTelegramAuth(user) {
    try {
        currentUser = {
            id: 'tg_' + user.id,
            username: user.username || 'tg_user',
            firstName: user.first_name || 'Пользователь',
            photoUrl: user.photo_url || '',
            isGuest: false
        };
        localStorage.setItem('tgUser', JSON.stringify(currentUser));

        const userRef = database.ref('users/' + currentUser.id);
        userRef.update({
            username: currentUser.username,
            firstName: currentUser.firstName,
            photoUrl: currentUser.photoUrl,
            lastActive: Date.now()
        }).catch(console.error);

        // ФИКС: было once('value').then(...set(...)) — гонка при двойном
        // вызове onTelegramAuth могла обнулить уже накопленную статистику.
        // transaction() гарантирует, что начальные данные создадутся только
        // один раз, даже при параллельных вызовах.
        userRef.child('stats').transaction(current => {
            if (current) {
                // статистика уже есть — эту ветку used only чтобы обновить lastActive ниже
                return current;
            }
            return {
                registeredAt: Date.now(),
                lastActive: Date.now(),
                parkingsCreated: 0,
                parkingsUpdated: 0,
                confirmations: 0,
                views: 0,
                favorites: 0,
                activeDates: [new Date().toISOString().split('T')[0]]
            };
        }).then(() => {
            // lastActive обновляем отдельной лёгкой записью, не пересоздавая всю статистику
            userRef.child('stats/lastActive').set(Date.now()).catch(console.error);
        }).catch(console.error);

        hideAuthScreen();
        showPanel('home');
        showOnboarding();
        console.log('✅ Пользователь авторизован:', user.first_name);
    } catch (e) {
        console.error('❌ Ошибка в onTelegramAuth:', e);
        continueAsGuest();
    }
}

function initApp() {
    if (checkTelegramAuthFromUrl()) {
        showPanel('home');
    } else {
        initAuth();
    }

    const savedCity = localStorage.getItem('parknear_city');
    if (savedCity) {
        try {
            const prefs = JSON.parse(savedCity);
            userCityPrefs = prefs;
            const savedCoords = localStorage.getItem('parknear_city_coords');
            if (savedCoords) {
                cityCoords = JSON.parse(savedCoords);
            }
            updateCityDisplay();
        } catch (e) {
            console.warn('Ошибка восстановления города:', e);
        }
    }

    document.getElementById('addBtn').onclick = function() {
        if (!currentUser) showPanel('home');
        else if (isDrawingMode) cancelDrawing();
        else startDrawingMode();
    };

    if (!map) {
        initMap();
    }

    if ('serviceWorker' in navigator) {
      
        const swScope = new URL('.', window.location.href).pathname;
        navigator.serviceWorker.register(swScope + 'sw.js', { scope: swScope })
            .then(registration => {
                console.log('✅ Service Worker зарегистрирован:', registration.scope);
            })
            .catch(error => {
                console.error('❌ Ошибка регистрации Service Worker:', error);
            });
    }

    loadAllParkings();
    initPullToRefresh();
    if (currentUser) {
        showPanel('home');
    }
    if (map && cityCoords) {
        map.setCenter([cityCoords.lat, cityCoords.lng], 12, { duration: 300 });
    }
}

function openTelegramBot() {
    console.log('openTelegramBot вызвана');

    if (window.Telegram && window.Telegram.WebApp) {
        var webApp = window.Telegram.WebApp;
        if (webApp.initDataUnsafe && webApp.initDataUnsafe.user) {
            var user = webApp.initDataUnsafe.user;
            var expectedId = 'tg_' + user.id;
            var savedUserRaw = localStorage.getItem('tgUser');
            var savedUser = null;
            try {
                savedUser = savedUserRaw ? JSON.parse(savedUserRaw) : null;
            } catch (e) {
                savedUser = null;
            }

            if (!savedUser || savedUser.id !== expectedId) {
                onTelegramAuth({
                    id: user.id,
                    first_name: user.first_name,
                    last_name: user.last_name || '',
                    username: user.username || '',
                    photo_url: user.photo_url || '',
                    auth_date: Math.floor(Date.now() / 1000),
                    hash: webApp.initDataUnsafe.hash || ''
                });
            } else {
                console.log('👤 Пользователь уже залогинен');
                hideAuthScreen();
                showPanel('home');
            }
            return;
        }
        webApp.openTelegramLink('https://t.me/parknear_bot');
        return;
    }
    window.open('https://t.me/parknear_bot', '_blank');
}
function closeAuthScreen() {
    const overlay = document.getElementById('authOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        if (!currentUser && localStorage.getItem('tgUser')) {
            initAuth();
        }
    }
});

    function rebuildRoute() {
        if (!routeStartCoords || !routeEndCoords) {
            alert('Сначала постройте маршрут');
            return;
        }
        if (currentRoute) {
            map.geoObjects.remove(currentRoute);
            currentRoute = null;
        }
        var mode = document.getElementById('routeTypeSelect')?.value || 'driving';
        try {
            currentRoute = new ymaps.multiRouter.MultiRoute({
                referencePoints: [routeStartCoords, routeEndCoords],
                params: { mode: mode, avoidTrafficJams: false, results: 1 }
            }, {
                routeStrokeColor: '#2B7574',
                routeStrokeWidth: 5,
                routeStrokeOpacity: 0.8,
                animation: false
            });
            map.geoObjects.add(currentRoute);
            updateRouteInfoFromMultiRoute(currentRoute);
            map.setBounds(currentRoute.getBounds(), { duration: 300 });
        } catch (e) {
            console.error('Ошибка перестроения:', e);
            alert('Не удалось перестроить маршрут');
        }
    }
    function editCarDataFromSettings() {
        // Заполняем поля и открываем редактор
        if (!currentUser) return;
        const car = currentUser.car || {};
        const overlay = document.getElementById('carEditorOverlay');

        // Заполняем марки
        const brandSelect = document.getElementById('carBrandSelect');
        brandSelect.innerHTML = '<option value="">Выберите марку</option>';
        Object.keys(carBrands).sort().forEach(b => {
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = b;
            if (b === car.brand) opt.selected = true;
            brandSelect.appendChild(opt);
        });
        updateCarModelSelect();

        // Устанавливаем значения
        if (car.model) {
            const modelSelect = document.getElementById('carModelSelect');
            for (let opt of modelSelect.options) {
                if (opt.value === car.model) { opt.selected = true; break; }
            }
        }
        document.getElementById('carColorSelect').value = car.color || '';
        document.getElementById('carPlateInput').value = car.plate || '';

        overlay.classList.add('active');
    }
    function updateCarModelSelect() {
        const brand = document.getElementById('carBrandSelect').value;
        const modelSelect = document.getElementById('carModelSelect');
        modelSelect.innerHTML = '<option value="">Выберите модель</option>';
        if (brand && carBrands[brand]) {
            carBrands[brand].forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                modelSelect.appendChild(opt);
            });
        }
    }
    function closeCarEditor() {
        document.getElementById('carEditorOverlay').classList.remove('active');
    }
    function editNickname() {
        const currentNick = currentUser.nickname || '';
        const newNick = prompt('Введите новый никнейм:', currentNick);
        if (newNick !== null && newNick.trim() !== '') {
            saveNickname(newNick.trim());
        }
    }
    function resetOnboarding() {
        localStorage.removeItem('onboardingSeen');
        showOnboarding();
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
    }
    // Заполняем цвета для редактора автомобиля
    (function initCarColors() {
        const colorSelect = document.getElementById('carColorSelect');
        if (colorSelect) {
            colorSelect.innerHTML = '<option value="">Выберите цвет</option>';
            Object.keys(carColors).forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                opt.style.background = carColors[c];
                opt.style.color = ['#FFFFFF', '#000000'].includes(carColors[c]) ? '#fff' : '#000';
                colorSelect.appendChild(opt);
            });
        }
    })();
    console.log('✅ ParkNear загружен. Код исправлен.');
