import { CURRICULUM, cumulativeGraphemes, itemById, itemsForStage } from './data/curriculum.js';

export const PROGRESS_SCHEMA_VERSION = 1;
export const REVIEW_INTERVALS = [1, 2, 4, 7, 14];
export const SOFT_CAP_MS = 10.5 * 60 * 1000;
export const HARD_CAP_MS = 12 * 60 * 1000;

export function createProgress(profile = {}) {
  return {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    profile: { name: '', address: 'Kosmonauto', createdAt: new Date().toISOString(), ...profile },
    onboardingComplete: false,
    baseline: null,
    currentStage: 1,
    mastery: {},
    reviewQueue: [],
    activeSession: null,
    sessions: [],
    errors: {},
    parentProbes: [],
    settings: { sound: true, effects: true, motion: true },
    offline: { version: null, verifiedAt: null, assetCount: 0, totalBytes: 0 },
    updatedAt: new Date().toISOString()
  };
}

export function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed) {
  let state = hashSeed(seed) || 1;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled(values, seed) {
  const result = [...values];
  const random = seededRandom(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function isRepairSession(progress) {
  const recent = progress.sessions.slice(-2);
  return recent.length === 2 && recent.every((session) => session.accuracy < 0.7);
}

function dueReview(progress, now) {
  return progress.reviewQueue
    .filter((entry) => new Date(entry.dueAt).getTime() <= now.getTime())
    .map((entry) => itemById(entry.itemId))
    .filter(Boolean);
}

function uniqueItems(values) {
  return [...new Map(values.filter(Boolean).map((value) => [value.id, value])).values()];
}

function distractorGraphemes(answer, stage, seed) {
  const graphemes = cumulativeGraphemes(stage).filter((value) => value !== answer);
  return shuffled(graphemes, seed).slice(0, 3);
}

function firstGrapheme(answer, stage) {
  return cumulativeGraphemes(stage).sort((a, b) => b.length - a.length).find((value) => answer.toLocaleLowerCase('pl-PL').startsWith(value)) ?? answer[0].toLocaleLowerCase('pl-PL');
}

export function selectSession(progress, now = new Date()) {
  const stage = Math.max(1, Math.min(12, progress.currentStage || 1));
  const repair = isRepairSession(progress);
  const number = progress.sessions.length + 1;
  const seed = `${progress.profile.createdAt}:${number}:${stage}`;
  const current = itemsForStage(stage);
  const secure = CURRICULUM.items.filter((item) => item.stage < stage && !item.assessOnly);
  const due = uniqueItems([...dueReview(progress, now), ...shuffled(secure, `${seed}:secure`)]);
  const currentShuffled = shuffled(current, `${seed}:current`);
  const transfer = shuffled(CURRICULUM.items.filter((item) => item.stage === stage && item.assessOnly), `${seed}:transfer`);
  const newGraphemes = CURRICULUM.stages[stage].introducedGraphemes.filter((value) => !['cluster', 'morpheme'].includes(value));
  const unseenGrapheme = newGraphemes.find((value) => !progress.mastery[`grapheme:${value}`]?.introduced) ?? null;
  const focusGrapheme = unseenGrapheme ?? [...newGraphemes].sort((a, b) => (progress.mastery[`grapheme:${a}`]?.trials ?? 0) - (progress.mastery[`grapheme:${b}`]?.trials ?? 0))[0] ?? null;

  const activities = [];
  activities.push({ type: 'warmup', instructionId: 'warmup-blend', item: currentShuffled[0], expectedSeconds: 75 });
  for (const item of uniqueItems([...due.slice(0, repair ? 6 : 4), ...currentShuffled]).slice(0, repair ? 6 : 5)) {
    const grapheme = firstGrapheme(item.answer, stage);
    activities.push({ type: 'hear-choose', instructionId: 'review-choose', item, grapheme, choices: shuffled([grapheme, ...distractorGraphemes(grapheme, stage, `${seed}:${item.id}`)], `${seed}:choices:${item.id}`).slice(0, 4), expectedSeconds: 22 });
  }
  if (!repair && focusGrapheme) {
    activities.push({ type: 'mapping', instructionId: 'mapping-new', grapheme: focusGrapheme, capital: focusGrapheme.toLocaleUpperCase('pl-PL'), expectedSeconds: 45, isNew: Boolean(unseenGrapheme) });
  }
  const blendItems = repair ? due.slice(0, 4) : currentShuffled.slice(1, 5);
  for (const item of blendItems) activities.push({ type: 'blend', instructionId: 'blend-swipe', item, expectedSeconds: 35 });
  const buildItem = currentShuffled[5] ?? currentShuffled[1];
  if (buildItem) activities.push({ type: 'build', instructionId: 'build-word', item: buildItem, expectedSeconds: 70 });
  const meaningItem = currentShuffled.find((item) => item.imageId) ?? currentShuffled[6] ?? currentShuffled[0];
  if (meaningItem) activities.push({ type: 'meaning', instructionId: 'read-first', item: meaningItem, expectedSeconds: 70 });
  if (!repair && number % 3 === 0 && transfer[0]) activities.push({ type: 'nonword', instructionId: 'alien-word', item: transfer[0], expectedSeconds: 35 });
  const story = CURRICULUM.stories.find((value) => value.stage === stage && value.id.endsWith(number % 2 ? '1' : '2'))
    ?? CURRICULUM.stories.filter((value) => value.stage === stage)[number % 2];
  if (story) activities.push({ type: 'story', instructionId: 'story-attempt', story, expectedSeconds: 85 });
  activities.push({ type: 'complete', instructionId: 'mission-complete', expectedSeconds: 25 });

  return {
    id: `session-${Date.now()}-${number}`,
    number, stage, seed, repair, focusGrapheme: repair ? null : focusGrapheme, newGrapheme: repair ? null : unseenGrapheme,
    startedAt: now.toISOString(), activityIndex: 0, activities, attempts: [], elapsedMs: 0
  };
}

export function canBeginNextActivity(session, now = new Date()) {
  const elapsed = now.getTime() - new Date(session.startedAt).getTime();
  const next = session.activities[session.activityIndex];
  if (!next || next.type === 'complete') return true;
  return elapsed < SOFT_CAP_MS;
}

export function mustStop(session, now = new Date()) {
  return now.getTime() - new Date(session.startedAt).getTime() >= HARD_CAP_MS;
}

export function recordAttempt(progress, session, activity, { correct, latencyMs = 0, answer = null, verified = true }) {
  const itemId = activity.item?.id ?? `grapheme:${activity.grapheme ?? 'oral'}`;
  const attempt = { itemId, type: activity.type, grapheme: activity.grapheme ?? null, correct: Boolean(correct), answer, latencyMs, verified, at: new Date().toISOString(), trained: activity.item?.trained ?? true };
  session.attempts.push(attempt);
  if (!correct) {
    progress.errors[itemId] = (progress.errors[itemId] ?? 0) + 1;
    const delayed = { ...activity, retry: true, instructionId: activity.instructionId };
    const insertion = Math.min(session.activities.length - 1, session.activityIndex + 3);
    session.activities.splice(insertion, 0, delayed);
  }
  return attempt;
}

function addReview(progress, itemId, correct, now) {
  const existing = progress.reviewQueue.find((entry) => entry.itemId === itemId);
  const intervalIndex = correct ? Math.min(REVIEW_INTERVALS.length - 1, (existing?.intervalIndex ?? -1) + 1) : 0;
  const dueAt = new Date(now);
  dueAt.setDate(dueAt.getDate() + REVIEW_INTERVALS[intervalIndex]);
  const next = { itemId, intervalIndex, dueAt: dueAt.toISOString(), lastResult: correct };
  progress.reviewQueue = [...progress.reviewQueue.filter((entry) => entry.itemId !== itemId), next];
}

export function finalizeSession(progress, session, now = new Date()) {
  const scored = session.attempts.filter((attempt) => attempt.verified);
  const correct = scored.filter((attempt) => attempt.correct).length;
  const trained = scored.filter((attempt) => attempt.trained);
  const unseen = scored.filter((attempt) => !attempt.trained);
  const summary = {
    id: session.id, number: session.number, stage: session.stage, repair: session.repair,
    startedAt: session.startedAt, completedAt: now.toISOString(), durationMs: Math.max(0, now.getTime() - new Date(session.startedAt).getTime()),
    attempts: scored.length, correct, accuracy: scored.length ? correct / scored.length : 1,
    trainedAccuracy: trained.length ? trained.filter((value) => value.correct).length / trained.length : null,
    unseenAccuracy: unseen.length ? unseen.filter((value) => value.correct).length / unseen.length : null,
    newGrapheme: session.newGrapheme
  };
  for (const attempt of scored) {
    if (!attempt.itemId.startsWith('grapheme:')) addReview(progress, attempt.itemId, attempt.correct, now);
    const itemKey = `item:${attempt.itemId}`;
    const itemMastery = progress.mastery[itemKey] ?? { trials: 0, correct: 0, sessions: [] };
    itemMastery.trials += 1;
    itemMastery.correct += attempt.correct ? 1 : 0;
    itemMastery.sessions = [...new Set([...itemMastery.sessions, session.id])];
    itemMastery.lastSeenAt = now.toISOString();
    progress.mastery[itemKey] = itemMastery;
  }
  if (session.focusGrapheme) {
    const key = `grapheme:${session.focusGrapheme}`;
    const prior = progress.mastery[key] ?? { introduced: false, trials: 0, correct: 0, sessions: [], firstSeenAt: now.toISOString() };
    const related = scored.filter((attempt) => attempt.grapheme === session.focusGrapheme || itemById(attempt.itemId)?.answer.includes(session.focusGrapheme));
    prior.introduced = true;
    prior.trials += related.length;
    prior.correct += related.filter((attempt) => attempt.correct).length;
    prior.sessions = [...new Set([...prior.sessions, session.id])];
    prior.lastSeenAt = now.toISOString();
    prior.provisional = prior.trials >= 12 && prior.correct / prior.trials >= 0.9 && prior.sessions.length >= 3 && new Date(prior.lastSeenAt).toDateString() !== new Date(prior.firstSeenAt).toDateString();
    progress.mastery[key] = prior;
  }

  const blendingKey = `stage:${session.stage}:blending`;
  const blending = progress.mastery[blendingKey] ?? { trials: 0, correct: 0, sessions: [] };
  const transferTrials = scored.filter((attempt) => ['blend', 'build', 'nonword'].includes(attempt.type) && !attempt.trained);
  blending.trials += transferTrials.length;
  blending.correct += transferTrials.filter((attempt) => attempt.correct).length;
  blending.sessions = [...new Set([...blending.sessions, ...(transferTrials.length ? [session.id] : [])])];
  blending.lastSeenAt = now.toISOString();
  blending.mastered = blending.trials >= 8 && blending.correct / blending.trials >= 0.8;
  progress.mastery[blendingKey] = blending;

  const stageGraphemes = CURRICULUM.stages[session.stage].introducedGraphemes.filter((value) => !['cluster', 'morpheme'].includes(value));
  const graphemesReady = stageGraphemes.length === 0 || stageGraphemes.every((value) => progress.mastery[`grapheme:${value}`]?.provisional);
  if (session.stage < 12 && graphemesReady && blending.mastered) progress.currentStage = session.stage + 1;
  progress.sessions.push(summary);
  if (summary.number % 5 === 0) progress.parentProbes.push({ id: `probe-${summary.number}`, due: true, stage: summary.stage, itemIds: shuffled(CURRICULUM.items.filter((item) => item.stage === summary.stage), `${session.seed}:probe`).slice(0, 5).map((item) => item.id) });
  progress.activeSession = null;
  progress.updatedAt = now.toISOString();
  return summary;
}

export function assignBaselineStage(scores) {
  if (!scores) return 1;
  if ((scores.lowercase ?? 0) < 0.6 || (scores.blending ?? 0) < 0.4) return 1;
  if ((scores.decoding ?? 0) >= 0.8 && (scores.blending ?? 0) >= 0.8) return Math.min(5, Math.max(2, scores.suggestedStage ?? 2));
  return 2;
}
