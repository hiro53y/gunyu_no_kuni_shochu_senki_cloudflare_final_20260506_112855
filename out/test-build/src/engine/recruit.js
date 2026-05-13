"use strict";
// ===========================================================================
// 捕虜・登用エンジン v2.1
// 戦闘終了時の捕虜化判定（battle.ts内 finalizeBattle）に続く処理。
// ここでは「捕虜の状態進行」「説得試行」「浪人プールからの登用」を扱う。
// spec_v2.md §6.7 / §6A に対応。
// ===========================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.tickPrisoners = tickPrisoners;
exports.persuasionCost = persuasionCost;
exports.persuasionSuccessRate = persuasionSuccessRate;
exports.attemptPersuade = attemptPersuade;
exports.hireCost = hireCost;
exports.hireRonin = hireRonin;
exports.refillRoninPool = refillRoninPool;
const genericPool_1 = require("../data/genericPool");
// --- ターン進行ごとの捕虜状態更新 -----------------------------------------
/** 各捕虜の capturedTurns を1増やし、忠誠を漸減させる */
function tickPrisoners(state) {
    const generals = { ...state.generals };
    for (const id of state.prisoners) {
        const g = generals[id];
        if (!g || g.status !== 'captured')
            continue;
        generals[id] = {
            ...g,
            capturedTurns: g.capturedTurns + 1,
            // 元勢力への忠誠が時間とともに下がる（最低5まで）
            loyalty: Math.max(5, g.loyalty - 2),
        };
    }
    return { ...state, generals };
}
/** 説得に必要な金 */
function persuasionCost(g) {
    return 500 + g.stats.charisma * 20 + g.persuadeAttempts * 200;
}
/** 説得成功率を求める */
function persuasionSuccessRate(state, g) {
    // ベース：プレイヤー当主の魅力 - 元勢力への忠誠
    const ruler = state.generals[state.factions.akatsuki.rulerGeneralId];
    const charismaPart = (ruler?.stats.charisma ?? 50) * 0.5;
    const loyaltyPart = -g.loyalty * 0.4;
    const captureBonus = Math.min(40, g.capturedTurns * 2);
    let base = charismaPart + loyaltyPart + captureBonus + 5;
    // 妖魔は基本登用不可
    if (g.homeFactionId === 'youma')
        return 0;
    // 元勢力滅亡 → +30%
    if (g.homeFactionId && state.factions[g.homeFactionId]?.destroyed)
        base += 30;
    // 汎用キャラの trait による補正
    if (g.isGeneric) {
        const profile = (0, genericPool_1.getTraitProfile)(g.trait);
        base += profile.persuasionModifier;
    }
    else {
        // ユニーク武将は説得難（ロマン枠）
        base -= 10;
    }
    return Math.max(0, Math.min(95, base)) / 100;
}
/** 1回の説得を試みる */
function attemptPersuade(state, generalId, rng) {
    const g = state.generals[generalId];
    if (!g)
        return { state, ok: false, message: '武将が見つかりません', cost: 0, successProbability: 0 };
    if (g.status !== 'captured')
        return { state, ok: false, message: '捕虜ではありません', cost: 0, successProbability: 0 };
    const cost = persuasionCost(g);
    const treasury = state.factions.akatsuki.treasury;
    if (treasury < cost) {
        return { state, ok: false, message: '金が不足しています', cost, successProbability: persuasionSuccessRate(state, g) };
    }
    const p = persuasionSuccessRate(state, g);
    const success = rng.chance(p);
    const akatsuki = { ...state.factions.akatsuki, treasury: treasury - cost };
    const generals = { ...state.generals };
    if (success) {
        generals[generalId] = {
            ...g,
            status: 'recruited',
            factionId: 'akatsuki',
            loyalty: 60, // 登用直後の忠誠は中程度
            capturedTurns: 0,
            persuadeAttempts: g.persuadeAttempts + 1,
            troopCurrent: Math.round(g.troopMax * 0.4), // 兵を再編成
        };
        const prisoners = state.prisoners.filter((id) => id !== generalId);
        return {
            state: {
                ...state,
                factions: { ...state.factions, akatsuki },
                generals,
                prisoners,
                rngSeed: rng.getSeed(),
            },
            ok: true,
            message: `${g.name}を登用した！（${cost.toLocaleString()}金）`,
            cost,
            successProbability: p,
        };
    }
    // 失敗：忠誠ダウン、試行回数アップ
    generals[generalId] = {
        ...g,
        persuadeAttempts: g.persuadeAttempts + 1,
        loyalty: Math.max(5, g.loyalty - 5),
    };
    return {
        state: {
            ...state,
            factions: { ...state.factions, akatsuki },
            generals,
            rngSeed: rng.getSeed(),
        },
        ok: false,
        message: `${g.name}の説得は失敗（${cost.toLocaleString()}金）`,
        cost,
        successProbability: p,
    };
}
/** 浪人雇用の必要金 */
function hireCost(g) {
    return 1000 + g.stats.power * 30 + g.stats.command * 20;
}
/** 浪人プールから武将を雇う */
function hireRonin(state, generalId) {
    const g = state.generals[generalId];
    if (!g)
        return { state, ok: false, message: '武将が見つかりません', cost: 0 };
    if (g.status !== 'ronin')
        return { state, ok: false, message: '浪人ではありません', cost: 0 };
    const cost = hireCost(g);
    const treasury = state.factions.akatsuki.treasury;
    if (treasury < cost)
        return { state, ok: false, message: '金が不足しています', cost };
    return {
        state: {
            ...state,
            factions: {
                ...state.factions,
                akatsuki: { ...state.factions.akatsuki, treasury: treasury - cost },
            },
            generals: {
                ...state.generals,
                [generalId]: {
                    ...g,
                    status: 'recruited',
                    factionId: 'akatsuki',
                    loyalty: 70,
                    troopCurrent: g.troopMax,
                },
            },
            roninPool: state.roninPool.filter((id) => id !== generalId),
        },
        ok: true,
        message: `${g.name}を雇った！（${cost.toLocaleString()}金）`,
        cost,
    };
}
// --- 浪人プールの補充 ----------------------------------------------------
const genericGen_1 = require("./genericGen");
/** 浪人プールが少なければ補充する。ターン終了時に呼ぶ */
function refillRoninPool(state, rng) {
    const target = 4;
    const cur = state.roninPool.length;
    if (cur >= target)
        return state;
    const generals = { ...state.generals };
    const newIds = [];
    for (let i = 0; i < target - cur; i++) {
        const g = (0, genericGen_1.generateGenericGeneral)(rng, { factionId: null });
        generals[g.id] = g;
        newIds.push(g.id);
    }
    return {
        ...state,
        generals,
        roninPool: [...state.roninPool, ...newIds],
        rngSeed: rng.getSeed(),
    };
}
