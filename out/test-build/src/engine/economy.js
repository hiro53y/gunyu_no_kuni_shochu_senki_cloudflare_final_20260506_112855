"use strict";
// ===========================================================================
// 経済エンジン v2.1
// ターン終了時の収入・維持費・満足度変動を計算する。
// すべて純粋関数として実装し、新しい GameState を返す。
// ===========================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.regionIncome = regionIncome;
exports.regionFood = regionFood;
exports.generalUpkeep = generalUpkeep;
exports.tickFactionEconomy = tickFactionEconomy;
exports.applyEconomyTick = applyEconomyTick;
exports.applySatisfactionDrift = applySatisfactionDrift;
exports.computeScore = computeScore;
exports.applyBuildAction = applyBuildAction;
exports.applyCollectAction = applyCollectAction;
/** 地域からの基礎収入（金）。建設レベルと国力で決まる */
function regionIncome(region) {
    const base = region.power * 200;
    const market = region.buildLevels.market * 150;
    const farm = region.buildLevels.farm * 60;
    const satisfactionMultiplier = 0.5 + (region.satisfaction / 100);
    return Math.round((base + market + farm) * satisfactionMultiplier);
}
/** 地域からの基礎兵糧 */
function regionFood(region) {
    const base = region.power * 80;
    const farm = region.buildLevels.farm * 200;
    return Math.round(base + farm);
}
/** 武将維持費 */
function generalUpkeep(troopCurrent, isUnique) {
    return Math.round(troopCurrent * (isUnique ? 0.4 : 0.5));
}
/** 1勢力分の経済処理 */
function tickFactionEconomy(state, factionId) {
    const log = [];
    let treasuryDelta = 0;
    let foodDelta = 0;
    for (const region of Object.values(state.regions)) {
        if (region.factionId !== factionId)
            continue;
        treasuryDelta += regionIncome(region);
        foodDelta += regionFood(region);
    }
    for (const g of Object.values(state.generals)) {
        if (g.factionId !== factionId)
            continue;
        if (g.status !== 'free' && g.status !== 'recruited')
            continue;
        const upkeep = generalUpkeep(g.troopCurrent, g.isUnique);
        treasuryDelta -= upkeep;
        foodDelta -= Math.round(g.troopCurrent * 0.5);
    }
    return { treasuryDelta, foodDelta, log };
}
/** 全勢力に対して経済処理を一括適用し、新 state を返す */
function applyEconomyTick(state) {
    const next = {
        ...state,
        factions: { ...state.factions },
    };
    const factionIds = Object.keys(state.factions);
    for (const fid of factionIds) {
        const r = tickFactionEconomy(state, fid);
        const f = state.factions[fid];
        next.factions[fid] = {
            ...f,
            treasury: Math.max(0, f.treasury + r.treasuryDelta),
            food: Math.max(0, f.food + r.foodDelta),
        };
    }
    return next;
}
/** 満足度の自然減（毎ターン -1）と、HUD用平均満足度の更新 */
function applySatisfactionDrift(state) {
    const next = { ...state, regions: { ...state.regions } };
    for (const id of Object.keys(state.regions)) {
        const r = state.regions[id];
        next.regions[id] = {
            ...r,
            satisfaction: clamp(r.satisfaction - 1, 0, 100),
        };
    }
    const playerRegions = Object.values(next.regions).filter((r) => r.factionId === 'akatsuki');
    if (playerRegions.length > 0) {
        const avg = playerRegions.reduce((s, r) => s + r.satisfaction, 0) / playerRegions.length;
        next.satisfaction = Math.round(avg);
    }
    return next;
}
/** 得点計算（HUD表示用） */
function computeScore(state) {
    let score = 0;
    for (const r of Object.values(state.regions)) {
        if (r.factionId === 'akatsuki')
            score += 50;
    }
    for (const g of Object.values(state.generals)) {
        if (g.status === 'dead' && g.homeFactionId === 'youma')
            score += 30;
    }
    return score;
}
/** 建設アクションの効果を反映する（金・国力・満足度を消費） */
function applyBuildAction(state, regionId, type) {
    const region = state.regions[regionId];
    if (!region)
        return { state, ok: false, message: '地域が見つかりません' };
    if (region.factionId !== 'akatsuki')
        return { state, ok: false, message: '自国地域のみ建設できます' };
    const current = region.buildLevels[type];
    if (current >= 5)
        return { state, ok: false, message: 'すでに最大レベルです' };
    const cost = 800 + current * 400;
    const akatsuki = state.factions.akatsuki;
    if (akatsuki.treasury < cost)
        return { state, ok: false, message: '金が不足しています' };
    return {
        state: {
            ...state,
            factions: {
                ...state.factions,
                akatsuki: { ...akatsuki, treasury: akatsuki.treasury - cost },
            },
            regions: {
                ...state.regions,
                [regionId]: {
                    ...region,
                    buildLevels: { ...region.buildLevels, [type]: current + 1 },
                    power: Math.min(10, region.power + (type === 'farm' || type === 'market' ? 1 : 0)),
                },
            },
        },
        ok: true,
        message: `${region.name}で${labelOfBuild(type)}を強化した（Lv${current + 1}）`,
    };
}
/** 徴収：金を一時的に得るが満足度が下がる */
function applyCollectAction(state, regionId) {
    const region = state.regions[regionId];
    if (!region)
        return { state, ok: false, message: '地域が見つかりません', gained: 0 };
    if (region.factionId !== 'akatsuki')
        return { state, ok: false, message: '自国地域のみ徴収できます', gained: 0 };
    const gained = Math.round(region.power * 600 * (region.satisfaction / 100));
    return {
        state: {
            ...state,
            factions: {
                ...state.factions,
                akatsuki: { ...state.factions.akatsuki, treasury: state.factions.akatsuki.treasury + gained },
            },
            regions: {
                ...state.regions,
                [regionId]: { ...region, satisfaction: clamp(region.satisfaction - 15, 0, 100) },
            },
        },
        ok: true,
        message: `${region.name}から ${gained.toLocaleString()}金を徴収（満足度-15）`,
        gained,
    };
}
function labelOfBuild(t) {
    return { farm: '田畑', wall: '城壁', market: '市場', forge: '鍛冶場' }[t];
}
function clamp(v, lo, hi) {
    return Math.min(Math.max(v, lo), hi);
}
