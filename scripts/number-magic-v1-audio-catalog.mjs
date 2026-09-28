const EN = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const PL = ['', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć', 'dziesięć'];

const entries = [];

function add(id, en, pl, cues = []) {
  entries.push(
    { id, locale: 'en', text: en, filename: `v1-${id}-en.mp3`, cues },
    { id, locale: 'pl', text: pl, filename: `v1-${id}-pl.mp3`, cues }
  );
}

add('welcome', "Hi! Let's build a playground together!", 'Cześć! Zbudujmy razem plac zabaw!');
add('session-end', 'We built it! All done, or play again?', 'Zbudowaliśmy plac zabaw! Koniec czy gramy jeszcze raz?');
add('join-look', "Let's look at the blocks.", 'Spójrzmy na klocki.');
add('join-count', "Let's count together.", 'Policzmy razem.');

for (let a = 1; a <= 9; a += 1) {
  for (let b = 1; b <= 10 - a; b += 1) {
    const sum = a + b;
    const enA = `${EN[a][0].toUpperCase()}${EN[a].slice(1)}`;
    const plA = `${PL[a][0].toUpperCase()}${PL[a].slice(1)}`;
    add(`join-ask-${a}-${b}`, `${enA} and ${EN[b]}. How many altogether?`, `${plA} i ${PL[b]}. Ile jest razem?`);
    add(`join-result-${a}-${b}`, `${enA} and ${EN[b]} make ${EN[sum]}!`, `${plA} i ${PL[b]} to razem ${PL[sum]}!`);
  }
}

for (let number = 1; number <= 10; number += 1) {
  add(`count-${number}`, `${EN[number][0].toUpperCase()}${EN[number].slice(1)}.`, `${PL[number][0].toUpperCase()}${PL[number].slice(1)}.`);
}

for (let number = 2; number <= 10; number += 1) {
  add(
    `join-tap-${number}`,
    `${EN[number][0].toUpperCase()}${EN[number].slice(1)} blocks altogether. Tap ${EN[number]}.`,
    `Razem jest ${PL[number]} klocków. Dotknij liczby ${PL[number]}.`
  );
}

add('share-target-3-right-1', 'Three toys. Give your sister one. The rest are for you.', 'Są trzy zabawki. Daj siostrze jedną. Reszta jest dla ciebie.');
add('share-target-4-right-2', 'Four toys. Give your sister two. The rest are for you.', 'Są cztery zabawki. Daj siostrze dwie. Reszta jest dla ciebie.');
add('share-target-5-right-2', 'Five toys. Give your sister two. The rest are for you.', 'Jest pięć zabawek. Daj siostrze dwie. Reszta jest dla ciebie.');
add('share-free-3', 'Share these three toys between both baskets.', 'Rozdziel te trzy zabawki do dwóch koszyków.');
add('share-free-5', 'Share these five toys between both baskets.', 'Rozdziel te pięć zabawek do dwóch koszyków.');

for (const [total, pl] of [[2, 'Są dwie'], [4, 'Są cztery'], [6, 'Jest sześć'], [8, 'Jest osiem'], [10, 'Jest dziesięć']]) {
  add(`share-equal-${total}`, `${EN[total][0].toUpperCase()}${EN[total].slice(1)} toys. Give each of you the same number. Use all the toys.`, `${pl} zabawek. Daj każdemu tyle samo. Użyj wszystkich zabawek.`);
}

for (const [total, pl] of [[3, 'Są trzy'], [5, 'Jest pięć'], [7, 'Jest siedem'], [9, 'Jest dziewięć']]) {
  add(`share-remainder-${total}`, `${EN[total][0].toUpperCase()}${EN[total].slice(1)} whole toys. Give each of you the same number. Leave the extra toy on the tray.`, `${pl} całych zabawek. Daj każdemu tyle samo. Zostaw dodatkową zabawkę na tacy.`);
}

add('share-use-all', 'Use all the toys.', 'Użyj wszystkich zabawek.');
add('share-target-1', "Your sister needs one. Let's count hers.", 'Siostra potrzebuje jednej zabawki. Policzmy ją.');
add('share-target-2', "Your sister needs two. Let's count hers.", 'Siostra potrzebuje dwóch zabawek. Policzmy je.');
add('share-unmatched', "These don't have a partner. Can you make the groups the same?", 'Te zabawki nie mają pary. Czy grupy mogą być takie same?');
add('share-more-pairs', 'There are enough for one more each.', 'Wystarczy zabawek, żeby dać każdemu jeszcze jedną.');
add('share-put-back', 'One basket has more. Put one back.', 'W jednym koszyku jest więcej. Odłóż jedną zabawkę.');
add('share-both-groups', 'Put at least one toy in each basket.', 'Włóż co najmniej jedną zabawkę do każdego koszyka.');

const PL_EACH = ['', 'Każdy ma po jednej.', 'Każdy ma po dwie.', 'Każdy ma po trzy.', 'Każdy ma po cztery.', 'Każdy ma po pięć.'];
for (let each = 1; each <= 5; each += 1) {
  add(`share-equal-result-${each}`, `${EN[each][0].toUpperCase()}${EN[each].slice(1)} each. The same number!`, `${PL_EACH[each]} Tyle samo!`);
}
for (let each = 1; each <= 4; each += 1) {
  add(`share-remainder-result-${each}`, `${EN[each][0].toUpperCase()}${EN[each].slice(1)} each, and one left over.`, `${PL_EACH[each]} Jedna została.`);
}

for (const [left, right] of [[1, 2], [2, 1], [1, 4], [2, 2], [2, 3], [3, 2], [4, 1]]) {
  const total = left + right;
  add(
    `share-parts-${left}-${right}`,
    `${EN[left][0].toUpperCase()}${EN[left].slice(1)} and ${EN[right]}. ${EN[total][0].toUpperCase()}${EN[total].slice(1)} altogether.`,
    `${PL[left][0].toUpperCase()}${PL[left].slice(1)} i ${PL[right]}. Razem ${PL[total]}.`
  );
}

export const NUMBER_MAGIC_V1_AUDIO_ENTRIES = Object.freeze(entries);
export const NUMBER_MAGIC_V1_AUDIO_BY_FILENAME = new Map(entries.map(entry => [entry.filename, entry]));
