import assert from 'node:assert/strict';
import { createNewGame, checkVictory, endTurn } from '../src/createGame';
import { autoResolve, finalizeBattle, initBattle } from '../src/engine/battle';
import { applyBuildAction, applyCollectAction } from '../src/engine/economy';
import { runNpcTurn } from '../src/engine/npc';
import type { Rng } from '../src/engine/rng';
import { createRng } from '../src/engine/rng';
import { deserializeSaveData, serializeGameState } from '../src/engine/save';

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

function eagerRng(): Rng {
  return {
    next: () => 0,
    int: (min) => min,
    pick: (arr) => arr[0],
    chance: () => true,
    weighted: (items) => items[0],
    getSeed: () => 1,
  };
}

function report(): void {
  results.forEach((line) => console.log(line));
  console.log(`${results.length} tests passed`);
}

function run(): void {
  test('新規ゲームが現行データで作成できる', () => {
    const state = createNewGame(1234);
    assert.equal(state.turn, 1);
    assert.equal(Object.keys(state.regions).length, 15);
    assert.ok(Object.keys(state.generals).length >= 20);
    assert.equal(state.regions['01'].factionId, 'akatsuki');
  });

  test('建設で地域が強化され金を消費する', () => {
    const state = createNewGame(1234);
    const beforeGold = state.factions.akatsuki.treasury;
    const beforeFarm = state.regions['01'].buildLevels.farm;
    const outcome = applyBuildAction(state, '01', 'farm');

    assert.equal(outcome.ok, true);
    assert.equal(outcome.state.regions['01'].buildLevels.farm, beforeFarm + 1);
    assert.ok(outcome.state.factions.akatsuki.treasury < beforeGold);
  });

  test('徴収で金が増え満足度が下がる', () => {
    const state = createNewGame(1234);
    const beforeGold = state.factions.akatsuki.treasury;
    const beforeSatisfaction = state.regions['01'].satisfaction;
    const outcome = applyCollectAction(state, '01');

    assert.equal(outcome.ok, true);
    assert.ok(outcome.state.factions.akatsuki.treasury > beforeGold);
    assert.ok(outcome.state.regions['01'].satisfaction < beforeSatisfaction);
  });

  test('合戦を自動解決して戦後処理まで進められる', () => {
    const state = createNewGame(1234);
    const battle = initBattle(state, {
      regionId: '06',
      playerIsAttacker: true,
      attackerFactionId: 'akatsuki',
      defenderFactionId: 'shion',
      playerGeneralIds: ['g_kazama_saku', 'g_suzuran', 'g_asagiri_chikage', null, null, null, null, null, null],
      enemyGeneralIds: ['g_shionin_hazuki', 'g_shionin_fuuko', 'g_narumi_souji', null, null, null, null, null, null],
    });
    const resolved = autoResolve(battle, state, createRng(99));
    const finalized = finalizeBattle(state, resolved, createRng(100));

    assert.notEqual(resolved.result, 'in_progress');
    assert.equal(finalized.state.battleState, null);
    assert.ok(finalized.log.length > 0);
  });

  test('NPC侵攻がプレイヤー絡みでも作戦記へ反映される', () => {
    const state = { ...createNewGame(1234), turn: 4 };
    const next = runNpcTurn(state, eagerRng());

    assert.ok(next.log.some((entry) => entry.type === 'battle'));
    assert.ok(next.log.some((entry) => entry.message.includes('侵攻')));
  });

  test('ターン終了で月が進みNPCログも保持できる', () => {
    const state = createNewGame(1234);
    const next = endTurn(state);

    assert.equal(next.turn, 2);
    assert.equal(next.ap, next.apMax);
    assert.equal(next.victory, 'none');
    assert.ok(Array.isArray(next.log));
  });

  test('1ターン目終了で即敗北しない', () => {
    const next = endTurn(createNewGame(1));

    assert.equal(next.turn, 2);
    assert.notEqual(next.victory, 'lose_zero');
  });

  test('セーブデータのserialize/deserializeができる', () => {
    const state = createNewGame(1234);
    const raw = serializeGameState(state);
    const loaded = deserializeSaveData(raw);

    assert.equal(loaded.ok, true);
    assert.equal(loaded.state?.turn, 1);
  });

  test('壊れたセーブデータを拒否する', () => {
    const loaded = deserializeSaveData('{ broken json');

    assert.equal(loaded.ok, false);
    assert.equal(loaded.state, null);
  });

  test('勝利条件を判定できる', () => {
    const state = createNewGame(1234);
    const regions = Object.fromEntries(
      Object.entries(state.regions).map(([id, region]) => [id, { ...region, factionId: 'akatsuki' as const }]),
    );

    assert.equal(checkVictory({ ...state, regions }), 'win_dominate');
  });

  report();
}

run();
