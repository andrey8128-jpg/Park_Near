/* ===== АКТИВНАЯ СТОЯНКА: ЛОКАЛЬНОЕ СОСТОЯНИЕ И ТАЙМЕР ===== */
(function () {
    'use strict';
    const STORAGE_KEY = 'parknear_active_parking';
    let timerInterval = null;
    let leaving = false;
    function getSavedParking() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const session = JSON.parse(raw);
            if (
                !session ||
                !session.parkingId ||
                !Number.isFinite(Number(session.startedAt))
            ) {
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
        const elapsed = Math.max(
            0,
            Math.floor((Date.now() - Number(startedAt)) / 1000)
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
    // Вызывается после успешного создания сессии в Firebase.
    window.setLocalActiveParking = function (parkingId, parkingName, startedAt) {
        saveParking({
            parkingId: String(parkingId),
            parkingName: parkingName || 'Парковка',
            startedAt: Number(startedAt) || Date.now()
        });
        renderBanner();
        updateParkingButtonHighlight();
    };
    // Вызывается после успешного завершения сессии в Firebase.
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

        if (button) {
            button.addEventListener('click', handleLeave);
        }
        renderBanner();
        updateParkingButtonHighlight();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
