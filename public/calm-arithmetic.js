(function () {
  'use strict';

  const DB_NAME = 'calm-arithmetic';
  const DB_VERSION = 1;
  const FALLBACK_KEY = 'calmArithmeticFallbackV1';
  const SESSION_ACTIVITY_COUNT = 8;
  const LAST_HERO_KEY = 'calmArithmeticLastHero';
  const superheroImageAssets = [
    'img/arithmetic/ironman1.jpeg',
    'img/arithmetic/ironman2.jpeg',
    'img/arithmetic/ironman3.jpeg'
  ];
  const ironManPattern = /^ironman\d+\.(jpe?g|png|webp)$/i;
  const ironManImages = superheroImageAssets.filter(source => {
    return ironManPattern.test(source.split('/').pop());
  });

  const copy = {
    en: {
      greeting: 'Hello, {name}.',
      academyName: 'Iron Man’s Number Lab',
      homeTitle: 'Ready to train with Iron Man?',
      homeSubtitle: 'Take it slow: look closely, count carefully, and power up each number.',
      start: 'Start mission',
      continue: 'Continue mission',
      startAgain: 'Start again',
      forParents: 'For parents',
      help: 'Help',
      done: 'Done',
      next: 'Next',
      finish: 'Finish',
      sessionComplete: 'Mission complete',
      completionTitle: 'Today you trained your number powers from one to five.',
      completionMessage: 'You looked closely, counted carefully, and made sets.',
      dotInstruction: 'How many dots did you see?',
      dotWaiting: 'Look carefully.',
      patternGone: 'The dots are hidden. Choose the number.',
      countInstruction: 'Tap each counter, then choose the total.',
      makeInstruction: 'Make {number}.',
      lookAgain: 'Look again.',
      countTogether: 'Touch each counter once as you count.',
      targetSlots: 'Use the marked spaces to make {number}.',
      yesThereAre: 'Yes. There are {number}.',
      yesMade: 'Yes. You made {number}.',
      waiting: 'Waiting',
      keepHolding: 'Keep holding…',
      unlocked: 'Opened',
      soundFull: 'Sound: instructions and feedback',
      soundInstructions: 'Sound: instructions only',
      soundOff: 'Sound off'
    },
    pl: {
      greeting: 'Cześć, {name}.',
      academyName: 'Laboratorium Liczb Iron Mana',
      homeTitle: 'Gotowi na trening z Iron Manem?',
      homeSubtitle: 'Bez pośpiechu: patrz uważnie, licz dokładnie i wzmacniaj każdą liczbę.',
      start: 'Rozpocznij misję',
      continue: 'Kontynuuj misję',
      startAgain: 'Zacznij od nowa',
      forParents: 'Dla rodziców',
      help: 'Pomoc',
      done: 'Gotowe',
      next: 'Dalej',
      finish: 'Zakończ',
      sessionComplete: 'Misja zakończona',
      completionTitle: 'Dziś ćwiczyliście moce liczb od jednego do pięciu.',
      completionMessage: 'Patrzyliście uważnie, liczyliście dokładnie i tworzyliście zbiory.',
      dotInstruction: 'Ile kropek widziałeś?',
      dotWaiting: 'Popatrz uważnie.',
      patternGone: 'Kropki są ukryte. Wybierz liczbę.',
      countInstruction: 'Dotknij każdego żetonu, a potem wybierz liczbę.',
      makeInstruction: 'Pokaż {number}.',
      lookAgain: 'Spójrz jeszcze raz.',
      countTogether: 'Dotknij każdego żetonu jeden raz podczas liczenia.',
      targetSlots: 'Użyj zaznaczonych miejsc, aby pokazać {number}.',
      yesThereAre: 'Tak. Jest {number}.',
      yesMade: 'Tak. Pokazałeś {number}.',
      waiting: 'Czekam',
      keepHolding: 'Trzymaj dalej…',
      unlocked: 'Otwarte',
      soundFull: 'Dźwięk: instrukcje i odpowiedzi',
      soundInstructions: 'Dźwięk: tylko instrukcje',
      soundOff: 'Dźwięk wyłączony'
    }
  };

  const numberWords = {
    en: ['', 'one', 'two', 'three', 'four', 'five'],
    pl: ['', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć']
  };

  const dotPositions = {
    dice: {
      1: [[50, 50]],
      2: [[30, 30], [70, 70]],
      3: [[28, 28], [50, 50], [72, 72]],
      4: [[28, 28], [72, 28], [28, 72], [72, 72]],
      5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]]
    },
    structured: {
      1: [[26, 32]],
      2: [[26, 32], [50, 32]],
      3: [[26, 32], [50, 32], [74, 32]],
      4: [[26, 32], [50, 32], [74, 32], [26, 68]],
      5: [[26, 32], [50, 32], [74, 32], [26, 68], [50, 68]]
    },
    irregular: {
      1: [[58, 42]],
      2: [[32, 62], [68, 30]],
      3: [[24, 34], [68, 25], [56, 72]],
      4: [[22, 28], [70, 22], [38, 72], [78, 68]],
      5: [[20, 25], [63, 20], [42, 48], [76, 70], [25, 76]]
    }
  };

  const elements = {};
  let repository;
  let profile = null;
  let currentSession = null;
  let currentActivityState = null;
  let pendingResumeSession = null;
  let homeHeroImage = null;
  let dotTimer = null;
  let gateTimer = null;
  let keyboardGateTimer = null;
  let gateHeld = { left: false, right: false };
  let activeChildPointer = null;
  let interruptedAt = null;

  function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function interfaceLanguage() {
    return profile && profile.interfaceLanguage === 'pl' ? 'pl' : 'en';
  }

  function numberLanguage() {
    return profile && profile.numberWordLanguage === 'pl' ? 'pl' : 'en';
  }

  function text(key, values) {
    let value = (copy[interfaceLanguage()] && copy[interfaceLanguage()][key]) || copy.en[key] || key;
    Object.entries(values || {}).forEach(([name, replacement]) => {
      value = value.replace(`{${name}}`, String(replacement));
    });
    return value;
  }

  function numberWord(quantity) {
    return numberWords[numberLanguage()][quantity] || String(quantity);
  }

  function chooseIronManImage() {
    if (ironManImages.length === 0) return '';

    let previousImage = '';
    try {
      previousImage = sessionStorage.getItem(LAST_HERO_KEY) || '';
    } catch (error) {
      // Random selection still works if session storage is unavailable.
    }

    const choices = ironManImages.filter(source => source !== previousImage);
    const pool = choices.length > 0 ? choices : ironManImages;
    const selected = pool[Math.floor(Math.random() * pool.length)];

    try {
      sessionStorage.setItem(LAST_HERO_KEY, selected);
    } catch (error) {
      // No persistence is required for the current mission.
    }
    return selected;
  }

  function showIronMan(source) {
    if (!source) return;
    document.querySelectorAll('[data-iron-man]').forEach(image => {
      image.src = source;
    });
  }

  function openDatabase() {
    if (!('indexedDB' in window)) {
      return Promise.resolve(null);
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('attempts')) {
          db.createObjectStore('attempts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Database is blocked'));
    });
  }

  function idbOperation(db, storeName, mode, operation) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = operation(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  function readFallback() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FALLBACK_KEY) || '{}');
      return {
        profile: parsed.profile || null,
        attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
      };
    } catch (error) {
      return { profile: null, attempts: [], sessions: [] };
    }
  }

  function writeFallback(data) {
    try {
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(data));
    } catch (error) {
      // The in-memory session remains usable if browser storage is unavailable.
    }
  }

  function createRepository() {
    const dbPromise = openDatabase().catch(() => null);

    return {
      async getProfile() {
        const db = await dbPromise;
        if (db) {
          return (await idbOperation(db, 'profiles', 'readonly', store => store.get('child-1'))) || null;
        }
        return readFallback().profile;
      },

      async saveProfile(value) {
        const db = await dbPromise;
        if (db) {
          await idbOperation(db, 'profiles', 'readwrite', store => store.put(value));
          return;
        }
        const data = readFallback();
        data.profile = value;
        writeFallback(data);
      },

      async saveAttempt(value) {
        const db = await dbPromise;
        if (db) {
          await idbOperation(db, 'attempts', 'readwrite', store => store.put(value));
          return;
        }
        const data = readFallback();
        const existingIndex = data.attempts.findIndex(item => item.id === value.id);
        if (existingIndex >= 0) data.attempts[existingIndex] = value;
        else data.attempts.push(value);
        writeFallback(data);
      },

      async saveSession(value) {
        const db = await dbPromise;
        if (db) {
          await idbOperation(db, 'sessions', 'readwrite', store => store.put(value));
          return;
        }
        const data = readFallback();
        const existingIndex = data.sessions.findIndex(item => item.id === value.id);
        if (existingIndex >= 0) data.sessions[existingIndex] = value;
        else data.sessions.push(value);
        writeFallback(data);
      },

      async getSessions() {
        const db = await dbPromise;
        if (db) {
          return (await idbOperation(db, 'sessions', 'readonly', store => store.getAll())) || [];
        }
        return readFallback().sessions;
      },

      async getAttempts() {
        const db = await dbPromise;
        if (db) {
          return (await idbOperation(db, 'attempts', 'readonly', store => store.getAll())) || [];
        }
        return readFallback().attempts;
      },

      async exportData() {
        return {
          schemaVersion: 1,
          curriculumVersion: 'quantity-1-5-v1',
          applicationVersion: '0.1.0',
          exportedAt: nowIso(),
          profile: await this.getProfile(),
          attempts: await this.getAttempts(),
          sessions: await this.getSessions()
        };
      },

      async importData(bundle) {
        if (!bundle || bundle.schemaVersion !== 1 || !bundle.profile) {
          throw new Error('Unsupported data file');
        }

        const db = await dbPromise;
        if (db) {
          await Promise.all([
            idbOperation(db, 'profiles', 'readwrite', store => store.clear()),
            idbOperation(db, 'attempts', 'readwrite', store => store.clear()),
            idbOperation(db, 'sessions', 'readwrite', store => store.clear())
          ]);
          await this.saveProfile(bundle.profile);
          for (const attempt of bundle.attempts || []) await this.saveAttempt(attempt);
          for (const session of bundle.sessions || []) await this.saveSession(session);
          return;
        }

        writeFallback({
          profile: bundle.profile,
          attempts: bundle.attempts || [],
          sessions: bundle.sessions || []
        });
      },

      async reset() {
        const db = await dbPromise;
        if (db) {
          await Promise.all([
            idbOperation(db, 'profiles', 'readwrite', store => store.clear()),
            idbOperation(db, 'attempts', 'readwrite', store => store.clear()),
            idbOperation(db, 'sessions', 'readwrite', store => store.clear()),
            idbOperation(db, 'metadata', 'readwrite', store => store.clear())
          ]);
        }
        try {
          localStorage.removeItem(FALLBACK_KEY);
        } catch (error) {
          // Ignore browser storage restrictions.
        }
      }
    };
  }

  function cacheElements() {
    [
      'setupScreen', 'setupForm', 'nicknameInput', 'homeScreen', 'homeGreeting',
      'academyTitle', 'homeTitle', 'homeSubtitle', 'homeSoundButton', 'startSessionButton',
      'resumeActions', 'continueSessionButton', 'restartSessionButton',
      'openParentGateButton', 'sessionScreen', 'progressMarks',
      'replayInstructionButton', 'sessionHero', 'activityInstruction', 'activityFeedback',
      'activityWorkspace', 'helpButton', 'doneButton', 'completionScreen',
      'completionEyebrow', 'completionTitle', 'completionMessage', 'finishSessionButton',
      'parentScreen', 'closeParentButton', 'parentSettingsForm',
      'parentNicknameInput', 'parentLanguageSelect', 'parentSoundSelect',
      'completedSessionCount', 'latestSessionSummary', 'exportDataButton',
      'importDataInput', 'resetDataButton', 'returnToMainAppButton',
      'parentGate', 'closeParentGateButton', 'gateLeft', 'gateRight', 'gateProgress'
    ].forEach(id => {
      elements[id] = document.getElementById(id);
    });
  }

  function showScreen(screen) {
    [elements.setupScreen, elements.homeScreen, elements.sessionScreen, elements.completionScreen, elements.parentScreen]
      .forEach(candidate => {
        candidate.hidden = candidate !== screen;
      });
  }

  function applyChildCopy() {
    elements.homeGreeting.textContent = text('greeting', { name: profile.nickname });
    elements.academyTitle.textContent = text('academyName');
    elements.homeTitle.textContent = text('homeTitle');
    elements.homeSubtitle.textContent = text('homeSubtitle');
    elements.startSessionButton.textContent = text('start');
    elements.continueSessionButton.textContent = text('continue');
    elements.restartSessionButton.textContent = text('startAgain');
    elements.openParentGateButton.textContent = text('forParents');
    elements.helpButton.textContent = text('help');
    elements.finishSessionButton.textContent = text('finish');
    elements.completionTitle.textContent = text('completionTitle');
    elements.completionMessage.textContent = text('completionMessage');
    elements.completionEyebrow.textContent = text('sessionComplete');
    updateSoundButton();
  }

  function updateSoundButton() {
    const key = profile.soundMode === 'off'
      ? 'soundOff'
      : profile.soundMode === 'instructionsOnly'
        ? 'soundInstructions'
        : 'soundFull';
    elements.homeSoundButton.setAttribute('aria-label', text(key));
    elements.homeSoundButton.title = text(key);
    elements.homeSoundButton.querySelector('span').textContent = profile.soundMode === 'off' ? '×' : '♪';
  }

  async function showHome() {
    clearTimeout(dotTimer);
    currentActivityState = null;
    showScreen(elements.homeScreen);
    applyChildCopy();

    const sessions = await repository.getSessions();
    const activeSessions = sessions
      .filter(session => !session.completedAt && session.completedActivityCount < session.plannedActivityCount)
      .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
    pendingResumeSession = activeSessions[0] || null;

    if (pendingResumeSession) {
      if (!pendingResumeSession.heroImage) {
        pendingResumeSession.heroImage = chooseIronManImage();
        await repository.saveSession(pendingResumeSession);
      }
      homeHeroImage = pendingResumeSession.heroImage;
    } else {
      homeHeroImage = chooseIronManImage();
    }
    showIronMan(homeHeroImage);

    elements.startSessionButton.hidden = Boolean(pendingResumeSession);
    elements.resumeActions.hidden = !pendingResumeSession;
  }

  function createSessionPlan() {
    return [
      {
        instanceId: uid('activity'),
        templateId: 'dot-flash',
        type: 'dotFlash',
        skillIds: ['subitise_1_3'],
        quantity: 2,
        arrangement: 'dice',
        representation: 'dicePattern',
        assessmentMode: 'review'
      },
      {
        instanceId: uid('activity'),
        templateId: 'count-set',
        type: 'countSet',
        skillIds: ['count_objects_to_5', 'cardinality_to_5'],
        quantity: 3,
        representation: 'plainCounters',
        assessmentMode: 'review'
      },
      {
        instanceId: uid('activity'),
        templateId: 'make-set',
        type: 'makeSet',
        skillIds: ['create_requested_set_to_5'],
        quantity: 2,
        representation: 'plainCounters',
        assessmentMode: 'guided'
      },
      {
        instanceId: uid('activity'),
        templateId: 'dot-flash',
        type: 'dotFlash',
        skillIds: ['subitise_4_structured'],
        quantity: 4,
        arrangement: 'structured',
        representation: 'structuredDots',
        assessmentMode: 'guided'
      },
      {
        instanceId: uid('activity'),
        templateId: 'count-set',
        type: 'countSet',
        skillIds: ['count_objects_to_5', 'cardinality_to_5'],
        quantity: 5,
        representation: 'plainCounters',
        assessmentMode: 'guided'
      },
      {
        instanceId: uid('activity'),
        templateId: 'make-set',
        type: 'makeSet',
        skillIds: ['create_requested_set_to_5'],
        quantity: 4,
        representation: 'plainCounters',
        assessmentMode: 'guided'
      },
      {
        instanceId: uid('activity'),
        templateId: 'dot-flash',
        type: 'dotFlash',
        skillIds: ['subitise_1_3'],
        quantity: 3,
        arrangement: 'irregular',
        representation: 'irregularDots',
        assessmentMode: 'independent'
      },
      {
        instanceId: uid('activity'),
        templateId: 'count-set',
        type: 'countSet',
        skillIds: ['count_objects_to_5', 'cardinality_to_5'],
        quantity: 4,
        representation: 'plainCounters',
        assessmentMode: 'independent'
      }
    ];
  }

  async function startSession(replaceExisting) {
    if (replaceExisting && pendingResumeSession) {
      pendingResumeSession.completedAt = nowIso();
      pendingResumeSession.endedReason = 'childExit';
      await repository.saveSession(pendingResumeSession);
    }

    currentSession = {
      id: uid('session'),
      startedAt: nowIso(),
      completedAt: null,
      currentActivityIndex: 0,
      plannedActivityCount: SESSION_ACTIVITY_COUNT,
      completedActivityCount: 0,
      successfulAttempts: 0,
      unsuccessfulAttempts: 0,
      targetSkillId: 'cardinality_to_5',
      skillIdsReviewed: ['subitise_1_3', 'count_objects_to_5'],
      endedReason: null,
      heroImage: homeHeroImage || chooseIronManImage(),
      activities: createSessionPlan()
    };
    showIronMan(currentSession.heroImage);
    await repository.saveSession(currentSession);
    renderCurrentActivity();
  }

  function resumeSession() {
    currentSession = pendingResumeSession;
    showIronMan(currentSession.heroImage);
    renderCurrentActivity();
  }

  function createProgressMarks() {
    elements.progressMarks.innerHTML = '';
    currentSession.activities.forEach((activity, index) => {
      const mark = document.createElement('span');
      mark.className = 'progress-mark';
      if (index < currentSession.currentActivityIndex) mark.classList.add('complete');
      if (index === currentSession.currentActivityIndex) mark.classList.add('current');
      elements.progressMarks.appendChild(mark);
    });
  }

  function resetActivityUi() {
    clearTimeout(dotTimer);
    elements.activityWorkspace.innerHTML = '';
    elements.activityWorkspace.classList.remove('activity-enter');
    elements.activityFeedback.textContent = '';
    elements.activityFeedback.className = 'activity-feedback';
    elements.doneButton.hidden = true;
    elements.doneButton.textContent = text('done');
    elements.doneButton.onclick = submitMakeSet;
    elements.helpButton.disabled = false;
  }

  function renderCurrentActivity() {
    showScreen(elements.sessionScreen);
    resetActivityUi();
    createProgressMarks();

    const activity = currentSession.activities[currentSession.currentActivityIndex];
    currentActivityState = {
      activity,
      startedAt: Date.now(),
      accumulatedPauseMs: 0,
      attempts: 0,
      selectedAnswer: null,
      countedOrder: [],
      trayIndices: [],
      scaffoldsUsed: [],
      tapCount: 0,
      repeatedObjectSelections: 0,
      instructionReplayCount: 0,
      helpRequestCount: 0,
      multiTouchInterruptions: 0,
      locked: false
    };

    if (activity.type === 'dotFlash') renderDotFlash(activity);
    if (activity.type === 'countSet') renderCountSet(activity);
    if (activity.type === 'makeSet') renderMakeSet(activity);
    requestAnimationFrame(() => elements.activityWorkspace.classList.add('activity-enter'));
    speakCurrentInstruction();
  }

  function setInstruction(key, values) {
    elements.activityInstruction.textContent = text(key, values);
    currentActivityState.instructionKey = key;
    currentActivityState.instructionValues = values || {};
  }

  function renderDotFlash(activity) {
    setInstruction('dotWaiting');
    const board = document.createElement('div');
    board.className = 'dot-board';
    board.setAttribute('aria-label', `${activity.quantity} dots`);

    const positions = dotPositions[activity.arrangement][activity.quantity];
    positions.forEach(([left, top]) => {
      const dot = document.createElement('span');
      dot.className = 'math-dot';
      dot.style.left = `${left}%`;
      dot.style.top = `${top}%`;
      board.appendChild(dot);
    });

    const coverLabel = document.createElement('span');
    coverLabel.className = 'dot-cover-label';
    coverLabel.textContent = text('patternGone');
    board.appendChild(coverLabel);

    const strip = buildNumberStrip();
    strip.hidden = true;
    elements.activityWorkspace.append(board, strip);

    dotTimer = setTimeout(() => {
      board.classList.add('hidden-pattern');
      strip.hidden = false;
      setInstruction('dotInstruction');
      speakCurrentInstruction();
    }, 1600);
  }

  function buildNumberStrip() {
    const strip = document.createElement('div');
    strip.className = 'number-strip';
    strip.setAttribute('role', 'group');
    strip.setAttribute('aria-label', 'Number choices');

    for (let value = 1; value <= 5; value++) {
      const button = document.createElement('button');
      button.className = 'number-tile';
      button.type = 'button';
      button.textContent = value;
      button.setAttribute('aria-label', numberWord(value));
      button.addEventListener('click', () => submitNumberAnswer(value, button));
      strip.appendChild(button);
    }

    return strip;
  }

  function renderCountSet(activity) {
    setInstruction('countInstruction');
    const set = document.createElement('div');
    set.className = 'counter-set';

    for (let index = 0; index < activity.quantity; index++) {
      const counter = document.createElement('button');
      counter.className = 'counter-button';
      counter.type = 'button';
      counter.dataset.counterIndex = String(index);
      counter.setAttribute('aria-label', `Counter ${index + 1}`);
      const label = document.createElement('span');
      label.className = 'count-label';
      counter.appendChild(label);
      counter.addEventListener('click', () => toggleCountedCounter(counter, index));
      set.appendChild(counter);
    }

    elements.activityWorkspace.append(set, buildNumberStrip());
  }

  function toggleCountedCounter(counter, index) {
    if (currentActivityState.locked) return;
    currentActivityState.tapCount += 1;
    const existingIndex = currentActivityState.countedOrder.indexOf(index);

    if (existingIndex >= 0) {
      currentActivityState.countedOrder.splice(existingIndex, 1);
      currentActivityState.repeatedObjectSelections += 1;
    } else {
      currentActivityState.countedOrder.push(index);
    }

    document.querySelectorAll('.counter-button').forEach(button => {
      const buttonIndex = Number(button.dataset.counterIndex);
      const countIndex = currentActivityState.countedOrder.indexOf(buttonIndex);
      button.classList.toggle('counted', countIndex >= 0);
      button.querySelector('.count-label').textContent = countIndex >= 0 ? String(countIndex + 1) : '';
    });
  }

  function renderMakeSet(activity) {
    setInstruction('makeInstruction', { number: activity.quantity });
    const layout = document.createElement('div');
    layout.className = 'make-set-layout';
    const bank = document.createElement('div');
    bank.className = 'counter-bank';
    const tray = document.createElement('div');
    tray.className = 'set-tray';
    tray.setAttribute('aria-label', 'Set tray');

    for (let index = 0; index < 5; index++) {
      const counter = document.createElement('button');
      counter.className = 'bank-counter';
      counter.type = 'button';
      counter.dataset.bankIndex = String(index);
      counter.setAttribute('aria-label', `Add counter ${index + 1}`);
      counter.addEventListener('click', () => addCounterToTray(index));
      bank.appendChild(counter);

      const slot = document.createElement('div');
      slot.className = 'tray-slot';
      slot.dataset.slotIndex = String(index);
      tray.appendChild(slot);
    }

    layout.append(bank, tray);
    elements.activityWorkspace.appendChild(layout);
    elements.doneButton.hidden = false;
  }

  function addCounterToTray(index) {
    if (currentActivityState.locked || currentActivityState.trayIndices.includes(index)) return;
    currentActivityState.tapCount += 1;
    currentActivityState.trayIndices.push(index);
    renderTrayState();
  }

  function removeCounterFromTray(index) {
    if (currentActivityState.locked) return;
    currentActivityState.tapCount += 1;
    currentActivityState.trayIndices = currentActivityState.trayIndices.filter(item => item !== index);
    renderTrayState();
  }

  function renderTrayState() {
    document.querySelectorAll('.bank-counter').forEach(button => {
      button.classList.toggle('used', currentActivityState.trayIndices.includes(Number(button.dataset.bankIndex)));
    });

    document.querySelectorAll('.tray-slot').forEach((slot, slotIndex) => {
      slot.innerHTML = '';
      const bankIndex = currentActivityState.trayIndices[slotIndex];
      if (bankIndex === undefined) return;

      const counter = document.createElement('button');
      counter.className = 'tray-counter';
      counter.type = 'button';
      counter.setAttribute('aria-label', 'Remove counter');
      counter.addEventListener('click', () => removeCounterFromTray(bankIndex));
      slot.appendChild(counter);
    });
  }

  function markSelectedNumber(button, stateClass) {
    document.querySelectorAll('.number-tile').forEach(tile => {
      tile.classList.remove('selected', 'incorrect');
    });
    button.classList.add(stateClass);
  }

  function submitNumberAnswer(value, button) {
    if (!currentActivityState || currentActivityState.locked) return;
    currentActivityState.tapCount += 1;
    currentActivityState.attempts += 1;
    currentActivityState.selectedAnswer = value;

    if (value === currentActivityState.activity.quantity) {
      markSelectedNumber(button, 'correct');
      completeActivity('number', value);
      return;
    }

    markSelectedNumber(button, 'incorrect');
    elements.activityFeedback.textContent = text('lookAgain');
    speakFeedback(text('lookAgain'));

    if (currentActivityState.attempts >= 2) {
      applyScaffold();
    }
  }

  function submitMakeSet() {
    if (!currentActivityState || currentActivityState.locked) return;
    currentActivityState.attempts += 1;
    const quantity = currentActivityState.trayIndices.length;

    if (quantity === currentActivityState.activity.quantity) {
      completeActivity('makeSet', quantity);
      return;
    }

    elements.activityFeedback.textContent = text('lookAgain');
    speakFeedback(text('lookAgain'));
    if (currentActivityState.attempts >= 2) {
      applyScaffold();
    }
  }

  function applyScaffold() {
    const type = currentActivityState.activity.type;
    if (!currentActivityState.scaffoldsUsed.includes('countObjects')) {
      currentActivityState.scaffoldsUsed.push(type === 'makeSet' ? 'highlightObjects' : 'countObjects');
    }

    if (type === 'dotFlash') {
      const board = document.querySelector('.dot-board');
      if (board) {
        board.classList.remove('hidden-pattern');
        clearTimeout(dotTimer);
        dotTimer = setTimeout(() => board.classList.add('hidden-pattern'), 1800);
      }
      elements.activityFeedback.textContent = text('countTogether');
    }

    if (type === 'countSet') {
      const set = document.querySelector('.counter-set');
      if (set) set.classList.add('show-count-labels');
      elements.activityFeedback.textContent = text('countTogether');
    }

    if (type === 'makeSet') {
      document.querySelectorAll('.tray-slot').forEach((slot, index) => {
        slot.classList.toggle('target-slot', index < currentActivityState.activity.quantity);
      });
      elements.activityFeedback.textContent = text('targetSlots', {
        number: currentActivityState.activity.quantity
      });
    }
  }

  function requestHelp() {
    if (!currentActivityState || currentActivityState.locked) return;
    currentActivityState.helpRequestCount += 1;
    if (!currentActivityState.scaffoldsUsed.includes('repeatInstruction')) {
      currentActivityState.scaffoldsUsed.push('repeatInstruction');
    }
    applyScaffold();
    speakCurrentInstruction();
  }

  async function completeActivity(responseType, value) {
    currentActivityState.locked = true;
    elements.helpButton.disabled = true;
    const quantity = currentActivityState.activity.quantity;
    const feedbackKey = responseType === 'makeSet' ? 'yesMade' : 'yesThereAre';
    const feedback = text(feedbackKey, { number: quantity });
    elements.activityFeedback.textContent = feedback;
    elements.activityFeedback.classList.add('correct');
    elements.sessionHero.classList.remove('hero-encourage');
    void elements.sessionHero.offsetWidth;
    elements.sessionHero.classList.add('hero-encourage');
    speakFeedback(feedback);

    const attempt = {
      id: uid('attempt'),
      sessionId: currentSession.id,
      activityInstanceId: currentActivityState.activity.instanceId,
      skillIds: currentActivityState.activity.skillIds,
      templateId: currentActivityState.activity.templateId,
      representation: currentActivityState.activity.representation,
      assessmentMode: currentActivityState.activity.assessmentMode,
      parameters: {
        quantity,
        arrangement: currentActivityState.activity.arrangement || null
      },
      startedAt: new Date(currentActivityState.startedAt).toISOString(),
      completedAt: nowIso(),
      activeResponseMs: Math.max(
        0,
        Date.now() - currentActivityState.startedAt - currentActivityState.accumulatedPauseMs
      ),
      response: { type: responseType, value },
      correct: true,
      errorType: currentActivityState.attempts > 1 ? 'incorrectQuantity' : null,
      attemptsWithinActivity: currentActivityState.attempts || 1,
      scaffoldsUsed: currentActivityState.scaffoldsUsed,
      inferredStrategy: inferStrategy(),
      strategyConfidence: inferStrategyConfidence(),
      interactionSummary: {
        tapCount: currentActivityState.tapCount,
        dragCount: 0,
        invalidDropCount: 0,
        repeatedObjectSelections: currentActivityState.repeatedObjectSelections,
        inputReversals: 0,
        instructionReplayCount: currentActivityState.instructionReplayCount,
        helpRequestCount: currentActivityState.helpRequestCount,
        multiTouchInterruptions: currentActivityState.multiTouchInterruptions
      }
    };

    await repository.saveAttempt(attempt);
    currentSession.completedActivityCount += 1;
    if (attempt.attemptsWithinActivity === 1 && attempt.scaffoldsUsed.length === 0) {
      currentSession.successfulAttempts += 1;
    } else {
      currentSession.unsuccessfulAttempts += 1;
    }
    await repository.saveSession(currentSession);

    elements.doneButton.hidden = false;
    elements.doneButton.textContent = text('next');
    elements.doneButton.onclick = advanceActivity;
  }

  function inferStrategy() {
    if (currentActivityState.activity.type === 'dotFlash' &&
        currentActivityState.attempts <= 1 &&
        currentActivityState.scaffoldsUsed.length === 0) {
      return 'subitised';
    }
    if (currentActivityState.activity.type === 'countSet' &&
        currentActivityState.countedOrder.length === currentActivityState.activity.quantity) {
      return 'countedAll';
    }
    return 'unknown';
  }

  function inferStrategyConfidence() {
    const strategy = inferStrategy();
    if (strategy === 'subitised') return 0.55;
    if (strategy === 'countedAll') return 0.8;
    return 0.2;
  }

  async function advanceActivity() {
    if (!currentActivityState || !currentActivityState.locked) return;
    currentSession.currentActivityIndex += 1;
    await repository.saveSession(currentSession);

    if (currentSession.currentActivityIndex >= currentSession.activities.length) {
      await completeSession();
      return;
    }
    renderCurrentActivity();
  }

  async function completeSession() {
    currentSession.completedAt = nowIso();
    currentSession.endedReason = 'completed';
    currentSession.summaryMessage = {
      en: copy.en.completionTitle,
      pl: copy.pl.completionTitle
    };
    await repository.saveSession(currentSession);
    showIronMan(currentSession.heroImage);
    showScreen(elements.completionScreen);
    elements.completionTitle.textContent = text('completionTitle');
    elements.completionMessage.textContent = text('completionMessage');
    elements.completionEyebrow.textContent = text('sessionComplete');
    elements.finishSessionButton.textContent = text('finish');
  }

  function instructionSpeechText() {
    if (!currentActivityState) return '';
    const activity = currentActivityState.activity;
    const language = interfaceLanguage();
    const quantityWord = numberWords[numberLanguage()][activity.quantity];

    if (activity.type === 'dotFlash') {
      if (currentActivityState.instructionKey === 'dotWaiting') {
        return copy[language].dotWaiting;
      }
      return copy[language].dotInstruction;
    }
    if (activity.type === 'countSet') {
      return copy[language].countInstruction;
    }
    return copy[language].makeInstruction.replace('{number}', quantityWord);
  }

  function speak(textValue, language) {
    if (!('speechSynthesis' in window) || profile.soundMode === 'off') return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textValue);
    utterance.lang = language === 'pl' ? 'pl-PL' : 'en-US';
    utterance.rate = 0.84;
    utterance.pitch = 1;
    utterance.volume = 0.75;
    window.speechSynthesis.speak(utterance);
  }

  function speakCurrentInstruction() {
    if (!currentActivityState || profile.soundMode === 'off') return;
    speak(instructionSpeechText(), interfaceLanguage());
  }

  function replayCurrentInstruction() {
    if (!currentActivityState) return;
    currentActivityState.instructionReplayCount += 1;
    speakCurrentInstruction();
  }

  function speakFeedback(feedback) {
    if (profile.soundMode !== 'full') return;
    speak(feedback, interfaceLanguage());
  }

  function cycleSoundMode() {
    const modes = ['full', 'instructionsOnly', 'off'];
    profile.soundMode = modes[(modes.indexOf(profile.soundMode) + 1) % modes.length];
    repository.saveProfile(profile);
    updateSoundButton();
  }

  async function saveInitialProfile(event) {
    event.preventDefault();
    const data = new FormData(elements.setupForm);
    const languageMode = String(data.get('languageMode') || 'en-en').split('-');
    profile = {
      id: 'child-1',
      nickname: String(data.get('nickname') || '').trim() || 'My learner',
      createdAt: nowIso(),
      interfaceLanguage: languageMode[0],
      numberWordLanguage: languageMode[1],
      soundMode: String(data.get('soundMode') || 'full'),
      sessionLength: 'short',
      curriculumVersion: 'quantity-1-5-v1'
    };
    await repository.saveProfile(profile);
    showHome();
  }

  function openParentGate() {
    elements.parentGate.hidden = false;
    elements.gateProgress.textContent = text('waiting');
    resetGateHold();
  }

  function closeParentGate() {
    elements.parentGate.hidden = true;
    resetGateHold();
  }

  function setGateHeld(side, held, button) {
    gateHeld[side] = held;
    button.classList.toggle('holding', held);
    clearTimeout(gateTimer);

    if (gateHeld.left && gateHeld.right) {
      elements.gateProgress.textContent = text('keepHolding');
      gateTimer = setTimeout(unlockParentArea, 3000);
    } else {
      elements.gateProgress.textContent = text('waiting');
    }
  }

  function resetGateHold() {
    clearTimeout(gateTimer);
    clearTimeout(keyboardGateTimer);
    gateHeld = { left: false, right: false };
    elements.gateLeft.classList.remove('holding');
    elements.gateRight.classList.remove('holding');
  }

  function unlockParentArea() {
    elements.gateProgress.textContent = text('unlocked');
    setTimeout(() => {
      elements.parentGate.hidden = true;
      showParentArea();
    }, 200);
  }

  async function showParentArea() {
    showScreen(elements.parentScreen);
    elements.parentNicknameInput.value = profile.nickname;
    elements.parentLanguageSelect.value = `${profile.interfaceLanguage}-${profile.numberWordLanguage}`;
    elements.parentSoundSelect.value = profile.soundMode;

    const sessions = (await repository.getSessions())
      .filter(session => session.completedAt && session.endedReason === 'completed')
      .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
    elements.completedSessionCount.textContent = String(sessions.length);
    elements.latestSessionSummary.textContent = sessions[0]
      ? new Date(sessions[0].completedAt).toLocaleDateString()
      : 'No session completed yet';
  }

  async function saveParentSettings(event) {
    event.preventDefault();
    const data = new FormData(elements.parentSettingsForm);
    const languageMode = String(data.get('languageMode') || 'en-en').split('-');
    profile.nickname = String(data.get('nickname') || '').trim() || profile.nickname;
    profile.interfaceLanguage = languageMode[0];
    profile.numberWordLanguage = languageMode[1];
    profile.soundMode = String(data.get('soundMode') || 'off');
    await repository.saveProfile(profile);
    applyChildCopy();
    elements.parentSettingsForm.querySelector('.primary-button').textContent = 'Saved';
    setTimeout(() => {
      elements.parentSettingsForm.querySelector('.primary-button').textContent = 'Save settings';
    }, 900);
  }

  async function exportData() {
    const bundle = await repository.exportData();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `calm-arithmetic-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importData(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const bundle = JSON.parse(await file.text());
      await repository.importData(bundle);
      profile = await repository.getProfile();
      await showParentArea();
      alert('Data imported.');
    } catch (error) {
      alert('This data file could not be imported.');
    } finally {
      event.target.value = '';
    }
  }

  async function resetData() {
    if (!confirm('Reset the profile and all Calm Arithmetic progress on this device?')) return;
    await repository.reset();
    profile = null;
    currentSession = null;
    pendingResumeSession = null;
    elements.parentScreen.hidden = true;
    elements.setupScreen.hidden = false;
  }

  function bindGateButton(button, side) {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setGateHeld(side, true, button);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(eventName => {
      button.addEventListener(eventName, () => setGateHeld(side, false, button));
    });
  }

  function bindEvents() {
    elements.setupForm.addEventListener('submit', saveInitialProfile);
    elements.startSessionButton.addEventListener('click', () => startSession(false));
    elements.continueSessionButton.addEventListener('click', resumeSession);
    elements.restartSessionButton.addEventListener('click', () => startSession(true));
    elements.homeSoundButton.addEventListener('click', cycleSoundMode);
    elements.openParentGateButton.addEventListener('click', openParentGate);
    elements.closeParentGateButton.addEventListener('click', closeParentGate);
    elements.replayInstructionButton.addEventListener('click', replayCurrentInstruction);
    elements.helpButton.addEventListener('click', requestHelp);
    elements.finishSessionButton.addEventListener('click', showHome);
    elements.closeParentButton.addEventListener('click', showHome);
    elements.parentSettingsForm.addEventListener('submit', saveParentSettings);
    elements.exportDataButton.addEventListener('click', exportData);
    elements.importDataInput.addEventListener('change', importData);
    elements.resetDataButton.addEventListener('click', resetData);
    elements.returnToMainAppButton.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
    bindGateButton(elements.gateLeft, 'left');
    bindGateButton(elements.gateRight, 'right');

    elements.activityWorkspace.addEventListener('contextmenu', event => event.preventDefault());
    elements.activityWorkspace.addEventListener('pointerdown', event => {
      if (activeChildPointer !== null && activeChildPointer !== event.pointerId) {
        event.preventDefault();
        if (currentActivityState) currentActivityState.multiTouchInterruptions += 1;
        return;
      }
      activeChildPointer = event.pointerId;
    }, true);
    ['pointerup', 'pointercancel'].forEach(eventName => {
      elements.activityWorkspace.addEventListener(eventName, event => {
        if (activeChildPointer === event.pointerId) activeChildPointer = null;
      }, true);
    });

    document.addEventListener('keydown', event => {
      if (elements.parentGate.hidden || event.key.toLowerCase() !== 'p' || event.repeat) return;
      elements.gateProgress.textContent = text('keepHolding');
      keyboardGateTimer = setTimeout(unlockParentArea, 3000);
    });
    document.addEventListener('keyup', event => {
      if (event.key.toLowerCase() !== 'p') return;
      clearTimeout(keyboardGateTimer);
      if (!elements.parentGate.hidden) elements.gateProgress.textContent = text('waiting');
    });

    document.addEventListener('visibilitychange', () => {
      if (!currentActivityState) return;
      if (document.hidden) {
        interruptedAt = Date.now();
      } else if (interruptedAt) {
        currentActivityState.accumulatedPauseMs += Date.now() - interruptedAt;
        interruptedAt = null;
      }
    });
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(window.location.protocol)) return;
    try {
      await navigator.serviceWorker.register('./calm-sw.js');
    } catch (error) {
      // The app remains usable online if service worker registration fails.
    }
  }

  async function initialise() {
    cacheElements();
    repository = createRepository();
    bindEvents();
    profile = await repository.getProfile();
    await registerServiceWorker();

    if (!profile) {
      showScreen(elements.setupScreen);
      return;
    }
    await showHome();
  }

  document.addEventListener('DOMContentLoaded', initialise);
})();
