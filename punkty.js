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

    var RANKS = [
        [1, 'Nowy widz'], [3, 'Stały widz'], [5, 'Bywalec'], [8, 'Kozak'], [12, 'Giga Kozak'], [18, 'Legenda']
    ];
    function title(lvl) {
        var t = RANKS[0][1];
        for (var i = 0; i < RANKS.length; i++) if (lvl >= RANKS[i][0]) t = RANKS[i][1];
        return t;
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

    return { level: level, need: need, title: title, REASONS: REASONS, RULES: RULES, streak: streak, badges: badges };
})();
