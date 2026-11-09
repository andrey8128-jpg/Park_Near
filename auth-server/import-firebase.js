'use strict';
const fs = require('fs');
const path = require('path');
require('dotenv').config({
    path: path.resolve(__dirname, '../.env')
});
const pool = require('./db');
function isObject(value) {
    return value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value);
}
function collectParkings(root) {
    const result = [];
    const seenIds = new Set();
    function visit(node, pathParts = []) {
        if (!isObject(node)) return;
        if (node.lat != null && node.lng != null) {
            const id = String(
                node.id || pathParts[pathParts.length - 1] || ''
            );
            if (!id) {
                throw new Error(
                    `Не найден ID парковки: ${pathParts.join('/')}`
                );
            }
            if (seenIds.has(id)) {
                throw new Error(`Повторный ID парковки: ${id}`);
            }
            seenIds.add(id);
            result.push({ id, data: node });
            return;
        }
        for (const [key, value] of Object.entries(node)) {
            visit(value, [...pathParts, key]);
        }
    }
    visit(root);
    return result;
}
function collectUsers(source) {
    return Object.entries(source).map(([id, data]) => ({
        id: String(id),
        data
    }));
}
function collectSessions(source) {
    return Object.entries(source).map(([id, data]) => ({
        id: String(id),
        data
    }));
}
function collectFavorites(users) {
    const result = [];
    for (const user of users) {
        const favorites = user.data.favorites;
        if (!isObject(favorites)) continue;
        for (const [key, value] of Object.entries(favorites)) {
            const parkingId = String(
                (isObject(value) && value.parkingId) || key
            );
            result.push({
                userId: user.id,
                parkingId
            });
        }
    }
    return result;
}
function collectPushSubscriptions(users) {
    const result = [];
    for (const user of users) {
        const subscriptions = user.data.pushSubscriptions;
        if (!isObject(subscriptions)) continue;
        for (const [key, data] of Object.entries(subscriptions)) {
            if (!isObject(data)) continue;
            result.push({
                id: `${user.id}:${key}`,
                userId: user.id,
                data
            });
        }
    }
    return result;
}
async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const inputArgument = args.find(
        arg => arg !== '--dry-run'
    );
    if (!inputArgument) {
        throw new Error(
            'Укажи путь к JSON-файлу резервной копии'
        );
    }
    const inputPath = path.resolve(
        process.cwd(),
        inputArgument
    );
    if (!fs.existsSync(inputPath)) {
        throw new Error('Файл резервной копии не найден');
    }
    const backup = JSON.parse(
        fs.readFileSync(inputPath, 'utf8')
    );
    for (const section of [
        'users',
        'parkings',
        'parkingSessions'
    ]) {
        if (!isObject(backup[section])) {
            throw new Error(
                `Отсутствует раздел ${section}`
            );
        }
    }
    const users = collectUsers(backup.users);
    const parkings = collectParkings(backup.parkings);
    const sessions = collectSessions(
        backup.parkingSessions
    );
    const favorites = collectFavorites(users);
    const subscriptions = collectPushSubscriptions(users);
    const userIds = new Set(users.map(x => x.id));
    const parkingIds = new Set(parkings.map(x => x.id));
    const missingFavoriteUsers = favorites.filter(
        x => !userIds.has(x.userId)
    );
    const missingFavoriteParkings = favorites.filter(
        x => !parkingIds.has(x.parkingId)
    );
    const missingSessionUsers = sessions.filter(
        x => x.data.userId &&
            !userIds.has(String(x.data.userId))
    );
    const missingSessionParkings = sessions.filter(
        x => x.data.parkingId &&
            !parkingIds.has(String(x.data.parkingId))
    );
    console.log('\nПроверка резервной копии:');
    console.log('Пользователи:', users.length);
    console.log('Парковки:', parkings.length);
    console.log('Сессии:', sessions.length);
    console.log(
        'Активные сессии:',
        sessions.filter(x => x.data.active === true).length
    );
    console.log('Избранное:', favorites.length);
    console.log('Push-подписки:', subscriptions.length);
    console.log(
        'Сессии без пользователя:',
        missingSessionUsers.length
    );
    console.log(
        'Сессии без парковки:',
        missingSessionParkings.length
    );
    if (
        missingFavoriteUsers.length ||
        missingFavoriteParkings.length
    ) {
        throw new Error(
            'Проверка избранного не пройдена. Импорт остановлен.'
        );
    }
    if (dryRun) {
        console.log(
            '\nПроверка завершена. Записи в базу не выполнялись.'
        );
        return;
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const user of users) {
            await client.query(
                `INSERT INTO users (id, data)
                 VALUES ($1, $2::jsonb)
                 ON CONFLICT (id)
                 DO UPDATE SET data = EXCLUDED.data`,
                [user.id, JSON.stringify(user.data)]
            );
        }
        for (const parking of parkings) {
            await client.query(
                `INSERT INTO parkings (id, data)
                 VALUES ($1, $2::jsonb)
                 ON CONFLICT (id)
                 DO UPDATE SET data = EXCLUDED.data`,
                [parking.id, JSON.stringify(parking.data)]
            );
        }
        for (const session of sessions) {
            await client.query(
                `INSERT INTO parking_sessions (id, data)
                 VALUES ($1, $2::jsonb)
                 ON CONFLICT (id)
                 DO UPDATE SET data = EXCLUDED.data`,
                [session.id, JSON.stringify(session.data)]
            );
        }
        for (const favorite of favorites) {
            await client.query(
                `INSERT INTO favorites (user_id, parking_id)
                 VALUES ($1, $2)
                 ON CONFLICT (user_id, parking_id)
                 DO NOTHING`,
                [favorite.userId, favorite.parkingId]
            );
        }
        for (const subscription of subscriptions) {
            await client.query(
                `INSERT INTO push_subscriptions
                 (id, user_id, data)
                 VALUES ($1, $2, $3::jsonb)
                 ON CONFLICT (id)
                 DO UPDATE SET
                    user_id = EXCLUDED.user_id,
                    data = EXCLUDED.data`,
                [
                    subscription.id,
                    subscription.userId,
                    JSON.stringify(subscription.data)
                ]
            );
        }
        await client.query('COMMIT');
        console.log('\nИмпорт завершён.');
        for (const table of [
            'users',
            'parkings',
            'parking_sessions',
            'favorites',
            'push_subscriptions'
        ]) {
            const result = await client.query(
                `SELECT COUNT(*)::int AS count FROM ${table}`
            );
            console.log(
                `${table}:`,
                result.rows[0].count
            );
        }
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
main()
    .catch(error => {
        console.error('\nОШИБКА:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
