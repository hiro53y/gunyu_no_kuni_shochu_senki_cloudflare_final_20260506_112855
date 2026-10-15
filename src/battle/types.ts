// 合戦の状態の型（DOM に依存しない）。左（L）が味方、右（R）が敵

export type Kind = 'ashigaru' | 'bushi' | 'yumi' | 'teppo' | 'kiba' | 'shinobi' | 'gunshi' | 'miko' | 'sohei' | 'onmyo' | 'youkai';

export type Side = 'L' | 'R';

/**
 * 射程
 * - near：前衛からだけ使え、敵の前衛を狙う（前衛が全滅していれば後衛）
 * - far：どこからでも、どの敵でも
 * - pierce：同じ段の前衛と後衛をまとめて
 * - all：敵全体
 * - ally：味方1部隊、allies：味方全体、self：自分、none：対象なし
 */
export type Range = 'near' | 'far' | 'pierce' | 'all' | 'ally' | 'allies' | 'self' | 'none';

export type Effect =
  | 'dmg'
  /** 打撃と、準備の取り消し */
  | 'cancel'
  /** 足軽：同じ列の味方をかばう構え（全体なら全員） */
  | 'guard'
  | 'guardAll'
  /** 付与（攻・防・知・速の強化） */
  | 'buffAtk'
  | 'buffDef'
  | 'buffSpd'
  | 'buffRandom'
  | 'heal'
  /** 相手の付与を外す */
  | 'dispel'
  /** 敵全体のガードを外す */
  | 'guardBreak'
  /** 戦果を動かす */
  | 'gauge'
  /** 制限時間を延ばす */
  | 'extend'
  /** 一度だけ打撃を防ぐ */
  | 'barrier'
  /** 一定の確率で部隊を壊滅させる */
  | 'assassin'
  /** 相手の手番を遅らせる */
  | 'delay'
  /** 相手の攻撃を下げる */
  | 'weaken'
  /** 与えた打撃の半分だけ兵を戻す */
  | 'drain';

export interface SkillDef {
  id: string;
  name: string;
  /** 消費する技数。'all' は残りすべて */
  cost: number | 'all';
  range: Range;
  /** 打撃の倍率（回復なら回復の倍率） */
  mult: number;
  /** 反撃の割合（近距離の物理だけ） */
  counter: number;
  /** 使ったあと次に動けるまでの時間 */
  stiff: number;
  /** 準備の時間（要準備の技） */
  prep?: number;
  effect: Effect;
  /** 効果の強さ（付与の割合・戦果の量・遅らせる時間など） */
  amount?: number;
  /** 物理（足軽にかばわれる・ガードで半減）。術は false */
  physical: boolean;
  /** 特定の兵種に倍率 */
  vs?: { kinds: Kind[]; mult: number };
  /** 戦果で勝っている時の倍率 */
  winning?: number;
  /** 反撃を受けない */
  noCounter?: boolean;
  /** ガードの半減を無視する */
  ignoreGuard?: boolean;
  desc: string;
  color: string;
}

export interface Buffs { atk: number; def: number; int: number; spd: number }

export interface Unit {
  uid: number;
  side: Side;
  /** 武将ID（本陣の武将・侍大将） */
  gen: string;
  name: string;
  short: string;
  portrait: string;
  kind: Kind;
  lv: number;
  /** 能力（1〜10ほど） */
  atk: number;
  def: number;
  int: number;
  spd: number;
  troops: number;
  maxTroops: number;
  /** 合戦の始めの兵数（戦果の計算用） */
  startTroops: number;
  /** 技数（この合戦で使える回数） */
  ap: number;
  apMax: number;
  /** 0=前衛、1=後衛 */
  row: 0 | 1;
  /** 0〜2（上・中・下） */
  slot: 0 | 1 | 2;
  skills: string[];
  /** 次に動く時 */
  next: number;
  /** 足軽のガード率（0〜1.5） */
  guard: number;
  guarding: boolean;
  /** かばう範囲が全員か */
  guardAll?: boolean;
  buffs: Buffs;
  barrier: boolean;
  /** 準備中の技 */
  prep: { skill: string; target: number | null; at: number } | null;
  out: boolean;
  /** 朔（壊滅すると負け） */
  lord?: boolean;
  /** 城主・大将 */
  boss?: boolean;
  youkai?: boolean;
  /** 与えた打撃・倒した数（経験の上乗せ） */
  dealt: number;
  kills: number;
}

export type BattleKind = 'siege' | 'field' | 'defense' | 'hunt';

export interface BattleEnd {
  winner: Side;
  reason: 'wipe' | 'lord' | 'time' | 'exhaust' | 'retreat';
}

export interface Battle {
  v: number;
  seed: number;
  rng: number;
  kind: BattleKind;
  /** 合戦の場所（国ID） */
  region: string;
  /** 今の時 */
  time: number;
  /** 制限時間 */
  limit: number;
  units: Unit[];
  /** 技で動かした戦果（ゲージの上乗せ） */
  gaugeAdj: number;
  /** 手番の部隊（味方の入力待ち） */
  active: number | null;
  log: string[];
  end: BattleEnd | null;
  /** 守る側（時間切れで戦果が五分の時は守る側の勝ち） */
  defender: Side;
  /** 何手目か */
  turns: number;
}

export type Action = { t: 'skill'; skill: string; target?: number } | { t: 'wait' };

/** 画面で再生する出来事 */
export type BEvent =
  | { k: 'turn'; uid: number }
  | { k: 'skill'; uid: number; name: string; color: string; range: Range }
  | { k: 'hit'; uid: number; from: number; n: number; guardBy?: number; big?: boolean; magic?: boolean }
  | { k: 'counter'; uid: number; from: number; n: number }
  | { k: 'heal'; uid: number; n: number }
  | { k: 'buff'; uid: number; text: string; good: boolean }
  | { k: 'prep'; uid: number; name: string }
  | { k: 'cancel'; uid: number }
  | { k: 'block'; uid: number }
  | { k: 'miss'; uid: number }
  | { k: 'down'; uid: number }
  | { k: 'gauge'; v: number }
  | { k: 'time'; v: number }
  | { k: 'wait'; uid: number }
  | { k: 'end'; winner: Side };
