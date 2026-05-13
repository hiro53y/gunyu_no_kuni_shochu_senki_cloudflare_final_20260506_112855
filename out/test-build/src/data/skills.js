"use strict";
// ===========================================================================
// スキル定義 v2.1
// ユニーク武将固有スキル（44種）＋汎用スキル（10種）
// ===========================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.SKILLS = void 0;
exports.getSkill = getSkill;
const sk = (s) => s;
exports.SKILLS = {
    // -------------------------------------------------------------------------
    // 暁ノ家
    // -------------------------------------------------------------------------
    sk_issen: sk({
        id: 'sk_issen', name: '一閃', kind: 'attack', target: 'enemy_one', cost: 15,
        description: '居合で単体に大ダメージを与える。',
        cutInDialogue: '一閃……目を瞑れ。',
        effect: { basePower: 1.8 },
    }),
    sk_kyouzaki: sk({
        id: 'sk_kyouzaki', name: '狂咲', kind: 'support', target: 'self', cost: 20,
        description: '攻撃を3ターン強化する。終了時に反動で1割ダメージ。',
        cutInDialogue: '咲き乱れろ……！',
        effect: { basePower: 0, selfBuff: { atk: 0.4, turns: 3 }, recoil: 0.1 },
    }),
    sk_kanagi: sk({
        id: 'sk_kanagi', name: '神薙ぎ', kind: 'heal', target: 'ally_one', cost: 12,
        description: '神威で味方単体を大きく回復する。',
        cutInDialogue: '神よ、御加護を。',
        effect: { basePower: 1.5 },
    }),
    sk_harai: sk({
        id: 'sk_harai', name: '祓い', kind: 'heal', target: 'ally_all', cost: 25,
        description: '味方全体を中回復し、状態異常を解除する。',
        cutInDialogue: '穢れよ、退け。',
        effect: { basePower: 0.7, hits: 9 },
    }),
    sk_sakubou: sk({
        id: 'sk_sakubou', name: '策謀', kind: 'support', target: 'enemy_all', cost: 18,
        description: '敵全体の攻撃を2ターン弱化する。',
        cutInDialogue: '読み筋は割れている。',
        effect: { basePower: 0, debuff: { atk: -0.25, turns: 2 } },
    }),
    sk_kobu: sk({
        id: 'sk_kobu', name: '鼓舞', kind: 'support', target: 'ally_all', cost: 18,
        description: '味方全体の攻撃を2ターン強化する。',
        cutInDialogue: '進め、暁の旗のもとに！',
        effect: { basePower: 0, selfBuff: { atk: 0.2, turns: 2 } },
    }),
    sk_teppeki: sk({
        id: 'sk_teppeki', name: '鉄壁', kind: 'support', target: 'self', cost: 10,
        description: '自身の防御を3ターン大きく強化する。',
        cutInDialogue: 'ここは通さん。',
        effect: { basePower: 0, selfBuff: { def: 0.5, turns: 3 } },
    }),
    sk_konshin: sk({
        id: 'sk_konshin', name: '渾身', kind: 'attack', target: 'enemy_one', cost: 18,
        description: 'HPが低いほど威力が上がる一撃。',
        effect: { basePower: 1.6 },
    }),
    // -------------------------------------------------------------------------
    // 黒鉄家
    // -------------------------------------------------------------------------
    sk_tetsuyari: sk({
        id: 'sk_tetsuyari', name: '鉄槍突撃', kind: 'attack', target: 'enemy_one', cost: 16,
        description: '鉄槍で貫く突撃。', effect: { basePower: 1.6 },
    }),
    sk_kokkou: sk({
        id: 'sk_kokkou', name: '黒甲', kind: 'support', target: 'self', cost: 12,
        description: '黒鉄甲冑で守りを固める。',
        effect: { basePower: 0, selfBuff: { def: 0.4, turns: 3 } },
    }),
    sk_isseisha: sk({
        id: 'sk_isseisha', name: '一斉射', kind: 'aoe', target: 'enemy_all', cost: 22,
        description: '敵全体に鉄砲を斉射する。',
        cutInDialogue: '撃て、容赦するな。',
        effect: { basePower: 0.8, hits: 9 },
    }),
    sk_sogeki: sk({
        id: 'sk_sogeki', name: '狙撃', kind: 'attack', target: 'enemy_one', cost: 14,
        description: '敵将を確実に仕留める一撃。低確率で即死。',
        effect: { basePower: 1.4, instaKillChance: 0.05 },
    }),
    sk_raijin: sk({
        id: 'sk_raijin', name: '雷迅', kind: 'attack', target: 'enemy_one', cost: 17,
        description: '雷光のごとき速さの一撃。',
        cutInDialogue: '雷鳴、参る。', effect: { basePower: 1.7 },
    }),
    sk_gouda: sk({
        id: 'sk_gouda', name: '豪打', kind: 'attack', target: 'enemy_one', cost: 20,
        description: '渾身の豪打。確率で麻痺。',
        effect: { basePower: 1.5, inflict: { type: 'stun', chance: 0.3, turns: 1 } },
    }),
    // -------------------------------------------------------------------------
    // 紫苑家
    // -------------------------------------------------------------------------
    sk_sandan: sk({
        id: 'sk_sandan', name: '算段', kind: 'support', target: 'ally_all', cost: 20,
        description: '味方全体を回復しつつ士気を上げる。',
        effect: { basePower: 0.5, selfBuff: { atk: 0.1, turns: 2 } },
    }),
    sk_baishuu: sk({
        id: 'sk_baishuu', name: '買収', kind: 'special', target: 'enemy_one', cost: 25,
        description: '敵単体を一時的に動けなくする。',
        cutInDialogue: '銭で済むなら、安いものよ。',
        effect: { basePower: 0, inflict: { type: 'sealed', chance: 0.6, turns: 2 } },
    }),
    sk_kairikutachi: sk({
        id: 'sk_kairikutachi', name: '海陸断ち', kind: 'aoe', target: 'enemy_all', cost: 22,
        description: '海と陸を断つ斬り抜け。',
        effect: { basePower: 0.85, hits: 9 },
    }),
    sk_ryakudatsu: sk({
        id: 'sk_ryakudatsu', name: '略奪', kind: 'attack', target: 'enemy_one', cost: 14,
        description: '敵を斬りつけ、勝利時の戦利品を増やす。',
        effect: { basePower: 1.3 },
    }),
    sk_sakuryaku: sk({
        id: 'sk_sakuryaku', name: '策略', kind: 'support', target: 'enemy_all', cost: 18,
        description: '敵全体の防御を弱化する。',
        effect: { basePower: 0, debuff: { def: -0.25, turns: 2 } },
    }),
    sk_chouhatsu: sk({
        id: 'sk_chouhatsu', name: '挑発', kind: 'support', target: 'enemy_all', cost: 12,
        description: '敵を挑発し、攻撃を自身に集中させる。',
        effect: { basePower: 0, debuff: { atk: -0.1, turns: 2 } },
    }),
    // -------------------------------------------------------------------------
    // 白鷺家
    // -------------------------------------------------------------------------
    sk_shinsoku: sk({
        id: 'sk_shinsoku', name: '神速', kind: 'support', target: 'self', cost: 12,
        description: '神速で行動回数が増える。',
        cutInDialogue: '風よ、追い越せぬか。',
        effect: { basePower: 0, selfBuff: { atk: 0.15, turns: 3 } },
    }),
    sk_shirasagi: sk({
        id: 'sk_shirasagi', name: '白鷺の翔', kind: 'attack', target: 'enemy_one', cost: 18,
        description: '白鷺の如く飛翔し斬撃を浴びせる。',
        cutInDialogue: '白鷺、翔べ。', effect: { basePower: 1.7 },
    }),
    sk_sanya: sk({
        id: 'sk_sanya', name: '三矢', kind: 'aoe', target: 'enemy_all', cost: 18,
        description: '三本の矢を同時に放つ。', effect: { basePower: 0.7, hits: 3 },
    }),
    sk_yougan: sk({
        id: 'sk_yougan', name: '鷹眼', kind: 'attack', target: 'enemy_one', cost: 14,
        description: '弱点を見抜いた精密射撃。',
        effect: { basePower: 1.4, instaKillChance: 0.08 },
    }),
    sk_yukigake: sk({
        id: 'sk_yukigake', name: '雪駆け', kind: 'attack', target: 'enemy_one', cost: 12,
        description: '雪原を駆ける騎馬突撃。', effect: { basePower: 1.4 },
    }),
    sk_totsugeki: sk({
        id: 'sk_totsugeki', name: '突撃', kind: 'attack', target: 'enemy_one', cost: 14,
        description: '一直線の騎馬突撃。', effect: { basePower: 1.5 },
    }),
    // -------------------------------------------------------------------------
    // 焔ノ家
    // -------------------------------------------------------------------------
    sk_kaenjin: sk({
        id: 'sk_kaenjin', name: '火炎陣', kind: 'aoe', target: 'enemy_all', cost: 24,
        description: '炎の陣を敷き敵全体を焼く。火傷付与。',
        cutInDialogue: '焔よ、舞え。',
        effect: { basePower: 0.85, hits: 9, inflict: { type: 'burn', chance: 0.5, turns: 2, magnitude: 50 } },
    }),
    sk_shinkanoinori: sk({
        id: 'sk_shinkanoinori', name: '神火の祈り', kind: 'heal', target: 'ally_all', cost: 22,
        description: '神火を呼び、味方全体を回復する。',
        effect: { basePower: 0.6, hits: 9 },
    }),
    sk_hiyaritotsugeki: sk({
        id: 'sk_hiyaritotsugeki', name: '火槍突撃', kind: 'attack', target: 'enemy_one', cost: 16,
        description: '火槍で一気に貫く突撃。',
        effect: { basePower: 1.6, inflict: { type: 'burn', chance: 0.3, turns: 2, magnitude: 40 } },
    }),
    sk_honoonagi: sk({
        id: 'sk_honoonagi', name: '焔薙ぎ', kind: 'aoe', target: 'enemy_all', cost: 20,
        description: '炎の薙ぎ払い。', effect: { basePower: 0.75, hits: 9 },
    }),
    // -------------------------------------------------------------------------
    // 蓮華院
    // -------------------------------------------------------------------------
    sk_rengekekkai: sk({
        id: 'sk_rengekekkai', name: '蓮華結界', kind: 'support', target: 'ally_all', cost: 22,
        description: '蓮華の結界で味方全体の防御を強化。',
        cutInDialogue: '南無、御仏の御加護。',
        effect: { basePower: 0, selfBuff: { def: 0.35, turns: 3 } },
    }),
    sk_johkakou: sk({
        id: 'sk_johkakou', name: '浄化光', kind: 'attack', target: 'enemy_one', cost: 18,
        description: '浄化の光で敵を打ち、妖魔に特効。',
        effect: { basePower: 1.5, youmaSpecial: 2.0 },
    }),
    sk_kongouhsh: sk({
        id: 'sk_kongouhsh', name: '金剛杵', kind: 'attack', target: 'enemy_one', cost: 16,
        description: '金剛杵による粉砕。',
        effect: { basePower: 1.6 },
    }),
    sk_choubuku: sk({
        id: 'sk_choubuku', name: '調伏', kind: 'special', target: 'enemy_one', cost: 25,
        description: '妖魔を調伏する。妖魔系に大ダメージ＋封印。',
        cutInDialogue: '退け、邪なるもの。',
        effect: { basePower: 1.2, youmaSpecial: 2.5, inflict: { type: 'sealed', chance: 0.5, turns: 2 } },
    }),
    // -------------------------------------------------------------------------
    // 妖魔の群
    // -------------------------------------------------------------------------
    sk_kokumu: sk({
        id: 'sk_kokumu', name: '黒霧', kind: 'aoe', target: 'enemy_all', cost: 30,
        description: '黒い霧で敵全体を侵す。恐怖付与。',
        cutInDialogue: 'グ……オオオ……',
        effect: { basePower: 0.9, hits: 9, inflict: { type: 'fear', chance: 0.4, turns: 2 } },
    }),
    sk_mizuchikoukou: sk({
        id: 'sk_mizuchikoukou', name: '蛟の咆哮', kind: 'aoe', target: 'enemy_all', cost: 40,
        description: '蛟王の咆哮。最強の必殺技。',
        cutInDialogue: '滅び去れ……人の子よ。',
        effect: { basePower: 1.3, hits: 9 },
    }),
    sk_gurenmai: sk({
        id: 'sk_gurenmai', name: '紅蓮舞', kind: 'aoe', target: 'enemy_all', cost: 25,
        description: '紅蓮の炎を纏い舞う。',
        effect: { basePower: 0.9, hits: 9, inflict: { type: 'burn', chance: 0.4, turns: 2, magnitude: 60 } },
    }),
    sk_kyuuketsu: sk({
        id: 'sk_kyuuketsu', name: '吸血', kind: 'attack', target: 'enemy_one', cost: 18,
        description: '相手から生命力を奪い自身を回復。',
        effect: { basePower: 1.5, recoil: -0.3 }, // recoilマイナスで吸収扱い
    }),
    sk_onikudaki: sk({
        id: 'sk_onikudaki', name: '鬼砕き', kind: 'attack', target: 'enemy_one', cost: 22,
        description: '鬼の力で粉砕する。',
        effect: { basePower: 2.0 },
    }),
    sk_dohatsu: sk({
        id: 'sk_dohatsu', name: '怒髪', kind: 'support', target: 'self', cost: 0,
        description: '怒りで攻撃を一気に強化。HP割合分強くなる。',
        effect: { basePower: 0, selfBuff: { atk: 0.6, turns: 3 } },
    }),
    // -------------------------------------------------------------------------
    // 浪人衆
    // -------------------------------------------------------------------------
    sk_ansatsu: sk({
        id: 'sk_ansatsu', name: '暗殺', kind: 'special', target: 'enemy_one', cost: 30,
        description: '影から忍び寄り即死を狙う。',
        cutInDialogue: '……南無。',
        effect: { basePower: 1.0, instaKillChance: 0.2 },
    }),
    sk_kagebunshin: sk({
        id: 'sk_kagebunshin', name: '影分身', kind: 'aoe', target: 'enemy_all', cost: 22,
        description: '影分身で全体に同時攻撃。',
        effect: { basePower: 0.8, hits: 9 },
    }),
    sk_sougetsuzan: sk({
        id: 'sk_sougetsuzan', name: '双月斬り', kind: 'attack', target: 'enemy_one', cost: 18,
        description: '二刀流の連続斬撃。',
        cutInDialogue: '月よ、双つに割れろ。',
        effect: { basePower: 1.7 },
    }),
    sk_zanshin: sk({
        id: 'sk_zanshin', name: '残心', kind: 'support', target: 'self', cost: 10,
        description: '次の攻撃の威力を大きく上げる。',
        effect: { basePower: 0, selfBuff: { atk: 0.5, turns: 1 } },
    }),
    // -------------------------------------------------------------------------
    // 汎用スキル（generic用）
    // -------------------------------------------------------------------------
    sk_zangeki: sk({
        id: 'sk_zangeki', name: '通常斬撃', kind: 'attack', target: 'enemy_one', cost: 0,
        description: '基本の斬撃。', effect: { basePower: 1.0 },
    }),
    sk_shuuchuutsuki: sk({
        id: 'sk_shuuchuutsuki', name: '集中突き', kind: 'attack', target: 'enemy_one', cost: 12,
        description: '一点集中の突き。', effect: { basePower: 1.3 },
    }),
    sk_kisha: sk({
        id: 'sk_kisha', name: '騎射', kind: 'attack', target: 'enemy_one', cost: 14,
        description: '馬上から弓を放つ。', effect: { basePower: 1.4 },
    }),
    sk_raitei: sk({
        id: 'sk_raitei', name: '雷霆', kind: 'aoe', target: 'enemy_all', cost: 24,
        description: '雷の如き全体攻撃。', effect: { basePower: 0.7, hits: 9 },
    }),
    sk_kaendan: sk({
        id: 'sk_kaendan', name: '火炎弾', kind: 'attack', target: 'enemy_one', cost: 14,
        description: '火炎の塊を放つ。',
        effect: { basePower: 1.4, inflict: { type: 'burn', chance: 0.3, turns: 2, magnitude: 30 } },
    }),
    sk_chiyu: sk({
        id: 'sk_chiyu', name: '治癒', kind: 'heal', target: 'ally_one', cost: 12,
        description: '味方単体を中回復する。', effect: { basePower: 1.2 },
    }),
    sk_hangeki: sk({
        id: 'sk_hangeki', name: '反撃', kind: 'support', target: 'self', cost: 8,
        description: '構えを取り次の被弾で反撃する。',
        effect: { basePower: 0, selfBuff: { def: 0.2, turns: 2 } },
    }),
    sk_meiso: sk({
        id: 'sk_meiso', name: '瞑想', kind: 'heal', target: 'self', cost: 6,
        description: '自身のHPを少し回復する。', effect: { basePower: 0.6 },
    }),
    sk_ittouryouudan: sk({
        id: 'sk_ittouryouudan', name: '一刀両断', kind: 'attack', target: 'enemy_one', cost: 25,
        description: '渾身の一撃。低確率で即死。',
        cutInDialogue: '断つ……ぞッ！',
        effect: { basePower: 2.0, instaKillChance: 0.1 },
    }),
    sk_tokinokoe: sk({
        id: 'sk_tokinokoe', name: '鬨の声', kind: 'support', target: 'ally_all', cost: 16,
        description: '味方全体の士気を上げる。',
        effect: { basePower: 0, selfBuff: { atk: 0.15, turns: 2 } },
    }),
};
/** スキルIDから安全に取得（未定義時は通常斬撃にフォールバック） */
function getSkill(id) {
    return exports.SKILLS[id] ?? exports.SKILLS['sk_zangeki'];
}
