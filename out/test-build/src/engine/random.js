"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextSeed = nextSeed;
exports.randomFloat = randomFloat;
exports.randomInt = randomInt;
exports.randomRange = randomRange;
exports.chance = chance;
exports.pickOne = pickOne;
exports.pickWeighted = pickWeighted;
exports.boundedRandomMultiplier = boundedRandomMultiplier;
exports.clamp = clamp;
const UINT_MAX = 4_294_967_296;
function nextSeed(seed) {
    return (seed * 1_664_525 + 1_013_904_223) >>> 0;
}
function randomFloat(seed) {
    const next = nextSeed(seed);
    return { value: next / UINT_MAX, seed: next };
}
function randomInt(seed, min, max) {
    const roll = randomFloat(seed);
    const value = Math.floor(roll.value * (max - min + 1)) + min;
    return { value, seed: roll.seed };
}
function randomRange(seed, min, max) {
    const roll = randomFloat(seed);
    return { value: min + (max - min) * roll.value, seed: roll.seed };
}
function chance(seed, probability) {
    const roll = randomFloat(seed);
    return { value: roll.value < probability, seed: roll.seed };
}
function pickOne(seed, items) {
    if (items.length === 0) {
        return { value: null, seed };
    }
    const roll = randomInt(seed, 0, items.length - 1);
    return { value: items[roll.value], seed: roll.seed };
}
function pickWeighted(seed, items) {
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
function boundedRandomMultiplier(seed, spread = 0.15) {
    return randomRange(seed, 1 - spread, 1 + spread);
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
