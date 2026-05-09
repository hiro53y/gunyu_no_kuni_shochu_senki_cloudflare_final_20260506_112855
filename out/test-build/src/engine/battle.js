"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveBattle = resolveBattle;
const names_1 = require("../data/names");
const random_1 = require("./random");
const selectors_1 = require("./selectors");
const terrainDefense = {
    plain: 1,
    forest: 1.1,
    mountain: 1.18,
    river: 1.14,
    coast: 1.06,
};
function collectEffects(officers, mode) {
    return officers.reduce((acc, officer) => {
        officer.skills.forEach((skillId) => {
            const skill = names_1.skillCatalog[skillId];
            if (!skill) {
                return;
            }
            const applies = skill.trigger === 'battle' ||
                (mode === 'attack' && skill.trigger === 'attack') ||
                (mode === 'defense' && skill.trigger === 'defense');
            if (!applies) {
                return;
            }
            acc.names.push(`${officer.name}「${skill.name}」`);
            acc.multiplier *= skill.effect.attackMultiplier ?? 1;
            acc.multiplier *= skill.effect.defenseMultiplier ?? 1;
            acc.damageReduction += skill.effect.damageReduction ?? 0;
            acc.enemyDebuff += skill.effect.enemyDebuff ?? 0;
            acc.moraleBonus += skill.effect.moraleBonus ?? 0;
            acc.sabotageRate += skill.effect.sabotageRate ?? 0;
        });
        return acc;
    }, { multiplier: 1, damageReduction: 0, enemyDebuff: 0, moraleBonus: 0, sabotageRate: 0, names: [] });
}
function staminaFactor(officer) {
    if (officer.stamina >= 50) {
        return 1;
    }
    return (0, random_1.clamp)(0.68 + officer.stamina / 155, 0.72, 0.98);
}
function officerPower(officer, mode) {
    const commandFactor = 0.58 + officer.command / 125;
    const valorFactor = mode === 'attack' ? 0.72 + officer.valor / 150 : 0.82 + officer.valor / 190;
    const wisdomFactor = 0.9 + officer.wisdom / 500;
    return officer.troops * commandFactor * valorFactor * wisdomFactor * staminaFactor(officer);
}
function addOfficerExperience(officer, expGain) {
    const totalExp = Math.max(0, officer.exp + expGain);
    const levelGain = Math.floor(totalExp / 100);
    if (levelGain <= 0) {
        return { ...officer, exp: totalExp };
    }
    return {
        ...officer,
        level: officer.level + levelGain,
        exp: totalExp % 100,
        maxTroops: officer.maxTroops + levelGain * 25,
    };
}
function selectDefenders(state, targetRegionId) {
    const region = state.regions[targetRegionId];
    const regionDefenders = (0, selectors_1.getRegionOfficers)(state, targetRegionId);
    if (regionDefenders.length > 0) {
        return [...regionDefenders]
            .sort((a, b) => b.command + b.valor + b.wisdom - (a.command + a.valor + a.wisdom))
            .slice(0, 3);
    }
    return (0, selectors_1.getFactionOfficers)(state, region.ownerFactionId)
        .sort((a, b) => b.command + b.valor - (a.command + a.valor))
        .slice(0, 2);
}
function distributeLosses(officers, ids, totalLosses) {
    const participants = [];
    const totalBefore = ids.reduce((sum, id) => sum + (officers[id]?.troops ?? 0), 0);
    let actualLosses = 0;
    ids.forEach((id) => {
        const officer = officers[id];
        if (!officer) {
            return;
        }
        const share = totalBefore > 0 ? officer.troops / totalBefore : 0;
        const loss = Math.min(officer.troops, Math.round(totalLosses * share));
        const after = Math.max(0, officer.troops - loss);
        officers[id] = addOfficerExperience({
            ...officer,
            troops: after,
            stamina: Math.max(5, officer.stamina - (loss > 0 ? 18 : 10)),
            status: after <= 0 ? 'wounded' : officer.status,
        }, Math.round(12 + loss / 12));
        participants.push({ officerId: id, name: officer.name, troopsBefore: officer.troops, troopsAfter: after });
        actualLosses += officer.troops - after;
    });
    return { participants, actualLosses };
}
function buildHint(conquered, attackerPower, defenderPower, castleHpAfter) {
    if (conquered) {
        return '制圧直後は城と治安が低い。内政か休養で反撃に備えると安定する。';
    }
    if (attackerPower > defenderPower) {
        return `城耐久が残った。残り${castleHpAfter}まで削れているため、訓練後の再侵攻が有効。`;
    }
    return '戦力差が厳しい。徴兵、訓練、士気回復、別方面の攻略を検討。';
}
function resolveBattle(state, input) {
    const targetRegion = state.regions[input.targetRegionId];
    const defenderFaction = state.factions[targetRegion.ownerFactionId];
    const attackerFaction = state.factions[input.attackerFactionId];
    const attackerOfficers = input.attackerOfficerIds
        .map((id) => state.officers[id])
        .filter((officer) => Boolean(officer) && officer.status === 'active' && officer.troops > 0)
        .slice(0, 3);
    const defenderOfficers = selectDefenders(state, input.targetRegionId);
    const attackEffects = collectEffects(attackerOfficers, 'attack');
    const defenseEffects = collectEffects(defenderOfficers, 'defense');
    const attackerTroops = attackerOfficers.reduce((sum, officer) => sum + officer.troops, 0);
    const defenderOfficerTroops = defenderOfficers.reduce((sum, officer) => sum + officer.troops, 0);
    const sabotagedTroops = Math.round(targetRegion.localTroops * (0, random_1.clamp)(attackEffects.sabotageRate, 0, 0.16));
    const defenderLocalTroops = Math.max(0, targetRegion.localTroops - sabotagedTroops);
    const defenderTroops = defenderOfficerTroops + defenderLocalTroops;
    let seed = state.rngSeed;
    const attackRoll = (0, random_1.boundedRandomMultiplier)(seed, 0.15);
    seed = attackRoll.seed;
    const defenseRoll = (0, random_1.boundedRandomMultiplier)(seed, 0.15);
    seed = defenseRoll.seed;
    const attackerBase = attackerOfficers.reduce((sum, officer) => sum + officerPower(officer, 'attack'), 0);
    const defenderOfficerBase = defenderOfficers.reduce((sum, officer) => sum + officerPower(officer, 'defense'), 0);
    const castleFactor = 1 + (targetRegion.castleHp / targetRegion.maxCastleHp) * 0.46;
    const defenderBase = defenderOfficerBase +
        defenderLocalTroops * terrainDefense[targetRegion.terrain] * castleFactor * (0.94 + defenderFaction.morale / 240);
    const attackMorale = 0.78 + (attackerFaction.morale + attackEffects.moraleBonus) / 145;
    const defenseMorale = 0.78 + (defenderFaction.morale + defenseEffects.moraleBonus) / 145;
    const attackerPower = Math.round(attackerBase * attackMorale * attackEffects.multiplier * (1 - defenseEffects.enemyDebuff) * attackRoll.value);
    const defenderPower = Math.round(defenderBase * defenseMorale * defenseEffects.multiplier * (1 - attackEffects.enemyDebuff) * defenseRoll.value);
    const pressure = (0, random_1.clamp)(attackerPower / Math.max(1, defenderPower), 0.25, 2.5);
    const castleDamage = Math.round((0, random_1.clamp)(18 + pressure * 24 + attackerTroops / 95, 12, 72));
    const castleHpAfter = Math.max(0, targetRegion.castleHp - castleDamage);
    const conquered = castleHpAfter <= 0 && attackerPower >= defenderPower * 0.74;
    const victory = conquered;
    const attackerLossRate = (0, random_1.clamp)((victory ? 0.08 : 0.15) + defenderPower / Math.max(1, attackerPower) * 0.08 - attackEffects.damageReduction, 0.05, 0.36);
    const defenderLossRate = (0, random_1.clamp)((victory ? 0.22 : 0.12) + attackerPower / Math.max(1, defenderPower) * 0.07 - defenseEffects.damageReduction, 0.06, 0.42);
    const attackerLossTarget = Math.round(attackerTroops * attackerLossRate);
    const defenderLossTarget = Math.round(defenderTroops * defenderLossRate) + sabotagedTroops;
    const officers = { ...state.officers };
    const attackerLosses = distributeLosses(officers, attackerOfficers.map((officer) => officer.id), attackerLossTarget);
    const defenderOfficerLossShare = defenderTroops > 0 ? defenderOfficerTroops / defenderTroops : 0;
    const defenderOfficerLosses = distributeLosses(officers, defenderOfficers.map((officer) => officer.id), Math.round(defenderLossTarget * defenderOfficerLossShare));
    const defenderLocalLosses = Math.min(targetRegion.localTroops, Math.round(defenderLossTarget * (1 - defenderOfficerLossShare)));
    const remainingLocalTroops = Math.max(0, targetRegion.localTroops - defenderLocalLosses - sabotagedTroops);
    const regions = { ...state.regions };
    regions[targetRegion.id] = {
        ...targetRegion,
        ownerFactionId: conquered ? input.attackerFactionId : targetRegion.ownerFactionId,
        castleHp: conquered ? Math.max(18, Math.round(targetRegion.maxCastleHp * 0.28)) : castleHpAfter,
        publicOrder: conquered ? Math.max(35, targetRegion.publicOrder - 16) : targetRegion.publicOrder,
        localTroops: conquered ? Math.max(80, Math.round(attackerTroops * 0.08)) : remainingLocalTroops,
    };
    if (conquered) {
        const retreatRegion = Object.values(state.regions).find((region) => region.id !== targetRegion.id && region.ownerFactionId === targetRegion.ownerFactionId);
        defenderOfficers.forEach((officer) => {
            const current = officers[officer.id];
            if (!current) {
                return;
            }
            officers[officer.id] = retreatRegion
                ? { ...current, locationRegionId: retreatRegion.id }
                : {
                    ...current,
                    factionId: names_1.RONIN_FACTION_ID,
                    locationRegionId: null,
                    status: current.troops > 0 ? 'ronin' : current.status,
                    loyalty: Math.min(current.loyalty, 45),
                };
        });
        attackerOfficers.forEach((officer) => {
            const current = officers[officer.id];
            if (current?.status === 'active') {
                officers[officer.id] = addOfficerExperience({ ...current, locationRegionId: targetRegion.id }, 18);
            }
        });
    }
    const activatedSkills = [...attackEffects.names, ...defenseEffects.names];
    if (sabotagedTroops > 0) {
        activatedSkills.push(`調略で守備兵${sabotagedTroops}を切り崩し`);
    }
    const result = {
        id: `battle_${state.turn}_${Date.now()}`,
        turn: state.turn,
        attackerFactionId: input.attackerFactionId,
        defenderFactionId: targetRegion.ownerFactionId,
        targetRegionId: targetRegion.id,
        targetRegionName: targetRegion.name,
        victory,
        conquered,
        attackerPower,
        defenderPower,
        attackerLosses: attackerLosses.actualLosses,
        defenderLosses: defenderOfficerLosses.actualLosses + defenderLocalLosses + sabotagedTroops,
        castleDamage,
        castleHpBefore: targetRegion.castleHp,
        castleHpAfter: conquered ? regions[targetRegion.id].castleHp : castleHpAfter,
        attackerParticipants: attackerLosses.participants,
        defenderParticipants: defenderOfficerLosses.participants,
        activatedSkills,
        hint: buildHint(conquered, attackerPower, defenderPower, castleHpAfter),
    };
    return {
        ...state,
        rngSeed: seed,
        regions,
        officers,
        lastBattleResult: result,
        stats: {
            ...state.stats,
            totalBattles: state.stats.totalBattles + 1,
        },
    };
}
