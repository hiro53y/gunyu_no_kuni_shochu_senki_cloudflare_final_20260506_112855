// 敵と仲間の動き
import { monDef } from '../content/monsters';
import { chance, int, range } from './rng';
import { at, canStand, cheb, cornerOk, distanceField, dirTo, isWall, lineDir, monsterAt, moveKind, roomAt, visibleFrom, type MoveKind } from './geo';
import { damageRoll, ev, log, monAtk, monDefense, monName, type Ctx } from './core';
import { hostile, hurtMonster, hurtPlayer, revealDisguise, spawnNear } from './actors';
import { monsterHitsMonster, monsterHitsPlayer, rangedAbility, scorch, trace } from './combat';
import { randomMonsterId } from './mapgen';
import { runDanger } from './run';
import { enemySkill } from './skills';
import { next } from './rng';
import { DIRS, DX, DY, type Dir, type Monster, type Pos } from './types';

/** 聖域の巻物が置いてあるマス */
function sanctuary(ctx: Ctx, x: number, y: number): boolean {
  return ctx.run.floor.items.some((fi) => fi.x === x && fi.y === y && fi.item.id === 's_seiiki' && !fi.item.shop);
}

/** プレイヤーから（または任意の点から）の距離の地図。手番の間は使い回す */
function field(ctx: Ctx, from: Pos, kind: MoveKind): Int16Array {
  const key = `${from.x},${from.y},${kind}`;
  let f = ctx.fields.get(key);
  if (!f) {
    f = distanceField(ctx.run.floor, from, kind === 'phase' ? 'walk' : kind);
    ctx.fields.set(key, f);
  }
  return f;
}

function free(ctx: Ctx, m: Monster, x: number, y: number): boolean {
  const run = ctx.run;
  if (!canStand(run.floor, x, y, moveKind(m))) return false;
  if (run.player.x === x && run.player.y === y) return false;
  if (monsterAt(run, x, y)) return false;
  if (!m.ally && sanctuary(ctx, x, y)) return false;
  if (!m.ally && m.role !== 'keeper' && inShop(ctx, x, y) && !inShop(ctx, m.x, m.y)) return false;
  return true;
}

/** 店の部屋のマスか */
function inShop(ctx: Ctx, x: number, y: number): boolean {
  return roomAt(ctx.run.floor, x, y)?.kind === 'shop';
}

function moveTo(ctx: Ctx, m: Monster, x: number, y: number) {
  const fx = m.x, fy = m.y;
  const d = dirTo(m, { x, y });
  if (d !== null) m.dir = d;
  m.x = x;
  m.y = y;
  ev(ctx, { k: 'move', uid: m.uid, fx, fy, tx: x, ty: y });
}

/** 目的地に近づく1歩。壁抜けは直進、それ以外は距離の地図に沿う */
function stepToward(ctx: Ctx, m: Monster, goal: Pos, away = false): boolean {
  const f = ctx.run.floor;
  const kind = moveKind(m);
  const field0 = kind === 'phase' ? null : field(ctx, goal, kind);
  // 目的地へ道がつながっていない時は、まっすぐ近づくだけ
  const dist = field0 && field0[at(f, m.x, m.y)] >= 0 ? field0 : null;
  const valueAt = (x: number, y: number) => (dist ? dist[at(f, x, y)] : cheb({ x, y }, goal));
  const here = valueAt(m.x, m.y);
  let best: { x: number; y: number; v: number; score: number } | null = null;
  for (const d of DIRS) {
    const x = m.x + DX[d], y = m.y + DY[d];
    if (!free(ctx, m, x, y) || !cornerOk(f, m.x, m.y, d, kind)) continue;
    const v = valueAt(x, y);
    if (v < 0) continue;
    // 同じ距離なら、まっすぐ向かう（逃げる時は遠ざかる）方を選ぶ
    const tie = (Math.abs(goal.x - x) + Math.abs(goal.y - y)) * 0.01;
    const score = away ? -v - tie : v + tie;
    if (!best || score < best.score) best = { x, y, v, score };
  }
  if (!best) return false;
  if (away ? best.v <= here : best.v >= here) return false;
  moveTo(ctx, m, best.x, best.y);
  return true;
}

/** 部屋の中か出入り口からなら部屋全体、通路なら周り1マスが見える */
function seesPlayer(ctx: Ctx, m: Monster): boolean {
  const run = ctx.run;
  // 姿隠し：隣にいても気づかれにくい
  if (run.player.st.hidden) return cheb(m, run.player) <= 1 && chance(ctx.r, 0.25);
  if (cheb(m, run.player) <= 1) return true;
  if (run.floor.dark || run.floor.fog) return cheb(m, run.player) <= (run.floor.fog ? 2 : 1);
  const vis = visibleFrom(run.floor, m.x, m.y);
  return vis.has(at(run.floor, run.player.x, run.player.y));
}

function randomGoal(ctx: Ctx, m: Monster): Pos | null {
  const f = ctx.run.floor;
  const rooms = f.rooms.filter((r) => r.kind !== 'shop');
  if (!rooms.length) return null;
  const room = rooms[int(ctx.r, rooms.length)];
  for (let i = 0; i < 10; i++) {
    const x = room.x + int(ctx.r, room.w), y = room.y + int(ctx.r, room.h);
    if (canStand(f, x, y, moveKind(m) === 'phase' ? 'walk' : moveKind(m))) return { x, y };
  }
  return null;
}

/** 隣（角を挟まない）か */
function adjacent(ctx: Ctx, a: Pos, b: Pos, kind: MoveKind): boolean {
  if (cheb(a, b) !== 1) return false;
  const d = dirTo(a, b)!;
  return cornerOk(ctx.run.floor, a.x, a.y, d, kind === 'phase' ? 'walk' : kind);
}

/** 1回分の行動 */
export function monsterAct(ctx: Ctx, m: Monster) {
  const run = ctx.run;
  if (m.dead || run.end) return;
  const def = monDef(m.id);
  const st = m.st;
  if (st.paralyze) { if (st.paralyze < 999) st.paralyze -= 1; return; }
  if (st.sleep) { st.sleep -= 1; return; }
  if (def.ability.k === 'regen' && !st.sealed && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + def.ability.n);
  if (m.ally) { allyAct(ctx, m); return; }
  if (m.role === 'npc') {
    const d = dirTo(m, run.player);
    if (d !== null && cheb(m, run.player) <= 3) m.dir = d;
    return;
  }
  // 身代わりは自分では動かない
  if (st.decoy) return;
  if (m.role === 'keeper' && !m.angry) {
    const d = dirTo(m, run.player);
    if (d !== null && cheb(m, run.player) <= 4) m.dir = d;
    return;
  }
  const p = run.player;
  // 化け狸：隣に来たら正体を現す
  if (m.disguise) {
    if (cheb(m, p) <= 1) revealDisguise(ctx, m);
    return;
  }
  if (!m.awake) {
    const sameRoom = roomAt(run.floor, m.x, m.y) && roomAt(run.floor, m.x, m.y) === roomAt(run.floor, p.x, p.y);
    const near = cheb(m, p) <= 1;
    const wake = near ? (def.sleepy ? 0.25 : 0.5) : sameRoom ? (def.sleepy ? 0.02 : 0.1) : 0;
    if (chance(ctx.r, wake)) m.awake = true;
    return;
  }
  // 混乱：でたらめに動き、そこにいる者を叩く
  if (st.confuse) {
    st.confuse -= 1;
    const d = int(ctx.r, 8) as Dir;
    const x = m.x + DX[d], y = m.y + DY[d];
    m.dir = d;
    if (p.x === x && p.y === y && cornerOk(run.floor, m.x, m.y, d, moveKind(m))) { monsterHitsPlayer(ctx, m); return; }
    const other = monsterAt(run, x, y);
    if (other && cornerOk(run.floor, m.x, m.y, d, moveKind(m))) { monsterHitsMonster(ctx, m, other); return; }
    if (free(ctx, m, x, y) && cornerOk(run.floor, m.x, m.y, d, moveKind(m))) moveTo(ctx, m, x, y);
    return;
  }
  const kind = moveKind(m);
  // 盗んで逃げている
  if (m.fleeing) {
    if (seesPlayer(ctx, m)) stepToward(ctx, m, p, true);
    else if (chance(ctx.r, 0.3)) {
      const goal = m.wander && cheb(m, m.wander) > 0 ? m.wander : (m.wander = randomGoal(ctx, m));
      if (goal) stepToward(ctx, m, goal);
    }
    return;
  }
  // 身代わりがいれば、そちらを狙う
  const decoy = run.monsters.find((o) => o !== m && !o.dead && o.st.decoy && cheb(o, m) <= 8);
  if (decoy) {
    if (adjacent(ctx, m, decoy, kind)) { m.dir = dirTo(m, decoy)!; monsterHitsMonster(ctx, m, decoy); return; }
    if (stepToward(ctx, m, decoy)) return;
  }
  const sees = seesPlayer(ctx, m);
  if (sees) m.goal = { x: p.x, y: p.y };
  // 敵の将：弱ると援軍を呼び、技を使う
  if (m.gen) {
    if (!m.called && m.hp < m.maxHp * 0.5) {
      m.called = true;
      let n = 0;
      const count = run.mode === 'defense' ? 3 : 2;
      for (let i = 0; i < count; i++) if (spawnNear(ctx, randomMonsterId(ctx.r, runDanger(run), run.banned, run.faction), m, 1, 3)) n++;
      if (n) {
        log(ctx, `${monName(m)}「者ども、出合え！」 援軍が駆けつけた！`, 'warn');
        ev(ctx, { k: 'se', name: 'roar' });
        return;
      }
    }
    if ((sees || cheb(m, p) <= 6) && enemySkill(ctx, m)) return;
    if (generalReach(ctx, m)) return;
  }
  if (!m.role && inShop(ctx, m.x, m.y)) {
    m.goal = null;
    if (!m.wander || inShop(ctx, m.wander.x, m.wander.y)) m.wander = randomGoal(ctx, m);
  }
  // ボス：配下を呼ぶ
  if (def.ability.k === 'boss' && !st.sealed) {
    m.cd = (m.cd ?? 0) - 1;
    if (m.cd <= 0 && chance(ctx.r, 0.3)) {
      m.cd = 10;
      let n = 0;
      // 弱ってくると呼ぶ数が増える
      const count = m.hp < m.maxHp * 0.5 ? 2 : 1;
      for (let i = 0; i < count; i++) if (spawnNear(ctx, randomMonsterId(ctx.r, runDanger(run) - 6, run.banned, run.faction), m, 1, 3)) n++;
      if (n) {
        log(ctx, `${def.name}が配下を呼び寄せた！`, 'warn');
        ev(ctx, { k: 'se', name: 'roar' });
        return;
      }
    }
    const line = lineDir(m, p);
    if (line && line.dist >= 2 && line.dist <= 8 && chance(ctx.r, 0.3)) {
      const tr = trace(ctx, m, line.dir, line.dist, { hitPlayer: true });
      if (tr.hitPlayer) {
        m.dir = line.dir;
        ev(ctx, { k: 'beam', fx: m.x, fy: m.y, tx: p.x, ty: p.y, color: '#ff4a1a' });
        ev(ctx, { k: 'se', name: 'fire' });
        scorch(ctx, tr.path);
        log(ctx, `${def.name}は業火を吐いた！`, 'bad');
        hurtPlayer(ctx, range(ctx.r, 22, 32), `${def.name}の業火`);
        return;
      }
    }
  }
  // 遠くからの特技
  if (sees && !st.sealed) {
    const line = lineDir(m, p);
    if (line && line.dist >= 2 && rangedAbility(ctx, m, line)) return;
    // 2マス先まで届く
    if (def.ability.k === 'reach' && line && line.dist === 2) {
      const mx = m.x + DX[line.dir], my = m.y + DY[line.dir];
      if (!isWall(run.floor, mx, my) && cornerOk(run.floor, m.x, m.y, line.dir) && cornerOk(run.floor, mx, my, line.dir) && !monsterAt(run, mx, my)) {
        m.dir = line.dir;
        monsterHitsPlayer(ctx, m);
        return;
      }
    }
  }
  // 部屋に入ってこない将は、階段（持ち場）の近くで待ち構える
  if (m.gen && run.midGen === m.gen && !m.goal && run.floor.stairs && cheb(m, run.floor.stairs) > 2 && !sees) {
    stepToward(ctx, m, run.floor.stairs);
    return;
  }
  // 隣ならプレイヤーを叩く（聖域の上なら叩けない）
  if (adjacent(ctx, m, p, kind)) {
    if (sanctuary(ctx, p.x, p.y)) return;
    m.dir = dirTo(m, p)!;
    monsterHitsPlayer(ctx, m);
    if (def.ability.k === 'double' && !st.sealed && !run.end && !m.dead) monsterHitsPlayer(ctx, m);
    return;
  }
  // 隣の仲間を叩く
  const allyNear = run.monsters.find((o) => o.ally && !o.dead && adjacent(ctx, m, o, kind));
  if (allyNear && chance(ctx.r, 0.7)) {
    m.dir = dirTo(m, allyNear)!;
    monsterHitsMonster(ctx, m, allyNear);
    return;
  }
  // 動く
  if (m.goal) {
    if (m.x === m.goal.x && m.y === m.goal.y) m.goal = null;
    else if (!stepToward(ctx, m, m.goal)) {
      // 道がふさがっていたら少し待ち、ときどき諦める
      if (!sees && chance(ctx.r, 0.3)) m.goal = null;
    }
    if (m.goal || sees) return;
  }
  if (!m.wander || (m.x === m.wander.x && m.y === m.wander.y) || chance(ctx.r, 0.02)) m.wander = randomGoal(ctx, m);
  if (m.wander && !stepToward(ctx, m, m.wander) && chance(ctx.r, 0.25)) m.wander = null;
}

/** 仲間：近くの敵を叩き、いなければプレイヤーについていく。弓・鉄砲の武将は離れて撃ち、槍は2マス先を突く */
function allyAct(ctx: Ctx, m: Monster) {
  const run = ctx.run;
  const p = run.player;
  const kind = moveKind(m);
  if (m.st.confuse) m.st.confuse -= 1;
  const style = m.gen ? run.gens[m.gen]?.style ?? 'melee' : 'melee';
  const enemies = run.monsters.filter((o) => hostile(o) && o !== m && !o.disguise);
  const near = enemies.filter((o) => adjacent(ctx, m, o, kind)).sort((a, b) => a.hp - b.hp)[0];
  if (near) {
    m.dir = dirTo(m, near)!;
    monsterHitsMonster(ctx, m, near);
    return;
  }
  const vis = visibleFrom(run.floor, m.x, m.y);
  const seen = enemies.filter((o) => vis.has(at(run.floor, o.x, o.y)) && cheb(o, p) <= 8).sort((a, b) => cheb(a, m) - cheb(b, m));
  // 槍：2マス先の敵を突く
  if (style === 'reach' || style === 'bow' || style === 'gun') {
    const maxD = style === 'reach' ? 2 : style === 'bow' ? 6 : 8;
    for (const o of seen) {
      const line = lineDir(m, o);
      if (!line || line.dist > maxD || line.dist < 2) continue;
      const tr = trace(ctx, m, line.dir, line.dist, { ignore: m });
      if (tr.hits[0] !== o || tr.path.length !== line.dist) continue;
      m.dir = line.dir;
      if (style === 'reach') { monsterHitsMonster(ctx, m, o); return; }
      ev(ctx, { k: style === 'gun' ? 'beam' : 'proj', fx: m.x, fy: m.y, tx: o.x, ty: o.y, ...(style === 'gun' ? { color: '#ffd080' } : { sprite: 'arrow' }) } as never);
      ev(ctx, { k: 'se', name: 'arrow' });
      const dmg = damageRoll(monAtk(m) * (style === 'gun' ? 0.95 : 0.8), monDefense(o), 20, next(ctx.r));
      hurtMonster(ctx, o, dmg, m);
      return;
    }
  }
  const target = seen[0];
  if (target && cheb(target, m) <= 5 && cheb(m, p) <= 5) {
    if (stepToward(ctx, m, target)) return;
  }
  if (cheb(m, p) > 1) stepToward(ctx, m, p);
}

/** 敵の将：槍は2マス先、弓・鉄砲は離れて撃つ */
function generalReach(ctx: Ctx, m: Monster): boolean {
  const run = ctx.run;
  const g = m.gen ? run.gens[m.gen] : null;
  if (!g || g.style === 'melee' || m.st.sealed) return false;
  const targets: (Monster | 'player')[] = ['player', ...run.monsters.filter((o) => o.ally && !o.dead)];
  for (const t of targets) {
    const pos = t === 'player' ? run.player : t;
    const line = lineDir(m, pos);
    if (!line || line.dist < 2) continue;
    const maxD = g.style === 'reach' ? 2 : g.style === 'bow' ? 7 : 9;
    if (line.dist > maxD) continue;
    if (g.style !== 'reach' && !chance(ctx.r, 0.55)) continue;
    const tr = trace(ctx, m, line.dir, line.dist, { hitPlayer: true, ignore: m });
    const hitIt = t === 'player' ? tr.hitPlayer : tr.hits[0] === t;
    if (!hitIt) continue;
    m.dir = line.dir;
    if (g.style === 'reach') {
      if (t === 'player') monsterHitsPlayer(ctx, m); else monsterHitsMonster(ctx, m, t);
      return true;
    }
    ev(ctx, g.style === 'gun' ? { k: 'beam', fx: m.x, fy: m.y, tx: pos.x, ty: pos.y, color: '#ffd080' } : { k: 'proj', fx: m.x, fy: m.y, tx: pos.x, ty: pos.y, sprite: 'arrow' });
    ev(ctx, { k: 'se', name: 'arrow' });
    const k = g.style === 'gun' ? 0.9 : 0.75;
    if (t === 'player') {
      log(ctx, `${monName(m)}が${g.style === 'gun' ? '鉄砲を撃って' : '矢を射て'}きた！`, 'bad');
      monsterHitsPlayerScaled(ctx, m, k);
    } else {
      hurtMonster(ctx, t, damageRoll(monAtk(m) * k, monDefense(t), 20, next(ctx.r)), m);
    }
    return true;
  }
  return false;
}

function monsterHitsPlayerScaled(ctx: Ctx, m: Monster, k: number) {
  const atk = m.atkV;
  m.atkV = (atk ?? 1) * k;
  monsterHitsPlayer(ctx, m);
  m.atkV = atk;
}

/** 敵全員の手番。倍速は2回、鈍足は2ターンに1回 */
export function monstersPhase(ctx: Ctx, phase: 1 | 2) {
  const run = ctx.run;
  if (run.timeStop && run.timeStop > 0) return;
  const list = run.monsters.filter((m) => !m.dead);
  // プレイヤーに近い順に動く（通路で詰まりにくい）
  list.sort((a, b) => cheb(a, run.player) - cheb(b, run.player));
  for (const m of list) {
    if (m.dead || run.end) continue;
    const def = monDef(m.id);
    let spd = def.spd;
    if (m.st.fast) spd += 1;
    if (m.st.slow) spd -= 1;
    spd = Math.max(-1, Math.min(1, spd));
    if (phase === 1) {
      if (spd === -1 && run.turn % 2 === 1) continue;
      monsterAct(ctx, m);
    } else if (spd === 1) {
      monsterAct(ctx, m);
    }
  }
  run.monsters = run.monsters.filter((m) => !m.dead);
}

/** 敵の状態の時間を進める（手番の終わり） */
export function tickMonsterStatus(ctx: Ctx) {
  for (const m of ctx.run.monsters) {
    const st = m.st;
    if (st.slow && st.slow < 999) st.slow -= 1;
    if (st.fast && st.fast < 999) st.fast -= 1;
    if (st.decoy) { st.decoy -= 1; if (!st.decoy) log(ctx, `${monDef(m.id).name}は身代わりから元に戻った。`); }
    if (st.guard) st.guard -= 1;
    if (st.power) { st.power -= 1; if (!st.power) delete st.powerK; }
    if (st.invincible) st.invincible -= 1;
  }
}

