// 兵種（10＋妖怪）と技。数値は戦国の部隊合戦の定番（兵種の攻防・遅れ、技の消費・硬直・倍率・反撃率）に合わせる
import { SKILL_BY_ID as UNIQUE_SRC } from '../content/skills';
import type { Anim, Kind, SkillDef } from './types';

export interface KindDef {
  id: Kind;
  name: string;
  /** 札の小さな字 */
  mark: string;
  /** 兵種の攻撃・防御（打撃の式に入る） */
  atk: number;
  def: number;
  /** 術の攻撃（陰陽） */
  mag: number;
  /** 遅れ（小さいほど手番が早く回る） */
  delay: number;
  /** 兵数の上限の倍率 */
  cap: number;
  /** 増員費（兵10人あたりの文） */
  hire: number;
  /** 補充費（傷ついた兵10人を戻す文） */
  heal: number;
  /** 勝った時に増える兵（10人単位） */
  gain: number;
  /** 技数の基本 */
  ap: number;
  /** 受けた打撃に反撃できるか */
  counter: boolean;
  /** 陣立てで前衛に置くか */
  front: boolean;
  color: string;
  /** 覚える技：[技, 覚えるレベル, 置き換える技] */
  skills: [string, number, string?][];
  desc: string;
}

export const KINDS: Record<Kind, KindDef> = {
  ashigaru: {
    id: 'ashigaru', name: '足軽', mark: '槍', atk: 4.5, def: 2, mag: 0, delay: 11, cap: 1.5, hire: 24, heal: 1, gain: 15, ap: 4, counter: true, front: true, color: '#b08a4a',
    skills: [['a_atk', 1], ['a_guard', 1], ['a_yari', 5], ['a_guardAll', 9], ['a_atk2', 14, 'a_atk'], ['a_guard2', 18, 'a_guard'], ['a_yari2', 24, 'a_yari']],
    desc: '守りの要。合戦の初めからガード50%で、同じ列の味方をかばって物理の打撃を半分にする。かばうたびにガード率は40%下がる。兵が安く多く集まる。前衛からしか攻撃できない。',
  },
  bushi: {
    id: 'bushi', name: '武士', mark: '刀', atk: 6, def: 3, mag: 0, delay: 12, cap: 1, hire: 48, heal: 4, gain: 10, ap: 4, counter: true, front: true, color: '#c84a4a',
    skills: [['b_atk', 1], ['b_tame', 1], ['b_kuzushi', 6], ['b_tekagen', 8], ['b_zenryoku', 10], ['b_atk2', 13, 'b_atk'], ['b_ukai', 15], ['b_zenryoku2', 22, 'b_zenryoku']],
    desc: '攻撃の高い主力。前衛からしか攻撃できない。反撃で兵が減りやすい。ガード崩しなら足軽の半減を受けない。手加減突撃を当てた将は必ず捕らえられる。',
  },
  yumi: {
    id: 'yumi', name: '弓兵', mark: '弓', atk: 4, def: 1.5, mag: 0, delay: 15, cap: 1.5, hire: 36, heal: 4, gain: 15, ap: 4, counter: false, front: false, color: '#6a9a4a',
    skills: [['y_atk', 1], ['y_nerai', 5], ['y_kyou', 9], ['y_issei0', 12], ['y_atk2', 16, 'y_atk'], ['y_issei', 22, 'y_issei0']],
    desc: '前後どちらの列からでも、どの敵でも射る。反撃を受けない。一斉射撃で敵全体に矢の雨。兵が集めやすい。',
  },
  teppo: {
    id: 'teppo', name: '鉄砲', mark: '砲', atk: 13, def: 0, mag: 0, delay: 8, cap: 0.7, hire: 120, heal: 4, gain: 5, ap: 2, counter: false, front: true, color: '#5a5e6a',
    skills: [['t_shot', 1], ['t_hiki', 1], ['t_kantsu', 8], ['t_kantsu2', 18, 't_kantsu']],
    desc: '攻撃は最強で初弾も早いが、次の弾までが長く、技数も少ない一発屋。前衛からしか撃てない。守りは紙。',
  },
  kiba: {
    id: 'kiba', name: '騎馬', mark: '馬', atk: 8, def: 3, mag: 0, delay: 10, cap: 1, hire: 60, heal: 4, gain: 5, ap: 5, counter: true, front: true, color: '#a87a3a',
    skills: [['k_atk', 1], ['k_senka', 5], ['k_kouei', 8], ['k_tosshin', 11], ['k_atk2', 14, 'k_atk'], ['k_oiuchi', 15], ['k_senka2', 20, 'k_senka']],
    desc: '前後どちらの列からでも、どの敵にでも突撃できる（反撃は受ける）。攻撃・速さ・射程に優れる。',
  },
  shinobi: {
    id: 'shinobi', name: '忍者', mark: '忍', atk: 3.8, def: 1.5, mag: 0, delay: 6, cap: 0.7, hire: 60, heal: 4, gain: 10, ap: 5, counter: true, front: false, color: '#4a5a8a',
    skills: [['s_shuri', 1], ['s_konoha', 1], ['s_jinchi', 6], ['s_ansatsu', 10], ['s_hayate', 14], ['s_shuri2', 16, 's_shuri'], ['s_ansatsu2', 22, 's_ansatsu']],
    desc: 'とても素早い遠距離部隊。手裏剣が当たると敵の準備を崩す。暗殺で部隊を一気に壊滅させることも。遠距離でも反撃はできる。',
  },
  gunshi: {
    id: 'gunshi', name: '軍師', mark: '扇', atk: 3.8, def: 1, mag: 0, delay: 20, cap: 1, hire: 48, heal: 4, gain: 10, ap: 3, counter: false, front: false, color: '#7e5ba3',
    skills: [['y_atk', 1], ['g_tac', 1], ['g_kaijo', 5], ['g_down', 8], ['g_jikan', 12], ['g_tac2', 14, 'g_tac'], ['g_down2', 18, 'g_down'], ['g_tac3', 22, 'g_tac2']],
    desc: '合戦の初めに、知の数だけ味方へ付与（攻・防・知・速、知×5%）を配る。状態解除で敵の付与を消し、戦果や時間を動かす。',
  },
  miko: {
    id: 'miko', name: '巫女', mark: '鈴', atk: 3.5, def: 1, mag: 0, delay: 16, cap: 0.7, hire: 72, heal: 4, gain: 8, ap: 3, counter: false, front: false, color: '#e07a8a',
    skills: [['m_mai', 1], ['y_atk', 1], ['m_kiri', 8], ['m_mai2', 12, 'm_mai'], ['m_kaze', 18], ['m_arashi', 22]],
    desc: '兵を回復できる貴重な兵種（回復は戦果に入らない）。守りが弱いので後衛に。',
  },
  sohei: {
    id: 'sohei', name: '僧兵', mark: '珠', atk: 5, def: 3, mag: 0, delay: 20, cap: 1, hire: 36, heal: 0, gain: 10, ap: 4, counter: true, front: true, color: '#3f8060',
    skills: [['h_totsu', 1], ['h_kago', 1], ['h_kaijo', 5], ['h_taisan', 8], ['h_enchou', 12], ['h_totsu2', 16, 'h_totsu'], ['h_enchou2', 22, 'h_enchou']],
    desc: '固い前衛。僧兵突撃で敵の付与を1つ外し、ガード解除で敵全体のガードを0にする。延長戦で時間を戻す。季節ごとに兵がすべて戻る。遅い。',
  },
  onmyo: {
    id: 'onmyo', name: '陰陽', mark: '符', atk: 3.5, def: 1, mag: 4, delay: 8, cap: 0.7, hire: 60, heal: 4, gain: 8, ap: 3, counter: false, front: false, color: '#5a3a8a',
    skills: [['o_shiki', 1], ['o_bougyo', 1], ['o_oni', 6], ['o_shiki2', 14, 'o_shiki'], ['o_joukyu', 18], ['o_zenbou', 22]],
    desc: '準備してから式神で敵全体を打つ（ガードを無視、知で計算）。準備中に手裏剣を受けると崩れる。防御式神はどんな攻撃も一度だけ防ぐ。初動は早い。',
  },
  youkai: {
    id: 'youkai', name: '妖怪', mark: '妖', atk: 5, def: 2.5, mag: 3, delay: 11, cap: 1, hire: 0, heal: 0, gain: 0, ap: 3, counter: true, front: true, color: '#3a2a4a',
    skills: [['y_tsume', 1], ['y_kaika', 6]],
    desc: '黄泉沼から湧き出た異形の群れ。僧兵の妖怪退散がよく効く。',
  },
};

export const KIND_IDS = Object.keys(KINDS).filter((k) => k !== 'youkai') as Kind[];

const S = (s: Omit<SkillDef, 'anim'> & { anim?: Anim }): SkillDef => ({ anim: 'melee', ...s });

/** 兵種の技（一般的な呼び名） */
export const BASE_SKILLS: SkillDef[] = [
  // 足軽
  S({ id: 'a_atk', name: '足軽攻撃', cost: 1, range: 'near', mult: 1, counter: 0.25, stiff: 15, effect: 'dmg', anim: 'spear', desc: '前の敵を槍で突く。', color: '#e8d8a8' }),
  S({ id: 'a_atk2', name: '足軽攻撃・改', cost: 1, range: 'near', mult: 1.2, counter: 0.25, stiff: 15, effect: 'dmg', anim: 'spear', desc: '鍛えた槍で突く。打撃1.2倍。', color: '#f0e0b0' }),
  S({ id: 'a_yari', name: '槍衾', cost: 2, range: 'near', mult: 2, counter: 0.25, stiff: 15, effect: 'dmg', anim: 'spear', desc: '槍を揃えて突き出す。打撃2倍。', color: '#ffd08a' }),
  S({ id: 'a_yari2', name: '槍衾・改', cost: 3, range: 'near', mult: 3, counter: 0.25, stiff: 15, effect: 'dmg', anim: 'spear', desc: '三段構えの槍衾。打撃3倍。', color: '#ffc06a' }),
  S({ id: 'a_guard', name: '味方ガード', cost: 1, range: 'self', mult: 0, counter: 0, stiff: 20, effect: 'guard', amount: 0.2, anim: 'guard', desc: '同じ列の味方をかばう構え。ガード率が知×20%上がる。', color: '#9ab0c8' }),
  S({ id: 'a_guard2', name: '味方ガード・改', cost: 1, range: 'self', mult: 0, counter: 0, stiff: 20, effect: 'guard', amount: 0.3, anim: 'guard', desc: '同じ列の味方をかばう構え。ガード率が知×30%上がる。', color: '#b0c8e0' }),
  S({ id: 'a_guardAll', name: '全体ガード', cost: 1, range: 'self', mult: 0, counter: 0, stiff: 20, effect: 'guardAll', amount: 0.1, anim: 'guard', desc: '前衛・後衛すべての味方をかばう構え。ガード率が知×10%上がる。', color: '#c8d8f0' }),
  // 武士
  S({ id: 'b_atk', name: '武士攻撃', cost: 1, range: 'near', mult: 1, counter: 0.25, stiff: 15, effect: 'dmg', desc: '前の敵に斬り込む。', color: '#ffb0a0' }),
  S({ id: 'b_atk2', name: '武士攻撃・改', cost: 1, range: 'near', mult: 1.1, counter: 0.25, stiff: 15, effect: 'dmg', desc: '鋭く斬り込む。打撃1.1倍。', color: '#ffc0b0' }),
  S({ id: 'b_tame', name: '力をためる', cost: 1, range: 'self', mult: 0, counter: 0, stiff: 5, effect: 'buffAtk', amount: 0.7, anim: 'buff', desc: '自分に攻付与70%。硬直がとても短い。', color: '#ff8a6a' }),
  S({ id: 'b_kuzushi', name: 'ガード崩し', cost: 1, range: 'near', mult: 0.8, counter: 0.05, stiff: 15, effect: 'dmg', ignoreGuard: true, desc: '足軽のガードの半減を受けない。反撃もほとんど受けない。', color: '#ffc0a0' }),
  S({ id: 'b_zenryoku', name: '全力攻撃', cost: 2, range: 'near', mult: 1.5, counter: 0.5, stiff: 20, effect: 'dmg', desc: '打撃1.5倍。そのぶん反撃も大きい。', color: '#ff6a4a' }),
  S({ id: 'b_zenryoku2', name: '全力攻撃・改', cost: 2, range: 'near', mult: 2, counter: 0.5, stiff: 20, effect: 'dmg', desc: '打撃2倍。そのぶん反撃も大きい。', color: '#ff4a2a' }),
  S({ id: 'b_ukai', name: '迂回突撃', cost: 2, range: 'near', mult: 1, counter: 0, stiff: 20, effect: 'dmg', anim: 'charge', desc: '横から回り込んで突く。反撃を受けない。', color: '#ffd0a0' }),
  S({ id: 'b_tekagen', name: '手加減突撃', cost: 2, range: 'near', mult: 0.2, counter: 0.2, stiff: 20, effect: 'mercy', desc: '打撃は小さいが、当てた将は合戦に勝てば必ず捕らえられる。', color: '#e0e0ff' }),
  // 弓兵（軍師・巫女も弓攻撃を使う）
  S({ id: 'y_atk', name: '弓攻撃', cost: 1, range: 'far', mult: 1, counter: 0, stiff: 20, effect: 'dmg', anim: 'arrow', desc: 'どの敵でも射る。反撃を受けない。', color: '#e8d0a0' }),
  S({ id: 'y_atk2', name: '弓攻撃・改', cost: 1, range: 'far', mult: 1.1, counter: 0, stiff: 20, effect: 'dmg', anim: 'arrow', desc: 'どの敵でも射る。打撃1.1倍。', color: '#f0e0b0' }),
  S({ id: 'y_nerai', name: '足軽狙い', cost: 2, range: 'far', mult: 0.7, counter: 0, stiff: 10, effect: 'dmg', anim: 'arrow', vs: { kinds: ['ashigaru'], mult: 3 / 0.7 }, desc: '足軽に打撃3倍（他には0.7倍）。硬直がやや短い。', color: '#d8e0a0' }),
  S({ id: 'y_kyou', name: '強化弓攻撃', cost: 3, range: 'far', mult: 2, counter: 0, stiff: 20, effect: 'dmg', anim: 'arrow', desc: '強く引き絞った一矢。打撃2倍。', color: '#ffe0a0' }),
  S({ id: 'y_issei0', name: '未熟一斉射撃', cost: 'all', range: 'all', mult: 0.4, counter: 0, stiff: 30, prep: 18, effect: 'dmg', anim: 'volley', desc: '要準備（長い）。敵全体に矢の雨。', color: '#fff0b0' }),
  S({ id: 'y_issei', name: '一斉射撃', cost: 'all', range: 'all', mult: 0.5, counter: 0, stiff: 25, effect: 'dmg', anim: 'volley', desc: '敵全体に矢の雨。準備は要らない。', color: '#fff4c0' }),
  // 鉄砲
  S({ id: 't_shot', name: '射撃', cost: 1, range: 'near', mult: 1, counter: 0, stiff: 30, effect: 'dmg', anim: 'gun', desc: '前の敵を撃つ。威力は最強だが、次の弾込めが遅い。', color: '#ffd080' }),
  S({ id: 't_hiki', name: '引き付け', cost: 0, range: 'self', mult: 0, counter: 0, stiff: 25, effect: 'buffAtk', amount: 0.5, anim: 'buff', desc: '技数を使わずに狙いを定める。自分に攻付与50%。', color: '#ffe0a0' }),
  S({ id: 't_kantsu', name: '貫通射撃', cost: 1, range: 'pierce', mult: 0.5, counter: 0, stiff: 40, effect: 'dmg', anim: 'gun', desc: '前衛と後衛をまとめて撃ち抜く（0.5倍）。硬直が長い。', color: '#ffc060' }),
  S({ id: 't_kantsu2', name: '貫通射撃・改', cost: 2, range: 'pierce', mult: 0.7, counter: 0, stiff: 40, effect: 'dmg', anim: 'gun', desc: '前衛と後衛をまとめて撃ち抜く（0.7倍）。', color: '#ffb040' }),
  // 騎馬
  S({ id: 'k_atk', name: '騎馬突撃', cost: 1, range: 'far', mult: 1, counter: 0.25, stiff: 20, effect: 'dmg', anim: 'charge', desc: 'どの敵にでも馬で突撃する。反撃は受ける。', color: '#e8c070' }),
  S({ id: 'k_atk2', name: '騎馬突撃・改', cost: 1, range: 'far', mult: 1.1, counter: 0.25, stiff: 20, effect: 'dmg', anim: 'charge', desc: 'どの敵にでも突撃する。打撃1.1倍。', color: '#f0d080' }),
  S({ id: 'k_senka', name: '戦果アップ', cost: 2, range: 'none', mult: 0, counter: 0, stiff: 15, effect: 'gauge', amount: 8, anim: 'shout', desc: '鬨の声で戦果を8上げる。', color: '#ffe08a' }),
  S({ id: 'k_senka2', name: '戦果アップ・改', cost: 2, range: 'none', mult: 0, counter: 0, stiff: 15, effect: 'gauge', amount: 15, anim: 'shout', desc: '戦果を15上げる。', color: '#fff0a0' }),
  S({ id: 'k_kouei', name: '後衛潰し', cost: 2, range: 'far', mult: 1, counter: 0.25, stiff: 20, effect: 'dmg', anim: 'charge', vs: { kinds: ['miko', 'onmyo', 'yumi', 'gunshi'], mult: 2 }, desc: '巫女・陰陽・弓兵・軍師に打撃2倍。', color: '#e8a050' }),
  S({ id: 'k_tosshin', name: '突進', cost: 2, range: 'far', mult: 1.3, counter: 0.25, stiff: 20, effect: 'drainAp', anim: 'charge', desc: '打撃1.3倍。相手の技数を1減らす。', color: '#f0b060' }),
  S({ id: 'k_oiuchi', name: '追い討ち', cost: 'all', range: 'far', mult: 1, counter: 0, stiff: 20, effect: 'dmg', anim: 'charge', winning: 3, desc: '戦果で勝っている時は打撃3倍。反撃を受けない。', color: '#ffb040' }),
  // 忍者
  S({ id: 's_shuri', name: '手裏剣', cost: 1, range: 'far', mult: 1, counter: 0, stiff: 20, effect: 'cancel', anim: 'shuriken', desc: 'どの敵でも狙える。当たると敵の準備を崩す。', color: '#b0c0ff' }),
  S({ id: 's_shuri2', name: '手裏剣・改', cost: 1, range: 'far', mult: 1.1, counter: 0, stiff: 20, effect: 'cancel', anim: 'shuriken', desc: '打撃1.1倍。当たると準備を崩す。', color: '#c0d0ff' }),
  S({ id: 's_hayate', name: '疾風手裏剣', cost: 2, range: 'far', mult: 1, counter: 0, stiff: 2, effect: 'cancel', anim: 'shuriken', desc: '硬直がいちばん短い手裏剣。準備を崩す。', color: '#d0e0ff' }),
  S({ id: 's_konoha', name: '木の葉隠れ', cost: 1, range: 'self', mult: 0, counter: 0, stiff: 20, effect: 'buffDef', amount: 0.7, anim: 'buff', desc: '自分に防付与70%。', color: '#90c090' }),
  S({ id: 's_jinchi', name: '陣地構築', cost: 1, range: 'none', mult: 0, counter: 0, stiff: 10, effect: 'field', amount: 0.06, anim: 'buff', desc: '味方の戦場補正を+6%（最大50%）。', color: '#a0c890' }),
  S({ id: 's_ansatsu', name: '暗殺', cost: 'all', range: 'far', mult: 0, counter: 0, stiff: 25, effect: 'assassin', amount: 0.75, anim: 'shuriken', desc: '一定の確率で敵の部隊を壊滅させる。相手の兵が多いと決まりにくい。大将には効かない。', color: '#8a7aff' }),
  S({ id: 's_ansatsu2', name: '暗殺・改', cost: 'all', range: 'far', mult: 0, counter: 0, stiff: 25, effect: 'assassin', amount: 0.83, anim: 'shuriken', desc: '高い確率で敵の部隊を壊滅させる。', color: '#7a6aff' }),
  // 軍師
  S({ id: 'g_tac', name: '合戦戦術', cost: 1, range: 'allies', mult: 0, counter: 0, stiff: 15, effect: 'tactics', amount: 300, anim: 'buff', desc: '味方に（2＋兵数÷300）個の付与を配る（知×5%）。', color: '#d0b0ff' }),
  S({ id: 'g_tac2', name: '合戦戦術・乙', cost: 1, range: 'allies', mult: 0, counter: 0, stiff: 15, effect: 'tactics', amount: 200, anim: 'buff', desc: '味方に（2＋兵数÷200）個の付与を配る。', color: '#d8c0ff' }),
  S({ id: 'g_tac3', name: '合戦戦術・甲', cost: 1, range: 'allies', mult: 0, counter: 0, stiff: 15, effect: 'tactics', amount: 100, anim: 'buff', desc: '味方に（2＋兵数÷100）個の付与を配る。', color: '#e0d0ff' }),
  S({ id: 'g_kaijo', name: '状態解除', cost: 1, range: 'all', mult: 0, counter: 0, stiff: 10, effect: 'dispel', amount: 2, anim: 'magic', desc: '敵の2部隊の付与を外す。', color: '#a090ff' }),
  S({ id: 'g_down', name: '戦果ダウン', cost: 1, range: 'none', mult: 0, counter: 0, stiff: 20, effect: 'gauge', amount: 5, anim: 'shout', desc: '流言で敵の戦果を5下げる。', color: '#c0a0ff' }),
  S({ id: 'g_down2', name: '戦果ダウン・改', cost: 1, range: 'none', mult: 0, counter: 0, stiff: 20, effect: 'gauge', amount: 10, anim: 'shout', desc: '敵の戦果を10下げる。', color: '#c8b0ff' }),
  S({ id: 'g_jikan', name: '時間経過', cost: 1, range: 'none', mult: 0, counter: 0, stiff: 20, effect: 'time', amount: -2, anim: 'magic', desc: '時間の目盛りを2減らす。戦果で勝っている時に。', color: '#b0a0e0' }),
  // 巫女
  S({ id: 'm_mai', name: '巫女の舞', cost: 1, range: 'ally', mult: 0.5, counter: 0, stiff: 20, effect: 'heal', anim: 'heal', desc: '味方1部隊の兵を回復する。', color: '#c8ffd8' }),
  S({ id: 'm_mai2', name: '巫女の舞・改', cost: 1, range: 'ally', mult: 1, counter: 0, stiff: 20, effect: 'heal', anim: 'heal', desc: '味方1部隊の兵を大きく回復する。', color: '#d8ffe0' }),
  S({ id: 'm_kiri', name: '治癒の霧', cost: 2, range: 'allies', mult: 0.5, counter: 0, stiff: 30, effect: 'heal', anim: 'heal', desc: '味方全体の兵を回復する。', color: '#a8ffd0' }),
  S({ id: 'm_kaze', name: '風の舞', cost: 1, range: 'ally', mult: 1, counter: 0, stiff: 5, effect: 'heal', anim: 'heal', desc: '味方1部隊を回復する。硬直がとても短い。', color: '#c0fff0' }),
  S({ id: 'm_arashi', name: '祓いの嵐', cost: 'all', range: 'all', mult: 0, counter: 0, stiff: 5, prep: 6, effect: 'ratio', amount: 0.1, anim: 'magic', desc: '要準備（短い）。敵全体に、それぞれの最大兵数の1割の打撃（軽減できない）。', color: '#ffe0f0' }),
  // 僧兵
  S({ id: 'h_totsu', name: '僧兵突撃', cost: 1, range: 'near', mult: 1, counter: 0.3, stiff: 20, effect: 'dispel', amount: 1, desc: '前の敵に突撃し、付与を1つ外す。', color: '#a0e0b0' }),
  S({ id: 'h_totsu2', name: '僧兵突撃・改', cost: 1, range: 'near', mult: 1.2, counter: 0.3, stiff: 20, effect: 'dispel', amount: 1, desc: '打撃1.2倍。付与を1つ外す。', color: '#b0f0c0' }),
  S({ id: 'h_kago', name: '加護', cost: 1, range: 'self', mult: 2, counter: 0, stiff: 15, effect: 'heal', anim: 'heal', desc: '自分の兵を大きく回復する。', color: '#c0ffc0' }),
  S({ id: 'h_kaijo', name: 'ガード解除', cost: 1, range: 'all', mult: 0, counter: 0, stiff: 10, effect: 'guardBreak', anim: 'shout', desc: '敵全体のガード率を0%にする。', color: '#e0ffe0' }),
  S({ id: 'h_taisan', name: '妖怪退散', cost: 1, range: 'near', mult: 1, counter: 0, stiff: 15, effect: 'dmg', vs: { kinds: ['youkai'], mult: 3 }, desc: '妖怪に打撃3倍。反撃を受けない。', color: '#fff8c0' }),
  S({ id: 'h_enchou', name: '延長戦', cost: 2, range: 'none', mult: 0, counter: 0, stiff: 20, effect: 'time', amount: 4, anim: 'shout', desc: '時間の目盛りを4戻す。', color: '#d0f0d0' }),
  S({ id: 'h_enchou2', name: '延長戦・改', cost: 2, range: 'none', mult: 0, counter: 0, stiff: 20, effect: 'time', amount: 6, anim: 'shout', desc: '時間の目盛りを6戻す。', color: '#e0ffe0' }),
  // 陰陽
  S({ id: 'o_shiki', name: '式神', cost: 1, range: 'all', mult: 1, counter: 0, stiff: 25, prep: 10, effect: 'dmg', magic: true, anim: 'shiki', desc: '要準備。式神で敵全体を打つ（ガードを無視）。', color: '#b08aff' }),
  S({ id: 'o_shiki2', name: '式神・改', cost: 1, range: 'all', mult: 1.1, counter: 0, stiff: 25, prep: 10, effect: 'dmg', magic: true, anim: 'shiki', desc: '要準備。打撃1.1倍。', color: '#c09aff' }),
  S({ id: 'o_joukyu', name: '上級式神', cost: 'all', range: 'all', mult: 1.5, counter: 0, stiff: 35, prep: 18, effect: 'dmg', magic: true, anim: 'shiki', desc: '要準備（長い）。強大な式神で敵全体を打つ。', color: '#9a6aff' }),
  S({ id: 'o_oni', name: '鬼を召喚', cost: 1, range: 'far', mult: 0.5, counter: 0, stiff: 20, effect: 'dmg', magic: true, anim: 'magic', desc: '鬼を呼んで1部隊を打つ。準備は要らない。', color: '#c07aff' }),
  S({ id: 'o_bougyo', name: '防御式神', cost: 1, range: 'ally', mult: 0, counter: 0, stiff: 20, effect: 'barrier', anim: 'magic', desc: '味方1部隊に、どんな攻撃も一度だけ防ぐ守りを付ける。', color: '#d0b8ff' }),
  S({ id: 'o_zenbou', name: '全体防御式神', cost: 'all', range: 'allies', mult: 0, counter: 0, stiff: 25, effect: 'barrier', anim: 'magic', desc: '味方全体に、一度だけ防ぐ守りを付ける。', color: '#e0c8ff' }),
  // 妖怪
  S({ id: 'y_tsume', name: '爪', cost: 1, range: 'near', mult: 1, counter: 0.3, stiff: 15, effect: 'dmg', anim: 'claw', desc: '鋭い爪で引き裂く。', color: '#c080ff' }),
  S({ id: 'y_kaika', name: '怪火', cost: 2, range: 'all', mult: 0.5, counter: 0, stiff: 25, effect: 'dmg', magic: true, anim: 'magic', desc: '怪しい火で敵全体を焼く。', color: '#ff7aff' }),
];

/** 武将の固有技（合戦用）。名前・色は content/skills.ts のもの */
type U = Omit<SkillDef, 'id' | 'name' | 'color' | 'anim' | 'desc'> & { anim?: Anim; desc: string };
const UNIQUE: Record<string, U> = {
  // 暁ノ家
  issen: { cost: 'all', range: 'near', mult: 1.6, counter: 0, stiff: 20, effect: 'dmg', anim: 'charge', desc: '武将みずから斬り込む居合。打撃1.6倍、反撃を受けない。' },
  kyouzaki: { cost: 2, range: 'allies', mult: 0, counter: 0, stiff: 20, effect: 'buffAtk', amount: 0.5, anim: 'shout', desc: '味方全体に攻付与50%。' },
  harai: { cost: 2, range: 'allies', mult: 0.7, counter: 0, stiff: 25, effect: 'heal', anim: 'heal', desc: '味方全体の兵を回復する。' },
  kanagi: { cost: 2, range: 'all', mult: 0.6, counter: 0, stiff: 25, effect: 'dmg', magic: true, vs: { kinds: ['youkai'], mult: 3 }, anim: 'magic', desc: '神威で敵全体を薙ぐ。妖怪に3倍。' },
  sakubou: { cost: 1, range: 'none', mult: 0, counter: 0, stiff: 15, effect: 'gauge', amount: 10, anim: 'shout', desc: '策で敵の戦果を10下げる。' },
  kobu: { cost: 2, range: 'allies', mult: 0, counter: 0, stiff: 20, effect: 'tactics', amount: 80, anim: 'shout', desc: '味方に（2＋兵数÷80）個の付与を配る。' },
  teppeki: { cost: 1, range: 'self', mult: 0, counter: 0, stiff: 15, effect: 'guardAll', amount: 0.25, anim: 'guard', desc: '全員をかばう構え。ガード率が知×25%上がる。' },
  konshin: { cost: 'all', range: 'near', mult: 2, counter: 0.25, stiff: 20, effect: 'dmg', anim: 'spear', desc: '渾身の槍。打撃2倍。' },
  // 黒鉄家
  tetsuyari: { cost: 2, range: 'pierce', mult: 1, counter: 0, stiff: 20, effect: 'dmg', anim: 'spear', desc: '鉄槍で前衛と後衛をまとめて貫く。' },
  kokkou: { cost: 2, range: 'allies', mult: 0, counter: 0, stiff: 20, effect: 'buffDef', amount: 0.5, anim: 'guard', desc: '味方全体に防付与50%。' },
  isseisha: { cost: 'all', range: 'all', mult: 0.6, counter: 0, stiff: 30, effect: 'dmg', anim: 'gun', anyRow: true, desc: '敵全体に鉄砲を撃ちかける。後衛からも撃てる。' },
  sogeki: { cost: 2, range: 'far', mult: 1.2, counter: 0, stiff: 30, effect: 'cancel', anim: 'gun', desc: '遠くの1部隊を狙い撃つ。後衛にも届き、準備を崩す。' },
  raijin: { cost: 'all', range: 'all', mult: 0.7, counter: 0, stiff: 25, effect: 'dmg', magic: true, anim: 'magic', desc: '雷を呼んで敵全体を打つ。' },
  gouda: { cost: 2, range: 'near', mult: 1.4, counter: 0.25, stiff: 20, effect: 'drainAp', desc: '力任せに打ちすえ、相手の技数を1減らす。' },
  // 紫苑家
  sandan: { cost: 2, range: 'allies', mult: 0.6, counter: 0, stiff: 25, effect: 'heal', anim: 'heal', desc: '兵糧を配り、味方全体の兵を回復する。' },
  baishuu: { cost: 'all', range: 'none', mult: 0, counter: 0, stiff: 20, effect: 'gauge', amount: 20, anim: 'shout', desc: '金で敵を揺さぶり、敵の戦果を20下げる。' },
  kairikutachi: { cost: 2, range: 'pierce', mult: 1, counter: 0.25, stiff: 20, effect: 'dmg', desc: '大太刀で前衛と後衛をまとめて薙ぐ。' },
  ryakudatsu: { cost: 1, range: 'near', mult: 0.8, counter: 0.4, stiff: 20, effect: 'drain', desc: '斬りつけ、与えた打撃の半分だけ兵を奪う。' },
  sakuryaku: { cost: 1, range: 'all', mult: 0, counter: 0, stiff: 10, effect: 'dispel', amount: 4, anim: 'magic', desc: '敵の4部隊の付与を外す。' },
  chouhatsu: { cost: 1, range: 'none', mult: 0, counter: 0, stiff: 20, effect: 'time', amount: -4, anim: 'shout', desc: '時間の目盛りを4減らす。' },
  // 白鷺家
  hyouga: { cost: 2, range: 'far', mult: 1.2, counter: 0, stiff: 20, effect: 'drainAp', anim: 'charge', desc: 'どの敵にでも駆け込み、凍らせて技数を1減らす。' },
  shinsoku: { cost: 2, range: 'allies', mult: 0, counter: 0, stiff: 15, effect: 'buffSpd', amount: 0.5, anim: 'buff', desc: '味方全体に速付与。手番が早く回る。' },
  sanya: { cost: 2, range: 'all', mult: 0.55, counter: 0, stiff: 20, effect: 'dmg', anim: 'volley', desc: '準備なしで敵全体に矢を射る。' },
  yougan: { cost: 1, range: 'far', mult: 1.4, counter: 0, stiff: 15, effect: 'cancel', anim: 'arrow', desc: '弱点を見抜いた一矢。打撃1.4倍、準備を崩す。' },
  totsugeki: { cost: 'all', range: 'far', mult: 1.8, counter: 0, stiff: 20, effect: 'dmg', anim: 'charge', desc: '武将みずから先頭で駆ける突撃。打撃1.8倍、反撃を受けない。' },
  yukigake: { cost: 2, range: 'far', mult: 1.3, counter: 0.25, stiff: 20, effect: 'drainAp', anim: 'charge', desc: '雪煙を上げて駆け、相手の技数を1減らす。' },
  // 焔ノ家
  kaenjin: { cost: 1, range: 'all', mult: 1, counter: 0, stiff: 15, prep: 6, prepGuard: 2, effect: 'dmg', magic: true, anim: 'magic', desc: '要準備（短い・崩すには2回当てる）。炎で敵全体を焼く。' },
  shinka: { cost: 2, range: 'allies', mult: 1, counter: 0, stiff: 25, effect: 'heal', anim: 'heal', desc: '神火の加護で味方全体の兵を大きく回復する。' },
  hiyari: { cost: 2, range: 'pierce', mult: 0.8, counter: 0, stiff: 30, effect: 'dmg', anim: 'gun', ignoreGuard: true, desc: '火槍の炎で前衛と後衛を焼き貫く。ガードの半減を受けない。' },
  honoonagi: { cost: 'all', range: 'all', mult: 0.7, counter: 0, stiff: 25, effect: 'dmg', magic: true, anim: 'magic', anyRow: true, desc: '炎をまとって敵全体を薙ぐ。' },
  // 蓮華院
  kekkai: { cost: 'all', range: 'allies', mult: 0, counter: 0, stiff: 25, effect: 'barrier', anim: 'magic', desc: '味方全体に、一度だけ防ぐ守りを付ける。' },
  jouka: { cost: 1, range: 'far', mult: 1, counter: 0, stiff: 20, effect: 'dmg', magic: true, vs: { kinds: ['youkai'], mult: 3 }, anim: 'magic', desc: '浄化の光。妖怪に3倍。' },
  choubuku: { cost: 2, range: 'all', mult: 0.5, counter: 0, stiff: 25, effect: 'dmg', magic: true, vs: { kinds: ['youkai'], mult: 3 }, anim: 'magic', desc: '敵全体を調伏する。妖怪に3倍。' },
  kongousho: { cost: 2, range: 'near', mult: 1.5, counter: 0.1, stiff: 20, effect: 'dmg', ignoreGuard: true, desc: '金剛杵で打ち砕く。ガードの半減を受けない。' },
  // 妖魔
  kokumu: { cost: 2, range: 'all', mult: 0.7, counter: 0, stiff: 25, effect: 'dispel', amount: 6, magic: true, anim: 'magic', desc: '黒い霧で敵全体を侵し、付与を外す。' },
  mizuchi: { cost: 'all', range: 'all', mult: 1.6, counter: 0, stiff: 30, prep: 10, prepGuard: 3, effect: 'dmg', magic: true, anim: 'magic', desc: '要準備（崩すには3回当てる）。天地を揺るがす咆哮。' },
  gurenmai: { cost: 2, range: 'all', mult: 0.8, counter: 0, stiff: 20, prep: 6, effect: 'dmg', magic: true, anim: 'magic', desc: '要準備（短い）。紅蓮の炎で敵全体を焼く。' },
  kyuuketsu: { cost: 1, range: 'far', mult: 1, counter: 0, stiff: 20, effect: 'drain', magic: true, anim: 'magic', desc: '生命を吸い、与えた打撃の半分だけ兵を戻す。' },
  onikudaki: { cost: 'all', range: 'near', mult: 2.5, counter: 0.3, stiff: 20, effect: 'dmg', anim: 'claw', desc: '鬼の剛力で叩き潰す。打撃2.5倍。' },
  dohatsu: { cost: 2, range: 'allies', mult: 0, counter: 0, stiff: 20, effect: 'buffAtk', amount: 0.6, anim: 'shout', desc: '味方全体に攻付与60%。' },
  // 浪人衆
  ansatsu: { cost: 2, range: 'far', mult: 0, counter: 0, stiff: 20, effect: 'assassin', amount: 0.83, anim: 'shuriken', desc: '消費2の暗殺。高い確率で部隊を壊滅させる。' },
  kagebunshin: { cost: 1, range: 'self', mult: 0, counter: 0, stiff: 5, effect: 'buffDef', amount: 0.7, anim: 'buff', desc: '影に紛れる。自分に防付与70%、硬直がとても短い。' },
  sougetsu: { cost: 2, range: 'near', mult: 1, counter: 0, stiff: 20, effect: 'dmg', amount: 2, desc: '二刀で2回斬る。反撃を受けない。' },
  zanshin: { cost: 1, range: 'near', mult: 1.2, counter: 0, stiff: 8, effect: 'dmg', desc: '斬って即座に構え直す。硬直が短く、反撃を受けない。' },
};

export const SKILL_TABLE: Record<string, SkillDef> = Object.fromEntries([
  ...Object.entries(UNIQUE).map(([id, u]) => {
    const src = UNIQUE_SRC[id];
    if (!src) throw new Error(`unique skill without source ${id}`);
    return [id, { anim: 'melee', ...u, id, name: src.name, color: src.color } as SkillDef] as const;
  }),
  ...BASE_SKILLS.map((s) => [s.id, s] as const),
]);

// 兵種の技と固有技の ID は重ならないこと
for (const s of BASE_SKILLS) if (UNIQUE[s.id]) throw new Error(`skill id conflict ${s.id}`);

export function battleSkill(id: string): SkillDef {
  const s = SKILL_TABLE[id];
  if (!s) throw new Error(`unknown battle skill ${id}`);
  return s;
}

/** 兵種の技のうち、そのレベルで使えるもの（上位の技は元の技を置き換える） */
export function kindSkills(kind: Kind, lv: number): string[] {
  const got = KINDS[kind].skills.filter(([, min]) => lv >= min);
  const replaced = new Set(got.map(([, , rep]) => rep).filter((x): x is string => !!x));
  return got.map(([id]) => id).filter((id) => !replaced.has(id));
}

export const RANGE_NAME: Record<SkillDef['range'], string> = {
  near: '近', far: '遠', pierce: '貫通', all: '全体', ally: '味方', allies: '味方全', self: '自分', none: '―',
};

/** 消費の表示 */
export function costLabel(s: SkillDef): string {
  return s.cost === 'all' ? '全' : String(s.cost);
}
