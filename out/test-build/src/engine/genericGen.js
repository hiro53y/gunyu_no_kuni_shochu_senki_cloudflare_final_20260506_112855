"use strict";
// ===========================================================================
// 汎用キャラクター生成エンジン v2.1
// 名字・名前プールと特性プロファイルからオリジナルの汎用武将を生成する。
// spec_v2.md §6B に対応
// ===========================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextGenericId = nextGenericId;
exports.rollTrait = rollTrait;
exports.generateGenericGeneral = generateGenericGeneral;
exports.generateInitialRoninPool = generateInitialRoninPool;
exports.generateInitialSupportGenerals = generateInitialSupportGenerals;
const genericPool_1 = require("../data/genericPool");
let counter = 1;
/** 重複しない汎用武将ID */
function nextGenericId() {
    const id = `gx_${Date.now().toString(36)}_${counter}`;
    counter++;
    return id;
}
/** trait を重み付きで抽選する */
function rollTrait(rng) {
    const traits = genericPool_1.TRAIT_PROFILES.map((p) => p.trait);
    const weights = genericPool_1.TRAIT_PROFILES.map((p) => p.weight);
    return rng.weighted(traits, weights);
}
/** ふりがな化は省略し名字＋名前のみ返す */
function rollName(rng) {
    const surname = rng.pick(genericPool_1.SURNAMES);
    const isFemale = rng.chance(0.25); // 約4人に1人
    const given = isFemale ? rng.pick(genericPool_1.GIVEN_NAMES_FEMALE) : rng.pick(genericPool_1.GIVEN_NAMES_MALE);
    return {
        name: `${surname} ${given}`,
        reading: '',
    };
}
/** 1人の汎用武将を生成して返す */
function generateGenericGeneral(rng, opts) {
    const trait = opts.forceTrait ?? rollTrait(rng);
    const profile = (0, genericPool_1.getTraitProfile)(trait);
    const { name, reading } = rollName(rng);
    const stats = {
        power: rng.int(profile.power[0], profile.power[1]),
        command: rng.int(profile.command[0], profile.command[1]),
        intel: rng.int(profile.intel[0], profile.intel[1]),
        charisma: rng.int(profile.charisma[0], profile.charisma[1]),
    };
    const troopMax = rng.int(profile.troopMax[0], profile.troopMax[1]);
    const loyalty = rng.int(profile.loyalty[0], profile.loyalty[1]);
    // スキル：profile.skills から最大2個
    const skillIds = profile.skills.slice(0, 2);
    return {
        id: nextGenericId(),
        name,
        reading,
        factionId: opts.factionId,
        homeFactionId: opts.factionId,
        isUnique: false,
        isGeneric: true,
        trait,
        stats,
        skillIds,
        troopMax,
        troopCurrent: troopMax,
        stamina: 100,
        loyalty,
        status: opts.factionId === null ? 'ronin' : 'free',
        capturedTurns: 0,
        persuadeAttempts: 0,
        portraitKey: `generic_${trait}`,
        remarks: `${profile.label}型`,
    };
}
/** 浪人プール初期生成（4人） */
function generateInitialRoninPool(rng, count = 4) {
    return Array.from({ length: count }, () => generateGenericGeneral(rng, { factionId: null }));
}
/** 各NPC勢力の初期サポート武将を生成（人間勢力に2〜3名、妖魔に4名、浪人に2名） */
function generateInitialSupportGenerals(rng) {
    const result = [];
    const humanFactions = ['kurogane', 'shion', 'shirasagi', 'honoo', 'rengein'];
    for (const f of humanFactions) {
        const count = rng.int(2, 3);
        for (let i = 0; i < count; i++) {
            result.push(generateGenericGeneral(rng, { factionId: f }));
        }
    }
    // 妖魔は雑兵が多い設定
    for (let i = 0; i < 4; i++) {
        const trait = rng.chance(0.4) ? 'attacker' : 'normal';
        const g = generateGenericGeneral(rng, { factionId: 'youma', forceTrait: trait });
        g.name = `妖魔・${rng.pick(['夜叉', '鬼', '化生', '蛟', '骸'])}${rng.int(1, 99)}号`;
        g.portraitKey = 'youma_grunt';
        result.push(g);
    }
    // 浪人衆所属を2名（roninPool とは別）
    for (let i = 0; i < 2; i++) {
        result.push(generateGenericGeneral(rng, { factionId: 'ronin' }));
    }
    return result;
}
