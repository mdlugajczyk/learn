import { LESSONS, WORDS, CHARACTERS, COURSE_REVISION, makeLesson, promptFor, unitAudio, emptyProgress, validateProgress, sessionResult, STORAGE_KEY } from './course.js';
import { Narrator } from './audio.js';

const app = document.querySelector('#app');
const narrator = new Narrator();
let progress = emptyProgress(), view = 'home', token = 0, busy = false, offline = false, storageWarning = false;
try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) progress = validateProgress(JSON.parse(saved)); } catch { storageWarning = true; }
const icons = {
  play: '<path d="M8 5 19 12 8 19Z" fill="currentColor"/>',
  next: '<path d="M4 12h15M13 5l7 7-7 7"/>',
  replay: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
  speaker: '<path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  home: '<path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/>',
  parent: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  help: '<path d="M8 8a4 4 0 1 1 7 3c-2 1-3 2-3 4M12 19h.01"/><circle cx="12" cy="12" r="10"/>',
  check: '<path d="m5 12 5 5L20 6"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const button = (id, name, label, className = 'icon') => `<button id="${id}" class="${className}" aria-label="${label}">${icon(name)}</button>`;
const image = (name, className = 'art', alt = '') => `<img class="${className}" src="assets/${name.toLowerCase()}.webp" alt="${alt}" draggable="false">`;
const pause = ms => new Promise(resolve => setTimeout(resolve, progress.settings.motion ? ms : Math.min(ms, 120)));
const current = () => progress.active?.steps[progress.active.index];
const stepState = () => progress.active.states[progress.active.index] ??= { mistakes: 0, assisted: false, done: false };
function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch { storageWarning = true; } }
function resetPlayback() { token++; busy = false; narrator.stop(); }
function header(playing = false) {
  return `<header class="topbar">${button('home', 'home', 'Wróć do książeczki')}<span class="wordmark">MIMI<span>●</span></span>${playing ? button('speaker', 'speaker', 'Powtórz polecenie') : button('parent', 'parent', 'Dla rodzica')}</header>`;
}
function bindHeader() {
  document.querySelector('#home')?.addEventListener('click', () => { resetPlayback(); view = 'home'; renderHome(); });
  document.querySelector('#parent')?.addEventListener('click', openParentGate);
  document.querySelector('#speaker')?.addEventListener('click', () => {
    if (busy) { renderStep(); return; }
    void guarded(() => present(current(), token));
  });
}

function renderHome() {
  view = 'home';
  document.body.classList.toggle('motion-off', !progress.settings.motion);
  const index = progress.active?.lesson ?? progress.selected;
  app.innerHTML = `<div class="shell home">${header()}<p class="eyebrow">Pierwsze słowa</p><h1>Czytamy z MIMI</h1><div class="storybook"><div class="family">${image('MIMI', 'art', 'Mimi z jasnymi plamkami')}${image('MAMA', 'art', 'Mama w czerwonej sukience')}</div></div><button id="start" class="start" aria-label="${progress.active ? 'Dokończ zabawę' : 'Zacznij czytać'}">${icon('play')}<span class="start-label">${progress.active ? 'Gramy dalej!' : 'Zaczynamy!'}</span></button><p class="book-number">${index + 1}. ${LESSONS[index].title}</p><nav class="bookmarks" aria-label="Książeczki">${LESSONS.map((lesson, i) => `<button class="bookmark ${i === index ? 'current' : i < progress.unlocked ? 'done' : ''}" data-lesson="${i}" ${i > progress.unlocked ? 'disabled' : ''} aria-label="${lesson.title}${i > progress.unlocked ? ', jeszcze nieodkryta' : ''}" ${i === index ? 'aria-current="step"' : ''}>${i < progress.unlocked ? icon('check') : i + 1}</button>`).join('')}</nav><p id="offlineStatus" class="offline" role="status">${offline ? '✓ Książeczka dostępna offline' : 'Książeczka zapisuje się na później…'}</p><a class="all-games" href="../">Wszystkie zabawy</a></div>`;
  bindHeader();
  document.querySelector('#home').onclick = () => location.assign('../');
  document.querySelectorAll('[data-lesson]').forEach(el => el.addEventListener('click', () => {
    progress.selected = Number(el.dataset.lesson);
    if (progress.active?.lesson !== progress.selected) progress.active = null;
    save(); renderHome();
  }));
  document.querySelector('#start').addEventListener('click', () => void guarded(async () => {
    document.querySelector('#start').disabled = true;
    if (!progress.active) {
      progress.active = { revision: COURSE_REVISION, lesson: progress.selected, steps: makeLesson(progress.selected), index: 0, states: {}, answers: [], started: Date.now() };
      save();
    }
    renderStep();
  }));
}

async function guarded(action) {
  try { await action(); } catch (error) {
    console.warn('Mimi audio unavailable:', error.message);
    resetPlayback();
    showDialog(`<h2>Wróćmy do dźwięku</h2><p>Dotknij strzałki, aby wznowić dźwięk. Jeśli nadal nic nie słychać, sprawdź wyjście dźwięku — słuchawki, Bluetooth lub AirPlay. Jeśli brakuje nagrania, otwórz książeczkę raz z internetem.</p>${button('recover', 'play', 'Spróbuj ponownie', 'start')}<button id="audioHome">Wróć do książeczek</button>`);
    document.querySelector('#recover').onclick = () => { closeDialog(); void guarded(() => { view === 'session' ? renderStep() : renderHome(); }); };
    document.querySelector('#audioHome').onclick = () => { closeDialog(); renderHome(); };
  }
}

function renderStep() {
  resetPlayback();
  view = 'session';
  const session = progress.active, step = current(), state = stepState();
  const revision = token;
  app.innerHTML = `<div class="shell session">${header(true)}<div class="page-progress" aria-label="Zadanie ${session.index + 1} z ${session.steps.length}"><span style="width:${100 * (session.index + 1) / session.steps.length}%"></span></div><section class="play-page ${step.type}" data-step="${step.type}">${stepMarkup(step)}</section><footer class="play-controls"><div>${step.type === 'read' ? button('help', 'help', 'Przeczytajmy razem — z pomocą') : ''}</div><div id="feedback" role="status" aria-live="polite"></div>${button('next', 'next', 'Dalej', 'next icon')}</footer></div>`;
  bindHeader();
  document.querySelector('#next').hidden = !state.done;
  document.querySelector('#next').onclick = next;
  document.querySelector('#help')?.addEventListener('click', () => {
    if (busy || state.done) return;
    state.assisted = true; save();
    document.querySelector('#help').disabled = true;
    void guarded(async () => { busy = true; await narrator.play('help'); if (revision !== token) return; await modelTarget(step.target, revision, true); if (revision === token) { busy = false; document.querySelector('#help').disabled = false; } });
  });
  document.querySelector('#modelPlay')?.addEventListener('click', () => void guarded(() => playModel(step, revision)));
  document.querySelector('#letter')?.addEventListener('click', () => void guarded(async () => {
    if (busy) return;
    busy = true;
    const el = document.querySelector('#letter'); el.classList.add('sounding');
    await narrator.play(unitAudio(step.target));
    if (revision !== token) return;
    el.classList.remove('sounding'); finishTeaching(); busy = false;
  }));
  document.querySelectorAll('[data-answer]').forEach(el => el.addEventListener('click', () => void guarded(() => answer(el, step, revision))));
  if (state.done) restoreCompleted(step);
  else void guarded(() => present(step, revision));
}

function targetMarkup(target) {
  return target.split(' ').map((word, index) => `<span data-target-word="${index}">${WORDS[word]?.length === 2 && WORDS[word].every(unit => unit.length === 2) ? WORDS[word].map((unit, i) => `<span class="syllable syllable-${i}">${unit}</span>`).join('') : word}</span>`).join(' ');
}
function characterCards(step, demo = false) {
  return `<div class="scene scene-${progress.active.index % 3} ${step.characters.length === 3 ? 'three' : ''}">${step.characters.map(name => step.parts ? `<div class="character-part-card">${image(name, 'art')}<div class="part-lenses">${step.parts.map(part => `<button class="part-lens" data-answer="${name} ${part}" aria-label="${name}, ${part}" ${demo ? 'disabled' : ''}><img src="assets/${name.toLowerCase()}-${part.toLowerCase()}.webp" alt="" draggable="false"></button>`).join('')}</div></div>` : `<button class="character" data-answer="${name}" aria-label="${name}" ${demo ? 'disabled' : ''}>${image(name)}</button>`).join('')}</div>`;
}
function stepMarkup(step) {
  if (step.type === 'meet') return `<p class="little-label">Poznajemy się</p><div class="meet-family">${step.characters.map(name => `<div>${image(name)}<span class="name-tag">${name}</span></div>`).join('')}</div>`;
  if (step.type === 'letter') return `<p class="little-label">Posłuchaj dźwięku</p><button class="big-letter" id="letter" aria-label="Posłuchaj dźwięku litery ${step.target}">${step.target}<span>${icon('speaker')}</span></button>`;
  if (step.type === 'blend' || step.type === 'word') return `<p class="little-label">${step.type === 'blend' ? 'Łączymy dźwięki' : 'Z kawałków — całe słowo'}</p>${step.type === 'word' && CHARACTERS.includes(step.target) ? image(step.target, 'art word-friend') : ''}<div class="word-lab" id="wordLab"><div class="units">${step.units.map((unit, i) => `${i ? `<span class="join-sign" aria-hidden="true">${step.type === 'word' ? '–' : '+'}</span>` : ''}<span class="unit ${step.type === 'word' ? `syllable-${i}` : ''}" data-unit="${i}">${unit}</span>`).join('')}</div><div class="stretch" aria-hidden="true">${step.type === 'blend' && ['M','L','N'].includes(step.units[0]) ? step.units[0].repeat(4) + step.units[1] : step.units.join('')}</div><strong class="whole" aria-hidden="true">${step.target}</strong><div class="blend-track"><span></span></div></div><div class="model-actions">${button('modelPlay', 'play', 'Pokaż, jak łączymy', 'model-play start')}</div>`;
  if (step.type === 'contrast') return `<p class="little-label">Posłuchaj i znajdź</p><div class="listen-mark">${icon('speaker')}</div><div class="contrast-options">${step.options.map(option => `<button class="syllable-choice" data-answer="${option}">${option}</button>`).join('')}</div>`;
  return `<div class="reading-card"><p class="little-label">${step.type === 'body-demo' ? 'Czytamy dwa słowa' : 'Przeczytaj i dotknij'}</p><h1 class="reading-target ${step.target.includes(' ') ? 'phrase' : ''}">${targetMarkup(step.target)}</h1></div>${characterCards(step, step.type === 'body-demo')}`;
}

async function present(step, revision) {
  if (revision !== token) return;
  const played = await narrator.play(promptFor(step));
  if (!played || revision !== token) return;
  if (step.type === 'contrast') await narrator.play(unitAudio(step.target));
  if (revision !== token) return;
  if (step.type === 'meet') finishTeaching();
  if (step.type === 'body-demo') {
    await modelTarget(step.target, revision);
    if (revision !== token) return;
    document.querySelector(`[data-answer="${step.target}"]`)?.classList.add('guided');
    finishTeaching();
  }
}
async function playModel(step, revision) {
  if (busy) return;
  busy = true;
  narrator.stop();
  const lab = document.querySelector('#wordLab'), play = document.querySelector('#modelPlay');
  document.querySelector('#next').hidden = true;
  lab.className = 'word-lab'; play.disabled = true;
  lab.querySelector('.whole').setAttribute('aria-hidden', 'true');
  lab.querySelectorAll('.unit').forEach(el => el.classList.remove('active', 'heard'));
  lab.querySelectorAll('.join-sign').forEach(el => el.textContent = step.type === 'word' ? '–' : '+');
  if (step.type === 'blend') {
    await narrator.play(`blend-${step.target.toLowerCase()}`, { onProgress: fraction => {
      if (revision !== token) return;
      lab.style.setProperty('--blend-progress', fraction);
      lab.classList.toggle('stretching', fraction > .12);
      lab.classList.toggle('collapsing', fraction > .75);
    } });
    if (revision !== token) return;
  } else {
    for (const [index, unit] of step.units.entries()) {
      const el = lab.querySelector(`[data-unit="${index}"]`);
      el.classList.add('active');
      await narrator.play(unitAudio(unit));
      if (revision !== token) return;
      el.classList.remove('active'); el.classList.add('heard');
      await pause(160);
    }
    lab.classList.add('hyphenated');
    lab.querySelectorAll('.join-sign').forEach(el => el.textContent = '–');
    await pause(520);
    if (revision !== token) return;
  }
  lab.classList.add('assembled');
  lab.querySelector('.whole').setAttribute('aria-hidden', 'false');
  await pause(220);
  if (revision !== token) return;
  await narrator.play(`word-${step.target.toLowerCase()}`);
  if (revision !== token) return;
  play.innerHTML = icon('replay'); play.setAttribute('aria-label', 'Pokaż jeszcze raz'); play.disabled = false;
  finishTeaching(); busy = false;
}
async function modelTarget(target, revision, withChunks = false) {
  for (const [index, word] of target.split(' ').entries()) {
    if (revision !== token) return;
    const el = document.querySelector(`[data-target-word="${index}"]`);
    el?.classList.add('active');
    if (withChunks && WORDS[word]) {
      for (const unit of WORDS[word]) { await narrator.play(unitAudio(unit)); if (revision !== token) return; await pause(140); }
    }
    await narrator.play(`word-${word.toLowerCase()}`);
    if (revision !== token) return;
    el?.classList.remove('active');
  }
}
function finishTeaching() { stepState().done = true; save(); document.querySelector('#next').hidden = false; }
function restoreCompleted(step) {
  if (['blend', 'word'].includes(step.type)) {
    document.querySelector('#wordLab').classList.add('assembled');
    document.querySelector('#wordLab .whole').setAttribute('aria-hidden', 'false');
    document.querySelector('#modelPlay').innerHTML = icon('replay');
  }
  if (['read', 'contrast'].includes(step.type)) {
    document.querySelectorAll('[data-answer]').forEach(el => { el.disabled = true; if (el.dataset.answer === step.target) el.classList.add('correct'); });
    document.querySelector('#feedback').innerHTML = icon('check');
  }
}
async function answer(el, step, revision) {
  const state = stepState();
  if (busy || state.done) return;
  busy = true;
  if (el.dataset.answer !== step.target) {
    state.mistakes++; save();
    el.classList.add('try-again');
    await narrator.play('retry');
    if (revision !== token) return;
    el.classList.remove('try-again'); busy = false;
    if (state.mistakes >= 2) document.querySelector('#help')?.classList.add('invite');
    return;
  }
  state.done = true;
  progress.active.answers.push({ step: step.id, type: step.type, target: step.target, correct: true, assisted: state.assisted, mistakes: state.mistakes });
  save();
  el.classList.add('correct');
  document.querySelector('#feedback').innerHTML = icon('check');
  document.querySelectorAll('[data-answer]').forEach(button => button.disabled = true);
  await narrator.play(progress.active.answers.length % 2 ? 'correct-1' : 'correct-2');
  if (revision !== token) return;
  if (step.type === 'read') await modelTarget(step.target, revision);
  else await narrator.play(unitAudio(step.target));
  if (revision !== token) return;
  document.querySelector('#next').hidden = false; busy = false;
}
function next() {
  if (busy || !stepState().done) return;
  progress.active.index++;
  if (progress.active.index === progress.active.steps.length) { complete(); return; }
  save(); renderStep();
}
function complete() {
  const result = sessionResult(progress.active);
  progress.history = [...progress.history, result].slice(-100);
  if (result.passed) progress.unlocked = Math.min(LESSONS.length - 1, Math.max(progress.unlocked, result.lesson + 1));
  progress.selected = result.passed ? progress.unlocked : result.lesson;
  progress.active = null; save(); resetPlayback(); view = 'complete';
  app.innerHTML = `<div class="shell home">${header()}<p class="eyebrow">Koniec książeczki</p><h1>Brawo!</h1><div class="finish-art">${image('MIMI')}<span class="finish-check">${icon('check')}</span></div><p class="finish-copy">Czas na przerwę.<br>Mimi poczeka na kolejną zabawę.</p>${button('finishHome', 'home', 'Wróć do książeczek', 'start')}</div>`;
  bindHeader(); document.querySelector('#finishHome').onclick = () => { resetPlayback(); renderHome(); };
  void guarded(() => narrator.play('finish'));
}

function showDialog(markup) {
  document.querySelector('dialog')?.remove();
  const dialog = document.createElement('dialog'); dialog.className = 'parent-dialog';
  dialog.innerHTML = `<div class="dialog-content">${markup}</div>`; document.body.append(dialog); dialog.showModal();
  dialog.addEventListener('cancel', () => { resetPlayback(); view === 'session' ? renderStep() : renderHome(); });
}
function closeDialog() { document.querySelector('dialog')?.close(); document.querySelector('dialog')?.remove(); }
function openParentGate() {
  resetPlayback();
  showDialog(`<form id="parentGate"><h2>Dla rodzica</h2><p>Wpisz RODZIC, aby otworzyć ustawienia.</p><label for="parentCode">Hasło do ustawień</label><input id="parentCode" autocomplete="off" autocapitalize="characters" spellcheck="false" required><p id="gateError" role="status"></p><div class="dialog-buttons"><button type="button" id="cancelGate">Wróć</button><button type="submit" class="primary">Otwórz</button></div></form>`);
  document.querySelector('#cancelGate').onclick = closeDialog;
  document.querySelector('#parentGate').onsubmit = event => {
    event.preventDefault();
    if (document.querySelector('#parentCode').value.trim().toUpperCase() === 'RODZIC') renderParent();
    else document.querySelector('#gateError').textContent = 'Wpisz słowo RODZIC.';
  };
}
function renderParent() {
  closeDialog();
  const recent = progress.history.slice(-8).reverse();
  showDialog(`<h2>Małe kroki z MIMI</h2><p>Najpierw dźwięki i sylaby, potem słowo i jego znaczenie. Pierwsza książeczka zostaje przy MA, MI, MAMA i MIMI.</p><label for="lessonSelect">Książeczka na następną zabawę</label><select id="lessonSelect">${LESSONS.map((lesson, index) => `<option value="${index}" ${progress.selected === index ? 'selected' : ''}>${index + 1}. ${lesson.title}</option>`).join('')}</select><button id="chooseLesson" class="primary">Wybierz książeczkę</button><label class="toggle"><input type="checkbox" id="motion" ${progress.settings.motion ? 'checked' : ''}> Spokojne animacje</label><h3>Ostatnie zabawy</h3>${recent.length ? `<ul class="history">${recent.map(result => `<li><strong>${LESSONS[result.lesson].title}</strong><span>${result.independent}/${result.readingTrials} trafień w pierwszej próbie<br>${result.supported} z pomocą lub po poprawce</span></li>`).join('')}</ul>` : '<p>Jeszcze nie ukończono książeczki.</p>'}<p class="parent-note">To wynik wyborów obrazków, nie ocena czytania na głos. Kolejna książeczka otwiera się po 80% trafień bez pomocy w co najmniej czterech zadaniach. Możesz wybrać dowolną książeczkę powyżej.</p><h3>Na tym urządzeniu</h3><p>${offline ? '✓ Pełny pakiet jest dostępny offline.' : 'Otwórz książeczkę online i zaczekaj na zapis plików.'}${storageWarning ? ' Uwaga: przeglądarka nie zapisała części postępów. Wyeksportuj kopię przed zamknięciem.' : ''}</p><div class="dialog-buttons"><button id="export">Zapisz postęp</button><label class="file-button">Wczytaj kopię<input type="file" id="import" accept="application/json,.json"></label></div><p id="importStatus" role="status"></p><details><summary>Instalacja i dźwięk</summary><p>iPhone / iPad: w Safari wybierz Udostępnij → Do ekranu początkowego. Android: menu Chrome → Zainstaluj aplikację.</p><p>Nagrania są wygenerowane przez ElevenLabs. Krótkie nagrania głosek warto wspólnie odsłuchać przy pierwszej zabawie.</p><p>Postęp MIMI jest osobny od poprzedniej aplikacji i zapisuje się tylko na tym urządzeniu.</p></details><button id="reset">Wyzeruj postęp MIMI</button><button id="closeParent" class="primary">Wróć do MIMI</button>`);
  document.querySelector('#closeParent').onclick = () => { closeDialog(); renderHome(); };
  document.querySelector('#chooseLesson').onclick = () => {
    progress.selected = Number(document.querySelector('#lessonSelect').value);
    progress.unlocked = Math.max(progress.selected, progress.unlocked);
    progress.active = null; save(); closeDialog(); renderHome();
  };
  document.querySelector('#motion').onchange = event => { progress.settings.motion = event.target.checked; save(); document.body.classList.toggle('motion-off', !progress.settings.motion); };
  document.querySelector('#export').onclick = async () => {
    const data = JSON.stringify(progress), digest = await checksum(data);
    const url = URL.createObjectURL(new Blob([JSON.stringify({ app: 'mimi', data, checksum: digest })], {type:'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = 'mimi-postep.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  document.querySelector('#import').onchange = async event => {
    try {
      const file = event.target.files[0]; if (!file) return;
      if (file.size > 2 * 1024 * 1024) throw new Error('Za duży plik.');
      const backup = JSON.parse(await file.text());
      if (backup.app !== 'mimi' || typeof backup.data !== 'string' || backup.checksum !== await checksum(backup.data)) throw new Error('Nieprawidłowa kopia.');
      const imported = validateProgress(JSON.parse(backup.data));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
      progress = imported; renderParent();
    } catch { document.querySelector('#importStatus').textContent = 'Nie udało się wczytać kopii. Obecny postęp pozostaje bez zmian.'; }
  };
  document.querySelector('#reset').onclick = () => {
    if (confirm('Usunąć wyłącznie postęp MIMI z tego urządzenia?')) { progress = emptyProgress(); save(); closeDialog(); renderHome(); }
  };
}
async function checksum(data) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data)))].map(value => value.toString(16).padStart(2, '0')).join(''); }

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { resetPlayback(); save(); }
  else if (view === 'session') {
    showDialog(`<h2>Wracamy do zabawy</h2>${button('resume', 'play', 'Dokończ zadanie', 'start')}`);
    document.querySelector('#resume').onclick = () => { closeDialog(); void guarded(() => renderStep()); };
  }
});

async function setupOffline() {
  const status = message => { const el = document.querySelector('#offlineStatus'); if (el) el.textContent = message; };
  if (!('serviceWorker' in navigator)) { status('Zabawa online — ta przeglądarka nie obsługuje zapisu offline.'); return; }
  try {
    const registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
    const check = () => registration.active?.postMessage({ type: 'CHECK_PACK' });
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'MIMI_OFFLINE_READY') { offline = true; status('✓ Książeczka dostępna offline'); }
      if (event.data?.type === 'MIMI_PACK_PROGRESS') status(`Zapisujemy książeczkę: ${event.data.done}/${event.data.total}`);
    });
    if (registration.active) check();
    registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', check));
    navigator.serviceWorker.ready.then(check);
  } catch { status('Zabawa online. Otwórz ponownie, aby zapisać książeczkę offline.'); }
}
renderHome();
void setupOffline();
