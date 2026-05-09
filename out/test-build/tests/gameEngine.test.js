"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const initialGameData_1 = require("../src/data/initialGameData");
const names_1 = require("../src/data/names");
const actions_1 = require("../src/engine/actions");
const battle_1 = require("../src/engine/battle");
const save_1 = require("../src/engine/save");
const victory_1 = require("../src/engine/victory");
const results = [];
function test(name, fn) {
    try {
        fn();
        results.push(`ok - ${name}`);
    }
    catch (error) {
        results.push(`not ok - ${name}`);
        throw error;
    }
}
function report() {
    results.forEach((line) => console.log(line));
    console.log(`${results.length} tests passed`);
}
function run() {
    test('戦闘計算が結果を返す', () => {
        const state = (0, initialGameData_1.createInitialGameState)('normal');
        const resultState = (0, battle_1.resolveBattle)(state, {
            attackerFactionId: names_1.PLAYER_FACTION_ID,
            targetRegionId: 'r_shiramine',
            attackerOfficerIds: ['o_harutsuna', 'o_saku'],
        });
        strict_1.default.notEqual(resultState.lastBattleResult, null);
        strict_1.default.equal(resultState.stats.totalBattles, 1);
    });
    test('内政で石高が増える', () => {
        const state = (0, initialGameData_1.createInitialGameState)('normal');
        const before = state.regions.r_akihara.riceYield;
        const outcome = (0, actions_1.performDomestic)(state, 'riceYield');
        strict_1.default.equal(outcome.ok, true);
        strict_1.default.ok(outcome.state.regions.r_akihara.riceYield > before);
        strict_1.default.equal(outcome.state.actionPoints, 2);
    });
    test('徴兵で兵力が増え、資源が減る', () => {
        const state = (0, initialGameData_1.createInitialGameState)('normal');
        const beforeTroops = state.regions.r_akihara.localTroops;
        const beforeGold = state.factions[names_1.PLAYER_FACTION_ID].gold;
        const outcome = (0, actions_1.performRecruitTroops)(state);
        strict_1.default.equal(outcome.ok, true);
        strict_1.default.ok(outcome.state.regions.r_akihara.localTroops > beforeTroops);
        strict_1.default.ok(outcome.state.factions[names_1.PLAYER_FACTION_ID].gold < beforeGold);
    });
    test('進軍勝利時に地域支配が変わる', () => {
        const state = (0, initialGameData_1.createInitialGameState)('easy');
        const boosted = {
            ...state,
            selectedRegionId: 'r_shiramine',
            officers: {
                ...state.officers,
                o_harutsuna: { ...state.officers.o_harutsuna, troops: 900, command: 96, valor: 90 },
                o_saku: { ...state.officers.o_saku, troops: 760, command: 88, valor: 94 },
            },
            regions: {
                ...state.regions,
                r_shiramine: { ...state.regions.r_shiramine, castleHp: 1, localTroops: 60 },
            },
        };
        const resultState = (0, battle_1.resolveBattle)(boosted, {
            attackerFactionId: names_1.PLAYER_FACTION_ID,
            targetRegionId: 'r_shiramine',
            attackerOfficerIds: ['o_harutsuna', 'o_saku'],
        });
        strict_1.default.equal(resultState.lastBattleResult?.conquered, true);
        strict_1.default.equal(resultState.regions.r_shiramine.ownerFactionId, names_1.PLAYER_FACTION_ID);
        strict_1.default.notEqual(resultState.officers.o_mayuki.locationRegionId, 'r_shiramine');
    });
    test('戦闘経験値は100未満に正規化されレベルアップする', () => {
        const state = (0, initialGameData_1.createInitialGameState)('easy');
        const prepared = {
            ...state,
            officers: {
                ...state.officers,
                o_harutsuna: { ...state.officers.o_harutsuna, exp: 95, troops: 900, command: 96, valor: 90 },
            },
            regions: {
                ...state.regions,
                r_shiramine: { ...state.regions.r_shiramine, castleHp: 1, localTroops: 60 },
            },
        };
        const resultState = (0, battle_1.resolveBattle)(prepared, {
            attackerFactionId: names_1.PLAYER_FACTION_ID,
            targetRegionId: 'r_shiramine',
            attackerOfficerIds: ['o_harutsuna'],
        });
        strict_1.default.ok(resultState.officers.o_harutsuna.exp < 100);
        strict_1.default.ok(resultState.officers.o_harutsuna.level > state.officers.o_harutsuna.level);
    });
    test('訓練レベルアップ後の新しい兵数上限を使う', () => {
        const state = (0, initialGameData_1.createInitialGameState)('normal');
        const prepared = {
            ...state,
            selectedOfficerIds: ['o_harutsuna'],
            officers: {
                ...state.officers,
                o_harutsuna: { ...state.officers.o_harutsuna, exp: 94, troops: 510, maxTroops: 520, command: 96 },
            },
        };
        const outcome = (0, actions_1.performTrain)(prepared);
        strict_1.default.equal(outcome.ok, true);
        strict_1.default.ok(outcome.state.officers.o_harutsuna.maxTroops > 520);
        strict_1.default.ok(outcome.state.officers.o_harutsuna.troops > 520);
    });
    test('休養で負傷武将が復帰する', () => {
        const state = (0, initialGameData_1.createInitialGameState)('normal');
        const prepared = {
            ...state,
            selectedOfficerIds: ['o_saku'],
            officers: {
                ...state.officers,
                o_saku: { ...state.officers.o_saku, status: 'wounded', troops: 0, stamina: 5 },
            },
        };
        const outcome = (0, actions_1.performRest)(prepared);
        strict_1.default.equal(outcome.ok, true);
        strict_1.default.equal(outcome.state.officers.o_saku.status, 'active');
        strict_1.default.ok(outcome.state.officers.o_saku.stamina >= 28);
        strict_1.default.equal(outcome.state.actionPoints, 2);
    });
    test('登用はAPを消費し候補所在地に配置する', () => {
        const state = (0, initialGameData_1.createInitialGameState)('normal');
        const prepared = {
            ...state,
            rngSeed: 1,
            selectedRegionId: 'r_kurose',
            officers: {
                ...state.officers,
                o_gento: { ...state.officers.o_gento, status: 'available', locationRegionId: 'r_akihara' },
            },
        };
        const outcome = (0, actions_1.performHire)(prepared, 'o_gento');
        strict_1.default.equal(outcome.ok, true);
        strict_1.default.equal(outcome.state.actionPoints, 2);
        strict_1.default.equal(outcome.state.officers.o_gento.factionId, names_1.PLAYER_FACTION_ID);
        strict_1.default.equal(outcome.state.officers.o_gento.locationRegionId, 'r_akihara');
    });
    test('セーブデータのserialize/deserializeができる', () => {
        const state = (0, initialGameData_1.createInitialGameState)('normal');
        const raw = (0, save_1.serializeGameState)(state);
        const loaded = (0, save_1.deserializeSaveData)(raw);
        strict_1.default.equal(loaded.ok, true);
        strict_1.default.equal(loaded.state?.turn, 1);
    });
    test('壊れたセーブデータを拒否する', () => {
        const raw = JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state: { turn: 1, regions: {} } });
        const loaded = (0, save_1.deserializeSaveData)(raw);
        strict_1.default.equal(loaded.ok, false);
        strict_1.default.equal(loaded.state, null);
    });
    test('勝利条件を判定できる', () => {
        const state = (0, initialGameData_1.createInitialGameState)('normal');
        const regionEntries = Object.entries(state.regions);
        const eightRegions = Object.fromEntries(regionEntries.map(([id, region], index) => [id, index < 8 ? { ...region, ownerFactionId: names_1.PLAYER_FACTION_ID } : region]));
        const checked = (0, victory_1.checkGameStatus)({ ...state, regions: eightRegions });
        strict_1.default.equal(checked.gameStatus, 'victory');
        strict_1.default.equal(checked.result?.controlledRegions, 8);
    });
    test('25ターンのスモーク進行で状態が壊れない', () => {
        let state = (0, initialGameData_1.createInitialGameState)('normal');
        for (let index = 0; index < 25 && state.gameStatus === 'playing'; index += 1) {
            state = (0, actions_1.performDomestic)(state, index % 2 === 0 ? 'riceYield' : 'publicOrder').state;
            state = (0, actions_1.performRecruitTroops)(state).state;
            state = (0, actions_1.performTrain)(state).state;
            state = (0, actions_1.endPlayerTurn)(state).state;
        }
        strict_1.default.ok(typeof state.turn === 'number');
        strict_1.default.ok(Object.keys(state.regions).length === 12);
        strict_1.default.ok(Object.keys(state.factions).length >= 5);
        strict_1.default.ok(Object.keys(state.officers).length >= 20);
    });
    report();
}
run();
