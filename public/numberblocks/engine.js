export function normalizeParts(parts) {
  return [...parts]
    .map(Number)
    .filter(Number.isInteger)
    .filter(value => value > 0)
    .sort((a, b) => b - a);
}

export function partitionKey(parts) {
  return normalizeParts(parts).join('+');
}

export function totalParts(parts) {
  return parts.reduce((total, value) => total + Number(value || 0), 0);
}

export function isValidComposition(target, parts) {
  return Number.isInteger(target) &&
    target >= 1 &&
    Array.isArray(parts) &&
    parts.length > 0 &&
    parts.every(value => Number.isInteger(value) && value > 0) &&
    totalParts(parts) === target;
}

export function splitPart(parts, index, leftValue) {
  if (!Array.isArray(parts) || !Number.isInteger(index) || index < 0 || index >= parts.length) {
    throw new RangeError('Choose a part that exists.');
  }

  const whole = parts[index];
  if (!Number.isInteger(whole) || whole < 2) {
    throw new RangeError('Only a part of two or more can be split.');
  }
  if (!Number.isInteger(leftValue) || leftValue < 1 || leftValue >= whole) {
    throw new RangeError('A split must leave at least one block on each side.');
  }

  const next = [...parts];
  next.splice(index, 1, leftValue, whole - leftValue);
  return next;
}

export function joinParts(parts, firstIndex, secondIndex) {
  if (!Array.isArray(parts) || firstIndex === secondIndex) {
    throw new RangeError('Choose two different parts to join.');
  }
  const indices = [firstIndex, secondIndex].sort((a, b) => a - b);
  if (indices[0] < 0 || indices[1] >= parts.length || !indices.every(Number.isInteger)) {
    throw new RangeError('Choose two parts that exist.');
  }

  const next = [...parts];
  const combined = next[indices[0]] + next[indices[1]];
  next.splice(indices[1], 1);
  next.splice(indices[0], 1, combined);
  return next;
}

export function enumeratePartitions(number, options = {}) {
  if (!Number.isInteger(number) || number < 1) return [];
  const includeWhole = options.includeWhole !== false;
  const results = [];

  function visit(remaining, maximum, current) {
    if (remaining === 0) {
      if (includeWhole || current.length > 1) results.push(current);
      return;
    }
    for (let value = Math.min(maximum, remaining); value >= 1; value -= 1) {
      visit(remaining - value, value, [...current, value]);
    }
  }

  visit(number, number, []);
  return results;
}

export function formatEquation(target, parts) {
  if (!isValidComposition(target, parts)) return '';
  return `${target} = ${parts.join(' + ')}`;
}

export function chooseNumberChoices(random = Math.random) {
  const low = 2 + Math.floor(random() * 4);
  let high = 6 + Math.floor(random() * 4);
  if (high === low) high = high === 9 ? 8 : high + 1;
  return [low, high, 10].sort(() => random() - 0.5);
}

export function suggestedSplit(value, discoveredKeys = []) {
  if (!Number.isInteger(value) || value < 2) return null;
  const discovered = new Set(discoveredKeys);
  const candidates = [];
  for (let left = 1; left <= Math.floor(value / 2); left += 1) {
    const key = partitionKey([left, value - left]);
    candidates.push({ left, right: value - left, key, new: !discovered.has(key) });
  }
  return candidates.find(candidate => candidate.new) || candidates[0] || null;
}
