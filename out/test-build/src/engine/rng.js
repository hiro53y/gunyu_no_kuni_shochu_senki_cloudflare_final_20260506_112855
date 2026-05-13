"use strict";
// ===========================================================================
// 乱数エンジン v2.1
// シード固定可能な擬似乱数（mulberry32）。リプレイとテストの再現性のため。
// すべての乱数呼び出しはこのエンジンを経由する。
// ===========================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRng = createRng;
exports.makeInitialSeed = makeInitialSeed;
/** mulberry32 の1ステップ */
function step(seed) {
    let s = (seed + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const v = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return { next: v, seed: s };
}
/** 現在シードから新しい Rng を作る。next 等を呼ぶたびに内部シードを進める */
function createRng(initialSeed) {
    let seed = initialSeed | 0;
    const r = {
        next() {
            const { next, seed: s } = step(seed);
            seed = s;
            return next;
        },
        int(min, max) {
            const lo = Math.ceil(min);
            const hi = Math.floor(max);
            return lo + Math.floor(this.next() * (hi - lo + 1));
        },
        pick(arr) {
            if (arr.length === 0)
                throw new Error('rng.pick: empty array');
            return arr[this.int(0, arr.length - 1)];
        },
        chance(p) {
            return this.next() < p;
        },
        weighted(items, weights) {
            if (items.length !== weights.length)
                throw new Error('rng.weighted: length mismatch');
            const total = weights.reduce((a, b) => a + b, 0);
            let r = this.next() * total;
            for (let i = 0; i < items.length; i++) {
                r -= weights[i];
                if (r <= 0)
                    return items[i];
            }
            return items[items.length - 1];
        },
        getSeed() {
            return seed;
        },
    };
    return r;
}
/** 初回シード生成（時刻ベース） */
function makeInitialSeed() {
    return (Date.now() ^ Math.floor(Math.random() * 2 ** 31)) | 0;
}
