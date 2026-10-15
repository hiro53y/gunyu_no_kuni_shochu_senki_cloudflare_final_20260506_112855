// 1手を進める：プレイヤーの行動 → 敵の手番 → ターンの終わり
import { itemDef } from '../content/items';
import { chance, int } from './rng';
import { at, canStand, cheb, cornerOk, doorRoom, inside, isWall, monsterAt, roomAt, updateSight, visibleFrom } from './geo';
import { buyPrice, charmIs, closeCtx, ev, hasSeal, itemName, log, makeCtx, type Ctx } from './core';
import { hostile, hurtPlayer, identify, makeThief, maybeSpawn, onEnterRoom, teleportPlayer } from './actors';
import { attackMonster, playerMelee } from './combat';
import {
  dropItem, equipItem, findInv, keeperCalm, pickUp, putInPot, shootArrow, swapFoot, takeFromPot, throwItem, triggerTrap, unequipItem, useItem, type Took,
} from './effects';
import { monstersPhase, tickMonsterStatus } from './ai';
import { canUseSkill, tickSkills, useSkill } from './skills';
import { descend } from './run';
import { DX, DY, type Action, type Dir, type GameEvent, type Item, type NpcKind, type Run } from './types';

export function incapacitated(run: Run): boolean {
  const st = run.player.st;
  return !!(st.sleep || st.paralyze);
}

function unpaid(run: Run): Item[] {
  const out: Item[] = [];
  const walk = (list: Item[]) => list.forEach((i) => { if (i.shop) out.push(i); if (i.contents) walk(i.contents); });
  walk(run.player.inv);
  return out;
}

export function unpaidTotal(run: Run): number {
  return unpaid(run).reduce((sum, i) => sum + buyPrice(i), 0);
}


/** 1手を進めて、描画用の出来事を返す */
export function step(run: Run, action: Action): GameEvent[] {
  if (run.end) return [];
  const ctx = makeCtx(run);
  if (run.prompt) {
    if (action.t === 'answer') answerPrompt(ctx, action.yes, !!action.steal);
    else if (action.t === 'npc' && run.prompt.kind === 'npc') npcAction(ctx, action);
    finish(ctx);
    return ctx.ev;
  }
  if (action.t === 'dash') dash(ctx, action.dir);
  else if (action.t === 'rest') rest(ctx);
  else {
    const took = playerAction(ctx, action);
    if (took === 'turn') endPlayerTurn(ctx);
  }
  // 眠り・金縛りの間は勝手にターンが進む
  let guard = 0;
  while (!run.end && !run.prompt && incapacitated(run) && guard++ < 300) endPlayerTurn(ctx);
  finish(ctx);
  return ctx.ev;
}

function finish(ctx: Ctx) {
  ctx.run.monsters = ctx.run.monsters.filter((m) => !m.dead);
  updateSight(ctx.run);
  closeCtx(ctx);
}

function answerPrompt(ctx: Ctx, yes: boolean, steal = false) {
  const run = ctx.run;
  const prompt = run.prompt!;
  run.prompt = null;
  if (prompt.kind === 'npc') { log(ctx, `${NPC_NAME[prompt.who]}「またどうぞ」`); return; }
  if (prompt.kind === 'pay') {
    if (steal) {
      // 払わずに飛び出す：泥棒になり、店主と番人が追ってくる
      log(ctx, '代金を払わずに店を飛び出した！', 'bad');
      makeThief(ctx);
      const took = move(ctx, prompt.dir, false);
      if (took === 'turn') endPlayerTurn(ctx);
      return;
    }
    if (!yes) { log(ctx, '商人「お代を払っていただかないと、お通しできませんよ」'); return; }
    if (run.player.gold < prompt.amount) { log(ctx, 'お金が足りない……', 'bad'); return; }
    run.player.gold -= prompt.amount;
    for (const i of unpaid(run)) i.shop = false;
    log(ctx, `${prompt.amount}文を払った。商人「毎度ありがとうございます」`, 'good');
    ev(ctx, { k: 'se', name: 'coin' });
    return;
  }
  if (prompt.kind === 'sell') {
    const fi = run.floor.items.find((x) => x.item.uid === prompt.itemUid);
    if (!yes || !fi) { log(ctx, '商人「そうですか、残念です」'); return; }
    run.player.gold += prompt.amount;
    fi.item.shop = true;
    log(ctx, `${prompt.amount}文で売った。`, 'good');
    ev(ctx, { k: 'se', name: 'coin' });
  }
}

function confusedDir(ctx: Ctx, dir: Dir): Dir {
  return ctx.run.player.st.confuse ? (int(ctx.r, 8) as Dir) : dir;
}

function playerAction(ctx: Ctx, a: Action): Took {
  const run = ctx.run;
  const p = run.player;
  if (incapacitated(run)) return 'turn';
  switch (a.t) {
    case 'move': return move(ctx, confusedDir(ctx, a.dir), false);
    case 'face': p.dir = a.dir; return 'free';
    case 'attack':
      if (p.st.confuse) p.dir = confusedDir(ctx, p.dir);
      else autoFace(ctx);
      playerMelee(ctx);
      return 'turn';
    case 'sort': sortInventory(run); return 'free';
    case 'wait': return 'turn';
    case 'pickup': return pickUp(ctx) ? 'turn' : 'free';
    case 'stairs': {
      const s = run.floor.stairs;
      if (!s || s.x !== p.x || s.y !== p.y) { log(ctx, 'ここに階段はない。'); return 'free'; }
      if (run.midPending && run.midGen) log(ctx, `${run.gens[run.midGen].name}を残して先へ進んだ。天守で待ち構えているだろう。`, 'warn');
      descend(ctx);
      return 'free';
    }
    case 'shoot': p.dir = confusedDir(ctx, p.dir); return shootArrow(ctx);
    case 'swapFoot': {
      const item = findInv(ctx, a.uid);
      return item ? swapFoot(ctx, item) : 'free';
    }
    case 'item': return itemAction(ctx, a);
    case 'skill': {
      const can = canUseSkill(run, a.who, a.skill);
      if (!can.ok) { log(ctx, `技は使えない。（${can.reason}）`); return 'free'; }
      return useSkill(ctx, a.who, a.skill) ? 'turn' : 'free';
    }
    default: return 'free';
  }
}

function itemAction(ctx: Ctx, a: Extract<Action, { t: 'item' }>): Took {
  const run = ctx.run;
  const p = run.player;
  const item = findInv(ctx, a.uid);
  if (!item) return 'free';
  switch (a.verb) {
    case 'use':
      if (itemDef(item.id).cat === 'staff') p.dir = confusedDir(ctx, p.dir);
      return useItem(ctx, item, a.target, a.scroll);
    case 'equip': return equipItem(ctx, item);
    case 'unequip': return unequipItem(ctx, item);
    case 'throw': p.dir = confusedDir(ctx, p.dir); return throwItem(ctx, item);
    case 'drop': return dropItem(ctx, item);
    case 'put': {
      const pot = a.target !== undefined ? findInv(ctx, a.target) : null;
      return pot ? putInPot(ctx, pot, item) : 'free';
    }
    case 'take': {
      const inner = (item.contents ?? []).find((c) => c.uid === a.target);
      return inner ? takeFromPot(ctx, item, inner) : 'free';
    }
    case 'name': {
      const text = (a.name ?? '').trim().slice(0, 12);
      if (text) run.named[item.id] = text;
      else delete run.named[item.id];
      return 'free';
    }
    default: return 'free';
  }
}

/** 1歩。敵に向かうと叩く、仲間とは入れ替わる */
function move(ctx: Ctx, dir: Dir, dashing: boolean): Took {
  const run = ctx.run;
  const p = run.player;
  const f = run.floor;
  p.dir = dir;
  const tx = p.x + DX[dir], ty = p.y + DY[dir];
  if (!inside(f, tx, ty)) return 'free';
  const m = monsterAt(run, tx, ty);
  if (m && cornerOk(f, p.x, p.y, dir)) {
    if (m.ally) {
      // 壁や水の中にいる仲間とは入れ替われない
      if (!canStand(f, tx, ty, 'walk')) return 'free';
      if (p.st.stuck) { p.st.stuck -= 1; log(ctx, '足を挟まれていて動けない！'); return 'turn'; }
      const fx = p.x, fy = p.y;
      p.x = tx; p.y = ty;
      m.x = fx; m.y = fy;
      ev(ctx, { k: 'move', uid: 0, fx, fy, tx, ty });
      ev(ctx, { k: 'move', uid: m.uid, fx: tx, fy: ty, tx: fx, ty: fy });
      afterStep(ctx, dashing);
      return 'turn';
    }
    if (m.role === 'npc' && m.npc) {
      run.prompt = { kind: 'npc', who: m.npc, cost: npcCost(run, m.npc) };
      log(ctx, NPC_GREETING[m.npc], 'info');
      return 'free';
    }
    if (m.disguise) {
      if (dashing) return 'free';
      attackMonster(ctx, m);
      return 'turn';
    }
    if (m.role === 'keeper' && !m.angry) {
      // 店主とはすれ違える（店の中のマスどうしだけ）
      const keeperRoom = roomAt(f, tx, ty);
      if (!keeperRoom || roomAt(f, p.x, p.y)?.id !== keeperRoom.id) {
        log(ctx, '商人「いらっしゃいませ。品物を拾ってお持ちくだされ」');
        return 'free';
      }
      const fx = p.x, fy = p.y;
      p.x = tx; p.y = ty;
      m.x = fx; m.y = fy;
      ev(ctx, { k: 'move', uid: 0, fx, fy, tx, ty });
      ev(ctx, { k: 'move', uid: m.uid, fx: tx, fy: ty, tx: fx, ty: fy });
      afterStep(ctx, dashing);
      return 'turn';
    }
    if (dashing) return 'free';
    attackMonster(ctx, m);
    ev(ctx, { k: 'atk', uid: 0, dir });
    return 'turn';
  }
  if (!canStand(f, tx, ty, 'walk') || !cornerOk(f, p.x, p.y, dir)) return 'free';
  if (p.st.stuck) {
    p.st.stuck -= 1;
    log(ctx, '足を挟まれていて動けない！');
    return 'turn';
  }
  // 店の品を持ったまま店を出ようとすると呼び止められる
  const here = roomAt(f, p.x, p.y);
  if (here && here.kind === 'shop' && roomAt(f, tx, ty)?.id !== here.id && keeperCalm(ctx)) {
    const total = unpaidTotal(run);
    if (total > 0) {
      run.prompt = { kind: 'pay', amount: total, dir };
      log(ctx, `商人「お代は${total}文になります。お支払いになりますか？」`, 'info');
      return 'free';
    }
  }
  const fx = p.x, fy = p.y;
  p.x = tx; p.y = ty;
  ev(ctx, { k: 'move', uid: 0, fx, fy, tx, ty });
  afterStep(ctx, dashing);
  return 'turn';
}

function afterStep(ctx: Ctx, dashing: boolean) {
  const run = ctx.run;
  const p = run.player;
  pickUp(ctx, true);
  const ti = run.floor.traps.findIndex((t) => t.x === p.x && t.y === p.y);
  if (ti >= 0) {
    const trap = run.floor.traps[ti];
    // 見えている罠は、ときどき避けられる
    if (trap.found && chance(ctx.r, 0.25)) log(ctx, '罠をうまく避けた。');
    else triggerTrap(ctx, ti);
  }
  const s = run.floor.stairs;
  if (s && s.x === p.x && s.y === p.y && !dashing) log(ctx, '階段がある。', 'info');
  onEnterRoom(ctx);
}

// ── 宿場の人 ──

const NPC_NAME: Record<NpcKind, string> = { inn: '宿の主人', bank: '倉庫番', seer: '辻占い' };
const NPC_GREETING: Record<NpcKind, string> = {
  inn: '宿の主人「長旅お疲れさまです。ひと晩いかがですか」',
  bank: '倉庫番「お預かりした物は、村の倉庫へ確かにお届けします」',
  seer: '辻占い「どれ、その道具の正体を占ってしんぜよう」',
};

export function npcCost(run: Run, who: NpcKind): number {
  if (who === 'inn') return 80 + run.floorNo * 15;
  if (who === 'seer') return 100 + run.floorNo * 5;
  return 0;
}

function npcAction(ctx: Ctx, a: Extract<Action, { t: 'npc' }>) {
  const run = ctx.run;
  const p = run.player;
  const cost = npcCost(run, a.who);
  if (a.who === 'inn') {
    if (p.gold < cost) { log(ctx, `宿の主人「お代が${cost}文、足りないようですな」`, 'bad'); return; }
    p.gold -= cost;
    p.hp = p.maxHp;
    p.hunger = p.maxHunger;
    p.st = {};
    p.str = Math.max(p.str, p.maxStr);
    log(ctx, `${cost}文を払って泊まった。ぐっすり眠って、すっかり元気になった！`, 'good');
    ev(ctx, { k: 'flash', color: '#fff2c0' });
    ev(ctx, { k: 'se', name: 'revive' });
    run.prompt = null;
    return;
  }
  if (a.who === 'bank') {
    if (a.gold) {
      if (p.gold <= 0) { log(ctx, '預けるお金を持っていない。'); return; }
      run.depositGold = (run.depositGold ?? 0) + p.gold;
      log(ctx, `${p.gold}文を倉庫番に預けた。（村の蓄えに届く）`, 'good');
      p.gold = 0;
      return;
    }
    const item = p.inv.find((i) => i.uid === a.target);
    if (!item) return;
    if (item.shop) { log(ctx, '倉庫番「お店の品はお預かりできません」'); return; }
    if (Object.values(p.eq).includes(item.uid) && item.cursed) { log(ctx, '呪われていて手放せない！', 'bad'); return; }
    for (const slot of ['weapon', 'armor', 'charm', 'arrow'] as const) if (p.eq[slot] === item.uid) delete p.eq[slot];
    p.inv.splice(p.inv.indexOf(item), 1);
    (run.deposit ??= []).push(item);
    log(ctx, `${itemName(run, item)}を預けた。（村の倉庫に届く）`, 'good');
    return;
  }
  // 辻占い
  const item = p.inv.find((i) => i.uid === a.target);
  if (!item) return;
  if (p.gold < cost) { log(ctx, `辻占い「見料が${cost}文、足りぬようじゃ」`, 'bad'); return; }
  p.gold -= cost;
  identify(ctx, item);
}

/** 向いた先に敵がおらず、隣の敵が1体だけなら、その敵の方を向く */
function autoFace(ctx: Ctx) {
  const run = ctx.run;
  const p = run.player;
  const ahead = monsterAt(run, p.x + DX[p.dir], p.y + DY[p.dir]);
  if (ahead && hostile(ahead)) return;
  const around: Dir[] = [];
  for (let d = 0; d < 8; d++) {
    const m = monsterAt(run, p.x + DX[d], p.y + DY[d]);
    if (m && hostile(m) && !m.disguise && cornerOk(run.floor, p.x, p.y, d as Dir) && !isWall(run.floor, m.x, m.y)) around.push(d as Dir);
  }
  if (around.length === 1) p.dir = around[0];
}

const SORT_ORDER = ['weapon', 'armor', 'charm', 'arrow', 'staff', 'scroll', 'grass', 'food', 'pot'];

export function sortInventory(run: Run) {
  run.player.inv.sort((a, b) => {
    const ca = SORT_ORDER.indexOf(itemDef(a.id).cat), cb = SORT_ORDER.indexOf(itemDef(b.id).cat);
    return ca - cb || a.id.localeCompare(b.id) || a.uid - b.uid;
  });
}

// ── ダッシュと休む ──

function hostilesInSight(run: Run): Set<number> {
  const vis = visibleFrom(run.floor, run.player.x, run.player.y);
  const out = new Set<number>();
  for (const m of run.monsters) if (hostile(m) && !m.disguise && vis.has(at(run.floor, m.x, m.y))) out.add(m.uid);
  return out;
}

/** 通路で曲がり角に沿って進む方向（分かれ道なら null） */
function corridorNext(run: Run, dir: Dir): Dir | null {
  const f = run.floor;
  const p = run.player;
  const back = (dir + 4) % 8;
  const options: Dir[] = [];
  for (let d = 0; d < 8; d++) {
    if (d === back || d === (back + 1) % 8 || d === (back + 7) % 8) continue;
    const x = p.x + DX[d], y = p.y + DY[d];
    if (canStand(f, x, y, 'walk') && cornerOk(f, p.x, p.y, d as Dir)) options.push(d as Dir);
  }
  if (options.length === 1) return options[0];
  if (options.includes(dir)) {
    // まっすぐ進めて、ほかは斜めの近道だけなら直進
    const others = options.filter((d) => d !== dir);
    if (others.every((d) => Math.abs(((d - dir + 8) % 8)) === 1 || Math.abs(((d - dir + 8) % 8)) === 7)) return dir;
  }
  return null;
}

function dash(ctx: Ctx, first: Dir) {
  const run = ctx.run;
  const p = run.player;
  let dir = confusedDir(ctx, first);
  const seen = hostilesInSight(run);
  const startHp = p.hp;
  for (let i = 0; i < 60; i++) {
    const wasRoom = roomAt(run.floor, p.x, p.y)?.id ?? -1;
    const wasDoor = !!doorRoom(run.floor, p.x, p.y);
    const took = move(ctx, dir, true);
    if (took !== 'turn') break;
    endPlayerTurn(ctx);
    if (run.end || run.prompt || incapacitated(run) || p.hp < startHp || p.st.confuse) break;
    const now = hostilesInSight(run);
    if ([...now].some((uid) => !seen.has(uid))) break;
    if (run.monsters.some((m) => hostile(m) && cheb(m, p) <= 1)) break;
    if (run.floor.items.some((fi) => fi.x === p.x && fi.y === p.y)) break;
    const s = run.floor.stairs;
    if (s && s.x === p.x && s.y === p.y) break;
    if (run.floor.traps.some((t) => t.found && cheb(t, { x: p.x + DX[dir], y: p.y + DY[dir] }) === 0)) break;
    const room = roomAt(run.floor, p.x, p.y)?.id ?? -1;
    const door = !!doorRoom(run.floor, p.x, p.y);
    if (room !== wasRoom || door !== wasDoor) break;
    if (room < 0) {
      const nextDir = corridorNext(run, dir);
      if (nextDir === null) break;
      dir = nextDir;
    } else {
      const nx = p.x + DX[dir], ny = p.y + DY[dir];
      if (!canStand(run.floor, nx, ny, 'walk') || isWall(run.floor, nx, ny)) break;
      // 部屋の中で道具が隣にあれば止まる
      if (run.floor.items.some((fi) => cheb(fi, p) === 1)) break;
    }
  }
}

function rest(ctx: Ctx) {
  const run = ctx.run;
  const p = run.player;
  if (hostilesInSight(run).size) { log(ctx, '敵が近くにいて休めない。'); return; }
  let n = 0;
  while (n < 100 && !run.end && p.hp < p.maxHp && p.hunger > 0) {
    endPlayerTurn(ctx);
    n++;
    if (hostilesInSight(run).size || run.prompt || incapacitated(run)) break;
  }
  log(ctx, n ? `${n}ターン休んだ。` : 'HPは満タンだ。');
}

// ── ターンの進行 ──

export function endPlayerTurn(ctx: Ctx) {
  const run = ctx.run;
  const p = run.player;
  if (run.end) return;
  if (run.pendingFall) { descend(ctx); return; }
  // 倍速なら2回に1回だけ世界が進む
  if (p.st.fast && !p.st.slow && !run.half) { run.half = 1; return; }
  run.half = 0;
  ctx.fields.clear();
  monstersPhase(ctx, 1);
  if (!run.end) monstersPhase(ctx, 2);
  if (!run.end && p.st.slow && !p.st.fast) { ctx.fields.clear(); monstersPhase(ctx, 1); }
  if (!run.end) endOfTurn(ctx);
}

function endOfTurn(ctx: Ctx) {
  const run = ctx.run;
  const p = run.player;
  const f = run.floor;
  run.turn += 1;
  run.stats.turns += 1;
  f.turns += 1;
  if (run.timeStop) run.timeStop -= 1;
  // お腹
  let rate = 0.085;
  if (hasSeal(run, '腹')) rate *= 0.5;
  if (charmIs(run, 'c_haramochi')) rate *= 0.5;
  if (charmIs(run, 'c_kaifuku')) rate *= 1.5;
  p.hungerAcc += rate;
  const before = p.hunger;
  while (p.hungerAcc >= 1) { p.hungerAcc -= 1; p.hunger = Math.max(0, p.hunger - 1); }
  if (before > 20 && p.hunger <= 20) log(ctx, 'お腹が減ってきた。', 'warn');
  if (before > 10 && p.hunger <= 10) log(ctx, 'お腹がぺこぺこだ……', 'warn');
  if (before > 0 && p.hunger === 0) log(ctx, 'お腹が減って倒れそうだ！', 'bad');
  if (p.hunger <= 0) {
    hurtPlayer(ctx, 1, '空腹');
    if (run.end) return;
  } else if (p.hp < p.maxHp) {
    p.regen += (p.maxHp / 110 + 0.05) * (charmIs(run, 'c_kaifuku') ? 3 : 1);
    while (p.regen >= 1) { p.regen -= 1; p.hp = Math.min(p.maxHp, p.hp + 1); }
  } else {
    p.regen = 0;
  }
  // 状態の時間
  const st = p.st;
  if (st.sleep) st.sleep -= 1;
  if (st.paralyze) st.paralyze -= 1;
  if (st.confuse) { st.confuse -= 1; if (!st.confuse) log(ctx, '混乱がおさまった。'); }
  if (st.slow) { st.slow -= 1; if (!st.slow) log(ctx, '足の速さが元に戻った。'); }
  if (st.fast) { st.fast -= 1; if (!st.fast) log(ctx, '倍速が切れた。'); }
  if (st.invincible) { st.invincible -= 1; if (!st.invincible) log(ctx, '無敵が切れた。'); }
  if (st.blind) st.blind -= 1;
  if (st.hidden) { st.hidden -= 1; if (!st.hidden) log(ctx, '姿が元に戻った。'); }
  if (st.guard) { st.guard -= 1; if (!st.guard) log(ctx, '守りの技が切れた。'); }
  if (st.power) { st.power -= 1; if (!st.power) { delete st.powerK; log(ctx, '攻めの技が切れた。'); } }
  tickSkills(run);
  if (st.stuck && chance(ctx.r, 0.15)) st.stuck = Math.max(0, st.stuck - 1);
  // 迷いのお守り
  if (charmIs(run, 'c_mayoi') && chance(ctx.r, 0.02)) {
    log(ctx, 'お守りに引っぱられて、どこかへ飛ばされた！', 'warn');
    teleportPlayer(ctx);
  }
  tickMonsterStatus(ctx);
  maybeSpawn(ctx);
  // 周りの罠に気づく
  for (const t of f.traps) if (!t.found && cheb(t, p) <= 1 && chance(ctx.r, 0.04)) { t.found = true; log(ctx, '近くに罠を見つけた。', 'info'); }
  // 店の品を持って店の外にいたら泥棒
  const room = roomAt(f, p.x, p.y);
  if ((!room || room.kind !== 'shop') && unpaid(run).length && f.shop) makeThief(ctx);
  // 長居すると突風が吹く
  if (f.kind !== 'boss' && f.kind !== 'town' && f.kind !== 'field') {
    if (f.turns === 1000) log(ctx, '遠くから風の音が聞こえてくる……', 'warn');
    if (f.turns === 1150) log(ctx, '風が強くなってきた！ 早く階段を探そう。', 'warn');
    if (f.turns >= 1250 && !run.end) {
      log(ctx, '突風に押し流されて、次の階へ運ばれた！', 'warn');
      run.pendingFall = true;
      descend(ctx);
    }
  }
}

