// テスト用：思いどおりの場面を作る
import { itemDef } from '../src/content/items';
import { createMonster } from '../src/engine/actors';
import { expFor, makeCtx, closeCtx } from '../src/engine/core';
import { createRun, type BattleSpec } from '../src/engine/run';
import { step } from '../src/engine/step';
import { T_FLOOR, T_HARD, T_WALL, type Action, type GenSpec, type Item, type Monster, type Run, type RunMode } from '../src/engine/types';

/** 城攻めの冒険の作り方（朔は Lv1・木刀と木の胴丸・おにぎりと薬草） */
export function testSpec(o: Partial<BattleSpec> = {}): BattleSpec {
  const items: Item[] = [
    { uid: 1, id: 'w_bokuto', plus: 0, seals: [], cursed: false, known: true },
    { uid: 2, id: 'a_mokuyoroi', plus: 0, seals: [], cursed: false, known: true },
    { uid: 3, id: 'f_onigiri' },
    { uid: 4, id: 'g_yakusou' },
  ];
  return {
    mode: 'siege', seed: 1, region: '06', faction: 'shion', danger0: 1, floors: 30,
    lord: { lv: 1, exp: 0, maxHp: 20, str: 8, maxStr: 8, maxHunger: 100 },
    items, eq: { weapon: 1, armor: 2 }, known: { f_onigiri: true, g_yakusou: true }, gens: [], band0: 0,
    ...o,
  };
}

export function siegeRun(seed = 1, o: Partial<BattleSpec> = {}): Run {
  return createRun(testSpec({ seed, ...o }));
}

/** 武将の情報（テスト用） */
export function genSpec(id: string, o: Partial<GenSpec> = {}): GenSpec {
  return {
    id, name: id, short: id, portrait: 'generic_normal', faction: 'shion', lv: 5, exp: expFor(5), cmd: 60, pow: 60, int: 60,
    skills: ['g_gouda'], style: 'melee', ally: true, ...o,
  };
}

/** 何もない大部屋（20×10）にプレイヤーだけを置いた冒険 */
export function arena(seed = 1, mode: RunMode = 'siege', o: Partial<BattleSpec> = {}): Run {
  const run = createRun(testSpec({ seed, mode, ...o }));
  const f = run.floor;
  f.tiles.fill(T_WALL);
  f.roomOf.fill(-1);
  for (let x = 0; x < f.w; x++) { f.tiles[x] = T_HARD; f.tiles[(f.h - 1) * f.w + x] = T_HARD; }
  for (let y = 0; y < f.h; y++) { f.tiles[y * f.w] = T_HARD; f.tiles[y * f.w + f.w - 1] = T_HARD; }
  const room = { id: 0, x: 5, y: 5, w: 20, h: 10, kind: 'normal' as const, lit: true };
  for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) { f.tiles[y * f.w + x] = T_FLOOR; f.roomOf[y * f.w + x] = 0; }
  f.rooms = [room];
  f.items = [];
  f.traps = [];
  f.shop = null;
  f.house = -1;
  f.stairs = { x: 24, y: 14 };
  f.dark = false;
  f.fog = false;
  f.kind = 'normal';
  const allies = run.monsters.filter((m) => m.ally);
  run.monsters = [];
  run.player.x = 10;
  run.player.y = 10;
  run.player.dir = 2;
  // 部隊の武将は朔の後ろに並べる
  allies.forEach((m, i) => { m.x = 8 - i; m.y = 10; run.monsters.push(m); });
  run.spawnIn = 99999;
  run.log = [];
  return run;
}

export function give(run: Run, id: string, extra: Partial<Item> = {}): Item {
  const def = itemDef(id);
  const item: Item = { uid: run.nextUid++, id, ...extra };
  if (def.cat === 'weapon' || def.cat === 'armor') { item.plus ??= 0; item.seals ??= []; item.cursed ??= false; }
  if (def.cat === 'staff' && item.charges === undefined) item.charges = 5;
  if (def.cat === 'pot' && item.cap === undefined) { item.cap = 4; item.contents = []; }
  if (def.cat === 'arrow' && item.count === undefined) item.count = 10;
  run.player.inv.push(item);
  return item;
}

export function spawn(run: Run, id: string, x: number, y: number, awake = true): Monster {
  const ctx = makeCtx(run);
  const m = createMonster(ctx, id, x, y, awake);
  closeCtx(ctx);
  return m;
}

export function act(run: Run, a: Action) {
  return step(run, a);
}

export function logText(run: Run): string {
  return run.log.map((l) => l.t).join('\n');
}

/** 敵の行動を止める（行動を1つ確かめたい時） */
export function freeze(m: Monster) {
  m.st.paralyze = 999;
}

export function serializeRun(run: Run): string {
  return JSON.stringify(run);
}
