import assert from 'node:assert/strict';
import test from 'node:test';
import { addDiscovery, chapterFor, chapterState, discoveriesFor, ensureExploration, missionChapters, planetTheme } from '../public/czytaj/experience.js';

test('legacy progress receives a safe local exploration state', () => {
  const progress = { sessions: [] };
  const exploration = ensureExploration(progress);
  assert.deepEqual(exploration.discoveriesByStage, {});
  assert.deepEqual(discoveriesFor(progress, 1), []);
});

test('a planet keeps at most six calm discoveries without currency', () => {
  const progress = { sessions: [] };
  for (let session = 1; session <= 10; session += 1) addDiscovery(progress, 1, session);
  assert.equal(discoveriesFor(progress, 1).length, 6);
  assert.equal(progress.exploration.lastLanding.sessionNumber, 10);
  assert.equal('coins' in progress.exploration, false);
});

test('activities form a continuous mission route', () => {
  const session = {
    activityIndex: 3,
    activities: [
      { type: 'warmup' },
      { type: 'hear-choose' },
      { type: 'mapping' },
      { type: 'blend' },
      { type: 'build' },
      { type: 'meaning' },
      { type: 'story' },
      { type: 'complete' }
    ]
  };
  const chapters = missionChapters(session);
  assert.deepEqual(chapters.map((chapter) => chapter.id), ['signals', 'lab', 'bridge', 'cargo', 'window', 'archive', 'landing']);
  assert.equal(chapterFor('blend').id, 'bridge');
  assert.equal(chapterState(session, chapters[0]), 'done');
  assert.equal(chapterState(session, chapters[2]), 'current');
});

test('all curriculum stages have a distinct planet presentation', () => {
  const slugs = Array.from({ length: 12 }, (_, index) => planetTheme(index + 1).slug);
  assert.equal(new Set(slugs).size, 12);
});
