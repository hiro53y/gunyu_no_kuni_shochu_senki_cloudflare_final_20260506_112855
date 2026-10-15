// 国盗りの進行：行動の扇・武名、出陣（宣戦布告した勢力の領地を1つずつ）・妖魔討伐・国の命令（建設・戦の準備・宣戦布告・人材探索・工作・説得）、
// 交流、城下（補充・増員・浪人宿）、ターンの終わり（傷ついた兵の回復・収入と維持費）、敵の手番（1ターンに1度の侵攻）、合戦の結果（捕獲の確率）
import { FACTIONS, FACTION_IDS, FINAL, HOME, REGIONS, regionDef, type FactionId } from '../content/sengoku';
import { GENERALS, GENERIC_TYPES, GEN_BY_ID, GIVEN_NAMES, LORD, ONI_NAMES, SURNAMES, type GenDef } from '../content/generals';
import { chance, hashSeed, pick, range, shuffle, type Rng } from '../engine/rng';
import { KINDS, KIND_IDS } from '../battle/kinds';
import { createBattle, act, type BattleSpec } from '../battle/engine';
import { chooseAction } from '../battle/ai';
import type { Battle, Kind } from '../battle/types';
import { CAMPAIGN_VERSION, type Campaign, type CommandId, type CustomGen, type GenState, type Invasion, type News, type Placement, type Scene } from './state';
import { DEFEAT, ENDING, FINAL_CALL, FIRST_WIN, LORD_FALLS, OPENING, SEASON_TALK, UNIFIED, YOUMA_WAKES, factionFallen } from './events';
import {
  autoPlace, baseOf, battleSpec, castleDanger, expFor, healCost, hireCost, huntArmy, invasionArmy, landsOf, lordLv, maxTroops, ownedCount, partyUnits, siegeArmy, traitsOf, upkeepOf,
} from './army';

export { castleDanger, expFor, lordLv, maxTroops, ownedCount, healCost, hireCost, landCount, landsOf, LAND_NAME, upkeepOf } from './army';

/** 1つの合戦に出せる部隊 */
export const MAX_PARTY = 6;
export const YOUMA_TURN = 8;
/** 武名で増える扇の境目 */
export const FAME_STEPS = [20, 60, 120];

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

// ── 扇と武名 ──

export function maxFans(c: Campaign): number {
  return 2 + FAME_STEPS.filter((s) => c.fame >= s).length;
}

export function nextFameStep(c: Campaign): number | null {
  return FAME_STEPS.find((s) => c.fame < s) ?? null;
}

function addFame(c: Campaign, n: number) {
  const before = maxFans(c);
  c.fame += n;
  if (maxFans(c) > before) news(c, `武名が${c.fame}に高まった。1季節の行動が${maxFans(c)}回に増えた！`, 'good');
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
  const g: GenState = { id, status, faction, lv, exp: expFor(lv), bond: 0, injured: 0, kind, troops: 0, wounded: 0, fought: 0 };
  if (custom) g.custom = custom;
  c.gens[id] = g;
  g.troops = maxTroops(c, id);
  return g;
}

/** 初めの国力（本拠は高い） */
function startNp(rid: string): number {
  const r = regionDef(rid);
  return Math.max(3, Math.min(14, Math.round(r.income / 30) + (r.capital ? 2 : 0)));
}

export function newCampaign(seed: number): Campaign {
  const c: Campaign = {
    v: CAMPAIGN_VERSION, seed: seed | 0, rng: hashSeed(seed, 'campaign'), turn: 1, fans: 2, fame: 0, gold: 1500,
    regions: {}, factions: {} as Campaign['factions'], gens: {}, nextGen: 1, progress: {},
    news: [], flags: {}, scenes: [...OPENING], invasions: [], captives: [], sortie: null,
    stats: { battles: 0, wins: 0, losses: 0, kills: 0, captured: 0, hunts: 0, defenses: 0, maxHit: 0 },
    titles: {},
  };
  for (const f of FACTION_IDS) c.factions[f] = { alive: true, war: f === 'youma' };
  for (const r of REGIONS) {
    c.regions[r.id] = { id: r.id, owner: r.owner, np: startNp(r.id), lands: landsOf(r.id), taken: 0, prep: 0, sabotage: 0 };
    if (r.owner !== 'akatsuki') { c.regions[r.id].boss = r.boss; if (r.mid) c.regions[r.id].mid = r.mid; }
  }
  for (const def of GENERALS) {
    const home = REGIONS.find((r) => r.boss === def.id || r.mid === def.id);
    const ours = def.faction === 'akatsuki';
    const lv = ours ? 3 + (def.lvBonus ?? 0) : Math.max(2, (home?.danger ?? 5) + (home?.mid === def.id ? 0 : 1) + (def.lvBonus ?? 0));
    newGen(c, def.id, ours ? 'ours' : 'enemy', def.faction, lv, def.kind);
  }
  ensureRonin(c);
  c.fans = maxFans(c);
  news(c, '暁ノ家の当主・風間朔が家督を継いだ。', 'info');
  return c;
}

// ── 調べる ──

export function ownedRegions(c: Campaign) { return Object.values(c.regions).filter((r) => r.owner === 'akatsuki'); }
export function regionsOf(c: Campaign, f: FactionId) { return Object.values(c.regions).filter((r) => r.owner === f); }

/** 隣に自分の国がある敵の国 */
export function isBorder(c: Campaign, rid: string): boolean {
  const r = c.regions[rid];
  if (!r || r.owner === 'akatsuki') return false;
  return regionDef(rid).adj.some((a) => c.regions[a].owner === 'akatsuki');
}

/** 攻められる国（隣で、宣戦布告した勢力） */
export function canAttack(c: Campaign, rid: string): boolean {
  return isBorder(c, rid) && c.factions[c.regions[rid].owner].war;
}

/** 家臣（朔を除く） */
export function ourGenerals(c: Campaign): GenState[] {
  return Object.values(c.gens).filter((g) => g.status === 'ours' && g.id !== LORD);
}

/** 合戦に出せる武将（壊滅の傷が無く、兵がいる） */
export function readyGenerals(c: Campaign): GenState[] {
  return Object.values(c.gens).filter((g) => g.status === 'ours' && g.injured <= 0 && g.troops > 0);
}

/** 収入：国ごとの年貢 ×（0.6＋国力×0.08） */
export function grossIncome(c: Campaign): number {
  return ownedRegions(c).reduce((sum, r) => sum + Math.round(regionDef(r.id).income * (0.6 + r.np * 0.08)), 0);
}

export function totalNp(c: Campaign): number {
  return ownedRegions(c).reduce((s, r) => s + r.np, 0);
}

export function totalUpkeep(c: Campaign): number {
  return Object.values(c.gens).filter((g) => g.status === 'ours').reduce((s, g) => s + upkeepOf(g), 0);
}

/** 実際の収入（維持費が国力を超えると半分） */
export function income(c: Campaign): number {
  const g = grossIncome(c);
  return totalUpkeep(c) > totalNp(c) ? Math.floor(g / 2) : g;
}

// ── 出陣 ──

export function sortieError(c: Campaign, mode: Battle['kind'], rid: string): string | null {
  if (c.defeat) return '戦は終わった';
  if (c.sortie) return '出陣中';
  if (mode === 'defense') return null;
  if (c.fans <= 0) return 'この季節の行動は残っていない';
  if (mode === 'siege') {
    if (!isBorder(c, rid)) return '隣の国ではない';
    if (!c.factions[c.regions[rid].owner].war) return '宣戦布告していない';
  }
  if (mode === 'hunt' && c.regions[rid]?.owner !== 'akatsuki') return '自分の国ではない';
  return null;
}

/** 陣立てを確かめる：出せる武将だけ、同じ枠は1人、6部隊まで */
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

/** 攻めてくる軍の強さ（出どころの国より強くはならず、時とともに強くなる） */
export function invasionDanger(c: Campaign, from: string): number {
  return Math.max(3, Math.round(Math.min(regionDef(from).danger + 1, 3 + c.turn * 0.4)));
}

/** 合戦の場所の種類 */
export function groundOf(c: Campaign, mode: Battle['kind'], rid: string, land?: number): BattleSpec['ground'] {
  if (mode === 'siege') return c.regions[rid].lands[land ?? 0] ?? 'castle';
  if (mode === 'defense') return rid === HOME ? 'castle' : 'town';
  return 'field';
}

/** 出陣する：扇を使い、合戦の作り方を返す */
export function beginBattle(c: Campaign, mode: Battle['kind'], rid: string, party: Placement[], seed: number, inv?: Invasion): BattleSpec {
  const err = sortieError(c, mode, rid);
  if (err) throw new Error(err);
  const placed = checkParty(c, party);
  if (!placed.length) throw new Error('出せる部隊がいない');
  if (mode !== 'defense') c.fans -= 1;
  const so = { mode, region: rid, party: placed, invasion: inv, land: mode === 'siege' ? c.regions[rid].taken : undefined, temps: {} };
  c.sortie = so;
  c.stats.battles += 1;
  const L = partyUnits(c, placed);
  let R;
  if (mode === 'siege') R = siegeArmy(c, so, seed);
  else if (mode === 'defense' && inv) R = invasionArmy(c, so, inv, seed);
  else R = huntArmy(c, so, seed, huntDanger(c, rid));
  const ground = groundOf(c, mode, rid, so.land);
  return battleSpec(mode, rid, seed, L, R, mode === 'defense' ? 'L' : 'R', ground!, c.regions[rid].prep);
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
  killed: string[];
  levelUps: string[];
  lost: number;
  gained: number;
  fame: number;
}

/** 捕獲の確率：基本1/5、落ち武者狩りがいれば1/2、手加減突撃を受けていれば必ず */
export function captureChance(hunter: boolean, mercy: boolean): number {
  if (mercy) return 1;
  return hunter ? 0.5 : 0.2;
}

export function finishBattle(c: Campaign, b: Battle): Report {
  const so = c.sortie;
  if (!so) throw new Error('出陣していない');
  const win = b.end?.winner === 'L';
  const def = regionDef(so.region);
  const rep: Report = { kind: win ? 'win' : 'lose', mode: so.mode, region: so.region, title: '', lines: [], gold: 0, captured: [], killed: [], levelUps: [], lost: 0, gained: 0, fame: 0 };
  const enemies = b.units.filter((u) => u.side === 'R');
  const enemyStart = enemies.reduce((s, u) => s + u.startTroops, 0);
  const killed = enemies.reduce((s, u) => s + (u.startTroops - u.troops), 0);
  c.stats.kills += killed;
  c.stats.maxHit = Math.max(c.stats.maxHit, b.dmg.L);
  // 味方：減った兵は傷ついた兵になる（休めば戻る）。勝てば兵種ごとに少し増える。経験
  for (const u of b.units.filter((x) => x.side === 'L')) {
    const g = c.gens[u.gen];
    if (!g) continue;
    const lost = Math.max(0, u.startTroops - u.troops);
    rep.lost += lost;
    g.troops = u.troops;
    g.wounded = Math.min(maxTroops(c, u.gen), g.wounded + Math.round(lost * (u.out ? 0.5 : 0.8)));
    g.fought = c.turn;
    if (win && !u.out) {
      const add = Math.min(KINDS[g.kind].gain * 3, Math.max(0, maxTroops(c, u.gen) - g.troops - g.wounded));
      g.troops += add;
      rep.gained += add;
    }
    if (u.out && u.gen !== LORD) g.injured = Math.max(g.injured, 2);
    const exp = Math.round((8 + enemyStart / (win ? 70 : 140)) + u.dealt / 40 + u.kills * 6);
    g.exp += exp;
    const before = g.lv;
    while (g.lv < 99 && g.exp >= expFor(g.lv + 1)) g.lv += 1;
    if (g.lv > before) rep.levelUps.push(`${baseOf(c, u.gen).short} Lv${before}→${g.lv}`);
  }
  // 捕獲：壊滅した敵の将（1合戦2人まで、手加減突撃の相手は別に1人）
  if (win) {
    const hunter = b.units.some((u) => u.side === 'L' && u.traits?.includes('hunter'));
    const downs = enemies.filter((u) => u.out).sort((x, y) => (y.mercy ? 1 : 0) - (x.mercy ? 1 : 0) || (GEN_BY_ID[y.gen] ? 1 : 0) - (GEN_BY_ID[x.gen] ? 1 : 0));
    let n = 0;
    let mercyUsed = false;
    for (const u of downs) {
      const extra = u.mercy && !mercyUsed;
      if (n >= 2 && !extra) break;
      const temp = so.temps[u.gen];
      const named = !temp && c.gens[u.gen]?.status === 'enemy';
      if (temp?.kind === 'youkai') continue; // 名のない妖怪は捕らえない
      if (!temp && !named) continue;
      const ok = useRng(c, (r) => chance(r, captureChance(hunter, !!u.mercy)));
      if (ok) {
        let id = u.gen;
        if (temp) {
          id = `x${c.nextGen++}`;
          newGen(c, id, 'enemy', temp.faction, temp.lv, temp.kind, temp.custom);
          c.gens[id].troops = Math.round(maxTroops(c, id) * 0.5);
        }
        if (GEN_BY_ID[id]?.never && !c.victory) { /* 黒淵は国を落とした時に討つ */ continue; }
        capture(c, id);
        rep.captured.push(id);
        if (extra) mercyUsed = true; else n++;
      } else if (temp && useRng(c, (r) => chance(r, 0.5))) {
        rep.killed.push(temp.custom.name);
      }
    }
  }
  const rs = c.regions[so.region];
  let fame = 0;
  if (so.mode === 'siege') {
    rs.prep = 0;
    rs.sabotage = 0;
    if (win) {
      const total = rs.lands.length;
      rs.taken += 1;
      const gold = 80 + castleDanger(c, so.region) * 15;
      c.gold += gold;
      rep.gold = gold;
      c.stats.wins += 1;
      fame += 2;
      if (rs.taken >= total) {
        takeRegion(c, so.region);
        fame += 10;
        rep.title = `${def.name}を手に入れた！`;
        rep.lines.push(`${def.name}は暁ノ家の国になった。`);
        if (!c.flags.firstWin) { c.flags.firstWin = true; c.scenes.push(FIRST_WIN); }
      } else {
        rep.title = `${def.name}の領地を取った！（${rs.taken}/${total}）`;
        rep.lines.push(`残る領地はあと${total - rs.taken}。${total - rs.taken === 1 ? '次は城だ。城主が守っている。' : ''}`);
      }
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
      fame += 3;
    } else {
      rep.title = `${def.name}を奪われた……`;
      loseRegion(c, so.region, so.invasion.faction, so.invasion.commander);
      c.stats.losses += 1;
    }
    cleanupCommander(c, so.invasion.commander);
  } else if (so.mode === 'hunt') {
    if (win) {
      const bonus = 150 + lordLv(c) * 20;
      c.gold += bonus;
      rep.gold = bonus;
      rep.title = '妖魔の群れを討ち払った！';
      rep.lines.push(`村人からお礼に${bonus}文が届いた。`);
      c.stats.hunts += 1;
      fame += 1;
    } else rep.title = '妖魔の群れに押し返された……';
  }
  if (fame) { addFame(c, fame); rep.fame = fame; rep.lines.push(`武名 +${fame}（${c.fame}）`); }
  rep.lines.push(`討った敵兵 ${killed}・失った兵 ${rep.lost}（傷ついた兵は休めば戻る）${rep.gained ? `・勝って加わった兵 ${rep.gained}` : ''}`);
  if (rep.killed.length) rep.lines.push(`${rep.killed.join('・')}は討死した。`);
  const injured = b.units.filter((u) => u.side === 'L' && u.out && u.gen !== LORD).map((u) => baseOf(c, u.gen).short);
  if (injured.length) rep.lines.push(`${injured.join('・')}は部隊が壊滅し、2季節のあいだ出陣できない。`);
  c.sortie = null;
  // 朔の部隊が壊滅した：暁ノ家はおしまい（季節の始めからやり直せる）
  if (b.units.some((u) => u.lord && u.out)) {
    c.defeat = c.turn;
    c.defeatReason = 'lord';
    c.scenes.push(LORD_FALLS);
    rep.lines.push('朔の部隊が壊滅した……');
  }
  checkFactions(c);
  checkEnd(c);
  checkTitles(c);
  return rep;
}

/** 出陣の記録が壊れていた時：部隊は本陣へ戻る */
export function abortSortie(c: Campaign) {
  const so = c.sortie;
  if (!so) return;
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
    c.scenes.push({ title: '捕縛', lines: [[id, def.refuse ?? `${def.short}「……主家ある限り、仕えぬ」`], ['', `${def.name}を牢に入れた。説得するか、主家が滅べば心を変えるかもしれない。`]] });
    news(c, `${def.name}を捕らえ、牢に入れた。`, 'info');
    return;
  }
  g.status = 'jail';
  c.captives.push(id);
}

function joinUs(c: Campaign, id: string) {
  const g = c.gens[id];
  g.status = 'ours';
  g.injured = 0;
  g.troops = Math.max(g.troops, Math.round(maxTroops(c, id) * 0.5));
  g.wounded = 0;
}

export function recruit(c: Campaign, id: string): Scene | null {
  const i = c.captives.indexOf(id);
  if (i < 0) return null;
  c.captives.splice(i, 1);
  joinUs(c, id);
  const g = c.gens[id];
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
  r.prep = 0;
  r.sabotage = 0;
  r.np = Math.max(1, Math.round(r.np * 0.7));
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
  r.prep = 0;
  r.sabotage = 0;
  r.np = Math.max(1, r.np - 2);
  const boss = commander && c.gens[commander]?.status === 'enemy' ? commander : makeGeneric(c, f, Math.max(3, regionDef(rid).danger + 2));
  r.boss = boss;
  c.factions[f].war = true;
  news(c, `${regionDef(rid).name}が${FACTIONS[f].name}に奪われた。`, 'bad');
  if (rid === HOME) {
    c.defeat = c.turn;
    c.defeatReason = 'home';
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
    c.factions[f].war = false;
    c.scenes.push(factionFallen(f));
    news(c, `${FACTIONS[f].name}が滅んだ。`, 'good');
    addFame(c, 5);
    c.invasions = c.invasions.filter((inv) => inv.faction !== f);
    for (const g of Object.values(c.gens)) {
      if (g.faction !== f) continue;
      if (g.status === 'jail' && !c.captives.includes(g.id)) {
        joinUs(c, g.id);
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
  { id: 'first', name: '初陣', desc: '初めて国を手に入れた' },
  { id: 'five', name: '五国の主', desc: '国を5つ持った' },
  { id: 'ten', name: '十国の覇者', desc: '国を10持った' },
  { id: 'unify', name: '天下人', desc: '八洲十五国をすべて手に入れた' },
  { id: 'kurobuchi', name: '霧祓い', desc: '蛟王黒淵を討ち取った' },
  { id: 'gens10', name: '人望厚き主', desc: '家臣が10人を超えた' },
  { id: 'gensall', name: '綺羅星', desc: '固有の武将をすべて家臣にした' },
  { id: 'defend3', name: '鉄壁の守り', desc: '攻めてきた敵を3度追い返した' },
  { id: 'hunt5', name: '妖魔祓い', desc: '妖魔の群れを5回討ち払った' },
  { id: 'fame180', name: '天下に轟く', desc: '武名が120に達した' },
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
  give('fame180', c.fame >= 120);
  give('rich', c.gold >= 30000);
  give('fast', !!c.victory && c.victory <= 30);
  give('kills', c.stats.kills >= 10000);
}

// ── 国の命令（武将の能力の合計が要る。足りない分は次へ持ち越す） ──

export interface CommandDef {
  id: CommandId;
  name: string;
  /** 合計する能力 */
  stat: 'cmd' | 'pow' | 'int';
  /** 扇を使うか */
  fan: boolean;
  desc: string;
}

export const COMMANDS: Record<CommandId, CommandDef> = {
  build: { id: 'build', name: '建設', stat: 'cmd', fan: true, desc: '国力を1上げる（最大30）。収入と、維持できる部隊が増える。' },
  prepare: { id: 'prepare', name: '戦の準備', stat: 'pow', fan: true, desc: '隣の敵の国との次の合戦で、味方の戦場補正を+7%（最大50%）。' },
  war: { id: 'war', name: '宣戦布告', stat: 'int', fan: true, desc: 'その勢力の国へ攻め込めるようにする。' },
  search: { id: 'search', name: '人材探索', stat: 'int', fan: true, desc: '名もなき武将を探して家臣に迎える。' },
  sabotage: { id: 'sabotage', name: '工作', stat: 'int', fan: true, desc: '隣の敵の国に流言を放ち、次の合戦で敵の兵を2割減らす（最大4割）。' },
  persuade: { id: 'persuade', name: '説得', stat: 'int', fan: false, desc: '牢の将を説く（扇を使わない）。' },
};

/** 命令に要る点 */
export function commandNeed(c: Campaign, cmd: CommandId, target: string): number {
  switch (cmd) {
    case 'build': return 60 + c.regions[target].np * 12;
    case 'prepare': return 50 + Math.round(c.regions[target].prep * 400);
    case 'war': return 250 + 50 * regionsOf(c, c.regions[target].owner).length;
    case 'search': return 120 + ourGenerals(c).length * 10;
    case 'sabotage': return 90 + Math.round(c.regions[target].sabotage * 300);
    case 'persuade': { const def = GEN_BY_ID[target]; return 160 + (def ? Math.round(def.cmd + def.int) : 100); }
    default: return 999;
  }
}

export function commandKey(cmd: CommandId, target: string): string {
  return `${cmd}:${target}`;
}

/** 命令に出せる武将（壊滅の傷が無い家臣。合戦に出たかどうかは問わない） */
export function commandGenerals(c: Campaign): GenState[] {
  return Object.values(c.gens).filter((g) => g.status === 'ours' && g.injured <= 0);
}

export function statOf(c: Campaign, id: string, stat: CommandDef['stat']): number {
  const b = baseOf(c, id);
  return b[stat] + c.gens[id].lv;
}

export function commandError(c: Campaign, cmd: CommandId, target: string, gens: string[]): string | null {
  const def = COMMANDS[cmd];
  if (c.defeat) return '戦は終わった';
  if (def.fan && c.fans <= 0) return 'この季節の行動は残っていない';
  if (!gens.length) return '武将を選んでください';
  if (gens.length > 5) return '5人まで';
  if (gens.some((id) => !commandGenerals(c).some((g) => g.id === id))) return '出せない武将がいる';
  switch (cmd) {
    case 'build':
      if (c.regions[target]?.owner !== 'akatsuki') return '自分の国ではない';
      if (c.regions[target].np >= 30) return '国力は最大';
      return null;
    case 'prepare':
      if (!isBorder(c, target)) return '隣の敵の国ではない';
      if (c.regions[target].prep >= 0.5) return '準備は最大';
      return null;
    case 'war': {
      const f = c.regions[target]?.owner;
      if (!f || f === 'akatsuki' || !isBorder(c, target)) return '隣の敵の国ではない';
      if (c.factions[f].war) return 'すでに戦っている';
      return null;
    }
    case 'search':
      if (c.regions[target]?.owner !== 'akatsuki') return '自分の国ではない';
      return null;
    case 'sabotage':
      if (!isBorder(c, target)) return '隣の敵の国ではない';
      if (c.regions[target].sabotage >= 0.4) return '工作は最大';
      return null;
    case 'persuade': {
      const g = c.gens[target];
      if (!g || g.status !== 'jail' || c.captives.includes(target)) return '牢にいない';
      return null;
    }
    default: return '不明な命令';
  }
}

export interface CommandResult { done: boolean; points: number; need: number; text: string; scene?: Scene }

/** 命令を出す。点が足りれば成し遂げ、足りなければ持ち越す */
export function doCommand(c: Campaign, cmd: CommandId, target: string, gens: string[]): CommandResult {
  const err = commandError(c, cmd, target, gens);
  if (err) throw new Error(err);
  const def = COMMANDS[cmd];
  if (def.fan) c.fans -= 1;
  const key = commandKey(cmd, target);
  const need = commandNeed(c, cmd, target);
  const points = gens.reduce((s, id) => s + statOf(c, id, def.stat), 0) + (c.progress[key] ?? 0);
  if (points < need) {
    c.progress[key] = points;
    return { done: false, points, need, text: `${def.name}は${points}/${need}まで進んだ。続きは次の命令で。` };
  }
  delete c.progress[key];
  const name = regionDef(cmd === 'persuade' ? HOME : target).name;
  switch (cmd) {
    case 'build': {
      const r = c.regions[target];
      r.np = Math.min(30, r.np + 1);
      news(c, `${name}の国力が${r.np}になった。`, 'good');
      return { done: true, points, need, text: `${name}の国力が${r.np}に上がった。` };
    }
    case 'prepare': {
      const r = c.regions[target];
      r.prep = Math.min(0.5, Math.round((r.prep + 0.07) * 100) / 100);
      return { done: true, points, need, text: `${name}との合戦の準備が整った（戦場補正+${Math.round(r.prep * 100)}%）。` };
    }
    case 'war': {
      const f = c.regions[target].owner;
      c.factions[f].war = true;
      news(c, `${FACTIONS[f].name}に宣戦布告した！`, 'warn');
      return { done: true, points, need, text: `${FACTIONS[f].name}に宣戦布告した。${FACTIONS[f].name}の国へ攻め込める。` };
    }
    case 'search': {
      const lv = Math.max(2, Math.round(lordLv(c) * 0.8));
      const id = makeGeneric(c, 'ronin', lv);
      joinUs(c, id);
      c.gens[id].troops = maxTroops(c, id);
      const info = genInfo(c, id);
      news(c, `人材探索で${info.name}（${KINDS[c.gens[id].kind].name}）が家臣に加わった。`, 'good');
      checkTitles(c);
      return { done: true, points, need, text: `${info.name}（${KINDS[c.gens[id].kind].name}・Lv${c.gens[id].lv}）が家臣に加わった。` };
    }
    case 'sabotage': {
      const r = c.regions[target];
      r.sabotage = Math.min(0.4, Math.round((r.sabotage + 0.2) * 100) / 100);
      return { done: true, points, need, text: `${name}に流言を放った。次の合戦で敵の兵が${Math.round(r.sabotage * 100)}%減る。` };
    }
    case 'persuade': {
      joinUs(c, target);
      const info = genInfo(c, target);
      news(c, `${info.name}を説き伏せ、家臣に迎えた。`, 'good');
      checkTitles(c);
      return { done: true, points, need, text: `${info.name}が家臣になった！`, scene: { title: '説得', mood: 'victory', lines: [[target, info.def?.join || `${info.short}「……負けた。そなたの言葉にな」`], ['', `${info.name}が家臣になった！`]] } };
    }
    default:
      return { done: false, points, need, text: '' };
  }
}

// ── 交流 ──

export function bondError(c: Campaign, id: string): string | null {
  const g = c.gens[id];
  if (!g || g.status !== 'ours' || id === LORD) return '家臣ではない';
  if (c.fans <= 0) return 'この季節の行動は残っていない';
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
  c.fans -= 1;
  g.exp = Math.max(g.exp, expFor(g.lv + 1));
  g.lv += 1;
  addFame(c, 3);
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

// ── 城下：兵の補充・増員・浪人宿（扇を使わない） ──

/** 傷ついた兵をすぐ戻す（払える分だけ） */
export function healNow(c: Campaign, id: string): string | null {
  const g = c.gens[id];
  if (!g || g.status !== 'ours') return '家臣ではない';
  const room = Math.min(g.wounded, Math.max(0, maxTroops(c, id) - g.troops));
  if (room <= 0) return '傷ついた兵はいない';
  const per = KINDS[g.kind].heal / 10;
  const n = per <= 0 ? room : Math.min(room, Math.floor(c.gold / per));
  if (n <= 0) return '文が足りない';
  c.gold -= Math.ceil(n * per);
  g.troops += n;
  g.wounded -= n;
  return null;
}

/** 上限まで新しく兵を雇う（払える分だけ） */
export function hireTroops(c: Campaign, id: string): string | null {
  const g = c.gens[id];
  if (!g || g.status !== 'ours') return '家臣ではない';
  const room = Math.max(0, maxTroops(c, id) - g.troops - g.wounded);
  if (room <= 0) return '兵は上限まで集まっている';
  const per = (KINDS[g.kind].hire * 0.25) / 10;
  const n = Math.min(room, Math.floor(c.gold / per));
  if (n <= 0) return '文が足りない';
  c.gold -= Math.ceil(n * per);
  g.troops += n;
  return null;
}

/** 全員の兵を戻し、足りない分を雇う（文が尽きたら途中まで）。手当てした部隊の数 */
export function refillAll(c: Campaign): number {
  let n = 0;
  const list = Object.values(c.gens).filter((g) => g.status === 'ours').sort((a, b) => (a.id === LORD ? -1 : b.id === LORD ? 1 : 0));
  for (const g of list) {
    let did = false;
    if (healCost(c, g.id) > 0 && !healNow(c, g.id)) did = true;
    if (hireCost(c, g.id) > 0 && !hireTroops(c, g.id)) did = true;
    if (did) n++;
  }
  return n;
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
  joinUs(c, id);
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
  // 収入（維持費が国力を超えると半分）
  const inc = income(c);
  c.gold += inc;
  news(c, totalUpkeep(c) > totalNp(c) ? `収入${inc}文（維持費${totalUpkeep(c)}が国力${totalNp(c)}を超え、半分になった）。` : `収入として${inc}文が入った。`, totalUpkeep(c) > totalNp(c) ? 'warn' : 'info');
  // 傷：この季節に戦っていない部隊は、傷ついた兵が上限まで戻る。僧兵は兵がすべて戻る
  for (const g of Object.values(c.gens)) {
    if (g.injured > 0) g.injured -= 1;
    if (g.status !== 'ours') continue;
    const max = maxTroops(c, g.id);
    if (g.kind === 'sohei' && g.injured <= 0) { g.troops = max; g.wounded = 0; continue; }
    if (g.fought < c.turn && g.wounded > 0) {
      const n = Math.min(g.wounded, Math.max(0, max - g.troops));
      g.troops += n;
      g.wounded = 0;
    }
    g.troops = Math.min(max, g.troops);
  }
  // 敵の国の取られた領地は、3季節ごとに1つ取り返される
  for (const r of Object.values(c.regions)) if (r.owner !== 'akatsuki' && r.taken > 0 && c.turn % 3 === 0) r.taken -= 1;
  enemyPhase(c);
  c.turn += 1;
  c.fans = maxFans(c);
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

/** 敵の手番：攻めてくるのは1ターンに1度まで */
function enemyPhase(c: Campaign) {
  if (c.turn < 3) return;
  const found: Invasion[] = [];
  const order = useRng(c, (r) => shuffle(r, FACTION_IDS.filter((f) => f !== 'akatsuki' && c.factions[f].alive)));
  for (const f of order) {
    if (found.length >= 1) break;
    const p = invadeChance(c, f);
    if (p <= 0 || !useRng(c, (r) => chance(r, p))) continue;
    const targets = ownedRegions(c).filter((r) => regionDef(r.id).adj.some((a) => c.regions[a].owner === f));
    if (!targets.length) continue;
    const to = useRng(c, (r) => pick(r, targets));
    const from = regionDef(to.id).adj.filter((a) => c.regions[a].owner === f).sort((a, b) => regionDef(b).danger - regionDef(a).danger)[0];
    const danger = invasionDanger(c, from);
    const commander = makeGeneric(c, f, danger + 1);
    c.factions[f].war = true;
    found.push({ from, to: to.id, faction: f, commander, danger });
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
  c.invasions = found.filter((inv) => c.factions[inv.faction].alive && c.regions[inv.from].owner === inv.faction && !!c.gens[inv.commander]);
  for (const inv of found) if (!c.invasions.includes(inv)) cleanupCommander(c, inv.commander);
}

function invadeChance(c: Campaign, f: FactionId): number {
  if (f === 'ronin') return c.factions.ronin.war ? 0.25 : 0;
  if (f === 'youma') return c.turn < YOUMA_TURN ? 0 : Math.min(0.55, 0.25 + (c.turn - YOUMA_TURN) * 0.02);
  return Math.min(0.55, FACTIONS[f].aggression * (0.6 + c.turn * 0.03) * (c.factions[f].war ? 1.3 : 1));
}

/** 迎え撃つ合戦の前に、侵攻の一覧から外す */
export function takeInvasion(c: Campaign, inv: Invasion) {
  const i = c.invasions.indexOf(inv);
  if (i >= 0) c.invasions.splice(i, 1);
}

/** 守りの陣立てを自動で組む（朔を除き、兵の多い順に6部隊） */
export function autoDefenders(c: Campaign): Placement[] {
  const list = readyGenerals(c).filter((g) => g.id !== LORD).sort((a, b) => b.troops - a.troops).slice(0, MAX_PARTY);
  return autoPlace(list.map((g) => ({ id: g.id, kind: g.kind })));
}

/** おまかせで守る：同じ合戦の仕組みで、両軍とも自動で戦う（出せる家臣がいなければ国を失う） */
export function autoDefend(c: Campaign, inv: Invasion, seed: number): { report: Report | null; battle: Battle | null } {
  takeInvasion(c, inv);
  const party = autoDefenders(c);
  if (!party.length) {
    loseRegion(c, inv.to, inv.faction, inv.commander);
    checkFactions(c);
    return { report: null, battle: null };
  }
  const spec = beginBattle(c, 'defense', inv.to, party, seed, inv);
  const b = createBattle(spec);
  for (let i = 0; i < 300 && !b.end; i++) act(b, chooseAction(b));
  return { report: finishBattle(c, b), battle: b };
}

/** 敵の国の名のある将（地図の情報用） */
export function regionLeaders(c: Campaign, rid: string): string[] {
  const r = c.regions[rid];
  return [r.boss, r.mid].filter((x): x is string => !!x && c.gens[x]?.status === 'enemy');
}

export { traitsOf };
