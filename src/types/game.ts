export type Difficulty = 'easy' | 'normal' | 'hard';
export type GamePhase = 'player' | 'npc';
export type GameStatus = 'playing' | 'victory' | 'defeat';
export type AiPersonality = 'aggressive' | 'domestic' | 'balanced' | 'opportunist';
export type Terrain = 'plain' | 'mountain' | 'forest' | 'river' | 'coast';
export type OfficerStatus = 'active' | 'wounded' | 'ronin' | 'available';
export type SkillTrigger =
  | 'attack'
  | 'defense'
  | 'battle'
  | 'domestic'
  | 'train'
  | 'search'
  | 'recruit'
  | 'turn';
export type GameActionType = 'domestic' | 'recruitTroops' | 'train' | 'search' | 'hire' | 'invade' | 'rest' | 'endTurn';
export type DomesticFocus = 'riceYield' | 'publicOrder' | 'castleHp' | 'developmentLevel';
export type LogType = 'system' | 'action' | 'battle' | 'economy' | 'event' | 'warning' | 'save';
export type RandomEventKind = 'goodHarvest' | 'badHarvest' | 'merchant' | 'ronin' | 'uprising' | 'artisan' | 'rumor' | 'festival';

export interface SkillEffect {
  attackMultiplier?: number;
  defenseMultiplier?: number;
  domesticMultiplier?: number;
  trainMultiplier?: number;
  searchChanceBonus?: number;
  hireChanceBonus?: number;
  moraleBonus?: number;
  damageReduction?: number;
  enemyDebuff?: number;
  castleRepairMultiplier?: number;
  sabotageRate?: number;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  trigger: SkillTrigger;
  effect: SkillEffect;
}

export interface Army {
  factionId: string;
  officerIds: string[];
  localTroops: number;
  morale: number;
}

export interface Region {
  id: string;
  name: string;
  ownerFactionId: string;
  neighbors: string[];
  riceYield: number;
  publicOrder: number;
  castleHp: number;
  maxCastleHp: number;
  localTroops: number;
  terrain: Terrain;
  developmentLevel: number;
  mapX: number;
  mapY: number;
}

export interface Faction {
  id: string;
  name: string;
  color: string;
  gold: number;
  food: number;
  morale: number;
  aiPersonality: AiPersonality;
  isPlayer: boolean;
  isMajor: boolean;
  homeRegionId: string | null;
}

export interface Officer {
  id: string;
  name: string;
  factionId: string;
  locationRegionId: string | null;
  command: number;
  valor: number;
  wisdom: number;
  politics: number;
  charisma: number;
  troops: number;
  maxTroops: number;
  stamina: number;
  maxStamina: number;
  loyalty: number;
  level: number;
  exp: number;
  skills: string[];
  status: OfficerStatus;
}

export interface BattleParticipant {
  officerId: string;
  name: string;
  troopsBefore: number;
  troopsAfter: number;
}

export interface BattleResult {
  id: string;
  turn: number;
  attackerFactionId: string;
  defenderFactionId: string;
  targetRegionId: string;
  targetRegionName: string;
  victory: boolean;
  conquered: boolean;
  attackerPower: number;
  defenderPower: number;
  attackerLosses: number;
  defenderLosses: number;
  castleDamage: number;
  castleHpBefore: number;
  castleHpAfter: number;
  attackerParticipants: BattleParticipant[];
  defenderParticipants: BattleParticipant[];
  activatedSkills: string[];
  hint: string;
}

export interface ActionLog {
  id: string;
  turn: number;
  type: LogType;
  message: string;
  createdAt: number;
}

export interface GameAction {
  type: GameActionType;
  regionId?: string;
  officerIds?: string[];
  focus?: DomesticFocus;
}

export interface RandomEvent {
  id: RandomEventKind;
  name: string;
  description: string;
  weight: number;
}

export interface GameSettings {
  sound: boolean;
  reducedMotion: boolean;
  showTutorial: boolean;
}

export interface GameStats {
  totalBattles: number;
  recruitedOfficers: number;
  defeatedFactions: string[];
}

export interface GameResult {
  title: string;
  reachedTurn: number;
  controlledRegions: number;
  defeatedMajorFactions: number;
  recruitedOfficers: number;
  totalBattles: number;
  rating: string;
  reason: string;
}

export interface GameState {
  turn: number;
  phase: GamePhase;
  actionPoints: number;
  maxActionPoints: number;
  difficulty: Difficulty;
  regions: Record<string, Region>;
  factions: Record<string, Faction>;
  officers: Record<string, Officer>;
  logs: ActionLog[];
  lastBattleResult: BattleResult | null;
  selectedRegionId: string;
  selectedOfficerIds: string[];
  gameStatus: GameStatus;
  rngSeed: number;
  settings: GameSettings;
  stats: GameStats;
  result: GameResult | null;
}

export interface SaveData {
  version: number;
  savedAt: string;
  state: GameState;
}

export interface ActionOutcome {
  state: GameState;
  ok: boolean;
  message: string;
}
