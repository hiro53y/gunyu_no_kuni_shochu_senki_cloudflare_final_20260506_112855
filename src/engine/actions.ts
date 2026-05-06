import { PLAYER_FACTION_ID, RONIN_FACTION_ID, randomEvents, skillCatalog } from '../data/names';
import type { ActionOutcome, DomesticFocus, GameState, Officer, Region } from '../types/game';
import { resolveBattle } from './battle';
import { applyFactionIncome, applyMonthlyRecovery, applyRegionAttrition, improveRegion } from './economy';
import { addLog } from './log';
import { runNpcTurn } from './npc';
import { chance, clamp, pickOne, pickWeighted, randomInt } from './random';
import {
  canFactionReachRegion,
  getAvailableRonin,
  getDefeatedMajorFactions,
  getHiddenRonin,
  getPlayerFaction,
  getPlayerRegions,
  getSelectedOfficers,
} from './selectors';
import { checkGameStatus } from './victory';

const DOMESTIC_AP_COST = 1;
const RECRUIT_AP_COST = 1;
const TRAIN_AP_COST = 1;
const SEARCH_AP_COST = 1;
const HIRE_AP_COST = 1;
const INVADE_AP_COST = 1;
const REST_AP_COST = 1;

function ok(state: GameState, message: string): ActionOutcome {
  return { state, ok: true, message };
}

function fail(state: GameState, message: string): ActionOutcome {
  return { state: addLog(state, 'warning', message), ok: false, message };
}

function requirePlaying(state: GameState): string | null {
  if (state.gameStatus !== 'playing') {
    return 'ゲーム終了後は行動できない。';
  }
  if (state.phase !== 'player') {
    return 'NPC処理中は行動できない。';
  }
  return null;
}

function requireAp(state: GameState, cost: number): string | null {
  return state.actionPoints >= cost ? null : `APが不足している。必要AP: ${cost}`;
}

function spendAp(state: GameState, cost: number): GameState {
  return { ...state, actionPoints: Math.max(0, state.actionPoints - cost) };
}

function selectedOrBestOfficer(state: GameState, score: (officer: Officer) => number): Officer | null {
  const selected = getSelectedOfficers(state).filter((officer) => officer.factionId === PLAYER_FACTION_ID && officer.stamina >= 10);
  if (selected.length > 0) {
    return [...selected].sort((a, b) => score(b) - score(a))[0];
  }
  return Object.values(state.officers)
    .filter((officer) => officer.factionId === PLAYER_FACTION_ID && officer.status === 'active' && officer.stamina >= 10)
    .sort((a, b) => score(b) - score(a))[0] ?? null;
}

function isPlayerRegion(state: GameState, region: Region): boolean {
  return region.ownerFactionId === PLAYER_FACTION_ID;
}

function updateOfficerAfterTask(officer: Officer, staminaCost: number, expGain: number): Officer {
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

function officerSkillMultiplier(officer: Officer, focus: DomesticFocus): number {
  return officer.skills.reduce((multiplier, skillId) => {
    const skill = skillCatalog[skillId];
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

export function performDomestic(state: GameState, focus: DomesticFocus): ActionOutcome {
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
      [region.id]: improveRegion(region, focus, amount),
    },
    officers: {
      ...next.officers,
      [officer.id]: updateOfficerAfterTask(officer, 11, 12),
    },
  };
  next = addLog(next, 'action', `${officer.name}が${region.name}で内政を実施した。`);
  return ok(checkGameStatus(next), '内政を実行した。');
}

export function performRecruitTroops(state: GameState): ActionOutcome {
  const guard = requirePlaying(state) ?? requireAp(state, RECRUIT_AP_COST);
  if (guard) {
    return fail(state, guard);
  }
  const region = state.regions[state.selectedRegionId];
  const faction = getPlayerFaction(state);
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
      [PLAYER_FACTION_ID]: {
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
  next = addLog(next, 'action', `${region.name}で${amount}の兵を集めた。治安は少し低下。`);
  return ok(checkGameStatus(next), '徴兵を実行した。');
}

export function performTrain(state: GameState): ActionOutcome {
  const guard = requirePlaying(state) ?? requireAp(state, TRAIN_AP_COST);
  if (guard) {
    return fail(state, guard);
  }
  const selected = getSelectedOfficers(state).filter((officer) => officer.factionId === PLAYER_FACTION_ID && officer.status === 'active');
  const targets =
    selected.length > 0
      ? selected.slice(0, 3)
      : Object.values(state.officers)
          .filter((officer) => officer.factionId === PLAYER_FACTION_ID && officer.status === 'active')
          .slice(0, 3);
  if (targets.length === 0) {
    return fail(state, '訓練できる武将がいない。');
  }

  const faction = getPlayerFaction(state);
  const foodCost = 24 + targets.length * 12;
  if (faction.food < foodCost) {
    return fail(state, `訓練には兵糧${foodCost}が必要。`);
  }

  const officers = { ...state.officers };
  let trained = 0;
  targets.forEach((officer) => {
    const skillMultiplier = officer.skills.reduce((multi, skillId) => {
      const skill = skillCatalog[skillId];
      return skill?.trigger === 'train' ? multi * (skill.effect.trainMultiplier ?? 1) : multi;
    }, 1);
    const gain = Math.round((38 + officer.command * 0.55) * skillMultiplier);
    officers[officer.id] = {
      ...updateOfficerAfterTask(officer, 12, 16),
      troops: Math.min(officer.maxTroops, officer.troops + gain),
    };
    trained += gain;
  });

  let next = spendAp(state, TRAIN_AP_COST);
  next = {
    ...next,
    officers,
    factions: {
      ...next.factions,
      [PLAYER_FACTION_ID]: {
        ...faction,
        food: faction.food - foodCost,
        morale: clamp(faction.morale + 3, 25, 95),
      },
    },
  };
  next = addLog(next, 'action', `${targets.length}人を訓練し、兵${trained}と士気を高めた。`);
  return ok(checkGameStatus(next), '訓練を実行した。');
}

export function performSearch(state: GameState): ActionOutcome {
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

  const searchSkill = officer.skills.reduce((sum, skillId) => sum + (skillCatalog[skillId]?.effect.searchChanceBonus ?? 0), 0);
  const probability = clamp(0.36 + officer.wisdom / 320 + officer.charisma / 500 + searchSkill, 0.3, 0.86);
  let roll = chance(state.rngSeed, probability);
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
    const hiddenRonin = getHiddenRonin(next);
    const pick = pickOne(seed, hiddenRonin);
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
      next = addLog(next, 'event', `${officer.name}が${found.name}を発見した。登用を試みられる。`);
      return ok(next, '浪人武将を発見した。');
    }
  }

  const rewardRoll = randomInt(seed, 50, 120);
  seed = rewardRoll.seed;
  const faction = getPlayerFaction(next);
  next = {
    ...next,
    rngSeed: seed,
    factions: {
      ...next.factions,
      [PLAYER_FACTION_ID]: {
        ...faction,
        gold: faction.gold + rewardRoll.value,
      },
    },
  };
  next = addLog(next, 'event', `${officer.name}の探索で金${rewardRoll.value}を得た。`);
  return ok(next, '探索を実行した。');
}

export function performHire(state: GameState, officerId?: string): ActionOutcome {
  const guard = requirePlaying(state) ?? requireAp(state, HIRE_AP_COST);
  if (guard) {
    return fail(state, guard);
  }
  const candidates = getAvailableRonin(state);
  const target = officerId ? state.officers[officerId] : candidates[0];
  if (!target || target.status !== 'available') {
    return fail(state, '登用できる浪人がいない。探索で候補を探す必要がある。');
  }
  const targetRegion = target.locationRegionId ? state.regions[target.locationRegionId] : null;
  if (!targetRegion || targetRegion.ownerFactionId !== PLAYER_FACTION_ID) {
    return fail(state, '登用候補は自勢力地域に滞在している必要がある。');
  }
  const faction = getPlayerFaction(state);
  const cost = 58;
  if (faction.gold < cost) {
    return fail(state, `登用には金${cost}が必要。`);
  }

  const negotiator = selectedOrBestOfficer(state, (item) => item.charisma * 1.2 + item.wisdom);
  const skillBonus = negotiator?.skills.reduce((sum, skillId) => sum + (skillCatalog[skillId]?.effect.hireChanceBonus ?? 0), 0) ?? 0;
  const probability = clamp(
    0.34 + (negotiator?.charisma ?? 50) / 360 + (negotiator?.wisdom ?? 50) / 520 + skillBonus - target.level * 0.03,
    0.28,
    0.86,
  );
  const roll = chance(state.rngSeed, probability);
  const regionId = targetRegion.id;
  const goldAfter = faction.gold - cost;
  let next: GameState = spendAp(
    {
      ...state,
      rngSeed: roll.seed,
      factions: {
        ...state.factions,
        [PLAYER_FACTION_ID]: { ...faction, gold: goldAfter },
      },
    },
    HIRE_AP_COST,
  );

  if (!roll.value) {
    next = addLog(next, 'event', `${target.name}の登用は不調に終わった。`);
    return ok(next, '登用は失敗した。');
  }

  next = {
    ...next,
    officers: {
      ...next.officers,
      [target.id]: {
        ...target,
        factionId: PLAYER_FACTION_ID,
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
  next = addLog(next, 'event', `${target.name}が暁ノ家に加わった。`);
  return ok(next, '登用に成功した。');
}

export function performInvade(state: GameState): ActionOutcome {
  const guard = requirePlaying(state) ?? requireAp(state, INVADE_AP_COST);
  if (guard) {
    return fail(state, guard);
  }
  const target = state.regions[state.selectedRegionId];
  if (!target || target.ownerFactionId === PLAYER_FACTION_ID) {
    return fail(state, '進軍先として隣接する敵地域を選ぶ。');
  }
  if (!canFactionReachRegion(state, PLAYER_FACTION_ID, target.id)) {
    return fail(state, 'その地域は自勢力の支配地に隣接していない。');
  }
  const attackers = getSelectedOfficers(state)
    .filter((officer) => officer.factionId === PLAYER_FACTION_ID && officer.status === 'active' && officer.troops > 0 && officer.stamina >= 18)
    .slice(0, 3);
  if (attackers.length === 0) {
    return fail(state, '進軍には兵を率いる武将を1人以上選ぶ必要がある。');
  }
  const faction = getPlayerFaction(state);
  if (faction.food < 50) {
    return fail(state, '進軍には兵糧50が必要。');
  }

  const defenderName = state.factions[target.ownerFactionId]?.name ?? '不明勢力';
  let next = spendAp(state, INVADE_AP_COST);
  next = {
    ...next,
    factions: {
      ...next.factions,
      [PLAYER_FACTION_ID]: {
        ...faction,
        food: faction.food - 50,
      },
    },
  };
  next = resolveBattle(next, {
    attackerFactionId: PLAYER_FACTION_ID,
    targetRegionId: target.id,
    attackerOfficerIds: attackers.map((officer) => officer.id),
  });

  const result = next.lastBattleResult;
  const message =
    result?.conquered === true
      ? `${defenderName}の${target.name}を制圧した。`
      : `${target.name}を攻めたが城は落ちなかった。`;
  next = addLog(next, 'battle', message);
  next = refreshDefeatedFactions(next);
  return ok(checkGameStatus(next), result?.conquered ? '進軍に勝利した。' : '進軍は撃退された。');
}

export function performRest(state: GameState): ActionOutcome {
  const guard = requirePlaying(state) ?? requireAp(state, REST_AP_COST);
  if (guard) {
    return fail(state, guard);
  }
  const selected = getSelectedOfficers(state).filter((officer) => officer.factionId === PLAYER_FACTION_ID);
  const targets =
    selected.length > 0
      ? selected.slice(0, 3)
      : Object.values(state.officers)
          .filter((officer) => officer.factionId === PLAYER_FACTION_ID && officer.status === 'active')
          .sort((a, b) => a.stamina - b.stamina)
          .slice(0, 3);

  const officers = { ...state.officers };
  targets.forEach((officer) => {
    officers[officer.id] = {
      ...officer,
      status: officer.status === 'wounded' ? 'active' : officer.status,
      stamina: Math.min(officer.maxStamina, officer.stamina + 34),
    };
  });

  let next = spendAp(state, REST_AP_COST);
  next = {
    ...next,
    officers,
    factions: {
      ...next.factions,
      [PLAYER_FACTION_ID]: {
        ...getPlayerFaction(next),
        morale: clamp(getPlayerFaction(next).morale + 2, 25, 95),
      },
    },
  };
  next = addLog(next, 'action', `${targets.length}人が休養し、スタミナを回復した。`);
  return ok(next, '休養を実行した。');
}

function applyRandomEvent(state: GameState): GameState {
  const eventChance = state.difficulty === 'hard' ? 0.3 : state.difficulty === 'easy' ? 0.22 : 0.26;
  let eventRoll = chance(state.rngSeed, eventChance);
  let seed = eventRoll.seed;
  if (!eventRoll.value) {
    return { ...state, rngSeed: seed };
  }

  const eventPick = pickWeighted(seed, randomEvents);
  seed = eventPick.seed;
  const event = eventPick.value;
  if (!event) {
    return { ...state, rngSeed: seed };
  }

  let next = { ...state, rngSeed: seed };
  const faction = getPlayerFaction(next);
  const playerRegions = getPlayerRegions(next);

  if (event.id === 'goodHarvest') {
    next = {
      ...next,
      factions: { ...next.factions, [PLAYER_FACTION_ID]: { ...faction, food: faction.food + 180 } },
    };
  } else if (event.id === 'badHarvest') {
    next = {
      ...next,
      factions: { ...next.factions, [PLAYER_FACTION_ID]: { ...faction, food: Math.max(0, faction.food - 130) } },
    };
  } else if (event.id === 'merchant') {
    const buy = faction.gold >= 45;
    next = {
      ...next,
      factions: {
        ...next.factions,
        [PLAYER_FACTION_ID]: {
          ...faction,
          gold: buy ? faction.gold - 45 : faction.gold,
          food: faction.food + (buy ? 170 : 70),
        },
      },
    };
  } else if (event.id === 'ronin') {
    const hidden = getHiddenRonin(next);
    const pick = pickOne(seed, hidden);
    seed = pick.seed;
    if (pick.value) {
      const regionPick = pickOne(seed, playerRegions);
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
  } else if (event.id === 'uprising') {
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
  } else if (event.id === 'artisan') {
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
  } else if (event.id === 'rumor') {
    next = {
      ...next,
      factions: { ...next.factions, [PLAYER_FACTION_ID]: { ...faction, morale: Math.max(25, faction.morale - 5) } },
    };
  } else if (event.id === 'festival') {
    const regions = { ...next.regions };
    playerRegions.forEach((region) => {
      regions[region.id] = { ...region, publicOrder: Math.min(100, region.publicOrder + 5) };
    });
    next = {
      ...next,
      regions,
      factions: {
        ...next.factions,
        [PLAYER_FACTION_ID]: { ...faction, gold: Math.max(0, faction.gold - 32) },
      },
    };
  }

  return addLog(next, 'event', `${event.name}: ${event.description}`);
}

function refreshDefeatedFactions(state: GameState): GameState {
  const defeated = getDefeatedMajorFactions(state);
  const newlyDefeated = defeated.filter((id) => !state.stats.defeatedFactions.includes(id));
  if (newlyDefeated.length === 0) {
    return state;
  }

  let next: GameState = {
    ...state,
    stats: {
      ...state.stats,
      defeatedFactions: defeated,
    },
  };
  newlyDefeated.forEach((id) => {
    next = addLog(next, 'system', `${state.factions[id].name}は滅亡した。`);
  });
  return next;
}

export function endPlayerTurn(state: GameState): ActionOutcome {
  const guard = requirePlaying(state);
  if (guard) {
    return fail(state, guard);
  }

  let next = addLog(state, 'system', `${state.turn}ターン目を終了。NPC勢力が動き出す。`);
  next = applyFactionIncome(next, PLAYER_FACTION_ID);
  next = applyRegionAttrition(next, PLAYER_FACTION_ID);
  next = applyRandomEvent(next);
  next = {
    ...next,
    phase: 'npc',
  };
  next = runNpcTurn(next);
  next = refreshDefeatedFactions(next);
  next = applyMonthlyRecovery(next);
  next = checkGameStatus(next);
  if (next.gameStatus === 'playing') {
    next = {
      ...next,
      turn: next.turn + 1,
      phase: 'player',
      actionPoints: next.maxActionPoints,
      lastBattleResult: next.lastBattleResult,
    };
    next = addLog(next, 'economy', `${next.turn}ターン目の評定。APが回復した。`);
  }

  return ok(next, 'ターンを終了した。');
}

export function selectRegion(state: GameState, regionId: string): GameState {
  if (!state.regions[regionId]) {
    return state;
  }
  return { ...state, selectedRegionId: regionId };
}

export function toggleOfficerSelection(state: GameState, officerId: string): GameState {
  const officer = state.officers[officerId];
  if (!officer || officer.factionId !== PLAYER_FACTION_ID || officer.status !== 'active') {
    return state;
  }
  const selected = new Set(state.selectedOfficerIds);
  if (selected.has(officerId)) {
    selected.delete(officerId);
  } else if (selected.size < 3) {
    selected.add(officerId);
  } else {
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

export function newGame(difficulty: GameState['difficulty'], create: (difficulty: GameState['difficulty']) => GameState): GameState {
  return create(difficulty);
}
