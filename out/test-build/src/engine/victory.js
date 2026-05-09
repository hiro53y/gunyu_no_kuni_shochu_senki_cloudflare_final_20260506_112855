"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGameResult = buildGameResult;
exports.checkGameStatus = checkGameStatus;
const names_1 = require("../data/names");
const selectors_1 = require("./selectors");
function ratingFor(state, status) {
    if (status === 'defeat') {
        return '再起の芽あり';
    }
    if (state.turn <= 24) {
        return '覇王の器';
    }
    if (state.turn <= 40) {
        return '名将';
    }
    return '堅実なる統一者';
}
function buildGameResult(state, status, reason) {
    const controlled = (0, selectors_1.getPlayerRegions)(state).length;
    const defeated = (0, selectors_1.getDefeatedMajorFactions)(state).length;
    return {
        title: status === 'victory' ? '八州統一' : '落日',
        reachedTurn: state.turn,
        controlledRegions: controlled,
        defeatedMajorFactions: defeated,
        recruitedOfficers: state.stats.recruitedOfficers,
        totalBattles: state.stats.totalBattles,
        rating: ratingFor(state, status),
        reason,
    };
}
function checkGameStatus(state) {
    if (state.gameStatus !== 'playing') {
        return state;
    }
    const playerRegions = (0, selectors_1.getPlayerRegions)(state).length;
    const majorNpcIds = Object.values(state.factions)
        .filter((faction) => faction.isMajor && !faction.isPlayer)
        .map((faction) => faction.id);
    const allMajorDefeated = majorNpcIds.every((id) => (0, selectors_1.getFactionRegions)(state, id).length === 0);
    if (playerRegions >= 8) {
        const result = buildGameResult(state, 'victory', '8地域以上を支配した。');
        return { ...state, gameStatus: 'victory', phase: 'player', result };
    }
    if (allMajorDefeated) {
        const result = buildGameResult(state, 'victory', '主要NPC勢力をすべて滅ぼした。');
        return { ...state, gameStatus: 'victory', phase: 'player', result };
    }
    if (playerRegions <= 0) {
        const result = buildGameResult(state, 'defeat', '暁ノ家の支配地域がなくなった。');
        return { ...state, gameStatus: 'defeat', phase: 'player', result };
    }
    if (state.turn >= 60 && playerRegions <= 3) {
        const result = buildGameResult(state, 'defeat', '60ターン経過時点で支配地域が3以下だった。');
        return { ...state, gameStatus: 'defeat', phase: 'player', result };
    }
    const playerFaction = state.factions[names_1.PLAYER_FACTION_ID];
    if (playerFaction.food <= 0 && playerFaction.gold <= 0 && playerRegions <= 1) {
        const result = buildGameResult(state, 'defeat', '資源が尽き、立て直しが困難になった。');
        return { ...state, gameStatus: 'defeat', phase: 'player', result };
    }
    return state;
}
