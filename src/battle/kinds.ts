// 兵種（10＋妖怪）と技。仕組みは戦国の合戦ものの定番を踏まえ、名前と数値は独自
import { SKILL_BY_ID as UNIQUE_SRC, type SkillDef as UniqueSrc } from '../content/skills';
import type { Kind, SkillDef } from './types';

export interface KindDef {
  id: Kind;
  name: string;
  /** 札の小さな字 */
  mark: string;
  /** 攻撃・防御の基本 */
  atk: number;
  def: number;
  /** 兵数の上限の倍率 */
  cap: number;
  /** 勝った時に増える兵（100人あたり） */
  gain: number;
  /** 技数の基本 */
  ap: number;
  /** 初速（小さいほど早く動く） */
  first: number;
  /** 兵1人を補充する文 */
  refill: number;
  /** 前衛向きか */
  front: boolean;
  color: string;
  /** 覚える技と、覚えるレベル */
  skills: [string, number][];
  desc: string;
}

export const KINDS: Record<Kind, KindDef> = {
  ashigaru: {
    id: 'ashigaru', name: '足軽', mark: '槍', atk: 4.5, def: 2, cap: 1.5, gain: 4, ap: 4, first: 9, refill: 1, front: true, color: '#b08a4a',
    skills: [['yari', 1], ['mamori', 1], ['yaribusuma', 5], ['sougamae', 12]],
    desc: '合戦の初めから構えていて、同じ列の味方をかばって打撃を半分にする守りの要。兵が集めやすい。',
  },
  bushi: {
    id: 'bushi', name: '武士', mark: '刀', atk: 6, def: 3, cap: 1, gain: 3, ap: 4, first: 6, refill: 4, front: true, color: '#c84a4a',
    skills: [['kirikomi', 1], ['tame', 1], ['kuzushi', 6], ['zenryoku', 10]],
    desc: '攻撃の高い前衛。構え崩しで、足軽にかばわれた相手も斬れる。反撃で兵が減りやすい。',
  },
  yumi: {
    id: 'yumi', name: '弓兵', mark: '弓', atk: 4, def: 1.5, cap: 1.5, gain: 4, ap: 4, first: 8, refill: 3, front: false, color: '#6a9a4a',
    skills: [['yumiuchi', 1], ['ashigaruNerai', 4], ['tsuyoyumi', 8], ['issha', 12]],
    desc: '後衛からどの敵でも射る。反撃を受けない。一斉射ちで敵全体を射る。',
  },
  teppo: {
    id: 'teppo', name: '鉄砲', mark: '砲', atk: 13, def: 0.4, cap: 0.7, gain: 1, ap: 2, first: 1, refill: 8, front: true, color: '#5a5e6a',
    skills: [['shageki', 1], ['hikitsuke', 1], ['kantsu', 8]],
    desc: '攻撃は最強。初弾はいちばん早いが、次の弾までが遅く、技数も少ない一発屋。守りは紙。',
  },
  kiba: {
    id: 'kiba', name: '騎馬', mark: '馬', atk: 8, def: 3, cap: 1, gain: 1.5, ap: 4, first: 4, refill: 6, front: true, color: '#a87a3a',
    skills: [['kibatotsu', 1], ['koueikuzushi', 6], ['ikioi', 9], ['oiuchi', 12]],
    desc: '前衛・後衛のどこからでも、どの敵にでも突撃できる。攻撃と速さに優れるが、反撃は受ける。',
  },
  shinobi: {
    id: 'shinobi', name: '忍者', mark: '忍', atk: 3.8, def: 1.5, cap: 0.7, gain: 3, ap: 5, first: 2, refill: 6, front: false, color: '#4a5a8a',
    skills: [['shuriken', 1], ['konoha', 1], ['shinobiansatsu', 8], ['hayashuriken', 10]],
    desc: '素早い遠距離部隊。手裏剣で敵の準備を取り消す。暗殺で小さな部隊を一気に壊滅させることも。',
  },
  gunshi: {
    id: 'gunshi', name: '軍師', mark: '扇', atk: 3.8, def: 1, cap: 1, gain: 3, ap: 3, first: 7, refill: 4, front: false, color: '#7e5ba3',
    skills: [['yumiuchi', 1], ['gunryaku', 1], ['midare', 5], ['senkakuzushi', 8]],
    desc: '合戦の初めに、味方に付与（攻・防・知・速の強化）を配る。敵の付与を外し、戦果を崩す。',
  },
  miko: {
    id: 'miko', name: '巫女', mark: '鈴', atk: 3.5, def: 1, cap: 0.7, gain: 2.5, ap: 3, first: 8, refill: 6, front: false, color: '#e07a8a',
    skills: [['mai', 1], ['yumiuchi', 1], ['kiri', 8]],
    desc: '兵を回復できる貴重な兵種。守りは弱いので後衛に。',
  },
  sohei: {
    id: 'sohei', name: '僧兵', mark: '珠', atk: 5, def: 3, cap: 1, gain: 3, ap: 4, first: 8, refill: 3, front: true, color: '#3f8060',
    skills: [['soheitotsu', 1], ['kago', 1], ['kamaeyaburi', 4], ['taisan', 7], ['enchou', 10]],
    desc: '固い前衛。突撃で敵の付与を外し、構え破りで敵全体のガードを解く。妖怪に強い。',
  },
  onmyo: {
    id: 'onmyo', name: '陰陽', mark: '符', atk: 4, def: 1, cap: 0.7, gain: 2.5, ap: 3, first: 3, refill: 6, front: false, color: '#5a3a8a',
    skills: [['shikigami', 1], ['mamorishiki', 1], ['daishiki', 12]],
    desc: '準備してから式神で敵全体を打つ（ガードを無視）。守り式神で味方を一度だけ守る。',
  },
  youkai: {
    id: 'youkai', name: '妖怪', mark: '妖', atk: 5, def: 2, cap: 1, gain: 0, ap: 4, first: 6, refill: 0, front: true, color: '#3a2a4a',
    skills: [['tsume', 1], ['kaika', 6]],
    desc: '黄泉沼から湧き出た異形の群れ。僧兵の妖退散が良く効く。',
  },
};

export const KIND_IDS = Object.keys(KINDS).filter((k) => k !== 'youkai') as Kind[];

const S = (s: SkillDef): SkillDef => s;

/** 兵種の技 */
export const BASE_SKILLS: SkillDef[] = [
  // 足軽
  S({ id: 'yari', name: '槍突き', cost: 1, range: 'near', mult: 1, counter: 0.25, stiff: 15, effect: 'dmg', physical: true, desc: '前の敵を槍で突く。', color: '#e8d8a8' }),
  S({ id: 'yaribusuma', name: '槍衾', cost: 2, range: 'near', mult: 2, counter: 0.25, stiff: 15, effect: 'dmg', physical: true, desc: '槍を揃えて突き出す。打撃2倍。', color: '#ffd08a' }),
  S({ id: 'mamori', name: '守りの構え', cost: 1, range: 'self', mult: 0, counter: 0, stiff: 20, effect: 'guard', amount: 0.2, physical: false, desc: '同じ列の味方をかばう構え。ガード率が知力に応じて上がる。', color: '#9ab0c8' }),
  S({ id: 'sougamae', name: '総構え', cost: 1, range: 'self', mult: 0, counter: 0, stiff: 20, effect: 'guardAll', amount: 0.1, physical: false, desc: '前衛・後衛のすべての味方をかばう構え。', color: '#c8d8f0' }),
  // 武士
  S({ id: 'kirikomi', name: '斬り込み', cost: 1, range: 'near', mult: 1, counter: 0.25, stiff: 15, effect: 'dmg', physical: true, desc: '前の敵に斬り込む。', color: '#ffb0a0' }),
  S({ id: 'tame', name: '気合い溜め', cost: 1, range: 'self', mult: 0, counter: 0, stiff: 5, effect: 'buffAtk', amount: 0.7, physical: false, desc: '自分に攻撃の付与（+70%）。すぐ次が動ける。', color: '#ff8a6a' }),
  S({ id: 'kuzushi', name: '構え崩し', cost: 1, range: 'near', mult: 0.8, counter: 0.05, stiff: 15, effect: 'dmg', physical: true, ignoreGuard: true, desc: '足軽のガードの半減を受けない斬撃。反撃もほとんど受けない。', color: '#ffc0a0' }),
  S({ id: 'zenryoku', name: '捨て身斬り', cost: 2, range: 'near', mult: 1.6, counter: 0.5, stiff: 20, effect: 'dmg', physical: true, desc: '全力の斬撃。打撃1.6倍だが、反撃も大きい。', color: '#ff6a4a' }),
  // 弓兵・軍師・巫女
  S({ id: 'yumiuchi', name: '弓射ち', cost: 1, range: 'far', mult: 1, counter: 0, stiff: 20, effect: 'dmg', physical: true, desc: 'どの敵でも射る。反撃を受けない。', color: '#e8d0a0' }),
  S({ id: 'ashigaruNerai', name: '足軽狙い', cost: 2, range: 'far', mult: 0.7, counter: 0, stiff: 10, effect: 'dmg', physical: true, vs: { kinds: ['ashigaru'], mult: 4.3 }, desc: '足軽に打撃3倍。硬直が短い。', color: '#d8e0a0' }),
  S({ id: 'tsuyoyumi', name: '強弓', cost: 3, range: 'far', mult: 2, counter: 0, stiff: 20, effect: 'dmg', physical: true, desc: '強く引き絞った一矢。打撃2倍。', color: '#ffe0a0' }),
  S({ id: 'issha', name: '一斉射ち', cost: 'all', range: 'all', mult: 0.5, counter: 0, stiff: 30, prep: 12, effect: 'dmg', physical: true, desc: '要準備。敵全体に矢の雨を降らせる。', color: '#fff0b0' }),
  // 鉄砲
  S({ id: 'shageki', name: '射撃', cost: 1, range: 'near', mult: 1, counter: 0, stiff: 32, effect: 'dmg', physical: true, noCounter: true, desc: '前の敵を撃つ。威力は最強だが、次の弾込めが遅い。', color: '#ffd080' }),
  S({ id: 'hikitsuke', name: '引き付け', cost: 0, range: 'self', mult: 0, counter: 0, stiff: 25, effect: 'buffAtk', amount: 0.5, physical: false, desc: '敵を引き付けて狙いを定める。攻撃の付与（+50%）。', color: '#ffe0a0' }),
  S({ id: 'kantsu', name: '貫き撃ち', cost: 1, range: 'pierce', mult: 0.6, counter: 0, stiff: 40, effect: 'dmg', physical: true, desc: '前衛と後衛をまとめて撃ち抜く。', color: '#ffc060' }),
  // 騎馬
  S({ id: 'kibatotsu', name: '騎馬突撃', cost: 1, range: 'far', mult: 1, counter: 0.25, stiff: 20, effect: 'dmg', physical: true, desc: 'どの敵にでも馬で突撃する。反撃は受ける。', color: '#e8c070' }),
  S({ id: 'koueikuzushi', name: '後衛崩し', cost: 2, range: 'far', mult: 1, counter: 0.25, stiff: 20, effect: 'dmg', physical: true, vs: { kinds: ['yumi', 'miko', 'onmyo', 'gunshi', 'teppo'], mult: 2 }, desc: '弓兵・巫女・陰陽・軍師・鉄砲に打撃2倍。', color: '#e8a050' }),
  S({ id: 'ikioi', name: '勢い付け', cost: 2, range: 'none', mult: 0, counter: 0, stiff: 15, effect: 'gauge', amount: 8, physical: false, desc: '鬨の声で戦果を8押し上げる。', color: '#ffe08a' }),
  S({ id: 'oiuchi', name: '追い討ち', cost: 'all', range: 'far', mult: 1, counter: 0, stiff: 20, effect: 'dmg', physical: true, winning: 2.5, noCounter: true, desc: '戦果で勝っている時は打撃2.5倍。反撃を受けない。', color: '#ffb040' }),
  // 忍者
  S({ id: 'shuriken', name: '手裏剣', cost: 1, range: 'far', mult: 1, counter: 0, stiff: 20, effect: 'cancel', physical: true, desc: 'どの敵でも狙える。当たると敵の準備を取り消す。', color: '#b0c0ff' }),
  S({ id: 'konoha', name: '木の葉隠れ', cost: 1, range: 'self', mult: 0, counter: 0, stiff: 20, effect: 'buffDef', amount: 0.7, physical: false, desc: '自分に防御の付与（+70%）。', color: '#90c090' }),
  S({ id: 'shinobiansatsu', name: '暗殺', cost: 'all', range: 'far', mult: 0, counter: 0, stiff: 20, effect: 'assassin', physical: false, desc: '一定の確率で敵の部隊を壊滅させる。自分より兵の多い相手には効きにくい。大将には効かない。', color: '#8a7aff' }),
  S({ id: 'hayashuriken', name: '疾風手裏剣', cost: 2, range: 'far', mult: 1, counter: 0, stiff: 3, effect: 'cancel', physical: true, desc: '硬直がいちばん短い手裏剣。準備を取り消す。', color: '#c0d0ff' }),
  // 軍師
  S({ id: 'gunryaku', name: '軍略', cost: 1, range: 'allies', mult: 0, counter: 0, stiff: 15, effect: 'buffRandom', physical: false, desc: '味方全体に付与を1つずつ（知力に応じた強さ）。', color: '#d0b0ff' }),
  S({ id: 'midare', name: '乱れの策', cost: 1, range: 'all', mult: 0, counter: 0, stiff: 10, effect: 'dispel', physical: false, desc: '敵の付与を外す。', color: '#a090ff' }),
  S({ id: 'senkakuzushi', name: '戦果崩し', cost: 1, range: 'none', mult: 0, counter: 0, stiff: 20, effect: 'gauge', amount: 7, physical: false, desc: '流言で戦果を7押し上げる。', color: '#c0a0ff' }),
  // 巫女
  S({ id: 'mai', name: '癒しの舞', cost: 1, range: 'ally', mult: 1, counter: 0, stiff: 20, effect: 'heal', physical: false, desc: '味方1部隊の兵を回復する。', color: '#c8ffd8' }),
  S({ id: 'kiri', name: '癒しの霧', cost: 2, range: 'allies', mult: 0.6, counter: 0, stiff: 30, effect: 'heal', physical: false, desc: '味方全体の兵を回復する。', color: '#a8ffd0' }),
  // 僧兵
  S({ id: 'soheitotsu', name: '僧兵突撃', cost: 1, range: 'near', mult: 1, counter: 0.3, stiff: 20, effect: 'dispel', physical: true, desc: '前の敵に突撃し、付与を1つ外す。', color: '#a0e0b0' }),
  S({ id: 'kago', name: '加護', cost: 1, range: 'self', mult: 1.6, counter: 0, stiff: 15, effect: 'heal', physical: false, desc: '自分の兵を大きく回復する。', color: '#c0ffc0' }),
  S({ id: 'kamaeyaburi', name: '構え破り', cost: 1, range: 'none', mult: 0, counter: 0, stiff: 10, effect: 'guardBreak', physical: false, desc: '敵全体のガードを解く。', color: '#e0ffe0' }),
  S({ id: 'taisan', name: '妖退散', cost: 1, range: 'near', mult: 1, counter: 0, stiff: 15, effect: 'dmg', physical: true, noCounter: true, vs: { kinds: ['youkai'], mult: 3 }, desc: '妖怪に打撃3倍。反撃を受けない。', color: '#fff8c0' }),
  S({ id: 'enchou', name: '延長', cost: 2, range: 'none', mult: 0, counter: 0, stiff: 20, effect: 'extend', amount: 10, physical: false, desc: '合戦の制限時間を10延ばす。', color: '#d0f0d0' }),
  // 陰陽
  S({ id: 'shikigami', name: '式神', cost: 1, range: 'all', mult: 0.85, counter: 0, stiff: 25, prep: 10, effect: 'dmg', physical: false, desc: '要準備。式神で敵全体を打つ。ガードを無視する。', color: '#b08aff' }),
  S({ id: 'mamorishiki', name: '守り式神', cost: 1, range: 'ally', mult: 0, counter: 0, stiff: 20, effect: 'barrier', physical: false, desc: '味方1部隊に、一度だけ打撃を防ぐ守りを付ける。', color: '#d0b8ff' }),
  S({ id: 'daishiki', name: '大式神', cost: 'all', range: 'all', mult: 1.4, counter: 0, stiff: 35, prep: 16, effect: 'dmg', physical: false, desc: '要準備（長い）。強大な式神で敵全体を打つ。', color: '#9a6aff' }),
  // 妖怪
  S({ id: 'tsume', name: '爪', cost: 1, range: 'near', mult: 1, counter: 0.3, stiff: 15, effect: 'dmg', physical: true, desc: '鋭い爪で引き裂く。', color: '#c080ff' }),
  S({ id: 'kaika', name: '怪火', cost: 2, range: 'all', mult: 0.45, counter: 0, stiff: 25, effect: 'dmg', physical: false, desc: '怪しい火で敵全体を焼く。', color: '#ff7aff' }),
];

/** 武将の固有技（content/skills.ts の定義から、合戦用に作る） */
function fromUnique(u: UniqueSrc): SkillDef {
  const big = u.cd >= 40;
  const base = { id: u.id, name: u.name, cost: (big ? 'all' : 2) as SkillDef['cost'], counter: 0, stiff: big ? 25 : 20, desc: u.desc, color: u.color, noCounter: true };
  const p = u.power;
  switch (u.kind) {
    case 'party':
      if (u.effect === 'heal') return { ...base, range: 'allies', mult: Math.max(0.6, p * 1.4), effect: 'heal', physical: false, desc: '味方全体の兵を回復する。' };
      if (u.effect === 'guard') return { ...base, range: 'allies', mult: 0, effect: 'buffDef', amount: 0.5, physical: false, desc: '味方全体に防御の付与（+50%）。' };
      if (u.effect === 'power') return { ...base, range: 'allies', mult: 0, effect: 'buffAtk', amount: Math.max(0.25, p - 1), physical: false, desc: `味方全体に攻撃の付与（+${Math.round(Math.max(0.25, p - 1) * 100)}%）。` };
      if (u.effect === 'invincible') return { ...base, range: 'allies', mult: 0, effect: 'barrier', physical: false, desc: '味方全体に、一度だけ打撃を防ぐ守りを付ける。' };
      return { ...base, range: 'allies', mult: 0, effect: 'buffSpd', amount: 0.5, physical: false, desc: '味方全体に速さの付与（+50%）。手番が早く回る。' };
    case 'turn':
      return { ...base, range: 'none', mult: 0, effect: 'gauge', amount: 12, physical: false, desc: '敵の兵を金で揺さぶり、戦果を12押し上げる。' };
    case 'line':
      return { ...base, range: 'pierce', mult: p * 0.8, effect: 'dmg', physical: true, desc: '前衛と後衛をまとめて貫く。' };
    case 'shot':
      return { ...base, range: 'far', mult: p * 0.8, effect: u.effect === 'paralyze' ? 'delay' : u.effect === 'fire' ? 'dmg' : 'dmg', amount: 12, physical: u.effect !== 'exorcise', ignoreGuard: u.effect === 'fire', vs: u.effect === 'exorcise' ? { kinds: ['youkai'], mult: 3 } : undefined, desc: u.effect === 'paralyze' ? 'どの敵でも狙い、凍えさせて手番を遅らせる。' : 'どの敵でも狙い撃つ強い一撃。' };
    case 'charge':
      return { ...base, range: 'far', mult: p * 0.9, effect: u.effect === 'paralyze' ? 'delay' : 'dmg', amount: 10, physical: true, desc: 'どの敵にでも駆け込む強い突撃。反撃を受けない。' };
    case 'single':
      return { ...base, range: 'near', mult: p * 0.9, effect: u.effect === 'drain' ? 'drain' : u.effect === 'paralyze' ? 'delay' : 'dmg', amount: 12, physical: true, desc: '前の敵に重い一撃。反撃を受けない。' };
    case 'around':
    case 'sight':
    case 'volley':
    default: {
      const eff = u.effect === 'confuse' || u.effect === 'sleep' ? 'delay' : u.effect === 'weaken' || u.effect === 'despair' ? 'weaken' : 'dmg';
      const mult = eff === 'dmg' ? p * 0.5 : eff === 'weaken' ? p * 0.3 : 0;
      return {
        ...base, range: 'all', mult, effect: eff, amount: eff === 'delay' ? 14 : 0.3, physical: u.effect !== 'fire' && u.effect !== 'exorcise' && u.effect !== 'despair',
        ignoreGuard: u.effect === 'fire', vs: u.effect === 'exorcise' ? { kinds: ['youkai'], mult: 3 } : undefined,
        desc: eff === 'delay' ? '敵全体を惑わせ、手番を遅らせる。' : eff === 'weaken' ? '敵全体を打ち、攻撃を下げる。' : '敵全体を打つ。',
      };
    }
  }
}

export const SKILL_TABLE: Record<string, SkillDef> = Object.fromEntries([
  ...Object.values(UNIQUE_SRC).map((u) => [u.id, fromUnique(u)] as const),
  ...BASE_SKILLS.map((s) => [s.id, s] as const),
]);

// 兵種の技と固有技の ID は重ならないこと
for (const s of BASE_SKILLS) if (UNIQUE_SRC[s.id]) throw new Error(`skill id conflict ${s.id}`);

export function battleSkill(id: string): SkillDef {
  const s = SKILL_TABLE[id];
  if (!s) throw new Error(`unknown battle skill ${id}`);
  return s;
}

/** 兵種の技のうち、そのレベルで使えるもの */
export function kindSkills(kind: Kind, lv: number): string[] {
  return KINDS[kind].skills.filter(([, min]) => lv >= min).map(([id]) => id);
}

export const RANGE_NAME: Record<SkillDef['range'], string> = {
  near: '近', far: '遠', pierce: '貫', all: '全', ally: '味方', allies: '味方全', self: '自分', none: '―',
};
