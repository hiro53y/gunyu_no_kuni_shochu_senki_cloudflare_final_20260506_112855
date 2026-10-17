// 国盗りの状態（本陣）。保存の形もこれ
import type { FactionId } from '../content/sengoku';
import type { Line } from '../content/generals';
import type { BattleKind, Ground, Kind } from '../battle/types';

export const CAMPAIGN_VERSION = 4;

export interface RegionState {
  id: string;
  owner: FactionId;
  /** 国力（1〜30）。収入と維持できる部隊の数 */
  np: number;
  /** 領地の並び（最後が城）。敵の国なら、これを1つずつ取っていく */
  lands: Ground[];
  /** 取った領地の数（すべて取ると国が手に入る） */
  taken: number;
  /** 戦の準備（次にこの国で戦う時の味方の戦場補正） */
  prep: number;
  /** 工作（次の合戦で敵の兵がこの割合だけ減る） */
  sabotage: number;
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
  /** 部隊が壊滅して出られない季節 */
  injured: number;
  /** 兵種と、今の兵数 */
  kind: Kind;
  troops: number;
  /** 傷ついた兵（休めば戻る） */
  wounded: number;
  /** 戦勝と部隊拡張で増えた恒久的な兵数上限 */
  capacityBonus?: number;
  /** 最後に合戦に出た季節 */
  fought: number;
  custom?: CustomGen;
  /** 浪人宿で雇う値段 */
  wage?: number;
}

export interface Scene {
  key?: string;
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
  /** 合戦の大将（武将ID） */
  commander: string;
  /** 軍の強さ */
  danger: number;
}

export interface News { turn: number; t: string; c?: 'good' | 'bad' | 'info' | 'warn' }

/** 陣立て：誰をどこに置くか */
export interface Placement { gen: string; row: 0 | 1; slot: 0 | 1 | 2 }

/** 出陣中の記録（合戦が終わったら本陣に反映する） */
export interface Sortie {
  seed?: number;
  mode: BattleKind;
  region: string;
  party: Placement[];
  invasion?: Invasion;
  /** 何番目の領地か（0から） */
  land?: number;
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
  /** いちばん大きな一合戦の打撃 */
  maxHit: number;
}

/** 国の命令 */
export type CommandId = 'build' | 'prepare' | 'war' | 'search' | 'sabotage' | 'persuade';

export interface Campaign {
  strategy?: import('./strategy').Strategy;
  v: number;
  seed: number;
  rng: number;
  turn: number;
  /** 残りの行動（扇） */
  fans: number;
  /** 武名（国を取る・勝つ・絆で増え、扇が増える） */
  fame: number;
  gold: number;
  regions: Record<string, RegionState>;
  factions: Record<FactionId, { alive: boolean; war: boolean }>;
  gens: Record<string, GenState>;
  nextGen: number;
  /** 命令の進み（`命令:対象` → たまった点） */
  progress: Record<string, number>;
  news: News[];
  flags: Record<string, true>;
  /** これから見せるできごと */
  scenes: Scene[];
  /** 敵の手番で攻めてきた敵（迎え撃つかおまかせか） */
  invasions: Invasion[];
  /** 捕らえて、登用するか決める将 */
  captives: string[];
  sortie: Sortie | null;
  stats: CampaignStats;
  titles: Record<string, true>;
  /** 黒淵を討った（そのあとも続けられる） */
  victory?: number;
  /** 暁原を失った・朔の部隊が壊滅した */
  defeat?: number;
  defeatReason?: 'home' | 'lord';
}

/** 演出の速さ：0=ふつう、1=速い、2=なし */
export interface Settings { bgm: number; se: number; fast: boolean; anim: 0 | 1 | 2; text: 's' | 'm' | 'l'; auto: boolean }

export const DEFAULT_SETTINGS: Settings = { bgm: 0.5, se: 0.7, fast: false, anim: 0, text: 'm', auto: false };
