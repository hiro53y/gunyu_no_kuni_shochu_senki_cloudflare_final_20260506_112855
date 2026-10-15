// 合戦の状態の型（DOM に依存しない）。左（L）が味方、右（R）が敵
// 仕組みは戦国の部隊合戦の定番（前衛3・後衛3、遅れと硬直の手番、技数、時間の目盛り、戦果）に合わせる

export type Kind = 'ashigaru' | 'bushi' | 'yumi' | 'teppo' | 'kiba' | 'shinobi' | 'gunshi' | 'miko' | 'sohei' | 'onmyo' | 'youkai';

export type Side = 'L' | 'R';

/**
 * 射程
 * - near：前衛の列からだけ使え、敵の前衛の列を狙う（前衛が全滅していれば後衛）
 * - far：どこからでも、どの敵でも
 * - pierce：狙った段の前衛と後衛をまとめて
 * - all：敵全体
 * - ally：味方1部隊、allies：味方全体、self：自分、none：対象なし（戦果・時間など）
 */
export type Range = 'near' | 'far' | 'pierce' | 'all' | 'ally' | 'allies' | 'self' | 'none';

export type Effect =
  | 'dmg'
  /** 打撃と、準備の取り消し */
  | 'cancel'
  /** 足軽：同じ列の味方をかばう（guardAll は全員） */
  | 'guard'
  | 'guardAll'
  /** 付与 */
  | 'buffAtk'
  | 'buffDef'
  | 'buffInt'
  | 'buffSpd'
  /** 軍師の合戦戦術：付与をいくつか配る */
  | 'tactics'
  | 'heal'
  /** 相手の付与を外す（打撃つき・状態解除） */
  | 'dispel'
  /** 敵全体のガードを0に */
  | 'guardBreak'
  /** 戦果を動かす */
  | 'gauge'
  /** 時間の目盛りを動かす（+で延ばす、−で減らす） */
  | 'time'
  /** 一度だけ攻撃を防ぐ守り */
  | 'barrier'
  /** 一定の確率で部隊を壊滅させる */
  | 'assassin'
  /** 打撃と、相手の技数を1減らす */
  | 'drainAp'
  /** 打撃。当てた相手は必ず捕らえられる */
  | 'mercy'
  /** 敵の最大兵数の割合で打撃（ガード・防御を無視） */
  | 'ratio'
  /** 戦場補正を上げる（陣地構築） */
  | 'field'
  /** 与えた打撃の半分だけ兵を戻す */
  | 'drain';

/** 画面の演出の種類 */
export type Anim = 'melee' | 'spear' | 'charge' | 'arrow' | 'gun' | 'shuriken' | 'magic' | 'shiki' | 'volley' | 'heal' | 'buff' | 'guard' | 'claw' | 'shout' | 'none';

export interface SkillDef {
  id: string;
  name: string;
  /** 消費する技数。'all' は残りすべて */
  cost: number | 'all';
  range: Range;
  /** 打撃の倍率（回復なら回復の倍率） */
  mult: number;
  /** 反撃の割合（受けた側が反撃できる兵種の時） */
  counter: number;
  /** 使ったあとの硬直（次の手番までの上乗せ） */
  stiff: number;
  /** 要準備の技：準備の時間 */
  prep?: number;
  /** 準備を崩すのに要る打撃の回数（既定1） */
  prepGuard?: number;
  effect: Effect;
  /** 効果の強さ（付与の割合・戦果の量・時間など） */
  amount?: number;
  /** 術（陰陽・魔）：ガードを無視し、知で計算する */
  magic?: boolean;
  /** 特定の兵種に倍率 */
  vs?: { kinds: Kind[]; mult: number };
  /** 戦果で勝っている時の倍率 */
  winning?: number;
  /** ガードの半減を無視する */
  ignoreGuard?: boolean;
  /** 後衛の列からも使える（near でも） */
  anyRow?: boolean;
  desc: string;
  color: string;
  anim: Anim;
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
  /** 能力（0〜10ほど）：攻・防・知・速 */
  atk: number;
  def: number;
  int: number;
  spd: number;
  troops: number;
  maxTroops: number;
  /** 合戦の始めの兵数 */
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
  /** 足軽のガード率（0.5＝50%。1以上なら必ずかばう） */
  guard: number;
  guarding: boolean;
  /** かばう範囲が全員か */
  guardAll?: boolean;
  buffs: Buffs;
  /** 防御式神（一度だけ防ぐ） */
  barrier: boolean;
  /** 準備中の技 */
  prep: { skill: string; target: number | null; hits: number } | null;
  out: boolean;
  /** 大将（朔）。壊滅すると負け */
  lord?: boolean;
  /** 城主・大将 */
  boss?: boolean;
  youkai?: boolean;
  /** 手加減突撃を受けた（捕らえられる） */
  mercy?: boolean;
  /** 与えた打撃・倒した数（経験の上乗せ） */
  dealt: number;
  kills: number;
  /** 特別な技能 */
  traits?: Trait[];
}

/** 合戦に効く特別な技能 */
export type Trait = 'firstStrike' | 'counterUp' | 'hunter' | 'luckAtk' | 'luckDef' | 'luckSpd' | 'initGauge' | 'initTime' | 'guardPlus' | 'autoHeal';

export type BattleKind = 'siege' | 'field' | 'defense' | 'hunt';

/** 戦場（守る側の補正が変わる） */
export type Ground = 'field' | 'town' | 'castle';

export interface BattleEnd {
  winner: Side;
  reason: 'wipe' | 'lord' | 'time' | 'exhaust' | 'retreat';
}

export interface Battle {
  v: number;
  seed: number;
  rng: number;
  kind: BattleKind;
  ground: Ground;
  /** 合戦の場所（国ID） */
  region: string;
  /** 今の時（手番の順に使う） */
  time: number;
  /** 残りの時間の目盛り（1行動で1減る） */
  ticks: number;
  /** 初めの目盛り（画面用） */
  ticksMax: number;
  units: Unit[];
  /** 与えた打撃の合計（戦果の計算） */
  dmg: { L: number; R: number };
  /** 技・壊滅・初めの上乗せで動いた戦果 */
  adj: { L: number; R: number };
  /** 戦場補正（守る側の打撃の上乗せ、陣地構築の上乗せ） */
  field: { L: number; R: number };
  /** 手番の部隊（入力待ち） */
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
  | { k: 'skill'; uid: number; skill: string; name: string; color: string; range: Range; anim: Anim; special: boolean; targets: number[] }
  /** guardBy：足軽がかばった時の、元の標的 */
  | { k: 'hit'; uid: number; from: number; n: number; guardBy?: number; big?: boolean; magic?: boolean }
  | { k: 'counter'; uid: number; from: number; n: number }
  | { k: 'heal'; uid: number; n: number }
  | { k: 'buff'; uid: number; stat: 'atk' | 'def' | 'int' | 'spd' | 'guard' | 'barrier' | 'dispel' | 'ap' | 'field'; text: string; good: boolean }
  | { k: 'prep'; uid: number; name: string }
  | { k: 'cancel'; uid: number }
  | { k: 'block'; uid: number }
  | { k: 'miss'; uid: number }
  | { k: 'kill'; uid: number }
  | { k: 'down'; uid: number }
  | { k: 'gauge'; v: number }
  | { k: 'tick'; v: number }
  | { k: 'wait'; uid: number }
  | { k: 'end'; winner: Side };
