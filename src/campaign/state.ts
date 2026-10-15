// 国盗りの状態（本陣）。保存の形もこれ
import type { FactionId } from '../content/sengoku';
import type { Line } from '../content/generals';
import type { BattleKind, Kind } from '../battle/types';

export const CAMPAIGN_VERSION = 2;

export interface RegionState {
  id: string;
  owner: FactionId;
  /** 籠城の守りの兵 */
  troops: number;
  /** 開発（年貢）1〜5 */
  dev: number;
  /** 城の高さ（籠城の守り）1〜5 */
  wall: number;
  /** 落とした砦の数（すべて落とすと国が手に入る） */
  taken: number;
  /** 城主・2人目の将（武将ID） */
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
  /** 傷が治るまでの季節 */
  injured: number;
  /** 兵種と、今の兵数 */
  kind: Kind;
  troops: number;
  /** 増員した回数 */
  extra: number;
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

/** 陣立て：誰をどこに置くか */
export interface Placement { gen: string; row: 0 | 1; slot: 0 | 1 | 2 }

/** 出陣中の記録（合戦が終わったら本陣に反映する） */
export interface Sortie {
  mode: BattleKind;
  region: string;
  party: Placement[];
  invasion?: Invasion;
  /** 何番目の砦か（0から） */
  fort?: number;
  /** その場で作った敵の侍大将（捕らえた時に家臣にできるよう中身を残す） */
  temps: Record<string, { custom: CustomGen; lv: number; kind: Kind; faction: FactionId }>;
}

export interface CampaignStats {
  battles: number;
  wins: number;
  losses: number;
  /** 討った敵兵の数 */
  kills: number;
  captured: number;
  hunts: number;
  defenses: number;
  /** いちばん大きな一撃 */
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
  nextGen: number;
  news: News[];
  flags: Record<string, true>;
  /** これから見せるできごと */
  scenes: Scene[];
  /** 敵の手番で攻めてきた敵（迎え撃つか籠城か） */
  invasions: Invasion[];
  /** 捕らえて、登用するか決める将 */
  captives: string[];
  sortie: Sortie | null;
  stats: CampaignStats;
  titles: Record<string, true>;
  /** 黒淵を討った（そのあとも続けられる） */
  victory?: number;
  /** 暁原を失った */
  defeat?: number;
}

export interface Settings { bgm: number; se: number; fast: boolean; text: 's' | 'm' | 'l'; auto: boolean }

export const DEFAULT_SETTINGS: Settings = { bgm: 0.5, se: 0.7, fast: false, text: 'm', auto: false };
