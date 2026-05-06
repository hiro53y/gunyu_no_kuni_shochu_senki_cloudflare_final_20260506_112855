import type { Faction, GameState, Region } from '../types/game';
import { clamp } from './random';
import { getFactionOfficers, getFactionRegions } from './selectors';

export interface IncomeResult {
  gold: number;
  food: number;
  upkeep: number;
  netFood: number;
}

export function calculateFactionIncome(state: GameState, factionId: string): IncomeResult {
  const regions = getFactionRegions(state, factionId);
  const officers = getFactionOfficers(state, factionId);
  const officerTroops = officers.reduce((sum, officer) => sum + officer.troops, 0);
  const localTroops = regions.reduce((sum, region) => sum + region.localTroops, 0);
  const totalTroops = officerTroops + localTroops;

  const base = regions.reduce(
    (acc, region) => {
      const orderFactor = clamp(region.publicOrder / 100, 0.45, 1);
      const developmentFactor = 1 + region.developmentLevel * 0.06;
      return {
        gold: acc.gold + region.riceYield * 0.62 * orderFactor * developmentFactor,
        food: acc.food + region.riceYield * 1.22 * orderFactor * developmentFactor,
      };
    },
    { gold: 0, food: 0 },
  );

  const upkeep = Math.ceil(totalTroops / 55);
  const difficultyFoodBonus = state.difficulty === 'hard' && !state.factions[factionId].isPlayer ? 18 : 0;

  return {
    gold: Math.max(0, Math.round(base.gold)),
    food: Math.max(0, Math.round(base.food + difficultyFoodBonus)),
    upkeep,
    netFood: Math.round(base.food + difficultyFoodBonus - upkeep),
  };
}

export function applyFactionIncome(state: GameState, factionId: string): GameState {
  const income = calculateFactionIncome(state, factionId);
  const faction = state.factions[factionId];
  const moraleDelta = income.netFood < 0 ? -2 : 1;

  return {
    ...state,
    factions: {
      ...state.factions,
      [factionId]: {
        ...faction,
        gold: Math.max(0, faction.gold + income.gold),
        food: Math.max(0, faction.food + income.netFood),
        morale: clamp(faction.morale + moraleDelta, 25, 95),
      },
    },
  };
}

export function improveRegion(region: Region, focus: 'riceYield' | 'publicOrder' | 'castleHp' | 'developmentLevel', amount: number): Region {
  if (focus === 'riceYield') {
    return { ...region, riceYield: Math.min(150, region.riceYield + Math.round(amount)) };
  }
  if (focus === 'publicOrder') {
    return { ...region, publicOrder: Math.min(100, region.publicOrder + Math.round(amount)) };
  }
  if (focus === 'castleHp') {
    return { ...region, castleHp: Math.min(region.maxCastleHp, region.castleHp + Math.round(amount)) };
  }
  return { ...region, developmentLevel: Math.min(8, region.developmentLevel + 1) };
}

export function applyRegionAttrition(state: GameState, factionId: string): GameState {
  const faction = state.factions[factionId];
  if (faction.food > 0) {
    return state;
  }

  const officers = getFactionOfficers(state, factionId);
  const regions = getFactionRegions(state, factionId);
  const officersUpdate = { ...state.officers };
  const regionsUpdate = { ...state.regions };

  officers.forEach((officer) => {
    officersUpdate[officer.id] = {
      ...officer,
      troops: Math.max(20, Math.floor(officer.troops * 0.96)),
      stamina: Math.max(10, officer.stamina - 4),
    };
  });

  regions.forEach((region) => {
    regionsUpdate[region.id] = {
      ...region,
      localTroops: Math.max(40, Math.floor(region.localTroops * 0.97)),
      publicOrder: Math.max(20, region.publicOrder - 2),
    };
  });

  return {
    ...state,
    officers: officersUpdate,
    regions: regionsUpdate,
    factions: {
      ...state.factions,
      [factionId]: {
        ...faction,
        morale: Math.max(25, faction.morale - 3),
      },
    },
  };
}

export function applyMonthlyRecovery(state: GameState): GameState {
  const officers = { ...state.officers };
  Object.values(officers).forEach((officer) => {
    if (officer.status !== 'active') {
      return;
    }
    officers[officer.id] = {
      ...officer,
      stamina: Math.min(officer.maxStamina, officer.stamina + 5),
    };
  });

  return { ...state, officers };
}
