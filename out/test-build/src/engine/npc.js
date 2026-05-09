"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runNpcTurn = runNpcTurn;
const names_1 = require("../data/names");
const battle_1 = require("./battle");
const economy_1 = require("./economy");
const log_1 = require("./log");
const random_1 = require("./random");
const selectors_1 = require("./selectors");
function invasionThreshold(state, faction, target) {
    const base = {
        aggressive: 0.82,
        opportunist: 0.76,
        balanced: 0.94,
        domestic: 1.12,
    }[faction.aiPersonality];
    const difficultyShift = state.difficulty === 'hard' ? -0.08 : state.difficulty === 'easy' ? 0.12 : 0;
    const playerPressure = target.ownerFactionId === names_1.PLAYER_FACTION_ID && (0, selectors_1.getPlayerRegions)(state).length >= 5 ? -0.06 : 0;
    return base + difficultyShift + playerPressure;
}
function estimateAttackerPower(officers, faction) {
    return officers.reduce((sum, officer) => {
        const stamina = officer.stamina >= 45 ? 1 : 0.82;
        return sum + officer.troops * (0.7 + officer.command / 120) * (0.8 + officer.valor / 180) * stamina;
    }, 0) * (0.82 + faction.morale / 150);
}
function chooseAttackers(state, factionId) {
    return (0, selectors_1.getFactionOfficers)(state, factionId)
        .filter((officer) => officer.troops >= 80 && officer.stamina >= 25)
        .sort((a, b) => b.command + b.valor + b.troops / 20 - (a.command + a.valor + a.troops / 20))
        .slice(0, 3);
}
function runNpcInvasion(state, faction) {
    const attackers = chooseAttackers(state, faction.id);
    if (attackers.length === 0 || faction.food < 45) {
        return null;
    }
    const attackPower = estimateAttackerPower(attackers, faction);
    const candidates = (0, selectors_1.getAdjacentEnemyRegions)(state, faction.id)
        .map((region) => ({
        region,
        ratio: attackPower / Math.max(1, (0, selectors_1.estimateRegionDefense)(state, region.id)),
    }))
        .sort((a, b) => b.ratio - a.ratio);
    const target = candidates.find((candidate) => candidate.ratio >= invasionThreshold(state, faction, candidate.region));
    if (!target) {
        return null;
    }
    const beforeOwner = state.factions[target.region.ownerFactionId]?.name ?? '不明勢力';
    let next = {
        ...state,
        factions: {
            ...state.factions,
            [faction.id]: { ...faction, food: Math.max(0, faction.food - 45) },
        },
    };
    next = (0, battle_1.resolveBattle)(next, {
        attackerFactionId: faction.id,
        targetRegionId: target.region.id,
        attackerOfficerIds: attackers.map((officer) => officer.id),
    });
    const result = next.lastBattleResult;
    const message = result?.conquered === true
        ? `${faction.name}が${beforeOwner}の${target.region.name}を制圧した。`
        : `${faction.name}が${target.region.name}へ攻め込んだが、城を落とせなかった。`;
    return (0, log_1.addLog)(next, 'battle', message);
}
function runNpcRecruit(state, faction) {
    if (faction.gold < 36 || faction.food < 40) {
        return null;
    }
    const ownRegions = (0, selectors_1.getFactionRegions)(state, faction.id);
    if (ownRegions.length === 0) {
        return null;
    }
    const target = [...ownRegions].sort((a, b) => a.localTroops + a.castleHp * 3 - (b.localTroops + b.castleHp * 3))[0];
    const recruitAmount = state.difficulty === 'hard' ? 135 : state.difficulty === 'easy' ? 90 : 110;
    return {
        ...state,
        regions: {
            ...state.regions,
            [target.id]: {
                ...target,
                localTroops: target.localTroops + recruitAmount,
                publicOrder: Math.max(25, target.publicOrder - 2),
            },
        },
        factions: {
            ...state.factions,
            [faction.id]: {
                ...faction,
                gold: faction.gold - 36,
                food: faction.food - 40,
            },
        },
    };
}
function runNpcDomestic(state, faction) {
    const ownRegions = (0, selectors_1.getFactionRegions)(state, faction.id);
    if (ownRegions.length === 0) {
        return null;
    }
    const target = [...ownRegions].sort((a, b) => {
        const aNeed = (a.maxCastleHp - a.castleHp) * 1.1 + (100 - a.publicOrder) + (8 - a.developmentLevel) * 4;
        const bNeed = (b.maxCastleHp - b.castleHp) * 1.1 + (100 - b.publicOrder) + (8 - b.developmentLevel) * 4;
        return bNeed - aNeed;
    })[0];
    const repaired = target.castleHp < target.maxCastleHp;
    return {
        ...state,
        regions: {
            ...state.regions,
            [target.id]: repaired
                ? { ...target, castleHp: Math.min(target.maxCastleHp, target.castleHp + 18), publicOrder: Math.min(100, target.publicOrder + 2) }
                : {
                    ...target,
                    riceYield: Math.min(150, target.riceYield + 5),
                    publicOrder: Math.min(100, target.publicOrder + 3),
                    developmentLevel: Math.min(8, target.developmentLevel + (target.developmentLevel < 5 ? 1 : 0)),
                },
        },
    };
}
function runNpcAction(state, faction) {
    const ownRegions = (0, selectors_1.getFactionRegions)(state, faction.id);
    if (ownRegions.length === 0) {
        return state;
    }
    const lowFood = faction.food < ownRegions.length * 95;
    const weakestCastle = ownRegions.some((region) => region.castleHp < region.maxCastleHp * 0.45);
    const shouldDefend = ownRegions.length <= 1 || lowFood || weakestCastle;
    const aggression = {
        aggressive: 0.7,
        opportunist: 0.58,
        balanced: 0.46,
        domestic: 0.28,
    }[faction.aiPersonality];
    const attackBias = (0, random_1.clamp)(aggression + ((0, selectors_1.getPlayerRegions)(state).length >= 6 ? 0.08 : 0), 0.2, 0.78);
    if (!shouldDefend) {
        const attack = runNpcInvasion(state, faction);
        if (attack && attack.lastBattleResult?.conquered) {
            return attack;
        }
        if (attack && attack.lastBattleResult && attackBias >= 0.55) {
            return attack;
        }
    }
    const recruit = runNpcRecruit(state, state.factions[faction.id]);
    if (recruit && (shouldDefend || faction.aiPersonality !== 'domestic')) {
        return recruit;
    }
    return runNpcDomestic(state, state.factions[faction.id]) ?? state;
}
function runNpcTurn(state) {
    let next = state;
    const npcFactions = Object.values(next.factions).filter((faction) => faction.isMajor && !faction.isPlayer);
    npcFactions.forEach((faction) => {
        if (next.gameStatus !== 'playing') {
            return;
        }
        if ((0, selectors_1.getFactionRegions)(next, faction.id).length === 0) {
            return;
        }
        next = (0, economy_1.applyFactionIncome)(next, faction.id);
        next = (0, economy_1.applyRegionAttrition)(next, faction.id);
        const actionCount = faction.aiPersonality === 'aggressive' && next.difficulty !== 'easy' ? 2 : 1;
        for (let index = 0; index < actionCount; index += 1) {
            next = runNpcAction(next, next.factions[faction.id]);
        }
    });
    return next;
}
