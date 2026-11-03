import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCrashTask, createSessionPlan, createDefaultProfile, createSeededRandom, commitResolution, easierReplacement } from '../public/numberblocks/game-model.js';

test('crashes conserve the original quantity across two to four nonempty groups', () => {
  for (let total = 2; total <= 10; total += 1) {
    for (let groups = 2; groups <= 4; groups += 1) {
      for (let seed = 0; seed < 30; seed += 1) {
        const task = makeCrashTask(total, groups, { introducedMax: 10, random: createSeededRandom(seed) });
        assert.equal(task.parts.length, Math.min(total, groups));
        assert.ok(task.parts.every(part => part > 0));
        assert.equal(task.parts.reduce((a, b) => a + b, 0), total);
        assert.equal(task.options.filter(value => value === total).length, 1);
        assert.equal(new Set(task.options).size, task.options.length);
      }
    }
  }
});

test('mystery sessions obey parent range and keep evidence separate from addition', () => {
  for (const maximum of [5, 6, 7, 8, 9, 10]) {
    const profile = createDefaultProfile({ settings: { joinMax: maximum } });
    const tasks = createSessionPlan('crash', profile, `range-${maximum}`);
    assert.deepEqual(tasks, createSessionPlan('crash', profile, `range-${maximum}`));
    assert.equal(tasks.length, 6);
    assert.equal(new Set(tasks.map(task => task.scene)).size, 3);
    assert.ok(tasks.every(task => task.variant === 'crash' && task.sum <= maximum && task.options.every(value => value <= maximum)));
    const { profile: scored } = commitResolution(profile, {
      taskId: tasks[0].id, skillId: 'crash', sessionId: 'one', completed: true,
      firstAttemptCorrect: true, assistance: [], family: tasks[0].parts.join('+')
    }, 'resolution');
    assert.equal(scored.evidence.crash.length, 1);
    assert.equal(scored.evidence.join.length, 0);
    assert.equal(scored.settings.joinMax, maximum);
    assert.equal(createDefaultProfile(scored).evidence.crash.length, 1);
    assert.equal(easierReplacement(tasks[0], profile).variant, 'crash');
  }
});

test('crash sessions vary narration and never repeat an impact palette consecutively', () => {
  for (let seed = 0; seed < 100; seed += 1) {
    const tasks = createSessionPlan('crash', createDefaultProfile(), seed);
    assert.deepEqual(new Set(tasks.map(task => task.crashCue)), new Set(['boom', 'kaboom']));
    for (let index = 1; index < tasks.length; index += 1) {
      assert.notEqual(tasks[index].impactVariant, tasks[index - 1].impactVariant);
      if (index > 1) assert.ok(new Set(tasks.slice(index - 2, index + 1).map(task => task.crashCue)).size > 1);
    }
  }
});
