const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const admin = require('firebase-admin');
const pool = require('./db');

// ============================================
// ПОДГОТОВКА СТРУКТУРЫ POSTGRESQL
// ============================================
async function initializeDatabase() {
    const statements = [
        `
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            data JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        `,
        `
        CREATE TABLE IF NOT EXISTS parkings (
            id TEXT PRIMARY KEY,
            data JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        `,
        `
        CREATE TABLE IF NOT EXISTS parking_sessions (
            id TEXT PRIMARY KEY,
            data JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        `,
        `
        CREATE TABLE IF NOT EXISTS favorites (
            user_id TEXT NOT NULL
                REFERENCES users(id) ON DELETE CASCADE,
            parking_id TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (user_id, parking_id)
        )
        `,
        `
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL
                REFERENCES users(id) ON DELETE CASCADE,
            data JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        `,
        `
        CREATE INDEX IF NOT EXISTS idx_parkings_city
        ON parkings ((data->>'city'))
        `,
        `
        CREATE INDEX IF NOT EXISTS idx_parking_sessions_user
        ON parking_sessions ((data->>'userId'))
        `,
        `
        CREATE INDEX IF NOT EXISTS idx_favorites_user
        ON favorites (user_id)
        `,
        `
        CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
        ON push_subscriptions (user_id)
        `
    ];
     const client = await pool.connect();
    try {
          await client.query('BEGIN');
        for (const statement of statements) {
            await client.query(statement);
        }
           await client.query('COMMIT');
        console.log('Структура PostgreSQL проверена и подготовлена');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(
            'Ошибка подготовки PostgreSQL:',
            error.message
        );
        throw error;
    } finally {
        client.release();
    }
}
const app = express();
const PORT = process.env.PORT || 3000;
// ============================================
// НАСТРОЙКИ
// ============================================
const ALLOWED_ORIGIN =
    process.env.ALLOWED_ORIGIN ||
    'https://andrey8128-jpg.github.io';
// Максимальный возраст данных Telegram — 24 часа
const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;
// ============================================
// CORS И JSON
// ============================================
app.use(cors({
    origin: ALLOWED_ORIGIN,
    methods: [
        'GET',
        'POST',
        'PATCH',
        'PUT',
        'DELETE',
        'OPTIONS'
    ],
    allowedHeaders: [
        'Content-Type',
        'Authorization'
    ]
}));
app.use(express.json({
    limit: '100kb'
}));
// ============================================
// СЕКРЕТНЫЕ ПЕРЕМЕННЫЕ
// ============================================
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!botToken) {
    throw new Error('Не задан TELEGRAM_BOT_TOKEN');
}
if (!serviceAccountJson) {
    throw new Error('Не задан FIREBASE_SERVICE_ACCOUNT_JSON');
}
// ============================================
// FIREBASE ADMIN
// ============================================
let serviceAccount;
try {
    serviceAccount = JSON.parse(serviceAccountJson);
} catch (error) {
    throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_JSON содержит некорректный JSON'
    );
}
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL:
        'https://parknear-bef41-default-rtdb.europe-west1.firebasedatabase.app'
});
const auth = admin.auth();
// ============================================
// ПРОВЕРКА ДАТЫ АВТОРИЗАЦИИ
// ============================================
function isAuthDateValid(authDate) {
    const date = Number(authDate);
    if (!Number.isFinite(date) || date <= 0) {
        return false;
    }
    const now = Math.floor(Date.now() / 1000);
    return (
        date <= now + 60 &&
        now - date <= MAX_AUTH_AGE_SECONDS
    );
}
// ============================================
// БЕЗОПАСНОЕ СРАВНЕНИЕ ХЕШЕЙ
// ============================================
function safeCompareHash(receivedHash, expectedHash) {
    if (
        typeof receivedHash !== 'string' ||
        !/^[a-f0-9]{64}$/i.test(receivedHash)
    ) {
        return false;
    }
    const received = Buffer.from(receivedHash, 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return (
        received.length === expected.length &&
        crypto.timingSafeEqual(received, expected)
    );
}
// ============================================
// TELEGRAM LOGIN WIDGET
// ============================================
function verifyTelegramWidget(userData) {
    if (
        !userData ||
        typeof userData !== 'object' ||
        Array.isArray(userData)
    ) {
        return false;
    }
    const receivedHash = userData.hash;
    if (
        !receivedHash ||
        !isAuthDateValid(userData.auth_date)
    ) {
        return false;
    }
    const dataCheckString = Object.keys(userData)
        .filter(key => key !== 'hash')
        .sort()
        .map(key => `${key}=${userData[key]}`)
        .join('\n');
    const secretKey = crypto
        .createHash('sha256')
        .update(botToken)
        .digest();
    const expectedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');
    return safeCompareHash(
        receivedHash,
        expectedHash
    );
}
// ============================================
// TELEGRAM MINI APP
// ============================================
function verifyTelegramWebApp(initData) {
    if (
        typeof initData !== 'string' ||
        !initData
    ) {
        return null;
    }
    const params = new URLSearchParams(initData);
    const receivedHash = params.get('hash');
    if (!receivedHash) {
        return null;
    }
    const authDate = params.get('auth_date');
    if (!isAuthDateValid(authDate)) {
        return null;
    }
    const dataCheckString = [...params.entries()]
        .filter(([key]) => key !== 'hash')
        .sort(([a], [b]) => {
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
        })
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();
    const expectedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');
    if (
        !safeCompareHash(receivedHash, expectedHash)
    ) {
        return null;
    }
    try {
        const userString = params.get('user');
        if (!userString) {
            return null;
        }
        const user = JSON.parse(userString);
        if (
            !user ||
            !user.id ||
            !/^\d+$/.test(String(user.id))
        ) {
            return null;
        }
        return user;
    } catch (error) {
        return null;
    }
}
// ============================================
// СОЗДАНИЕ FIREBASE CUSTOM TOKEN
// ============================================
async function createFirebaseToken(telegramUser) {
    if (
        !telegramUser ||
        !telegramUser.id ||
        !/^\d+$/.test(String(telegramUser.id))
    ) {
        throw new Error('Некорректный Telegram user ID');
    }
    const telegramId = String(telegramUser.id);
    // UID Firebase
    const uid = `tg_${telegramId}`;
    // Создаём Custom Token
    const customToken = await auth.createCustomToken(
        uid,
        {
            provider: 'telegram',
            telegramId: telegramId
        }
    );
    // Формируем проверенный профиль
    const user = {
        id: uid,
        telegramId: telegramId,
        username:
            telegramUser.username || 'tg_user',
        firstName:
            telegramUser.first_name ||
            telegramUser.firstName ||
            'Пользователь',
        photoUrl:
            telegramUser.photo_url ||
            telegramUser.photoUrl ||
            '',
        isGuest: false
    };
    return {
        customToken,
        uid,
        user
    };
}
// ============================================
// ПРОВЕРКА РАБОТОСПОСОБНОСТИ
// ============================================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Park Near Auth Server'
    });
});
// ============================================
// АВТОРИЗАЦИЯ TELEGRAM LOGIN WIDGET
// ============================================
app.post('/auth/telegram-widget', async (req, res) => {
    try {
        const userData = req.body?.user;
        // Проверяем подпись Telegram
        if (!verifyTelegramWidget(userData)) {
            return res.status(401).json({
                success: false,
                error: 'Не удалось подтвердить данные Telegram'
            });
        }
        // Создаём Firebase Custom Token
        const result = await createFirebaseToken(userData);
        return res.json({
            success: true,
            customToken: result.customToken,
            uid: result.uid,
            user: result.user
        });
    } catch (error) {
        console.error(
            'Ошибка Telegram Widget:',
            error.message
        );
        return res.status(500).json({
            success: false,
            error: 'Ошибка авторизации'
        });
    }
});
// ============================================
// АВТОРИЗАЦИЯ TELEGRAM MINI APP
// ============================================
app.post('/auth/telegram-webapp', async (req, res) => {
    try {
        const telegramUser = verifyTelegramWebApp(
            req.body?.initData
        );
        // Проверяем подпись Telegram
        if (!telegramUser) {
            return res.status(401).json({
                success: false,
                error: 'Не удалось подтвердить данные Telegram'
            });
        }
        // Создаём Firebase Custom Token
        const result = await createFirebaseToken(telegramUser);
        return res.json({
            success: true,
            customToken: result.customToken,
            uid: result.uid,
            user: result.user
        });
    } catch (error) {
        console.error(
            'Ошибка Telegram Mini App:',
            error.message
        );
        return res.status(500).json({
            success: false,
            error: 'Ошибка авторизации'
        });
    }
});
// ПРОВЕРКА ПОДКЛЮЧЕНИЯ POSTGRESQL
app.get('/health/db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');

        res.json({
            status: 'ok',
            database: 'connected',
            time: result.rows[0].now
        });
    } catch (error) {
        console.error('Ошибка PostgreSQL:', error.message);

        res.status(500).json({
            status: 'error',
            database: 'disconnected'
        });
    }
});
// ============================================
// ПОЛУЧЕНИЕ ПАРКОВОК ИЗ POSTGRESQL
// ============================================
app.get('/api/parkings', async (req, res) => {
    try {
        const city = String(req.query.city || '').trim();
        let result;
        if (city) {
            result = await pool.query(
                `SELECT id, data
                 FROM parkings
                 WHERE LOWER(TRIM(data->>'city')) = LOWER($1)
                 ORDER BY id`,
                [city]
            );
        } else {
            result = await pool.query(
                `SELECT id, data
                 FROM parkings
                 ORDER BY id`
            );
        }
        const parkings = result.rows.map(row => ({
            ...row.data,
            id: row.id
        }));
        res.json({
            success: true,
            count: parkings.length,
            parkings
        });
    } catch (error) {
        console.error('Ошибка получения парковок:', error.message);
        res.status(500).json({
            success: false,
            error: 'Не удалось загрузить парковки'
        });
    }
});
// ============================================
// ОБРАБОТКА НЕИЗВЕСТНЫХ МАРШРУТОВ
// ============================================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Маршрут не найден'
    });
});
// ============================================
// ОБРАБОТКА ОШИБОК JSON
// ============================================
app.use((error, req, res, next) => {
    console.error('Ошибка сервера:', error.message);
    if (error instanceof SyntaxError && error.status === 400) {
        return res.status(400).json({
            success: false,
            error: 'Некорректный JSON'
        });
    }
    return res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера'
    });
});
// ============================================
// ЗАПУСК СЕРВЕРА ПОСЛЕ ПРОВЕРКИ POSTGRESQL
// ============================================
async function startServer() {
    try {
        await initializeDatabase();

        app.listen(PORT, '0.0.0.0', () => {
            console.log(
                `Park Near API запущен на порту ${PORT}`
            );
        });
    } catch (error) {
        console.error(
            'Сервер не запущен: PostgreSQL недоступен:',
            error.message
        );
        process.exit(1);
    }
}
startServer();
