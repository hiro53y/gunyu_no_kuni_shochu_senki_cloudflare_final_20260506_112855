// 道具の効果：食べる・読む・振る・投げる・撃つ・装備・壺・罠
import { itemDef } from '../content/items';
import { monDef } from '../content/monsters';
import { TRAP_BY_ID } from '../content/world';
import { runDanger } from './run';
import { chance, int, next, pick, range } from './rng';
import { at, cheb, roomAt, vacant, visibleFrom } from './geo';
import {
  buyPrice, charmIs, equipped, ev, isEquipped, itemName, log, monDefense, monName, newUid, sealsOf, sealSlots, sellPrice, typeKnown, type Ctx,
} from './core';
import {
  dropNear, healPlayer, hurtMonster, revealDisguise, hurtPlayer, identify, levelUp, makeKnownType, MAX_ALLIES, MAX_INV,
  monsterLevelUp, spawnNear, teleportMonster, teleportPlayer, weakenStr,
} from './actors';
import { confusePlayer, knockback, rustEquipment, scorch, sleepPlayer, trace } from './combat';
import { makeItem, randomItemDef, randomMonsterId } from './mapgen';
import { DX, DY, T_FLOOR, T_HARD, T_WALL, type Dir, type Item, type Monster } from './types';

export type Took = 'turn' | 'free';

/** 持ち物から取り除く（装備も外す） */
export function takeOut(ctx: Ctx, item: Item) {
  const p = ctx.run.player;
  const i = p.inv.indexOf(item);
  if (i >= 0) p.inv.splice(i, 1);
  for (const slot of ['weapon', 'armor', 'charm', 'arrow'] as const) if (p.eq[slot] === item.uid) delete p.eq[slot];
}

export function findInv(ctx: Ctx, uid: number): Item | null {
  return ctx.run.player.inv.find((i) => i.uid === uid) ?? null;
}

/** 持ち物に入れる（矢はまとめる）。入らなければ false */
export function addToInv(ctx: Ctx, item: Item): boolean {
  const p = ctx.run.player;
  if (item.id === 'gold') {
    p.gold += item.count ?? 0;
    return true;
  }
  const def = itemDef(item.id);
  if (def.cat === 'arrow') {
    const same = p.inv.find((i) => i.id === item.id && !i.shop === !item.shop && (i.count ?? 0) < 99);
    if (same) {
      same.count = Math.min(99, (same.count ?? 0) + (item.count ?? 0));
      return true;
    }
  }
  if (p.inv.length >= MAX_INV) return false;
  if (charmIs(ctx.run, 'c_shikibetsu')) { ctx.run.known[item.id] = true; item.known = true; }
  p.inv.push(item);
  return true;
}

function useCharge(ctx: Ctx, staff: Item): boolean {
  if ((staff.charges ?? 0) <= 0) {
    log(ctx, 'しかし何も起こらなかった。（回数切れ）');
    staff.known = true;
    return false;
  }
  staff.charges = (staff.charges ?? 0) - 1;
  return true;
}

// ── 使う（食べる・読む・振る） ──

export function useItem(ctx: Ctx, item: Item, target?: number, scroll?: string): Took {
  const run = ctx.run;
  const def = itemDef(item.id);
  if (item.shop && def.cat !== 'staff') {
    // 店の品を使うと代金を払う義務が残るが、ここでは「使えない」とする
    log(ctx, '商人「お代を払ってから使ってくだされ」');
    return 'free';
  }
  run.stats.itemsUsed += 1;
  switch (def.cat) {
    case 'grass':
      takeOut(ctx, item);
      log(ctx, `${itemName(run, item)}を飲んだ。`);
      makeKnownType(ctx, item.id);
      eatGrass(ctx, item.id);
      return 'turn';
    case 'food':
      takeOut(ctx, item);
      log(ctx, `${itemName(run, item)}を食べた。`);
      eatFood(ctx, item.id);
      return 'turn';
    case 'scroll':
      takeOut(ctx, item);
      log(ctx, `${itemName(run, item)}を読んだ。`);
      makeKnownType(ctx, item.id);
      readScroll(ctx, item.id, target, scroll);
      return 'turn';
    case 'staff':
      if (item.shop) {
        log(ctx, '商人「お代を払ってから使ってくだされ」');
        return 'free';
      }
      log(ctx, `${itemName(run, item)}を振った。`);
      zapStaff(ctx, item);
      return 'turn';
    default:
      log(ctx, 'それは使えない。');
      return 'free';
  }
}

function eatFood(ctx: Ctx, id: string) {
  const p = ctx.run.player;
  const fill = (n: number, overflow: number) => {
    const before = p.hunger;
    if (p.hunger >= p.maxHunger && overflow) {
      p.maxHunger = Math.min(200, p.maxHunger + overflow);
      log(ctx, `最大満腹度が${overflow}増えた。`, 'good');
    }
    p.hunger = Math.min(p.maxHunger, p.hunger + n);
    if (p.hunger > before) log(ctx, 'お腹がふくれた。', 'good');
  };
  ev(ctx, { k: 'se', name: 'eat' });
  switch (id) {
    case 'f_onigiri': fill(50, 1); break;
    case 'f_oonigiri': fill(999, 3); break;
    case 'f_tokusei': p.maxHunger = Math.min(200, p.maxHunger + 5); fill(999, 0); log(ctx, '最大満腹度が5増えた！', 'good'); break;
    case 'f_yaki': fill(50, 1); healPlayer(ctx, 10); break;
    case 'f_kusatta': {
      fill(30, 0);
      const roll = int(ctx.r, 4);
      if (roll === 0) { log(ctx, 'お腹をこわした……'); weakenStr(ctx, 1); }
      else if (roll === 1) confusePlayer(ctx, 8);
      else if (roll === 2) sleepPlayer(ctx, 4);
      else log(ctx, '……意外とおいしかった。');
      break;
    }
    default:
  }
}

export function eatGrass(ctx: Ctx, id: string) {
  const run = ctx.run;
  const p = run.player;
  switch (id) {
    case 'g_yakusou': healPlayer(ctx, 25, 1); p.st.blind = 0; break;
    case 'g_daiyakusou': healPlayer(ctx, 100, 2); p.st.confuse = 0; p.st.blind = 0; break;
    case 'g_inochi': p.maxHp += 5; healPlayer(ctx, 5); log(ctx, '最大HPが5増えた！', 'good'); break;
    case 'g_chikara':
      if (p.str >= p.maxStr) p.maxStr += 1;
      p.str += 1;
      log(ctx, `力が1上がった！（${p.str}/${p.maxStr}）`, 'good');
      break;
    case 'g_doku': weakenStr(ctx, 1); hurtPlayer(ctx, 5, '毒草'); break;
    case 'g_konran': confusePlayer(ctx, 10); break;
    case 'g_suimin': sleepPlayer(ctx, 5); break;
    case 'g_megusuri':
      for (const t of run.floor.traps) t.found = true;
      log(ctx, 'この階の罠がすべて見えるようになった。', 'good');
      break;
    case 'g_senrigan':
      run.floor.clairvoyant = true;
      log(ctx, 'この階の敵と道具の気配が分かるようになった。', 'good');
      break;
    case 'g_baisoku': p.st.fast = 20; p.st.slow = 0; log(ctx, '体が軽くなった！（倍速）', 'good'); break;
    case 'g_fukkatsu': healPlayer(ctx, 999); log(ctx, '力がみなぎった。'); break;
    case 'g_kaen': breatheFire(ctx); break;
    case 'g_zassou': log(ctx, '何も起こらなかった。'); break;
    case 'g_ten': levelUp(ctx, true); break;
    case 'g_dokukeshi':
      if (p.str < p.maxStr) { p.str = p.maxStr; log(ctx, `力が元に戻った。（${p.str}）`, 'good'); } else log(ctx, '何も起こらなかった。');
      break;
    case 'g_muteki': p.st.invincible = 20; log(ctx, '無敵になった！', 'good'); break;
    case 'g_sugata': p.st.hidden = 30; log(ctx, '姿が薄れた。敵に気づかれにくくなった。', 'good'); break;
    default:
  }
}

function breatheFire(ctx: Ctx) {
  const p = ctx.run.player;
  const tr = trace(ctx, p, p.dir, 10);
  ev(ctx, { k: 'beam', fx: p.x, fy: p.y, tx: tr.end.x, ty: tr.end.y, color: '#ff7a2a' });
  ev(ctx, { k: 'se', name: 'fire' });
  scorch(ctx, tr.path);
  const m = tr.hits[0];
  if (m) {
    log(ctx, `${monName(m)}を炎が包んだ！`);
    hurtMonster(ctx, m, 30 + int(ctx.r, 10), 'player');
  } else log(ctx, '炎を吐いた。');
}

// ── 巻物 ──

export function readScroll(ctx: Ctx, id: string, target?: number, scroll?: string) {
  const run = ctx.run;
  const p = run.player;
  const f = run.floor;
  const inSight = () => {
    const vis = visibleFrom(f, p.x, p.y);
    return run.monsters.filter((m) => !m.dead && !m.ally && m.role !== 'keeper' && vis.has(at(f, m.x, m.y)));
  };
  switch (id) {
    case 's_shikibetsu': {
      let item = target !== undefined ? findInv(ctx, target) : null;
      if (!item) item = p.inv.find((i) => !typeKnown(run, i.id) || !i.known) ?? null;
      if (item) identify(ctx, item);
      else log(ctx, 'しかし識別する物がなかった。');
      break;
    }
    case 's_tenkei':
    case 's_chikei': {
      const slot = id === 's_tenkei' ? 'weapon' : 'armor';
      const eqItem = equipped(run, slot);
      if (!eqItem) { log(ctx, `${slot === 'weapon' ? '武器' : '防具'}を装備していない……`); break; }
      eqItem.plus = (eqItem.plus ?? 0) + 1;
      eqItem.cursed = false;
      eqItem.known = true;
      log(ctx, `${itemName(run, eqItem)}が強くなった！`, 'good');
      ev(ctx, { k: 'flash', color: '#fff2b0' });
      break;
    }
    case 's_hakushi': {
      const written = scroll && scroll !== 's_hakushi' && run.known[scroll] && itemDef(scroll).cat === 'scroll' ? scroll : null;
      if (!written) { log(ctx, '書く巻物を思いつかなかった。'); break; }
      log(ctx, `「${itemDef(written).name}」と書いた。`);
      readScroll(ctx, written, target);
      break;
    }
    case 's_oobeya': {
      if (f.shop) { log(ctx, '商人ににらまれて、何も起こらなかった。'); break; }
      for (let y = 1; y < f.h - 1; y++) {
        for (let x = 1; x < f.w - 1; x++) {
          const i = at(f, x, y);
          if (f.tiles[i] === T_WALL) f.tiles[i] = T_FLOOR;
          f.roomOf[i] = 0;
        }
      }
      f.rooms = [{ id: 0, x: 1, y: 1, w: f.w - 2, h: f.h - 2, kind: 'normal', lit: !f.dark }];
      f.house = -1;
      for (const m of run.monsters) if (!m.dead) m.awake = true;
      log(ctx, '階全体が大部屋になった！', 'warn');
      ev(ctx, { k: 'flash', color: '#ffffff' });
      break;
    }
    case 's_konran': {
      const list = inSight();
      for (const m of list) m.st.confuse = 20;
      log(ctx, list.length ? '見えている敵が混乱した！' : '何も起こらなかった。', list.length ? 'good' : undefined);
      break;
    }
    case 's_nemuri': {
      const list = inSight();
      for (const m of list) m.st.sleep = 20;
      log(ctx, list.length ? '見えている敵が眠った！' : '何も起こらなかった。', list.length ? 'good' : undefined);
      break;
    }
    case 's_shinkuu': {
      const list = inSight();
      ev(ctx, { k: 'flash', color: '#d0f0ff' });
      ev(ctx, { k: 'se', name: 'slash' });
      if (!list.length) log(ctx, '真空の刃が舞ったが、誰もいなかった。');
      for (const m of list) hurtMonster(ctx, m, 30, 'player');
      break;
    }
    case 's_seiiki': log(ctx, '何も起こらなかった。（床に置いて使う物らしい）'); break;
    case 's_wanakeshi': f.traps = []; log(ctx, 'この階の罠がすべて消えた。', 'good'); break;
    case 's_douguyose': {
      const items = f.items.filter((fi) => !fi.item.shop);
      f.items = f.items.filter((fi) => fi.item.shop);
      for (const fi of items) dropNear(ctx, fi.item, p, true);
      log(ctx, items.length ? '道具が足元に集まってきた！' : '何も起こらなかった。', items.length ? 'good' : undefined);
      break;
    }
    case 's_kaijuu': {
      let count = 0;
      const clear = (list: Item[]) => list.forEach((i) => { if (i.cursed) { i.cursed = false; count++; } if (i.contents) clear(i.contents); });
      clear(p.inv);
      log(ctx, count ? '持ち物の呪いが解けた。' : '何も起こらなかった。', count ? 'good' : undefined);
      break;
    }
    case 's_kikan':
      if (run.mode === 'defense' || run.mode === 'practice') { log(ctx, '合戦の最中に撤退はできない！'); break; }
      log(ctx, '撤退の法螺貝を吹き、部隊をまとめて退いた。', 'good');
      run.end = { kind: 'return', cause: '撤退の巻物', floor: run.floorNo };
      break;
    case 's_chizu':
      f.seen.fill(0);
      for (let i = 0; i < f.tiles.length; i++) if (f.tiles[i] !== T_WALL && f.tiles[i] !== T_HARD) f.seen[i] = 1;
      f.mapped = true;
      log(ctx, 'この階の地図が分かった。', 'good');
      break;
    case 's_bakuhatsu': {
      ev(ctx, { k: 'boom', x: p.x, y: p.y, r: 1 });
      ev(ctx, { k: 'se', name: 'thunder' });
      const near = run.monsters.filter((m) => !m.dead && !m.ally && cheb(m, p) <= 1);
      if (!near.length) log(ctx, '雷が鳴り響いた。');
      for (const m of near) hurtMonster(ctx, m, 35, 'player');
      break;
    }
    case 's_nekiri': {
      const target = inSight().filter((m) => !m.role).sort((a, b) => cheb(a, p) - cheb(b, p))[0];
      if (!target) { log(ctx, '根切りの巻物を読んだが、見える所に敵がいなかった。'); break; }
      const id = target.id;
      (run.banned ??= {})[id] = true;
      let n = 0;
      for (const m of run.monsters) {
        if (m.id === id && !m.ally && !m.dead) { m.dead = true; n++; ev(ctx, { k: 'die', uid: m.uid, x: m.x, y: m.y }); }
      }
      ev(ctx, { k: 'flash', color: '#c8b0ff' });
      log(ctx, `${monDef(id).name}は、この冒険から根こそぎ姿を消した！（${n}体）`, 'good');
      break;
    }
    case 's_bakuretsu': {
      ev(ctx, { k: 'boom', x: p.x, y: p.y, r: 1 });
      ev(ctx, { k: 'se', name: 'boom' });
      let walls = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = p.x + dx, y = p.y + dy;
          if (x <= 0 || y <= 0 || x >= f.w - 1 || y >= f.h - 1) continue;
          if (f.tiles[at(f, x, y)] === T_WALL) { f.tiles[at(f, x, y)] = T_FLOOR; walls++; }
        }
      }
      const near = run.monsters.filter((m) => !m.dead && !m.ally && m.role !== 'npc' && cheb(m, p) <= 1);
      for (const m of near) hurtMonster(ctx, m, 40, 'player');
      log(ctx, `爆裂！${walls ? `壁が${walls}マス吹き飛んだ。` : ''}${near.length ? '' : ''}`, 'warn');
      break;
    }
    case 's_tokitome':
      run.timeStop = 15;
      log(ctx, '時が止まった！', 'good');
      ev(ctx, { k: 'flash', color: '#b0c8ff' });
      break;
    default:
  }
}

// ── 杖 ──

function zapStaff(ctx: Ctx, staff: Item) {
  const run = ctx.run;
  const p = run.player;
  if (!useCharge(ctx, staff)) return;
  const dir = p.dir;
  if (staff.id === 't_kussaku') { digTunnel(ctx, dir); makeKnownType(ctx, staff.id); return; }
  const tr = trace(ctx, p, dir, 10);
  ev(ctx, { k: 'beam', fx: p.x, fy: p.y, tx: tr.end.x, ty: tr.end.y, color: '#9fd8ff' });
  ev(ctx, { k: 'se', name: 'magic' });
  const m = tr.hits[0];
  if (!m) {
    log(ctx, '魔法弾は何にも当たらなかった。');
    return;
  }
  makeKnownType(ctx, staff.id);
  staffEffect(ctx, staff.id, m, dir);
}

export function staffEffect(ctx: Ctx, id: string, m: Monster, dir: Dir) {
  const run = ctx.run;
  const p = run.player;
  const name = monName(m);
  if (m.role === 'npc') { log(ctx, `${name}には効かなかった。`); return; }
  if (m.disguise) revealDisguise(ctx, m);
  if (m.role === 'keeper' && !m.angry && id !== 't_chigiri') {
    // 店主に杖を当てると怒る
    hurtMonster(ctx, m, 1, 'player');
  }
  switch (id) {
    case 't_fukitobashi':
      log(ctx, `${name}を吹き飛ばした！`);
      m.awake = true;
      knockback(ctx, m, dir, 10);
      break;
    case 't_bashogae': {
      const px = p.x, py = p.y;
      p.x = m.x; p.y = m.y;
      m.x = px; m.y = py;
      ev(ctx, { k: 'warp', uid: 0, x: p.x, y: p.y });
      ev(ctx, { k: 'warp', uid: m.uid, x: m.x, y: m.y });
      log(ctx, `${name}と場所が入れ替わった。`);
      break;
    }
    case 't_ichiji':
      if (m.gen) { log(ctx, `${name}は踏みとどまった！`); break; }
      log(ctx, `${name}をどこかへ飛ばした。`); teleportMonster(ctx, m); break;
    case 't_donsoku': m.st.slow = 999; m.st.fast = 0; log(ctx, `${name}の足が遅くなった。`); break;
    case 't_fuuin': m.st.sealed = true; log(ctx, `${name}の特技を封じた。`); break;
    case 't_kanashibari': m.st.paralyze = m.gen ? 4 : 999; log(ctx, `${name}は金縛りになった。`); break;
    case 't_ikazuchi':
      ev(ctx, { k: 'se', name: 'thunder' });
      log(ctx, `${name}に雷が落ちた！`);
      hurtMonster(ctx, m, range(ctx.r, 20, 30), 'player');
      break;
    case 't_henge': {
      if (m.role) { log(ctx, `${name}には効かなかった。`); break; }
      const nid = randomMonsterId(ctx.r, runDanger(run), run.banned, run.faction);
      m.id = nid;
      const def = monDef(nid);
      m.maxHp = Math.round(def.hp * (m.scale ?? 1));
      m.hp = m.maxHp;
      m.st = {};
      run.stats.seenIds[nid] = true;
      log(ctx, `${name}は${def.name}に変わった！`);
      break;
    }
    case 't_chigiri': {
      const allies = run.monsters.filter((x) => x.ally && !x.dead && !x.gen).length;
      if (m.role || m.ally || m.gen) { log(ctx, `${name}には効かなかった。`); break; }
      if (allies >= MAX_ALLIES) { log(ctx, '寝返らせた兵は、これ以上まとめきれない。'); break; }
      m.ally = true;
      m.turned = true;
      m.awake = true;
      m.st = {};
      m.fleeing = false;
      m.hp = m.maxHp;
      run.stats.allies += 1;
      log(ctx, `${name}が寝返った！ この戦の間、味方になる。`, 'good');
      ev(ctx, { k: 'popup', x: m.x, y: m.y, text: '寝返り', color: '#8affb0' });
      break;
    }
    case 't_hikiyose': {
      const tx = p.x + DX[dir], ty = p.y + DY[dir];
      if (vacant(run, tx, ty) || (m.x === tx && m.y === ty)) {
        const fx = m.x, fy = m.y;
        m.x = tx; m.y = ty;
        ev(ctx, { k: 'move', uid: m.uid, fx, fy, tx, ty });
      }
      log(ctx, `${name}を引き寄せた。`);
      break;
    }
    case 't_itamiwake': m.st.bond = true; log(ctx, `${name}と痛みを分け合うことになった。`); break;
    case 't_suima': m.st.sleep = m.gen ? 5 : 30; log(ctx, `${name}は眠ってしまった。`); break;
    case 't_migawari':
      if (m.role) { log(ctx, `${name}には効かなかった。`); break; }
      m.st.decoy = 40;
      m.awake = true;
      log(ctx, `${name}は身代わりになった！ ほかの敵が襲いかかる。`, 'good');
      ev(ctx, { k: 'popup', x: m.x, y: m.y, text: '身代わり', color: '#ffb0f0' });
      break;
    default:
  }
  m.awake = m.awake || id === 't_fukitobashi';
}

/** 掘削の杖：向いた方向の壁を10マスまでくり抜く（外壁は掘れない） */
export function digTunnel(ctx: Ctx, dir: Dir) {
  const run = ctx.run;
  const f = run.floor;
  const p = run.player;
  let x = p.x, y = p.y, dug = 0;
  for (let i = 0; i < 10; i++) {
    x += DX[dir]; y += DY[dir];
    if (x <= 0 || y <= 0 || x >= f.w - 1 || y >= f.h - 1) break;
    const t = f.tiles[at(f, x, y)];
    if (t === T_HARD) break;
    if (t === T_WALL) { f.tiles[at(f, x, y)] = T_FLOOR; dug++; }
  }
  ev(ctx, { k: 'beam', fx: p.x, fy: p.y, tx: x, ty: y, color: '#d8b070' });
  ev(ctx, { k: 'se', name: 'dig' });
  log(ctx, dug ? `壁を${dug}マスくり抜いた！` : '魔法弾は何もくり抜かなかった。', dug ? 'good' : undefined);
}

// ── 投げる・撃つ ──

/** 投げた物が敵に当たった時 */
function thrownHits(ctx: Ctx, item: Item, m: Monster): boolean {
  const run = ctx.run;
  const def = itemDef(item.id);
  const name = monName(m);
  switch (def.cat) {
    case 'weapon':
    case 'armor': {
      const dmg = Math.max(1, (def.power ?? 1) + (item.plus ?? 0));
      log(ctx, `${itemName(run, item)}が${name}に当たった。`);
      hurtMonster(ctx, m, dmg, 'player');
      return false;
    }
    case 'arrow': {
      const dmg = Math.max(1, Math.round(((def.dmg ?? 3) + run.player.lv * 0.3) * (0.9 + next(ctx.r) * 0.2) * (20 / (20 + monDefense(m) * 0.6))));
      log(ctx, `${name}に${dmg}の打撃。`);
      hurtMonster(ctx, m, dmg, 'player');
      return true;
    }
    case 'grass':
      makeKnownType(ctx, item.id);
      grassOnMonster(ctx, item.id, m);
      return true;
    case 'staff':
      makeKnownType(ctx, item.id);
      log(ctx, `${itemName(run, item)}が${name}に当たった。`);
      if (item.id === 't_kussaku') hurtMonster(ctx, m, 1, 'player');
      else staffEffect(ctx, item.id, m, run.player.dir);
      return true;
    case 'pot':
      breakPot(ctx, item, m);
      return true;
    default:
      log(ctx, `${itemName(run, item)}が${name}に当たった。`);
      hurtMonster(ctx, m, 1, 'player');
      return true;
  }
}

function grassOnMonster(ctx: Ctx, id: string, m: Monster) {
  const name = monName(m);
  const undead = monDef(m.id).tag === 'undead';
  switch (id) {
    case 'g_yakusou':
    case 'g_daiyakusou':
      if (undead) { log(ctx, `${name}は苦しんでいる！`); hurtMonster(ctx, m, id === 'g_yakusou' ? 25 : 100, 'player'); }
      else { m.hp = Math.min(m.maxHp, m.hp + (id === 'g_yakusou' ? 25 : 100)); log(ctx, `${name}は回復した。`); }
      break;
    case 'g_doku': m.st.weak = true; log(ctx, `${name}の攻撃力が下がった。`); hurtMonster(ctx, m, 5, 'player'); break;
    case 'g_konran': m.st.confuse = 20; log(ctx, `${name}は混乱した。`); break;
    case 'g_suimin': m.st.sleep = m.gen ? 5 : 15; log(ctx, `${name}は眠った。`); break;
    case 'g_baisoku': m.st.fast = 999; m.st.slow = 0; log(ctx, `${name}は倍速になった！`, 'warn'); break;
    case 'g_kaen': log(ctx, `${name}が燃え上がった！`); hurtMonster(ctx, m, 30, 'player'); break;
    case 'g_ten': monsterLevelUp(ctx, m); break;
    case 'g_inochi': m.maxHp += 5; m.hp += 5; log(ctx, `${name}は元気になった。`); break;
    default: log(ctx, `${name}に草が当たった。`); hurtMonster(ctx, m, 1, 'player');
  }
}

/** 壺が割れる：中身が散らばる。底抜けの壺なら落とし穴ができる */
function breakPot(ctx: Ctx, pot: Item, at2: { x: number; y: number }) {
  const run = ctx.run;
  log(ctx, `${itemName(run, pot)}は割れた。`);
  ev(ctx, { k: 'se', name: 'break' });
  if (pot.id === 'p_soko') {
    makeKnownType(ctx, pot.id);
    if (!run.floor.traps.some((t) => t.x === at2.x && t.y === at2.y) && run.floor.tiles[at(run.floor, at2.x, at2.y)] === T_FLOOR && run.floor.kind !== 'boss') {
      run.floor.traps.push({ x: at2.x, y: at2.y, id: 'pit', found: true });
      log(ctx, '落とし穴ができた！');
    }
  }
  for (const inner of pot.contents ?? []) dropNear(ctx, inner, at2);
}

export function throwItem(ctx: Ctx, item: Item): Took {
  const run = ctx.run;
  if (isEquipped(run, item) && item.cursed) {
    log(ctx, '呪われていて手放せない！', 'bad');
    return 'free';
  }
  if (item.shop) {
    log(ctx, '商人「お代を払ってから投げてくだされ」');
    return 'free';
  }
  takeOut(ctx, item);
  return fly(ctx, item, false);
}

/** 投げる・撃つの共通 */
function fly(ctx: Ctx, item: Item, shot: boolean): Took {
  const run = ctx.run;
  const p = run.player;
  const def = itemDef(item.id);
  const pierce = charmIs(run, 'c_ento') || (shot && item.id === 'r_gin');
  const tr = trace(ctx, p, p.dir, pierce ? 16 : 10, { pierce });
  ev(ctx, { k: 'proj', fx: p.x, fy: p.y, tx: tr.hits.length && !pierce ? tr.hits[0].x : tr.end.x, ty: tr.hits.length && !pierce ? tr.hits[0].y : tr.end.y, sprite: def.cat });
  ev(ctx, { k: 'se', name: shot ? 'arrow' : 'throw' });
  let consumed = false;
  let landed = tr.end;
  for (const m of tr.hits) {
    if (!chance(ctx.r, 0.9)) {
      log(ctx, `${itemName(run, item)}は${monName(m)}に当たらなかった。`);
      continue;
    }
    const vanish = thrownHits(ctx, item, m);
    landed = { x: m.x, y: m.y };
    if (vanish && !(shot && item.id === 'r_gin')) { consumed = true; break; }
    if (!vanish) { landed = { x: m.x, y: m.y }; break; }
  }
  if (!consumed) {
    if (def.cat === 'pot') breakPot(ctx, item, landed);
    else dropNear(ctx, item, landed);
  }
  return 'turn';
}

export function shootArrow(ctx: Ctx): Took {
  const run = ctx.run;
  const arrows = equipped(run, 'arrow');
  if (!arrows) { log(ctx, '矢を装備していない。'); return 'free'; }
  if (arrows.shop) { log(ctx, '商人「お代を払ってから使ってくだされ」'); return 'free'; }
  const one: Item = { uid: newUid(run), id: arrows.id, count: 1 };
  arrows.count = (arrows.count ?? 1) - 1;
  if ((arrows.count ?? 0) <= 0) takeOut(ctx, arrows);
  return fly(ctx, one, true);
}

// ── 装備 ──

export function equipItem(ctx: Ctx, item: Item): Took {
  const run = ctx.run;
  const def = itemDef(item.id);
  const slot = def.cat === 'weapon' ? 'weapon' : def.cat === 'armor' ? 'armor' : def.cat === 'charm' ? 'charm' : def.cat === 'arrow' ? 'arrow' : null;
  if (!slot) { log(ctx, 'それは装備できない。'); return 'free'; }
  const current = equipped(run, slot);
  if (current && current.uid === item.uid) return unequipItem(ctx, item);
  if (current && current.cursed && slot !== 'arrow') {
    log(ctx, `${itemName(run, current)}は呪われていて外せない！`, 'bad');
    return 'free';
  }
  run.player.eq[slot] = item.uid;
  if (slot !== 'arrow') {
    item.known = true;
    if (def.cat === 'charm') run.known[item.id] = true;
  }
  log(ctx, `${itemName(run, item)}を装備した。`);
  ev(ctx, { k: 'se', name: 'equip' });
  if (item.cursed && slot !== 'arrow') log(ctx, 'うっ……呪われている！', 'bad');
  return slot === 'arrow' ? 'free' : 'turn';
}

export function unequipItem(ctx: Ctx, item: Item): Took {
  const run = ctx.run;
  const p = run.player;
  for (const slot of ['weapon', 'armor', 'charm', 'arrow'] as const) {
    if (p.eq[slot] !== item.uid) continue;
    if (item.cursed && slot !== 'arrow') {
      log(ctx, `${itemName(run, item)}は呪われていて外せない！`, 'bad');
      return 'free';
    }
    delete p.eq[slot];
    log(ctx, `${itemName(run, item)}を外した。`);
    return slot === 'arrow' ? 'free' : 'turn';
  }
  return 'free';
}

// ── 壺 ──

export function putInPot(ctx: Ctx, pot: Item, item: Item): Took {
  const run = ctx.run;
  if (pot === item || itemDef(pot.id).cat !== 'pot') return 'free';
  if (isEquipped(run, item) && item.cursed) { log(ctx, '呪われていて手放せない！', 'bad'); return 'free'; }
  const contents = (pot.contents ??= []);
  if (contents.length >= (pot.cap ?? 0)) { log(ctx, `${itemName(run, pot)}はもういっぱいだ。`); pot.known = true; return 'free'; }
  takeOut(ctx, item);
  const potName = itemName(run, pot);
  const itemNameText = itemName(run, item);
  makeKnownType(ctx, pot.id);
  switch (pot.id) {
    case 'p_hozon': contents.push(item); log(ctx, `${itemNameText}を${potName}に入れた。`); break;
    case 'p_shikibetsu':
      contents.push(item);
      run.known[item.id] = true;
      item.known = true;
      log(ctx, `${itemNameText}を入れた。${itemName(run, item)}だった！`, 'item');
      break;
    case 'p_kitae':
      contents.push(item);
      if (item.plus !== undefined) { item.plus += 1; log(ctx, `${itemNameText}を入れた。鍛えられた！`, 'good'); }
      else log(ctx, `${itemNameText}を入れた。`);
      break;
    case 'p_henka': {
      const danger = runDanger(run);
      const changed = makeItem(ctx.r, randomItemDef(ctx.r, danger), newUid(run), danger);
      changed.shop = item.shop;
      contents.push(changed);
      log(ctx, `${itemNameText}を入れた。壺の中で何かに変わった……`);
      break;
    }
    case 'p_kankin': {
      const gold = sellPrice(item);
      run.player.gold += gold;
      log(ctx, `${itemNameText}は${gold}文に変わった。`, 'good');
      // 換金の壺は品物が残らないので容量だけ減る
      pot.cap = Math.max(0, (pot.cap ?? 0) - 1);
      break;
    }
    case 'p_soko':
      log(ctx, `${itemNameText}は壺の底から消えてしまった！`, 'bad');
      pot.cap = Math.max(0, (pot.cap ?? 0) - 1);
      break;
    case 'p_gousei': synthesize(ctx, pot, item); break;
    default: contents.push(item);
  }
  return 'turn';
}

/** 合成：同じ種類の武器どうし・防具どうしは1つになり、強化値と印が移る */
function synthesize(ctx: Ctx, pot: Item, item: Item) {
  const run = ctx.run;
  const contents = pot.contents!;
  const def = itemDef(item.id);
  const base = contents.find((c) => itemDef(c.id).cat === def.cat && (def.cat === 'weapon' || def.cat === 'armor' || (def.cat === 'staff' && c.id === item.id)));
  if (!base) {
    contents.push(item);
    log(ctx, `${itemName(run, item)}を合成の壺に入れた。`);
    return;
  }
  if (def.cat === 'staff') {
    base.charges = (base.charges ?? 0) + (item.charges ?? 0);
    log(ctx, '杖の回数が合わさった！', 'good');
    run.stats.synth += 1;
    return;
  }
  base.plus = (base.plus ?? 0) + (item.plus ?? 0);
  const seals = base.seals ?? (base.seals = []);
  const existing = sealsOf(base);
  let added = 0;
  for (const s of sealsOf(item)) {
    if (existing.length + added >= sealSlots(base)) break;
    if (!existing.includes(s) && !seals.includes(s)) { seals.push(s); added++; }
  }
  base.known = base.known && item.known;
  run.stats.synth += 1;
  log(ctx, `${itemName(run, base, { plain: true })}と${itemName(run, item, { plain: true })}が合成された！${added ? `（印が${added}つ移った）` : ''}`, 'good');
  ev(ctx, { k: 'flash', color: '#ffe9a0' });
}

export function takeFromPot(ctx: Ctx, pot: Item, inner: Item): Took {
  const run = ctx.run;
  if (pot.id !== 'p_hozon' || !run.known[pot.id]) { log(ctx, 'この壺からは取り出せない。'); return 'free'; }
  const contents = pot.contents ?? [];
  const i = contents.indexOf(inner);
  if (i < 0) return 'free';
  if (run.player.inv.length >= MAX_INV) { log(ctx, '持ち物がいっぱいだ。'); return 'free'; }
  contents.splice(i, 1);
  run.player.inv.push(inner);
  log(ctx, `${itemName(run, inner)}を取り出した。`);
  return 'turn';
}

// ── 置く・拾う ──

export function dropItem(ctx: Ctx, item: Item): Took {
  const run = ctx.run;
  const p = run.player;
  if (isEquipped(run, item) && item.cursed) { log(ctx, '呪われていて手放せない！', 'bad'); return 'free'; }
  if (run.floor.items.some((fi) => fi.x === p.x && fi.y === p.y)) { log(ctx, 'ここには置けない。'); return 'free'; }
  if (run.floor.stairs && run.floor.stairs.x === p.x && run.floor.stairs.y === p.y) { log(ctx, '階段の上には置けない。'); return 'free'; }
  if (run.floor.traps.some((t) => t.x === p.x && t.y === p.y && t.found)) { log(ctx, '罠の上には置けない。'); return 'free'; }
  takeOut(ctx, item);
  run.floor.items.push({ item, x: p.x, y: p.y });
  log(ctx, `${itemName(run, item)}を足元に置いた。`);
  // 店の中で自分の物を置くと売れる
  const room = roomAt(run.floor, p.x, p.y);
  if (room && room.kind === 'shop' && !item.shop && keeperCalm(ctx)) {
    run.prompt = { kind: 'sell', amount: sellPrice(item), itemUid: item.uid };
    log(ctx, `商人「${itemName(run, item)}なら${sellPrice(item)}文で買い取りましょう」`, 'info');
  }
  return 'turn';
}

export function keeperCalm(ctx: Ctx): boolean {
  return ctx.run.monsters.some((m) => m.role === 'keeper' && !m.dead && !m.angry);
}

/** 足元の道具を拾う */
export function pickUp(ctx: Ctx, quietIfNone = false): boolean {
  const run = ctx.run;
  const p = run.player;
  const fi = run.floor.items.find((x) => x.x === p.x && x.y === p.y);
  if (!fi) {
    if (!quietIfNone) log(ctx, '足元には何もない。');
    return false;
  }
  if (fi.item.id === 's_seiiki' && !fi.item.shop && quietIfNone) {
    // 聖域の巻物は歩いただけでは拾わない
    return false;
  }
  if (fi.item.shop && quietIfNone) {
    // 店の品は「拾う」を押した時だけ
    log(ctx, `${itemName(run, fi.item)}がある。（${buyPrice(fi.item)}文・「拾う」で手に取る）`, 'info');
    return false;
  }
  const name = itemName(run, fi.item);
  if (!addToInv(ctx, fi.item)) {
    log(ctx, `${name}の上に乗った。（持ち物がいっぱい）`);
    return false;
  }
  run.floor.items.splice(run.floor.items.indexOf(fi), 1);
  ev(ctx, { k: 'se', name: fi.item.id === 'gold' ? 'coin' : 'pickup' });
  if (fi.item.shop) log(ctx, `${name}を拾った。（商人「${buyPrice(fi.item)}文になります」）`, 'item');
  else log(ctx, `${name}を拾った。`, 'item');
  return true;
}

export function swapFoot(ctx: Ctx, item: Item): Took {
  const run = ctx.run;
  const p = run.player;
  const fi = run.floor.items.find((x) => x.x === p.x && x.y === p.y);
  if (!fi) return dropItem(ctx, item);
  if (isEquipped(run, item) && item.cursed) { log(ctx, '呪われていて手放せない！', 'bad'); return 'free'; }
  const room = roomAt(run.floor, p.x, p.y);
  if (room?.kind === 'shop' && !item.shop) { log(ctx, '店の中では交換できない。置いてから拾ってくだされ。'); return 'free'; }
  takeOut(ctx, item);
  run.floor.items.splice(run.floor.items.indexOf(fi), 1);
  run.player.inv.push(fi.item);
  run.floor.items.push({ item, x: p.x, y: p.y });
  log(ctx, `${itemName(run, item)}と${itemName(run, fi.item)}を交換した。`);
  return 'turn';
}

// ── 罠 ──

export function triggerTrap(ctx: Ctx, trapIndex: number) {
  const run = ctx.run;
  const p = run.player;
  const trap = run.floor.traps[trapIndex];
  if (!trap) return;
  const wasFound = trap.found;
  trap.found = true;
  ev(ctx, { k: 'se', name: 'trap' });
  const name = TRAP_NAMES[trap.id] ?? '罠';
  log(ctx, wasFound ? `${name}を踏んだ。` : `${name}だ！`, 'warn');
  switch (trap.id) {
    case 'pit':
      if (run.floor.kind === 'boss' || run.floor.kind === 'field') { log(ctx, '……しかし何も起こらなかった。'); break; }
      log(ctx, '落とし穴に落ちた！ 抜け道を這い出ると次の階だった。', 'bad');
      hurtPlayer(ctx, 5, '落とし穴');
      if (!run.end) run.pendingFall = true;
      break;
    case 'mine': {
      ev(ctx, { k: 'boom', x: p.x, y: p.y, r: 1 });
      ev(ctx, { k: 'se', name: 'boom' });
      run.floor.items = run.floor.items.filter((fi) => cheb(fi, p) > 1 || fi.item.shop);
      for (const m of run.monsters) if (!m.dead && cheb(m, p) <= 1) hurtMonster(ctx, m, 60, 'other');
      hurtPlayer(ctx, Math.max(1, Math.floor(p.hp / 2)), '地雷');
      run.floor.traps.splice(run.floor.traps.indexOf(trap), 1);
      break;
    }
    case 'poison': hurtPlayer(ctx, range(ctx.r, 3, 6), '毒矢'); if (!run.end) weakenStr(ctx, 1); break;
    case 'arrow': hurtPlayer(ctx, range(ctx.r, 5, 10), '矢の罠'); break;
    case 'sleep': sleepPlayer(ctx, range(ctx.r, 4, 7)); break;
    case 'rust': rustEquipment(ctx); break;
    case 'hunger': p.hunger = Math.max(0, p.hunger - 10); log(ctx, 'お腹が減った……', 'bad'); break;
    case 'summon': {
      const danger = runDanger(run);
      let n = 0;
      for (let i = 0; i < range(ctx.r, 3, 5); i++) {
        const id = randomMonsterId(ctx.r, danger, run.banned, run.faction);
        if (spawnNear(ctx, id, p, 1, 2)) n++;
      }
      log(ctx, n ? '敵が現れた！' : '……何も起こらなかった。', n ? 'bad' : undefined);
      break;
    }
    case 'warp': teleportPlayer(ctx); log(ctx, 'どこかへ飛ばされた。'); break;
    case 'spin': confusePlayer(ctx, 10); break;
    case 'gust': knockback(ctx, 'player', int(ctx.r, 8) as Dir, 6); break;
    case 'slow': p.st.slow = Math.max(p.st.slow ?? 0, 20); p.st.fast = 0; log(ctx, '足が遅くなった……', 'bad'); break;
    case 'bear': p.st.stuck = 8; log(ctx, '足を挟まれて動けない！', 'bad'); break;
    case 'curse': {
      const candidates = p.inv.filter((i) => !i.cursed && !i.shop);
      if (!candidates.length) { log(ctx, '……何も起こらなかった。'); break; }
      const item = pick(ctx.r, candidates);
      item.cursed = true;
      log(ctx, `${itemName(run, item)}が呪われてしまった！`, 'bad');
      break;
    }
    default:
  }
}

const TRAP_NAMES = Object.fromEntries(Object.values(TRAP_BY_ID).map((t) => [t.id, t.name]));
