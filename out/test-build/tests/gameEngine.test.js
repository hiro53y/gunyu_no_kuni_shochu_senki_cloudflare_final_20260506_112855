"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const createGame_1 = require("../src/createGame");
const battle_1 = require("../src/engine/battle");
const economy_1 = require("../src/engine/economy");
const npc_1 = require("../src/engine/npc");
const rng_1 = require("../src/engine/rng");
const save_1 = require("../src/engine/save");
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
function eagerRng() {
    return {
        next: () => 0,
        int: (min) => min,
        pick: (arr) => arr[0],
        chance: () => true,
        weighted: (items) => items[0],
        getSeed: () => 1,
    };
}
function report() {
    results.forEach((line) => console.log(line));
    console.log(`${results.length} tests passed`);
}
function run() {
    test('新規ゲームが現行データで作成できる', () => {
        const state = (0, createGame_1.createNewGame)(1234);
        strict_1.default.equal(state.turn, 1);
        strict_1.default.equal(Object.keys(state.regions).length, 15);
        strict_1.default.ok(Object.keys(state.generals).length >= 20);
        strict_1.default.equal(state.regions['01'].factionId, 'akatsuki');
    });
    test('建設で地域が強化され金を消費する', () => {
        const state = (0, createGame_1.createNewGame)(1234);
        const beforeGold = state.factions.akatsuki.treasury;
        const beforeFarm = state.regions['01'].buildLevels.farm;
        const outcome = (0, economy_1.applyBuildAction)(state, '01', 'farm');
        strict_1.default.equal(outcome.ok, true);
        strict_1.default.equal(outcome.state.regions['01'].buildLevels.farm, beforeFarm + 1);
        strict_1.default.ok(outcome.state.factions.akatsuki.treasury < beforeGold);
    });
    test('徴収で金が増え満足度が下がる', () => {
        const state = (0, createGame_1.createNewGame)(1234);
        const beforeGold = state.factions.akatsuki.treasury;
        const beforeSatisfaction = state.regions['01'].satisfaction;
        const outcome = (0, economy_1.applyCollectAction)(state, '01');
        strict_1.default.equal(outcome.ok, true);
        strict_1.default.ok(outcome.state.factions.akatsuki.treasury > beforeGold);
        strict_1.default.ok(outcome.state.regions['01'].satisfaction < beforeSatisfaction);
    });
    test('合戦を自動解決して戦後処理まで進められる', () => {
        const state = (0, createGame_1.createNewGame)(1234);
        const battle = (0, battle_1.initBattle)(state, {
            regionId: '06',
            playerIsAttacker: true,
            attackerFactionId: 'akatsuki',
            defenderFactionId: 'shion',
            playerGeneralIds: ['g_kazama_saku', 'g_suzuran', 'g_asagiri_chikage', null, null, null, null, null, null],
            enemyGeneralIds: ['g_shionin_hazuki', 'g_shionin_fuuko', 'g_narumi_souji', null, null, null, null, null, null],
        });
        const resolved = (0, battle_1.autoResolve)(battle, state, (0, rng_1.createRng)(99));
        const finalized = (0, battle_1.finalizeBattle)(state, resolved, (0, rng_1.createRng)(100));
        strict_1.default.notEqual(resolved.result, 'in_progress');
        strict_1.default.equal(finalized.state.battleState, null);
        strict_1.default.ok(finalized.log.length > 0);
    });
    test('NPC侵攻がプレイヤー絡みでも作戦記へ反映される', () => {
        const state = (0, createGame_1.createNewGame)(1234);
        const next = (0, npc_1.runNpcTurn)(state, eagerRng());
        strict_1.default.ok(next.log.some((entry) => entry.type === 'battle'));
        strict_1.default.ok(next.log.some((entry) => entry.message.includes('侵攻')));
    });
    test('ターン終了で月が進みNPCログも保持できる', () => {
        const state = (0, createGame_1.createNewGame)(1234);
        const next = (0, createGame_1.endTurn)(state);
        strict_1.default.equal(next.turn, 2);
        strict_1.default.equal(next.ap, next.apMax);
        strict_1.default.ok(Array.isArray(next.log));
    });
    test('セーブデータのserialize/deserializeができる', () => {
        const state = (0, createGame_1.createNewGame)(1234);
        const raw = (0, save_1.serializeGameState)(state);
        const loaded = (0, save_1.deserializeSaveData)(raw);
        strict_1.default.equal(loaded.ok, true);
        strict_1.default.equal(loaded.state?.turn, 1);
    });
    test('壊れたセーブデータを拒否する', () => {
        const loaded = (0, save_1.deserializeSaveData)('{ broken json');
        strict_1.default.equal(loaded.ok, false);
        strict_1.default.equal(loaded.state, null);
    });
    test('勝利条件を判定できる', () => {
        const state = (0, createGame_1.createNewGame)(1234);
        const regions = Object.fromEntries(Object.entries(state.regions).map(([id, region]) => [id, { ...region, factionId: 'akatsuki' }]));
        strict_1.default.equal((0, createGame_1.checkVictory)({ ...state, regions }), 'win_dominate');
    });
    report();
}
run();
