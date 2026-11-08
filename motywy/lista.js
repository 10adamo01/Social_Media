// =====================================================================
// LISTA MOTYWÓW STRONY
//
// Jak dodać nowy motyw (3 kroki):
//   1. Skopiuj plik motywy/_szablon.css jako motywy/<id>.css
//      (np. motywy/halloween.css) i zmień w nim kolory.
//   2. Dopisz motyw na końcu listy poniżej (skopiuj blok GTA 6 i zmień wartości).
//   3. Wrzuć oba pliki na GitHuba do folderu "motywy".
// Nowy motyw pojawi się w Ustawieniach i w profilach widzów najpóźniej po ~10 minutach.
//
// Pola:
//   id        – krótka nazwa bez spacji i polskich znaków (taka sama jak nazwa pliku CSS)
//   nazwa     – nazwa widoczna na stronie
//   opis      – jedno zdanie o motywie
//   kolory    – 3 kolory do kafelka z podglądem: [tło, główny akcent, drugi akcent]
//   akcent    – kolor przycisków i podkreśleń (zastępuje kolor z Ustawień); pomiń, żeby użyć koloru z Ustawień
//   odPoziomu – od którego poziomu widz może sam włączyć motyw w profilu
//               (1 Nowy widz, 3 Stały widz, 5 Bywalec, 8 Kozak, 12 Giga Kozak, 18 Legenda)
//   plik      – ścieżka do pliku CSS motywu (motyw domyślny go nie ma)
//   premium   – true = złote wyróżnienie kafelka i napis PREMIUM (opcjonalnie)
// =====================================================================
window.ZAWLOX_MOTYWY = [
    {
        id: 'domyslny',
        nazwa: 'Zawlox',
        opis: 'Klasyczny wygląd kanału – ciemne tło, srebrne ramki i kolor akcentu z Ustawień.',
        kolory: ['#0e0e10', '#9147ff', '#d4d4d8'],
        odPoziomu: 1
    },
    {
        id: 'terminal',
        nazwa: 'Terminal',
        opis: 'Zielony ekran hakera – neonowa zieleń na czerni i linie jak w starym monitorze.',
        kolory: ['#040905', '#22c55e', '#b6ffc8'],
        akcent: '#22c55e',
        odPoziomu: 3,
        plik: 'motywy/terminal.css'
    },
    {
        id: 'gta6',
        nazwa: 'GTA 6 · Vice City',
        opis: 'Neonowy zachód słońca nad Vice City – róż, pomarańcz i turkus.',
        kolory: ['#1a0b2e', '#ff2e88', '#22d3ee'],
        akcent: '#ff2e88',
        odPoziomu: 5,
        plik: 'motywy/gta6.css'
    },
    {
        id: 'zorza',
        nazwa: 'Zorza polarna',
        opis: 'Granatowa noc, gwiazdy i powoli falująca zorza w turkusie i fiolecie.',
        kolory: ['#050b18', '#5eead4', '#818cf8'],
        akcent: '#2dd4bf',
        odPoziomu: 8,
        plik: 'motywy/zorza.css'
    },
    {
        id: 'inferno',
        nazwa: 'Inferno',
        opis: 'Lawa i ogień – żar od dołu ekranu i unoszące się iskry.',
        kolory: ['#0d0503', '#f97316', '#dc2626'],
        akcent: '#f97316',
        odPoziomu: 12,
        plik: 'motywy/inferno.css'
    },
    {
        id: 'zloty-kozak',
        nazwa: 'Złoty Kozak',
        opis: 'Motyw premium dla Legend – czerń i mieniące się złoto, złote ramki z błyskiem i złoty pył.',
        kolory: ['#090806', '#e2b84a', '#fff4c9'],
        akcent: '#e2b84a',
        odPoziomu: 18,
        premium: true,
        plik: 'motywy/zloty-kozak.css'
    }
];
