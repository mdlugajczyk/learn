import { CURRICULUM } from './curriculum.js';

export const AUDIO_MODEL = 'gpt-4o-mini-tts-2025-12-15';
export const AUDIO_VOICE = 'marin';
export const AUDIO_PACK_VERSION = '1.0.0';

const instructions = {
  'narrator-sample': 'Cześć, Kosmonauto. Jestem Momo. Będziemy spokojnie odkrywać dźwięki, litery i słowa.',
  'welcome-home': 'Gotowy na krótką misję czytelniczą? Naciśnij duży przycisk Start misji.',
  'mission-start': 'Zaczynamy spokojnie. Jeśli chcesz usłyszeć polecenie jeszcze raz, naciśnij głośnik.',
  'controls-speaker': 'To jest głośnik. Dotknij go, gdy chcesz usłyszeć polecenie jeszcze raz.',
  'controls-retry': 'To jest okrągła strzałka. Dotknij jej, gdy chcesz spróbować albo zobaczyć jeszcze raz.',
  'controls-go': 'Ta strzałka prowadzi dalej. Dotknij jej, gdy zadanie jest gotowe.',
  'warmup-blend': 'Posłuchaj dźwięków. Połącz je w słowo i wybierz odpowiedź.',
  'review-choose': 'Posłuchaj dźwięku. Dotknij pasującej litery.',
  'mapping-new': 'Poznajemy nowy znak. Dotknij go, żeby usłyszeć jego dźwięk.',
  'blend-swipe': 'Przesuń kropkę do końca. Potem posłuchaj całego słowa.',
  'build-word': 'Ułóż litery w pustych polach. Zacznij od pierwszego dźwięku.',
  'read-first': 'Przeczytaj słowo sam. Gdy będziesz gotowy, naciśnij Dalej.',
  'choose-meaning': 'Teraz wybierz obrazek, który pasuje do przeczytanego słowa.',
  'alien-word': 'To słowo kosmity. Nie musi nic znaczyć. Spróbuj je przeczytać dźwięk po dźwięku.',
  'story-attempt': 'Przeczytaj zdanie sam. Potem możesz posłuchać narratora.',
  'listening-scene': 'Posłuchaj uważnie krótkiej sceny, a potem odpowiedz na pytanie.',
  'correct-short': 'Brawo, udało się!',
  'correct-choice': 'Bardzo dobrze!',
  'retry-gentle': 'Zatrzymajmy się. Posłuchaj poprawnego dźwięku i spróbuj jeszcze raz.',
  'mission-complete': 'Misja zakończona. Wykonałeś dziś dobrą, spokojną pracę. Teraz czas na przerwę.',
  'repair-session': 'Dziś utrwalamy znane rzeczy. Mały krok też prowadzi do celu.',
  'audio-missing': 'Potrzebna jest pomoc dorosłego. Brakuje plików dźwiękowych tej misji.',
  'parent-probe': 'Po tej misji czeka krótka próba czytania z dorosłym. Nie blokuje następnej misji.',
  'baseline-lowercase': 'Dotknij małej litery, która pasuje do dużej litery.',
  'baseline-sound': 'Posłuchaj dźwięku i wybierz pasującą małą literę.',
  'baseline-first-sound': 'Posłuchaj słowa i wybierz jego pierwszy dźwięk.',
  'baseline-blend': 'Posłuchaj dźwięków i wskaż słowo, które powstało.',
  'baseline-segment': 'Ile dźwięków słyszysz w tym słowie? Dotknij odpowiedniej liczby.',
  'baseline-decode': 'Spróbuj przeczytać słowo. Dorosły zaznaczy, czy się udało.',
  'tap-continue': 'Naciśnij Dalej, kiedy będziesz gotowy.',
  'sound-a': 'a', 'sound-m': 'm', 'sound-o': 'o', 'sound-t': 't', 'sound-i': 'i', 'sound-l': 'l',
  'sound-k': 'k', 'sound-e': 'e', 'sound-s': 's', 'sound-n': 'n', 'sound-u': 'u', 'sound-y': 'y',
  'sound-p': 'p', 'sound-r': 'r', 'sound-d': 'd', 'sound-w': 'w', 'sound-b': 'b', 'sound-g': 'g',
  'sound-j': 'j', 'sound-c': 'c', 'sound-f': 'f', 'sound-ł': 'ł', 'sound-z': 'z', 'sound-ó': 'ó',
  'sound-h': 'h', 'sound-ch': 'ch', 'sound-sz': 'sz', 'sound-cz': 'cz', 'sound-ż': 'ż', 'sound-rz': 'rz',
  'sound-dz': 'dz', 'sound-dż': 'dż', 'sound-ą': 'ą', 'sound-ę': 'ę', 'sound-ś': 'ś', 'sound-ć': 'ć',
  'sound-ń': 'ń', 'sound-ź': 'ź', 'sound-dź': 'dź', 'sound-si': 'si', 'sound-ci': 'ci', 'sound-ni': 'ni',
  'sound-zi': 'zi', 'sound-dzi': 'dzi'
};

const entry = (id, text, category, extra = {}) => ({
  id, text, category, filename: `audio/${id}.mp3`, source: 'ai', model: AUDIO_MODEL, voice: AUDIO_VOICE,
  language: 'pl', generatedAt: null, contentHash: null, critical: category !== 'effect', ...extra
});

const all = Object.entries(instructions).map(([id, text]) => entry(id, text, id.startsWith('sound-') ? 'phoneme' : 'instruction', {
  direction: id.startsWith('sound-')
    ? 'Wymów wyłącznie czysty polski dźwięk, bez nazwy litery, bez dodanej samogłoski, ciepło i bardzo krótko.'
    : 'Mów naturalną polszczyzną, ciepło, spokojnie i odrobinę wolniej niż w rozmowie. Bez przesadnej kreskówkowej ekspresji.'
}));

const seenIds = new Set(all.map((value) => value.id));
for (const item of CURRICULUM.items) {
  for (const id of item.audioIds) {
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    all.push(entry(id, item.answer, item.type === 'nonword' ? 'nonword' : 'word', {
      direction: 'Wymów jedno polskie słowo naturalnie, wyraźnie i bez poprzedzającego komentarza. Nie literuj.'
    }));
  }
}
for (const story of CURRICULUM.stories) {
  story.sentences.forEach((sentence, index) => {
    all.push(entry(story.audioIds[index], sentence, 'story', {
      direction: 'Przeczytaj zdanie naturalną, ciepłą polszczyzną. Tempo spokojne, bez przesadnej ekspresji.'
    }));
  });
}
for (const scene of CURRICULUM.listeningScenes) {
  all.push(entry(scene.audioId, scene.text, 'listening', {
    direction: 'Opowiedz scenę naturalną, ciepłą polszczyzną. Zrób krótką pauzę przed pytaniem.'
  }));
}

export const AUDIO_ENTRIES = all;
export const AUDIO_BY_ID = new Map(all.map((value) => [value.id, value]));

export function audioEntry(id) {
  return AUDIO_BY_ID.get(id);
}
