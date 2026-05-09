// ===========================================================================
// 汎用キャラ生成用プール v2.1
// 名字・名前のプールと、trait別のステータス・スキル設定を提供する。
// すべてオリジナルで歴史的雰囲気のある日本語名を使用。
// spec_v2.md §6B に対応
// ===========================================================================

import type { GenericTrait, SkillId } from '../types/game';

// --- 名字プール（戦国期日本人風・架空） ------------------------------------

export const SURNAMES = [
  '山田', '川中', '岡部', '林', '村瀬', '井川', '土井', '長谷', '杉江', '片岡',
  '波多', '立花', '杉村', '宮田', '原', '菅原', '今川', '水野', '堀', '樋口',
  '神保', '武藤', '富田', '奈良', '石井', '矢野', '米沢', '三宅', '伴野', '安藤',
  '磯野', '岩瀬', '大久保', '北山', '古沢', '湯浅', '佐久間', '津田', '前野', '柴山',
  '松倉', '榎本', '結城', '相馬', '本郷', '新庄', '鵜飼', '滝沢', '白石', '黒田',
] as const;

// --- 名前プール（男性） ------------------------------------------------------

export const GIVEN_NAMES_MALE = [
  '一郎', '二郎', '三郎', '源八', '藤十郎', '与次郎', '新左衛門', '伊織', '左京', '九郎',
  '平助', '清次', '右近', '惣助', '忠平', '元春', '丹後', '五兵衛', '市之助', '虎之助',
  '駿河', '勘解由', '長門', '修理', '監物', '主水', '玄蕃', '掃部', '兵部', '織部',
  '弥三郎', '七之助', '半次郎', '忠左衛門', '小十郎', '弥九郎', '宗五郎', '六郎', '甚兵衛', '又兵衛',
] as const;

// --- 名前プール（女性） ------------------------------------------------------

export const GIVEN_NAMES_FEMALE = [
  '千鶴', '咲', '紗那', '藍', '楓', '美雪', '香織', '菖蒲', '桔梗', '真琴',
  '椿', '雪乃', '紅羽', '瑠璃', '葵', '撫子', '小百合', '紫', '琴音', '朱里',
  '萌花', '若菜', '菊乃', '茜', '光', '風花', '蓮', '柚', '澪', '志乃',
] as const;

// --- 特性プロファイル ------------------------------------------------------

export interface TraitProfile {
  trait: GenericTrait;
  /** 出現重み（合計100） */
  weight: number;
  /** 武力レンジ */
  power: [number, number];
  /** 統率レンジ */
  command: [number, number];
  /** 知略レンジ */
  intel: [number, number];
  /** 魅力レンジ */
  charisma: [number, number];
  /** 兵数上限の基礎値レンジ */
  troopMax: [number, number];
  /** デフォルト忠誠度（説得難度の目安） */
  loyalty: [number, number];
  /** スキルIDの候補配列。先頭から最大2個ピックされる */
  skills: SkillId[];
  /** 説得成功率の補正（％） */
  persuasionModifier: number;
  /** 表示用のラベル */
  label: string;
}

export const TRAIT_PROFILES: TraitProfile[] = [
  {
    trait: 'normal', weight: 60, label: '平凡',
    power: [50, 70], command: [50, 70], intel: [40, 65], charisma: [40, 65],
    troopMax: [400, 600], loyalty: [50, 70],
    skills: ['sk_zangeki', 'sk_shuuchuutsuki', 'sk_meiso'],
    persuasionModifier: 0,
  },
  {
    trait: 'attacker', weight: 12, label: '攻め手',
    power: [88, 99], command: [30, 55], intel: [25, 50], charisma: [30, 60],
    troopMax: [600, 800], loyalty: [40, 65],
    skills: ['sk_shuuchuutsuki', 'sk_zangeki'],
    persuasionModifier: -5,
  },
  {
    trait: 'defender', weight: 7, label: '守り手',
    power: [60, 75], command: [88, 99], intel: [50, 70], charisma: [50, 70],
    troopMax: [800, 1000], loyalty: [60, 80],
    skills: ['sk_hangeki', 'sk_zangeki'],
    persuasionModifier: -10,
  },
  {
    trait: 'strategist', weight: 6, label: '軍師',
    power: [30, 50], command: [50, 70], intel: [88, 95], charisma: [50, 70],
    troopMax: [400, 600], loyalty: [50, 75],
    skills: ['sk_kobu', 'sk_chouhatsu'],
    persuasionModifier: 0,
  },
  {
    trait: 'commander', weight: 4, label: '名将',
    power: [70, 85], command: [88, 95], intel: [60, 78], charisma: [70, 85],
    troopMax: [900, 1100], loyalty: [70, 85],
    skills: ['sk_tokinokoe', 'sk_zangeki'],
    persuasionModifier: -15,
  },
  {
    trait: 'sniper', weight: 6, label: '狙撃手',
    power: [80, 92], command: [50, 70], intel: [60, 75], charisma: [40, 60],
    troopMax: [500, 700], loyalty: [50, 70],
    skills: ['sk_sanya', 'sk_kisha'],
    persuasionModifier: -5,
  },
  {
    trait: 'wild', weight: 3, label: '暴れ者',
    power: [95, 99], command: [25, 45], intel: [15, 35], charisma: [20, 40],
    troopMax: [600, 850], loyalty: [30, 55],
    skills: ['sk_ittouryouudan', 'sk_zangeki'],
    persuasionModifier: -25,
  },
  {
    trait: 'gem', weight: 2, label: '逸材',
    power: [88, 99], command: [75, 95], intel: [75, 95], charisma: [70, 95],
    troopMax: [900, 1200], loyalty: [80, 95],
    skills: ['sk_ittouryouudan', 'sk_tokinokoe'],
    persuasionModifier: -35,
  },
];

/** trait→プロファイルの逆引き */
export function getTraitProfile(trait: GenericTrait): TraitProfile {
  return TRAIT_PROFILES.find((p) => p.trait === trait) ?? TRAIT_PROFILES[0];
}
