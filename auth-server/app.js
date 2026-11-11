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
        CREATE TABLE IF NOT EXISTS auth_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL
                REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        `,
        `
        CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
        ON auth_sessions (user_id)
        `,
        `
        CREATE TABLE IF NOT EXISTS login_tokens (
            token TEXT PRIMARY KEY,
            data JSONB NOT NULL,
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
const BOT_API_SECRET = process.env.BOT_API_SECRET;

if (!BOT_API_SECRET || BOT_API_SECRET.length < 32) {
    throw new Error(
        'BOT_API_SECRET не задан или слишком короткий'
    );
}

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

    if (!safeCompareHash(receivedHash, expectedHash)) {
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
// СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ И СЕССИИ В POSTGRESQL
// ============================================
async function createPostgresSession(telegramUser) {
    if (
        !telegramUser ||
        !telegramUser.id ||
        !/^\d+$/.test(String(telegramUser.id))
    ) {
        throw new Error('Некорректный Telegram user ID');
    }

    const telegramId = String(telegramUser.id);
    const userId = `tg_${telegramId}`;
    const now = Date.now();

    const user = {
        id: userId,
        telegramId,
        username: telegramUser.username || 'tg_user',
        firstName:
            telegramUser.first_name ||
            telegramUser.firstName ||
            'Пользователь',
        photoUrl:
            telegramUser.photo_url ||
            telegramUser.photoUrl ||
            '',
        isGuest: false,
        lastActive: now
    };

    const initialStats = {
        registeredAt: now,
        lastActive: now,
        parkingsCreated: 0,
        parkingsUpdated: 0,
        confirmations: 0,
        views: 0,
        favorites: 0,
        activeDates: [
            new Date().toISOString().split('T')[0]
        ]
    };

    // Генерируем случайный токен и сохраняем в БД только его SHA-256.
    const sessionToken = crypto.randomBytes(32).toString('hex');

    const tokenHash = crypto
        .createHash('sha256')
        .update(sessionToken)
        .digest('hex');

    const sessionId = crypto.randomBytes(16).toString('hex');

    const expiresAt = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
    );

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Создаём пользователя или обновляем его профиль,
        // сохраняя уже существующую статистику.
        await client.query(
            `INSERT INTO users (id, data)
             VALUES ($1, $2::jsonb)
             ON CONFLICT (id)
             DO UPDATE SET data =
                COALESCE(users.data, '{}'::jsonb)
                || EXCLUDED.data
                || jsonb_build_object(
                    'stats',
                    COALESCE(
                        users.data->'stats',
                        EXCLUDED.data->'stats'
                    )
                )`,
            [
                userId,
                JSON.stringify({
                    ...user,
                    stats: initialStats
                })
            ]
        );

        // Создаём серверную сессию.
        await client.query(
            `INSERT INTO auth_sessions
                (id, user_id, token_hash, expires_at)
             VALUES ($1, $2, $3, $4)`,
            [
                sessionId,
                userId,
                tokenHash,
                expiresAt
            ]
        );

        // Удаляем просроченные сессии.
        await client.query(
            `DELETE FROM auth_sessions
             WHERE expires_at <= NOW()`
        );

        await client.query('COMMIT');

        return {
            sessionToken,
            uid: userId,
            user,
            expiresAt: expiresAt.toISOString()
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// ============================================
// ПРОВЕРКА СЕССИИ PARK NEAR
// ============================================
async function requireAuth(req, res, next) {
    try {
        const authorization = req.headers.authorization || '';
        const match = authorization.match(/^Bearer ([a-f0-9]{64})$/i);

        if (!match) {
            return res.status(401).json({
                success: false,
                error: 'Требуется авторизация'
            });
        }

        const tokenHash = crypto
            .createHash('sha256')
            .update(match[1])
            .digest('hex');

        const result = await pool.query(
            `SELECT
                s.id AS session_id,
                u.id AS user_id,
                u.data AS user_data
             FROM auth_sessions s
             JOIN users u ON u.id = s.user_id
             WHERE s.token_hash = $1
               AND s.expires_at > NOW()
             LIMIT 1`,
            [tokenHash]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Сессия истекла или недействительна'
            });
        }

        req.authUser = {
            id: result.rows[0].user_id,
            ...result.rows[0].user_data
        };

        req.authSessionId = result.rows[0].session_id;
        next();
    } catch (error) {
        console.error('Ошибка проверки сессии:', error.message);

        return res.status(500).json({
            success: false,
            error: 'Ошибка проверки авторизации'
        });
    }
}
// ============================================
// ПОЛУЧЕНИЕ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
// ============================================
app.get('/auth/me', requireAuth, (req, res) => {
    res.json({
        success: true,
        user: req.authUser
    });
});

// ============================================
// ЗАВЕРШЕНИЕ СЕССИИ
// ============================================
app.post('/auth/logout', requireAuth, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM auth_sessions WHERE id = $1',
            [req.authSessionId]
        );

        return res.json({
            success: true
        });
    } catch (error) {
        console.error('Ошибка завершения сессии:', error.message);

        return res.status(500).json({
            success: false,
            error: 'Не удалось завершить сессию'
        });
    }
});
// ============================================
// СОЗДАНИЕ ГОСТЕВОЙ СЕССИИ
// ============================================
app.post('/auth/guest', async (req, res) => {
    const client = await pool.connect();
    try {
        const now = Date.now();
        // ID и токен создаются сервером.
        const guestId =
            `guest_${crypto.randomBytes(16).toString('hex')}`;
        const sessionToken =
            crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto
            .createHash('sha256')
            .update(sessionToken)
            .digest('hex');
        const sessionId =
            crypto.randomBytes(16).toString('hex');
        const expiresAt = new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
        );
        const user = {
            id: guestId,
            username: 'guest',
            firstName: 'Гость',
            photoUrl: '',
            isGuest: true,
            lastActive: now,
            stats: {
                registeredAt: now,
                lastActive: now,
                parkingsCreated: 0,
                parkingsUpdated: 0,
                confirmations: 0,
                views: 0,
                favorites: 0,
                activeDates: [
                    new Date().toISOString().split('T')[0]
                ]
            }
        };
        await client.query('BEGIN');
        await client.query(
            `INSERT INTO users (id, data)
             VALUES ($1, $2::jsonb)`,
            [guestId, JSON.stringify(user)]
        );
        await client.query(
            `INSERT INTO auth_sessions
                (id, user_id, token_hash, expires_at)
             VALUES ($1, $2, $3, $4)`,
            [sessionId, guestId, tokenHash, expiresAt]
        );
        await client.query('COMMIT');
        return res.json({
            success: true,
            sessionToken,
            expiresAt: expiresAt.toISOString(),
            user
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(
            'Ошибка создания гостевой сессии:',
            error.message
        );
        return res.status(500).json({
            success: false,
            error: 'Не удалось создать гостевую сессию'
        });
    } finally {
        client.release();
    }
});
// ============================================
// ОБМЕН ОДНОРАЗОВОГО TELEGRAM-ТОКЕНА НА СЕССИЮ
// ============================================
app.post('/auth/telegram-token-login', async (req, res) => {
    const { token } = req.body || {};

    if (
        typeof token !== 'string' ||
        token.length < 16 ||
        token.length > 256
    ) {
        return res.status(400).json({
            success: false,
            error: 'Некорректный токен авторизации'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Блокируем запись, чтобы один токен нельзя было
        // одновременно использовать в нескольких запросах.
        const tokenResult = await client.query(
            `SELECT data
             FROM login_tokens
             WHERE token = $1
             FOR UPDATE`,
            [token]
        );

        if (tokenResult.rows.length === 0) {
            await client.query('ROLLBACK');

            return res.status(401).json({
                success: false,
                error: 'Токен не найден или уже использован'
            });
        }

        const tokenData = tokenResult.rows[0].data;
        const expires = Number(tokenData.expires);
        const userId = String(tokenData.userId || '');

        if (
            !Number.isFinite(expires) ||
            expires <= Date.now() ||
            !/^tg_\d+$/.test(userId)
        ) {
            await client.query(
                'DELETE FROM login_tokens WHERE token = $1',
                [token]
            );

            await client.query('COMMIT');

            return res.status(401).json({
                success: false,
                error: 'Токен истёк или содержит некорректные данные'
            });
        }

        // Получаем существующего пользователя из PostgreSQL.
        const userResult = await client.query(
            `SELECT id, data
             FROM users
             WHERE id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');

            return res.status(401).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }

        const sessionToken = crypto.randomBytes(32).toString('hex');

        const tokenHash = crypto
            .createHash('sha256')
            .update(sessionToken)
            .digest('hex');

        const sessionId = crypto.randomBytes(16).toString('hex');

        const expiresAt = new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
        );

        await client.query(
            `INSERT INTO auth_sessions
                (id, user_id, token_hash, expires_at)
             VALUES ($1, $2, $3, $4)`,
            [sessionId, userId, tokenHash, expiresAt]
        );

        // Удаляем временный токен после успешного обмена.
        await client.query(
            'DELETE FROM login_tokens WHERE token = $1',
            [token]
        );

        await client.query('COMMIT');

        const userData = userResult.rows[0].data;

        return res.json({
            success: true,
            sessionToken,
            uid: userId,
            user: {
                ...userData,
                id: userId
            },
            expiresAt: expiresAt.toISOString()
        });
    } catch (error) {
        await client.query('ROLLBACK');

        console.error(
            'Ошибка обмена Telegram-токена:',
            error.message
        );

        return res.status(500).json({
            success: false,
            error: 'Не удалось выполнить авторизацию'
        });
    } finally {
        client.release();
    }
});

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

        if (!verifyTelegramWidget(userData)) {
            return res.status(401).json({
                success: false,
                error: 'Не удалось подтвердить данные Telegram'
            });
        }

        const result = await createPostgresSession(userData);
        return res.json({
            success: true,
            sessionToken: result.sessionToken,
            uid: result.uid,
            user: result.user,
            expiresAt: result.expiresAt
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
        if (!telegramUser) {
            return res.status(401).json({
                success: false,
                error: 'Не удалось подтвердить данные Telegram'
            });
        }
        const result = await createPostgresSession(telegramUser);
        return res.json({
            success: true,
            sessionToken: result.sessionToken,
            uid: result.uid,
            user: result.user,
            expiresAt: result.expiresAt
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
// ============================================
// СОХРАНЕНИЕ TELEGRAM LOGIN TOKEN ОТ БОТА
// ============================================
app.post('/api/bot/login-token', async (req, res) => {
    try {
        const receivedSecret = req.headers['x-bot-api-secret'];
        if (
            typeof receivedSecret !== 'string' ||
            receivedSecret.length !== BOT_API_SECRET.length ||
            !crypto.timingSafeEqual(
                Buffer.from(receivedSecret),
                Buffer.from(BOT_API_SECRET)
            )
        ) {
            return res.status(401).json({
                success: false,
                error: 'Доступ запрещён'
            });
        }
        const { token, userData } = req.body || {};
        if (
            typeof token !== 'string' ||
            !/^[a-f0-9]{32,128}$/i.test(token) ||
            !userData ||
            !/^\d+$/.test(String(userData.userId || ''))
        ) {
            return res.status(400).json({
                success: false,
                error: 'Некорректные данные'
            });
        }
        const telegramId = String(userData.userId);
        const userId = `tg_${telegramId}`;
        const now = Date.now();
        const user = {
            id: userId,
            telegramId,
            username: userData.username || 'tg_user',
            firstName: userData.firstName || 'Пользователь',
            lastName: userData.lastName || '',
            photoUrl: userData.photoUrl || '',
            isGuest: false,
            lastActive: now
        };
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(
                `INSERT INTO users (id, data)
                 VALUES ($1, $2::jsonb)
                 ON CONFLICT (id)
                 DO UPDATE SET data =
                    COALESCE(users.data, '{}'::jsonb)
                    || EXCLUDED.data
                    || jsonb_build_object(
                        'stats',
                        COALESCE(
                            users.data->'stats',
                            EXCLUDED.data->'stats'
                        )
                    )`,
                [
                    userId,
                    JSON.stringify({
                        ...user,
                        stats: {
                            registeredAt: now,
                            lastActive: now,
                            parkingsCreated: 0,
                            parkingsUpdated: 0,
                            confirmations: 0,
                            views: 0,
                            favorites: 0,
                            activeDates: [
                                new Date().toISOString().split('T')[0]
                            ]
                        }
                    })
                ]
            );
            await client.query(
                `INSERT INTO login_tokens (token, data)
                 VALUES ($1, $2::jsonb)`,
                [
                    token,
                    JSON.stringify({
                        userId,
                        expires: now + 5 * 60 * 1000,
                        userData: user
                    })
                ]
            );
            await client.query('COMMIT');
            return res.json({
                success: true
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error(
            'Ошибка сохранения Telegram-токена:',
            error.message
        );
        return res.status(500).json({
            success: false,
            error: 'Не удалось сохранить токен'
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
// АКТИВНАЯ ПАРКОВОЧНАЯ СЕССИЯ: ПОЛУЧЕНИЕ
// ============================================
app.get('/api/parking-sessions/active', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, data
             FROM parking_sessions
             WHERE data->>'userId' = $1
               AND data->>'active' = 'true'
             ORDER BY created_at DESC
             LIMIT 1`,
            [String(req.authUser.id)]
        );
        if (result.rows.length === 0) {
            return res.json({
                success: true,
                session: null
            });
        }
        return res.json({
            success: true,
            session: {
                id: result.rows[0].id,
                ...result.rows[0].data
            }
        });
    } catch (error) {
        console.error('Ошибка получения активной парковки:', error);
        return res.status(500).json({
            success: false,
            error: 'Не удалось получить активную парковку'
        });
    }
});
// ============================================
// НАЧАЛО ПАРКОВОЧНОЙ СЕССИИ
// ============================================
app.post('/api/parking-sessions', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
        const parkingId = String(req.body?.parkingId || '');
        const userId = String(req.authUser.id);
        if (!parkingId) {
            return res.status(400).json({
                success: false,
                error: 'Не указан идентификатор парковки'
            });
        }
        await client.query('BEGIN');
        // Не допускаем две одновременные активные сессии одного пользователя.
        await client.query(
            'SELECT pg_advisory_xact_lock(hashtext($1))',
            [userId]
        );
        const existing = await client.query(
            `SELECT id
             FROM parking_sessions
             WHERE data->>'userId' = $1
               AND data->>'active' = 'true'
             LIMIT 1`,
            [userId]
        );
        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');

            return res.status(409).json({
                success: false,
                error: 'У вас уже есть активная парковка'
            });
        }
        const parkingResult = await client.query(
            `SELECT id, data
             FROM parkings
             WHERE id = $1
             FOR UPDATE`,
            [parkingId]
        );
        if (parkingResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Парковка не найдена'
            });
        }
        const parking = parkingResult.rows[0].data;
        const total = Math.max(0, Number(parking.totalSpots) || 0);
        const occupied = Math.max(0, Number(parking.occupiedSpots) || 0);
        if (total > 0 && occupied >= total) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                success: false,
                error: 'Свободных мест больше нет'
            });
        }
        const startedAt = Date.now();
        const sessionId = crypto.randomUUID();
        const session = {
            parkingId,
            userId,
            startedAt,
            endedAt: null,
            active: true
        };
        const updatedParking = {
            ...parking,
            occupiedSpots: occupied + 1
        };
        await client.query(
            `UPDATE parkings
             SET data = $2::jsonb
             WHERE id = $1`,
            [parkingId, JSON.stringify(updatedParking)]
        );
        await client.query(
            `INSERT INTO parking_sessions (id, data)
             VALUES ($1, $2::jsonb)`,
            [sessionId, JSON.stringify(session)]
        );
        await client.query('COMMIT');
        return res.status(201).json({
            success: true,
            session: {
                id: sessionId,
                ...session
            },
            parking: {
                ...updatedParking,
                id: parkingId
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка начала парковки:', error);
        return res.status(500).json({
            success: false,
            error: 'Не удалось начать парковочную сессию'
        });
    } finally {
        client.release();
    }
});
// ============================================
// ЗАВЕРШЕНИЕ АКТИВНОЙ ПАРКОВОЧНОЙ СЕССИИ
// ============================================
app.delete(
    '/api/parking-sessions/active/:parkingId',
    requireAuth,
    async (req, res) => {
        const client = await pool.connect();
        try {
            const parkingId = String(req.params.parkingId);
            const userId = String(req.authUser.id);
            await client.query('BEGIN');
            await client.query(
                'SELECT pg_advisory_xact_lock(hashtext($1))',
                [userId]
            );
            const sessionResult = await client.query(
                `SELECT id, data
                 FROM parking_sessions
                 WHERE data->>'userId' = $1
                   AND data->>'parkingId' = $2
                   AND data->>'active' = 'true'
                 ORDER BY created_at DESC
                 LIMIT 1
                 FOR UPDATE`,
                [userId, parkingId]
            );
            if (sessionResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    error: 'Активная парковочная сессия не найдена'
                });
            }
            const sessionRow = sessionResult.rows[0];
            const endedAt = Date.now();
            const updatedSession = {
                ...sessionRow.data,
                active: false,
                endedAt
            };
            const parkingResult = await client.query(
                `SELECT id, data
                 FROM parkings
                 WHERE id = $1
                 FOR UPDATE`,
                [parkingId]
            );
            if (parkingResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    error: 'Парковка не найдена'
                });
            }
            const parking = parkingResult.rows[0].data;
            const updatedParking = {
                ...parking,
                occupiedSpots: Math.max(
                    0,
                    (Number(parking.occupiedSpots) || 0) - 1
                )
            };
            await client.query(
                `UPDATE parking_sessions
                 SET data = $2::jsonb
                 WHERE id = $1`,
                [
                    sessionRow.id,
                    JSON.stringify(updatedSession)
                ]
            );
            await client.query(
                `UPDATE parkings
                 SET data = $2::jsonb
                 WHERE id = $1`,
                [parkingId, JSON.stringify(updatedParking)]
            );
            await client.query('COMMIT');
            return res.json({
                success: true,
                session: {
                    id: sessionRow.id,
                    ...updatedSession
                },
                parking: {
                    ...updatedParking,
                    id: parkingId
                }
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Ошибка завершения парковки:', error);
            return res.status(500).json({
                success: false,
                error: 'Не удалось завершить парковочную сессию'
            });
        } finally {
            client.release();
        }
    }
);

// ============================================
// ПОЛУЧЕНИЕ ОДНОЙ ПАРКОВКИ
// ============================================
app.get('/api/parkings/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, data FROM parkings WHERE id = $1',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Парковка не найдена'
            });
        }

        return res.json({
            success: true,
            parking: {
                ...result.rows[0].data,
                id: result.rows[0].id
            }
        });
    } catch (error) {
        console.error('Ошибка получения парковки:', error);

        return res.status(500).json({
            success: false,
            error: 'Не удалось получить парковку'
        });
    }
});

// ============================================
// ПОЛУЧЕНИЕ ИСТОРИИ ПАРКОВКИ
// ============================================
app.get('/api/parkings/:id/history', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT data FROM parkings WHERE id = $1',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Парковка не найдена'
            });
        }

        const history = result.rows[0].data?.history || [];
        const entries = Array.isArray(history)
            ? history
            : Object.values(history);

        const limit = Math.min(
            100,
            Math.max(1, Number(req.query.limit) || 10)
        );

        return res.json({
            success: true,
            total: entries.length,
            history: entries
                .filter(Boolean)
                .sort((a, b) =>
                    Number(b.timestamp) - Number(a.timestamp)
                )
                .slice(0, limit)
        });
    } catch (error) {
        console.error('Ошибка истории парковки:', error);

        return res.status(500).json({
            success: false,
            error: 'Не удалось загрузить историю'
        });
    }
});

// ============================================
// УЧЁТ ПРОСМОТРОВ ПАРКОВКИ
// ============================================
app.post(
    '/api/parkings/:id/view',
    requireAuth,
    async (req, res) => {
        try {
            const result = await pool.query(
                `UPDATE parkings
                 SET data = jsonb_set(
                     COALESCE(data, '{}'::jsonb),
                     '{views}',
                     to_jsonb(
                         COALESCE((data->>'views')::integer, 0) + 1
                     ),
                     true
                 )
                 WHERE id = $1
                   AND data->>'authorId' <> $2
                 RETURNING data`,
                [req.params.id, String(req.authUser.id)]
            );

            return res.json({
                success: true,
                counted: result.rowCount > 0
            });
        } catch (error) {
            console.error('Ошибка учёта просмотра:', error);

            return res.status(500).json({
                success: false,
                error: 'Не удалось учесть просмотр'
            });
        }
    }
);

// ============================================
// ПОДТВЕРЖДЕНИЕ ПАРКОВКИ
// ============================================
app.post(
    '/api/parkings/:id/confirm',
    requireAuth,
    async (req, res) => {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const result = await client.query(
                `SELECT data
                 FROM parkings
                 WHERE id = $1
                 FOR UPDATE`,
                [req.params.id]
            );

            if (result.rows.length === 0) {
                await client.query('ROLLBACK');

                return res.status(404).json({
                    success: false,
                    error: 'Парковка не найдена'
                });
            }

            const parking = result.rows[0].data || {};

            if (
                String(parking.authorId) ===
                String(req.authUser.id)
            ) {
                await client.query('ROLLBACK');

                return res.status(400).json({
                    success: false,
                    error: 'Нельзя подтверждать собственную парковку'
                });
            }

            const updated = await client.query(
                `UPDATE users
                 SET data = jsonb_set(
                     COALESCE(data, '{}'::jsonb),
                     '{stats}',
                     COALESCE(data->'stats', '{}'::jsonb) ||
                     jsonb_build_object(
                         'confirmations',
                         COALESCE(
                             (data #>> '{stats,confirmations}')::integer,
                             0
                         ) + 1
                     ),
                     true
                 )
                 WHERE id = $1`,
                [parking.authorId]
            );

            await client.query('COMMIT');

            return res.json({
                success: true,
                counted: updated.rowCount > 0
            });

        } catch (error) {
            await client.query('ROLLBACK');

            console.error('Ошибка подтверждения парковки:', error);

            return res.status(500).json({
                success: false,
                error: 'Не удалось подтвердить парковку'
            });
        } finally {
            client.release();
        }
    }
);

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
// СОЗДАНИЕ ПАРКОВКИ В POSTGRESQL
// ============================================
app.post('/api/parkings', requireAuth, async (req, res) => {
    const parking = req.body || {};
    const city = String(parking.city || '').trim();
    const street = String(parking.street || '').trim();
    const houseNumber = String(parking.houseNumber || '').trim();
    const totalSpots = Number(parking.totalSpots);
    const lat = Number(parking.lat);
    const lng = Number(parking.lng);
    const coordinates = parking.coordinates;

    if (
        !Number.isInteger(totalSpots) ||
        totalSpots < 1 ||
        totalSpots > 500
    ) {
        return res.status(400).json({
            success: false,
            error: 'Количество мест должно быть от 1 до 500'
        });
    }

    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 || lat > 90 ||
        lng < -180 || lng > 180
    ) {
        return res.status(400).json({
            success: false,
            error: 'Некорректные координаты'
        });
    }

    if (
        !Array.isArray(coordinates) ||
        coordinates.length < 3 ||
        !coordinates.every(point =>
            Array.isArray(point) &&
            point.length >= 2 &&
            Number.isFinite(Number(point[0])) &&
            Number.isFinite(Number(point[1])) &&
            Number(point[0]) >= -90 &&
            Number(point[0]) <= 90 &&
            Number(point[1]) >= -180 &&
            Number(point[1]) <= 180
        )
    ) {
        return res.status(400).json({
            success: false,
            error: 'Некорректный контур парковки'
        });
    }

    const cleanKeyPart = value =>
        String(value || '')
            .trim()
            .replace(/[.#$\/\[\]]/g, '')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');

    const cityKey = cleanKeyPart(city) || 'Неизвестный_город';
    const streetKey = cleanKeyPart(street) || 'Неизвестная_улица';
    const houseKey = cleanKeyPart(houseNumber) || 'Без_дома';
    const baseKey = `${cityKey}_${streetKey}_${houseKey}`;
    const now = Date.now();
    const user = req.authUser;

    const parkingData = {
        lat,
        lng,
        coordinates,
        totalSpots,
        occupiedSpots: 0,
        name: String(parking.name || '').trim(),
        groupId: cityKey,
        isPaid: false,
        address: String(parking.address || '').trim(),
        city,
        region: String(parking.region || '').trim(),
        street,
        houseNumber,
        authorId: user.id,
        authorName: user.firstName || user.username || '',
        authorUsername: user.username || '',
        lastUpdatedAt: now,
        lastUpdatedBy:
            user.nickname ||
            user.firstName ||
            user.username ||
            'Пользователь',
        timestamp: now,
        status: 'unknown',
        statusConfirmations: 0,
        history: [{
            action: 'created',
            timestamp: now,
            userId: user.id,
            username: user.username || ''
        }]
    };

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        let parkingId = null;

        for (let number = 1; number <= 50; number++) {
            const candidate = `${baseKey}(${number})`;

            const result = await client.query(
                `INSERT INTO parkings (id, data)
                 VALUES ($1, $2::jsonb)
                 ON CONFLICT (id) DO NOTHING
                 RETURNING id`,
                [candidate, JSON.stringify(parkingData)]
            );

            if (result.rowCount > 0) {
                parkingId = candidate;
                break;
            }
        }

        if (!parkingId) {
            await client.query('ROLLBACK');

            return res.status(409).json({
                success: false,
                error: 'Не удалось подобрать свободный идентификатор парковки'
            });
        }

        await client.query(
            `UPDATE users
             SET data = jsonb_set(
                 COALESCE(data, '{}'::jsonb),
                 '{stats,parkingsCreated}',
                 to_jsonb(
                     COALESCE(
                         (data->'stats'->>'parkingsCreated')::integer,
                         0
                     ) + 1
                 ),
                 true
             )
             WHERE id = $1`,
            [user.id]
        );

        await client.query('COMMIT');

        return res.status(201).json({
            success: true,
            id: parkingId,
            parking: {
                ...parkingData,
                id: parkingId
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка создания парковки:', error.message);

        return res.status(500).json({
            success: false,
            error: 'Не удалось сохранить парковку'
        });
    } finally {
        client.release();
    }
});

// ============================================
// РЕДАКТИРОВАНИЕ ПАРКОВКИ
// ============================================
app.put('/api/parkings/:id', requireAuth, async (req, res) => {
    const client = await pool.connect();

    try {
        const { name, street, houseNumber, totalSpots, description } = req.body;

        if (!name || !String(name).trim()) {
            return res.status(400).json({
                success: false,
                error: 'Введите название парковки'
            });
        }

        if (!street?.trim() && !houseNumber?.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Укажите улицу или номер дома'
            });
        }

        if (
            !Number.isInteger(totalSpots) ||
            totalSpots < 1 ||
            totalSpots > 500
        ) {
            return res.status(400).json({
                success: false,
                error: 'Количество мест должно быть от 1 до 500'
            });
        }

        await client.query('BEGIN');

        const result = await client.query(
            'SELECT data FROM parkings WHERE id = $1 FOR UPDATE',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');

            return res.status(404).json({
                success: false,
                error: 'Парковка не найдена'
            });
        }

        const parking = result.rows[0].data;

        if (String(parking.authorId) !== String(req.authUser.id)) {
            await client.query('ROLLBACK');

            return res.status(403).json({
                success: false,
                error: 'Редактировать парковку может только её автор'
            });
        }

        const updates = {
            name: String(name).trim(),
            street: String(street || '').trim(),
            houseNumber: String(houseNumber || '').trim(),
            totalSpots,
            description: String(description || '').trim(),
            address: [
                String(street || '').trim(),
                String(houseNumber || '').trim()
            ].filter(Boolean).join(', ')
        };

        const updated = await client.query(
            `UPDATE parkings
             SET data = data || $2::jsonb
             WHERE id = $1
             RETURNING data`,
            [req.params.id, JSON.stringify(updates)]
        );

        await client.query(
            `UPDATE users
             SET data = jsonb_set(
                 COALESCE(data, '{}'::jsonb),
                 '{stats}',
                 COALESCE(data->'stats', '{}'::jsonb) ||
                 jsonb_build_object(
                     'parkingsUpdated',
                     COALESCE((data #>> '{stats,parkingsUpdated}')::int, 0) + 1
                 ),
                 true
             )
             WHERE id = $1`,
            [req.authUser.id]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            parking: updated.rows[0].data
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка редактирования парковки:', error);

        res.status(500).json({
            success: false,
            error: 'Не удалось обновить парковку'
        });
    } finally {
        client.release();
    }
});

// ============================================
// УДАЛЕНИЕ ПАРКОВКИ В POSTGRESQL
// ============================================
app.delete('/api/parkings/:id', requireAuth, async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const result = await client.query(
            'SELECT data FROM parkings WHERE id = $1 FOR UPDATE',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');

            return res.status(404).json({
                success: false,
                error: 'Парковка не найдена'
            });
        }

        const parking = result.rows[0].data;

        if (String(parking.authorId) !== String(req.authUser.id)) {
            await client.query('ROLLBACK');

            return res.status(403).json({
                success: false,
                error: 'Удалять парковку может только её автор'
            });
        }

        await client.query(
            'DELETE FROM parkings WHERE id = $1',
            [req.params.id]
        );

        await client.query('COMMIT');

        return res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка удаления парковки:', error);

        return res.status(500).json({
            success: false,
            error: 'Не удалось удалить парковку'
        });
    } finally {
        client.release();
    }
});

// ============================================
// ИЗМЕНЕНИЕ ЗАНЯТОСТИ ПАРКОВКИ В POSTGRESQL
// ============================================
app.patch('/api/parkings/:id/occupancy', requireAuth, async (req, res) => {
    const delta = Number(req.body?.delta);

    if (delta !== 1 && delta !== -1) {
        return res.status(400).json({
            success: false,
            error: 'Допустимо изменить занятость только на одно место'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const result = await client.query(
            'SELECT data FROM parkings WHERE id = $1 FOR UPDATE',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');

            return res.status(404).json({
                success: false,
                error: 'Парковка не найдена'
            });
        }

        const parking = result.rows[0].data || {};
        const total = Number(parking.totalSpots || 0);
        const previousOccupied = Number(parking.occupiedSpots || 0);
        const newOccupied = previousOccupied + delta;

        if (
            !Number.isInteger(total) ||
            !Number.isInteger(previousOccupied) ||
            newOccupied < 0 ||
            newOccupied > total
        ) {
            await client.query('ROLLBACK');

            return res.status(400).json({
                success: false,
                error: 'Нельзя изменить занятость: достигнут предел мест'
            });
        }

        const now = Date.now();

        const username =
            req.authUser.nickname ||
            req.authUser.firstName ||
            req.authUser.username ||
            'Пользователь';

        const historyEntry = {
            action: delta < 0 ? 'freed' : 'occupied',
            timestamp: now,
            userId: req.authUser.id,
            username,
            previousOccupied,
            newOccupied
        };

        // История из Firebase могла быть объектом, новая история — массивом.
        const previousHistory = Array.isArray(parking.history)
            ? parking.history
            : Object.values(parking.history || {});

        const updatedParking = {
            ...parking,
            occupiedSpots: newOccupied,
            lastUpdatedAt: now,
            lastUpdatedBy: username,
            history: [...previousHistory, historyEntry]
        };

        await client.query(
            'UPDATE parkings SET data = $2::jsonb WHERE id = $1',
            [req.params.id, JSON.stringify(updatedParking)]
        );

        await client.query('COMMIT');

        return res.json({
            success: true,
            previousOccupied,
            occupiedSpots: newOccupied,
            parking: {
                ...updatedParking,
                id: req.params.id
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка изменения занятости:', error);

        return res.status(500).json({
            success: false,
            error: 'Не удалось изменить занятость парковки'
        });
    } finally {
        client.release();
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
