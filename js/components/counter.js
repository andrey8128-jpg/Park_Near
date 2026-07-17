export function renderCounter(current, min, max, onUpdate) {
    const container = document.createElement('div');
    container.className = 'counter-row';
    container.innerHTML = `
        <button class="counter-btn minus">−</button>
        <div class="counter-value">${current}</div>
        <button class="counter-btn plus">+</button>
    `;
    const minusBtn = container.querySelector('.minus');
    const plusBtn = container.querySelector('.plus');
    const valueEl = container.querySelector('.counter-value');
    minusBtn.addEventListener('click', () => {
        const val = parseInt(valueEl.textContent) - 1;
        if (val >= min) {
            valueEl.textContent = val;
            if (onUpdate) onUpdate(val);
        }
    });
    plusBtn.addEventListener('click', () => {
        const val = parseInt(valueEl.textContent) + 1;
        if (val <= max) {
            valueEl.textContent = val;
            if (onUpdate) onUpdate(val);
        }
    });
    return container;
}
