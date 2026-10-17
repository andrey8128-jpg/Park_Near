const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const admin = require('firebase-admin');

// ⚠️ ВАЖНО: Сюда нужно вставить данные из вашего JSON-ключа Firebase
const serviceAccount = require('./path-to-your-firebase-service-account.json'); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
app.use(cors()); // Разрешаем запросы с вашего сайта
app.use(express.json());

// Эндпоинт, на который будет отправлять запрос ваш сайт
app.post('/api/yandex-login', async (req, res) => {
  const { code, redirectUri } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Код авторизации не предоставлен' });
  }

  try {
    // 1. Обмениваем код на access_token у Яндекса[reference:2]
    const tokenResponse = await fetch('https://oauth.yandex.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: 'a4c1372c585e4962bf9dfef4b5e14bf5', // Замените на ваш Client ID
        client_secret: 'e156b3e05ff94c34b484153c3fa3e97f', // Замените на ваш Client Secret
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(tokenData.error_description || 'Ошибка обмена кода');

    const accessToken = tokenData.access_token;

    // 2. Получаем профиль пользователя из Яндекса
    const userInfoResponse = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { 'Authorization': `OAuth ${accessToken}` }
    });
    const userInfo = await userInfoResponse.json();

    // 3. Создаем уникальный ID для Firebase на основе ID Яндекса
    const uid = `yandex:${userInfo.id}`;

    // 4. Генерируем Custom Token для Firebase[reference:3][reference:4]
    const customToken = await admin.auth().createCustomToken(uid);

    // 5. Отправляем токен и данные пользователя обратно на сайт
    res.json({
      firebaseToken: customToken,
      user: userInfo
    });
  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Запускаем сервер
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
