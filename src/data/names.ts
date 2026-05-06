import type { RandomEvent, Skill } from '../types/game';

export const PLAYER_FACTION_ID = 'f_akebono';
export const RONIN_FACTION_ID = 'f_ronin';

export const skillCatalog: Record<string, Skill> = {
  swiftCharge: {
    id: 'swiftCharge',
    name: '疾風突撃',
    description: '攻撃時、攻撃力が上昇する。',
    trigger: 'attack',
    effect: { attackMultiplier: 1.14 },
  },
  firmFormation: {
    id: 'firmFormation',
    name: '堅陣',
    description: '防御時、防御力が上昇し被害を抑える。',
    trigger: 'defense',
    effect: { defenseMultiplier: 1.12, damageReduction: 0.08 },
  },
  magistrate: {
    id: 'magistrate',
    name: '名奉行',
    description: '内政効果が上昇する。',
    trigger: 'domestic',
    effect: { domesticMultiplier: 1.24 },
  },
  strategistEye: {
    id: 'strategistEye',
    name: '軍略眼',
    description: '戦闘時、敵の補正を一部低下させる。',
    trigger: 'battle',
    effect: { enemyDebuff: 0.06 },
  },
  rally: {
    id: 'rally',
    name: '鼓舞',
    description: '戦闘時、味方士気を高める。',
    trigger: 'battle',
    effect: { moraleBonus: 4, attackMultiplier: 1.04 },
  },
  intrigue: {
    id: 'intrigue',
    name: '調略',
    description: '進軍時、敵兵力をわずかに削る。',
    trigger: 'attack',
    effect: { sabotageRate: 0.06 },
  },
  castleCraft: {
    id: 'castleCraft',
    name: '築城',
    description: '城耐久の回復量が上昇する。',
    trigger: 'domestic',
    effect: { castleRepairMultiplier: 1.35 },
  },
  popularTrust: {
    id: 'popularTrust',
    name: '人望',
    description: '探索と登用の成功率が上昇する。',
    trigger: 'recruit',
    effect: { hireChanceBonus: 0.14, searchChanceBonus: 0.08 },
  },
  fieldDrill: {
    id: 'fieldDrill',
    name: '練兵上手',
    description: '訓練効果が上昇する。',
    trigger: 'train',
    effect: { trainMultiplier: 1.2 },
  },
};

export const randomEvents: RandomEvent[] = [
  {
    id: 'goodHarvest',
    name: '豊作',
    description: '支配地に実りがあり、兵糧が増えた。',
    weight: 18,
  },
  {
    id: 'badHarvest',
    name: '凶作',
    description: '天候不順で兵糧が減った。',
    weight: 10,
  },
  {
    id: 'merchant',
    name: '商人来訪',
    description: '商人が兵糧を持ち込んだ。',
    weight: 12,
  },
  {
    id: 'ronin',
    name: '浪人来訪',
    description: '仕官先を探す武将が領内に現れた。',
    weight: 14,
  },
  {
    id: 'uprising',
    name: '一揆',
    description: '治安の低い地域で不満が噴き出した。',
    weight: 8,
  },
  {
    id: 'artisan',
    name: '名工来訪',
    description: '名工の助力で城の補修が進んだ。',
    weight: 12,
  },
  {
    id: 'rumor',
    name: '流言',
    description: '不穏な噂が広がり士気が下がった。',
    weight: 8,
  },
  {
    id: 'festival',
    name: '祭礼',
    description: '祭礼で民心が落ち着いた。',
    weight: 10,
  },
];

export const terrainLabel: Record<string, string> = {
  plain: '平野',
  mountain: '山地',
  forest: '森',
  river: '河畔',
  coast: '海辺',
};

export const difficultyLabel: Record<string, string> = {
  easy: '易しい',
  normal: '普通',
  hard: '難しい',
};
