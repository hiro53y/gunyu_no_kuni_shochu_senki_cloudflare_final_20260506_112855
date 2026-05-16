"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeGenerals = summarizeGenerals;
exports.getDeployableGenerals = getDeployableGenerals;
exports.getEnemyPreviewGenerals = getEnemyPreviewGenerals;
exports.summarizeSlots = summarizeSlots;
exports.createBattleForecast = createBattleForecast;
exports.hasBattleHistory = hasBattleHistory;
const regions_1 = require("../data/regions");
function generalPower(g) {
    return Math.round(g.troopCurrent + g.stats.power * 7 + g.stats.command * 5 + g.stats.intel * 2);
}
function summarizeGenerals(generals) {
    const sorted = [...generals].sort((a, b) => generalPower(b) - generalPower(a));
    return {
        troopTotal: generals.reduce((sum, g) => sum + g.troopCurrent, 0),
        combatPower: generals.reduce((sum, g) => sum + generalPower(g), 0),
        topPower: sorted[0]?.stats.power ?? 0,
        topGeneralName: sorted[0]?.name ?? null,
        generalCount: generals.length,
    };
}
function getDeployableGenerals(state) {
    return Object.values(state.generals)
        .filter((g) => g.factionId === 'akatsuki')
        .filter((g) => g.status === 'free' || g.status === 'recruited')
        .filter((g) => g.troopCurrent > 0)
        .sort((a, b) => generalPower(b) - generalPower(a));
}
function getEnemyPreviewGenerals(state, regionId) {
    const fid = state.regions[regionId]?.factionId;
    if (!fid)
        return [];
    return Object.values(state.generals)
        .filter((g) => g.factionId === fid)
        .filter((g) => g.troopCurrent > 0)
        .sort((a, b) => generalPower(b) - generalPower(a))
        .slice(0, 3);
}
function summarizeSlots(state, slots) {
    const generals = slots
        .filter((s) => s.generalId && !s.retreated && s.hp > 0)
        .map((s) => {
        const g = state.generals[s.generalId];
        return g ? { ...g, troopCurrent: s.hp } : null;
    })
        .filter((g) => g !== null);
    return summarizeGenerals(generals);
}
function createBattleForecast(state, regionId, playerGenerals) {
    const region = state.regions[regionId];
    const terrain = region ? regions_1.TERRAIN_BONUSES[region.terrain] : regions_1.TERRAIN_BONUSES.plain;
    const player = summarizeGenerals(playerGenerals);
    const enemy = summarizeGenerals(getEnemyPreviewGenerals(state, regionId));
    const terrainFactor = 1 + terrain.atkPct / 100 - Math.max(0, terrain.defPct) / 220;
    const playerScore = Math.max(1, player.combatPower * terrainFactor);
    const enemyScore = Math.max(1, enemy.combatPower);
    const ratio = playerScore / enemyScore;
    const winRate = Math.max(8, Math.min(92, Math.round(100 * ratio / (ratio + 1))));
    let rating = 'even';
    if (winRate >= 58)
        rating = 'advantage';
    if (winRate <= 45)
        rating = 'disadvantage';
    const troopGap = enemy.troopTotal - player.troopTotal;
    const powerGap = enemy.topPower - player.topPower;
    let mainReason = '兵数と武力が近く、互角の戦いです。';
    if (player.generalCount === 0) {
        mainReason = 'まだ武将が配置されていません。強い順で自動配置すると戦力を確認できます。';
    }
    else if (rating === 'advantage') {
        mainReason = terrain.atkPct > 0
            ? '味方の兵数と武将能力に加え、地形の攻撃補正も活かせます。'
            : '味方の総合戦力が敵を上回っています。';
    }
    else if (rating === 'disadvantage') {
        if (troopGap > 250 && powerGap > 5) {
            mainReason = '敵の兵数が多く、さらに上位武将の武力が高いため不利です。';
        }
        else if (troopGap > 250) {
            mainReason = '敵の総兵力が味方を上回っているため不利です。';
        }
        else if (powerGap > 5) {
            mainReason = '敵上位武将の武力が高く、短期戦で押されやすいです。';
        }
        else {
            mainReason = '敵の総合戦力が高く、現兵力では消耗が大きくなります。';
        }
    }
    let recommendation = 'medium';
    if (region?.factionId === 'akatsuki')
        recommendation = 'own';
    else if (rating === 'advantage' || winRate >= 60)
        recommendation = 'high';
    else if (rating === 'disadvantage' || winRate <= 45)
        recommendation = 'low';
    const recommendationReason = recommendation === 'own'
        ? '自国です。内政・徴収・休養で戦力を整えられます。'
        : recommendation === 'high'
            ? '敵兵力が比較的少なく、現在の武将で攻略可能です。'
            : recommendation === 'medium'
                ? '勝敗は配置とスキル次第です。兵の補充後なら安定します。'
                : '敵戦力が高く、現兵力では不利です。';
    return {
        player,
        enemy,
        terrainNote: terrain.note,
        rating,
        winRate,
        mainReason,
        recommendation,
        recommendationReason,
        danger: Math.max(1, Math.min(9, Math.round((enemyScore / Math.max(1, playerScore)) * 4))),
    };
}
function hasBattleHistory(state) {
    return state.log.some((l) => l.type === 'battle');
}
