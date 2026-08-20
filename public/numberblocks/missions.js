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

export function factKey(fact) {
  return `${fact.a}+${fact.b}`;
}

export function unlockedTier(sessionsCompleted = 0) {
  if (sessionsCompleted >= 8) return 4;
  if (sessionsCompleted >= 5) return 3;
  if (sessionsCompleted >= 2) return 2;
  return 1;
}

function sample(values, random) {
  return values[Math.min(values.length - 1, Math.floor(random() * values.length))];
}

export function chooseFact(progress = {}, random = Math.random, options = {}) {
  const sessionsCompleted = Number(progress.sessionsCompleted || 0);
  const tier = options.tier || unlockedTier(sessionsCompleted);
  const eligible = MISSION_FACTS.filter(fact => fact.tier <= tier && (!options.excludeKey || factKey(fact) !== options.excludeKey));
  const wins = progress.factWins || {};
  const leastPractised = Math.min(...eligible.map(fact => Number(wins[factKey(fact)] || 0)));
  const reviewPool = eligible.filter(fact => Number(wins[factKey(fact)] || 0) === leastPractised);
  return { ...sample(reviewPool.length ? reviewPool : eligible, random) };
}

export function createMissionPlan(progress = {}, random = Math.random) {
  const first = chooseFact(progress, random);
  let third;
  const canUseTen = unlockedTier(progress.sessionsCompleted || 0) >= 4;
  if (canUseTen && Number(progress.sessionsCompleted || 0) % 3 === 2) {
    third = { ...sample(MISSION_FACTS.filter(fact => fact.favorite), random) };
  } else {
    third = chooseFact(progress, random, { excludeKey: factKey(first) });
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

export function missionAudioName(kind, fact) {
  if (!fact) return `mission-${kind}.m4a`;
  return `mission-${kind}-${fact.a}-${fact.b}.m4a`;
}
