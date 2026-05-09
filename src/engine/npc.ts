// ===========================================================================
// NPC勢力AI v2.1
// ターン終了時に各NPC勢力の行動を決定し適用する。
// 現状は意思決定の枠組みを実装し、合戦・建設・徴兵を中心に処理する。
// ===========================================================================

import type { Faction, FactionId, GameState, Region } from '../types/game';
import type { Rng } from './rng';
import { initBattle, autoResolve, finalizeBattle } from './battle';

/** NPC勢力が支配する地域を返す */
function ownRegions(state: GameState, fid: FactionId): Region[] {
  return Object.values(state.regions).filter((r) => r.factionId === fid);
}

/** 隣接する敵地域を返す */
function adjacentEnemyRegions(state: GameState, fid: FactionId): Region[] {
  const own = ownRegions(state, fid);
  const set = new Set<string>();
  for (const r of own) {
    for (const adj of r.adjacentIds) {
      const ar = state.regions[adj];
      if (ar && ar.factionId !== fid && ar.factionId !== null) set.add(adj);
    }
  }
  return [...set].map((id) => state.regions[id]).filter((r): r is Region => Boolean(r));
}

/** 自勢力の合戦員候補（兵数が一定以上の武将） */
function combatRoster(state: GameState, fid: FactionId, max = 3): string[] {
  return Object.values(state.generals)
    .filter((g) => g.factionId === fid && (g.status === 'free' || g.status === 'recruited'))
    .filter((g) => g.troopCurrent >= 100)
    .sort((a, b) => (b.stats.power + b.stats.command) - (a.stats.power + a.stats.command))
    .slice(0, max)
    .map((g) => g.id);
}

/** 侵攻判断のしきい値（性格別） */
function aggressionScore(faction: Faction): number {
  switch (faction.aiPersonality) {
    case 'aggressive': return 0.85;
    case 'monstrous':  return 0.95;
    case 'mercenary':  return 0.30;
    case 'economic':   return 0.40;
    case 'religious':  return 0.55;
    case 'defensive':  return 0.45;
    default:           return 0.50;
  }
}

/** NPC が侵攻先を選択して合戦を実行する */
function tryNpcInvasion(state: GameState, fid: FactionId, rng: Rng): GameState {
  const faction = state.factions[fid];
  if (faction.destroyed) return state;
  if (!rng.chance(aggressionScore(faction))) return state;

  const targets = adjacentEnemyRegions(state, fid);
  if (targets.length === 0) return state;

  // 国力の低い地域を優先
  const target = targets.sort((a, b) => a.power - b.power)[0];

  const attackerIds = combatRoster(state, fid, 3);
  if (attackerIds.length === 0) return state;

  const defenderFid = target.factionId;
  if (!defenderFid) return state;
  const defenderIds = combatRoster(state, defenderFid, 3);

  const battle = initBattle(state, {
    regionId: target.id,
    playerIsAttacker: false,
    attackerFactionId: fid,
    defenderFactionId: defenderFid,
    playerGeneralIds: defenderFid === 'akatsuki' ? defenderIds : Array(9).fill(null),
    enemyGeneralIds: fid === 'akatsuki' ? Array(9).fill(null) : attackerIds,
  });

  // プレイヤーが防衛側でない（NPC vs NPC）の場合のみ自動解決
  if (fid !== 'akatsuki' && defenderFid !== 'akatsuki') {
    const resolved = autoResolve(battle, state, rng);
    const fin = finalizeBattle(state, resolved, rng);
    return fin.state;
  }
  // プレイヤー絡みの戦闘は通常 UI から起動するため、ここでは行わない
  return state;
}

/** NPC が自国地域を建設・補強する */
function tryNpcImprove(state: GameState, fid: FactionId): GameState {
  const own = ownRegions(state, fid);
  if (own.length === 0) return state;
  // 国力が低い地域を1つ強化
  const target = own.sort((a, b) => a.power - b.power)[0];
  return {
    ...state,
    regions: {
      ...state.regions,
      [target.id]: {
        ...target,
        power: Math.min(10, target.power + 1),
        satisfaction: Math.min(100, target.satisfaction + 3),
      },
    },
  };
}

/** 妖魔勢力の特殊成長（ターン経過で強化） */
function applyYoumaGrowth(state: GameState, rng: Rng): GameState {
  if (state.turn < 30) return state;
  // 30ターン以降、妖魔の地域の国力を上げる
  const next = { ...state, regions: { ...state.regions } };
  for (const r of Object.values(state.regions)) {
    if (r.factionId === 'youma') {
      next.regions[r.id] = { ...r, power: Math.min(10, r.power + (rng.chance(0.4) ? 1 : 0)) };
    }
  }
  return next;
}

/** 全 NPC 勢力のターン処理を実行 */
export function runNpcTurn(state: GameState, rng: Rng): GameState {
  let next = state;
  const npcIds: FactionId[] = ['kurogane', 'shion', 'shirasagi', 'honoo', 'rengein', 'youma', 'ronin'];

  for (const fid of npcIds) {
    const f = next.factions[fid];
    if (!f || f.destroyed) continue;
    if (ownRegions(next, fid).length === 0) {
      next = { ...next, factions: { ...next.factions, [fid]: { ...f, destroyed: true } } };
      continue;
    }

    // 行動回数：性格別 1〜2回
    const acts = f.aiPersonality === 'aggressive' || f.aiPersonality === 'monstrous' ? 2 : 1;
    for (let i = 0; i < acts; i++) {
      // 30%で侵攻、70%で建設・補強
      if (rng.chance(0.3)) {
        next = tryNpcInvasion(next, fid, rng);
      } else {
        next = tryNpcImprove(next, fid);
      }
    }
  }

  next = applyYoumaGrowth(next, rng);
  return next;
}
