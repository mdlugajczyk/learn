import {
  chooseNumberChoices,
  formatEquation,
  joinParts,
  partitionKey,
  splitPart,
  suggestedSplit
} from './engine.js';

const STORAGE_KEY = 'tens-number-magic-v1';
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
  target: 5,
  parts: [5],
  history: [],
  selectedIndex: 0,
  joinMode: false,
  joinFirstIndex: null,
  choices: [5, 7, 10],
  discoveries: {},
  recent: {},
  sound: true,
  gentleMotion: false,
  offlineReady: false,
  audioUnlocked: false,
  toastTimer: null,
  resetArmedUntil: 0
};

class SoundStudio {
  constructor() {
    this.context = null;
    this.voice = new Audio();
    this.voice.preload = 'auto';
    this.voice.volume = 0.92;
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
  }

  speak(filename) {
    if (!state.sound || !state.audioUnlocked || !filename) return;
    const token = ++this.voiceToken;
    this.voice.pause();
    this.voice.src = `audio/${filename}`;
    this.voice.currentTime = 0;
    this.voice.play().catch(() => {
      if (token !== this.voiceToken || !('speechSynthesis' in window)) return;
      const fallback = new SpeechSynthesisUtterance(elements.mentorText?.textContent || '');
      fallback.lang = 'en-GB';
      fallback.rate = 0.88;
      fallback.pitch = 1.08;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(fallback);
    });
  }

  effect(kind) {
    if (!state.sound || !state.audioUnlocked || !this.context) return;
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    const now = this.context.currentTime;
    const patterns = {
      tap: [[420, 610, 0, .065, .055]],
      slide: [[280, 350, 0, .045, .025]],
      split: [[330, 520, 0, .16, .06], [520, 760, .08, .19, .055]],
      join: [[310, 390, 0, .18, .06], [390, 520, .06, .24, .055]],
      discover: [[523, 620, 0, .2, .055], [659, 740, .09, .25, .05], [784, 880, .18, .3, .045]],
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
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    state.discoveries = stored.discoveries && typeof stored.discoveries === 'object' ? stored.discoveries : {};
    state.recent = stored.recent && typeof stored.recent === 'object' ? stored.recent : {};
    state.sound = stored.sound !== false;
    state.gentleMotion = stored.gentleMotion === true;
  } catch {
    // A fresh, in-memory game still works if storage is unavailable.
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      discoveries: state.discoveries,
      recent: state.recent,
      sound: state.sound,
      gentleMotion: state.gentleMotion
    }));
  } catch {
    // Progress persistence is helpful, but never blocks play.
  }
}

function cacheElements() {
  [
    'homeScreen', 'playScreen', 'homeMentor', 'playMentor', 'welcomeMentor',
    'numberChoices', 'shuffleButton', 'offlinePill', 'offlineLabel', 'playTitle', 'playContent',
    'backButton', 'mentorText', 'replayButton', 'partsStage', 'equation',
    'splitDock', 'splitTitle', 'splitRange', 'leftSplitValue', 'rightSplitValue',
    'splitButton', 'undoButton', 'joinAllButton', 'joinButtonLabel', 'newWayButton', 'discoveryCount',
    'recentDiscoveries', 'welcomeOverlay', 'startButton', 'settingsButton',
    'settingsOverlay', 'closeSettingsButton', 'soundToggle', 'motionToggle',
    'settingsOfflineDot', 'settingsOfflineTitle', 'settingsOfflineCopy',
    'installInstructions', 'installedMessage', 'resetProgressButton', 'toast',
    'celebration'
  ].forEach(id => { elements[id] = document.getElementById(id); });
  elements.soundButtons = [...document.querySelectorAll('[data-sound-button]')];
}

function numberName(number, capitalized = false) {
  const value = NUMBER_NAMES[number] || String(number);
  return capitalized ? value.charAt(0).toUpperCase() + value.slice(1) : value;
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
  if (number === 4) {
    body.append(makeElement('span', 'brow brow-left'), makeElement('span', 'brow brow-right'));
  }
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
  elements.soundButtons.forEach(button => {
    button.setAttribute('aria-label', state.sound ? 'Turn sound off' : 'Turn sound on');
  });
}

function renderChoices() {
  elements.numberChoices.replaceChildren();
  state.choices.forEach((number, index) => {
    const button = makeElement('button', `number-choice${number === 10 ? ' favorite' : ''}`);
    button.type = 'button';
    button.style.setProperty('--number-color', characterColor(number));
    button.setAttribute('aria-label', `Play with number ${numberName(number)}`);
    const host = makeElement('span', 'character-host choice-character');
    host.appendChild(createCharacter(number));
    const label = makeElement('span', 'choice-label', number);
    button.append(host, label);
    button.style.setProperty('--choice-index', index);
    button.addEventListener('click', () => {
      sounds.unlock();
      sounds.effect('tap');
      startNumber(number);
    });
    elements.numberChoices.appendChild(button);
  });
}

function shuffleChoices() {
  const previous = state.choices.join(',');
  for (let tries = 0; tries < 5; tries += 1) {
    state.choices = chooseNumberChoices();
    if (state.choices.join(',') !== previous) break;
  }
  sounds.effect('slide');
  renderChoices();
}

function startNumber(number) {
  state.target = number;
  state.parts = [number];
  state.history = [];
  state.selectedIndex = 0;
  state.joinMode = false;
  state.joinFirstIndex = null;
  elements.homeScreen.hidden = true;
  elements.playScreen.hidden = false;
  elements.playTitle.textContent = numberName(number, true).toUpperCase();
  setMentorText(`Let's find all the ways to make ${numberName(number)}!`);
  renderPlay();
  sounds.speak(`play-${number}.m4a`);
  requestAnimationFrame(() => { elements.playContent.scrollTop = 0; });
}

function goHome() {
  sounds.stopVoice();
  sounds.effect('back');
  elements.playScreen.hidden = true;
  elements.homeScreen.hidden = false;
  shuffleChoices();
}

function setMentorText(text) {
  elements.mentorText.textContent = text;
}

function compositionSentence(parts = state.parts) {
  const words = parts.map(number => numberName(number));
  let joined = words[0] || '';
  if (words.length === 2) joined = `${words[0]} and ${words[1]}`;
  if (words.length > 2) joined = `${words.slice(0, -1).join(', ')}, and ${words.at(-1)}`;
  return `${numberName(state.target, true)} is made of ${joined}!`;
}

function compositionAudioFilename(parts = state.parts) {
  const key = partitionKey(parts).replaceAll('+', '-');
  return `composition-${state.target}-${key}.m4a`;
}

function renderPlay(options = {}) {
  renderParts(options);
  renderEquation();
  renderSplitDock();
  renderActions();
  renderDiscoveries();
}

function renderParts(options = {}) {
  elements.partsStage.replaceChildren();
  elements.partsStage.className = `parts-stage parts-count-${state.parts.length}`;
  state.parts.forEach((number, index) => {
    const isSelected = state.joinMode ? index === state.joinFirstIndex : index === state.selectedIndex;
    const button = makeElement('button', `part-card${number > 1 && !state.joinMode ? ' splittable' : ''}${isSelected ? ' selected' : ''}`);
    button.type = 'button';
    button.dataset.partIndex = String(index);
    button.style.setProperty('--part-color', characterColor(number));
    button.setAttribute('aria-label', number > 1
      ? `Number ${number}. Tap to split, or drag it onto another number to join.`
      : 'Number one. Drag it onto another number to join.');
    const host = makeElement('span', 'character-host part-character');
    host.appendChild(createCharacter(number));
    const label = makeElement('span', 'part-label', number);
    button.append(host, label);
    if (options.arriveIndices?.includes(index)) {
      button.classList.add('part-arrive');
      button.style.setProperty('--arrive-rotate', index % 2 ? '7deg' : '-7deg');
    }
    if (options.joinedIndex === index) button.classList.add('part-joining');
    attachPartGestures(button, index);
    elements.partsStage.appendChild(button);
  });
  updatePreviewCubes();
}

function attachPartGestures(button, index) {
  let startX = 0;
  let startY = 0;
  let moved = false;
  let targetIndex = null;

  button.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    startX = event.clientX;
    startY = event.clientY;
    moved = false;
    targetIndex = null;
    button.setPointerCapture(event.pointerId);
  });

  button.addEventListener('pointermove', event => {
    if (!button.hasPointerCapture(event.pointerId)) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < 9) return;
    moved = true;
    button.classList.add('dragging');
    button.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.04)`;
    targetIndex = findDropTarget(index, event.clientX, event.clientY);
    document.querySelectorAll('.part-card').forEach(part => {
      part.classList.toggle('drop-target', Number(part.dataset.partIndex) === targetIndex);
    });
  });

  const finish = event => {
    if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    button.style.transform = '';
    button.classList.remove('dragging');
    document.querySelectorAll('.part-card').forEach(part => part.classList.remove('drop-target'));
    if (moved) {
      button.dataset.suppressClick = 'true';
      setTimeout(() => delete button.dataset.suppressClick, 80);
      if (targetIndex !== null) joinSelectedParts(index, targetIndex);
    }
  };

  button.addEventListener('pointerup', finish);
  button.addEventListener('pointercancel', finish);
  button.addEventListener('click', () => {
    if (button.dataset.suppressClick === 'true') return;
    selectPart(index);
  });
}

function findDropTarget(sourceIndex, x, y) {
  let best = null;
  let bestDistance = Infinity;
  document.querySelectorAll('.part-card').forEach(part => {
    const index = Number(part.dataset.partIndex);
    if (index === sourceIndex) return;
    const rect = part.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.hypot(x - centerX, y - centerY);
    if ((x >= rect.left - 18 && x <= rect.right + 18 && y >= rect.top - 18 && y <= rect.bottom + 18) || distance < 72) {
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    }
  });
  return best;
}

function selectPart(index) {
  if (state.joinMode) {
    if (state.joinFirstIndex === null) {
      state.joinFirstIndex = index;
      state.selectedIndex = index;
      sounds.effect('tap');
      setMentorText(`Great! Now tap another number friend to join with ${numberName(state.parts[index])}.`);
      renderPlay();
      return;
    }
    if (state.joinFirstIndex === index) {
      state.joinFirstIndex = null;
      setMentorText('Choose the first number friend to join.');
      renderPlay();
      return;
    }
    joinSelectedParts(state.joinFirstIndex, index);
    return;
  }
  state.selectedIndex = index;
  sounds.effect('tap');
  const value = state.parts[index];
  if (value > 1) {
    setMentorText(`Slide the star, then split ${numberName(value)}!`);
  } else {
    setMentorText('One cannot split, but you can drag it onto a friend to join!');
  }
  renderPlay();
}

function renderEquation() {
  elements.equation.replaceChildren();
  if (state.parts.length === 1) {
    elements.equation.appendChild(makeElement('span', 'equation-token', state.target));
    elements.equation.firstElementChild.style.setProperty('--token-color', characterColor(state.target));
    elements.equation.setAttribute('aria-label', numberName(state.target));
    return;
  }

  const sequence = [state.target, '=', ...state.parts.flatMap((value, index) => index ? ['+', value] : [value])];
  sequence.forEach((value, index) => {
    const numeric = Number.isInteger(value);
    const span = makeElement('span', numeric ? 'equation-token' : 'equation-symbol', value);
    if (numeric) span.style.setProperty('--token-color', characterColor(value));
    span.style.animationDelay = `${index * 28}ms`;
    elements.equation.appendChild(span);
  });
  elements.equation.setAttribute('aria-label', formatEquation(state.target, state.parts));
}

function renderSplitDock() {
  const value = state.parts[state.selectedIndex];
  if (state.joinMode || !value || value < 2) {
    elements.splitDock.hidden = true;
    updatePreviewCubes();
    return;
  }

  elements.splitDock.hidden = false;
  elements.splitTitle.textContent = `Split ${numberName(value)}`;
  elements.splitRange.min = '1';
  elements.splitRange.max = String(value - 1);
  const current = Number(elements.splitRange.value);
  const hint = suggestedSplit(value, state.discoveries[String(value)] || []);
  const fallback = Math.min(hint?.left || Math.ceil(value / 2), value - 1);
  elements.splitRange.value = String(current >= 1 && current < value ? current : fallback);
  updateSplitValues();
}

function updateSplitValues() {
  const selectedValue = state.parts[state.selectedIndex];
  if (!selectedValue || selectedValue < 2) return;
  const left = Number(elements.splitRange.value);
  const right = selectedValue - left;
  elements.leftSplitValue.value = String(left);
  elements.leftSplitValue.textContent = String(left);
  elements.rightSplitValue.value = String(right);
  elements.rightSplitValue.textContent = String(right);
  const max = selectedValue - 1;
  const position = max <= 1 ? 50 : ((left - 1) / (max - 1)) * 100;
  elements.splitRange.parentElement.style.setProperty('--range-position', `${position}%`);
  updatePreviewCubes(left);
}

function updatePreviewCubes(leftValue = Number(elements.splitRange.value)) {
  document.querySelectorAll('.part-card .cube').forEach(cube => cube.classList.remove('preview-a', 'preview-b'));
  const selected = elements.partsStage.querySelector(`.part-card[data-part-index="${state.selectedIndex}"]`);
  if (!selected || elements.splitDock.hidden) return;
  [...selected.querySelectorAll('.cube')].forEach((cube, index) => {
    cube.classList.add(index < leftValue ? 'preview-a' : 'preview-b');
  });
}

function performSplit() {
  const index = state.selectedIndex;
  const value = state.parts[index];
  const left = Number(elements.splitRange.value);
  if (!value || value < 2 || left < 1 || left >= value) return;
  const oldCard = elements.partsStage.querySelector(`.part-card[data-part-index="${index}"]`);
  oldCard?.classList.add('part-splitting');
  sounds.effect('split');
  setTimeout(() => {
    state.history.push([...state.parts]);
    state.parts = splitPart(state.parts, index, left).sort((a, b) => b - a);
    const newIndices = state.parts.map((_, partIndex) => partIndex);
    state.selectedIndex = Math.max(0, state.parts.findIndex(part => part > 1));
    const isNew = recordDiscovery();
    setMentorText(compositionSentence());
    renderPlay({ arriveIndices: newIndices });
    sounds.speak(compositionAudioFilename());
    if (isNew) celebrateDiscovery();
  }, state.gentleMotion ? 10 : 300);
}

function joinSelectedParts(firstIndex, secondIndex) {
  if (firstIndex === secondIndex) return;
  const combinedValue = state.parts[firstIndex] + state.parts[secondIndex];
  state.history.push([...state.parts]);
  state.parts = joinParts(state.parts, firstIndex, secondIndex).sort((a, b) => b - a);
  const combinedIndex = state.parts.indexOf(combinedValue);
  state.selectedIndex = combinedIndex;
  state.joinMode = false;
  state.joinFirstIndex = null;
  const isWhole = state.parts.length === 1;
  const isNew = !isWhole && recordDiscovery();
  sounds.effect('join');
  setMentorText(isWhole
    ? `Back together! ${numberName(state.target, true)} is still ${numberName(state.target)}!`
    : compositionSentence());
  renderPlay({ joinedIndex: combinedIndex });
  sounds.speak(isWhole ? `together-${state.target}.m4a` : compositionAudioFilename());
  if (isNew) celebrateDiscovery();
}

function joinAll() {
  if (state.parts.length === 1) return;
  if (state.parts.length === 2) {
    joinSelectedParts(0, 1);
    return;
  }
  state.joinMode = !state.joinMode;
  state.joinFirstIndex = null;
  sounds.effect(state.joinMode ? 'tap' : 'back');
  setMentorText(state.joinMode
    ? 'Tap two number friends to join them together!'
    : 'Tap a number friend to see what is inside!');
  renderPlay();
}

function undo() {
  const previous = state.history.pop();
  if (!previous) return;
  state.parts = previous;
  state.joinMode = false;
  state.joinFirstIndex = null;
  state.selectedIndex = Math.max(0, state.parts.findIndex(value => value > 1));
  sounds.effect('back');
  setMentorText(state.parts.length === 1 ? `Here is ${numberName(state.target)} again.` : compositionSentence());
  renderPlay();
}

function startNewWay() {
  if (state.parts.length > 1) state.history.push([...state.parts]);
  state.parts = [state.target];
  state.selectedIndex = 0;
  state.joinMode = false;
  state.joinFirstIndex = null;
  const discovered = state.discoveries[String(state.target)] || [];
  const hint = suggestedSplit(state.target, discovered);
  if (hint) elements.splitRange.value = String(hint.left);
  sounds.effect('slide');
  setMentorText(`Can you make ${numberName(state.target)} a different way?`);
  renderPlay({ joinedIndex: 0 });
  sounds.speak(`new-way-${state.target}.m4a`);
}

function recordDiscovery() {
  if (state.parts.length < 2) return false;
  const targetKey = String(state.target);
  const key = partitionKey(state.parts);
  const discoveries = new Set(state.discoveries[targetKey] || []);
  const isNew = !discoveries.has(key);
  discoveries.add(key);
  state.discoveries[targetKey] = [...discoveries];
  const recent = [key, ...(state.recent[targetKey] || []).filter(item => item !== key)].slice(0, 4);
  state.recent[targetKey] = recent;
  saveState();
  return isNew;
}

function renderDiscoveries() {
  const targetKey = String(state.target);
  const count = (state.discoveries[targetKey] || []).length;
  elements.discoveryCount.textContent = `${count} ${count === 1 ? 'way' : 'ways'} found`;
  elements.recentDiscoveries.replaceChildren();
  (state.recent[targetKey] || []).slice(0, 3).forEach(key => {
    elements.recentDiscoveries.appendChild(makeElement('span', 'discovery-badge', key));
  });
}

function renderActions() {
  elements.undoButton.disabled = state.history.length === 0;
  elements.joinAllButton.disabled = state.parts.length === 1;
  elements.joinAllButton.classList.toggle('action-button-accent', state.joinMode);
  elements.joinButtonLabel.textContent = state.joinMode ? 'Cancel' : 'Join';
}

function celebrateDiscovery() {
  sounds.effect('discover');
  showToast('A brand-new way! ✦');
  if (state.gentleMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  elements.celebration.replaceChildren();
  const colors = ['#ef4e55', '#ffd84d', '#43b876', '#34a7df', '#aa67c8', '#fff'];
  for (let index = 0; index < 22; index += 1) {
    const piece = makeElement('span', 'celebration-piece');
    piece.style.setProperty('--left', `${45 + Math.random() * 10}%`);
    piece.style.setProperty('--top', `${34 + Math.random() * 12}%`);
    piece.style.setProperty('--x', `${-165 + Math.random() * 330}px`);
    piece.style.setProperty('--y', `${-150 + Math.random() * 290}px`);
    piece.style.setProperty('--spin', `${-300 + Math.random() * 600}deg`);
    piece.style.setProperty('--delay', `${Math.random() * 120}ms`);
    piece.style.setProperty('--size', `${6 + Math.random() * 8}px`);
    piece.style.setProperty('--radius', index % 3 === 0 ? '50%' : '3px');
    piece.style.setProperty('--color', colors[index % colors.length]);
    elements.celebration.appendChild(piece);
  }
  setTimeout(() => elements.celebration.replaceChildren(), 1300);
}

function showToast(message) {
  clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  state.toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 1800);
}

function openSettings() {
  elements.settingsOverlay.hidden = false;
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
      if (Date.now() >= state.resetArmedUntil) elements.resetProgressButton.textContent = 'Reset discoveries';
    }, 3600);
    return;
  }
  state.discoveries = {};
  state.recent = {};
  state.resetArmedUntil = 0;
  elements.resetProgressButton.textContent = 'Reset discoveries';
  saveState();
  renderDiscoveries();
  showToast('Discoveries reset');
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
    ? 'Characters, voices, sounds, and progress work without internet.'
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
    elements.settingsOfflineTitle.textContent = 'Offline install unavailable here';
    elements.settingsOfflineCopy.textContent = 'The hosted app will support offline play.';
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
    if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'CHECK_READY' });
  } catch {
    elements.offlineLabel.textContent = 'Offline save will retry next time';
    elements.settingsOfflineTitle.textContent = 'Offline save paused';
    elements.settingsOfflineCopy.textContent = 'Play online now; the app will retry automatically.';
  }
}

function wireEvents() {
  elements.startButton.addEventListener('click', () => {
    sounds.unlock();
    elements.welcomeOverlay.hidden = true;
    sounds.speak('welcome.m4a');
  });
  elements.shuffleButton.addEventListener('click', shuffleChoices);
  elements.backButton.addEventListener('click', goHome);
  elements.replayButton.addEventListener('click', () => {
    sounds.effect('tap');
    sounds.speak(state.parts.length > 1 ? compositionAudioFilename() : `play-${state.target}.m4a`);
  });
  elements.splitRange.addEventListener('input', () => {
    updateSplitValues();
    sounds.effect('slide');
  });
  elements.splitButton.addEventListener('click', performSplit);
  elements.undoButton.addEventListener('click', undo);
  elements.joinAllButton.addEventListener('click', joinAll);
  elements.newWayButton.addEventListener('click', startNewWay);
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
  renderMentors();
  renderChoices();
  updatePreferenceUi();
  updateOfflineUi();
  updateInstallUi();
  wireEvents();
  registerOfflineApp();
}

init();
