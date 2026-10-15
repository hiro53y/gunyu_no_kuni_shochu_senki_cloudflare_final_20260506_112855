// 国盗りを最初から最後まで自動で遊ぶボット（本陣の判断＋合戦はおまかせ）
import { regionDef } from '../src/content/sengoku';
import { LORD } from '../src/content/generals';
import {
  addExtra, beginBattle, bondError, canAttack, castleDanger, devError, develop, doBond, endTurn, finishBattle, hire, holdCastle, holdOdds,
  invasionDanger, lordLv, ownedRegions, readyGenerals, recruit, refillAll, roninList, takeInvasion, type Report,
} from '../src/campaign/campaign';
import { autoPlace, genPower } from '../src/campaign/army';
import type { Campaign } from '../src/campaign/state';
import { deserializeCampaign } from '../src/engine/save';
import { act, createBattle } from '../src/battle/engine';
import { chooseAction } from '../src/battle/ai';
import type { Battle, BattleKind } from '../src/battle/types';

export interface CampaignResult {
  c: Campaign;
  errors: string[];
  battles: { turn: number; mode: BattleKind; region: string; kind: Report['kind']; lv: number; danger: number; reason?: string }[];
}

function checkCampaign(c: Campaign): string[] {
  const bad: string[] = [];
  if (!Number.isFinite(c.gold) || c.gold < 0) bad.push(`文が不正 ${c.gold}`);
  if (c.ap < 0 || c.ap > 3) bad.push(`行動が不正 ${c.ap}`);
  for (const r of Object.values(c.regions)) {
    if (r.owner === 'akatsuki' && (r.boss || r.mid)) bad.push(`自分の国 ${r.id} に敵の将がいる`);
    if (r.owner !== 'akatsuki' && !r.boss) bad.push(`敵の国 ${r.id} に城主がいない`);
    for (const id of [r.boss, r.mid]) if (id && c.gens[id]?.status !== 'enemy') bad.push(`国 ${r.id} の将 ${id} が敵でない（${c.gens[id]?.status}）`);
    if (r.taken < 0) bad.push(`砦の数が負 ${r.id}`);
  }
  for (const g of Object.values(c.gens)) {
    if (g.status === 'ours' && g.id === 'g_kurobuchi') bad.push('黒淵が家臣になっている');
    if (!Number.isFinite(g.lv) || g.lv < 1) bad.push(`武将のLvが不正 ${g.id}`);
    if (!Number.isFinite(g.troops) || g.troops < 0) bad.push(`兵数が不正 ${g.id} ${g.troops}`);
  }
  return bad;
}

/** 合戦をおまかせで最後まで */
export function autoBattle(b: Battle): Battle {
  for (let i = 0; i < 3000 && !b.end; i++) act(b, chooseAction(b));
  return b;
}

/** 出せる武将から強い順に6人（朔は必ず）を並べる */
export function botParty(c: Campaign) {
  const ready = readyGenerals(c);
  const score = (id: string) => { const p = genPower(c, id); return (p.atk + p.def + p.int) * Math.sqrt(c.gens[id].troops); };
  const list = ready.filter((g) => g.id !== LORD).sort((a, b) => score(b.id) - score(a.id)).slice(0, 5);
  const all = [c.gens[LORD], ...list].filter((g) => g && g.troops > 0);
  return autoPlace(all.map((g) => ({ id: g.id, kind: g.kind })));
}

function battle(c: Campaign, mode: BattleKind, rid: string, seed: number, res: CampaignResult, inv?: Campaign['invasions'][number]) {
  const party = botParty(c);
  const spec = beginBattle(c, mode, rid, party, seed, inv);
  const b = autoBattle(createBattle(spec));
  if (!b.end) res.errors.push(`合戦が終わらない ${rid}`);
  const danger = mode === 'siege' ? castleDanger(c, rid) : mode === 'defense' && inv ? invasionDanger(c, inv.from) : 0;
  const rep = finishBattle(c, b);
  res.battles.push({ turn: c.turn, mode, region: rid, kind: rep.kind, lv: lordLv(c), danger, reason: b.end?.reason });
  for (const id of [...c.captives]) recruit(c, id);
}

export function playCampaign(c: Campaign, seed: number, maxTurns = 120, roundTrip = false): CampaignResult {
  const res: CampaignResult = { c, errors: [], battles: [] };
  let n = 0;
  for (; c.turn <= maxTurns && !c.defeat && !c.victory; ) {
    c.scenes = [];
    for (const id of [...c.captives]) recruit(c, id);
    refillAll(c);
    // 攻めてきた敵
    for (const inv of [...c.invasions]) {
      if (holdOdds(c, inv) >= 0.6 || c.gens[LORD].troops <= 0) holdCastle(c, inv);
      else { takeInvasion(c, inv); battle(c, 'defense', inv.to, seed * 1000 + n++, res, inv); refillAll(c); }
      if (c.defeat) break;
    }
    if (c.defeat) break;
    if (readyGenerals(c).length < 5) {
      const r = roninList(c).filter((g) => (g.wage ?? 0) < c.gold - 600).sort((a, b) => b.lv - a.lv)[0];
      if (r) hire(c, r.id);
    }
    while (c.ap > 0 && !c.defeat && !c.victory) {
      refillAll(c);
      if (c.gens[LORD].troops <= 0) break;
      const targets = Object.keys(c.regions).filter((rid) => canAttack(c, rid)).sort((a, b) => castleDanger(c, a) - castleDanger(c, b));
      const target = targets[0];
      const strength = lordLv(c) + readyGenerals(c).filter((g) => g.id !== LORD).sort((a, b) => b.lv - a.lv).slice(0, 5).reduce((s, g) => s + g.lv, 0) / 8;
      if (target && strength >= castleDanger(c, target) * 0.95 + c.regions[target].taken * 0.5) {
        battle(c, 'siege', target, seed * 1000 + n++, res);
        continue;
      }
      const weak = ownedRegions(c).filter((r) => regionDef(r.id).adj.some((a) => c.regions[a].owner !== 'akatsuki')).sort((a, b) => a.wall * 150 + a.troops - (b.wall * 150 + b.troops))[0];
      if (weak && c.gold > 3000 && !devError(c, weak.id, 'wall') && n % 2 === 0) { develop(c, weak.id, 'wall'); n++; continue; }
      const bondTarget = readyGenerals(c).find((g) => g.id !== LORD && !bondError(c, g.id));
      if (bondTarget && n % 4 === 1) { doBond(c, bondTarget.id); n++; continue; }
      if (c.gold > 2500) { const g = readyGenerals(c).sort((a, b) => b.lv - a.lv)[0]; if (g) addExtra(c, g.id); }
      battle(c, 'hunt', ownedRegions(c)[0].id, seed * 1000 + n++, res);
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
