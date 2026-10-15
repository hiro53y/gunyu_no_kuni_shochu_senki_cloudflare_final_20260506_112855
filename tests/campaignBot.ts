// 国盗りを最初から最後まで自動で遊ぶボット（本陣の判断＋迷宮は上手なボット）
import { itemDef } from '../src/content/items';
import { regionDef } from '../src/content/sengoku';
import {
  buy, canAttack, castleDanger, depart, develop, devError, doBond, bondError, endTurn, equipStore, finishSortie, hire, holdCastle, holdOdds,
  ownedRegions, readyGenerals, recruit, roninList, smith, smithCost, stockPrice, takeInvasion, type Report,
} from '../src/campaign/campaign';
import type { Campaign } from '../src/campaign/state';
import { deserializeCampaign } from '../src/engine/save';
import { createRun } from '../src/engine/run';
import type { RunMode } from '../src/engine/types';
import { mulberry, playOut, smartAction, type Rand } from './bot';

export interface CampaignResult {
  c: Campaign;
  errors: string[];
  battles: { turn: number; mode: RunMode; region: string; kind: Report['kind']; lv: number; danger: number }[];
}

function checkCampaign(c: Campaign): string[] {
  const bad: string[] = [];
  if (!Number.isFinite(c.gold) || c.gold < 0) bad.push(`文が不正 ${c.gold}`);
  if (c.ap < 0 || c.ap > 3) bad.push(`行動が不正 ${c.ap}`);
  const uids = new Set<number>();
  for (const i of c.store) { if (uids.has(i.uid)) bad.push(`蔵の番号が重複 ${i.uid}`); uids.add(i.uid); }
  for (const [slot, uid] of Object.entries(c.eq)) if (uid !== undefined && !c.store.some((i) => i.uid === uid)) bad.push(`装備 ${slot} が蔵に無い`);
  for (const r of Object.values(c.regions)) {
    if (r.owner === 'akatsuki' && (r.boss || r.mid)) bad.push(`自分の国 ${r.id} に敵の将がいる`);
    if (r.owner !== 'akatsuki' && !r.boss) bad.push(`敵の国 ${r.id} に城主がいない`);
    for (const id of [r.boss, r.mid]) if (id && c.gens[id]?.status !== 'enemy') bad.push(`国 ${r.id} の将 ${id} が敵でない（${c.gens[id]?.status}）`);
  }
  for (const g of Object.values(c.gens)) {
    if (g.status === 'ours' && g.faction === 'youma' && g.id === 'g_kurobuchi') bad.push('黒淵が家臣になっている');
    if (!Number.isFinite(g.lv) || g.lv < 1) bad.push(`武将のLvが不正 ${g.id}`);
  }
  return bad;
}

/** 蔵の物から、持っていく物を選ぶ（回復・食べ物・巻物・杖） */
function chooseCarry(c: Campaign): number[] {
  const eq = new Set(Object.values(c.eq));
  const score = (id: string) => {
    const cat = itemDef(id).cat;
    if (['g_yakusou', 'g_daiyakusou', 'g_fukkatsu'].includes(id)) return 10;
    if (cat === 'food') return 8;
    if (id === 's_kikan') return 7;
    if (cat === 'staff' || cat === 'scroll') return 5;
    if (cat === 'grass') return 3;
    return 0;
  };
  return c.store.filter((i) => !eq.has(i.uid) && score(i.id) > 0).sort((a, b) => score(b.id) - score(a.id)).slice(0, 10).map((i) => i.uid);
}

function equipBest(c: Campaign) {
  for (const cat of ['weapon', 'armor'] as const) {
    const pow = (uid?: number) => {
      const i = c.store.find((x) => x.uid === uid);
      return i ? (itemDef(i.id).power ?? 0) + (i.plus ?? 0) : -99;
    };
    const cur = c.eq[cat];
    const curItem = c.store.find((x) => x.uid === cur);
    if (curItem?.cursed) continue;
    const best = c.store.filter((i) => itemDef(i.id).cat === cat && !i.cursed).sort((a, b) => pow(b.uid) - pow(a.uid))[0];
    if (best && best.uid !== cur && pow(best.uid) > pow(cur)) equipStore(c, best.uid);
  }
}

function shop(c: Campaign) {
  equipBest(c);
  // 鍛冶：装備を少しずつ鍛える
  for (const slot of ['weapon', 'armor'] as const) {
    const item = c.store.find((i) => i.uid === c.eq[slot]);
    if (item && c.gold > smithCost(item) + 1500 && (item.plus ?? 0) < c.lord.lv / 2) smith(c, item.uid);
  }
  // 薬草とおにぎり
  const herbs = c.store.filter((i) => i.id === 'g_yakusou').length;
  for (let k = herbs; k < 4 && c.gold > stockPrice('g_yakusou') + 600; k++) buy(c, 'g_yakusou');
  const food = c.store.filter((i) => itemDef(i.id).cat === 'food').length;
  for (let k = food; k < 3 && c.gold > stockPrice('f_onigiri') + 600; k++) buy(c, 'f_onigiri');
  // 浪人を雇う（家臣が少ない時）
  if (readyGenerals(c).length < 4) {
    const r = roninList(c).filter((g) => (g.wage ?? 0) < c.gold - 800).sort((a, b) => b.lv - a.lv)[0];
    if (r) hire(c, r.id);
  }
}

/** 1回の冒険を遊ばせる */
function battle(c: Campaign, mode: RunMode, rid: string, rand: Rand, seed: number, res: CampaignResult, inv?: Campaign['invasions'][number]) {
  const party = readyGenerals(c).sort((a, b) => b.lv - a.lv).slice(0, 2).map((g) => g.id);
  const spec = depart(c, mode, rid, { party, carry: chooseCarry(c) }, seed, inv);
  const run = createRun(spec);
  const out = playOut(run, smartAction, rand, 40000);
  res.errors.push(...out.errors);
  if (!out.run.end) out.run.end = { kind: 'quit', cause: '時間切れ', floor: out.run.floorNo };
  const rep = finishSortie(c, out.run);
  res.battles.push({ turn: c.turn, mode, region: rid, kind: rep.kind, lv: c.lord.lv, danger: spec.danger0 });
  for (const id of [...c.captives]) recruit(c, id);
}

export function playCampaign(c: Campaign, seed: number, maxTurns = 120, roundTrip = false): CampaignResult {
  const rand = mulberry(seed);
  const res: CampaignResult = { c, errors: [], battles: [] };
  let n = 0;
  for (; c.turn <= maxTurns && !c.defeat && !c.victory; ) {
    c.scenes = [];
    for (const id of [...c.captives]) recruit(c, id);
    // 攻めてきた敵
    for (const inv of [...c.invasions]) {
      if (holdOdds(c, inv) >= 0.6 || readyGenerals(c).length === 0 && c.lord.lv < 3) holdCastle(c, inv);
      else { takeInvasion(c, inv); battle(c, 'defense', inv.to, rand, seed * 1000 + n++, res, inv); }
      if (c.defeat) break;
    }
    if (c.defeat) break;
    shop(c);
    while (c.ap > 0 && !c.defeat && !c.victory) {
      const targets = Object.keys(c.regions).filter((rid) => canAttack(c, rid)).sort((a, b) => castleDanger(c, a) - castleDanger(c, b));
      const target = targets[0];
      const strength = c.lord.lv + readyGenerals(c).slice(0, 2).reduce((s, g) => s + g.lv, 0) / 4;
      if (target && strength >= castleDanger(c, target) * 1.05 + (regionDef(target).floors - 3)) {
        battle(c, 'siege', target, rand, seed * 1000 + n++, res);
        continue;
      }
      // 守りの弱い国の城を固める
      const weak = ownedRegions(c).filter((r) => regionDef(r.id).adj.some((a) => c.regions[a].owner !== 'akatsuki')).sort((a, b) => a.wall * 150 + a.troops - (b.wall * 150 + b.troops))[0];
      if (weak && c.gold > 3000 && !devError(c, weak.id, 'wall') && rand() < 0.5) { develop(c, weak.id, 'wall'); continue; }
      if (weak && c.gold > 2500 && !devError(c, weak.id, 'troops') && rand() < 0.3) { develop(c, weak.id, 'troops'); continue; }
      const bondTarget = readyGenerals(c).find((g) => !bondError(c, g.id));
      if (bondTarget && rand() < 0.25) { doBond(c, bondTarget.id); continue; }
      // 修行
      const home = ownedRegions(c)[0];
      battle(c, 'hunt', home.id, rand, seed * 1000 + n++, res);
    }
    if (c.defeat || c.victory) break;
    try {
      endTurn(c);
    } catch (e) {
      res.errors.push(`endTurn ${(e as Error).message}`);
      break;
    }
    res.errors.push(...checkCampaign(c).map((e) => `t${c.turn} ${e}`));
    if (res.errors.length) break;
    if (roundTrip) {
      const back = deserializeCampaign(JSON.stringify(c));
      if (!back) { res.errors.push('本陣の保存を読み込めない'); break; }
      Object.assign(c, back);
    }
  }
  return res;
}
