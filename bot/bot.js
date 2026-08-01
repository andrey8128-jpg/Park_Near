const SITE_URL = 'https://andrey8128-jpg.github.io/Park_Near';

bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const payload = match[1];

  if (payload.startsWith('login_')) {
    const token = payload.split('_')[1];
    const expires = Date.now() + 5 * 60 * 1000;

    const userData = {
      userId: userId,
      username: msg.from.username || '',
      firstName: msg.from.first_name || '',
      lastName: msg.from.last_name || '',
      photoUrl: ''
    };

    try {
      await admin.database().ref(`loginTokens/${token}`).set({
        userId: userId,
        expires: expires,
        userData: userData
      });

      // ✅ Правильная строка
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
