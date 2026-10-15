// 国盗りを最初から最後まで自動で遊ぶボット（本陣の判断＋合戦はおまかせ）
import { LORD } from '../src/content/generals';
import {
  autoDefend, beginBattle, bondError, canAttack, castleDanger, commandError, commandGenerals, doBond, doCommand, endTurn, finishBattle, hire, isBorder,
  lordLv, ownedRegions, readyGenerals, recruit, refillAll, roninList, statOf, takeInvasion, type Report,
} from '../src/campaign/campaign';
import { autoPlace, enemyTroops, genPower } from '../src/campaign/army';
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
  if (c.fans < 0 || c.fans > 5) bad.push(`扇が不正 ${c.fans}`);
  for (const r of Object.values(c.regions)) {
    if (r.owner === 'akatsuki' && (r.boss || r.mid)) bad.push(`自分の国 ${r.id} に敵の将がいる`);
    if (r.owner !== 'akatsuki' && !r.boss) bad.push(`敵の国 ${r.id} に城主がいない`);
    for (const id of [r.boss, r.mid]) if (id && c.gens[id]?.status !== 'enemy') bad.push(`国 ${r.id} の将 ${id} が敵でない（${c.gens[id]?.status}）`);
    if (r.taken < 0 || r.taken >= r.lands.length) bad.push(`領地の数が不正 ${r.id} ${r.taken}`);
    if (r.np < 1 || r.np > 30) bad.push(`国力が不正 ${r.id}`);
  }
  for (const g of Object.values(c.gens)) {
    if (g.status === 'ours' && g.id === 'g_kurobuchi') bad.push('黒淵が家臣になっている');
    if (!Number.isFinite(g.lv) || g.lv < 1) bad.push(`武将のLvが不正 ${g.id}`);
    if (!Number.isFinite(g.troops) || g.troops < 0 || g.wounded < 0) bad.push(`兵数が不正 ${g.id} ${g.troops}/${g.wounded}`);
  }
  return bad;
}

/** 合戦をおまかせで最後まで */
export function autoBattle(b: Battle): Battle {
  for (let i = 0; i < 3000 && !b.end; i++) act(b, chooseAction(b));
  return b;
}

/** 出せる武将から強い順に6部隊。朔は家臣が足りない時だけ出す（壊滅すると終わりなので） */
export function botParty(c: Campaign, withLord = false) {
  const ready = readyGenerals(c);
  const score = (id: string) => { const p = genPower(c, id); return (p.atk + p.def + p.int + 3) * Math.sqrt(c.gens[id].troops); };
  const others = ready.filter((g) => g.id !== LORD).sort((a, b) => score(b.id) - score(a.id));
  const lord = c.gens[LORD];
  const useLord = withLord || (others.length < 4 && lord.troops > 0 && lord.injured <= 0);
  const list = [...(useLord ? [lord] : []), ...others].slice(0, 6);
  const placed = autoPlace(list.map((g) => ({ id: g.id, kind: g.kind })));
  // 朔は守りやすい後衛へ（空きがあれば）
  const lp = placed.find((p) => p.gen === LORD);
  if (lp && lp.row === 0) {
    const free = ([0, 1, 2] as const).find((s) => !placed.some((p) => p.row === 1 && p.slot === s));
    if (free !== undefined) { lp.row = 1; lp.slot = free; }
  }
  return placed;
}

function battle(c: Campaign, mode: BattleKind, rid: string, seed: number, res: CampaignResult, inv?: Campaign['invasions'][number]) {
  const party = botParty(c);
  const spec = beginBattle(c, mode, rid, party, seed, inv);
  const b = autoBattle(createBattle(spec));
  if (!b.end) res.errors.push(`合戦が終わらない ${rid}`);
  const danger = mode === 'siege' ? castleDanger(c, rid) : inv?.danger ?? 0;
  const rep = finishBattle(c, b);
  res.battles.push({ turn: c.turn, mode, region: rid, kind: rep.kind, lv: lordLv(c), danger, reason: b.end?.reason });
  for (const id of [...c.captives]) recruit(c, id);
}

/** 命令に出す武将（その能力の高い順に5人） */
function bestFor(c: Campaign, stat: 'cmd' | 'pow' | 'int'): string[] {
  return commandGenerals(c).sort((a, b) => statOf(c, b.id, stat) - statOf(c, a.id, stat)).slice(0, 5).map((g) => g.id);
}

/** 味方の力の目安と、敵の領地の守りの目安 */
function ourPower(c: Campaign): number {
  return botParty(c).reduce((s, p) => s + c.gens[p.gen].troops * (1 + genPower(c, p.gen).atk / 10), 0);
}
export function enemyPower(c: Campaign, rid: string): number {
  const r = c.regions[rid];
  const d = castleDanger(c, rid) + Math.floor(r.taken / 2);
  const final = r.taken >= r.lands.length - 1;
  const size = Math.min(6, 2 + Math.floor(d / 6) + (final ? 1 : 0));
  return enemyTroops(d, 'bushi', false) * size * (1 + d / 40) * (1 - r.sabotage) * (r.lands[r.taken] === 'castle' ? 1.4 : r.lands[r.taken] === 'town' ? 1.15 : 1);
}

export function playCampaign(c: Campaign, seed: number, maxTurns = 120, roundTrip = false): CampaignResult {
  const res: CampaignResult = { c, errors: [], battles: [] };
  let n = 0;
  for (; c.turn <= maxTurns && !c.defeat && !c.victory; ) {
    c.scenes = [];
    for (const id of [...c.captives]) recruit(c, id);
    refillAll(c);
    // 攻めてきた敵：家臣が揃っていれば迎え撃ち、少なければおまかせ
    for (const inv of [...c.invasions]) {
      if (readyGenerals(c).filter((g) => g.id !== LORD).length >= 3) { takeInvasion(c, inv); battle(c, 'defense', inv.to, seed * 1000 + n++, res, inv); }
      else autoDefend(c, inv, seed * 1000 + n++);
      for (const id of [...c.captives]) recruit(c, id);
      refillAll(c);
      if (c.defeat) break;
    }
    if (c.defeat) break;
    if (readyGenerals(c).length < 6) {
      const r = roninList(c).filter((g) => (g.wage ?? 0) < c.gold - 600).sort((a, b) => b.lv - a.lv)[0];
      if (r) hire(c, r.id);
    }
    // 牢の将の説得（扇を使わない）
    for (const g of Object.values(c.gens)) {
      if (g.status === 'jail' && !c.captives.includes(g.id) && !commandError(c, 'persuade', g.id, bestFor(c, 'int'))) doCommand(c, 'persuade', g.id, bestFor(c, 'int'));
    }
    let guard = 0;
    while (c.fans > 0 && !c.defeat && !c.victory && guard++ < 10) {
      refillAll(c);
      const borders = Object.keys(c.regions).filter((rid) => isBorder(c, rid));
      const targets = borders.filter((rid) => canAttack(c, rid)).sort((a, b) => enemyPower(c, a) - enemyPower(c, b));
      const target = targets[0];
      if (target && readyGenerals(c).length >= 2 && ourPower(c) >= enemyPower(c, target)) {
        battle(c, 'siege', target, seed * 1000 + n++, res);
        continue;
      }
      // 攻められる国が無い・弱い国が無ければ、いちばん弱い隣国へ宣戦布告
      const easiest = [...borders].sort((a, b) => enemyPower(c, a) - enemyPower(c, b))[0];
      if (easiest && !c.factions[c.regions[easiest].owner].war && (!target || enemyPower(c, easiest) < enemyPower(c, target) * 0.7) && !commandError(c, 'war', easiest, bestFor(c, 'int'))) {
        doCommand(c, 'war', easiest, bestFor(c, 'int'));
        continue;
      }
      // 狙う国に工作・戦の準備
      if (target && n % 3 === 0 && !commandError(c, 'sabotage', target, bestFor(c, 'int'))) { doCommand(c, 'sabotage', target, bestFor(c, 'int')); n++; continue; }
      if (target && n % 3 === 1 && !commandError(c, 'prepare', target, bestFor(c, 'pow'))) { doCommand(c, 'prepare', target, bestFor(c, 'pow')); n++; continue; }
      const bondTarget = readyGenerals(c).find((g) => g.id !== LORD && !bondError(c, g.id));
      if (bondTarget && n % 4 === 2) { doBond(c, bondTarget.id); n++; continue; }
      const poor = ownedRegions(c).filter((r) => r.np < 30).sort((a, b) => a.np - b.np)[0];
      if (poor && !commandError(c, 'build', poor.id, bestFor(c, 'cmd'))) { doCommand(c, 'build', poor.id, bestFor(c, 'cmd')); n++; continue; }
      if (readyGenerals(c).length >= 2) battle(c, 'hunt', ownedRegions(c)[0].id, seed * 1000 + n++, res);
      else break;
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
