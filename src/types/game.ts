// ===========================================================================
// 群雄ノ國：掌中戦記 v2.1 型定義
// プロジェクト全体で共有する型を集約する。
// ===========================================================================

// --- 識別子型 ---------------------------------------------------------------

export type FactionId =
  | 'akatsuki'   // 暁ノ家（プレイヤー）
  | 'kurogane'   // 黒鉄家
  | 'shion'      // 紫苑家
  | 'shirasagi'  // 白鷺家
  | 'honoo'      // 焔ノ家
  | 'rengein'    // 蓮華院
  | 'youma'      // 妖魔の群
  | 'ronin';     // 浪人衆

export type RegionId = string;   // '01' .. '15'
export type GeneralId = string;  // 'g_kazama_saku' のような安定キー
export type SkillId = string;    // 'sk_issen' など

// --- 地形 -------------------------------------------------------------------

export type Terrain =
  | 'plain'          // 平野
  | 'mountain'       // 山地
  | 'port'           // 港湾
  | 'pass'           // 峠
  | 'field'          // 田園
  | 'coast'          // 海岸
  | 'snow'           // 雪原
  | 'volcano'        // 火山
  | 'forest'         // 深い森
  | 'mountain_temple'// 山岳寺領
  | 'cursed'         // 魔境
  | 'wasteland'      // 荒野
  | 'islands';       // 群島

// --- 地域 -------------------------------------------------------------------

export interface Region {
  id: RegionId;
  name: string;
  reading: string;
  terrain: Terrain;
  product: string;
  factionId: FactionId | null;
  /** 国力 1-10 */
  power: number;
  /** 満足度 0-100 */
  satisfaction: number;
  /** 建設レベル */
  buildLevels: {
    farm: number;
    wall: number;
    market: number;
    forge: number;
  };
  adjacentIds: RegionId[];
  /** 各勢力の調略進捗 0-100。100到達で寝返り */
  scoutProgress: Partial<Record<FactionId, number>>;
}

// --- 勢力 -------------------------------------------------------------------

export type AiPersonality =
  | 'player'
  | 'aggressive'   // 黒鉄
  | 'economic'     // 紫苑
  | 'defensive'    // 白鷺
  | 'religious'    // 焔ノ家・蓮華院
  | 'monstrous'    // 妖魔
  | 'mercenary';   // 浪人

export type Diplomacy = 'self' | 'ally' | 'neutral' | 'hostile' | 'subjugated';

export interface Faction {
  id: FactionId;
  name: string;
  rulerGeneralId: GeneralId;
  /** 旗印・勢力カラー */
  color: string;
  emblem: string;
  aiPersonality: AiPersonality;
  /** 各勢力との外交関係（自分自身は'self'） */
  diplomacy: Record<FactionId, Diplomacy>;
  /** 国庫（金） */
  treasury: number;
  /** 兵糧 */
  food: number;
  /** 滅亡フラグ */
  destroyed: boolean;
}

// --- スキル -----------------------------------------------------------------

export type SkillKind = 'attack' | 'aoe' | 'support' | 'heal' | 'special';
export type SkillTarget = 'enemy_one' | 'enemy_all' | 'ally_one' | 'ally_all' | 'self';

export type StatusEffectType =
  | 'burn'      // 火傷
  | 'poison'    // 毒
  | 'stun'      // 麻痺
  | 'fear'      // 恐怖
  | 'rage'      // 暴走
  | 'guard_up'  // 防御強化
  | 'atk_up'    // 攻撃強化
  | 'sealed';   // 封印

export interface SkillEffect {
  /** ダメージ係数または回復係数 */
  basePower: number;
  /** 自身バフ */
  selfBuff?: { atk?: number; def?: number; turns: number };
  /** 敵デバフ */
  debuff?: { atk?: number; def?: number; turns: number };
  /** 自身に発生する反動（HP割合 0-1） */
  recoil?: number;
  /** 妖魔特効倍率（1.0で等倍、2.0で倍） */
  youmaSpecial?: number;
  /** 即死判定確率 0-1 */
  instaKillChance?: number;
  /** 状態異常付与 */
  inflict?: { type: StatusEffectType; chance: number; turns: number; magnitude?: number };
  /** 全体攻撃の場合の対象数（target=enemy_all/ally_all時） */
  hits?: number;
}

export interface Skill {
  id: SkillId;
  name: string;
  kind: SkillKind;
  target: SkillTarget;
  /** 消費スタミナ */
  cost: number;
  description: string;
  effect: SkillEffect;
  /** 必殺台詞（カットイン用） */
  cutInDialogue?: string;
}

export interface StatusEffect {
  type: StatusEffectType;
  turnsLeft: number;
  magnitude: number;
}

// --- 武将 -------------------------------------------------------------------

export interface GeneralStats {
  command: number;   // 統率
  power: number;     // 武力
  intel: number;     // 知略
  charisma: number;  // 魅力
}

export type GeneralStatus =
  | 'free'       // 通常運用中
  | 'captured'   // 捕虜
  | 'recruited'  // プレイヤーに登用済み（factionIdはakatsuki）
  | 'dead'       // 死亡（再登場しない）
  | 'ronin';     // 浪人として待機

export type GenericTrait =
  | 'normal'      // 平凡
  | 'attacker'    // 攻め手（武力極振り）
  | 'defender'    // 守り手（統率極振り）
  | 'strategist'  // 軍師（知略極振り）
  | 'commander'   // 名将（エリート総合）
  | 'sniper'      // 狙撃手（弓スキル付）
  | 'wild'        // 暴れ者（武力99他極端）
  | 'gem';        // 逸材（全能力高、激レア）

export interface General {
  id: GeneralId;
  name: string;
  reading: string;
  factionId: FactionId | null;
  /** 元の勢力（捕虜化時に元所属を保持） */
  homeFactionId: FactionId | null;
  /** ユニーク武将（22名）か */
  isUnique: boolean;
  /** 汎用キャラかどうか */
  isGeneric: boolean;
  /** 汎用キャラの特性（ユニークでも参考表示） */
  trait: GenericTrait;
  stats: GeneralStats;
  skillIds: SkillId[];
  /** 兵数上限・現在 */
  troopMax: number;
  troopCurrent: number;
  /** スタミナ 0-100 */
  stamina: number;
  /** 元勢力への忠誠 0-100 */
  loyalty: number;
  status: GeneralStatus;
  /** 捕虜になってから経過したターン数 */
  capturedTurns: number;
  /** 説得試行回数 */
  persuadeAttempts: number;
  /** 立ち絵キー（後でB方針で実画像に差し替え） */
  portraitKey: string;
  /** 設定メモ */
  remarks?: string;
}

// --- 合戦 -------------------------------------------------------------------

export interface BattleSlot {
  generalId: GeneralId | null;
  hp: number;
  hpMax: number;
  /** ガード率 0-100 */
  guard: number;
  /** 行動順カウンタ（素早さ蓄積） */
  tick: number;
  statusEffects: StatusEffect[];
  /** 撤退済み */
  retreated: boolean;
}

export type BattleResult =
  | 'in_progress'
  | 'player_win'
  | 'enemy_win'
  | 'draw';

export interface BattleLogEntry {
  turn: number;
  message: string;
  /** カットイン演出用：誰の必殺技か */
  cutInGeneralId?: GeneralId;
  cutInDialogue?: string;
}

export interface BattleState {
  regionId: RegionId;
  /** 攻め手側がプレイヤーか敵か */
  playerIsAttacker: boolean;
  /** 攻め手＝侵攻側 */
  attackerFactionId: FactionId;
  defenderFactionId: FactionId;
  playerSlots: BattleSlot[];   // 9スロット (3x3)
  enemySlots: BattleSlot[];    // 9スロット
  turn: number;
  log: BattleLogEntry[];
  result: BattleResult;
  /** 戦場補正 */
  terrainBonus: { atkPct: number; defPct: number; healPct: number; note: string };
  /** 戦闘終了時、捕虜化された敵将ID */
  capturedAfter: GeneralId[];
  /** 戦闘終了時、死亡した武将ID（敵味方両方） */
  killedAfter: GeneralId[];
}

// --- 行動・履歴 -------------------------------------------------------------

export type ActionType =
  | 'battle'
  | 'build'
  | 'collect'
  | 'scout'
  | 'sabotage'
  | 'recruit'
  | 'rest'
  | 'persuade'
  | 'end_turn';

export interface ActionRecord {
  turn: number;
  actor: 'player' | FactionId;
  type: ActionType;
  targetRegionId?: RegionId;
  targetGeneralId?: GeneralId;
  message: string;
}

// --- ゲーム全体 -------------------------------------------------------------

export type VictoryStatus =
  | 'none'
  | 'win_dominate'   // 12地域支配
  | 'win_youma'      // 妖魔殲滅
  | 'lose_zero'      // 自勢力地域0
  | 'lose_timeout';  // 90ターンで5地域以下

export interface GameConfig {
  musicVolume: number;
  sfxVolume: number;
  fontSize: 'small' | 'medium' | 'large';
  animationsDisabled: boolean;
}

export interface GameState {
  turn: number;
  yearMonth: { year: number; month: number };
  ap: number;
  apMax: number;
  /** プレイヤー全体の満足度（HUD表示用） */
  satisfaction: number;
  /** 得点（HUD表示用） */
  score: number;
  factions: Record<FactionId, Faction>;
  regions: Record<RegionId, Region>;
  generals: Record<GeneralId, General>;
  log: ActionRecord[];
  /** 戦闘中なら present、それ以外は null */
  battleState: BattleState | null;
  /** プレイヤーが抱える捕虜のIDリスト */
  prisoners: GeneralId[];
  /** 浪人衆として「浪間」に控える登用候補 */
  roninPool: GeneralId[];
  /** シード固定可能な乱数の現在状態 */
  rngSeed: number;
  config: GameConfig;
  victory: VictoryStatus;
  /** 自動セーブ用のメタ */
  meta: {
    createdAt: string;
    lastSavedAt: string | null;
  };
}

// --- セーブデータ -----------------------------------------------------------

export const SAVE_VERSION = 21; // v2.1

export interface SaveData {
  version: number;
  createdAt: string;
  state: GameState;
}
