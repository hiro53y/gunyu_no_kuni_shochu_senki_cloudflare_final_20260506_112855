// 合戦の進行：時間の流れ・手番・射程・ガード・反撃・準備・付与・戦果ゲージ・勝敗。乱数は seed 付きで決定的
import { chance, hashSeed, int, next as rnd, pick, type Rng } from '../engine/rng';
import { KINDS, battleSkill } from './kinds';
import type { Action, BEvent, Battle, BattleKind, Buffs, Side, SkillDef, Unit } from './types';

export const BATTLE_VERSION = 1;
export const DEFAULT_LIMIT = 100;

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
}

export interface BattleSpec {
  seed: number;
  kind: BattleKind;
  region: string;
  limit?: number;
  defender: Side;
  L: UnitSpec[];
  R: UnitSpec[];
}

const other = (s: Side): Side => (s === 'L' ? 'R' : 'L');
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
  if (ctx.b.log.length > 120) ctx.b.log.splice(0, ctx.b.log.length - 120);
}

/** 速さによる硬直の倍率（速いほど早く次が来る） */
function stiffK(u: Unit): number {
  const spd = u.spd * (1 + u.buffs.spd);
  return 12 / (8 + Math.max(0, spd));
}

export function createBattle(spec: BattleSpec): Battle {
  const b: Battle = {
    v: BATTLE_VERSION, seed: spec.seed | 0, rng: hashSeed(spec.seed, 'battle', spec.region), kind: spec.kind, region: spec.region,
    time: 0, limit: spec.limit ?? DEFAULT_LIMIT, units: [], gaugeAdj: 0, active: null, log: [], end: null, defender: spec.defender, turns: 0,
  };
  const ctx = ctxOf(b);
  let uid = 1;
  for (const side of ['L', 'R'] as Side[]) {
    for (const s of side === 'L' ? spec.L : spec.R) {
      const kd = KINDS[s.kind];
      const troops = Math.max(1, Math.round(Math.min(s.troops, s.maxTroops)));
      const u: Unit = {
        uid: uid++, side, gen: s.gen, name: s.name, short: s.short, portrait: s.portrait, kind: s.kind, lv: s.lv,
        atk: s.atk, def: s.def, int: s.int, spd: s.spd, troops, maxTroops: Math.max(troops, Math.round(s.maxTroops)), startTroops: troops,
        ap: kd.ap + (s.apBonus ?? 0), apMax: kd.ap + (s.apBonus ?? 0), row: s.row, slot: s.slot, skills: [...s.skills],
        next: Math.max(0.5, kd.first + int(ctx.r, 30) / 10 - s.spd * 0.35), guard: s.kind === 'ashigaru' ? 0.5 : 0, guarding: s.kind === 'ashigaru',
        buffs: { ...ZERO }, barrier: false, prep: null, out: false, lord: s.lord, boss: s.boss, youkai: s.youkai, dealt: 0, kills: 0,
      };
      b.units.push(u);
    }
  }
  // 軍師：合戦の初めに味方へ付与を配る
  for (const u of b.units) {
    if (u.kind !== 'gunshi') continue;
    const allies = b.units.filter((x) => x.side === u.side);
    const n = Math.min(6, 2 + Math.floor(u.troops / 300));
    for (let i = 0; i < n; i++) {
      const t = pick(ctx.r, allies);
      const stat = pick(ctx.r, ['atk', 'def', 'spd'] as const);
      t.buffs[stat] = Math.max(t.buffs[stat], Math.min(0.45, u.int * 0.05));
    }
    log(ctx, `${u.name}の陣立てで、味方に付与が配られた。`);
  }
  log(ctx, `合戦が始まった！（制限時間 ${b.limit}）`);
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

/** 前衛として扱われるか（自分の側の前衛が全滅していれば後衛も前に出る） */
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
  if (s.cost === 'all' ? u.ap < 1 : u.ap < s.cost) return { ok: false, reason: '技数が足りない' };
  if (s.range === 'near' && !inFront(b, u)) return { ok: false, reason: '前衛からしか使えない' };
  const foes = alive(b, other(u.side));
  if (['near', 'far', 'pierce', 'all'].includes(s.range) && !foes.length) return { ok: false, reason: '敵がいない' };
  if (s.effect === 'heal' && s.range === 'self' && u.troops >= u.maxTroops) return { ok: false, reason: '兵は満ちている' };
  if (s.effect === 'heal' && s.range !== 'self' && !alive(b, u.side).some((x) => x.troops < x.maxTroops)) return { ok: false, reason: '傷ついた味方がいない' };
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

/** 戦果ゲージ（0〜100。50より大きいと左＝味方が優勢） */
export function gauge(b: Battle): number {
  const loss = (side: Side) => {
    const list = b.units.filter((u) => u.side === side);
    const start = list.reduce((s, u) => s + u.startTroops, 0);
    const now = list.reduce((s, u) => s + u.troops, 0);
    return start > 0 ? Math.max(0, (start - now) / start) : 0;
  };
  const g = 50 + (loss('R') - loss('L')) * 70 + b.gaugeAdj;
  return Math.max(0, Math.min(100, Math.round(g * 10) / 10));
}

// ── 打撃 ──

/** 攻撃の強さ（兵数の平方根に比例） */
function power(a: Unit, mult: number): number {
  const kd = KINDS[a.kind];
  return kd.atk * (0.6 + a.atk * 0.08) * Math.sqrt(Math.max(0, a.troops)) * mult * (1 + a.buffs.atk);
}

function defense(t: Unit): number {
  return 100 + 14 * Math.max(0.2, KINDS[t.kind].def) * (1 + t.def * 0.1) * (1 + t.buffs.def);
}

/** 期待する打撃（AI と画面の目安用。乱数とガードは見ない） */
export function estimate(b: Battle, a: Unit, t: Unit, skillId: string): number {
  const s = battleSkill(skillId);
  let mult = s.mult;
  if (s.vs?.kinds.includes(t.kind)) mult *= s.vs.mult;
  if (s.winning && (a.side === 'L' ? gauge(b) > 50 : gauge(b) < 50)) mult *= s.winning;
  return (power(a, mult) * 100) / defense(t);
}

function down(ctx: Ctx, t: Unit, by: Unit | null) {
  if (t.out) return;
  t.out = true;
  t.troops = 0;
  t.prep = null;
  t.guarding = false;
  if (by) by.kills += 1;
  ctx.ev.push({ k: 'down', uid: t.uid });
  log(ctx, `${t.name}隊が壊滅した！`);
}

/** 部隊に打撃を与える。かばう足軽・守り式神・反撃を処理し、実際の打撃を返す */
function strike(ctx: Ctx, a: Unit, target: Unit, s: SkillDef, multK = 1): number {
  const b = ctx.b;
  if (target.out) return 0;
  // 守り式神
  if (target.barrier) {
    target.barrier = false;
    ctx.ev.push({ k: 'block', uid: target.uid });
    log(ctx, `${target.name}隊の守り式神が打撃を防いだ。`);
    return 0;
  }
  let t = target;
  let halved = false;
  if (s.physical && !s.ignoreGuard) {
    if (t.kind === 'ashigaru' && t.guarding) {
      halved = true;
      t.guard = Math.max(0, t.guard - 0.4);
      if (t.guard <= 0) t.guarding = false;
    } else {
      const guards = alive(b, t.side).filter((g) => g !== t && g.guarding && g.guard > 0 && (g.guardAll || g.row === t.row)).sort((x, y) => y.guard - x.guard);
      const g = guards[0];
      if (g && rnd(ctx.r) < Math.min(1, g.guard)) {
        t = g;
        halved = true;
        g.guard = Math.max(0, g.guard - 0.4);
        if (g.guard <= 0) g.guarding = false;
      }
    }
  }
  let mult = s.mult * multK;
  if (s.vs?.kinds.includes(t.kind)) mult *= s.vs.mult;
  if (s.winning && (a.side === 'L' ? gauge(b) > 50 : gauge(b) < 50)) mult *= s.winning;
  let dmg = (power(a, mult) * 100) / defense(t) * (0.9 + rnd(ctx.r) * 0.2);
  if (halved) dmg /= 2;
  const n = Math.max(1, Math.min(t.troops, Math.round(dmg)));
  t.troops -= n;
  a.dealt += n;
  ctx.ev.push({ k: 'hit', uid: t.uid, from: a.uid, n, guardBy: t !== target ? t.uid : undefined, big: n >= t.maxTroops * 0.3, magic: !s.physical });
  if (t !== target) log(ctx, `${t.name}隊が${target.name}隊をかばった！`);
  if (t.troops <= 0) down(ctx, t, a);
  else if (s.effect === 'cancel' && t.prep) {
    log(ctx, `${t.name}隊の準備が崩された！`);
    t.prep = null;
    ctx.ev.push({ k: 'cancel', uid: t.uid });
  }
  // 反撃（近距離の物理）
  if (s.counter > 0 && !s.noCounter && !t.out && !a.out && s.physical) {
    const c = Math.max(1, Math.min(a.troops, Math.round((power(t, 1) * 100) / defense(a) * s.counter * (0.9 + rnd(ctx.r) * 0.2))));
    a.troops -= c;
    t.dealt += c;
    ctx.ev.push({ k: 'counter', uid: a.uid, from: t.uid, n: c });
    if (a.troops <= 0) down(ctx, a, t);
  }
  return n;
}

function heal(ctx: Ctx, healer: Unit, t: Unit, mult: number) {
  restore(ctx, t, Math.round(t.maxTroops * 0.14 * mult * (1 + healer.int * 0.07)));
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
  t.buffs[stat] = Math.max(t.buffs[stat], amount);
  const label = stat === 'atk' ? '攻' : stat === 'def' ? '防' : stat === 'spd' ? '速' : '知';
  ctx.ev.push({ k: 'buff', uid: t.uid, text: `${label}+${Math.round(amount * 100)}%`, good: true });
}

function dispel(ctx: Ctx, t: Unit, all: boolean) {
  const keys = (['atk', 'def', 'int', 'spd'] as const).filter((k) => t.buffs[k] > 0);
  if (!keys.length) return;
  for (const k of all ? keys : keys.slice(0, 1)) t.buffs[k] = 0;
  ctx.ev.push({ k: 'buff', uid: t.uid, text: '付与解除', good: false });
}

/** 技の効果を出す（標的が死んでいれば、選び直す） */
function resolve(ctx: Ctx, u: Unit, s: SkillDef, targetUid: number | null) {
  const b = ctx.b;
  const foe = other(u.side);
  let target = targetUid !== null ? unitById(b, targetUid) : null;
  const needsT = s.range === 'near' || s.range === 'far' || s.range === 'pierce' || s.range === 'ally';
  if (needsT && (!target || target.out || (s.range !== 'ally' && target.side === u.side))) {
    const list = legalTargets(b, u, s.id);
    target = list.length ? list.sort((x, y) => x.troops - y.troops)[0] : null;
  }
  if (needsT && !target) return;
  if (s.range === 'near' && target && !frontTargets(b, foe).includes(target)) target = frontTargets(b, foe)[0] ?? null;
  switch (s.effect) {
    case 'dmg':
    case 'cancel':
    case 'drain':
    case 'delay':
    case 'weaken':
    case 'dispel': {
      const targets: Unit[] = s.range === 'all' ? alive(b, foe) : s.range === 'pierce' ? alive(b, foe).filter((x) => x.slot === target!.slot) : target ? [target] : [];
      for (const t of targets) {
        let dealt = 0;
        if (s.mult > 0) dealt = strike(ctx, u, t, s);
        if (u.out) break;
        if (t.out) continue;
        if (s.effect === 'drain' && dealt > 0) restore(ctx, u, Math.round(dealt / 2));
        if (s.effect === 'delay') { t.next += s.amount ?? 10; ctx.ev.push({ k: 'buff', uid: t.uid, text: '足止め', good: false }); }
        if (s.effect === 'weaken') { t.buffs.atk = Math.max(-0.6, Math.min(t.buffs.atk, 0) - (s.amount ?? 0.3)); ctx.ev.push({ k: 'buff', uid: t.uid, text: '攻撃低下', good: false }); }
        if (s.effect === 'dispel') dispel(ctx, t, s.range === 'all');
      }
      break;
    }
    case 'assassin': {
      const t = target!;
      const p = t.lord || t.boss ? 0 : Math.max(0.08, Math.min(0.6, 0.42 * u.troops / Math.max(1, t.troops)));
      ctx.ev.push({ k: 'hit', uid: t.uid, from: u.uid, n: 0 });
      if (t.barrier) { t.barrier = false; ctx.ev.push({ k: 'block', uid: t.uid }); break; }
      if (chance(ctx.r, p)) {
        log(ctx, `${u.name}隊の暗殺が決まった！`);
        u.dealt += t.troops;
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
      u.guard = Math.min(1.5, u.guard + (s.amount ?? 0.2) * Math.max(1, u.int));
      ctx.ev.push({ k: 'buff', uid: u.uid, text: `ガード${Math.round(u.guard * 100)}%`, good: true });
      break;
    case 'buffAtk':
    case 'buffDef':
    case 'buffSpd': {
      const stat = s.effect === 'buffAtk' ? 'atk' : s.effect === 'buffDef' ? 'def' : 'spd';
      const list = s.range === 'allies' ? alive(b, u.side) : s.range === 'ally' ? [target!] : [u];
      for (const t of list) buff(ctx, t, stat, s.amount ?? 0.3);
      break;
    }
    case 'buffRandom':
      for (const t of alive(b, u.side)) buff(ctx, t, pick(ctx.r, ['atk', 'def', 'spd'] as const), Math.min(0.45, u.int * 0.05));
      break;
    case 'heal': {
      const list = s.range === 'allies' ? alive(b, u.side) : s.range === 'ally' ? [target!] : [u];
      for (const t of list) heal(ctx, u, t, s.mult);
      break;
    }
    case 'guardBreak':
      for (const t of alive(b, foe)) {
        if (t.guarding || t.guard > 0) { t.guarding = false; t.guard = 0; ctx.ev.push({ k: 'buff', uid: t.uid, text: 'ガード解除', good: false }); }
      }
      break;
    case 'gauge':
      b.gaugeAdj += (u.side === 'L' ? 1 : -1) * (s.amount ?? 5);
      ctx.ev.push({ k: 'gauge', v: gauge(b) });
      break;
    case 'extend':
      b.limit += s.amount ?? 8;
      ctx.ev.push({ k: 'time', v: b.limit });
      log(ctx, `制限時間が${s.amount}延びた。`);
      break;
    case 'barrier': {
      const list = s.range === 'allies' ? alive(b, u.side) : [target!];
      for (const t of list) { t.barrier = true; ctx.ev.push({ k: 'buff', uid: t.uid, text: '守り式神', good: true }); }
      break;
    }
    default:
  }
  ctx.ev.push({ k: 'gauge', v: gauge(b) });
}

/** 勝敗の確認 */
function checkEnd(ctx: Ctx): boolean {
  const b = ctx.b;
  if (b.end) return true;
  const lord = b.units.find((u) => u.lord);
  if (lord && lord.out) return finish(ctx, 'R', 'lord');
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

/** 戦果で決める */
function byGauge(b: Battle): Side {
  const g = gauge(b);
  return g > 50 ? 'L' : g < 50 ? 'R' : b.defender;
}

/** 次に動く部隊まで時を進める。準備の済んだ技はここで発動する */
function advance(ctx: Ctx) {
  const b = ctx.b;
  b.active = null;
  for (let guard = 0; guard < 500; guard++) {
    if (checkEnd(ctx)) return;
    const ready = b.units.filter((u) => !u.out && (u.ap > 0 || u.prep));
    if (!ready.length) { finish(ctx, byGauge(b), 'exhaust'); return; }
    ready.sort((x, y) => x.next - y.next || y.spd - x.spd || (x.side === y.side ? 0 : x.side === 'L' ? -1 : 1) || x.uid - y.uid);
    const u = ready[0];
    if (u.next > b.limit) { b.time = b.limit; ctx.ev.push({ k: 'time', v: b.time }); finish(ctx, byGauge(b), 'time'); return; }
    b.time = Math.max(b.time, u.next);
    if (u.prep) {
      const s = battleSkill(u.prep.skill);
      const target = u.prep.target;
      u.prep = null;
      ctx.ev.push({ k: 'turn', uid: u.uid });
      ctx.ev.push({ k: 'skill', uid: u.uid, name: s.name, color: s.color, range: s.range });
      log(ctx, `${u.name}隊の「${s.name}」！`);
      resolve(ctx, u, s, target);
      u.next = b.time + s.stiff * stiffK(u);
      continue;
    }
    b.active = u.uid;
    ctx.ev.push({ k: 'turn', uid: u.uid });
    return;
  }
  finish(ctx, byGauge(b), 'time');
}

/** 手番の部隊が行動する。出来事の列を返す（次の手番まで進めてから返す） */
export function act(b: Battle, a: Action): BEvent[] {
  if (b.end || b.active === null) return [];
  const ctx = ctxOf(b);
  const u = unitById(b, b.active)!;
  b.turns += 1;
  if (a.t === 'wait') {
    u.next = b.time + 6 * stiffK(u);
    ctx.ev.push({ k: 'wait', uid: u.uid });
    advance(ctx);
    return close(ctx);
  }
  const can = canUse(b, u, a.skill);
  if (!u.skills.includes(a.skill) || !can.ok) {
    // 使えない技は待機として扱う（画面の不具合で止まらないように）
    u.next = b.time + 6 * stiffK(u);
    ctx.ev.push({ k: 'wait', uid: u.uid });
    advance(ctx);
    return close(ctx);
  }
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
    u.prep = { skill: s.id, target, at: b.time + s.prep * stiffK(u) };
    u.next = u.prep.at;
    ctx.ev.push({ k: 'prep', uid: u.uid, name: s.name });
    log(ctx, `${u.name}隊は「${s.name}」の準備に入った。`);
  } else {
    ctx.ev.push({ k: 'skill', uid: u.uid, name: s.name, color: s.color, range: s.range });
    log(ctx, `${u.name}隊の「${s.name}」！`);
    resolve(ctx, u, s, target);
    u.next = b.time + s.stiff * stiffK(u);
  }
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
export function upcoming(b: Battle, n = 6): Unit[] {
  return b.units.filter((u) => !u.out && (u.ap > 0 || u.prep)).sort((x, y) => x.next - y.next || y.spd - x.spd).slice(0, n);
}

export function activeUnit(b: Battle): Unit | null {
  return b.active !== null ? unitById(b, b.active) : null;
}
