// ===========================================================================
// ゲーム初期化・ターン進行の統括
// 新規ゲーム作成と、ターン終了時の処理（経済→イベント→NPC→自動セーブ）を担う。
// ===========================================================================

import type { GameState, GeneralId, FactionId } from './types/game';
import { buildInitialRegions } from './data/regions';
import { buildInitialFactions } from './data/factions';
import { buildInitialGenerals } from './data/generals';
import {
  applyEconomyTick, applySatisfactionDrift, computeScore,
  rollTurnEvent, runNpcTurn, refillRoninPool, tickPrisoners,
  generateInitialSupportGenerals, generateInitialRoninPool,
  createRng, makeInitialSeed, autoSaveGame,
} from './engine';

/** 新規ゲームの GameState を作る */
export function createNewGame(seed?: number): GameState {
  const initialSeed = seed ?? makeInitialSeed();
  const rng = createRng(initialSeed);

  // ユニーク武将
  const uniqueGenerals = buildInitialGenerals();
  // 各勢力のサポート武将（汎用）
  const supportGenerals = generateInitialSupportGenerals(rng);
  // 浪人プール
  const roninGenerals = generateInitialRoninPool(rng, 4);

  const generals = { ...uniqueGenerals };
  for (const g of supportGenerals) generals[g.id] = g;
  for (const g of roninGenerals) generals[g.id] = g;

  return {
    turn: 1,
    yearMonth: { year: 1, month: 1 },
    ap: 3,
    apMax: 3,
    satisfaction: 70,
    score: 0,
    factions: buildInitialFactions(),
    regions: buildInitialRegions(),
    generals,
    log: [],
    battleState: null,
    prisoners: [],
    roninPool: roninGenerals.map((g) => g.id),
    rngSeed: rng.getSeed(),
    config: {
      musicVolume: 0.6,
      sfxVolume: 0.7,
      fontSize: 'medium',
      animationsDisabled: false,
    },
    victory: 'none',
    meta: {
      createdAt: new Date().toISOString(),
      lastSavedAt: null,
    },
  };
}

/** 勝敗判定 */
export function checkVictory(state: GameState): GameState['victory'] {
  const playerRegions = Object.values(state.regions).filter((r) => r.factionId === 'akatsuki').length;
  if (playerRegions === 0) return 'lose_zero';
  if (playerRegions >= 12) return 'win_dominate';

  const youma = state.factions.youma;
  const youmaRegions = Object.values(state.regions).filter((r) => r.factionId === 'youma').length;
  if (youma.destroyed || youmaRegions === 0) {
    const ruler = state.generals[state.factions.youma.rulerGeneralId];
    if (!ruler || ruler.status === 'dead') return 'win_youma';
  }

  if (state.turn >= 90 && playerRegions <= 5) return 'lose_timeout';
  return 'none';
}

/** 月の進行 */
function nextYearMonth(ym: { year: number; month: number }): { year: number; month: number } {
  if (ym.month >= 12) return { year: ym.year + 1, month: 1 };
  return { year: ym.year, month: ym.month + 1 };
}

/** ターン終了処理 */
export function endTurn(state: GameState): GameState {
  const rng = createRng(state.rngSeed);
  let next = state;

  // 1. 経済処理
  next = applyEconomyTick(next);

  // 2. 満足度自然減＋HUD満足度更新
  next = applySatisfactionDrift(next);

  // 3. 捕虜の状態進行
  next = tickPrisoners(next);

  // 4. ランダムイベント
  const ev = rollTurnEvent(next, rng);
  next = ev.state;
  if (ev.message) {
    next = {
      ...next,
      log: [
        { turn: next.turn, actor: 'player', type: 'end_turn', message: ev.message },
        ...next.log,
      ],
    };
  }

  // 5. NPC勢力の行動
  next = runNpcTurn(next, rng);

  // 6. 浪人プール補充
  next = refillRoninPool(next, rng);

  // 7. 勝敗判定
  const victory = checkVictory(next);

  // 8. ターンと月の進行
  next = {
    ...next,
    turn: next.turn + 1,
    yearMonth: nextYearMonth(next.yearMonth),
    ap: next.apMax,
    score: computeScore(next),
    rngSeed: rng.getSeed(),
    victory,
  };

  // 9. 自動セーブ（勝敗確定時はセーブしない）
  if (victory === 'none') {
    autoSaveGame(next);
  }

  return next;
}

/** APを1消費して新しい state を返す。0未満になる場合は ok: false */
export function consumeAp(state: GameState, cost: number): { state: GameState; ok: boolean } {
  if (state.ap < cost) return { state, ok: false };
  return { state: { ...state, ap: state.ap - cost }, ok: true };
}

/** 武将の休養（スタミナ・兵数回復、AP不要） */
export function applyRestAction(state: GameState, generalIds: GeneralId[]): GameState {
  const generals = { ...state.generals };
  for (const id of generalIds) {
    const g = state.generals[id];
    if (!g) continue;
    generals[id] = {
      ...g,
      stamina: Math.min(100, g.stamina + 30),
      troopCurrent: Math.min(g.troopMax, g.troopCurrent + Math.round(g.troopMax * 0.15)),
    };
  }
  return { ...state, generals };
}

/** 調略コマンド：隣接敵地域に対して調略進捗を進める */
export function applyScoutAction(state: GameState, regionId: string): { state: GameState; ok: boolean; message: string } {
  const region = state.regions[regionId];
  if (!region) return { state, ok: false, message: '地域が見つかりません' };
  if (region.factionId === 'akatsuki' || region.factionId === null)
    return { state, ok: false, message: '自国地域以外を選んでください' };

  // 隣接判定
  const adjacent = region.adjacentIds.some((aid) => state.regions[aid]?.factionId === 'akatsuki');
  if (!adjacent) return { state, ok: false, message: '隣接していません' };

  const cost = 1500;
  if (state.factions.akatsuki.treasury < cost)
    return { state, ok: false, message: `金が不足しています（${cost.toLocaleString()}金必要）` };

  const cur = region.scoutProgress.akatsuki ?? 0;
  const inc = 25;
  const next = Math.min(100, cur + inc);

  const newRegions = { ...state.regions };
  let factions = state.factions;

  if (next >= 100) {
    // 寝返り発生
    newRegions[regionId] = {
      ...region,
      factionId: 'akatsuki',
      satisfaction: 50,
      scoutProgress: {},
    };
    return {
      state: {
        ...state,
        regions: newRegions,
        factions: { ...factions, akatsuki: { ...factions.akatsuki, treasury: factions.akatsuki.treasury - cost } },
      },
      ok: true,
      message: `${region.name}が寝返った！`,
    };
  }

  newRegions[regionId] = {
    ...region,
    scoutProgress: { ...region.scoutProgress, akatsuki: next },
  };
  return {
    state: {
      ...state,
      regions: newRegions,
      factions: { ...factions, akatsuki: { ...factions.akatsuki, treasury: factions.akatsuki.treasury - cost } },
    },
    ok: true,
    message: `${region.name}への調略が進んだ（${next}%）`,
  };
}

// --- 公開エクスポート -------------------------------------------------------

export type { GameState, GeneralId, FactionId };
