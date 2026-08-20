import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../public/czytaj/app.js', import.meta.url), 'utf8');
const indexSource = await readFile(new URL('../public/czytaj/index.html', import.meta.url), 'utf8');
const stylesSource = await readFile(new URL('../public/czytaj/styles.css', import.meta.url), 'utf8');

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

test('child interactions are forgiving and every drag has a tap path', () => {
  assert.match(appSource, /progress >= \.68/);
  assert.match(appSource, /nearestTarget\?\.distance <= 96/);
  assert.match(appSource, /startButton\.addEventListener\('click'/);
  assert.match(appSource, /button\.addEventListener\('click'/);
  assert.match(stylesSource, /\.launch-control[^}]*min-height: 82px/s);
  assert.match(stylesSource, /\.tile \{[^}]*min-width: 64px;[^}]*min-height: 64px/s);
});

test('a wrong objective answer stays for a guided retry', () => {
  const answerStart = appSource.indexOf('async function objectiveAnswer');
  const answerEnd = appSource.indexOf('function bindBuildTile', answerStart);
  const answerHandler = appSource.slice(answerStart, answerEnd);
  assert.match(answerHandler, /correctButton\?\.classList\.add\('guided'\)/);
  assert.doesNotMatch(answerHandler, /correct \? 520 : 420/);
});

test('the playful shell keeps meaning pictures behind the reading attempt', () => {
  assert.match(appSource, /class="meaning-window shutters-closed"/);
  assert.match(appSource, /id="revealMeaning"/);
  const hiddenAttempt = appSource.indexOf("if (!state.meaningRevealed)");
  const pictureChoices = appSource.indexOf('observatory-choices', hiddenAttempt);
  assert.ok(hiddenAttempt >= 0 && pictureChoices > hiddenAttempt);
});
