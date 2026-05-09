// ===========================================================================
// 勢力定義 v2.1 — 8勢力
// world_v2.md §3 に対応
// ===========================================================================

import type { Faction, FactionId } from '../types/game';

interface FactionTemplate {
  id: FactionId;
  name: string;
  rulerGeneralId: string;
  color: string;
  emblem: string;
  aiPersonality: Faction['aiPersonality'];
  initTreasury: number;
  initFood: number;
}

export const FACTION_TEMPLATES: FactionTemplate[] = [
  {
    id: 'akatsuki', name: '暁ノ家', rulerGeneralId: 'g_kazama_saku',
    color: '#C84A4A', emblem: 'sun_crescent',
    aiPersonality: 'player',
    initTreasury: 5_000, initFood: 8_000,
  },
  {
    id: 'kurogane', name: '黒鉄家', rulerGeneralId: 'g_kurogane_genbu',
    color: '#525560', emblem: 'three_pillars',
    aiPersonality: 'aggressive',
    initTreasury: 12_000, initFood: 12_000,
  },
  {
    id: 'shion', name: '紫苑家', rulerGeneralId: 'g_shionin_hazuki',
    color: '#7E5BA3', emblem: 'shion_flower',
    aiPersonality: 'economic',
    initTreasury: 22_000, initFood: 10_000,
  },
  {
    id: 'shirasagi', name: '白鷺家', rulerGeneralId: 'g_shirasagi_toshiro',
    color: '#A8A8B0', emblem: 'flying_heron',
    aiPersonality: 'defensive',
    initTreasury: 9_000, initFood: 9_000,
  },
  {
    id: 'honoo', name: '焔ノ家', rulerGeneralId: 'g_honoo_kurenai',
    color: '#D43818', emblem: 'crimson_flame',
    aiPersonality: 'religious',
    initTreasury: 7_000, initFood: 7_000,
  },
  {
    id: 'rengein', name: '蓮華院', rulerGeneralId: 'g_rengein_kangetsu',
    color: '#3F8060', emblem: 'eight_lotus',
    aiPersonality: 'religious',
    initTreasury: 8_000, initFood: 11_000,
  },
  {
    id: 'youma', name: '妖魔の群', rulerGeneralId: 'g_kouou_kurobuchi',
    color: '#1A1A1A', emblem: 'three_eyed_serpent',
    aiPersonality: 'monstrous',
    initTreasury: 0, initFood: 99_999,
  },
  {
    id: 'ronin', name: '浪人衆', rulerGeneralId: 'g_shikkoku_kagemaru',
    color: '#1F3A6E', emblem: 'moon_twin_blades',
    aiPersonality: 'mercenary',
    initTreasury: 6_000, initFood: 4_000,
  },
];

const FACTION_IDS: FactionId[] = FACTION_TEMPLATES.map((f) => f.id);

/** 初期外交関係マトリクスを返す */
function buildInitialDiplomacy(self: FactionId): Record<FactionId, Faction['diplomacy'][FactionId]> {
  const result = {} as Record<FactionId, Faction['diplomacy'][FactionId]>;
  for (const id of FACTION_IDS) {
    if (id === self) {
      result[id] = 'self';
    } else if (id === 'youma' || self === 'youma') {
      // 妖魔は全勢力と敵対
      result[id] = 'hostile';
    } else if (id === 'ronin' || self === 'ronin') {
      // 浪人衆は中立
      result[id] = 'neutral';
    } else if (id === 'rengein' || self === 'rengein') {
      // 蓮華院は最初穏健
      result[id] = 'neutral';
    } else {
      // 人間勢力同士は隣接でなければ中立、隣接は敵対扱い（簡略化）
      result[id] = 'neutral';
    }
  }
  return result;
}

/** 初期 GameState の Faction レコードを構築する */
export function buildInitialFactions(): Record<FactionId, Faction> {
  const out = {} as Record<FactionId, Faction>;
  for (const t of FACTION_TEMPLATES) {
    out[t.id] = {
      id: t.id,
      name: t.name,
      rulerGeneralId: t.rulerGeneralId,
      color: t.color,
      emblem: t.emblem,
      aiPersonality: t.aiPersonality,
      diplomacy: buildInitialDiplomacy(t.id),
      treasury: t.initTreasury,
      food: t.initFood,
      destroyed: false,
    };
  }
  return out;
}

/** 全 FactionId のリスト */
export function getAllFactionIds(): FactionId[] {
  return [...FACTION_IDS];
}
