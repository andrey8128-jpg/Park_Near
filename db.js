// db.js
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config(); // Подключаем dotenv, чтобы читать .env локально

const client = new Client({
    user: process.env.DB_USER || 'gen_user',
    host: process.env.DB_HOST || '9df55aa7054cff298910dac3.twc1.net',
    database: process.env.DB_NAME || 'default_db',
    password: process.env.DB_PASSWORD, // Пароль будет браться из .env или GitHub Secrets
    port: process.env.DB_PORT || 5432,
    ssl: {
        rejectUnauthorized: true,
        // Ищем сертификат в папке certs внутри проекта
        ca: fs.readFileSync(path.join(__dirname, 'certs', 'root.crt'), 'utf-8')
    }
});

// Подключаемся
client.connect()
    .then(() => console.log('✅ Успешное подключение к PostgreSQL'))
    .catch(err => console.error('❌ Ошибка подключения к БД:', err.stack));

module.exports = client; // Экспортируем клиент, чтобы использовать его в других файлах
