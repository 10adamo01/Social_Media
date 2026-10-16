// =====================================================================
// PUNKTY – wspólne zasady dla strony głównej i profilu
// (same punkty liczy baza: supabase-punkty.sql)
// =====================================================================
window.ZawloxPunkty = (function () {
    // Poziom N wymaga 25·N·(N−1) punktów: 2 → 50, 3 → 150, 4 → 300, 5 → 500, 10 → 2250…
    function need(level) { return 25 * level * (level - 1); }
    function level(points) {
        points = Math.max(0, Number(points) || 0);
        var l = Math.floor((1 + Math.sqrt(1 + points * 4 / 25)) / 2);
        while (need(l + 1) <= points) l++;
        while (l > 1 && need(l) > points) l--;
        var from = need(l), to = need(l + 1);
        return { level: l, from: from, to: to, progress: (points - from) / (to - from), left: to - points };
    }

    // Rangi widzów – próg to poziom (punkty liczy need())
    var RANKS = [
        { lvl: 1,  name: 'Nowy widz',  icon: '🌱', color: '#9ca3af', desc: 'Pierwsze kroki na kanale' },
        { lvl: 3,  name: 'Stały widz', icon: '📺', color: '#4ade80', desc: 'Wpadasz regularnie' },
        { lvl: 5,  name: 'Bywalec',    icon: '⭐', color: '#38bdf8', desc: 'Znają Cię na czacie' },
        { lvl: 8,  name: 'Kozak',      icon: '🐐', color: '#c084fc', desc: 'Prawdziwy członek ekipy' },
        { lvl: 12, name: 'Giga Kozak', icon: '⚡', color: '#fb923c', desc: 'Elita Giga Kozaków' },
        { lvl: 18, name: 'Legenda',    icon: '👑', color: '#facc15', desc: 'Najwyższa ranga kanału' }
    ];
    function rankOf(lvl) {
        var r = RANKS[0];
        for (var i = 0; i < RANKS.length; i++) if (lvl >= RANKS[i].lvl) r = RANKS[i];
        return r;
    }
    function title(lvl) { return rankOf(lvl).name; }

    // Drabinka rang: wstawia kafelki do kontenera; points = null → widok dla niezalogowanych
    function ladder(box, points) {
        var nf = new Intl.NumberFormat('pl-PL');
        var has = typeof points === 'number' && !isNaN(points);
        var lv = has ? level(points).level : 0;
        var cur = has ? rankOf(lv) : null;
        var next = null;
        if (has) for (var i = 0; i < RANKS.length; i++) if (RANKS[i].lvl > lv) { next = RANKS[i]; break; }
        box.innerHTML = '';
        var head = document.createElement('p');
        head.className = 'ladder-head';
        if (!has) head.innerHTML = 'Zbieraj punkty i awansuj przez <b>6 rang</b> – od Nowego widza aż do Legendy.';
        else if (!next) head.innerHTML = 'Masz najwyższą rangę – <b>Legenda</b>! 👑';
        else {
            var left = need(next.lvl) - points;
            head.innerHTML = 'Następna ranga: <b></b> – brakuje Ci <b></b>';
            head.children[0].textContent = next.icon + ' ' + next.name;
            head.children[1].textContent = nf.format(left) + ' pkt';
        }
        box.appendChild(head);
        var grid = document.createElement('ol');
        grid.className = 'ladder';
        RANKS.forEach(function (r, i) {
            var from = need(r.lvl);
            var upTo = RANKS[i + 1] ? need(RANKS[i + 1].lvl) : null;
            var li = document.createElement('li');
            var state = !has ? 'open' : r === cur ? 'current' : r.lvl <= lv ? 'done' : r === next ? 'next' : 'locked';
            li.className = 'rung is-' + state;
            li.style.setProperty('--rc', r.color);
            li.innerHTML = '<span class="rung-ico" aria-hidden="true"></span><b class="rung-name"></b>' +
                '<span class="rung-req"></span><span class="rung-desc"></span><span class="rung-tag"></span>';
            li.querySelector('.rung-ico').textContent = r.icon;
            li.querySelector('.rung-name').textContent = r.name;
            li.querySelector('.rung-req').textContent = from === 0 ? 'Start' : nf.format(from) + ' pkt';
            li.querySelector('.rung-desc').textContent = r.desc;
            var tag = li.querySelector('.rung-tag');
            if (state === 'current') tag.textContent = 'Twoja ranga';
            else if (state === 'done') tag.textContent = '✓ Zdobyta';
            else if (state === 'next') {
                var pct = Math.max(0, Math.min(1, (points - need(cur.lvl)) / (from - need(cur.lvl))));
                tag.innerHTML = '<span class="rung-bar"><span></span></span>';
                tag.querySelector('.rung-bar span').style.width = Math.round(pct * 100) + '%';
                tag.title = Math.round(pct * 100) + '%';
            } else if (state === 'locked') tag.textContent = '🔒';
            li.setAttribute('aria-label', r.name + ', od ' + (from === 0 ? 'startu' : from + ' punktów') +
                (state === 'current' ? ', twoja ranga' : state === 'done' ? ', zdobyta' : ''));
            grid.appendChild(li);
        });
        box.appendChild(grid);
    }

    var REASONS = {
        daily:        { label: 'Codzienna wizyta',  icon: '📅' },
        watch_stream: { label: 'Oglądanie streama', icon: '📺' },
        watch_video:  { label: 'Oglądanie filmu',   icon: '🎬' },
        game:         { label: 'Rozegrana gra',     icon: '🎮' },
        game_best:    { label: 'Nowy rekord',       icon: '🏆' },
        vote:         { label: 'Głos w ankiecie',   icon: '🗳️' }
    };

    // jak zdobywać punkty – ta sama tabelka na stronie głównej i w profilu
    var RULES = [
        ['📺', 'Oglądanie streama na stronie', '+1 pkt / min', 'do 120 dziennie'],
        ['🎬', 'Oglądanie filmów na stronie', '+1 pkt / min', 'do 40 dziennie'],
        ['🎮', 'Rozegrana minigierka', '+3 pkt', 'do 10 gier dziennie'],
        ['🏆', 'Pobity własny rekord', '+10 pkt', 'do 3 dziennie'],
        ['🗳️', 'Głos w ankiecie', '+5 pkt', 'za każdą ankietę'],
        ['📅', 'Codzienna wizyta', '+10 pkt', 'raz dziennie']
    ];

    // dni z rzędu z aktywnością (lista dat 'YYYY-MM-DD', od najnowszej)
    function streak(days) {
        if (!days || !days.length) return 0;
        var set = {}; days.forEach(function (d) { set[d] = true; });
        var d = new Date(), n = 0;
        var key = function (x) { return x.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' }); };
        if (!set[key(d)]) d.setDate(d.getDate() - 1);   // dzisiaj jeszcze nic – liczymy od wczoraj
        while (set[key(d)]) { n++; d.setDate(d.getDate() - 1); }
        return n;
    }

    function badges(p) {
        var s = streak(p.days);
        return [
            { icon: '👋', name: 'Pierwsze kroki',   desc: 'Zdobądź pierwsze punkty',            ok: p.points > 0 },
            { icon: '🎮', name: 'Gracz',            desc: 'Rozegraj 10 minigierek',             ok: p.games >= 10 },
            { icon: '🏆', name: 'Rekordzista',      desc: 'Pobij swój rekord 5 razy',           ok: p.records >= 5 },
            { icon: '📺', name: 'Widz streamów',    desc: 'Obejrzyj 60 minut streamów',         ok: p.stream_min >= 60 },
            { icon: '🎬', name: 'Kinomaniak',       desc: 'Obejrzyj 60 minut filmów',           ok: p.video_min >= 60 },
            { icon: '🗳️', name: 'Głos ludu',        desc: 'Zagłosuj w 5 ankietach',             ok: p.votes >= 5 },
            { icon: '🔥', name: 'Seria 7 dni',      desc: 'Bądź aktywny 7 dni z rzędu',         ok: s >= 7 },
            { icon: '👑', name: 'Top 3 widzów',     desc: 'Wskocz do top 3 rankingu punktów',   ok: p.role === 'owner' || (p.rank !== null && p.rank <= 3) }
        ];
    }

    return { level: level, need: need, title: title, rankOf: rankOf, RANKS: RANKS, ladder: ladder, REASONS: REASONS, RULES: RULES, streak: streak, badges: badges };
})();
