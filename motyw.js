// =====================================================================
// MOTYW STRONY – kolor akcentu i motywy (lista w motywy/lista.js)
// Ładowany w <head>, żeby wygląd był od razu (bez mignięcia).
//  • motyw dla wszystkich i kolor ustawia właściciel w Ustawieniach (baza),
//  • widz z odpowiednią rangą może w profilu włączyć sobie inny motyw.
// Ostatnie ustawienia trzymamy w przeglądarce, a świeże pobieramy z bazy.
// =====================================================================
(function () {
    var KEY = 'zawlox-motyw';               // kolor akcentu z Ustawień
    var KEY_SITE = 'zawlox-motyw-strona';   // motyw ustawiony przez właściciela
    var KEY_MINE = 'zawlox-motyw-moj';      // motyw wybrany przez widza ('' = jak ustawił Zawlox)
    var KEY_LVL = 'zawlox-poziom';          // poziom widza (zapisuje strona po zalogowaniu)
    var DEFAULT = '#9147ff';
    var root = document.documentElement;
    var LIST = window.ZAWLOX_MOTYWY || [];

    function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function set(k, v) { try { if (v === null || v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }

    // ---------- kolor akcentu ----------
    function clean(c) { return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : null; }
    function rgb(c) { return [1, 3, 5].map(function (i) { return parseInt(c.slice(i, i + 2), 16); }); }
    function hex(a) { return '#' + a.map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join(''); }
    function lum(a) {
        var l = a.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
        return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
    }
    var siteAccent = clean(get(KEY)) || DEFAULT;

    function paint(color) {
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

    // ---------- motywy ----------
    function find(id) { for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i]; return null; }
    function level() { return parseInt(get(KEY_LVL), 10) || 1; }
    function canUse(t, lvl) { return !!t && (lvl === Infinity || (t.odPoziomu || 1) <= lvl); }

    var siteTheme = find(get(KEY_SITE)) ? get(KEY_SITE) : 'domyslny';
    var current = null;

    function wanted() {
        var mine = get(KEY_MINE);
        var lvl = get('zawlox-tworca') === '1' ? Infinity : level();
        if (mine && canUse(find(mine), lvl)) return mine;
        return siteTheme;
    }

    function useTheme(id) {
        var t = find(id) || find('domyslny') || { id: 'domyslny' };
        current = t.id;
        root.setAttribute('data-motyw', t.id);
        var link = document.getElementById('motyw-css');
        if (t.plik) {
            var href = t.plik + '?v=' + encodeURIComponent(t.wersja || '1');
            if (!link) {
                if (document.readyState === 'loading' && !document.body) {
                    // w trakcie wczytywania <head> – arkusz blokuje rysowanie, więc nie ma mignięcia
                    document.write('<link id="motyw-css" rel="stylesheet" href="' + href + '">');
                } else {
                    link = document.createElement('link');
                    link.id = 'motyw-css'; link.rel = 'stylesheet'; link.href = href;
                    document.head.appendChild(link);
                }
            } else if (link.getAttribute('href') !== href) link.setAttribute('href', href);
        } else if (link) link.parentNode.removeChild(link);
        paint(t.akcent || siteAccent);
        return t.id;
    }

    useTheme(wanted());

    // ---------- świeże ustawienia z bazy ----------
    async function refresh() {
        var cfg = window.ZAWLOX_CONFIG || {};
        if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return;
        var base = cfg.supabaseUrl.replace(/\/$/, '') + '/rest/v1/site_settings?id=eq.1&select=';
        var headers = { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + cfg.supabaseAnonKey };
        try {
            var r = await fetch(base + 'accent,theme', { headers: headers });
            if (!r.ok) r = await fetch(base + 'accent', { headers: headers });   // baza bez kolumny "theme"
            if (!r.ok) return;
            var row = (await r.json())[0] || {};
            var c = clean(row.accent);
            if (c) { siteAccent = c; set(KEY, c); }
            if (row.theme !== undefined) {
                siteTheme = find(row.theme) ? row.theme : 'domyslny';
                set(KEY_SITE, siteTheme);
            }
            useTheme(wanted());
        } catch (e) { /* zostaje to, co w pamięci */ }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh);
    else refresh();

    // ---------- kafelki wyboru motywu (Ustawienia i profil) ----------
    // opts: { selected, level (Infinity = bez blokad), withSiteOption, siteName, onPick(id) }
    function cards(box, opts) {
        box.innerHTML = '';
        box.classList.add('motywy');
        var items = [];
        if (opts.withSiteOption) items.push({ id: '', nazwa: 'Jak ustawił Zawlox', opis: 'Zawsze motyw wybrany przez twórcę – teraz: ' + (opts.siteName || 'Zawlox') + '.', kolory: (find(siteTheme) || {}).kolory || ['#0e0e10', '#9147ff', '#d4d4d8'], odPoziomu: 1 });
        items = items.concat(LIST);
        items.forEach(function (t) {
            var locked = !canUse(t.id === '' ? { odPoziomu: 1 } : t, opts.level);
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'motyw-card' + (locked ? ' is-locked' : '') + (t.premium ? ' is-premium' : '');
            b.setAttribute('aria-pressed', String(t.id === opts.selected));
            var k = t.kolory || [];
            b.style.setProperty('--m1', k[0] || '#0e0e10');
            b.style.setProperty('--m2', k[1] || '#9147ff');
            b.style.setProperty('--m3', k[2] || '#d4d4d8');
            b.innerHTML = '<span class="motyw-prev" aria-hidden="true"><i></i><i></i><i></i></span>' +
                '<b class="motyw-name"></b><span class="motyw-desc"></span><span class="motyw-tag"></span>';
            b.querySelector('.motyw-name').textContent = t.nazwa;
            if (t.premium) b.querySelector('.motyw-name').insertAdjacentHTML('afterbegin', '<span class="motyw-premium">★ Premium</span>');
            b.querySelector('.motyw-desc').textContent = t.opis || '';
            var tag = b.querySelector('.motyw-tag');
            if (t.id === opts.selected) tag.textContent = '✓ Wybrany';
            else if (locked) tag.textContent = '🔒 od poziomu ' + t.odPoziomu + (opts.rankName ? ' (' + opts.rankName(t.odPoziomu) + ')' : '');
            if (locked) b.setAttribute('aria-disabled', 'true');
            b.addEventListener('click', function () { if (!locked) opts.onPick(t.id); });
            box.appendChild(b);
        });
    }

    window.ZawloxMotyw = {
        DEFAULT: DEFAULT, clean: clean,
        // kolor akcentu (panel Ustawień)
        apply: function (c) { siteAccent = clean(c) || DEFAULT; var t = find(current); return t && t.akcent ? paint(t.akcent) : paint(siteAccent); },
        save: function (c) { set(KEY, c); },
        // motywy
        list: function () { return LIST.slice(); },
        find: find,
        current: function () { return current; },
        site: function () { return siteTheme; },
        mine: function () { return get(KEY_MINE) || ''; },
        preview: function (id) { return useTheme(id); },                       // tylko podgląd na tej stronie
        setSite: function (id) { siteTheme = find(id) ? id : 'domyslny'; set(KEY_SITE, siteTheme); return useTheme(wanted()); },
        setMine: function (id) { set(KEY_MINE, id || null); return useTheme(wanted()); },
        setLevel: function (lvl, creator) { set(KEY_LVL, String(lvl || 1)); set('zawlox-tworca', creator ? '1' : null); var w = wanted(); if (w !== current) useTheme(w); },
        canUse: canUse,
        cards: cards
    };
})();
