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
    
    function showOnboarding() {
        if (localStorage.getItem('onboardingSeen') === 'true') return;
        isOnboardingActive = true;
        const overlay = document.getElementById('onboardingOverlay');
        overlay.style.display = 'flex';
        function updateProgress(index) {
            const fill = document.getElementById('onboardingProgressFill');
            if (fill) {
                const percent = ((index + 1) / onboardingSlides.length) * 100;
                fill.style.width = percent + '%';
            }
        }
        function removeHighlight() {
            if (highlightedElement) {
                highlightedElement.classList.remove('onboarding-highlight');
                highlightedElement = null;
            }
            if (clickHandlerForHighlight) {
                document.removeEventListener('click', clickHandlerForHighlight, true);
                clickHandlerForHighlight = null;
            }
        }
        function renderSlide(index) {
            const slide = onboardingSlides[index];
            removeHighlight();
            updateProgress(index);
            document.getElementById('onboardingSlide').innerHTML = `
            <div class="onboarding-icon">${slide.icon}</div>
            <div class="onboarding-title">${slide.title}</div>
            <div class="onboarding-text">${slide.text}</div>
        `;
            const dotsContainer = document.getElementById('onboardingDots');
            dotsContainer.innerHTML = onboardingSlides.map((_, i) =>
                `<div class="onboarding-dot ${i === index ? 'active' : ''}"></div>`
            ).join('');
            const nextBtn = document.getElementById('onboardingNext');
            const prevBtn = document.getElementById('onboardingPrev');
            const skipBtn = document.getElementById('onboardingSkip');
            if (slide.requiredAction) {
                nextBtn.style.display = 'none';
                prevBtn.style.display = 'none';
                skipBtn.textContent = 'Пропустить шаг';
                skipBtn.style.display = 'block';
                const selector = slide.highlightSelector;
                if (selector) {
                    const el = document.querySelector(selector);
                    if (el) {
                        el.classList.add('onboarding-highlight');
                        highlightedElement = el;
                        if (clickHandlerForHighlight) {
                            document.removeEventListener('click', clickHandlerForHighlight, true);
                        }
                        clickHandlerForHighlight = function(e) {
                            const target = e.target.closest(selector);
                            if (target) {
                                e.preventDefault();
                                e.stopPropagation();
                                if (index < onboardingSlides.length - 1) {
                                    currentSlide = index + 1;
                                    renderSlide(currentSlide);
                                } else {
                                    finishOnboarding();
                                }
                            }
                        };
                        document.addEventListener('click', clickHandlerForHighlight, true);
                    } else {
                        console.warn('Элемент не найден:', selector);
                        setTimeout(() => {
                            if (index < onboardingSlides.length - 1) {
                                currentSlide = index + 1;
                                renderSlide(currentSlide);
                            } else {
                                finishOnboarding();
                            }
                        }, 2000);
                    }
                }
            } else {
                nextBtn.style.display = 'block';
                prevBtn.style.display = 'block';
                skipBtn.textContent = '✕';
                skipBtn.style.display = 'block';

                nextBtn.textContent = index === onboardingSlides.length - 1 ? 'Понятно' : 'Далее →';
                prevBtn.style.visibility = index === 0 ? 'hidden' : 'visible';
            }
        }
        function finishOnboarding() {
            localStorage.setItem('onboardingSeen', 'true');
            document.getElementById('onboardingOverlay').style.display = 'none';
            removeHighlight();
            isOnboardingActive = false;
            if (typeof showToast === 'function') {
                showToast('🎉 Добро пожаловать! Теперь вы готовы пользоваться ParkNear.', 4000);
            }
        }
        document.getElementById('onboardingNext').onclick = function() {
            if (currentSlide === onboardingSlides.length - 1) {
                finishOnboarding();
            } else {
                currentSlide++;
                renderSlide(currentSlide);
            }
        };
        document.getElementById('onboardingPrev').onclick = function() {
            if (currentSlide > 0) {
                currentSlide--;
                renderSlide(currentSlide);
            }
        };
        document.getElementById('onboardingSkip').onclick = function() {
            finishOnboarding();
        };
        let touchStartX = 0;
        const modal = document.querySelector('#onboardingOverlay > div');
        if (modal) {
            modal.addEventListener('touchstart', function(e) {
                touchStartX = e.changedTouches[0].screenX;
            }, { passive: true });
            modal.addEventListener('touchend', function(e) {
                const diff = touchStartX - e.changedTouches[0].screenX;
                if (Math.abs(diff) > 50) {
                    if (diff > 0 && currentSlide < onboardingSlides.length - 1) {
                        const slide = onboardingSlides[currentSlide];
                        if (!slide.requiredAction) {
                            currentSlide++;
                            renderSlide(currentSlide);
                        }
                    } else if (diff < 0 && currentSlide > 0) {
                        const slide = onboardingSlides[currentSlide];
                        if (!slide.requiredAction) {
                            currentSlide--;
                            renderSlide(currentSlide);
                        }
                    }
                }
            }, { passive: true });
        }
        currentSlide = 0;
        renderSlide(0);
    }