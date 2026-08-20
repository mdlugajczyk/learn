import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../public/czytaj/app.js', import.meta.url), 'utf8');
const indexSource = await readFile(new URL('../public/czytaj/index.html', import.meta.url), 'utf8');
const stylesSource = await readFile(new URL('../public/czytaj/styles.css', import.meta.url), 'utf8');
const launcherSource = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

test('the main launcher keeps Number Magic visible at the top', () => {
  const menuStart = launcherSource.indexOf('<div id="startupModal"');
  const menuEnd = launcherSource.indexOf('</div>\n  </div>', menuStart);
  const menu = launcherSource.slice(menuStart, menuEnd);
  const heading = menu.indexOf('<h2>Choose a Mode</h2>');
  const numberMagic = menu.indexOf("window.location.href='numberblocks/'");
  const legacyMode = menu.indexOf("initializeMode('lowercase')");
  assert.ok(heading >= 0 && numberMagic > heading && numberMagic < legacyMode);
  assert.match(menu, />Ten's Number Magic</);
});

test('startup and onboarding never play a narrator test sample', () => {
  assert.doesNotMatch(appSource, /narrator-sample|audio\.unlock\(|playSample|approveVoice/);
  assert.match(appSource, /setInstruction\('welcome-home', false\)/);
});

test('the blend gesture models separate sounds and then the complete joined word', () => {
  const blendHandlerStart = appSource.indexOf("} else if (activity.type === 'blend') {");
  const blendHandlerEnd = appSource.indexOf("} else if (activity.type === 'build') {", blendHandlerStart);
  const blendHandler = appSource.slice(blendHandlerStart, blendHandlerEnd);
  assert.match(blendHandler, /await playUnits\(activity\.item/);
  assert.match(blendHandler, /await audio\.play\(activity\.item\.audioIds\[0\]\)/);
  assert.ok(blendHandler.indexOf('playUnits') < blendHandler.indexOf('audio.play(activity.item.audioIds[0])'));
  assert.match(appSource, /id="blendResult"/);
});

test('known syllables become the blending and building units for longer words', () => {
  assert.match(appSource, /if \(item\.syllables\?\.length > 1\) return item\.syllables/);
  assert.match(appSource, /const parts = learningUnits\(activity\.item, session\.stage\)/);
  assert.match(appSource, /audioIdForUnit\(part\)/);
});

test('mama highlights ma then ma before joining into the whole word', () => {
  const blendHandlerStart = appSource.indexOf("} else if (activity.type === 'blend') {");
  const blendHandlerEnd = appSource.indexOf("} else if (activity.type === 'build') {", blendHandlerStart);
  const blendHandler = appSource.slice(blendHandlerStart, blendHandlerEnd);
  assert.match(appSource, /data-blend-unit="\$\{index\}"/);
  assert.match(appSource, /id="joinedWord"/);
  assert.ok(blendHandler.indexOf('await playUnits(activity.item') < blendHandler.indexOf("area.classList.add('is-assembling')"));
  assert.ok(blendHandler.indexOf("area.classList.add('is-assembled')") < blendHandler.indexOf('await audio.play(activity.item.audioIds[0])'));
  assert.doesNotMatch(blendHandler, /is-joining/);
  assert.match(stylesSource, /\.graphemes\.has-known-units\.is-assembled \.joined-word/);
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
  assert.match(appSource, /iconAction\('revealMeaning'/);
  const hiddenAttempt = appSource.indexOf("if (!state.meaningRevealed)");
  const pictureChoices = appSource.indexOf('observatory-choices', hiddenAttempt);
  assert.ok(hiddenAttempt >= 0 && pictureChoices > hiddenAttempt);
});
