const SITE_URL = 'https://andrey8128-jpg.github.io/Park_Near';

bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const payload = match[1];

  if (payload.startsWith('login_')) {
    const token = payload.split('_')[1];
    const expires = Date.now() + 5 * 60 * 1000;
    
    // Формируем ID пользователя (точно такой же, как ожидает фронтенд)
    const userProfileId = 'tg_' + userId;

    const userData = {
      userId: userId,
      username: msg.from.username || '',
      firstName: msg.from.first_name || '',
      lastName: msg.from.last_name || '',
      photoUrl: ''
    };

    try {
      // 1. Сохраняем временный токен (чтобы фронтенд понял, кто вошел)
      await admin.database().ref(`loginTokens/${token}`).set({
        userId: userId,
        expires: expires,
        userData: userData
      });

      // 2. СРАЗУ создаем/обновляем пользователя в разделе users
      const userRef = admin.database().ref(`users/${userProfileId}`);
      await userRef.update({
        id: userProfileId,
        telegramId: String(userId),
        username: userData.username || 'tg_user',
        firstName: userData.firstName || 'Пользователь',
        photoUrl: userData.photoUrl || '',
        isGuest: false,
        lastActive: Date.now()
      });

      // 3. Создаем статистику, если ее еще нет
      await userRef.child('stats').transaction(stats => {
        if (stats !== null) return stats;
        return {
          registeredAt: Date.now(),
          lastActive: Date.now(),
          parkingsCreated: 0,
          parkingsUpdated: 0,
          confirmations: 0,
          views: 0,
          favorites: 0,
          activeDates: [new Date().toISOString().split('T')[0]]
        };
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
      console.error('Ошибка сохранения данных:', err);
      bot.sendMessage(chatId, '❌ Произошла ошибка, попробуйте позже.');
    }
  } else {
    bot.sendMessage(chatId, 'Привет! Используйте кнопку "Войти" на сайте ParkNear.');
  }
});
