export function initSwipeDelete(container) {
    container.querySelectorAll('.swipe-container').forEach(cnt => {
        const item = cnt.querySelector('.swipe-item');
        if (!item) return;
        let startX = 0, curX = 0, dragging = false;
        item.addEventListener('touchstart', e => {
            startX = e.touches[0].clientX;
            dragging = true;
            item.style.transition = 'none';
        });
        item.addEventListener('touchmove', e => {
            if (!dragging) return;
            curX = e.touches[0].clientX - startX;
            if (curX < 0) {
                item.style.transform = `translateX(${Math.max(curX, -80)}px)`;
            }
        });
        item.addEventListener('touchend', () => {
            dragging = false;
            item.style.transition = 'transform 0.2s';
            if (curX < -40) {
                item.style.transform = 'translateX(-80px)';
            } else {
                item.style.transform = 'translateX(0)';
            }
            curX = 0;
        });
        const del = cnt.querySelector('.swipe-delete');
        if (del) {
            del.addEventListener('click', () => {
                item.style.transform = 'translateX(0)';
            });
        }
    });
}
