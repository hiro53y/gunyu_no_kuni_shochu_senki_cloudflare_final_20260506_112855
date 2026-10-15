// 道具の一覧（名前・値段・出やすさ）。効果は engine/itemEffects.ts
import type { ItemCat } from '../engine/types';

export interface ItemDef {
  id: string;
  name: string;
  cat: ItemCat;
  /** 店の売値の基本 */
  price: number;
  /** 出やすさ（0 なら自然には出ない） */
  weight: number;
  /** この階より浅いところには出ない */
  minFloor: number;
  desc: string;
  /** 武器の攻撃力・防具の防御力 */
  power?: number;
  /** 印の枠 */
  slots?: number;
  /** 最初から付いている印 */
  seal?: string;
  /** 杖の回数 */
  charges?: [number, number];
  /** 壺の容量 */
  cap?: [number, number];
  /** 矢の威力 */
  dmg?: number;
  /** 常に呪われている */
  alwaysCursed?: boolean;
}

/** 印 */
export const SEALS: Record<string, { name: string; desc: string; on: 'weapon' | 'armor' }> = {
  会: { name: '会心', desc: 'ときどき大きな一撃が出る', on: 'weapon' },
  獣: { name: '獣斬り', desc: '獣の敵に1.5倍の打撃', on: 'weapon' },
  霊: { name: '霊斬り', desc: '霊の敵に1.5倍の打撃', on: 'weapon' },
  砕: { name: '鎧砕き', desc: '鎧・骨の敵に1.5倍の打撃', on: 'weapon' },
  貫: { name: '貫き', desc: '前の2マスをまとめて突く', on: 'weapon' },
  薙: { name: '薙ぎ', desc: '前と左右斜めの3マスを斬る', on: 'weapon' },
  癒: { name: '癒し', desc: '与えた打撃の一部だけ回復する', on: 'weapon' },
  掘: { name: '掘り', desc: '壁を叩くと掘れる', on: 'weapon' },
  錆: { name: '錆よけ', desc: '錆びない', on: 'armor' },
  腹: { name: '腹持ち', desc: 'お腹が減りにくい', on: 'armor' },
  反: { name: '術返し', desc: '術を跳ね返す', on: 'armor' },
  避: { name: '見切り', desc: 'ときどき攻撃をかわす', on: 'armor' },
  返: { name: '痛み返し', desc: '受けた打撃の半分を返す', on: 'armor' },
  火: { name: '火よけ', desc: '火の打撃を半分にする', on: 'armor' },
  毒: { name: '毒よけ', desc: '力が下がらない', on: 'armor' },
  眠: { name: '眠りよけ', desc: '眠らない', on: 'armor' },
};

const W = (id: string, name: string, power: number, slots: number, price: number, weight: number, minFloor: number, desc: string, seal?: string, alwaysCursed?: boolean): ItemDef =>
  ({ id, name, cat: 'weapon', power, slots, price, weight, minFloor, desc, seal, alwaysCursed });
const A = (id: string, name: string, power: number, slots: number, price: number, weight: number, minFloor: number, desc: string, seal?: string): ItemDef =>
  ({ id, name, cat: 'armor', power, slots, price, weight, minFloor, desc, seal });

export const ITEMS: ItemDef[] = [
  // ── 武器 ──
  W('w_bokuto', '木刀', 2, 3, 300, 12, 1, '軽い木の刀。印の枠が少ない。'),
  W('w_dou', '銅の太刀', 4, 4, 600, 12, 1, '扱いやすい銅の刀。'),
  W('w_tetsu', '鉄の太刀', 6, 5, 1000, 9, 4, '旅の定番。印をたくさん付けられる。'),
  W('w_hagane', '鋼の太刀', 8, 5, 1600, 6, 10, '鍛え抜かれた鋼の刀。'),
  W('w_ootachi', '大太刀', 11, 3, 2400, 4, 14, '重く強い大太刀。印の枠は少ない。'),
  W('w_zantetsu', '斬鉄の刀', 13, 5, 4000, 2, 20, '鉄をも断つ名刀。ときどき会心の一撃。', '会'),
  W('w_kemono', '獣斬りの太刀', 5, 5, 1400, 5, 3, '獣の敵に強い。', '獣'),
  W('w_tama', '霊斬りの太刀', 5, 5, 1400, 5, 6, '霊の敵に強い。', '霊'),
  W('w_kudaki', '鎧砕きの槌', 5, 4, 1400, 5, 6, '鎧と骨の敵に強い。', '砕'),
  W('w_yari', '三日月槍', 4, 4, 1200, 6, 2, '前の2マスを同時に突ける。', '貫'),
  W('w_naginata', '薙刀', 5, 4, 1800, 5, 5, '前と左右斜めの3マスを薙ぎ払う。', '薙'),
  W('w_iyashi', '癒しの太刀', 3, 4, 1200, 4, 4, '敵を斬ると少し回復する。', '癒'),
  W('w_tsuruhashi', 'つるはし', 3, 3, 900, 5, 2, '壁を掘れる。', '掘'),
  W('w_kin', '金の太刀', 4, 4, 1500, 4, 6, '錆びない金の刀。', '錆'),
  W('w_youtou', '妖刀', 18, 2, 900, 2, 12, '恐ろしく強いが必ず呪われている。', undefined, true),
  // ── 防具 ──
  A('a_mokuyoroi', '木の胴丸', 2, 3, 300, 12, 1, '軽い木の防具。'),
  A('a_dou', '銅の胴丸', 4, 4, 600, 12, 1, '扱いやすい銅の防具。'),
  A('a_tetsu', '鉄の胴丸', 6, 5, 1000, 9, 4, '旅の定番。印をたくさん付けられる。'),
  A('a_hagane', '鋼の胴丸', 8, 5, 1600, 6, 10, '鍛え抜かれた鋼の防具。'),
  A('a_oyoroi', '大鎧', 11, 3, 2400, 4, 14, '重く硬い大鎧。印の枠は少ない。'),
  A('a_kawa', '革の胴丸', 3, 4, 900, 5, 2, 'お腹が減りにくくなる。', '腹'),
  A('a_kin', '金の胴丸', 4, 4, 1500, 4, 5, '錆びない金の防具。', '錆'),
  A('a_kagami', '鏡の胴丸', 5, 4, 2000, 3, 9, '敵の術を跳ね返す。', '反'),
  A('a_mikiri', '見切りの胴丸', 3, 4, 1800, 4, 6, 'ときどき攻撃をかわす。', '避'),
  A('a_toge', '棘の胴丸', 4, 4, 1800, 4, 7, '受けた打撃の半分を相手に返す。', '返'),
  A('a_hinezumi', '火鼠の胴丸', 6, 4, 2000, 3, 10, '火の打撃を半分にする。', '火'),
  A('a_dokuyoke', '毒よけの胴丸', 5, 4, 1600, 4, 6, '力を下げられない。', '毒'),
  A('a_nemuri', '眠りよけの胴丸', 5, 4, 1600, 3, 8, '眠らされない。', '眠'),
  // ── お守り ──
  { id: 'c_nemuri', name: '眠りよけのお守り', cat: 'charm', price: 1500, weight: 5, minFloor: 3, desc: '眠らなくなる。' },
  { id: 'c_konran', name: '混乱よけのお守り', cat: 'charm', price: 1500, weight: 5, minFloor: 3, desc: '混乱しなくなる。' },
  { id: 'c_doku', name: '毒よけのお守り', cat: 'charm', price: 1500, weight: 5, minFloor: 3, desc: '力が下がらなくなる。' },
  { id: 'c_kaifuku', name: '回復のお守り', cat: 'charm', price: 3000, weight: 3, minFloor: 5, desc: 'HP の回復が速くなるが、お腹も減りやすい。' },
  { id: 'c_ento', name: '遠投のお守り', cat: 'charm', price: 2000, weight: 3, minFloor: 5, desc: '投げた物が敵を貫いて飛ぶ。' },
  { id: 'c_toushi', name: '透視のお守り', cat: 'charm', price: 3000, weight: 2, minFloor: 8, desc: '階の敵と道具がすべて見える。' },
  { id: 'c_shikibetsu', name: '識別のお守り', cat: 'charm', price: 3000, weight: 2, minFloor: 6, desc: '拾った道具の正体が分かる。' },
  { id: 'c_wanami', name: '罠見のお守り', cat: 'charm', price: 1500, weight: 4, minFloor: 3, desc: '罠がすべて見える。' },
  { id: 'c_haramochi', name: '腹持ちのお守り', cat: 'charm', price: 2000, weight: 4, minFloor: 4, desc: 'お腹が半分しか減らない。' },
  { id: 'c_gouriki', name: '剛力のお守り', cat: 'charm', price: 2000, weight: 4, minFloor: 4, desc: '攻撃力が上がる。' },
  { id: 'c_kongou', name: '金剛のお守り', cat: 'charm', price: 2000, weight: 4, minFloor: 4, desc: '防御力が上がる。' },
  { id: 'c_mayoi', name: '迷いのお守り', cat: 'charm', price: 500, weight: 3, minFloor: 2, desc: 'ときどき勝手にどこかへ飛ばされる。呪われている。', alwaysCursed: true },
  // ── 草 ──
  { id: 'g_yakusou', name: '薬草', cat: 'grass', price: 50, weight: 20, minFloor: 1, desc: 'HP を25回復。満タンなら最大HPが1増える。' },
  { id: 'g_daiyakusou', name: '大薬草', cat: 'grass', price: 100, weight: 10, minFloor: 2, desc: 'HP を100回復し、混乱と目つぶしも治る。' },
  { id: 'g_inochi', name: '命の草', cat: 'grass', price: 500, weight: 3, minFloor: 3, desc: '最大HPが5増える。' },
  { id: 'g_chikara', name: '力の草', cat: 'grass', price: 500, weight: 4, minFloor: 2, desc: '力が1上がる。' },
  { id: 'g_doku', name: '毒草', cat: 'grass', price: 20, weight: 8, minFloor: 1, desc: '力が下がる。敵に投げると攻撃力を下げる。' },
  { id: 'g_konran', name: '混乱草', cat: 'grass', price: 20, weight: 7, minFloor: 1, desc: '混乱する。敵に投げると混乱させる。' },
  { id: 'g_suimin', name: '睡眠草', cat: 'grass', price: 20, weight: 7, minFloor: 1, desc: '眠ってしまう。敵に投げると眠らせる。' },
  { id: 'g_megusuri', name: '目薬草', cat: 'grass', price: 50, weight: 7, minFloor: 1, desc: 'この階の罠がすべて見える。' },
  { id: 'g_senrigan', name: '千里眼の草', cat: 'grass', price: 150, weight: 5, minFloor: 3, desc: 'この階の敵と道具の場所が分かる。' },
  { id: 'g_baisoku', name: '倍速草', cat: 'grass', price: 100, weight: 6, minFloor: 2, desc: 'しばらく倍速で動ける。' },
  { id: 'g_fukkatsu', name: '復活の草', cat: 'grass', price: 1000, weight: 3, minFloor: 4, desc: '倒れた時に自動で生き返る。' },
  { id: 'g_kaen', name: '火炎草', cat: 'grass', price: 100, weight: 6, minFloor: 2, desc: '前方へ火を吐く。' },
  { id: 'g_zassou', name: '雑草', cat: 'grass', price: 10, weight: 6, minFloor: 1, desc: '何の効果もない。' },
  { id: 'g_ten', name: '天の草', cat: 'grass', price: 300, weight: 3, minFloor: 4, desc: 'レベルが1上がる。' },
  { id: 'g_dokukeshi', name: '毒消し草', cat: 'grass', price: 100, weight: 6, minFloor: 2, desc: '下がった力を元に戻す。' },
  { id: 'g_sugata', name: '姿隠しの草', cat: 'grass', price: 200, weight: 4, minFloor: 3, desc: 'しばらく敵に気づかれにくくなる。' },
  { id: 'g_muteki', name: '無敵草', cat: 'grass', price: 300, weight: 3, minFloor: 6, desc: 'しばらく打撃を受けない。' },
  // ── 巻物 ──
  { id: 's_shikibetsu', name: '識別の巻物', cat: 'scroll', price: 100, weight: 16, minFloor: 1, desc: '道具を1つ選んで正体を見極める。' },
  { id: 's_tenkei', name: '天恵の巻物', cat: 'scroll', price: 300, weight: 6, minFloor: 2, desc: '装備中の武器が1つ強くなり、呪いが解ける。' },
  { id: 's_chikei', name: '地恵の巻物', cat: 'scroll', price: 300, weight: 6, minFloor: 2, desc: '装備中の防具が1つ強くなり、呪いが解ける。' },
  { id: 's_hakushi', name: '白紙の巻物', cat: 'scroll', price: 800, weight: 3, minFloor: 4, desc: '正体の分かった巻物の名を書くと、その効果が出る。' },
  { id: 's_oobeya', name: '大部屋の巻物', cat: 'scroll', price: 200, weight: 5, minFloor: 2, desc: '階全体が一つの大部屋になる。' },
  { id: 's_konran', name: '混乱の巻物', cat: 'scroll', price: 200, weight: 7, minFloor: 1, desc: '見えている敵を混乱させる。' },
  { id: 's_nemuri', name: '眠りの巻物', cat: 'scroll', price: 300, weight: 6, minFloor: 2, desc: '見えている敵を眠らせる。' },
  { id: 's_shinkuu', name: '真空斬りの巻物', cat: 'scroll', price: 400, weight: 5, minFloor: 3, desc: '見えている敵すべてに打撃を与える。' },
  { id: 's_seiiki', name: '聖域の巻物', cat: 'scroll', price: 600, weight: 3, minFloor: 5, desc: '床に置くと、敵はその上の者を攻撃できない。読んでも効果はない。' },
  { id: 's_wanakeshi', name: '罠消しの巻物', cat: 'scroll', price: 200, weight: 5, minFloor: 2, desc: 'この階の罠をすべて消す。' },
  { id: 's_douguyose', name: '道具寄せの巻物', cat: 'scroll', price: 300, weight: 4, minFloor: 3, desc: 'この階の道具を足元に集める。' },
  { id: 's_kaijuu', name: '解呪の巻物', cat: 'scroll', price: 300, weight: 5, minFloor: 2, desc: '持ち物の呪いをすべて解く。' },
  { id: 's_kikan', name: '撤退の巻物', cat: 'scroll', price: 800, weight: 2, minFloor: 5, desc: '城攻め・修行の途中で、持ち物を持ったまま本陣へ退く。登った階まで城門が破れたまま残る。' },
  { id: 's_chizu', name: '地図の巻物', cat: 'scroll', price: 200, weight: 6, minFloor: 1, desc: 'この階の地形と階段が分かる。' },
  { id: 's_bakuhatsu', name: '雷鳴の巻物', cat: 'scroll', price: 300, weight: 5, minFloor: 3, desc: '周りの敵に雷を落とす。' },
  { id: 's_nekiri', name: '根切りの巻物', cat: 'scroll', price: 1000, weight: 2, minFloor: 6, desc: 'いちばん近い敵の種類を、この冒険から消し去る。' },
  { id: 's_bakuretsu', name: '爆裂の巻物', cat: 'scroll', price: 400, weight: 4, minFloor: 3, desc: '周りの敵と壁を吹き飛ばす。' },
  { id: 's_tokitome', name: '時止めの巻物', cat: 'scroll', price: 600, weight: 2, minFloor: 8, desc: 'しばらくの間、階の敵がすべて止まる。' },
  // ── 杖 ──
  { id: 't_fukitobashi', name: 'ふきとばしの杖', cat: 'staff', price: 500, weight: 8, minFloor: 1, charges: [3, 6], desc: '当たった敵を遠くへ吹き飛ばす。' },
  { id: 't_bashogae', name: '場所替えの杖', cat: 'staff', price: 500, weight: 6, minFloor: 2, charges: [3, 6], desc: '当たった敵と場所を入れ替える。' },
  { id: 't_ichiji', name: '一時しのぎの杖', cat: 'staff', price: 500, weight: 7, minFloor: 1, charges: [3, 6], desc: '当たった敵をどこかへ飛ばす。' },
  { id: 't_donsoku', name: '鈍足の杖', cat: 'staff', price: 500, weight: 7, minFloor: 1, charges: [3, 6], desc: '当たった敵を鈍足にする。' },
  { id: 't_fuuin', name: '封印の杖', cat: 'staff', price: 700, weight: 6, minFloor: 3, charges: [3, 6], desc: '当たった敵の特技を封じる。' },
  { id: 't_kanashibari', name: '金縛りの杖', cat: 'staff', price: 700, weight: 6, minFloor: 2, charges: [3, 6], desc: '当たった敵は叩かれるまで動けない。' },
  { id: 't_ikazuchi', name: '雷の杖', cat: 'staff', price: 800, weight: 6, minFloor: 2, charges: [3, 6], desc: '当たった敵に雷を落とす。' },
  { id: 't_henge', name: '変化の杖', cat: 'staff', price: 600, weight: 5, minFloor: 3, charges: [3, 6], desc: '当たった敵を別の敵に変える。' },
  { id: 't_chigiri', name: '寝返りの杖', cat: 'staff', price: 1500, weight: 3, minFloor: 2, charges: [1, 3], desc: '当たった兵を寝返らせ、この戦の味方にする（将には効かない・2体まで）。' },
  { id: 't_hikiyose', name: '引き寄せの杖', cat: 'staff', price: 500, weight: 5, minFloor: 2, charges: [3, 6], desc: '当たった敵を目の前に引き寄せる。' },
  { id: 't_itamiwake', name: '痛み分けの杖', cat: 'staff', price: 800, weight: 4, minFloor: 4, charges: [2, 5], desc: '当たった敵は、こちらが受けた打撃と同じだけ傷つく。' },
  { id: 't_kussaku', name: '掘削の杖', cat: 'staff', price: 600, weight: 5, minFloor: 2, charges: [3, 6], desc: '向いている方向の壁をまっすぐくり抜いて通路を作る。' },
  { id: 't_migawari', name: '身代わりの杖', cat: 'staff', price: 700, weight: 4, minFloor: 3, charges: [2, 5], desc: '当たった敵が身代わりになり、ほかの敵に狙われる。' },
  { id: 't_suima', name: '睡魔の杖', cat: 'staff', price: 600, weight: 6, minFloor: 2, charges: [3, 6], desc: '当たった敵を眠らせる。' },
  // ── 壺 ──
  { id: 'p_hozon', name: '保存の壺', cat: 'pot', price: 500, weight: 8, minFloor: 1, cap: [3, 5], desc: '道具をしまえる。取り出しもできる。' },
  { id: 'p_gousei', name: '合成の壺', cat: 'pot', price: 1500, weight: 3, minFloor: 3, cap: [2, 4], desc: '同じ種類の武器どうし・防具どうしを入れると1つになり、印が移る。' },
  { id: 'p_shikibetsu', name: '識別の壺', cat: 'pot', price: 800, weight: 5, minFloor: 2, cap: [3, 5], desc: '入れた道具の正体が分かる。' },
  { id: 'p_kitae', name: '鍛えの壺', cat: 'pot', price: 1200, weight: 3, minFloor: 4, cap: [2, 4], desc: '入れた武器・防具が1つ強くなる。' },
  { id: 'p_henka', name: '変化の壺', cat: 'pot', price: 600, weight: 5, minFloor: 2, cap: [3, 5], desc: '入れた道具が別の何かに変わる。' },
  { id: 'p_kankin', name: '換金の壺', cat: 'pot', price: 400, weight: 5, minFloor: 2, cap: [3, 5], desc: '入れた道具が売値のお金に変わる。' },
  { id: 'p_soko', name: '底抜けの壺', cat: 'pot', price: 300, weight: 4, minFloor: 2, cap: [3, 5], desc: '入れた物は消える。投げると割れて落とし穴ができる。' },
  // ── 食べ物 ──
  { id: 'f_onigiri', name: 'おにぎり', cat: 'food', price: 100, weight: 18, minFloor: 1, desc: '満腹度が50回復する。' },
  { id: 'f_oonigiri', name: '大きなおにぎり', cat: 'food', price: 200, weight: 6, minFloor: 2, desc: '満腹度が満タンになる。' },
  { id: 'f_kusatta', name: '腐ったおにぎり', cat: 'food', price: 10, weight: 4, minFloor: 1, desc: '満腹度が30回復するが、何かが起きる。' },
  { id: 'f_tokusei', name: '特製おにぎり', cat: 'food', price: 600, weight: 2, minFloor: 5, desc: '最大満腹度が5増え、満タンになる。' },
  { id: 'f_yaki', name: '焼きおにぎり', cat: 'food', price: 120, weight: 0, minFloor: 1, desc: '満腹度が50回復し、HP も少し回復する。' },
  // ── 矢 ──
  { id: 'r_ki', name: '木の矢', cat: 'arrow', price: 2, weight: 9, minFloor: 1, dmg: 4, desc: '装備すると「矢」で撃てる。' },
  { id: 'r_tetsu', name: '鉄の矢', cat: 'arrow', price: 4, weight: 5, minFloor: 5, dmg: 7, desc: '重い鉄の矢。' },
  { id: 'r_gin', name: '銀の矢', cat: 'arrow', price: 6, weight: 3, minFloor: 8, dmg: 5, desc: '敵を貫いて飛ぶ。' },
  // ── お金 ──
  { id: 'gold', name: '文', cat: 'gold', price: 0, weight: 0, minFloor: 1, desc: 'お金。勝つか撤退すれば本陣の蓄えになる。' },
];

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export function itemDef(id: string): ItemDef {
  const def = ITEM_BY_ID[id];
  if (!def) throw new Error(`unknown item ${id}`);
  return def;
}

/** 未識別にする種類 */
export const UNID_CATS: ItemCat[] = ['grass', 'scroll', 'staff', 'pot', 'charm'];

export const CAT_NAME: Record<ItemCat, string> = {
  weapon: '武器', armor: '防具', charm: 'お守り', grass: '草', scroll: '巻物', staff: '杖', pot: '壺', food: '食べ物', arrow: '矢', gold: 'お金',
};

/** 仮の名前の候補 */
export const FAKE_NAMES: Record<string, string[]> = {
  grass: ['赤い草', '青い草', '白い草', '黒い草', '黄色い草', '桃色の草', '紫の草', '銀の草', 'まだらの草', '縞の草', 'ねじれた草', '苦い草', '甘い草', '湿った草', '乾いた草', '細い草', '太い草', '光る草', '香る草', '棘の草'],
  scroll: ['「ヨミハ」の巻物', '「カゲロ」の巻物', '「ツムギ」の巻物', '「ホムラ」の巻物', '「ナギサ」の巻物', '「ウツロ」の巻物', '「シズク」の巻物', '「アカツキ」の巻物', '「ミナモ」の巻物', '「コダマ」の巻物', '「ハヤテ」の巻物', '「ユラギ」の巻物', '「タソガレ」の巻物', '「イブキ」の巻物', '「サザメ」の巻物', '「オボロ」の巻物', '「カスミ」の巻物', '「マドイ」の巻物', '「ヒカゲ」の巻物', '「トバリ」の巻物'],
  staff: ['桜の杖', '樫の杖', '竹の杖', '松の杖', '楓の杖', '柳の杖', '梅の杖', '杉の杖', '檜の杖', '桐の杖', '欅の杖', '椿の杖', '榊の杖', '柘植の杖', '黒檀の杖', '朴の杖'],
  pot: ['青い壺', '赤い壺', '白い壺', '黒い壺', '緑の壺', '黄色い壺', '茶色の壺', '藍色の壺', '金色の壺', '銀色の壺', '水玉の壺', '縞の壺'],
  charm: ['翡翠のお守り', '琥珀のお守り', '瑠璃のお守り', '珊瑚のお守り', '水晶のお守り', '瑪瑙のお守り', '真珠のお守り', '黒曜のお守り', '柘榴石のお守り', '月長石のお守り', '鈴のお守り', '組紐のお守り', '木彫りのお守り', '貝のお守り'],
};
