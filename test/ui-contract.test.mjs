import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../public/czytaj/app.js', import.meta.url), 'utf8');

test('startup and onboarding never play a narrator test sample', () => {
  assert.doesNotMatch(appSource, /narrator-sample|audio\.unlock\(|playSample|approveVoice/);
  assert.match(appSource, /setInstruction\('welcome-home', false\)/);
});

test('the blend gesture models the complete word rather than replaying isolated phonemes', () => {
  const blendHandlerStart = appSource.indexOf("} else if (activity.type === 'blend') {");
  const blendHandlerEnd = appSource.indexOf("} else if (activity.type === 'build') {", blendHandlerStart);
  const blendHandler = appSource.slice(blendHandlerStart, blendHandlerEnd);
  assert.match(blendHandler, /await audio\.play\(activity\.item\.audioIds\[0\]\)/);
  assert.doesNotMatch(blendHandler, /playSegmented/);
  assert.match(appSource, /id="blendResult"/);
});
