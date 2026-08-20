export const CURRICULUM_VERSION = '1.0.0';

const reviewDays = [1, 2, 4, 7, 14];

const stageSource = [
  {
    id: 'stage-0', order: 0, name: 'Baza kosmiczna', planet: 'Start',
    introducedGraphemes: [], prerequisites: [], words: [], nonwords: []
  },
  {
    id: 'stage-1', order: 1, name: 'Planeta Ametyst', planet: 'Ametyst',
    introducedGraphemes: ['a', 'm', 't', 'o'], prerequisites: ['stage-0'],
    words: ['ma', 'mama', 'ta', 'tata', 'mata', 'tama', 'to', 'oto', 'tam', 'tom', 'atom'],
    nonwords: ['ama', 'mato', 'toma', 'omam', 'atam', 'mota']
  },
  {
    id: 'stage-2', order: 2, name: 'Planeta Limonka', planet: 'Limonka',
    introducedGraphemes: ['k', 'i', 'l', 'e'], prerequisites: ['stage-1'],
    words: ['kot', 'kotek', 'motek', 'molo', 'lok', 'lato', 'lata', 'lot', 'lotka', 'meta', 'mak', 'mleko', 'Ela', 'Ala', 'kalka', 'kilka', 'kometa', 'taki'],
    nonwords: ['lamek', 'kimo', 'teli', 'malko', 'ekat', 'oltek']
  },
  {
    id: 'stage-3', order: 3, name: 'Planeta Sosenka', planet: 'Sosenka',
    introducedGraphemes: ['s', 'n', 'u', 'y'], prerequisites: ['stage-2'],
    words: ['syn', 'sen', 'nos', 'las', 'lis', 'osa', 'miska', 'maska', 'misa', 'maki', 'lina', 'nuta', 'nuty', 'list', 'most', 'smok', 'sok', 'sum', 'kuna', 'kasa', 'kino', 'nisko'],
    nonwords: ['sulem', 'nako', 'mynos', 'lusek', 'kasin', 'tuno']
  },
  {
    id: 'stage-4', order: 4, name: 'Planeta Woda', planet: 'Woda',
    introducedGraphemes: ['d', 'p', 'r', 'w'], prerequisites: ['stage-3'],
    words: ['dom', 'woda', 'rower', 'worek', 'park', 'para', 'pora', 'pole', 'drut', 'drewno', 'deska', 'sowa', 'kura', 'rama', 'rano', 'pralka', 'spodek', 'puder', 'dywan', 'drwal', 'ruda', 'nora', 'ser', 'peron'],
    nonwords: ['wurem', 'pados', 'dranek', 'soper', 'rymak', 'wostu']
  },
  {
    id: 'stage-5', order: 5, name: 'Planeta Błękit', planet: 'Błękit',
    introducedGraphemes: ['b', 'g', 'j', 'c'], prerequisites: ['stage-4'],
    words: ['but', 'bok', 'guma', 'gra', 'jagoda', 'cebula', 'banan', 'jajko', 'jajka', 'bajka', 'gaj', 'cyrk', 'robot', 'balon', 'wagon', 'garnek', 'koc', 'noc', 'cena', 'jajo', 'kajak', 'rogal', 'noga', 'bonus'],
    nonwords: ['gajun', 'becor', 'jomar', 'cugon', 'baruk', 'nigat']
  },
  {
    id: 'stage-6', order: 6, name: 'Planeta Fala', planet: 'Fala',
    introducedGraphemes: ['f', 'ł', 'z'], prerequisites: ['stage-5'],
    words: ['fala', 'foka', 'fotel', 'lufa', 'zamek', 'zupa', 'zero', 'koza', 'waza', 'łapa', 'łata', 'łuk', 'głowa', 'alfabet', 'telefon', 'flet', 'flaga', 'zlew', 'lizak', 'walizka', 'fasola', 'bułka', 'jabłko', 'łobuz'],
    nonwords: ['fuzak', 'łamer', 'zofil', 'felun', 'głonek', 'wazop']
  },
  {
    id: 'stage-7', order: 7, name: 'Planeta Chmurka', planet: 'Chmurka',
    introducedGraphemes: ['ó', 'h', 'ch'], prerequisites: ['stage-6'],
    words: ['góra', 'król', 'lód', 'łódka', 'wóz', 'ból', 'stół', 'chata', 'chleb', 'echo', 'hak', 'hamak', 'herbata', 'hotel', 'hula', 'mucha', 'ucho', 'dach', 'mech', 'puch', 'duch', 'chmura', 'choroba', 'choinka', 'chomik', 'równy'],
    nonwords: ['chólek', 'humar', 'górach', 'fucho', 'łónek', 'chelus']
  },
  {
    id: 'stage-8', order: 8, name: 'Planeta Szum', planet: 'Szum',
    introducedGraphemes: ['sz', 'cz', 'ż', 'rz'], prerequisites: ['stage-7'],
    words: ['szafa', 'szalik', 'szum', 'mysz', 'kosz', 'czapka', 'czapla', 'kaczka', 'mecz', 'żaba', 'żuk', 'jeż', 'róża', 'ryż', 'rzeka', 'burza', 'morze', 'orzech', 'grzyb', 'drzewo', 'krzesło', 'talerz', 'lekarz', 'szczotka', 'szczur', 'warzywa'],
    nonwords: ['szórek', 'czalim', 'żupak', 'rzefon', 'myszor', 'grzuma']
  },
  {
    id: 'stage-9', order: 9, name: 'Planeta Wstęga', planet: 'Wstęga',
    introducedGraphemes: ['dz', 'dż', 'ą', 'ę'], prerequisites: ['stage-8'],
    words: ['dzban', 'dzwon', 'koledzy', 'rdza', 'chodzę', 'widzę', 'jedzą', 'pędzel', 'wędka', 'mąż', 'wąż', 'ząb', 'kąt', 'bąk', 'dąb', 'ręka', 'zęby', 'tęcza', 'gąska', 'mądry', 'wąsy', 'dżem', 'dżungla', 'drożdże', 'pająk', 'węzeł'],
    nonwords: ['dząpa', 'dżelum', 'kązer', 'wędom', 'pądżek', 'rędza']
  },
  {
    id: 'stage-10', order: 10, name: 'Planeta Światło', planet: 'Światło',
    introducedGraphemes: ['ś', 'ć', 'ń', 'ź', 'dź'], prerequisites: ['stage-9'],
    words: ['ślad', 'łoś', 'oś', 'ość', 'kość', 'ćma', 'spać', 'prać', 'brać', 'koń', 'słoń', 'bańka', 'dłoń', 'źrebak', 'woźny', 'źródło', 'gwóźdź', 'łódź', 'gałąź', 'kapeć', 'paproć', 'gość', 'maść', 'teść', 'radość', 'młodość'],
    nonwords: ['śnorek', 'ćalum', 'bańko', 'źwema', 'dźarak', 'gośnik']
  },
  {
    id: 'stage-11', order: 11, name: 'Planeta Iskra', planet: 'Iskra',
    introducedGraphemes: ['si', 'ci', 'ni', 'zi', 'dzi'], prerequisites: ['stage-10'],
    words: ['pies', 'siano', 'miasto', 'ciasto', 'ciocia', 'ciepło', 'niebo', 'niebieski', 'ziarno', 'zielony', 'dziecko', 'dzień', 'dzik', 'dziób', 'siedem', 'sierpień', 'cukier', 'bocian', 'babcia', 'kapcie', 'ognisko', 'okno', 'piasek', 'wiadro', 'kwiat', 'gwiazda', 'pociąg', 'księżyc'],
    nonwords: ['siadek', 'ciorum', 'nielak', 'ziamek', 'dziopa', 'piastun']
  },
  {
    id: 'stage-12', order: 12, name: 'Planeta Opowieści', planet: 'Opowieści',
    introducedGraphemes: ['cluster', 'morpheme'], prerequisites: ['stage-11'],
    words: ['przedszkole', 'astronauta', 'planeta', 'biblioteka', 'przygoda', 'rakieta', 'komputer', 'rowerzysta', 'ogrodnik', 'podwórko', 'naleśniki', 'lokomotywa', 'parasolka', 'kaloryfer', 'wycieczka', 'przyjaciel', 'skrzydło', 'wiewiórka', 'truskawka', 'dinozaur', 'samolot', 'kosmonauta', 'mikroskop', 'teleskop', 'piosenka', 'opowiadanie', 'niespodzianka', 'wyprawa'],
    nonwords: ['prastulek', 'skrzydun', 'telesoma', 'wędrolot', 'kosmurek', 'blistawa']
  }
];

const pictureEmoji = {
  mama: '👩', tata: '👨', kot: '🐈', mleko: '🥛', limonka: '🍋', syn: '🧒', nos: '👃', las: '🌲', lis: '🦊', osa: '🐝',
  smok: '🐉', dom: '🏠', woda: '💧', rower: '🚲', worek: '🎒', park: '🌳', kura: '🐔', sowa: '🦉', ser: '🧀', but: '👟',
  guma: '🟣', jagoda: '🫐', banan: '🍌', jajko: '🥚', robot: '🤖', balon: '🎈', wagon: '🚃', noc: '🌙', kajak: '🛶', noga: '🦵',
  fala: '🌊', foka: '🦭', fotel: '🪑', zupa: '🥣', koza: '🐐', łapa: '🐾', łuk: '🏹', głowa: '🙂', telefon: '☎️', flaga: '🚩',
  jabłko: '🍎', góra: '⛰️', król: '👑', lód: '🧊', łódka: '⛵', stół: '🪑', chleb: '🍞', hamak: '🏖️', hotel: '🏨', ucho: '👂',
  chmura: '☁️', chomik: '🐹', szafa: '🚪', szalik: '🧣', mysz: '🐭', kosz: '🧺', czapka: '🧢', żaba: '🐸', żuk: '🪲', jeż: '🦔',
  róża: '🌹', grzyb: '🍄', drzewo: '🌳', szczotka: '🪥', dzban: '🏺', dzwon: '🔔', wędka: '🎣', mąż: '👨', wąż: '🐍', ząb: '🦷',
  bąk: '🐝', dąb: '🌳', ręka: '✋', zęby: '😁', pająk: '🕷️', miś: '🧸', ślimak: '🐌', kość: '🦴', liść: '🍃', ćma: '🦋',
  koń: '🐴', słoń: '🐘', bańka: '🫧', dłoń: '🤚', łódź: '🚤', pies: '🐕', siano: '🌾', miasto: '🏙️', ciasto: '🍰', niebo: '🌤️',
  dziecko: '🧒', dzik: '🐗', dziób: '🐦', ognisko: '🔥', okno: '🪟', piasek: '🏖️', wiadro: '🪣', kwiat: '🌼', gwiazda: '⭐', pociąg: '🚆',
  księżyc: '🌙', astronauta: '🧑‍🚀', planeta: '🪐', rakieta: '🚀', komputer: '💻', parasolka: '☂️', truskawka: '🍓', samolot: '✈️', teleskop: '🔭'
};

const spriteWords = [
  'mama', 'tata', 'kot', 'mleko', 'kometa', 'syn', 'nos', 'las',
  'lis', 'osa', 'smok', 'dom', 'woda', 'rower', 'worek', 'park',
  'kura', 'sowa', 'ser', 'but', 'guma', 'jagoda', 'banan', 'jajko',
  'robot', 'balon', 'wagon', 'noc', 'kajak', 'noga', 'fala', 'foka',
  'fotel', 'zupa', 'koza', 'łapa', 'łuk', 'głowa', 'telefon', 'flaga',
  'jabłko', 'góra', 'król', 'lód', 'łódka', 'stół', 'chleb', 'hamak',
  'hotel', 'ucho', 'chmura', 'chomik', 'szafa', 'szalik', 'mysz', 'kosz',
  'czapka', 'żaba', 'żuk', 'jeż', 'róża', 'grzyb', 'drzewo', 'szczotka'
];

const storySource = [
  [1, 'Oto mama.', 'Mama ma to.'], [1, 'Oto tata.', 'Tata ma to.'],
  [2, 'Ala ma kota.', 'Kot ma mleko.'], [2, 'Ela ma mleko.', 'Lotka lata.'],
  [3, 'Osa ma nos.', 'Lis ma las.'], [3, 'Smok ma sok.', 'Syn ma miski.'],
  [4, 'To dom.', 'W domu mama.'], [4, 'Sowa rano lata.', 'Kura rano drepta.'],
  [5, 'Robot ma balon.', 'Balon leci.'], [5, 'Jajko jest na kocu.', 'Obok jest but.'],
  [6, 'Foka ma łapy.', 'Foka sunie na fali.'], [6, 'Jabłko jest w misce.', 'Obok jest lizak.'],
  [7, 'Chomik ma dom.', 'W domu ma chleb.'], [7, 'Chmura płynie.', 'Z chmury pada woda.'],
  [8, 'Żaba patrzy na róże.', 'Obok wyrasta grzyb.'], [8, 'Szczur ma szalik.', 'Szalik jest gruby.'],
  [9, 'Pająk jest za wędką.', 'Wędka leży nad wodą.'], [9, 'Dżem jest w słoiku.', 'Obok stoi dzban.'],
  [10, 'Dąb ma gałąź.', 'Ona spada na dłoń.'], [10, 'Koń galopuje po łące.', 'Słoń patrzy z daleka.'],
  [11, 'Pies biegnie przez siano.', 'Dziecko woła psa.'], [11, 'Na niebie świeci księżyc.', 'Obok migają gwiazdy.'],
  [12, 'Astronauta wsiada do rakiety.', 'Zaczyna się spokojna wyprawa.'], [12, 'Przyjaciele znaleźli teleskop.', 'Wieczorem oglądali planety.']
];

const listeningSource = [
  'Momo widzi dwie skrzynie. W żółtej jest mapa, a w niebieskiej lupa. Gdzie jest mapa?',
  'Kot schował się pod stołem, a piłka leży na stole. Co jest pod stołem?',
  'Najpierw Ala włożyła buty, potem kurtkę. Co włożyła najpierw?',
  'Rakieta jest większa od robota, ale mniejsza od planety. Co jest największe?',
  'W ogrodzie rosną trzy kwiaty: czerwony, żółty i niebieski. Który kwiat jest pośrodku?',
  'Momo ma klucz i mapę. Klucz wkłada do kieszeni, mapę do plecaka. Co jest w plecaku?',
  'Rano padał deszcz, po południu wyszło słońce. Kiedy było słonecznie?',
  'Mały chomik biegnie wolno, a duży pies szybko. Kto biegnie szybciej?',
  'Na półce stoją książka, kubek i lampka. Kubek jest między książką a lampką. Co stoi w środku?',
  'Zielona rakieta leci w lewo, a czerwona w prawo. Która leci w prawo?',
  'Przed obiadem myjemy ręce. Po obiedzie odkładamy talerz. Co robimy przed obiadem?',
  'Momo znalazł ślad, obejrzał mapę i dotarł do statku. Co pomogło mu znaleźć drogę?'
];

function slug(value) {
  return value.toLocaleLowerCase('pl-PL').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function graphemesAvailableAt(stageOrder) {
  return stageSource
    .filter((stage) => stage.order <= stageOrder)
    .flatMap((stage) => stage.introducedGraphemes)
    .filter((value) => !['cluster', 'morpheme'].includes(value));
}

function splitIntoGraphemes(word, stageOrder) {
  if (stageOrder === 12) return [...word.toLocaleLowerCase('pl-PL')];
  const available = graphemesAvailableAt(stageOrder).sort((a, b) => b.length - a.length);
  const result = [];
  let remaining = word.toLocaleLowerCase('pl-PL');
  while (remaining) {
    const match = available.find((value) => remaining.startsWith(value)) ?? remaining[0];
    result.push(match);
    remaining = remaining.slice(match.length);
  }
  return result;
}

const earlySyllables = {
  ma: ['ma'], mama: ['ma', 'ma'], ta: ['ta'], tata: ['ta', 'ta'], mata: ['ma', 'ta'], tama: ['ta', 'ma'],
  to: ['to'], oto: ['o', 'to'], tam: ['tam'], tom: ['tom'], atom: ['a', 'tom']
};

const items = [];
const stages = stageSource.map((stage) => {
  const wordItems = stage.words.map((answer, index) => {
    const id = `s${stage.order}-word-${String(index + 1).padStart(2, '0')}-${slug(answer)}`;
    items.push({
      id, type: 'word', answer: answer.toLocaleLowerCase('pl-PL'), graphemes: splitIntoGraphemes(answer, stage.order), syllables: earlySyllables[answer.toLocaleLowerCase('pl-PL')] ?? [],
      difficulty: Math.min(5, 1 + Math.floor(answer.length / 3)), skillTags: [`stage:${stage.order}`, 'decoding', 'real-word'],
      audioIds: [`word-${slug(answer)}`], imageId: pictureEmoji[answer.toLocaleLowerCase('pl-PL')] ? `picture-${slug(answer)}` : undefined,
      distractors: [], assessOnly: false, stage: stage.order, trained: index < Math.ceil(stage.words.length * 0.7)
    });
    return id;
  });
  const nonwordItems = stage.nonwords.map((answer, index) => {
    const id = `s${stage.order}-nonword-${String(index + 1).padStart(2, '0')}-${slug(answer)}`;
    items.push({
      id, type: 'nonword', answer, graphemes: splitIntoGraphemes(answer, stage.order), syllables: [], difficulty: Math.min(5, 1 + Math.floor(answer.length / 3)),
      skillTags: [`stage:${stage.order}`, 'decoding', 'transfer'], audioIds: [`nonword-${slug(answer)}`],
      distractors: [], assessOnly: true, stage: stage.order, trained: false
    });
    return id;
  });
  return {
    id: stage.id, order: stage.order, name: stage.name, planet: stage.planet,
    introducedGraphemes: stage.introducedGraphemes, prerequisites: stage.prerequisites,
    itemIds: [...wordItems, ...nonwordItems], storyIds: [],
    masteryRules: { graphemeAccuracy: 0.9, graphemeTrials: 12, sessions: 3, laterDayCheck: true, blendingAccuracy: 0.8, blendingTrials: 8, reviewDays }
  };
});

export const STORIES = storySource.map(([stage, ...sentences], index) => {
  const id = `story-${String(index + 1).padStart(2, '0')}`;
  stages[stage].storyIds.push(id);
  return { id, stage, title: `Raport z planety ${stages[stage].planet}`, sentences, audioIds: sentences.map((_, sentenceIndex) => `${id}-sentence-${sentenceIndex + 1}`) };
});

export const LISTENING_SCENES = listeningSource.map((text, index) => ({
  id: `listening-${String(index + 1).padStart(2, '0')}`, stage: index + 1, text, audioId: `listening-${String(index + 1).padStart(2, '0')}`
}));

export const CURRICULUM = { version: CURRICULUM_VERSION, stages, items, stories: STORIES, listeningScenes: LISTENING_SCENES };
export const PICTURE_EMOJI = pictureEmoji;
export const PICTURE_SPRITE_INDEX = Object.fromEntries(spriteWords.map((word, index) => [word, index]));

export function cumulativeGraphemes(stageOrder) {
  return stages.filter((stage) => stage.order <= stageOrder).flatMap((stage) => stage.introducedGraphemes).filter((value) => !['cluster', 'morpheme'].includes(value));
}

export function itemsForStage(stageOrder, { includeAssessment = false } = {}) {
  return items.filter((item) => item.stage === stageOrder && (includeAssessment || !item.assessOnly));
}

export function itemById(id) {
  return items.find((item) => item.id === id);
}
