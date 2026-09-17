import test from 'node:test';
import assert from 'node:assert/strict';
import { COURSE_REVISION, LESSONS, makeLesson, promptFor, sessionResult, emptyProgress, validateProgress } from '../public/mimi/course.js';

test('Mimi teaches vowel contrast and chunked words before independent reading', () => {
  const steps = makeLesson(0, () => .4);
  assert.deepEqual([...new Set(steps.filter(s => s.type === 'read').map(s => s.target))].sort(), ['MAMA', 'MIMI']);
  for (const word of ['MAMA', 'MIMI']) {
    const teaching = steps.findIndex(s => s.type === 'word' && s.target === word);
    assert.ok(teaching < steps.findIndex(s => s.type === 'read' && s.target === word));
    assert.deepEqual(steps[teaching].units, word === 'MAMA' ? ['MA', 'MA'] : ['MI', 'MI']);
  }
});
test('every reading task keeps the spoken prompt neutral and has the target and distractors', () => {
  for (let i = 0; i < LESSONS.length; i++) for (const step of makeLesson(i)) {
    if (step.type !== 'read') continue;
    assert.equal(promptFor(step), 'read-tap');
    const [who, what] = step.target.split(' ');
    assert.ok(step.characters.includes(who));
    assert.ok(step.characters.length >= 2);
    if (what) { assert.ok(step.parts.includes(what)); assert.ok(step.parts.length >= 2); }
  }
});
test('character positions change independently of the displayed word', () => {
  const locations = new Set();
  for (const random of [() => 0, () => .5, () => .99]) for (const step of makeLesson(0, random).filter(s => s.type === 'read' && s.target === 'MAMA')) locations.add(step.characters.indexOf('MAMA'));
  assert.equal(locations.size, 2);
});
test('help and corrected responses never count as independent reading', () => {
  const answers = Array.from({length: 5}, (_, i) => ({type:'read', correct:true, assisted:i === 0, mistakes:i === 1 ? 1 : 0}));
  const result = sessionResult({lesson:0, answers});
  assert.equal(result.independent, 3); assert.equal(result.passed, false);
  answers[0].assisted = false;
  assert.equal(sessionResult({lesson:0, answers}).passed, true);
  assert.equal(sessionResult({lesson:0, answers:answers.slice(0,3)}).passed, false);
});
test('saved lesson reopens and invalid or future progress cannot be restored', () => {
  const progress = emptyProgress();
  progress.active = { revision:COURSE_REVISION, lesson:0, steps:makeLesson(0), index:5, states:{5:{mistakes:1, assisted:true}}, answers:[], started:1 };
  const loaded = validateProgress(JSON.parse(JSON.stringify(progress)));
  assert.equal(loaded.active.index, 5);
  assert.equal(loaded.active.states[5].assisted, true);
  assert.equal(loaded.active.states[5].mistakes, 1);
  assert.throws(() => validateProgress({...progress, version:2}));
  assert.throws(() => validateProgress({...progress, history:[{lesson:'<img>'}]}));
  progress.active.steps[0].target = '<img src=x>';
  assert.throws(() => validateProgress(progress));
});

test('opening has an immediate tap interaction and teaches one word before the next', () => {
  const steps = makeLesson(0);
  assert.deepEqual(steps.slice(0, 7).map(s => s.target), ['A', 'M', 'MA', 'MAMA', 'I', 'MI', 'MIMI']);
  assert.equal(steps[0].type, 'letter');
  assert.ok(steps.slice(0, 7).every(s => !s.characters));
  assert.ok(steps.findIndex(s => s.type === 'read') > steps.findIndex(s => s.target === 'MIMI'));
  for (let i = 0; i < LESSONS.length; i++) assert.ok(makeLesson(i).every(s => s.type !== 'meet'));
});

test('course update preserves completed history and settings, restarting only the unfinished booklet', () => {
  const previous = { ...emptyProgress(), unlocked: 2, selected: 1, settings: { motion: false },
    history: [{ lesson: 0, at: new Date().toISOString(), readingTrials: 6, independent: 6, supported: 0, passed: true }],
    active: { lesson: 1, index: 0, steps: [{ type: 'meet' }], states: {}, answers: [] } };
  const next = validateProgress(previous);
  assert.equal(next.active, null);
  assert.equal(next.unlocked, 2);
  assert.equal(next.selected, 1);
  assert.deepEqual(next.history, previous.history);
  assert.deepEqual(next.settings, previous.settings);
});
