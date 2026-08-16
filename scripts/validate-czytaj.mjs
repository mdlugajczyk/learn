import { access, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUDIO_ENTRIES } from '../public/czytaj/data/audio-manifest.js';
import { CURRICULUM, PICTURE_EMOJI, PICTURE_SPRITE_INDEX, cumulativeGraphemes } from '../public/czytaj/data/curriculum.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(absolute));
    else if (entry.isFile()) result.push(absolute);
  }
  return result;
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

function contentCharacters(value) {
  return [...value.toLocaleLowerCase('pl-PL').normalize('NFC')].filter((character) => /\p{L}/u.test(character));
}

export async function validateCzytaj({ strictAudio = false } = {}) {
  const errors = [];
  const stageIds = new Set();
  const itemIds = new Set();
  const storyIds = new Set();
  const audioIds = new Set();

  for (const stage of CURRICULUM.stages) {
    assert(!stageIds.has(stage.id), `Duplicate stage id: ${stage.id}`, errors);
    stageIds.add(stage.id);
    assert(Number.isInteger(stage.order), `Invalid stage order: ${stage.id}`, errors);
  }
  for (const stage of CURRICULUM.stages) for (const prerequisite of stage.prerequisites) assert(stageIds.has(prerequisite), `Unknown prerequisite ${prerequisite} in ${stage.id}`, errors);

  const visiting = new Set();
  const visited = new Set();
  function visit(stageId) {
    if (visiting.has(stageId)) { errors.push(`Stage cycle at ${stageId}`); return; }
    if (visited.has(stageId)) return;
    visiting.add(stageId);
    const stage = CURRICULUM.stages.find((value) => value.id === stageId);
    for (const prerequisite of stage?.prerequisites ?? []) visit(prerequisite);
    visiting.delete(stageId);
    visited.add(stageId);
  }
  for (const id of stageIds) visit(id);

  for (const entry of AUDIO_ENTRIES) {
    assert(!audioIds.has(entry.id), `Duplicate audio id: ${entry.id}`, errors);
    audioIds.add(entry.id);
    assert(entry.filename.startsWith('audio/') && !entry.filename.includes('..'), `Unsafe audio filename: ${entry.filename}`, errors);
  }

  for (const item of CURRICULUM.items) {
    assert(!itemIds.has(item.id), `Duplicate item id: ${item.id}`, errors);
    itemIds.add(item.id);
    const stage = CURRICULUM.stages[item.stage];
    assert(Boolean(stage), `Invalid item stage: ${item.id}`, errors);
    for (const audioId of item.audioIds) assert(audioIds.has(audioId), `Missing audio reference ${audioId} in ${item.id}`, errors);
    if (item.imageId) assert(Boolean(PICTURE_EMOJI[item.answer]), `Missing picture reference ${item.imageId} in ${item.id}`, errors);
    if (item.stage < 12) {
      const allowed = new Set(cumulativeGraphemes(item.stage).flatMap((grapheme) => [...grapheme]));
      for (const character of contentCharacters(item.answer)) assert(allowed.has(character), `Untaught grapheme character “${character}” in ${item.id} (${item.answer})`, errors);
    }
  }
  for (const stage of CURRICULUM.stages) for (const id of stage.itemIds) assert(itemIds.has(id), `Missing item ${id} in ${stage.id}`, errors);

  for (const story of CURRICULUM.stories) {
    assert(!storyIds.has(story.id), `Duplicate story id: ${story.id}`, errors);
    storyIds.add(story.id);
    const allowed = new Set(cumulativeGraphemes(story.stage).flatMap((grapheme) => [...grapheme]));
    for (const audioId of story.audioIds) assert(audioIds.has(audioId), `Missing story audio ${audioId}`, errors);
    if (story.stage < 12) for (const character of contentCharacters(story.sentences.join(' '))) assert(allowed.has(character), `Untaught character “${character}” in ${story.id}`, errors);
  }
  for (const stage of CURRICULUM.stages) for (const id of stage.storyIds) assert(storyIds.has(id), `Missing story ${id} in ${stage.id}`, errors);

  assert(CURRICULUM.stages.length === 13, `Expected stages 0–12, found ${CURRICULUM.stages.length}`, errors);
  assert(CURRICULUM.items.filter((item) => item.type === 'nonword').length === 72, 'Expected exactly 72 nonwords', errors);
  assert(CURRICULUM.items.filter((item) => item.type === 'word').length >= 270, 'Expected approximately 280 real-word items', errors);
  assert(CURRICULUM.stories.length === 24, 'Expected exactly 24 mini-stories', errors);
  assert(CURRICULUM.listeningScenes.length === 12, 'Expected exactly 12 listening scenes', errors);
  assert(Object.keys(PICTURE_SPRITE_INDEX).length >= 60, 'Expected at least 60 locally bundled concrete picture cells', errors);
  assert(await exists(path.join(root, 'public', 'czytaj', 'assets', 'vocabulary-atlas.png')), 'Missing local vocabulary picture atlas', errors);
  for (const character of ['ą', 'ę', 'ó', 'ł', 'ś', 'ć', 'ń', 'ź', 'ż']) assert(CURRICULUM.items.some((item) => item.answer.includes(character)), `Polish diacritic ${character} is absent from content`, errors);

  const sourceFiles = await walk(path.join(root, 'public', 'czytaj'));
  assert(sourceFiles.length < 900, `Czytaj has ${sourceFiles.length} files; budget is below 900`, errors);
  let total = 0;
  for (const file of sourceFiles) {
    const info = await stat(file);
    total += info.size;
    if (/\.(mp3|png|webp|jpg|jpeg|woff2)$/i.test(file)) assert(info.size < 2 * 1024 * 1024, `Media exceeds 2 MB: ${path.relative(root, file)}`, errors);
    if (/\.(html|css|js|json|webmanifest)$/i.test(file)) {
      const contents = await readFile(file, 'utf8');
      assert(!/https?:\/\//i.test(contents), `Unsafe external runtime URL in ${path.relative(root, file)}`, errors);
    }
  }
  assert(total < 60 * 1024 * 1024, `Czytaj source pack exceeds 60 MB`, errors);

  if (strictAudio) {
    const manifestFile = path.join(root, 'public', 'czytaj', 'audio', 'manifest.json');
    assert(await exists(manifestFile), 'Missing generated audio/manifest.json', errors);
    for (const entry of AUDIO_ENTRIES) assert(await exists(path.join(root, 'public', 'czytaj', entry.filename)), `Missing audio file: ${entry.filename}`, errors);
    if (await exists(manifestFile)) {
      const audioManifest = JSON.parse(await readFile(manifestFile, 'utf8'));
      assert(audioManifest.entries?.length === AUDIO_ENTRIES.length, `Audio manifest has ${audioManifest.entries?.length ?? 0}/${AUDIO_ENTRIES.length} entries`, errors);
      if (audioManifest.releaseStatus === 'temporary-testing-only') {
        assert(appSourceIncludesTemporaryWarning(await readFile(path.join(root, 'public', 'czytaj', 'app.js'), 'utf8')), 'Temporary audio pack requires a visible learning-safety warning', errors);
      }
    }
  }

  const appSource = await readFile(path.join(root, 'public', 'czytaj', 'app.js'), 'utf8');
  assert(!appSource.includes('speechSynthesis'), 'Runtime speechSynthesis is forbidden', errors);
  assert(!appSource.includes('SpeechRecognition'), 'Speech recognition is forbidden in v1', errors);

  if (errors.length) throw new Error(`Czytaj validation failed:\n- ${errors.join('\n- ')}`);
  const counts = {
    stages: CURRICULUM.stages.length,
    realWords: CURRICULUM.items.filter((item) => item.type === 'word').length,
    nonwords: CURRICULUM.items.filter((item) => item.type === 'nonword').length,
    stories: CURRICULUM.stories.length,
    listeningScenes: CURRICULUM.listeningScenes.length,
    audioEntries: AUDIO_ENTRIES.length,
    files: sourceFiles.length,
    bytes: total
  };
  console.log(`Czytaj validated: ${JSON.stringify(counts)}`);
  return counts;
}

function appSourceIncludesTemporaryWarning(source) {
  return source.includes('Nie używaj jeszcze tej wersji do nauki dźwięków liter.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validateCzytaj({ strictAudio: process.argv.includes('--strict-audio') }).catch((error) => { console.error(error.message); process.exit(1); });
}
