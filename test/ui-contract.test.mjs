import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../public/czytaj/app.js', import.meta.url), 'utf8');
const indexSource = await readFile(new URL('../public/czytaj/index.html', import.meta.url), 'utf8');

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

test('parent mode gate opens on a normal tap during a mission', () => {
  const gateHandlerStart = appSource.indexOf('const openParentGate = () => {');
  const gateHandlerEnd = appSource.indexOf("gateForm.addEventListener('submit'", gateHandlerStart);
  const gateHandler = appSource.slice(gateHandlerStart, gateHandlerEnd);

  assert.match(gateHandler, /state\.presentationToken \+= 1/);
  assert.match(gateHandler, /audio\.stop\(\)/);
  assert.match(gateHandler, /gate\.showModal\(\)/);
  assert.match(gateHandler, /parentButton\.addEventListener\('click', openParentGate\)/);
  assert.doesNotMatch(gateHandler, /pointerdown|holdTimer|3000/);
  assert.match(indexSource, /aria-label="Otwórz tryb rodzica"/);
  assert.doesNotMatch(indexSource, /Przytrzymaj przez trzy sekundy/);
});
