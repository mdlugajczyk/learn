import {
  RANGE_PRESETS,
  advanceLearning,
  answerChoices,
  createMissionPlan,
  isCorrectSplit,
  learningStatus,
  normalizeLearningSettings,
  rangeForLearning,
  recordFactResult,
  missionAudioName
} from './missions.js';

const STORAGE_KEY = 'tens-number-missions-v2';
const LEGACY_STORAGE_KEY = 'tens-number-magic-v1';
const NUMBER_NAMES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const CHARACTER_DATA = {
  1: { columns: 1, color: '#ef4e55' },
  2: { columns: 1, color: '#f28b35' },
  3: { columns: 1, color: '#f1c92f' },
  4: { columns: 2, color: '#55b764' },
  5: { columns: 1, color: '#28a7df' },
  6: { columns: 2, color: '#6561bf' },
  7: { columns: 1, color: '#62a7ce' },
  8: { columns: 2, color: '#eb5da4' },
  9: { columns: 3, color: '#98a1aa' },
  10: { columns: 2, color: '#ef4e55' }
};

const elements = {};
const state = {
  sound: true,
  gentleMotion: false,
  audioUnlocked: false,
  offlineReady: false,
  progress: { sessionsCompleted: 0, factWins: {}, mistakes: 0 },
  learning: normalizeLearningSettings(),
  session: [],
  missionIndex: 0,
  phase: 'home',
  counts: [0, 0],
  splitParts: [],
  choices: [],
  missionMistake: false,
  newLevel: null,
  prompt: { file: 'welcome.m4a', text: '' },
  phaseToken: 0,
  celebrationTimer: null,
  toastTimer: null,
  resetArmedUntil: 0
};

class SoundStudio {
  constructor() {
    this.context = null;
    this.voice = new Audio();
    this.voice.preload = 'auto';
    this.voice.volume = .94;
    this.voiceToken = 0;
  }

  unlock() {
    if (!state.sound) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass && !this.context) this.context = new AudioContextClass();
    if (this.context?.state === 'suspended') this.context.resume().catch(() => {});
    state.audioUnlocked = true;
    this.effect('tap');
  }

  stopVoice() {
    this.voiceToken += 1;
    this.voice.pause();
    this.voice.removeAttribute('src');
    window.speechSynthesis?.cancel();
  }

  speak(filename, fallbackText = '') {
    if (!state.sound || !state.audioUnlocked || !filename) return;
    const token = ++this.voiceToken;
    this.voice.pause();
    this.voice.src = `audio/${filename}`;
    this.voice.currentTime = 0;
    this.voice.play().catch(() => {
      if (token !== this.voiceToken || !fallbackText || !('speechSynthesis' in window)) return;
      const fallback = new SpeechSynthesisUtterance(fallbackText);
      fallback.lang = 'en-GB';
      fallback.rate = .86;
      fallback.pitch = 1.06;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(fallback);
    });
  }

  effect(kind) {
    if (!state.sound || !state.audioUnlocked || !this.context) return;
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    const now = this.context.currentTime;
    const patterns = {
      tap: [[420, 610, 0, .065, .05]],
      block: [[310, 470, 0, .11, .055]],
      snap: [[360, 650, 0, .15, .06], [620, 790, .08, .18, .04]],
      join: [[280, 390, 0, .18, .06], [390, 620, .07, .26, .055]],
      wrong: [[330, 260, 0, .13, .04]],
      discover: [[523, 660, 0, .2, .055], [659, 830, .1, .26, .05], [784, 990, .2, .32, .045]],
      back: [[460, 330, 0, .09, .045]]
    };
    (patterns[kind] || patterns.tap).forEach(([from, to, delay, duration, volume]) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = kind === 'discover' ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(from, now + delay);
      oscillator.frequency.exponentialRampToValueAtTime(to, now + delay + duration);
      gain.gain.setValueAtTime(.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(volume, now + delay + .018);
      gain.gain.exponentialRampToValueAtTime(.0001, now + delay + duration);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(now + delay);
      oscillator.stop(now + delay + duration + .02);
    });
  }
}

const sounds = new SoundStudio();

function loadState() {
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '{}');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    state.sound = stored.sound ?? legacy.sound ?? true;
    state.gentleMotion = stored.gentleMotion ?? legacy.gentleMotion ?? false;
    state.learning = normalizeLearningSettings(stored.learning || {});
    if (stored.progress && typeof stored.progress === 'object') {
      state.progress = {
        sessionsCompleted: Number(stored.progress.sessionsCompleted || 0),
        factWins: stored.progress.factWins || {},
        factStats: stored.progress.factStats || {},
        mistakes: Number(stored.progress.mistakes || 0)
      };
    }
  } catch {
    // A fresh session still works if local storage is unavailable.
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sound: state.sound,
      gentleMotion: state.gentleMotion,
      learning: state.learning,
      progress: state.progress
    }));
  } catch {
    // Device-local persistence is helpful but never blocks play.
  }
}

function cacheElements() {
  [
    'homeScreen', 'playScreen', 'homeMentor', 'playMentor', 'welcomeMentor',
    'missionButton', 'homeProgress', 'offlinePill', 'offlineLabel', 'playTitle',
    'backButton', 'mentorText', 'replayButton', 'missionStage', 'missionProgress',
    'equation', 'welcomeOverlay', 'startButton', 'settingsButton', 'settingsOverlay',
    'closeSettingsButton', 'soundToggle', 'motionToggle', 'settingsOfflineDot',
    'settingsOfflineTitle', 'settingsOfflineCopy', 'installInstructions',
    'installedMessage', 'learningSummary', 'masteryCount', 'settingsRangeChoices',
    'autoAdvanceToggle', 'rangeOverlay', 'setupRangeChoices', 'setupAutoAdvance',
    'saveRangeButton', 'restartRangeButton', 'resetProgressButton', 'toast', 'celebration'
  ].forEach(id => { elements[id] = document.getElementById(id); });
  elements.soundButtons = [...document.querySelectorAll('[data-sound-button]')];
}

function numberName(number, capitalized = false) {
  const value = NUMBER_NAMES[number] || String(number);
  return capitalized ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function blockNoun(number) {
  return number === 1 ? 'block' : 'blocks';
}

function characterColor(number) {
  return CHARACTER_DATA[number]?.color || '#526080';
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createCharacter(number) {
  const data = CHARACTER_DATA[number];
  const rows = Math.ceil(number / data.columns);
  const character = makeElement('div', `number-character n${number}`);
  character.style.setProperty('--cols', data.columns);
  character.style.setProperty('--rows', rows);
  character.style.setProperty('--character-color', data.color);
  character.setAttribute('aria-hidden', 'true');

  const numberling = makeElement('span', 'numberling', number);
  const body = makeElement('div', 'body-wrap');
  const grid = makeElement('div', 'cube-grid');
  for (let index = 0; index < number; index += 1) {
    const cube = makeElement('span', 'cube');
    cube.dataset.cubeIndex = String(index);
    grid.appendChild(cube);
  }

  const face = makeElement('span', `character-face${number === 5 || number === 10 ? ' star-eyes' : ''}`);
  face.append(makeElement('span', 'eye'), makeElement('span', 'eye'));
  const mouth = makeElement('span', 'mouth');
  body.appendChild(grid);
  if (number === 8) body.appendChild(makeElement('span', 'mask'));
  if (number === 4) body.append(makeElement('span', 'brow brow-left'), makeElement('span', 'brow brow-right'));
  if (number === 6) {
    const spots = makeElement('span', 'six-spots');
    for (let index = 0; index < 6; index += 1) spots.appendChild(makeElement('span'));
    body.appendChild(spots);
  }
  if (number === 7) body.appendChild(makeElement('span', 'rainbow-hair'));
  body.append(face, mouth);

  ['left', 'right'].forEach(side => {
    const arm = makeElement('span', `arm arm-${side}`);
    arm.appendChild(makeElement('span', 'hand'));
    body.appendChild(arm);
    const leg = makeElement('span', `leg leg-${side}`);
    leg.appendChild(makeElement('span', 'foot'));
    body.appendChild(leg);
  });
  character.append(numberling, body);
  return character;
}

function characterHost(number, className = 'mission-character') {
  const host = makeElement('span', `character-host ${className}`);
  host.appendChild(createCharacter(number));
  return host;
}

function renderMentors() {
  [elements.homeMentor, elements.playMentor, elements.welcomeMentor].forEach(host => {
    host.replaceChildren(createCharacter(10));
  });
}

function updatePreferenceUi() {
  document.documentElement.classList.toggle('sound-muted', !state.sound);
  document.documentElement.classList.toggle('gentle', state.gentleMotion);
  elements.soundToggle.checked = state.sound;
  elements.motionToggle.checked = state.gentleMotion;
  elements.autoAdvanceToggle.checked = state.learning.autoAdvance;
  elements.setupAutoAdvance.checked = state.learning.autoAdvance;
  document.querySelectorAll('input[data-range-preset]').forEach(input => {
    input.checked = input.value === state.learning.preset;
  });
  elements.soundButtons.forEach(button => {
    button.setAttribute('aria-label', state.sound ? 'Turn sound off' : 'Turn sound on');
  });
  updateLearningSummary();
}

function renderRangeChoices(container, name) {
  container.replaceChildren();
  RANGE_PRESETS.forEach(preset => {
    const label = makeElement('label', 'range-choice');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = preset.id;
    input.dataset.rangePreset = preset.id;
    input.checked = preset.id === state.learning.preset;
    const copy = makeElement('span', 'range-choice-copy');
    copy.append(makeElement('strong', '', preset.label), makeElement('small', '', preset.description));
    label.append(input, copy, makeElement('i', '', '✓'));
    container.appendChild(label);
  });
}

function updateLearningSummary() {
  const status = learningStatus(state.progress, state.learning);
  const range = rangeForLearning(state.learning);
  const displayedMin = range.minSum <= 2 ? 1 : range.minSum;
  const remaining = Math.max(0, status.needed - status.frontierMastered);
  if (state.learning.autoAdvance && status.maxSum < 10) {
    elements.learningSummary.textContent = `Working with ${displayedMin}–${status.maxSum}. ${remaining} more strong ${remaining === 1 ? 'fact' : 'facts'} to unlock ${status.maxSum + 1}.`;
  } else if (state.learning.autoAdvance) {
    elements.learningSummary.textContent = `Working with ${displayedMin}–10. The full range is unlocked.`;
  } else {
    elements.learningSummary.textContent = `Working with ${displayedMin}–${status.maxSum}. The range is fixed here.`;
  }
  elements.masteryCount.textContent = `${status.frontierMastered}/${status.frontierTotal} strong`;
}

function setLearningPreset(preset, autoAdvance = state.learning.autoAdvance) {
  state.learning = normalizeLearningSettings({ configured: true, preset, autoAdvance });
  saveState();
  updatePreferenceUi();
  renderHomeProgress();
}

function renderHomeProgress() {
  elements.homeProgress.replaceChildren();
  const completed = state.progress.sessionsCompleted;
  const range = rangeForLearning(state.learning);
  const label = makeElement('span', 'home-progress-label', completed
    ? `${completed} ${completed === 1 ? 'mission set' : 'mission sets'} · working up to ${range.maxSum}`
    : `Your first mission is ready · starting up to ${range.maxSum}`);
  const stars = makeElement('span', 'home-progress-stars');
  for (let index = 0; index < 3; index += 1) stars.appendChild(makeElement('i', index < Math.min(3, completed) ? 'earned' : '', '★'));
  elements.homeProgress.append(stars, label);
}

function clearPhaseTimers() {
  state.phaseToken += 1;
  clearTimeout(state.celebrationTimer);
  state.celebrationTimer = null;
}

function setPrompt(file, text, repeatAfter = true) {
  state.prompt = { file, text };
  elements.mentorText.textContent = text;
  sounds.speak(file, text);
  if (!repeatAfter) return;
  const token = state.phaseToken;
  setTimeout(() => {
    if (state.phaseToken === token && !document.hidden && state.phase !== 'success') sounds.speak(file, text);
  }, 7200);
}

function currentMission() {
  return state.session[state.missionIndex];
}

function startSession() {
  clearPhaseTimers();
  sounds.unlock();
  state.session = createMissionPlan(state.progress, Math.random, state.learning);
  state.missionIndex = 0;
  state.newLevel = null;
  elements.homeScreen.hidden = true;
  elements.playScreen.hidden = false;
  startMission();
}

function startMission() {
  clearPhaseTimers();
  const mission = currentMission();
  state.counts = [0, 0];
  state.splitParts = [];
  state.choices = answerChoices(mission.fact.sum);
  state.missionMistake = false;
  state.phase = mission.mode === 'forward' ? 'build-first' : 'split';
  renderMission();
  if (mission.mode === 'forward') {
    setPrompt(`mission-build-first-${mission.fact.a}.m4a`, `First, build ${numberName(mission.fact.a)}! Drag blocks into the glowing spot.`);
  } else {
    setPrompt(missionAudioName('split', mission.fact), `Here is ${numberName(mission.fact.sum)}. Pull away ${numberName(mission.fact.a)} ${blockNoun(mission.fact.a)}!`);
  }
}

function goHome() {
  clearPhaseTimers();
  sounds.stopVoice();
  sounds.effect('back');
  state.phase = 'home';
  elements.playScreen.hidden = true;
  elements.homeScreen.hidden = false;
  renderHomeProgress();
}

function renderMission() {
  const mission = currentMission();
  if (!mission) return;
  elements.playTitle.textContent = `MISSION ${state.missionIndex + 1} OF 3`;
  renderMissionProgress();
  renderEquation();
  elements.missionStage.replaceChildren();
  elements.missionStage.className = `mission-stage phase-${state.phase} mode-${mission.mode}`;

  if (state.phase === 'build-first' || state.phase === 'build-second') renderBuildStage(mission.fact);
  else if (state.phase === 'split') renderSplitStage(mission.fact);
  else if (state.phase === 'choose') renderChoiceStage(mission.fact);
  else if (state.phase === 'combine') renderCombineStage(mission.fact);
  else if (state.phase === 'success') renderSuccessStage(mission.fact);
  else if (state.phase === 'session-complete') renderSessionComplete();
}

function renderMissionProgress() {
  elements.missionProgress.replaceChildren();
  const sessionComplete = state.phase === 'session-complete';
  for (let index = 0; index < 3; index += 1) {
    const done = sessionComplete || index < state.missionIndex;
    const active = !sessionComplete && index === state.missionIndex;
    const pip = makeElement('span', `mission-pip${done ? ' done' : ''}${active ? ' active' : ''}`);
    pip.appendChild(makeElement('i', '', done ? '★' : index + 1));
    elements.missionProgress.appendChild(pip);
  }
}

function equationToken(value, status = '') {
  const numeric = Number.isInteger(value);
  const token = makeElement('span', `${numeric ? 'equation-token' : 'equation-symbol'}${status ? ` ${status}` : ''}`, value);
  if (numeric) token.style.setProperty('--token-color', characterColor(value));
  return token;
}

function renderEquation() {
  elements.equation.replaceChildren();
  const mission = currentMission();
  if (!mission) return;
  const { a, b, sum } = mission.fact;
  let values;
  if (mission.mode === 'reverse' && state.phase === 'split') values = [sum, '=', '?', '+', '?'];
  else if (state.phase === 'build-first') values = [a, '+', '?', '=', '?'];
  else if (state.phase === 'build-second') values = [a, '+', b, '=', '?'];
  else if (state.phase === 'success') values = [a, '+', b, '=', sum];
  else values = [a, '+', b, '=', '?'];
  values.forEach((value, index) => {
    const pending = value === '?' ? 'pending' : '';
    const token = equationToken(value, pending);
    token.style.animationDelay = `${index * 35}ms`;
    elements.equation.appendChild(token);
  });
  elements.equation.setAttribute('aria-label', values.join(' '));
}

function buildZone(index, target, count, active) {
  const zone = makeElement('div', `build-zone${active ? ' active' : ''}${count === target ? ' complete' : ''}`);
  zone.dataset.zoneIndex = String(index);
  zone.setAttribute('aria-label', `${numberName(target)} building spot. ${count} blocks placed.`);
  zone.appendChild(makeElement('span', 'zone-number', target));
  const content = makeElement('div', 'zone-content');
  if (count > 0) content.appendChild(characterHost(count, 'mission-character build-character'));
  else {
    const ghost = makeElement('span', 'target-ghost');
    const data = CHARACTER_DATA[target];
    ghost.style.setProperty('--ghost-cols', data.columns);
    for (let cube = 0; cube < target; cube += 1) ghost.appendChild(makeElement('i'));
    content.appendChild(ghost);
  }
  zone.appendChild(content);
  if (active) zone.appendChild(makeElement('span', 'zone-pulse', '✦'));
  return zone;
}

function renderBuildStage(fact) {
  const activeIndex = state.phase === 'build-first' ? 0 : 1;
  const arena = makeElement('div', 'build-arena');
  arena.append(
    buildZone(0, fact.a, state.counts[0], activeIndex === 0),
    makeElement('span', 'arena-operator', '+'),
    buildZone(1, fact.b, state.counts[1], activeIndex === 1)
  );
  const tray = makeElement('div', 'block-tray');
  tray.setAttribute('aria-label', 'Loose blocks');
  const used = state.counts[0] + state.counts[1];
  for (let index = used; index < fact.sum; index += 1) {
    const block = makeElement('button', 'loose-block');
    block.type = 'button';
    block.setAttribute('aria-label', 'Loose number block. Drag it into the glowing spot.');
    block.append(makeElement('span', 'loose-eye'), makeElement('span', 'loose-eye'));
    attachLooseBlockGesture(block, activeIndex);
    tray.appendChild(block);
  }
  const hint = makeElement('div', 'drag-coach');
  hint.setAttribute('aria-hidden', 'true');
  hint.append(makeElement('span', 'coach-mini-block'), makeElement('span', 'coach-finger', '☝'));
  elements.missionStage.append(arena, hint, tray);
}

function pointInside(element, x, y, padding = 18) {
  const rect = element.getBoundingClientRect();
  return x >= rect.left - padding && x <= rect.right + padding && y >= rect.top - padding && y <= rect.bottom + padding;
}

function attachLooseBlockGesture(block, zoneIndex) {
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let moved = false;
  let armed = false;
  let acceptTimer = null;
  let completed = false;

  const cleanup = () => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', finish);
    document.removeEventListener('pointercancel', finish);
    clearTimeout(acceptTimer);
  };

  const accept = () => {
    if (completed) return;
    completed = true;
    cleanup();
    block.classList.add('block-accepted');
    setTimeout(() => placeLooseBlock(zoneIndex), state.gentleMotion ? 10 : 110);
  };

  const move = event => {
    if (event.pointerId !== pointerId || completed) return;
    event.preventDefault();
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < 7) return;
    moved = true;
    block.classList.add('dragging');
    block.style.setProperty('--drag-x', `${dx}px`);
    block.style.setProperty('--drag-y', `${dy}px`);
    const zone = elements.missionStage.querySelector(`.build-zone[data-zone-index="${zoneIndex}"]`);
    armed = pointInside(zone, event.clientX, event.clientY, 26);
    zone?.classList.toggle('drop-ready', armed);
    if (armed && !acceptTimer) acceptTimer = setTimeout(accept, 150);
    if (!armed && acceptTimer) {
      clearTimeout(acceptTimer);
      acceptTimer = null;
    }
  };

  const finish = event => {
    if (event.pointerId !== pointerId || completed) return;
    cleanup();
    if (event.type !== 'pointercancel' && armed) accept();
    else {
      block.classList.remove('dragging');
      block.classList.add('block-return');
      setTimeout(() => block.classList.remove('block-return'), 260);
    }
    pointerId = null;
  };

  block.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    sounds.unlock();
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', finish);
    document.addEventListener('pointercancel', finish);
  });
  block.addEventListener('click', event => {
    if (event.detail === 0) accept();
  });
}

function placeLooseBlock(zoneIndex) {
  const mission = currentMission();
  const target = zoneIndex === 0 ? mission.fact.a : mission.fact.b;
  if (state.counts[zoneIndex] >= target) return;
  state.counts[zoneIndex] += 1;
  sounds.effect(state.counts[zoneIndex] === target ? 'snap' : 'block');
  renderMission();
  if (state.counts[zoneIndex] !== target) return;
  const token = state.phaseToken;
  setTimeout(() => {
    if (state.phaseToken !== token) return;
    clearPhaseTimers();
    if (zoneIndex === 0) {
      state.phase = 'build-second';
      renderMission();
      setPrompt(`mission-build-next-${mission.fact.b}.m4a`, `You built ${numberName(mission.fact.a)}! Now build ${numberName(mission.fact.b)}.`);
    } else {
      state.phase = 'choose';
      renderMission();
      setPrompt(missionAudioName('predict', mission.fact), `What do ${numberName(mission.fact.a)} and ${numberName(mission.fact.b)} make? Choose a number friend!`);
    }
  }, state.gentleMotion ? 20 : 520);
}

function partsPreview(fact) {
  const preview = makeElement('div', 'parts-preview');
  [fact.a, fact.b].forEach((value, index) => {
    const friend = makeElement('div', `preview-friend preview-friend-${index + 1}`);
    friend.append(characterHost(value, 'mission-character preview-character'), makeElement('span', 'friend-badge', value));
    preview.appendChild(friend);
    if (index === 0) preview.appendChild(makeElement('span', 'preview-plus', '+'));
  });
  return preview;
}

function renderChoiceStage(fact) {
  elements.missionStage.appendChild(partsPreview(fact));
  const question = makeElement('div', 'choice-question', '?');
  const grid = makeElement('div', 'answer-grid');
  state.choices.forEach(value => {
    const button = makeElement('button', 'answer-card');
    button.type = 'button';
    button.dataset.answer = String(value);
    button.style.setProperty('--answer-color', characterColor(value));
    button.setAttribute('aria-label', numberName(value, true));
    button.append(characterHost(value, 'mission-character answer-character'), makeElement('span', 'answer-number', value));
    button.addEventListener('click', () => chooseAnswer(button, value));
    grid.appendChild(button);
  });
  elements.missionStage.append(question, grid);
}

function chooseAnswer(button, value) {
  if (state.phase !== 'choose') return;
  const mission = currentMission();
  sounds.unlock();
  if (value !== mission.fact.sum) {
    state.missionMistake = true;
    state.progress.mistakes += 1;
    saveState();
    sounds.effect('wrong');
    button.classList.remove('wrong-answer');
    requestAnimationFrame(() => button.classList.add('wrong-answer'));
    setPrompt('mission-try-again.m4a', `Nearly! Count ${numberName(mission.fact.a)} and ${numberName(mission.fact.b)}, then try again.`, false);
    return;
  }
  clearPhaseTimers();
  sounds.effect('snap');
  button.classList.add('correct-answer');
  setTimeout(() => {
    state.phase = 'combine';
    renderMission();
    setPrompt(missionAudioName('combine', mission.fact), `Yes! Now push ${numberName(mission.fact.a)} and ${numberName(mission.fact.b)} together!`);
  }, state.gentleMotion ? 20 : 520);
}

function renderCombineStage(fact) {
  const arena = makeElement('div', 'combine-arena');
  [fact.a, fact.b].forEach((value, index) => {
    const button = makeElement('button', `built-friend built-friend-${index + 1}`);
    button.type = 'button';
    button.dataset.friendIndex = String(index);
    button.setAttribute('aria-label', `Number ${numberName(value)}. Push it into the other number friend.`);
    button.append(characterHost(value, 'mission-character combine-character'), makeElement('span', 'friend-badge', value));
    attachCombineGesture(button, index);
    arena.appendChild(button);
  });
  const coach = makeElement('div', 'combine-coach');
  coach.setAttribute('aria-hidden', 'true');
  coach.append(makeElement('span', '', '☝'), makeElement('i', '', '→'));
  arena.appendChild(coach);
  elements.missionStage.appendChild(arena);
}

function attachCombineGesture(button, index) {
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let moved = false;
  let touching = false;
  let joinTimer = null;
  let completed = false;

  const target = () => elements.missionStage.querySelector(`.built-friend[data-friend-index="${index === 0 ? 1 : 0}"]`);
  const cleanup = () => {
    clearTimeout(joinTimer);
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', finish);
    document.removeEventListener('pointercancel', finish);
  };
  const complete = () => {
    if (completed) return;
    completed = true;
    cleanup();
    button.classList.add('magnet-join');
    target()?.classList.add('magnet-target');
    setTimeout(completeMission, state.gentleMotion ? 20 : 260);
  };
  const move = event => {
    if (event.pointerId !== pointerId || completed) return;
    event.preventDefault();
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < 7) return;
    moved = true;
    button.classList.add('dragging');
    button.style.setProperty('--drag-x', `${dx}px`);
    button.style.setProperty('--drag-y', `${dy}px`);
    touching = pointInside(target(), event.clientX, event.clientY, 32);
    target()?.classList.toggle('drop-ready', touching);
    if (touching && !joinTimer) joinTimer = setTimeout(complete, 150);
    if (!touching && joinTimer) {
      clearTimeout(joinTimer);
      joinTimer = null;
    }
  };
  const finish = event => {
    if (event.pointerId !== pointerId || completed) return;
    cleanup();
    if (event.type !== 'pointercancel' && touching) complete();
    else {
      button.classList.remove('dragging');
      button.classList.add('friend-hop');
      setTimeout(() => button.classList.remove('friend-hop'), 520);
    }
  };
  button.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    sounds.unlock();
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', finish);
    document.addEventListener('pointercancel', finish);
  });
}

function renderSplitStage(fact) {
  const splitArena = makeElement('div', 'split-arena');
  const pads = makeElement('div', 'split-targets');
  [fact.a, fact.b].forEach(value => pads.appendChild(makeElement('span', 'split-target', value)));
  const whole = makeElement('button', 'reverse-whole');
  whole.type = 'button';
  whole.setAttribute('aria-label', `Number ${numberName(fact.sum)}. Pull some of its blocks away.`);
  whole.append(characterHost(fact.sum, 'mission-character reverse-character'), makeElement('span', 'friend-badge', fact.sum));
  attachSplitGesture(whole, fact);
  const coach = makeElement('div', 'reverse-coach');
  coach.setAttribute('aria-hidden', 'true');
  coach.append(makeElement('span', '', '☝'), makeElement('i', '', '↗'));
  splitArena.append(pads, whole, coach);
  elements.missionStage.appendChild(splitArena);
}

function attachSplitGesture(button, fact) {
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let chunk = 0;
  let moved = false;
  let armed = false;
  let splitTimer = null;
  let selected = [];
  let completed = false;

  const cleanup = () => {
    clearTimeout(splitTimer);
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', finish);
    document.removeEventListener('pointercancel', finish);
  };
  const resolve = () => {
    if (completed) return;
    completed = true;
    cleanup();
    const parts = [chunk, fact.sum - chunk];
    if (isCorrectSplit(fact, parts)) {
      sounds.effect('snap');
      button.classList.add('split-success');
      setTimeout(() => completeSplit(parts), state.gentleMotion ? 20 : 260);
    } else {
      state.missionMistake = true;
      state.progress.mistakes += 1;
      saveState();
      sounds.effect('wrong');
      button.classList.add('split-wrong');
      setPrompt('mission-split-retry.m4a', `Almost! Try pulling ${numberName(fact.a)} ${blockNoun(fact.a)} away.`, false);
      setTimeout(() => renderMission(), state.gentleMotion ? 20 : 480);
    }
  };
  const move = event => {
    if (event.pointerId !== pointerId || completed) return;
    event.preventDefault();
    lastX = event.clientX;
    lastY = event.clientY;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < 7) return;
    moved = true;
    selected.forEach(cube => {
      cube.style.setProperty('--peel-x', `${dx}px`);
      cube.style.setProperty('--peel-y', `${dy}px`);
    });
    armed = Math.hypot(dx, dy) > 48;
    button.classList.toggle('split-armed', armed);
    const preview = elements.missionStage.querySelector('.mission-split-preview');
    if (preview) {
      preview.textContent = `${chunk} + ${fact.sum - chunk}`;
      preview.classList.toggle('armed', armed);
      const arena = elements.missionStage.getBoundingClientRect();
      preview.style.left = `${Math.min(arena.width - 44, Math.max(44, event.clientX - arena.left + 20))}px`;
      preview.style.top = `${Math.min(arena.height - 30, Math.max(28, event.clientY - arena.top - 24))}px`;
    }
    if (armed && !splitTimer) splitTimer = setTimeout(resolve, 170);
    if (!armed && splitTimer) {
      clearTimeout(splitTimer);
      splitTimer = null;
    }
  };
  const finish = event => {
    if (event.pointerId !== pointerId || completed) return;
    cleanup();
    elements.missionStage.querySelector('.mission-split-preview')?.remove();
    if (event.type !== 'pointercancel' && moved && armed) resolve();
    else {
      selected.forEach(cube => {
        cube.style.removeProperty('--peel-x');
        cube.style.removeProperty('--peel-y');
      });
      button.classList.add('split-return');
      setTimeout(() => button.classList.remove('split-return', 'split-armed'), 280);
    }
  };
  button.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const cubes = [...button.querySelectorAll('.cube')];
    const touchedCube = event.target.closest?.('.cube');
    const cube = touchedCube || cubes.reduce((nearest, candidate) => {
      const rect = candidate.getBoundingClientRect();
      const distance = Math.hypot(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2));
      return !nearest || distance < nearest.distance ? { candidate, distance } : nearest;
    }, null)?.candidate;
    if (!cube) return;
    event.preventDefault();
    sounds.unlock();
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    lastX = startX;
    lastY = startY;
    chunk = Math.min(Number(cube.dataset.cubeIndex) + 1, fact.sum - 1);
    selected = cubes.slice(0, chunk);
    selected.forEach(item => item.classList.add('peel-cube'));
    cubes.slice(chunk).forEach(item => item.classList.add('stay-cube'));
    const preview = makeElement('span', 'mission-split-preview', `${chunk} + ${fact.sum - chunk}`);
    elements.missionStage.appendChild(preview);
    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', finish);
    document.addEventListener('pointercancel', finish);
  });
}

function completeSplit(parts) {
  clearPhaseTimers();
  const mission = currentMission();
  state.splitParts = parts;
  state.phase = 'choose';
  renderMission();
  setPrompt(missionAudioName('split-made', mission.fact), `You made ${numberName(mission.fact.a)} and ${numberName(mission.fact.b)}! What do they make?`);
}

function completeMission() {
  if (state.phase !== 'combine') return;
  clearPhaseTimers();
  const mission = currentMission();
  state.phase = 'success';
  state.progress = recordFactResult(state.progress, mission.fact, { firstTry: !state.missionMistake });
  saveState();
  sounds.effect('join');
  renderMission();
  setPrompt(missionAudioName('success', mission.fact), `${numberName(mission.fact.a, true)} and ${numberName(mission.fact.b)} make ${numberName(mission.fact.sum)}! Number magic!`, false);
  celebrate();
  state.celebrationTimer = setTimeout(nextMission, state.gentleMotion ? 900 : 3200);
}

function renderSuccessStage(fact) {
  const success = makeElement('div', 'mission-success');
  success.append(
    makeElement('span', 'success-spark success-spark-1', '✦'),
    characterHost(fact.sum, 'mission-character success-character'),
    makeElement('span', 'success-number', fact.sum),
    makeElement('span', 'success-spark success-spark-2', '★')
  );
  elements.missionStage.appendChild(success);
}

function nextMission() {
  clearPhaseTimers();
  state.missionIndex += 1;
  if (state.missionIndex < state.session.length) {
    startMission();
    return;
  }
  state.progress.sessionsCompleted += 1;
  const advancement = advanceLearning(state.progress, state.learning);
  state.learning = advancement.learning;
  state.newLevel = advancement.unlocked;
  saveState();
  state.missionIndex = 2;
  state.phase = 'session-complete';
  renderMission();
  if (state.newLevel) {
    setPrompt(`mission-unlock-${state.newLevel}.m4a`, `Amazing! Number ${numberName(state.newLevel)} is ready to play!`, false);
  } else {
    setPrompt('mission-session-complete.m4a', 'Three missions complete! Ten is very proud of you!', false);
  }
}

function renderSessionComplete() {
  elements.equation.replaceChildren();
  elements.equation.setAttribute('aria-label', 'Mission complete');
  const card = makeElement('div', 'session-complete-card');
  card.append(
    makeElement('span', 'session-stars', '★ ✦ ★'),
    characterHost(10, 'mission-character session-ten'),
    makeElement('h2', '', 'Mission complete!'),
    makeElement('p', state.newLevel ? 'level-unlocked-copy' : '', state.newLevel
      ? `New number unlocked: ${state.newLevel}!`
      : 'Three number challenges solved')
  );
  const again = makeElement('button', 'mission-again-button');
  again.type = 'button';
  again.append(makeElement('span', '', 'Play again'), makeElement('span', '', '★'));
  again.addEventListener('click', startSession);
  card.appendChild(again);
  elements.missionStage.appendChild(card);
  renderHomeProgress();
}

function celebrate() {
  if (state.gentleMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  elements.celebration.replaceChildren();
  const colors = ['#ef4e55', '#ffd84d', '#43b876', '#34a7df', '#aa67c8', '#fff'];
  for (let index = 0; index < 24; index += 1) {
    const piece = makeElement('span', 'celebration-piece');
    piece.style.setProperty('--left', `${45 + Math.random() * 10}%`);
    piece.style.setProperty('--top', `${34 + Math.random() * 12}%`);
    piece.style.setProperty('--x', `${-170 + Math.random() * 340}px`);
    piece.style.setProperty('--y', `${-160 + Math.random() * 300}px`);
    piece.style.setProperty('--spin', `${-320 + Math.random() * 640}deg`);
    piece.style.setProperty('--delay', `${Math.random() * 130}ms`);
    piece.style.setProperty('--size', `${7 + Math.random() * 9}px`);
    piece.style.setProperty('--radius', index % 3 === 0 ? '50%' : '3px');
    piece.style.setProperty('--color', colors[index % colors.length]);
    elements.celebration.appendChild(piece);
  }
  setTimeout(() => elements.celebration.replaceChildren(), 1500);
}

function showToast(message) {
  clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  state.toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 1800);
}

function openSettings() {
  elements.settingsOverlay.hidden = false;
  updatePreferenceUi();
  updateInstallUi();
}

function closeSettings() {
  elements.settingsOverlay.hidden = true;
}

function toggleSound() {
  state.sound = !state.sound;
  if (!state.sound) sounds.stopVoice();
  updatePreferenceUi();
  saveState();
  if (state.sound) sounds.unlock();
}

function resetProgress() {
  const now = Date.now();
  if (now > state.resetArmedUntil) {
    state.resetArmedUntil = now + 3500;
    elements.resetProgressButton.textContent = 'Tap again to reset everything';
    showToast('Tap reset once more to confirm');
    setTimeout(() => {
      if (Date.now() >= state.resetArmedUntil) elements.resetProgressButton.textContent = 'Reset mission progress';
    }, 3600);
    return;
  }
  state.progress = { sessionsCompleted: 0, factWins: {}, factStats: {}, mistakes: 0 };
  state.learning = normalizeLearningSettings({
    ...state.learning,
    adaptiveMax: RANGE_PRESETS.find(preset => preset.id === state.learning.preset)?.maxSum
  });
  state.resetArmedUntil = 0;
  elements.resetProgressButton.textContent = 'Reset mission progress';
  saveState();
  renderHomeProgress();
  updatePreferenceUi();
  showToast('Mission progress reset');
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function updateOfflineUi() {
  document.documentElement.classList.toggle('offline-ready', state.offlineReady);
  elements.offlineLabel.textContent = state.offlineReady ? 'Ready to play offline' : 'Preparing offline play…';
  elements.settingsOfflineDot.classList.toggle('ready', state.offlineReady);
  elements.settingsOfflineTitle.textContent = state.offlineReady ? 'Ready to play offline' : 'Preparing offline play';
  elements.settingsOfflineCopy.textContent = state.offlineReady
    ? 'Missions, characters, voices, and progress work without internet.'
    : 'Keep this page open for a moment while the app is saved.';
}

function updateInstallUi() {
  const installed = isStandalone();
  elements.installInstructions.hidden = installed;
  elements.installedMessage.hidden = !installed;
}

async function registerOfflineApp() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    elements.offlineLabel.textContent = 'Open securely to enable offline play';
    return;
  }
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'OFFLINE_READY') {
      state.offlineReady = true;
      updateOfflineUi();
    }
  });
  try {
    const registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
    await navigator.serviceWorker.ready;
    (registration.active || registration.waiting || registration.installing)?.postMessage({ type: 'CHECK_READY' });
    navigator.serviceWorker.controller?.postMessage({ type: 'CHECK_READY' });
  } catch {
    elements.offlineLabel.textContent = 'Offline save will retry next time';
  }
}

function wireEvents() {
  elements.startButton.addEventListener('click', () => {
    sounds.unlock();
    elements.welcomeOverlay.hidden = true;
    if (!state.learning.configured) {
      elements.rangeOverlay.hidden = false;
      return;
    }
    sounds.speak('welcome.m4a', "Hello, number maker! I'm Ten. Ready for some number magic?");
  });
  elements.missionButton.addEventListener('click', startSession);
  elements.backButton.addEventListener('click', goHome);
  elements.replayButton.addEventListener('click', () => {
    sounds.unlock();
    sounds.effect('tap');
    sounds.speak(state.prompt.file, state.prompt.text);
  });
  elements.soundButtons.forEach(button => button.addEventListener('click', toggleSound));
  elements.settingsButton.addEventListener('click', openSettings);
  elements.offlinePill.addEventListener('click', openSettings);
  elements.closeSettingsButton.addEventListener('click', closeSettings);
  elements.settingsOverlay.addEventListener('click', event => {
    if (event.target === elements.settingsOverlay) closeSettings();
  });
  elements.soundToggle.addEventListener('change', () => {
    state.sound = elements.soundToggle.checked;
    updatePreferenceUi();
    saveState();
    if (state.sound) sounds.unlock();
    else sounds.stopVoice();
  });
  elements.motionToggle.addEventListener('change', () => {
    state.gentleMotion = elements.motionToggle.checked;
    updatePreferenceUi();
    saveState();
  });
  elements.settingsRangeChoices.addEventListener('change', event => {
    if (!event.target.matches('input[data-range-preset]')) return;
    setLearningPreset(event.target.value);
    showToast(`Learning range starts at ${RANGE_PRESETS.find(preset => preset.id === event.target.value)?.label}`);
  });
  elements.autoAdvanceToggle.addEventListener('change', () => {
    state.learning = normalizeLearningSettings({ ...state.learning, configured: true, autoAdvance: elements.autoAdvanceToggle.checked });
    saveState();
    updatePreferenceUi();
    showToast(state.learning.autoAdvance ? 'Automatic growth on' : 'Learning range fixed');
  });
  elements.restartRangeButton.addEventListener('click', () => {
    setLearningPreset(state.learning.preset, state.learning.autoAdvance);
    showToast('Selected learning range restarted');
  });
  elements.saveRangeButton.addEventListener('click', () => {
    const selected = elements.setupRangeChoices.querySelector('input[data-range-preset]:checked')?.value || 'little';
    setLearningPreset(selected, elements.setupAutoAdvance.checked);
    elements.rangeOverlay.hidden = true;
    sounds.speak('welcome.m4a', "Hello, number maker! I'm Ten. Ready for some number magic?");
    showToast('Starting range saved');
  });
  elements.resetProgressButton.addEventListener('click', resetProgress);
  document.addEventListener('visibilitychange', () => {
    saveState();
    if (document.hidden) sounds.stopVoice();
  });
  window.addEventListener('pagehide', saveState);
}

function init() {
  cacheElements();
  loadState();
  renderRangeChoices(elements.settingsRangeChoices, 'settingsRange');
  renderRangeChoices(elements.setupRangeChoices, 'setupRange');
  renderMentors();
  renderHomeProgress();
  updatePreferenceUi();
  updateOfflineUi();
  updateInstallUi();
  wireEvents();
  registerOfflineApp();
}

init();
