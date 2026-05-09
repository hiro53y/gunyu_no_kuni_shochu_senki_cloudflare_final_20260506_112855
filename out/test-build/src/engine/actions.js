"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performDomestic = performDomestic;
exports.performRecruitTroops = performRecruitTroops;
exports.performTrain = performTrain;
exports.performSearch = performSearch;
exports.performHire = performHire;
exports.performInvade = performInvade;
exports.performRest = performRest;
exports.endPlayerTurn = endPlayerTurn;
exports.selectRegion = selectRegion;
exports.toggleOfficerSelection = toggleOfficerSelection;
exports.newGame = newGame;
const names_1 = require("../data/names");
const battle_1 = require("./battle");
const economy_1 = require("./economy");
const log_1 = require("./log");
const npc_1 = require("./npc");
const random_1 = require("./random");
const selectors_1 = require("./selectors");
const victory_1 = require("./victory");
const DOMESTIC_AP_COST = 1;
const RECRUIT_AP_COST = 1;
const TRAIN_AP_COST = 1;
const SEARCH_AP_COST = 1;
const HIRE_AP_COST = 1;
const INVADE_AP_COST = 1;
const REST_AP_COST = 1;
function ok(state, message) {
    return { state, ok: true, message };
}
function fail(state, message) {
    return { state: (0, log_1.addLog)(state, 'warning', message), ok: false, message };
}
function requirePlaying(state) {
    if (state.gameStatus !== 'playing') {
        return 'ゲーム終了後は行動できない。';
    }
    if (state.phase !== 'player') {
        return 'NPC処理中は行動できない。';
    }
    return null;
}
function requireAp(state, cost) {
    return state.actionPoints >= cost ? null : `APが不足している。必要AP: ${cost}`;
}
function spendAp(state, cost) {
    return { ...state, actionPoints: Math.max(0, state.actionPoints - cost) };
}
function selectedOrBestOfficer(state, score) {
    const selected = (0, selectors_1.getSelectedOfficers)(state).filter((officer) => officer.factionId === names_1.PLAYER_FACTION_ID && officer.stamina >= 10);
    if (selected.length > 0) {
        return [...selected].sort((a, b) => score(b) - score(a))[0];
    }
    return Object.values(state.officers)
        .filter((officer) => officer.factionId === names_1.PLAYER_FACTION_ID && officer.status === 'active' && officer.stamina >= 10)
        .sort((a, b) => score(b) - score(a))[0] ?? null;
}
function isPlayerRegion(state, region) {
    return region.ownerFactionId === names_1.PLAYER_FACTION_ID;
}
function updateOfficerAfterTask(officer, staminaCost, expGain) {
    const nextExp = officer.exp + expGain;
    const levelUp = nextExp >= 100;
    return {
        ...officer,
        stamina: Math.max(0, officer.stamina - staminaCost),
        exp: levelUp ? nextExp - 100 : nextExp,
        level: levelUp ? officer.level + 1 : officer.level,
        maxTroops: levelUp ? officer.maxTroops + 25 : officer.maxTroops,
    };
}
function isRestTarget(officer) {
    return officer.factionId === names_1.PLAYER_FACTION_ID && (officer.status === 'active' || officer.status === 'wounded');
}
function officerSkillMultiplier(officer, focus) {
    return officer.skills.reduce((multiplier, skillId) => {
        const skill = names_1.skillCatalog[skillId];
        if (!skill) {
            return multiplier;
        }
        if (skill.trigger === 'domestic') {
            multiplier *= skill.effect.domesticMultiplier ?? 1;
            if (focus === 'castleHp') {
                multiplier *= skill.effect.castleRepairMultiplier ?? 1;
            }
        }
        return multiplier;
    }, 1);
}
function performDomestic(state, focus) {
    const guard = requirePlaying(state) ?? requireAp(state, DOMESTIC_AP_COST);
    if (guard) {
        return fail(state, guard);
    }
    const region = state.regions[state.selectedRegionId];
    if (!region || !isPlayerRegion(state, region)) {
        return fail(state, '内政は自勢力の地域を選んで実行する。');
    }
    const officer = selectedOrBestOfficer(state, (item) => item.politics * 1.4 + item.wisdom + item.charisma * 0.4);
    if (!officer) {
        return fail(state, '担当できる武将がいない。');
    }
    const amount = Math.round((7 + officer.politics * 0.14 + officer.wisdom * 0.04) * officerSkillMultiplier(officer, focus));
    let next = spendAp(state, DOMESTIC_AP_COST);
    next = {
        ...next,
        regions: {
            ...next.regions,
            [region.id]: (0, economy_1.improveRegion)(region, focus, amount),
        },
        officers: {
            ...next.officers,
            [officer.id]: updateOfficerAfterTask(officer, 11, 12),
        },
    };
    next = (0, log_1.addLog)(next, 'action', `${officer.name}が${region.name}で内政を実施した。`);
    return ok((0, victory_1.checkGameStatus)(next), '内政を実行した。');
}
function performRecruitTroops(state) {
    const guard = requirePlaying(state) ?? requireAp(state, RECRUIT_AP_COST);
    if (guard) {
        return fail(state, guard);
    }
    const region = state.regions[state.selectedRegionId];
    const faction = (0, selectors_1.getPlayerFaction)(state);
    if (!region || !isPlayerRegion(state, region)) {
        return fail(state, '徴兵は自勢力の地域で実行する。');
    }
    if (faction.gold < 42 || faction.food < 36) {
        return fail(state, '徴兵には金42・兵糧36が必要。');
    }
    if (region.publicOrder < 35) {
        return fail(state, '治安が低すぎる。先に内政で治安を整える必要がある。');
    }
    const officer = selectedOrBestOfficer(state, (item) => item.charisma + item.command * 0.5 + item.politics * 0.4);
    const bonus = officer ? Math.round(officer.charisma * 0.5) : 0;
    const amount = 115 + bonus;
    let next = spendAp(state, RECRUIT_AP_COST);
    next = {
        ...next,
        regions: {
            ...next.regions,
            [region.id]: {
                ...region,
                localTroops: region.localTroops + amount,
                publicOrder: Math.max(20, region.publicOrder - 5),
            },
        },
        factions: {
            ...next.factions,
            [names_1.PLAYER_FACTION_ID]: {
                ...faction,
                gold: faction.gold - 42,
                food: faction.food - 36,
            },
        },
        officers: officer
            ? {
                ...next.officers,
                [officer.id]: updateOfficerAfterTask(officer, 8, 8),
            }
            : next.officers,
    };
    next = (0, log_1.addLog)(next, 'action', `${region.name}で${amount}の兵を集めた。治安は少し低下。`);
    return ok((0, victory_1.checkGameStatus)(next), '徴兵を実行した。');
}
function performTrain(state) {
    const guard = requirePlaying(state) ?? requireAp(state, TRAIN_AP_COST);
    if (guard) {
        return fail(state, guard);
    }
    const selected = (0, selectors_1.getSelectedOfficers)(state).filter((officer) => officer.factionId === names_1.PLAYER_FACTION_ID && officer.status === 'active');
    const targets = selected.length > 0
        ? selected.slice(0, 3)
        : Object.values(state.officers)
            .filter((officer) => officer.factionId === names_1.PLAYER_FACTION_ID && officer.status === 'active')
            .slice(0, 3);
    if (targets.length === 0) {
        return fail(state, '訓練できる武将がいない。');
    }
    const faction = (0, selectors_1.getPlayerFaction)(state);
    const foodCost = 24 + targets.length * 12;
    if (faction.food < foodCost) {
        return fail(state, `訓練には兵糧${foodCost}が必要。`);
    }
    const officers = { ...state.officers };
    let trained = 0;
    targets.forEach((officer) => {
        const skillMultiplier = officer.skills.reduce((multi, skillId) => {
            const skill = names_1.skillCatalog[skillId];
            return skill?.trigger === 'train' ? multi * (skill.effect.trainMultiplier ?? 1) : multi;
        }, 1);
        const gain = Math.round((38 + officer.command * 0.55) * skillMultiplier);
        const updated = updateOfficerAfterTask(officer, 12, 16);
        officers[officer.id] = {
            ...updated,
            troops: Math.min(updated.maxTroops, officer.troops + gain),
        };
        trained += gain;
    });
    let next = spendAp(state, TRAIN_AP_COST);
    next = {
        ...next,
        officers,
        factions: {
            ...next.factions,
            [names_1.PLAYER_FACTION_ID]: {
                ...faction,
                food: faction.food - foodCost,
                morale: (0, random_1.clamp)(faction.morale + 3, 25, 95),
            },
        },
    };
    next = (0, log_1.addLog)(next, 'action', `${targets.length}人を訓練し、兵${trained}と士気を高めた。`);
    return ok((0, victory_1.checkGameStatus)(next), '訓練を実行した。');
}
function performSearch(state) {
    const guard = requirePlaying(state) ?? requireAp(state, SEARCH_AP_COST);
    if (guard) {
        return fail(state, guard);
    }
    const region = state.regions[state.selectedRegionId];
    if (!region || !isPlayerRegion(state, region)) {
        return fail(state, '探索は自勢力の地域で実行する。');
    }
    const officer = selectedOrBestOfficer(state, (item) => item.wisdom * 1.1 + item.charisma);
    if (!officer) {
        return fail(state, '探索を担当できる武将がいない。');
    }
    const searchSkill = officer.skills.reduce((sum, skillId) => sum + (names_1.skillCatalog[skillId]?.effect.searchChanceBonus ?? 0), 0);
    const probability = (0, random_1.clamp)(0.36 + officer.wisdom / 320 + officer.charisma / 500 + searchSkill, 0.3, 0.86);
    let roll = (0, random_1.chance)(state.rngSeed, probability);
    let seed = roll.seed;
    let next = spendAp(state, SEARCH_AP_COST);
    next = {
        ...next,
        rngSeed: seed,
        officers: {
            ...next.officers,
            [officer.id]: updateOfficerAfterTask(officer, 10, 10),
        },
    };
    if (roll.value) {
        const hiddenRonin = (0, selectors_1.getHiddenRonin)(next);
        const pick = (0, random_1.pickOne)(seed, hiddenRonin);
        seed = pick.seed;
        if (pick.value) {
            const found = pick.value;
            next = {
                ...next,
                rngSeed: seed,
                officers: {
                    ...next.officers,
                    [found.id]: {
                        ...found,
                        status: 'available',
                        locationRegionId: region.id,
                    },
                },
            };
            next = (0, log_1.addLog)(next, 'event', `${officer.name}が${found.name}を発見した。登用を試みられる。`);
            return ok(next, '浪人武将を発見した。');
        }
    }
    const rewardRoll = (0, random_1.randomInt)(seed, 50, 120);
    seed = rewardRoll.seed;
    const faction = (0, selectors_1.getPlayerFaction)(next);
    next = {
        ...next,
        rngSeed: seed,
        factions: {
            ...next.factions,
            [names_1.PLAYER_FACTION_ID]: {
                ...faction,
                gold: faction.gold + rewardRoll.value,
            },
        },
    };
    next = (0, log_1.addLog)(next, 'event', `${officer.name}の探索で金${rewardRoll.value}を得た。`);
    return ok(next, '探索を実行した。');
}
function performHire(state, officerId) {
    const guard = requirePlaying(state) ?? requireAp(state, HIRE_AP_COST);
    if (guard) {
        return fail(state, guard);
    }
    const candidates = (0, selectors_1.getAvailableRonin)(state);
    const target = officerId ? state.officers[officerId] : candidates[0];
    if (!target || target.status !== 'available') {
        return fail(state, '登用できる浪人がいない。探索で候補を探す必要がある。');
    }
    const targetRegion = target.locationRegionId ? state.regions[target.locationRegionId] : null;
    if (!targetRegion || targetRegion.ownerFactionId !== names_1.PLAYER_FACTION_ID) {
        return fail(state, '登用候補は自勢力地域に滞在している必要がある。');
    }
    const faction = (0, selectors_1.getPlayerFaction)(state);
    const cost = 58;
    if (faction.gold < cost) {
        return fail(state, `登用には金${cost}が必要。`);
    }
    const negotiator = selectedOrBestOfficer(state, (item) => item.charisma * 1.2 + item.wisdom);
    const skillBonus = negotiator?.skills.reduce((sum, skillId) => sum + (names_1.skillCatalog[skillId]?.effect.hireChanceBonus ?? 0), 0) ?? 0;
    const probability = (0, random_1.clamp)(0.34 + (negotiator?.charisma ?? 50) / 360 + (negotiator?.wisdom ?? 50) / 520 + skillBonus - target.level * 0.03, 0.28, 0.86);
    const roll = (0, random_1.chance)(state.rngSeed, probability);
    const regionId = targetRegion.id;
    const goldAfter = faction.gold - cost;
    let next = spendAp({
        ...state,
        rngSeed: roll.seed,
        factions: {
            ...state.factions,
            [names_1.PLAYER_FACTION_ID]: { ...faction, gold: goldAfter },
        },
    }, HIRE_AP_COST);
    if (!roll.value) {
        next = (0, log_1.addLog)(next, 'event', `${target.name}の登用は不調に終わった。`);
        return ok(next, '登用は失敗した。');
    }
    next = {
        ...next,
        officers: {
            ...next.officers,
            [target.id]: {
                ...target,
                factionId: names_1.PLAYER_FACTION_ID,
                locationRegionId: regionId,
                status: 'active',
                loyalty: 68,
            },
        },
        selectedOfficerIds: [...new Set([...next.selectedOfficerIds, target.id])].slice(0, 3),
        stats: {
            ...next.stats,
            recruitedOfficers: next.stats.recruitedOfficers + 1,
        },
    };
    next = (0, log_1.addLog)(next, 'event', `${target.name}が暁ノ家に加わった。`);
    return ok(next, '登用に成功した。');
}
function performInvade(state) {
    const guard = requirePlaying(state) ?? requireAp(state, INVADE_AP_COST);
    if (guard) {
        return fail(state, guard);
    }
    const target = state.regions[state.selectedRegionId];
    if (!target || target.ownerFactionId === names_1.PLAYER_FACTION_ID) {
        return fail(state, '進軍先として隣接する敵地域を選ぶ。');
    }
    if (!(0, selectors_1.canFactionReachRegion)(state, names_1.PLAYER_FACTION_ID, target.id)) {
        return fail(state, 'その地域は自勢力の支配地に隣接していない。');
    }
    const attackers = (0, selectors_1.getSelectedOfficers)(state)
        .filter((officer) => officer.factionId === names_1.PLAYER_FACTION_ID && officer.status === 'active' && officer.troops > 0 && officer.stamina >= 18)
        .slice(0, 3);
    if (attackers.length === 0) {
        return fail(state, '進軍には兵を率いる武将を1人以上選ぶ必要がある。');
    }
    const faction = (0, selectors_1.getPlayerFaction)(state);
    if (faction.food < 50) {
        return fail(state, '進軍には兵糧50が必要。');
    }
    const defenderName = state.factions[target.ownerFactionId]?.name ?? '不明勢力';
    let next = spendAp(state, INVADE_AP_COST);
    next = {
        ...next,
        factions: {
            ...next.factions,
            [names_1.PLAYER_FACTION_ID]: {
                ...faction,
                food: faction.food - 50,
            },
        },
    };
    next = (0, battle_1.resolveBattle)(next, {
        attackerFactionId: names_1.PLAYER_FACTION_ID,
        targetRegionId: target.id,
        attackerOfficerIds: attackers.map((officer) => officer.id),
    });
    const result = next.lastBattleResult;
    const message = result?.conquered === true
        ? `${defenderName}の${target.name}を制圧した。`
        : `${target.name}を攻めたが城は落ちなかった。`;
    next = (0, log_1.addLog)(next, 'battle', message);
    next = refreshDefeatedFactions(next);
    return ok((0, victory_1.checkGameStatus)(next), result?.conquered ? '進軍に勝利した。' : '進軍は撃退された。');
}
function performRest(state) {
    const guard = requirePlaying(state) ?? requireAp(state, REST_AP_COST);
    if (guard) {
        return fail(state, guard);
    }
    const selected = state.selectedOfficerIds
        .map((id) => state.officers[id])
        .filter((officer) => Boolean(officer) && isRestTarget(officer));
    const targets = selected.length > 0
        ? selected.slice(0, 3)
        : Object.values(state.officers)
            .filter(isRestTarget)
            .sort((a, b) => {
            if (a.status === 'wounded' && b.status !== 'wounded') {
                return -1;
            }
            if (a.status !== 'wounded' && b.status === 'wounded') {
                return 1;
            }
            return a.stamina - b.stamina;
        })
            .slice(0, 3);
    if (targets.length === 0) {
        return fail(state, '休養できる武将がいない。');
    }
    const officers = { ...state.officers };
    targets.forEach((officer) => {
        officers[officer.id] = {
            ...officer,
            status: officer.status === 'wounded' ? 'active' : officer.status,
            stamina: Math.min(officer.maxStamina, Math.max(28, officer.stamina + 34)),
        };
    });
    let next = spendAp(state, REST_AP_COST);
    next = {
        ...next,
        officers,
        factions: {
            ...next.factions,
            [names_1.PLAYER_FACTION_ID]: {
                ...(0, selectors_1.getPlayerFaction)(next),
                morale: (0, random_1.clamp)((0, selectors_1.getPlayerFaction)(next).morale + 2, 25, 95),
            },
        },
    };
    next = (0, log_1.addLog)(next, 'action', `${targets.length}人が休養し、スタミナを回復した。`);
    return ok(next, '休養を実行した。');
}
function applyRandomEvent(state) {
    const eventChance = state.difficulty === 'hard' ? 0.3 : state.difficulty === 'easy' ? 0.22 : 0.26;
    let eventRoll = (0, random_1.chance)(state.rngSeed, eventChance);
    let seed = eventRoll.seed;
    if (!eventRoll.value) {
        return { ...state, rngSeed: seed };
    }
    const eventPick = (0, random_1.pickWeighted)(seed, names_1.randomEvents);
    seed = eventPick.seed;
    const event = eventPick.value;
    if (!event) {
        return { ...state, rngSeed: seed };
    }
    let next = { ...state, rngSeed: seed };
    const faction = (0, selectors_1.getPlayerFaction)(next);
    const playerRegions = (0, selectors_1.getPlayerRegions)(next);
    if (event.id === 'goodHarvest') {
        next = {
            ...next,
            factions: { ...next.factions, [names_1.PLAYER_FACTION_ID]: { ...faction, food: faction.food + 180 } },
        };
    }
    else if (event.id === 'badHarvest') {
        next = {
            ...next,
            factions: { ...next.factions, [names_1.PLAYER_FACTION_ID]: { ...faction, food: Math.max(0, faction.food - 130) } },
        };
    }
    else if (event.id === 'merchant') {
        const buy = faction.gold >= 45;
        next = {
            ...next,
            factions: {
                ...next.factions,
                [names_1.PLAYER_FACTION_ID]: {
                    ...faction,
                    gold: buy ? faction.gold - 45 : faction.gold,
                    food: faction.food + (buy ? 170 : 70),
                },
            },
        };
    }
    else if (event.id === 'ronin') {
        const hidden = (0, selectors_1.getHiddenRonin)(next);
        const pick = (0, random_1.pickOne)(seed, hidden);
        seed = pick.seed;
        if (pick.value) {
            const regionPick = (0, random_1.pickOne)(seed, playerRegions);
            seed = regionPick.seed;
            next = {
                ...next,
                rngSeed: seed,
                officers: {
                    ...next.officers,
                    [pick.value.id]: {
                        ...pick.value,
                        status: 'available',
                        locationRegionId: regionPick.value?.id ?? next.selectedRegionId,
                    },
                },
            };
        }
    }
    else if (event.id === 'uprising') {
        const target = [...playerRegions].sort((a, b) => a.publicOrder - b.publicOrder)[0];
        if (target) {
            next = {
                ...next,
                regions: {
                    ...next.regions,
                    [target.id]: {
                        ...target,
                        publicOrder: Math.max(20, target.publicOrder - 10),
                        localTroops: Math.max(40, target.localTroops - 70),
                    },
                },
            };
        }
    }
    else if (event.id === 'artisan') {
        const target = [...playerRegions].sort((a, b) => a.castleHp - b.castleHp)[0];
        if (target) {
            next = {
                ...next,
                regions: {
                    ...next.regions,
                    [target.id]: { ...target, castleHp: Math.min(target.maxCastleHp, target.castleHp + 28) },
                },
            };
        }
    }
    else if (event.id === 'rumor') {
        next = {
            ...next,
            factions: { ...next.factions, [names_1.PLAYER_FACTION_ID]: { ...faction, morale: Math.max(25, faction.morale - 5) } },
        };
    }
    else if (event.id === 'festival') {
        const regions = { ...next.regions };
        playerRegions.forEach((region) => {
            regions[region.id] = { ...region, publicOrder: Math.min(100, region.publicOrder + 5) };
        });
        next = {
            ...next,
            regions,
            factions: {
                ...next.factions,
                [names_1.PLAYER_FACTION_ID]: { ...faction, gold: Math.max(0, faction.gold - 32) },
            },
        };
    }
    return (0, log_1.addLog)(next, 'event', `${event.name}: ${event.description}`);
}
function refreshDefeatedFactions(state) {
    const defeated = (0, selectors_1.getDefeatedMajorFactions)(state);
    const newlyDefeated = defeated.filter((id) => !state.stats.defeatedFactions.includes(id));
    if (newlyDefeated.length === 0) {
        return state;
    }
    let next = {
        ...state,
        stats: {
            ...state.stats,
            defeatedFactions: defeated,
        },
    };
    newlyDefeated.forEach((id) => {
        next = (0, log_1.addLog)(next, 'system', `${state.factions[id].name}は滅亡した。`);
    });
    return next;
}
function endPlayerTurn(state) {
    const guard = requirePlaying(state);
    if (guard) {
        return fail(state, guard);
    }
    let next = (0, log_1.addLog)(state, 'system', `${state.turn}ターン目を終了。NPC勢力が動き出す。`);
    next = (0, economy_1.applyFactionIncome)(next, names_1.PLAYER_FACTION_ID);
    next = (0, economy_1.applyRegionAttrition)(next, names_1.PLAYER_FACTION_ID);
    next = applyRandomEvent(next);
    next = {
        ...next,
        phase: 'npc',
    };
    next = (0, npc_1.runNpcTurn)(next);
    next = refreshDefeatedFactions(next);
    next = (0, economy_1.applyMonthlyRecovery)(next);
    next = (0, victory_1.checkGameStatus)(next);
    if (next.gameStatus === 'playing') {
        next = {
            ...next,
            turn: next.turn + 1,
            phase: 'player',
            actionPoints: next.maxActionPoints,
            lastBattleResult: next.lastBattleResult,
        };
        next = (0, log_1.addLog)(next, 'economy', `${next.turn}ターン目の評定。APが回復した。`);
    }
    return ok(next, 'ターンを終了した。');
}
function selectRegion(state, regionId) {
    if (!state.regions[regionId]) {
        return state;
    }
    return { ...state, selectedRegionId: regionId };
}
function toggleOfficerSelection(state, officerId) {
    const officer = state.officers[officerId];
    if (!officer || officer.factionId !== names_1.PLAYER_FACTION_ID || officer.status !== 'active') {
        return state;
    }
    const selected = new Set(state.selectedOfficerIds);
    if (selected.has(officerId)) {
        selected.delete(officerId);
    }
    else if (selected.size < 3) {
        selected.add(officerId);
    }
    else {
        const [, second, third] = [...selected];
        selected.clear();
        if (second) {
            selected.add(second);
        }
        if (third) {
            selected.add(third);
        }
        selected.add(officerId);
    }
    return { ...state, selectedOfficerIds: [...selected] };
}
function newGame(difficulty, create) {
    return create(difficulty);
}
