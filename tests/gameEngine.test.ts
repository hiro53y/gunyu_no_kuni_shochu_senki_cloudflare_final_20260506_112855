import assert from 'node:assert/strict';
import { createNewGame, checkVictory, endTurn, applyRestAction, applyScoutAction, consumeAp } from '../src/createGame';
import {
  applyBuildAction,
  applyCollectAction,
  autoResolve,
  createRng,
  deserializeSaveData,
  finalizeBattle,
  hireRonin,
  initBattle,
  serializeGameState,
} from '../src/engine';
import { createBattleForecast, getDeployableGenerals, hasBattleHistory } from '../src/engine/battleIntel';

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
    const state = createNewGame(1);
    const battle = initBattle(state, {
      regionId: '03',
      playerIsAttacker: true,
      attackerFactionId: 'akatsuki',
      defenderFactionId: 'kurogane',
      playerGeneralIds: ['g_kazama_saku', null, null, 'g_kazama_genba', null, null, 'g_asagiri_chikage', null, null],
      enemyGeneralIds: ['g_hagane_narukami', null, null, 'g_kurogane_genbu', null, null, 'g_akaganezaki_hayato', null, null],
    });
    const resolved = autoResolve(battle, state, createRng(10));

    assert.notEqual(resolved.result, 'in_progress');
    assert.ok(resolved.log.length > 1);
  });

  test('内政で国力と建設レベルが増える', () => {
    const state = createNewGame(2);
    const beforePower = state.regions['01'].power;
    const beforeFarm = state.regions['01'].buildLevels.farm;
    const outcome = applyBuildAction(state, '01', 'farm');

    assert.equal(outcome.ok, true);
    assert.equal(outcome.state.regions['01'].buildLevels.farm, beforeFarm + 1);
    assert.ok(outcome.state.regions['01'].power > beforePower);
  });

  test('徴収で金が増え、満足度が下がる', () => {
    const state = createNewGame(3);
    const beforeGold = state.factions.akatsuki.treasury;
    const beforeSatisfaction = state.regions['01'].satisfaction;
    const outcome = applyCollectAction(state, '01');

    assert.equal(outcome.ok, true);
    assert.ok(outcome.state.factions.akatsuki.treasury > beforeGold);
    assert.ok(outcome.state.regions['01'].satisfaction < beforeSatisfaction);
  });

  test('進軍勝利時に地域支配が変わる', () => {
    const state = createNewGame(4);
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
    const battle = initBattle(boosted, {
      regionId: '11',
      playerIsAttacker: true,
      attackerFactionId: 'akatsuki',
      defenderFactionId: 'rengein',
      playerGeneralIds: ['g_kazama_saku', null, null, 'g_kazama_genba', null, null, 'g_asagiri_chikage', null, null],
      enemyGeneralIds: ['g_rengein_kangetsu', null, null, 'g_horenbo_tesshin', null, null, null, null, null],
    });
    const resolved = autoResolve(battle, boosted, createRng(5));
    const finalized = finalizeBattle(boosted, { ...resolved, result: 'player_win' }, createRng(6));

    assert.equal(finalized.state.regions['11'].factionId, 'akatsuki');
  });

  test('登用で浪人を雇用できる', () => {
    const state = createNewGame(7);
    const target = state.roninPool[0];
    assert.ok(target);
    const prepared = {
      ...state,
      factions: {
        ...state.factions,
        akatsuki: { ...state.factions.akatsuki, treasury: 50000 },
      },
    };
    const outcome = hireRonin(prepared, target);

    assert.equal(outcome.ok, true);
    assert.equal(outcome.state.generals[target].factionId, 'akatsuki');
  });

  test('セーブデータのserialize/deserializeができる', () => {
    const state = createNewGame(8);
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
    const state = createNewGame(9);
    const entries = Object.entries(state.regions);
    const conquered = Object.fromEntries(
      entries.map(([id, region], index) => [id, index < 12 ? { ...region, factionId: 'akatsuki' as const } : region]),
    );
    const checked = checkVictory({ ...state, regions: conquered });

    assert.equal(checked, 'win_dominate');
  });

  test('25ターンのスモーク進行で状態が壊れない', () => {
    let state = createNewGame(11);
    for (let index = 0; index < 25 && state.victory === 'none'; index += 1) {
      const built = applyBuildAction(state, '01', index % 2 === 0 ? 'farm' : 'market');
      state = built.state;
      state = applyCollectAction(state, '01').state;
      state = applyRestAction(state, ['g_kazama_saku', 'g_kazama_genba']);
      state = endTurn(state);
    }

    assert.ok(typeof state.turn === 'number');
    assert.equal(Object.keys(state.regions).length, 15);
    assert.equal(Object.keys(state.factions).length, 8);
    assert.ok(Object.keys(state.generals).length >= 22);
  });

  test('出陣前の戦力予測が危険度と勝率を返す', () => {
    const state = createNewGame(12);
    const forecast = createBattleForecast(state, '03', getDeployableGenerals(state).slice(0, 3));

    assert.ok(forecast.winRate > 0);
    assert.ok(forecast.mainReason.length > 0);
    assert.equal(hasBattleHistory(state), false);
  });

  test('調略とAP消費が現在APIで動く', () => {
    const state = createNewGame(13);
    const consumed = consumeAp(state, 1);
    const scouted = applyScoutAction(state, '03');

    assert.equal(consumed.ok, true);
    assert.equal(consumed.state.ap, 2);
    assert.equal(scouted.ok, true);
  });

  report();
}

run();
