// =====================================================================
// MOTYW – kolor akcentu strony ustawiany w panelu Ustawienia.
// Ładowany w <head>, żeby kolor był od razu (bez mignięcia fioletem).
// Ostatni kolor trzymamy w przeglądarce, a świeży pobieramy z bazy.
// =====================================================================
(function () {
    var KEY = 'zawlox-motyw';
    var DEFAULT = '#9147ff';
    var root = document.documentElement;

    function clean(c) { return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : null; }
    function rgb(c) { return [1, 3, 5].map(function (i) { return parseInt(c.slice(i, i + 2), 16); }); }
    function hex(a) { return '#' + a.map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join(''); }
    function lum(a) {
        var l = a.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
        return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
    }

    function apply(color) {
        var c = clean(color) || DEFAULT;
        var a = rgb(c);
        // jaśniejsza wersja do napisów i podświetleń (domyślnie dokładnie stary #a970ff)
        var c2 = c === DEFAULT ? '#a970ff' : hex(a.map(function (v) { return v + (255 - v) * 0.25; }));
        var s = root.style;
        s.setProperty('--accent', c);
        s.setProperty('--accent-2', c2);
        s.setProperty('--accent-rgb', a.join(', '));
        s.setProperty('--accent-2-rgb', rgb(c2).join(', '));
        // jasny kolor (np. żółty) dostaje ciemny tekst na przyciskach
        s.setProperty('--on-accent', lum(a) > 0.42 ? '#0e0e10' : '#ffffff');
        window.ZAWLOX_ACCENT = c;
        try { document.dispatchEvent(new CustomEvent('zawlox-motyw', { detail: { accent: c, accent2: c2 } })); } catch (e) {}
        return c;
    }

    function save(c) { try { localStorage.setItem(KEY, c); } catch (e) {} }

    var cached = null;
    try { cached = localStorage.getItem(KEY); } catch (e) {}
    apply(cached);

    async function refresh() {
        var cfg = window.ZAWLOX_CONFIG || {};
        if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return;
        try {
            var r = await fetch(cfg.supabaseUrl.replace(/\/$/, '') + '/rest/v1/site_settings?select=accent&id=eq.1', {
                headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + cfg.supabaseAnonKey }
            });
            if (!r.ok) return;
            var rows = await r.json();
            var c = rows && rows[0] && clean(rows[0].accent);
            if (!c) return;
            save(c);
            if (c !== window.ZAWLOX_ACCENT) apply(c);
        } catch (e) { /* zostaje kolor z pamięci */ }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh);
    else refresh();

    window.ZawloxMotyw = { apply: apply, save: save, DEFAULT: DEFAULT, clean: clean };
})();
