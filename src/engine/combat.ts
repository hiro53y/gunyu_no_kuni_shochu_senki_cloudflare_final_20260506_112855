// 近接の打ち合い・特技・飛ぶ物の軌道・吹き飛ばし
import { monDef } from '../content/monsters';
import { itemDef } from '../content/items';
import { chance, int, next, pick, range } from './rng';
import { at, canStand, cornerOk, inside, isWall, monsterAt, moveKind } from './geo';
import { charmIs, damageRoll, equipped, ev, hasSeal, itemName, log, monAtk, monDefense, monName, playerAttack, playerDefense, sealsOf, type Ctx } from './core';
import { angerKeeper, revealDisguise, hurtMonster, hurtPlayer, levelDown, teleportMonster, weakenStr } from './actors';
import { DX, DY, T_FLOOR, T_HARD, type Dir, type Monster, type Pos } from './types';

const PLAYER_HIT = 0.95;
const MONSTER_HIT = 0.88;

function slayerBonus(ctx: Ctx, m: Monster): number {
  const tag = monDef(m.id).tag;
  const seals = sealsOf(equipped(ctx.run, 'weapon'));
  let k = 1;
  if (tag === 'beast' && seals.includes('獣')) k *= 1.5;
  if (tag === 'spirit' && seals.includes('霊')) k *= 1.5;
  if ((tag === 'armor' || tag === 'undead') && seals.includes('砕')) k *= 1.5;
  return k;
}

/** プレイヤーが向いている方向を攻撃する。当たる相手がいなければ素振り（罠を探す・壁を掘る） */
export function playerMelee(ctx: Ctx) {
  const run = ctx.run;
  const p = run.player;
  const f = run.floor;
  const dir = p.dir;
  ev(ctx, { k: 'atk', uid: 0, dir });
  const seals = sealsOf(equipped(run, 'weapon'));
  const targets: { x: number; y: number; dir: Dir }[] = [{ x: p.x + DX[dir], y: p.y + DY[dir], dir }];
  if (seals.includes('貫')) targets.push({ x: p.x + DX[dir] * 2, y: p.y + DY[dir] * 2, dir });
  if (seals.includes('薙')) {
    for (const d of [((dir + 7) % 8) as Dir, ((dir + 1) % 8) as Dir]) targets.push({ x: p.x + DX[d], y: p.y + DY[d], dir: d });
  }
  let any = false;
  for (const t of targets) {
    const m = monsterAt(run, t.x, t.y);
    if (!m) continue;
    // 斜めは角を挟むと届かない。貫きの2マス目は1マス目が壁でない時だけ
    if (!cornerOk(f, p.x, p.y, t.dir)) continue;
    if (Math.max(Math.abs(t.x - p.x), Math.abs(t.y - p.y)) === 2 && isWall(f, p.x + DX[dir], p.y + DY[dir])) continue;
    any = true;
    attackMonster(ctx, m);
    if (run.end) return;
  }
  if (any) return;
  // 素振り：周りの罠が見つかる。掘りの印なら壁を掘る
  ev(ctx, { k: 'se', name: 'swing' });
  let found = 0;
  for (const trap of f.traps) {
    if (!trap.found && Math.max(Math.abs(trap.x - p.x), Math.abs(trap.y - p.y)) <= 1) { trap.found = true; found++; }
  }
  if (found) log(ctx, '罠を見つけた！', 'info');
  const fx = p.x + DX[dir], fy = p.y + DY[dir];
  if (seals.includes('掘') && inside(f, fx, fy) && f.tiles[at(f, fx, fy)] !== T_HARD && isWall(f, fx, fy)) {
    f.tiles[at(f, fx, fy)] = T_FLOOR;
    log(ctx, '壁を掘った。');
    ev(ctx, { k: 'se', name: 'dig' });
  }
}

export function attackMonster(ctx: Ctx, m: Monster) {
  const run = ctx.run;
  if (m.role === 'npc') {
    log(ctx, `${monName(m)}「乱暴はよしてくだされ」`);
    return;
  }
  if (m.disguise) revealDisguise(ctx, m);
  if (m.role === 'keeper' && !m.angry) angerKeeper(ctx, m);
  if (!chance(ctx.r, PLAYER_HIT)) {
    log(ctx, `${monName(m)}に攻撃が外れた。`);
    ev(ctx, { k: 'miss', x: m.x, y: m.y });
    ev(ctx, { k: 'se', name: 'miss' });
    m.awake = true;
    return;
  }
  let atk = playerAttack(run) * slayerBonus(ctx, m);
  const seals = sealsOf(equipped(run, 'weapon'));
  const crit = seals.includes('会') && chance(ctx.r, 0.25);
  if (crit) atk *= 1.8;
  const dmg = damageRoll(atk, monDefense(m), 20, next(ctx.r));
  log(ctx, `${monName(m)}に${dmg}の打撃${crit ? '（会心！）' : ''}`);
  ev(ctx, { k: 'se', name: crit ? 'crit' : 'hit' });
  hurtMonster(ctx, m, dmg, 'player', { crit });
  if (seals.includes('癒')) {
    const heal = Math.max(1, Math.floor(dmg / 4));
    const p = run.player;
    p.hp = Math.min(p.maxHp, p.hp + heal);
  }
}

/** 敵がプレイヤーを叩く */
export function monsterHitsPlayer(ctx: Ctx, m: Monster) {
  const run = ctx.run;
  const p = run.player;
  const def = monDef(m.id);
  ev(ctx, { k: 'atk', uid: m.uid, dir: m.dir });
  const evade = hasSeal(run, '避') ? 0.2 : 0;
  if (!chance(ctx.r, MONSTER_HIT - evade)) {
    log(ctx, `${def.name}の攻撃をかわした。`);
    ev(ctx, { k: 'miss', x: p.x, y: p.y });
    return;
  }
  const dmg = damageRoll(monAtk(m), playerDefense(run), 24, next(ctx.r));
  log(ctx, `${def.name}から${dmg}の打撃を受けた。`, 'bad');
  ev(ctx, { k: 'se', name: 'hurt' });
  const taken = hurtPlayer(ctx, dmg, def.name);
  if (run.end) return;
  if (taken > 0 && hasSeal(run, '返') && !m.dead) {
    log(ctx, `${def.name}に痛みを返した！`);
    hurtMonster(ctx, m, Math.max(1, Math.floor(taken / 2)), 'player');
  }
  if (m.dead || m.st.sealed) return;
  onHitAbility(ctx, m);
}

/** 叩いた時の特技 */
function onHitAbility(ctx: Ctx, m: Monster) {
  const run = ctx.run;
  const p = run.player;
  const a = monDef(m.id).ability;
  switch (a.k) {
    case 'steal': {
      if (a.gold) {
        if (p.gold <= 0) return;
        const amount = Math.min(p.gold, range(ctx.r, 50, 150) + run.floorNo * 20);
        p.gold -= amount;
        m.stolenGold = (m.stolenGold ?? 0) + amount;
        log(ctx, `${monName(m)}に${amount}文を盗まれた！`, 'bad');
      } else {
        const candidates = p.inv.filter((i) => !Object.values(p.eq).includes(i.uid));
        if (!candidates.length) return;
        const item = pick(ctx.r, candidates);
        p.inv.splice(p.inv.indexOf(item), 1);
        (m.stolen ??= []).push(item);
        log(ctx, `${monName(m)}に${itemName(run, item)}を盗まれた！`, 'bad');
      }
      m.fleeing = true;
      teleportMonster(ctx, m);
      return;
    }
    case 'confuse':
      if (chance(ctx.r, a.p)) confusePlayer(ctx, 3 + monDef(m.id).tier);
      return;
    case 'rust':
      if (chance(ctx.r, a.p)) rustEquipment(ctx);
      return;
    case 'poison':
      if (chance(ctx.r, a.p)) weakenStr(ctx, 1);
      return;
    case 'drain':
      if (chance(ctx.r, a.p)) levelDown(ctx);
      return;
    case 'blow':
      if (chance(ctx.r, a.p)) {
        log(ctx, `${monName(m)}に吹き飛ばされた！`, 'bad');
        knockback(ctx, 'player', m.dir, 5);
      }
      return;
    case 'hunger': {
      const before = p.hunger;
      p.hunger = Math.max(0, p.hunger - a.amount);
      if (before > p.hunger) log(ctx, `お腹が${before - p.hunger}減った……`, 'bad');
      return;
    }
    case 'freeze':
      if (chance(ctx.r, a.p)) sleepPlayer(ctx, range(ctx.r, 3, 5));
      return;
    default:
  }
}

export function confusePlayer(ctx: Ctx, turns: number) {
  if (charmIs(ctx.run, 'c_konran')) {
    log(ctx, 'お守りのおかげで混乱しなかった。');
    return;
  }
  ctx.run.player.st.confuse = Math.max(ctx.run.player.st.confuse ?? 0, turns);
  log(ctx, '頭が混乱した！', 'bad');
}

export function sleepPlayer(ctx: Ctx, turns: number) {
  if (charmIs(ctx.run, 'c_nemuri') || hasSeal(ctx.run, '眠')) {
    log(ctx, '眠気を振り払った。');
    return;
  }
  ctx.run.player.st.sleep = Math.max(ctx.run.player.st.sleep ?? 0, turns);
  log(ctx, '眠ってしまった……', 'bad');
}

export function rustEquipment(ctx: Ctx) {
  const run = ctx.run;
  const targets = [equipped(run, 'weapon'), equipped(run, 'armor')].filter((i): i is NonNullable<typeof i> => !!i);
  if (!targets.length) return;
  const item = pick(ctx.r, targets);
  if (sealsOf(item).includes('錆')) {
    log(ctx, `${itemName(run, item)}は錆びなかった。`);
    return;
  }
  item.plus = (item.plus ?? 0) - 1;
  log(ctx, `${itemName(run, item, { plain: true })}が錆びてしまった！`, 'bad');
}

/** 敵どうし・仲間の打ち合い */
export function monsterHitsMonster(ctx: Ctx, attacker: Monster, target: Monster) {
  ev(ctx, { k: 'atk', uid: attacker.uid, dir: attacker.dir });
  if (!chance(ctx.r, MONSTER_HIT)) {
    ev(ctx, { k: 'miss', x: target.x, y: target.y });
    return;
  }
  const dmg = damageRoll(monAtk(attacker), monDefense(target), 20, next(ctx.r));
  if (attacker.ally || target.ally) log(ctx, `${monName(attacker)}は${monName(target)}に${dmg}の打撃を与えた。`);
  hurtMonster(ctx, target, dmg, attacker);
}

/** 火の通り道：床のおにぎりは焼け、巻物は燃える */
export function scorch(ctx: Ctx, path: Pos[]) {
  const f = ctx.run.floor;
  for (const p of path) {
    const fi = f.items.find((x) => x.x === p.x && x.y === p.y);
    if (!fi || fi.item.shop) continue;
    const cat = itemDef(fi.item.id).cat;
    if (fi.item.id === 'f_onigiri' || fi.item.id === 'f_oonigiri' || fi.item.id === 'f_kusatta') {
      fi.item.id = 'f_yaki';
      log(ctx, 'おにぎりがこんがり焼けた。', 'item');
    } else if (cat === 'scroll') {
      f.items.splice(f.items.indexOf(fi), 1);
      log(ctx, '巻物が燃えてしまった！', 'warn');
    }
  }
}

// ── 飛ぶ物 ──

export interface Trace {
  /** 通ったマス */
  path: Pos[];
  /** 当たった敵 */
  hits: Monster[];
  /** プレイヤーに当たった */
  hitPlayer: boolean;
  /** 止まったマス（壁の手前） */
  end: Pos;
}

/** from から dir へ range マス。壁で止まる。pierce なら敵を貫く */
export function trace(ctx: Ctx, from: Pos, dir: Dir, range: number, opts: { pierce?: boolean; hitPlayer?: boolean; ignore?: Monster } = {}): Trace {
  const run = ctx.run;
  const f = run.floor;
  const path: Pos[] = [];
  const hits: Monster[] = [];
  let x = from.x, y = from.y;
  let end = { x, y };
  for (let i = 0; i < range; i++) {
    const nx = x + DX[dir], ny = y + DY[dir];
    if (!inside(f, nx, ny) || isWall(f, nx, ny)) break;
    if (dir % 2 === 1 && !cornerOk(f, x, y, dir)) break;
    x = nx; y = ny;
    path.push({ x, y });
    end = { x, y };
    if (opts.hitPlayer && run.player.x === x && run.player.y === y) return { path, hits, hitPlayer: true, end };
    const m = monsterAt(run, x, y);
    if (m && m !== opts.ignore) {
      hits.push(m);
      if (!opts.pierce) return { path, hits, hitPlayer: false, end };
    }
  }
  return { path, hits, hitPlayer: false, end };
}

/** 吹き飛ばす。壁や者にぶつかると5の打撃 */
export function knockback(ctx: Ctx, target: Monster | 'player', dir: Dir, dist: number) {
  const run = ctx.run;
  const f = run.floor;
  const self = target === 'player' ? run.player : target;
  const kind = target === 'player' ? 'walk' : moveKind(target) === 'phase' ? 'walk' : moveKind(target);
  const fx = self.x, fy = self.y;
  let bumped: Monster | 'player' | 'wall' | null = null;
  for (let i = 0; i < dist; i++) {
    const nx = self.x + DX[dir], ny = self.y + DY[dir];
    if (!inside(f, nx, ny) || !canStand(f, nx, ny, kind) || !cornerOk(f, self.x, self.y, dir)) { bumped = 'wall'; break; }
    const other = monsterAt(run, nx, ny);
    if (other) { bumped = other; break; }
    if (run.player.x === nx && run.player.y === ny && target !== 'player') { bumped = 'player'; break; }
    self.x = nx; self.y = ny;
  }
  ev(ctx, { k: 'move', uid: target === 'player' ? 0 : target.uid, fx, fy, tx: self.x, ty: self.y });
  if (bumped) {
    ev(ctx, { k: 'se', name: 'bump' });
    if (target === 'player') hurtPlayer(ctx, 5, 'ぶつかった衝撃');
    else hurtMonster(ctx, target, 5, 'other');
    if (bumped !== 'wall') {
      if (bumped === 'player') hurtPlayer(ctx, 5, 'ぶつかった衝撃');
      else hurtMonster(ctx, bumped, 5, 'other');
    }
  }
}

/** 敵の遠くからの特技（火・石・術）。使ったら true */
export function rangedAbility(ctx: Ctx, m: Monster, line: { dir: Dir; dist: number }): boolean {
  const run = ctx.run;
  const a = monDef(m.id).ability;
  if (m.st.sealed) return false;
  const p = run.player;
  if (a.k === 'gun' && (m.cd ?? 0) > 0) { m.cd = (m.cd ?? 0) - 1; return false; }
  if (a.k === 'fire' || a.k === 'stone' || a.k === 'arrow' || a.k === 'gun') {
    if (line.dist < 2 || line.dist > 10 || !chance(ctx.r, a.p)) return false;
    const tr = trace(ctx, m, line.dir, line.dist, { hitPlayer: true });
    // 間に部隊の武将がいれば、そちらに当たる
    const shield = !tr.hitPlayer && tr.hits[0]?.ally ? tr.hits[0] : null;
    if (!tr.hitPlayer && !shield) return false;
    m.dir = line.dir;
    if (shield) {
      const dmg = Math.round(a.dmg * (0.85 + next(ctx.r) * 0.3));
      ev(ctx, a.k === 'fire' || a.k === 'gun' ? { k: 'beam', fx: m.x, fy: m.y, tx: shield.x, ty: shield.y, color: a.k === 'gun' ? '#ffd080' : '#ff7a2a' } : { k: 'proj', fx: m.x, fy: m.y, tx: shield.x, ty: shield.y, sprite: a.k });
      log(ctx, `${monName(m)}の攻撃が${monName(shield)}に当たった。`);
      if (a.k === 'gun') m.cd = 1;
      hurtMonster(ctx, shield, dmg, m);
      return true;
    }
    if (a.k === 'arrow' || a.k === 'gun') {
      if (a.k === 'gun') {
        ev(ctx, { k: 'beam', fx: m.x, fy: m.y, tx: p.x, ty: p.y, color: '#ffd080' });
        ev(ctx, { k: 'se', name: 'gun' });
        m.cd = 1;
      } else {
        ev(ctx, { k: 'proj', fx: m.x, fy: m.y, tx: p.x, ty: p.y, sprite: 'arrow' });
        ev(ctx, { k: 'se', name: 'arrow' });
      }
      if (!chance(ctx.r, a.k === 'gun' ? 0.8 - line.dist * 0.02 : 0.85)) {
        log(ctx, `${monName(m)}の${a.k === 'gun' ? '弾' : '矢'}は外れた。`);
        return true;
      }
      const dmg = Math.round(a.dmg * (0.85 + next(ctx.r) * 0.3));
      log(ctx, `${monName(m)}が${a.k === 'gun' ? '鉄砲を撃ってきた' : '矢を射てきた'}！ ${dmg}の打撃。`, 'bad');
      hurtPlayer(ctx, dmg, `${monName(m)}の${a.k === 'gun' ? '鉄砲' : '矢'}`);
      return true;
    }
    if (a.k === 'fire') {
      ev(ctx, { k: 'beam', fx: m.x, fy: m.y, tx: p.x, ty: p.y, color: '#ff7a2a' });
      ev(ctx, { k: 'se', name: 'fire' });
      scorch(ctx, tr.path);
      const dmg = Math.round(a.dmg * (m.scale ?? 1) * (0.85 + next(ctx.r) * 0.3) * (hasSeal(run, '火') ? 0.5 : 1));
      log(ctx, `${monName(m)}は火を吐いた！ ${dmg}の打撃。`, 'bad');
      hurtPlayer(ctx, dmg, `${monName(m)}の火`);
    } else {
      ev(ctx, { k: 'proj', fx: m.x, fy: m.y, tx: p.x, ty: p.y, sprite: 'stone' });
      if (!chance(ctx.r, 0.85)) {
        log(ctx, `${monName(m)}の投げた石は外れた。`);
        return true;
      }
      const dmg = Math.round(a.dmg * (m.scale ?? 1) * (0.85 + next(ctx.r) * 0.3));
      log(ctx, `${monName(m)}が石を投げてきた！ ${dmg}の打撃。`, 'bad');
      hurtPlayer(ctx, dmg, `${monName(m)}の石`);
    }
    return true;
  }
  if (a.k === 'magic') {
    if (line.dist < 2 || line.dist > 10 || !chance(ctx.r, a.p)) return false;
    const tr = trace(ctx, m, line.dir, line.dist, { hitPlayer: true });
    if (!tr.hitPlayer) return false;
    m.dir = line.dir;
    ev(ctx, { k: 'beam', fx: m.x, fy: m.y, tx: p.x, ty: p.y, color: '#b98cff' });
    ev(ctx, { k: 'se', name: 'magic' });
    const effect = a.effects[int(ctx.r, a.effects.length)];
    if (hasSeal(run, '反')) {
      log(ctx, `${monName(m)}の術を跳ね返した！`, 'good');
      if (effect === 'slow') m.st.slow = 999;
      if (effect === 'confuse') m.st.confuse = 10;
      if (effect === 'paralyze') m.st.paralyze = 999;
      return true;
    }
    log(ctx, `${monName(m)}は術を唱えた！`, 'bad');
    if (effect === 'slow') { p.st.slow = Math.max(p.st.slow ?? 0, 15); p.st.fast = 0; log(ctx, '足が遅くなった……', 'bad'); }
    if (effect === 'confuse') confusePlayer(ctx, 8);
    if (effect === 'paralyze') { p.st.paralyze = Math.max(p.st.paralyze ?? 0, 4); log(ctx, '体が動かない！', 'bad'); }
    return true;
  }
  return false;
}

