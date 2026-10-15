// 迷宮の中の武将：強さの計算・駒を置く・経験とレベル
import { range } from './rng';
import { ev, expFor, log, newUid, type Ctx } from './core';
import type { GenSpec, Monster } from './types';

export interface GenStats { maxHp: number; atk: number; def: number; exp: number }

/** 武将の強さ（レベルと統率・武力から） */
export function genStats(g: GenSpec): GenStats {
  let maxHp = 15 + g.lv * 3.6 + g.cmd * 0.1;
  let atk = 1 + g.lv * 0.7 + g.pow * 0.03;
  let def = g.lv * 0.45 + g.cmd * 0.02;
  let exp = (2 + g.lv * g.lv * 0.26 + g.lv) * 1.6;
  if (!g.ally) {
    if (g.role === 'boss') { maxHp *= 3; atk *= 1.15; def *= 1.1; exp *= 6; }
    else if (g.role === 'mid') { maxHp *= 2.2; atk *= 1.08; def *= 1.05; exp *= 4; }
    else if (g.role === 'commander') { maxHp *= 2.2; atk *= 1.05; exp *= 4; }
  }
  return { maxHp: Math.round(maxHp), atk: Math.round(atk * 10) / 10, def: Math.round(def * 10) / 10, exp: Math.round(exp) };
}

/** 武将の駒を迷宮に置く（x<0 なら置き場所はあとで決める） */
export function spawnGeneral(ctx: Ctx, g: GenSpec, x: number, y: number): Monster {
  const run = ctx.run;
  const s = genStats(g);
  const m: Monster = {
    uid: newUid(run), id: 'general', x, y, dir: g.ally ? 4 : 4, hp: s.maxHp, maxHp: s.maxHp, awake: true, st: {},
    gen: g.id, gname: g.name, atkV: s.atk, defV: s.def, expV: s.exp,
  };
  if (g.ally) m.ally = true;
  else m.role = 'boss';
  if (x >= 0) run.monsters.push(m);
  return m;
}

/** 部隊の武将のレベルが上がった時：強さを計算し直し、HPも増やす */
function genLevelUp(ctx: Ctx, m: Monster, g: GenSpec) {
  g.lv += 1;
  const s = genStats(g);
  const gain = s.maxHp - m.maxHp;
  m.maxHp = s.maxHp;
  m.hp = Math.min(m.maxHp, m.hp + Math.max(gain, range(ctx.r, 3, 6)));
  m.atkV = s.atk;
  m.defV = s.def;
  log(ctx, `${g.name}のレベルが${g.lv}に上がった！`, 'good');
  ev(ctx, { k: 'popup', x: m.x, y: m.y, text: 'LvUP', color: '#ffd84a' });
}

/** 部隊の武将に経験を配る（倒した本人は満額、ほかは半分） */
export function shareGenExp(ctx: Ctx, n: number, killer: Monster | null) {
  const run = ctx.run;
  for (const m of run.monsters) {
    if (!m.ally || m.dead || !m.gen) continue;
    const g = run.gens[m.gen];
    if (!g) continue;
    g.exp += Math.round(n * (m === killer ? 1 : 0.5));
    while (g.lv < 99 && g.exp >= expFor(g.lv + 1)) genLevelUp(ctx, m, g);
  }
}

/** 部隊の武将（迷宮にいる駒） */
export function partyMonsters(ctx: Ctx | { run: Ctx['run'] }): Monster[] {
  return ctx.run.monsters.filter((m) => m.ally && !m.dead && !!m.gen);
}
