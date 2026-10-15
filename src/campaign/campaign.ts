// 国盗りの進行：出陣・修行・内政・交流・城下・ターンの終わり・敵の手番・冒険の結果
import { FACTIONS, FACTION_IDS, FINAL, HOME, REGIONS, TERRAIN_BAND, regionDef, type FactionId } from '../content/sengoku';
import { GENERALS, GENERIC_TYPES, GEN_BY_ID, GIVEN_NAMES, LORD, ONI_NAMES, SURNAMES, type GenDef, type FightStyle } from '../content/generals';
import { ITEMS, itemDef } from '../content/items';
import { chance, hashSeed, int, pick, range, shuffle, weighted, type Rng } from '../engine/rng';
import { buyPrice, expFor, sellPrice } from '../engine/core';
import { makeFakeNames, type BattleSpec } from '../engine/run';
import type { GenSpec, Item, Run, RunMode } from '../engine/types';
import { CAMPAIGN_VERSION, type Campaign, type CustomGen, type GenState, type Invasion, type News, type Scene } from './state';
import { DEFEAT, ENDING, FINAL_CALL, FIRST_WIN, OPENING, SEASON_TALK, UNIFIED, YOUMA_WAKES, factionFallen } from './events';

export const MAX_AP = 3;
export const MAX_PARTY = 2;
export const MAX_CARRY = 10;
export const MAX_STORE = 80;
export const YOUMA_TURN = 8;
/** 経験値の倍率（レベルが冒険をまたいで残るので、迷宮1回分より少なく） */
export const EXP_RATE = 0.22;

// ── 乱数 ──

function rngOf(c: Campaign): Rng { return { s: c.rng }; }
function useRng<T>(c: Campaign, fn: (r: Rng) => T): T {
  const r = rngOf(c);
  const out = fn(r);
  c.rng = r.s;
  return out;
}

function news(c: Campaign, t: string, cl?: News['c']) {
  c.news.push(cl ? { turn: c.turn, t, c: cl } : { turn: c.turn, t });
  if (c.news.length > 80) c.news.splice(0, c.news.length - 80);
}

// ── 武将の情報 ──

export interface GenInfo {
  id: string;
  name: string;
  short: string;
  portrait: string;
  cmd: number;
  pow: number;
  int: number;
  cha: number;
  skills: string[];
  style: FightStyle;
  youkai: boolean;
  role: string;
  desc: string;
  unique: boolean;
  def?: GenDef;
}

export function genInfo(c: Campaign, id: string): GenInfo {
  const def = GEN_BY_ID[id];
  if (def) {
    return {
      id, name: def.name, short: def.short, portrait: def.portrait, cmd: def.cmd, pow: def.pow, int: def.int, cha: def.cha,
      skills: [...def.skills], style: def.style, youkai: !!def.youkai, role: def.role, desc: def.desc, unique: true, def,
    };
  }
  const cu = c.gens[id]?.custom;
  if (!cu) throw new Error(`unknown general ${id}`);
  return {
    id, name: cu.name, short: cu.short, portrait: cu.portrait, cmd: cu.cmd, pow: cu.pow, int: cu.int, cha: 50,
    skills: [cu.skill], style: cu.style, youkai: !!cu.youkai, role: cu.label, desc: `${FACTIONS[c.gens[id].faction].name}に仕えていた${cu.label}。`, unique: false,
  };
}

/** 今使える技（絆2で2つ目） */
export function activeSkills(c: Campaign, id: string): string[] {
  const info = genInfo(c, id);
  const g = c.gens[id];
  if (id === LORD) return ownedCount(c) >= 5 || c.flags.lordBond ? info.skills : info.skills.slice(0, 1);
  return info.unique && g.bond >= 2 ? info.skills : info.skills.slice(0, 1);
}

/** 迷宮に渡す武将の情報 */
export function specOf(c: Campaign, id: string, ally: boolean, role?: GenSpec['role']): GenSpec {
  const info = genInfo(c, id);
  const g = c.gens[id];
  return {
    id, name: info.name, short: info.short, portrait: info.portrait, faction: ally ? 'akatsuki' : g.faction,
    lv: g.lv, exp: g.exp, cmd: info.cmd, pow: info.pow, int: info.int, skills: ally ? activeSkills(c, id) : info.skills,
    style: info.style, youkai: info.youkai, ally, role,
    intro: info.def?.intro || undefined, defeat: info.def?.defeat || (ally ? undefined : `${info.short}「無念……！」`),
  };
}

// ── 新しい戦 ──

function starterItem(c: Campaign, id: string, extra: Partial<Item> = {}): Item {
  const def = itemDef(id);
  const item: Item = { uid: c.nextUid++, id, ...extra };
  if (def.cat === 'weapon' || def.cat === 'armor') { item.plus ??= 0; item.seals ??= []; item.cursed = false; item.known = true; }
  if (def.cat === 'staff' && def.charges) item.charges = def.charges[1];
  if (def.cat === 'arrow') item.count = 20;
  return item;
}

export function newCampaign(seed: number): Campaign {
  const c: Campaign = {
    v: CAMPAIGN_VERSION, seed: seed | 0, rng: hashSeed(seed, 'campaign'), turn: 1, ap: MAX_AP, gold: 1500,
    regions: {}, factions: {} as Campaign['factions'], gens: {},
    lord: { lv: 3, exp: expFor(3), maxHp: 32, str: 8, maxStr: 8, maxHunger: 100 },
    store: [], eq: {}, nextUid: 1, nextGen: 1,
    known: {}, fake: makeFakeNames(seed), named: {},
    news: [], flags: {}, scenes: [...OPENING], invasions: [], captives: [], sortie: null, stock: [],
    stats: { battles: 0, wins: 0, losses: 0, kills: 0, captured: 0, hunts: 0, defenses: 0, maxHit: 0 },
    titles: {},
  };
  for (const f of FACTION_IDS) c.factions[f] = { alive: true };
  for (const r of REGIONS) {
    c.regions[r.id] = { id: r.id, owner: r.owner, troops: r.owner === 'akatsuki' ? 500 : 300 + r.danger * 40, dev: 1, wall: r.capital ? 2 : 1, breach: 0 };
    if (r.owner !== 'akatsuki') { c.regions[r.id].boss = r.boss; if (r.mid) c.regions[r.id].mid = r.mid; }
  }
  for (const def of GENERALS) {
    const home = REGIONS.find((r) => r.boss === def.id || r.mid === def.id);
    const ours = def.faction === 'akatsuki';
    const lv = ours ? (def.id === LORD ? 3 : 3 + (def.lvBonus ?? 0)) : Math.max(2, (home?.danger ?? 5) + (home?.mid === def.id ? 0 : 1) + (def.lvBonus ?? 0));
    c.gens[def.id] = { id: def.id, status: ours ? 'ours' : 'enemy', faction: def.faction, lv, exp: expFor(lv), bond: 0, injured: 0 };
  }
  // 最初の蔵：朔の刀と胴丸、薬草とおにぎり
  const w = starterItem(c, 'w_dou');
  const a = starterItem(c, 'a_dou');
  c.store.push(w, a, starterItem(c, 'g_yakusou'), starterItem(c, 'g_yakusou'), starterItem(c, 'g_yakusou'), starterItem(c, 'f_onigiri'), starterItem(c, 'f_onigiri'), starterItem(c, 's_shikibetsu'), starterItem(c, 's_kikan'));
  c.eq = { weapon: w.uid, armor: a.uid };
  for (const id of ['g_yakusou', 'f_onigiri', 's_shikibetsu', 's_kikan']) c.known[id] = true;
  rerollStock(c);
  ensureRonin(c);
  news(c, '暁ノ家の当主・風間朔が家督を継いだ。', 'info');
  return c;
}

// ── 調べる ──

export function ownedRegions(c: Campaign) { return Object.values(c.regions).filter((r) => r.owner === 'akatsuki'); }
export function ownedCount(c: Campaign) { return ownedRegions(c).length; }
export function regionsOf(c: Campaign, f: FactionId) { return Object.values(c.regions).filter((r) => r.owner === f); }

/** 隣に自分の国がある敵の国（攻められる） */
export function canAttack(c: Campaign, rid: string): boolean {
  const r = c.regions[rid];
  if (!r || r.owner === 'akatsuki') return false;
  return regionDef(rid).adj.some((a) => c.regions[a].owner === 'akatsuki');
}

export function ourGenerals(c: Campaign): GenState[] {
  return Object.values(c.gens).filter((g) => g.status === 'ours' && g.id !== LORD);
}

export function readyGenerals(c: Campaign): GenState[] {
  return ourGenerals(c).filter((g) => g.injured <= 0);
}

/** 城の強さ（時が経つと少し固くなる） */
export function castleDanger(c: Campaign, rid: string): number {
  const def = regionDef(rid);
  return def.danger + Math.min(3, Math.floor((c.turn - 1) / 15));
}

export function castleFloors(rid: string): number {
  return regionDef(rid).floors;
}

/** 守りの強さ */
export function defensePower(c: Campaign, rid: string): number {
  const r = c.regions[rid];
  return r.wall * 150 + r.troops;
}

export function income(c: Campaign): number {
  return ownedRegions(c).reduce((sum, r) => sum + Math.round(regionDef(r.id).income * (1 + 0.3 * (r.dev - 1))), 0);
}

// ── 出陣の準備 ──

export interface SortiePlan { party: string[]; carry: number[] }

function lordSkills(c: Campaign): string[] { return activeSkills(c, LORD); }

/** 蔵から持っていく物（装備は必ず持つ） */
function takeCarry(c: Campaign, carry: number[]): { items: Item[]; eq: Campaign['eq'] } {
  const eqUids = new Set(Object.values(c.eq).filter((u): u is number => u !== undefined));
  const chosen = new Set(carry.slice(0, MAX_CARRY));
  const items = c.store.filter((i) => eqUids.has(i.uid) || chosen.has(i.uid));
  return { items: JSON.parse(JSON.stringify(items)) as Item[], eq: { ...c.eq } };
}

function checkParty(c: Campaign, party: string[]): string[] {
  const ok = party.filter((id, i) => party.indexOf(id) === i && c.gens[id]?.status === 'ours' && c.gens[id].injured <= 0 && id !== LORD);
  return ok.slice(0, MAX_PARTY);
}

export function sortieError(c: Campaign, mode: RunMode, rid: string): string | null {
  if (c.defeat) return '戦は終わった';
  if (c.sortie) return '出陣中';
  if (mode === 'defense') return null;
  if (c.ap <= 0) return 'この季節の行動は残っていない';
  if (mode === 'siege' && !canAttack(c, rid)) return '隣の国ではない';
  if (mode === 'hunt' && c.regions[rid]?.owner !== 'akatsuki') return '自分の国ではない';
  return null;
}

/** 出陣する：本陣の状態を出陣中にし、冒険の作り方を返す */
export function depart(c: Campaign, mode: RunMode, rid: string, plan: SortiePlan, seed: number, inv?: Invasion): BattleSpec {
  const err = sortieError(c, mode, rid);
  if (err) throw new Error(err);
  const party = checkParty(c, plan.party);
  const { items, eq } = takeCarry(c, plan.carry);
  const carried = new Set(items.map((i) => i.uid));
  c.store = c.store.filter((i) => !carried.has(i.uid));
  c.eq = {};
  if (mode !== 'defense') c.ap -= 1;
  c.sortie = { mode, region: rid, party, invasion: inv };
  c.stats.battles += 1;
  const gens = party.map((id) => specOf(c, id, true));
  const def = regionDef(rid);
  let danger0 = castleDanger(c, rid);
  let floors = def.floors;
  let faction: FactionId = c.regions[rid].owner;
  let startFloor = 1;
  if (mode === 'siege') {
    const r = c.regions[rid];
    if (r.boss) gens.push(specOf(c, r.boss, false, 'boss'));
    if (r.mid && c.gens[r.mid]?.status === 'enemy') gens.push(specOf(c, r.mid, false, 'mid'));
    startFloor = Math.min(floors, r.breach + 1);
  } else if (mode === 'hunt') {
    faction = 'youma';
    floors = 3;
    danger0 = Math.max(2, Math.min(c.lord.lv + 1, def.danger + 2 + Math.floor(c.turn / 3)));
  } else if (mode === 'defense' && inv) {
    faction = inv.faction;
    floors = 1;
    danger0 = invasionDanger(c, inv.from);
    gens.push(specOf(c, inv.commander, false, 'commander'));
  }
  return {
    mode, seed, region: rid, faction, danger0, floors, startFloor, lord: { ...c.lord }, items, eq,
    known: { ...c.known }, fake: { ...c.fake }, named: { ...c.named }, gens, band0: TERRAIN_BAND[def.terrain], lordSkills: lordSkills(c), expRate: EXP_RATE,
  };
}

/** 出陣の記録が壊れていた時：持ち物は戻らず、部隊は傷を負って帰る */
export function abortSortie(c: Campaign) {
  const so = c.sortie;
  if (!so) return;
  for (const id of so.party) if (c.gens[id]) c.gens[id].injured = Math.max(c.gens[id].injured, 1);
  if (so.invasion) loseRegion(c, so.region, so.invasion.faction, so.invasion.commander);
  c.sortie = null;
  news(c, '出陣の記録が途切れていた。部隊は傷を負って本陣へ戻った。', 'bad');
  checkFactions(c);
}

// ── 冒険の結果 ──

export interface Report {
  kind: 'win' | 'retreat' | 'lose';
  mode: RunMode;
  region: string;
  title: string;
  lines: string[];
  gold: number;
  items: number;
  lostItems: number;
  captured: string[];
}

function storeAdd(c: Campaign, item: Item): boolean {
  if (c.store.length >= MAX_STORE) { c.gold += sellPrice(item); return false; }
  c.store.push(item);
  return true;
}

export function finishSortie(c: Campaign, run: Run): Report {
  const so = c.sortie;
  if (!so) throw new Error('出陣していない');
  const end = run.end ?? { kind: 'quit' as const, cause: '退却', floor: run.floorNo };
  const win = end.kind === 'clear';
  const kept = win || end.kind === 'return';
  const def = regionDef(so.region);
  const rep: Report = { kind: win ? 'win' : end.kind === 'return' ? 'retreat' : 'lose', mode: so.mode, region: so.region, title: '', lines: [], gold: 0, items: 0, lostItems: 0, captured: [] };
  // 朔の強さ
  const p = run.player;
  c.lord = { lv: p.lv, exp: p.exp, maxHp: p.maxHp, str: p.maxStr, maxStr: p.maxStr, maxHunger: p.maxHunger };
  c.known = { ...c.known, ...run.known };
  c.named = { ...run.named };
  c.stats.kills += run.stats.kills;
  c.stats.maxHit = Math.max(c.stats.maxHit, run.stats.maxHit ?? 0);
  // 武将の成長と傷
  for (const id of so.party) {
    const g = c.gens[id];
    const sp = run.gens[id];
    if (g && sp) { g.lv = sp.lv; g.exp = sp.exp; }
    if (run.fallen.includes(id) || !kept) g.injured = Math.max(g.injured, run.fallen.includes(id) ? 2 : 1);
  }
  // 持ち物と文
  const inv = run.player.inv.filter((i) => !i.shop);
  const eqUids = run.player.eq;
  const keepEq = new Set(Object.values(eqUids).filter((u): u is number => u !== undefined));
  for (const item of inv) {
    if (!kept && !keepEq.has(item.uid)) { rep.lostItems += 1; continue; }
    const copy: Item = { ...item, uid: c.nextUid++ };
    if (copy.contents) copy.contents = copy.contents.map((x) => ({ ...x, uid: c.nextUid++ }));
    delete copy.shop;
    let isEq = false;
    for (const slot of ['weapon', 'armor', 'charm', 'arrow'] as const) if (eqUids[slot] === item.uid) { c.eq[slot] = copy.uid; isEq = true; }
    // 装備は蔵がいっぱいでも必ず戻す
    if (isEq) { c.store.push(copy); rep.items += 1; } else if (storeAdd(c, copy)) rep.items += 1;
  }
  if (kept) { c.gold += run.player.gold; rep.gold = run.player.gold; }
  // 捕らえた将
  for (const id of run.captured) {
    if (!c.gens[id] || c.gens[id].status !== 'enemy') continue;
    rep.captured.push(id);
    capture(c, id);
  }
  const rs = c.regions[so.region];
  if (so.mode === 'siege') {
    if (win) {
      takeRegion(c, so.region);
      rep.title = `${def.name}を落とした！`;
      rep.lines.push(`${def.name}は暁ノ家の国になった。`);
      c.stats.wins += 1;
      if (!c.flags.firstWin) { c.flags.firstWin = true; c.scenes.push(FIRST_WIN); }
    } else {
      const reached = Math.max(0, run.stats.maxFloor - (kept ? 1 : 2));
      if (reached > rs.breach) { rs.breach = Math.min(def.floors - 1, reached); rep.lines.push(`城門を${rs.breach}階まで破った。次はその先から攻められる。`); }
      // 中の階の将を倒していれば、城から外れる
      if (rs.mid && c.gens[rs.mid]?.status !== 'enemy') delete rs.mid;
      rep.title = kept ? `${def.name}から撤退した` : `${def.name}の攻略に失敗した……`;
      if (!kept) c.stats.losses += 1;
    }
  } else if (so.mode === 'defense' && so.invasion) {
    if (win) {
      rep.title = `${def.name}を守り抜いた！`;
      rep.lines.push(`${FACTIONS[so.invasion.faction].name}の軍を追い返した。`);
      c.stats.wins += 1;
      c.stats.defenses += 1;
    } else {
      rep.title = `${def.name}を奪われた……`;
      loseRegion(c, so.region, so.invasion.faction, so.invasion.commander);
      c.stats.losses += 1;
    }
    cleanupCommander(c, so.invasion.commander);
  } else if (so.mode === 'hunt') {
    if (win) {
      const bonus = 150 + castleDanger(c, so.region) * 20;
      c.gold += bonus;
      rep.gold += bonus;
      rep.title = '妖魔の巣を祓った！';
      rep.lines.push(`村人からお礼に${bonus}文が届いた。`);
      c.stats.hunts += 1;
    } else rep.title = kept ? '妖魔の巣から引き上げた' : '妖魔の巣で倒れた……';
  }
  if (!kept) rep.lines.push(`朔は傷を負って本陣へ運ばれた。装備以外の持ち物${rep.lostItems}個と、拾った文を失った。`);
  if (run.fallen.length) rep.lines.push(`${run.fallen.map((id) => genInfo(c, id).short).join('・')}は深手を負い、しばらく出陣できない。`);
  c.sortie = null;
  checkFactions(c);
  checkEnd(c);
  checkTitles(c);
  return rep;
}

/** 捕らえた：忠義の将は牢へ、ほかは登用を決める */
function capture(c: Campaign, id: string) {
  const g = c.gens[id];
  const def = GEN_BY_ID[id];
  c.stats.captured += 1;
  for (const r of Object.values(c.regions)) {
    if (r.boss === id) delete r.boss;
    if (r.mid === id) delete r.mid;
  }
  if (def?.never) {
    g.status = 'gone';
    if (id === 'g_kurobuchi' && !c.victory) {
      c.victory = c.turn;
      c.scenes.push(...ENDING);
      news(c, '蛟王黒淵を討ち取った！ 黄泉沼の霧が晴れていく。', 'good');
    }
    return;
  }
  if (def?.loyal && c.factions[g.faction].alive && regionsOf(c, g.faction).length > 0) {
    g.status = 'jail';
    c.scenes.push({ title: '捕縛', lines: [[id, def.refuse ?? `${def.short}「……主家ある限り、仕えぬ」`], ['', `${def.name}を牢に入れた。主家が滅べば、心を変えるかもしれない。`]] });
    news(c, `${def.name}を捕らえ、牢に入れた。`, 'info');
    return;
  }
  g.status = 'jail';
  c.captives.push(id);
}

export function recruit(c: Campaign, id: string): Scene | null {
  const i = c.captives.indexOf(id);
  if (i < 0) return null;
  c.captives.splice(i, 1);
  const g = c.gens[id];
  g.status = 'ours';
  g.faction = g.faction === 'akatsuki' ? 'akatsuki' : g.faction;
  g.injured = 0;
  const info = genInfo(c, id);
  news(c, `${info.name}が家臣に加わった。`, 'good');
  checkTitles(c);
  return { title: '登用', mood: 'victory', lines: [[id, info.def?.join || `${info.short}「拾ってもらった命、暁ノ家のために使おう」`], ['', `${info.name}が家臣になった！`]] };
}

export function release(c: Campaign, id: string) {
  const i = c.captives.indexOf(id);
  if (i < 0) return;
  c.captives.splice(i, 1);
  const g = c.gens[id];
  g.status = 'ronin';
  g.wage = wageOf(g);
  news(c, `${genInfo(c, id).name}を解き放った。浪人宿で会えるかもしれない。`, 'info');
}

function takeRegion(c: Campaign, rid: string) {
  const r = c.regions[rid];
  const prev = r.owner;
  r.owner = 'akatsuki';
  r.breach = 0;
  r.troops = 300;
  delete r.boss;
  // 逃げた中の階の将は、同じ家の別の城へ
  if (r.mid) {
    const mid = r.mid;
    delete r.mid;
    fleeGeneral(c, mid, prev);
  }
  news(c, `${regionDef(rid).name}を手に入れた。`, 'good');
  if (rid === FINAL && !c.flags.finalTaken) c.flags.finalTaken = true;
}

function fleeGeneral(c: Campaign, id: string, faction: FactionId) {
  const g = c.gens[id];
  if (!g || g.status !== 'enemy') return;
  const dest = regionsOf(c, faction).find((x) => !x.mid);
  if (dest) { dest.mid = id; news(c, `${genInfo(c, id).name}は${regionDef(dest.id).name}へ落ちのびた。`, 'info'); }
  else { g.status = 'ronin'; g.wage = wageOf(g); news(c, `${genInfo(c, id).name}は浪人になった。`, 'info'); }
}

function loseRegion(c: Campaign, rid: string, f: FactionId, commander?: string) {
  const r = c.regions[rid];
  r.owner = f;
  r.breach = 0;
  r.troops = 300;
  r.dev = Math.max(1, r.dev - 1);
  const boss = commander && c.gens[commander]?.status === 'enemy' ? commander : makeGeneric(c, f, Math.max(3, regionDef(rid).danger + 2));
  r.boss = boss;
  news(c, `${regionDef(rid).name}が${FACTIONS[f].name}に奪われた。`, 'bad');
  if (rid === HOME) {
    c.defeat = c.turn;
    c.scenes.push(DEFEAT);
  }
}

function cleanupCommander(c: Campaign, id: string) {
  const g = c.gens[id];
  if (!g || GEN_BY_ID[id]) return;
  const inUse = Object.values(c.regions).some((r) => r.boss === id || r.mid === id);
  if (g.status === 'enemy' && !inUse) delete c.gens[id];
}

/** 勢力が滅んだか。牢の将は主家が滅ぶと仕える */
function checkFactions(c: Campaign) {
  for (const f of FACTION_IDS) {
    if (f === 'akatsuki' || !c.factions[f].alive) continue;
    if (regionsOf(c, f).length > 0) continue;
    c.factions[f].alive = false;
    c.scenes.push(factionFallen(f));
    news(c, `${FACTIONS[f].name}が滅んだ。`, 'good');
    c.invasions = c.invasions.filter((inv) => inv.faction !== f);
    for (const g of Object.values(c.gens)) {
      if (g.faction !== f) continue;
      if (g.status === 'jail' && !c.captives.includes(g.id)) {
        g.status = 'ours';
        g.injured = 0;
        const info = genInfo(c, g.id);
        c.scenes.push({ title: '帰順', mood: 'victory', lines: [[g.id, info.def?.join || `${info.short}「主家は滅んだ。……これからは、そなたに仕えよう」`], ['', `${info.name}が家臣になった！`]] });
        news(c, `${info.name}が家臣に加わった。`, 'good');
      } else if (g.status === 'enemy') {
        if (GEN_BY_ID[g.id]) { g.status = 'ronin'; g.wage = wageOf(g); } else delete c.gens[g.id];
      }
    }
  }
}

function checkEnd(c: Campaign) {
  if (!c.flags.unified && ownedCount(c) === REGIONS.length) {
    c.flags.unified = true;
    c.scenes.push(UNIFIED);
    news(c, '八洲十五国をすべて手に入れた！ 天下統一！', 'good');
  }
}

// ── 称号 ──

export const TITLES: { id: string; name: string; desc: string }[] = [
  { id: 'first', name: '初陣', desc: '初めて城を落とした' },
  { id: 'five', name: '五国の主', desc: '国を5つ持った' },
  { id: 'ten', name: '十国の覇者', desc: '国を10持った' },
  { id: 'unify', name: '天下人', desc: '八洲十五国をすべて手に入れた' },
  { id: 'kurobuchi', name: '霧祓い', desc: '蛟王黒淵を討ち取った' },
  { id: 'gens10', name: '人望厚き主', desc: '家臣が10人を超えた' },
  { id: 'gensall', name: '綺羅星', desc: '固有の武将をすべて家臣にした' },
  { id: 'defend3', name: '鉄壁の守り', desc: '攻めてきた敵を3度追い返した' },
  { id: 'hunt5', name: '妖魔祓い', desc: '妖魔の巣を5回祓った' },
  { id: 'lv30', name: '剣聖', desc: '朔がレベル30になった' },
  { id: 'rich', name: '長者', desc: '文を3万貯めた' },
  { id: 'fast', name: '電光石火', desc: '20ターン以内に黒淵を討った' },
];

export function checkTitles(c: Campaign) {
  const give = (id: string, ok: boolean) => {
    if (ok && !c.titles[id]) { c.titles[id] = true; news(c, `称号「${TITLES.find((t) => t.id === id)!.name}」を得た！`, 'good'); }
  };
  const n = ownedCount(c);
  give('first', c.stats.wins > 0 && n > 1);
  give('five', n >= 5);
  give('ten', n >= 10);
  give('unify', n === REGIONS.length);
  give('kurobuchi', !!c.victory);
  give('gens10', ourGenerals(c).length >= 10);
  give('gensall', GENERALS.filter((g) => !g.never).every((g) => c.gens[g.id]?.status === 'ours'));
  give('defend3', c.stats.defenses >= 3);
  give('hunt5', c.stats.hunts >= 5);
  give('lv30', c.lord.lv >= 30);
  give('rich', c.gold >= 30000);
  give('fast', !!c.victory && c.victory <= 20);
}

// ── 内政 ──

export type DevKind = 'dev' | 'wall' | 'troops';

export function devCost(c: Campaign, rid: string, kind: DevKind): number {
  const r = c.regions[rid];
  if (kind === 'dev') return 400 * r.dev;
  if (kind === 'wall') return 500 * r.wall;
  return 400;
}

export function devError(c: Campaign, rid: string, kind: DevKind): string | null {
  const r = c.regions[rid];
  if (!r || r.owner !== 'akatsuki') return '自分の国ではない';
  if (c.ap <= 0) return 'この季節の行動は残っていない';
  if (kind === 'dev' && r.dev >= 5) return 'これ以上は開けない';
  if (kind === 'wall' && r.wall >= 5) return 'これ以上は高くできない';
  if (kind === 'troops' && r.troops >= 1500) return '兵はもう十分';
  if (c.gold < devCost(c, rid, kind)) return '文が足りない';
  return null;
}

export function develop(c: Campaign, rid: string, kind: DevKind): string {
  const err = devError(c, rid, kind);
  if (err) throw new Error(err);
  const r = c.regions[rid];
  c.gold -= devCost(c, rid, kind);
  c.ap -= 1;
  const name = regionDef(rid).name;
  if (kind === 'dev') { r.dev += 1; news(c, `${name}の田畑を開いた（開発${r.dev}）。`, 'good'); return `${name}の年貢が増えた。`; }
  if (kind === 'wall') { r.wall += 1; news(c, `${name}の城を固めた（城${r.wall}）。`, 'good'); return `${name}の守りが固くなった。`; }
  r.troops = Math.min(1500, r.troops + 300);
  news(c, `${name}で兵を集めた（兵${r.troops}）。`, 'good');
  return `${name}の兵が増えた。`;
}

// ── 交流 ──

export function bondError(c: Campaign, id: string): string | null {
  const g = c.gens[id];
  if (!g || g.status !== 'ours' || id === LORD) return '家臣ではない';
  if (c.ap <= 0) return 'この季節の行動は残っていない';
  const def = GEN_BY_ID[id];
  if (def && g.bond >= def.bond.length) return 'もう十分に分かり合っている';
  if (!def && g.bond >= 2) return 'もう十分に分かり合っている';
  return null;
}

export function doBond(c: Campaign, id: string): Scene {
  const err = bondError(c, id);
  if (err) throw new Error(err);
  const g = c.gens[id];
  const def = GEN_BY_ID[id];
  c.ap -= 1;
  // 交流でも少し腕が上がる
  g.exp = Math.max(g.exp, expFor(g.lv + 1));
  g.lv += 1;
  if (def) {
    const ev = def.bond[g.bond];
    g.bond += 1;
    news(c, `${def.short}と語らった。（絆${g.bond}）`, 'good');
    return { title: `${def.short} ── ${ev.title}`, lines: [...ev.lines, ['', `${def.short}のレベルが${g.lv}に上がった。`]] };
  }
  const info = genInfo(c, id);
  g.bond += 1;
  news(c, `${info.short}と酒を酌み交わした。`, 'good');
  return {
    title: `${info.short}と酒宴`,
    lines: [
      [id, pickLine(c, [`殿、この酒はうまいですな！`, `拾っていただいた恩、戦で返しますぞ。`, `いつか故郷の村にも、殿の旗を立ててくだされ。`, `次の戦、先陣はぜひ拙者に！`])],
      ['g_saku', 'おう。頼りにしてるぜ。'],
      ['', `${info.short}のレベルが${g.lv}に上がった。`],
    ],
  };
}

function pickLine(c: Campaign, lines: string[]): string {
  return useRng(c, (r) => pick(r, lines));
}

// ── 城下：蔵・装備・鍛冶・商人・浪人宿 ──

export function equipStore(c: Campaign, uid: number): string | null {
  const item = c.store.find((i) => i.uid === uid);
  if (!item) return null;
  const cat = itemDef(item.id).cat;
  const slot = cat === 'weapon' ? 'weapon' : cat === 'armor' ? 'armor' : cat === 'charm' ? 'charm' : cat === 'arrow' ? 'arrow' : null;
  if (!slot) return 'それは装備できない';
  const cur = c.eq[slot] !== undefined ? c.store.find((i) => i.uid === c.eq[slot]) : null;
  if (cur && cur.uid === uid) {
    if (cur.cursed && slot !== 'arrow') return '呪われていて外せない';
    delete c.eq[slot];
    return null;
  }
  if (cur && cur.cursed && slot !== 'arrow') return '今の装備が呪われていて外せない';
  c.eq[slot] = uid;
  item.known = true;
  if (cat === 'charm') c.known[item.id] = true;
  return null;
}

export function isEquippedStore(c: Campaign, uid: number): boolean {
  return Object.values(c.eq).includes(uid);
}

export function sellStore(c: Campaign, uid: number): number {
  const i = c.store.findIndex((x) => x.uid === uid);
  if (i < 0 || isEquippedStore(c, uid)) return 0;
  const price = sellPrice(c.store[i]);
  c.store.splice(i, 1);
  c.gold += price;
  return price;
}

export function smithCost(item: Item): number {
  const def = itemDef(item.id);
  return Math.round(200 * ((item.plus ?? 0) + 1) + def.price * 0.3);
}

export function smith(c: Campaign, uid: number): string | null {
  const item = c.store.find((i) => i.uid === uid);
  if (!item) return '品が無い';
  const cat = itemDef(item.id).cat;
  if (cat !== 'weapon' && cat !== 'armor') return '武器と防具だけ鍛えられる';
  if ((item.plus ?? 0) >= 30) return 'これ以上は鍛えられない';
  const cost = smithCost(item);
  if (c.gold < cost) return '文が足りない';
  c.gold -= cost;
  item.plus = (item.plus ?? 0) + 1;
  item.cursed = false;
  item.known = true;
  return null;
}

/** 商人の品（その時点で手に入る国の数で品ぞろえが良くなる） */
export function rerollStock(c: Campaign) {
  const level = 2 + ownedCount(c) * 2;
  useRng(c, (r) => {
    const always = ['f_onigiri', 'g_yakusou', 's_shikibetsu'];
    const pool = ITEMS.filter((d) => d.weight > 0 && d.cat !== 'gold' && d.minFloor <= level && !always.includes(d.id) && d.price >= 50);
    const picks: string[] = [...always];
    for (let i = 0; i < 6; i++) {
      const d = weighted(r, pool, (x) => x.weight);
      if (d && !picks.includes(d.id)) picks.push(d.id);
    }
    if (ownedCount(c) >= 3 && !picks.includes('s_kikan')) picks.push('s_kikan');
    c.stock = picks;
  });
}

export function stockPrice(id: string): number {
  return Math.round(buyPrice(stockItem(id, 0)) * 1.2);
}

function stockItem(id: string, uid: number): Item {
  const def = itemDef(id);
  const item: Item = { uid, id };
  if (def.cat === 'weapon' || def.cat === 'armor') { item.plus = 0; item.seals = []; item.cursed = false; item.known = true; }
  if (def.cat === 'staff' && def.charges) item.charges = def.charges[0];
  if (def.cat === 'pot' && def.cap) { item.cap = def.cap[0]; item.contents = []; }
  if (def.cat === 'arrow') item.count = 15;
  return item;
}

export function buy(c: Campaign, id: string): string | null {
  if (!c.stock.includes(id)) return '品切れ';
  const price = stockPrice(id);
  if (c.gold < price) return '文が足りない';
  if (c.store.length >= MAX_STORE) return '蔵がいっぱい';
  c.gold -= price;
  const item = stockItem(id, c.nextUid++);
  item.known = true;
  c.known[id] = true;
  c.store.push(item);
  return null;
}

function wageOf(g: GenState): number {
  return 300 + g.lv * 90 + (GEN_BY_ID[g.id] ? 600 : 0);
}

export function roninList(c: Campaign): GenState[] {
  return Object.values(c.gens).filter((g) => g.status === 'ronin');
}

/** 浪人宿に、名もなき浪人を2人ほど置いておく */
export function ensureRonin(c: Campaign) {
  const generics = roninList(c).filter((g) => !GEN_BY_ID[g.id]);
  for (let i = generics.length; i < 2; i++) {
    const lv = Math.max(2, Math.round(c.lord.lv * 0.8));
    const id = makeGeneric(c, 'ronin', lv);
    c.gens[id].status = 'ronin';
    c.gens[id].wage = wageOf(c.gens[id]);
  }
}

export function hire(c: Campaign, id: string): string | null {
  const g = c.gens[id];
  if (!g || g.status !== 'ronin') return 'もういない';
  const wage = g.wage ?? wageOf(g);
  if (c.gold < wage) return '文が足りない';
  c.gold -= wage;
  g.status = 'ours';
  g.injured = 0;
  news(c, `浪人の${genInfo(c, id).name}を雇った。`, 'good');
  checkTitles(c);
  return null;
}

/** 名もなき侍大将を作る */
export function makeGeneric(c: Campaign, f: FactionId, lv: number): string {
  return useRng(c, (r) => {
    const id = `x${c.nextGen++}`;
    const youkai = f === 'youma';
    const type = youkai ? GENERIC_TYPES.find((t) => t.key === 'oni')! : pick(r, GENERIC_TYPES.filter((t) => t.key !== 'oni'));
    const given = pick(r, GIVEN_NAMES);
    const name = youkai ? `${pick(r, ONI_NAMES)}童子` : `${pick(r, SURNAMES)} ${given}`;
    const custom: CustomGen = {
      name, short: youkai ? name : given, portrait: type.portrait, label: type.label, skill: type.skill, style: type.style,
      cmd: range(r, type.cmd[0], type.cmd[1]), pow: range(r, type.pow[0], type.pow[1]), int: range(r, type.int[0], type.int[1]), youkai,
    };
    c.gens[id] = { id, status: 'enemy', faction: f, lv: Math.max(1, lv), exp: expFor(Math.max(1, lv)), bond: 0, injured: 0, custom };
    return id;
  });
}

// ── ターンの終わりと敵の手番 ──

export interface TurnReport { lines: News[]; invasions: Invasion[] }

export function endTurn(c: Campaign): TurnReport {
  if (c.sortie || c.invasions.length || c.captives.length) throw new Error('まだ決めていないことがある');
  const startNews = c.news.length;
  // 年貢
  const inc = income(c);
  c.gold += inc;
  news(c, `年貢として${inc}文が入った。`, 'info');
  // 傷と城門
  for (const g of Object.values(c.gens)) if (g.injured > 0) g.injured -= 1;
  for (const r of Object.values(c.regions)) {
    if (r.owner !== 'akatsuki' && r.breach > 0) r.breach -= 1;
    if (r.owner === 'akatsuki') r.troops = Math.min(1500, r.troops + 40 + r.dev * 10);
    else r.troops = Math.min(2000, r.troops + 30);
  }
  // 敵の手番
  enemyPhase(c);
  c.turn += 1;
  c.ap = MAX_AP;
  rerollStock(c);
  ensureRonin(c);
  if (c.turn === YOUMA_TURN && !c.flags.youma) { c.flags.youma = true; c.scenes.push(YOUMA_WAKES); }
  else if (c.turn % 4 === 1 && c.turn > 1 && useRng(c, (r) => chance(r, 0.5))) c.scenes.push(SEASON_TALK[0]);
  else if (c.turn > 2 && useRng(c, (r) => chance(r, 0.18))) c.scenes.push(SEASON_TALK[(c.turn - 1) % 4]);
  if (!c.flags.finalCall && regionDef(FINAL).adj.some((a) => c.regions[a].owner === 'akatsuki') && c.lord.lv >= 18) {
    c.flags.finalCall = true;
    c.scenes.push(FINAL_CALL);
  }
  checkTitles(c);
  return { lines: c.news.slice(startNews), invasions: [...c.invasions] };
}

function enemyPhase(c: Campaign) {
  if (c.turn < 3) return;
  const limit = c.turn < 12 ? 1 : c.turn < 24 ? 2 : 3;
  const found: Invasion[] = [];
  const order = useRng(c, (r) => shuffle(r, FACTION_IDS.filter((f) => f !== 'akatsuki' && c.factions[f].alive)));
  for (const f of order) {
    if (found.length >= limit) break;
    const p = invadeChance(c, f);
    if (p <= 0 || !useRng(c, (r) => chance(r, p))) continue;
    const targets = ownedRegions(c).filter((r) => regionDef(r.id).adj.some((a) => c.regions[a].owner === f) && !found.some((x) => x.to === r.id));
    if (!targets.length) continue;
    // 守りの弱い国を狙う
    targets.sort((a, b) => defensePower(c, a.id) - defensePower(c, b.id));
    const to = targets[0];
    const from = regionDef(to.id).adj.filter((a) => c.regions[a].owner === f).sort((a, b) => regionDef(b).danger - regionDef(a).danger)[0];
    const d = invasionDanger(c, from);
    const power = useRng(c, (r) => 300 + d * 70 + c.turn * 15 + range(r, 0, 200));
    const commander = makeGeneric(c, f, d + 1);
    found.push({ from, to: to.id, faction: f, power, commander });
    news(c, `${FACTIONS[f].name}が${regionDef(from).name}から${regionDef(to.id).name}へ攻めてきた！`, 'bad');
  }
  // 妖魔は人の国も呑み込む
  if (c.turn >= YOUMA_TURN + 2 && c.factions.youma.alive && useRng(c, (r) => chance(r, Math.min(0.3, 0.1 + (c.turn - YOUMA_TURN) * 0.01)))) {
    const cand = Object.values(c.regions).filter((r) => r.owner !== 'akatsuki' && r.owner !== 'youma' && regionDef(r.id).adj.some((a) => c.regions[a].owner === 'youma'));
    if (cand.length) {
      const target = useRng(c, (r) => pick(r, cand));
      const prev = target.owner;
      const oldBoss = target.boss, oldMid = target.mid;
      target.owner = 'youma';
      target.breach = 0;
      delete target.mid;
      target.boss = makeGeneric(c, 'youma', regionDef(target.id).danger + 3);
      news(c, `妖魔の群が${regionDef(target.id).name}を呑み込んだ！`, 'warn');
      for (const id of [oldBoss, oldMid]) if (id) fleeGeneral(c, id, prev);
      checkFactions(c);
    }
  }
  // 妖魔に呑まれて出どころを失った攻め手は引き返す
  c.invasions = found.filter((inv) => c.factions[inv.faction].alive && c.regions[inv.from].owner === inv.faction && !!c.gens[inv.commander]);
  for (const inv of found) if (!c.invasions.includes(inv)) cleanupCommander(c, inv.commander);
}

/** 攻めてくる軍の強さ（出どころの城より強くはならず、時とともに強くなる） */
export function invasionDanger(c: Campaign, from: string): number {
  return Math.max(3, Math.round(Math.min(regionDef(from).danger + 1, 3 + c.turn * 0.4)));
}

function invadeChance(c: Campaign, f: FactionId): number {
  if (f === 'ronin') return 0;
  if (f === 'youma') return c.turn < YOUMA_TURN ? 0 : Math.min(0.55, 0.25 + (c.turn - YOUMA_TURN) * 0.02);
  return Math.min(0.55, FACTIONS[f].aggression * (0.6 + c.turn * 0.03));
}

/** 籠城（守将に任せる）。勝てば true */
export function holdCastle(c: Campaign, inv: Invasion): { won: boolean; text: string } {
  const i = c.invasions.indexOf(inv);
  if (i >= 0) c.invasions.splice(i, 1);
  const def = defensePower(c, inv.to);
  const won = useRng(c, (r) => {
    const a = int(r, 41) / 100, b = int(r, 41) / 100;
    return def * (0.8 + a) >= inv.power * (0.8 + b);
  });
  const r = c.regions[inv.to];
  const name = regionDef(inv.to).name;
  let text: string;
  if (won) {
    r.troops = Math.max(100, r.troops - Math.round(inv.power * 0.3));
    text = `${name}は籠城して守り抜いた。（兵${r.troops}）`;
    news(c, text, 'good');
    c.stats.defenses += 1;
    cleanupCommander(c, inv.commander);
  } else {
    loseRegion(c, inv.to, inv.faction, inv.commander);
    text = `${name}は守りきれず、${FACTIONS[inv.faction].name}に奪われた……`;
  }
  checkTitles(c);
  return { won, text };
}

/** 迎え撃つ合戦の前に、侵攻の一覧から外す */
export function takeInvasion(c: Campaign, inv: Invasion) {
  const i = c.invasions.indexOf(inv);
  if (i >= 0) c.invasions.splice(i, 1);
}

/** 勝ちの見込み（籠城） */
export function holdOdds(c: Campaign, inv: Invasion): number {
  const d = defensePower(c, inv.to);
  // 0.8〜1.2 の揺らぎどうしで比べた時の、おおよその勝ちの割合
  let win = 0;
  for (let a = 0; a <= 40; a += 4) for (let b = 0; b <= 40; b += 4) if (d * (0.8 + a / 100) >= inv.power * (0.8 + b / 100)) win++;
  return win / 121;
}

/** 敵の国の顔ぶれ（地図の情報用） */
export function regionLeaders(c: Campaign, rid: string): string[] {
  const r = c.regions[rid];
  return [r.boss, r.mid].filter((x): x is string => !!x && c.gens[x]?.status === 'enemy');
}
