// 国盗りの進行：出陣（合戦）・妖魔討伐・内政・交流・城下（補充・増員・浪人宿）・ターンの終わり・敵の手番・合戦の結果
import { FACTIONS, FACTION_IDS, FINAL, HOME, REGIONS, regionDef, type FactionId } from '../content/sengoku';
import { GENERALS, GENERIC_TYPES, GEN_BY_ID, GIVEN_NAMES, LORD, ONI_NAMES, SURNAMES, type GenDef } from '../content/generals';
import { chance, hashSeed, int, pick, range, shuffle, type Rng } from '../engine/rng';
import { KINDS, KIND_IDS } from '../battle/kinds';
import type { BattleSpec } from '../battle/engine';
import type { Battle, Kind } from '../battle/types';
import { CAMPAIGN_VERSION, type Campaign, type CustomGen, type GenState, type Invasion, type News, type Placement, type Scene } from './state';
import { DEFEAT, ENDING, FINAL_CALL, FIRST_WIN, OPENING, SEASON_TALK, UNIFIED, YOUMA_WAKES, factionFallen } from './events';
import {
  baseOf, battleSpec, castleDanger, expFor, extraCost, forts, huntArmy, invasionArmy, lordLv, maxTroops, ownedCount, partyUnits, refillCost, siegeArmy,
} from './army';

export { castleDanger, expFor, forts, lordLv, maxTroops, ownedCount, refillCost, extraCost } from './army';

export const MAX_AP = 3;
/** 1つの合戦に出せる部隊（朔を含む） */
export const MAX_PARTY = 6;
export const YOUMA_TURN = 8;

// ── 乱数 ──

function useRng<T>(c: Campaign, fn: (r: Rng) => T): T {
  const r = { s: c.rng };
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
  /** 固有技 */
  skills: string[];
  kind: Kind;
  youkai: boolean;
  role: string;
  desc: string;
  unique: boolean;
  def?: GenDef;
}

export function genInfo(c: Campaign, id: string): GenInfo {
  const b = baseOf(c, id);
  const g = c.gens[id];
  const def = b.def;
  if (def) {
    return { id, name: def.name, short: def.short, portrait: def.portrait, cmd: def.cmd, pow: def.pow, int: def.int, cha: def.cha, skills: [...def.skills], kind: g?.kind ?? def.kind, youkai: !!def.youkai, role: def.role, desc: def.desc, unique: true, def };
  }
  const cu = g.custom!;
  return {
    id, name: cu.name, short: cu.short, portrait: cu.portrait, cmd: cu.cmd, pow: cu.pow, int: cu.int, cha: 50, skills: [], kind: g.kind, youkai: !!cu.youkai,
    role: cu.label, desc: `${FACTIONS[g.faction].name}に仕えていた${cu.label}。`, unique: false,
  };
}

// ── 新しい戦 ──

function newGen(c: Campaign, id: string, status: GenState['status'], faction: FactionId, lv: number, kind: Kind, custom?: CustomGen): GenState {
  const g: GenState = { id, status, faction, lv, exp: expFor(lv), bond: 0, injured: 0, kind, troops: 0, extra: 0 };
  if (custom) g.custom = custom;
  c.gens[id] = g;
  g.troops = maxTroops(c, id);
  return g;
}

export function newCampaign(seed: number): Campaign {
  const c: Campaign = {
    v: CAMPAIGN_VERSION, seed: seed | 0, rng: hashSeed(seed, 'campaign'), turn: 1, ap: MAX_AP, gold: 1500,
    regions: {}, factions: {} as Campaign['factions'], gens: {}, nextGen: 1,
    news: [], flags: {}, scenes: [...OPENING], invasions: [], captives: [], sortie: null,
    stats: { battles: 0, wins: 0, losses: 0, kills: 0, captured: 0, hunts: 0, defenses: 0, maxHit: 0 },
    titles: {},
  };
  for (const f of FACTION_IDS) c.factions[f] = { alive: true };
  for (const r of REGIONS) {
    c.regions[r.id] = { id: r.id, owner: r.owner, troops: r.owner === 'akatsuki' ? 500 : 300 + r.danger * 40, dev: 1, wall: r.capital ? 2 : 1, taken: 0 };
    if (r.owner !== 'akatsuki') { c.regions[r.id].boss = r.boss; if (r.mid) c.regions[r.id].mid = r.mid; }
  }
  for (const def of GENERALS) {
    const home = REGIONS.find((r) => r.boss === def.id || r.mid === def.id);
    const ours = def.faction === 'akatsuki';
    const lv = ours ? 3 + (def.lvBonus ?? 0) : Math.max(2, (home?.danger ?? 5) + (home?.mid === def.id ? 0 : 1) + (def.lvBonus ?? 0));
    newGen(c, def.id, ours ? 'ours' : 'enemy', def.faction, lv, def.kind);
  }
  ensureRonin(c);
  news(c, '暁ノ家の当主・風間朔が家督を継いだ。', 'info');
  return c;
}

// ── 調べる ──

export function ownedRegions(c: Campaign) { return Object.values(c.regions).filter((r) => r.owner === 'akatsuki'); }
export function regionsOf(c: Campaign, f: FactionId) { return Object.values(c.regions).filter((r) => r.owner === f); }

/** 隣に自分の国がある敵の国（攻められる） */
export function canAttack(c: Campaign, rid: string): boolean {
  const r = c.regions[rid];
  if (!r || r.owner === 'akatsuki') return false;
  return regionDef(rid).adj.some((a) => c.regions[a].owner === 'akatsuki');
}

/** 家臣（朔を除く） */
export function ourGenerals(c: Campaign): GenState[] {
  return Object.values(c.gens).filter((g) => g.status === 'ours' && g.id !== LORD);
}

/** 合戦に出せる武将（朔を含む。傷が無く、兵がいる） */
export function readyGenerals(c: Campaign): GenState[] {
  return Object.values(c.gens).filter((g) => g.status === 'ours' && g.injured <= 0 && g.troops > 0);
}

/** 籠城の守りの強さ */
export function defensePower(c: Campaign, rid: string): number {
  const r = c.regions[rid];
  return r.wall * 150 + r.troops;
}

export function income(c: Campaign): number {
  return ownedRegions(c).reduce((sum, r) => sum + Math.round(regionDef(r.id).income * (1 + 0.3 * (r.dev - 1))), 0);
}

// ── 出陣 ──

export function sortieError(c: Campaign, mode: Battle['kind'], rid: string): string | null {
  if (c.defeat) return '戦は終わった';
  if (c.sortie) return '出陣中';
  if (mode === 'defense') return null;
  if (c.ap <= 0) return 'この季節の行動は残っていない';
  if (mode === 'siege' && !canAttack(c, rid)) return '隣の国ではない';
  if (mode === 'hunt' && c.regions[rid]?.owner !== 'akatsuki') return '自分の国ではない';
  return null;
}

/** 陣立てを確かめる：出せる武将だけ、同じ枠は1人、朔は必ず */
export function checkParty(c: Campaign, party: Placement[]): Placement[] {
  const ok: Placement[] = [];
  const used = new Set<string>();
  for (const p of party) {
    const g = c.gens[p.gen];
    if (!g || g.status !== 'ours' || g.injured > 0 || g.troops <= 0) continue;
    if (ok.some((x) => x.gen === p.gen) || used.has(`${p.row}${p.slot}`)) continue;
    used.add(`${p.row}${p.slot}`);
    ok.push(p);
    if (ok.length >= MAX_PARTY) break;
  }
  return ok;
}

/** 妖魔討伐の強さ */
export function huntDanger(c: Campaign, rid: string): number {
  return Math.max(2, Math.min(lordLv(c) + 1, regionDef(rid).danger + 2 + Math.floor(c.turn / 3)));
}

/** 攻めてくる軍の強さ（出どころの城より強くはならず、時とともに強くなる） */
export function invasionDanger(c: Campaign, from: string): number {
  return Math.max(3, Math.round(Math.min(regionDef(from).danger + 1, 3 + c.turn * 0.4)));
}

/** 出陣する：行動を使い、合戦の作り方を返す */
export function beginBattle(c: Campaign, mode: Battle['kind'], rid: string, party: Placement[], seed: number, inv?: Invasion): BattleSpec {
  const err = sortieError(c, mode, rid);
  if (err) throw new Error(err);
  const placed = checkParty(c, party);
  if (!placed.some((p) => p.gen === LORD)) throw new Error('朔は必ず出陣する');
  if (mode !== 'defense') c.ap -= 1;
  const so = { mode, region: rid, party: placed, invasion: inv, fort: mode === 'siege' ? c.regions[rid].taken : undefined, temps: {} };
  c.sortie = so;
  c.stats.battles += 1;
  const L = partyUnits(c, placed);
  let R;
  if (mode === 'siege') R = siegeArmy(c, so, seed);
  else if (mode === 'defense' && inv) R = invasionArmy(c, so, inv, seed, invasionDanger(c, inv.from));
  else R = huntArmy(c, so, seed, huntDanger(c, rid));
  return battleSpec(mode, rid, seed, L, R, mode === 'defense' ? 'L' : 'R');
}

// ── 合戦の結果 ──

export interface Report {
  kind: 'win' | 'lose';
  mode: Battle['kind'];
  region: string;
  title: string;
  lines: string[];
  gold: number;
  captured: string[];
  levelUps: string[];
  lost: number;
  gained: number;
}

export function finishBattle(c: Campaign, b: Battle): Report {
  const so = c.sortie;
  if (!so) throw new Error('出陣していない');
  const win = b.end?.winner === 'L';
  const def = regionDef(so.region);
  const rep: Report = { kind: win ? 'win' : 'lose', mode: so.mode, region: so.region, title: '', lines: [], gold: 0, captured: [], levelUps: [], lost: 0, gained: 0 };
  const enemies = b.units.filter((u) => u.side === 'R');
  const enemyStart = enemies.reduce((s, u) => s + u.startTroops, 0);
  const killed = enemies.reduce((s, u) => s + (u.startTroops - u.troops), 0);
  c.stats.kills += killed;
  // 味方：兵数・傷・経験
  for (const u of b.units.filter((x) => x.side === 'L')) {
    const g = c.gens[u.gen];
    if (!g) continue;
    rep.lost += u.startTroops - u.troops;
    c.stats.maxHit = Math.max(c.stats.maxHit, u.dealt);
    let troops = u.troops;
    if (win && !u.out) {
      const add = Math.round(maxTroops(c, u.gen) * KINDS[g.kind].gain / 100);
      troops = Math.min(maxTroops(c, u.gen), troops + add);
      rep.gained += troops - u.troops;
    }
    g.troops = troops;
    if (u.out && u.gen !== LORD) g.injured = Math.max(g.injured, 2);
    const exp = Math.round((8 + enemyStart / (win ? 70 : 140)) + u.dealt / 40 + u.kills * 6);
    g.exp += exp;
    const before = g.lv;
    while (g.lv < 99 && g.exp >= expFor(g.lv + 1)) g.lv += 1;
    if (g.lv > before) rep.levelUps.push(`${baseOf(c, u.gen).short} Lv${before}→${g.lv}`);
  }
  // 捕らえた将（壊滅した敵から最大2人。名のある将が先）
  if (win) {
    const downs = enemies.filter((u) => u.out).sort((x, y) => (GEN_BY_ID[y.gen] ? 1 : 0) - (GEN_BY_ID[x.gen] ? 1 : 0) || (y.boss ? 1 : 0) - (x.boss ? 1 : 0));
    let n = 0;
    for (const u of downs) {
      if (n >= 2) break;
      if (so.temps[u.gen]) {
        if (so.temps[u.gen].kind === 'youkai') continue; // 名のない妖怪は捕らえない
        if (!useRng(c, (r) => chance(r, 0.5))) continue;
        const t = so.temps[u.gen];
        const id = `x${c.nextGen++}`;
        newGen(c, id, 'enemy', t.faction, t.lv, t.kind, t.custom);
        capture(c, id);
        rep.captured.push(id);
        n++;
      } else if (c.gens[u.gen]?.status === 'enemy') {
        capture(c, u.gen);
        rep.captured.push(u.gen);
        n++;
      }
    }
  }
  const rs = c.regions[so.region];
  if (so.mode === 'siege') {
    if (win) {
      const total = forts(so.region);
      rs.taken += 1;
      const gold = 100 + castleDanger(c, so.region) * 20;
      c.gold += gold;
      rep.gold = gold;
      c.stats.wins += 1;
      if (rs.taken >= total) {
        takeRegion(c, so.region);
        rep.title = `${def.name}を落とした！`;
        rep.lines.push(`${def.name}は暁ノ家の国になった。`);
        if (!c.flags.firstWin) { c.flags.firstWin = true; c.scenes.push(FIRST_WIN); }
      } else {
        rep.title = `${def.name}の砦を落とした！（${rs.taken}/${total}）`;
        rep.lines.push(`残る砦はあと${total - rs.taken}。${total - rs.taken === 1 ? '次は本城だ。' : ''}`);
      }
      // 城主・2人目の将が捕らえられていれば国から外す
      if (rs.mid && c.gens[rs.mid]?.status !== 'enemy') delete rs.mid;
    } else {
      rep.title = `${def.name}の攻略に失敗した……`;
      c.stats.losses += 1;
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
      const bonus = 150 + huntGoldBase(c);
      c.gold += bonus;
      rep.gold = bonus;
      rep.title = '妖魔の群れを討ち払った！';
      rep.lines.push(`村人からお礼に${bonus}文が届いた。`);
      c.stats.hunts += 1;
    } else rep.title = '妖魔の群れに押し返された……';
  }
  rep.lines.push(`討った敵兵 ${killed}・失った兵 ${rep.lost}${rep.gained ? `・勝って加わった兵 ${rep.gained}` : ''}`);
  const injured = b.units.filter((u) => u.side === 'L' && u.out && u.gen !== LORD).map((u) => baseOf(c, u.gen).short);
  if (injured.length) rep.lines.push(`${injured.join('・')}は部隊が壊滅し、2季節のあいだ出陣できない。`);
  if (b.units.some((u) => u.lord && u.out)) rep.lines.push('朔の部隊が壊滅した。兵を補充しないと出陣できない。');
  c.sortie = null;
  checkFactions(c);
  checkEnd(c);
  checkTitles(c);
  return rep;
}

function huntGoldBase(c: Campaign): number {
  return lordLv(c) * 20;
}

/** 出陣の記録が壊れていた時：部隊は傷を負って帰る */
export function abortSortie(c: Campaign) {
  const so = c.sortie;
  if (!so) return;
  for (const p of so.party) if (c.gens[p.gen] && p.gen !== LORD) c.gens[p.gen].injured = Math.max(c.gens[p.gen].injured, 1);
  if (so.invasion) loseRegion(c, so.region, so.invasion.faction, so.invasion.commander);
  c.sortie = null;
  news(c, '合戦の記録が途切れていた。部隊は本陣へ戻った。', 'bad');
  checkFactions(c);
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
  g.injured = 0;
  g.troops = Math.max(g.troops, Math.round(maxTroops(c, id) * 0.5));
  const info = genInfo(c, id);
  news(c, `${info.name}が家臣に加わった。`, 'good');
  checkTitles(c);
  return { title: '登用', mood: 'victory', lines: [[id, info.def?.join || `${info.short}「拾ってもらった命、暁ノ家のために使おう」`], ['', `${info.name}が家臣になった！（${KINDS[g.kind].name}）`]] };
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
  r.taken = 0;
  r.troops = 300;
  // 討たれずに残った城主・2人目の将は、同じ家の別の城へ落ちのびる（黒淵は本拠と運命を共にする）
  const left = [r.boss, r.mid].filter((x): x is string => !!x);
  delete r.boss;
  delete r.mid;
  for (const id of left) {
    if (GEN_BY_ID[id]?.never && c.gens[id]?.status === 'enemy') capture(c, id);
    else fleeGeneral(c, id, prev);
  }
  news(c, `${regionDef(rid).name}を手に入れた。`, 'good');
  if (rid === FINAL && !c.flags.finalTaken) c.flags.finalTaken = true;
}

function fleeGeneral(c: Campaign, id: string, faction: FactionId) {
  const g = c.gens[id];
  if (!g || g.status !== 'enemy') return;
  for (const r of Object.values(c.regions)) {
    if (r.boss === id) delete r.boss;
    if (r.mid === id) delete r.mid;
  }
  const dest = regionsOf(c, faction).find((x) => !x.mid && x.boss !== id);
  if (dest) { dest.mid = id; news(c, `${genInfo(c, id).name}は${regionDef(dest.id).name}へ落ちのびた。`, 'info'); }
  else { g.status = 'ronin'; g.wage = wageOf(g); news(c, `${genInfo(c, id).name}は浪人になった。`, 'info'); }
}

function loseRegion(c: Campaign, rid: string, f: FactionId, commander?: string) {
  const r = c.regions[rid];
  r.owner = f;
  r.taken = 0;
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
        g.troops = Math.max(g.troops, Math.round(maxTroops(c, g.id) * 0.5));
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
  { id: 'first', name: '初陣', desc: '初めて国を落とした' },
  { id: 'five', name: '五国の主', desc: '国を5つ持った' },
  { id: 'ten', name: '十国の覇者', desc: '国を10持った' },
  { id: 'unify', name: '天下人', desc: '八洲十五国をすべて手に入れた' },
  { id: 'kurobuchi', name: '霧祓い', desc: '蛟王黒淵を討ち取った' },
  { id: 'gens10', name: '人望厚き主', desc: '家臣が10人を超えた' },
  { id: 'gensall', name: '綺羅星', desc: '固有の武将をすべて家臣にした' },
  { id: 'defend3', name: '鉄壁の守り', desc: '攻めてきた敵を3度追い返した' },
  { id: 'hunt5', name: '妖魔祓い', desc: '妖魔の群れを5回討ち払った' },
  { id: 'lv30', name: '剣聖', desc: '朔がレベル30になった' },
  { id: 'rich', name: '長者', desc: '文を3万貯めた' },
  { id: 'fast', name: '電光石火', desc: '30季節以内に黒淵を討った' },
  { id: 'kills', name: '万人斬り', desc: '討った敵兵が1万を超えた' },
];

export function checkTitles(c: Campaign) {
  const give = (id: string, ok: boolean) => {
    if (ok && !c.titles[id]) { c.titles[id] = true; news(c, `称号「${TITLES.find((t) => t.id === id)!.name}」を得た！`, 'good'); }
  };
  const n = ownedCount(c);
  give('first', n > 1);
  give('five', n >= 5);
  give('ten', n >= 10);
  give('unify', n === REGIONS.length);
  give('kurobuchi', !!c.victory);
  give('gens10', ourGenerals(c).length >= 10);
  give('gensall', GENERALS.filter((g) => !g.never).every((g) => c.gens[g.id]?.status === 'ours'));
  give('defend3', c.stats.defenses >= 3);
  give('hunt5', c.stats.hunts >= 5);
  give('lv30', lordLv(c) >= 30);
  give('rich', c.gold >= 30000);
  give('fast', !!c.victory && c.victory <= 30);
  give('kills', c.stats.kills >= 10000);
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
  news(c, `${name}で守りの兵を集めた（兵${r.troops}）。`, 'good');
  return `${name}の守りの兵が増えた。`;
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
    const lines = ev.lines.map((l) => [l[0], l[1].replace(/新しい技「(.+?)」を覚えた。/, '固有技「$1」を合戦で使えるようになった。')] as [string, string]);
    return { title: `${def.short} ── ${ev.title}`, lines: [...lines, ['', `${def.short}のレベルが${g.lv}に上がった。`]] };
  }
  const info = genInfo(c, id);
  g.bond += 1;
  news(c, `${info.short}と酒を酌み交わした。`, 'good');
  return {
    title: `${info.short}と酒宴`,
    lines: [
      [id, useRng(c, (r) => pick(r, ['殿、この酒はうまいですな！', '拾っていただいた恩、戦で返しますぞ。', 'いつか故郷の村にも、殿の旗を立ててくだされ。', '次の戦、先陣はぜひ拙者に！']))],
      ['g_saku', 'おう。頼りにしてるぜ。'],
      ['', `${info.short}のレベルが${g.lv}に上がった。`],
    ],
  };
}

// ── 城下：兵の補充・増員・浪人宿 ──

export function refill(c: Campaign, id: string): string | null {
  const g = c.gens[id];
  if (!g || g.status !== 'ours') return '家臣ではない';
  const cost = refillCost(c, id);
  if (cost <= 0) return '兵は満ちている';
  if (c.gold < cost) {
    // 払える分だけ補充する
    const per = KINDS[g.kind].refill * 0.25;
    const n = Math.floor(c.gold / per);
    if (n <= 0) return '文が足りない';
    c.gold -= Math.ceil(n * per);
    g.troops += n;
    return null;
  }
  c.gold -= cost;
  g.troops = maxTroops(c, id);
  return null;
}

/** 全員の兵を補充する（文が尽きたら途中まで） */
export function refillAll(c: Campaign): number {
  let n = 0;
  const list = Object.values(c.gens).filter((g) => g.status === 'ours').sort((a, b) => (a.id === LORD ? -1 : b.id === LORD ? 1 : 0));
  for (const g of list) if (refillCost(c, g.id) > 0 && !refill(c, g.id)) n++;
  return n;
}

export function addExtra(c: Campaign, id: string): string | null {
  const g = c.gens[id];
  if (!g || g.status !== 'ours') return '家臣ではない';
  if (g.extra >= 10) return 'これ以上は増やせない';
  const cost = extraCost(g);
  if (c.gold < cost) return '文が足りない';
  c.gold -= cost;
  g.extra += 1;
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
    const lv = Math.max(2, Math.round(lordLv(c) * 0.8));
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
  g.troops = Math.max(g.troops, Math.round(maxTroops(c, id) * 0.6));
  news(c, `浪人の${genInfo(c, id).name}を雇った。`, 'good');
  checkTitles(c);
  return null;
}

/** 名もなき侍大将を作る（本陣に残る将：攻めてくる大将・浪人など） */
export function makeGeneric(c: Campaign, f: FactionId, lv: number): string {
  const { kind, custom } = useRng(c, (r) => {
    const kind: Kind = f === 'youma' ? 'youkai' : f === 'ronin' ? pick(r, KIND_IDS) : FACTIONS[f].troops.length ? pick(r, FACTIONS[f].troops)[0] : 'bushi';
    const type = GENERIC_TYPES.find((t) => t.kind === kind) ?? GENERIC_TYPES[1];
    const youkai = kind === 'youkai';
    const given = pick(r, GIVEN_NAMES);
    const name = youkai ? `${pick(r, ONI_NAMES)}童子` : `${pick(r, SURNAMES)} ${given}`;
    const custom: CustomGen = {
      name, short: youkai ? name : given, portrait: pick(r, type.portraits), label: type.label,
      cmd: range(r, type.cmd[0], type.cmd[1]), pow: range(r, type.pow[0], type.pow[1]), int: range(r, type.int[0], type.int[1]), youkai,
    };
    return { kind, custom };
  });
  const id = `x${c.nextGen++}`;
  newGen(c, id, 'enemy', f, Math.max(1, lv), kind, custom);
  return id;
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
  // 傷、兵の自然な戻り（上限の1割）、砦の取り返し
  for (const g of Object.values(c.gens)) {
    if (g.injured > 0) g.injured -= 1;
    if (g.status === 'ours') g.troops = Math.min(maxTroops(c, g.id), g.troops + Math.round(maxTroops(c, g.id) * 0.1));
  }
  for (const r of Object.values(c.regions)) {
    if (r.owner !== 'akatsuki' && r.taken > 0 && c.turn % 3 === 0) r.taken -= 1;
    if (r.owner === 'akatsuki') r.troops = Math.min(1500, r.troops + 40 + r.dev * 10);
    else r.troops = Math.min(2000, r.troops + 30);
  }
  // 敵の手番
  enemyPhase(c);
  c.turn += 1;
  c.ap = MAX_AP;
  ensureRonin(c);
  if (c.turn === YOUMA_TURN && !c.flags.youma) { c.flags.youma = true; c.scenes.push(YOUMA_WAKES); }
  else if (c.turn % 4 === 1 && c.turn > 1 && useRng(c, (r) => chance(r, 0.5))) c.scenes.push(SEASON_TALK[0]);
  else if (c.turn > 2 && useRng(c, (r) => chance(r, 0.18))) c.scenes.push(SEASON_TALK[(c.turn - 1) % 4]);
  if (!c.flags.finalCall && regionDef(FINAL).adj.some((a) => c.regions[a].owner === 'akatsuki') && lordLv(c) >= 18) {
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
      target.taken = 0;
      delete target.mid;
      delete target.boss;
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
    text = `${name}は籠城して守り抜いた。（守りの兵${r.troops}）`;
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

/** 籠城で守れる見込み */
export function holdOdds(c: Campaign, inv: Invasion): number {
  const d = defensePower(c, inv.to);
  let win = 0;
  for (let a = 0; a <= 40; a += 4) for (let b = 0; b <= 40; b += 4) if (d * (0.8 + a / 100) >= inv.power * (0.8 + b / 100)) win++;
  return win / 121;
}

/** 敵の国の名のある将（地図の情報用） */
export function regionLeaders(c: Campaign, rid: string): string[] {
  const r = c.regions[rid];
  return [r.boss, r.mid].filter((x): x is string => !!x && c.gens[x]?.status === 'enemy');
}
