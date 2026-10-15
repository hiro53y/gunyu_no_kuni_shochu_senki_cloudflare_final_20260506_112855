// 合戦の進行：遅れと硬直の手番・時間の目盛り・射程・打撃と反撃・ガードとかばい・準備・付与・戦果・勝敗。乱数は seed 付きで決定的
// 打撃の式（部隊合戦の定番）：[補正した兵数 ×（攻撃力 − 防御力）÷ 10] × 技の倍率 × 補正
import { chance, hashSeed, int, next as rnd, pick, type Rng } from '../engine/rng';
import { KINDS, battleSkill } from './kinds';
import type { Action, BEvent, Battle, BattleKind, Buffs, Ground, Side, SkillDef, Trait, Unit } from './types';

export const BATTLE_VERSION = 2;
/** 時間の目盛り（1行動で1減る） */
export const DEFAULT_TICKS = 24;
/** 守る側の初めの戦果の上乗せ */
export const GROUND_GAUGE: Record<Ground, number> = { field: 10, town: 20, castle: 40 };
/** 守る側の打撃の上乗せ（戦場補正） */
export const GROUND_FIELD: Record<Ground, number> = { field: 0, town: 0.1, castle: 0.2 };
export const GROUND_NAME: Record<Ground, string> = { field: '野戦', town: '町', castle: '城' };
/** 待機の硬直 */
export const WAIT_STIFF = 25;
/** 前衛の列からしか攻撃できない兵種（近・貫通・全体） */
const FRONT_ONLY = new Set(['ashigaru', 'bushi', 'teppo', 'sohei', 'youkai']);

/** 合戦に出る部隊の作り方 */
export interface UnitSpec {
  gen: string;
  name: string;
  short: string;
  portrait: string;
  kind: Unit['kind'];
  lv: number;
  atk: number;
  def: number;
  int: number;
  spd: number;
  troops: number;
  maxTroops: number;
  row: 0 | 1;
  slot: 0 | 1 | 2;
  skills: string[];
  lord?: boolean;
  boss?: boolean;
  youkai?: boolean;
  /** 技数の上乗せ（レベルなど） */
  apBonus?: number;
  traits?: Trait[];
}

export interface BattleSpec {
  seed: number;
  kind: BattleKind;
  ground?: Ground;
  region: string;
  ticks?: number;
  defender: Side;
  /** 戦の準備などで上乗せする戦場補正 */
  bonus?: { L?: number; R?: number };
  L: UnitSpec[];
  R: UnitSpec[];
}

export const other = (s: Side): Side => (s === 'L' ? 'R' : 'L');
const ZERO: Buffs = { atk: 0, def: 0, int: 0, spd: 0 };

interface Ctx { b: Battle; r: Rng; ev: BEvent[] }

function ctxOf(b: Battle): Ctx {
  return { b, r: { s: b.rng }, ev: [] };
}

function close(ctx: Ctx): BEvent[] {
  ctx.b.rng = ctx.r.s;
  return ctx.ev;
}

function log(ctx: Ctx, t: string) {
  ctx.b.log.push(t);
  if (ctx.b.log.length > 150) ctx.b.log.splice(0, ctx.b.log.length - 150);
}

const STAT_NAME = { atk: '攻', def: '防', int: '知', spd: '速' } as const;

// ── 手番の遅れ ──

/** 速さの補正：速0で+8、速1ごとに−2。速付与があれば−4 */
export function speedMod(u: Unit): number {
  return 8 - 2 * u.spd - (u.buffs.spd > 0 ? 4 : 0);
}

/** 行動のあと、次の手番までの遅れ */
export function delayAfter(u: Unit, stiff: number): number {
  return Math.max(2, KINDS[u.kind].delay + speedMod(u) + stiff);
}

function hasTrait(u: Unit, t: Trait): boolean {
  return !!u.traits?.includes(t);
}

export function createBattle(spec: BattleSpec): Battle {
  const ground: Ground = spec.ground ?? 'field';
  const b: Battle = {
    v: BATTLE_VERSION, seed: spec.seed | 0, rng: hashSeed(spec.seed, 'battle', spec.region), kind: spec.kind, ground, region: spec.region,
    time: 0, ticks: spec.ticks ?? DEFAULT_TICKS, ticksMax: spec.ticks ?? DEFAULT_TICKS, units: [],
    dmg: { L: 0, R: 0 }, adj: { L: 0, R: 0 }, field: { L: 0, R: 0 },
    active: null, log: [], end: null, defender: spec.defender, turns: 0,
  };
  const ctx = ctxOf(b);
  b.adj[spec.defender] += GROUND_GAUGE[ground];
  b.field[spec.defender] += GROUND_FIELD[ground];
  b.field.L += spec.bonus?.L ?? 0;
  b.field.R += spec.bonus?.R ?? 0;
  let uid = 1;
  for (const side of ['L', 'R'] as Side[]) {
    for (const s of side === 'L' ? spec.L : spec.R) {
      const kd = KINDS[s.kind];
      const troops = Math.max(1, Math.round(Math.min(s.troops, s.maxTroops)));
      const ap = Math.max(1, kd.ap + (s.apBonus ?? 0));
      const u: Unit = {
        uid: uid++, side, gen: s.gen, name: s.name, short: s.short, portrait: s.portrait, kind: s.kind, lv: s.lv,
        atk: s.atk, def: s.def, int: s.int, spd: s.spd, troops, maxTroops: Math.max(troops, Math.round(s.maxTroops)), startTroops: troops,
        ap, apMax: ap, row: s.row, slot: s.slot, skills: [...s.skills], next: 0,
        guard: s.kind === 'ashigaru' ? (s.traits?.includes('guardPlus') ? 1.2 : 0.5) : 0, guarding: s.kind === 'ashigaru',
        buffs: { ...ZERO }, barrier: false, prep: null, out: false, lord: s.lord, boss: s.boss, youkai: s.youkai, dealt: 0, kills: 0,
        traits: s.traits?.length ? [...s.traits] : undefined,
      };
      b.units.push(u);
    }
  }
  // 運の技能（2/3で付与50%）
  for (const u of b.units) {
    if (hasTrait(u, 'luckAtk') && chance(ctx.r, 2 / 3)) u.buffs.atk = Math.max(u.buffs.atk, 0.5);
    if (hasTrait(u, 'luckDef') && chance(ctx.r, 2 / 3)) u.buffs.def = Math.max(u.buffs.def, 0.5);
    if (hasTrait(u, 'luckSpd') && chance(ctx.r, 2 / 3)) u.buffs.spd = Math.max(u.buffs.spd, 0.5);
    if (hasTrait(u, 'initGauge')) b.adj[u.side] += 10;
    if (hasTrait(u, 'initTime')) b.ticks = Math.max(4, b.ticks - 5);
  }
  // 軍師：合戦の初めに、知の数だけ付与を配る（効果は知×5%）
  for (const u of b.units) {
    if (u.kind !== 'gunshi') continue;
    const n = Math.max(1, Math.round(u.int));
    spreadBuffs(ctx, u, n, false);
    log(ctx, `${u.name}隊の采配で、味方に付与が${n}つ配られた。`);
  }
  // 最初の手番：兵種の遅れ＋速さ＋乱数1〜4、たいてい+10（陰陽は+4、先手必勝なら無し）
  for (const u of b.units) {
    let d = KINDS[u.kind].delay + speedMod(u) + 1 + int(ctx.r, 4);
    if (!hasTrait(u, 'firstStrike') && chance(ctx.r, 0.92)) d += u.kind === 'onmyo' ? 4 : 10;
    u.next = Math.max(1, d);
  }
  log(ctx, `合戦が始まった！（${GROUND_NAME[ground]}・時間 ${b.ticks}）`);
  advance(ctx);
  close(ctx);
  return b;
}

export function unitById(b: Battle, uid: number): Unit | null {
  return b.units.find((u) => u.uid === uid) ?? null;
}

export function alive(b: Battle, side: Side): Unit[] {
  return b.units.filter((u) => u.side === side && !u.out);
}

/** 前衛の列として扱われるか（自分の側の前衛が全滅していれば後衛も前に出る） */
export function inFront(b: Battle, u: Unit): boolean {
  if (u.row === 0) return true;
  return !alive(b, u.side).some((x) => x.row === 0);
}

function frontTargets(b: Battle, side: Side): Unit[] {
  const list = alive(b, side);
  const front = list.filter((x) => x.row === 0);
  return front.length ? front : list;
}

/** 技が今使えるか（使えない時は理由） */
export function canUse(b: Battle, u: Unit, skillId: string): { ok: boolean; reason?: string } {
  const s = battleSkill(skillId);
  if (u.out) return { ok: false, reason: '壊滅' };
  const cost = s.cost === 'all' ? 1 : s.cost;
  if (u.ap < cost) return { ok: false, reason: '技数が足りない' };
  const attack = s.range === 'near' || s.range === 'pierce' || s.range === 'all';
  if (attack && !s.anyRow && (s.range === 'near' || FRONT_ONLY.has(u.kind)) && !inFront(b, u)) return { ok: false, reason: '前衛の列からしか使えない' };
  const foes = alive(b, other(u.side));
  if ((attack || s.range === 'far') && !foes.length) return { ok: false, reason: '敵がいない' };
  if (s.effect === 'heal' && s.range === 'self' && u.troops >= u.maxTroops) return { ok: false, reason: '兵は満ちている' };
  if (s.effect === 'heal' && s.range !== 'self' && !alive(b, u.side).some((x) => x.troops < x.maxTroops)) return { ok: false, reason: '減った味方がいない' };
  if (s.effect === 'field' && b.field[u.side] >= 0.5) return { ok: false, reason: '戦場補正は最大' };
  return { ok: true };
}

/** 標的を選ぶ技なら、選べる相手 */
export function legalTargets(b: Battle, u: Unit, skillId: string): Unit[] {
  const s = battleSkill(skillId);
  const foe = other(u.side);
  switch (s.range) {
    case 'near': return frontTargets(b, foe);
    case 'far':
    case 'pierce': return alive(b, foe);
    case 'ally': return alive(b, u.side);
    default: return [];
  }
}

export function needsTarget(skillId: string): boolean {
  const r = battleSkill(skillId).range;
  return r === 'near' || r === 'far' || r === 'pierce' || r === 'ally';
}

// ── 戦果 ──

/** 戦果の評価（L から見て。正なら L の勝ち） */
export function rating(b: Battle): number {
  const total = b.dmg.L + b.dmg.R;
  const share = total > 0 ? (100 * (b.dmg.L - b.dmg.R)) / total : 0;
  return share + b.adj.L - b.adj.R;
}

/** 戦果ゲージ（0〜100。50より大きいと左＝味方が優勢） */
export function gauge(b: Battle): number {
  const g = 50 + rating(b) / 2;
  return Math.max(0, Math.min(100, Math.round(g * 10) / 10));
}

/** 時間切れの勝者 */
export function byGauge(b: Battle): Side {
  const r = rating(b);
  return r > 0 ? 'L' : r < 0 ? 'R' : b.defender;
}

// ── 打撃の式 ──

/** 打撃の計算に使う兵数（多い部隊は伸びが鈍る） */
export function effTroops(n: number): number {
  if (n < 100) return 100;
  if (n < 500) return n;
  if (n < 2000) return (n - 500) / 2 + 500;
  return (n - 2000) / 4 + 1250;
}

export function attackPower(u: Unit, magic: boolean): number {
  const k = KINDS[u.kind];
  return magic ? k.mag + u.int * (1 + u.buffs.int) : k.atk + u.atk * (1 + u.buffs.atk);
}

export function defensePower(u: Unit, magic: boolean): number {
  const k = KINDS[u.kind];
  return magic ? u.int * (1 + u.buffs.int) * 0.7 : k.def + u.def * (1 + u.buffs.def) * 0.8;
}

/** 基本の打撃（技の倍率の前）：[補正兵数 ×（攻−防）÷10]。上限は元の兵数、下限は補正兵数の1/10 */
export function baseDamage(a: Unit, t: Unit, magic: boolean): number {
  const eff = effTroops(a.troops);
  const diff = Math.max(1, attackPower(a, magic) - defensePower(t, magic));
  const raw = (eff * diff) / 10;
  return Math.max(eff / 10, Math.min(a.troops, raw));
}

function skillMult(b: Battle, a: Unit, t: Unit, s: SkillDef): number {
  let m = s.mult;
  if (s.vs?.kinds.includes(t.kind) || (s.vs?.kinds.includes('youkai') && t.youkai)) m *= s.vs.mult;
  if (s.winning && rating(b) * (a.side === 'L' ? 1 : -1) > 0) m *= s.winning;
  return m;
}

/** 見込みの打撃（AI と画面の目安。かばいの確率は見ない） */
export function estimate(b: Battle, a: Unit, t: Unit, skillId: string): number {
  const s = battleSkill(skillId);
  if (s.effect === 'ratio') return t.maxTroops * (s.amount ?? 0.1);
  if (s.mult <= 0) return 0;
  let d = baseDamage(a, t, !!s.magic) * skillMult(b, a, t, s) * (1 + Math.min(0.5, b.field[a.side]));
  if (!s.magic && !s.ignoreGuard && t.kind === 'ashigaru' && t.guarding) d *= 0.5;
  const hits = s.effect === 'dmg' && (s.amount ?? 1) > 1 ? s.amount! : 1;
  return Math.min(t.troops, Math.round(d * hits));
}

function down(ctx: Ctx, t: Unit, by: Unit | null) {
  if (t.out) return;
  t.out = true;
  t.troops = 0;
  t.prep = null;
  t.guarding = false;
  if (by) {
    by.kills += 1;
    ctx.b.adj[by.side] += 5;
  }
  ctx.ev.push({ k: 'down', uid: t.uid });
  log(ctx, `${t.name}隊が壊滅した！`);
}

function deal(ctx: Ctx, from: Unit, t: Unit, n: number) {
  t.troops -= n;
  from.dealt += n;
  ctx.b.dmg[from.side] += n;
}

/** 部隊に打撃を与える。かばう足軽・防御式神・反撃を処理し、実際の打撃を返す */
function strike(ctx: Ctx, a: Unit, target: Unit, s: SkillDef, single: boolean): number {
  const b = ctx.b;
  if (target.out || a.out) return 0;
  let t = target;
  let halved = false;
  // 足軽のかばい：1部隊を狙う物理の攻撃だけ
  if (!s.magic && s.effect !== 'ratio') {
    if (single) {
      const guards = alive(b, t.side)
        .filter((g) => g !== t && g.kind === 'ashigaru' && g.guarding && g.guard > 0 && (g.guardAll || g.row === t.row))
        .sort((x, y) => y.guard - x.guard);
      const g = guards[0];
      if (g && rnd(ctx.r) < Math.min(1, g.guard)) t = g;
    }
    if (t.kind === 'ashigaru' && t.guarding) {
      halved = !s.ignoreGuard;
      t.guard = Math.max(0, Math.round((t.guard - 0.4) * 100) / 100);
      if (t.guard <= 0) t.guarding = false;
    }
  }
  // 防御式神：どんな攻撃も一度だけ防ぐ
  if (t.barrier) {
    t.barrier = false;
    ctx.ev.push({ k: 'block', uid: t.uid });
    log(ctx, `${t.name}隊の防御式神が攻撃を防いだ。`);
    return 0;
  }
  let dmg: number;
  if (s.effect === 'ratio') dmg = t.maxTroops * (s.amount ?? 0.1);
  else dmg = baseDamage(a, t, !!s.magic) * skillMult(b, a, t, s) * (1 + Math.min(0.5, b.field[a.side]));
  if (halved) dmg *= 0.5;
  const before = t.troops;
  const n = Math.max(1, Math.min(t.troops, Math.floor(dmg)));
  deal(ctx, a, t, n);
  ctx.ev.push({ k: 'hit', uid: t.uid, from: a.uid, n, guardBy: t !== target ? target.uid : undefined, big: n >= Math.max(150, t.maxTroops * 0.3), magic: !!s.magic });
  if (t !== target) log(ctx, `${t.name}隊が${target.name}隊をかばった！`);
  if (t.troops <= 0) down(ctx, t, a);
  else if (s.effect === 'cancel' && t.prep) {
    t.prep.hits += 1;
    const need = battleSkill(t.prep.skill).prepGuard ?? 1;
    if (t.prep.hits >= need) {
      log(ctx, `${t.name}隊の準備が崩された！`);
      t.prep = null;
      ctx.ev.push({ k: 'cancel', uid: t.uid });
      // 準備が崩れたら、すぐ次の手番に
      t.next = Math.min(t.next, b.time + delayAfter(t, 0));
    }
  }
  // 反撃：受けた側が反撃できる兵種なら、受ける前の兵数で打ち返す
  if (s.counter > 0 && !s.magic && KINDS[t.kind].counter && !t.out && !a.out) {
    if (a.barrier) {
      a.barrier = false;
      ctx.ev.push({ k: 'block', uid: a.uid });
    } else {
      const eff = effTroops(before);
      const diff = Math.max(1, attackPower(t, false) - defensePower(a, false));
      const base = Math.max(eff / 10, Math.min(before, (eff * diff) / 10));
      const c = Math.max(1, Math.min(a.troops, Math.floor(base * s.counter * (hasTrait(t, 'counterUp') ? 2 : 1))));
      deal(ctx, t, a, c);
      ctx.ev.push({ k: 'counter', uid: a.uid, from: t.uid, n: c });
      if (a.troops <= 0) down(ctx, a, t);
    }
  }
  return n;
}

/** 回復：[補正兵数 × 知 × 0.06] × 倍率 */
export function healAmount(healer: Unit, mult: number): number {
  return Math.round(effTroops(healer.troops) * healer.int * (1 + healer.buffs.int) * 0.06 * mult);
}

function restore(ctx: Ctx, t: Unit, amount: number) {
  if (t.out) return;
  const n = Math.min(t.maxTroops - t.troops, amount);
  if (n <= 0) return;
  t.troops += n;
  ctx.ev.push({ k: 'heal', uid: t.uid, n });
}

function buff(ctx: Ctx, t: Unit, stat: keyof Buffs, amount: number) {
  if (t.out) return;
  if (t.buffs[stat] >= amount) return;
  t.buffs[stat] = amount;
  ctx.ev.push({ k: 'buff', uid: t.uid, stat, text: `${STAT_NAME[stat]}+${Math.round(amount * 100)}%`, good: true });
}

/** 付与をn個、味方にばらまく（知×5%） */
function spreadBuffs(ctx: Ctx, u: Unit, n: number, events = true) {
  const allies = alive(ctx.b, u.side);
  const amount = Math.min(0.5, Math.max(0.05, u.int * (1 + u.buffs.int) * 0.05));
  for (let i = 0; i < n; i++) {
    const t = pick(ctx.r, allies);
    const stat = pick(ctx.r, ['atk', 'def', 'int', 'spd'] as const);
    if (events) buff(ctx, t, stat, amount);
    else t.buffs[stat] = Math.max(t.buffs[stat], amount);
  }
}

function dispelOne(ctx: Ctx, t: Unit, all: boolean): boolean {
  const keys = (['atk', 'def', 'int', 'spd'] as const).filter((k) => t.buffs[k] > 0);
  if (!keys.length) return false;
  for (const k of all ? keys : keys.slice(0, 1)) t.buffs[k] = 0;
  ctx.ev.push({ k: 'buff', uid: t.uid, stat: 'dispel', text: '付与解除', good: false });
  return true;
}

/** 暗殺の決まる確率 */
export function assassinChance(a: Unit, t: Unit, base: number): number {
  if (t.lord || t.boss) return 0;
  let p = base;
  if (t.troops > a.troops) p -= 0.17;
  if (t.troops > a.troops + 1000) p -= 0.17;
  if (t.troops * 2 < a.troops) p += 0.08;
  return Math.max(0, Math.min(1, p));
}

/** 技の効果を出す */
function resolve(ctx: Ctx, u: Unit, s: SkillDef, targetUid: number | null): number[] {
  const b = ctx.b;
  const foe = other(u.side);
  let target = targetUid !== null ? unitById(b, targetUid) : null;
  const needsT = s.range === 'near' || s.range === 'far' || s.range === 'pierce' || s.range === 'ally';
  if (needsT) {
    const list = legalTargets(b, u, s.id);
    if (!target || !list.includes(target)) target = list.length ? [...list].sort((x, y) => x.troops - y.troops)[0] : null;
    if (!target) return [];
  }
  const hitList: Unit[] = s.range === 'all' ? alive(b, foe) : s.range === 'pierce' ? alive(b, foe).filter((x) => x.slot === target!.slot) : target && target.side !== u.side ? [target] : [];
  const ids = (s.range === 'allies' ? alive(b, u.side) : s.range === 'self' ? [u] : s.range === 'ally' ? [target!] : hitList).map((x) => x.uid);
  ctx.ev.push({ k: 'skill', uid: u.uid, skill: s.id, name: s.name, color: s.color, range: s.range, anim: s.anim, special: s.cost === 'all', targets: ids });
  log(ctx, `${u.name}隊の「${s.name}」！`);
  const single = s.range === 'near' || s.range === 'far';
  switch (s.effect) {
    case 'dmg':
    case 'cancel':
    case 'drain':
    case 'drainAp':
    case 'mercy':
    case 'ratio':
    case 'dispel': {
      const hits = s.effect === 'dmg' && (s.amount ?? 1) > 1 ? s.amount! : 1;
      let dispelled = 0;
      for (const t0 of hitList) {
        for (let h = 0; h < hits; h++) {
          let dealt = 0;
          if (s.mult > 0 || s.effect === 'ratio') dealt = strike(ctx, u, t0, s, single);
          if (u.out) break;
          if (t0.out) continue;
          if (s.effect === 'drain' && dealt > 0) restore(ctx, u, Math.round(dealt / 2));
          if (s.effect === 'drainAp' && dealt > 0 && t0.ap > 0) { t0.ap -= 1; ctx.ev.push({ k: 'buff', uid: t0.uid, stat: 'ap', text: '技数−1', good: false }); }
          if (s.effect === 'mercy' && dealt > 0) { t0.mercy = true; ctx.ev.push({ k: 'buff', uid: t0.uid, stat: 'dispel', text: '捕獲狙い', good: false }); }
        }
        if (u.out) break;
        if (s.effect === 'dispel' && !t0.out && dispelled < (s.amount ?? 1)) {
          // 状態解除（全体）は付与のある部隊から順に、突撃は当てた相手の付与を1つ
          if (s.range === 'all' && s.mult <= 0) continue;
          if (dispelOne(ctx, t0, false)) dispelled++;
        }
      }
      if (s.effect === 'dispel' && s.range === 'all' && s.mult <= 0) {
        const list = alive(b, foe).filter((x) => x.buffs.atk + x.buffs.def + x.buffs.int + x.buffs.spd > 0);
        for (const t of list.slice(0, s.amount ?? 2)) dispelOne(ctx, t, true);
        if (!list.length) ctx.ev.push({ k: 'miss', uid: u.uid });
      }
      break;
    }
    case 'assassin': {
      const t = target!;
      const p = assassinChance(u, t, s.amount ?? 0.75);
      if (t.barrier) { t.barrier = false; ctx.ev.push({ k: 'block', uid: t.uid }); break; }
      if (chance(ctx.r, p)) {
        log(ctx, `${u.name}隊の暗殺が決まった！`);
        ctx.ev.push({ k: 'kill', uid: t.uid });
        deal(ctx, u, t, t.troops);
        down(ctx, t, u);
      } else {
        ctx.ev.push({ k: 'miss', uid: t.uid });
        log(ctx, `${u.name}隊の暗殺は失敗した。`);
      }
      break;
    }
    case 'guard':
    case 'guardAll':
      u.guarding = true;
      u.guardAll = s.effect === 'guardAll';
      u.guard = Math.min(3, Math.round((u.guard + (s.amount ?? 0.2) * Math.max(1, u.int * (1 + u.buffs.int))) * 100) / 100);
      ctx.ev.push({ k: 'buff', uid: u.uid, stat: 'guard', text: `ガード${Math.round(u.guard * 100)}%`, good: true });
      break;
    case 'buffAtk':
    case 'buffDef':
    case 'buffInt':
    case 'buffSpd': {
      const stat = s.effect === 'buffAtk' ? 'atk' : s.effect === 'buffDef' ? 'def' : s.effect === 'buffInt' ? 'int' : 'spd';
      const list = s.range === 'allies' ? alive(b, u.side) : s.range === 'ally' ? [target!] : [u];
      for (const t of list) buff(ctx, t, stat, s.amount ?? 0.3);
      break;
    }
    case 'tactics': {
      const n = Math.min(29, 2 + Math.floor(u.troops / (s.amount ?? 300)));
      spreadBuffs(ctx, u, n);
      break;
    }
    case 'heal': {
      const list = s.range === 'allies' ? alive(b, u.side) : s.range === 'ally' ? [target!] : [u];
      const amount = healAmount(u, s.mult);
      for (const t of list) restore(ctx, t, amount);
      break;
    }
    case 'guardBreak': {
      let any = false;
      for (const t of alive(b, foe)) {
        if (t.guarding || t.guard > 0) { any = true; t.guarding = false; t.guard = 0; ctx.ev.push({ k: 'buff', uid: t.uid, stat: 'guard', text: 'ガード0%', good: false }); }
      }
      if (!any) ctx.ev.push({ k: 'miss', uid: u.uid });
      break;
    }
    case 'gauge':
      b.adj[u.side] += s.amount ?? 5;
      log(ctx, `戦果が${s.amount}動いた。`);
      break;
    case 'time': {
      const before = b.ticks;
      b.ticks = Math.max(1, Math.min(60, b.ticks + (s.amount ?? 0)));
      ctx.ev.push({ k: 'tick', v: b.ticks });
      log(ctx, `時間の目盛りが${Math.abs(b.ticks - before)}${b.ticks > before ? '戻った' : '減った'}。`);
      break;
    }
    case 'field':
      b.field[u.side] = Math.min(0.5, b.field[u.side] + (s.amount ?? 0.04));
      ctx.ev.push({ k: 'buff', uid: u.uid, stat: 'field', text: `戦場補正${Math.round(b.field[u.side] * 100)}%`, good: true });
      break;
    case 'barrier': {
      const list = s.range === 'allies' ? alive(b, u.side) : [target!];
      for (const t of list) { t.barrier = true; ctx.ev.push({ k: 'buff', uid: t.uid, stat: 'barrier', text: '防御式神', good: true }); }
      break;
    }
    default:
  }
  ctx.ev.push({ k: 'gauge', v: gauge(b) });
  return ids;
}

/** 勝敗の確認 */
function checkEnd(ctx: Ctx): boolean {
  const b = ctx.b;
  if (b.end) return true;
  const lord = b.units.find((u) => u.lord);
  if (lord && lord.out) return finish(ctx, other(lord.side), 'lord');
  if (!alive(b, 'R').length) return finish(ctx, 'L', 'wipe');
  if (!alive(b, 'L').length) return finish(ctx, 'R', 'wipe');
  return false;
}

function finish(ctx: Ctx, winner: Side, reason: NonNullable<Battle['end']>['reason']): true {
  const b = ctx.b;
  b.end = { winner, reason };
  b.active = null;
  ctx.ev.push({ k: 'end', winner });
  const why = reason === 'wipe' ? '敵を全滅させた' : reason === 'lord' ? '大将の部隊が壊滅した' : reason === 'time' ? '時間切れ。戦果で決着' : reason === 'retreat' ? '退却した' : '両軍とも技が尽きた。戦果で決着';
  log(ctx, `${why}。${winner === 'L' ? '味方' : '敵'}の勝ち！`);
  return true;
}

/** 1行動ごとに時間の目盛りが1つ減る */
function tickDown(ctx: Ctx) {
  const b = ctx.b;
  b.ticks = Math.max(0, b.ticks - 1);
  ctx.ev.push({ k: 'tick', v: b.ticks });
}

/** 次に動く部隊まで進める。準備の済んだ技はここで発動する */
function advance(ctx: Ctx) {
  const b = ctx.b;
  b.active = null;
  for (let guard = 0; guard < 200; guard++) {
    if (checkEnd(ctx)) return;
    if (b.ticks <= 0) { finish(ctx, byGauge(b), 'time'); return; }
    const ready = b.units.filter((u) => !u.out && (u.ap > 0 || u.prep));
    if (!ready.length) { finish(ctx, byGauge(b), 'exhaust'); return; }
    ready.sort(order);
    const u = ready[0];
    b.time = Math.max(b.time, u.next);
    if (u.prep) {
      // 準備の済んだ技を放つ（これも1行動）
      const s = battleSkill(u.prep.skill);
      const target = u.prep.target;
      u.prep = null;
      ctx.ev.push({ k: 'turn', uid: u.uid });
      b.turns += 1;
      resolve(ctx, u, s, target);
      u.next = b.time + delayAfter(u, s.stiff);
      afterAction(ctx, u);
      tickDown(ctx);
      continue;
    }
    b.active = u.uid;
    ctx.ev.push({ k: 'turn', uid: u.uid });
    return;
  }
  finish(ctx, byGauge(b), 'time');
}

/** 手番の並び：次に動く時が早い順。同じなら速い方、それも同じなら味方から */
function order(x: Unit, y: Unit): number {
  return x.next - y.next || y.spd - x.spd || (x.side === y.side ? 0 : x.side === 'L' ? -1 : 1) || x.uid - y.uid;
}

/** 行動のあとの技能（自動回復） */
function afterAction(ctx: Ctx, u: Unit) {
  if (!u.out && hasTrait(u, 'autoHeal')) restore(ctx, u, 30);
}

/** 手番の部隊が行動する。出来事の列を返す（次の手番まで進めてから返す） */
export function act(b: Battle, a: Action): BEvent[] {
  if (b.end || b.active === null) return [];
  const ctx = ctxOf(b);
  const u = unitById(b, b.active)!;
  b.turns += 1;
  const doWait = () => {
    u.next = b.time + delayAfter(u, WAIT_STIFF);
    ctx.ev.push({ k: 'wait', uid: u.uid });
    log(ctx, `${u.name}隊は待機した。`);
  };
  if (a.t === 'wait') doWait();
  else {
    const can = canUse(b, u, a.skill);
    if (!u.skills.includes(a.skill) || !can.ok) doWait();
    else {
      const s = battleSkill(a.skill);
      const cost = s.cost === 'all' ? u.ap : s.cost;
      u.ap -= cost;
      // ガード系以外の行動をすると構えは解ける（ガード率は残る）
      if (u.kind === 'ashigaru' && s.effect !== 'guard' && s.effect !== 'guardAll') u.guarding = false;
      let target = a.target ?? null;
      if (needsTarget(s.id)) {
        const list = legalTargets(b, u, s.id);
        if (!list.some((t) => t.uid === target)) target = list.length ? list[0].uid : null;
      }
      if (s.prep) {
        u.prep = { skill: s.id, target, hits: 0 };
        u.next = b.time + delayAfter(u, s.prep);
        ctx.ev.push({ k: 'prep', uid: u.uid, name: s.name });
        log(ctx, `${u.name}隊は「${s.name}」の準備に入った。`);
      } else {
        resolve(ctx, u, s, target);
        u.next = b.time + delayAfter(u, s.stiff);
      }
    }
  }
  afterAction(ctx, u);
  tickDown(ctx);
  advance(ctx);
  return close(ctx);
}

/** 退却（負けとして終える） */
export function retreat(b: Battle): BEvent[] {
  const ctx = ctxOf(b);
  if (!b.end) finish(ctx, 'R', 'retreat');
  return close(ctx);
}

/** これから動く順（画面の行動順の帯） */
export function upcoming(b: Battle, n = 8): Unit[] {
  return b.units.filter((u) => !u.out && (u.ap > 0 || u.prep)).sort(order).slice(0, n);
}

/** その技（または待機）を使ったら、行動順の何番目に入るか（緑の矢印。0始まり。帯の外なら -1） */
export function predictSlot(b: Battle, uid: number, skillId: string | null, n = 8): number {
  const u = unitById(b, uid);
  if (!u) return -1;
  let stiff = WAIT_STIFF;
  let apLeft = u.ap;
  if (skillId) {
    const s = battleSkill(skillId);
    stiff = s.prep ?? s.stiff;
    apLeft -= s.cost === 'all' ? u.ap : s.cost;
    if (apLeft <= 0 && !s.prep) return -1;
  }
  const at = b.time + delayAfter(u, stiff);
  const others = b.units.filter((x) => x !== u && !x.out && (x.ap > 0 || x.prep)).sort(order);
  const idx = others.filter((x) => x.next < at || (x.next === at && order(x, { ...u, next: at }) < 0)).length;
  return idx < n - 1 ? idx : -1;
}

export function activeUnit(b: Battle): Unit | null {
  return b.active !== null ? unitById(b, b.active) : null;
}

/** 部隊の役割の目安（画面・AI） */
export function canCounter(u: Unit): boolean {
  return KINDS[u.kind].counter;
}
