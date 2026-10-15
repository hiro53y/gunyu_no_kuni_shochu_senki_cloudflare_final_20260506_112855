// 敵の一覧。城の兵（10系統×3段階）と妖怪（16系統×3段階）、旅の商人、武将の器。名前と設定はすべて独自
import type { FactionId } from './sengoku';
import { FACTIONS } from './sengoku';
import { next, weighted, type Rng } from '../engine/rng';

export type Ability =
  | { k: 'none' }
  /** 盗んでワープ。gold=true はお金だけ */
  | { k: 'steal'; gold: boolean }
  /** 叩くと混乱させることがある */
  | { k: 'confuse'; p: number }
  /** 直線に火を吐く */
  | { k: 'fire'; dmg: number; p: number }
  /** 直線に石を投げる */
  | { k: 'stone'; dmg: number; p: number }
  /** 直線に矢を射る */
  | { k: 'arrow'; dmg: number; p: number }
  /** 鉄砲（撃ったら次の手番は弾込め） */
  | { k: 'gun'; dmg: number; p: number }
  /** 叩くと装備を錆びさせる */
  | { k: 'rust'; p: number }
  /** 2マス先まで届く */
  | { k: 'reach' }
  /** 弱ると爆発する */
  | { k: 'explode'; dmg: number }
  /** 魔法弾（鈍足・混乱・金縛り） */
  | { k: 'magic'; p: number; effects: ('slow' | 'confuse' | 'paralyze')[] }
  /** 叩くと力を下げる */
  | { k: 'poison'; p: number }
  /** 叩くとレベルを下げる */
  | { k: 'drain'; p: number }
  /** 叩いて吹き飛ばす */
  | { k: 'blow'; p: number }
  /** 叩くと満腹度を下げる */
  | { k: 'hunger'; amount: number }
  /** 叩くと眠らせる */
  | { k: 'freeze'; p: number }
  /** 1ターンに2回攻撃 */
  | { k: 'double' }
  /** HP が回復していく */
  | { k: 'regen'; n: number }
  /** 仲間を呼び、火を吐く（ボス） */
  | { k: 'boss' };

export type MonTag = 'beast' | 'spirit' | 'armor' | 'undead' | 'human';

export interface MonDef {
  id: string;
  name: string;
  fam: string;
  tier: number;
  /** 出やすい階の中心 */
  lv: number;
  hp: number;
  atk: number;
  def: number;
  exp: number;
  /** 1=倍速、0=通常、-1=鈍足 */
  spd: number;
  /** 移動：walk=歩く、swim=水も渡る、fly=水も溶岩も渡る、phase=壁も抜ける */
  move: 'walk' | 'swim' | 'fly' | 'phase';
  tag: MonTag | null;
  ability: Ability;
  /** 絵：sprite は元の絵、hue は色相の回転、tone は明るさ */
  sprite: string;
  hue: number;
  tone: number;
  desc: string;
  /** 寝て出ることが多い */
  sleepy?: boolean;
  /** 透明（見えにくい） */
  invisible?: boolean;
  /** 図鑑や出現の対象外 */
  special?: boolean;
  /** 城の兵（旗の色で塗る） */
  soldier?: boolean;
}

interface Family {
  fam: string;
  sprite: string;
  move: MonDef['move'];
  tag: MonTag | null;
  spd: number;
  /** HP・攻撃・防御の倍率 */
  mod: [number, number, number];
  tiers: { name: string; lv: number; hue: number; tone: number; ability: Ability; desc: string; spd?: number; invisible?: boolean }[];
  soldier?: boolean;
  sleepy?: boolean;
}

/** 城の兵。絵は旗の色で塗り分ける */
const SOLDIERS: Family[] = [
  {
    fam: 'ashigaru', sprite: 'soldier-ashigaru', move: 'walk', tag: 'human', spd: 0, mod: [1, 0.9, 0.9], soldier: true,
    tiers: [
      { name: '足軽', lv: 2, hue: 0, tone: 1, ability: { k: 'none' }, desc: '陣笠に胴丸の雑兵。数で押してくる。' },
      { name: '槍足軽', lv: 10, hue: 0, tone: 1, ability: { k: 'reach' }, desc: '長槍で2マス先から突いてくる。通路の角に誘い込みたい。' },
      { name: '足軽大将', lv: 20, hue: 0, tone: 1, ability: { k: 'double' }, desc: '足軽を束ねる古強者。1ターンに2度斬りかかる。' },
    ],
  },
  {
    fam: 'teppo', sprite: 'soldier-teppo', move: 'walk', tag: 'human', spd: 0, mod: [0.8, 0.8, 0.8], soldier: true,
    tiers: [
      { name: '鉄砲足軽', lv: 4, hue: 0, tone: 1, ability: { k: 'gun', dmg: 7, p: 0.35 }, desc: '一直線に並ぶと鉄砲を撃ってくる。撃ったあとは弾込めで1手休む。' },
      { name: '鉄砲組頭', lv: 12, hue: 0, tone: 1, ability: { k: 'gun', dmg: 14, p: 0.4 }, desc: '狙いの確かな鉄砲の頭。斜めにずれて近づこう。' },
      { name: '早撃ち', lv: 22, hue: 0, tone: 1, ability: { k: 'gun', dmg: 24, p: 0.45 }, desc: '弾込めの早い名手。遠くでも油断できない。' },
    ],
  },
  {
    fam: 'yumi', sprite: 'soldier-yumi', move: 'walk', tag: 'human', spd: 0, mod: [0.8, 0.85, 0.8], soldier: true,
    tiers: [
      { name: '弓足軽', lv: 3, hue: 0, tone: 1, ability: { k: 'arrow', dmg: 4, p: 0.4 }, desc: '離れた所から矢を射かけてくる。' },
      { name: '弓組頭', lv: 11, hue: 0, tone: 1, ability: { k: 'arrow', dmg: 8, p: 0.4 }, desc: '強弓を引く弓の頭。' },
      { name: '弓聖', lv: 21, hue: 0, tone: 1, ability: { k: 'arrow', dmg: 15, p: 0.45 }, desc: '百発百中と恐れられる射手。' },
    ],
  },
  {
    fam: 'kiba', sprite: 'soldier-kiba', move: 'walk', tag: 'human', spd: 1, mod: [0.7, 0.65, 0.8], soldier: true,
    tiers: [
      { name: '騎馬武者', lv: 6, hue: 0, tone: 1, ability: { k: 'none' }, desc: '馬で駆ける武者。1ターンに2歩動く。' },
      { name: '騎馬隊長', lv: 14, hue: 0, tone: 1, ability: { k: 'none' }, desc: '騎馬隊を率いる将。逃げても追いつかれる。' },
      { name: '赤備え', lv: 24, hue: 0, tone: 1, ability: { k: 'blow', p: 0.3 }, desc: '朱の甲冑の精鋭。馬で体当たりして吹き飛ばす。' },
    ],
  },
  {
    fam: 'sohei', sprite: 'soldier-sohei', move: 'walk', tag: 'human', spd: 0, mod: [1.1, 1, 1], soldier: true,
    tiers: [
      { name: '僧兵', lv: 5, hue: 0, tone: 1, ability: { k: 'reach' }, desc: '薙刀を振るう寺の兵。2マス先まで届く。' },
      { name: '荒法師', lv: 13, hue: 0, tone: 1, ability: { k: 'reach' }, desc: '経より薙刀を選んだ荒くれ僧。' },
      { name: '悪僧', lv: 23, hue: 0, tone: 1, ability: { k: 'regen', n: 3 }, desc: '怪しい術で傷がふさがる破戒僧。手早く倒したい。' },
    ],
  },
  {
    fam: 'shinobi', sprite: 'soldier-shinobi', move: 'walk', tag: 'human', spd: 0, mod: [0.8, 0.9, 0.8], soldier: true,
    tiers: [
      { name: '下忍', lv: 5, hue: 0, tone: 1, ability: { k: 'steal', gold: false }, desc: '道具を一つ盗んで煙のように消える。倒せば取り返せる。' },
      { name: '中忍', lv: 14, hue: 0, tone: 1, ability: { k: 'steal', gold: false }, desc: '盗みの手際がいい忍。' },
      { name: '上忍', lv: 24, hue: 0, tone: 1, ability: { k: 'double' }, desc: '姿の見えない忍の上手。1ターンに2度斬る。', invisible: true },
    ],
  },
  {
    fam: 'kaizoku', sprite: 'soldier-kaizoku', move: 'swim', tag: 'human', spd: 0, mod: [0.95, 0.9, 0.85], soldier: true,
    tiers: [
      { name: '海賊', lv: 3, hue: 0, tone: 1, ability: { k: 'steal', gold: true }, desc: '水も泳ぐ荒くれ。文を奪って逃げる。' },
      { name: '海賊頭', lv: 12, hue: 0, tone: 1, ability: { k: 'steal', gold: true }, desc: '手下を率いる海賊。ごっそり奪う。' },
      { name: '海賊大将', lv: 22, hue: 0, tone: 1, ability: { k: 'blow', p: 0.35 }, desc: '大太刀で吹き飛ばす海の大将。' },
    ],
  },
  {
    fam: 'musha', sprite: 'soldier-musha', move: 'walk', tag: 'armor', spd: 0, mod: [1.3, 0.95, 1.8], soldier: true, sleepy: true,
    tiers: [
      { name: '鎧武者', lv: 7, hue: 0, tone: 1, ability: { k: 'none' }, desc: '重い鎧の武者。とにかく硬い。鎧砕きの武器が効く。' },
      { name: '鉄甲武者', lv: 15, hue: 0, tone: 1, ability: { k: 'none' }, desc: '鉄板を重ねた甲冑の武者。' },
      { name: '黒鉄の巨兵', lv: 25, hue: 0, tone: 1, ability: { k: 'regen', n: 3 }, desc: '鉄の山のような大男。傷がふさがっていく。' },
    ],
  },
  {
    fam: 'jutsu', sprite: 'soldier-jutsu', move: 'walk', tag: 'human', spd: 0, mod: [0.8, 0.85, 0.8], soldier: true,
    tiers: [
      { name: '呪術師', lv: 8, hue: 0, tone: 1, ability: { k: 'magic', p: 0.35, effects: ['slow'] }, desc: '鈍足の呪いを放つ。術返しの防具で跳ね返せる。' },
      { name: '陰陽師', lv: 16, hue: 0, tone: 1, ability: { k: 'magic', p: 0.4, effects: ['slow', 'confuse'] }, desc: '惑わしの術も使う陰陽の使い手。' },
      { name: '大陰陽師', lv: 26, hue: 0, tone: 1, ability: { k: 'magic', p: 0.45, effects: ['slow', 'confuse', 'paralyze'] }, desc: '金縛りまで操る術の大家。' },
    ],
  },
  {
    fam: 'hiya', sprite: 'soldier-hiya', move: 'walk', tag: 'human', spd: 0, mod: [0.85, 0.9, 0.8], soldier: true,
    tiers: [
      { name: '火矢兵', lv: 6, hue: 0, tone: 1, ability: { k: 'fire', dmg: 6, p: 0.3 }, desc: '火の付いた矢を放つ。巻物が燃えるので注意。' },
      { name: '焙烙兵', lv: 14, hue: 0, tone: 1, ability: { k: 'explode', dmg: 32 }, desc: '火薬の壺を抱えた兵。弱ると爆発する。とどめは遠くから。' },
      { name: '火術師', lv: 24, hue: 0, tone: 1, ability: { k: 'fire', dmg: 22, p: 0.4 }, desc: '炎の術を操る。火よけの防具が欲しい。' },
    ],
  },
];

const FAMILIES: Family[] = [
  {
    fam: 'tanuki', sprite: 'enemy-tanuki', move: 'walk', tag: 'beast', spd: 0, mod: [0.9, 0.8, 0.8],
    tiers: [
      { name: '豆狸', lv: 2, hue: 0, tone: 1, ability: { k: 'steal', gold: true }, desc: '旅人の財布を狙う小さな狸。お金をくすねると煙のように消える。' },
      { name: '化け狸', lv: 12, hue: 200, tone: 1, ability: { k: 'steal', gold: false }, desc: '腹鼓で目をくらませ、道具を一つ奪って逃げる。倒せば取り返せる。' },
      { name: '大狸', lv: 22, hue: 300, tone: 0.9, ability: { k: 'steal', gold: false }, desc: '村一つ分の宝を腹に溜め込んだ狸の親分。足が速く、すぐ逃げる。', spd: 1 },
    ],
  },
  {
    fam: 'kitsune', sprite: 'enemy-kitsune', move: 'walk', tag: 'beast', spd: 0, mod: [0.85, 0.85, 0.9],
    tiers: [
      { name: '子狐', lv: 3, hue: 0, tone: 1, ability: { k: 'confuse', p: 0.2 }, desc: '尾を揺らして相手の目を回す。混乱したまま歩くと危ない。' },
      { name: '妖狐', lv: 13, hue: 160, tone: 1, ability: { k: 'confuse', p: 0.25 }, desc: '幻を見せる狐。混乱中の道具の使用には気をつけたい。' },
      { name: '九尾', lv: 24, hue: 40, tone: 1.1, ability: { k: 'confuse', p: 0.35 }, desc: '九つの尾が光る大妖。叩かれるたびに世界が回る。' },
    ],
  },
  {
    fam: 'yoroi', sprite: 'enemy-armor', move: 'walk', tag: 'armor', spd: 0, mod: [1.25, 0.95, 1.9],
    tiers: [
      { name: '古鎧', lv: 5, hue: 0, tone: 1, ability: { k: 'none' }, desc: '持ち主を失った鎧が動き出したもの。とにかく硬い。' },
      { name: '鉄鎧', lv: 13, hue: 190, tone: 0.9, ability: { k: 'none' }, desc: '鉄の板を幾重にも重ねた鎧。鎧に強い武器で挑みたい。' },
      { name: '金剛鎧', lv: 24, hue: 50, tone: 1.15, ability: { k: 'regen', n: 3 }, desc: '傷がひとりでにふさがる不壊の鎧。手早く倒さないと元通り。' },
    ],
  },
  {
    fam: 'onibi', sprite: 'enemy-onibi', move: 'fly', tag: 'spirit', spd: 0, mod: [0.7, 0.9, 0.6],
    tiers: [
      { name: '鬼火', lv: 4, hue: 0, tone: 1, ability: { k: 'fire', dmg: 5, p: 0.3 }, desc: 'まっすぐ並ぶと火を吐いてくる青い火。水も溶岩も越える。' },
      { name: '陰火', lv: 12, hue: 110, tone: 1, ability: { k: 'fire', dmg: 14, p: 0.4 }, desc: '緑に燃える火の玉。離れていても油断できない。' },
      { name: '業火', lv: 23, hue: 180, tone: 1.1, ability: { k: 'fire', dmg: 26, p: 0.45 }, desc: '罪を焼く紅蓮の炎。火に強い防具が欲しい。' },
    ],
  },
  {
    fam: 'kappa', sprite: 'enemy-kappa', move: 'swim', tag: null, spd: 0, mod: [0.9, 0.9, 0.9],
    tiers: [
      { name: '河童', lv: 3, hue: 0, tone: 1, ability: { k: 'stone', dmg: 4, p: 0.4 }, desc: '遠くから石を投げてくる。水の中も平気で泳ぐ。' },
      { name: '川太郎', lv: 11, hue: 260, tone: 1, ability: { k: 'stone', dmg: 7, p: 0.35 }, desc: '川の主の若衆。投げる石は大きく、よく当たる。' },
      { name: '河伯', lv: 21, hue: 170, tone: 0.95, ability: { k: 'stone', dmg: 14, p: 0.4 }, desc: '水を治める古い神。岩のような礫を投げつける。' },
    ],
  },
  {
    fam: 'sabi', sprite: 'enemy-rust-armor', move: 'walk', tag: 'armor', spd: 0, mod: [1.1, 0.95, 1.3],
    tiers: [
      { name: '錆武者', lv: 8, hue: 0, tone: 1, ability: { k: 'rust', p: 0.4 }, desc: '触れたものを錆びさせる亡者の武者。防具が弱っていく。' },
      { name: '赤錆武者', lv: 16, hue: 330, tone: 1.05, ability: { k: 'rust', p: 0.5 }, desc: '真っ赤な錆をまとう武者。金の装備なら錆びない。' },
      { name: '腐食武者', lv: 26, hue: 90, tone: 0.9, ability: { k: 'rust', p: 0.6 }, desc: '鎧も刀も溶かす毒錆を吐く。錆びない印が頼り。' },
    ],
  },
  {
    fam: 'kage', sprite: 'enemy-shadow', move: 'phase', tag: 'spirit', spd: 0, mod: [0.8, 1, 0.7],
    tiers: [
      { name: '影法師', lv: 8, hue: 0, tone: 1, ability: { k: 'none' }, desc: '壁の中を通り抜けて近づいてくる影。壁の中にいる間は叩けない。' },
      { name: '黒影', lv: 18, hue: 200, tone: 0.8, ability: { k: 'none' }, desc: '濃い闇の影。壁越しに何度でも現れる。' },
      { name: '闇影', lv: 28, hue: 300, tone: 0.75, ability: { k: 'none' }, desc: '姿が見えない影の主。足音だけを頼りに戦うことになる。', invisible: true },
    ],
  },
  {
    fam: 'neko', sprite: 'nekomata', move: 'walk', tag: 'beast', spd: 1, mod: [0.7, 0.62, 0.8],
    tiers: [
      { name: '山猫', lv: 7, hue: 0, tone: 1, ability: { k: 'none' }, desc: '素早い山の猫。1ターンに2歩動く。' },
      { name: '猫又', lv: 14, hue: 230, tone: 1, ability: { k: 'none' }, desc: '尾が二つに裂けた化け猫。逃げても追いつかれる。' },
      { name: '化け猫', lv: 25, hue: 300, tone: 1, ability: { k: 'double' }, desc: '足は普通だが、1ターンに2回ずつ引っかく。通路で迎え撃ちたい。', spd: 0 },
    ],
  },
  {
    fam: 'rokuro', sprite: 'rokurokubi', move: 'walk', tag: 'spirit', spd: 0, mod: [1, 1.1, 0.9],
    tiers: [
      { name: 'ろくろ首', lv: 9, hue: 0, tone: 1, ability: { k: 'reach' }, desc: '首を伸ばして2マス先から噛みつく。間合いを取っても安心できない。' },
      { name: '長首', lv: 17, hue: 120, tone: 1, ability: { k: 'reach' }, desc: 'さらに長い首を持つ女怪。通路の角が安全地帯。' },
      { name: '大首', lv: 27, hue: 200, tone: 0.9, ability: { k: 'reach' }, desc: '空に浮かぶ巨大な顔。遠くから一気に噛む。' },
    ],
  },
  {
    fam: 'chouchin', sprite: 'chouchin', move: 'fly', tag: 'spirit', spd: 0, mod: [1, 0.8, 0.8],
    tiers: [
      { name: '提灯お化け', lv: 7, hue: 0, tone: 1, ability: { k: 'explode', dmg: 18 }, desc: '弱ると爆発する。周りの道具まで吹き飛ばす。遠くから倒そう。' },
      { name: '鬼提灯', lv: 16, hue: 300, tone: 1, ability: { k: 'explode', dmg: 40 }, desc: '鬼の顔の提灯。爆発すると体力の大半を持っていかれる。' },
      { name: '爆提灯', lv: 26, hue: 30, tone: 1.15, ability: { k: 'explode', dmg: 80 }, desc: '火薬が詰まった提灯。とどめは矢か杖で。' },
    ],
  },
  {
    fam: 'hone', sprite: 'honehoushi', move: 'walk', tag: 'undead', spd: 0, mod: [0.8, 0.9, 0.9],
    tiers: [
      { name: '骨法師', lv: 9, hue: 0, tone: 1, ability: { k: 'magic', p: 0.35, effects: ['slow'] }, desc: '鈍足の術を放つ骸骨の僧。回復の草は毒になる。' },
      { name: '骨導師', lv: 19, hue: 200, tone: 1, ability: { k: 'magic', p: 0.4, effects: ['slow', 'confuse'] }, desc: '惑わしの術も使う。反射の印があれば術を返せる。' },
      { name: '骨大僧', lv: 29, hue: 280, tone: 0.9, ability: { k: 'magic', p: 0.45, effects: ['slow', 'confuse', 'paralyze'] }, desc: '金縛りの術まで操る高僧の骸骨。' },
    ],
  },
  {
    fam: 'kumo', sprite: 'tsuchigumo', move: 'walk', tag: 'beast', spd: 0, mod: [0.9, 1, 1],
    tiers: [
      { name: '毒蜘蛛', lv: 7, hue: 0, tone: 1, ability: { k: 'poison', p: 0.4 }, desc: '噛まれると力が下がる。毒消し草を持っておきたい。' },
      { name: '土蜘蛛', lv: 17, hue: 30, tone: 0.9, ability: { k: 'poison', p: 0.5 }, desc: '洞に潜む大蜘蛛。力をじわじわ奪う。' },
      { name: '女郎蜘蛛', lv: 27, hue: 300, tone: 1.1, ability: { k: 'poison', p: 0.65 }, desc: '妖しく光る大蜘蛛。毒の印の防具が欲しい。' },
    ],
  },
  {
    fam: 'baku', sprite: 'baku', move: 'walk', tag: 'beast', spd: 0, mod: [1.1, 0.9, 1],
    tiers: [
      { name: '獏', lv: 10, hue: 0, tone: 1, ability: { k: 'drain', p: 0.25 }, desc: '夢を食べる獣。噛まれるとレベルが1つ下がる。' },
      { name: '夢喰い', lv: 18, hue: 180, tone: 1, ability: { k: 'drain', p: 0.35 }, desc: '積み上げた経験を食らう。近づかれる前に倒したい。' },
      { name: '大獏', lv: 28, hue: 260, tone: 0.9, ability: { k: 'drain', p: 0.45 }, desc: '悪夢ごと全てを食らう獏の王。' },
    ],
  },
  {
    fam: 'tengu', sprite: 'tengu', move: 'fly', tag: null, spd: 0, mod: [0.9, 1, 1],
    tiers: [
      { name: '烏天狗', lv: 10, hue: 0, tone: 1, ability: { k: 'blow', p: 0.3 }, desc: '羽団扇で旅人を吹き飛ばす。壁にぶつかると痛い。' },
      { name: '天狗', lv: 19, hue: 330, tone: 1, ability: { k: 'blow', p: 0.4 }, desc: '山の主。吹き飛ばされた先に敵がいることも。' },
      { name: '大天狗', lv: 29, hue: 40, tone: 1.1, ability: { k: 'blow', p: 0.5 }, desc: '嵐を呼ぶ大天狗。素早く宙を舞う。', spd: 1 },
    ],
  },
  {
    fam: 'gaki', sprite: 'gaki', move: 'walk', tag: 'spirit', spd: 0, mod: [1, 0.85, 0.9],
    tiers: [
      { name: '餓鬼', lv: 6, hue: 0, tone: 1, ability: { k: 'hunger', amount: 5 }, desc: '叩かれるとお腹が減る。食べ物は大事に。' },
      { name: '大餓鬼', lv: 15, hue: 120, tone: 1, ability: { k: 'hunger', amount: 9 }, desc: '底なしの食欲。満腹度をごっそり減らす。' },
      { name: '飢餓鬼', lv: 25, hue: 260, tone: 0.9, ability: { k: 'hunger', amount: 14 }, desc: '飢えそのものの鬼。長居は禁物。' },
    ],
  },
  {
    fam: 'yuki', sprite: 'yukionna', move: 'walk', tag: 'spirit', spd: 0, mod: [0.85, 1, 0.9],
    tiers: [
      { name: '雪ん子', lv: 8, hue: 0, tone: 1, ability: { k: 'freeze', p: 0.25 }, desc: '冷たい息で旅人を眠らせる。眠りよけのお守りがあれば平気。' },
      { name: '雪女', lv: 18, hue: 200, tone: 1, ability: { k: 'freeze', p: 0.35 }, desc: '凍える吐息。眠っている間に囲まれると危ない。' },
      { name: '吹雪姫', lv: 28, hue: 260, tone: 1.1, ability: { k: 'freeze', p: 0.45 }, desc: '吹雪を纏う姫。長く眠らされる。' },
    ],
  },
];

/** 敵の強さ：出現階 lv から決め、系統の倍率をかける */
function statsFor(lv: number, mod: [number, number, number]) {
  return {
    hp: Math.round((3 + lv * 2.8) * mod[0]),
    atk: Math.round((1 + lv * 0.7) * mod[1]),
    def: Math.round(lv * 0.5 * mod[2]),
    exp: Math.round((2 + lv * lv * 0.26 + lv) * 1.6),
  };
}

export const MONSTERS: MonDef[] = [];
for (const family of [...SOLDIERS, ...FAMILIES]) {
  family.tiers.forEach((tier, index) => {
    const stats = statsFor(tier.lv, family.mod);
    MONSTERS.push({
      id: `${family.fam}${index + 1}`,
      name: tier.name,
      fam: family.fam,
      tier: index + 1,
      lv: tier.lv,
      ...stats,
      spd: tier.spd ?? family.spd,
      move: family.move,
      tag: family.tag,
      ability: tier.ability,
      sprite: family.sprite,
      hue: tier.hue,
      tone: tier.tone,
      desc: tier.desc,
      invisible: tier.invisible,
      sleepy: family.sleepy || family.fam === 'yoroi' || family.fam === 'baku',
      soldier: family.soldier,
    });
  });
}

MONSTERS.push(
  {
    id: 'general', name: '武将', fam: 'general', tier: 1, lv: 1, hp: 30, atk: 5, def: 2, exp: 50, spd: 0, move: 'walk', tag: 'human',
    ability: { k: 'none' }, sprite: 'token', hue: 0, tone: 1, special: true,
    desc: '名のある武将。技を使う。',
  },
  {
    id: 'keeper', name: '旅の商人', fam: 'keeper', tier: 1, lv: 99, hp: 900, atk: 45, def: 30, exp: 1500, spd: 0, move: 'walk', tag: 'human',
    ability: { k: 'none' }, sprite: 'keeper', hue: 0, tone: 1, special: true,
    desc: '城の中でも商いをする肝の太い商人。品物を持ったまま出ようとすると呼び止められる。払わずに逃げると、階段を上がるまでどこまでも追ってくる。',
  },
  {
    id: 'inn', name: '宿の主人', fam: 'npc', tier: 1, lv: 99, hp: 999, atk: 0, def: 99, exp: 0, spd: 0, move: 'walk', tag: 'human',
    ability: { k: 'none' }, sprite: 'keeper', hue: 25, tone: 1.05, special: true,
    desc: '宿場の宿を営む主人。文を払えば、ひと晩でHPも満腹度もすっかり元通り。',
  },
  {
    id: 'bank', name: '倉庫番', fam: 'npc', tier: 1, lv: 99, hp: 999, atk: 0, def: 99, exp: 0, spd: 0, move: 'walk', tag: 'human',
    ability: { k: 'none' }, sprite: 'keeper', hue: 180, tone: 0.95, special: true,
    desc: '預けた道具とお金を村の倉庫へ届けてくれる。冒険の途中で倒れても、預けた物は失わない。',
  },
  {
    id: 'seer', name: '辻占い', fam: 'npc', tier: 1, lv: 99, hp: 999, atk: 0, def: 99, exp: 0, spd: 0, move: 'walk', tag: 'human',
    ability: { k: 'none' }, sprite: 'keeper', hue: 270, tone: 0.9, special: true,
    desc: '文を払えば、道具の正体を占ってくれる。',
  },
  {
    id: 'boss', name: '黄泉の大鬼', fam: 'boss', tier: 1, lv: 30, hp: 520, atk: 34, def: 26, exp: 3000, spd: 0, move: 'walk', tag: null,
    ability: { k: 'boss' }, sprite: 'oni', hue: 0, tone: 1, special: true,
    desc: '天守の最上階に座す鬼の王。火を吐き、配下を呼び寄せる。',
  },
);

export const MON_BY_ID: Record<string, MonDef> = Object.fromEntries(MONSTERS.map((m) => [m.id, m]));

export function monDef(id: string): MonDef {
  const def = MON_BY_ID[id];
  if (!def) throw new Error(`unknown monster ${id}`);
  return def;
}

/** 同じ系統の1つ上の段階（無ければ null） */
export function nextTier(id: string): string | null {
  const def = monDef(id);
  const up = MONSTERS.find((m) => m.fam === def.fam && m.tier === def.tier + 1);
  return up ? up.id : null;
}

export const NORMAL_MONSTERS = MONSTERS.filter((m) => !m.special);

const YOUKAI_FAMS = FAMILIES.map((f) => f.fam);

/** 妖怪（霊に効く技・祓いが効く） */
export function isYoukai(id: string): boolean {
  const def = MON_BY_ID[id];
  return !!def && !def.soldier && !def.special;
}

/** 系統の中から、強さの基準に合った段階を選ぶ */
function tierFor(r: Rng, fam: string, danger: number, banned: Record<string, true>): MonDef | null {
  const list = NORMAL_MONSTERS.filter((m) => m.fam === fam && !banned[m.id]);
  if (!list.length) return null;
  const fit = list.filter((m) => m.lv <= danger + 2);
  if (!fit.length) return list[0].lv <= danger + 4 ? list[0] : null;
  // いちばん合う段階が出やすく、1つ下の段階もときどき混ざる
  return weighted(r, fit, (m) => (m === fit[fit.length - 1] ? 5 : danger - m.lv > 14 ? 0.3 : 1.5))!;
}

/** 勢力の兵と妖怪から、1体の種類を選ぶ */
export function pickMonster(r: Rng, danger: number, faction: FactionId, banned: Record<string, true> = {}): string {
  const fd = FACTIONS[faction];
  for (let tries = 0; tries < 12; tries++) {
    const youkai = fd.troops.length === 0 || next(r) < fd.youkai;
    let fam: string;
    if (youkai) {
      const fams = YOUKAI_FAMS.filter((f) => (NORMAL_MONSTERS.find((m) => m.fam === f)?.lv ?? 99) <= danger + 3);
      if (!fams.length) continue;
      fam = weighted(r, fams, () => 1)!;
    } else {
      fam = weighted(r, fd.troops, ([, w]) => w)![0];
    }
    const def = tierFor(r, fam, danger, banned);
    if (def) return def.id;
  }
  const pool = NORMAL_MONSTERS.filter((m) => !banned[m.id] && m.lv <= danger + 2);
  return (pool.length ? pool[pool.length - 1] : NORMAL_MONSTERS[0]).id;
}
