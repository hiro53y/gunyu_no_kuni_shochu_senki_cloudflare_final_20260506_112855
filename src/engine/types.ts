// 群雄ノ國：掌中戦記 — 迷宮（城攻め・合戦・修行）の状態の型（DOM に依存しない）
import type { FactionId } from '../content/sengoku';
import type { FightStyle } from '../content/generals';

/** 8方向。0=上、1=右上、2=右、3=右下、4=下、5=左下、6=左、7=左上 */
export type Dir = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const DX = [0, 1, 1, 1, 0, -1, -1, -1] as const;
export const DY = [-1, -1, 0, 1, 1, 1, 0, -1] as const;
export const DIRS: Dir[] = [0, 1, 2, 3, 4, 5, 6, 7];

export interface Pos { x: number; y: number }

/** 地形 */
export const T_WALL = 0;
export const T_FLOOR = 1;
export const T_WATER = 2;
export const T_LAVA = 3;
/** 壊せない外壁 */
export const T_HARD = 4;

export type ItemCat = 'weapon' | 'armor' | 'charm' | 'grass' | 'scroll' | 'staff' | 'pot' | 'food' | 'arrow' | 'gold';

export interface Item {
  uid: number;
  id: string;
  /** 強化値（武器・防具） */
  plus?: number;
  /** 合成で付いた印（武器・防具） */
  seals?: string[];
  cursed?: boolean;
  /** 杖の残り回数 */
  charges?: number;
  /** 矢の本数・お金の額 */
  count?: number;
  /** 壺の中身と容量 */
  contents?: Item[];
  cap?: number;
  /** この品の強化値・回数・呪いが分かっているか */
  known?: boolean;
  /** 店の品（まだ買っていない） */
  shop?: boolean;
}

export interface FloorItem { item: Item; x: number; y: number }

export interface Trap { x: number; y: number; id: string; found: boolean }

export interface Status {
  sleep?: number;
  confuse?: number;
  /** 金縛り。999 は「叩かれるまで」 */
  paralyze?: number;
  slow?: number;
  fast?: number;
  blind?: number;
  /** トラバサミ */
  stuck?: number;
  /** 無敵 */
  invincible?: number;
  /** 特技を封じられた */
  sealed?: boolean;
  /** 痛み分け（プレイヤーの受けた痛みを受ける） */
  bond?: boolean;
  /** 攻撃力が下がった（毒草を当てられた） */
  weak?: boolean;
  /** 姿隠し（敵に気づかれにくい） */
  hidden?: number;
  /** 身代わり（ほかの敵に狙われる） */
  decoy?: number;
  /** 守りの技：受ける打撃が半分（残りターン） */
  guard?: number;
  /** 攻めの技：攻撃力が powerK 倍（残りターン） */
  power?: number;
  powerK?: number;
}

/** 迷宮に連れていく武将（味方）と、城を守る武将（敵）の情報 */
export interface GenSpec {
  id: string;
  name: string;
  short: string;
  portrait: string;
  faction: FactionId;
  lv: number;
  exp: number;
  cmd: number;
  pow: number;
  int: number;
  /** 使える技（絆で増える） */
  skills: string[];
  style: FightStyle;
  youkai?: boolean;
  ally: boolean;
  /** 城主・中の階の将・合戦の大将 */
  role?: 'boss' | 'mid' | 'commander';
  /** 台詞 */
  intro?: string;
  defeat?: string;
}

export interface Monster {
  uid: number;
  id: string;
  x: number;
  y: number;
  dir: Dir;
  hp: number;
  maxHp: number;
  awake: boolean;
  st: Status;
  /** 仲間 */
  ally?: boolean;
  /** 仲間の強さの上乗せ（敵を倒すたびに上がる） */
  bonus?: number;
  /** 盗んだ道具・お金 */
  stolen?: Item[];
  stolenGold?: number;
  /** 盗んだあと逃げている */
  fleeing?: boolean;
  role?: 'keeper' | 'boss' | 'npc';
  /** 宿場の人（宿・倉庫番・辻占い） */
  npc?: NpcKind;
  /** 化け狸が化けている道具 */
  disguise?: string;
  /** 店主が怒っている */
  angry?: boolean;
  /** 最後にプレイヤーを見た場所 */
  goal?: Pos | null;
  /** うろつく目的地 */
  wander?: Pos | null;
  /** 深層での強さの倍率 */
  scale?: number;
  /** 爆発済み・倒れた */
  dead?: boolean;
  /** 召喚の間隔（ボス） */
  cd?: number;
  /** 武将（GenSpec の id）。強さは下の値を使う */
  gen?: string;
  gname?: string;
  atkV?: number;
  defV?: number;
  expV?: number;
  /** 寝返った敵（買収） */
  turned?: boolean;
  /** 援軍を呼んだ */
  called?: boolean;
}

export interface Player {
  x: number;
  y: number;
  dir: Dir;
  hp: number;
  maxHp: number;
  lv: number;
  exp: number;
  str: number;
  maxStr: number;
  hunger: number;
  maxHunger: number;
  gold: number;
  inv: Item[];
  eq: { weapon?: number; armor?: number; charm?: number; arrow?: number };
  st: Status;
  /** HP 回復の端数 */
  regen: number;
  /** 満腹度の端数 */
  hungerAcc: number;
}

export type RoomKind = 'normal' | 'shop' | 'house' | 'boss';

export interface Room { id: number; x: number; y: number; w: number; h: number; kind: RoomKind; lit: boolean }

export interface Shop { room: number; keeper: number }

export type FloorKind = 'normal' | 'big' | 'boss' | 'town' | 'field';

export type NpcKind = 'inn' | 'bank' | 'seer';

export interface Floor {
  no: number;
  w: number;
  h: number;
  tiles: number[];
  /** 各マスの部屋の番号（通路は -1） */
  roomOf: number[];
  rooms: Room[];
  stairs: Pos | null;
  items: FloorItem[];
  traps: Trap[];
  /** 一度見たマス（ミニマップ用） */
  seen: number[];
  /** 聖域の巻物が置かれたマスは items で判断する */
  dark: boolean;
  fog: boolean;
  kind: FloorKind;
  shop: Shop | null;
  /** モンスターハウスの部屋（まだ起きていなければ番号） */
  house: number;
  houseAwake: boolean;
  /** この階に来てからのターン */
  turns: number;
  /** 帯（見た目と曲） */
  band: number;
  /** 千里眼・地図を使った */
  clairvoyant?: boolean;
  mapped?: boolean;
}

/** 城攻め・防衛の合戦・妖魔の巣での修行・道場 */
export type RunMode = 'siege' | 'defense' | 'hunt' | 'practice';

export interface LogLine { t: string; c?: 'good' | 'bad' | 'info' | 'item' | 'warn' }

/** 画面に問い合わせる（店の支払い・売却） */
export type Prompt =
  | { kind: 'pay'; amount: number; dir: Dir }
  | { kind: 'sell'; amount: number; itemUid: number }
  | { kind: 'npc'; who: NpcKind; cost: number };

export interface RunStats {
  kills: number;
  turns: number;
  maxFloor: number;
  itemsUsed: number;
  synth: number;
  stolen: number;
  allies: number;
  killedIds: Record<string, number>;
  seenIds: Record<string, true>;
  /** いちばん大きな一撃 */
  maxHit?: number;
}

export interface RunEnd {
  /** dead=朔が倒れた、clear=勝ち、return=撤退の巻物、quit=退却 */
  kind: 'dead' | 'clear' | 'return' | 'quit';
  cause: string;
  floor: number;
}

export interface Run {
  v: number;
  mode: RunMode;
  seed: number;
  /** 行動の乱数（地図は seed と階から作る） */
  rng: number;
  turn: number;
  floorNo: number;
  lastFloor: number;
  player: Player;
  floor: Floor;
  monsters: Monster[];
  nextUid: number;
  log: LogLine[];
  /** 種類として正体が分かったもの */
  known: Record<string, true>;
  /** 遊ぶたびに変わる仮の名前 */
  fake: Record<string, string>;
  /** プレイヤーが付けた名前 */
  named: Record<string, string>;
  stats: RunStats;
  end: RunEnd | null;
  /** 店の品を持ち逃げした */
  thief: boolean;
  spawnIn: number;
  prompt: Prompt | null;
  dailyDate?: string;
  /** ボスを倒した */
  bossDown?: boolean;
  /** 倍速のプレイヤーの、ターンの前半か */
  half?: number;
  /** 時止めの残り */
  timeStop?: number;
  /** 練習迷宮の案内を出した階 */
  tutorial?: number;
  /** 落とし穴に落ちた（手番の終わりに次の階へ） */
  pendingFall?: boolean;
  /** 根切りの巻物で消した敵の種類 */
  banned?: Record<string, true>;
  /** 宿場の倉庫番に預けた物とお金（倒れても村に届く） */
  deposit?: Item[];
  depositGold?: number;
  /** 攻める国（城攻め・合戦）か、修行する国 */
  region: string;
  /** 敵の勢力（兵の顔ぶれと旗の色） */
  faction: FactionId;
  /** 1階の強さの基準 */
  danger0: number;
  /** 最初の階（城門を破っていれば途中から） */
  startFloor: number;
  /** 城の見た目（帯） */
  band0: number;
  /** 武将の情報（味方と敵） */
  gens: Record<string, GenSpec>;
  /** 連れてきた武将 */
  party: string[];
  /** 傷を負って退いた味方の武将 */
  fallen: string[];
  /** 討ち取った（捕らえた）敵の武将 */
  captured: string[];
  /** 技の残り待ちターン（武将ID → 技ID → ターン） */
  scd: Record<string, Record<string, number>>;
  /** 中の階の将（倒さずに進むと最上階に加わる） */
  midPending?: boolean;
  /** 朔の技 */
  lordSkills?: string[];
  /** 経験値の倍率（国盗りではレベルが残るので少なめ） */
  expRate?: number;
  /** 城主・大将 */
  bossGen?: string;
  midGen?: string;
}

/** 描画用の出来事。player の uid は 0 */
export type GameEvent =
  | { k: 'move'; uid: number; fx: number; fy: number; tx: number; ty: number }
  | { k: 'atk'; uid: number; dir: Dir }
  | { k: 'hit'; uid: number; x: number; y: number; n: number; crit?: boolean }
  | { k: 'heal'; x: number; y: number; n: number }
  | { k: 'miss'; x: number; y: number }
  | { k: 'die'; uid: number; x: number; y: number }
  | { k: 'proj'; fx: number; fy: number; tx: number; ty: number; sprite: string }
  | { k: 'beam'; fx: number; fy: number; tx: number; ty: number; color: string }
  | { k: 'boom'; x: number; y: number; r: number }
  | { k: 'warp'; uid: number; x: number; y: number }
  | { k: 'flash'; color: string }
  | { k: 'lvup' }
  | { k: 'se'; name: string }
  | { k: 'floor' }
  | { k: 'popup'; x: number; y: number; text: string; color: string }
  /** 武将の技（名前の大きな表示） */
  | { k: 'skill'; uid: number; name: string; color: string; gen?: string }
  /** 武将の台詞 */
  | { k: 'say'; gen: string; text: string };

export type Verb = 'use' | 'equip' | 'unequip' | 'throw' | 'drop' | 'put' | 'take' | 'name';

export type Action =
  | { t: 'move'; dir: Dir }
  | { t: 'dash'; dir: Dir }
  | { t: 'face'; dir: Dir }
  | { t: 'attack' }
  | { t: 'wait' }
  | { t: 'rest' }
  | { t: 'pickup' }
  | { t: 'stairs' }
  | { t: 'shoot' }
  | { t: 'swapFoot'; uid: number }
  | { t: 'item'; uid: number; verb: Verb; target?: number; name?: string; scroll?: string }
  | { t: 'answer'; yes: boolean; steal?: boolean }
  | { t: 'npc'; who: NpcKind; target?: number; gold?: boolean }
  | { t: 'sort' }
  /** 武将の技。who は武将ID（朔は g_saku） */
  | { t: 'skill'; who: string; skill: string };
