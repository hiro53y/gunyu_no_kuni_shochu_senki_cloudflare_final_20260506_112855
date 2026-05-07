import assert from 'node:assert/strict';
import { createInitialGameState } from '../src/data/initialGameData';
import { PLAYER_FACTION_ID } from '../src/data/names';
import { endPlayerTurn, performDomestic, performHire, performRecruitTroops, performRest, performTrain } from '../src/engine/actions';
import { resolveBattle } from '../src/engine/battle';
import { deserializeSaveData, serializeGameState } from '../src/engine/save';
import { checkGameStatus } from '../src/engine/victory';

const results: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    results.push(`ok - ${name}`);
  } catch (error) {
    results.push(`not ok - ${name}`);
    throw error;
  }
}

function report(): void {
  results.forEach((line) => console.log(line));
  console.log(`${results.length} tests passed`);
}

function run(): void {
  test('戦闘計算が結果を返す', () => {
    const state = createInitialGameState('normal');
    const resultState = resolveBattle(state, {
      attackerFactionId: PLAYER_FACTION_ID,
      targetRegionId: 'r_shiramine',
      attackerOfficerIds: ['o_harutsuna', 'o_saku'],
    });

    assert.notEqual(resultState.lastBattleResult, null);
    assert.equal(resultState.stats.totalBattles, 1);
  });

  test('内政で石高が増える', () => {
    const state = createInitialGameState('normal');
    const before = state.regions.r_akihara.riceYield;
    const outcome = performDomestic(state, 'riceYield');

    assert.equal(outcome.ok, true);
    assert.ok(outcome.state.regions.r_akihara.riceYield > before);
    assert.equal(outcome.state.actionPoints, 2);
  });

  test('徴兵で兵力が増え、資源が減る', () => {
    const state = createInitialGameState('normal');
    const beforeTroops = state.regions.r_akihara.localTroops;
    const beforeGold = state.factions[PLAYER_FACTION_ID].gold;
    const outcome = performRecruitTroops(state);

    assert.equal(outcome.ok, true);
    assert.ok(outcome.state.regions.r_akihara.localTroops > beforeTroops);
    assert.ok(outcome.state.factions[PLAYER_FACTION_ID].gold < beforeGold);
  });

  test('進軍勝利時に地域支配が変わる', () => {
    const state = createInitialGameState('easy');
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

    const resultState = resolveBattle(boosted, {
      attackerFactionId: PLAYER_FACTION_ID,
      targetRegionId: 'r_shiramine',
      attackerOfficerIds: ['o_harutsuna', 'o_saku'],
    });

    assert.equal(resultState.lastBattleResult?.conquered, true);
    assert.equal(resultState.regions.r_shiramine.ownerFactionId, PLAYER_FACTION_ID);
    assert.notEqual(resultState.officers.o_mayuki.locationRegionId, 'r_shiramine');
  });

  test('戦闘経験値は100未満に正規化されレベルアップする', () => {
    const state = createInitialGameState('easy');
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

    const resultState = resolveBattle(prepared, {
      attackerFactionId: PLAYER_FACTION_ID,
      targetRegionId: 'r_shiramine',
      attackerOfficerIds: ['o_harutsuna'],
    });

    assert.ok(resultState.officers.o_harutsuna.exp < 100);
    assert.ok(resultState.officers.o_harutsuna.level > state.officers.o_harutsuna.level);
  });

  test('訓練レベルアップ後の新しい兵数上限を使う', () => {
    const state = createInitialGameState('normal');
    const prepared = {
      ...state,
      selectedOfficerIds: ['o_harutsuna'],
      officers: {
        ...state.officers,
        o_harutsuna: { ...state.officers.o_harutsuna, exp: 94, troops: 510, maxTroops: 520, command: 96 },
      },
    };
    const outcome = performTrain(prepared);

    assert.equal(outcome.ok, true);
    assert.ok(outcome.state.officers.o_harutsuna.maxTroops > 520);
    assert.ok(outcome.state.officers.o_harutsuna.troops > 520);
  });

  test('休養で負傷武将が復帰する', () => {
    const state = createInitialGameState('normal');
    const prepared = {
      ...state,
      selectedOfficerIds: ['o_saku'],
      officers: {
        ...state.officers,
        o_saku: { ...state.officers.o_saku, status: 'wounded' as const, troops: 0, stamina: 5 },
      },
    };
    const outcome = performRest(prepared);

    assert.equal(outcome.ok, true);
    assert.equal(outcome.state.officers.o_saku.status, 'active');
    assert.ok(outcome.state.officers.o_saku.stamina >= 28);
    assert.equal(outcome.state.actionPoints, 2);
  });

  test('登用はAPを消費し候補所在地に配置する', () => {
    const state = createInitialGameState('normal');
    const prepared = {
      ...state,
      rngSeed: 1,
      selectedRegionId: 'r_kurose',
      officers: {
        ...state.officers,
        o_gento: { ...state.officers.o_gento, status: 'available' as const, locationRegionId: 'r_akihara' },
      },
    };
    const outcome = performHire(prepared, 'o_gento');

    assert.equal(outcome.ok, true);
    assert.equal(outcome.state.actionPoints, 2);
    assert.equal(outcome.state.officers.o_gento.factionId, PLAYER_FACTION_ID);
    assert.equal(outcome.state.officers.o_gento.locationRegionId, 'r_akihara');
  });

  test('セーブデータのserialize/deserializeができる', () => {
    const state = createInitialGameState('normal');
    const raw = serializeGameState(state);
    const loaded = deserializeSaveData(raw);

    assert.equal(loaded.ok, true);
    assert.equal(loaded.state?.turn, 1);
  });

  test('壊れたセーブデータを拒否する', () => {
    const raw = JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state: { turn: 1, regions: {} } });
    const loaded = deserializeSaveData(raw);

    assert.equal(loaded.ok, false);
    assert.equal(loaded.state, null);
  });

  test('勝利条件を判定できる', () => {
    const state = createInitialGameState('normal');
    const regionEntries = Object.entries(state.regions);
    const eightRegions = Object.fromEntries(
      regionEntries.map(([id, region], index) => [id, index < 8 ? { ...region, ownerFactionId: PLAYER_FACTION_ID } : region]),
    );
    const checked = checkGameStatus({ ...state, regions: eightRegions });

    assert.equal(checked.gameStatus, 'victory');
    assert.equal(checked.result?.controlledRegions, 8);
  });

  test('25ターンのスモーク進行で状態が壊れない', () => {
    let state = createInitialGameState('normal');
    for (let index = 0; index < 25 && state.gameStatus === 'playing'; index += 1) {
      state = performDomestic(state, index % 2 === 0 ? 'riceYield' : 'publicOrder').state;
      state = performRecruitTroops(state).state;
      state = performTrain(state).state;
      state = endPlayerTurn(state).state;
    }

    assert.ok(typeof state.turn === 'number');
    assert.ok(Object.keys(state.regions).length === 12);
    assert.ok(Object.keys(state.factions).length >= 5);
    assert.ok(Object.keys(state.officers).length >= 20);
  });

  report();
}

run();
