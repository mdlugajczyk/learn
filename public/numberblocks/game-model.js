export const GAME_VERSION = 3;
export const NUMBER_WORDS = Object.freeze([
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'
]);

export const PLAYGROUND_EQUIPMENT = Object.freeze([
  'slide', 'swing', 'seesaw', 'tunnel', 'sandbox', 'climbing-dome',
  'merry-go-round', 'spring-rider', 'trampoline', 'playhouse',
  'stepping-pods', 'water-table'
]);

const PLAYGROUND_SLOTS = Object.freeze([
  { x: 17, y: 29 }, { x: 50, y: 29 }, { x: 83, y: 29 },
  { x: 17, y: 54 }, { x: 50, y: 54 }, { x: 83, y: 54 },
  { x: 17, y: 79 }, { x: 50, y: 79 }, { x: 83, y: 79 }
]);

export const JOIN_FACTS = Object.freeze([
  [1, 1], [1, 2], [1, 3], [2, 2], [1, 4], [2, 3],
  [1, 5], [2, 4], [3, 3], [1, 6], [2, 5], [3, 4],
  [1, 7], [2, 6], [3, 5], [4, 4], [1, 8], [2, 7],
  [3, 6], [4, 5], [1, 9], [2, 8], [3, 7], [4, 6], [5, 5]
]);

export const DEFAULT_SETTINGS = Object.freeze({
  locale: 'en',
  sessionLength: 6,
  joinMin: 2,
  joinMax: 5,
  equalMax: 4,
  remainderMax: 5,
  narrationVolume: 0.94,
  effectsVolume: 0.55,
  reducedMotion: false,
  autoAdvance: true,
  remaindersEnabled: false
});

export function factFamily(a, b) {
  return `${Math.min(a, b)}+${Math.max(a, b)}`;
}

export function createSeededRandom(seed = Date.now()) {
  let value = 2166136261;
  for (const character of String(seed)) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return () => {
    value += 0x6D2B79F5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(values, random = Math.random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function createPlaygroundPlan(seed = Date.now(), count = 6) {
  const itemCount = Math.max(1, Math.min(Number(count) || 6, PLAYGROUND_SLOTS.length, PLAYGROUND_EQUIPMENT.length));
  const random = createSeededRandom(`playground:${seed}`);
  const kinds = shuffle(PLAYGROUND_EQUIPMENT, random).slice(0, itemCount);
  const slots = shuffle(PLAYGROUND_SLOTS, random).slice(0, itemCount);
  const baseHue = Math.floor(random() * 360);
  return {
    id: `playground-${seed}`,
    seed: String(seed),
    items: kinds.map((kind, index) => ({
      id: `${kind}-${index + 1}`,
      kind,
      x: Number((slots[index].x + (random() - 0.5) * 2.4).toFixed(2)),
      y: Number((slots[index].y + (random() - 0.5) * 1.6).toFixed(2)),
      width: 22,
      rotation: Number(((random() - 0.5) * 5).toFixed(2)),
      hue: Math.round((baseHue + index * 43 + random() * 22) % 360),
      z: Math.round(slots[index].y)
    }))
  };
}

export function generateJoinOptions({ a, b }, {
  introducedMax = 5,
  choiceCount = 4,
  random = Math.random
} = {}) {
  const sum = a + b;
  const allowed = Array.from({ length: introducedMax }, (_, index) => index + 1);
  if (!allowed.includes(sum)) throw new Error('Join total is outside the introduced answer range');
  const requested = Math.min(choiceCount, allowed.length >= 4 ? 4 : 2, allowed.length);
  const candidates = [sum - 1, sum + 1, a, b, Math.abs(a - b), ...allowed];
  const distractors = [];
  for (const value of candidates) {
    if (!Number.isInteger(value) || value === 0 || value === sum || !allowed.includes(value) || distractors.includes(value)) continue;
    distractors.push(value);
    if (distractors.length === requested - 1) break;
  }
  return shuffle([sum, ...distractors], random);
}

export function makeJoinTask(a, b, options = {}) {
  const sum = a + b;
  const introducedMax = options.introducedMax || Math.max(5, sum);
  const task = {
    kind: 'join',
    id: options.id || `join-${a}-${b}`,
    skillId: 'join',
    a,
    b,
    sum,
    representation: options.representation || 'blocks',
    answerSupport: options.answerSupport || 'quantity',
    teachingDemo: options.teachingDemo === true,
    choiceCount: options.choiceCount || (options.teachingDemo ? 2 : 4)
  };
  return {
    ...task,
    options: generateJoinOptions(task, {
      introducedMax,
      choiceCount: task.choiceCount,
      random: options.random || Math.random
    })
  };
}

export function makeShareTask(total, goal, options = {}) {
  return {
    kind: 'share',
    id: options.id || `share-${goal}-${total}`,
    skillId: goal === 'equalAll' ? 'share.equal'
      : goal === 'equalRemainder' ? 'share.remainder'
        : 'share.composition',
    total,
    goal,
    target: options.target,
    requireBothNonempty: options.requireBothNonempty !== false,
    teachingDemo: options.teachingDemo === true,
    toySet: options.toySet || 'teddies'
  };
}

export function createToyState(total) {
  if (!Number.isInteger(total) || total < 1 || total > 10) throw new Error('Toy total must be between one and ten');
  return {
    total,
    toys: Array.from({ length: total }, (_, index) => ({ id: `toy-${index + 1}`, location: 'tray' })),
    history: []
  };
}

export function toyCounts(state) {
  return state.toys.reduce((counts, toy) => {
    counts[toy.location] += 1;
    return counts;
  }, { tray: 0, left: 0, right: 0 });
}

export function toyStateIsValid(state) {
  if (!state || !Array.isArray(state.toys) || state.toys.length !== state.total) return false;
  const ids = new Set(state.toys.map(toy => toy.id));
  return ids.size === state.total
    && state.toys.every(toy => ['tray', 'left', 'right'].includes(toy.location))
    && Object.values(toyCounts(state)).every(count => count >= 0)
    && Object.values(toyCounts(state)).reduce((sum, count) => sum + count, 0) === state.total;
}

function moveToy(state, toyId, to) {
  const toy = state.toys.find(item => item.id === toyId);
  if (!toy || !['tray', 'left', 'right'].includes(to)) return state;
  const from = toy.location;
  if (from === to) return state;
  const next = {
    ...state,
    toys: state.toys.map(item => item.id === toyId ? { ...item, location: to } : item),
    history: [...state.history, { toyId, from, to }].slice(-30)
  };
  if (!toyStateIsValid(next)) throw new Error('Toy conservation invariant failed');
  return next;
}

export function sendNextToy(state, recipient) {
  if (!['left', 'right'].includes(recipient)) return state;
  const toy = state.toys.find(item => item.location === 'tray');
  return toy ? moveToy(state, toy.id, recipient) : state;
}

export function returnOneToy(state, recipient) {
  if (!['left', 'right'].includes(recipient)) return state;
  const toy = [...state.toys].reverse().find(item => item.location === recipient);
  return toy ? moveToy(state, toy.id, 'tray') : state;
}

export function undoToyMove(state) {
  const last = state.history.at(-1);
  if (!last) return state;
  const next = {
    ...state,
    toys: state.toys.map(item => item.id === last.toyId ? { ...item, location: last.from } : item),
    history: state.history.slice(0, -1)
  };
  if (!toyStateIsValid(next)) throw new Error('Undo violated toy conservation');
  return next;
}

export function validateShare(task, state) {
  if (!task || task.kind !== 'share' || !toyStateIsValid(state) || task.total !== state.total) {
    return { success: false, reason: 'invalid' };
  }
  const counts = toyCounts(state);
  if (task.goal === 'freeGroups') {
    const success = counts.tray === 0 && (!task.requireBothNonempty || (counts.left > 0 && counts.right > 0));
    return { success, reason: success ? 'complete' : counts.tray ? 'use-all' : 'both-groups' };
  }
  if (task.goal === 'targetRecipient') {
    const recipient = task.target?.recipient;
    const targetCount = task.target?.count;
    const success = counts.tray === 0 && counts[recipient] === targetCount;
    return { success, reason: success ? 'complete' : counts.tray ? 'use-all' : 'target', recipient, targetCount };
  }
  if (task.goal === 'equalAll') {
    const success = counts.tray === 0 && counts.left === counts.right;
    return { success, reason: success ? 'complete' : counts.tray ? 'use-all' : 'unmatched' };
  }
  if (task.goal === 'equalRemainder') {
    const each = Math.floor(task.total / 2);
    const remainder = task.total % 2;
    const success = counts.left === each && counts.right === each && counts.tray === remainder;
    let reason = 'put-back';
    if (counts.left === counts.right && counts.tray > remainder) reason = 'more-pairs';
    else if (counts.left !== counts.right && counts.tray > remainder) reason = 'unmatched';
    return { success, reason: success ? 'complete' : reason, each, remainder };
  }
  return { success: false, reason: 'invalid' };
}

export function createDefaultProfile(overrides = {}) {
  return {
    version: GAME_VERSION,
    settings: { ...DEFAULT_SETTINGS, ...(overrides.settings || {}) },
    sessionsCompleted: Number(overrides.sessionsCompleted || 0),
    evidence: {
      join: [...(overrides.evidence?.join || [])],
      'share.composition': [...(overrides.evidence?.['share.composition'] || [])],
      'share.equal': [...(overrides.evidence?.['share.equal'] || [])],
      'share.remainder': [...(overrides.evidence?.['share.remainder'] || [])]
    },
    outcomes: [...(overrides.outcomes || [])].slice(-200),
    resolutions: [...(overrides.resolutions || [])].slice(-200),
    playgrounds: [...(overrides.playgrounds || [])].slice(-12),
    checkpoint: overrides.checkpoint || null
  };
}

export function scoreOutcome(profileValue, outcome) {
  const profile = createDefaultProfile(profileValue);
  if (!outcome?.completed || outcome.skipped || outcome.teachingDemo || outcome.freePlay) return profile;
  const independent = outcome.firstAttemptCorrect === true && !(outcome.assistance || []).length;
  const family = outcome.family || outcome.taskId;
  const existing = profile.evidence[outcome.skillId] || [];
  if (existing.some(item => item.sessionId === outcome.sessionId && item.family === family)) return profile;
  const observation = {
    independent,
    family,
    sessionId: outcome.sessionId,
    representation: outcome.representation,
    answerSupport: outcome.answerSupport,
    assistance: [...(outcome.assistance || [])]
  };
  profile.evidence[outcome.skillId] = [...existing, observation].slice(-8);
  profile.outcomes = [...profile.outcomes, outcome].slice(-200);
  if (outcome.skillId === 'share.equal' && independent) profile.settings.remaindersEnabled = true;
  if (outcome.skillId === 'join' && profile.settings.autoAdvance && canAdvance(profile.evidence.join, 3) && profile.settings.joinMax < 10) {
    profile.settings.joinMax += 1;
    profile.evidence.join = [];
  }
  if (outcome.skillId === 'share.equal' && profile.settings.autoAdvance
    && canAdvance(profile.evidence['share.equal'], Math.min(3, profile.settings.equalMax / 2))
    && profile.settings.equalMax < 10) {
    profile.settings.equalMax += 2;
    profile.evidence['share.equal'] = [];
  }
  if (outcome.skillId === 'share.remainder' && profile.settings.autoAdvance
    && canAdvance(profile.evidence['share.remainder'], Math.min(3, (profile.settings.remainderMax - 1) / 2))
    && profile.settings.remainderMax < 9) {
    profile.settings.remainderMax += 2;
    profile.evidence['share.remainder'] = [];
  }
  return profile;
}

export function canAdvance(evidence = [], availableFamilies = 3) {
  if (evidence.length < 8) return false;
  const window = evidence.slice(-8);
  const independent = window.filter(item => item.independent);
  const sessions = new Set(window.map(item => item.sessionId));
  const families = new Set(window.map(item => item.family));
  return independent.length >= 7
    && sessions.size >= 2
    && families.size >= Math.min(3, availableFamilies);
}

export function needsReducedDemand(evidence = []) {
  return evidence.length >= 2 && evidence.slice(-2).every(item => !item.independent);
}

export function commitResolution(profileValue, outcome, resolutionId) {
  const profile = createDefaultProfile(profileValue);
  if (!resolutionId || profile.resolutions.includes(resolutionId)) return { profile, awarded: false };
  const scored = scoreOutcome(profile, outcome);
  scored.resolutions = [...scored.resolutions, resolutionId].slice(-200);
  return { profile: scored, awarded: true };
}

function joinTaskForSlot(slot, profile, random, sessionId, mode) {
  const firstSession = profile.sessionsCompleted === 0 && mode === 'adventure';
  const reduceDemand = !firstSession && needsReducedDemand(profile.evidence.join);
  const activeMax = reduceDemand ? Math.min(5, profile.settings.joinMax) : profile.settings.joinMax;
  const firstFacts = [[1, 1], [2, 1], [2, 2], [2, 3]];
  let a;
  let b;
  if (firstSession) [a, b] = firstFacts[Math.min(slot, firstFacts.length - 1)];
  else {
    const facts = JOIN_FACTS.filter(pair => pair[0] + pair[1] >= profile.settings.joinMin && pair[0] + pair[1] <= activeMax);
    [a, b] = facts[Math.min(facts.length - 1, Math.floor(random() * facts.length))];
  }
  if (!firstSession && random() < 0.5) [a, b] = [b, a];
  const teachingDemo = firstSession && slot === 0;
  return makeJoinTask(a, b, {
    id: `${sessionId}-join-${slot}`,
    introducedMax: profile.settings.joinMax,
    teachingDemo,
    choiceCount: teachingDemo || reduceDemand ? 2 : 4,
    random
  });
}

function shareTaskForSlot(slot, profile, sessionId, firstSession) {
  if (firstSession && slot === 2) {
    return makeShareTask(3, 'targetRecipient', {
      id: `${sessionId}-share-${slot}`,
      target: { recipient: 'right', count: 1 },
      teachingDemo: true
    });
  }
  if (firstSession && slot === 4) {
    return makeShareTask(4, 'equalAll', { id: `${sessionId}-share-${slot}`, teachingDemo: true });
  }
  const evenTotals = [2, 4, 6, 8, 10].filter(total => total <= profile.settings.equalMax);
  const oddTotals = [3, 5, 7, 9].filter(total => total <= profile.settings.remainderMax);
  const reduceComposition = needsReducedDemand(profile.evidence['share.composition']);
  const reduceEquality = needsReducedDemand(profile.evidence['share.equal']);
  const equalTotal = reduceEquality ? 2 : evenTotals[slot % evenTotals.length];
  const remainderTotal = oddTotals[slot % oddTotals.length];
  const sequence = [
    makeShareTask(3, 'targetRecipient', { target: { recipient: 'right', count: 1 } }),
    makeShareTask(reduceComposition ? 3 : 5, 'freeGroups'),
    makeShareTask(2, 'equalAll'),
    makeShareTask(equalTotal, 'equalAll'),
    profile.settings.remaindersEnabled
      ? makeShareTask(remainderTotal, 'equalRemainder')
      : makeShareTask(4, 'targetRecipient', { target: { recipient: 'right', count: 2 } }),
    makeShareTask(5, 'targetRecipient', { target: { recipient: 'right', count: 2 } })
  ];
  return { ...sequence[slot % sequence.length], id: `${sessionId}-share-${slot}` };
}

export function createSessionPlan(mode, profileValue, seed = Date.now()) {
  const profile = createDefaultProfile(profileValue);
  const random = createSeededRandom(seed);
  const length = [4, 6, 8].includes(profile.settings.sessionLength) ? profile.settings.sessionLength : 6;
  const sessionId = `session-${seed}`;
  const defaultPattern = ['join', 'join', 'share', 'join', 'share', 'join', 'share', 'join'];
  const pattern = mode === 'join' ? Array(length).fill('join')
    : mode === 'share' ? Array(length).fill('share')
      : defaultPattern.slice(0, length);
  let joinSlot = 0;
  const tasks = pattern.map((kind, slot) => {
    if (kind === 'join') {
      const task = joinTaskForSlot(joinSlot, profile, random, sessionId, mode);
      joinSlot += 1;
      return task;
    }
    return shareTaskForSlot(slot, profile, sessionId, profile.sessionsCompleted === 0 && mode === 'adventure');
  });
  const joinTasks = tasks.filter(task => task.kind === 'join' && !task.teachingDemo);
  if (profile.sessionsCompleted > 0 && joinTasks.length && random() < Math.min(1, joinTasks.length * 0.2)) {
    joinTasks[Math.floor(random() * joinTasks.length)].representation = 'toys';
  }
  const recentJoin = profile.outcomes.filter(outcome => outcome.skillId === 'join').slice(-8);
  const visuallySolid = recentJoin.length >= 8
    && recentJoin.filter(outcome => outcome.firstAttemptCorrect && !(outcome.assistance || []).length).length >= 7;
  const numeralCandidates = joinTasks.filter(task => task.representation !== 'toys');
  if (visuallySolid && numeralCandidates.length) numeralCandidates.at(-1).answerSupport = 'numeralOnly';
  return tasks;
}

export function easierReplacement(task, profileValue, seed = Date.now()) {
  const profile = createDefaultProfile(profileValue);
  const random = createSeededRandom(seed);
  if (task.kind === 'join') return makeJoinTask(1, 1, {
    id: `${task.id}-easier`, introducedMax: profile.settings.joinMax, choiceCount: 2, random
  });
  return makeShareTask(2, 'equalAll', { id: `${task.id}-easier`, teachingDemo: true });
}
