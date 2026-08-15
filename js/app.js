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
        const isDark = (darkTheme === '1');
        if (isDark) {
            document.body.classList.add('dark-theme');
            
            // Накладываем фильтр только на тайлы карты, чтобы не инвертировать цвета маркеров
            const mapStyle = document.createElement('style');
            mapStyle.id = 'dark-map-style';
            mapStyle.innerHTML = `
                .dark-theme #map .ymaps-2-1-game-layer,
                .dark-theme #map [class*="ymaps-2-1-17-events-pane"] {
                    filter: invert(0.9) hue-rotate(180deg) brightness(0.9) contrast(0.9) saturate(0.8) !important;
                }
            `;
            document.head.appendChild(mapStyle);

            if (window.Telegram && window.Telegram.WebApp) {
                try {
                    window.Telegram.WebApp.setHeaderColor('#1C1C1E');
                    window.Telegram.WebApp.setBackgroundColor('#000000');
                } catch(e) {}
            }
        }
        var toggle1 = document.getElementById('settingsThemeToggle');
        var toggle2 = document.getElementById('settingsThemeToggleInline');
        if (toggle1) toggle1.checked = isDark;
        if (toggle2) toggle2.checked = isDark;
    })();
    // ===================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====================
    let map = null;
    let currentUser = null;
    let lastKnownLocation = null;
    let mapMarkers = {};
    let myLocationPlacemark = null;
    let addressPreviewMarker = null;
    let _parkingFormCoords = null;
    let _parkingFormSizeCheck = null;
    let drawingPolygon = null;
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
    let nearbySearchFilter = null;
    let userLocationForSearch = null;
    let pendingAddressData = null;
    let newParkingCoords = null;

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
    if (total === 0) return '#0A282C';
    const ratio = occupied / total;
    return (ratio < 0.5) ? '#2B7574' : (document.body.classList.contains('dark-theme') ? '#861211' : '#0E2931');
}
   function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
    function getOccupancyDotColor(free, total) {
        if (total === 0) return 'var(--gray)';
        const ratio = free / total;
        if (ratio >= 0.5) return 'var(--green)';
        if (ratio >= 0.2) return 'var(--orange)';
        return 'var(--red)';
    }
    function getDistanceInMeters(lat1, lng1, lat2, lng2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI /
            180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    function renderParkingItem(parking, userCoords) {
    const free = parking.totalSpots - (parking.occupiedSpots || 0);
    const total = parking.totalSpots || 0;
    const ratio = total > 0 ? free / total : 1;
    let badgeClass = '';
    if (ratio <= 0.2) badgeClass = 'critical';
    else if (ratio <= 0.5) badgeClass = 'low';
    let badgeText = free;
    if (total === 0) badgeText = '?';

    let distanceHtml = '';
    if (userCoords && parking.lat && parking.lng) {
        const dist = getDistanceInMeters(userCoords.lat, userCoords.lng, parking.lat, parking.lng);
        const distStr = dist < 1000 ? Math.round(dist) + ' м' : (dist/1000).toFixed(1) + ' км';
        const time = Math.round(dist / 500); // 30 км/ч
        const timeStr = time < 1 ? '<1 мин' : time + ' мин';
        distanceHtml = `<div class="meta-row"><span>${distStr}</span><span class="dot">·</span><span>${timeStr}</span></div>`;
    }

    return `
        <div class="parking-item" onclick="focusMap(${parking.lat}, ${parking.lng}, '${parking.id}')">
            <div class="info">
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div class="name">${escapeHtml(parking.name || 'Без названия')}</div>
                    <span class="free-badge ${badgeClass}">${badgeText}</span>
                </div>
                ${distanceHtml}
            </div>
        </div>
    `;
}

    function formatDateTime(timestamp) {
        if (!timestamp) return 'Неизвестно';
        const d = new Date(timestamp);
        return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    }

    function checkPolygonSize(coordinates) {
        if (!coordinates || coordinates.length < 3) return { valid: false, error: 'Минимум 3 точки' };
        const lats = coordinates.map(c => c[0]),
            lngs = coordinates.map(c => c[1]);
        const minLat = Math.min(...lats),
            maxLat = Math.max(...lats),
            minLng = Math.min(...lngs),
            maxLng = Math.max(...lngs);
        const widthM = getDistanceInMeters(minLat, minLng, minLat, maxLng),
            lengthM = getDistanceInMeters(minLat, minLng, maxLat, minLng);
        if (widthM > MAX_ZONE_WIDTH || lengthM > MAX_ZONE_LENGTH) return { valid: false,
            error: `Зона слишком большая! Максимум ${MAX_ZONE_WIDTH}×${MAX_ZONE_LENGTH}м. Сейчас: ${Math.round(widthM)}×${Math.round(lengthM)}м` };
        return { valid: true, width: widthM, length: lengthM };
    }
    // ===================== РАСЧЁТ ПЛОЩАДИ И МЕСТ =====================
function calculateParkingSpots(coordinates) {
    if (!coordinates || coordinates.length < 3) return 0;

    // Переводим координаты в метры относительно первой точки
    const firstLat = coordinates[0][0];
    const firstLng = coordinates[0][1];
    const pointsInMeters = coordinates.map(([lat, lng]) => {
        // 1 градус широты ≈ 111320 м
        const dy = (lat - firstLat) * 111320;
        // 1 градус долготы зависит от широты: cos(lat) * 111320
        const dx = (lng - firstLng) * 111320 * Math.cos(firstLat * Math.PI / 180);
        return { x: dx, y: dy };
    });

    // Вычисляем площадь по формуле шнурка (Shoelace formula)
    let area = 0;
    const n = pointsInMeters.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += pointsInMeters[i].x * pointsInMeters[j].y;
        area -= pointsInMeters[j].x * pointsInMeters[i].y;
    }
    area = Math.abs(area) / 2; // площадь в м²

    // Средняя площадь одного машино-места с учётом проездов (≈15 м²)
    const avgSpotArea = 15;
    const spots = Math.floor(area / avgSpotArea);
    return Math.max(0, spots);
}

    function parseAddress(fullAddress) {
        if (!fullAddress) return { region: '', city: '', street: '', houseNumber: '' };
        let addr = fullAddress.replace(/^Россия,\s*/i, '');
        let region = '',
            city = '',
            street = '',
            houseNumber = '';
        const houseMatch = addr.match(/\b(?:д(?:ом)?\.?\s*)?(\d+[а-я]?(?:\s*\/\s*\d+)?(?:\s*[кк]\.?\s*\d+)?)\b/i);
        if (houseMatch) {
            houseNumber = houseMatch[1].trim();
            addr = addr.replace(houseMatch[0], '').trim();
        }
        for (const reg of Object.keys(regionsData)) {
            if (addr.includes(reg)) { region = reg; break; }
        }
        if (region) {
            const cities = regionsData[region];
            for (const c of cities) {
                if (addr.includes(c)) { city = c; break; }
            }
            if (!city && cities.includes(region)) city = region;
        } else {
            for (const reg of Object.keys(regionsData)) {
                const cities = regionsData[reg];
                for (const c of cities) {
                    if (addr.includes(c)) { region = reg;
                        city = c; break; }
                }
                if (region) break;
            }
        }
        let streetPart = addr;
        if (region) streetPart = streetPart.replace(new RegExp(region, 'i'), '').trim();
        if (city && city !== region) streetPart = streetPart.replace(new RegExp(city, 'i'), '').trim();
        streetPart = streetPart.replace(/^[, ]+/, '').replace(/[, ]+$/, '');
        street = streetPart;
        return { region, city, street, houseNumber };
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
        if (!navigator.geolocation) {
            return reject(new Error('Геолокация не поддерживается вашим устройством'));
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            },
            (error) => reject(error),
            {
                enableHighAccuracy: true,
                timeout: 7000,      // Ждем максимум 7 секунд
                maximumAge: 60000   // Кэшируем позицию на 1 минуту
            }
        );
    });
}
function tryYandexGeolocation(resolve, reject) {
    if (typeof ymaps !== 'undefined' && ymaps.geolocation) {
        ymaps.geolocation.get({ provider: 'browser', timeout: 10000 })
            .then(function(result) {
                var coords = result.geoObjects.get(0).geometry.getCoordinates();
                var location = { lat: coords[0], lng: coords[1] };
                lastKnownLocation = location;
                console.log('✅ Геолокация получена через Яндекс:', location);
                resolve(location);
            })
            .catch(function(err) {
                console.error('❌ Яндекс.Геолокация не удалась:', err);
                reject(new Error('Геолокация недоступна'));
            });
    } else {
        // Ни один метод не сработал
        reject(new Error('Геолокация не поддерживается браузером'));
    }
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
    function loadAllParkings(force = false) {
    // Если данные уже есть и не прошло 30 секунд – не перезагружаем
    if (!force && Date.now() - lastDataRefresh < 30000 && Object.keys(parkingDataCache).length > 0) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        if (map) {
            Object.keys(mapMarkers).forEach(id => {
                if (mapMarkers[id]) {
                    map.geoObjects.remove(mapMarkers[id]);
                    delete mapMarkers[id];
                }
            });
        }
        database.ref('parkings').once('value').then(snapshot => {
            const data = snapshot.val();
            const newCache = {};
            if (data) {
                const cityFilter = userCityPrefs.city ? userCityPrefs.city.toLowerCase() : '';
                Object.keys(data).forEach(key => {
                    const p = data[key];
                    if (p && p.lat && p.lng) {
                        if (cityFilter) {
                            const pCity = (p.city || '').toLowerCase();
                            const pAddr = (p.address || '').toLowerCase();
                            const pName = (p.name || '').toLowerCase();
                            if (!pCity.includes(cityFilter) && !pAddr.includes(cityFilter) && !pName.includes(cityFilter)) {
                                return;
                            }
                        }
                        newCache[key] = p;
                        if (map) addMarkerToMap(key, p);
                    }
                });
            }
            parkingDataCache = newCache;
            lastDataRefresh = Date.now();
            // Сохраняем в localStorage для офлайн-доступа
            try {
                localStorage.setItem('parkingCache', JSON.stringify(newCache));
            } catch(e) {}
            resolve();
        }).catch(error => {
            // Если не удалось загрузить, пробуем взять из localStorage
            const cached = localStorage.getItem('parkingCache');
            if (cached) {
                try {
                    parkingDataCache = JSON.parse(cached);
                    if (map) {
                        Object.values(parkingDataCache).forEach(p => addMarkerToMap(p.id || p.key, p));
                    }
                    resolve();
                } catch(e) { reject(error); }
            } else {
                reject(error);
            }
        });
    });
}
    function refreshParkingMarker() {
        if (!currentParkingId) return;
        database.ref(`parkings/${currentParkingId}`).once('value').then(snapshot => {
            const data = snapshot.val();
            if (mapMarkers[currentParkingId]) {
                map.geoObjects.remove(mapMarkers[currentParkingId]);
                delete mapMarkers[currentParkingId];
            }
            parkingDataCache[currentParkingId] = data;
            addMarkerToMap(currentParkingId, data);
        });
    }

    function addMarkerToMap(id, data) {
    if (mapMarkers[id]) {
        map.geoObjects.remove(mapMarkers[id]);
        delete mapMarkers[id];
    }
    if (!map) return;

    var totalSpots = data.totalSpots || 0;
    var occupiedSpots = data.occupiedSpots || 0;
    var freeSpots = totalSpots - occupiedSpots;
    var color = getOccupancyColor(occupiedSpots, totalSpots);

    var placemark;
    if (data.coordinates && Array.isArray(data.coordinates) && data.coordinates.length >= 3) {
        placemark = new ymaps.Polygon([data.coordinates], {
            hintContent: data.name
        }, {
            fillColor: color + '55',
            strokeColor: color,
            strokeWidth: 2,
            balloon: { enabled: false }
        });
    } else {
        placemark = new ymaps.Placemark([data.lat, data.lng], {
            hintContent: data.name
        }, {
            preset: 'islands#blueParkingIcon',
            balloon: { enabled: false }
        });
    }

    placemark.events.add('click', function(e) {
        openCenterSheet(id, data);
        if (map.balloon) map.balloon.close();
    });

    map.geoObjects.add(placemark);
    mapMarkers[id] = placemark;
}

    // ===================== ИНИЦИАЛИЗАЦИЯ КАРТЫ =====================
    function initMap() {
        console.log('Инициализация карты...');
        map = new ymaps.Map("map", { center: [55.7558, 37.6173], zoom: 14, controls: ['zoomControl'],
            type: 'yandex#map' });
        console.log('Карта инициализирована');
        document.getElementById('addBtn').onclick = () => { if (!currentUser) showPanel('home');
            else if (isDrawingMode) cancelDrawing();
            else startDrawingMode(); };

        const layerBtn = document.getElementById('layerSwitcher');
        let pressTimer = null;

        function showLayerMenu() {
            document.getElementById('layerMenu').classList.add('active');
        }

        layerBtn.addEventListener('mousedown', function(e) {
            pressTimer = setTimeout(() => {
                showLayerMenu();
                pressTimer = null;
            }, 500);
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
                document.querySelectorAll('.layer-option').forEach(o => o.classList.remove('selected'));
                document.querySelector(`.layer-option[data-type="${nextType}"]`).classList.add('selected');
                updateMapTheme();
            }
        });

        layerBtn.addEventListener('touchstart', function(e) {
            pressTimer = setTimeout(() => {
                showLayerMenu();
                pressTimer = null;
            }, 500);
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
                document.querySelectorAll('.layer-option').forEach(o => o.classList.remove('selected'));
                document.querySelector(`.layer-option[data-type="${nextType}"]`).classList.add('selected');
                updateMapTheme();
            }
        });

        document.getElementById('geoBtn').onclick = () => {
            if (!map) return;
            const btn = document.getElementById('geoBtn');
            const originalContent = btn.innerHTML;
            btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></div>';
            getUserLocation().then(coords => {
                btn.innerHTML = originalContent;
                if (myLocationPlacemark) map.geoObjects.remove(myLocationPlacemark);
                myLocationPlacemark = new ymaps.Placemark([coords.lat, coords.lng], { hintContent: 'Вы здесь',
                    balloonContent: '<strong>Ваше местоположение</strong>' }, { preset: 'islands#blueCircleDotIconWithCaption' });
                myLocationPlacemark.properties.set('caption', 'Вы здесь');
                map.geoObjects.add(myLocationPlacemark);
                map.setCenter([coords.lat, coords.lng], 16, { duration: 500 });
                if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback
                    .notificationOccurred('success');
            }).catch(err => {
                btn.innerHTML = originalContent;
                console.error("Ошибка геолокации:", err);
                let message = 'Не удалось определить местоположение.';
                if (window.Telegram?.WebApp) message += ' Проверьте настройки геолокации.';
                if (window.Telegram?.WebApp?.showAlert) window.Telegram.WebApp.showAlert(message);
                else alert(message);
            });
        };

        loadAllParkings();

        setTimeout(() => {
            getUserLocation().then(coords => {
                if (myLocationPlacemark) map.geoObjects.remove(myLocationPlacemark);
                myLocationPlacemark = new ymaps.Placemark([coords.lat, coords.lng], { hintContent: 'Вы здесь' }, { preset: 'islands#blueCircleDotIconWithCaption' });
                myLocationPlacemark.properties.set('caption', 'Вы здесь');
                map.geoObjects.add(myLocationPlacemark);
                map.setCenter([coords.lat, coords.lng], 14, { duration: 500 });
            }).catch(() => console.log('Автогеолокация не удалась'));
        }, 1000);
        setTimeout(() => {
    const splash = document.getElementById('splashScreen');
    if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => splash.remove(), 300);
    }
}, 5000);
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
    // Удаляем старые кнопки, если они есть
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

    // Создаём кнопки управления над таббаром
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

    // Сохраняем черновик
    _parkingFormCoords = newParkingCoords;
    _parkingFormSizeCheck = sizeCheck;

    // Меняем кнопки: "Готова" (открывает форму) и "Отменить"
    const controls = document.getElementById('drawingControls');
    if (controls) {
        controls.innerHTML = `
            <button class="btn-finish" onclick="openParkingForm()">✅ Готова</button>
            <button class="btn-cancel" onclick="cancelDrawing()">✕ Отменить</button>
        `;
    }

    document.getElementById('addBtn').classList.remove('drawing');
    document.getElementById('addBtn').textContent = '✕';
    isDrawingMode = false;

    // Показываем тост с подсказкой о количестве мест
    const spots = calculateParkingSpots(newParkingCoords);
    if (spots > 0) {
        showToast(`🚗 Примерно ${spots} машино-мест в этой зоне`, 3000);
    } else {
        showToast('⚠️ Зона слишком мала для парковки', 2000);
    }
}
function openParkingForm() {
    if (!_parkingFormCoords) {
        showToast('Сначала нарисуйте зону парковки', 2000);
        return;
    }
    const panel = document.getElementById('panel');
    if (panel.classList.contains('active')) {
        closePanel();
        setTimeout(() => {
            openAddPanelWithPolygon(_parkingFormCoords, _parkingFormSizeCheck);
        }, 300);
    } else {
        openAddPanelWithPolygon(_parkingFormCoords, _parkingFormSizeCheck);
    }
}
    function cancelDrawing() {
    if (editingPolygon) {
        map.geoObjects.remove(editingPolygon);
        editingPolygon = null;
        if (originalPolyCoords && currentParkingId) {
            addMarkerToMap(currentParkingId, { ...currentParkingData, coordinates: originalPolyCoords });
        }
        const controls = document.getElementById('drawingControls');
        if (controls) controls.remove();
        document.getElementById('addBtn').classList.remove('drawing');
        document.getElementById('addBtn').textContent = '+';
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
    document.getElementById('addBtn').classList.remove('drawing');
    document.getElementById('addBtn').textContent = '+';
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
    document.getElementById('panel').classList.add('active');
    document.getElementById('panelTitle').textContent = 'Новая парковка';

    // Вычисляем примерное количество мест до рендера HTML
    const suggestedSpots = calculateParkingSpots(coordinates);
    const spotsPlaceholder = suggestedSpots > 0 ? `Например: ${suggestedSpots}` : 'Например: 10';

    document.getElementById('panelContent').innerHTML = `
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
    <input type="number" id="parkSpots" class="input-field" placeholder="Например: 10" min="1" max="500">
    <small style="color:var(--text-secondary); font-size:12px; display:block; margin-top:4px;">
        Автоматически рассчитано по площади зоны (можно изменить)
    </small>
</div>
        <button class="btn-primary" id="saveParkBtn" onclick="submitParkingWithPolygon()">Сохранить парковку</button>
        <button class="btn-secondary" onclick="cancelDrawing(); closePanel();">Отмена</button>
    `;
    setTimeout(() => {
        initMiniMap(coordinates);
        // Автозаполнение адреса по координатам
        if (coordinates && coordinates.length > 0) {
            const center = coordinates[0];
            ymaps.geocode(center, { results: 1 }).then(res => {
                const geo = res.geoObjects.get(0);
                if (geo) {
                    const address = geo.getAddressLine();
                    const parsed = parseAddress(address);
                    const streetInput = document.getElementById('parkStreetName');
                    const houseInput = document.getElementById('parkHouseNumber');
                    if (streetInput) streetInput.value = parsed.street || '';
                    if (houseInput) houseInput.value = parsed.houseNumber || '';
                }
            }).catch(err => console.warn('Геокодирование не удалось:', err));
        }
    }, 50);
}

    function initMiniMap(coords) {
        if (!coords || coords.length < 3) return;

        const container = document.getElementById('miniMapContainer');
        if (!container) return;

        const miniMap = new ymaps.Map(container, {
            center: coords[0],
            zoom: 17,
            controls: []
        });

        const polygon = new ymaps.Polygon([coords], {}, {
            fillColor: '#2B757433',
            strokeColor: '#2B7574',
            strokeWidth: 2
        });
        miniMap.geoObjects.add(polygon);
        miniMap.setBounds(polygon.geometry.getBounds(), { checkZoomRange: true });
    }

    function submitParkingWithPolygon() {
        const streetType = document.getElementById('parkStreetType').value;
        const streetName = document.getElementById('parkStreetName').value.trim();
        const houseNumber = document.getElementById('parkHouseNumber').value.trim();
        const totalSpots = parseInt(document.getElementById('parkSpots').value);

        if (!currentUser) { alert('Ошибка: пользователь не авторизован'); return; }
        if (!totalSpots || totalSpots < 1) { alert('Пожалуйста, укажите количество парковочных мест'); return; }
        if (!streetType && !streetName && !houseNumber) {
            alert('Введите хотя бы улицу или номер дома');
            return;
        }

        let coordsToSave = window.newParkingCoords;
        if (!coordsToSave && drawingPolygon && drawingPolygon.geometry) {
            const raw = drawingPolygon.geometry.getCoordinates()[0];
            coordsToSave = raw.map(c => [parseFloat(c[0]), parseFloat(c[1])]);
        }
        if (!coordsToSave || coordsToSave.length < 3) {
            alert('Ошибка: координаты зоны не найдены. Нарисуйте заново.');
            return;
        }

        const btn = document.getElementById('saveParkBtn');
        btn.textContent = 'Сохранение...';
        btn.disabled = true;

        const centerLat = coordsToSave.reduce((s, c) => s + c[0], 0) / coordsToSave.length;
        const centerLng = coordsToSave.reduce((s, c) => s + c[1], 0) / coordsToSave.length;

        const fullStreet = streetType && streetName ? `${streetType} ${streetName}` : (streetName || '');
        let name = fullStreet;
        if (houseNumber) {
            name = name ? `${name}, ${houseNumber}` : houseNumber;
        }
        if (!name) {
            name = `${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}`;
        }

        ymaps.geocode([centerLat, centerLng], { kind: 'locality', results: 1 })
            .then(res => {
                const geo = res.geoObjects.get(0);
                let address = geo ? geo.getAddressLine() : '';
                if (address.length > 80) address = address.substring(0, 77) + '...';
                const parsed = parseAddress(address);
                if (fullStreet) parsed.street = fullStreet;
                if (houseNumber) parsed.houseNumber = houseNumber;
                if (!parsed.city && userCityPrefs.region && userCityPrefs.city) {
                    parsed.region = userCityPrefs.region;
                    parsed.city = userCityPrefs.city;
                }

                const parkingData = {
                    lat: centerLat,
                    lng: centerLng,
                    coordinates: coordsToSave,
                    totalSpots,
                    occupiedSpots: 0,
                    name,
                    isPaid: false,
                    address: address || `${centerLat.toFixed(6)}, ${centerLng.toFixed(6)}`,
                    region: parsed.region,
                    city: parsed.city,
                    street: parsed.street,
                    houseNumber: parsed.houseNumber,
                    authorId: currentUser.id,
                    authorName: currentUser.firstName,
                    authorUsername: currentUser.username,
                    lastUpdatedAt: Date.now(),
                    lastUpdatedBy: currentUser.nickname || currentUser.firstName,
                    timestamp: Date.now(),
                    status: 'unknown'
                };

                const newRef = database.ref('parkings').push();
                return newRef.set(parkingData).then(() => {
                    database.ref(`users/${currentUser.id}/stats/parkingsCreated`)
                        .transaction(count => (count || 0) + 1);
                    database.ref(`parkings/${newRef.key}/history`).push({
                        action: 'created',
                        timestamp: Date.now(),
                        userId: currentUser.id,
                        username: currentUser.username
                    });
                    addMarkerToMap(newRef.key, parkingData);
                    if (drawingPolygon) { map.geoObjects.remove(drawingPolygon);
                        drawingPolygon = null; }
                    window.newParkingCoords = null;

                    if (document.getElementById('searchResults')) {
                        filterParkings();
                    }

                    closePanel();
                    showMap();
                    if (window.Telegram?.WebApp?.HapticFeedback) {
                        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                    }
                });
            })
            .catch(() => {
                const parkingData = {
                    lat: centerLat,
                    lng: centerLng,
                    coordinates: coordsToSave,
                    totalSpots,
                    occupiedSpots: 0,
                    name,
                    isPaid: false,
                    address: `${centerLat.toFixed(6)}, ${centerLng.toFixed(6)}`,
                    region: userCityPrefs.region || '',
                    city: userCityPrefs.city || '',
                    street: fullStreet,
                    houseNumber: houseNumber,
                    authorId: currentUser.id,
                    authorName: currentUser.firstName,
                    authorUsername: currentUser.username,
                    lastUpdatedAt: Date.now(),
                    lastUpdatedBy: currentUser.nickname || currentUser.firstName,
                    timestamp: Date.now(),
                    status: 'unknown'
                };
                const newRef = database.ref('parkings').push();
                return newRef.set(parkingData).then(() => {
                    database.ref(`users/${currentUser.id}/stats/parkingsCreated`)
                        .transaction(count => (count || 0) + 1);
                    database.ref(`parkings/${newRef.key}/history`).push({
                        action: 'created',
                        timestamp: Date.now(),
                        userId: currentUser.id,
                        username: currentUser.username
                    });
                    addMarkerToMap(newRef.key, parkingData);
                    if (drawingPolygon) { map.geoObjects.remove(drawingPolygon);
                        drawingPolygon = null; }
                    window.newParkingCoords = null;

                    if (document.getElementById('searchResults')) {
                        filterParkings();
                    }

                    closePanel();
                    showMap();
                    if (window.Telegram?.WebApp?.HapticFeedback) {
                        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                    }
                });
            })
            .finally(() => {
                const currentBtn = document.getElementById('saveParkBtn');
                if (currentBtn) { currentBtn.textContent = 'Сохранить парковку';
                    currentBtn.disabled = false; }
            });
    }

    function saveEditedPolygon(newCoords) {
        if (!currentParkingId) return;
        const sizeCheck = checkPolygonSize(newCoords);
        if (!sizeCheck.valid) { alert(sizeCheck.error);
            cancelDrawing(); return; }
        database.ref(`parkings/${currentParkingId}/coordinates`).set(newCoords).then(() => {
            map.geoObjects.remove(editingPolygon);
            editingPolygon = null;
            document.getElementById('addBtn').classList.remove('drawing');
            document.getElementById('addBtn').textContent = '+';
            isDrawingMode = false;
            const controls = document.getElementById('drawingControls');
            if (controls) controls.remove();
            currentParkingData.coordinates = newCoords;
            parkingDataCache[currentParkingId] = currentParkingData;
            refreshParkingMarker();
            if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback
                .notificationOccurred('success');
            alert('Границы обновлены');
        }).catch(err => { console.error('Ошибка обновления полигона:', err);
            alert('Ошибка: ' + err.message);
            cancelDrawing(); });
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

    const total = data.totalSpots || 0;
    const occupied = data.occupiedSpots || 0;
    const free = total - occupied;
    const percent = total > 0 ? Math.round((occupied / total) * 100) : 0;

    const now = new Date();
    let forecastText = 'Загрузка прогноза...';

    let html = `
        <div class="center-sheet-title">${escapeHtml(data.name || 'Парковка')}</div>
        <div class="center-stats">
            <div class="center-stat">
                <div class="center-stat-value green">${free}</div>
                <div class="center-stat-label">Свободно</div>
            </div>
            <div class="center-stat">
                <div class="center-stat-value blue">${total}</div>
                <div class="center-stat-label">Всего мест</div>
            </div>
            <div class="center-stat">
                <div class="center-stat-value ${percent > 70 ? 'red' : percent > 40 ? 'orange' : 'green'}">${percent}%</div>
                <div class="center-stat-label">Загруженность</div>
            </div>
        </div>
        <div class="center-forecast">
            <div class="center-forecast-title">📊 Прогноз</div>
            <div class="center-forecast-text">${escapeHtml(forecastText)}</div>
            <div id="forecastChartPlaceholder" style="text-align:center; padding:10px; color:var(--text-secondary);">
                <div class="spinner" style="width:24px;height:24px;border-width:2px;"></div>
                <p>Загрузка прогноза...</p>
            </div>
        </div>
        <div class="center-actions">
            <button class="btn-secondary" onclick="toggleFavoriteCenter()">⭐ Избранное</button>
            <button class="btn-secondary" onclick="buildRouteFromCenter()">🧭 Маршрут</button>
            <button class="btn-secondary" onclick="editFromCenter()">✏️ Изменить</button>
        </div>
    `;

    content.innerHTML = html;
    sheet.classList.add('active');

    try {
        const forecastData = await generateForecastData(now, free, parkingId);
        const chartHtml = renderForecastChart(forecastData);
        const text = generateForecastText(forecastData, now);
        const textContainer = document.querySelector('.center-forecast-text');
        if (textContainer) textContainer.innerHTML = text;
        const placeholder = document.getElementById('forecastChartPlaceholder');
        if (placeholder) {
            const container = document.createElement('div');
            container.innerHTML = chartHtml;
            placeholder.parentNode.replaceChild(container.firstElementChild, placeholder);
        }
    } catch (e) {
        console.warn('Ошибка загрузки прогноза:', e);
        const placeholder = document.getElementById('forecastChartPlaceholder');
        if (placeholder) {
            placeholder.innerHTML = '<div style="color:var(--text-secondary);">Прогноз временно недоступен</div>';
        }
        const textContainer = document.querySelector('.center-forecast-text');
        if (textContainer) textContainer.innerHTML = 'Прогноз временно недоступен';
    }
}
function closeCenterSheet() {
    document.getElementById('centerSheet').classList.remove('active');
    currentParkingId = null;
    currentParkingData = null;
}
function generateForecastText(forecastData, now) {
    if (!forecastData || forecastData.length === 0) {
        return 'Прогноз недоступен';
    }
    // Берём прогноз на 2-й час (индекс 1) – можно настроить
    const index = Math.min(1, forecastData.length - 1);
    const forecast = forecastData[index];
    const timeStr = forecast.time;
    const value = forecast.value;
    // Добавляем окончание для слова "мест"
    const places = value % 10 === 1 && value % 100 !== 11 ? 'место' : (value % 10 >= 2 && value % 10 <= 4 && (value % 100 < 10 || value % 100 >= 20) ? 'места' : 'мест');
    return `Ожидается примерно <b>${value}</b> ${places} к <b>${timeStr}</b>`;
}
// Генерация прогноза на основе истории за 7 дней
async function generateForecastData(now, currentFree, parkingId) {
    // Если parkingId не указан, возвращаем заглушку
    if (!parkingId) {
        const data = [];
        for (let i = 1; i <= 5; i++) {
            const future = new Date(now.getTime() + i * 60 * 60 * 1000);
            const timeStr = future.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            const base = currentFree + i * 0.8 + Math.random() * 2 - 1;
            const value = Math.max(0, Math.round(base));
            data.push({ time: timeStr, value });
        }
        return data;
    }

    // Загружаем историю за последние 7 дней (максимум 200 записей)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const snapshot = await database.ref(`parkings/${parkingId}/history`)
        .orderByChild('timestamp')
        .startAt(sevenDaysAgo)
        .limitToLast(200)
        .once('value');
    const history = snapshot.val();

    // Если истории нет или она пуста, используем простой тренд
    if (!history) {
        const data = [];
        for (let i = 1; i <= 5; i++) {
            const future = new Date(now.getTime() + i * 60 * 60 * 1000);
            const timeStr = future.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            const base = currentFree - i * 0.5 + Math.random() * 1.5;
            const value = Math.max(0, Math.round(base));
            data.push({ time: timeStr, value });
        }
        return data;
    }

    // Группируем записи по часам (0-23)
    const hourlyData = {};
    const entries = Object.values(history);
    entries.forEach(entry => {
        const dt = new Date(entry.timestamp);
        const hour = dt.getHours();
        if (!hourlyData[hour]) hourlyData[hour] = [];
        hourlyData[hour].push(entry.newOccupied || entry.occupiedSpots || 0);
    });

    // Вычисляем среднее для каждого часа
    const hourlyAvg = {};
    Object.keys(hourlyData).forEach(hour => {
        const values = hourlyData[hour];
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        hourlyAvg[hour] = Math.round(avg);
    });

    // Получаем общее количество мест
    const totalSpots = parkingDataCache[parkingId]?.totalSpots || 20;

    // Строим прогноз на 5 часов вперёд
    const forecast = [];
    for (let i = 1; i <= 5; i++) {
        const future = new Date(now.getTime() + i * 60 * 60 * 1000);
        const hour = future.getHours();
        const timeStr = future.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        let value;
        if (hourlyAvg[hour] !== undefined) {
            // Используем среднее за этот час
            value = hourlyAvg[hour];
        } else {
            // Если данных для этого часа нет, используем ближайший существующий час
            const hours = Object.keys(hourlyAvg).map(Number).sort((a, b) => a - b);
            let closest = hours[0];
            let minDiff = 24;
            hours.forEach(h => {
                const diff = Math.abs(h - hour);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = h;
                }
            });
            if (closest !== undefined) {
                value = hourlyAvg[closest];
            } else {
                // Совсем нет данных – тренд
                value = Math.max(0, Math.round(currentFree - i * 0.5));
            }
        }
        // Корректируем, чтобы не выходить за пределы
        value = Math.max(0, Math.min(totalSpots, value));
        forecast.push({ time: timeStr, value });
    }

    return forecast;
}
// Отрисовка линейного графика в SVG
function renderForecastChart(data) {
    if (!data || data.length === 0) return '';

    const maxVal = Math.max(...data.map(d => d.value), 1);
    const padding = { top: 10, bottom: 20, left: 5, right: 5 };
    const width = 300;  // базовый размер, масштабируется через viewBox
    const height = 80;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const points = data.map((d, i) => {
        const x = padding.left + (i / (data.length - 1)) * chartWidth;
        const y = padding.top + chartHeight - (d.value / maxVal) * chartHeight;
        return { x, y, value: d.value, time: d.time };
    });

    const linePath = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
    const areaPath = 'M' + points[0].x.toFixed(1) + ',' + (padding.top + chartHeight) + ' ' +
        points.map(p => 'L' + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ') +
        ' L' + points[points.length-1].x.toFixed(1) + ',' + (padding.top + chartHeight) + ' Z';

    // Метки времени (под осью X)
    const labels = points.map(p =>
        `<text x="${p.x}" y="${height - 2}" text-anchor="middle" class="forecast-chart-axis">${p.time}</text>`
    ).join('');

    // Точки
    const dots = points.map(p =>
        `<circle cx="${p.x}" cy="${p.y}" r="3" class="forecast-chart-dot" />`
    ).join('');

    // Подписи значений (над точками)
    const valueLabels = points.map(p =>
        `<text x="${p.x}" y="${p.y - 6}" text-anchor="middle" font-size="8" fill="var(--text-secondary)">${p.value}</text>`
    ).join('');

    return `
        <div class="forecast-chart-container">
            <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
                <!-- Область под графиком -->
                <path d="${areaPath}" class="forecast-chart-area" />
                <!-- Линия -->
                <path d="${linePath}" class="forecast-chart-line" />
                <!-- Точки -->
                ${dots}
                <!-- Подписи значений -->
                ${valueLabels}
                <!-- Метки времени -->
                ${labels}
            </svg>
        </div>
    `;
}
function toggleFavoriteCenter() {
    if (!currentParkingId || !currentParkingData) return;
    const parkingId = currentParkingId;
    const data = currentParkingData;
    toggleFavorite(parkingId, data);
    // Окно не закрываем – кнопка обновится внутри toggleFavorite
}
function buildRouteFromCenter() {
    if (!currentParkingId) return;
    const parkingId = currentParkingId;
    closeCenterSheet();
    buildRouteToParking(parkingId);
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
    const totalSpots = data.totalSpots || 0;
    const occupiedSpots = data.occupiedSpots || 0;
    const freeSpots = totalSpots - occupiedSpots;
    const color = getOccupancyColor(occupiedSpots, totalSpots);
    const occupancyPercent = totalSpots > 0 ? Math.round((occupiedSpots / totalSpots) * 100) : 0;
    const isAuthor = currentUser && currentUser.id === data.authorId;
    const status = data.status || 'unknown';
    const statusText = status === 'free' ? 'Свободно' : status === 'occupied' ? 'Занято' : 'Неизвестно';
    const statusClass = status === 'free' ? 'status-free' : status === 'occupied' ? 'status-occupied' : 'status-unknown';

    let addressDisplay = data.street || data.name || 'Без названия';
    if (data.houseNumber) {
        addressDisplay += `, д. ${data.houseNumber}`;
    }

    document.getElementById('panel').classList.add('active');
    document.getElementById('panelTitle').textContent = 'Редактирование';

    let html = `
    <div class="occupancy-header">
        <div class="occupancy-title">
            <span class="status-indicator ${statusClass}"></span>
            ${escapeHtml(data.name || 'Без названия')}
        </div>
    </div>
    <div class="occupancy-stats">
        <div class="stat-card stat-total"><div class="stat-value" id="statTotal">${totalSpots}</div><div class="stat-label">Всего мест</div></div>
        <div class="stat-card stat-free"><div class="stat-value" id="statFree">${freeSpots}</div><div class="stat-label">Свободно</div></div>
        <div class="stat-card stat-occupied"><div class="stat-value" id="statOccupied">${occupiedSpots}</div><div class="stat-label">Занято</div></div>
    </div>
    <div class="progress-bar"><div class="progress-fill" id="progressFill" style="width:${occupancyPercent}%;background:${color};"></div></div>
    <div style="text-align:center;font-size:13px;color:var(--text-secondary);margin-bottom:20px;" id="occupancyPercentText">Загруженность: ${occupancyPercent}%</div>
    <div class="occupancy-control" style="margin-bottom:15px;">
        <label>Изменить количество занятых мест:</label>
        <div class="counter-row">
    <button class="counter-btn minus" onclick="changeOccupancy(-1, '${currentParkingId}')">−</button>
    <div class="counter-value" id="currentOccupied">${occupiedSpots}</div>
    <button class="counter-btn plus" onclick="changeOccupancy(1, '${currentParkingId}')">+</button>
       </div>
    </div>

    <!-- ===== ИСТОРИЯ ИЗМЕНЕНИЙ (ВСЕГДА ОТКРЫТА) ===== -->
    <div id="historyContainer" style="margin-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-weight:600; font-size:16px;">📋 История изменений</span>
            <span style="font-size:12px; color:var(--text-secondary);" id="historyCount"></span>
            <button id="showAllHistoryBtn" style="background:none; border:none; color:var(--accent); cursor:pointer; font-size:14px; display:none;">См. все</button>
        </div>
        <div id="historyList" style="max-height:200px; overflow-y:auto;"></div>
        <div id="historyFullList" style="display:none; max-height:200px; overflow-y:auto; margin-top:8px;"></div>
        <button id="hideAllHistoryBtn" style="display:none; background:none; border:none; color:var(--accent); cursor:pointer; font-size:14px; margin-top:4px;">Скрыть всё</button>
    </div>
    `;

    // ===== ТРИ КНОПКИ В РЯД =====
    html += `
    <div style="display:flex; gap:8px; margin-top:16px;">
        <button class="btn-secondary" style="flex:1; margin:0;" onclick="toggleParkingEditor()">✏️ Изменить</button>
        <button class="btn-secondary" style="flex:1; margin:0;" onclick="buildRouteToParking('${currentParkingId}')">🧭 Маршрут</button>
        <button class="btn-danger" style="flex:1; margin:0; padding:10px;" onclick="deleteParkingWithConfirm('${currentParkingId}')">🗑️ Удалить</button>
    </div>
    `;

    // ===== ПАНЕЛЬ РЕДАКТИРОВАНИЯ (СКРЫТА ПО УМОЛЧАНИЮ) =====
    if (currentUser && isAuthor) {
        const currentStreet = data.street || '';
        const streetType = currentStreet.split(' ')[0] || '';
        const streetName = extractStreetName(currentStreet);

        html += `
        <div id="editPanel" style="display:none; margin-top:16px; background:var(--bg-secondary); border-radius:16px; padding:16px; box-shadow:var(--card-shadow);">
            <div class="form-group">
                <label>Название / улица</label>
                <select id="editStreetType" class="input-field" style="margin-bottom:8px;">
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
                <input type="text" id="editStreetName" class="input-field" value="${escapeHtml(streetName)}" placeholder="Название улицы">
            </div>
            <div class="form-group">
                <label>Номер дома</label>
                <input type="text" id="editHouseNumber" class="input-field" value="${escapeHtml(data.houseNumber || '')}" placeholder="15">
            </div>
            <div class="form-group">
                <label>Количество мест</label>
                <input type="number" id="editTotalSpots" class="input-field" value="${totalSpots}" min="1" max="500">
            </div>
            <button class="btn-primary" onclick="saveParkingDetails()">💾 Сохранить</button>
            <button class="btn-secondary" style="margin-top:8px;" onclick="toggleParkingEditor()">Отмена</button>
        </div>
        `;
    } else if (!isAuthor && currentUser) {
        html += `<div style="text-align:center; margin-top:16px; font-size:14px; color:var(--text-secondary);">Вы не можете редактировать эту парковку</div>`;
    }

    document.getElementById('panelContent').innerHTML = html;

    // ===== ЗАГРУЗКА ИСТОРИИ (ВСЕГДА) =====
    if (currentUser && currentParkingId) {
        loadHistoryPreview(currentParkingId);
    }

    // ===== ОБРАБОТЧИК ДЛЯ КНОПКИ "СМ. ВСЕ" =====
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

    // ===== ПЕРЕКЛЮЧЕНИЕ ПАНЕЛИ РЕДАКТИРОВАНИЯ =====
    window.toggleParkingEditor = function() {
        const panel = document.getElementById('editPanel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    };

    // ===== УДАЛЕНИЕ С ПОДТВЕРЖДЕНИЕМ =====
    window.deleteParkingWithConfirm = function(parkingId) {
        if (confirm('Вы уверены, что хотите удалить эту парковку? Это действие необратимо!')) {
            deleteParking(parkingId);
        }
    };
}
    // Загрузка истории для предпросмотра (первые 3 записи + кнопка "См. все")
// Загрузка истории для предпросмотра (первые 3 записи + кнопка "См. все")
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

        const street = streetType && streetName ? `${streetType} ${streetName}` : (streetName || currentParkingData
            .street || '');
        if (!street && !houseNumber) { alert('Введите улицу или номер дома'); return; }

        let newName = street;
        if (houseNumber) {
            newName = newName ? `${newName}, ${houseNumber}` : houseNumber;
        }
        if (!newName) {
            newName = 'Адрес не указан';
        }

        if (isNaN(totalSpots) || totalSpots < 1) { alert('Количество мест должно быть больше 0'); return; }
        if (totalSpots < currentParkingData.occupiedSpots) { alert('Общее число мест не может быть меньше занятых.');
            return; }

        const updates = { name: newName, street, houseNumber, totalSpots };

        database.ref(`parkings/${currentParkingId}`).update(updates).then(() => {
            if (currentUser.id === currentParkingData.authorId) database.ref(
                `users/${currentUser.id}/stats/parkingsUpdated`).transaction(c => (c || 0) + 1);
            currentParkingData = { ...currentParkingData, ...updates };
            parkingDataCache[currentParkingId] = currentParkingData;
            updateOccupancyDisplay(currentParkingData.occupiedSpots);
            refreshParkingMarker();

            const summaryAddress = document.getElementById('summaryAddress');
            const summarySpots = document.getElementById('summarySpots');
            if (summaryAddress) {
                let display = updates.street || updates.name || 'Без названия';
                if (updates.houseNumber) {
                    display += `, д. ${updates.houseNumber}`;
                }
                summaryAddress.textContent = display;
            }
            if (summarySpots) {
                summarySpots.textContent = `🅿️ ${updates.totalSpots} мест`;
            }
            const fields = document.getElementById('editorFields');
            const btn = document.getElementById('editToggleBtn');
            if (fields && fields.classList.contains('open')) {
                fields.classList.remove('open');
                if (btn) {
                    btn.classList.remove('active');
                    btn.textContent = '✏️';
                }
            }

            closePanel();
            showMap();
            if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback
                .notificationOccurred('success');
        }).catch(err => { console.error('Ошибка сохранения:', err);
            alert('Ошибка: ' + err.message); });
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
    console.log('changeOccupancy called with delta=', delta, 'parkingId=', parkingId);

    if (!currentUser) {
        alert('Необходимо авторизоваться');
        return;
    }

    const id = parkingId || currentParkingId;
    if (!id) {
        console.error('changeOccupancy: нет parkingId');
        alert('Ошибка: ID парковки не найден');
        return;
    }

    // Загружаем актуальные данные из Firebase
    let data = parkingDataCache[id];
    if (!data) {
        try {
            const snapshot = await database.ref(`parkings/${id}`).once('value');
            data = snapshot.val();
            if (data) {
                parkingDataCache[id] = data;
                if (id === currentParkingId) currentParkingData = data;
            }
        } catch (err) {
            console.error('Ошибка загрузки данных:', err);
            alert('Не удалось загрузить данные парковки');
            return;
        }
    }

    if (!data) {
        alert('Данные парковки не найдены');
        return;
    }

    const total = data.totalSpots || 0;
    const cur = data.occupiedSpots || 0;
    const newOcc = cur + delta;

    if (newOcc < 0 || newOcc > total) {
        console.warn('Недопустимое значение:', newOcc);
        return;
    }

    const now = Date.now();
    const car = currentUser.car || {};

    try {
        await database.ref(`parkings/${id}`).update({
            occupiedSpots: newOcc,
            lastUpdatedAt: now,
            lastUpdatedBy: currentUser.nickname || currentUser.firstName
        });

        await database.ref(`parkings/${id}/history`).push({
            action: delta < 0 ? 'freed' : 'occupied',
            timestamp: now,
            userId: currentUser.id,
            username: currentUser.username || currentUser.nickname || 'Гость',
            previousOccupied: cur,
            newOccupied: newOcc,
            car: {
                brand: car.brand || '',
                model: car.model || '',
                plate: car.plate || '',
                color: car.color || ''
            }
        });

        // Обновляем кеш
        if (parkingDataCache[id]) parkingDataCache[id].occupiedSpots = newOcc;
        if (id === currentParkingId && currentParkingData) currentParkingData.occupiedSpots = newOcc;

        // Обновляем интерфейс
        updateOccupancyDisplay(newOcc);
        refreshParkingMarker();
        if (document.getElementById('historyList')) loadHistoryPreview(id);

        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.selectionChanged();
        }
    } catch (err) {
        console.error('Ошибка обновления занятости:', err);
        alert('Ошибка: ' + (err.message || 'Неизвестная ошибка'));
    }
}
    function deleteParking(parkingId) {
        if (!currentUser) { alert('Необходимо авторизоваться'); return; }
        if (!confirm('Вы уверены, что хотите удалить эту парковку?')) return;
        database.ref(`parkings/${parkingId}`).remove().then(() => {
            if (mapMarkers[parkingId]) { map.geoObjects.remove(mapMarkers[parkingId]);
                delete mapMarkers[parkingId]; }
            delete parkingDataCache[parkingId];
            closePanel();
            showMap();
            if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback
                .notificationOccurred('success');
            const panelContent = document.getElementById('panelContent');
            if (panelContent && document.getElementById('searchResults')) {
                filterParkings();
            }
        }).catch(err => { console.error('Ошибка удаления:', err);
            alert('Ошибка удаления: ' + err.message); });
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

    function toggleFavorite(parkingId, parkingData) {
    if (!currentUser || !parkingId) return;
    const data = parkingData || parkingDataCache[parkingId] || null;
    if (!data) return;

    const favRef = database.ref(`users/${currentUser.id}/favorites/${parkingId}`);
    favRef.once('value').then(snap => {
        if (snap.exists()) {
            favRef.remove();
            // Обновляем текст кнопки в центральном окне
            const btn = document.querySelector('.center-actions .btn-secondary:first-child');
            if (btn) btn.innerHTML = '⭐ Избранное';
            if (data.authorId) {
                database.ref(`users/${data.authorId}/stats/favorites`).transaction(c => Math.max(0, (c || 1) - 1));
            }
        } else {
            const favData = {
                parkingId: parkingId,
                name: data.name || data.address || data.street || 'Парковка',
                lat: data.lat || 0,
                lng: data.lng || 0,
                address: data.address || '',
                timestamp: Date.now()
            };
            favRef.set(favData);
            const btn = document.querySelector('.center-actions .btn-secondary:first-child');
            if (btn) btn.innerHTML = '✅ В избранном';
            if (data.authorId) {
                database.ref(`users/${data.authorId}/stats/favorites`).transaction(c => (c || 0) + 1);
            }
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
        const line = new ymaps.Polyline([routeStartCoords, routeEndCoords], {}, {
            strokeColor: '#2B7574',
            strokeWidth: 4,
            strokeOpacity: 0.8
        });
        map.geoObjects.add(line);
        currentRoute = line;
        const dist = getDistanceInMeters(
            routeStartCoords[0], routeStartCoords[1],
            routeEndCoords[0], routeEndCoords[1]
        ) / 1000;
        const time = Math.round(dist * 2);
        const free = routeParkingData.totalSpots - routeParkingData.occupiedSpots;
        document.getElementById('routeInfo').innerHTML = `
        <div>🚗 До парковки (по прямой)</div>
        <div> ${dist.toFixed(1)} км</div>
        <div>⏱ ~${time} мин (приблизительно)</div>
        <div> Свободных мест: ${free}</div>
        <div>🔄 Обновлено: ${formatDateTime(routeParkingData.timestamp)}</div>
    `;
        document.getElementById('routeCard').classList.add('active');
        map.setBounds([
            [Math.min(routeStartCoords[0], routeEndCoords[0]), Math.min(routeStartCoords[1], routeEndCoords[1])],
            [Math.max(routeStartCoords[0], routeEndCoords[0]), Math.max(routeStartCoords[1], routeEndCoords[1])]
        ], { duration: 500 });
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
        if (!currentUser) { alert('Необходимо войти'); return; }
        isAddressPickerOpen = true;
        document.getElementById('addressPickerOverlay').style.display = 'block';
        setTimeout(() => {
            if (!addressPickerMap) {
                addressPickerMap = new ymaps.Map('addressPickerMap', {
                    center: map.getCenter() || [55.7558, 37.6173],
                    zoom: 15,
                    controls: ['zoomControl']
                });
                addressPickerMap.events.add('click', e => setAddressPickerCoords(e.get('coords')));
                setAddressPickerCoords(addressPickerMap.getCenter());
            } else {
                addressPickerMap.container.fitToViewport();
            }
        }, 100);
    }

    function setAddressPickerCoords(coords) {
        addressPickerCoords = coords;
        if (addressPickerPlacemark) {
            addressPickerPlacemark.geometry.setCoordinates(coords);
        } else {
            addressPickerPlacemark = new ymaps.Placemark(coords, {
                hintContent: 'Ваш адрес',
                balloonContent: 'Перетащите метку'
            }, {
                preset: 'islands#redHomeIcon',
                draggable: true
            });
            addressPickerMap.geoObjects.add(addressPickerPlacemark);
            addressPickerPlacemark.events.add('dragend', () => {
                addressPickerCoords = addressPickerPlacemark.geometry.getCoordinates();
            });
        }
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
        if (!currentUser) return;
        const overlay = document.getElementById('addressEditorOverlay');
        if (!overlay) return;
        document.getElementById('editAddrId').value = addressId;

        database.ref(`users/${currentUser.id}/homeAddresses/${addressId}`).once('value')
            .then(snap => {
                const addr = snap.val() || {};
                document.getElementById('editAddrLabel').value = addr.label || 'Дом';
                document.getElementById('editAddrCity').value = addr.city || '';
                document.getElementById('editAddrStreet').value = addr.street || '';
                document.getElementById('editAddrHouse').value = addr.houseNumber || '';
                overlay.classList.add('active');
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

        loadAllParkings()
            .then(function() {
                renderSearchPanel(content, {
                    searchQuery: savedSearch,
                    sortBy: savedSort,
                    radius: savedRadius,
                    freeOnly: savedFreeOnly
                });
            })
            .catch(function() {
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
                if (r === userCityPrefs.region) opt.selected = true;
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
                if (city === userCityPrefs.city) opt.selected = true;
                citySelect.appendChild(opt);
            });
        }
    }

    function applyCityFromPicker() {
        const region = document.getElementById('cityPickerRegion')?.value;
        const city = document.getElementById('cityPickerCity')?.value;
        if (!region || !city) {
            alert('Выберите регион и город');
            return;
        }
        mapCity = { region, city };
        closeCityPicker();
        updateCityDisplay();
        loadAllParkings();
        if (document.getElementById('panelTitle')?.textContent === 'Поиск') {
            filterParkings();
        }
    }

    function updateCityDisplay() {
        const cityName = mapCity ? mapCity.city : (userCityPrefs.city || 'Не указан');
        const displayEl = document.getElementById('cityDisplayName');
        if (displayEl) {
            displayEl.textContent = cityName;
        }
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
    if (!currentUser) {
        content.innerHTML = `
            <div class="profile-header">
                <div class="profile-avatar">👤</div>
                <div class="profile-name">Добро пожаловать</div>
                <div class="profile-username">Войдите, чтобы сохранять данные</div>
            </div>
            <button class="telegram-btn" onclick="openTelegramBot()">Войти через Telegram</button>
            <button class="guest-btn" onclick="continueAsGuest()">Продолжить как гость</button>
        `;
        return;
    }

    const isGuest = currentUser.id.startsWith('guest_');

    database.ref(`users/${currentUser.id}/stats`).once('value').then(statsSnap => {
        const stats = statsSnap.val() || {};
        database.ref(`users/${currentUser.id}/car`).once('value').then(carSnap => {
            const car = carSnap.val() || {};
            database.ref(`users/${currentUser.id}/cityPreferences`).once('value').then(prefSnap => {
                const prefs = prefSnap.val() || { region: '', city: '' };
                userCityPrefs = prefs;

                // ---- Расчёт XP и уровня ----
                const created = stats.parkingsCreated || 0;
                const updated = stats.parkingsUpdated || 0;
                const confirmations = stats.confirmations || 0;
                const views = stats.views || 0;
                const favorites = stats.favorites || 0;
                const activeDates = stats.activeDates || [];
                const score = (created * 25) + (updated * 5) + (confirmations * 5) + Math.floor(views / 5) + (favorites * 5) + (activeDates.length * 5);

                const levels = [
                    { xp: 0, name: "Пешеход", emoji: "👣" },
                    { xp: 1000, name: "Водитель-любитель", emoji: "🚗" },
                    { xp: 3000, name: "Начинающий парковщик", emoji: "🅿️" },
                    { xp: 5000, name: "Городской водитель", emoji: "🏙️" },
                    { xp: 10000, name: "Наблюдатель", emoji: "🔭" },
                    { xp: 20000, name: "Помощник района", emoji: "🤝" },
                    { xp: 40000, name: "Картограф", emoji: "🗺️" },
                    { xp: 70000, name: "Инспектор", emoji: "👮" },
                    { xp: 110000, name: "Ветеран дорог", emoji: "🏅" },
                    { xp: 150000, name: "Страж парковки", emoji: "⚖️" },
                    { xp: 250000, name: "Архитектор города", emoji: "🏗️" },
                    { xp: 500000, name: "Легенда ParkNear", emoji: "💎" }
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

                const xpForCurrent = currentLevel.xp;
                const xpForNext = nextLevel.xp;
                const xpProgress = xpForNext > xpForCurrent ? (score - xpForCurrent) / (xpForNext - xpForCurrent) : 1;
                const progressPercent = Math.min(100, Math.round(xpProgress * 100));
                const circumference = 2 * Math.PI * 45;
                const strokeDashoffset = circumference * (1 - progressPercent / 100);

                // ---- Шапка профиля с круговым индикатором ----
                let html = `
                    <div style="display: flex; align-items: center; padding: 20px 0 16px; gap: 16px;">
                        <div style="font-size: 64px; flex-shrink: 0;">
                            ${currentUser.photoUrl ? `<img src="${currentUser.photoUrl}" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover;">` : '👤'}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 20px; font-weight: 700;">${currentUser.firstName}</div>
                            <div style="font-size: 15px; color: var(--text-secondary);">@${currentUser.nickname || currentUser.username}</div>
                            <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                                <span style="font-size: 14px; background: var(--accent); color: #E2E2E0; padding: 2px 12px; border-radius: 12px; font-weight: 600;">
                                    ${currentLevel.emoji} ${currentLevel.name}
                                </span>
                                ${isGuest ? '<span class="badge" style="font-size: 12px;">Гость</span>' : ''}
                            </div>
                        </div>
                        <div style="position: relative; width: 64px; height: 64px; flex-shrink: 0;">
                            <svg viewBox="0 0 100 100" style="transform: rotate(-90deg); width: 64px; height: 64px;">
                                <circle cx="50" cy="50" r="45" fill="none" stroke="var(--bg-primary)" stroke-width="8"/>
                                <circle cx="50" cy="50" r="45" fill="none" stroke="url(#repGradient)" stroke-width="8"
                                        stroke-linecap="round"
                                        stroke-dasharray="${circumference}"
                                        stroke-dashoffset="${strokeDashoffset}"
                                        style="transition: stroke-dashoffset 0.8s ease;"/>
                            </svg>
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; font-size: 11px; font-weight: 600; color: var(--text-primary); line-height: 1.2;">
                                ${score}<br>
                                <span style="font-size: 8px; color: var(--text-secondary);">XP</span>
                            </div>
                        </div>
                    </div>
                `;

                // ---- Секция "Мой автомобиль" (исправлена: убрано дублирование) ----
                html += `
                    <div class="profile-section-header" onclick="toggleProfileSection('car')">
                      <span>Мой автомобиль</span>
                       <span style="font-size:12px; color:var(--text-secondary);">${car.brand ? '✅ Добавлен' : '➕ Не добавлен'}</span>
                         <span class="arrow-span">▶</span>
                            </div>
                        <div class="profile-section-content" id="profileSectionCarContent">
                            ${car.brand ? `
                                <div style="padding: 4px 0;">
                                    <div><strong>${car.brand} ${car.model || ''}</strong></div>
                                    <div style="color: var(--text-secondary); font-size: 14px;">${car.plate || 'без номера'}</div>
                                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                                        <button class="btn-secondary" style="flex:1;" onclick="editCarDataFromSettings()">Редактировать</button>
                                        <button class="btn-danger" style="flex:1; padding:10px; margin:0;" onclick="removeCar()">🗑️ Удалить</button>
                                    </div>
                                </div>
                            ` : `
                                <div style="padding: 4px 0; color: var(--text-secondary);">
                                    Автомобиль не добавлен
                                    <button class="btn-secondary" style="width:100%; margin-top:8px;" onclick="editCarDataFromSettings()">➕ Добавить</button>
                                </div>
                            `}
                        </div>
                    </div>
                `;

                // ---- Остальные секции ----
                html += `
                    <div class="profile-section" id="profileSectionHistory">
                        <div class="profile-section-header" onclick="toggleProfileSection('history')">
                            <span>История парковок</span>
                            <span>▶</span>
                        </div>
                        <div class="profile-section-content" id="profileSectionHistoryContent">
                            <div id="historyListContainer" style="padding: 4px 0;">
                                <div style="text-align:center; color:var(--text-secondary);">Загрузка...</div>
                            </div>
                        </div>
                    </div>

                    <div class="profile-section" id="profileSectionFavorites">
                        <div class="profile-section-header" onclick="toggleProfileSection('favorites')">
                            <span>Избранные парковки</span>
                            <span>▶</span>
                        </div>
                        <div class="profile-section-content" id="profileSectionFavoritesContent">
                            <div id="favoritesListContainer" style="padding: 4px 0;">
                                <div style="text-align:center; color:var(--text-secondary);">Загрузка...</div>
                            </div>
                        </div>
                    </div>

                    <div class="profile-section" id="profileSectionSettings">
                        <div class="profile-section-header" onclick="toggleProfileSection('settings')">
                            <span>Настройки</span>
                            <span>▶</span>
                        </div>
                        <div class="profile-section-content" id="profileSectionSettingsContent">
                            <div id="settingsContentInline" style="padding: 4px 0;"></div>
                        </div>
                    </div>
                `;

                content.innerHTML = html;
                renderSettingsInline();
                window._historyLoaded = false;
                window._favoritesLoaded = false;
            });
        });
    });
}
// ---- Переключение секций профиля ----
function toggleProfileSection(section) {
    const content = document.getElementById(`profileSection${section.charAt(0).toUpperCase() + section.slice(1)}Content`);
    if (!content) return;
    const isOpen = content.classList.contains('open');
    if (isOpen) {
        content.classList.remove('open');
    } else {
        content.classList.add('open');
    }
    // Обновляем стрелку
    const header = document.getElementById(`profileSection${section.charAt(0).toUpperCase() + section.slice(1)}`);
    if (header) {
        const arrow = header.querySelector('.arrow-span');
if (arrow) {
    arrow.textContent = isOpen ? '▶' : '▼';
}
    }

    // Загружаем данные, если секция открыта
    if (section === 'history' && !window._historyLoaded) {
        loadUserParkingHistory();
        window._historyLoaded = true;
    } else if (section === 'favorites' && !window._favoritesLoaded) {
        loadFavoritesInline();
        window._favoritesLoaded = true;
    }
}

// ---- Загрузка истории парковок пользователя ----
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
// ---- Загрузка избранного (для инлайн отображения) ----
function loadFavoritesInline() {
    const container = document.getElementById('favoritesListContainer');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; color:var(--text-secondary);">Загрузка...</div>';

    database.ref(`users/${currentUser.id}/favorites`).once('value').then(snap => {
        const favs = snap.val() || {};
        const entries = Object.values(favs).filter(f => f.parkingId);
        if (entries.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:var(--text-secondary);">Нет избранных парковок</div>';
            return;
        }
        let html = '';
        entries.forEach(item => {
            // Получаем актуальные данные о парковке из кеша или из базы
            const parking = parkingDataCache[item.parkingId];
            const free = parking ? (parking.totalSpots - parking.occupiedSpots) : '?';
            html += `
                <div class="parking-item" style="margin-bottom: 6px;" onclick="focusMap(${item.lat || 0}, ${item.lng || 0}, '${item.parkingId}')">
                    <div class="info">
                        <div class="name">${item.name || 'Без названия'}</div>
                        <div class="addr">${item.address || ''}</div>
                    </div>
                    <div class="free">${free} мест</div>
                </div>
            `;
        });
        container.innerHTML = html;
    }).catch(err => {
        container.innerHTML = '<div style="text-align:center; color:var(--red);">Ошибка загрузки</div>';
    });
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
            updateCityDisplay();
            loadAllParkings();
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
            updateCityDisplay();
            loadAllParkings();
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
            Promise.all([
                database.ref(`users/${currentUser.id}/favorites`).once('value'),
                database.ref(`users/${currentUser.id}/homeAddresses`).once('value')
            ]).then(([favSnap, homeSnap]) => {
                let html = '';

                const addrs = homeSnap.val() || {};
                const addrEntries = Object.entries(addrs);

                html += `<div class="fav-section-title" style="display:flex; justify-content:space-between; align-items:center;">
                <span>🏠 Мои адреса</span>
                <button class="add-address-btn" onclick="addHomeAddress()" title="Добавить адрес">+</button>
            </div>`;
                html += `<div class="addresses-list">`;

                addrEntries.forEach(([id, addr]) => {
                    const label = addr.label || 'Адрес';
                    let icon = '📍';
                    if (label === 'Дом') icon = '🏠';
                    else if (label === 'Работа') icon = '💼';
                    else if (label === 'Родственники') icon = '👨‍👩‍👧‍👦';
                    const addressText = addr.city && addr.street && addr.houseNumber ?
                        `${addr.city}, ${addr.street}, ${addr.houseNumber}` :
                        (addr.address || 'Без адреса');

                    html += `
                <div class="swipe-container" style="border-radius:14px; margin-bottom:6px;">
                    <div class="swipe-item" onclick="centerMapOnAddress(${addr.lat || 'null'}, ${addr.lng || 'null'})" style="display:flex; align-items:center; gap:12px; padding:12px 16px;">
                        <span style="font-size:20px;">${icon}</span>
                        <div class="fav-item-info">
                            <div class="fav-item-name">${label}</div>
                            <div class="fav-item-meta">${addressText}</div>
                        </div>
                        <button class="settings-edit-btn" onclick="event.stopPropagation(); openAddressEditor('${id}')" title="Редактировать адрес" style="flex-shrink:0; margin-left:auto;">✏️</button>
                    </div>
                    <div class="swipe-delete" onclick="event.stopPropagation(); removeHomeAddress('${id}')">Удалить</div>
                </div>`;
                });

                if (addrEntries.length === 0) {
                    html += `<div class="address-tile" onclick="addHomeAddress()" style="opacity:0.5; padding:20px; text-align:center;">
                        <div class="address-tile-icon">➕</div>
                        <div class="address-tile-label">Добавить</div>
                    </div>`;
                }

                html += `</div>`;
                const favs = favSnap.val();
                html += `<div class="fav-section-title">⭐ Избранные парковки</div>`;

                if (!favs) {
                    html += '<div class="empty-state"><p>Нет избранных парковок</p></div>';
                } else {
                    html += `<div class="fav-search">
                    <input type="text" id="favSearchInput" placeholder="Поиск по избранному..." oninput="filterFavorites()">
                </div>`;
                    html += '<div id="favListContainer">';
                    Object.values(favs).forEach(item => {
                        if (!item || !item.parkingId) return;
                        html += `<div class="fav-item" data-name="${item.name||''}" data-address="${item.address||''}" onclick="highlightAndShowParking('${item.parkingId}')">
                        <div class="fav-item-info">
                            <div class="fav-item-name">${item.name || 'Без названия'}</div>
                            <div class="fav-item-meta">
                                <span>${item.address || ''}</span>
                            </div>
                        </div>
                        <div class="fav-item-right">
                            <span class="occupancy-dot" style="background: var(--accent);"></span>
                            <button class="settings-edit-btn" onclick="event.stopPropagation(); removeFromFavorites('${item.parkingId}')" title="Удалить из избранного">✕</button>
                        </div>
                    </div>`;
                    });
                    html += '</div>';
                }

                content.innerHTML = html;
                attachSwipeToContainers(content);
            });
        }
    }

    function removeFromFavorites(parkingId) {
        if (!currentUser || !parkingId) return;
        const favRef = database.ref(`users/${currentUser.id}/favorites/${parkingId}`);
        favRef.remove().then(() => {
            const content = document.getElementById('panelContent');
            if (content && document.getElementById('panel').classList.contains('active')) {
                loadUserData('favorites', content);
            }
        }).catch(err => console.error('Ошибка удаления из избранного:', err));
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
            content.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Загрузка...</p></div>';
            loadUserData('favorites', content);
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
    document.querySelector('.tab:first-child').classList.add('active');
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
        hideAuthScreen();
        currentUser = {
            id: 'guest_' + Date.now(),
            username: 'guest',
            firstName: 'Гость',
            photoUrl: '',
            isGuest: true
        };
        localStorage.setItem('tgUser', JSON.stringify(currentUser));
        database.ref(`users/${currentUser.id}/stats`).set({
            registeredAt: Date.now(),
            lastActive: Date.now(),
            parkingsCreated: 0,
            parkingsUpdated: 0,
            confirmations: 0,
            views: 0,
            favorites: 0,
            activeDates: [new Date().toISOString().split('T')[0]]
        });
        showPanel('home');
        showOnboarding();
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

    // Синхронизируем все переключатели темы
    var toggle1 = document.getElementById('settingsThemeToggle');
    var toggle2 = document.getElementById('settingsThemeToggleInline');
    if (toggle1) toggle1.checked = isDark;
    if (toggle2) toggle2.checked = isDark;

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
    // Если есть кеш – показываем мгновенно
    if (Object.keys(parkingDataCache).length > 0) {
        getUserLocation().then(coords => {
            userLocationForSearch = coords;
            renderHomeContent(content, coords);
        }).catch(() => {
            userLocationForSearch = null;
            renderHomeContent(content, null);
        });
        // Фоновое обновление
        loadAllParkings().then(() => {
            // Если панель всё ещё открыта – перерисовываем
            const panel = document.getElementById('panel');
            if (panel && panel.classList.contains('active')) {
                const title = document.getElementById('panelTitle');
                if (title && title.textContent === 'Главная') {
                    getUserLocation().then(coords => {
                        userLocationForSearch = coords;
                        renderHomeContent(content, coords);
                    }).catch(() => {
                        userLocationForSearch = null;
                        renderHomeContent(content, null);
                    });
                }
            }
        });
        return;
    }
    // Если кеша нет – показываем загрузку и грузим данные
    content.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Загрузка парковок...</p></div>';
    Promise.all([
        loadAllParkings(true),
        getUserLocation().catch(() => null)
    ]).then(([, coords]) => {
        userLocationForSearch = coords;
        renderHomeContent(content, coords);
    }).catch(() => {
        content.innerHTML = '<div class="empty-state"><p>Не удалось загрузить данные</p></div>';
    });
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

    // Если координаты есть – показываем парковки рядом, иначе – все парковки (без сортировки по расстоянию)
    if (coords) {
        showNearbyParkings(coords, 5);
    } else {
        // Показываем все парковки (без учёта расстояния)
        var allParkings = Object.values(parkingDataCache).filter(function(p) { return p.lat && p.lng; });
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
        // Сохраняем в localStorage
        localStorage.setItem('tgUser', JSON.stringify(currentUser));

        // Сохраняем в Firebase
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
        console.log('✅ Пользователь авторизован:', user.first_name);
    } catch (e) {
        console.error('❌ Ошибка в onTelegramAuth:', e);
        // Запасной вариант – гость
        continueAsGuest();
    }
}
  function initApp() {
    // 1. Проверяем, не вернулись ли с авторизации через Telegram (редирект)
    if (checkTelegramAuthFromUrl()) {
        // Если авторизация уже выполнена, показываем главную и выходим
        showPanel('home');
        return;
    }
    // 2. Инициализация авторизации (показывает окно входа, если нет сохранённого пользователя)
    initAuth();
    // 3. Обработчик кнопки «+» (добавить парковку)
    document.getElementById('addBtn').onclick = () => {
        if (!currentUser) {
            showPanel('home');
        } else if (isDrawingMode) {
            cancelDrawing();
        } else {
            startDrawingMode();
        }
    };
    // 4. Обработчик кнопки геолокации
    document.getElementById('geoBtn').onclick = () => {
        if (!map) return;
        const btn = document.getElementById('geoBtn');
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></div>';
        getUserLocation()
            .then(coords => {
                btn.innerHTML = originalContent;
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
            .catch(err => {
                btn.innerHTML = originalContent;
                console.error('Ошибка геолокации:', err);
                let message = 'Не удалось определить местоположение.';
                if (window.Telegram?.WebApp) message += ' Проверьте настройки геолокации.';
                if (window.Telegram?.WebApp?.showAlert) {
                    window.Telegram.WebApp.showAlert(message);
                } else {
                    alert(message);
                }
            });
    };
    // 5. Инициализация карты (если ещё не инициализирована)
    if (!map) {
        ymaps.ready(() => {
            initMap();
        });
    }
    // 6. Загружаем парковки
    loadAllParkings();
    // 7. Pull-to-refresh
    initPullToRefresh();
    // 8. Если пользователь уже залогинен, показываем домашнюю панель
    if (currentUser) {
        showPanel('home');
    }
}
    function openTelegramBot() {
        console.log('openTelegramBot вызвана');

        if (window.Telegram && window.Telegram.WebApp) {
            var webApp = window.Telegram.WebApp;
            if (webApp.initDataUnsafe && webApp.initDataUnsafe.user) {
                var user = webApp.initDataUnsafe.user;
                var savedUser = localStorage.getItem('tgUser');
                if (!savedUser) {
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
            initAuth();   // ✅ Правильно
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

    // Принудительное скрытие splash через 5 секунд (на случай, если карта не загрузилась)
    setTimeout(function() {
        var splash = document.getElementById('splashScreen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(function() { splash.remove(); }, 300);
        }
    }, 5000);
    // Диагностика загрузки карты
(function checkMapLoading() {
    console.log('🔍 Проверка загрузки Яндекс.Карт...');
    if (typeof ymaps === 'undefined') {
        console.error('❌ ymaps не определён. Скрипт Яндекс.Карт не загрузился.');
        document.getElementById('map').innerHTML = '<div style="color:red;text-align:center;padding:20px;">⚠️ Карта не загрузилась. Проверьте API-ключ и интернет-соединение.</div>';
        return;
    }
    ymaps.ready(function() {
        console.log('✅ ymaps.ready сработал');
        initApp(); // <- вызываем именно initApp, а не initMap
    });
})();
