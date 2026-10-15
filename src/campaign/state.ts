// 国盗りの状態（本陣）。保存の形もこれ
import type { FactionId } from '../content/sengoku';
import type { FightStyle, Line } from '../content/generals';
import type { LordState } from '../engine/run';
import type { Item, RunMode } from '../engine/types';

export const CAMPAIGN_VERSION = 1;

export interface RegionState {
  id: string;
  owner: FactionId;
  /** 守りの兵 */
  troops: number;
  /** 開発（年貢）1〜5 */
  dev: number;
  /** 城の高さ（守り）1〜5 */
  wall: number;
  /** 破った城門（次はこの次の階から攻められる） */
  breach: number;
  /** 城主・中の階の将（武将ID） */
  boss?: string;
  mid?: string;
}

export type GenStatus = 'enemy' | 'ours' | 'jail' | 'ronin' | 'gone';

/** 名もなき侍大将の中身 */
export interface CustomGen {
  name: string;
  short: string;
  portrait: string;
  label: string;
  skill: string;
  style: FightStyle;
  cmd: number;
  pow: number;
  int: number;
  youkai?: boolean;
}

export interface GenState {
  id: string;
  status: GenStatus;
  /** 仕える勢力（敵の時）・元の勢力 */
  faction: FactionId;
  lv: number;
  exp: number;
  /** 絆（交流の回数）0〜2 */
  bond: number;
  /** 傷が治るまでのターン */
  injured: number;
  custom?: CustomGen;
  /** 浪人宿で雇う値段 */
  wage?: number;
}

export interface Scene {
  title?: string;
  /** 背景の色合い */
  mood?: 'normal' | 'dark' | 'victory' | 'sad';
  lines: Line[];
}

/** 攻めてきた敵 */
export interface Invasion {
  from: string;
  to: string;
  faction: FactionId;
  power: number;
  /** 合戦の大将（武将ID） */
  commander: string;
}

export interface News { turn: number; t: string; c?: 'good' | 'bad' | 'info' | 'warn' }

/** 出陣中の記録（冒険が終わったら本陣に反映する） */
export interface Sortie {
  mode: RunMode;
  region: string;
  party: string[];
  invasion?: Invasion;
}

export interface CampaignStats {
  battles: number;
  wins: number;
  losses: number;
  kills: number;
  captured: number;
  hunts: number;
  defenses: number;
  maxHit: number;
}

export interface Campaign {
  v: number;
  seed: number;
  rng: number;
  turn: number;
  /** 残りの行動 */
  ap: number;
  gold: number;
  regions: Record<string, RegionState>;
  factions: Record<FactionId, { alive: boolean }>;
  gens: Record<string, GenState>;
  lord: LordState;
  /** 蔵（朔の装備を含む） */
  store: Item[];
  eq: { weapon?: number; armor?: number; charm?: number; arrow?: number };
  nextUid: number;
  nextGen: number;
  known: Record<string, true>;
  fake: Record<string, string>;
  named: Record<string, string>;
  news: News[];
  flags: Record<string, true>;
  /** これから見せるできごと */
  scenes: Scene[];
  /** 敵の手番で攻めてきた敵（迎え撃つか籠城か） */
  invasions: Invasion[];
  /** 捕らえて、登用するか決める将 */
  captives: string[];
  sortie: Sortie | null;
  /** 商人の品（ターンごとに入れ替わる） */
  stock: string[];
  stats: CampaignStats;
  titles: Record<string, true>;
  /** 黒淵を討った（そのあとも続けられる） */
  victory?: number;
  /** 暁原を失った */
  defeat?: number;
}

export interface Settings { bgm: number; se: number; fast: boolean; text: 's' | 'm' | 'l' }

export const DEFAULT_SETTINGS: Settings = { bgm: 0.5, se: 0.7, fast: false, text: 'm' };
