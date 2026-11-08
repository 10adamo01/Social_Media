// =====================================================================
// WYGLĄD WIDZA – ramka avatara, kolor nicku, tytuł, tło karty i medale sezonów
// (przedmioty kupuje się w sklepik.html, wygląd jest w sklep/przedmioty.css)
// =====================================================================
window.ZawloxWyglad = (function () {
    var ICONS = { 'ramka-kozacka': '🐐', 'ramka-zlota': '👑' };
    // tytuły: nazwa + ikonka (nowy tytuł = wiersz w shop_items + wpis tutaj + styl .zt-<id>)
    var TITLES = {
        'tytul-nocny-marek':       ['Nocny Marek', '🌙'],
        'tytul-kozak-z-czatu':     ['Kozak z czatu', '💬'],
        'tytul-lowca-rekordow':    ['Łowca Rekordów', '🎯'],
        'tytul-weteran-vice-city': ['Weteran Vice City', '🌴'],
        'tytul-giga-kozak':        ['Giga Kozak', '⚡'],
        'tytul-snajper':           ['Snajper', '🎯'],
        'tytul-blyskawica':        ['Błyskawica', '⚡'],
        'tytul-mozg':              ['Mózg', '🧠'],
        'tytul-krol-weza':         ['Król Węża', '🐍'],
        'tytul-mistrz-sezonu':     ['Mistrz Sezonu', '🏆'],
        'tytul-niezlomny':         ['Niezłomny', '🔥']
    };
    function safe(id) { return typeof id === 'string' && /^[a-z0-9-]{1,40}$/.test(id) ? id : null; }

    // owija avatar (img albo span z literą) w ramkę
    function frame(avatarEl, frameId) {
        var w = document.createElement('span');
        w.className = 'zf';
        var id = safe(frameId);
        if (id) {
            w.classList.add('zf-' + id);
            if (ICONS[id]) w.setAttribute('data-zf-icon', ICONS[id]);
        }
        // ramka przejmuje odstępy avatara z układu (np. kolumnę w siatce)
        w.appendChild(avatarEl);
        return w;
    }

    // nadaje kolor nickowi (element już istnieje)
    function color(nameEl, colorId) {
        Array.prototype.slice.call(nameEl.classList).forEach(function (c) { if (c.indexOf('zn-') === 0) nameEl.classList.remove(c); });
        var id = safe(colorId);
        if (id) nameEl.classList.add('zn-' + id);
        return nameEl;
    }

    // plakietka z tytułem (null, gdy brak tytułu)
    function title(titleId, small) {
        var id = safe(titleId);
        if (!id) return null;
        var t = TITLES[id] || [id.replace(/^tytul-/, '').replace(/-/g, ' '), ''];
        var el = document.createElement('span');
        el.className = 'zt zt-' + id + (small ? ' zt-sm' : '');
        if (t[1]) el.setAttribute('data-zt-icon', t[1]);
        el.appendChild(document.createTextNode(t[0]));
        return el;
    }
    function titleName(titleId) { var t = TITLES[titleId]; return t ? t[0] : ''; }

    // tło karty profilu (element już istnieje)
    function banner(el, bannerId) {
        Array.prototype.slice.call(el.classList).forEach(function (c) { if (c === 'zb' || c.indexOf('zb-') === 0) el.classList.remove(c); });
        var id = safe(bannerId);
        if (id) el.classList.add('zb', 'zb-' + id);
        return el;
    }

    // medale sezonów: 🥇×2 🥈 🥉
    function medalText(g, s, b) {
        var out = [];
        [[g, '🥇'], [s, '🥈'], [b, '🥉']].forEach(function (m) {
            var n = Number(m[0]) || 0;
            if (n === 1) out.push(m[1]); else if (n > 1) out.push(m[1] + '×' + n);
        });
        return out.join(' ');
    }
    function medals(g, s, b) {
        var t = medalText(g, s, b);
        if (!t) return null;
        var el = document.createElement('span');
        el.className = 'zw-medale';
        el.textContent = t;
        el.title = 'Odznaki sezonów rankingu';
        return el;
    }

    var MONTHS = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
    function seasonName(season) {           // '2026-11' → 'Listopad 2026'
        var p = String(season || '').split('-');
        return (MONTHS[(parseInt(p[1], 10) || 1) - 1] || '') + ' ' + (p[0] || '');
    }

    return { frame: frame, color: color, title: title, titleName: titleName, banner: banner, medals: medals, medalText: medalText, seasonName: seasonName };
})();
