// 自動プレイ：上手なボット（難易度の集計用）と、でたらめなボット（不具合探し用）、毎手の不変条件の検査
import { itemDef } from '../src/content/items';
import { monDef } from '../src/content/monsters';
import { at, canStand, cheb, cornerOk, dirTo, distanceField, isWall, visibleFrom } from '../src/engine/geo';
import { equipped, typeKnown } from '../src/engine/core';
import { hostile } from '../src/engine/actors';
import { deserializeRun } from '../src/engine/save';
const serializeRun = (run: Run) => JSON.stringify(run);
import { step } from '../src/engine/step';
import { canUseSkill, LORD, skillsOf } from '../src/engine/skills';
import { skillDef } from '../src/content/skills';
import { MAX_INV } from '../src/engine/actors';
import { DX, DY, T_FLOOR, type Action, type Dir, type Item, type Run } from '../src/engine/types';

export interface Rand { (): number }

export function mulberry(seed: number): Rand {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 不変条件 ──

export function checkInvariants(run: Run): string[] {
  const errors: string[] = [];
  const p = run.player;
  const f = run.floor;
  const bad = (msg: string) => errors.push(`[${run.mode} ${run.floorNo}F t${run.turn}] ${msg}`);
  const nums: [string, number][] = [['hp', p.hp], ['maxHp', p.maxHp], ['lv', p.lv], ['exp', p.exp], ['str', p.str], ['hunger', p.hunger], ['gold', p.gold], ['rng', run.rng], ['turn', run.turn]];
  for (const [k, v] of nums) if (typeof v !== 'number' || !Number.isFinite(v)) bad(`${k} が数でない: ${v}`);
  if (p.hp > p.maxHp) bad(`HP ${p.hp} > 最大 ${p.maxHp}`);
  if (!run.end && p.hp <= 0) bad('HP 0 なのに冒険が続いている');
  if (run.mode === 'siege' && run.end?.kind === 'clear' && !run.captured.includes(run.bossGen ?? '')) bad('城主を討たずに勝った');
  for (const [who, t] of Object.entries(run.scd)) for (const [sid, n] of Object.entries(t)) if (!(n > 0) || !skillDef(sid)) bad(`技の待ちが不正 ${who} ${sid} ${n}`);
  if (p.hunger < 0 || p.hunger > p.maxHunger) bad(`満腹度 ${p.hunger}/${p.maxHunger}`);
  if (p.gold < 0) bad(`お金が負 ${p.gold}`);
  if (p.inv.length > MAX_INV) bad(`持ち物 ${p.inv.length} > ${MAX_INV}`);
  if (!canStand(f, p.x, p.y, 'walk') || f.tiles[at(f, p.x, p.y)] !== T_FLOOR) bad(`プレイヤーが床の外 (${p.x},${p.y}) tile=${f.tiles[at(f, p.x, p.y)]}`);
  for (const slot of ['weapon', 'armor', 'charm', 'arrow'] as const) {
    const uid = p.eq[slot];
    if (uid !== undefined && !p.inv.some((i) => i.uid === uid)) bad(`装備 ${slot} の品が持ち物に無い`);
    const item = equipped(run, slot);
    if (item) {
      const cat = itemDef(item.id).cat;
      if (cat !== slot) bad(`装備 ${slot} に ${cat}`);
    }
  }
  const occupied = new Set<number>();
  for (const m of run.monsters) {
    if (m.dead) { bad(`倒れた敵が残っている ${m.id}`); continue; }
    if (!Number.isFinite(m.hp) || m.hp <= 0 || m.hp > m.maxHp) bad(`敵のHP ${m.id} ${m.hp}/${m.maxHp}`);
    const kind = monDef(m.id).move;
    if (!canStand(f, m.x, m.y, kind)) bad(`敵 ${m.id} が立てないマス (${m.x},${m.y})`);
    const k = at(f, m.x, m.y);
    if (occupied.has(k)) bad(`敵が重なっている (${m.x},${m.y})`);
    occupied.add(k);
    if (m.x === p.x && m.y === p.y) bad(`敵 ${m.id} がプレイヤーと重なっている`);
    if (m.gen && !run.gens[m.gen]) bad(`知らない武将 ${m.gen}`);
    if (m.gen && m.ally && run.fallen.includes(m.gen)) bad(`退いた武将 ${m.gen} が残っている`);
  }
  const uids = new Set<number>();
  const seeItem = (item: Item, where: string) => {
    if (uids.has(item.uid)) bad(`道具の番号が重複 ${item.uid} ${item.id} (${where})`);
    uids.add(item.uid);
    if (!itemDef(item.id)) bad(`知らない道具 ${item.id}`);
    for (const inner of item.contents ?? []) seeItem(inner, `${where}/壺`);
    if (item.contents && item.contents.length > (item.cap ?? 0) + 5) bad(`壺の中身が多すぎる ${item.contents.length}/${item.cap}`);
    if (item.count !== undefined && (!Number.isFinite(item.count) || item.count < 0)) bad(`数が不正 ${item.id} ${item.count}`);
  };
  p.inv.forEach((i) => seeItem(i, '持ち物'));
  const spots = new Set<number>();
  for (const fi of f.items) {
    seeItem(fi.item, '床');
    const k = at(f, fi.x, fi.y);
    if (spots.has(k)) bad(`1マスに道具が2つ (${fi.x},${fi.y})`);
    spots.add(k);
    if (f.tiles[k] !== T_FLOOR) bad(`道具が床以外にある (${fi.x},${fi.y}) tile=${f.tiles[k]}`);
  }
  for (const m of run.monsters) for (const s of m.stolen ?? []) seeItem(s, '盗品');
  if (f.stairs && f.tiles[at(f, f.stairs.x, f.stairs.y)] !== T_FLOOR) bad('階段が床以外');
  for (const t of f.traps) if (f.tiles[at(f, t.x, t.y)] !== T_FLOOR) bad(`罠が床以外 (${t.x},${t.y})`);
  return errors;
}

// ── 上手なボット ──

const HEAL = ['g_yakusou', 'g_daiyakusou', 'g_fukkatsu'];

function adjacentHostile(run: Run) {
  const p = run.player;
  for (const m of run.monsters) {
    if (!hostile(m) || m.role === 'keeper') continue;
    if (cheb(m, p) !== 1) continue;
    const d = dirTo(p, m)!;
    if (!cornerOk(run.floor, p.x, p.y, d)) continue;
    if (isWall(run.floor, m.x, m.y)) continue;
    return { m, d };
  }
  return null;
}

/** 見えていない（未探索の）床に隣接する、行ける場所へ */
function exploreTarget(run: Run, dist: Int16Array): number | null {
  const f = run.floor;
  let best: number | null = null;
  let bestD = 1e9;
  for (let i = 0; i < f.tiles.length; i++) {
    if (dist[i] <= 0 || !f.seen[i]) continue;
    const x = i % f.w, y = Math.floor(i / f.w);
    let frontier = false;
    for (let d = 0; d < 8 && !frontier; d++) {
      const j = at(f, x + DX[d], y + DY[d]);
      if (!f.seen[j] && f.tiles[j] !== 0 && f.tiles[j] !== 4) frontier = true;
    }
    if (frontier && dist[i] < bestD) { bestD = dist[i]; best = i; }
  }
  return best;
}

/** 目的のマスへの1歩（距離の地図を目的地から引く） */
function stepTo(run: Run, target: number, allowUid = -1): Dir | null {
  const f = run.floor;
  const p = run.player;
  const tx = target % f.w, ty = Math.floor(target / f.w);
  const back = distanceField(f, { x: tx, y: ty }, 'walk');
  let best: Dir | null = null;
  let bestV = back[at(f, p.x, p.y)];
  for (let d = 0; d < 8; d++) {
    const x = p.x + DX[d], y = p.y + DY[d];
    const v = back[at(f, x, y)];
    if (v < 0 || v >= bestV || !cornerOk(f, p.x, p.y, d as Dir)) continue;
    if (run.monsters.some((m) => m.x === x && m.y === y && (m.role === 'keeper' || !hostile(m)) && !m.ally && m.uid !== allowUid)) continue;
    bestV = v;
    best = d as Dir;
  }
  return best;
}

export function smartAction(run: Run, rand: Rand): Action {
  const p = run.player;
  const f = run.floor;
  if (run.prompt) {
    const pr = run.prompt;
    if (pr.kind === 'npc') {
      if (pr.who === 'inn' && p.hp < p.maxHp * 0.9 && p.gold >= pr.cost) return { t: 'npc', who: 'inn' };
      return { t: 'answer', yes: false };
    }
    return { t: 'answer', yes: pr.kind === 'pay' ? p.gold >= pr.amount : true };
  }
  // 宿場：傷んでいてお金があれば宿に泊まる
  if (f.kind === 'town' && p.hp < p.maxHp * 0.9) {
    const inn = run.monsters.find((m) => m.npc === 'inn');
    if (inn && p.gold >= 80 + run.floorNo * 15) {
      if (cheb(inn, p) === 1) return { t: 'move', dir: dirTo(p, inn)! };
      const d = stepTo(run, at(f, inn.x, inn.y), inn.uid);
      if (d !== null) return { t: 'move', dir: d };
    }
  }
  // 武将の技
  const skill = chooseSkill(run);
  if (skill) return skill;
  // 払えない店の品は置いていく
  const unpaid = p.inv.find((i) => i.shop);
  if (unpaid && !f.items.some((fi) => fi.x === p.x && fi.y === p.y)) return { t: 'item', uid: unpaid.uid, verb: 'drop' };
  const inv = p.inv.filter((i) => !i.shop);
  const find = (ids: string[]) => inv.find((i) => ids.includes(i.id) && typeKnown(run, i.id));
  // 回復
  if (p.hp < p.maxHp * 0.35) {
    const herb = find(HEAL.slice(0, 2));
    if (herb) return { t: 'item', uid: herb.uid, verb: 'use' };
  }
  if (p.hunger < 12) {
    const food = inv.find((i) => itemDef(i.id).cat === 'food');
    if (food) return { t: 'item', uid: food.uid, verb: 'use' };
  }
  // より強い装備
  for (const slot of ['weapon', 'armor'] as const) {
    const cur = equipped(run, slot);
    if (cur?.cursed) continue;
    const curPow = cur ? (itemDef(cur.id).power ?? 0) + (cur.plus ?? 0) : -1;
    const better = inv.find((i) => itemDef(i.id).cat === slot && (itemDef(i.id).power ?? 0) + (i.known ? (i.plus ?? 0) : 0) > curPow + 1);
    if (better) return { t: 'item', uid: better.uid, verb: 'equip' };
  }
  if (!equipped(run, 'arrow')) {
    const arrows = inv.find((i) => itemDef(i.id).cat === 'arrow');
    if (arrows) return { t: 'item', uid: arrows.uid, verb: 'equip' };
  }
  const adj = adjacentHostile(run);
  if (adj) {
    if (p.dir !== adj.d) return { t: 'face', dir: adj.d };
    // 危ない時は未識別の巻物や杖に賭ける
    if (p.hp < p.maxHp * 0.25 && rand() < 0.5) {
      const gamble = inv.find((i) => ['scroll', 'staff'].includes(itemDef(i.id).cat));
      if (gamble) return { t: 'item', uid: gamble.uid, verb: 'use' };
    }
    return { t: 'attack' };
  }
  const vis = visibleFrom(f, p.x, p.y);
  // 近づいてくる敵に、正体の分かった攻撃用の杖
  const attackStaff = inv.find((i) => ['t_ikazuchi', 't_suima', 't_kanashibari', 't_fukitobashi', 't_ichiji', 't_donsoku'].includes(i.id) && typeKnown(run, i.id) && (i.charges ?? 0) > 0);
  if (attackStaff && p.hp < p.maxHp * 0.7) {
    for (const m of run.monsters) {
      if (!hostile(m) || m.role === 'keeper' || !vis.has(at(f, m.x, m.y)) || cheb(p, m) > 4) continue;
      const dx = m.x - p.x, dy = m.y - p.y;
      if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) continue;
      const d = dirTo(p, m)!;
      return p.dir === d ? { t: 'item', uid: attackStaff.uid, verb: 'use' } : { t: 'face', dir: d };
    }
  }
  // 遠くの敵に矢
  const arrows = equipped(run, 'arrow');
  if (arrows) {
    for (const m of run.monsters) {
      if (!hostile(m) || m.role === 'keeper' || !vis.has(at(f, m.x, m.y))) continue;
      const dx = m.x - p.x, dy = m.y - p.y;
      if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) continue;
      const d = dirTo(p, m)!;
      if (cheb(p, m) <= 5 && rand() < 0.6) return p.dir === d ? { t: 'shoot' } : { t: 'face', dir: d };
    }
  }
  // 分からない道具はときどき試す（安全な時）
  if (rand() < 0.04) {
    const unknown = inv.find((i) => !typeKnown(run, i.id) && ['grass', 'scroll'].includes(itemDef(i.id).cat));
    if (unknown) return { t: 'item', uid: unknown.uid, verb: 'use' };
  }
  // 階段
  const s = f.stairs;
  const onStairs = !!s && s.x === p.x && s.y === p.y;
  if (onStairs && (f.turns > 250 || p.hp > p.maxHp * 0.5)) return { t: 'stairs' };
  const dist = distanceField(f, p, 'walk');
  // 拾う
  if (p.inv.length < MAX_INV) {
    let target: number | null = null;
    let bestD = 1e9;
    for (const fi of f.items) {
      if (fi.item.shop) continue;
      const k = at(f, fi.x, fi.y);
      if (!vis.has(k) && !f.seen[k]) continue;
      if (dist[k] > 0 && dist[k] < bestD) { bestD = dist[k]; target = k; }
    }
    if (target !== null && bestD < 15) {
      const d = stepTo(run, target);
      if (d !== null) return { t: 'move', dir: d };
    }
  }
  if (p.hp < p.maxHp * 0.6 && p.hunger > 35) {
    const visHostile = run.monsters.some((m) => hostile(m) && !m.disguise && vis.has(at(f, m.x, m.y)));
    if (!visHostile) return { t: 'rest' };
    if (rand() < 0.5) return { t: 'wait' };
  }
  // 天守・合戦：敵の将を探して討つ
  if (!s) {
    const foe = run.monsters.filter((m) => hostile(m) && m.role !== 'keeper').sort((a, b) => (b.gen ? 1 : 0) - (a.gen ? 1 : 0) || cheb(a, p) - cheb(b, p))[0];
    if (foe) {
      const d = stepTo(run, at(f, foe.x, foe.y), foe.uid);
      if (d !== null) return { t: 'move', dir: d };
    }
  }
  // 探索か、階段へ
  const explore = f.turns < 400 ? exploreTarget(run, dist) : null;
  const goal = explore ?? (s && f.seen[at(f, s.x, s.y)] ? at(f, s.x, s.y) : exploreTarget(run, dist));
  if (goal !== null) {
    const d = stepTo(run, goal);
    if (d !== null) return { t: 'move', dir: d };
  }
  return { t: 'move', dir: Math.floor(rand() * 8) as Dir };
}

/** 技を使うか決める（上手なボット用） */
function chooseSkill(run: Run): Action | null {
  const p = run.player;
  const f = run.floor;
  const vis = visibleFrom(f, p.x, p.y);
  const foes = run.monsters.filter((m) => hostile(m) && m.role !== 'keeper' && !m.disguise && vis.has(at(f, m.x, m.y)));
  const general = foes.some((m) => !!m.gen);
  const adjacent = foes.filter((m) => cheb(m, p) === 1).length;
  const allyLow = run.monsters.some((m) => m.ally && !m.dead && m.hp < m.maxHp * 0.4);
  for (const who of [LORD, ...run.party]) {
    for (const sid of skillsOf(run, who)) {
      if (!canUseSkill(run, who, sid).ok) continue;
      const def = skillDef(sid);
      let want = false;
      if (def.kind === 'party') {
        if (def.effect === 'heal') want = p.hp < p.maxHp * 0.5 || allyLow;
        else if (def.effect === 'invincible') want = p.hp < p.maxHp * 0.4 && foes.length > 0;
        else want = general || foes.length >= 3;
      } else if (def.kind === 'turn') want = foes.length >= 2;
      else want = general || foes.length >= 2 || (adjacent > 0 && p.hp < p.maxHp * 0.6);
      if (want) return { t: 'skill', who, skill: sid };
    }
  }
  return null;
}

// ── でたらめなボット ──

export function randomAction(run: Run, rand: Rand): Action {
  const p = run.player;
  if (run.prompt) {
    if (run.prompt.kind === 'npc' && rand() < 0.7) {
      const who = run.prompt.who;
      const target = p.inv[Math.floor(rand() * Math.max(1, p.inv.length))];
      return { t: 'npc', who, target: target?.uid, gold: rand() < 0.2 };
    }
    return { t: 'answer', yes: rand() < 0.5, steal: rand() < 0.25 };
  }
  if (rand() < 0.01) return { t: 'sort' };
  if (rand() < 0.04) {
    const whos = [LORD, ...run.party];
    const who = whos[Math.floor(rand() * whos.length)];
    const list = skillsOf(run, who);
    if (list.length) return { t: 'skill', who, skill: list[Math.floor(rand() * list.length)] };
  }
  const dir = Math.floor(rand() * 8) as Dir;
  const roll = rand();
  const pickItem = () => p.inv[Math.floor(rand() * p.inv.length)];
  if (roll < 0.35) return { t: 'move', dir };
  if (roll < 0.42) return { t: 'dash', dir };
  if (roll < 0.47) return { t: 'face', dir };
  if (roll < 0.57) return { t: 'attack' };
  if (roll < 0.6) return { t: 'wait' };
  if (roll < 0.62) return { t: 'rest' };
  if (roll < 0.65) return { t: 'pickup' };
  if (roll < 0.68) return { t: 'stairs' };
  if (roll < 0.7) return { t: 'shoot' };
  if (!p.inv.length) return { t: 'wait' };
  const item = pickItem();
  const verbs = ['use', 'use', 'use', 'equip', 'unequip', 'throw', 'drop', 'put', 'take', 'name'] as const;
  const verb = verbs[Math.floor(rand() * verbs.length)];
  if (verb === 'put') {
    const pot = p.inv.find((i) => itemDef(i.id).cat === 'pot' && i !== item);
    return { t: 'item', uid: item.uid, verb, target: pot?.uid };
  }
  if (verb === 'take') {
    const pot = p.inv.find((i) => (i.contents?.length ?? 0) > 0);
    return pot ? { t: 'item', uid: pot.uid, verb, target: pot.contents![0].uid } : { t: 'wait' };
  }
  if (verb === 'name') return { t: 'item', uid: item.uid, verb, name: rand() < 0.5 ? 'なぞ' : '' };
  if (rand() < 0.2) return { t: 'swapFoot', uid: item.uid };
  const target = pickItem();
  const scrolls = Object.keys(run.known).filter((id) => itemDef(id).cat === 'scroll');
  return { t: 'item', uid: item.uid, verb, target: target?.uid, scroll: scrolls[Math.floor(rand() * scrolls.length)] };
}

export interface BotResult { run: Run; steps: number; errors: string[] }

/** 冒険の終わりまで（または上限まで）遊ばせる */
export function playOut(run: Run, policy: (run: Run, rand: Rand) => Action, rand: Rand, maxSteps: number, roundTripEvery = 0): BotResult {
  const errors: string[] = [];
  let steps = 0;
  let current = run;
  for (; steps < maxSteps && !current.end; steps++) {
    const action = policy(current, rand);
    try {
      step(current, action);
    } catch (error) {
      errors.push(`例外 ${(error as Error).stack?.split('\n').slice(0, 4).join(' | ')} action=${JSON.stringify(action)}`);
      break;
    }
    const found = checkInvariants(current);
    if (found.length) { errors.push(...found.map((e) => `${e} action=${JSON.stringify(action)}`)); break; }
    if (roundTripEvery && steps % roundTripEvery === 0) {
      const text = serializeRun(current);
      const back = deserializeRun(text);
      if (!back) { errors.push('保存した冒険を読み込めない'); break; }
      if (serializeRun(back) !== text) { errors.push('保存→読み込みで内容が変わる'); break; }
      current = back;
    }
  }
  return { run: current, steps, errors };
}
