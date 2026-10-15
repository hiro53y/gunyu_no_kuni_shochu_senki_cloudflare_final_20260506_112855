// 八洲の国（15）と勢力（8）。国盗りの地図と、守りの部隊・砦の数を決める
import type { Kind } from '../battle/types';
export type FactionId = 'akatsuki' | 'kurogane' | 'shion' | 'shirasagi' | 'honoo' | 'rengein' | 'youma' | 'ronin';

export type Terrain =
  | 'plain' | 'mountain' | 'port' | 'pass' | 'field' | 'coast' | 'snow' | 'volcano' | 'forest' | 'mountain_temple' | 'cursed' | 'wasteland' | 'islands';

export interface FactionDef {
  id: FactionId;
  name: string;
  color: string;
  /** 地図で使う薄い色 */
  light: string;
  /** 家紋の字 */
  mon: string;
  /** 攻めてくる気の強さ（0〜1） */
  aggression: number;
  /** 守りの部隊の兵種と重み */
  troops: [Kind, number][];
  /** 妖怪の割合（妖魔の群は1） */
  youkai: number;
  desc: string;
}

export const FACTIONS: Record<FactionId, FactionDef> = {
  akatsuki: {
    id: 'akatsuki', name: '暁ノ家', color: '#c84a4a', light: '#e8a090', mon: '暁', aggression: 0,
    troops: [['ashigaru', 3], ['yumi', 2], ['bushi', 2]], youkai: 0,
    desc: '中央の平野「暁原」を治める小さな家。若き当主・風間朔が家督を継いだばかり。',
  },
  kurogane: {
    id: 'kurogane', name: '黒鉄家', color: '#5a5e6a', light: '#a8adb8', mon: '鉄', aggression: 0.42,
    troops: [['ashigaru', 3], ['teppo', 2], ['bushi', 2], ['yumi', 1]], youkai: 0,
    desc: '鉱山と鉄砲で東を治める武の家。当主・黒鉄玄武は隙あらば暁原を呑もうと狙っている。',
  },
  shion: {
    id: 'shion', name: '紫苑家', color: '#7e5ba3', light: '#c4aee0', mon: '紫', aggression: 0.3,
    troops: [['bushi', 2], ['yumi', 3], ['ashigaru', 2], ['gunshi', 1], ['shinobi', 1]], youkai: 0,
    desc: '南の湊を押さえる商いの家。若き女当主・紫苑院葉月は金で戦を動かす。',
  },
  shirasagi: {
    id: 'shirasagi', name: '白鷺家', color: '#9ea6b8', light: '#dde2ec', mon: '鷺', aggression: 0.22,
    troops: [['kiba', 3], ['yumi', 3], ['bushi', 1], ['ashigaru', 1]], youkai: 0,
    desc: '北西の山と雪原の古い武家。騎馬と弓に優れ、守りは固い。',
  },
  honoo: {
    id: 'honoo', name: '焔ノ家', color: '#d43818', light: '#f0a080', mon: '焔', aggression: 0.28,
    troops: [['onmyo', 2], ['teppo', 2], ['ashigaru', 2], ['miko', 1]], youkai: 0,
    desc: '北の火山で神を祀る巫女の家。火の術を操る。',
  },
  rengein: {
    id: 'rengein', name: '蓮華院', color: '#3f8060', light: '#a0d0b4', mon: '蓮', aggression: 0.12,
    troops: [['sohei', 3], ['miko', 2], ['onmyo', 1], ['ashigaru', 1]], youkai: 0,
    desc: '森と山寺の武装寺院。妖魔の調伏を何より重んじる。',
  },
  youma: {
    id: 'youma', name: '妖魔の群', color: '#2a1a2e', light: '#8a6a9a', mon: '妖', aggression: 0.0,
    troops: [['youkai', 1]], youkai: 1,
    desc: '黄泉沼から湧き出した異形の群れ。首領・蛟王黒淵のもと、八洲を呑み込もうとしている。',
  },
  ronin: {
    id: 'ronin', name: '浪人衆', color: '#1f3a6e', light: '#90a8d8', mon: '浪', aggression: 0,
    troops: [['shinobi', 3], ['bushi', 2], ['ashigaru', 1]], youkai: 0,
    desc: '南西の群島「浪間」を根城にする流れ者の集まり。金で動く。',
  },
};

export const FACTION_IDS = Object.keys(FACTIONS) as FactionId[];

export interface RegionDef {
  id: string;
  name: string;
  reading: string;
  terrain: Terrain;
  product: string;
  owner: FactionId;
  /** 城の強さ（敵の強さの基準になる階） */
  danger: number;
  /** （旧）城の階数。砦の数の目安に使う */
  floors: number;
  /** 本拠（落とすと勢力が大きく傾く） */
  capital?: boolean;
  /** 城主（最上階の将） */
  boss: string;
  /** 中の階を守る将 */
  mid?: string;
  adj: string[];
  /** 地図の位置（0〜100） */
  x: number;
  y: number;
  /** 年貢の基本 */
  income: number;
  desc: string;
}

export const REGIONS: RegionDef[] = [
  { id: '01', name: '暁原', reading: 'あけはら', terrain: 'plain', product: '米', owner: 'akatsuki', danger: 1, floors: 3, capital: true, boss: 'g_saku', adj: ['03', '04', '06', '11', '13'], x: 50, y: 55, income: 260, desc: '暁ノ家の本拠。ここを失えば家は滅ぶ。' },
  { id: '02', name: '黒鉄野', reading: 'くろがねの', terrain: 'mountain', product: '鉄', owner: 'kurogane', danger: 11, floors: 5, capital: true, boss: 'g_genbu', adj: ['03', '04', '14'], x: 79, y: 42, income: 300, desc: '黒鉄家の本城。鉄の山に築かれた堅城。' },
  { id: '03', name: '鋼津', reading: 'はがねづ', terrain: 'port', product: '鉄砲', owner: 'kurogane', danger: 5, floors: 3, boss: 'g_hayato', adj: ['01', '02', '05', '06'], x: 74, y: 61, income: 220, desc: '鉄砲を鍛える港町。鉄砲足軽が多い。' },
  { id: '04', name: '雷鳴峠', reading: 'らいめいとうげ', terrain: 'pass', product: '木材', owner: 'kurogane', danger: 7, floors: 4, boss: 'g_narukami', adj: ['01', '02', '09', '10', '14'], x: 62, y: 31, income: 160, desc: '雷の絶えない峠の砦。黒鉄家の筆頭武将が守る。' },
  { id: '05', name: '紫苑湊', reading: 'しおんみなと', terrain: 'port', product: '交易品', owner: 'shion', danger: 12, floors: 5, capital: true, boss: 'g_hazuki', adj: ['03', '06', '07'], x: 62, y: 80, income: 340, desc: '八洲一の商いの湊。紫苑家の本拠。' },
  { id: '06', name: '紅葉野', reading: 'もみじの', terrain: 'field', product: '米', owner: 'shion', danger: 4, floors: 3, boss: 'g_souji', adj: ['01', '03', '05', '07', '12'], x: 47, y: 70, income: 220, desc: '紅葉の美しい田園。紫苑家の知将が治める。' },
  { id: '07', name: '潮咲', reading: 'しおさき', terrain: 'coast', product: '塩', owner: 'shion', danger: 8, floors: 4, boss: 'g_fuuko', adj: ['05', '06', '12', '15'], x: 37, y: 86, income: 180, desc: '塩田と海賊の浜。海賊頭が根城にしている。' },
  { id: '08', name: '白鷺嶺', reading: 'しらさぎね', terrain: 'mountain', product: '馬', owner: 'shirasagi', danger: 15, floors: 5, capital: true, mid: 'g_rin', boss: 'g_toshiro', adj: ['09', '11', '12'], x: 20, y: 36, income: 260, desc: '白鷺家の本城。雲の上の山城。' },
  { id: '09', name: '雪見野', reading: 'ゆきみの', terrain: 'snow', product: '毛皮', owner: 'shirasagi', danger: 10, floors: 4, boss: 'g_shizune', adj: ['04', '08', '10', '11'], x: 34, y: 18, income: 170, desc: '一面の雪原。白鷺の騎馬隊が駆ける。' },
  { id: '10', name: '焔ノ郷', reading: 'ほのおのさと', terrain: 'volcano', product: '硫黄', owner: 'honoo', danger: 16, floors: 5, capital: true, mid: 'g_tomoshibi', boss: 'g_kurenai', adj: ['04', '09', '14'], x: 54, y: 12, income: 230, desc: '火山の麓の社。焔ノ家の巫女が神火を守る。' },
  { id: '11', name: '千歳森', reading: 'ちとせのもり', terrain: 'forest', product: '薬草', owner: 'rengein', danger: 3, floors: 3, boss: 'g_tesshin', adj: ['01', '08', '09', '12', '13'], x: 31, y: 52, income: 190, desc: '千年の森。蓮華院の武僧が妖魔を見張る。' },
  { id: '12', name: '鈴音山', reading: 'すずねやま', terrain: 'mountain_temple', product: '経典', owner: 'rengein', danger: 9, floors: 4, capital: true, boss: 'g_kangetsu', adj: ['06', '07', '08', '11', '13'], x: 20, y: 68, income: 200, desc: '鈴の音が響く山寺。蓮華院の本山。' },
  { id: '13', name: '黄泉沼', reading: 'よみぬま', terrain: 'cursed', product: '瘴気', owner: 'youma', danger: 24, floors: 7, capital: true, mid: 'g_guren', boss: 'g_kurobuchi', adj: ['01', '11', '12', '14'], x: 41, y: 40, income: 60, desc: '黒い霧の湧く沼。妖魔の群の巣にして、蛟王黒淵の座所。' },
  { id: '14', name: '鬼哭原', reading: 'きこくはら', terrain: 'wasteland', product: '—', owner: 'youma', danger: 19, floors: 5, boss: 'g_gaou', adj: ['02', '04', '10', '13'], x: 76, y: 21, income: 90, desc: '鬼の哭く荒野。鬼大将・牙王の陣がある。' },
  { id: '15', name: '浪間', reading: 'なみま', terrain: 'islands', product: '海産物', owner: 'ronin', danger: 13, floors: 4, capital: true, mid: 'g_yuzuriha', boss: 'g_kagemaru', adj: ['07'], x: 15, y: 88, income: 200, desc: '流れ者の集う群島。浪人衆の根城。' },
];

export const REGION_BY_ID: Record<string, RegionDef> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

export function regionDef(id: string): RegionDef {
  const r = REGION_BY_ID[id];
  if (!r) throw new Error(`unknown region ${id}`);
  return r;
}

export const HOME = '01';
export const FINAL = '13';

/** 地形 → 城の見た目（帯） */
export const TERRAIN_BAND: Record<Terrain, number> = {
  plain: 0, field: 0, mountain: 1, pass: 1, port: 2, coast: 2, islands: 2, snow: 3, volcano: 4, wasteland: 4, forest: 5, mountain_temple: 6, cursed: 7,
};

export const TERRAIN_NAME: Record<Terrain, string> = {
  plain: '平野', mountain: '山地', port: '港', pass: '峠', field: '田園', coast: '海岸', snow: '雪原', volcano: '火山', forest: '森', mountain_temple: '山寺', cursed: '魔境', wasteland: '荒野', islands: '群島',
};

export const SEASONS = ['春', '夏', '秋', '冬'] as const;

export function turnLabel(turn: number): string {
  return `${Math.floor((turn - 1) / 4) + 1}年目 ${SEASONS[(turn - 1) % 4]}`;
}
