const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');

// Инициализация Firebase Admin SDK
const serviceAccount = require('./path-to-firebase-adminsdk.json'); // путь к вашему ключу
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://parknear-bef41-default-rtdb.europe-west1.firebasedatabase.app'
});

const TOKEN = '8648392175:AAF0kTfggjxp0fJyNFqWuD-UfCn-72d62eI';
const bot = new TelegramBot(TOKEN, { polling: true });

const SITE_URL = 'https://andrey8128-jpg.github.io/Park_Near/';

bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const payload = match[1];

  if (payload.startsWith('login_')) {
    const token = payload.split('_')[1];
    const expires = Date.now() + 5 * 60 * 1000;

    // Сохраняем данные пользователя из Telegram
    const userData = {
      userId: userId,
      username: msg.from.username || '',
      firstName: msg.from.first_name || '',
      lastName: msg.from.last_name || '',
      photoUrl: '' // можно получить через getUserProfilePhotos, но оставим пустым
    };

    try {
      await admin.database().ref(`loginTokens/${token}`).set({
        userId: userId,
        expires: expires,
        userData: userData
      });

      const redirectUrl = `${SITE_URL}/?token=${token}`;
      await bot.sendMessage(chatId,
        `✅ Вы успешно авторизованы!\n\nНажмите на кнопку ниже, чтобы вернуться на сайт.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Вернуться на сайт', url: redirectUrl }]
            ]
          }
        }
      );
    } catch (err) {
      console.error('Ошибка сохранения токена:', err);
      bot.sendMessage(chatId, '❌ Произошла ошибка, попробуйте позже.');
    }
  } else {
    bot.sendMessage(chatId, 'Привет! Используйте кнопку "Войти" на сайте ParkNear.');
  }
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Привет! Используйте кнопку "Войти" на сайте ParkNear.');
});

console.log('Бот запущен...');
