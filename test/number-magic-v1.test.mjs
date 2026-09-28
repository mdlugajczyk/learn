import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  canAdvance,
  commitResolution,
  createDefaultProfile,
  createPlaygroundPlan,
  createSessionPlan,
  createToyState,
  generateJoinOptions,
  makeShareTask,
  needsReducedDemand,
  returnOneToy,
  scoreOutcome,
  sendNextToy,
  toyCounts,
  toyStateIsValid,
  undoToyMove,
  validateShare
} from '../public/numberblocks/game-model.js';
import { NUMBER_MAGIC_V1_AUDIO_BY_FILENAME } from '../scripts/number-magic-v1-audio-catalog.mjs';

test('join choices have one answer, unique introduced distractors, and no zero', () => {
  for (let a = 1; a <= 4; a += 1) {
    for (let b = 1; b <= 5 - a; b += 1) {
      const options = generateJoinOptions({ a, b }, { introducedMax: 5, random: () => 0.42 });
      assert.equal(options.length, 4);
      assert.equal(new Set(options).size, 4);
      assert.equal(options.filter(value => value === a + b).length, 1);
      assert.equal(options.every(value => value >= 1 && value <= 5), true);
    }
  }
});

test('a small introduced range reduces join choices instead of adding unknown values', () => {
  const options = generateJoinOptions({ a: 1, b: 1 }, { introducedMax: 3, choiceCount: 4, random: () => 0 });
  assert.equal(options.length, 2);
  assert.equal(options.includes(2), true);
  assert.equal(options.every(value => value >= 1 && value <= 3), true);
});

test('toy moves, returns, and undo preserve every object identity', () => {
  const initial = createToyState(5);
  const oneLeft = sendNextToy(initial, 'left');
  const oneEach = sendNextToy(oneLeft, 'right');
  const returned = returnOneToy(oneEach, 'left');
  const restored = undoToyMove(returned);
  assert.equal(toyStateIsValid(initial), true);
  assert.equal(toyStateIsValid(oneEach), true);
  assert.equal(toyStateIsValid(returned), true);
  assert.equal(toyStateIsValid(restored), true);
  assert.deepEqual(toyCounts(oneEach), { tray: 3, left: 1, right: 1 });
  assert.deepEqual(toyCounts(returned), { tray: 4, left: 0, right: 1 });
  assert.deepEqual(toyCounts(restored), { tray: 3, left: 1, right: 1 });
  assert.deepEqual(initial.toys.map(toy => toy.id), restored.toys.map(toy => toy.id));
});

test('free grouping of five accepts every nonempty complete allocation', () => {
  const task = makeShareTask(5, 'freeGroups');
  for (const leftTarget of [1, 2, 3, 4]) {
    let state = createToyState(5);
    for (let index = 0; index < leftTarget; index += 1) state = sendNextToy(state, 'left');
    while (toyCounts(state).tray) state = sendNextToy(state, 'right');
    assert.equal(validateShare(task, state).success, true);
  }
});

test('directed sharing accepts only the named recipient target', () => {
  const task = makeShareTask(5, 'targetRecipient', { target: { recipient: 'right', count: 2 } });
  let correct = createToyState(5);
  correct = sendNextToy(correct, 'right');
  correct = sendNextToy(correct, 'right');
  while (toyCounts(correct).tray) correct = sendNextToy(correct, 'left');
  assert.equal(validateShare(task, correct).success, true);
  assert.equal(validateShare(task, { ...correct, toys: correct.toys.map((toy, index) => ({ ...toy, location: index < 2 ? 'left' : 'right' })) }).success, false);
});

test('equal-all four accepts only two and two with an empty tray', () => {
  const task = makeShareTask(4, 'equalAll');
  let state = createToyState(4);
  state = sendNextToy(state, 'left');
  state = sendNextToy(state, 'right');
  state = sendNextToy(state, 'left');
  state = sendNextToy(state, 'right');
  assert.equal(validateShare(task, state).success, true);
  const unequal = returnOneToy(state, 'right');
  assert.equal(validateShare(task, unequal).success, false);
});

test('equal-remainder five requires two each and exactly one spare', () => {
  const task = makeShareTask(5, 'equalRemainder');
  let state = createToyState(5);
  state = sendNextToy(state, 'left');
  state = sendNextToy(state, 'right');
  state = sendNextToy(state, 'left');
  state = sendNextToy(state, 'right');
  assert.equal(validateShare(task, state).success, true);
  let under = createToyState(5);
  under = sendNextToy(under, 'left');
  under = sendNextToy(under, 'right');
  assert.deepEqual(validateShare(task, under), { success: false, reason: 'more-pairs', each: 2, remainder: 1 });
  const fullUnequal = sendNextToy(state, 'left');
  assert.deepEqual(validateShare(task, fullUnequal), { success: false, reason: 'put-back', each: 2, remainder: 1 });
});

test('assisted completion remains evidence but never counts as independent', () => {
  const outcome = {
    taskId: 'join-2-3', skillId: 'join', sessionId: 's1', family: '2+3',
    completed: true, skipped: false, firstAttemptCorrect: true,
    assistance: ['count'], representation: 'blocks', answerSupport: 'quantity'
  };
  const profile = scoreOutcome(createDefaultProfile(), outcome);
  assert.equal(profile.evidence.join.length, 1);
  assert.equal(profile.evidence.join[0].independent, false);
});

test('the same fact contributes at most one observation in a session', () => {
  const profile = createDefaultProfile();
  const base = {
    taskId: 'one', skillId: 'join', sessionId: 's1', family: '1+2', completed: true,
    firstAttemptCorrect: true, assistance: [], representation: 'blocks', answerSupport: 'quantity'
  };
  const once = scoreOutcome(profile, base);
  const twice = scoreOutcome(once, { ...base, taskId: 'two' });
  assert.equal(twice.evidence.join.length, 1);
});

test('advancement needs seven of eight independent observations across sessions and families', () => {
  const evidence = Array.from({ length: 8 }, (_, index) => ({
    independent: index !== 7,
    sessionId: index < 4 ? 's1' : 's2',
    family: ['1+1', '1+2', '2+2'][index % 3]
  }));
  assert.equal(canAdvance(evidence, 3), true);
  assert.equal(canAdvance(evidence.map(item => ({ ...item, sessionId: 's1' })), 3), false);
  assert.equal(canAdvance(evidence.map(item => ({ ...item, family: '1+1' })), 3), false);
});

test('two consecutive supported outcomes reduce only that track on the next task', () => {
  assert.equal(needsReducedDemand([{ independent: true }, { independent: false }]), false);
  assert.equal(needsReducedDemand([{ independent: false }, { independent: false }]), true);
});

test('equal-sharing progression advances independently from joining', () => {
  let profile = createDefaultProfile();
  for (let index = 0; index < 8; index += 1) {
    profile = scoreOutcome(profile, {
      taskId: `equal-${index}`,
      skillId: 'share.equal',
      sessionId: `s${Math.floor(index / 2) + 1}`,
      family: index % 2 ? 'equalAll:2' : 'equalAll:4',
      completed: true,
      firstAttemptCorrect: index !== 7,
      assistance: index === 7 ? ['feedback'] : [],
      representation: 'toys',
      answerSupport: 'construction'
    });
  }
  assert.equal(profile.settings.equalMax, 6);
  assert.equal(profile.settings.joinMax, 5);
  assert.equal(profile.settings.remaindersEnabled, true);
});

test('resolution IDs make playground awards idempotent', () => {
  const outcome = {
    taskId: 'join-1-1', skillId: 'join', sessionId: 's1', family: '1+1', completed: true,
    firstAttemptCorrect: true, assistance: [], representation: 'blocks', answerSupport: 'quantity'
  };
  const first = commitResolution(createDefaultProfile(), outcome, 'resolution-1');
  const duplicate = commitResolution(first.profile, outcome, 'resolution-1');
  assert.equal(first.awarded, true);
  assert.equal(duplicate.awarded, false);
  assert.equal(duplicate.profile.outcomes.length, 1);
});

test('playground plans are deterministic, varied, and never repeat equipment in a session', () => {
  const first = createPlaygroundPlan('lesson-1', 8);
  const repeat = createPlaygroundPlan('lesson-1', 8);
  const next = createPlaygroundPlan('lesson-2', 8);
  assert.deepEqual(first, repeat);
  assert.equal(first.items.length, 8);
  assert.equal(new Set(first.items.map(item => item.kind)).size, 8);
  assert.equal(new Set(first.items.map(item => item.hue)).size, 8);
  assert.notDeepEqual(first.items, next.items);
});

test('playground equipment slots keep their tap-sized boxes apart', () => {
  for (let seed = 0; seed < 50; seed += 1) {
    const items = createPlaygroundPlan(seed, 8).items;
    for (let left = 0; left < items.length; left += 1) {
      for (let right = left + 1; right < items.length; right += 1) {
        const a = items[left];
        const b = items[right];
        const overlapsX = Math.abs(a.x - b.x) < (a.width + b.width) / 2;
        const overlapsY = Math.abs(a.y - b.y) < 22;
        assert.equal(overlapsX && overlapsY, false, `${a.kind} overlaps ${b.kind} for seed ${seed}`);
      }
    }
  }
});

test('first adventure follows the six-job join and sharing structure', () => {
  const plan = createSessionPlan('adventure', createDefaultProfile(), 'first');
  assert.deepEqual(plan.map(task => task.kind), ['join', 'join', 'share', 'join', 'share', 'join']);
  assert.equal(plan.length, 6);
  assert.equal(plan[0].teachingDemo, true);
  assert.equal(plan[2].goal, 'targetRecipient');
  assert.equal(plan[4].goal, 'equalAll');
});

test('the authored bilingual pack covers every ordered join fact through ten', () => {
  for (let a = 1; a <= 9; a += 1) {
    for (let b = 1; b <= 10 - a; b += 1) {
      for (const locale of ['en', 'pl']) {
        assert.equal(NUMBER_MAGIC_V1_AUDIO_BY_FILENAME.has(`v1-join-ask-${a}-${b}-${locale}.mp3`), true);
        assert.equal(NUMBER_MAGIC_V1_AUDIO_BY_FILENAME.has(`v1-join-result-${a}-${b}-${locale}.mp3`), true);
      }
    }
  }
});

test('a session has at most one transfer probe and never stacks it with numeral-only transfer', () => {
  const outcomes = Array.from({ length: 8 }, (_, index) => ({
    taskId: `join-${index}`, skillId: 'join', sessionId: `s${index}`, completed: true,
    firstAttemptCorrect: index !== 7, assistance: index === 7 ? ['count'] : [], answerSupport: 'quantity'
  }));
  const profile = createDefaultProfile({ sessionsCompleted: 2, outcomes });
  for (let seed = 0; seed < 20; seed += 1) {
    const plan = createSessionPlan('adventure', profile, seed);
    assert.ok(plan.filter(task => task.representation === 'toys').length <= 1);
    assert.ok(plan.filter(task => task.answerSupport === 'numeralOnly').length <= 1);
    assert.equal(plan.some(task => task.representation === 'toys' && task.answerSupport === 'numeralOnly'), false);
  }
});

test('Undo and Check remain actionable while the last committed toy is still hopping', async () => {
  const appSource = await readFile(new URL('../public/numberblocks/app.js', import.meta.url), 'utf8');
  assert.match(appSource, /undo\.disabled = !state\.taskState\.toys\.history\.length \|\| state\.phase !== 'question'/);
  assert.match(appSource, /check\.disabled = !shareCanCheck\(task\) \|\| state\.phase !== 'question'/);
  assert.match(appSource, /state\.taskState\.transferId !== transferId/);
  assert.doesNotMatch(appSource, /function checkShare\(\) \{\s+if \(state\.phase !== 'question' \|\| state\.taskState\.transferLocked\)/);
});

test('tablet landscape lays the stage and four-answer panel side by side', async () => {
  const shellCss = await readFile(new URL('../public/numberblocks/styles.css', import.meta.url), 'utf8');
  const missionCss = await readFile(new URL('../public/numberblocks/missions.css', import.meta.url), 'utf8');
  assert.match(shellCss, /min-width: 700px\) and \(max-height: 820px\) and \(orientation: landscape\)/);
  assert.match(shellCss, /grid-template-columns: 118px minmax\(280px, 1\.15fr\) minmax\(276px, \.85fr\)/);
  assert.match(missionCss, /grid-template-rows: repeat\(2, minmax\(84px, 1fr\)\)/);
});

test('parent can choose every joining maximum from five to ten and Ten is white', async () => {
  const appSource = await readFile(new URL('../public/numberblocks/app.js', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../public/numberblocks/styles.css', import.meta.url), 'utf8');
  assert.match(appSource, /\[5, 6, 7, 8, 9, 10\]\.forEach\(maximum/);
  assert.match(appSource, /'#35aaa0', '#ffffff'/);
  assert.match(styles, /\.ten-friend, \.number-10 \{ --unit-color: #fff; \}/);
  assert.match(styles, /\.number-10 \.friend-number \{[^}]*background: #fff;/);
});
