// 自動プレイによる総当たり：でたらめな操作でも壊れないこと、上手なボットが城を攻め落とせること
import { describe, expect, it } from 'vitest';
import { createRun, type BattleSpec } from '../src/engine/run';
import { REGIONS, TERRAIN_BAND } from '../src/content/sengoku';
import { GENERALS } from '../src/content/generals';
import { expFor } from '../src/engine/core';
import type { GenSpec, RunMode } from '../src/engine/types';
import { mulberry, playOut, randomAction, smartAction } from './bot';
import { testSpec } from './helpers';

const RUNS = Number(process.env.FUZZ_RUNS ?? 30);

function gen(id: string, ally: boolean, lv: number, role?: GenSpec['role']): GenSpec {
  const d = GENERALS.find((g) => g.id === id)!;
  return {
    id, name: d.name, short: d.short, portrait: d.portrait, faction: d.faction, lv, exp: expFor(lv), cmd: d.cmd, pow: d.pow, int: d.int,
    skills: [...d.skills], style: d.style, youkai: d.youkai, ally, role,
  };
}

/** 国の城を、ほどよく育った朔と武将2人で攻める */
function castleSpec(i: number, mode: RunMode, strong = 1): BattleSpec {
  const r = REGIONS[1 + (i % (REGIONS.length - 1))];
  const lv = Math.max(3, Math.round(r.danger * 1.1 * strong));
  const allyIds = ['g_suzuran', 'g_chikage', 'g_genba', 'g_tesshin', 'g_rin', 'g_hayato', 'g_shizune'];
  const party = [allyIds[i % allyIds.length], allyIds[(i + 3) % allyIds.length]].map((id) => gen(id, true, lv));
  const enemies: GenSpec[] = [];
  if (mode === 'siege') {
    enemies.push(gen(r.boss, false, r.danger + 1, 'boss'));
    if (r.mid) enemies.push(gen(r.mid, false, r.danger, 'mid'));
  } else if (mode === 'defense') enemies.push({ ...gen('g_narukami', false, r.danger + 1, 'commander'), id: 'x1' });
  const base = testSpec();
  const tier = r.danger >= 12 ? ['w_hagane', 'a_hagane'] : r.danger >= 6 ? ['w_tetsu', 'a_tetsu'] : ['w_dou', 'a_dou'];
  const items = [
    { uid: 1, id: tier[0], plus: Math.floor(r.danger / 4), seals: [], cursed: false, known: true },
    { uid: 2, id: tier[1], plus: Math.floor(r.danger / 4), seals: [], cursed: false, known: true },
    { uid: 3, id: 'f_onigiri' }, { uid: 4, id: 'g_yakusou' }, { uid: 5, id: 'g_yakusou' }, { uid: 6, id: 'g_daiyakusou' },
  ];
  return {
    ...base, mode, seed: 3000 + i * 7919, region: r.id, faction: mode === 'hunt' ? 'youma' : r.owner === 'akatsuki' ? 'kurogane' : r.owner,
    danger0: r.danger, floors: mode === 'defense' ? 1 : mode === 'hunt' ? 3 : r.floors, band0: TERRAIN_BAND[r.terrain],
    lord: { lv, exp: expFor(lv), maxHp: 20 + (lv - 1) * 5, str: 9, maxStr: 9, maxHunger: 100 },
    items, eq: { weapon: 1, armor: 2 }, known: { f_onigiri: true, g_yakusou: true, g_daiyakusou: true }, gens: [...party, ...enemies],
    lordSkills: ['issen', 'kyouzaki'],
  };
}

describe('自動プレイ', () => {
  // 長い同期処理で Vitest の連絡が途切れないよう、10回ずつに分ける
  for (const mode of ['siege', 'defense', 'hunt', 'practice'] as RunMode[]) for (let chunk = 0; chunk < RUNS; chunk += 10) {
    it(`でたらめな操作（${mode} ${chunk + 1}〜${Math.min(RUNS, chunk + 10)}回目）で例外も不変条件の違反も起きない`, () => {
      const errors: string[] = [];
      for (let i = chunk; i < Math.min(RUNS, chunk + 10); i++) {
        const spec = mode === 'practice' ? testSpec({ mode, seed: 1000 + i, floors: 3, danger0: 1, region: '01', faction: 'ronin' }) : castleSpec(i, mode);
        const run = createRun(spec);
        const result = playOut(run, randomAction, mulberry(i + 1), 1500, 97);
        errors.push(...result.errors);
        if (errors.length) break;
      }
      expect(errors).toEqual([]);
    });
  }

  it('上手なボットが城を攻め、壊れずに勝ち負けがつく', () => {
    const errors: string[] = [];
    let wins = 0, total = 0;
    for (let i = 0; i < Math.max(14, Math.round(RUNS / 2)); i++) {
      const run = createRun(castleSpec(i, 'siege'));
      const result = playOut(run, smartAction, mulberry(i + 5), 30000, 211);
      errors.push(...result.errors);
      total++;
      if (result.run.end?.kind === 'clear') wins++;
      if (errors.length) break;
    }
    expect(errors).toEqual([]);
    expect(wins).toBeGreaterThan(0);
    console.log(`城攻めの勝ち ${wins}/${total}`);
  });

  it('合戦と修行も上手なボットで最後まで遊べる', () => {
    const errors: string[] = [];
    for (let i = 0; i < 10; i++) {
      for (const mode of ['defense', 'hunt'] as RunMode[]) {
        const run = createRun(castleSpec(i, mode));
        const result = playOut(run, smartAction, mulberry(i + 50), 20000, 101);
        errors.push(...result.errors);
        expect(result.run.end, `${mode} ${i}`).not.toBeNull();
      }
    }
    expect(errors).toEqual([]);
  });
});
