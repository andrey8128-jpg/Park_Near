
/* =====================================================
   PARK NEAR — SVG ICON SYSTEM
   Единый набор иконок для iOS, Android и PWA
   ===================================================== */

(function () {
    'use strict';

    const icons = {
        map: `
            <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/>
            <path d="M9 3v15M15 6v15"/>
        `,

        satellite: `
            <path d="m13.5 6.5 4 4"/>
            <path d="m16 4 4 4"/>
            <path d="m4 16 4 4"/>
            <path d="m6.5 13.5 4 4"/>
            <path d="M8 16 16 8"/>
            <path d="m3 21 5-5"/>
            <path d="m16 8 5-5"/>
        `,

        layers: `
            <path d="m12 3 9 5-9 5-9-5 9-5Z"/>
            <path d="m3 12 9 5 9-5"/>
            <path d="m3 16 9 5 9-5"/>
        `,

        mapPin: `
            <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/>
            <circle cx="12" cy="10" r="2.5"/>
        `,

        locate: `
            <path d="M12 2v3M12 19v3"/>
            <path d="M2 12h3M19 12h3"/>
            <circle cx="12" cy="12" r="7"/>
            <circle cx="12" cy="12" r="2"/>
        `,

        heart: `
            <path d="M20.8 8.8c0 5.2-8.8 10.2-8.8 10.2S3.2 14 3.2 8.8A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z"/>
        `,

        save: `
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/>
            <path d="M17 21v-8H7v8"/>
            <path d="M7 3v5h8"/>
        `,

        edit: `
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>
        `,

        home: `
            <path d="m3 10 9-7 9 7"/>
            <path d="M5 9v12h14V9"/>
            <path d="M9 21v-7h6v7"/>
        `,

        car: `
            <path d="m5 11 1.5-5h11L19 11"/>
            <path d="M3 11h18l1 4v4h-2v-2H4v2H2v-4z"/>
            <circle cx="6.5" cy="15" r="1"/>
            <circle cx="17.5" cy="15" r="1"/>
        `,

        users: `
            <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="10" cy="7" r="4"/>
            <path d="M20 21v-2a4 4 0 0 0-3-3.87"/>
        `,

        settings: `
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a7 7 0 0 0 0-6"/>
            <path d="M4.6 9a7 7 0 0 0 0 6"/>
            <path d="m15 3-3-1-3 1-1 3-3 2 1 3-1 3 3 2 1 3 3 1 3-1 1-3 3-2-1-3 1-3-3-2z"/>
        `,

        user: `
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 21a8 8 0 0 1 16 0"/>
        `,

        clock: `
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 7v5l3 2"/>
        `,

        search: `
            <circle cx="11" cy="11" r="7"/>
            <path d="m20 20-4-4"/>
        `,

        lock: `
            <rect x="4" y="10" width="16" height="11" rx="2"/>
            <path d="M8 10V7a4 4 0 1 1 8 0v3"/>
            <path d="M12 14v3"/>
        `,

        plus: `
            <path d="M12 5v14"/>
            <path d="M5 12h14"/>
        `,

        check: `
            <path d="m5 12 4 4L19 6"/>
        `,

        route: `
            <circle cx="6" cy="6" r="3"/>
            <circle cx="18" cy="18" r="3"/>
            <path d="M9 6h2a4 4 0 0 1 4 4v4a4 4 0 0 0 4 4"/>
        `,

        bell: `
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
            <path d="M10 21h4"/>
        `,

        star: `
            <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>
        `,

        trash: `
            <path d="M3 6h18"/>
            <path d="M8 6V4h8v2"/>
            <path d="m19 6-1 14H6L5 6"/>
            <path d="M10 11v5M14 11v5"/>
        `,

        close: `
            <path d="m18 6-12 12"/>
            <path d="m6 6 12 12"/>
        `,

        info: `
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 11v5M12 8h.01"/>
        `,

        compass: `
            <circle cx="12" cy="12" r="9"/>
            <path d="m15.5 8.5-2 5-5 2 2-5z"/>
        `
    };

    function escapeAttribute(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    window.pnIcon = function (name, options = {}) {
        const path = icons[name];

        if (!path) {
            console.warn(
                '[Park Near] Иконка не найдена:',
                name
            );
            return '';
        }

        const size = Math.max(
            12,
            Math.min(64, Number(options.size) || 24)
        );

        const className =
            typeof options.className === 'string'
                ? options.className.replace(
                    /[^a-zA-Z0-9 _-]/g,
                    ''
                ).trim()
                : 'pn-icon';

        const accessibility = options.label
            ? `role="img" aria-label="${escapeAttribute(options.label)}"`
            : 'aria-hidden="true" focusable="false"';

        return `
            <svg
                class="${escapeAttribute(className || 'pn-icon')}"
                width="${size}"
                height="${size}"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                ${accessibility}
            >
                ${path}
            </svg>
        `;
    };

    window.PNIcons = Object.freeze(
        Object.keys(icons)
    );

})();
