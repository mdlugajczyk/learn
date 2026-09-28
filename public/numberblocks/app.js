import {
  GAME_VERSION,
  NUMBER_WORDS,
  commitResolution,
  createDefaultProfile,
  createPlaygroundPlan,
  createSessionPlan,
  createToyState,
  easierReplacement,
  factFamily,
  returnOneToy,
  sendNextToy,
  toyCounts,
  toyStateIsValid,
  undoToyMove,
  validateShare
} from './game-model.js';

const STORAGE_KEY = 'tens-playground-v3';
const WELCOME_KEY = 'tens-playground-welcomed-v1';
const COLORS = ['#ef5362', '#f28d3a', '#f0c93e', '#48b96a', '#2c9fdb', '#7163c7', '#e861a5', '#78919f', '#35aaa0', '#ffffff'];
const TOY_ICONS = { teddies: '🧸', cars: '🚗', ducks: '🦆' };
const PLAYGROUND_ASSETS = {
  slide: { src: 'art/playground/slide.webp', label: 'slide' },
  swing: { src: 'art/playground/swing.webp', label: 'swing' },
  seesaw: { src: 'art/playground/seesaw.webp', label: 'seesaw' },
  tunnel: { src: 'art/playground/tunnel.webp', label: 'rainbow tunnel' },
  sandbox: { src: 'art/playground/sandbox.webp', label: 'sandbox' },
  'climbing-dome': { src: 'art/playground/climbing-dome.webp', label: 'climbing dome' },
  'merry-go-round': { src: 'art/playground/merry-go-round.webp', label: 'merry-go-round' },
  'spring-rider': { src: 'art/playground/spring-rider.webp', label: 'spring rider' },
  trampoline: { src: 'art/playground/trampoline.webp', label: 'trampoline' },
  playhouse: { src: 'art/playground/playhouse.webp', label: 'playhouse' },
  'stepping-pods': { src: 'art/playground/stepping-pods.webp', label: 'stepping pods' },
  'water-table': { src: 'art/playground/water-table.webp', label: 'water table' }
};
const LEGACY_EQUIPMENT = { ground: 'sandbox', flag: 'spring-rider', flowers: 'stepping-pods', kite: 'trampoline' };

const COPY = {
  en: {
    welcome: "Hi! Let's build a playground together!",
    joinAsk: task => `${cap(task.a)} and ${NUMBER_WORDS[task.b]}. How many altogether?`,
    joinResult: task => `${cap(task.a)} and ${NUMBER_WORDS[task.b]} make ${NUMBER_WORDS[task.sum]}!`,
    joinLook: "Let's look at the blocks.",
    joinCount: "Let's count together.",
    joinTap: task => `${cap(task.sum)} blocks altogether. Tap ${NUMBER_WORDS[task.sum]}.`,
    shareTarget: task => `${cap(task.total)} toys. Give your sister ${NUMBER_WORDS[task.target.count]}. The rest are for you.`,
    shareFree: task => `Share these ${NUMBER_WORDS[task.total]} toys between both baskets.`,
    shareEqual: task => `${cap(task.total)} toys. Give each of you the same number. Use all the toys.`,
    shareRemainder: task => `${cap(task.total)} whole toys. Give each of you the same number. Leave the extra toy on the tray.`,
    shareParts: counts => `${cap(counts.left)} and ${NUMBER_WORDS[counts.right]}. ${cap(counts.left + counts.right)} altogether.`,
    shareEqualResult: counts => `${cap(counts.left)} each. The same number!`,
    shareRemainderResult: counts => `${cap(counts.left)} each, and one left over.`,
    useAll: 'Use all the toys.',
    bothGroups: 'Put at least one toy in each basket.',
    target: task => `Your sister needs ${NUMBER_WORDS[task.target.count]}. Let's count hers.`,
    unmatched: "These don't have a partner. Can you make the groups the same?",
    morePairs: 'There are enough for one more each.',
    putBack: 'One basket has more. Put one back.',
    next: 'Next playground job!',
    finale: 'We built it! All done, or play again?'
  },
  pl: {
    welcome: 'Cześć! Zbudujmy razem plac zabaw!',
    joinAsk: task => `${capPl(task.a)} i ${plWord(task.b)}. Ile jest razem?`,
    joinResult: task => `${capPl(task.a)} i ${plWord(task.b)} to razem ${plWord(task.sum)}!`,
    joinLook: 'Spójrzmy na klocki.',
    joinCount: 'Policzmy razem.',
    joinTap: task => `Razem jest ${plWord(task.sum)} klocków. Dotknij ${plWord(task.sum)}.`,
    shareTarget: task => `Jest ${plWord(task.total)} zabawek. Daj siostrze ${plWord(task.target.count)}. Reszta jest dla ciebie.`,
    shareFree: task => `Rozdziel ${plWord(task.total)} zabawek do dwóch koszyków.`,
    shareEqual: task => `${capPl(task.total)} zabawki. Daj każdemu tyle samo. Użyj wszystkich zabawek.`,
    shareRemainder: task => `${capPl(task.total)} zabawek. Daj każdemu tyle samo. Zostaw dodatkową zabawkę na tacy.`,
    shareParts: counts => `${capPl(counts.left)} i ${plWord(counts.right)}. Razem ${plWord(counts.left + counts.right)}.`,
    shareEqualResult: counts => `Każdy ma ${plWord(counts.left)}. Tyle samo!`,
    shareRemainderResult: counts => `Każdy ma ${plWord(counts.left)}, a jedna została.`,
    useAll: 'Użyj wszystkich zabawek.',
    bothGroups: 'Włóż co najmniej jedną zabawkę do każdego koszyka.',
    target: task => `Siostra potrzebuje ${plWord(task.target.count)}. Policzmy jej zabawki.`,
    unmatched: 'Te zabawki nie mają pary. Czy grupy mogą być takie same?',
    morePairs: 'Wystarczy zabawek, żeby dać każdemu jeszcze jedną.',
    putBack: 'W jednym koszyku jest więcej. Odłóż jedną zabawkę.',
    next: 'Następne zadanie!',
    finale: 'Zbudowaliśmy plac zabaw! Koniec czy gramy jeszcze raz?'
  }
};

const UI_COPY = {
  en: {
    homeTitle: 'What shall we play?', adventure: 'Adventure', adventureHint: 'Build a playground',
    join: 'Bump Together', joinHint: 'How many altogether?', share: 'Share the Toys', shareHint: 'One toy at a time',
    playgrounds: 'My playgrounds', play: 'Play', you: 'You', sister: 'Sister', help: 'Help', check: 'Check ✓',
    titles: { adventure: 'ADVENTURE', join: 'BUMP TOGETHER', share: 'SHARE THE TOYS' }
  },
  pl: {
    homeTitle: 'W co się pobawimy?', adventure: 'Przygoda', adventureHint: 'Zbuduj plac zabaw',
    join: 'Połącz razem', joinHint: 'Ile jest razem?', share: 'Podziel zabawki', shareHint: 'Po jednej zabawce',
    playgrounds: 'Moje place zabaw', play: 'Graj', you: 'Ty', sister: 'Siostra', help: 'Pomoc', check: 'Sprawdź ✓',
    titles: { adventure: 'PRZYGODA', join: 'POŁĄCZ RAZEM', share: 'PODZIEL ZABAWKI' }
  }
};

const PL_WORDS = ['zero', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć', 'dziesięć'];
const elements = {};
let profile = loadProfile();
let session = null;
let toastTimer = null;
let parentHoldTimer = null;
let helpPulseTimer = null;
let idleTimer = null;

const state = {
  phase: 'home',
  token: 0,
  taskState: null,
  prompt: { text: '', file: null },
  paused: false,
  audioFailed: false
};

function cap(number) {
  const word = NUMBER_WORDS[number] || String(number);
  return word.charAt(0).toUpperCase() + word.slice(1);
}
function plWord(number) { return PL_WORDS[number] || String(number); }
function capPl(number) { const word = plWord(number); return word.charAt(0).toUpperCase() + word.slice(1); }
function copy() { return COPY[profile.settings.locale] || COPY.en; }
function ui() { return UI_COPY[profile.settings.locale] || UI_COPY.en; }
function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function normalizePlayground(playground = {}, count = 6) {
  const base = createPlaygroundPlan(playground.seed || playground.id || Date.now(), count);
  const storedItems = Array.isArray(playground.items) ? playground.items
    : Array.isArray(playground.built) && playground.built.every(item => typeof item === 'object') ? playground.built
      : null;
  if (storedItems?.length) return { ...base, ...playground, items: storedItems.slice(0, count) };
  const legacyKinds = Array.isArray(playground.built)
    ? playground.built.map(kind => LEGACY_EQUIPMENT[kind] || kind).filter(kind => PLAYGROUND_ASSETS[kind])
    : [];
  return {
    ...base,
    ...playground,
    items: base.items.slice(0, Math.max(legacyKinds.length, count)).map((item, index) => ({
      ...item,
      kind: legacyKinds[index] || item.kind,
      id: `${legacyKinds[index] || item.kind}-${index + 1}`
    }))
  };
}

function equipmentImage(item, className = '') {
  const asset = PLAYGROUND_ASSETS[item.kind] || PLAYGROUND_ASSETS.slide;
  const image = make('img', className);
  image.src = asset.src;
  image.alt = '';
  image.draggable = false;
  image.style.setProperty('--equipment-hue', `${Number(item.hue) || 0}deg`);
  return image;
}

function playWithEquipment(button, item) {
  const image = button.querySelector('img');
  if (!image) return;
  const gentle = useReducedMotion();
  const motions = {
    swing: [{ transform: 'rotate(0)' }, { transform: 'rotate(-7deg)' }, { transform: 'rotate(7deg)' }, { transform: 'rotate(0)' }],
    seesaw: [{ transform: 'rotate(0)' }, { transform: 'rotate(-6deg)' }, { transform: 'rotate(6deg)' }, { transform: 'rotate(0)' }],
    'merry-go-round': [{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }],
    'spring-rider': [{ transform: 'rotate(0)' }, { transform: 'rotate(-8deg) translateY(-5px)' }, { transform: 'rotate(7deg)' }, { transform: 'rotate(0)' }],
    trampoline: [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(8px) scale(1.05,.9)' }, { transform: 'translateY(-16px) scale(.98,1.08)' }, { transform: 'translateY(0) scale(1)' }],
    slide: [{ transform: 'translateY(0)' }, { transform: 'translateY(-9px) rotate(-2deg)' }, { transform: 'translateY(0)' }],
    tunnel: [{ transform: 'scale(1)' }, { transform: 'scale(1.09)' }, { transform: 'scale(1)' }],
    'water-table': [{ transform: 'rotate(0)' }, { transform: 'rotate(-3deg)' }, { transform: 'rotate(3deg)' }, { transform: 'rotate(0)' }]
  };
  const keyframes = gentle
    ? [{ opacity: 1 }, { opacity: 0.72 }, { opacity: 1 }]
    : motions[item.kind] || [{ transform: 'translateY(0)' }, { transform: 'translateY(-15px) rotate(4deg)' }, { transform: 'translateY(0)' }];
  image.getAnimations().forEach(animation => animation.cancel());
  image.animate(keyframes, { duration: item.kind === 'merry-go-round' ? 850 : 620, easing: 'cubic-bezier(.25,.75,.25,1)' });
  audio.effect(item.kind === 'water-table' ? 'boop' : 'hop');
}

function renderPlayground(container, playgroundValue, { interactive = true, limit } = {}) {
  const playground = normalizePlayground(playgroundValue, limit || playgroundValue?.items?.length || 6);
  container.replaceChildren();
  const items = Number.isInteger(limit) ? playground.items.slice(0, limit) : playground.items;
  items.forEach((item, index) => {
    const node = make(interactive ? 'button' : 'span', 'playground-equipment');
    if (interactive) {
      node.type = 'button';
      node.setAttribute('aria-label', `Play with the ${PLAYGROUND_ASSETS[item.kind]?.label || 'playground toy'}`);
      node.addEventListener('click', () => playWithEquipment(node, item));
    } else {
      node.setAttribute('aria-hidden', 'true');
    }
    node.style.setProperty('--equipment-x', `${item.x}%`);
    node.style.setProperty('--equipment-y', `${item.y}%`);
    node.style.setProperty('--equipment-width', `${item.width || 25}%`);
    node.style.setProperty('--equipment-rotation', `${item.rotation || 0}deg`);
    node.style.setProperty('--equipment-delay', `${index * 70}ms`);
    node.style.zIndex = String(item.z || Math.round(item.y));
    node.appendChild(equipmentImage(item));
    container.appendChild(node);
  });
  return playground;
}

function delay(milliseconds, token = state.token) {
  return new Promise(resolve => setTimeout(() => resolve(token === state.token && !state.paused), milliseconds));
}

class AudioDirector {
  constructor() {
    this.voice = new Audio();
    this.voice.preload = 'auto';
    this.context = null;
    this.token = 0;
    this.voice.addEventListener('error', () => {
      if (!this.voice.src) return;
      state.audioFailed = true;
      elements.audioRetryButton.hidden = false;
    });
  }
  unlock() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass && !this.context) this.context = new AudioContextClass();
    if (this.context?.state === 'suspended') this.context.resume().catch(() => {});
    this.effect('tap');
  }
  stop() {
    this.token += 1;
    this.voice.pause();
    this.voice.removeAttribute('src');
  }
  speak(file) {
    this.stop();
    elements.audioRetryButton.hidden = true;
    state.audioFailed = false;
    if (!file || profile.settings.narrationVolume <= 0) return;
    const token = this.token;
    this.voice.volume = profile.settings.narrationVolume;
    this.voice.src = `audio/${file}`;
    this.voice.currentTime = 0;
    this.voice.play().catch(() => {
      if (token !== this.token) return;
      state.audioFailed = true;
      elements.audioRetryButton.hidden = false;
    });
  }
  effect(kind) {
    if (!this.context || profile.settings.effectsVolume <= 0) return;
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    const patterns = {
      tap: [[430, 570, .055]],
      hop: [[330, 520, .09]],
      boop: [[420, 680, .12]],
      build: [[392, 650, .14], [520, 830, .2]],
      undo: [[500, 350, .09]]
    };
    const now = this.context.currentTime;
    const duck = this.voice.paused ? 1 : 0.32;
    (patterns[kind] || patterns.tap).forEach(([from, to, duration], index) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(from, now + index * .07);
      oscillator.frequency.exponentialRampToValueAtTime(to, now + index * .07 + duration);
      gain.gain.setValueAtTime(.0001, now + index * .07);
      gain.gain.exponentialRampToValueAtTime(.045 * profile.settings.effectsVolume * duck, now + index * .07 + .018);
      gain.gain.exponentialRampToValueAtTime(.0001, now + index * .07 + duration);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(now + index * .07);
      oscillator.stop(now + index * .07 + duration + .03);
    });
  }
}

const audio = new AudioDirector();

function loadProfile() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (Number(stored.version || 0) > GAME_VERSION) return createDefaultProfile({ settings: stored.settings });
    const loaded = createDefaultProfile(stored);
    if (loaded.checkpoint && !checkpointIsValid(loaded.checkpoint)) loaded.checkpoint = null;
    return loaded;
  } catch {
    return createDefaultProfile();
  }
}

function checkpointIsValid(checkpoint) {
  const savedSession = checkpoint?.session;
  if (!savedSession || !Array.isArray(savedSession.tasks) || !savedSession.tasks.length) return false;
  if (!Number.isInteger(savedSession.index) || savedSession.index < 0 || savedSession.index >= savedSession.tasks.length) return false;
  if (!Number.isInteger(savedSession.completed) || savedSession.completed < 0 || savedSession.completed > savedSession.tasks.length) return false;
  if (!Array.isArray(savedSession.built) || savedSession.built.length !== savedSession.completed) return false;
  const task = savedSession.tasks[savedSession.index];
  if (!task || !['join', 'share'].includes(task.kind) || !checkpoint.taskState) return false;
  if (task.kind === 'share' && (!toyStateIsValid(checkpoint.taskState.toys) || checkpoint.taskState.toys.total !== task.total)) return false;
  return ['question', 'evaluating', 'help', 'resolving', 'playground-update'].includes(checkpoint.phase);
}

function saveProfile() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch { showToast('Progress may not stay on this device.'); }
}

function cacheElements() {
  [
    'app', 'homeScreen', 'gameScreen', 'offlineStatus', 'parentHoldButton', 'homeTen', 'homeTitle', 'adventureButton',
    'adventureLabel', 'adventureHint', 'joinLabel', 'joinHint', 'shareLabel', 'shareHint', 'playgroundsLabel', 'firstPlayLabel',
    'joinButton', 'shareButton', 'playgroundsButton', 'playgroundCount', 'gameTitle', 'jobProgress',
    'playgroundStrip', 'playTen', 'promptText', 'audioRetryButton', 'taskStage', 'taskControls',
    'resultAnnouncement', 'leaveButton', 'replayButton', 'firstVisitOverlay', 'welcomeTen', 'firstPlayButton',
    'helpOverlay', 'showHelpButton', 'resetTaskButton', 'skipTaskButton', 'cosmeticOverlay', 'choiceTen',
    'cosmeticChoices', 'finaleOverlay', 'finalePlayground', 'finaleTen', 'finaleTitle', 'allDoneButton', 'anotherButton',
    'playgroundsOverlay', 'savedPlaygrounds', 'parentOverlay', 'learningSummary', 'rangeButtons',
    'lengthButtons', 'autoAdvanceToggle', 'remaindersToggle', 'narrationVolume', 'effectsVolume',
    'reducedMotionToggle', 'resetProgressButton', 'resumeOverlay', 'resumeButton', 'toast'
  ].forEach(id => { elements[id] = document.getElementById(id); });
}

function layoutColumns(number) {
  if (number === 10) return 5;
  if (number >= 8) return 4;
  if (number >= 4) return 2;
  return 1;
}

function createNumberFriend(number, { prefix = 'unit', color = COLORS[number - 1], slots = false } = {}) {
  const cols = layoutColumns(number);
  const friend = make('div', `number-friend number-${number}`);
  friend.style.setProperty('--cols', cols);
  friend.style.setProperty('--rows', Math.ceil(number / cols));
  friend.style.setProperty('--unit-color', color);
  const numeral = make('span', 'friend-number', number);
  const body = make('div', 'friend-body');
  const grid = make('div', 'friend-grid');
  for (let index = 0; index < number; index += 1) {
    const unit = make('span', slots ? 'result-slot' : 'quantity-unit');
    if (!slots) unit.dataset.unitId = `${prefix}-${index + 1}`;
    grid.appendChild(unit);
  }
  const face = make('span', 'friend-face');
  face.append(make('i'), make('i'));
  body.append(grid, face, make('span', 'friend-arms'));
  friend.append(numeral, body);
  return friend;
}

function createToyQuantity(number, { prefix = 'toy-unit', slots = false } = {}) {
  const cols = layoutColumns(number);
  const friend = make('div', 'number-friend toy-quantity-friend');
  friend.style.setProperty('--cols', cols);
  friend.style.setProperty('--rows', Math.ceil(number / cols));
  const numeral = make('span', 'friend-number', number);
  const body = make('div', 'friend-body');
  const grid = make('div', 'friend-grid');
  for (let index = 0; index < number; index += 1) {
    const unit = make('span', slots ? 'result-slot' : 'quantity-unit join-toy-unit', slots ? undefined : '🧸');
    if (!slots) unit.dataset.unitId = `${prefix}-${index + 1}`;
    grid.appendChild(unit);
  }
  body.appendChild(grid);
  friend.append(numeral, body);
  return friend;
}

function renderTens() {
  ['homeTen', 'welcomeTen', 'playTen', 'choiceTen', 'finaleTen'].forEach(id => {
    elements[id].replaceChildren(createNumberFriend(10, { prefix: `${id}-ten`, color: COLORS[9] }));
  });
}

function showPrompt(text, file = null, speak = true) {
  state.prompt = { text, file };
  elements.promptText.textContent = text;
  if (speak) audio.speak(file);
}

function joinAudio(task, kind) {
  return v1Audio(`join-${kind}-${task.a}-${task.b}`);
}

function v1Audio(id) {
  return profile.settings.locale === 'en' ? `v1-${id}-en.mp3` : `v1-${id}-pl.mp3`;
}

function taskPrompt(task) {
  if (task.kind === 'join') return { text: copy().joinAsk(task), file: joinAudio(task, 'ask') };
  if (task.goal === 'targetRecipient') return { text: copy().shareTarget(task), file: v1Audio(`share-target-${task.total}-${task.target.recipient}-${task.target.count}`) };
  if (task.goal === 'freeGroups') return { text: copy().shareFree(task), file: v1Audio(`share-free-${task.total}`) };
  if (task.goal === 'equalAll') return { text: copy().shareEqual(task), file: v1Audio(`share-equal-${task.total}`) };
  return { text: copy().shareRemainder(task), file: v1Audio(`share-remainder-${task.total}`) };
}

function currentTask() { return session?.tasks[session.index]; }

function createTaskState(task) {
  return task.kind === 'join' ? {
    wrongSubmissions: 0,
    firstAttemptCorrect: null,
    assistance: task.teachingDemo ? ['demo'] : [],
    disabledAnswers: [],
    guided: false,
    modelAnswer: false,
    resolutionId: null
  } : {
    toys: createToyState(task.total),
    wrongSubmissions: 0,
    firstAttemptCorrect: null,
    assistance: task.teachingDemo ? ['demo'] : [],
    transferLocked: false,
    transferId: 0,
    lastMoved: null,
    feedback: null,
    resolutionId: null
  };
}

function startSession(mode) {
  audio.unlock();
  const seed = Date.now();
  const tasks = createSessionPlan(mode, profile, seed);
  session = {
    id: `session-${seed}`,
    seed,
    mode,
    tasks,
    playground: createPlaygroundPlan(seed, tasks.length),
    index: 0,
    completed: 0,
    built: [],
    cosmetics: {},
    startedAt: Date.now()
  };
  state.phase = 'question';
  state.taskState = createTaskState(currentTask());
  state.token += 1;
  elements.homeScreen.hidden = true;
  elements.gameScreen.hidden = false;
  renderGameShell();
  renderTask();
  saveCheckpoint();
}

function renderGameShell() {
  if (!session) return;
  elements.gameTitle.textContent = ui().titles[session.mode];
  elements.jobProgress.replaceChildren();
  for (let index = 0; index < session.tasks.length; index += 1) elements.jobProgress.appendChild(make('i', index < session.completed ? 'done' : ''));
  elements.playgroundStrip.replaceChildren();
  for (let index = 0; index < session.tasks.length; index += 1) {
    const item = session.playground.items[index];
    const piece = make('span', `playground-piece${index < session.built.length ? ' built' : ''}`);
    piece.appendChild(equipmentImage(item));
    elements.playgroundStrip.appendChild(piece);
  }
}

function clearTaskTimers() {
  clearTimeout(helpPulseTimer);
  clearTimeout(idleTimer);
}

function armInactivity() {
  clearTaskTimers();
  helpPulseTimer = setTimeout(() => elements.taskControls.querySelector('.help-button')?.classList.add('pulse'), 10000);
  idleTimer = setTimeout(() => elements.taskStage.classList.add('quiet-idle'), 30000);
}

function renderTask({ speak = true } = {}) {
  const task = currentTask();
  if (!task) return;
  clearTaskTimers();
  elements.taskStage.className = `task-stage task-${task.kind}`;
  elements.taskStage.replaceChildren();
  elements.taskControls.replaceChildren();
  if (task.kind === 'join') renderJoinTask(task);
  else renderShareTask(task);
  const prompt = taskPrompt(task);
  showPrompt(prompt.text, prompt.file, speak);
  armInactivity();
  saveCheckpoint();
}

function renderJoinTask(task) {
  const stage = make('div', 'join-stage');
  const left = make('div', 'join-group join-group-left');
  const leftQuantity = task.representation === 'toys'
    ? createToyQuantity(task.a, { prefix: `${task.id}-a` })
    : createNumberFriend(task.a, { prefix: `${task.id}-a`, color: COLORS[task.a - 1] });
  left.append(make('span', 'source-outline'), leftQuantity);
  const right = make('div', 'join-group join-group-right');
  const rightQuantity = task.representation === 'toys'
    ? createToyQuantity(task.b, { prefix: `${task.id}-b` })
    : createNumberFriend(task.b, { prefix: `${task.id}-b`, color: COLORS[task.b - 1] });
  right.append(make('span', 'source-outline'), rightQuantity);
  stage.append(left, make('span', 'join-plus', '+'), right, make('span', 'join-spark', '✦'));
  elements.taskStage.appendChild(stage);
  renderJoinControls(task);
}

function renderJoinControls(task) {
  elements.taskControls.replaceChildren();
  elements.taskControls.className = 'task-controls join-task-controls';
  const panel = make('div', 'answer-panel');
  const taskState = state.taskState;
  const options = taskState.guided
    ? [task.sum, ...task.options.filter(value => value !== task.sum && !taskState.disabledAnswers.includes(value)).slice(0, 1)]
    : task.options;
  options.forEach(value => {
    const button = make('button', `answer-card${taskState.disabledAnswers.includes(value) ? ' wrong' : ''}${taskState.modelAnswer && value === task.sum ? ' guided' : ''}`);
    button.type = 'button';
    button.dataset.answer = String(value);
    button.disabled = taskState.disabledAnswers.includes(value) || state.phase !== 'question';
    button.setAttribute('aria-label', `${cap(value)} blocks`);
    button.appendChild(make('span', 'answer-numeral', value));
    if (task.answerSupport !== 'numeralOnly') button.appendChild(quantityFrame(value));
    else button.classList.add('numeral-only');
    button.addEventListener('click', () => chooseJoinAnswer(value, button));
    panel.appendChild(button);
  });
  if (options.length === 2) panel.classList.add('two-choices');
  const actionRow = make('div', 'task-action-row');
  const repeat = make('button', 'round-action', '🔊');
  repeat.type = 'button'; repeat.setAttribute('aria-label', 'Hear the question again'); repeat.addEventListener('click', replayPrompt);
  const help = make('button', 'help-button', `☝ ${ui().help}`);
  help.type = 'button'; help.addEventListener('click', openHelp);
  const menu = make('button', 'round-action', '•••');
  menu.type = 'button'; menu.setAttribute('aria-label', 'More choices'); menu.addEventListener('click', openHelp);
  actionRow.append(repeat, help, menu);
  elements.taskControls.append(panel, actionRow);
}

function quantityFrame(value) {
  const frame = make('span', 'quantity-frame');
  const totalCells = value <= 5 ? 5 : 10;
  frame.style.setProperty('--frame-cols', 5);
  frame.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < totalCells; index += 1) frame.appendChild(make('i', index < value ? 'filled' : ''));
  return frame;
}

function lockAnswerButtons() {
  elements.taskControls.querySelectorAll('.answer-card').forEach(button => { button.disabled = true; });
}

function chooseJoinAnswer(value, button) {
  if (state.phase !== 'question') return;
  state.phase = 'evaluating';
  audio.unlock();
  audio.stop();
  clearTaskTimers();
  lockAnswerButtons();
  const task = currentTask();
  const taskState = state.taskState;
  button.classList.add('selected');
  if (value === task.sum) {
    if (taskState.firstAttemptCorrect === null) taskState.firstAttemptCorrect = true;
    taskState.resolutionId ||= `${session.id}-${task.id}-${crypto.randomUUID?.() || Date.now()}`;
    state.phase = 'resolving';
    saveCheckpoint();
    animateJoin(task, button);
    return;
  }
  if (taskState.firstAttemptCorrect === null) taskState.firstAttemptCorrect = false;
  taskState.wrongSubmissions += 1;
  taskState.disabledAnswers.push(value);
  button.classList.add('wrong');
  showPrompt(copy().joinLook, v1Audio('join-look'));
  if (taskState.guided) taskState.modelAnswer = true;
  state.phase = 'question';
  setTimeout(() => {
    if (taskState.wrongSubmissions >= 2 && !taskState.guided) startJoinHelp();
    else renderJoinControls(task);
  }, 500);
}

async function animateJoin(task) {
  const token = ++state.token;
  const stage = elements.taskStage.querySelector('.join-stage');
  if (!await delay(150, token)) return;
  if (useReducedMotion()) {
    await formJoinResult(task, stage, token, true);
    return;
  }
  stage.classList.add('anticipate');
  if (!await delay(250, token)) return;
  stage.classList.remove('anticipate'); stage.classList.add('approach');
  if (!await delay(350, token)) return;
  stage.classList.add('contact'); audio.effect('boop');
  if (!await delay(150, token)) return;
  await formJoinResult(task, stage, token, false);
}

async function formJoinResult(task, stage, token, reduced) {
  const units = [...stage.querySelectorAll('.quantity-unit')];
  const formation = make('div', 'result-formation forming');
  const resultFriend = task.representation === 'toys'
    ? createToyQuantity(task.sum, { slots: true })
    : createNumberFriend(task.sum, { slots: true, color: COLORS[task.sum - 1] });
  formation.appendChild(resultFriend);
  elements.taskStage.appendChild(formation);
  const slots = [...formation.querySelectorAll('.result-slot')];
  if (!reduced) {
    stage.classList.add('reorganizing');
    units.forEach((unit, index) => {
      const from = unit.getBoundingClientRect();
      const to = slots[index].getBoundingClientRect();
      unit.style.setProperty('--move-x', `${to.left + to.width / 2 - (from.left + from.width / 2)}px`);
      unit.style.setProperty('--move-y', `${to.top + to.height / 2 - (from.top + from.height / 2)}px`);
    });
    requestAnimationFrame(() => units.forEach(unit => unit.classList.add('unit-moving')));
    if (!await delay(650, token)) return;
  } else if (!await delay(200, token)) return;
  units.forEach((unit, index) => {
    unit.classList.remove('unit-moving');
    unit.style.removeProperty('--move-x'); unit.style.removeProperty('--move-y');
    slots[index].appendChild(unit);
  });
  stage.classList.add('finished');
  formation.classList.add('revealed');
  const equation = make('div', 'join-equation visible');
  equation.append(make('span', '', task.a), make('b', '', '+'), make('span', '', task.b), make('b', '', '='), make('span', '', task.sum));
  elements.taskStage.appendChild(equation);
  showPrompt(copy().joinResult(task), joinAudio(task, 'result'));
  elements.resultAnnouncement.textContent = copy().joinResult(task);
  if (!await delay(reduced ? 250 : 700, token)) return;
  finishCurrentTask();
}

async function startJoinHelp() {
  const task = currentTask();
  const taskState = state.taskState;
  taskState.guided = true;
  if (!taskState.assistance.includes('count')) taskState.assistance.push('count');
  state.phase = 'help';
  renderTask({ speak: false });
  const token = ++state.token;
  const units = [...elements.taskStage.querySelectorAll('.quantity-unit')];
  elements.taskStage.classList.add('counting');
  showPrompt(copy().joinCount, v1Audio('join-count'));
  for (let index = 0; index < units.length; index += 1) {
    units.forEach(unit => unit.classList.remove('count-highlight'));
    units[index].classList.add('count-highlight');
    audio.speak(v1Audio(`count-${index + 1}`));
    if (!await delay(620, token)) return;
  }
  units.forEach(unit => unit.classList.remove('count-highlight'));
  state.phase = 'question';
  renderJoinControls(task);
  showPrompt(copy().joinTap(task), v1Audio(`join-tap-${task.sum}`));
  saveCheckpoint();
}

function renderShareTask(task) {
  const taskState = state.taskState;
  const counts = toyCounts(taskState.toys);
  const stage = make('div', 'share-stage');
  const tray = make('div', 'toy-tray');
  tray.appendChild(make('span', 'tray-label', counts.tray));
  taskState.toys.toys.filter(toy => toy.location === 'tray').forEach(toy => tray.appendChild(toyNode(toy, task)));
  const baskets = make('div', 'basket-row');
  baskets.append(basketNode('left', ui().you, '🧒', task), basketNode('right', ui().sister, '👧', task));
  stage.append(tray, baskets);
  elements.taskStage.appendChild(stage);
  renderShareControls(task);
}

function toyNode(toy, task) {
  const node = make('span', `toy${state.taskState.lastMoved === toy.id ? ' toy-hop' : ''}`, TOY_ICONS[task.toySet] || '🧸');
  node.dataset.toyId = toy.id;
  node.setAttribute('aria-hidden', 'true');
  return node;
}

function basketNode(recipient, label, portraitIcon, task) {
  const wrapper = make('div', `basket-wrap basket-wrap-${recipient}`);
  const button = make('button', `basket${state.taskState.feedback === recipient ? ' needs-help' : ''}`);
  button.type = 'button';
  button.dataset.recipient = recipient;
  button.disabled = state.taskState.transferLocked || state.phase !== 'question';
  button.setAttribute('aria-label', `Send the next toy to ${label}. ${toyCounts(state.taskState.toys)[recipient]} toys here.`);
  const recipientLabel = make('span', 'recipient');
  recipientLabel.append(make('span', 'portrait', portraitIcon), make('span', '', label));
  const contents = make('span', 'basket-toys');
  state.taskState.toys.toys.filter(toy => toy.location === recipient).forEach(toy => contents.appendChild(toyNode(toy, task)));
  button.append(recipientLabel, contents, make('span', 'basket-count', toyCounts(state.taskState.toys)[recipient]));
  button.addEventListener('click', () => sendToy(recipient));
  const returnButton = make('button', 'return-one', '↩');
  returnButton.type = 'button';
  returnButton.disabled = state.taskState.transferLocked || toyCounts(state.taskState.toys)[recipient] === 0 || state.phase !== 'question';
  returnButton.setAttribute('aria-label', `Return one toy from ${label}'s basket`);
  returnButton.addEventListener('click', () => returnToy(recipient));
  wrapper.append(button, returnButton);
  return wrapper;
}

function renderShareControls(task) {
  elements.taskControls.className = 'task-controls share-task-controls';
  const controls = make('div', 'share-controls');
  controls.appendChild(shareGoalVisual(task));
  const row = make('div', 'share-action-row');
  const undo = make('button', 'round-action', '↶');
  undo.type = 'button'; undo.disabled = !state.taskState.toys.history.length || state.phase !== 'question';
  undo.setAttribute('aria-label', 'Undo the last toy'); undo.addEventListener('click', undoToy);
  const check = make('button', 'check-button', ui().check);
  check.type = 'button'; check.disabled = !shareCanCheck(task) || state.phase !== 'question';
  check.addEventListener('click', checkShare);
  const help = make('button', 'help-button', '☝');
  help.type = 'button'; help.setAttribute('aria-label', 'Help'); help.addEventListener('click', openHelp);
  row.append(undo, check, help);
  controls.appendChild(row);
  elements.taskControls.appendChild(controls);
}

function shareGoalVisual(task) {
  const visual = make('div', 'share-prompt-visual');
  if (task.goal === 'targetRecipient') {
    const total = make('span', 'goal-card'); total.append(make('b', '', task.total), make('span', '', 'toys'));
    const target = make('span', 'goal-card'); target.append(make('b', '', `👧 ${task.target.count}`), make('span', '', 'Sister'));
    visual.append(total, make('span', 'goal-symbol', '→'), target);
  } else if (task.goal === 'freeGroups') visual.append(make('span', 'goal-card', '🧺'), make('span', 'goal-symbol', '+'), make('span', 'goal-card', '🧺'));
  else {
    visual.append(make('span', 'goal-card', '🧺'), make('span', 'goal-symbol', '='), make('span', 'goal-card', '🧺'));
    if (task.goal === 'equalRemainder') visual.append(make('span', 'goal-symbol', '+'), make('span', 'goal-card', '🧸'));
  }
  return visual;
}

function shareCanCheck(task) {
  const counts = toyCounts(state.taskState.toys);
  return task.goal === 'equalRemainder' || counts.tray === 0;
}

function sendToy(recipient) {
  if (state.taskState.transferLocked || state.phase !== 'question') return;
  const before = state.taskState.toys;
  const next = sendNextToy(before, recipient);
  if (next === before) return;
  state.taskState.toys = next;
  state.taskState.lastMoved = next.history.at(-1)?.toyId;
  state.taskState.transferLocked = true;
  state.taskState.transferId = Number(state.taskState.transferId || 0) + 1;
  const transferId = state.taskState.transferId;
  const taskToken = state.token;
  state.taskState.feedback = null;
  audio.effect('hop');
  renderShareTaskOnly();
  saveCheckpoint();
  setTimeout(() => {
    if (!state.taskState || state.phase !== 'question' || state.token !== taskToken || state.taskState.transferId !== transferId) return;
    state.taskState.transferLocked = false;
    state.taskState.lastMoved = null;
    renderShareTaskOnly();
  }, useReducedMotion() ? 20 : 230);
}

function returnToy(recipient) {
  if (state.taskState.transferLocked || state.phase !== 'question') return;
  const next = returnOneToy(state.taskState.toys, recipient);
  if (next === state.taskState.toys) return;
  state.taskState.toys = next;
  audio.effect('undo');
  renderShareTaskOnly();
  saveCheckpoint();
}

function undoToy() {
  if (state.phase !== 'question') return;
  const next = undoToyMove(state.taskState.toys);
  if (next === state.taskState.toys) return;
  state.taskState.transferId = Number(state.taskState.transferId || 0) + 1;
  state.taskState.transferLocked = false;
  state.taskState.lastMoved = null;
  state.taskState.toys = next;
  audio.effect('undo');
  renderShareTaskOnly();
  saveCheckpoint();
}

function renderShareTaskOnly() {
  elements.taskStage.replaceChildren();
  elements.taskControls.replaceChildren();
  renderShareTask(currentTask());
}

function checkShare() {
  if (state.phase !== 'question') return;
  state.taskState.transferId = Number(state.taskState.transferId || 0) + 1;
  state.taskState.transferLocked = false;
  state.taskState.lastMoved = null;
  state.phase = 'evaluating';
  audio.stop();
  const task = currentTask();
  const result = validateShare(task, state.taskState.toys);
  if (result.success) {
    if (state.taskState.firstAttemptCorrect === null) state.taskState.firstAttemptCorrect = true;
    state.taskState.resolutionId ||= `${session.id}-${task.id}-${crypto.randomUUID?.() || Date.now()}`;
    state.phase = 'resolving';
    saveCheckpoint();
    resolveShare(task);
    return;
  }
  if (state.taskState.firstAttemptCorrect === null) state.taskState.firstAttemptCorrect = false;
  state.taskState.wrongSubmissions += 1;
  if (!state.taskState.assistance.includes('feedback')) state.taskState.assistance.push('feedback');
  state.taskState.feedback = result.recipient || (result.reason === 'put-back' ? largerBasket() : null);
  const messages = { 'use-all': copy().useAll, target: copy().target(task), unmatched: copy().unmatched, 'more-pairs': copy().morePairs, 'put-back': copy().putBack, 'both-groups': copy().bothGroups };
  const feedbackAudio = result.reason === 'target' ? v1Audio(`share-target-${task.target.count}`) : v1Audio(`share-${result.reason}`);
  showPrompt(messages[result.reason] || copy().useAll, feedbackAudio);
  state.phase = 'question';
  renderShareTaskOnly();
  saveCheckpoint();
}

function largerBasket() {
  const counts = toyCounts(state.taskState.toys);
  return counts.left > counts.right ? 'left' : 'right';
}

async function resolveShare(task) {
  const token = ++state.token;
  renderShareTaskOnly();
  const counts = toyCounts(state.taskState.toys);
  if (task.goal === 'equalAll' || task.goal === 'equalRemainder') {
    elements.taskStage.querySelectorAll('.basket-toys').forEach(node => node.classList.add('pair-line'));
    if (task.goal === 'equalRemainder') elements.taskStage.querySelector('.toy-tray .toy')?.classList.add('spare-spotlight');
  }
  const text = task.goal === 'equalAll' ? copy().shareEqualResult(counts)
    : task.goal === 'equalRemainder' ? copy().shareRemainderResult(counts)
      : copy().shareParts(counts);
  const file = task.goal === 'equalAll' ? v1Audio(`share-equal-result-${counts.left}`)
    : task.goal === 'equalRemainder' ? v1Audio(`share-remainder-result-${counts.left}`)
      : v1Audio(`share-parts-${counts.left}-${counts.right}`);
  showPrompt(text, file);
  elements.resultAnnouncement.textContent = text;
  audio.effect('build');
  if (!await delay(useReducedMotion() ? 250 : 1100, token)) return;
  finishCurrentTask();
}

function outcomeForCurrentTask() {
  const task = currentTask();
  const taskState = state.taskState;
  return {
    taskId: task.id,
    skillId: task.skillId,
    sessionId: session.id,
    family: task.kind === 'join' ? factFamily(task.a, task.b) : `${task.goal}:${task.total}`,
    completed: true,
    skipped: false,
    teachingDemo: task.teachingDemo,
    freePlay: task.goal === 'freeGroups',
    firstAttemptCorrect: taskState.firstAttemptCorrect,
    assistance: [...taskState.assistance],
    wrongSubmissions: taskState.wrongSubmissions,
    representation: task.representation || 'toys',
    answerSupport: task.answerSupport || 'construction'
  };
}

function finishCurrentTask() {
  const taskState = state.taskState;
  const result = commitResolution(profile, outcomeForCurrentTask(), taskState.resolutionId);
  profile = result.profile;
  if (result.awarded) {
    session.completed += 1;
    session.built.push({ ...session.playground.items[session.completed - 1] });
  }
  state.phase = 'playground-update';
  renderGameShell();
  renderPlaygroundUpdate();
  saveCheckpoint();
  saveProfile();
}

function renderPlaygroundUpdate() {
  const item = session.built.at(-1);
  elements.taskStage.className = 'task-stage';
  const update = make('div', 'playground-update');
  const reveal = make('span', 'new-playground-piece');
  reveal.appendChild(equipmentImage(item));
  update.append(reveal, make('strong', '', `${session.completed} of ${session.tasks.length}`));
  elements.taskStage.replaceChildren(update);
  elements.taskControls.replaceChildren();
  elements.taskControls.className = 'task-controls';
  const row = make('div', 'task-action-row');
  const replay = make('button', 'round-action', '↻');
  replay.type = 'button'; replay.setAttribute('aria-label', 'Replay the result animation'); replay.addEventListener('click', replayResult);
  const next = make('button', 'next-button');
  next.type = 'button'; next.append(make('span', '', copy().next), make('span', '', '→'));
  next.addEventListener('click', continueSession);
  row.append(replay, next);
  elements.taskControls.appendChild(row);
  audio.effect('build');
}

function replayResult() {
  const task = currentTask();
  if (task.kind === 'join') {
    state.phase = 'question';
    const saved = state.taskState;
    elements.taskStage.replaceChildren();
    renderJoinTask(task);
    state.taskState = saved;
    state.phase = 'resolving';
    animateJoin(task);
  } else {
    renderShareTaskOnly();
    resolveShare(task);
  }
}

function continueSession() {
  if (session.completed >= session.tasks.length) {
    showFinale();
    return;
  }
  if (session.completed === 2 || session.completed === 4) {
    showCosmeticChoice(session.completed);
    return;
  }
  nextTask();
}

function nextTask() {
  session.index += 1;
  state.phase = 'question';
  state.taskState = createTaskState(currentTask());
  state.token += 1;
  renderGameShell();
  renderTask();
}

function showCosmeticChoice(slot) {
  elements.cosmeticChoices.replaceChildren();
  const choices = slot === 2
    ? [{ id: 'sunny', icon: '☀️', label: 'Sunny', color: '#ffd94f', hue: 24 }, { id: 'berry', icon: '🫐', label: 'Berry', color: '#ef5362', hue: 318 }]
    : [{ id: 'starlight', icon: '⭐', label: 'Stars', color: '#7163c7', hue: 260 }, { id: 'garden', icon: '🌈', label: 'Rainbow', color: '#43b96a', hue: 105 }];
  choices.forEach(choice => {
    const button = make('button', 'cosmetic-choice');
    button.type = 'button'; button.style.background = choice.color;
    button.append(make('b', '', choice.icon), make('span', '', choice.label));
    button.addEventListener('click', () => {
      session.cosmetics[`slot-${slot}`] = choice.id;
      session.playground.items[slot - 1].hue = choice.hue;
      session.built[slot - 1].hue = choice.hue;
      elements.cosmeticOverlay.hidden = true;
      nextTask();
    });
    elements.cosmeticChoices.appendChild(button);
  });
  elements.cosmeticOverlay.hidden = false;
}

function showFinale() {
  state.phase = 'finale';
  profile.sessionsCompleted += 1;
  const playground = {
    id: session.id,
    seed: session.seed,
    items: session.built.map(item => ({ ...item })),
    cosmetics: { ...session.cosmetics },
    completedAt: Date.now()
  };
  profile.playgrounds.push(playground);
  profile.playgrounds = profile.playgrounds.slice(-12);
  profile.checkpoint = null;
  saveProfile();
  renderPlayground(elements.finalePlayground, playground);
  elements.finaleTitle.textContent = profile.settings.locale === 'pl' ? 'Zbudowaliśmy go!' : 'We built it!';
  elements.finaleOverlay.hidden = false;
  showPrompt(copy().finale, v1Audio('session-end'));
}

function openSavedPlayground(playgroundValue) {
  state.phase = 'playground-view';
  audio.stop();
  elements.playgroundsOverlay.hidden = true;
  renderPlayground(elements.finalePlayground, playgroundValue);
  elements.finaleTitle.textContent = profile.settings.locale === 'pl' ? 'Twój plac zabaw' : 'Your playground';
  elements.finaleOverlay.hidden = false;
}

function goHome() {
  state.token += 1;
  state.phase = 'home';
  audio.stop();
  clearTaskTimers();
  session = null;
  profile.checkpoint = null;
  saveProfile();
  elements.gameScreen.hidden = true;
  elements.homeScreen.hidden = false;
  elements.finaleOverlay.hidden = true;
  updateHome();
}

function openHelp() { elements.helpOverlay.hidden = false; }
function closeOverlay(id) { elements[id].hidden = true; }

function showTaskHelp() {
  elements.helpOverlay.hidden = true;
  if (currentTask().kind === 'join') startJoinHelp();
  else demonstrateShareHelp();
}

async function demonstrateShareHelp() {
  const task = currentTask();
  if (!state.taskState.assistance.includes('demo')) state.taskState.assistance.push('demo');
  state.phase = 'help';
  state.taskState.toys = createToyState(task.total);
  renderShareTaskOnly();
  const token = ++state.token;
  const moves = task.goal === 'targetRecipient'
    ? Array(task.target.count).fill(task.target.recipient)
    : ['left', 'right'];
  for (const recipient of moves) {
    state.taskState.toys = sendNextToy(state.taskState.toys, recipient);
    state.taskState.lastMoved = state.taskState.toys.history.at(-1)?.toyId;
    renderShareTaskOnly();
    audio.effect('hop');
    if (!await delay(450, token)) return;
  }
  if (task.goal === 'equalAll' && task.total === 2) state.taskState.toys = createToyState(2);
  state.taskState.lastMoved = null;
  state.phase = 'question';
  renderShareTaskOnly();
  saveCheckpoint();
}

function resetCurrentTask() {
  closeOverlay('helpOverlay');
  state.token += 1;
  state.phase = 'question';
  state.taskState = createTaskState(currentTask());
  renderTask();
}

function skipToEasier() {
  closeOverlay('helpOverlay');
  session.tasks[session.index] = easierReplacement(currentTask(), profile, Date.now());
  state.token += 1;
  state.phase = 'question';
  state.taskState = createTaskState(currentTask());
  renderTask();
}

function saveCheckpoint() {
  if (!session || state.phase === 'home' || state.phase === 'finale') return;
  profile.checkpoint = {
    session,
    phase: state.phase,
    taskState: state.taskState,
    savedAt: Date.now()
  };
  saveProfile();
}

function restoreCheckpoint() {
  const checkpoint = profile.checkpoint;
  if (!checkpoint?.session || !checkpoint.taskState) return false;
  session = checkpoint.session;
  session.playground = normalizePlayground(session.playground || { id: session.id, seed: session.seed, built: session.built }, session.tasks.length);
  session.built = session.playground.items.slice(0, session.completed).map(item => ({ ...item }));
  state.phase = checkpoint.phase;
  state.taskState = checkpoint.taskState;
  elements.homeScreen.hidden = true;
  elements.gameScreen.hidden = false;
  renderGameShell();
  if (state.phase === 'playground-update') renderPlaygroundUpdate();
  else if (state.phase === 'resolving') {
    renderTask({ speak: false });
    const task = currentTask();
    if (task.kind === 'join') {
      const stage = elements.taskStage.querySelector('.join-stage');
      void formJoinResult(task, stage, ++state.token, true);
    } else {
      state.taskState.transferLocked = false;
      void resolveShare(task);
    }
  } else {
    state.phase = 'question';
    if (state.taskState.toys) state.taskState.transferLocked = false;
    renderTask({ speak: false });
  }
  return true;
}

function useReducedMotion() {
  return profile.settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function replayPrompt() { audio.unlock(); showPrompt(state.prompt.text, state.prompt.file); }
function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message; elements.toast.hidden = false;
  toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 2200);
}

function updateHome() {
  elements.playgroundCount.textContent = profile.playgrounds.length;
  document.documentElement.classList.toggle('reduced-motion', profile.settings.reducedMotion);
  document.documentElement.lang = profile.settings.locale;
  elements.homeTitle.textContent = ui().homeTitle;
  elements.adventureLabel.textContent = ui().adventure;
  elements.adventureHint.textContent = ui().adventureHint;
  elements.joinLabel.textContent = ui().join;
  elements.joinHint.textContent = ui().joinHint;
  elements.shareLabel.textContent = ui().share;
  elements.shareHint.textContent = ui().shareHint;
  elements.playgroundsLabel.textContent = ui().playgrounds;
  elements.firstPlayLabel.textContent = ui().play;
}

function renderSavedPlaygrounds() {
  elements.savedPlaygrounds.replaceChildren();
  if (!profile.playgrounds.length) {
    elements.savedPlaygrounds.appendChild(make('p', 'empty-playgrounds', 'Complete an adventure and your playground will wait here.'));
    return;
  }
  [...profile.playgrounds].reverse().forEach(playground => {
    const card = make('button', 'saved-playground');
    card.type = 'button'; card.setAttribute('aria-label', 'Replay this completed playground');
    const normalized = renderPlayground(card, playground, { interactive: false, limit: Math.min(playground.items?.length || playground.built?.length || 6, 8) });
    card.addEventListener('click', () => { audio.effect('build'); openSavedPlayground(normalized); });
    elements.savedPlaygrounds.appendChild(card);
  });
}

function openParentSettings() {
  renderParentSettings();
  elements.parentOverlay.hidden = false;
}

function evidenceSummary(skillId, label) {
  const evidence = profile.evidence[skillId] || [];
  const independent = evidence.filter(item => item.independent).length;
  return { label, value: `${independent} independent, ${evidence.length - independent} with help` };
}

function renderParentSettings() {
  elements.learningSummary.replaceChildren();
  const joiningLabel = profile.settings.joinMin > 2 ? `Joining ${profile.settings.joinMin}–${profile.settings.joinMax}` : `Joining to ${profile.settings.joinMax}`;
  [evidenceSummary('join', joiningLabel), evidenceSummary('share.composition', 'Making groups'), evidenceSummary('share.equal', `Equal sharing to ${profile.settings.equalMax}`), evidenceSummary('share.remainder', `Odd leftovers to ${profile.settings.remainderMax}`)].forEach(item => {
    const row = make('div', 'summary-row'); row.append(make('span', '', item.label), make('strong', '', item.value)); elements.learningSummary.appendChild(row);
  });
  elements.rangeButtons.replaceChildren();
  [5, 6, 7, 8, 9, 10].forEach(maximum => {
    const selected = profile.settings.joinMin === 2 && profile.settings.joinMax === maximum;
    const button = make('button', selected ? 'selected' : '', maximum);
    button.type = 'button';
    button.setAttribute('aria-label', `Practice joining up to ${maximum}`);
    button.addEventListener('click', () => { profile.settings.joinMin = 2; profile.settings.joinMax = maximum; saveProfile(); renderParentSettings(); });
    elements.rangeButtons.appendChild(button);
  });
  elements.lengthButtons.replaceChildren();
  [4, 6, 8].forEach(value => {
    const button = make('button', profile.settings.sessionLength === value ? 'selected' : '', value);
    button.type = 'button'; button.addEventListener('click', () => { profile.settings.sessionLength = value; saveProfile(); renderParentSettings(); }); elements.lengthButtons.appendChild(button);
  });
  elements.autoAdvanceToggle.checked = profile.settings.autoAdvance;
  elements.remaindersToggle.checked = profile.settings.remaindersEnabled;
  elements.narrationVolume.value = profile.settings.narrationVolume;
  elements.effectsVolume.value = profile.settings.effectsVolume;
  elements.reducedMotionToggle.checked = profile.settings.reducedMotion;
  document.querySelectorAll('[data-locale]').forEach(button => button.classList.toggle('selected', button.dataset.locale === profile.settings.locale));
}

function bindParentHold() {
  const start = event => {
    if (event.type === 'pointerdown' && event.pointerType === 'mouse' && event.button !== 0) return;
    clearTimeout(parentHoldTimer);
    elements.parentHoldButton.classList.add('holding');
    parentHoldTimer = setTimeout(() => { elements.parentHoldButton.classList.remove('holding'); openParentSettings(); }, 3000);
  };
  const cancel = () => { clearTimeout(parentHoldTimer); elements.parentHoldButton.classList.remove('holding'); };
  elements.parentHoldButton.addEventListener('pointerdown', start);
  elements.parentHoldButton.addEventListener('pointerup', cancel);
  elements.parentHoldButton.addEventListener('pointercancel', cancel);
  elements.parentHoldButton.addEventListener('pointerleave', cancel);
  elements.parentHoldButton.addEventListener('keydown', event => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) start(event); });
  elements.parentHoldButton.addEventListener('keyup', cancel);
}

function bindEvents() {
  elements.firstPlayButton.addEventListener('click', () => {
    audio.unlock();
    try { localStorage.setItem(WELCOME_KEY, 'yes'); } catch {}
    elements.firstVisitOverlay.hidden = true;
    showPrompt(copy().welcome, v1Audio('welcome'));
  });
  elements.adventureButton.addEventListener('click', () => startSession('adventure'));
  elements.joinButton.addEventListener('click', () => startSession('join'));
  elements.shareButton.addEventListener('click', () => startSession('share'));
  elements.leaveButton.addEventListener('click', goHome);
  elements.replayButton.addEventListener('click', replayPrompt);
  elements.audioRetryButton.addEventListener('click', replayPrompt);
  elements.playgroundsButton.addEventListener('click', () => { renderSavedPlaygrounds(); elements.playgroundsOverlay.hidden = false; });
  elements.showHelpButton.addEventListener('click', showTaskHelp);
  elements.resetTaskButton.addEventListener('click', resetCurrentTask);
  elements.skipTaskButton.addEventListener('click', skipToEasier);
  elements.allDoneButton.addEventListener('click', goHome);
  elements.anotherButton.addEventListener('click', () => { elements.finaleOverlay.hidden = true; startSession('adventure'); });
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeOverlay(button.dataset.close)));
  elements.autoAdvanceToggle.addEventListener('change', () => { profile.settings.autoAdvance = elements.autoAdvanceToggle.checked; saveProfile(); });
  elements.remaindersToggle.addEventListener('change', () => { profile.settings.remaindersEnabled = elements.remaindersToggle.checked; saveProfile(); });
  elements.narrationVolume.addEventListener('input', () => { profile.settings.narrationVolume = Number(elements.narrationVolume.value); audio.voice.volume = profile.settings.narrationVolume; saveProfile(); });
  elements.effectsVolume.addEventListener('input', () => { profile.settings.effectsVolume = Number(elements.effectsVolume.value); saveProfile(); });
  elements.reducedMotionToggle.addEventListener('change', () => { profile.settings.reducedMotion = elements.reducedMotionToggle.checked; updateHome(); saveProfile(); });
  document.querySelectorAll('[data-locale]').forEach(button => button.addEventListener('click', () => { profile.settings.locale = button.dataset.locale; saveProfile(); updateHome(); renderParentSettings(); }));
  elements.resetProgressButton.addEventListener('click', () => {
    if (elements.resetProgressButton.dataset.armed !== 'true') {
      elements.resetProgressButton.dataset.armed = 'true'; elements.resetProgressButton.textContent = 'Tap again to confirm reset';
      setTimeout(() => { elements.resetProgressButton.dataset.armed = 'false'; elements.resetProgressButton.textContent = 'Reset local progress'; }, 4000);
      return;
    }
    const settings = { ...profile.settings };
    profile = createDefaultProfile({ settings }); saveProfile(); renderParentSettings(); updateHome();
    elements.resetProgressButton.dataset.armed = 'false'; elements.resetProgressButton.textContent = 'Reset local progress';
  });
  elements.resumeButton.addEventListener('click', () => {
    audio.unlock();
    elements.resumeOverlay.hidden = true;
    state.paused = false;
    if (profile.checkpoint && (!session || state.phase === 'resolving')) restoreCheckpoint();
    else replayPrompt();
  });
  bindParentHold();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && session) { state.paused = true; audio.stop(); clearTaskTimers(); saveCheckpoint(); }
    else if (state.paused && session) elements.resumeOverlay.hidden = false;
  });
}

async function registerOffline() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    await registration.update().catch(() => {});
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'OFFLINE_READY') {
        elements.offlineStatus.classList.add('offline-ready');
        elements.offlineStatus.querySelector('span:last-child').textContent = 'Available offline';
      }
    });
    registration.active?.postMessage({ type: 'CHECK_READY' });
  } catch {
    elements.offlineStatus.querySelector('span:last-child').textContent = 'Online play';
  }
}

function initialize() {
  cacheElements();
  renderTens();
  bindEvents();
  updateHome();
  elements.firstVisitOverlay.hidden = localStorage.getItem(WELCOME_KEY) === 'yes';
  if (profile.checkpoint) elements.resumeOverlay.hidden = false;
  registerOffline();
}

initialize();
