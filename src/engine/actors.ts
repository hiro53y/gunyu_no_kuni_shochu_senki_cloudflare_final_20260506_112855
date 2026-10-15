// 打撃・回復・倒れる・経験値・敵の出現・ワープ・道具を落とす
import { MON_BY_ID, monDef, nextTier, pickMonster } from '../content/monsters';
import { chance, int, range } from './rng';
import { at, canStand, cheb, inside, moveKind, roomAt, vacant, visibleFrom } from './geo';
import { charmIs, ev, expFor, hasSeal, itemName, log, monName, newUid, type Ctx } from './core';
import { makeItem, randomItemDef } from './mapgen';
import { runDanger } from './run';
import { shareGenExp } from './generals';
import { T_FLOOR, T_LAVA, T_WATER, type Item, type Monster, type Pos } from './types';

export const MAX_INV = 20;
export const MAX_ALLIES = 2;

// ── プレイヤー ──

export function healPlayer(ctx: Ctx, n: number, overflowMax = 0) {
  const p = ctx.run.player;
  const before = p.hp;
  if (p.hp >= p.maxHp && overflowMax > 0) {
    p.maxHp += overflowMax;
    log(ctx, `最大HPが${overflowMax}増えた。`, 'good');
  }
  p.hp = Math.min(p.maxHp, p.hp + n);
  const healed = p.hp - before;
  if (healed > 0) ev(ctx, { k: 'heal', x: p.x, y: p.y, n: healed });
}

/** プレイヤーが傷つく。倒れたら復活の草を探し、無ければ冒険の終わり */
export function hurtPlayer(ctx: Ctx, n: number, cause: string): number {
  const run = ctx.run;
  const p = run.player;
  if (run.end) return 0;
  if (p.st.invincible) {
    ev(ctx, { k: 'popup', x: p.x, y: p.y, text: '無敵', color: '#ffe680' });
    return 0;
  }
  const dmg = Math.max(0, Math.round(n * (p.st.guard ? 0.5 : 1)));
  if (dmg <= 0) return 0;
  p.hp -= dmg;
  ev(ctx, { k: 'hit', uid: 0, x: p.x, y: p.y, n: dmg });
  // 眠り・金縛りは叩かれると覚める
  if (p.st.sleep) p.st.sleep = 0;
  // 痛み分け
  for (const m of run.monsters) {
    if (!m.dead && m.st.bond && !m.ally) {
      log(ctx, `${monName(m)}も痛みを分け合った！`);
      hurtMonster(ctx, m, dmg, 'other');
    }
  }
  if (p.hp <= 0) {
    const herb = p.inv.findIndex((i) => i.id === 'g_fukkatsu' && !i.shop);
    if (herb >= 0) {
      p.inv.splice(herb, 1);
      run.known.g_fukkatsu = true;
      p.hp = p.maxHp;
      p.st = {};
      log(ctx, '復活の草の力で生き返った！', 'good');
      ev(ctx, { k: 'flash', color: '#c8ffb0' });
      ev(ctx, { k: 'se', name: 'revive' });
    } else {
      p.hp = 0;
      run.end = { kind: 'dead', cause, floor: run.floorNo };
      log(ctx, `朔は${cause}で倒れた……`, 'bad');
      ev(ctx, { k: 'die', uid: 0, x: p.x, y: p.y });
      ev(ctx, { k: 'se', name: 'death' });
    }
  }
  return dmg;
}

export function gainExp(ctx: Ctx, n: number) {
  const p = ctx.run.player;
  p.exp += Math.max(0, Math.round(n));
  while (p.lv < 99 && p.exp >= expFor(p.lv + 1)) levelUp(ctx, false);
}

export function levelUp(ctx: Ctx, byHerb: boolean) {
  const p = ctx.run.player;
  if (p.lv >= 99) return;
  p.lv += 1;
  if (byHerb) p.exp = Math.max(p.exp, expFor(p.lv));
  const gain = range(ctx.r, 4, 7);
  p.maxHp += gain;
  p.hp = Math.min(p.maxHp, p.hp + gain);
  log(ctx, `レベル${p.lv}に上がった！`, 'good');
  ev(ctx, { k: 'lvup' });
  ev(ctx, { k: 'se', name: 'lvup' });
}

export function levelDown(ctx: Ctx) {
  const p = ctx.run.player;
  if (p.lv <= 1) {
    log(ctx, 'しかしレベルはこれ以上下がらない。');
    return;
  }
  p.lv -= 1;
  p.exp = expFor(p.lv);
  p.maxHp = Math.max(15, p.maxHp - 5);
  p.hp = Math.min(p.hp, p.maxHp);
  log(ctx, `レベルが${p.lv}に下がった……`, 'bad');
}

export function weakenStr(ctx: Ctx, n: number) {
  const p = ctx.run.player;
  if (hasSeal(ctx.run, '毒') || charmIs(ctx.run, 'c_doku')) {
    log(ctx, 'しかし毒は効かなかった。');
    return;
  }
  p.str = Math.max(0, p.str - n);
  log(ctx, `力が${n}下がった。`, 'bad');
}

// ── 敵 ──

export function hostile(m: Monster): boolean {
  if (m.dead || m.ally || m.role === 'npc') return false;
  if (m.role === 'keeper') return !!m.angry;
  return true;
}

/** 敵を作る（深層では階に応じて強くなる） */
export function createMonster(ctx: Ctx, id: string, x: number, y: number, awake: boolean, role?: Monster['role']): Monster {
  const def = monDef(id);
  const run = ctx.run;
  const m: Monster = {
    uid: newUid(run), id, x, y, dir: 4, hp: def.hp, maxHp: def.hp, awake, st: {},
  };
  if (role) m.role = role;
  run.monsters.push(m);
  run.stats.seenIds[id] = true;
  return m;
}

export function hurtMonster(ctx: Ctx, m: Monster, n: number, by: 'player' | Monster | 'other', opts: { crit?: boolean; noExp?: boolean } = {}) {
  if (m.dead || m.role === 'npc') return;
  if (m.disguise) revealDisguise(ctx, m);
  if (m.st.invincible) {
    ev(ctx, { k: 'popup', x: m.x, y: m.y, text: '無敵', color: '#ffe680' });
    return;
  }
  const dmg = Math.max(1, Math.round(n * (m.st.guard ? 0.5 : 1)));
  m.hp -= dmg;
  if (by === 'player') ctx.run.stats.maxHit = Math.max(ctx.run.stats.maxHit ?? 0, dmg);
  m.awake = true;
  if (m.st.paralyze) m.st.paralyze = 0;
  if (m.st.sleep) m.st.sleep = 0;
  if (m.role === 'keeper' && by === 'player' && !m.angry) angerKeeper(ctx, m);
  ev(ctx, { k: 'hit', uid: m.uid, x: m.x, y: m.y, n: dmg, crit: opts.crit });
  const def = monDef(m.id);
  if (m.hp > 0 && def.ability.k === 'explode' && !m.st.sealed && m.hp <= m.maxHp * 0.3) {
    explode(ctx, m, def.ability.dmg);
    return;
  }
  if (m.hp <= 0) killMonster(ctx, m, by, opts.noExp);
}

/** 化け狸が正体を現す */
export function revealDisguise(ctx: Ctx, m: Monster) {
  if (!m.disguise) return;
  delete m.disguise;
  m.awake = true;
  m.st.sleep = 0;
  ctx.run.stats.seenIds[m.id] = true;
  log(ctx, `なんと、${monName(m)}が化けていた！`, 'warn');
  ev(ctx, { k: 'popup', x: m.x, y: m.y, text: 'ドロン！', color: '#ffd84a' });
}

export function angerKeeper(ctx: Ctx, keeper: Monster) {
  if (keeper.angry) return;
  keeper.angry = true;
  keeper.awake = true;
  log(ctx, '商人「この泥棒め！」', 'bad');
  makeThief(ctx);
}

/** 泥棒になる：持っている店の品は自分の物になり、番人が現れる */
export function makeThief(ctx: Ctx) {
  const run = ctx.run;
  const markOwned = (items: Item[]) => {
    for (const item of items) {
      item.shop = false;
      if (item.contents) markOwned(item.contents);
    }
  };
  markOwned(run.player.inv);
  if (!run.thief) {
    run.thief = true;
    run.stats.stolen += 1;
  }
  log(ctx, '泥棒だ！ 商人が追ってくる。次の階へ進めば逃げ切れる。', 'warn');
  for (const m of run.monsters) if (m.role === 'keeper') { m.angry = true; m.awake = true; m.st = {}; }
}

function explode(ctx: Ctx, m: Monster, dmg: number) {
  const run = ctx.run;
  m.dead = true;
  log(ctx, `${monName(m)}は爆発した！`, 'bad');
  ev(ctx, { k: 'boom', x: m.x, y: m.y, r: 1 });
  ev(ctx, { k: 'se', name: 'boom' });
  // 周りの道具は吹き飛ぶ
  run.floor.items = run.floor.items.filter((fi) => cheb(fi, m) > 1 || fi.item.shop);
  for (const other of run.monsters) {
    if (other !== m && !other.dead && cheb(other, m) <= 1) hurtMonster(ctx, other, dmg, 'other', { noExp: true });
  }
  const p = run.player;
  // 爆発は大きいが、HP が多ければ一撃では倒れない
  if (cheb(p, m) <= 1) hurtPlayer(ctx, Math.min(dmg * (hasSeal(run, '火') ? 0.5 : 1), Math.floor(p.hp * 0.6) + 2), '爆発');
  dropLoot(ctx, m, false);
}

export function killMonster(ctx: Ctx, m: Monster, by: 'player' | Monster | 'other', noExp = false) {
  const run = ctx.run;
  if (m.dead) return;
  m.dead = true;
  m.hp = 0;
  const def = monDef(m.id);
  const name = monName(m);
  ev(ctx, { k: 'die', uid: m.uid, x: m.x, y: m.y });
  if (m.ally) {
    if (m.gen) {
      // 武将は死なずに深手を負って退く
      if (!run.fallen.includes(m.gen)) run.fallen.push(m.gen);
      log(ctx, `${name}は深手を負って戦場から退いた……`, 'bad');
      ev(ctx, { k: 'se', name: 'death' });
    } else log(ctx, `寝返った${name}が倒れた。`, 'bad');
    return;
  }
  if (m.gen) {
    defeatGeneral(ctx, m);
  } else log(ctx, `${name}を倒した。`);
  if (by === 'player' || (by !== 'other' && by.ally)) {
    run.stats.kills += 1;
    run.stats.killedIds[m.id] = (run.stats.killedIds[m.id] ?? 0) + 1;
  }
  const exp = Math.max(1, Math.round((m.expV ?? def.exp * (m.scale ?? 1)) * (run.expRate ?? 1)));
  if (!noExp && by !== 'other') {
    // 部隊の手柄：倒した者は満額、ほかは半分
    const killer = by === 'player' ? null : by;
    if (by === 'player' || by.ally) {
      gainExp(ctx, by === 'player' ? exp : Math.round(exp * 0.5));
      shareGenExp(ctx, exp, killer);
    }
  }
  if (by !== 'player' && by !== 'other' && !by.dead && !by.gen) {
    if (by.ally) {
      by.bonus = (by.bonus ?? 0) + 1;
      if ((by.bonus ?? 0) % 4 === 0) monsterLevelUp(ctx, by);
    } else if (!by.role) {
      monsterLevelUp(ctx, by);
    }
  }
  if (m.role === 'boss' && !m.gen) {
    run.bossDown = true;
    run.floor.stairs = { x: m.x, y: m.y };
    ev(ctx, { k: 'flash', color: '#fff2b0' });
  }
  dropLoot(ctx, m);
}

/** 敵の将を討ち取った（捕らえる）。城主・大将なら勝ち */
function defeatGeneral(ctx: Ctx, m: Monster) {
  const run = ctx.run;
  const g = run.gens[m.gen!];
  if (!run.captured.includes(m.gen!)) run.captured.push(m.gen!);
  log(ctx, `${g?.name ?? monName(m)}を討ち取った！`, 'good');
  if (g?.defeat) ev(ctx, { k: 'say', gen: g.id, text: g.defeat });
  ev(ctx, { k: 'flash', color: '#fff2b0' });
  ev(ctx, { k: 'se', name: 'clear' });
  if (m.gen === run.midGen) run.midPending = false;
  if (m.gen === run.bossGen && (run.mode === 'siege' || run.mode === 'defense')) {
    // 残りの兵は逃げ散る
    for (const o of run.monsters) if (!o.dead && !o.ally && o !== m && o.role !== 'keeper') { o.dead = true; ev(ctx, { k: 'warp', uid: o.uid, x: o.x, y: o.y }); }
    run.bossDown = true;
    run.end = { kind: 'clear', cause: run.mode === 'siege' ? '城主を討ち取った' : '大将を討ち取った', floor: run.floorNo };
    log(ctx, run.mode === 'siege' ? '城を落とした！ 勝鬨を上げよ！' : '敵の大将を討ち取った！ 敵は総崩れだ！', 'good');
  }
}

/** 盗んだ物と、ときどき道具を落とす */
function dropLoot(ctx: Ctx, m: Monster, bonus = true) {
  const run = ctx.run;
  if (m.stolenGold) {
    dropNear(ctx, { uid: newUid(run), id: 'gold', count: m.stolenGold }, m, true);
    m.stolenGold = 0;
  }
  for (const item of m.stolen ?? []) dropNear(ctx, item, m, true);
  m.stolen = [];
  if (bonus && !m.role && chance(ctx.r, 0.07)) {
    const danger = runDanger(run);
    dropNear(ctx, makeItem(ctx.r, randomItemDef(ctx.r, danger), newUid(run), danger), m, true);
  }
}

export function monsterLevelUp(ctx: Ctx, m: Monster) {
  const up = nextTier(m.id);
  if (up) {
    const before = monName(m);
    m.id = up;
    const def = monDef(up);
    m.maxHp = Math.round(def.hp * (m.scale ?? 1));
    m.hp = m.maxHp;
    ctx.run.stats.seenIds[up] = true;
    log(ctx, `${before}はレベルが上がって${def.name}になった！`, m.ally ? 'good' : 'warn');
  } else {
    m.bonus = (m.bonus ?? 0) + 2;
    m.maxHp = Math.round(m.maxHp * 1.15);
    m.hp = m.maxHp;
    log(ctx, `${monName(m)}は強くなった！`, m.ally ? 'good' : 'warn');
  }
  ev(ctx, { k: 'popup', x: m.x, y: m.y, text: 'LvUP', color: '#ffd84a' });
}

// ── 置く・落とす ──

/** 道具を落とせるマス（床・道具なし・罠なし・階段なし） */
export function canDropAt(ctx: Ctx, x: number, y: number): boolean {
  const f = ctx.run.floor;
  if (!inside(f, x, y) || f.tiles[at(f, x, y)] !== T_FLOOR) return false;
  if (f.items.some((fi) => fi.x === x && fi.y === y)) return false;
  if (f.traps.some((t) => t.x === x && t.y === y)) return false;
  if (f.stairs && f.stairs.x === x && f.stairs.y === y) return false;
  return true;
}

/** 近くの空いた床に道具を置く。水・溶岩に落ちると消える */
export function dropNear(ctx: Ctx, item: Item, pos: Pos, quiet = false): boolean {
  const f = ctx.run.floor;
  const tile = inside(f, pos.x, pos.y) ? f.tiles[at(f, pos.x, pos.y)] : T_FLOOR;
  if (tile === T_WATER || tile === T_LAVA) {
    if (!quiet) log(ctx, `${itemName(ctx.run, item)}は${tile === T_WATER ? '水に沈んで' : '溶岩に焼かれて'}消えた。`);
    return false;
  }
  for (let radius = 0; radius <= 3; radius++) {
    const ring: Pos[] = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        ring.push({ x: pos.x + dx, y: pos.y + dy });
      }
    }
    // 同じ半径の中は毎回同じ順で探す（ゆらぎは不要）
    for (const p of ring) {
      if (canDropAt(ctx, p.x, p.y)) {
        f.items.push({ item, x: p.x, y: p.y });
        return true;
      }
    }
  }
  if (!quiet) log(ctx, `${itemName(ctx.run, item)}は消えてしまった。`);
  return false;
}

// ── 位置 ──

/** 部屋の中のランダムな空いたマス（見えていない所を優先） */
export function randomSpot(ctx: Ctx, opts: { kind?: 'walk' | 'swim' | 'fly' | 'phase'; hidden?: boolean; awayFrom?: Pos; minDist?: number; noShop?: boolean } = {}): Pos | null {
  const run = ctx.run;
  const f = run.floor;
  const vis = opts.hidden ? visibleFrom(f, run.player.x, run.player.y) : null;
  const rooms = f.rooms.filter((room) => !(opts.noShop && room.kind === 'shop'));
  for (let tries = 0; tries < 60; tries++) {
    const room = rooms[int(ctx.r, rooms.length)];
    if (!room) return null;
    const x = room.x + int(ctx.r, room.w), y = room.y + int(ctx.r, room.h);
    if (!canStand(f, x, y, opts.kind ?? 'walk') || f.tiles[at(f, x, y)] !== T_FLOOR) continue;
    if (!vacant(run, x, y)) continue;
    if (vis && vis.has(at(f, x, y))) continue;
    if (opts.awayFrom && cheb(opts.awayFrom, { x, y }) < (opts.minDist ?? 5)) continue;
    return { x, y };
  }
  return null;
}

/** 近くに敵を出す */
export function spawnNear(ctx: Ctx, id: string, pos: Pos, minR: number, maxR: number): Monster | null {
  const f = ctx.run.floor;
  const kind = MON_BY_ID[id]?.move ?? 'walk';
  for (let tries = 0; tries < 80; tries++) {
    const r = range(ctx.r, minR, maxR);
    const x = pos.x + range(ctx.r, -r, r), y = pos.y + range(ctx.r, -r, r);
    if (!inside(f, x, y) || !canStand(f, x, y, kind) || f.tiles[at(f, x, y)] !== T_FLOOR || !vacant(ctx.run, x, y)) continue;
    return createMonster(ctx, id, x, y, true);
  }
  return null;
}

export function teleportPlayer(ctx: Ctx) {
  const run = ctx.run;
  const spot = randomSpot(ctx, { awayFrom: run.player, minDist: 6, noShop: true }) ?? randomSpot(ctx, { noShop: true });
  if (!spot) return;
  run.player.x = spot.x;
  run.player.y = spot.y;
  ev(ctx, { k: 'warp', uid: 0, x: spot.x, y: spot.y });
}

export function teleportMonster(ctx: Ctx, m: Monster) {
  const spot = randomSpot(ctx, { kind: moveKind(m) === 'phase' ? 'walk' : moveKind(m), awayFrom: ctx.run.player, minDist: 6, noShop: true });
  if (!spot) return;
  m.x = spot.x;
  m.y = spot.y;
  m.goal = null;
  m.wander = null;
  ev(ctx, { k: 'warp', uid: m.uid, x: spot.x, y: spot.y });
}

/** 周期的な敵の出現 */
export function maybeSpawn(ctx: Ctx) {
  const run = ctx.run;
  if (run.floor.kind === 'boss' || run.floor.kind === 'town' || run.floor.kind === 'field' || run.mode === 'practice') return;
  run.spawnIn -= 1;
  if (run.spawnIn > 0) return;
  run.spawnIn = range(ctx.r, 35, 65);
  const count = run.monsters.filter((m) => !m.dead && !m.role && !m.ally).length;
  if (count >= 14) return;
  const id = pickMonster(ctx.r, runDanger(run), run.faction, run.banned ?? {});
  const spot = randomSpot(ctx, { kind: monDef(id).move === 'phase' ? 'walk' : monDef(id).move, hidden: true, awayFrom: run.player, minDist: 6, noShop: true });
  if (spot) createMonster(ctx, id, spot.x, spot.y, chance(ctx.r, 0.6));
}

/** 道具の正体を明らかにする */
export function identify(ctx: Ctx, item: Item, quiet = false) {
  const before = itemName(ctx.run, item);
  ctx.run.known[item.id] = true;
  item.known = true;
  if (item.contents) for (const inner of item.contents) { ctx.run.known[inner.id] = true; inner.known = true; }
  if (!quiet) log(ctx, `${before}は${itemName(ctx.run, item)}だった。`, 'item');
}

export function makeKnownType(ctx: Ctx, id: string) {
  if (!ctx.run.known[id]) ctx.run.known[id] = true;
}

/** 部屋に入った時：モンスターハウスが起きる */
export function onEnterRoom(ctx: Ctx) {
  const run = ctx.run;
  const room = roomAt(run.floor, run.player.x, run.player.y);
  if (!room) return;
  if (room.id === run.floor.house && !run.floor.houseAwake) {
    run.floor.houseAwake = true;
    for (const m of run.monsters) {
      if (!m.dead && roomAt(run.floor, m.x, m.y)?.id === room.id) { m.awake = true; m.st.sleep = 0; }
    }
    log(ctx, 'モンスターハウスだ！', 'warn');
    ev(ctx, { k: 'flash', color: '#ff6a6a' });
    ev(ctx, { k: 'se', name: 'house' });
  }
}

