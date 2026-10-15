// 罠と、迷宮の見た目（帯）
export interface TrapDef { id: string; name: string; weight: number; minFloor: number; desc: string }

export const TRAPS: TrapDef[] = [
  { id: 'pit', name: '落とし穴', weight: 10, minFloor: 1, desc: '落ちた先から、次の階へ転がり出る。' },
  { id: 'mine', name: '埋め火', weight: 5, minFloor: 4, desc: '火薬が爆ぜて HP が半分になり、周りの道具も吹き飛ぶ。' },
  { id: 'poison', name: '毒矢の罠', weight: 7, minFloor: 2, desc: '毒矢が飛んできて力が下がる。' },
  { id: 'arrow', name: '矢の罠', weight: 8, minFloor: 1, desc: '矢が飛んでくる。' },
  { id: 'sleep', name: '眠り香の罠', weight: 7, minFloor: 2, desc: '眠りの香が噴き出す。' },
  { id: 'rust', name: '錆水の罠', weight: 6, minFloor: 3, desc: '装備が錆びる。' },
  { id: 'hunger', name: '腹減りの罠', weight: 6, minFloor: 2, desc: 'お腹が減る。' },
  { id: 'summon', name: '鳴子の罠', weight: 5, minFloor: 3, desc: '鳴子が鳴り、兵が駆けつける。' },
  { id: 'warp', name: '抜け穴の罠', weight: 8, minFloor: 1, desc: 'どこかへ飛ばされる。' },
  { id: 'spin', name: '回転床', weight: 7, minFloor: 1, desc: '目が回って混乱する。' },
  { id: 'gust', name: '突風の罠', weight: 5, minFloor: 3, desc: '吹き飛ばされる。' },
  { id: 'slow', name: '鈍足の罠', weight: 5, minFloor: 4, desc: '足が遅くなる。' },
  { id: 'bear', name: 'トラバサミ', weight: 6, minFloor: 2, desc: 'しばらく動けなくなる。' },
  { id: 'curse', name: '呪いの札', weight: 4, minFloor: 5, desc: '持ち物が1つ呪われる。' },
];

export const TRAP_BY_ID: Record<string, TrapDef> = Object.fromEntries(TRAPS.map((t) => [t.id, t]));

export type FloorStyle = 'earth' | 'rock' | 'flag' | 'snow' | 'ember' | 'moss' | 'plank' | 'swamp' | 'tatami' | 'grass' | 'cave';
export type WallStyle = 'ishigaki' | 'rock' | 'snowrock' | 'bamboo' | 'wood' | 'swamp' | 'castle' | 'hedge';

export interface Band {
  name: string;
  /** 地形の色 */
  floor: string;
  floorDark: string;
  wall: string;
  wallTop: string;
  accent: string;
  /** 水・溶岩の池 */
  liquid: 'water' | 'lava' | null;
  fstyle: FloorStyle;
  wstyle: WallStyle;
}

export const BANDS: Band[] = [
  { name: '平城の曲輪', floor: '#7d6b4a', floorDark: '#66583c', wall: '#3a332a', wallTop: '#7a7264', accent: '#b8a070', liquid: null, fstyle: 'earth', wstyle: 'ishigaki' },
  { name: '山城の岩道', floor: '#6a665c', floorDark: '#55524a', wall: '#2c2a27', wallTop: '#5e5a52', accent: '#9aa08a', liquid: null, fstyle: 'rock', wstyle: 'rock' },
  { name: '水城の石畳', floor: '#5a6a70', floorDark: '#4a5860', wall: '#1f3240', wallTop: '#4a6474', accent: '#7fc8e0', liquid: 'water', fstyle: 'flag', wstyle: 'ishigaki' },
  { name: '雪の城', floor: '#c8d0d8', floorDark: '#aab4c0', wall: '#4a5a6a', wallTop: '#e8eef4', accent: '#ffffff', liquid: null, fstyle: 'snow', wstyle: 'snowrock' },
  { name: '火の山の砦', floor: '#6a4a3a', floorDark: '#563b2e', wall: '#2e1b16', wallTop: '#5a2f22', accent: '#ff8a3c', liquid: 'lava', fstyle: 'ember', wstyle: 'rock' },
  { name: '森の砦', floor: '#5e6e38', floorDark: '#4c5a2c', wall: '#22381c', wallTop: '#4e7a32', accent: '#9fc260', liquid: null, fstyle: 'moss', wstyle: 'bamboo' },
  { name: '山寺の回廊', floor: '#7a6448', floorDark: '#66533b', wall: '#2e2a22', wallTop: '#6a7a52', accent: '#c8d890', liquid: null, fstyle: 'plank', wstyle: 'wood' },
  { name: '黄泉の沼', floor: '#4e4058', floorDark: '#3e3248', wall: '#18121e', wallTop: '#3e2e4c', accent: '#b49ae0', liquid: 'water', fstyle: 'swamp', wstyle: 'swamp' },
  { name: '天守', floor: '#8a6e48', floorDark: '#735a3a', wall: '#1e1810', wallTop: '#5a3a22', accent: '#e8c070', liquid: null, fstyle: 'tatami', wstyle: 'castle' },
  { name: '合戦場', floor: '#6e7e3e', floorDark: '#5c6a32', wall: '#2e3a1e', wallTop: '#5a6a3a', accent: '#c8d880', liquid: null, fstyle: 'grass', wstyle: 'hedge' },
  { name: '妖魔の巣', floor: '#5d5a52', floorDark: '#4a4842', wall: '#221e26', wallTop: '#4a4252', accent: '#a08ac8', liquid: null, fstyle: 'cave', wstyle: 'rock' },
];

export const BAND_KEEP = 8;
export const BAND_FIELD = 9;
export const BAND_NEST = 10;
