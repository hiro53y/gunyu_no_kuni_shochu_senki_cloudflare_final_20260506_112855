export interface RandomResult<T> {
  value: T;
  seed: number;
}

const UINT_MAX = 4_294_967_296;

export function nextSeed(seed: number): number {
  return (seed * 1_664_525 + 1_013_904_223) >>> 0;
}

export function randomFloat(seed: number): RandomResult<number> {
  const next = nextSeed(seed);
  return { value: next / UINT_MAX, seed: next };
}

export function randomInt(seed: number, min: number, max: number): RandomResult<number> {
  const roll = randomFloat(seed);
  const value = Math.floor(roll.value * (max - min + 1)) + min;
  return { value, seed: roll.seed };
}

export function randomRange(seed: number, min: number, max: number): RandomResult<number> {
  const roll = randomFloat(seed);
  return { value: min + (max - min) * roll.value, seed: roll.seed };
}

export function chance(seed: number, probability: number): RandomResult<boolean> {
  const roll = randomFloat(seed);
  return { value: roll.value < probability, seed: roll.seed };
}

export function pickOne<T>(seed: number, items: readonly T[]): RandomResult<T | null> {
  if (items.length === 0) {
    return { value: null, seed };
  }
  const roll = randomInt(seed, 0, items.length - 1);
  return { value: items[roll.value], seed: roll.seed };
}

export function pickWeighted<T extends { weight: number }>(seed: number, items: readonly T[]): RandomResult<T | null> {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (total <= 0) {
    return { value: null, seed };
  }

  const roll = randomRange(seed, 0, total);
  let cursor = 0;
  for (const item of items) {
    cursor += Math.max(0, item.weight);
    if (roll.value <= cursor) {
      return { value: item, seed: roll.seed };
    }
  }

  return { value: items[items.length - 1], seed: roll.seed };
}

export function boundedRandomMultiplier(seed: number, spread = 0.15): RandomResult<number> {
  return randomRange(seed, 1 - spread, 1 + spread);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
