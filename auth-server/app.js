const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Адрес опубликованного приложения Park Near
const ALLOWED_ORIGIN =
    process.env.ALLOWED_ORIGIN ||
    'https://andrey8128-jpg.github.io';

// Максимальный возраст данных Telegram — 24 часа
const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;

app.use(cors({
    origin: ALLOWED_ORIGIN,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '100kb' }));

// Проверяем наличие секретных настроек
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!botToken) {
    throw new Error('Не задан TELEGRAM_BOT_TOKEN');
}

if (!serviceAccountJson) {
    throw new Error('Не задан FIREBASE_SERVICE_ACCOUNT_JSON');
}

// Подключаем Firebase Admin SDK
let serviceAccount;

try {
    serviceAccount = JSON.parse(serviceAccountJson);
} catch (error) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON содержит некорректный JSON');
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL:
        'https://parknear-bef41-default-rtdb.europe-west1.firebasedatabase.app'
});

const auth = admin.auth();

// Проверка срока действия авторизации
function isAuthDateValid(authDate) {
    const date = Number(authDate);

    if (!Number.isFinite(date)) {
        return false;
    }

    const now = Math.floor(Date.now() / 1000);

    return date <= now + 60 &&
        now - date <= MAX_AUTH_AGE_SECONDS;
}

// Безопасное сравнение хешей
function safeCompareHash(receivedHash, expectedHash) {
    if (
        typeof receivedHash !== 'string' ||
        !/^[a-f0-9]{64}$/i.test(receivedHash)
    ) {
        return false;
    }

    const received = Buffer.from(receivedHash, 'hex');
    const expected = Buffer.from(expectedHash, 'hex');

    return received.length === expected.length &&
        crypto.timingSafeEqual(received, expected);
}

// Проверка Telegram Login Widget
function verifyTelegramWidget(userData) {
    if (!userData || typeof userData !== 'object') {
        return false;
    }

    const receivedHash = userData.hash;

    if (!receivedHash || !isAuthDateValid(userData.auth_date)) {
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

    return safeCompareHash(receivedHash, expectedHash);
}

// Проверка Telegram Mini App initData
function verifyTelegramWebApp(initData) {
    if (typeof initData !== 'string' || !initData) {
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
        .sort(([a], [b]) => a.localeCompare(b))
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
        return JSON.parse(userString);
    } catch (error) {
        return null;
    }
}
// Проверяем данные пользователя и создаём Firebase Custom Token
async function createFirebaseToken(telegramUser) {
    if (
        !telegramUser ||
        !telegramUser.id ||
        !/^\d+$/.test(String(telegramUser.id))
    ) {
        throw new Error('Некорректный Telegram user ID');
    }
    const telegramId = String(telegramUser.id);
    const uid = `tg_${telegramId}`;
    const customToken = await auth.createCustomToken(uid, {
        provider: 'telegram',
        telegramId
    });
    return {
        customToken,
        uid,
        user: {
            id: uid,
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
            isGuest: false
        }
    };
}
