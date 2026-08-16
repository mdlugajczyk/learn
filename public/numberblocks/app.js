import {
  chooseNumberChoices,
  formatEquation,
  partitionKey
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
  positions: [{ x: .5, y: .46 }],
  history: [],
  coachVisible: false,
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
      bounce: [[245, 470, 0, .11, .045], [470, 620, .1, .14, .038]],
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
    'undoButton', 'newWayButton', 'discoveryCount',
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
  state.positions = defaultPositions(1);
  state.history = [];
  state.coachVisible = true;
  elements.homeScreen.hidden = true;
  elements.playScreen.hidden = false;
  elements.playTitle.textContent = numberName(number, true).toUpperCase();
  setMentorText('Pull some blocks away. Bump friends together. Flick them up!');
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
  const words = canonicalParts(parts).map(number => numberName(number));
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
  renderActions();
  renderDiscoveries();
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function canonicalParts(parts = state.parts) {
  return [...parts].sort((left, right) => right - left);
}

function defaultPositions(count) {
  if (count === 1) return [{ x: .5, y: .46 }];
  if (count <= 4) {
    return Array.from({ length: count }, (_, index) => ({
      x: .17 + (index * .66) / (count - 1),
      y: .55 + (index % 2 ? .035 : -.015)
    }));
  }
  const columns = Math.min(5, count);
  const rows = Math.ceil(count / columns);
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const itemsInRow = Math.min(columns, count - row * columns);
    const column = index % columns;
    return {
      x: (column + 1) / (itemsInRow + 1),
      y: rows === 1 ? .56 : .38 + row * .31
    };
  });
}

function snapshotPlay() {
  return {
    parts: [...state.parts],
    positions: state.positions.map(position => ({ ...position }))
  };
}

function pushHistory() {
  state.history.push(snapshotPlay());
}

function renderParts(options = {}) {
  if (state.positions.length !== state.parts.length) state.positions = defaultPositions(state.parts.length);
  elements.partsStage.replaceChildren();
  elements.partsStage.className = `parts-stage parts-count-${state.parts.length}`;
  state.parts.forEach((number, index) => {
    const button = makeElement('button', `part-card${number > 1 ? ' splittable' : ''}`);
    button.type = 'button';
    button.dataset.partIndex = String(index);
    button.dataset.gesture = number > 1 ? 'split-move-join-juggle' : 'move-join-juggle';
    button.style.setProperty('--part-color', characterColor(number));
    button.style.left = `${state.positions[index].x * 100}%`;
    button.style.top = `${state.positions[index].y * 100}%`;
    button.setAttribute('aria-label', number > 1
      ? `Number ${number}. Pull its blocks apart to split. Drag its number badge onto a friend to join. Tap to bounce.`
      : 'Number one. Drag its number badge onto a friend to join. Tap to bounce.');
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
  if (state.coachVisible && state.parts.length === 1) renderGestureCoach();
}

function attachPartGestures(button, index) {
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let lastTime = 0;
  let velocityX = 0;
  let velocityY = 0;
  let moved = false;
  let armed = false;
  let targetIndex = null;
  let mode = 'move';
  let chunk = 0;
  let startCenterX = 0;
  let startCenterY = 0;
  let preview = null;
  let selectedCubes = [];
  let activePointerId = null;
  let splitTimer = null;
  let joinTimer = null;
  let settleTimer = null;

  button.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (activePointerId !== null) return;
    event.preventDefault();
    activePointerId = event.pointerId;
    sounds.unlock();
    dismissGestureCoach();
    startX = event.clientX;
    startY = event.clientY;
    lastX = startX;
    lastY = startY;
    lastTime = performance.now();
    velocityX = 0;
    velocityY = 0;
    moved = false;
    armed = false;
    targetIndex = null;
    const cube = event.target.closest('.cube');
    const value = state.parts[index];
    mode = cube && value > 1 ? 'split' : 'move';
    const cardRect = button.getBoundingClientRect();
    startCenterX = cardRect.left + cardRect.width / 2;
    startCenterY = cardRect.top + cardRect.height / 2;
    if (mode === 'split') {
      chunk = Math.min(Number(cube.dataset.cubeIndex) + 1, value - 1);
      const cubes = [...button.querySelectorAll('.cube')];
      selectedCubes = cubes.slice(0, chunk);
      selectedCubes.forEach(item => item.classList.add('peel-cube'));
      cubes.slice(chunk).forEach(item => item.classList.add('stay-cube'));
      button.classList.add('peel-active');
      preview = makeElement('span', 'split-preview', `${chunk} + ${value - chunk}`);
      elements.partsStage.appendChild(preview);
      moveSplitPreview(preview, event.clientX, event.clientY);
    }
    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', finish);
    document.addEventListener('pointercancel', finish);
  });

  const move = event => {
    if (event.pointerId !== activePointerId) return;
    event.preventDefault();
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const now = performance.now();
    const elapsed = Math.max(8, now - lastTime);
    velocityX = (event.clientX - lastX) / elapsed;
    velocityY = (event.clientY - lastY) / elapsed;
    lastX = event.clientX;
    lastY = event.clientY;
    lastTime = now;
    if (!moved && Math.hypot(dx, dy) < 9) return;
    moved = true;
    if (mode === 'split') {
      selectedCubes.forEach(item => {
        item.style.setProperty('--peel-x', `${dx}px`);
        item.style.setProperty('--peel-y', `${dy}px`);
      });
      armed = Math.hypot(dx, dy) > 38;
      button.classList.toggle('split-armed', armed);
      preview?.classList.toggle('armed', armed);
      moveSplitPreview(preview, event.clientX, event.clientY);
      if (armed && !splitTimer) {
        splitTimer = setTimeout(() => {
          if (activePointerId !== null && armed) {
            finish({ pointerId: activePointerId, type: 'pointerup', clientX: lastX, clientY: lastY });
          }
        }, 140);
      } else if (!armed && splitTimer) {
        clearTimeout(splitTimer);
        splitTimer = null;
      }
      return;
    }
    button.classList.add('dragging');
    moveCard(button, startCenterX + dx, startCenterY + dy);
    targetIndex = findDropTarget(index, event.clientX, event.clientY);
    showDropTarget(targetIndex);
    clearTimeout(settleTimer);
    settleTimer = null;
    if (targetIndex !== null && !joinTimer) {
      joinTimer = setTimeout(() => {
        if (activePointerId !== null && targetIndex !== null) {
          finish({ pointerId: activePointerId, type: 'pointerup', clientX: lastX, clientY: lastY });
        }
      }, 170);
    } else if (targetIndex === null && joinTimer) {
      clearTimeout(joinTimer);
      joinTimer = null;
    }
    if (targetIndex === null) {
      settleTimer = setTimeout(() => {
        if (activePointerId !== null && targetIndex === null) {
          finish({ pointerId: activePointerId, type: 'pointerup', clientX: lastX, clientY: lastY });
        }
      }, 220);
    }
  };

  const finish = event => {
    if (event.pointerId !== activePointerId) return;
    clearTimeout(splitTimer);
    clearTimeout(joinTimer);
    clearTimeout(settleTimer);
    splitTimer = null;
    joinTimer = null;
    settleTimer = null;
    activePointerId = null;
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', finish);
    document.removeEventListener('pointercancel', finish);
    showDropTarget(null);
    const cancelled = event.type === 'pointercancel';
    if (mode === 'split') {
      preview?.remove();
      if (!cancelled && moved && armed) {
        performGestureSplit(index, chunk, event.clientX, event.clientY);
      } else {
        button.classList.add('peel-return');
        selectedCubes.forEach(item => {
          item.style.removeProperty('--peel-x');
          item.style.removeProperty('--peel-y');
        });
        setTimeout(() => button.classList.remove('peel-active', 'peel-return', 'split-armed'), 230);
        if (!moved) hopPart(button);
      }
      return;
    }
    button.classList.remove('dragging');
    if (!cancelled && moved) {
      const finalRect = button.getBoundingClientRect();
      state.positions[index] = positionFromCenter(finalRect.left + finalRect.width / 2, finalRect.top + finalRect.height / 2);
      if (targetIndex !== null) {
        joinSelectedParts(index, targetIndex);
      } else if (velocityY < -.38 || Math.hypot(velocityX, velocityY) > .95) {
        jugglePart(button, velocityX, velocityY);
      } else {
        button.classList.add('part-land');
        setTimeout(() => button.classList.remove('part-land'), 380);
      }
    } else if (!cancelled) {
      hopPart(button);
    }
  };

  button.addEventListener('click', event => {
    if (event.detail === 0) hopPart(button);
  });
}

function moveCard(button, centerX, centerY) {
  const stageRect = elements.partsStage.getBoundingClientRect();
  const halfWidth = Math.min(button.offsetWidth / 2 + 6, stageRect.width / 2);
  const halfHeight = Math.min(button.offsetHeight / 2 + 7, stageRect.height / 2);
  const x = clamp(centerX, stageRect.left + halfWidth, stageRect.right - halfWidth);
  const y = clamp(centerY, stageRect.top + halfHeight, stageRect.bottom - halfHeight);
  button.style.left = `${x - stageRect.left}px`;
  button.style.top = `${y - stageRect.top}px`;
}

function positionFromCenter(centerX, centerY) {
  const stageRect = elements.partsStage.getBoundingClientRect();
  return {
    x: clamp((centerX - stageRect.left) / stageRect.width, .1, .9),
    y: clamp((centerY - stageRect.top) / stageRect.height, .16, .84)
  };
}

function moveSplitPreview(preview, clientX, clientY) {
  if (!preview) return;
  const stageRect = elements.partsStage.getBoundingClientRect();
  preview.style.left = `${clamp(clientX - stageRect.left + 18, 46, stageRect.width - 46)}px`;
  preview.style.top = `${clamp(clientY - stageRect.top - 28, 28, stageRect.height - 34)}px`;
}

function showDropTarget(targetIndex) {
  elements.partsStage.querySelectorAll('.part-card').forEach(part => {
    part.classList.toggle('drop-target', Number(part.dataset.partIndex) === targetIndex);
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

function renderEquation() {
  elements.equation.replaceChildren();
  if (state.parts.length === 1) {
    elements.equation.appendChild(makeElement('span', 'equation-token', state.target));
    elements.equation.firstElementChild.style.setProperty('--token-color', characterColor(state.target));
    elements.equation.setAttribute('aria-label', numberName(state.target));
    return;
  }

  const parts = canonicalParts();
  const sequence = [state.target, '=', ...parts.flatMap((value, index) => index ? ['+', value] : [value])];
  sequence.forEach((value, index) => {
    const numeric = Number.isInteger(value);
    const span = makeElement('span', numeric ? 'equation-token' : 'equation-symbol', value);
    if (numeric) span.style.setProperty('--token-color', characterColor(value));
    span.style.animationDelay = `${index * 28}ms`;
    elements.equation.appendChild(span);
  });
  elements.equation.setAttribute('aria-label', formatEquation(state.target, parts));
}

function performGestureSplit(index, left, clientX, clientY) {
  const value = state.parts[index];
  if (!value || value < 2 || left < 1 || left >= value) return;
  const oldCard = elements.partsStage.querySelector(`.part-card[data-part-index="${index}"]`);
  oldCard?.classList.add('part-splitting');
  sounds.effect('split');
  setTimeout(() => {
    pushHistory();
    const originalPosition = state.positions[index];
    const pulledPosition = positionFromCenter(clientX, clientY);
    let directionX = pulledPosition.x - originalPosition.x;
    let directionY = pulledPosition.y - originalPosition.y;
    const distance = Math.hypot(directionX, directionY) || 1;
    directionX /= distance;
    directionY /= distance;
    const restingPosition = {
      x: clamp(originalPosition.x - directionX * .11, .1, .9),
      y: clamp(originalPosition.y - directionY * .08, .16, .84)
    };
    state.parts.splice(index, 1, left, value - left);
    state.positions.splice(index, 1, pulledPosition, restingPosition);
    const isNew = recordDiscovery();
    setMentorText(compositionSentence());
    renderPlay({ arriveIndices: [index, index + 1] });
    sounds.speak(compositionAudioFilename());
    if (isNew) celebrateDiscovery();
  }, state.gentleMotion ? 10 : 180);
}

function joinSelectedParts(firstIndex, secondIndex) {
  if (firstIndex === secondIndex) return;
  const combinedValue = state.parts[firstIndex] + state.parts[secondIndex];
  pushHistory();
  const combinedIndex = Math.min(firstIndex, secondIndex);
  const removedIndex = Math.max(firstIndex, secondIndex);
  const landingPosition = { ...state.positions[secondIndex] };
  state.parts[combinedIndex] = combinedValue;
  state.parts.splice(removedIndex, 1);
  state.positions[combinedIndex] = landingPosition;
  state.positions.splice(removedIndex, 1);
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

function hopPart(button) {
  sounds.effect('bounce');
  button.classList.remove('part-hop');
  requestAnimationFrame(() => button.classList.add('part-hop'));
  setTimeout(() => button.classList.remove('part-hop'), 560);
}

function jugglePart(button, velocityX, velocityY) {
  sounds.effect('bounce');
  button.classList.add('juggling');
  const host = button.querySelector('.part-character');
  if (!host || state.gentleMotion) {
    button.classList.remove('juggling');
    return;
  }
  const sideways = clamp(velocityX * 62, -58, 58);
  const lift = clamp(velocityY * 145, -122, -68);
  host.animate([
    { transform: 'translate3d(0, 0, 0) rotate(0)' },
    { transform: `translate3d(${sideways * .55}px, ${lift}px, 0) rotate(${sideways * .18}deg)`, offset: .42 },
    { transform: `translate3d(${sideways}px, 0, 0) rotate(${-sideways * .08}deg)`, offset: .72 },
    { transform: `translate3d(${sideways * .72}px, -18px, 0) rotate(${sideways * .04}deg)`, offset: .84 },
    { transform: 'translate3d(0, 0, 0) rotate(0)' }
  ], { duration: 880, easing: 'cubic-bezier(.2,.72,.3,1)' }).finished.finally(() => {
    button.classList.remove('juggling');
  });
}

function renderGestureCoach() {
  const coach = makeElement('div', 'gesture-coach');
  coach.setAttribute('aria-hidden', 'true');
  const ghost = makeElement('span', 'coach-ghost');
  const coachChunk = Math.min(2, state.target - 1);
  for (let index = 0; index < Math.min(state.target, 5); index += 1) {
    const cube = makeElement('i');
    if (index < coachChunk) cube.classList.add('coach-pulled');
    ghost.appendChild(cube);
  }
  const hand = makeElement('span', 'coach-hand', '☝');
  const result = makeElement('span', 'coach-result', `${coachChunk} + ${state.target - coachChunk}`);
  coach.append(ghost, hand, result);
  elements.partsStage.appendChild(coach);
}

function dismissGestureCoach() {
  if (!state.coachVisible) return;
  state.coachVisible = false;
  elements.partsStage.querySelector('.gesture-coach')?.classList.add('coach-leave');
}

function undo() {
  const previous = state.history.pop();
  if (!previous) return;
  state.parts = previous.parts;
  state.positions = previous.positions;
  sounds.effect('back');
  setMentorText(state.parts.length === 1 ? `Here is ${numberName(state.target)} again.` : compositionSentence());
  renderPlay();
}

function startNewWay() {
  if (state.parts.length > 1) pushHistory();
  state.parts = [state.target];
  state.positions = defaultPositions(1);
  state.coachVisible = true;
  sounds.effect('slide');
  setMentorText('Try a new way: pull a different block group away!');
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
  elements.undoButton.addEventListener('click', undo);
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
