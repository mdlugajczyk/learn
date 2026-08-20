const PLANETS = [
  { slug: 'start', symbol: '✦', accent: '#70dfbb', deep: '#315f65', discovery: 'baza Momo' },
  { slug: 'ametyst', symbol: '◆', accent: '#b58cff', deep: '#5a3aa1', discovery: 'kryształ' },
  { slug: 'limonka', symbol: '●', accent: '#c8ed72', deep: '#668d31', discovery: 'świetlik' },
  { slug: 'sosenka', symbol: '▲', accent: '#76d3a2', deep: '#2f7958', discovery: 'kosmiczna sosna' },
  { slug: 'woda', symbol: '≈', accent: '#73d8ec', deep: '#337ba2', discovery: 'muszla' },
  { slug: 'blekit', symbol: '○', accent: '#91b8ff', deep: '#4c65a7', discovery: 'niebieski księżyc' },
  { slug: 'fala', symbol: '∿', accent: '#67ded0', deep: '#297d79', discovery: 'śpiewająca fala' },
  { slug: 'chmurka', symbol: '☁', accent: '#f2e8cf', deep: '#7882a3', discovery: 'lekka chmura' },
  { slug: 'szum', symbol: '⌁', accent: '#f0ad7b', deep: '#a55755', discovery: 'wietrzny dzwonek' },
  { slug: 'wstega', symbol: '∞', accent: '#f19bc6', deep: '#945184', discovery: 'świetlna wstęga' },
  { slug: 'swiatlo', symbol: '✺', accent: '#ffe17b', deep: '#ae7131', discovery: 'latarnia' },
  { slug: 'iskra', symbol: '✧', accent: '#ffaf7c', deep: '#ae5751', discovery: 'iskra' },
  { slug: 'opowiesci', symbol: '▤', accent: '#a5a8ff', deep: '#595aa4', discovery: 'archiwum opowieści' }
];

const DISCOVERY_SYMBOLS = ['◆', '✦', '⌁', '◉', '♢', '❋'];

export function planetTheme(stage = 1) {
  return PLANETS[Math.max(0, Math.min(12, Number(stage) || 1))];
}

export function ensureExploration(progress) {
  if (!progress.exploration || typeof progress.exploration !== 'object') {
    progress.exploration = { discoveriesByStage: {}, lastLanding: null };
  }
  if (!progress.exploration.discoveriesByStage || typeof progress.exploration.discoveriesByStage !== 'object') {
    progress.exploration.discoveriesByStage = {};
  }
  return progress.exploration;
}

export function discoveriesFor(progress, stage) {
  const exploration = ensureExploration(progress);
  return exploration.discoveriesByStage[String(stage)] ?? [];
}

export function addDiscovery(progress, stage, sessionNumber) {
  const exploration = ensureExploration(progress);
  const key = String(stage);
  const existing = exploration.discoveriesByStage[key] ?? [];
  const slot = existing.length % DISCOVERY_SYMBOLS.length;
  const id = `stage-${stage}-discovery-${Math.min(existing.length, DISCOVERY_SYMBOLS.length - 1)}`;
  if (!existing.some((entry) => entry.id === id)) {
    exploration.discoveriesByStage[key] = [...existing, {
      id,
      symbol: DISCOVERY_SYMBOLS[slot],
      foundAt: new Date().toISOString(),
      sessionNumber
    }];
  }
  exploration.lastLanding = { stage, sessionNumber, at: new Date().toISOString() };
  return exploration;
}

const CHAPTERS = [
  { id: 'signals', label: 'Sygnały', types: ['warmup', 'hear-choose'] },
  { id: 'lab', label: 'Laboratorium', types: ['mapping'] },
  { id: 'bridge', label: 'Most światła', types: ['blend'] },
  { id: 'cargo', label: 'Ładownia', types: ['build'] },
  { id: 'window', label: 'Odkrycie', types: ['meaning', 'nonword'] },
  { id: 'archive', label: 'Opowieść', types: ['story'] },
  { id: 'landing', label: 'Lądowanie', types: ['complete'] }
];

export function chapterFor(type) {
  return CHAPTERS.find((chapter) => chapter.types.includes(type)) ?? CHAPTERS[0];
}

export function missionChapters(session) {
  const activityTypes = session.activities.map((activity) => activity.type);
  return CHAPTERS.filter((chapter) => chapter.id === 'landing' || chapter.types.some((type) => activityTypes.includes(type)));
}

export function chapterState(session, chapter) {
  const currentType = session.activities[session.activityIndex]?.type;
  const currentChapter = chapterFor(currentType);
  const chapters = missionChapters(session);
  const currentIndex = chapters.findIndex((entry) => entry.id === currentChapter.id);
  const index = chapters.findIndex((entry) => entry.id === chapter.id);
  return index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'later';
}
