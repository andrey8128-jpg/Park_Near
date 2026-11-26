
// ============================================
// PARK NEAR 2.0 — КОРОТКОЕ ОБУЧЕНИЕ
// ============================================

(function () {
    const ONBOARDING_VERSION = '2';
    const STORAGE_KEY = 'parkNearOnboardingVersion';

    const slides = [
        {
            icon: '🅿️',
            title: 'Добро пожаловать в ParkNear!',
            text: 'Находите парковки, проверяйте свободные места и помогайте другим водителям. Найди место. Припаркуйся проще.'
        },
        {
            icon: '🏠',
            title: 'Главная',
            text: 'Ищите парковки по адресу или месту назначения. В разделе «Рядом с вами» смотрите ближайшие парковки. Кнопка «Домой» поможет найти парковки возле сохранённого домашнего адреса.'
        },
        {
            icon: '🗺️',
            title: 'Карта',
            text: 'Здесь отображаются парковки выбранного города. Перемещайте и приближайте карту, нажимайте на парковки, чтобы посмотреть информацию о них.'
        },
        {
            icon: '📍',
            title: 'Кнопки управления картой',
            text: '📍 Моё местоположение — перемещает карту к вам. 🗺️ Слои — переключают схему, спутник и гибрид. Название города сверху позволяет выбрать другой город.'
        },
        {
            icon: '🚗',
            title: 'Информация о парковках',
            text: 'Открывайте парковки, чтобы посмотреть адрес, количество мест и занятость. Сохраняйте понравившиеся парковки в избранное и прокладывайте маршрут.'
        },
        {
            icon: '➕',
            title: 'Добавляйте парковки!',
            text: 'Нажмите «+» в правом нижнем углу. Обведите границы парковки, нажмите «Готово», заполните адрес и количество мест, затем сохраните. Отмечайте реальные парковки и точно указывайте их границы.'
        },
        {
            icon: '⭐',
            title: 'Мой ParkNear',
            text: 'Вкладка «Избранное» хранит ваши парковки. В «Профиле» находятся автомобиль, адреса, история, настройки и обучение. Вы всегда можете вернуться к этой инструкции.'
        }
    ];

    let currentSlide = 0;
    let isActive = false;
    let touchStartX = 0;

    function wasCompleted() {
        try {
            return localStorage.getItem(STORAGE_KEY)
                === ONBOARDING_VERSION;
        } catch (error) {
            return false;
        }
    }

    function finishOnboarding() {
        const overlay = document.getElementById(
            'onboardingOverlay'
        );

        if (!overlay) return;

        try {
            localStorage.setItem(
                STORAGE_KEY,
                ONBOARDING_VERSION
            );
        } catch (error) {
            console.warn(
                'Не удалось сохранить обучение:',
                error
            );
        }

        overlay.style.display = 'none';
        overlay.setAttribute('aria-hidden', 'true');

        isActive = false;

        if (typeof showToast === 'function') {
            showToast(
                '🎉 Вы готовы пользоваться ParkNear!',
                3000
            );
        }
    }

    function renderSlide(index) {
        const slide = slides[index];

        if (!slide) return;

        const slideContainer = document.getElementById(
            'onboardingSlide'
        );

        const dotsContainer = document.getElementById(
            'onboardingDots'
        );

        const progress = document.getElementById(
            'onboardingProgressFill'
        );

        const nextButton = document.getElementById(
            'onboardingNext'
        );

        const prevButton = document.getElementById(
            'onboardingPrev'
        );

        const skipButton = document.getElementById(
            'onboardingSkip'
        );

        if (
            !slideContainer ||
            !dotsContainer ||
            !progress ||
            !nextButton ||
            !prevButton ||
            !skipButton
        ) {
            console.error(
                'Не найдены элементы окна обучения'
            );
            return;
        }

        currentSlide = index;

        slideContainer.innerHTML = `
            <div class="onboarding-icon">
                ${slide.icon}
            </div>

            <div class="onboarding-title">
                ${slide.title}
            </div>

            <div class="onboarding-text">
                ${slide.text}
            </div>
        `;

        dotsContainer.innerHTML = slides.map(
            (_, i) => `
                <div class="onboarding-dot ${
                    i === index ? 'active' : ''
                }"></div>
            `
        ).join('');

        progress.style.width =
            ((index + 1) / slides.length * 100) + '%';

        prevButton.style.visibility =
            index === 0 ? 'hidden' : 'visible';

        nextButton.textContent =
            index === slides.length - 1
                ? 'Начать пользоваться!'
                : 'Далее →';

        skipButton.textContent = 'Пропустить';
    }

    window.showOnboarding = function (options = {}) {
        const force = options.force === true;

        if (isActive) return;

        if (!force && wasCompleted()) return;

        const overlay = document.getElementById(
            'onboardingOverlay'
        );

        if (!overlay) {
            console.error(
                'Окно onboardingOverlay не найдено'
            );
            return;
        }

        isActive = true;
        currentSlide = 0;

        overlay.style.display = 'flex';
        overlay.setAttribute('aria-hidden', 'false');

        const nextButton = document.getElementById(
            'onboardingNext'
        );

        const prevButton = document.getElementById(
            'onboardingPrev'
        );

        const skipButton = document.getElementById(
            'onboardingSkip'
        );

        nextButton.onclick = function () {
            if (currentSlide < slides.length - 1) {
                renderSlide(currentSlide + 1);
            } else {
                finishOnboarding();
            }
        };

        prevButton.onclick = function () {
            if (currentSlide > 0) {
                renderSlide(currentSlide - 1);
            }
        };

        skipButton.onclick = finishOnboarding;

        const modal = overlay.querySelector(
            '#onboardingSlide'
        )?.parentElement;

        if (modal) {
            modal.ontouchstart = function (event) {
                touchStartX =
                    event.changedTouches[0].screenX;
            };

            modal.ontouchend = function (event) {
                const diff =
                    touchStartX -
                    event.changedTouches[0].screenX;

                if (Math.abs(diff) < 60) return;

                if (diff > 0) {
                    if (currentSlide < slides.length - 1) {
                        renderSlide(currentSlide + 1);
                    }
                } else {
                    if (currentSlide > 0) {
                        renderSlide(currentSlide - 1);
                    }
                }
            };
        }

        renderSlide(0);
    };

    // Повторное обучение из профиля

    window.resetOnboarding = function () {
        window.showOnboarding({
            force: true
        });
    };

})();
