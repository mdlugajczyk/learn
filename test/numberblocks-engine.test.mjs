import test from 'node:test';
import assert from 'node:assert/strict';

import {
  chooseNumberChoices,
  enumeratePartitions,
  formatEquation,
  isValidComposition,
  joinParts,
  partitionKey,
  splitPart,
  suggestedSplit
} from '../public/numberblocks/engine.js';

test('split and join preserve the target quantity', () => {
  const split = splitPart([5], 0, 3);
  assert.deepEqual(split, [3, 2]);
  assert.equal(isValidComposition(5, split), true);
  assert.deepEqual(splitPart(split, 0, 1), [1, 2, 2]);
  assert.deepEqual(joinParts([1, 2, 2], 0, 2), [3, 2]);
});

test('partition keys ignore visual order', () => {
  assert.equal(partitionKey([1, 3, 1]), '3+1+1');
  assert.equal(partitionKey([3, 1, 1]), partitionKey([1, 1, 3]));
});

test('five has the expected seven integer partitions', () => {
  const partitions = enumeratePartitions(5);
  assert.equal(partitions.length, 7);
  assert.deepEqual(partitions.at(-1), [1, 1, 1, 1, 1]);
  assert.deepEqual(enumeratePartitions(5, { includeWhole: false })[0], [4, 1]);
});

test('ten has 42 possible partitions including the whole', () => {
  assert.equal(enumeratePartitions(10).length, 42);
});

test('equations are produced only for valid compositions', () => {
  assert.equal(formatEquation(5, [3, 1, 1]), '5 = 3 + 1 + 1');
  assert.equal(formatEquation(5, [2, 2]), '');
});

test('number choices contain one low, one high, and favorite Ten', () => {
  const values = [0.1, 0.2, 0.8];
  const choices = chooseNumberChoices(() => values.shift() ?? 0.5);
  assert.equal(choices.includes(10), true);
  assert.equal(choices.some(value => value >= 2 && value <= 5), true);
  assert.equal(choices.some(value => value >= 6 && value <= 9), true);
});

test('suggested split prioritizes an undiscovered pair', () => {
  assert.deepEqual(suggestedSplit(5, ['4+1']), {
    left: 2,
    right: 3,
    key: '3+2',
    new: true
  });
});
