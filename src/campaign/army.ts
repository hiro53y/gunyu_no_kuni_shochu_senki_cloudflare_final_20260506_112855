// 軍勢：武将の能力・兵数の上限・技・技能、陣立て、敵の守りの部隊、合戦の作り方、補充と増員の値段
import { FACTIONS, regionDef, type FactionId } from '../content/sengoku';
import { GENERIC_TYPES, GEN_BY_ID, GIVEN_NAMES, LORD, ONI_NAMES, SURNAMES, type GenDef } from '../content/generals';
import { hashSeed, pick, range, weighted, chance, type Rng } from '../engine/rng';
import { KINDS, kindSkills } from '../battle/kinds';
import { DEFAULT_TICKS, type UnitSpec, type BattleSpec } from '../battle/engine';
import type { Ground, Kind, Trait } from '../battle/types';
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

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 合戦での能力（0〜12ほど）：攻＝武力、防＝統率、知＝知略、速＝武と知の平均。レベルで少し伸びる */
export function powerOf(cmd: number, pow: number, int: number, lv: number): GenPower {
  return {
    atk: clamp(Math.round(pow / 10) - 2 + Math.floor(lv / 10), 0, 12),
    def: clamp(Math.round(cmd / 10) - 2 + Math.floor(lv / 12), 0, 12),
    int: clamp(Math.round(int / 10) - 2 + Math.floor(lv / 12), 0, 12),
    spd: clamp(Math.round((pow + int) / 20) - 2 + Math.floor(lv / 15), 0, 10),
  };
}

export function genPower(c: Campaign, id: string): GenPower {
  const b = baseOf(c, id);
  return powerOf(b.cmd, b.pow, b.int, c.gens[id].lv);
}

/** 武将の技数 */
export function apOf(kind: Kind, lv: number): number {
  return KINDS[kind].ap + Math.floor(lv / 15);
}

/** 名のある武将の特別な技能 */
export const GEN_TRAITS: Record<string, Trait[]> = {
  g_saku: ['counterUp'], g_suzuran: ['autoHeal'], g_chikage: ['initGauge'], g_genba: ['guardPlus'],
  g_genbu: ['guardPlus'], g_hayato: ['firstStrike'], g_narukami: ['counterUp'],
  g_hazuki: ['luckAtk'], g_fuuko: ['hunter'], g_souji: ['initTime'],
  g_toshiro: ['luckSpd'], g_rin: ['firstStrike'], g_shizune: ['hunter'],
  g_kurenai: ['luckDef'], g_tomoshibi: ['luckAtk'],
  g_kangetsu: ['autoHeal'], g_tesshin: ['counterUp'],
  g_kurobuchi: ['initGauge', 'autoHeal'], g_guren: ['autoHeal'], g_gaou: ['counterUp'],
  g_kagemaru: ['firstStrike'], g_yuzuriha: ['luckAtk'],
};

export const TRAIT_NAME: Record<Trait, string> = {
  firstStrike: '先手必勝', counterUp: '反撃率アップ', hunter: '落ち武者狩り', luckAtk: '攻撃運', luckDef: '防御運', luckSpd: '速さ運',
  initGauge: '初期戦果', initTime: '初期時間経過', guardPlus: '強化初期ガード', autoHeal: '自動回復',
};

export const TRAIT_DESC: Record<Trait, string> = {
  firstStrike: '合戦の初めに先手を取りやすい。', counterUp: '反撃の打撃が2倍。', hunter: '合戦で敵の将を捕らえる確率が1/2に上がる。',
  luckAtk: '合戦の初めに2/3で攻付与50%。', luckDef: '合戦の初めに2/3で防付与50%。', luckSpd: '合戦の初めに2/3で速付与50%。',
  initGauge: '合戦の初めの戦果+10。', initTime: '合戦の時間の目盛りが5減る。', guardPlus: '足軽の初めのガード率が120%。', autoHeal: '行動のたびに兵が30戻る。',
};

/** 名もなき侍大将の技能（3割ほどが1つ持つ） */
const GENERIC_TRAITS: Trait[] = ['luckAtk', 'luckDef', 'luckSpd', 'counterUp', 'hunter', 'firstStrike'];

export function traitsOf(c: Campaign, id: string): Trait[] {
  if (GEN_TRAITS[id]) return GEN_TRAITS[id];
  const g = c.gens[id];
  if (!g?.custom) return [];
  const h = hashSeed(c.seed, 'trait', g.custom.name) >>> 0;
  return h % 10 < 3 ? [GENERIC_TRAITS[h % GENERIC_TRAITS.length]] : [];
}

/** 味方の兵数の上限：（400＋50×国の数）× 兵種の倍率 */
export function maxTroops(c: Campaign, id: string): number {
  const g = c.gens[id];
  return Math.round((400 + 50 * ownedCount(c)) * KINDS[g.kind].cap + (g.capacityBonus??0));
}

/** 敵の兵数（国の強さから） */
export function enemyTroops(danger: number, kind: Kind, boss: boolean): number {
  return Math.round((280 + danger * 32) * KINDS[kind].cap * (boss ? 1.3 : 1));
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
export function unitSpecOf(c: Campaign, id: string, p: Placement, ally: boolean, opts: { boss?: boolean; troops?: number; danger?: number; cut?: number } = {}): UnitSpec {
  const g = c.gens[id];
  const b = baseOf(c, id);
  const pw = powerOf(b.cmd, b.pow, b.int, g.lv);
  const max = ally ? maxTroops(c, id) : enemyTroops(opts.danger ?? g.lv, g.kind, !!opts.boss);
  const troops = ally ? Math.min(g.troops, max) : Math.round((opts.troops ?? max) * (1 - (opts.cut ?? 0)));
  return {
    gen: id, name: b.name, short: b.short, portrait: b.portrait, kind: g.kind, lv: g.lv, ...pw,
    troops: Math.max(1, troops), maxTroops: max, row: p.row, slot: p.slot,
    skills: unitSkills(c, id, ally), lord: id === LORD && ally, boss: opts.boss, youkai: b.youkai || g.kind === 'youkai', apBonus: Math.floor(g.lv / 15),
    traits: traitsOf(c, id),
  };
}

/** 兵種に合わせて前衛・後衛に並べる（空いた所を順に埋める） */
export function autoPlace(kinds: { id: string; kind: Kind }[]): Placement[] {
  const out: Placement[] = [];
  const used = new Set<string>();
  const take = (row: 0 | 1, id: string) => {
    const slot = ([1, 0, 2] as const).find((s) => !used.has(`${row}${s}`));
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

// ── 国と領地 ──

/** 国の領地の数（最後が城） */
export function landCount(rid: string): number {
  const r = regionDef(rid);
  return Math.min(5, 2 + (r.danger >= 8 ? 1 : 0) + (r.danger >= 15 ? 1 : 0) + (r.capital ? 1 : 0));
}

/** 領地の並び（野・町を交互に、最後は城） */
export function landsOf(rid: string): Ground[] {
  const n = landCount(rid);
  const t = regionDef(rid).terrain;
  const townFirst = t === 'port' || t === 'plain' || t === 'coast' || t === 'field';
  const out: Ground[] = [];
  for (let i = 0; i < n - 1; i++) out.push((i % 2 === 0) === townFirst ? 'town' : 'field');
  out.push('castle');
  return out;
}

export const LAND_NAME: Record<Ground, string> = { field: '野', town: '町', castle: '城' };

/** 国の強さ（時が経つと少し固くなる） */
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

function pickKind(r: Rng, f: FactionId): Kind {
  return weighted(r, FACTIONS[f].troops, ([, w]) => w)![0];
}

/** その場限りの侍大将の部隊を作る */
function tempUnit(c: Campaign, so: Sortie, id: string, p: Placement, danger: number, cut: number, r: Rng): UnitSpec {
  const t = so.temps[id];
  const pw = powerOf(t.custom.cmd, t.custom.pow, t.custom.int, t.lv);
  const max = Math.round(enemyTroops(danger, t.kind, false) * (0.8 + range(r, 0, 40) / 100));
  const traits: Trait[] = chance(r, 0.3) ? [pick(r, GENERIC_TRAITS)] : [];
  return {
    gen: id, name: t.custom.name, short: t.custom.short, portrait: t.custom.portrait, kind: t.kind, lv: t.lv, ...pw,
    troops: Math.max(1, Math.round(max * (1 - cut))), maxTroops: max, row: p.row, slot: p.slot, skills: kindSkills(t.kind, t.lv), youkai: t.kind === 'youkai',
    apBonus: Math.floor(t.lv / 15), traits,
  };
}

/** 敵の部隊を並べる（名のある将＋侍大将） */
function enemyArmy(c: Campaign, so: Sortie, seed: number, faction: FactionId, danger: number, size: number, named: { id: string; boss?: boolean }[], cut = 0): UnitSpec[] {
  const r = rngFor(seed, 'army', so.region, so.land ?? 0);
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
    return item.temp ? tempUnit(c, so, item.id, p, danger, cut, r) : unitSpecOf(c, item.id, p, false, { boss: item.boss, danger, cut });
  });
}

/** 城攻めの守りの部隊（領地の番号ごと） */
export function siegeArmy(c: Campaign, so: Sortie, seed: number): UnitSpec[] {
  const rid = so.region;
  const rs = c.regions[rid];
  const n = rs.lands.length;
  const f = so.land ?? 0;
  const danger = castleDanger(c, rid) + Math.floor(f / 2);
  const final = f >= n - 1;
  const named: { id: string; boss?: boolean }[] = [];
  if (final && rs.boss && c.gens[rs.boss]?.status === 'enemy') named.push({ id: rs.boss, boss: true });
  if (rs.mid && c.gens[rs.mid]?.status === 'enemy' && (final || f === n - 2)) named.push({ id: rs.mid });
  const size = Math.max(named.length, Math.min(6, 2 + Math.floor(danger / 6) + (final ? 1 : 0)));
  const units=enemyArmy(c, so, seed, rs.owner, danger, size, named, rs.sabotage);
  if(rid==='13'&&final&&c.strategy?.route){
    for(const u of units){
      if(c.strategy.route==='seal'&&c.strategy.seals.length>=2){u.atk=Math.max(1,u.atk-2);u.def=Math.max(0,u.def-1);}
      if(c.strategy.route==='hado'){u.troops=Math.min(u.maxTroops,Math.round(u.troops*1.12));u.apBonus=(u.apBonus??0)+1;}
      if(c.strategy.route==='pact'){u.spd=Math.max(0,u.spd-1);}
    }
  }
  return units;
}

/** 攻めてきた軍（大将＋侍大将） */
export function invasionArmy(c: Campaign, so: Sortie, inv: Invasion, seed: number): UnitSpec[] {
  const size = Math.min(6, 2 + Math.floor(inv.danger / 4));
  return enemyArmy(c, so, seed, inv.faction, inv.danger, size, c.gens[inv.commander] ? [{ id: inv.commander, boss: true }] : []);
}

/** 妖魔討伐の群れ */
export function huntArmy(c: Campaign, so: Sortie, seed: number, danger: number): UnitSpec[] {
  const size = Math.min(6, 3 + Math.floor(danger / 8));
  return enemyArmy(c, so, seed, 'youma', danger, size, []);
}

/** 味方の部隊（陣立てのとおり） */
export function partyUnits(c: Campaign, party: Placement[]): UnitSpec[] {
  return party.map((p) => unitSpecOf(c, p.gen, p, true));
}

export function battleSpec(kind: BattleSpec['kind'], region: string, seed: number, L: UnitSpec[], R: UnitSpec[], defender: 'L' | 'R', ground: Ground, bonusL = 0): BattleSpec {
  return { seed, kind, region, defender, ground, L, R, ticks: DEFAULT_TICKS, bonus: { L: bonusL } };
}

// ── 兵の補充・増員・維持費 ──

/** 傷ついた兵をすぐ戻す文（10人あたり 足軽1・他4） */
export function healCost(c: Campaign, id: string): number {
  const g = c.gens[id];
  const n = Math.min(g.wounded, Math.max(0, maxTroops(c, id) - g.troops));
  return Math.ceil((n / 10) * KINDS[g.kind].heal);
}

/** 上限まで新しく兵を雇う文（10人あたり増員費の1/4） */
export function hireCost(c: Campaign, id: string): number {
  const g = c.gens[id];
  const n = Math.max(0, maxTroops(c, id) - g.troops - g.wounded);
  return Math.ceil((n / 10) * KINDS[g.kind].hire * 0.25);
}

/** 武将1人の維持費：1＋兵500ごとに+1 */
export function upkeepOf(g: GenState): number {
  return 1 + Math.floor((g.troops + g.wounded) / 500);
}
