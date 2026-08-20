import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MISSION_FACTS,
  RANGE_PRESETS,
  advanceLearning,
  answerChoices,
  chooseFact,
  createMissionPlan,
  factKey,
  isFactMastered,
  isCorrectSplit,
  learningStatus,
  nextSplitStep,
  normalizeLearningSettings,
  recordFactResult,
  unlockedTier
} from '../public/numberblocks/missions.js';

test('every mission fact is a valid addition within ten', () => {
  assert.equal(MISSION_FACTS.length, 18);
  for (const fact of MISSION_FACTS) {
    assert.equal(fact.a + fact.b, fact.sum);
    assert.ok(fact.a > 0 && fact.b > 0);
    assert.ok(fact.sum <= 10);
  }
});

test('a session reinforces its first fact in both directions', () => {
  const values = [0, 0.4, 0.8];
  const plan = createMissionPlan({ sessionsCompleted: 0, factWins: {} }, () => values.shift() ?? 0.5);
  assert.equal(plan.length, 3);
  assert.equal(plan[0].mode, 'forward');
  assert.equal(plan[1].mode, 'reverse');
  assert.equal(factKey(plan[0].fact), factKey(plan[1].fact));
  assert.notEqual(factKey(plan[0].fact), factKey(plan[2].fact));
});

test('answer choices always contain one correct and two distinct distractors', () => {
  for (let sum = 2; sum <= 10; sum += 1) {
    const choices = answerChoices(sum, () => 0.25);
    assert.equal(choices.length, 3);
    assert.equal(new Set(choices).size, 3);
    assert.equal(choices.includes(sum), true);
    assert.equal(choices.every(value => value >= 2 && value <= 10), true);
  }
});

test('split checking ignores left-to-right order', () => {
  const fact = { a: 2, b: 3, sum: 5 };
  assert.equal(isCorrectSplit(fact, [2, 3]), true);
  assert.equal(isCorrectSplit(fact, [3, 2]), true);
  assert.equal(isCorrectSplit(fact, [1, 4]), false);
});

test('reverse missions pull exactly one block at a time', () => {
  const fact = { a: 2, b: 3, sum: 5 };
  assert.deepEqual(nextSplitStep(fact, 0), { pulled: 1, remaining: 4, complete: false });
  assert.deepEqual(nextSplitStep(fact, 1), { pulled: 2, remaining: 3, complete: true });
  assert.deepEqual(nextSplitStep(fact, 2), { pulled: 2, remaining: 3, complete: true });
});

test('Ten missions unlock only after foundational sessions', () => {
  assert.equal(unlockedTier(0), 1);
  assert.equal(unlockedTier(2), 2);
  assert.equal(unlockedTier(5), 3);
  assert.equal(unlockedTier(8), 4);
});

test('parent presets cover gentle, full, and bigger-number starting ranges', () => {
  assert.deepEqual(RANGE_PRESETS.map(preset => preset.label), ['1–5', '1–7', '1–10', '5–10']);
  assert.deepEqual(normalizeLearningSettings({ preset: 'big' }), {
    configured: false,
    preset: 'big',
    autoAdvance: true,
    adaptiveMax: 10
  });
});

test('a fact becomes strong after two clean answers and a mistake requires recovery', () => {
  const fact = { a: 2, b: 2, sum: 4 };
  let progress = recordFactResult({}, fact, { firstTry: true });
  assert.equal(isFactMastered(progress, fact), false);
  progress = recordFactResult(progress, fact, { firstTry: true });
  assert.equal(isFactMastered(progress, fact), true);
  progress = recordFactResult(progress, fact, { firstTry: false });
  assert.equal(isFactMastered(progress, fact), false);
  progress = recordFactResult(progress, fact, { firstTry: true });
  progress = recordFactResult(progress, fact, { firstTry: true });
  assert.equal(isFactMastered(progress, fact), true);
});

test('mastering most frontier facts unlocks exactly one new total', () => {
  const learning = { configured: true, preset: 'little', autoAdvance: true, adaptiveMax: 5 };
  const frontier = MISSION_FACTS.filter(fact => fact.sum >= 3 && fact.sum <= 5).slice(0, 4);
  let progress = {};
  for (const fact of frontier) {
    progress = recordFactResult(progress, fact, { firstTry: true });
    progress = recordFactResult(progress, fact, { firstTry: true });
  }
  assert.equal(learningStatus(progress, learning).readyToAdvance, true);
  assert.deepEqual(advanceLearning(progress, learning), {
    learning: { ...learning, adaptiveMax: 6 },
    unlocked: 6
  });
});

test('mission selection respects the parent floor and adaptive ceiling', () => {
  const learning = { configured: true, preset: 'big', autoAdvance: false, adaptiveMax: 10 };
  for (let index = 0; index < 12; index += 1) {
    const plan = createMissionPlan({}, () => index / 12, learning);
    assert.equal(plan.every(mission => mission.fact.sum >= 5 && mission.fact.sum <= 10), true);
  }
});

test('strong earlier facts remain in occasional review rotation', () => {
  const masteredFact = MISSION_FACTS.find(fact => fact.a === 1 && fact.b === 1);
  let progress = recordFactResult({}, masteredFact, { firstTry: true });
  progress = recordFactResult(progress, masteredFact, { firstTry: true });
  const review = chooseFact(progress, () => 0, { learning: { preset: 'little', adaptiveMax: 5 } });
  assert.equal(factKey(review), factKey(masteredFact));
});
