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
      photoUrl: '' // можно оставить пустым
    };

    try {
      // Сохраняем токен в Firebase
      await admin.database().ref(`loginTokens/${token}`).set({
        userId: userId,
        expires: expires,
        userData: userData
      });

      // Отправляем только кнопку (без лишнего текста)
      await bot.sendMessage(chatId, 'Нажмите, чтобы открыть приложение:', {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🚀 Открыть приложение',
                web_app: { url: `${SITE_URL}/?token=${token}` }
              }
            ]
          ]
        }
      });
    } catch (err) {
      console.error('Ошибка сохранения токена:', err);
      bot.sendMessage(chatId, '❌ Произошла ошибка, попробуйте позже.');
    }
  } else {
    bot.sendMessage(chatId, 'Привет! Используйте кнопку "Войти" на сайте ParkNear.');
  }
});
