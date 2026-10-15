// 軍勢：武将の能力・兵数の上限・技、陣立て、敵の守りの部隊、合戦の作り方
import { FACTIONS, regionDef, type FactionId } from '../content/sengoku';
import { GENERIC_TYPES, GEN_BY_ID, GIVEN_NAMES, LORD, ONI_NAMES, SURNAMES, type GenDef } from '../content/generals';
import { hashSeed, pick, range, weighted, type Rng } from '../engine/rng';
import { KINDS, kindSkills } from '../battle/kinds';
import type { UnitSpec, BattleSpec } from '../battle/engine';
import type { Kind } from '../battle/types';
import type { Campaign, CustomGen, GenState, Invasion, Placement, Sortie } from './state';

/** そのレベルになるのに必要な経験の合計 */
export function expFor(lv: number): number {
  return lv <= 1 ? 0 : Math.floor(10 * Math.pow(lv - 1, 2.1));
}

export function ownedCount(c: Campaign): number {
  return Object.values(c.regions).filter((r) => r.owner === 'akatsuki').length;
}

export function lordLv(c: Campaign): number {
  return c.gens[LORD]?.lv ?? 1;
}

/** 武将の元の能力（統率・武力・知略）と名前 */
export function baseOf(c: Campaign, id: string): { def?: GenDef; name: string; short: string; portrait: string; cmd: number; pow: number; int: number; youkai: boolean } {
  const def = GEN_BY_ID[id];
  if (def) return { def, name: def.name, short: def.short, portrait: def.portrait, cmd: def.cmd, pow: def.pow, int: def.int, youkai: !!def.youkai };
  const cu = c.gens[id]?.custom;
  if (!cu) throw new Error(`unknown general ${id}`);
  return { name: cu.name, short: cu.short, portrait: cu.portrait, cmd: cu.cmd, pow: cu.pow, int: cu.int, youkai: !!cu.youkai };
}

export interface GenPower { atk: number; def: number; int: number; spd: number }

/** 合戦での能力（1〜10ほど） */
export function powerOf(cmd: number, pow: number, int: number, lv: number): GenPower {
  return {
    atk: Math.round((pow / 12 + lv * 0.12) * 10) / 10,
    def: Math.round((cmd / 14 + lv * 0.08) * 10) / 10,
    int: Math.round((int / 12 + lv * 0.04) * 10) / 10,
    spd: Math.round(((pow * 0.5 + int * 0.5) / 15 + lv * 0.03) * 10) / 10,
  };
}

export function genPower(c: Campaign, id: string): GenPower {
  const b = baseOf(c, id);
  return powerOf(b.cmd, b.pow, b.int, c.gens[id].lv);
}

/** 味方の兵数の上限（国の数・レベル・増員で増える） */
export function maxTroops(c: Campaign, id: string): number {
  const g = c.gens[id];
  const k = KINDS[g.kind].cap;
  return Math.round((400 + 50 * ownedCount(c) + 10 * g.lv) * k + g.extra * 100 * k);
}

/** 敵の兵数（国の強さから） */
export function enemyTroops(danger: number, kind: Kind, boss: boolean): number {
  return Math.round((310 + danger * 58) * KINDS[kind].cap * (boss ? 1.3 : 1));
}

/** 使える技（兵種の技＋固有技） */
export function unitSkills(c: Campaign, id: string, ally: boolean): string[] {
  const g = c.gens[id];
  const out = kindSkills(g.kind, g.lv);
  const def = GEN_BY_ID[id];
  if (def) {
    if (id === LORD) {
      out.push(def.skills[0]);
      if (ownedCount(c) >= 5 || c.flags.lordBond) out.push(def.skills[1]);
    } else {
      out.push(def.skills[0]);
      if (ally ? g.bond >= 2 : g.lv >= 20) out.push(def.skills[1]);
    }
  }
  return out;
}

/** 合戦に出す部隊の作り方 */
export function unitSpecOf(c: Campaign, id: string, p: Placement, ally: boolean, opts: { boss?: boolean; troops?: number; danger?: number } = {}): UnitSpec {
  const g = c.gens[id];
  const b = baseOf(c, id);
  const pw = powerOf(b.cmd, b.pow, b.int, g.lv);
  const max = ally ? maxTroops(c, id) : enemyTroops(opts.danger ?? g.lv, g.kind, !!opts.boss);
  return {
    gen: id, name: b.name, short: b.short, portrait: b.portrait, kind: g.kind, lv: g.lv, ...pw,
    troops: ally ? Math.min(g.troops, max) : opts.troops ?? max, maxTroops: max, row: p.row, slot: p.slot,
    skills: unitSkills(c, id, ally), lord: id === LORD && ally, boss: opts.boss, youkai: b.youkai || g.kind === 'youkai', apBonus: Math.floor(g.lv / 10),
  };
}

/** 兵種に合わせて前衛・後衛に並べる（空いた所を順に埋める） */
export function autoPlace(kinds: { id: string; kind: Kind }[]): Placement[] {
  const out: Placement[] = [];
  const used = new Set<string>();
  const take = (row: 0 | 1, id: string) => {
    const slot = ([0, 1, 2] as const).find((s) => !used.has(`${row}${s}`));
    if (slot === undefined) return false;
    used.add(`${row}${slot}`);
    out.push({ gen: id, row, slot });
    return true;
  };
  const list = kinds.slice(0, 6);
  for (const k of list.filter((x) => KINDS[x.kind].front)) if (!take(0, k.id)) take(1, k.id);
  for (const k of list.filter((x) => !KINDS[x.kind].front)) if (!take(1, k.id)) take(0, k.id);
  return out;
}

// ── 国と砦 ──

/** 国の砦の数（最後が本城） */
export function forts(rid: string): number {
  const r = regionDef(rid);
  return Math.min(5, 2 + (r.danger >= 8 ? 1 : 0) + (r.danger >= 15 ? 1 : 0) + (r.capital ? 1 : 0));
}

/** 城の強さ（時が経つと少し固くなる） */
export function castleDanger(c: Campaign, rid: string): number {
  return regionDef(rid).danger + Math.min(4, Math.floor((c.turn - 1) / 12));
}

// ── 敵の部隊 ──

function rngFor(seed: number, ...parts: (string | number)[]): Rng {
  return { s: hashSeed(seed, ...parts) };
}

/** その場限りの侍大将（捕らえたら家臣にできる） */
function tempGeneral(r: Rng, so: Sortie, faction: FactionId, kind: Kind, lv: number, n: number): string {
  const type = GENERIC_TYPES.find((t) => t.kind === kind) ?? GENERIC_TYPES[1];
  const youkai = kind === 'youkai';
  const given = pick(r, GIVEN_NAMES);
  const name = youkai ? `${pick(r, ONI_NAMES)}童子` : `${pick(r, SURNAMES)} ${given}`;
  const custom: CustomGen = {
    name, short: youkai ? name : given, portrait: pick(r, type.portraits), label: type.label,
    cmd: range(r, type.cmd[0], type.cmd[1]), pow: range(r, type.pow[0], type.pow[1]), int: range(r, type.int[0], type.int[1]), youkai,
  };
  const id = `tmp${n}`;
  so.temps[id] = { custom, lv: Math.max(1, lv), kind, faction };
  return id;
}

/** 勢力の兵種から1つ選ぶ */
function pickKind(r: Rng, f: FactionId): Kind {
  return weighted(r, FACTIONS[f].troops, ([, w]) => w)![0];
}

export interface Army { units: UnitSpec[] }

/** その場限りの侍大将の部隊を作る */
function tempUnit(c: Campaign, so: Sortie, id: string, p: Placement, danger: number): UnitSpec {
  const t = so.temps[id];
  const pw = powerOf(t.custom.cmd, t.custom.pow, t.custom.int, t.lv);
  const max = enemyTroops(danger, t.kind, false);
  return {
    gen: id, name: t.custom.name, short: t.custom.short, portrait: t.custom.portrait, kind: t.kind, lv: t.lv, ...pw,
    troops: max, maxTroops: max, row: p.row, slot: p.slot, skills: kindSkills(t.kind, t.lv), youkai: t.kind === 'youkai', apBonus: Math.floor(t.lv / 10),
  };
}

/** 敵の部隊を並べる（名のある将＋侍大将） */
function enemyArmy(c: Campaign, so: Sortie, seed: number, faction: FactionId, danger: number, size: number, named: { id: string; boss?: boolean }[]): UnitSpec[] {
  const r = rngFor(seed, 'army', so.region, so.fort ?? 0);
  const list: { id: string; kind: Kind; boss?: boolean; temp?: boolean }[] = named.map((n) => ({ id: n.id, kind: c.gens[n.id].kind, boss: n.boss }));
  let n = 0;
  while (list.length < size) {
    const kind = pickKind(r, faction);
    const id = tempGeneral(r, so, faction, kind, Math.max(1, danger + range(r, -2, 1)), n++);
    list.push({ id, kind, temp: true });
  }
  const places = autoPlace(list.map((x) => ({ id: x.id, kind: x.kind })));
  return places.map((p) => {
    const item = list.find((x) => x.id === p.gen)!;
    return item.temp ? tempUnit(c, so, item.id, p, danger) : unitSpecOf(c, item.id, p, false, { boss: item.boss, danger });
  });
}

/** 城攻めの守りの部隊（砦の番号ごと） */
export function siegeArmy(c: Campaign, so: Sortie, seed: number): UnitSpec[] {
  const rid = so.region;
  const rs = c.regions[rid];
  const n = forts(rid);
  const f = so.fort ?? 0;
  const danger = castleDanger(c, rid) + Math.floor(f / 2);
  const final = f >= n - 1;
  const named: { id: string; boss?: boolean }[] = [];
  if (final && rs.boss && c.gens[rs.boss]?.status === 'enemy') named.push({ id: rs.boss, boss: true });
  if (rs.mid && c.gens[rs.mid]?.status === 'enemy' && (final || f === n - 2)) named.push({ id: rs.mid });
  const size = Math.max(named.length, Math.min(6, 2 + Math.floor(danger / 8) + (final ? 1 : 0)));
  return enemyArmy(c, so, seed, rs.owner, danger, size, named);
}

/** 攻めてきた軍（大将＋侍大将） */
export function invasionArmy(c: Campaign, so: Sortie, inv: Invasion, seed: number, danger: number): UnitSpec[] {
  const size = Math.min(6, 2 + Math.floor(danger / 5));
  return enemyArmy(c, so, seed, inv.faction, danger, size, c.gens[inv.commander] ? [{ id: inv.commander, boss: true }] : []);
}

/** 妖魔討伐の群れ */
export function huntArmy(c: Campaign, so: Sortie, seed: number, danger: number): UnitSpec[] {
  const size = Math.min(6, 3 + Math.floor(danger / 10));
  return enemyArmy(c, so, seed, 'youma', danger, size, []);
}

/** 味方の部隊（陣立てのとおり） */
export function partyUnits(c: Campaign, party: Placement[]): UnitSpec[] {
  return party.map((p) => unitSpecOf(c, p.gen, p, true));
}

export function battleSpec(kind: BattleSpec['kind'], region: string, seed: number, L: UnitSpec[], R: UnitSpec[], defender: 'L' | 'R'): BattleSpec {
  return { seed, kind, region, defender, L, R, limit: 100 };
}

// ── 兵の補充・増員 ──

/** 兵を満たすのに要る文 */
export function refillCost(c: Campaign, id: string): number {
  const g = c.gens[id];
  const missing = Math.max(0, maxTroops(c, id) - g.troops);
  return Math.ceil(missing * KINDS[g.kind].refill * 0.25);
}

export function extraCost(g: GenState): number {
  return 300 * (g.extra + 1);
}
