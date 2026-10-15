// 合戦の単体テスト：打撃の式・時間の目盛り・手番の遅れ・射程・足軽のガード・反撃・準備と崩し・防御式神・付与・回復・戦果と勝敗・暗殺・総当たり
import { describe, expect, it } from 'vitest';
import {
  act, alive, assassinChance, baseDamage, byGauge, canUse, createBattle, delayAfter, effTroops, gauge, healAmount, legalTargets, predictSlot, rating, upcoming, type UnitSpec,
} from '../src/battle/engine';
import { chooseAction } from '../src/battle/ai';
import { KINDS, kindSkills, SKILL_TABLE, battleSkill } from '../src/battle/kinds';
import type { Battle, Ground, Kind, Unit } from '../src/battle/types';

export function spec(kind: Kind, row: 0 | 1, slot: 0 | 1 | 2, o: Partial<UnitSpec> = {}): UnitSpec {
  return {
    gen: `${kind}${row}${slot}`, name: `${kind}${row}${slot}`, short: kind, portrait: 'generic_normal', kind, lv: 10,
    atk: 5, def: 5, int: 5, spd: 5, troops: 500, maxTroops: 500, row, slot, skills: kindSkills(kind, 30), ...o,
  };
}

function battle(L: UnitSpec[], R: UnitSpec[], seed = 1, ticks = 60, ground: Ground = 'field'): Battle {
  return createBattle({ seed, kind: 'field', ground, region: '01', defender: 'R', ticks, L, R });
}

const side = (b: Battle, s: 'L' | 'R') => b.units.filter((u) => u.side === s);
const first = (b: Battle, s: 'L' | 'R', kind?: Kind) => side(b, s).find((u) => !kind || u.kind === kind)!;

/** 指定した部隊に手番を回す（ほかの部隊は待機させる） */
function untilTurn(b: Battle, uid: number) {
  for (let i = 0; i < 300 && !b.end && b.active !== uid; i++) act(b, { t: 'wait' });
  if (b.active !== uid) throw new Error('手番が回らない');
}

function unitLike(o: Partial<Unit>): Unit {
  return {
    uid: 1, side: 'L', gen: 'x', name: 'x', short: 'x', portrait: 'p', kind: 'bushi', lv: 1, atk: 5, def: 5, int: 5, spd: 5, troops: 500, maxTroops: 500, startTroops: 500,
    ap: 4, apMax: 4, row: 0, slot: 0, skills: [], next: 0, guard: 0, guarding: false, buffs: { atk: 0, def: 0, int: 0, spd: 0 }, barrier: false, prep: null, out: false, dealt: 0, kills: 0, ...o,
  };
}

describe('打撃の式', () => {
  it('兵数の補正：100未満は100、500〜は伸びが半分、2000〜は1/4', () => {
    expect(effTroops(50)).toBe(100);
    expect(effTroops(99)).toBe(100);
    expect(effTroops(100)).toBe(100);
    expect(effTroops(499)).toBe(499);
    expect(effTroops(500)).toBe(500);
    expect(effTroops(1000)).toBe(750);
    expect(effTroops(2000)).toBe(1250);
    expect(effTroops(3000)).toBe(1500);
  });

  it('打撃＝[兵数×（攻撃力−防御力）÷10]。攻撃力＝兵種の攻＋攻、防御力＝兵種の防＋防×0.8', () => {
    const a = unitLike({ kind: 'bushi', atk: 5, troops: 500 });
    const t = unitLike({ kind: 'ashigaru', def: 5 });
    // (6+5) − (2+5×0.8) = 5 → 500×5/10 = 250
    expect(baseDamage(a, t, false)).toBeCloseTo(250);
    // 上限は元の兵数
    expect(baseDamage(unitLike({ kind: 'teppo', atk: 9, troops: 100 }), unitLike({ kind: 'miko', def: 0 }), false)).toBe(100);
    // 下限は補正した兵数の1/10
    expect(baseDamage(unitLike({ kind: 'miko', atk: 0, troops: 1000 }), unitLike({ kind: 'bushi', def: 9 }), false)).toBe(75);
  });

  it('術は知で計算する（魔攻＋知 − 知×0.7）', () => {
    const a = unitLike({ kind: 'onmyo', int: 8, troops: 300 });
    const t = unitLike({ kind: 'bushi', int: 5 });
    expect(baseDamage(a, t, true)).toBeCloseTo((300 * (4 + 8 - 3.5)) / 10);
  });

  it('回復＝[兵数×知×0.06]×倍率', () => {
    expect(healAmount(unitLike({ kind: 'miko', int: 6, troops: 300 }), 1)).toBe(108);
  });
});

describe('時間の目盛りと手番', () => {
  it('待機を含め、1行動ごとに目盛りが1つ減り、尽きると戦果で決着', () => {
    const b = battle([spec('bushi', 0, 0)], [spec('bushi', 0, 0)], 1, 3);
    expect(b.ticks).toBe(3);
    act(b, { t: 'wait' });
    expect(b.ticks).toBe(2);
    act(b, { t: 'wait' });
    act(b, { t: 'wait' });
    expect(b.end?.reason).toBe('time');
    // 打撃が無く五分なら守る側（R）の勝ち
    expect(b.end?.winner).toBe('R');
  });

  it('延長戦で目盛りが戻り、時間経過で減る', () => {
    const b = battle([spec('sohei', 0, 0, { skills: ['h_enchou'] }), spec('gunshi', 1, 1, { skills: ['g_jikan'] })], [spec('bushi', 0, 0)], 2, 20);
    const so = first(b, 'L', 'sohei');
    untilTurn(b, so.uid);
    const t0 = b.ticks;
    act(b, { t: 'skill', skill: 'h_enchou' });
    expect(b.ticks).toBe(t0 + 4 - 1);
    const gs = first(b, 'L', 'gunshi');
    untilTurn(b, gs.uid);
    const t1 = b.ticks;
    act(b, { t: 'skill', skill: 'g_jikan' });
    expect(b.ticks).toBe(t1 - 2 - 1);
  });

  it('次の手番＝今＋兵種の遅れ＋速さの補正（速0で+8、1ごとに−2）＋硬直', () => {
    const b = battle([spec('bushi', 0, 0, { spd: 3, skills: ['b_tame', 'b_atk'] })], [spec('ashigaru', 0, 0)], 3);
    const u = first(b, 'L');
    untilTurn(b, u.uid);
    const now = b.time;
    const spdBuff = u.buffs.spd > 0 ? 4 : 0;
    act(b, { t: 'skill', skill: 'b_tame' });
    expect(u.next).toBe(now + KINDS.bushi.delay + (8 - 2 * 3) - spdBuff + 5);
    expect(delayAfter(u, 20)).toBe(KINDS.bushi.delay + 2 - spdBuff + 20);
  });

  it('硬直の短い技ほど、次の手番の予告（緑の矢印）が前に来る', () => {
    const b = battle([spec('bushi', 0, 0, { skills: ['b_tame', 'b_zenryoku'] }), spec('yumi', 1, 0)], [spec('bushi', 0, 0), spec('yumi', 1, 1), spec('ashigaru', 0, 1)], 4);
    const u = first(b, 'L', 'bushi');
    untilTurn(b, u.uid);
    const quick = predictSlot(b, u.uid, 'b_tame');
    const slow = predictSlot(b, u.uid, 'b_zenryoku');
    expect(quick).toBeGreaterThanOrEqual(0);
    expect(slow === -1 || slow >= quick).toBe(true);
  });

  it('技数が尽きた部隊は手番が回らず、全員尽きると戦果で決着', () => {
    const b = battle([spec('teppo', 0, 0, { skills: ['t_shot'] })], [spec('teppo', 0, 0, { skills: ['t_shot'] })], 5, 50);
    for (let i = 0; i < 20 && !b.end; i++) act(b, chooseAction(b));
    expect(b.end).not.toBeNull();
    for (const u of b.units) expect(u.ap).toBeGreaterThanOrEqual(0);
    expect(['exhaust', 'wipe', 'time']).toContain(b.end!.reason);
  });
});

describe('射程', () => {
  it('近距離は前衛の列からしか使えず、敵の前衛の列だけを狙える', () => {
    const b = battle([spec('bushi', 0, 0), spec('bushi', 1, 1)], [spec('bushi', 0, 0), spec('yumi', 1, 1)]);
    const front = side(b, 'L').find((u) => u.row === 0)!;
    const back = side(b, 'L').find((u) => u.row === 1)!;
    expect(canUse(b, front, 'b_atk').ok).toBe(true);
    expect(canUse(b, back, 'b_atk').ok).toBe(false);
    expect(legalTargets(b, front, 'b_atk').map((u) => u.row)).toEqual([0]);
    expect(legalTargets(b, front, 'y_atk').length).toBe(2);
  });

  it('鉄砲は後衛の列から撃てない。弓の一斉射撃は後衛からでも撃てる', () => {
    const b = battle([spec('teppo', 1, 0), spec('yumi', 1, 1), spec('bushi', 0, 0)], [spec('bushi', 0, 0)]);
    expect(canUse(b, first(b, 'L', 'teppo'), 't_kantsu2').ok).toBe(false);
    expect(canUse(b, first(b, 'L', 'yumi'), 'y_issei').ok).toBe(true);
  });

  it('前衛が全滅すると後衛が前に出て、近距離で狙われる', () => {
    const b = battle([spec('bushi', 0, 0)], [spec('bushi', 0, 0), spec('yumi', 1, 1)]);
    const ef = side(b, 'R').find((u) => u.row === 0)!;
    ef.out = true; ef.troops = 0;
    expect(legalTargets(b, first(b, 'L'), 'b_atk').map((u) => u.kind)).toEqual(['yumi']);
  });

  it('貫通は狙った段の前衛と後衛をまとめて打つ', () => {
    const b = battle([spec('teppo', 0, 1, { skills: ['t_kantsu'] })], [spec('bushi', 0, 1), spec('yumi', 1, 1), spec('yumi', 1, 0)]);
    const me = first(b, 'L');
    untilTurn(b, me.uid);
    act(b, { t: 'skill', skill: 't_kantsu', target: side(b, 'R').find((u) => u.row === 0)!.uid });
    const hit = side(b, 'R').filter((u) => u.troops < u.maxTroops).map((u) => `${u.row}${u.slot}`).sort();
    expect(hit).toEqual(['01', '11']);
  });
});

describe('足軽のガード', () => {
  it('合戦の初めからガード50%。100%以上なら同じ列の味方を必ずかばい、打撃は半分、ガード率は40%下がる', () => {
    const b = battle([spec('yumi', 1, 0, { skills: ['y_atk'] })], [spec('ashigaru', 0, 0), spec('bushi', 0, 1)], 6);
    const ash = first(b, 'R', 'ashigaru');
    expect(ash.guard).toBe(0.5);
    expect(ash.guarding).toBe(true);
    ash.guard = 1.2;
    const bushi = first(b, 'R', 'bushi');
    const me = first(b, 'L');
    untilTurn(b, me.uid);
    const expectFull = baseDamage(me, ash, false) * (1 + b.field.L);
    act(b, { t: 'skill', skill: 'y_atk', target: bushi.uid });
    expect(bushi.troops).toBe(bushi.maxTroops);
    expect(ash.maxTroops - ash.troops).toBe(Math.floor(expectFull * 0.5));
    expect(ash.guard).toBeCloseTo(0.8);
  });

  it('違う列の味方はかばわない（全体ガードなら全員をかばう）', () => {
    const b = battle([spec('yumi', 1, 0, { skills: ['y_atk'] })], [spec('ashigaru', 0, 0), spec('yumi', 1, 1)], 7);
    const ash = first(b, 'R', 'ashigaru');
    ash.guard = 2;
    const back = first(b, 'R', 'yumi');
    const me = first(b, 'L');
    untilTurn(b, me.uid);
    act(b, { t: 'skill', skill: 'y_atk', target: back.uid });
    expect(back.troops).toBeLessThan(back.maxTroops);
    ash.guardAll = true;
    ash.guarding = true;
    const before = back.troops;
    untilTurn(b, me.uid);
    act(b, { t: 'skill', skill: 'y_atk', target: back.uid });
    expect(back.troops).toBe(before);
  });

  it('全体攻撃はかばえず、術はガードの半減を受けない', () => {
    const b = battle([spec('onmyo', 1, 0, { skills: ['o_shiki'] })], [spec('ashigaru', 0, 0), spec('bushi', 0, 1)], 8);
    const ash = first(b, 'R', 'ashigaru');
    ash.guard = 3;
    const me = first(b, 'L');
    untilTurn(b, me.uid);
    act(b, { t: 'skill', skill: 'o_shiki' });
    // 準備のあと、次の手番で発動する
    for (let i = 0; i < 50 && !b.end && me.prep; i++) act(b, { t: 'wait' });
    const bushi = first(b, 'R', 'bushi');
    expect(bushi.troops).toBeLessThan(bushi.maxTroops);
    expect(ash.guard).toBe(3);
  });

  it('ガード崩しは半減を受けず、ガード解除は敵全体のガードを0にする', () => {
    const b = battle([spec('bushi', 0, 0, { skills: ['b_kuzushi'] }), spec('sohei', 0, 1, { skills: ['h_kaijo'] })], [spec('ashigaru', 0, 0), spec('ashigaru', 0, 1)], 9);
    const me = first(b, 'L', 'bushi');
    const t = first(b, 'R');
    untilTurn(b, me.uid);
    const full = Math.floor(baseDamage(me, t, false) * 0.8 * (1 + b.field.L));
    const before = side(b, 'R').map((u) => u.troops);
    act(b, { t: 'skill', skill: 'b_kuzushi', target: t.uid });
    const lost = side(b, 'R').reduce((s, u, i) => s + (before[i] - u.troops), 0);
    expect(lost).toBe(full);
    const so = first(b, 'L', 'sohei');
    untilTurn(b, so.uid);
    act(b, { t: 'skill', skill: 'h_kaijo' });
    for (const u of side(b, 'R')) { expect(u.guard).toBe(0); expect(u.guarding).toBe(false); }
  });
});

describe('反撃・準備・防御式神・付与', () => {
  it('近距離で武士を斬ると、技の反撃率の分だけ反撃を受ける。弓兵は反撃できない', () => {
    const b = battle([spec('bushi', 0, 0, { skills: ['b_atk'] })], [spec('bushi', 0, 0), spec('yumi', 0, 1)], 10);
    const me = first(b, 'L');
    const foe = first(b, 'R', 'bushi');
    untilTurn(b, me.uid);
    const counter = Math.floor(baseDamage(foe, me, false) * 0.25);
    const myBefore0 = me.troops;
    act(b, { t: 'skill', skill: 'b_atk', target: foe.uid });
    expect(myBefore0 - me.troops).toBe(counter);
    const yumi = first(b, 'R', 'yumi');
    untilTurn(b, me.uid);
    const myBefore = me.troops;
    act(b, { t: 'skill', skill: 'b_atk', target: yumi.uid });
    expect(me.troops).toBe(myBefore);
  });

  it('要準備の技は手裏剣が当たると崩れる（崩すのに2回要る技もある）', () => {
    const b = battle([spec('shinobi', 1, 0, { skills: ['s_shuri'], spd: 9, troops: 100, maxTroops: 100 })], [spec('onmyo', 1, 0, { skills: ['o_shiki'] }), spec('onmyo', 1, 1, { skills: ['kaenjin'] })], 11);
    const ninja = first(b, 'L');
    const [o1, o2] = side(b, 'R');
    o1.prep = { skill: 'o_shiki', target: null, hits: 0 };
    o1.next = 9999;
    o2.prep = { skill: 'kaenjin', target: null, hits: 0 };
    o2.next = 9999;
    untilTurn(b, ninja.uid);
    act(b, { t: 'skill', skill: 's_shuri', target: o1.uid });
    expect(o1.prep).toBeNull();
    untilTurn(b, ninja.uid);
    act(b, { t: 'skill', skill: 's_shuri', target: o2.uid });
    expect(o2.prep?.hits).toBe(1);
    untilTurn(b, ninja.uid);
    act(b, { t: 'skill', skill: 's_shuri', target: o2.uid });
    expect(o2.prep).toBeNull();
  });

  it('防御式神はどんな攻撃も一度だけ防ぐ', () => {
    const b = battle([spec('teppo', 0, 0, { skills: ['t_shot'] })], [spec('bushi', 0, 0)], 12);
    const me = first(b, 'L');
    const foe = first(b, 'R');
    foe.barrier = true;
    untilTurn(b, me.uid);
    act(b, { t: 'skill', skill: 't_shot', target: foe.uid });
    expect(foe.troops).toBe(foe.maxTroops);
    expect(foe.barrier).toBe(false);
  });

  it('軍師は合戦の初めに、知の数だけ付与を配る（知×5%）', () => {
    const b = battle([spec('gunshi', 1, 0, { int: 6 }), spec('bushi', 0, 0), spec('ashigaru', 0, 1)], [spec('bushi', 0, 0)], 13);
    const total = side(b, 'L').reduce((s, u) => s + [u.buffs.atk, u.buffs.def, u.buffs.int, u.buffs.spd].filter((x) => x > 0).length, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(6);
    for (const u of side(b, 'L')) for (const v of Object.values(u.buffs)) expect(v === 0 || Math.abs(v - 0.3) < 1e-9).toBe(true);
  });

  it('突進は相手の技数を1減らす', () => {
    const b = battle([spec('kiba', 0, 0, { skills: ['k_tosshin'] })], [spec('yumi', 1, 0, { troops: 2000, maxTroops: 2000 })], 14);
    const me = first(b, 'L');
    const foe = first(b, 'R');
    untilTurn(b, me.uid);
    const ap = foe.ap;
    act(b, { t: 'skill', skill: 'k_tosshin', target: foe.uid });
    expect(foe.ap).toBe(ap - 1);
  });
});

describe('戦果と勝敗', () => {
  it('戦果は与えた打撃の割合。守る側は戦場で初めの上乗せ（野10・町20・城40）', () => {
    const f = battle([spec('bushi', 0, 0)], [spec('bushi', 0, 0)], 15, 60, 'field');
    const c = battle([spec('bushi', 0, 0)], [spec('bushi', 0, 0)], 15, 60, 'castle');
    expect(rating(f)).toBe(-10);
    expect(rating(c)).toBe(-40);
    expect(gauge(c)).toBe(30);
    f.dmg.L = 300; f.dmg.R = 100;
    expect(rating(f)).toBeCloseTo(50 - 10);
    expect(byGauge(f)).toBe('L');
  });

  it('部隊を壊滅させると戦果+5', () => {
    const b = battle([spec('teppo', 0, 0, { skills: ['t_shot'], atk: 9 })], [spec('miko', 0, 0, { troops: 30, maxTroops: 30 }), spec('miko', 0, 1)], 16);
    const me = first(b, 'L');
    untilTurn(b, me.uid);
    const adj = b.adj.L;
    act(b, { t: 'skill', skill: 't_shot', target: first(b, 'R').uid });
    expect(first(b, 'R').out).toBe(true);
    expect(b.adj.L).toBe(adj + 5);
  });

  it('大将の部隊が壊滅すると負け', () => {
    const b = battle([spec('bushi', 0, 0, { lord: true, troops: 20, maxTroops: 500 }), spec('yumi', 1, 0)], [spec('teppo', 0, 0, { atk: 9, spd: 9 })], 17);
    for (let i = 0; i < 40 && !b.end; i++) act(b, chooseAction(b));
    if (first(b, 'L').out) expect(b.end).toEqual({ winner: 'R', reason: 'lord' });
  });

  it('暗殺は相手の兵が多いと決まりにくく、大将には効かない', () => {
    const a = unitLike({ troops: 300 });
    expect(assassinChance(a, unitLike({ troops: 100 }), 0.75)).toBeCloseTo(0.83);
    expect(assassinChance(a, unitLike({ troops: 500 }), 0.75)).toBeCloseTo(0.58);
    expect(assassinChance(a, unitLike({ troops: 1500 }), 0.75)).toBeCloseTo(0.41);
    expect(assassinChance(a, unitLike({ troops: 100, boss: true }), 0.75)).toBe(0);
  });
});

describe('技の表', () => {
  it('すべての兵種の技があり、置き換えた技は残らない', () => {
    for (const k of Object.keys(KINDS) as Kind[]) {
      for (const [id] of KINDS[k].skills) expect(SKILL_TABLE[id], id).toBeTruthy();
      const at30 = kindSkills(k, 30);
      for (const [, , rep] of KINDS[k].skills) if (rep) expect(at30).not.toContain(rep);
    }
    expect(battleSkill('issen').name).toBe('一閃');
  });
});

describe('総当たりと再現', () => {
  const kinds = Object.keys(KINDS) as Kind[];
  function randomArmy(seed: number, n: number, sideKey: string): UnitSpec[] {
    let s = seed;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const out: UnitSpec[] = [];
    const places: [0 | 1, 0 | 1 | 2][] = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]];
    for (let i = 0; i < n; i++) {
      const kind = kinds[Math.floor(rnd() * kinds.length)];
      const troops = 50 + Math.floor(rnd() * 1500);
      const lv = 1 + Math.floor(rnd() * 30);
      const st = () => Math.floor(rnd() * 10);
      out.push(spec(kind, places[i][0], places[i][1], {
        gen: `${sideKey}${i}`, troops, maxTroops: troops + Math.floor(rnd() * 300), lv, atk: st(), def: st(), int: st(), spd: st(), skills: kindSkills(kind, lv),
        lord: sideKey === 'L' && i === 0, traits: rnd() < 0.3 ? [(['firstStrike', 'counterUp', 'luckAtk', 'initTime', 'autoHeal', 'guardPlus'] as const)[Math.floor(rnd() * 6)]] : [],
      }));
    }
    return out;
  }

  it('でたらめな行動と AI で3,000戦しても、数が壊れず必ず終わる', () => {
    for (let i = 0; i < 3000; i++) {
      const L = randomArmy(i * 7 + 1, 1 + (i % 6), 'L');
      const R = randomArmy(i * 13 + 5, 1 + ((i * 5) % 6), 'R');
      const b = createBattle({ seed: i, kind: 'field', ground: (['field', 'town', 'castle'] as const)[i % 3], region: '01', defender: i % 2 ? 'L' : 'R', L, R });
      let steps = 0;
      while (!b.end && steps < 400) {
        const u = b.units.find((x) => x.uid === b.active)!;
        let a = chooseAction(b);
        if (i % 2 === 0 && steps % 3 === 0) {
          const ok = u.skills.filter((s) => canUse(b, u, s).ok);
          const s = ok[(i + steps) % Math.max(1, ok.length)];
          const t = s ? legalTargets(b, u, s) : [];
          a = s ? { t: 'skill', skill: s, target: t.length ? t[(steps + i) % t.length].uid : undefined } : { t: 'wait' };
        }
        act(b, a);
        steps++;
        for (const x of b.units) {
          expect(x.troops).toBeGreaterThanOrEqual(0);
          expect(x.troops).toBeLessThanOrEqual(x.maxTroops);
          expect(x.ap).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(x.next)).toBe(true);
        }
        expect(b.ticks).toBeGreaterThanOrEqual(0);
      }
      expect(b.end, `battle ${i}`).not.toBeNull();
      expect(Number.isFinite(gauge(b))).toBe(true);
      expect(upcoming(b).every((u) => !u.out)).toBe(true);
      expect(alive(b, 'L').length + alive(b, 'R').length).toBeGreaterThan(0);
    }
  });

  it('同じ seed と同じ行動なら、同じ結果になる', () => {
    const run = () => {
      const b = createBattle({ seed: 77, kind: 'field', region: '01', defender: 'R', L: randomArmy(3, 6, 'L'), R: randomArmy(9, 6, 'R') });
      while (!b.end) act(b, chooseAction(b));
      return JSON.stringify(b);
    };
    expect(run()).toBe(run());
  });
});
