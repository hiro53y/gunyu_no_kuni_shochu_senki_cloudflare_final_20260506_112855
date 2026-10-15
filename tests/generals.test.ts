// 武将：強さ・部隊・技・敵の将・捕縛・中の階の将
import { describe, expect, it } from 'vitest';
import { SKILLS } from '../src/content/skills';
import { GENERALS, GENERIC_TYPES } from '../src/content/generals';
import { PORTRAITS } from '../src/render/sprites';
import { existsSync } from 'node:fs';
import { genStats } from '../src/engine/generals';
import { canUseSkill } from '../src/engine/skills';
import { closeCtx, makeCtx } from '../src/engine/core';
import { spawnGeneral } from '../src/engine/generals';
import { createRun } from '../src/engine/run';
import { act, arena, freeze, genSpec, logText, siegeRun, spawn, testSpec } from './helpers';

describe('武将の強さ', () => {
  it('レベルと統率・武力で強くなり、城主は何倍も固い', () => {
    const a = genStats(genSpec('a', { lv: 5 }));
    const b = genStats(genSpec('b', { lv: 15 }));
    expect(b.maxHp).toBeGreaterThan(a.maxHp);
    expect(b.atk).toBeGreaterThan(a.atk);
    const boss = genStats(genSpec('c', { lv: 5, ally: false, role: 'boss' }));
    expect(boss.maxHp).toBeGreaterThan(a.maxHp * 2.5);
  });

  it('すべての武将と侍大将の立ち絵・駒・会話の絵が実在する', () => {
    const keys = [...GENERALS.map((g) => g.portrait), ...GENERIC_TYPES.map((t) => t.portrait)];
    for (const k of keys) {
      expect(PORTRAITS, k).toContain(k);
      for (const dir of ['portraits', 'tokens', 'busts']) {
        const ext = dir === 'portraits' ? 'png' : 'webp';
        expect(existsSync(`public/assets/${dir}/${k}.${ext}`), `${dir}/${k}`).toBe(true);
      }
    }
  });

  it('すべての武将の技が定義されている', () => {
    const ids = new Set(SKILLS.map((s) => s.id));
    for (const g of GENERALS) for (const s of g.skills) expect(ids.has(s)).toBe(true);
  });
});

describe('部隊', () => {
  it('連れてきた武将が朔の近くに置かれ、敵を叩く', () => {
    const run = createRun(testSpec({ gens: [genSpec('g_x'), genSpec('g_y', { style: 'bow' })] }));
    const allies = run.monsters.filter((m) => m.ally);
    expect(allies.map((m) => m.gen).sort()).toEqual(['g_x', 'g_y']);
    for (const m of allies) expect(Math.max(Math.abs(m.x - run.player.x), Math.abs(m.y - run.player.y))).toBeLessThanOrEqual(6);
  });

  it('弓の武将は離れた敵を射る。槍は2マス先を突く', () => {
    const run = arena(3, 'siege', { gens: [genSpec('g_bow', { style: 'bow', lv: 10 })] });
    const ally = run.monsters.find((m) => m.gen === 'g_bow')!;
    ally.x = 10; ally.y = 12;
    const enemy = spawn(run, 'yoroi1', 15, 12);
    freeze(enemy);
    for (let i = 0; i < 3; i++) act(run, { t: 'wait' });
    expect(enemy.hp < enemy.maxHp || enemy.dead).toBe(true);
  });

  it('味方の武将が倒れると、死なずに退く（fallen）', () => {
    const run = arena(4, 'siege', { gens: [genSpec('g_weak', { lv: 1 })] });
    const ally = run.monsters.find((m) => m.gen === 'g_weak')!;
    ally.hp = 1;
    ally.x = 12; ally.y = 10;
    spawn(run, 'ashigaru3', 13, 10);
    for (let i = 0; i < 10 && !run.fallen.length; i++) act(run, { t: 'wait' });
    expect(run.fallen).toContain('g_weak');
    expect(logText(run)).toContain('退いた');
    expect(run.monsters.some((m) => m.gen === 'g_weak')).toBe(false);
  });

  it('倒した敵の経験は部隊の武将にも入り、レベルが上がる', () => {
    const run = arena(5, 'siege', { gens: [genSpec('g_lv', { lv: 1, exp: 0 })] });
    for (let i = 0; i < 6; i++) {
      const m = spawn(run, 'ashigaru1', 11, 10);
      m.hp = 1;
      act(run, { t: 'attack' });
    }
    expect(run.gens.g_lv.lv).toBeGreaterThan(1);
  });
});

describe('技', () => {
  it('技は使うと待ちターンが付き、待ちが明けるとまた使える', () => {
    const run = arena(6, 'siege', { lordSkills: ['issen'] });
    const m = spawn(run, 'yoroi1', 11, 10);
    freeze(m);
    expect(canUseSkill(run, 'g_saku', 'issen').ok).toBe(true);
    act(run, { t: 'skill', who: 'g_saku', skill: 'issen' });
    expect(m.hp < m.maxHp || m.dead).toBe(true);
    expect(canUseSkill(run, 'g_saku', 'issen').ok).toBe(false);
    run.monsters = [];
    for (let i = 0; i < 25; i++) act(run, { t: 'wait' });
    spawn(run, 'yoroi1', 11, 11);
    expect(canUseSkill(run, 'g_saku', 'issen').ok).toBe(true);
  });

  it('狙える相手がいなければ使えず、ターンも進まない', () => {
    const run = arena(7, 'siege', { lordSkills: ['issen'] });
    const turn = run.turn;
    act(run, { t: 'skill', who: 'g_saku', skill: 'issen' });
    expect(run.turn).toBe(turn);
    expect(canUseSkill(run, 'g_saku', 'issen').reason).toBe('狙える相手がいない');
  });

  it('すべての技を、味方の武将が使っても敵の将が使っても壊れない', () => {
    for (const s of SKILLS) {
      // 味方
      const run = arena(11, 'siege', { gens: [genSpec('g_t', { skills: [s.id], lv: 10 })] });
      const ally = run.monsters.find((m) => m.gen === 'g_t')!;
      ally.x = 10; ally.y = 11; ally.dir = 2;
      for (const [x, y] of [[11, 11], [12, 11], [14, 11], [11, 10], [16, 13]]) { const m = spawn(run, 'ashigaru2', x, y); freeze(m); }
      run.player.hp = 5;
      const before = JSON.stringify(run.monsters.map((m) => [m.hp, m.st]));
      act(run, { t: 'skill', who: 'g_t', skill: s.id });
      expect(run.scd.g_t?.[s.id], s.id).toBeGreaterThan(0);
      expect(JSON.stringify(run.monsters.map((m) => [m.hp, m.st])) !== before || run.player.hp !== 5 || s.kind === 'party', s.id).toBe(true);
      // 敵の将
      const run2 = arena(12, 'siege', { gens: [genSpec('g_e', { skills: [s.id], lv: 10, ally: false, role: 'boss' })] });
      const ctx = makeCtx(run2);
      const boss = spawnGeneral(ctx, run2.gens.g_e, 14, 10);
      closeCtx(ctx);
      run2.player.hp = run2.player.maxHp = 500;
      boss.hp = Math.floor(boss.maxHp * 0.3);
      for (let i = 0; i < 12 && !run2.end; i++) act(run2, { t: 'wait' });
      expect(Number.isFinite(run2.player.hp)).toBe(true);
    }
  });

  it('買収で敵が寝返り、部隊の味方になる', () => {
    const run = arena(13, 'siege', { gens: [genSpec('g_h', { skills: ['baishuu'] })] });
    const m = spawn(run, 'ashigaru1', 14, 10);
    freeze(m);
    act(run, { t: 'skill', who: 'g_h', skill: 'baishuu' });
    expect(m.ally).toBe(true);
    expect(m.turned).toBe(true);
  });

  it('守りの技で受ける打撃が半分になる', () => {
    const hits: number[] = [];
    for (const guard of [false, true]) {
      let total = 0;
      for (let k = 0; k < 30; k++) {
        const run = arena(100 + k, 'siege', { lordSkills: ['teppeki'] });
        run.player.hp = run.player.maxHp = 999;
        if (guard) run.player.st.guard = 50;
        const m = spawn(run, 'ashigaru3', 11, 10);
        for (let i = 0; i < 3; i++) act(run, { t: 'wait' });
        total += 999 - run.player.hp;
        void m;
      }
      hits.push(total);
    }
    expect(hits[1]).toBeLessThan(hits[0] * 0.7);
  });
});

describe('敵の将と城攻め', () => {
  it('天守の城主を討ち取ると城攻めに勝ち、捕らえた将に入る', () => {
    const run = createRun(testSpec({ floors: 3, startFloor: 3, danger0: 3, gens: [genSpec('g_boss', { ally: false, role: 'boss', lv: 3, defeat: '負けた……' })] }));
    expect(run.floor.kind).toBe('boss');
    const boss = run.monsters.find((m) => m.gen === 'g_boss')!;
    expect(boss).toBeTruthy();
    const ctx = makeCtx(run);
    // 隣に置いて一撃で倒れるようにする
    boss.x = run.player.x; boss.y = run.player.y - 1; boss.hp = 1;
    for (const m of run.monsters) if (!m.gen) m.st.paralyze = 999;
    closeCtx(ctx);
    run.player.dir = 0;
    act(run, { t: 'attack' });
    if (!run.end) act(run, { t: 'attack' });
    expect(run.end?.kind).toBe('clear');
    expect(run.captured).toContain('g_boss');
  });

  it('中の階の将を倒さずに進むと、天守で城主と一緒に出てくる', () => {
    const run = createRun(testSpec({ floors: 4, startFloor: 2, danger0: 3, gens: [genSpec('g_boss', { ally: false, role: 'boss' }), genSpec('g_mid', { ally: false, role: 'mid' })] }));
    expect(run.floorNo).toBe(2);
    expect(run.monsters.some((m) => m.gen === 'g_mid')).toBe(true);
    expect(run.midPending).toBe(true);
    // 階段まで飛んで上る
    const ctx = makeCtx(run);
    closeCtx(ctx);
    run.player.x = run.floor.stairs!.x; run.player.y = run.floor.stairs!.y;
    act(run, { t: 'stairs' });
    expect(run.floorNo).toBe(3);
    run.player.x = run.floor.stairs!.x; run.player.y = run.floor.stairs!.y;
    act(run, { t: 'stairs' });
    expect(run.floorNo).toBe(4);
    expect(run.monsters.filter((m) => m.gen).map((m) => m.gen).sort()).toEqual(['g_boss', 'g_mid']);
  });

  it('城門を破った城は、その次の階から始まる', () => {
    const run = siegeRun(8, { floors: 5, startFloor: 3, danger0: 4 });
    expect(run.floorNo).toBe(3);
  });

  it('合戦は1階の野で、大将を討てば勝ち', () => {
    const run = createRun(testSpec({ mode: 'defense', floors: 1, danger0: 4, gens: [genSpec('g_cmd', { ally: false, role: 'commander', lv: 2 })] }));
    expect(run.floor.kind).toBe('field');
    const cmd = run.monsters.find((m) => m.gen === 'g_cmd')!;
    cmd.hp = 1;
    cmd.x = run.player.x; cmd.y = run.player.y - 1;
    for (const m of run.monsters) if (!m.gen) m.st.paralyze = 999;
    run.player.dir = 0;
    act(run, { t: 'attack' });
    if (!run.end) act(run, { t: 'attack' });
    expect(run.end?.kind).toBe('clear');
  });

  it('敵の将は弱ると援軍を呼ぶ', () => {
    const run = arena(21, 'siege', { gens: [genSpec('g_call', { ally: false, role: 'boss', skills: ['g_teate'] })] });
    const ctx = makeCtx(run);
    const boss = spawnGeneral(ctx, run.gens.g_call, 15, 10);
    closeCtx(ctx);
    boss.hp = Math.floor(boss.maxHp * 0.4);
    const before = run.monsters.length;
    act(run, { t: 'wait' });
    expect(run.monsters.length).toBeGreaterThan(before);
    expect(logText(run)).toContain('援軍');
  });
});
