import { PLAYER_FACTION_ID, RONIN_FACTION_ID, skillCatalog } from '../data/names';
import type { Faction, GameState, Officer, Region, Skill } from '../types/game';

export function getPlayerFaction(state: GameState): Faction {
  return state.factions[PLAYER_FACTION_ID];
}

export function getSelectedRegion(state: GameState): Region {
  return state.regions[state.selectedRegionId] ?? Object.values(state.regions)[0];
}

export function getFactionRegions(state: GameState, factionId: string): Region[] {
  return Object.values(state.regions).filter((region) => region.ownerFactionId === factionId);
}

export function getPlayerRegions(state: GameState): Region[] {
  return getFactionRegions(state, PLAYER_FACTION_ID);
}

export function getFactionOfficers(state: GameState, factionId: string): Officer[] {
  return Object.values(state.officers).filter((officer) => officer.factionId === factionId && officer.status === 'active');
}

export function getRegionOfficers(state: GameState, regionId: string, factionId = state.regions[regionId]?.ownerFactionId): Officer[] {
  return Object.values(state.officers).filter(
    (officer) => officer.locationRegionId === regionId && officer.status === 'active' && officer.factionId === factionId,
  );
}

export function getAvailableRonin(state: GameState): Officer[] {
  return Object.values(state.officers).filter(
    (officer) => officer.factionId === RONIN_FACTION_ID && officer.status === 'available',
  );
}

export function getHiddenRonin(state: GameState): Officer[] {
  return Object.values(state.officers).filter(
    (officer) => officer.factionId === RONIN_FACTION_ID && officer.status === 'ronin',
  );
}

export function getSelectedOfficers(state: GameState): Officer[] {
  return state.selectedOfficerIds
    .map((id) => state.officers[id])
    .filter((officer): officer is Officer => Boolean(officer) && officer.status === 'active');
}

export function getOfficerSkills(officer: Officer): Skill[] {
  return officer.skills.map((id) => skillCatalog[id]).filter((skill): skill is Skill => Boolean(skill));
}

export function countControlledRegions(state: GameState, factionId: string): number {
  return getFactionRegions(state, factionId).length;
}

export function isMajorFactionDefeated(state: GameState, factionId: string): boolean {
  const faction = state.factions[factionId];
  return Boolean(faction?.isMajor) && getFactionRegions(state, factionId).length === 0;
}

export function getDefeatedMajorFactions(state: GameState): string[] {
  return Object.values(state.factions)
    .filter((faction) => faction.isMajor && !faction.isPlayer && isMajorFactionDefeated(state, faction.id))
    .map((faction) => faction.id);
}

export function getAdjacentEnemyRegions(state: GameState, factionId: string): Region[] {
  const ownRegionIds = new Set(getFactionRegions(state, factionId).map((region) => region.id));
  const enemyIds = new Set<string>();

  ownRegionIds.forEach((regionId) => {
    state.regions[regionId].neighbors.forEach((neighborId) => {
      const neighbor = state.regions[neighborId];
      if (neighbor && neighbor.ownerFactionId !== factionId) {
        enemyIds.add(neighborId);
      }
    });
  });

  return [...enemyIds].map((id) => state.regions[id]).filter((region): region is Region => Boolean(region));
}

export function canFactionReachRegion(state: GameState, factionId: string, targetRegionId: string): boolean {
  return getFactionRegions(state, factionId).some((region) => region.neighbors.includes(targetRegionId));
}

export function getFactionTroops(state: GameState, factionId: string): number {
  const officerTroops = getFactionOfficers(state, factionId).reduce((sum, officer) => sum + officer.troops, 0);
  const regionTroops = getFactionRegions(state, factionId).reduce((sum, region) => sum + region.localTroops, 0);
  return officerTroops + regionTroops;
}

export function estimateRegionDefense(state: GameState, regionId: string): number {
  const region = state.regions[regionId];
  const officers = getRegionOfficers(state, regionId);
  const officerPower = officers.reduce((sum, officer) => sum + officer.troops * (1 + officer.command / 180), 0);
  const castlePower = region.castleHp * 7;
  return Math.round(region.localTroops * 1.25 + officerPower + castlePower);
}

export function getBorderPlayerRegions(state: GameState): Region[] {
  return getPlayerRegions(state).filter((region) =>
    region.neighbors.some((neighborId) => state.regions[neighborId]?.ownerFactionId !== PLAYER_FACTION_ID),
  );
}
