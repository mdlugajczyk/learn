export const CHARACTERS = ['MIMI', 'MAMA', 'TATA', 'LALA'];
export const WORDS = {
  MAMA: ['MA', 'MA'], MIMI: ['MI', 'MI'], LALA: ['LA', 'LA'],
  TATA: ['TA', 'TA'], OKO: ['O', 'KO'], NOS: ['NO', 'S'], NOGA: ['NO', 'GA']
};
export const SYLLABLES = {
  MA: ['M', 'A'], MI: ['M', 'I'], LA: ['L', 'A'], LI: ['L', 'I'],
  TA: ['T', 'A'], TO: ['T', 'O'], KO: ['K', 'O'], NO: ['N', 'O'], GA: ['G', 'A']
};
export const LESSONS = [
  { id: 'mama-mimi', title: 'MAMA i MIMI', letters: ['A', 'M', 'I'], words: ['MA', 'MI', 'MAMA', 'MIMI'], characters: ['MAMA', 'MIMI'] },
  { id: 'lala', title: 'LALA', letters: ['L'], words: ['LA', 'LI', 'LALA'], characters: ['MAMA', 'MIMI', 'LALA'] },
  { id: 'tata', title: 'TATA', letters: ['T'], words: ['TA', 'TATA'], characters: ['MAMA', 'MIMI', 'TATA'] },
  { id: 'oko', title: 'OKO', letters: ['O', 'K'], words: ['TO', 'KO', 'OKO'], characters: ['MAMA', 'MIMI'] },
  { id: 'nos', title: 'NOS', letters: ['N', 'S'], words: ['NO', 'NOS'], characters: ['MAMA', 'MIMI'] },
  { id: 'noga', title: 'NOGA', letters: ['G'], words: ['GA', 'NOGA'], characters: ['MAMA', 'MIMI'] }
];

export function shuffle(values, random = Math.random) {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const letter = value => ({ type: 'letter', target: value });
const blend = value => ({ type: 'blend', target: value, units: SYLLABLES[value] });
const word = value => ({ type: 'word', target: value, units: WORDS[value] });
const match = (target, options) => ({ type: 'contrast', target, options });
const read = (target, characters, parts) => ({ type: 'read', target, characters, parts });

export function makeLesson(index, random = Math.random) {
  const family = LESSONS[index].characters;
  const readingRound = targets => shuffle(targets, random).map(target => read(target, shuffle(family, random)));
  const bodyRound = (targets, parts) => shuffle(targets, random).map(target => read(target, shuffle(family, random), parts));
  const review = () => readingRound(['MAMA', 'MIMI']);
  let steps;
  if (index === 0) steps = [
    { type: 'meet', characters: family, audio: 'meet-family' }, letter('A'), letter('M'), blend('MA'), word('MAMA'),
    read('MAMA', shuffle(family, random)), letter('I'), blend('MI'),
    ...shuffle(['MA', 'MI', 'MI', 'MA'], random).map(target => match(target, shuffle(['MA', 'MI'], random))),
    word('MIMI'), ...readingRound(['MAMA', 'MIMI', 'MAMA', 'MIMI', 'MAMA', 'MIMI'])
  ];
  if (index === 1) steps = [
    ...review(), { type: 'meet', characters: ['LALA'], audio: 'meet-doll' }, letter('L'), blend('LA'),
    ...shuffle(['LA', 'MA', 'LA'], random).map(target => match(target, shuffle(['LA', 'MA'], random))),
    word('LALA'), ...readingRound(['LALA', 'MAMA', 'MIMI', 'LALA']), blend('LI'),
    match('LI', shuffle(['LI', 'MI'], random)), ...readingRound(['MIMI', 'LALA'])
  ];
  if (index === 2) steps = [
    ...review(), { type: 'meet', characters: ['TATA'], audio: 'meet-dad' }, blend('TA'),
    ...shuffle(['TA', 'MA', 'TA'], random).map(target => match(target, shuffle(['TA', 'MA'], random))),
    word('TATA'), ...readingRound(['TATA', 'MAMA', 'MIMI', 'TATA', 'MAMA', 'TATA'])
  ];
  if (index === 3) steps = [
    ...review(), letter('O'), blend('TO'), blend('KO'), match('KO', shuffle(['KO', 'TO'], random)),
    word('OKO'), { type: 'body-demo', target: 'MIMI OKO', characters: family, parts: ['OKO', 'NOS'] },
    ...bodyRound(['MIMI OKO', 'MAMA OKO', 'MAMA OKO', 'MIMI OKO', 'MAMA OKO', 'MIMI OKO'], ['OKO', 'NOS'])
  ];
  if (index === 4) steps = [
    ...bodyRound(['MAMA OKO', 'MIMI OKO'], ['OKO', 'NOS']), letter('N'), blend('NO'), letter('S'), word('NOS'),
    { type: 'body-demo', target: 'MAMA NOS', characters: family, parts: ['OKO', 'NOS'] },
    ...bodyRound(['MAMA NOS', 'MIMI NOS', 'MAMA OKO', 'MIMI OKO', 'MIMI NOS', 'MAMA NOS'], ['OKO', 'NOS'])
  ];
  if (index === 5) steps = [
    ...bodyRound(['MAMA OKO', 'MIMI NOS'], ['OKO', 'NOS']), blend('GA'), word('NOGA'),
    { type: 'body-demo', target: 'MIMI NOGA', characters: family, parts: ['NOS', 'NOGA'] },
    ...bodyRound(['MIMI NOGA', 'MAMA NOS', 'MAMA NOGA', 'MIMI NOS', 'MAMA NOGA', 'MIMI NOGA'], ['NOS', 'NOGA']),
    ...bodyRound(['MAMA OKO', 'MIMI NOS'], ['OKO', 'NOS'])
  ];
  return steps.map((step, id) => ({ ...step, id }));
}

export const STORAGE_KEY = 'mimi-reading-v1';
export function emptyProgress() {
  return { version: 1, unlocked: 0, selected: 0, history: [], settings: { motion: true }, active: null };
}
export function validateProgress(value) {
  if (!value || value.version !== 1 || !Number.isInteger(value.unlocked) || value.unlocked < 0 || value.unlocked >= LESSONS.length || !Array.isArray(value.history)) throw new Error('Nieprawidłowy zapis postępów.');
  const history = value.history.map(result => {
    if (!Number.isInteger(result.lesson) || !LESSONS[result.lesson] || !Number.isInteger(result.readingTrials) || result.readingTrials < 0 || result.readingTrials > 100 || !Number.isInteger(result.independent) || result.independent < 0 || result.independent > result.readingTrials || !Number.isInteger(result.supported) || result.supported !== result.readingTrials - result.independent || typeof result.at !== 'string' || !Number.isFinite(Date.parse(result.at))) throw new Error('Nieprawidłowe wyniki.');
    return { lesson: result.lesson, readingTrials: result.readingTrials, independent: result.independent, supported: result.supported, at: new Date(result.at).toISOString(), passed: Boolean(result.passed) };
  }).slice(-100);
  const progress = { ...emptyProgress(), unlocked: value.unlocked, selected: value.selected, history, settings: { motion: value.settings?.motion !== false } };
  if (!Number.isInteger(progress.selected) || progress.selected < 0 || progress.selected > progress.unlocked) progress.selected = progress.unlocked;
  const active = value.active;
  if (active && Number.isInteger(active.lesson) && LESSONS[active.lesson] && Number.isInteger(active.index) && Array.isArray(active.steps) && active.index >= 0 && active.index < active.steps.length && Array.isArray(active.answers)) {
    const canonical = makeLesson(active.lesson, () => .5);
    const sameMembers = (a, b) => Array.isArray(a) && a.length === b?.length && [...a].sort().join('|') === [...b].sort().join('|');
    const steps = active.steps.map((step, id) => {
      const template = canonical.find(candidate => candidate.type === step.type && candidate.target === step.target);
      if (!template) throw new Error('Nieprawidłowe zadanie.');
      return { ...template, id, ...(template.characters && sameMembers(step.characters, template.characters) ? { characters: step.characters } : {}), ...(template.options && sameMembers(step.options, template.options) ? { options: step.options } : {}) };
    });
    if (steps.length !== canonical.length) throw new Error('Niepełna książeczka.');
    const states = Object.fromEntries(steps.map((_, i) => [i, { mistakes: Math.min(100, Math.max(0, Number(active.states?.[i]?.mistakes) || 0)), assisted: Boolean(active.states?.[i]?.assisted), done: Boolean(active.states?.[i]?.done) }]));
    const answers = active.answers.filter((answer, i, list) => Number.isInteger(answer.step) && steps[answer.step] && ['read', 'contrast'].includes(steps[answer.step].type) && list.findIndex(a => a.step === answer.step) === i).map(answer => ({ step: answer.step, type: steps[answer.step].type, target: steps[answer.step].target, correct: Boolean(answer.correct), mistakes: states[answer.step].mistakes, assisted: states[answer.step].assisted }));
    progress.active = { lesson: active.lesson, steps, index: active.index, states, answers, started: Number(active.started) || Date.now() };
  }
  return progress;
}
export function sessionResult(session) {
  const reading = session.answers.filter(a => a.type === 'read');
  const independent = reading.filter(a => a.correct && !a.assisted && a.mistakes === 0).length;
  return { lesson: session.lesson, at: new Date().toISOString(), readingTrials: reading.length, independent, supported: reading.length - independent, passed: reading.length >= 4 && independent / reading.length >= .8 };
}

// Only teaching screens and explicit help may pronounce an unanswered target.
export function promptFor(step) {
  if (step.type === 'read') return 'read-tap';
  if (step.type === 'contrast') return 'listen-choose';
  if (step.type === 'letter') return 'touch-letter';
  if (step.type === 'blend') return 'join-sounds';
  if (step.type === 'word') return 'join-chunks';
  if (step.type === 'body-demo') return 'two-words';
  return step.audio;
}
export const unitAudio = unit => unit.length === 1 ? `sound-${unit.toLowerCase()}` : `word-${unit.toLowerCase()}`;
