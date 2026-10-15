// ===========================================================================
// 乱数エンジン v2.1
// シード固定可能な擬似乱数（mulberry32）。リプレイとテストの再現性のため。
// すべての乱数呼び出しはこのエンジンを経由する。
// ===========================================================================

/**
 * mulberry32: 32bit シード乱数。シンプルかつ十分な分布。
 * 状態は GameState.rngSeed として保持され、各呼び出しでシードを更新する。
 */
export interface Rng {
  /** 0以上1未満の小数を返す */
  next(): number;
  /** 整数 [min, max] (両端含む) */
  int(min: number, max: number): number;
  /** 配列からランダム選択 */
  pick<T>(arr: readonly T[]): T;
  /** 確率 0-1 で true を返す */
  chance(p: number): boolean;
  /** 重み付き選択。weights の長さは items と同じ */
  weighted<T>(items: readonly T[], weights: readonly number[]): T;
  /** 現在のシードを返す（保存用） */
  getSeed(): number;
}

/** mulberry32 の1ステップ */
function step(seed: number): { next: number; seed: number } {
  let s = (seed + 0x6D2B79F5) | 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const v = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { next: v, seed: s };
}

/** 現在シードから新しい Rng を作る。next 等を呼ぶたびに内部シードを進める */
export function createRng(initialSeed: number): Rng {
  let seed = initialSeed | 0;

  const r: Rng = {
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
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new Error('rng.pick: empty array');
      return arr[this.int(0, arr.length - 1)];
    },
    chance(p) {
      return this.next() < p;
    },
    weighted<T>(items: readonly T[], weights: readonly number[]): T {
      if (items.length !== weights.length) throw new Error('rng.weighted: length mismatch');
      const total = weights.reduce((a, b) => a + b, 0);
      let r = this.next() * total;
      for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
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
export function makeInitialSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 2 ** 31)) | 0;
}
