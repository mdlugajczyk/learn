import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MISSION_FACTS,
  answerChoices,
  createMissionPlan,
  factKey,
  isCorrectSplit,
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

test('Ten missions unlock only after foundational sessions', () => {
  assert.equal(unlockedTier(0), 1);
  assert.equal(unlockedTier(2), 2);
  assert.equal(unlockedTier(5), 3);
  assert.equal(unlockedTier(8), 4);
});
