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
