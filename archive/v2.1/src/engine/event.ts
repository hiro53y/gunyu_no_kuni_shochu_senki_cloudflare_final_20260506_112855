// ===========================================================================
// ランダムイベントエンジン v2.1
// ターン終了時に発生する小イベントを処理する。
// ===========================================================================

import type { GameState, FactionId, GenericTrait } from '../types/game';
import type { Rng } from './rng';
import { generateGenericGeneral } from './genericGen';

interface EventResult {
  state: GameState;
  message: string | null;
}

interface EventDef {
  id: string;
  weight: number;
  apply: (state: GameState, rng: Rng) => EventResult;
}

const EVENTS: EventDef[] = [
  {
    id: 'good_harvest', weight: 12,
    apply: (state) => {
      const akatsuki = state.factions.akatsuki;
      const bonus = 1500;
      return {
        state: { ...state, factions: { ...state.factions, akatsuki: { ...akatsuki, food: akatsuki.food + bonus } } },
        message: `豊作の報せ：兵糧が${bonus}増えた`,
      };
    },
  },
  {
    id: 'bad_harvest', weight: 8,
    apply: (state) => {
      const akatsuki = state.factions.akatsuki;
      const loss = 1000;
      return {
        state: { ...state, factions: { ...state.factions, akatsuki: { ...akatsuki, food: Math.max(0, akatsuki.food - loss) } } },
        message: `凶作の報せ：兵糧が${loss}減った`,
      };
    },
  },
  {
    id: 'merchant', weight: 10,
    apply: (state) => {
      const akatsuki = state.factions.akatsuki;
      const gain = 2000;
      return {
        state: { ...state, factions: { ...state.factions, akatsuki: { ...akatsuki, treasury: akatsuki.treasury + gain } } },
        message: `行商人が立ち寄り、${gain.toLocaleString()}金を得た`,
      };
    },
  },
  {
    id: 'wandering_warrior', weight: 8,
    apply: (state, rng) => {
      // 5%確率で逸材、20%で攻め手・守り手・軍師、残りで通常
      const traitChoices: GenericTrait[] = ['gem', 'attacker', 'defender', 'strategist', 'normal'];
      const trait = rng.weighted(traitChoices, [5, 20, 15, 15, 45]);
      const g = generateGenericGeneral(rng, { factionId: null, forceTrait: trait });
      return {
        state: {
          ...state,
          generals: { ...state.generals, [g.id]: g },
          roninPool: [...state.roninPool, g.id],
        },
        message: `流浪の${trait === 'gem' ? '逸材' : '武芸者'}「${g.name}」が浪間に現れた`,
      };
    },
  },
  {
    id: 'youma_growth', weight: 6,
    apply: (state, rng) => {
      // 妖魔の群に汎用キャラを補充
      const g = generateGenericGeneral(rng, { factionId: 'youma', forceTrait: rng.chance(0.3) ? 'attacker' : 'normal' });
      g.name = `妖魔・${rng.pick(['夜叉', '鬼', '化生', '蛟', '骸'])}${rng.int(1, 99)}号`;
      g.portraitKey = 'youma_grunt';
      return {
        state: { ...state, generals: { ...state.generals, [g.id]: g } },
        message: `黄泉沼に新たな妖魔が湧いた`,
      };
    },
  },
  {
    id: 'unrest', weight: 5,
    apply: (state) => {
      const regions = { ...state.regions };
      let target: string | null = null;
      let lowest = 100;
      for (const r of Object.values(regions)) {
        if (r.factionId === 'akatsuki' && r.satisfaction < lowest) {
          lowest = r.satisfaction;
          target = r.id;
        }
      }
      if (!target) return { state, message: null };
      regions[target] = { ...regions[target], satisfaction: Math.max(0, regions[target].satisfaction - 10) };
      return { state: { ...state, regions }, message: `${regions[target].name}で民の不満が高まった` };
    },
  },
];

/** 1ターンに最大1回イベント発動 */
export function rollTurnEvent(state: GameState, rng: Rng): { state: GameState; message: string | null } {
  if (!rng.chance(0.55)) return { state, message: null };
  const totalWeight = EVENTS.reduce((s, e) => s + e.weight, 0);
  const ev = rng.weighted(EVENTS, EVENTS.map((e) => e.weight));
  void totalWeight;
  return ev.apply(state, rng);
}
