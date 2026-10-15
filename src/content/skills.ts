// 武将の固有技（合戦用には battle/kinds.ts の fromUnique で変換する）

export type SkillKind =
  /** 前の一直線 n マスの敵をまとめて斬る */
  | 'line'
  /** 周り8マスの敵を斬る */
  | 'around'
  /** 一直線に飛ぶ（最初の敵に当たる）。beam=true なら貫く */
  | 'shot'
  /** 見えている敵すべて */
  | 'sight'
  /** いちばん近い敵 n 体 */
  | 'volley'
  /** 部隊（朔と味方）全員にかかる */
  | 'party'
  /** 隣の敵1体に重い一撃 */
  | 'single'
  /** 一直線に駆け抜ける */
  | 'charge'
  /** 敵1体を寝返らせる */
  | 'turn';

export type SkillEffect =
  | 'dmg'
  | 'heal'
  | 'confuse'
  | 'sleep'
  | 'paralyze'
  | 'weaken'
  | 'guard'
  | 'power'
  | 'invincible'
  | 'fast'
  | 'exorcise'
  | 'fire'
  | 'drain'
  | 'despair';

export interface SkillDef {
  id: string;
  name: string;
  kind: SkillKind;
  effect: SkillEffect;
  /** 打撃の倍率（攻撃力に掛ける）か固定値の基本 */
  power: number;
  /** 届く距離・数 */
  range: number;
  /** 使ったあと、また使えるまでのターン */
  cd: number;
  /** 効果の続くターン */
  turns?: number;
  desc: string;
  /** 演出の色 */
  color: string;
}

const S = (id: string, name: string, kind: SkillKind, effect: SkillEffect, power: number, range: number, cd: number, desc: string, color: string, turns?: number): SkillDef =>
  ({ id, name, kind, effect, power, range, cd, desc, color, turns });

export const SKILLS: SkillDef[] = [
  // 暁ノ家
  S('issen', '一閃', 'line', 'dmg', 2.2, 3, 22, '前の一直線3マスの敵を、居合でまとめて斬り抜ける。', '#ffe6a0'),
  S('kyouzaki', '狂咲', 'party', 'power', 1.5, 0, 45, '部隊全員の攻撃力が10ターンの間1.5倍になる。', '#ff7a8a', 10),
  S('harai', '祓い', 'party', 'heal', 0.5, 0, 36, '部隊全員のHPを最大の半分回復し、悪い状態を祓う。', '#c8ffd8'),
  S('kanagi', '神薙ぎ', 'sight', 'exorcise', 2.0, 0, 34, '見えている妖・霊の敵を神威で薙ぎ払う。人には効きにくい。', '#ffffff'),
  S('sakubou', '策謀', 'sight', 'confuse', 0, 0, 30, '見えている敵すべてを混乱させる（8ターン）。', '#b98cff', 8),
  S('kobu', '鼓舞', 'party', 'power', 1.3, 0, 30, '部隊全員の攻撃力が12ターンの間1.3倍になる。', '#ffb24a', 12),
  S('teppeki', '鉄壁', 'party', 'guard', 0.5, 0, 36, '部隊全員の受ける打撃が10ターンの間半分になる。', '#9ab0c8', 10),
  S('konshin', '渾身', 'single', 'dmg', 2.0, 1, 18, '隣の敵に重い一撃。使い手のHPが減っているほど強い。', '#ff9a4a'),
  // 黒鉄家
  S('tetsuyari', '鉄槍突撃', 'line', 'dmg', 1.9, 5, 24, '鉄槍で一直線5マスの敵をまとめて貫く。', '#c0c8d0'),
  S('kokkou', '黒甲', 'party', 'guard', 0.6, 0, 30, '部隊全員の受ける打撃が12ターンの間4割減る。', '#5a6070', 12),
  S('isseisha', '一斉射', 'sight', 'dmg', 1.1, 0, 32, '見えている敵すべてに鉄砲を撃ちかける。', '#ffcf6a'),
  S('sogeki', '狙撃', 'shot', 'dmg', 3.2, 12, 20, '遠くの敵1体を鉄砲で撃ち抜く。', '#ffe08a'),
  S('raijin', '雷迅', 'sight', 'dmg', 1.4, 0, 34, '雷を呼び、見えている敵すべてを打つ。ときどき金縛りにする。', '#9fd8ff'),
  S('gouda', '豪打', 'single', 'paralyze', 2.6, 1, 22, '隣の敵を力任せに打ちすえ、金縛りにする。', '#ff8a5a', 6),
  // 紫苑家
  S('sandan', '算段', 'party', 'heal', 0.35, 0, 28, '兵糧を配って部隊全員のHPを回復し、お腹も満たす。', '#e0c8ff'),
  S('baishuu', '買収', 'turn', 'dmg', 0, 10, 60, '見えている敵1体（将は除く）を金で寝返らせ、この戦の味方にする。', '#ffd84a'),
  S('kairikutachi', '海陸断ち', 'around', 'dmg', 1.7, 1, 22, '周り8マスの敵を大太刀で薙ぎ払う。', '#7ac8ff'),
  S('ryakudatsu', '略奪', 'single', 'dmg', 1.8, 1, 18, '隣の敵を斬りつけ、倒すと文を奪う。', '#ffd84a'),
  S('sakuryaku', '策略', 'sight', 'weaken', 0, 0, 28, '見えている敵すべての攻撃力を下げ、足を鈍らせる。', '#a090ff', 20),
  S('chouhatsu', '挑発', 'sight', 'sleep', 0, 0, 32, '見えている敵を言葉で惑わせ、眠らせる（5ターン）。', '#90a0ff', 5),
  // 白鷺家
  S('shinsoku', '神速', 'party', 'fast', 0, 0, 40, '部隊全員が8ターンの間、倍速で動く。', '#e0f0ff', 8),
  S('hyouga', '白鷺の翔', 'shot', 'paralyze', 2.0, 8, 24, '一直線に氷の刃を飛ばし、当たった敵を斬って凍らせる。', '#c8f0ff', 6),
  S('sanya', '三矢', 'volley', 'dmg', 1.4, 3, 22, 'いちばん近い敵3体に、それぞれ矢を射る。', '#e8d0a0'),
  S('yougan', '鷹眼', 'shot', 'dmg', 2.8, 12, 20, '弱点を見抜いた一矢。必ず当たる。', '#f0e0b0'),
  S('totsugeki', '突撃', 'charge', 'dmg', 1.8, 6, 22, '一直線に駆け抜け、通り道の敵をすべて蹴散らす。', '#d8e8ff'),
  S('yukigake', '雪駆け', 'charge', 'paralyze', 1.4, 6, 26, '雪煙を上げて駆け、通り道の敵を凍えさせる。', '#ffffff', 4),
  // 焔ノ家
  S('kaenjin', '火炎陣', 'around', 'fire', 1.6, 2, 30, '周り2マスを炎の陣で包む。', '#ff7a2a'),
  S('shinka', '神火の祈り', 'party', 'heal', 0.6, 0, 40, '神火の加護で部隊全員のHPを大きく回復する。', '#ffb070'),
  S('hiyari', '火槍突撃', 'shot', 'fire', 2.0, 6, 22, '火槍の炎を一直線に吹きつけ、貫く。', '#ff5a1a'),
  S('honoonagi', '焔薙ぎ', 'around', 'fire', 1.4, 1, 20, '炎をまとって周りを薙ぎ払う。', '#ff8a3a'),
  // 蓮華院
  S('kekkai', '蓮華結界', 'party', 'invincible', 0, 0, 55, '部隊全員が4ターンの間、打撃を受けなくなる。', '#a8ffc8', 4),
  S('jouka', '浄化光', 'shot', 'exorcise', 3.0, 10, 22, '浄化の光を放つ。妖・霊の敵に大きな打撃。', '#ffffe0'),
  S('kongousho', '金剛杵', 'single', 'dmg', 2.4, 1, 18, '金剛杵で隣の敵を打ち砕く。鎧の敵にも通る。', '#e0c070'),
  S('choubuku', '調伏', 'sight', 'exorcise', 2.6, 0, 40, '見えている妖・霊の敵を調伏し、特技を封じる。', '#fff8c0'),
  // 妖魔
  S('kokumu', '黒霧', 'sight', 'despair', 1.2, 0, 30, '黒い霧で見えている者を侵す。', '#6a3a9a'),
  S('mizuchi', '蛟の咆哮', 'sight', 'dmg', 2.0, 0, 40, '天地を揺るがす咆哮。', '#8a5aff'),
  S('gurenmai', '紅蓮舞', 'around', 'fire', 1.8, 1, 24, '紅蓮の炎をまとって舞い、周りを焼く。', '#ff3a3a'),
  S('kyuuketsu', '吸血', 'single', 'drain', 2.0, 1, 20, '隣の敵の生命を吸い、その分だけ回復する。', '#c0203a'),
  S('onikudaki', '鬼砕き', 'single', 'dmg', 3.2, 1, 24, '鬼の剛力で隣の敵を叩き潰す。', '#ff6a3a'),
  S('dohatsu', '怒髪', 'party', 'power', 1.7, 0, 50, '怒りを爆発させ、部隊全員の攻撃力が8ターン1.7倍。', '#ff4a2a', 8),
  // 浪人衆
  S('ansatsu', '暗殺', 'single', 'dmg', 3.6, 1, 30, '隣の敵の急所を突く。弱った敵ほど仕留めやすい。', '#9a9aff'),
  S('kagebunshin', '影走り', 'party', 'fast', 0, 0, 36, '影のように走る。部隊全員が10ターン倍速になる。', '#6a7aa8', 10),
  S('sougetsu', '双月斬り', 'around', 'dmg', 1.9, 1, 22, '二刀で周り8マスを斬り払う。', '#d0d8ff'),
  S('zanshin', '残心', 'single', 'dmg', 2.2, 1, 12, '隣の敵を斬る。すぐにまた使える。', '#b0c0ff'),
  // 汎用（侍大将）
  S('g_gouda', '剛打', 'single', 'dmg', 2.4, 1, 20, '隣の敵に力いっぱい打ちかかる。', '#ff9a5a'),
  S('g_teppeki', '堅陣', 'party', 'guard', 0.6, 0, 34, '部隊全員の受ける打撃が10ターン4割減る。', '#9ab0c8', 10),
  S('g_sogeki', '強弓', 'shot', 'dmg', 2.4, 10, 20, '遠くの敵1体を強弓で射抜く。', '#e8d0a0'),
  S('g_sakubou', '撹乱', 'sight', 'confuse', 0, 0, 34, '見えている敵を混乱させる（6ターン）。', '#b98cff', 6),
  S('g_kobu', '号令', 'party', 'power', 1.25, 0, 30, '部隊全員の攻撃力が10ターン1.25倍。', '#ffb24a', 10),
  S('g_ranbu', '乱撃', 'around', 'dmg', 1.4, 1, 20, '周り8マスの敵を暴れ打つ。', '#ff7a5a'),
  S('g_teate', '手当て', 'party', 'heal', 0.3, 0, 28, '部隊全員のHPを少し回復する。', '#c8ffd8'),
  S('g_onibi', '鬼火', 'shot', 'fire', 1.8, 8, 22, '鬼火を一直線に放つ。', '#ff5a1a'),
];

export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export function skillDef(id: string): SkillDef {
  const def = SKILL_BY_ID[id];
  if (!def) throw new Error(`unknown skill ${id}`);
  return def;
}
