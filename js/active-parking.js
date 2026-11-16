/* ===== АКТИВНАЯ СТОЯНКА: ЛОКАЛЬНОЕ СОСТОЯНИЕ И ТАЙМЕР ===== */
(function () {
    'use strict';
    const STORAGE_KEY = 'parknear_active_parking';
    let timerInterval = null;
    let leaving = false;
function normalizeStartedAt(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
     let timestamp;
    if (typeof value === 'number') {
        timestamp = value;
    } else {
        const numericValue = Number(value);
        timestamp = Number.isFinite(numericValue)
            ? numericValue
            : Date.parse(value);
    }
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        return null;
    }
    // Переводим Unix timestamp из секунд в миллисекунды.
    if (timestamp < 1e12) {
        timestamp *= 1000;
    }
    return Number.isFinite(new Date(timestamp).getTime())
        ? timestamp
        : null;
}
    function getSavedParking() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const session = JSON.parse(raw);
            if (
               !session ||
               !session.parkingId ||
               !normalizeStartedAt(session.startedAt)
)            {
                localStorage.removeItem(STORAGE_KEY);
                return null;
            }
            return session;
        } catch (error) {
            console.error('Не удалось прочитать активную стоянку:', error);
            return null;
        }
    }
    function saveParking(session) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        } catch (error) {
            console.error('Не удалось сохранить активную стоянку:', error);
        }
    }
function formatDuration(startedAt) {
    const normalizedStartedAt = normalizeStartedAt(startedAt);
    if (!normalizedStartedAt) {
        return '00:00:00';
    }
    const elapsed = Math.max(
        0,
        Math.floor((Date.now() - normalizedStartedAt) / 1000)
    );
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    return [hours, minutes, seconds]
        .map(value => String(value).padStart(2, '0'))
        .join(':');
}
    function renderBanner() {
        const banner = document.getElementById('activeParkingBanner');
        const nameEl = document.getElementById('activeParkingName');
        const timerEl = document.getElementById('activeParkingTimer');
        if (!banner || !nameEl || !timerEl) return;
        const session = getSavedParking();
        if (!session) {
            banner.hidden = true;
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            return;
        }
        nameEl.textContent = session.parkingName || 'Парковка';
        timerEl.textContent = formatDuration(session.startedAt);
        banner.hidden = false;
        if (!timerInterval) {
            timerInterval = setInterval(() => {
                const current = getSavedParking();
                if (!current) {
                    renderBanner();
                    return;
                }
                timerEl.textContent = formatDuration(current.startedAt);
            }, 1000);
        }
    }
    // Вызывается после успешного создания парковочной сессии.
window.setLocalActiveParking = function (parkingId, parkingName, startedAt) {
    const normalizedStartedAt = normalizeStartedAt(startedAt);
    if (!normalizedStartedAt) {
        console.error(
            'Не удалось определить время начала парковки:',
            startedAt
        );
        return;
    }
    saveParking({
        parkingId: String(parkingId),
        parkingName: parkingName || 'Парковка',
        startedAt: normalizedStartedAt
    });
    renderBanner();
    updateParkingButtonHighlight();
};
    // Вызывается после успешного завершения парковочной сессии.
    window.clearLocalActiveParking = function () {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.error('Не удалось очистить активную стоянку:', error);
        }
        leaving = false;
        renderBanner();
        updateParkingButtonHighlight();
    };
    window.getLocalActiveParking = getSavedParking;
    function updateParkingButtonHighlight() {
        const session = getSavedParking();
        document
            .querySelectorAll('.parking-park-btn')
            .forEach(button => {
                const onclick = button.getAttribute('onclick') || '';
                const match = onclick.match(
                    /(?:startParkingSession|endParkingSession)\(['"]([^'"]+)['"]\)/
                );
                button.classList.toggle(
                    'is-active-parking',
                    Boolean(session && match && match[1] === session.parkingId)
                );
            });
    }
    async function handleLeave() {
        if (leaving) return;
        const session = getSavedParking();
        if (!session) {
            renderBanner();
            return;
        }
        if (typeof window.endParkingSession !== 'function') {
            alert('Не удалось завершить стоянку: функция не найдена.');
            return;
        }
        const button = document.getElementById('activeParkingLeaveBtn');
        leaving = true;
        if (button) {
            button.disabled = true;
            button.textContent = 'Завершение…';
        }
        try {
            await window.endParkingSession(session.parkingId);
        } finally {
            leaving = false;
            if (button) {
                button.disabled = false;
                button.textContent = 'Я уехал';
            }
        }
    }
    
function init() {
    const button = document.getElementById('activeParkingLeaveBtn');
    const bannerInfo = document.querySelector('#activeParkingBanner .active-parking-info');
    if (button) {
        button.addEventListener('click', handleLeave);
    }
    if (bannerInfo) {
        bannerInfo.style.cursor = 'pointer';
        bannerInfo.setAttribute('role', 'button');
        bannerInfo.setAttribute('tabindex', '0');
        bannerInfo.setAttribute('aria-label', 'Открыть активную парковку');
        const openActiveParking = async function () {
            const session = getSavedParking();
            if (!session) {
                alert('Активная парковка не найдена');
                return;
            }
            try {
                const response = await fetch(
                    `${window.PARKNEAR_API_URL}/api/parkings/${encodeURIComponent(session.parkingId)}`,
                    { cache: 'no-store' }
                );
                const result = await response.json();
                if (!response.ok || !result.success || !result.parking) {
                    throw new Error(result.error || 'Не удалось загрузить парковку');
                }
                if (typeof window.openCenterSheet !== 'function') {
                    throw new Error('Не найдена функция открытия карточки парковки');
                }
                window.openCenterSheet(session.parkingId, result.parking);
            } catch (error) {
                console.error('Ошибка открытия активной парковки:', error);
                alert(error.message || 'Не удалось открыть активную парковку');
            }
        };
        bannerInfo.addEventListener('click', openActiveParking);
        bannerInfo.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openActiveParking();
            }
        });
    }
        renderBanner();
    updateParkingButtonHighlight();
}

// Запускаем восстановление активной парковки после загрузки страницы.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
    init();
}

})();