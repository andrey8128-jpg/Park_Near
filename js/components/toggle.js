export function renderToggle(checked, onToggle) {
    const label = document.createElement('label');
    label.className = 'theme-switch';
    label.innerHTML = `
        <input type="checkbox" ${checked ? 'checked' : ''}>
        <span class="theme-slider"></span>
    `;
    const input = label.querySelector('input');
    input.addEventListener('change', () => {
        if (onToggle) onToggle(input.checked);
    });
    return label;
}
