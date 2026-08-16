import { AudioQueue } from './audio.js';
import { CURRICULUM, PICTURE_EMOJI, PICTURE_SPRITE_INDEX, cumulativeGraphemes, itemById, itemsForStage } from './data/curriculum.js';
import { assignBaselineStage, canBeginNextActivity, finalizeSession, mustStop, recordAttempt, selectSession, shuffled } from './engine.js';
import { exportBackup, importBackupAtomically, progressStore, requestPersistentStorage } from './store.js';

const app = document.querySelector('#app');
const replayButton = document.querySelector('#replayButton');
const parentButton = document.querySelector('#parentButton');
const gate = document.querySelector('#parentGate');
const gateForm = document.querySelector('#parentGateForm');
const parentCode = document.querySelector('#parentCode');
const toast = document.querySelector('#toast');
const audio = new AudioQueue();
const APP_ROOT = new URL('./', import.meta.url);

const state = {
  progress: null,
  view: 'loading',
  onboardingStep: 0,
  narratorApproved: false,
  lastInstruction: null,
  inputLocked: false,
  swRegistration: null,
  download: null,
  activityStartedAt: 0,
  meaningRevealed: false,
  buildSlots: [],
  sessionCompleted: false
};

const html = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const percent = (value) => value == null ? '—' : `${Math.round(value * 100)}%`;
const formatDuration = (milliseconds) => `${Math.max(1, Math.round(milliseconds / 60000))} min`;
const formatBytes = (bytes) => bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '0 MB';
const today = (value) => new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: 'short' }).format(new Date(value));

function showToast(message, duration = 3000) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, duration);
}

function setInstruction(id, autoplay = true) {
  state.lastInstruction = id;
  if (autoplay && state.progress?.settings.sound) setTimeout(() => audio.play(id), 80);
}

function momo() {
  return '<div class="momo" aria-label="Momo, mały robot przewodnik"><span class="momo-antenna"></span><span class="momo-body"></span><span class="momo-face"></span></div>';
}

async function save() {
  state.progress = await progressStore.save(state.progress);
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    state.swRegistration = await navigator.serviceWorker.register(new URL('sw.js', APP_ROOT), { scope: APP_ROOT.pathname });
    return state.swRegistration;
  } catch (error) {
    console.warn('Service worker registration failed', error);
    return null;
  }
}

async function init() {
  try {
    state.progress = await progressStore.load();
  } catch (error) {
    app.innerHTML = `<section class="screen"><div class="card"><p class="eyebrow">Błąd danych</p><h1>Potrzebna jest pomoc dorosłego</h1><p>${html(error.message)}</p></div></section>`;
    return;
  }
  audio.enabled = state.progress.settings.sound;
  document.body.classList.toggle('motion-off', !state.progress.settings.motion);
  await registerServiceWorker();
  if (state.progress.activeSession) state.view = 'session';
  else state.view = state.progress.onboardingComplete ? 'home' : 'onboarding';
  render();
  if (state.view === 'home') setInstruction('welcome-home');
}

function render() {
  replayButton.hidden = state.view === 'parent' || state.view === 'loading';
  parentButton.hidden = state.view === 'onboarding' || state.view === 'parent' || state.view === 'loading';
  if (state.view === 'onboarding') renderOnboarding();
  else if (state.view === 'home') renderHome();
  else if (state.view === 'session') renderSession();
  else if (state.view === 'parent') renderParent();
}

function renderOnboarding() {
  const step = state.onboardingStep;
  const progress = Math.round(((step + 1) / 4) * 100);
  const heads = [
    ['Konfiguracja rodzica', 'Najpierw przygotujmy krótkie misje dla dziecka.'],
    ['Głos Momo', 'Instrukcje są zapisane w aplikacji i działają offline.'],
    ['Pakiet offline', 'Pobierzemy i sprawdzimy cały kurs przed pierwszą misją.'],
    ['Krótka baza', 'Ta próba wybiera dobry początek, ale nigdy nie omija nauki łączenia dźwięków.']
  ];
  app.innerHTML = `
    <section class="screen">
      <div class="screen-head"><p class="eyebrow">Krok ${step + 1} z 4</p><h1>${heads[step][0]}</h1><p>${heads[step][1]}</p></div>
      <div class="progress-bar" aria-label="Postęp konfiguracji"><span style="width:${progress}%"></span></div>
      <div style="height:14px"></div>
      ${step === 0 ? onboardingProfile() : step === 1 ? onboardingVoice() : step === 2 ? onboardingPack() : onboardingBaseline()}
    </section>`;
  bindOnboarding();
}

function onboardingProfile() {
  return `<div class="card">${momo()}<div style="max-width:72%"><p class="eyebrow">Jeden profil na tym urządzeniu</p><h2>Jak Momo ma się zwracać?</h2></div>
    <div class="form-grid">
      <label>Imię dziecka — opcjonalnie<input id="childName" maxlength="30" value="${html(state.progress.profile.name)}" placeholder="np. Leon"></label>
      <p class="small">Bez imienia Momo powie „Kosmonauto”. Dane zostają tylko na tym urządzeniu.</p>
      <button id="profileNext" class="button primary large">Dalej</button>
    </div></div>`;
}

function onboardingVoice() {
  return `<div class="card"><p class="eyebrow">Jawne źródło głosu</p><h2>Głos narratora jest wygenerowany przez AI</h2>
    <p>Każde polecenie jest wcześniej przygotowanym plikiem MP3. Aplikacja nie wysyła tekstu ani danych dziecka do usługi głosowej i nigdy nie używa syntezy mowy działającej w przeglądarce.</p>
    <div class="callout">Rodzimy użytkownik języka polskiego powinien zatwierdzić krytyczne klipy przed samodzielną pracą dziecka.</div>
    <div class="button-row" style="margin-top:16px">
      <button id="playSample" class="button secondary">🔊 Posłuchaj próbki</button>
      <button id="approveVoice" class="button primary" ${state.narratorApproved ? '' : 'disabled'}>${state.narratorApproved ? 'Głos zaakceptowany' : 'Akceptuję ten głos'}</button>
    </div>
    <button id="voiceNext" class="button primary large" style="margin-top:16px" ${state.narratorApproved ? '' : 'disabled'}>Dalej</button>
  </div>`;
}

function onboardingPack() {
  const download = state.download;
  const offline = state.progress.offline;
  const complete = Boolean(offline.verifiedAt);
  const width = download?.total ? Math.round(download.completed / download.total * 100) : complete ? 100 : 0;
  return `<div class="card"><p class="eyebrow">Bez sieci po instalacji</p><h2>${complete ? 'Gotowe offline' : 'Pobierz cały kurs'}</h2>
    <p>Pakiet obejmuje interfejs, program 12 planet, naturalne instrukcje, słowa, opowiadania i grafiki.</p>
    <div class="progress-bar" style="background:#dddde6"><span style="width:${width}%"></span></div>
    <p><strong>${download ? `${download.completed} z ${download.total} plików` : complete ? `${offline.assetCount} plików · ${formatBytes(offline.totalBytes)}` : 'Nie pobrano'}</strong></p>
    ${download?.error ? `<div class="callout">${html(download.error)}<br>Tryb dziecka pozostaje zablokowany.</div>` : ''}
    <div class="button-row">
      <button id="downloadPack" class="button ${complete ? 'secondary' : 'primary'}" ${download?.running ? 'disabled' : ''}>${complete ? 'Sprawdź pliki ponownie' : 'Pobierz i sprawdź'}</button>
      <button id="packNext" class="button primary" ${complete ? '' : 'disabled'}>Dalej</button>
    </div></div>`;
}

function onboardingBaseline() {
  const probes = [
    ['lowercase', 'Duże → małe litery', 'Jak często dobiera poprawną małą literę?'],
    ['sound', 'Dźwięk → mała litera', 'Czy rozpoznaje dźwięki znanych liter?'],
    ['firstSound', 'Pierwszy dźwięk', 'Czy wskazuje początek słowa bez podpowiedzi obrazkiem?'],
    ['blending', 'Łączenie ustne', 'Czy łączy 2–3 dźwięki w słowo?'],
    ['segmentation', 'Dzielenie ustne', 'Czy liczy dźwięki w prostym słowie?'],
    ['decoding', 'Czytanie prostych słów', 'Czy czyta niećwiczone wcześniej proste słowa?']
  ];
  return `<div class="card"><p class="small">W v1 dorosły prowadzi tę krótką próbę. Wybierz najbardziej typowy wynik; szybkość nie obniża wyniku.</p>
    <div class="form-grid">${probes.map(([id, title, description]) => `<label>${title}<span class="small">${description}</span><select data-baseline="${id}"><option value="0">Jeszcze nie</option><option value="0.5">Czasami / z pomocą</option><option value="1">Pewnie i samodzielnie</option></select></label>`).join('')}
      <button id="finishBaseline" class="button primary large">Ustal pierwszą planetę</button>
    </div></div>`;
}

function bindOnboarding() {
  document.querySelector('#profileNext')?.addEventListener('click', async () => {
    const name = document.querySelector('#childName').value.trim();
    state.progress.profile.name = name;
    state.progress.profile.address = name || 'Kosmonauto';
    await save();
    state.onboardingStep = 1;
    render();
  });
  document.querySelector('#playSample')?.addEventListener('click', async () => {
    const played = await audio.play('narrator-sample');
    if (!played) {
      showToast('Nie udało się odtworzyć próbki. Odśwież aplikację i spróbuj ponownie.', 5500);
      return;
    }
    state.narratorApproved = true;
    render();
  });
  document.querySelector('#approveVoice')?.addEventListener('click', () => { state.narratorApproved = true; render(); });
  document.querySelector('#voiceNext')?.addEventListener('click', () => { if (state.narratorApproved) { state.onboardingStep = 2; render(); } });
  document.querySelector('#downloadPack')?.addEventListener('click', () => downloadOrVerifyPack(Boolean(state.progress.offline.verifiedAt)));
  document.querySelector('#packNext')?.addEventListener('click', () => { if (state.progress.offline.verifiedAt) { state.onboardingStep = 3; render(); } });
  document.querySelector('#finishBaseline')?.addEventListener('click', async () => {
    const scores = {};
    document.querySelectorAll('[data-baseline]').forEach((select) => { scores[select.dataset.baseline] = Number(select.value); });
    scores.suggestedStage = scores.decoding >= 1 && scores.sound >= 1 ? 3 : 2;
    state.progress.baseline = { completedAt: new Date().toISOString(), scores };
    state.progress.currentStage = assignBaselineStage(scores);
    state.progress.onboardingComplete = true;
    await requestPersistentStorage();
    await save();
    state.view = 'home';
    render();
    setInstruction('welcome-home');
  });
}

async function packManifest() {
  const response = await fetch(new URL('offline-pack.json', APP_ROOT), { cache: 'no-store' });
  if (!response.ok) throw new Error('Manifest pakietu offline nie jest dostępny. Uruchom produkcyjny build.');
  return response.json();
}

async function downloadOrVerifyPack(verifyOnly = false) {
  state.download = { running: true, completed: 0, total: 0, error: null };
  render();
  try {
    const manifest = await packManifest();
    const registration = state.swRegistration ?? await registerServiceWorker();
    const worker = registration?.active ?? registration?.waiting ?? registration?.installing;
    if (!worker) throw new Error('Przeglądarka nie uruchomiła jeszcze pamięci offline. Odczekaj chwilę i spróbuj ponownie.');
    await new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = ({ data }) => {
        if (data.type === 'progress') {
          state.download = { ...state.download, completed: data.completed, total: data.total };
          render();
        } else if (data.type === 'complete') {
          state.progress.offline = { version: data.version, verifiedAt: new Date().toISOString(), assetCount: data.total, totalBytes: data.bytes };
          resolve();
        } else if (data.type === 'error') reject(new Error(data.message));
      };
      worker.postMessage({ type: verifyOnly ? 'VERIFY_PACK' : 'DOWNLOAD_PACK', manifest }, [channel.port2]);
    });
    state.download.running = false;
    await save();
  } catch (error) {
    state.progress.offline.verifiedAt = null;
    state.download = { ...state.download, running: false, error: error.message };
    await save();
  }
  render();
}

function renderHome() {
  const stage = CURRICULUM.stages[state.progress.currentStage];
  const ready = Boolean(state.progress.offline.verifiedAt);
  const sessionCount = state.progress.sessions.length;
  app.innerHTML = `<section class="screen">
    <div class="card hero-card" style="--hero-image:url('assets/czytaj-space-card.png')">
      ${momo()}
      <div class="hero-copy">
        <p class="eyebrow">${ready ? 'Gotowe offline' : 'Potrzebna pomoc dorosłego'}</p>
        <h1>Cześć, ${html(state.progress.profile.address)}!</h1>
        <p>${ready ? 'Momo przygotował krótką misję czytelniczą.' : 'Pakiet dźwięków i ćwiczeń nie został w pełni sprawdzony.'}</p>
      </div>
    </div>
    <div class="card">
      <div class="planet-row"><div class="planet"></div><div><p class="eyebrow">Planeta ${stage.order} z 12</p><h2>${html(stage.planet)}</h2></div></div>
      <div class="mission-map">${CURRICULUM.stages.slice(1).map((value) => `<span class="map-node ${value.order < stage.order ? 'done' : value.order === stage.order ? 'current' : ''}"></span>`).join('')}</div>
      ${!ready ? '<div class="callout">Dziecko nie może rozpocząć samodzielnej misji, dopóki wszystkie wymagane pliki audio nie są zapisane i sprawdzone.</div>' : ''}
      <button id="startMission" class="button primary large" ${ready ? '' : 'disabled'}>${state.progress.activeSession ? 'Dokończ misję' : 'Start misji'}</button>
      <p class="small" style="text-align:center">Misja ${sessionCount + 1} · około 10 minut · bez punktów i presji czasu</p>
    </div>
  </section>`;
  document.querySelector('#startMission')?.addEventListener('click', startMission);
}

async function startMission() {
  if (!state.progress.offline.verifiedAt) return;
  await audio.unlock();
  if (!state.progress.activeSession) {
    state.progress.activeSession = selectSession(state.progress);
    await save();
  }
  state.view = 'session';
  state.meaningRevealed = false;
  state.buildSlots = [];
  render();
  setInstruction(state.progress.activeSession.repair ? 'repair-session' : 'mission-start');
}

function currentActivity() {
  return state.progress.activeSession?.activities[state.progress.activeSession.activityIndex];
}

function sessionProgress() {
  const session = state.progress.activeSession;
  if (!session) return 100;
  return Math.round((session.activityIndex / Math.max(1, session.activities.length - 1)) * 100);
}

function renderSession() {
  const session = state.progress.activeSession;
  if (!session) { state.view = 'home'; render(); return; }
  if (mustStop(session) && currentActivity()?.type !== 'complete') {
    session.activityIndex = session.activities.findIndex((value) => value.type === 'complete');
  }
  const activity = currentActivity();
  if (!activity) { completeMission(); return; }
  state.activityStartedAt = performance.now();
  app.innerHTML = `<section class="screen">
    <div class="mission-meta"><span>${session.repair ? 'Misja utrwalająca' : `Misja ${session.number}`}</span><span>Planeta ${session.stage}</span></div>
    <div class="progress-bar"><span style="width:${sessionProgress()}%"></span></div>
    <div style="height:14px"></div>
    <div class="card exercise-card">
      <div class="instruction"><span>🔊</span><span id="instructionText">${instructionText(activity.instructionId)}</span></div>
      ${activityMarkup(activity)}
    </div>
  </section>`;
  bindActivity(activity);
  if (activity.type !== 'complete') setInstruction(activity.instructionId);
}

function instructionText(id) {
  return ({
    'warmup-blend': 'Posłuchaj dźwięków. Połącz je w słowo.',
    'review-choose': 'Posłuchaj dźwięku. Dotknij pasującej litery.',
    'mapping-new': 'Poznajemy nowy znak. Dotknij go, aby usłyszeć dźwięk.',
    'blend-swipe': 'Przesuń promień pod literami i połącz dźwięki.',
    'build-word': 'Ułóż litery w pustych polach.',
    'read-first': 'Przeczytaj słowo sam. Obrazki pojawią się później.',
    'alien-word': 'To słowo kosmity. Spróbuj je odczytać.',
    'story-attempt': 'Przeczytaj zdania sam. Potem możesz ich posłuchać.',
    'mission-complete': 'Misja zakończona. Czas na przerwę.'
  })[id] ?? 'Posłuchaj polecenia.';
}

function splitGraphemes(word, stage) {
  const known = cumulativeGraphemes(stage).sort((a, b) => b.length - a.length);
  const result = [];
  let remaining = word.toLocaleLowerCase('pl-PL');
  while (remaining) {
    const match = known.find((value) => remaining.startsWith(value)) ?? remaining[0];
    result.push(match);
    remaining = remaining.slice(match.length);
  }
  return result;
}

function pictureMarkup(word) {
  const index = PICTURE_SPRITE_INDEX[word];
  if (index == null) return `<span aria-hidden="true">${PICTURE_EMOJI[word] ?? '❔'}</span>`;
  const column = index % 8;
  const row = Math.floor(index / 8);
  return `<span class="picture-sprite" style="--picture-x:${column * (100 / 7)}%;--picture-y:${row * (100 / 7)}%" aria-hidden="true"></span>`;
}

function activityMarkup(activity) {
  const session = state.progress.activeSession;
  if (activity.type === 'warmup') {
    const target = activity.item;
    const choices = shuffled([target, ...itemsForStage(session.stage).filter((item) => item.id !== target.id).slice(0, 2)], `${session.seed}:warmup`).slice(0, 3);
    activity.choices = choices;
    return `<div class="letter-display">${splitGraphemes(target.answer, session.stage).map(() => '●').join(' ')}</div><div class="choices">${choices.map((item) => `<button class="choice" data-answer="${html(item.id)}" style="font-size:1.8rem">${html(item.answer)}</button>`).join('')}</div>`;
  }
  if (activity.type === 'hear-choose') return `<div class="letter-display">?</div><div class="choices">${activity.choices.map((choice) => `<button class="choice" data-grapheme="${html(choice)}">${html(choice)}</button>`).join('')}</div>`;
  if (activity.type === 'mapping') return `<button id="mappingLetter" class="choice" style="width:100%;min-height:170px;font-size:7rem">${html(activity.grapheme)} <span class="capital-partner">${html(activity.capital)}</span></button><button id="mappingDone" class="button primary large" style="margin-top:16px">Znam ten dźwięk</button>`;
  if (activity.type === 'blend') {
    const parts = splitGraphemes(activity.item.answer, session.stage);
    return `<div class="graphemes" id="blendArea">${parts.map((part) => `<span class="grapheme">${html(part)}</span>`).join('')}<span class="beam-track"></span><span class="beam" id="beam"></span></div><button id="blendStart" class="button primary large">Przesuń promień</button><button id="blendDone" class="button secondary large hidden" style="margin-top:10px">Połączyłem</button>`;
  }
  if (activity.type === 'build') {
    const parts = splitGraphemes(activity.item.answer, session.stage);
    activity.parts = parts;
    const tiles = shuffled(parts.map((value, index) => ({ value, index })), `${session.seed}:${activity.item.id}:tiles`);
    return `<div class="sound-boxes">${parts.map((_, index) => `<span class="sound-box" data-slot="${index}"></span>`).join('')}</div><div class="tile-rack">${tiles.map((tile) => `<button class="tile" data-tile="${tile.index}" data-value="${html(tile.value)}">${html(tile.value)}</button>`).join('')}</div><button id="buildReset" class="button secondary">Ułóż od nowa</button>`;
  }
  if (activity.type === 'meaning') {
    if (!state.meaningRevealed) return `<div class="word-display">${html(activity.item.answer)}</div><button id="revealMeaning" class="button primary large">Przeczytałem — pokaż obrazki</button>`;
    const candidates = shuffled(CURRICULUM.items.filter((item) => item.imageId && item.id !== activity.item.id), `${session.seed}:pictures`).slice(0, 3);
    activity.meaningChoices = shuffled([activity.item, ...candidates], `${session.seed}:picture-order`);
    return `<div class="word-display" style="min-height:80px;font-size:2.7rem">${html(activity.item.answer)}</div><div class="choices">${activity.meaningChoices.map((item) => `<button class="choice picture" data-picture="${html(item.id)}" aria-label="${html(item.answer)}">${pictureMarkup(item.answer)}</button>`).join('')}</div>`;
  }
  if (activity.type === 'nonword') return `<p class="eyebrow">Słowo kosmity</p><div class="word-display">${html(activity.item.answer)}</div><button id="unverifiedDone" class="button primary large">Przeczytałem</button><p class="small">Ta samodzielna deklaracja nie liczy się jako opanowane czytanie.</p>`;
  if (activity.type === 'story') return `<div class="story">${activity.story.sentences.map((sentence) => `<p>${html(sentence)}</p>`).join('')}</div><div class="button-row" style="margin-top:16px"><button id="storyListen" class="button secondary">🔊 Posłuchaj po próbie</button><button id="storyDone" class="button primary">Przeczytałem</button></div>`;
  return completionMarkup();
}

function bindActivity(activity) {
  if (activity.type === 'warmup') {
    playSegmented(activity.item.answer);
    document.querySelectorAll('[data-answer]').forEach((button) => button.addEventListener('click', () => objectiveAnswer(button, button.dataset.answer === activity.item.id, activity)));
  } else if (activity.type === 'hear-choose') {
    setTimeout(() => audio.play(`sound-${activity.grapheme}`), 500);
    document.querySelectorAll('[data-grapheme]').forEach((button) => button.addEventListener('click', () => objectiveAnswer(button, button.dataset.grapheme === activity.grapheme, activity, `sound-${activity.grapheme}`)));
  } else if (activity.type === 'mapping') {
    document.querySelector('#mappingLetter').addEventListener('click', () => audio.play(`sound-${activity.grapheme}`));
    document.querySelector('#mappingDone').addEventListener('click', () => finishActivity(activity, true));
  } else if (activity.type === 'blend') {
    document.querySelector('#blendStart').addEventListener('click', async () => {
      document.querySelector('#beam').classList.add('moving');
      await playSegmented(activity.item.answer);
      document.querySelector('#blendDone').classList.remove('hidden');
    }, { once: true });
    document.querySelector('#blendDone').addEventListener('click', () => finishActivity(activity, true));
  } else if (activity.type === 'build') {
    document.querySelectorAll('[data-tile]').forEach((button) => button.addEventListener('click', () => addBuildTile(button, activity)));
    document.querySelector('#buildReset').addEventListener('click', () => { state.buildSlots = []; renderSession(); });
  } else if (activity.type === 'meaning') {
    document.querySelector('#revealMeaning')?.addEventListener('click', () => { state.meaningRevealed = true; renderSession(); setInstruction('choose-meaning'); });
    document.querySelectorAll('[data-picture]').forEach((button) => button.addEventListener('click', () => objectiveAnswer(button, button.dataset.picture === activity.item.id, activity, `word-${activity.item.answer.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l')}`)));
  } else if (activity.type === 'nonword') {
    document.querySelector('#unverifiedDone').addEventListener('click', () => finishActivity(activity, true, false));
  } else if (activity.type === 'story') {
    document.querySelector('#storyListen').addEventListener('click', async () => { for (const id of activity.story.audioIds) await audio.play(id); });
    document.querySelector('#storyDone').addEventListener('click', () => finishActivity(activity, true, false));
  } else if (activity.type === 'complete') {
    document.querySelector('#finishMission').addEventListener('click', completeMission);
  }
}

async function playSegmented(word) {
  for (const part of splitGraphemes(word, state.progress.activeSession.stage)) await audio.play(`sound-${part}`);
}

async function objectiveAnswer(button, correct, activity, modelAudio = null) {
  if (state.inputLocked) return;
  state.inputLocked = true;
  button.classList.add(correct ? 'correct' : 'retry');
  recordAttempt(state.progress, state.progress.activeSession, activity, { correct, answer: button.dataset.answer ?? button.dataset.grapheme ?? button.dataset.picture, latencyMs: performance.now() - state.activityStartedAt });
  if (correct) {
    if (state.progress.settings.effects) await audio.play('correct-choice', { required: false });
  } else {
    await audio.play('retry-gentle');
    if (modelAudio) await audio.play(modelAudio);
  }
  await save();
  setTimeout(() => { state.inputLocked = false; nextActivity(); }, correct ? 450 : 250);
}

async function addBuildTile(button, activity) {
  if (state.inputLocked || button.classList.contains('used')) return;
  button.classList.add('used');
  state.buildSlots.push({ value: button.dataset.value, tile: button.dataset.tile });
  document.querySelector(`[data-slot="${state.buildSlots.length - 1}"]`).textContent = button.dataset.value;
  document.querySelector(`[data-slot="${state.buildSlots.length - 1}"]`).classList.add('filled');
  if (state.buildSlots.length !== activity.parts.length) return;
  const answer = state.buildSlots.map((value) => value.value).join('');
  const correct = answer === activity.parts.join('');
  if (correct) {
    state.buildSlots = [];
    await finishActivity(activity, true);
  } else {
    recordAttempt(state.progress, state.progress.activeSession, activity, { correct: false, answer, latencyMs: performance.now() - state.activityStartedAt });
    await audio.play('retry-gentle');
    await save();
    state.buildSlots = [];
    renderSession();
  }
}

async function finishActivity(activity, correct, verified = true) {
  if (state.inputLocked) return;
  state.inputLocked = true;
  recordAttempt(state.progress, state.progress.activeSession, activity, { correct, verified, latencyMs: performance.now() - state.activityStartedAt });
  await save();
  state.inputLocked = false;
  nextActivity();
}

async function nextActivity() {
  const session = state.progress.activeSession;
  session.activityIndex += 1;
  state.meaningRevealed = false;
  state.buildSlots = [];
  if (!canBeginNextActivity(session) && session.activities[session.activityIndex]?.type !== 'complete') {
    session.activityIndex = session.activities.findIndex((value) => value.type === 'complete');
  }
  await save();
  renderSession();
}

function completionMarkup() {
  const session = state.progress.activeSession;
  return `<div style="text-align:center;padding:12px 0 4px"><div class="planet" style="margin:0 auto 18px;transform:scale(1.25)"></div><h2>Misja zakończona</h2><p>Momo przesuwa rakietę o jeden spokojny krok.</p>${session.number % 5 === 0 ? '<div class="callout">W trybie rodzica czeka pięcioelementowa próba czytania. Nie blokuje kolejnej misji.</div>' : ''}<button id="finishMission" class="button primary large" style="margin-top:16px">Koniec na dziś</button></div>`;
}

async function completeMission() {
  if (state.sessionCompleted || !state.progress.activeSession) return;
  state.sessionCompleted = true;
  await audio.play('mission-complete');
  finalizeSession(state.progress, state.progress.activeSession);
  await save();
  state.sessionCompleted = false;
  state.view = 'home';
  render();
}

function renderParent() {
  const progress = state.progress;
  const sessions = progress.sessions;
  const latest = sessions.at(-1);
  const confusionRows = Object.entries(progress.errors).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const dueProbes = progress.parentProbes.filter((probe) => probe.due);
  app.innerHTML = `<section class="screen">
    <div class="screen-head"><p class="eyebrow">Panel dorosłego</p><h1>${html(progress.profile.name || 'Kosmonauta')}</h1><p>Aktywności ukończone nie są tym samym co wykazana umiejętność.</p></div>
    <div class="card"><div class="button-row"><button id="parentClose" class="button primary">Wróć do dziecka</button><a class="button secondary" href="../" style="text-decoration:none">Menu główne</a></div></div>
    <div class="card"><p class="eyebrow">Podsumowanie</p><div class="stats-grid">
      <div class="stat"><span>Etap</span><strong>${progress.currentStage}/12</strong></div>
      <div class="stat"><span>Misje</span><strong>${sessions.length}</strong></div>
      <div class="stat"><span>Ostatnia trafność</span><strong>${latest ? percent(latest.accuracy) : '—'}</strong></div>
      <div class="stat"><span>Do powtórki</span><strong>${progress.reviewQueue.length}</strong></div>
    </div></div>
    <div class="card"><p class="eyebrow">Etapy i umiejętności</p><h2>Droga przez planety</h2>
      <div class="table-wrap"><table><thead><tr><th>Etap</th><th>Nowe znaki</th><th>Status</th></tr></thead><tbody>${CURRICULUM.stages.slice(1).map((stage) => `<tr><td>${stage.order}. ${html(stage.planet)}</td><td>${html(stage.introducedGraphemes.join(' · '))}</td><td>${stage.order < progress.currentStage ? 'ukończony' : stage.order === progress.currentStage ? 'w toku' : 'później'}</td></tr>`).join('')}</tbody></table></div>
      <p class="small">Znaki etapu bieżącego: ${CURRICULUM.stages[progress.currentStage].introducedGraphemes.map((grapheme) => `${html(grapheme)} — ${progress.mastery[`grapheme:${grapheme}`]?.provisional ? 'opanowany w próbach mieszanych' : `${progress.mastery[`grapheme:${grapheme}`]?.trials ?? 0}/12 prób`}`).join('; ') || 'płynność tekstu i zbitki spółgłoskowe'}.</p>
    </div>
    <div class="card"><p class="eyebrow">Baza początkowa</p><h2>Ocena startowa</h2>
      ${progress.baseline ? `<p>Małe litery: <strong>${percent(progress.baseline.scores.lowercase)}</strong><br>Dźwięki liter: <strong>${percent(progress.baseline.scores.sound)}</strong><br>Pierwszy dźwięk: <strong>${percent(progress.baseline.scores.firstSound)}</strong><br>Łączenie: <strong>${percent(progress.baseline.scores.blending)}</strong><br>Dzielenie: <strong>${percent(progress.baseline.scores.segmentation)}</strong><br>Czytanie słów: <strong>${percent(progress.baseline.scores.decoding)}</strong></p>` : '<p>Brak zapisanej bazy.</p>'}
      <button id="repeatBaseline" class="button secondary">Powtórz krótką bazę</button>
    </div>
    <div class="card"><p class="eyebrow">Nauka, nie samo wykonanie</p><h2>Wyniki ostatniej misji</h2>
      <p>Ćwiczone wcześniej: <strong>${latest ? percent(latest.trainedAccuracy) : '—'}</strong><br>Niećwiczone / transfer: <strong>${latest ? percent(latest.unseenAccuracy) : '—'}</strong></p>
      <p class="small">Wczesnej nauki nie blokuje tempo odpowiedzi. Nieweryfikowane czytanie na głos nie podnosi wyniku opanowania.</p>
    </div>
    ${dueProbes.length ? `<div class="card"><p class="eyebrow">Próba z rodzicem</p><h2>Pięć słów do sprawdzenia</h2>${dueProbes.map((probe) => `<div class="callout" style="margin-bottom:10px"><strong>Po misji ${probe.id.split('-')[1]}</strong><p>${probe.itemIds.map((id) => itemById(id)?.answer).filter(Boolean).join(' · ')}</p><button class="button secondary" data-probe-done="${probe.id}">Oznacz jako przeprowadzoną</button></div>`).join('')}</div>` : ''}
    <div class="card"><p class="eyebrow">Powtarzające się pomyłki</p><h2>Najczęstsze trudności</h2>${confusionRows.length ? `<div class="table-wrap"><table><thead><tr><th>Element</th><th>Pomyłki</th></tr></thead><tbody>${confusionRows.map(([id, count]) => `<tr><td>${html(itemById(id)?.answer ?? id)}</td><td>${count}</td></tr>`).join('')}</tbody></table></div>` : '<p>Jeszcze brak danych.</p>'}</div>
    <div class="card"><p class="eyebrow">Historia</p><h2>Ostatnie misje</h2>${sessions.length ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Etap</th><th>Wynik</th><th>Czas</th></tr></thead><tbody>${sessions.slice(-10).reverse().map((session) => `<tr><td>${today(session.completedAt)}</td><td>${session.stage}${session.repair ? ' · utrw.' : ''}</td><td>${percent(session.accuracy)}</td><td>${formatDuration(session.durationMs)}</td></tr>`).join('')}</tbody></table></div>` : '<p>Brak zakończonych misji.</p>'}</div>
    <div class="card"><p class="eyebrow">Ustawienia dziecka</p><h2>Dźwięk i ruch</h2>
      <label class="setting"><span>Instrukcje głosowe<br><span class="small">Wymagane do samodzielnej pracy</span></span><input id="soundSetting" class="switch" type="checkbox" ${progress.settings.sound ? 'checked' : ''}></label>
      <label class="setting"><span>Delikatne efekty dźwiękowe</span><input id="effectsSetting" class="switch" type="checkbox" ${progress.settings.effects ? 'checked' : ''}></label>
      <label class="setting"><span>Spokojne animacje</span><input id="motionSetting" class="switch" type="checkbox" ${progress.settings.motion ? 'checked' : ''}></label>
    </div>
    <div class="card"><p class="eyebrow">Offline</p><h2>${progress.offline.verifiedAt ? 'Gotowe offline' : 'Pakiet niepełny'}</h2>
      <p><span class="status ${progress.offline.verifiedAt ? 'ready' : 'warning'}">${progress.offline.verifiedAt ? '✓' : '!' } ${progress.offline.assetCount || 0} plików · ${formatBytes(progress.offline.totalBytes)}</span></p>
      <button id="repairPack" class="button secondary">Sprawdź pliki offline</button>
      ${state.download?.error ? `<p class="callout">${html(state.download.error)}</p>` : ''}
    </div>
    <div class="card"><p class="eyebrow">Kopia lokalna</p><h2>Eksport i import</h2><p>Kopia zawiera profil, bazę, kolejkę powtórek, historię i ustawienia. Import jest najpierw sprawdzany, a dopiero potem zastępuje dane.</p>
      <div class="button-row"><button id="exportProgress" class="button secondary">Eksportuj JSON</button><label class="button secondary" style="display:inline-grid;place-items:center">Importuj JSON<input id="importProgress" type="file" accept="application/json" hidden></label></div>
    </div>
    <div class="card"><p class="eyebrow">Instalacja</p><h2>Dodaj do ekranu głównego</h2><p><strong>iPhone:</strong> otwórz w Safari, wybierz Udostępnij, potem „Do ekranu początkowego”.</p><p><strong>Android:</strong> otwórz w Chrome, wybierz menu i „Zainstaluj aplikację”.</p><p class="small">Po pobraniu i weryfikacji kurs działa bez sieci. Głos Momo został wygenerowany przez AI.</p></div>
    <div class="card"><p class="eyebrow">Strefa ostrożna</p><h2>Reset postępu</h2><button id="resetProgress" class="button danger">Usuń postęp po potwierdzeniu</button></div>
  </section>`;
  bindParent();
}

function bindParent() {
  document.querySelector('#parentClose').addEventListener('click', () => { state.view = state.progress.activeSession ? 'session' : 'home'; render(); });
  for (const [id, key] of [['soundSetting', 'sound'], ['effectsSetting', 'effects'], ['motionSetting', 'motion']]) {
    document.querySelector(`#${id}`).addEventListener('change', async (event) => {
      state.progress.settings[key] = event.target.checked;
      audio.enabled = state.progress.settings.sound;
      document.body.classList.toggle('motion-off', !state.progress.settings.motion);
      await save();
    });
  }
  document.querySelectorAll('[data-probe-done]').forEach((button) => button.addEventListener('click', async () => {
    const probe = state.progress.parentProbes.find((value) => value.id === button.dataset.probeDone);
    if (probe) { probe.due = false; probe.completedAt = new Date().toISOString(); await save(); renderParent(); }
  }));
  document.querySelector('#repairPack').addEventListener('click', () => downloadOrVerifyPack(true));
  document.querySelector('#repeatBaseline').addEventListener('click', () => { state.onboardingStep = 3; state.view = 'onboarding'; render(); });
  document.querySelector('#exportProgress').addEventListener('click', async () => {
    const data = await exportBackup(state.progress);
    const blob = new Blob([data], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `czytaj-postep-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
  document.querySelector('#importProgress').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      state.progress = await importBackupAtomically(await file.text());
      showToast('Kopia została sprawdzona i przywrócona.');
      renderParent();
    } catch (error) { showToast(error.message, 5500); }
  });
  document.querySelector('#resetProgress').addEventListener('click', async () => {
    const phrase = prompt('Aby usunąć cały postęp, wpisz: USUŃ');
    if (phrase !== 'USUŃ') return;
    state.progress = await progressStore.reset();
    state.view = 'onboarding';
    state.onboardingStep = 0;
    render();
  });
}

replayButton.addEventListener('click', async () => {
  await audio.unlock();
  if (state.lastInstruction) audio.play(state.lastInstruction);
});

let holdTimer = null;
const beginHold = () => {
  parentButton.classList.add('holding');
  holdTimer = setTimeout(() => {
    parentButton.classList.remove('holding');
    parentCode.value = '';
    gate.showModal();
    setTimeout(() => parentCode.focus(), 50);
  }, 3000);
};
const cancelHold = () => { clearTimeout(holdTimer); parentButton.classList.remove('holding'); };
parentButton.addEventListener('pointerdown', beginHold);
parentButton.addEventListener('pointerup', cancelHold);
parentButton.addEventListener('pointercancel', cancelHold);
parentButton.addEventListener('pointerleave', cancelHold);
gateForm.addEventListener('submit', (event) => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault();
  if (parentCode.value.trim().toLocaleUpperCase('pl-PL') !== 'RODZIC') { showToast('Wpisz dokładnie RODZIC.'); return; }
  gate.close();
  audio.stop();
  state.view = 'parent';
  render();
});

audio.addEventListener('requiredmissing', () => {
  state.progress.offline.verifiedAt = null;
  save();
  audio.stop();
  state.view = 'parent';
  showToast('Brakuje wymaganego nagrania. Tryb dziecka został bezpiecznie zatrzymany.', 6000);
  render();
});

document.addEventListener('visibilitychange', () => { if (document.hidden) audio.stop(); });
window.addEventListener('pagehide', () => audio.stop());

init();
