"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const createGame_1 = require("../src/createGame");
const engine_1 = require("../src/engine");
const battleIntel_1 = require("../src/engine/battleIntel");
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
        const state = (0, createGame_1.createNewGame)(1);
        const battle = (0, engine_1.initBattle)(state, {
            regionId: '03',
            playerIsAttacker: true,
            attackerFactionId: 'akatsuki',
            defenderFactionId: 'kurogane',
            playerGeneralIds: ['g_kazama_saku', null, null, 'g_kazama_genba', null, null, 'g_asagiri_chikage', null, null],
            enemyGeneralIds: ['g_hagane_narukami', null, null, 'g_kurogane_genbu', null, null, 'g_akaganezaki_hayato', null, null],
        });
        const resolved = (0, engine_1.autoResolve)(battle, state, (0, engine_1.createRng)(10));
        strict_1.default.notEqual(resolved.result, 'in_progress');
        strict_1.default.ok(resolved.log.length > 1);
    });
    test('内政で国力と建設レベルが増える', () => {
        const state = (0, createGame_1.createNewGame)(2);
        const beforePower = state.regions['01'].power;
        const beforeFarm = state.regions['01'].buildLevels.farm;
        const outcome = (0, engine_1.applyBuildAction)(state, '01', 'farm');
        strict_1.default.equal(outcome.ok, true);
        strict_1.default.equal(outcome.state.regions['01'].buildLevels.farm, beforeFarm + 1);
        strict_1.default.ok(outcome.state.regions['01'].power > beforePower);
    });
    test('徴収で金が増え、満足度が下がる', () => {
        const state = (0, createGame_1.createNewGame)(3);
        const beforeGold = state.factions.akatsuki.treasury;
        const beforeSatisfaction = state.regions['01'].satisfaction;
        const outcome = (0, engine_1.applyCollectAction)(state, '01');
        strict_1.default.equal(outcome.ok, true);
        strict_1.default.ok(outcome.state.factions.akatsuki.treasury > beforeGold);
        strict_1.default.ok(outcome.state.regions['01'].satisfaction < beforeSatisfaction);
    });
    test('進軍勝利時に地域支配が変わる', () => {
        const state = (0, createGame_1.createNewGame)(4);
        const boosted = {
            ...state,
            generals: {
                ...state.generals,
                g_kazama_saku: { ...state.generals.g_kazama_saku, troopCurrent: 2000, troopMax: 2000 },
                g_kazama_genba: { ...state.generals.g_kazama_genba, troopCurrent: 1800, troopMax: 1800 },
                g_asagiri_chikage: { ...state.generals.g_asagiri_chikage, troopCurrent: 1600, troopMax: 1600 },
                g_rengein_kangetsu: { ...state.generals.g_rengein_kangetsu, troopCurrent: 120, troopMax: 120 },
                g_horenbo_tesshin: { ...state.generals.g_horenbo_tesshin, troopCurrent: 120, troopMax: 120 },
            },
        };
        const battle = (0, engine_1.initBattle)(boosted, {
            regionId: '11',
            playerIsAttacker: true,
            attackerFactionId: 'akatsuki',
            defenderFactionId: 'rengein',
            playerGeneralIds: ['g_kazama_saku', null, null, 'g_kazama_genba', null, null, 'g_asagiri_chikage', null, null],
            enemyGeneralIds: ['g_rengein_kangetsu', null, null, 'g_horenbo_tesshin', null, null, null, null, null],
        });
        const resolved = (0, engine_1.autoResolve)(battle, boosted, (0, engine_1.createRng)(5));
        const finalized = (0, engine_1.finalizeBattle)(boosted, { ...resolved, result: 'player_win' }, (0, engine_1.createRng)(6));
        strict_1.default.equal(finalized.state.regions['11'].factionId, 'akatsuki');
    });
    test('登用で浪人を雇用できる', () => {
        const state = (0, createGame_1.createNewGame)(7);
        const target = state.roninPool[0];
        strict_1.default.ok(target);
        const prepared = {
            ...state,
            factions: {
                ...state.factions,
                akatsuki: { ...state.factions.akatsuki, treasury: 50000 },
            },
        };
        const outcome = (0, engine_1.hireRonin)(prepared, target);
        strict_1.default.equal(outcome.ok, true);
        strict_1.default.equal(outcome.state.generals[target].factionId, 'akatsuki');
    });
    test('セーブデータのserialize/deserializeができる', () => {
        const state = (0, createGame_1.createNewGame)(8);
        const raw = (0, engine_1.serializeGameState)(state);
        const loaded = (0, engine_1.deserializeSaveData)(raw);
        strict_1.default.equal(loaded.ok, true);
        strict_1.default.equal(loaded.state?.turn, 1);
    });
    test('壊れたセーブデータを拒否する', () => {
        const raw = JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state: { turn: 1, regions: {} } });
        const loaded = (0, engine_1.deserializeSaveData)(raw);
        strict_1.default.equal(loaded.ok, false);
        strict_1.default.equal(loaded.state, null);
    });
    test('勝利条件を判定できる', () => {
        const state = (0, createGame_1.createNewGame)(9);
        const entries = Object.entries(state.regions);
        const conquered = Object.fromEntries(entries.map(([id, region], index) => [id, index < 12 ? { ...region, factionId: 'akatsuki' } : region]));
        const checked = (0, createGame_1.checkVictory)({ ...state, regions: conquered });
        strict_1.default.equal(checked, 'win_dominate');
    });
    test('25ターンのスモーク進行で状態が壊れない', () => {
        let state = (0, createGame_1.createNewGame)(11);
        for (let index = 0; index < 25 && state.victory === 'none'; index += 1) {
            const built = (0, engine_1.applyBuildAction)(state, '01', index % 2 === 0 ? 'farm' : 'market');
            state = built.state;
            state = (0, engine_1.applyCollectAction)(state, '01').state;
            state = (0, createGame_1.applyRestAction)(state, ['g_kazama_saku', 'g_kazama_genba']);
            state = (0, createGame_1.endTurn)(state);
        }
        strict_1.default.ok(typeof state.turn === 'number');
        strict_1.default.equal(Object.keys(state.regions).length, 15);
        strict_1.default.equal(Object.keys(state.factions).length, 8);
        strict_1.default.ok(Object.keys(state.generals).length >= 22);
    });
    test('序盤5ターンで支配地域が不自然に0にならない', () => {
        let state = (0, createGame_1.createNewGame)(110);
        for (let index = 0; index < 5; index += 1) {
            state = (0, createGame_1.endTurn)(state);
            const playerRegions = Object.values(state.regions).filter((r) => r.factionId === 'akatsuki').length;
            strict_1.default.ok(playerRegions >= 1);
            strict_1.default.equal(state.victory, 'none');
        }
    });
    test('ターン終了時にNPC勢力の行動が作戦記に残る', () => {
        const state = (0, createGame_1.createNewGame)(111);
        const next = (0, createGame_1.endTurn)(state);
        const npcLogs = next.log.filter((entry) => entry.actor !== 'player');
        strict_1.default.ok(npcLogs.length > 0);
        strict_1.default.ok(npcLogs.some((entry) => entry.type === 'build' || entry.type === 'battle'));
    });
    test('出陣前の戦力予測が危険度と勝率を返す', () => {
        const state = (0, createGame_1.createNewGame)(12);
        const forecast = (0, battleIntel_1.createBattleForecast)(state, '03', (0, battleIntel_1.getDeployableGenerals)(state).slice(0, 3));
        strict_1.default.ok(forecast.winRate > 0);
        strict_1.default.ok(forecast.mainReason.length > 0);
        strict_1.default.equal((0, battleIntel_1.hasBattleHistory)(state), false);
    });
    test('調略とAP消費が現在APIで動く', () => {
        const state = (0, createGame_1.createNewGame)(13);
        const consumed = (0, createGame_1.consumeAp)(state, 1);
        const scouted = (0, createGame_1.applyScoutAction)(state, '03');
        strict_1.default.equal(consumed.ok, true);
        strict_1.default.equal(consumed.state.ap, 2);
        strict_1.default.equal(scouted.ok, true);
    });
    test('武将portraitKeyが既存画像に紐づいている', () => {
        const state = (0, createGame_1.createNewGame)(14);
        const missing = Object.values(state.generals)
            .map((g) => ({ name: g.name, key: g.portraitKey }))
            .filter(({ key }) => !(0, node_fs_1.existsSync)((0, node_path_1.join)(process.cwd(), 'public', 'assets', 'portraits', `${key}.png`)));
        strict_1.default.deepEqual(missing, []);
    });
    test('古いセーブのportraitKeyを現行画像キーへ補正する', () => {
        const state = (0, createGame_1.createNewGame)(15);
        const broken = {
            ...state,
            generals: {
                ...state.generals,
                g_kazama_saku: { ...state.generals.g_kazama_saku, portraitKey: 'old_saku' },
            },
        };
        const loaded = (0, engine_1.deserializeSaveData)((0, engine_1.serializeGameState)(broken));
        strict_1.default.equal(loaded.ok, true);
        strict_1.default.equal(loaded.state?.generals.g_kazama_saku.portraitKey, 'akatsuki_saku');
    });
    report();
}
run();
