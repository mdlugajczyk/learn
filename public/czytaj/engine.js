import { CURRICULUM, itemById, itemsForStage } from './data/curriculum.js';
import { advanceLesson, ensureLessonPath, isSafeAuditoryChoice, itemCanBeRead, knownGraphemesForLesson, lessonFor, lessonsForStage } from './learning-path.js';

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
    exploration: { discoveriesByStage: {}, lastLanding: null },
    lessonPath: {},
    settings: { sound: true, effects: true, motion: true, controlsTaught: false },
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

function distractorGraphemes(answer, knownGraphemes, seed) {
  const graphemes = knownGraphemes.filter((value) => value !== answer && isSafeAuditoryChoice(value));
  return shuffled(graphemes, seed).slice(0, 3);
}

function itemForAnswer(stageItems, answer) {
  return stageItems.find((item) => item.answer === answer);
}

function sessionStory(stage, lessonIndex, number) {
  const lessons = lessonsForStage(stage);
  const storyReady = stage === 1 ? lessonIndex >= 3 : lessonIndex === lessons.length - 1;
  if (!storyReady) return null;
  const stories = CURRICULUM.stories.filter((value) => value.stage === stage);
  return stories[number % Math.max(1, stories.length)] ?? null;
}

export function selectSession(progress, now = new Date()) {
  const stage = Math.max(1, Math.min(12, progress.currentStage || 1));
  ensureLessonPath(progress);
  const repair = isRepairSession(progress);
  const number = progress.sessions.length + 1;
  const seed = `${progress.profile.createdAt}:${number}:${stage}`;
  const lesson = lessonFor(progress, stage);
  const focusGrapheme = repair ? null : lesson.focusGrapheme;
  const focusAlreadyIntroduced = focusGrapheme ? Boolean(progress.mastery[`grapheme:${focusGrapheme}`]?.introduced) : false;
  const knownGraphemes = knownGraphemesForLesson(stage, lesson.index, { includeFocus: !repair || focusAlreadyIntroduced });
  const knownSet = new Set(knownGraphemes);
  const current = itemsForStage(stage).filter((item) => itemCanBeRead(item, knownSet));
  const targets = lesson.targetAnswers.map((answer) => itemForAnswer(current, answer)).filter(Boolean);
  const priorTargetAnswers = new Set(lessonsForStage(stage).slice(0, lesson.index).flatMap((value) => value.targetAnswers));
  const secure = CURRICULUM.items.filter((item) => item.stage < stage && !item.assessOnly);
  const due = uniqueItems([...dueReview(progress, now), ...shuffled(secure, `${seed}:secure`)]).filter((item) => item.stage < stage || priorTargetAnswers.has(item.answer));
  const reviewCurrent = current.filter((item) => priorTargetAnswers.has(item.answer));
  const reviewItems = uniqueItems([...due, ...shuffled(reviewCurrent, `${seed}:current-review`)]);
  const transfer = shuffled(CURRICULUM.items.filter((item) => item.stage === stage && item.assessOnly && itemCanBeRead(item, knownSet)), `${seed}:transfer`);
  const unseenGrapheme = focusGrapheme && !focusAlreadyIntroduced ? focusGrapheme : null;

  const activities = [];
  if (!progress.settings?.controlsTaught) activities.push({ type: 'controls', instructionId: 'controls-speaker', expectedSeconds: 55 });

  const warmupPool = repair ? reviewItems : reviewItems.slice(0, 5);
  if (warmupPool.length >= 2) {
    const warmupItem = warmupPool[0];
    activities.push({ type: 'warmup', instructionId: 'warmup-blend', item: warmupItem, choices: warmupPool.slice(0, 3), expectedSeconds: 65 });
  }

  // Nowy znak zawsze pojawia się przed zadaniem, które używa go w sylabie lub słowie.
  if (focusGrapheme) {
    activities.push({ type: 'mapping', instructionId: 'mapping-new', grapheme: focusGrapheme, capital: focusGrapheme.toLocaleUpperCase('pl-PL'), expectedSeconds: 45, isNew: Boolean(unseenGrapheme) });
  }

  const reviewGraphemes = shuffled(knownGraphemes.filter(isSafeAuditoryChoice), `${seed}:grapheme-review`);
  const orderedGraphemes = uniqueItems([
    ...(focusGrapheme && isSafeAuditoryChoice(focusGrapheme) ? [{ id: focusGrapheme, value: focusGrapheme }] : []),
    ...reviewGraphemes.map((value) => ({ id: value, value }))
  ]).map((entry) => entry.value).slice(0, repair ? 6 : 4);
  for (const grapheme of orderedGraphemes) {
    const choices = shuffled([grapheme, ...distractorGraphemes(grapheme, knownGraphemes, `${seed}:${grapheme}`)], `${seed}:choices:${grapheme}`).slice(0, 4);
    if (choices.length >= 2) activities.push({ type: 'hear-choose', instructionId: 'review-choose', grapheme, choices, expectedSeconds: 22 });
  }

  const blendItems = repair ? reviewItems.slice(0, 4) : targets.slice(0, 4);
  for (const item of blendItems) activities.push({ type: 'blend', instructionId: 'blend-swipe', item, expectedSeconds: 38 });
  const buildPool = repair ? reviewItems : targets;
  const buildItem = buildPool.find((item) => item.graphemes.length >= 3) ?? buildPool.find((item) => item.graphemes.length >= 2) ?? null;
  if (buildItem) activities.push({ type: 'build', instructionId: 'build-word', item: buildItem, expectedSeconds: 70 });
  const meaningItem = (repair ? reviewItems : targets).find((item) => item.imageId) ?? null;
  if (meaningItem) activities.push({ type: 'meaning', instructionId: 'read-first', item: meaningItem, expectedSeconds: 70 });
  if (!repair && lesson.focusGrapheme == null && number % 3 === 0 && transfer[0]) activities.push({ type: 'nonword', instructionId: 'alien-word', item: transfer[0], expectedSeconds: 35 });
  const story = repair ? null : sessionStory(stage, lesson.index, number);
  if (story) activities.push({ type: 'story', instructionId: 'story-attempt', story, expectedSeconds: 85 });
  activities.push({ type: 'complete', instructionId: 'mission-complete', expectedSeconds: 25 });

  return {
    id: `session-${Date.now()}-${number}`,
    number, stage, seed, repair, lessonId: lesson.id, lessonIndex: lesson.index, lessonPurpose: lesson.purpose,
    knownGraphemes, focusGrapheme, newGrapheme: repair ? null : unseenGrapheme,
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
    newGrapheme: session.newGrapheme, lessonId: session.lessonId, lessonIndex: session.lessonIndex
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
  if (!session.repair && summary.accuracy >= 0.7) advanceLesson(progress, session.stage);
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
