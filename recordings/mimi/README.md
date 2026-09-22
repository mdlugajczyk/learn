# MIMI — własne nagrania

Każdy klip aplikacji ma stałą, czytelną nazwę. Nagraj tylko jedną linię na plik,
zapisaną dokładnie podaną nazwą. iPhone Voice Memos (`.m4a`), WAV i MP3 są
obsługiwane. Po nagraniu przenieś pliki do tego folderu i uruchom z głównego
folderu projektu:

```sh
npm run audio:mimi:import
```

Skrypt normalizuje dźwięk, zamienia go na format aplikacji i oznacza go jako
`human` w manifeście — generator ElevenLabs już go nie nadpisze. Aby sprawdzić
co zostanie użyte bez zmiany plików: `npm run audio:mimi:import -- --dry-run`.
Po imporcie uruchom `npm run build`, a następnie opublikuj zmiany.

Nagrywaj w cichym pokoju, 15–20 cm od mikrofonu, z krótką ciszą na początku i
końcu. Mów spokojnie, naturalnie i po polsku. Przy głoskach nie dodawaj samogłoski:
`mmmm`, a nie `my`; `llll`, a nie `ly`.

| Nagraj jako | Powiedz / zrób dokładnie to |
|---|---|
| `touch-letter.m4a` | „Dotknij litery i posłuchaj jej dźwięku.” |
| `join-sounds.m4a` | „Dotknij strzałki. Posłuchaj, jak dźwięki łączą się razem.” |
| `join-chunks.m4a` | „Połączmy znane kawałki w całe słowo. Dotknij strzałki.” |
| `listen-choose.m4a` | „Posłuchaj. Dotknij pasującego napisu.” |
| `read-tap.m4a` | „Przeczytaj i dotknij.” |
| `two-words.m4a` | „Teraz dwa słowa. Pierwsze mówi, kogo szukamy. Drugie mówi, co trzeba dotknąć. Pod obrazkami są powiększone kawałki. Zobacz.” |
| `help.m4a` | „Przeczytajmy razem.” |
| `retry.m4a` | „Spróbuj jeszcze raz. Popatrz uważnie na litery.” |
| `correct-1.m4a` | „Brawo, udało się!” |
| `correct-2.m4a` | „Bardzo dobrze!” |
| `finish.m4a` | „Pięknie się dzisiaj czytało. Mimi dziękuje. Teraz czas na przerwę.” |
| `resume.m4a` | „Dotknij strzałki, żeby wrócić do zabawy.” |
| `sound-a.m4a` | Czyste „a”. |
| `sound-i.m4a` | Czyste „i”. |
| `sound-m.m4a` | Długie, czyste „mmmm”, bez „y”. |
| `sound-l.m4a` | Długie, czyste „llll”, bez „y”. |
| `sound-o.m4a` | Czyste „o”. |
| `sound-n.m4a` | Długie, czyste „nnnn”, bez „y”. |
| `sound-s.m4a` | Długie, czyste „ssss”, bez „y”. |
| `blend-ma.m4a` | Połącz płynnie „mmmm-a”, kończąc na „ma”. |
| `blend-mi.m4a` | Połącz płynnie „mmmm-i”, kończąc na „mi”. |
| `blend-la.m4a` | Połącz płynnie „llll-a”, kończąc na „la”. |
| `blend-li.m4a` | Połącz płynnie „llll-i”, kończąc na „li”. |
| `blend-ta.m4a` | „ta”. |
| `blend-to.m4a` | „to”. |
| `blend-ko.m4a` | „ko”. |
| `blend-no.m4a` | Połącz płynnie „nnnn-o”, kończąc na „no”. |
| `blend-ga.m4a` | „ga”. |
| `word-ma.m4a` | „ma”. |
| `word-mi.m4a` | „mi”. |
| `word-la.m4a` | „la”. |
| `word-li.m4a` | „li”. |
| `word-ta.m4a` | „ta”. |
| `word-to.m4a` | „to”. |
| `word-ko.m4a` | „ko”. |
| `word-no.m4a` | „no”. |
| `word-ga.m4a` | „ga”. |
| `word-mama.m4a` | „mama” — naturalnie po polsku. |
| `word-mimi.m4a` | „Mimi” — imię królika. |
| `word-lala.m4a` | „lala”. |
| `word-tata.m4a` | „tata”. |
| `word-oko.m4a` | „oko”. |
| `word-nos.m4a` | „nos”. |
| `word-noga.m4a` | „noga”. |
| `meet-family.m4a` | „To Mimi z jasnymi plamkami, a to mama w czerwonej sukience. Będziemy czytać i szukać obrazków. Głośnik powtarza polecenie. Okrągła strzałka pokazuje jeszcze raz. Zaczynamy!” |
| `meet-doll.m4a` | „Mimi ma nową zabawkę. To lala. Zaraz spróbujemy przeczytać to słowo.” |
| `meet-dad.m4a` | „To tata w zielonym swetrze. Nauczymy się czytać jego słowo.” |

`meet-*` są obecnie niewykorzystane w lekcjach, ale pozostają opisane, aby cały
pakiet nagrań był kompletny i gotowy na przyszłe lekcje.
