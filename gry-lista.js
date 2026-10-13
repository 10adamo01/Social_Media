// =====================================================================
// Lista minigierek – używana przez stronę główną, zakładkę Minigierki i same gry.
// lower: true = mniejszy wynik jest lepszy (np. czas w ms)
// =====================================================================
window.ZAWLOX_GRY = {
    aim: {
        name: 'Aim Trainer',
        url: 'gra.html',
        tag: 'Celność',
        desc: '30 sekund trafiania w cele. Liczy się szybkość i celność.',
        unit: 'pkt',
        lower: false
    },
    reflex: {
        name: 'Refleks',
        url: 'refleks.html',
        tag: 'Czas reakcji',
        desc: 'Kliknij, gdy ekran zrobi się zielony. 5 prób, liczy się średni czas.',
        unit: 'ms',
        lower: true
    },
    memory: {
        name: 'Pamięć',
        url: 'pamiec.html',
        tag: 'Pamięć',
        desc: 'Zapamiętaj i powtórz coraz dłuższą sekwencję kolorów.',
        unit: 'poz.',
        lower: false
    },
    snake: {
        name: 'Wąż',
        url: 'snake.html',
        tag: 'Zręczność',
        desc: 'Klasyczny snake. Zbieraj punkty i nie wjedź w ścianę ani w siebie.',
        unit: 'pkt',
        lower: false
    }
};
