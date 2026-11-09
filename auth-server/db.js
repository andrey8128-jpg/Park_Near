const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: Number(process.env.PGPORT || 5432),
    ssl: {
        rejectUnauthorized: true,
        ca: fs.readFileSync(
            path.join(__dirname, 'certs', 'ca.crt'),
            'utf8'
        )
    }
});

pool.on('error', (err) => {
    console.error('Ошибка PostgreSQL:', err.message);
});

module.exports = pool;
