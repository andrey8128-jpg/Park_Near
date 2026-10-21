// ===================== ОНБОРДИНГ С ПОДСВЕТКОЙ =====================
    const onboardingSlides = [
    {
        icon: '👋',
        title: 'Добро пожаловать в ParkNear!',
        text: 'Приложение для поиска и отметки парковок, с актуальной занятостью. Давайте познакомимся с главными функциями.',
        highlightSelector: null,
        requiredAction: false
    },
    {
        icon: '➕',
        title: 'Шаг 1: Добавление парковки',
        text: 'Нажмите на синюю кнопку «+» в правом нижнем углу, чтобы обвести зону на карте и указать количество мест.',
        highlightSelector: '#addBtn',
        requiredAction: true
    },
    {
        icon: '📍',
        title: 'Шаг 2: Ваше местоположение',
        text: 'Нажмите на кнопку с эмодзи 📍, чтобы карта переместилась к вам. Это поможет искать парковки рядом.',
        highlightSelector: '#geoBtn',
        requiredAction: true
    },
    // ❌ Удалён шаг с обновлением данных, так как кнопки нет
    {
        icon: '🗺️',
        title: 'Шаг 3: Слои карты',
        text: 'Нажмите на иконку 🗺️ в правом верхнем углу, чтобы переключать вид: схема, спутник или гибрид.',
        highlightSelector: '.layer-switcher',
        requiredAction: true
    },
    {
        icon: '🔍',
        title: 'Шаг 4: Поиск парковок',
        text: 'На главном экране введите адрес или место в поле «куда вы направляетесь?», чтобы найти парковки рядом.',
        highlightSelector: '#homeSearchInput',  // ← исправлено
        requiredAction: true
    },
    {
        icon: '⭐',
        title: 'Шаг 5: Избранное и адреса',
        text: 'Вкладка «Избранное» хранит ваши любимые парковки и домашние адреса. Свайпом влево можно удалить.',
        highlightSelector: '.tab:nth-child(3)',
        requiredAction: true
    },
    {
        icon: '⚙️',
        title: 'Шаг 6: Настройки профиля',
        text: 'В профиле (вкладка «Профиль») можно задать город, добавить автомобиль и включить тёмную тему. Нажмите на вкладку, чтобы заглянуть.',
        highlightSelector: '.tab:nth-child(4)',
        requiredAction: true
    },
    {
        icon: '🎉',
        title: 'Вы готовы!',
        text: 'Теперь вы знаете все основные фишки. Начните с поиска парковки или добавьте свою — удачи на дорогах!',
        highlightSelector: null,
        requiredAction: false
    }
];
    let currentSlide = 0;
    let highlightedElement = null;
    let isOnboardingActive = false;
    let clickHandlerForHighlight = null;