// 冒険（城攻め・合戦・修行）の始まりと階の移動
import { FAKE_NAMES, ITEMS, UNID_CATS } from '../content/items';
import { BANDS, BAND_FIELD, BAND_KEEP, BAND_NEST } from '../content/world';
import { regionDef, type FactionId } from '../content/sengoku';
import { hashSeed, pick, range, shuffle } from './rng';
import { generateFloor } from './mapgen';
import { canStand, updateSight, vacant } from './geo';
import { ev, log, newUid, type Ctx } from './core';
import { createMonster, makeThief, onEnterRoom } from './actors';
import { spawnGeneral } from './generals';
import { type GenSpec, type Item, type Monster, type Run, type RunMode } from './types';

export const RUN_VERSION = 3;

/** 朔の、冒険をまたいで残る強さ */
export interface LordState { lv: number; exp: number; maxHp: number; str: number; maxStr: number; maxHunger: number }

/** 冒険の作り方（本陣から渡す） */
export interface BattleSpec {
  mode: RunMode;
  seed: number;
  region: string;
  faction: FactionId;
  danger0: number;
  floors: number;
  startFloor?: number;
  lord: LordState;
  /** 持っていく道具（装備も含む） */
  items: Item[];
  /** 装備している道具の uid */
  eq?: { weapon?: number; armor?: number; charm?: number; arrow?: number };
  known?: Record<string, true>;
  fake?: Record<string, string>;
  named?: Record<string, string>;
  /** 味方（連れていく武将）と敵の将 */
  gens: GenSpec[];
  band0?: number;
  /** 朔の技 */
  lordSkills?: string[];
  /** 経験値の倍率 */
  expRate?: number;
}

/** 階 → 強さの基準 */
export function runDanger(run: Run, no = run.floorNo): number {
  return Math.max(1, Math.round(run.danger0 + (no - 1) * 0.8));
}

/** 最上階（天守）か */
export function isKeepFloor(run: Run, no = run.floorNo): boolean {
  return run.mode === 'siege' && no === run.lastFloor;
}

/** 中の階の将がいる階 */
export function midFloorNo(run: Run): number {
  return Math.max(1, Math.ceil(run.lastFloor / 2));
}

export function bandFor(run: Run, no: number): number {
  if (run.mode === 'defense') return BAND_FIELD;
  if (run.mode === 'hunt') return BAND_NEST;
  if (isKeepFloor(run, no)) return BAND_KEEP;
  return run.band0;
}

/** 仮の名前（戦ごとに同じ。本陣が持っていればそれを使う） */
export function makeFakeNames(seed: number): Record<string, string> {
  const fake: Record<string, string> = {};
  const nameRng = { s: hashSeed(seed, 'names') };
  for (const cat of UNID_CATS) {
    const names = shuffle(nameRng, [...FAKE_NAMES[cat]]);
    ITEMS.filter((d) => d.cat === cat).forEach((d, i) => { fake[d.id] = names[i % names.length]; });
  }
  return fake;
}

export function createRun(o: BattleSpec): Run {
  const run: Run = {
    v: RUN_VERSION,
    mode: o.mode,
    seed: o.seed | 0,
    rng: hashSeed(o.seed, 'play', o.mode, o.region),
    turn: 0,
    floorNo: 0,
    lastFloor: Math.max(1, o.floors),
    player: {
      x: 0, y: 0, dir: 4, hp: o.lord.maxHp, maxHp: o.lord.maxHp, lv: o.lord.lv, exp: o.lord.exp, str: o.lord.str, maxStr: o.lord.maxStr,
      hunger: o.lord.maxHunger, maxHunger: o.lord.maxHunger, gold: 0, inv: [], eq: {}, st: {}, regen: 0, hungerAcc: 0,
    },
    floor: null as unknown as Run['floor'],
    monsters: [],
    nextUid: 1,
    log: [],
    known: { ...(o.known ?? {}) },
    fake: o.fake && Object.keys(o.fake).length ? { ...o.fake } : makeFakeNames(o.seed),
    named: { ...(o.named ?? {}) },
    stats: { kills: 0, turns: 0, maxFloor: 1, itemsUsed: 0, synth: 0, stolen: 0, allies: 0, killedIds: {}, seenIds: {} },
    end: null,
    thief: false,
    spawnIn: 40,
    prompt: null,
    region: o.region,
    faction: o.faction,
    danger0: o.danger0,
    startFloor: Math.max(1, Math.min(o.floors, o.startFloor ?? 1)),
    band0: o.band0 ?? 0,
    gens: {},
    party: [],
    fallen: [],
    captured: [],
    scd: {},
    lordSkills: [...(o.lordSkills ?? ['issen'])],
    expRate: o.expRate ?? 1,
  };
  for (const g of o.gens) {
    run.gens[g.id] = { ...g, skills: [...g.skills] };
    if (g.ally) run.party.push(g.id);
    if (g.role === 'boss' || g.role === 'commander') run.bossGen = g.id;
    if (g.role === 'mid') run.midGen = g.id;
  }
  // 持ち物：uid を振り直し、装備をつなぎ直す
  const p = run.player;
  const remap = new Map<number, number>();
  for (const src of o.items) {
    const copy = JSON.parse(JSON.stringify(src)) as Item;
    copy.uid = run.nextUid++;
    remap.set(src.uid, copy.uid);
    for (const inner of copy.contents ?? []) inner.uid = run.nextUid++;
    delete copy.shop;
    p.inv.push(copy);
  }
  for (const slot of ['weapon', 'armor', 'charm', 'arrow'] as const) {
    const uid = o.eq?.[slot];
    if (uid !== undefined && remap.has(uid)) p.eq[slot] = remap.get(uid)!;
  }
  const ctx: Ctx = { run, ev: [], r: { s: run.rng }, fields: new Map() };
  enterFloor(ctx, run.startFloor, []);
  // 部隊の武将を朔の周りに置く
  const allies: Monster[] = run.party.map((id) => spawnGeneral(ctx, run.gens[id], -1, -1));
  run.monsters = run.monsters.filter((m) => !allies.includes(m));
  placeAllies(ctx, allies);
  updateSight(run);
  run.rng = ctx.r.s;
  return run;
}

function placeAllies(ctx: Ctx, allies: Monster[]) {
  const run = ctx.run;
  for (const ally of allies) {
    const f = run.floor;
    const spots: { x: number; y: number; d: number }[] = [];
    for (let y = 1; y < f.h - 1; y++) {
      for (let x = 1; x < f.w - 1; x++) {
        if (!canStand(f, x, y, 'walk') || !vacant(run, x, y) || f.roomOf[y * f.w + x] < 0 && Math.max(Math.abs(x - run.player.x), Math.abs(y - run.player.y)) > 1) continue;
        spots.push({ x, y, d: Math.max(Math.abs(x - run.player.x), Math.abs(y - run.player.y)) * 10 + Math.abs(x - run.player.x) + Math.abs(y - run.player.y) });
      }
    }
    spots.sort((a, b) => a.d - b.d);
    const spot = spots[0];
    if (spot) {
      ally.x = spot.x; ally.y = spot.y; ally.goal = null; ally.wander = null;
      run.monsters.push(ally);
    }
  }
}

/** 階に入る。仲間は隣に連れていく */
export function enterFloor(ctx: Ctx, no: number, allies: Monster[]) {
  const run = ctx.run;
  run.floorNo = no;
  run.stats.maxFloor = Math.max(run.stats.maxFloor, no);
  const band = bandFor(run, no);
  const danger = runDanger(run, no);
  const keep = isKeepFloor(run, no);
  const genRng = { s: hashSeed(run.seed, run.mode, run.region, 'floor', no) };
  // 将の配置：最上階に城主（中の階の将が残っていれば一緒に）、中の階に2人目
  const bossHere = keep || run.mode === 'defense' ? run.bossGen : undefined;
  let midHere: string | undefined;
  if (run.midGen && !run.captured.includes(run.midGen)) {
    if (keep && (run.midPending || run.startFloor > midFloorNo(run))) midHere = run.midGen;
    else if (!keep && no === midFloorNo(run)) midHere = run.midGen;
  }
  const gen = generateFloor(genRng, {
    mode: run.mode, no, danger, band, liquid: BANDS[band].liquid, boss: keep, field: run.mode === 'defense',
    faction: run.faction, banned: run.banned ?? {}, newUid: () => newUid(run),
    bossGen: bossHere, midGen: midHere,
  });
  run.floor = gen.floor;
  run.monsters = [];
  run.player.x = gen.start.x;
  run.player.y = gen.start.y;
  run.player.dir = run.mode === 'defense' ? 0 : run.player.dir;
  run.prompt = null;
  if (keep) run.midPending = false;
  for (const s of gen.spawns) {
    if (s.gen) {
      const g = run.gens[s.gen];
      if (!g) continue;
      const m = spawnGeneral(ctx, g, s.x, s.y);
      m.awake = !s.asleep;
      continue;
    }
    const m = createMonster(ctx, s.id, s.x, s.y, !s.asleep, s.role);
    if (s.asleep) m.awake = false;
    if (s.role === 'keeper' && run.floor.shop) run.floor.shop.keeper = m.uid;
    // 化け狸は、寝ている間は道具に化けている
    if (s.asleep && (s.id === 'tanuki2' || s.id === 'tanuki3')) {
      m.disguise = pick(genRng, ['g_yakusou', 'g_daiyakusou', 's_shikibetsu', 'f_onigiri', 'g_chikara']);
      delete run.stats.seenIds[s.id];
    }
  }
  if (midHere && !keep) run.midPending = true;
  placeAllies(ctx, allies);
  run.spawnIn = range(ctx.r, 30, 60);
  updateSight(run);
  onEnterRoom(ctx);
  ev(ctx, { k: 'floor' });
  const name = BANDS[band].name;
  const castle = run.region ? regionDef(run.region).name : '道場';
  if (run.mode === 'defense') log(ctx, `${castle}の野で合戦が始まった！ 敵の大将を討ち取れ！`, 'warn');
  else if (keep) log(ctx, `${castle}城・天守。城主の気配がする……`, 'warn');
  else if (run.mode === 'hunt') log(ctx, `${castle}の妖魔の巣 ${no}階に着いた。`, 'info');
  else if (run.mode === 'practice') log(ctx, `道場 ${no}階。`, 'info');
  else log(ctx, `${castle}城 ${no}階（${name}）に着いた。`, 'info');
  if (midHere && !keep) log(ctx, `この階の階段は、${run.gens[midHere].name}が守っている。`, 'warn');
  if (gen.floor.dark) log(ctx, 'この階は暗闇に包まれている。', 'warn');
  if (gen.floor.fog) log(ctx, 'この階は霧が立ちこめている。', 'warn');
  if (gen.floor.kind === 'big') log(ctx, 'この階は大広間だ！', 'warn');
  if (gen.floor.shop) log(ctx, 'どこかに旅の商人がいる気配がする。', 'info');
  if (run.mode === 'practice') tutorial(ctx, no);
}

function tutorial(ctx: Ctx, no: number) {
  const lines: Record<number, string[]> = {
    1: ['【道場】十字パッドで8方向に動ける。斜めにも動けるのが大事。', '【道場】敵に向かって進むか「攻撃」で叩く。叩くと1ターン進む。', '【道場】階段を見つけたら上に乗って「階段」で進もう。'],
    2: ['【道場】道具は「道具」から使う。草は飲む、巻物は読む、杖は振る。', '【道場】「技」で武将の技を使える。使うとしばらく待ちになる。', '【道場】Bを押しながら動くとダッシュできる。'],
    3: ['【道場】お腹が減るとHPが減っていく。おにぎりを食べよう。', '【道場】正体の分からない道具は、使うか識別すると分かる。', '【道場】階段を上れば稽古は終わり。'],
  };
  for (const t of lines[no] ?? []) log(ctx, t, 'info');
  ctx.run.tutorial = no;
}

/** 次の階へ。最後の階なら勝ち（修行・道場） */
export function descend(ctx: Ctx) {
  const run = ctx.run;
  // 店の品を持ったまま離れたら泥棒
  if (run.player.inv.some((i) => i.shop || (i.contents ?? []).some((c) => c.shop))) makeThief(ctx);
  if (run.floorNo >= run.lastFloor) {
    run.pendingFall = false;
    if (run.mode === 'siege' || run.mode === 'defense') return;
    run.end = { kind: 'clear', cause: run.mode === 'hunt' ? '巣を祓った' : '稽古を終えた', floor: run.floorNo };
    log(ctx, run.mode === 'hunt' ? '妖魔の巣の奥まで祓い清めた！' : '稽古を終えた！', 'good');
    ev(ctx, { k: 'se', name: 'clear' });
    return;
  }
  const allies = run.monsters.filter((m) => m.ally && !m.dead);
  run.pendingFall = false;
  run.half = 0;
  enterFloor(ctx, run.floorNo + 1, allies);
  ev(ctx, { k: 'se', name: 'stairs' });
}
