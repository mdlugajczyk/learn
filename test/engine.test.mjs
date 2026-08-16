import assert from 'node:assert/strict';
import test from 'node:test';
import { CURRICULUM } from '../public/czytaj/data/curriculum.js';
import { HARD_CAP_MS, REVIEW_INTERVALS, SOFT_CAP_MS, canBeginNextActivity, createProgress, finalizeSession, isRepairSession, recordAttempt, selectSession, seededRandom } from '../public/czytaj/engine.js';
import { exportBackup, validateBackup } from '../public/czytaj/store.js';

test('curriculum has the requested coverage', () => {
  assert.equal(CURRICULUM.stages.length, 13);
  assert.equal(CURRICULUM.items.filter((item) => item.type === 'nonword').length, 72);
  assert.ok(CURRICULUM.items.filter((item) => item.type === 'word').length >= 270);
  assert.equal(CURRICULUM.stories.length, 24);
  assert.equal(CURRICULUM.listeningScenes.length, 12);
});

test('seeded selection is deterministic and introduces at most one grapheme', () => {
  const progress = createProgress({ createdAt: '2026-01-01T00:00:00.000Z' });
  progress.currentStage = 8;
  const first = selectSession(progress, new Date('2026-01-10T09:00:00.000Z'));
  const second = selectSession(progress, new Date('2026-01-10T09:00:00.000Z'));
  assert.deepEqual(first.activities.map((value) => value.item?.id ?? value.type), second.activities.map((value) => value.item?.id ?? value.type));
  assert.ok(first.newGrapheme == null || typeof first.newGrapheme === 'string');
  assert.ok(first.activities.filter((value) => value.isNew).length <= 1);
  assert.equal(seededRandom('same')(), seededRandom('same')());
});

test('two sessions below 70% trigger review-only repair', () => {
  const progress = createProgress();
  progress.sessions = [{ accuracy: 0.6 }, { accuracy: 0.69 }];
  assert.equal(isRepairSession(progress), true);
  const session = selectSession(progress);
  assert.equal(session.repair, true);
  assert.equal(session.newGrapheme, null);
  assert.equal(session.activities.some((value) => value.isNew), false);
});

test('soft cap allows the current activity to finish but prevents a new one', () => {
  const progress = createProgress();
  const session = selectSession(progress, new Date('2026-02-01T10:00:00.000Z'));
  assert.equal(canBeginNextActivity(session, new Date(Date.parse(session.startedAt) + SOFT_CAP_MS - 1)), true);
  assert.equal(canBeginNextActivity(session, new Date(Date.parse(session.startedAt) + SOFT_CAP_MS + 1)), false);
  assert.ok(HARD_CAP_MS > SOFT_CAP_MS);
});

test('review scheduling starts at one day and advances through fixed intervals', () => {
  const progress = createProgress({ createdAt: '2026-01-01T00:00:00.000Z' });
  const session = selectSession(progress, new Date('2026-03-01T09:00:00.000Z'));
  const activity = session.activities.find((value) => value.item);
  recordAttempt(progress, session, activity, { correct: true });
  finalizeSession(progress, session, new Date('2026-03-01T09:09:00.000Z'));
  assert.equal(progress.reviewQueue[0].intervalIndex, 0);
  const due = new Date(progress.reviewQueue[0].dueAt);
  assert.equal(due.getDate(), 2);
  assert.deepEqual(REVIEW_INTERVALS, [1, 2, 4, 7, 14]);
});

test('trained and unseen accuracy remain separate', () => {
  const progress = createProgress();
  const session = selectSession(progress);
  session.attempts = [
    { itemId: 'a', correct: true, verified: true, trained: true },
    { itemId: 'b', correct: false, verified: true, trained: false }
  ];
  const summary = finalizeSession(progress, session);
  assert.equal(summary.trainedAccuracy, 1);
  assert.equal(summary.unseenAccuracy, 0);
});

test('stage advances only after grapheme and unseen blending thresholds', () => {
  const progress = createProgress();
  progress.currentStage = 1;
  for (const grapheme of ['m', 'o', 't']) progress.mastery[`grapheme:${grapheme}`] = { introduced: true, trials: 12, correct: 12, sessions: ['one', 'two', 'three'], provisional: true };
  progress.mastery['grapheme:a'] = { introduced: true, trials: 8, correct: 8, sessions: ['one', 'two'], firstSeenAt: '2026-03-01T09:00:00.000Z' };
  progress.mastery['stage:1:blending'] = { trials: 7, correct: 7, sessions: ['one', 'two'] };
  const session = selectSession(progress, new Date('2026-03-03T09:00:00.000Z'));
  session.focusGrapheme = 'a';
  session.newGrapheme = null;
  const aItem = CURRICULUM.items.find((item) => item.stage === 1 && item.answer.includes('a') && !item.trained);
  session.attempts = [
    ...Array.from({ length: 4 }, (_, index) => ({ itemId: `grapheme:a`, type: 'mapping', grapheme: 'a', correct: true, verified: true, trained: true, at: `2026-03-03T09:0${index}:00.000Z` })),
    { itemId: aItem.id, type: 'blend', grapheme: null, correct: true, verified: true, trained: false, at: '2026-03-03T09:05:00.000Z' }
  ];
  finalizeSession(progress, session, new Date('2026-03-03T09:09:00.000Z'));
  assert.equal(progress.mastery['grapheme:a'].provisional, true);
  assert.equal(progress.mastery['stage:1:blending'].mastered, true);
  assert.equal(progress.currentStage, 2);
});

test('backup checksum rejects corruption without importing', async () => {
  const backup = await exportBackup(createProgress());
  const valid = await validateBackup(backup);
  assert.equal(valid.schemaVersion, 1);
  const parsed = JSON.parse(backup);
  parsed.payload.progress.currentStage = 12;
  await assert.rejects(() => validateBackup(JSON.stringify(parsed)), /Suma kontrolna/);
});
