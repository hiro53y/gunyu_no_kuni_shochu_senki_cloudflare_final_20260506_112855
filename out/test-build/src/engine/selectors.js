"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlayerFaction = getPlayerFaction;
exports.getSelectedRegion = getSelectedRegion;
exports.getFactionRegions = getFactionRegions;
exports.getPlayerRegions = getPlayerRegions;
exports.getFactionOfficers = getFactionOfficers;
exports.getRegionOfficers = getRegionOfficers;
exports.getAvailableRonin = getAvailableRonin;
exports.getHiddenRonin = getHiddenRonin;
exports.getSelectedOfficers = getSelectedOfficers;
exports.getOfficerSkills = getOfficerSkills;
exports.countControlledRegions = countControlledRegions;
exports.isMajorFactionDefeated = isMajorFactionDefeated;
exports.getDefeatedMajorFactions = getDefeatedMajorFactions;
exports.getAdjacentEnemyRegions = getAdjacentEnemyRegions;
exports.canFactionReachRegion = canFactionReachRegion;
exports.getFactionTroops = getFactionTroops;
exports.estimateRegionDefense = estimateRegionDefense;
exports.getBorderPlayerRegions = getBorderPlayerRegions;
const names_1 = require("../data/names");
function getPlayerFaction(state) {
    return state.factions[names_1.PLAYER_FACTION_ID];
}
function getSelectedRegion(state) {
    return state.regions[state.selectedRegionId] ?? Object.values(state.regions)[0];
}
function getFactionRegions(state, factionId) {
    return Object.values(state.regions).filter((region) => region.ownerFactionId === factionId);
}
function getPlayerRegions(state) {
    return getFactionRegions(state, names_1.PLAYER_FACTION_ID);
}
function getFactionOfficers(state, factionId) {
    return Object.values(state.officers).filter((officer) => officer.factionId === factionId && officer.status === 'active');
}
function getRegionOfficers(state, regionId, factionId = state.regions[regionId]?.ownerFactionId) {
    return Object.values(state.officers).filter((officer) => officer.locationRegionId === regionId && officer.status === 'active' && officer.factionId === factionId);
}
function getAvailableRonin(state) {
    return Object.values(state.officers).filter((officer) => officer.factionId === names_1.RONIN_FACTION_ID && officer.status === 'available');
}
function getHiddenRonin(state) {
    return Object.values(state.officers).filter((officer) => officer.factionId === names_1.RONIN_FACTION_ID && officer.status === 'ronin');
}
function getSelectedOfficers(state) {
    return state.selectedOfficerIds
        .map((id) => state.officers[id])
        .filter((officer) => Boolean(officer) && officer.status === 'active');
}
function getOfficerSkills(officer) {
    return officer.skills.map((id) => names_1.skillCatalog[id]).filter((skill) => Boolean(skill));
}
function countControlledRegions(state, factionId) {
    return getFactionRegions(state, factionId).length;
}
function isMajorFactionDefeated(state, factionId) {
    const faction = state.factions[factionId];
    return Boolean(faction?.isMajor) && getFactionRegions(state, factionId).length === 0;
}
function getDefeatedMajorFactions(state) {
    return Object.values(state.factions)
        .filter((faction) => faction.isMajor && !faction.isPlayer && isMajorFactionDefeated(state, faction.id))
        .map((faction) => faction.id);
}
function getAdjacentEnemyRegions(state, factionId) {
    const ownRegionIds = new Set(getFactionRegions(state, factionId).map((region) => region.id));
    const enemyIds = new Set();
    ownRegionIds.forEach((regionId) => {
        state.regions[regionId].neighbors.forEach((neighborId) => {
            const neighbor = state.regions[neighborId];
            if (neighbor && neighbor.ownerFactionId !== factionId) {
                enemyIds.add(neighborId);
            }
        });
    });
    return [...enemyIds].map((id) => state.regions[id]).filter((region) => Boolean(region));
}
function canFactionReachRegion(state, factionId, targetRegionId) {
    return getFactionRegions(state, factionId).some((region) => region.neighbors.includes(targetRegionId));
}
function getFactionTroops(state, factionId) {
    const officerTroops = getFactionOfficers(state, factionId).reduce((sum, officer) => sum + officer.troops, 0);
    const regionTroops = getFactionRegions(state, factionId).reduce((sum, region) => sum + region.localTroops, 0);
    return officerTroops + regionTroops;
}
function estimateRegionDefense(state, regionId) {
    const region = state.regions[regionId];
    const officers = getRegionOfficers(state, regionId);
    const officerPower = officers.reduce((sum, officer) => sum + officer.troops * (1 + officer.command / 180), 0);
    const castlePower = region.castleHp * 7;
    return Math.round(region.localTroops * 1.25 + officerPower + castlePower);
}
function getBorderPlayerRegions(state) {
    return getPlayerRegions(state).filter((region) => region.neighbors.some((neighborId) => state.regions[neighborId]?.ownerFactionId !== names_1.PLAYER_FACTION_ID));
}
