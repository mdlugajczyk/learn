import { AudioQueue } from './audio.js';
import { CURRICULUM, PICTURE_EMOJI, PICTURE_SPRITE_INDEX, cumulativeGraphemes, itemById } from './data/curriculum.js';
import { assignBaselineStage, canBeginNextActivity, finalizeSession, mustStop, recordAttempt, selectSession, shuffled } from './engine.js';
import { addDiscovery, chapterFor, chapterState, discoveriesFor, ensureExploration, missionChapters, planetTheme } from './experience.js';
import { lessonIndexFor, teachingNotesForStage } from './learning-path.js';
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
  lastInstruction: null,
  inputLocked: false,
  swRegistration: null,
  download: null,
  activityStartedAt: 0,
  meaningRevealed: false,
  buildSlots: [],
  storyStep: 0,
  storyAttempted: false,
  showLaunch: false,
  sessionCompleted: false,
  presentationToken: 0,
  justUnlockedStage: null
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

async function setInstruction(id, autoplay = true) {
  state.lastInstruction = id;
  if (autoplay && state.progress?.settings.sound) return audio.play(id);
  return false;
}

function momo(variant = '') {
  return `<div class="momo ${variant}" aria-label="Momo, mały robot przewodnik"><span class="momo-antenna"></span><span class="momo-arm arm-left"></span><span class="momo-arm arm-right"></span><span class="momo-body"></span><span class="momo-face"></span><span class="momo-glow"></span></div>`;
}

function iconAction(id, icon, label, classes = 'button primary large mission-action') {
  const disabled = classes.includes('is-disabled') ? ' disabled' : '';
  return `<button id="${id}" class="${classes} icon-action" type="button" aria-label="${html(label)}" title="${html(label)}"${disabled}><span aria-hidden="true">${icon}</span><span class="visually-hidden">${html(label)}</span></button>`;
}

async function save() {
  state.progress = await progressStore.save(state.progress);
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    state.swRegistration = await navigator.serviceWorker.register(new URL('sw.js', APP_ROOT).href, { scope: APP_ROOT.pathname });
    return state.swRegistration;
  } catch (error) {
    console.warn('Service worker registration failed', error);
    return null;
  }
}

async function init() {
  try {
    state.progress = await progressStore.load();
    ensureExploration(state.progress);
    // Sesje sprzed uporządkowanej ścieżki dobierały słowa losowo. Nie wznawiamy
    // ich w połowie po aktualizacji, bo mogłyby pokazać dziecku niepoznany znak.
    if (state.progress.activeSession && !state.progress.activeSession.lessonId) {
      state.progress.activeSession = null;
      await save();
    }
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
  if (state.view === 'home') setInstruction('welcome-home', false);
}

function render() {
  replayButton.hidden = state.view === 'parent' || state.view === 'loading';
  parentButton.hidden = state.view === 'onboarding' || state.view === 'parent' || state.view === 'loading';
  if (state.view === 'onboarding') renderOnboarding();
  else if (state.view === 'home') renderHome();
  else if (state.view === 'session') renderSession();
  else if (state.view === 'parent') renderParent();
  requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
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
    <button id="voiceNext" class="button primary large" style="margin-top:16px">Dalej</button>
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
  document.querySelector('#voiceNext')?.addEventListener('click', () => { state.onboardingStep = 2; render(); });
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
    setInstruction('welcome-home', false);
  });
}

async function packManifest() {
  const response = await fetch(new URL('offline-pack.json', APP_ROOT).href, { cache: 'no-store' });
  if (!response.ok) throw new Error('Manifest pakietu offline nie jest dostępny. Uruchom produkcyjny build.');
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Serwer nie udostępnił pakietu offline. Wymagany jest plik offline-pack.json, a serwer zwrócił stronę HTML.');
  }
  const manifest = await response.json();
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets) || manifest.assetCount !== manifest.assets.length) {
    throw new Error('Manifest pakietu offline ma nieprawidłowy format.');
  }
  return manifest;
}

async function downloadOrVerifyPack(verifyOnly = false) {
  state.download = { running: true, completed: 0, total: 0, error: null };
  render();
  try {
    const manifest = await packManifest();
    state.download = { ...state.download, total: manifest.assetCount };
    render();
    await (state.swRegistration ?? registerServiceWorker());
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active;
    if (!worker) throw new Error('Przeglądarka nie uruchomiła jeszcze pamięci offline. Odczekaj chwilę i spróbuj ponownie.');
    const requestPackAction = (type) => new Promise((resolve, reject) => {
      const requestId = globalThis.crypto?.randomUUID?.() ?? `czytaj-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const timeout = setTimeout(() => finish(() => reject(new Error('Pobieranie nie odpowiedziało. Zamknij aplikację, otwórz ją ponownie i spróbuj jeszcze raz.'))), 120000);
      const finish = (callback) => {
        clearTimeout(timeout);
        navigator.serviceWorker.removeEventListener('message', onMessage);
        callback();
      };
      const onMessage = ({ data }) => {
        if (data?.requestId !== requestId) return;
        if (data.type === 'progress') {
          state.download = { ...state.download, completed: data.completed, total: data.total };
          render();
        } else if (data.type === 'complete') {
          state.progress.offline = { version: data.version, verifiedAt: new Date().toISOString(), assetCount: data.total, totalBytes: data.bytes };
          finish(resolve);
        } else if (data.type === 'error') finish(() => reject(new Error(data.message)));
      };
      navigator.serviceWorker.addEventListener('message', onMessage);
      worker.postMessage({ type, manifest, requestId });
    });
    try {
      await requestPackAction(verifyOnly ? 'VERIFY_PACK' : 'DOWNLOAD_PACK');
    } catch (error) {
      if (!verifyOnly) throw error;
      state.download = { running: true, completed: 0, total: manifest.assetCount, error: null };
      render();
      await requestPackAction('DOWNLOAD_PACK');
    }
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
  const theme = planetTheme(stage.order);
  const discoveries = discoveriesFor(state.progress, stage.order);
  const ready = Boolean(state.progress.offline.verifiedAt);
  const sessionCount = state.progress.sessions.length;
  app.innerHTML = `<section class="screen child-home planet-${theme.slug}" style="--planet-accent:${theme.accent};--planet-deep:${theme.deep}">
    <div class="cockpit-home">
      <div class="cockpit-window" aria-hidden="true">
        <span class="home-planet"><i>${theme.symbol}</i></span>
        <span class="orbit-moon moon-one"></span><span class="orbit-moon moon-two"></span>
        ${state.justUnlockedStage === stage.order ? '<span class="new-planet-banner">NOWA PLANETA</span>' : ''}
      </div>
      ${momo('home-momo momo-wave')}
      <div class="home-copy">
        <p class="eyebrow">${ready ? `Planeta ${stage.order} z 12` : 'Potrzebna pomoc dorosłego'}</p>
        <h1>${state.justUnlockedStage === stage.order ? `Nowy kurs: ${html(stage.planet)}!` : `Cześć, ${html(state.progress.profile.address)}!`}</h1>
        <p>${ready ? `Momo odebrał sygnał z planety ${html(stage.planet)}.` : 'Pakiet dźwięków i ćwiczeń nie został w pełni sprawdzony.'}</p>
      </div>
      <button id="startMission" class="launch-control" ${ready ? '' : 'disabled'}>
        <span class="launch-light" aria-hidden="true"></span>
        <span>${state.progress.activeSession ? 'Dokończ misję' : 'Start misji'}</span>
        <small>około 10 minut</small>
      </button>
    </div>
    <div class="planet-log card">
      <div class="planet-log-heading"><div class="planet-mini"><i>${theme.symbol}</i></div><div><p class="eyebrow">${html(stage.planet)}</p><h2>Odkrycia z wypraw</h2></div></div>
      <div class="discovery-shelf" aria-label="${discoveries.length} z 6 odkryć">${Array.from({ length: 6 }, (_, index) => {
        const discovery = discoveries[index];
        return `<span class="discovery-slot ${discovery ? 'found' : ''}" style="--i:${index}" aria-label="${discovery ? `Odkrycie ${index + 1}` : 'Jeszcze nieodkryte'}">${discovery?.symbol ?? '·'}</span>`;
      }).join('')}</div>
      <div class="mission-map" aria-label="Droga przez 12 planet">${CURRICULUM.stages.slice(1).map((value) => `<span class="map-node ${value.order < stage.order ? 'done' : value.order === stage.order ? 'current' : ''}"></span>`).join('')}</div>
      ${!ready ? '<div class="callout">Dziecko nie może rozpocząć samodzielnej misji, dopóki wszystkie wymagane pliki audio nie są zapisane i sprawdzone.</div>' : ''}
      <p class="small home-note">Misja ${sessionCount + 1} · spokojna wyprawa bez punktów i presji</p>
    </div>
  </section>`;
  state.justUnlockedStage = null;
  document.querySelector('#startMission')?.addEventListener('click', startMission);
}

async function startMission() {
  if (!state.progress.offline.verifiedAt) return;
  const created = !state.progress.activeSession;
  if (!state.progress.activeSession) {
    state.progress.activeSession = selectSession(state.progress);
  }
  state.showLaunch = created;
  state.view = 'session';
  state.meaningRevealed = false;
  state.buildSlots = [];
  render();
  if (created) setTimeout(() => {
    document.querySelector('.launch-sequence')?.classList.add('leaving');
    setTimeout(() => document.querySelector('.launch-sequence')?.remove(), 520);
    state.showLaunch = false;
  }, 850);
  if (created) await save();
}

function currentActivity() {
  return state.progress.activeSession?.activities[state.progress.activeSession.activityIndex];
}

function sessionProgress() {
  const session = state.progress.activeSession;
  if (!session) return 100;
  return Math.round((session.activityIndex / Math.max(1, session.activities.length - 1)) * 100);
}

const ACTIVITY_UI = {
  controls: ['Sterowanie statkiem', '✦'],
  warmup: ['Uruchom sygnał', '✦'],
  'hear-choose': ['Podłącz antenę', '◖'],
  mapping: ['Laboratorium znaku', '⌁'],
  blend: ['Zbuduj most światła', '↝'],
  build: ['Napraw ładownię', '◇'],
  meaning: ['Otwórz obserwatorium', '◎'],
  nonword: ['Sygnał kosmity', '☄'],
  story: ['Archiwum planety', '▤'],
  complete: ['Lądowanie', '★']
};

function activityUi(type) {
  const [label, icon] = ACTIVITY_UI[type] ?? ['Kosmiczne zadanie', '✦'];
  return { label, icon };
}

function graphemeLayout(parts) {
  const count = Math.max(1, parts.length);
  const tileFont = Math.max(1.35, Math.min(4.1, 11.5 / count));
  return `--grapheme-count:${count};--tile-font:${tileFont.toFixed(2)}rem`;
}

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function renderSession() {
  const session = state.progress.activeSession;
  if (!session) { state.view = 'home'; render(); return; }
  if (mustStop(session) && currentActivity()?.type !== 'complete') {
    session.activityIndex = session.activities.findIndex((value) => value.type === 'complete');
  }
  const activity = currentActivity();
  if (!activity) { completeMission(); return; }
  const ui = activityUi(activity.type);
  const theme = planetTheme(session.stage);
  const currentChapter = chapterFor(activity.type);
  const chapters = missionChapters(session);
  const instructionId = activity.type === 'meaning' && state.meaningRevealed ? 'choose-meaning' : activity.instructionId;
  state.activityStartedAt = performance.now();
  app.innerHTML = `<section class="screen session-screen planet-${theme.slug}" data-activity-type="${html(activity.type)}" data-chapter="${currentChapter.id}" style="--planet-accent:${theme.accent};--planet-deep:${theme.deep}">
    ${state.showLaunch ? '<div class="launch-sequence" aria-hidden="true"><span class="launch-ring one"></span><span class="launch-ring two"></span><span class="launch-ship">▲</span><strong>START MISJI</strong></div>' : ''}
    <div class="mission-deck" aria-hidden="true">
      <div class="deck-window"><span class="deck-planet"><i>${theme.symbol}</i></span><span class="passing-star star-a">✦</span><span class="passing-star star-b">✦</span></div>
      ${momo(`session-momo momo-${currentChapter.id}`)}
      <div class="engine-cells">${Array.from({ length: 5 }, (_, index) => `<span class="${sessionProgress() >= (index + 1) * 18 ? 'charged' : ''}"></span>`).join('')}</div>
    </div>
    <div class="mission-route" aria-label="Etapy misji">${chapters.map((chapter) => `<span class="route-stop ${chapterState(session, chapter)}" aria-label="${chapter.label}"><i>${chapterState(session, chapter) === 'done' ? '✓' : ''}</i><small>${chapter.label}</small></span>`).join('')}</div>
    <div class="mission-meta"><span>${session.repair ? 'Misja utrwalająca' : `Misja ${session.number}`}</span><span>${html(CURRICULUM.stages[session.stage].planet)}</span></div>
    <div class="card exercise-card activity-${html(activity.type)} chapter-${currentChapter.id}">
      <div class="activity-heading"><span class="activity-badge"><b>${ui.icon}</b>${ui.label}</span></div>
      <div class="instruction"><span class="speaker-orb">🔊</span><span id="instructionText">${instructionText(instructionId)}</span></div>
      <div class="play-zone">${activityMarkup(activity)}</div>
    </div>
  </section>`;
  requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
  bindActivity(activity);
  presentActivity(activity, instructionId);
}

async function presentActivity(activity, instructionId) {
  const token = ++state.presentationToken;
  const session = state.progress.activeSession;
  if (!session) return;
  await setInstruction(instructionId);
  if (token !== state.presentationToken) return;
  await pause(220);
  if (token !== state.presentationToken) return;
  if (activity.type === 'warmup') await playUnits(activity.item, '.sound-orb', token);
  if (activity.type === 'hear-choose') await audio.play(`sound-${activity.grapheme}`);
}

function instructionText(id) {
  return ({
    'controls-speaker': 'Dotknij głośnika, gdy chcesz usłyszeć polecenie jeszcze raz.',
    'controls-retry': 'Dotknij okrągłej strzałki, gdy chcesz spróbować albo zobaczyć jeszcze raz.',
    'controls-go': 'Dotknij strzałki, gdy zadanie jest gotowe.',
    'warmup-blend': 'Posłuchaj dźwięków. Połącz je w słowo.',
    'review-choose': 'Posłuchaj dźwięku. Dotknij pasującej litery.',
    'mapping-new': 'Poznajemy nowy znak. Dotknij go, aby usłyszeć dźwięk.',
    'blend-swipe': 'Poprowadź światło pod literami. Na końcu usłyszysz całe słowo.',
    'build-word': 'Ułóż litery w pustych polach.',
    'read-first': 'Przeczytaj słowo sam. Obrazki pojawią się później.',
    'choose-meaning': 'Wybierz obrazek, który pasuje do słowa.',
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

function learningUnits(item, stage) {
  // Jednosylabowe „ma” najpierw budujemy z m + a. Kiedy ta sylaba jest już
  // znana, dłuższe słowo pokazujemy na wyższym poziomie: ma + ma → mama.
  if (item.syllables?.length > 1) return item.syllables;
  return item.graphemes?.length ? item.graphemes : splitGraphemes(item.answer, stage);
}

function audioIdForUnit(unit) {
  if ([...unit].length === 1) return `sound-${unit}`;
  const slug = unit.toLocaleLowerCase('pl-PL').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-');
  return `word-${slug}`;
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
  if (activity.type === 'controls') return `<div class="control-tutorial" aria-label="Poznaj trzy przyciski sterowania">
    <button class="control-orb current" data-control-step="0" type="button" aria-label="Powtórz dźwięk"><span aria-hidden="true">🔊</span></button>
    <button class="control-orb" data-control-step="1" type="button" aria-label="Spróbuj ponownie" disabled><span aria-hidden="true">↻</span></button>
    <button class="control-orb go" data-control-step="2" type="button" aria-label="Dalej" disabled><span aria-hidden="true">➜</span></button>
  </div><p class="play-prompt">Momo pokaże po kolei trzy przyciski.</p>`;
  if (activity.type === 'warmup') {
    const target = activity.item;
    const parts = learningUnits(target, session.stage);
    const choices = activity.choices ?? [target];
    activity.choices = choices;
    return `<div class="signal-field"><span class="signal-dish" aria-hidden="true"></span><div class="sound-orbit" style="${graphemeLayout(parts)}" aria-label="${parts.length} dźwięki"><span class="orbit-thread"></span>${parts.map((_, index) => `<span class="sound-orb" style="--i:${index}"><i></i></span>`).join('')}</div></div><p class="play-prompt">Który kod przysłała planeta?</p><div class="choices word-choice-grid">${choices.map((item, index) => `<button class="choice word-choice" data-answer="${html(item.id)}" style="--i:${index}"><span class="landing-dot" aria-hidden="true"></span>${html(item.answer)}</button>`).join('')}</div>`;
  }
  if (activity.type === 'hear-choose') return `<div class="antenna-console"><div class="sound-console" aria-hidden="true"><span class="sound-core">♪</span><span class="sound-ring ring-one"></span><span class="sound-ring ring-two"></span><span class="sound-ring ring-three"></span></div><span class="signal-wire" aria-hidden="true"></span></div><p class="play-prompt">Dotknij anteny z pasującą literą.</p><div class="choices letter-choices">${activity.choices.map((choice, index) => `<button class="choice letter-choice antenna-pad" data-grapheme="${html(choice)}" style="--i:${index}"><i aria-hidden="true"></i><span>${html(choice)}</span></button>`).join('')}</div>`;
  if (activity.type === 'mapping') return `<div class="letter-scanner"><span class="scanner-ring" aria-hidden="true"></span><span class="scanner-beam" aria-hidden="true"></span><button id="mappingLetter" class="mapping-letter" aria-label="Litera ${html(activity.grapheme)}. Dotknij, aby usłyszeć dźwięk."><span>${html(activity.grapheme)}</span><small>${html(activity.capital)}</small></button></div><p class="play-prompt">Dotknij znaku. Każde dotknięcie uruchamia skaner.</p>${iconAction('mappingDone', '➜', 'Dalej')}`;
  if (activity.type === 'blend') {
    const parts = learningUnits(activity.item, session.stage);
    const duration = Math.max(1.1, 1 + parts.length * .14).toFixed(2);
    return `<div class="bridge-status" aria-hidden="true"><span></span><span></span><span></span><span></span></div><div class="blend-lab"><div class="graphemes" id="blendArea" style="${graphemeLayout(parts)};--beam-duration:${duration}s">${parts.map((part, index) => `<span class="grapheme" style="--i:${index}">${html(part)}</span>`).join('')}<span class="beam-track"></span><span class="beam" id="beam"><i></i></span></div></div><p class="play-prompt">Przeciągnij duże światło po szerokiej drodze.</p>${iconAction('blendStart', '↻', 'Momo pokazuje jeszcze raz')}<div id="blendResult" class="blend-result hidden"><span class="visually-hidden">Całe słowo</span><strong>${html(activity.item.answer)}</strong>${iconAction('blendReplay', '🔊', 'Posłuchaj całego słowa jeszcze raz', 'blend-replay')}</div>${iconAction('blendDone', '➜', 'Dalej', 'button secondary large hidden')}`;
  }
  if (activity.type === 'build') {
    const parts = learningUnits(activity.item, session.stage);
    activity.parts = parts;
    const tiles = shuffled(parts.map((value, index) => ({ value, index })), `${session.seed}:${activity.item.id}:tiles`);
    return `<div class="builder"><div class="cargo-machine" aria-hidden="true"><span></span><i></i></div><div class="sound-boxes" style="${graphemeLayout(parts)}">${parts.map((_, index) => `<span class="sound-box" data-slot="${index}" aria-label="Pole ${index + 1}"></span>`).join('')}</div><div class="cargo-bay"><span class="cargo-label">Moduły literowe</span><div class="tile-rack">${tiles.map((tile, index) => `<button class="tile" data-tile="${tile.index}" data-value="${html(tile.value)}" style="--i:${index}" aria-label="Litera ${html(tile.value)}. Dotknij lub przeciągnij.">${html(tile.value)}</button>`).join('')}</div></div></div><p class="play-prompt">Najłatwiej: dotknij litery. Możesz też ją przeciągnąć.</p>${iconAction('buildReset', '↻', 'Ułóż od początku', 'button secondary compact')}`;
  }
  if (activity.type === 'meaning') {
    if (!state.meaningRevealed) return `<div class="meaning-window shutters-closed"><span class="window-shutter shutter-left" aria-hidden="true"></span><span class="window-shutter shutter-right" aria-hidden="true"></span><span class="window-star star-one" aria-hidden="true">✦</span><span class="window-star star-two" aria-hidden="true">✦</span><div class="word-display">${html(activity.item.answer)}</div></div><p class="play-prompt">Najpierw przeczytaj. Okno otworzy się po próbie.</p>${iconAction('revealMeaning', '➜', 'Pokaż obrazki')}`;
    const candidates = shuffled(CURRICULUM.items.filter((item) => item.imageId && item.id !== activity.item.id), `${session.seed}:pictures`).slice(0, 3);
    activity.meaningChoices = shuffled([activity.item, ...candidates], `${session.seed}:picture-order`);
    return `<div class="word-chip">${html(activity.item.answer)}</div><p class="play-prompt">Wybierz właściwe okno.</p><div class="choices picture-choices observatory-choices">${activity.meaningChoices.map((item, index) => `<button class="choice picture porthole-choice" data-picture="${html(item.id)}" aria-label="${html(item.answer)}" style="--i:${index}">${pictureMarkup(item.answer)}</button>`).join('')}</div>`;
  }
  if (activity.type === 'nonword') return `<div class="alien-signal"><span class="alien-rings" aria-hidden="true">⌁</span><span class="alien-eye" aria-hidden="true"></span><div class="word-display">${html(activity.item.answer)}</div></div><p class="play-prompt">Kosmita wymyślił ten kod. Spróbuj go odczytać.</p>${iconAction('unverifiedDone', '➜', 'Dalej')}<p class="small">To spokojna próba bez oceniania.</p>`;
  if (activity.type === 'story') return `<div class="story-capsule"><span class="capsule-light" aria-hidden="true"></span><div class="story-progress" aria-label="Zdanie ${state.storyStep + 1} z ${activity.story.sentences.length}">${activity.story.sentences.map((_, index) => `<span class="${index < state.storyStep ? 'done' : index === state.storyStep ? 'current' : ''}"></span>`).join('')}</div><div class="story">${activity.story.sentences.map((sentence, index) => `<p class="story-line ${index === state.storyStep ? 'active' : ''}" data-story-line="${index}" ${index === state.storyStep ? '' : 'hidden'}>${html(sentence)}</p>`).join('')}</div></div><div class="button-row story-actions">${iconAction('storyListen', '🔊', 'Posłuchaj po próbie', `button secondary ${state.storyAttempted ? '' : 'is-disabled'}`)}${iconAction('storyAdvance', '➜', 'Dalej', 'button primary')}</div>`;
  return completionMarkup();
}

function bindActivity(activity) {
  if (activity.type === 'controls') {
    document.querySelector('[data-control-step="0"]').addEventListener('click', () => advanceControlTutorial(0, 'controls-retry'));
    document.querySelector('[data-control-step="1"]').addEventListener('click', () => advanceControlTutorial(1, 'controls-go'));
    document.querySelector('[data-control-step="2"]').addEventListener('click', async () => {
      state.progress.settings.controlsTaught = true;
      await save();
      finishActivity(activity, true, false);
    });
  } else if (activity.type === 'warmup') {
    document.querySelectorAll('[data-answer]').forEach((button) => button.addEventListener('click', () => objectiveAnswer(button, button.dataset.answer === activity.item.id, activity)));
  } else if (activity.type === 'hear-choose') {
    document.querySelectorAll('[data-grapheme]').forEach((button) => button.addEventListener('click', () => objectiveAnswer(button, button.dataset.grapheme === activity.grapheme, activity, `sound-${activity.grapheme}`)));
  } else if (activity.type === 'mapping') {
    document.querySelector('#mappingLetter').addEventListener('click', async (event) => {
      event.currentTarget.closest('.letter-scanner')?.classList.add('scanning');
      await audio.play(`sound-${activity.grapheme}`);
      setTimeout(() => event.currentTarget.closest('.letter-scanner')?.classList.remove('scanning'), 420);
    });
    document.querySelector('#mappingDone').addEventListener('click', () => finishActivity(activity, true));
  } else if (activity.type === 'blend') {
    const area = document.querySelector('#blendArea');
    const beam = document.querySelector('#beam');
    const startButton = document.querySelector('#blendStart');
    let dragStart = null;
    let running = false;
    const runBlend = async ({ fromDrag = false } = {}) => {
      if (running) return;
      running = true;
      state.presentationToken += 1;
      const token = state.presentationToken;
      startButton.disabled = true;
      document.querySelector('.blend-lab').classList.add('is-running');
      area.querySelectorAll('.grapheme').forEach((element) => element.classList.remove('is-crossed'));
      if (!fromDrag) {
        beam.classList.remove('moving');
        beam.style.transform = '';
        void beam.offsetWidth;
        beam.classList.add('moving');
      }
      area.classList.add('is-joining');
      beam.style.transform = '';
      beam.classList.add('at-end');
      await playUnits(activity.item, '.grapheme', token);
      if (token !== state.presentationToken) return;
      await pause(120);
      const played = await audio.play(activity.item.audioIds[0]);
      area.classList.remove('is-joining');
      if (!played || token !== state.presentationToken) return;
      area.querySelectorAll('.grapheme').forEach((element) => element.classList.add('was-sounded'));
      document.querySelector('#blendResult').classList.remove('hidden');
      document.querySelector('#blendDone').classList.remove('hidden');
    };
    startButton.addEventListener('click', () => runBlend(), { once: true });
    area.addEventListener('pointerdown', (event) => {
      if (running) return;
      dragStart = { x: event.clientX, pointerId: event.pointerId };
      area.setPointerCapture?.(event.pointerId);
      beam.classList.add('is-dragging');
    });
    area.addEventListener('pointermove', (event) => {
      if (!dragStart || running) return;
      const bounds = area.getBoundingClientRect();
      const travel = bounds.width * .9 - beam.offsetWidth;
      const progress = Math.max(0, Math.min(1, (event.clientX - bounds.left - bounds.width * .05) / travel));
      beam.style.transform = `translateX(${progress * travel}px)`;
      area.querySelectorAll('.grapheme').forEach((element, index, elements) => element.classList.toggle('is-crossed', progress >= index / Math.max(1, elements.length - 1)));
    });
    area.addEventListener('pointerup', (event) => {
      if (!dragStart || running) return;
      const bounds = area.getBoundingClientRect();
      const progress = (event.clientX - bounds.left) / Math.max(1, bounds.width);
      dragStart = null;
      beam.classList.remove('is-dragging');
      if (progress >= .68) runBlend({ fromDrag: true });
      else {
        area.classList.add('needs-more');
        setTimeout(() => area.classList.remove('needs-more'), 650);
      }
    });
    area.addEventListener('pointercancel', () => {
      dragStart = null;
      beam.classList.remove('is-dragging');
      beam.style.transform = '';
    });
    document.querySelector('#blendReplay').addEventListener('click', () => audio.play(activity.item.audioIds[0]));
    document.querySelector('#blendDone').addEventListener('click', () => finishActivity(activity, true));
  } else if (activity.type === 'build') {
    document.querySelectorAll('[data-tile]').forEach((button) => bindBuildTile(button, activity));
    document.querySelector('#buildReset').addEventListener('click', () => { state.buildSlots = []; renderSession(); });
  } else if (activity.type === 'meaning') {
    document.querySelector('#revealMeaning')?.addEventListener('click', () => { state.meaningRevealed = true; renderSession(); });
    document.querySelectorAll('[data-picture]').forEach((button) => button.addEventListener('click', () => objectiveAnswer(button, button.dataset.picture === activity.item.id, activity, `word-${activity.item.answer.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l')}`)));
  } else if (activity.type === 'nonword') {
    document.querySelector('#unverifiedDone').addEventListener('click', () => finishActivity(activity, true, false));
  } else if (activity.type === 'story') {
    document.querySelector('#storyListen').addEventListener('click', async () => { for (const id of activity.story.audioIds) await audio.play(id); });
    document.querySelector('#storyAdvance').addEventListener('click', () => {
      if (state.storyAttempted) { finishActivity(activity, true, false); return; }
      if (state.storyStep < activity.story.sentences.length - 1) {
        state.storyStep += 1;
        document.querySelectorAll('[data-story-line]').forEach((line, index) => {
          line.hidden = index !== state.storyStep;
          line.classList.toggle('active', index === state.storyStep);
        });
        document.querySelectorAll('.story-progress span').forEach((dot, index) => {
          dot.classList.toggle('done', index < state.storyStep);
          dot.classList.toggle('current', index === state.storyStep);
        });
        return;
      }
      state.storyAttempted = true;
      document.querySelector('#storyListen').disabled = false;
      document.querySelector('#storyListen').classList.remove('is-disabled');
      document.querySelector('.story-capsule')?.classList.add('story-complete');
    });
  } else if (activity.type === 'complete') {
    document.querySelector('#finishMission').addEventListener('click', completeMission);
  }
}

async function advanceControlTutorial(completedStep, nextInstructionId) {
  const current = document.querySelector(`[data-control-step="${completedStep}"]`);
  const next = document.querySelector(`[data-control-step="${completedStep + 1}"]`);
  current?.classList.remove('current');
  current?.classList.add('learned');
  if (next) {
    next.disabled = false;
    next.classList.add('current');
  }
  const text = document.querySelector('#instructionText');
  if (text) text.textContent = instructionText(nextInstructionId);
  await setInstruction(nextInstructionId);
}

async function playUnits(item, selector = null, token = state.presentationToken) {
  const parts = learningUnits(item, state.progress.activeSession.stage);
  const elements = selector ? [...document.querySelectorAll(selector)] : [];
  for (const [index, part] of parts.entries()) {
    if (token !== state.presentationToken) return false;
    elements[index]?.classList.add('is-sounding');
    await audio.play(audioIdForUnit(part));
    elements[index]?.classList.remove('is-sounding');
    elements[index]?.classList.add('was-sounded');
    await pause(70);
  }
  return true;
}

async function objectiveAnswer(button, correct, activity, modelAudio = null) {
  if (state.inputLocked) return;
  state.inputLocked = true;
  button.classList.add(correct ? 'correct' : 'retry');
  document.querySelector('.exercise-card')?.classList.add(correct ? 'is-correct' : 'is-retry');
  document.querySelector('.session-momo')?.classList.add(correct ? 'momo-happy' : 'momo-thinking');
  recordAttempt(state.progress, state.progress.activeSession, activity, { correct, answer: button.dataset.answer ?? button.dataset.grapheme ?? button.dataset.picture, latencyMs: performance.now() - state.activityStartedAt });
  if (correct) {
    await playSuccessFeedback();
  } else {
    await audio.play('retry-gentle');
    if (modelAudio) await audio.play(modelAudio);
  }
  await save();
  if (correct) {
    setTimeout(() => { state.inputLocked = false; nextActivity(); }, 520);
    return;
  }
  const answerSelector = activity.type === 'warmup'
    ? `[data-answer="${CSS.escape(activity.item.id)}"]`
    : activity.type === 'hear-choose'
      ? `[data-grapheme="${CSS.escape(activity.grapheme)}"]`
      : `[data-picture="${CSS.escape(activity.item.id)}"]`;
  const correctButton = document.querySelector(answerSelector);
  correctButton?.classList.add('guided');
  setTimeout(() => {
    button.classList.remove('retry');
    document.querySelector('.exercise-card')?.classList.remove('is-retry');
    document.querySelector('.session-momo')?.classList.remove('momo-thinking');
    state.inputLocked = false;
  }, 520);
}

async function playSuccessFeedback() {
  const session = state.progress.activeSession;
  if (!session) return false;
  const count = session.successFeedbackCount ?? 0;
  session.successFeedbackCount = count + 1;
  return audio.play(count % 2 === 0 ? 'correct-short' : 'correct-choice', { required: false });
}

function bindBuildTile(button, activity) {
  let origin = null;
  let ghost = null;
  let dragged = false;
  const clearDrag = () => {
    ghost?.remove();
    ghost = null;
    button.classList.remove('drag-source');
  };
  const move = (event) => {
    if (!origin) return;
    if (!dragged && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 12) {
      dragged = true;
      ghost = button.cloneNode(true);
      ghost.className = 'tile drag-ghost';
      document.body.append(ghost);
      button.classList.add('drag-source');
    }
    if (ghost) {
      event.preventDefault();
      ghost.style.left = `${event.clientX}px`;
      ghost.style.top = `${event.clientY}px`;
    }
  };
  const end = (event) => {
    if (!origin) return;
    const exactTarget = dragged ? document.elementFromPoint(event.clientX, event.clientY)?.closest('.sound-box') : null;
    const nearestTarget = dragged ? [...document.querySelectorAll('.sound-box:not(.filled)')]
      .map((slot) => {
        const bounds = slot.getBoundingClientRect();
        return { slot, distance: Math.hypot(event.clientX - (bounds.left + bounds.width / 2), event.clientY - (bounds.top + bounds.height / 2)) };
      })
      .sort((a, b) => a.distance - b.distance)[0] : null;
    const dropTarget = exactTarget ?? (nearestTarget?.distance <= 96 ? nearestTarget.slot : null);
    origin = null;
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', end);
    document.removeEventListener('pointercancel', cancel);
    clearDrag();
    if (dragged) {
      event.preventDefault();
      if (dropTarget) addBuildTile(button, activity, Number(dropTarget.dataset.slot), false);
      else {
        button.classList.add('soft-wobble');
        setTimeout(() => button.classList.remove('soft-wobble'), 450);
      }
    }
  };
  const cancel = () => {
    origin = null;
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', end);
    document.removeEventListener('pointercancel', cancel);
    clearDrag();
  };
  button.addEventListener('pointerdown', (event) => {
    if (state.inputLocked || button.classList.contains('used')) return;
    origin = { x: event.clientX, y: event.clientY };
    dragged = false;
    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', cancel);
  });
  button.addEventListener('click', () => {
    if (dragged) { dragged = false; return; }
    addBuildTile(button, activity);
  });
  button.draggable = true;
  button.addEventListener('dragstart', (event) => {
    event.dataTransfer?.setData('text/plain', button.dataset.tile);
    event.dataTransfer?.setDragImage(button, button.offsetWidth / 2, button.offsetHeight / 2);
    button.classList.add('drag-source');
  });
  button.addEventListener('dragend', () => button.classList.remove('drag-source'));
  document.querySelectorAll('.sound-box').forEach((slot) => {
    slot.addEventListener('dragover', (event) => event.preventDefault());
    slot.addEventListener('drop', (event) => {
      event.preventDefault();
      if (event.dataTransfer?.getData('text/plain') === button.dataset.tile) addBuildTile(button, activity, Number(slot.dataset.slot), false);
    });
  });
}

async function animateTileToSlot(button, slot) {
  if (!button.animate || !slot) return;
  const from = button.getBoundingClientRect();
  const to = slot.getBoundingClientRect();
  const ghost = button.cloneNode(true);
  ghost.className = 'tile tile-flight';
  Object.assign(ghost.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
  document.body.append(ghost);
  await ghost.animate([
    { transform: 'translate(0, 0) scale(1)', offset: 0 },
    { transform: `translate(${(to.left + to.width / 2) - (from.left + from.width / 2)}px, ${(to.top + to.height / 2) - (from.top + from.height / 2) - 10}px) scale(1.12)`, offset: .7 },
    { transform: `translate(${(to.left + to.width / 2) - (from.left + from.width / 2)}px, ${(to.top + to.height / 2) - (from.top + from.height / 2)}px) scale(.82)`, offset: 1 }
  ], { duration: 360, easing: 'cubic-bezier(.22,.8,.3,1)' }).finished.catch(() => undefined);
  ghost.remove();
}

async function addBuildTile(button, activity, requestedSlot = null, animate = true) {
  if (state.inputLocked || button.classList.contains('used')) return;
  const openSlot = requestedSlot ?? Array.from({ length: activity.parts.length }, (_, index) => index).find((index) => !state.buildSlots[index]);
  if (openSlot == null || state.buildSlots[openSlot]) {
    document.querySelector(`[data-slot="${openSlot}"]`)?.classList.add('soft-wobble');
    return;
  }
  const slot = document.querySelector(`[data-slot="${openSlot}"]`);
  state.inputLocked = true;
  if (animate) await animateTileToSlot(button, slot);
  button.classList.add('used');
  state.buildSlots[openSlot] = { value: button.dataset.value, tile: button.dataset.tile };
  slot.textContent = button.dataset.value;
  slot.classList.add('filled');
  state.inputLocked = false;
  if (state.buildSlots.filter(Boolean).length !== activity.parts.length) return;
  const answer = state.buildSlots.map((value) => value.value).join('');
  const correct = answer === activity.parts.join('');
  if (correct) {
    document.querySelector('.builder')?.classList.add('is-complete');
    await pause(420);
    state.buildSlots = [];
    await finishActivity(activity, true);
  } else {
    recordAttempt(state.progress, state.progress.activeSession, activity, { correct: false, answer, latencyMs: performance.now() - state.activityStartedAt });
    const mismatch = state.buildSlots.findIndex((value, index) => value.value !== activity.parts[index]);
    const wrongSlot = document.querySelector(`[data-slot="${mismatch}"]`);
    wrongSlot?.classList.add('needs-fix');
    await audio.play('retry-gentle');
    if (activity.parts[mismatch]) await audio.play(audioIdForUnit(activity.parts[mismatch]));
    await save();
    for (let index = mismatch; index < state.buildSlots.length; index += 1) {
      const placedTile = state.buildSlots[index];
      document.querySelector(`[data-tile="${placedTile?.tile}"]`)?.classList.remove('used');
      const slot = document.querySelector(`[data-slot="${index}"]`);
      if (slot) { slot.textContent = ''; slot.classList.remove('filled'); }
      state.buildSlots[index] = null;
    }
    setTimeout(() => wrongSlot?.classList.remove('needs-fix'), 700);
    state.inputLocked = false;
  }
}

async function finishActivity(activity, correct, verified = true) {
  if (state.inputLocked) return;
  state.inputLocked = true;
  recordAttempt(state.progress, state.progress.activeSession, activity, { correct, verified, latencyMs: performance.now() - state.activityStartedAt });
  if (correct && verified) await playSuccessFeedback();
  await save();
  state.inputLocked = false;
  nextActivity();
}

async function nextActivity() {
  const session = state.progress.activeSession;
  state.presentationToken += 1;
  audio.stop();
  session.activityIndex += 1;
  state.meaningRevealed = false;
  state.buildSlots = [];
  state.storyStep = 0;
  state.storyAttempted = false;
  if (!canBeginNextActivity(session) && session.activities[session.activityIndex]?.type !== 'complete') {
    session.activityIndex = session.activities.findIndex((value) => value.type === 'complete');
  }
  await save();
  renderSession();
}

function completionMarkup() {
  const session = state.progress.activeSession;
  const theme = planetTheme(session.stage);
  const discoveryCount = discoveriesFor(state.progress, session.stage).length;
  return `<div class="completion"><div class="landing-scene" aria-hidden="true"><span class="landing-planet"><i>${theme.symbol}</i></span><span class="landing-rocket">▲</span><span class="landing-beam"></span><span class="next-discovery" style="--slot:${discoveryCount % 6}">✦</span>${momo('landing-momo momo-happy')}</div><h2>Lądowanie udane!</h2><p>Momo znalazł nowe odkrycie na planecie ${html(CURRICULUM.stages[session.stage].planet)}. Zobaczysz je po powrocie do statku.</p>${session.number % 5 === 0 ? '<div class="callout">W trybie rodzica czeka pięcioelementowa próba czytania. Nie blokuje kolejnej misji.</div>' : ''}${iconAction('finishMission', '⌂', 'Wróć do statku')}</div>`;
}

async function completeMission() {
  if (state.sessionCompleted || !state.progress.activeSession) return;
  state.sessionCompleted = true;
  state.presentationToken += 1;
  audio.stop();
  const completedStage = state.progress.activeSession.stage;
  const completedNumber = state.progress.activeSession.number;
  const priorStage = state.progress.currentStage;
  addDiscovery(state.progress, completedStage, completedNumber);
  finalizeSession(state.progress, state.progress.activeSession);
  if (state.progress.currentStage > priorStage) state.justUnlockedStage = state.progress.currentStage;
  await save();
  state.sessionCompleted = false;
  state.view = 'home';
  render();
}

function renderParent() {
  const progress = state.progress;
  const sessions = progress.sessions;
  const latest = sessions.at(-1);
  const lessonNotes = teachingNotesForStage(progress.currentStage);
  const currentLessonIndex = lessonIndexFor(progress, progress.currentStage);
  const currentLesson = lessonNotes[currentLessonIndex];
  const discoveryTotal = Object.values(ensureExploration(progress).discoveriesByStage).reduce((sum, entries) => sum + entries.length, 0);
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
      <div class="stat"><span>Odkrycia</span><strong>${discoveryTotal}</strong></div>
    </div></div>
    <div class="card"><p class="eyebrow">Etapy i umiejętności</p><h2>Droga przez planety</h2>
      <div class="table-wrap"><table><thead><tr><th>Etap</th><th>Nowe znaki</th><th>Status</th></tr></thead><tbody>${CURRICULUM.stages.slice(1).map((stage) => `<tr><td>${stage.order}. ${html(stage.planet)}</td><td>${html(stage.introducedGraphemes.join(' · '))}</td><td>${stage.order < progress.currentStage ? 'ukończony' : stage.order === progress.currentStage ? 'w toku' : 'później'}</td></tr>`).join('')}</tbody></table></div>
      <p class="small">Znaki etapu bieżącego: ${CURRICULUM.stages[progress.currentStage].introducedGraphemes.map((grapheme) => `${html(grapheme)} — ${progress.mastery[`grapheme:${grapheme}`]?.provisional ? 'opanowany w próbach mieszanych' : `${progress.mastery[`grapheme:${grapheme}`]?.trials ?? 0}/12 prób`}`).join('; ') || 'płynność tekstu i zbitki spółgłoskowe'}.</p>
    </div>
    <div class="card"><p class="eyebrow">Kolejność wewnątrz planety</p><h2>Lekcja ${currentLessonIndex + 1} z ${lessonNotes.length}</h2>
      <p><strong>${currentLesson?.focusGrapheme ? `Nowy znak: ${html(currentLesson.focusGrapheme)}` : 'Utrwalenie i transfer'}</strong><br>${html(currentLesson?.purpose ?? '')}</p>
      <div class="lesson-sequence">${lessonNotes.map((lesson, index) => `<div class="lesson-step ${index < currentLessonIndex ? 'done' : index === currentLessonIndex ? 'current' : ''}"><span>${index + 1}</span><div><strong>${lesson.focusGrapheme ? html(lesson.focusGrapheme) : 'utrw.'}</strong><small>${html(lesson.targetAnswers.slice(0, 6).join(' · ') || 'dźwięk i znak')}</small></div></div>`).join('')}</div>
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
  state.presentationToken += 1;
  if (state.lastInstruction) audio.play(state.lastInstruction);
});

const openParentGate = () => {
  if (gate.open) return;
  state.presentationToken += 1;
  audio.stop();
  parentCode.value = '';
  gate.showModal();
  setTimeout(() => parentCode.focus(), 50);
};
parentButton.addEventListener('click', openParentGate);
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

document.addEventListener('visibilitychange', () => { if (document.hidden) { state.presentationToken += 1; audio.stop(); } });
window.addEventListener('pagehide', () => { state.presentationToken += 1; audio.stop(); });

init();
