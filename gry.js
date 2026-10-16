// =====================================================================
// Wspólny silnik minigierek: logowanie Discord, sesje gry, zapis wyników,
// ranking top 5, konto gracza i ekrany start / odliczanie / wynik.
//
// Użycie w grze:
//   Gry.init({ game: 'reflex', stage: elementPlanszy, countdown: true,
//              onStart(ranked) {...}, onAbort() {...}, onMenu() {...} });
//   Gry.finish({ score, details, stats: [['Trafienia', '16'], ...], aborted });
// =====================================================================
(function () {
    'use strict';

    const cfg = window.ZAWLOX_CONFIG || {};
    const LISTA = window.ZAWLOX_GRY || {};
    const sb = (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase)
        ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
        : null;
    const nf = new Intl.NumberFormat('pl-PL');

    // Ikony: Font Awesome Free 6.4.0 (https://fontawesome.com), licencja CC BY 4.0
    const ICONS = {
            "arrow-right": [
                    "0 0 448 512",
                    "M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z"
            ],
            "play": [
                    "0 0 384 512",
                    "M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"
            ],
            "discord": [
                    "0 0 640 512",
                    "M524.531,69.836a1.5,1.5,0,0,0-.764-.7A485.065,485.065,0,0,0,404.081,32.03a1.816,1.816,0,0,0-1.923.91,337.461,337.461,0,0,0-14.9,30.6,447.848,447.848,0,0,0-134.426,0,309.541,309.541,0,0,0-15.135-30.6,1.89,1.89,0,0,0-1.924-.91A483.689,483.689,0,0,0,116.085,69.137a1.712,1.712,0,0,0-.788.676C39.068,183.651,18.186,294.69,28.43,404.354a2.016,2.016,0,0,0,.765,1.375A487.666,487.666,0,0,0,176.02,479.918a1.9,1.9,0,0,0,2.063-.676A348.2,348.2,0,0,0,208.12,430.4a1.86,1.86,0,0,0-1.019-2.588,321.173,321.173,0,0,1-45.868-21.853,1.885,1.885,0,0,1-.185-3.126c3.082-2.309,6.166-4.711,9.109-7.137a1.819,1.819,0,0,1,1.9-.256c96.229,43.917,200.41,43.917,295.5,0a1.812,1.812,0,0,1,1.924.233c2.944,2.426,6.027,4.851,9.132,7.16a1.884,1.884,0,0,1-.162,3.126,301.407,301.407,0,0,1-45.89,21.83,1.875,1.875,0,0,0-1,2.611,391.055,391.055,0,0,0,30.014,48.815,1.864,1.864,0,0,0,2.063.7A486.048,486.048,0,0,0,610.7,405.729a1.882,1.882,0,0,0,.765-1.352C623.729,277.594,590.933,167.465,524.531,69.836ZM222.491,337.58c-28.972,0-52.844-26.587-52.844-59.239S193.056,219.1,222.491,219.1c29.665,0,53.306,26.82,52.843,59.239C275.334,310.993,251.924,337.58,222.491,337.58Zm195.38,0c-28.971,0-52.843-26.587-52.843-59.239S388.437,219.1,417.871,219.1c29.667,0,53.307,26.82,52.844,59.239C470.715,310.993,447.538,337.58,417.871,337.58Z"
            ],
            "gamepad": [
                    "0 0 640 512",
                    "M192 64C86 64 0 150 0 256S86 448 192 448H448c106 0 192-86 192-192s-86-192-192-192H192zM496 168a40 40 0 1 1 0 80 40 40 0 1 1 0-80zM392 304a40 40 0 1 1 80 0 40 40 0 1 1 -80 0zM168 200c0-13.3 10.7-24 24-24s24 10.7 24 24v32h32c13.3 0 24 10.7 24 24s-10.7 24-24 24H216v32c0 13.3-10.7 24-24 24s-24-10.7-24-24V280H136c-13.3 0-24-10.7-24-24s10.7-24 24-24h32V200z"
            ]
    };

    let opts = null, game = null, gameId = '';
    let user = null, myBest = null;
    let ranked = false, sessionId = null, state = 'menu';
    let el = {};

    // ---------- pomocnicze ----------
    const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
    const icon = (name) => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;
    const fmt = (n) => n === null || n === undefined ? '–' : nf.format(n) + (game && game.unit ? ' ' + game.unit : '');
    const better = (a, b) => b === null || b === undefined || (game.lower ? a < b : a > b);

    let toastTimer;
    function toast(text, isError = false) {
        const t = el.toast;
        t.textContent = text;
        t.classList.toggle('error', isError);
        t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
    }

    function displayName(u) {
        const m = (u && u.user_metadata) || {};
        return (m.custom_claims && m.custom_claims.global_name) || m.full_name || m.name || 'Gracz';
    }

    // ---------- budowa interfejsu ----------
    function injectIcons() {
        const defs = Object.entries(ICONS)
            .map(([n, [vb, d]]) => `<symbol id="i-${n}" viewBox="${vb}"><path d="${d}"/></symbol>`).join('');
        const svg = h(`<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${defs}</defs></svg>`);
        document.body.prepend(svg);
    }

    function buildOverlays(stage) {
        stage.append(
            h(`<div class="overlay" data-ov="start">
                <h2>Gotowy?</h2>
                <p data-el="start-text"></p>
                <div class="overlay-actions">
                    <button type="button" class="btn btn-primary" data-el="btn-play" hidden>${icon('play')} Graj o ranking</button>
                    <button type="button" class="btn btn-discord" data-el="btn-login" hidden>${icon('discord')} Zaloguj przez Discord</button>
                    <button type="button" class="btn btn-ghost" data-el="btn-practice">Trening</button>
                </div>
            </div>`),
            h(`<div class="overlay" data-ov="count" hidden><div class="countdown" data-el="count-num">3</div></div>`),
            h(`<div class="overlay" data-ov="result" hidden>
                <p class="kicker" data-el="res-label">Twój wynik</p>
                <div class="big-score" data-el="res-score">0</div>
                <div class="result-stats" data-el="res-stats"></div>
                <p class="result-msg" data-el="res-msg" role="status"></p>
                <div class="overlay-actions">
                    <button type="button" class="btn btn-primary" data-el="btn-again">${icon('play')} Zagraj jeszcze raz</button>
                    <button type="button" class="btn btn-ghost" data-el="btn-menu">Menu</button>
                </div>
            </div>`)
        );
    }

    function buildSide(side) {
        side.append(
            h(`<div class="hud is-silver panel"><div class="hud-in">
                <h2 class="panel-title">Top 5 <small>${game.lower ? 'najniższy czas' : 'najlepsze wyniki'}</small></h2>
                <ol class="board" data-el="board" aria-live="polite"></ol>
            </div></div>`),
            h(`<div class="hud panel"><div class="hud-in">
                <h2 class="panel-title">Twoje konto</h2>
                <div data-el="acc-guest">
                    <p class="account-note" data-el="acc-guest-text">Zaloguj się przez Discord – w rankingu pojawi się Twoja nazwa i avatar z Discorda. Jedno logowanie działa we wszystkich minigierkach.</p>
                    <button type="button" class="btn btn-discord btn-sm" data-el="btn-login-side">${icon('discord')} Zaloguj przez Discord</button>
                </div>
                <div data-el="acc-user" hidden>
                    <div class="me">
                        <img class="avatar" data-el="me-avatar" alt="" width="44" height="44">
                        <div>
                            <div class="me-name" data-el="me-name"></div>
                            <div class="me-best">Rekord: <b data-el="me-best">–</b><span data-el="me-rank"></span></div>
                        </div>
                    </div>
                    <div class="me-actions"><a class="btn btn-primary btn-sm" href="profil.html">Mój profil</a><button type="button" class="btn btn-ghost btn-sm" data-el="btn-logout">Wyloguj</button></div>
                </div>
            </div></div>`),
            h(`<a class="btn btn-ghost btn-sm other-games" href="minigierki.html">${icon('gamepad')} Wszystkie minigierki</a>`)
        );
    }

    function collect(root) {
        root.querySelectorAll('[data-el]').forEach(n => { el[n.dataset.el] = n; });
        root.querySelectorAll('[data-ov]').forEach(n => { el['ov-' + n.dataset.ov] = n; });
    }

    function showOverlay(name) {
        ['start', 'count', 'result'].forEach(n => { el['ov-' + n].hidden = n !== name; });
    }

    // ---------- konto ----------
    function renderAccount() {
        const logged = !!user;
        el['acc-guest'].hidden = logged;
        el['acc-user'].hidden = !logged;
        el['btn-play'].hidden = !logged;
        el['btn-login'].hidden = logged || !sb;
        el['btn-login-side'].hidden = !sb;

        if (!sb) {
            el['start-text'].textContent = 'Ranking nie jest jeszcze włączony – możesz zagrać trening.';
            el['acc-guest-text'].textContent = 'Ranking pojawi się wkrótce. Na razie możesz trenować bez logowania.';
        } else if (logged) {
            el['start-text'].textContent = `Grasz jako ${displayName(user)}. Twój najlepszy wynik trafi do rankingu.`;
            el['me-name'].textContent = displayName(user);
            const av = user.user_metadata && user.user_metadata.avatar_url;
            el['me-avatar'].src = av || '';
            el['me-avatar'].style.visibility = av ? 'visible' : 'hidden';
            el['me-best'].textContent = fmt(myBest);
        } else {
            el['start-text'].textContent = 'Zaloguj się przez Discord, żeby Twój wynik trafił do rankingu, albo zagraj trening.';
        }
    }

    async function login() {
        if (!sb) return;
        const { error } = await sb.auth.signInWithOAuth({
            provider: 'discord',
            options: { redirectTo: location.origin + location.pathname }
        });
        if (error) toast('Nie udało się zalogować: ' + error.message, true);
    }

    async function logout() {
        if (!sb) return;
        await sb.auth.signOut();
        user = null; myBest = null;
        renderAccount();
        loadBoard();
    }

    async function loadMyBest() {
        if (!sb || !user) return;
        const { data } = await sb.from('leaderboard').select('score')
            .eq('game', gameId).eq('user_id', user.id).maybeSingle();
        myBest = data ? data.score : null;
        el['me-best'].textContent = fmt(myBest);
        if (myBest === null) { el['me-rank'].textContent = ''; return; }
        let q = sb.from('leaderboard').select('user_id', { count: 'exact', head: true }).eq('game', gameId);
        q = game.lower ? q.lt('score', myBest) : q.gt('score', myBest);
        const { count } = await q;
        el['me-rank'].textContent = typeof count === 'number' ? ` · miejsce #${count + 1}` : '';
    }

    // ---------- ranking ----------
    function avatarEl(url, name) {
        if (url) {
            const img = document.createElement('img');
            img.className = 'avatar'; img.alt = ''; img.width = 32; img.height = 32;
            img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
            img.src = url;
            return img;
        }
        const d = document.createElement('div');
        d.className = 'avatar avatar-fallback';
        d.textContent = (name || '?').slice(0, 1).toUpperCase();
        return d;
    }

    async function loadBoard() {
        const board = el.board;
        if (!sb) { board.innerHTML = '<li class="board-empty">Ranking wkrótce</li>'; return; }
        if (!board.children.length) board.innerHTML = '<li class="skeleton-row"></li>'.repeat(5);
        const { data, error } = await sb.from('leaderboard')
            .select('user_id, player_name, avatar_url, score')
            .eq('game', gameId)
            .order('score', { ascending: !!game.lower })
            .order('created_at', { ascending: true })
            .limit(5);
        if (error) { board.innerHTML = '<li class="board-empty">Nie udało się wczytać rankingu</li>'; return; }
        if (!data.length) { board.innerHTML = '<li class="board-empty">Brak wyników – bądź pierwszy!</li>'; return; }
        board.innerHTML = '';
        data.forEach((p, i) => {
            const li = document.createElement('li');
            li.className = 'row' + (user && p.user_id === user.id ? ' is-me' : '');
            const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = i + 1;
            const name = document.createElement('span'); name.className = 'pname'; name.textContent = p.player_name;
            const score = document.createElement('span'); score.className = 'pscore'; score.textContent = fmt(p.score);
            li.append(rank, avatarEl(p.avatar_url, p.player_name), name, score);
            board.appendChild(li);
        });
    }

    // ---------- przebieg gry ----------
    async function start(isRanked) {
        if (state === 'countdown' || state === 'playing' || state === 'starting') return;
        ranked = isRanked && !!sb && !!user;
        sessionId = null;

        if (ranked) {
            state = 'starting';
            el['btn-play'].disabled = true;
            el['btn-again'].disabled = true;
            const { data, error } = await sb.rpc('start_game', { p_game: gameId });
            el['btn-play'].disabled = false;
            el['btn-again'].disabled = false;
            state = 'menu';
            if (error) {
                toast(/not_logged_in|JWT/i.test(error.message)
                    ? 'Sesja wygasła – zaloguj się ponownie.'
                    : 'Nie udało się rozpocząć gry rankingowej.', true);
                return;
            }
            sessionId = data;
        }

        if (opts.onPrepare) opts.onPrepare(ranked);

        if (opts.countdown) {
            state = 'countdown';
            showOverlay('count');
            for (const n of [3, 2, 1]) {
                const c = el['count-num'];
                c.textContent = n;
                c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        showOverlay(null);
        state = 'playing';
        opts.onStart(ranked);
    }

    async function finish({ score, details = {}, stats = [], aborted = false, label }) {
        if (state !== 'playing') return;
        state = 'result';

        el['res-label'].textContent = label || (ranked ? 'Twój wynik' : 'Trening');
        el['res-score'].textContent = fmt(score);
        el['res-stats'].innerHTML = '';
        for (const [k, v] of stats) {
            const s = document.createElement('span');
            s.append(k + ': ');
            const b = document.createElement('b'); b.textContent = v; s.append(b);
            el['res-stats'].append(s);
        }
        const msg = el['res-msg'];
        msg.className = 'result-msg';
        msg.textContent = ranked ? 'Zapisuję wynik…' : (sb ? 'Trening – wynik nie trafia do rankingu.' : '');
        showOverlay('result');

        if (!ranked) return;
        if (aborted) {
            msg.classList.add('bad');
            msg.textContent = 'Gra przerwana – wynik nie został zapisany.';
            return;
        }
        const prevBest = myBest;
        const { data: best, error } = await sb.rpc('submit_score', {
            p_session: sessionId, p_score: score, p_details: details
        });
        if (error) {
            msg.classList.add('bad');
            msg.textContent = /invalid_time|invalid_session/.test(error.message)
                ? 'Wynik odrzucony – gra trwała nietypowo albo została przerwana. Spróbuj jeszcze raz.'
                : 'Nie udało się zapisać wyniku. Spróbuj jeszcze raz.';
            return;
        }
        myBest = best;
        msg.classList.add('good');
        msg.textContent = better(score, prevBest) && score === best
            ? '🏆 Nowy rekord! Wynik zapisany w rankingu.'
            : `Wynik zapisany. Twój rekord: ${fmt(best)}.`;
        loadBoard();
        loadMyBest();
    }

    // ---------- start ----------
    async function init(options) {
        opts = options;
        gameId = options.game;
        game = LISTA[gameId] || { name: gameId, unit: '', lower: false };
        el.toast = document.getElementById('toast') || document.body.appendChild(h('<div class="toast" role="status" aria-live="polite"></div>'));

        injectIcons();
        buildOverlays(options.stage);
        const side = document.getElementById('gry-side');
        buildSide(side);
        collect(options.stage); collect(side);

        el['btn-play'].addEventListener('click', () => start(true));
        el['btn-practice'].addEventListener('click', () => start(false));
        el['btn-again'].addEventListener('click', () => start(!!user && !!sb));
        el['btn-menu'].addEventListener('click', () => { state = 'menu'; showOverlay('start'); if (opts.onMenu) opts.onMenu(); });
        el['btn-login'].addEventListener('click', login);
        el['btn-login-side'].addEventListener('click', login);
        el['btn-logout'].addEventListener('click', logout);

        // Zmiana karty w trakcie gry = przerwanie (inaczej zegar biegnie dalej)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && state === 'playing' && opts.onAbort) opts.onAbort();
        });

        renderAccount();
        loadBoard();
        if (!sb) {
            if (cfg.supabaseUrl && !window.supabase) toast('Nie udało się wczytać rankingu – odśwież stronę.', true);
            return;
        }
        const { data } = await sb.auth.getSession();
        user = data.session ? data.session.user : null;
        renderAccount();
        if (user) { loadMyBest(); loadBoard(); }
        sb.auth.onAuthStateChange((_e, session) => {
            const was = user && user.id;
            user = session ? session.user : null;
            if ((user && user.id) !== was) { renderAccount(); loadMyBest(); loadBoard(); }
        });
    }

    window.Gry = {
        init,
        finish,
        toast,
        get state() { return state; },
        get playing() { return state === 'playing'; }
    };
})();
