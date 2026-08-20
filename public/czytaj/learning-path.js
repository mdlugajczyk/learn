import { CURRICULUM, cumulativeGraphemes, itemsForStage } from './data/curriculum.js';

const AMETYST_LESSONS = [
  { id: 'ametyst-a', focusGrapheme: 'a', targetAnswers: [], purpose: 'Najpierw poznajemy dźwięk i małą literę a.' },
  { id: 'ametyst-m', focusGrapheme: 'm', targetAnswers: ['ma', 'mama'], purpose: 'Łączymy m z a: ma, a potem mama.' },
  { id: 'ametyst-t', focusGrapheme: 't', targetAnswers: ['ta', 'tata', 'mata', 'tama'], purpose: 'Łączymy t z a: ta, potem budujemy tata, mata i tama.' },
  { id: 'ametyst-o', focusGrapheme: 'o', targetAnswers: ['to', 'oto'], purpose: 'Dodajemy o i czytamy to oraz oto.' },
  { id: 'ametyst-transfer', focusGrapheme: null, targetAnswers: ['tam', 'tom', 'atom'], purpose: 'Przenosimy znane dźwięki na nowe słowa.' },
  { id: 'ametyst-story', focusGrapheme: null, targetAnswers: ['ma', 'mama', 'ta', 'tata', 'mata', 'tama', 'to', 'oto', 'tam', 'tom', 'atom'], purpose: 'Utrwalamy całą planetę i czytamy krótką historię.' }
];

// Te pary mają ten sam lub zależny od kontekstu dźwięk. Nie wolno pytać dziecka
// „który zapis słyszysz?” bez podania konkretnego słowa.
const AMBIGUOUS_SOUND_CHOICES = new Set(['ó', 'h', 'ch', 'ż', 'rz', 'ą', 'ę', 'si', 'ci', 'ni', 'zi', 'dzi']);
const VOWELS = new Set(['a', 'ą', 'e', 'ę', 'i', 'o', 'ó', 'u', 'y']);

function hasConsonantCluster(item) {
  let previousWasConsonant = false;
  for (const grapheme of item.graphemes) {
    const consonant = !VOWELS.has(grapheme);
    if (consonant && previousWasConsonant) return true;
    previousWasConsonant = consonant;
  }
  return false;
}

function priorStageGraphemes(stageOrder) {
  return stageOrder <= 1 ? [] : cumulativeGraphemes(stageOrder - 1);
}

function sortTeachingItems(items) {
  return [...items].sort((a, b) =>
    Number(hasConsonantCluster(a)) - Number(hasConsonantCluster(b))
    || a.graphemes.length - b.graphemes.length
    || a.answer.localeCompare(b.answer, 'pl')
  );
}

function genericLessons(stageOrder) {
  const stage = CURRICULUM.stages[stageOrder];
  const introduced = stage.introducedGraphemes.filter((value) => !['cluster', 'morpheme'].includes(value));
  const prior = priorStageGraphemes(stageOrder);
  const stageItems = itemsForStage(stageOrder);
  if (!introduced.length) {
    return [{ id: `${stage.id}-fluency`, focusGrapheme: null, targetAnswers: sortTeachingItems(stageItems).map((item) => item.answer), purpose: 'Czytamy coraz dłuższe słowa i krótkie teksty.' }];
  }
  const lessons = introduced.map((focusGrapheme, index) => {
    const known = new Set([...prior, ...introduced.slice(0, index + 1)]);
    const candidates = sortTeachingItems(stageItems.filter((item) => item.graphemes.includes(focusGrapheme) && item.graphemes.every((value) => known.has(value))));
    const simple = candidates.filter((item) => !hasConsonantCluster(item));
    const targetItems = simple.length ? simple : candidates;
    return {
      id: `${stage.id}-${focusGrapheme}`,
      focusGrapheme,
      targetAnswers: targetItems.map((item) => item.answer),
      purpose: `Poznajemy ${focusGrapheme}, łączymy je ze znanymi dźwiękami i czytamy najprostsze dostępne słowa.`
    };
  });
  lessons.push({
    id: `${stage.id}-consolidation`,
    focusGrapheme: null,
    targetAnswers: sortTeachingItems(stageItems).map((item) => item.answer),
    purpose: 'Utrwalamy znaki planety, sprawdzamy nowe słowa i czytamy krótką historię.'
  });
  return lessons;
}

export function lessonsForStage(stageOrder) {
  return stageOrder === 1 ? AMETYST_LESSONS : genericLessons(stageOrder);
}

export function ensureLessonPath(progress) {
  if (!progress.lessonPath || typeof progress.lessonPath !== 'object') progress.lessonPath = {};
  return progress.lessonPath;
}

export function lessonIndexFor(progress, stageOrder) {
  const path = ensureLessonPath(progress);
  const lessons = lessonsForStage(stageOrder);
  return Math.max(0, Math.min(lessons.length - 1, Number(path[stageOrder]) || 0));
}

export function lessonFor(progress, stageOrder) {
  const index = lessonIndexFor(progress, stageOrder);
  return { ...lessonsForStage(stageOrder)[index], index };
}

export function knownGraphemesForLesson(stageOrder, lessonIndex, { includeFocus = true } = {}) {
  const stage = CURRICULUM.stages[stageOrder];
  const introduced = stage.introducedGraphemes.filter((value) => !['cluster', 'morpheme'].includes(value));
  const count = Math.min(introduced.length, lessonIndex + (includeFocus ? 1 : 0));
  return [...new Set([...priorStageGraphemes(stageOrder), ...introduced.slice(0, count)])];
}

export function itemCanBeRead(item, knownGraphemes) {
  if (item.stage === 12) return true;
  const known = knownGraphemes instanceof Set ? knownGraphemes : new Set(knownGraphemes);
  return item.graphemes.every((value) => known.has(value));
}

export function isSafeAuditoryChoice(grapheme) {
  return Boolean(grapheme) && !AMBIGUOUS_SOUND_CHOICES.has(grapheme);
}

export function advanceLesson(progress, stageOrder) {
  const path = ensureLessonPath(progress);
  const current = lessonIndexFor(progress, stageOrder);
  path[stageOrder] = Math.min(lessonsForStage(stageOrder).length - 1, current + 1);
  return path[stageOrder];
}

export function teachingNotesForStage(stageOrder) {
  return lessonsForStage(stageOrder).map(({ id, focusGrapheme, targetAnswers, purpose }, index) => ({
    id, index, focusGrapheme, targetAnswers, purpose
  }));
}
