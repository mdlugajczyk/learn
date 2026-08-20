export const MISSION_FACTS = Object.freeze([
  { a: 1, b: 1, sum: 2, tier: 1 },
  { a: 1, b: 2, sum: 3, tier: 1 },
  { a: 2, b: 2, sum: 4, tier: 1 },
  { a: 1, b: 3, sum: 4, tier: 1 },
  { a: 2, b: 3, sum: 5, tier: 1 },
  { a: 1, b: 4, sum: 5, tier: 1 },
  { a: 1, b: 5, sum: 6, tier: 2 },
  { a: 2, b: 4, sum: 6, tier: 2 },
  { a: 3, b: 3, sum: 6, tier: 2 },
  { a: 2, b: 5, sum: 7, tier: 2 },
  { a: 3, b: 4, sum: 7, tier: 2 },
  { a: 3, b: 5, sum: 8, tier: 3 },
  { a: 4, b: 4, sum: 8, tier: 3 },
  { a: 4, b: 5, sum: 9, tier: 3 },
  { a: 2, b: 8, sum: 10, tier: 4, favorite: true },
  { a: 3, b: 7, sum: 10, tier: 4, favorite: true },
  { a: 4, b: 6, sum: 10, tier: 4, favorite: true },
  { a: 5, b: 5, sum: 10, tier: 4, favorite: true }
]);

export const RANGE_PRESETS = Object.freeze([
  { id: 'little', label: '1–5', minSum: 2, maxSum: 5, description: 'Small number friends' },
  { id: 'growing', label: '1–7', minSum: 2, maxSum: 7, description: 'Ready for six and seven' },
  { id: 'all', label: '1–10', minSum: 2, maxSum: 10, description: 'The whole Number Magic world' },
  { id: 'big', label: '5–10', minSum: 5, maxSum: 10, description: 'Skip straight to bigger totals' }
]);

export function factKey(fact) {
  return `${fact.a}+${fact.b}`;
}

export function unlockedTier(sessionsCompleted = 0) {
  if (sessionsCompleted >= 8) return 4;
  if (sessionsCompleted >= 5) return 3;
  if (sessionsCompleted >= 2) return 2;
  return 1;
}

export function normalizeLearningSettings(value = {}) {
  const preset = RANGE_PRESETS.find(item => item.id === value.preset) || RANGE_PRESETS[0];
  const requestedMax = Number(value.adaptiveMax ?? preset.maxSum);
  return {
    configured: value.configured === true,
    preset: preset.id,
    autoAdvance: value.autoAdvance !== false,
    adaptiveMax: Math.max(preset.maxSum, Math.min(10, requestedMax))
  };
}

export function rangeForLearning(value = {}) {
  const settings = normalizeLearningSettings(value);
  const preset = RANGE_PRESETS.find(item => item.id === settings.preset) || RANGE_PRESETS[0];
  return { minSum: preset.minSum, maxSum: settings.adaptiveMax, startMax: preset.maxSum };
}

function factStat(progress, fact) {
  const key = factKey(fact);
  const stored = progress.factStats?.[key] || {};
  const legacyWins = Number(progress.factWins?.[key] || 0);
  const attempts = Number(stored.attempts ?? legacyWins);
  const recent = Array.isArray(stored.recent)
    ? stored.recent.slice(-5).map(value => value ? 1 : 0)
    : Array(Math.min(2, legacyWins)).fill(1);
  return {
    attempts,
    perfect: Number(stored.perfect ?? recent.reduce((total, value) => total + value, 0)),
    streak: Number(stored.streak ?? (recent.every(Boolean) ? recent.length : 0)),
    recent
  };
}

export function isFactMastered(progress = {}, fact) {
  const stat = factStat(progress, fact);
  return stat.attempts >= 2 && stat.recent.length >= 2 && stat.recent.slice(-2).every(Boolean);
}

export function recordFactResult(progress = {}, fact, { firstTry = true } = {}) {
  const key = factKey(fact);
  const previous = factStat(progress, fact);
  const result = firstTry ? 1 : 0;
  return {
    ...progress,
    factWins: {
      ...(progress.factWins || {}),
      [key]: Number(progress.factWins?.[key] || 0) + 1
    },
    factStats: {
      ...(progress.factStats || {}),
      [key]: {
        attempts: previous.attempts + 1,
        perfect: previous.perfect + result,
        streak: result ? previous.streak + 1 : 0,
        recent: [...previous.recent, result].slice(-5)
      }
    }
  };
}

export function learningStatus(progress = {}, learning = {}) {
  const settings = normalizeLearningSettings(learning);
  const range = rangeForLearning(settings);
  const frontierMin = Math.max(range.minSum, range.maxSum - 2);
  const frontier = MISSION_FACTS.filter(fact => fact.sum >= frontierMin && fact.sum <= range.maxSum);
  const mastered = frontier.filter(fact => isFactMastered(progress, fact)).length;
  const needed = Math.max(1, Math.ceil(frontier.length * .75));
  return {
    minSum: range.minSum,
    maxSum: range.maxSum,
    frontierTotal: frontier.length,
    frontierMastered: mastered,
    needed,
    readyToAdvance: settings.autoAdvance && range.maxSum < 10 && mastered >= needed
  };
}

export function advanceLearning(progress = {}, learning = {}) {
  const settings = normalizeLearningSettings(learning);
  const status = learningStatus(progress, settings);
  if (!status.readyToAdvance) return { learning: settings, unlocked: null };
  const unlocked = Math.min(10, settings.adaptiveMax + 1);
  return { learning: { ...settings, adaptiveMax: unlocked }, unlocked };
}

function sample(values, random) {
  return values[Math.min(values.length - 1, Math.floor(random() * values.length))];
}

export function chooseFact(progress = {}, random = Math.random, options = {}) {
  const range = rangeForLearning(options.learning);
  const eligible = MISSION_FACTS.filter(fact => (
    fact.sum >= range.minSum
    && fact.sum <= range.maxSum
    && (!options.excludeKey || factKey(fact) !== options.excludeKey)
  ));
  const learningPool = eligible.filter(fact => !isFactMastered(progress, fact));
  const masteredPool = eligible.filter(fact => isFactMastered(progress, fact));
  const useReview = learningPool.length && masteredPool.length && random() < .2;
  const pool = useReview ? masteredPool : (learningPool.length ? learningPool : eligible);
  const leastPractised = Math.min(...pool.map(fact => factStat(progress, fact).attempts));
  const reviewPool = pool.filter(fact => factStat(progress, fact).attempts === leastPractised);
  return { ...sample(reviewPool.length ? reviewPool : eligible, random) };
}

export function createMissionPlan(progress = {}, random = Math.random, learning = {}) {
  const first = chooseFact(progress, random, { learning });
  let third;
  const canUseTen = rangeForLearning(learning).maxSum >= 10;
  if (canUseTen && Number(progress.sessionsCompleted || 0) % 3 === 2) {
    third = { ...sample(MISSION_FACTS.filter(fact => fact.favorite), random) };
  } else {
    third = chooseFact(progress, random, { excludeKey: factKey(first), learning });
  }
  return [
    { mode: 'forward', fact: first },
    { mode: 'reverse', fact: { ...first } },
    { mode: 'forward', fact: third }
  ];
}

export function answerChoices(sum, random = Math.random) {
  const candidates = new Set([sum]);
  const offsets = [-1, 1, -2, 2, -3, 3];
  for (const offset of offsets) {
    const candidate = sum + offset;
    if (candidate >= 2 && candidate <= 10) candidates.add(candidate);
    if (candidates.size === 3) break;
  }
  const choices = [...candidates];
  for (let index = choices.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [choices[index], choices[swapIndex]] = [choices[swapIndex], choices[index]];
  }
  return choices;
}

export function isCorrectSplit(fact, parts) {
  if (!fact || !Array.isArray(parts) || parts.length !== 2) return false;
  const expected = [fact.a, fact.b].sort((left, right) => left - right);
  const actual = [...parts].sort((left, right) => left - right);
  return expected[0] === actual[0] && expected[1] === actual[1];
}

export function nextSplitStep(fact, pulled = 0) {
  if (!fact || !Number.isFinite(fact.a) || !Number.isFinite(fact.sum)) {
    return { pulled: 0, remaining: 0, complete: false };
  }
  const target = Math.max(1, Math.min(fact.sum - 1, Math.floor(fact.a)));
  const current = Math.max(0, Math.min(target, Math.floor(Number(pulled) || 0)));
  const next = Math.min(target, current + 1);
  return {
    pulled: next,
    remaining: fact.sum - next,
    complete: next === target
  };
}

export function missionAudioName(kind, fact) {
  if (!fact) return `mission-${kind}.mp3`;
  return `mission-${kind}-${fact.a}-${fact.b}.mp3`;
}
