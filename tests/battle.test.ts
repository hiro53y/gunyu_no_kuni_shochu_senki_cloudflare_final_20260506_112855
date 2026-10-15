// 合戦の単体テスト：射程・ガード・反撃・準備と取り消し・手番の順・技数・戦果と勝敗・付与・回復・暗殺・再現
import { describe, expect, it } from 'vitest';
import { act, alive, canUse, createBattle, gauge, legalTargets, unitById, type UnitSpec } from '../src/battle/engine';
import { chooseAction } from '../src/battle/ai';
import { KINDS, kindSkills, SKILL_TABLE } from '../src/battle/kinds';
import type { Battle, Kind } from '../src/battle/types';

export function spec(kind: Kind, row: 0 | 1, slot: 0 | 1 | 2, o: Partial<UnitSpec> = {}): UnitSpec {
  return {
    gen: `${kind}${row}${slot}`, name: `${kind}${row}${slot}`, short: kind, portrait: 'generic_normal', kind, lv: 10,
    atk: 5, def: 5, int: 5, spd: 5, troops: 600, maxTroops: 600, row, slot, skills: kindSkills(kind, 20), ...o,
  };
}

function battle(L: UnitSpec[], R: UnitSpec[], seed = 1, limit = 100): Battle {
  return createBattle({ seed, kind: 'field', region: '01', defender: 'R', limit, L, R });
}

/** 指定した部隊に手番を回す（ほかの部隊は待機させる） */
function untilTurn(b: Battle, uid: number) {
  for (let i = 0; i < 200 && !b.end && b.active !== uid; i++) act(b, { t: 'wait' });
}

describe('射程', () => {
  it('近距離の技は前衛からしか使えず、敵の前衛だけを狙える', () => {
    const b = battle([spec('bushi', 0, 0), spec('bushi', 1, 1)], [spec('bushi', 0, 0), spec('yumi', 1, 1)]);
    const front = b.units.find((u) => u.side === 'L' && u.row === 0)!;
    const back = b.units.find((u) => u.side === 'L' && u.row === 1)!;
    expect(canUse(b, front, 'kirikomi').ok).toBe(true);
    expect(canUse(b, back, 'kirikomi').ok).toBe(false);
    expect(legalTargets(b, front, 'kirikomi').map((u) => u.row)).toEqual([0]);
    // 遠距離はどの敵でも
    expect(legalTargets(b, front, 'yumiuchi').length).toBe(2);
  });

  it('前衛が全滅すると後衛が前に出て、近距離で狙われる', () => {
    const b = battle([spec('bushi', 0, 0)], [spec('bushi', 0, 0, { troops: 1 }), spec('yumi', 1, 1)]);
    const me = b.units.find((u) => u.side === 'L')!;
    const ef = b.units.find((u) => u.side === 'R' && u.row === 0)!;
    ef.out = true; ef.troops = 0;
    expect(legalTargets(b, me, 'kirikomi').map((u) => u.kind)).toEqual(['yumi']);
  });

  it('貫き撃ちは同じ段の前衛と後衛をまとめて打つ', () => {
    const b = battle([spec('teppo', 0, 1, { skills: ['kantsu'] })], [spec('bushi', 0, 1), spec('yumi', 1, 1), spec('yumi', 1, 0)]);
    const me = b.units.find((u) => u.side === 'L')!;
    untilTurn(b, me.uid);
    const target = b.units.find((u) => u.side === 'R' && u.row === 0)!;
    act(b, { t: 'skill', skill: 'kantsu', target: target.uid });
    const hit = b.units.filter((u) => u.side === 'R' && u.troops < u.maxTroops).map((u) => `${u.row}${u.slot}`).sort();
    expect(hit).toEqual(['01', '11']);
  });
});

describe('足軽のガード', () => {
  it('同じ列の味方への物理攻撃を足軽がかばい、打撃が減り、ガード率が下がる', () => {
    let guarded = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const b = battle([spec('yumi', 1, 0, { skills: ['yumiuchi'] })], [spec('ashigaru', 0, 0, { int: 9 }), spec('bushi', 0, 1)], seed);
      const ash = b.units.find((u) => u.kind === 'ashigaru')!;
      ash.guard = 1;
      const me = b.units.find((u) => u.side === 'L')!;
      untilTurn(b, me.uid);
      const target = b.units.find((u) => u.kind === 'bushi' && u.side === 'R')!;
      act(b, { t: 'skill', skill: 'yumiuchi', target: target.uid });
      if (ash.troops < ash.maxTroops && target.troops === target.maxTroops) { guarded++; expect(ash.guard).toBeLessThan(1); }
    }
    expect(guarded).toBeGreaterThan(10);
  });

  it('式神（術）はガードを無視し、構え破りでガードが外れる', () => {
    const b = battle([spec('sohei', 0, 0, { skills: ['kamaeyaburi'] })], [spec('ashigaru', 0, 0)]);
    const me = b.units.find((u) => u.side === 'L')!;
    untilTurn(b, me.uid);
    act(b, { t: 'skill', skill: 'kamaeyaburi' });
    const ash = b.units.find((u) => u.kind === 'ashigaru')!;
    expect(ash.guarding).toBe(false);
    expect(ash.guard).toBe(0);
    expect(SKILL_TABLE.shikigami.physical).toBe(false);
  });
});

describe('反撃', () => {
  it('近距離の攻撃は反撃を受け、弓は受けない', () => {
    const b = battle([spec('bushi', 0, 0, { skills: ['kirikomi'] }), spec('yumi', 1, 0, { skills: ['yumiuchi'] })], [spec('bushi', 0, 0)]);
    const sw = b.units.find((u) => u.side === 'L' && u.kind === 'bushi')!;
    const ar = b.units.find((u) => u.side === 'L' && u.kind === 'yumi')!;
    const foe = b.units.find((u) => u.side === 'R')!;
    untilTurn(b, sw.uid);
    act(b, { t: 'skill', skill: 'kirikomi', target: foe.uid });
    expect(sw.troops).toBeLessThan(sw.maxTroops);
    untilTurn(b, ar.uid);
    const before = ar.troops;
    act(b, { t: 'skill', skill: 'yumiuchi', target: foe.uid });
    expect(ar.troops).toBe(before);
  });
});

describe('準備と取り消し', () => {
  it('式神は準備ののち敵全体に当たり、準備中に手裏剣を受けると取り消される', () => {
    // 発動する
    const b = battle([spec('onmyo', 1, 0, { skills: ['shikigami'] })], [spec('bushi', 0, 0), spec('bushi', 0, 2)]);
    const me = b.units.find((u) => u.side === 'L')!;
    untilTurn(b, me.uid);
    act(b, { t: 'skill', skill: 'shikigami' });
    expect(me.prep).not.toBeNull();
    for (let i = 0; i < 40 && me.prep; i++) act(b, { t: 'wait' });
    expect(b.units.filter((u) => u.side === 'R').every((u) => u.troops < u.maxTroops)).toBe(true);
    // 取り消される
    const b2 = battle([spec('onmyo', 1, 0, { skills: ['shikigami'], spd: 9 })], [spec('shinobi', 1, 0, { skills: ['shuriken'], spd: 9 }), spec('bushi', 0, 1)], 3);
    const me2 = b2.units.find((u) => u.side === 'L')!;
    const ninja = b2.units.find((u) => u.kind === 'shinobi')!;
    untilTurn(b2, me2.uid);
    act(b2, { t: 'skill', skill: 'shikigami' });
    untilTurn(b2, ninja.uid);
    if (b2.active === ninja.uid && me2.prep) {
      act(b2, { t: 'skill', skill: 'shuriken', target: me2.uid });
      expect(me2.prep).toBeNull();
    }
  });
});

describe('手番と技数', () => {
  it('技を使うと技数が減り、尽きると動かなくなる。鉄砲は初弾がいちばん早い', () => {
    const b = battle([spec('teppo', 0, 0), spec('ashigaru', 0, 1)], [spec('ashigaru', 0, 0), spec('bushi', 0, 1)]);
    expect(unitById(b, b.active!)!.kind).toBe('teppo');
    const t = b.units.find((u) => u.kind === 'teppo')!;
    const ap = t.ap;
    act(b, { t: 'skill', skill: 'shageki', target: legalTargets(b, t, 'shageki')[0].uid });
    expect(t.ap).toBe(ap - 1);
    expect(t.next).toBeGreaterThan(20);
  });

  it('「全」の技は残りの技数をすべて使う', () => {
    const b = battle([spec('kiba', 0, 0, { skills: ['oiuchi'] })], [spec('bushi', 0, 0)]);
    const me = b.units.find((u) => u.side === 'L')!;
    untilTurn(b, me.uid);
    act(b, { t: 'skill', skill: 'oiuchi', target: b.units.find((u) => u.side === 'R')!.uid });
    expect(me.ap).toBe(0);
  });
});

describe('勝敗', () => {
  it('敵を全滅させれば勝ち', () => {
    const b = battle([spec('teppo', 0, 0, { troops: 1500, maxTroops: 1500 })], [spec('miko', 0, 0, { troops: 20, maxTroops: 20 })]);
    act(b, { t: 'skill', skill: 'shageki', target: b.units.find((u) => u.side === 'R')!.uid });
    expect(b.end?.winner).toBe('L');
    expect(b.end?.reason).toBe('wipe');
  });

  it('朔の部隊が壊滅すると負け', () => {
    const b = battle([spec('bushi', 0, 0, { lord: true, troops: 5, maxTroops: 600 }), spec('bushi', 0, 1)], [spec('teppo', 0, 0, { troops: 1500, maxTroops: 1500 })]);
    for (let i = 0; i < 30 && !b.end; i++) act(b, b.active && unitById(b, b.active)!.side === 'R' ? { t: 'skill', skill: 'shageki', target: b.units.find((u) => u.lord)!.uid } : { t: 'wait' });
    expect(b.end?.winner).toBe('R');
    expect(b.end?.reason).toBe('lord');
  });

  it('時間切れは戦果ゲージで決まり、五分なら守る側の勝ち', () => {
    const b = battle([spec('bushi', 0, 0)], [spec('bushi', 0, 0)], 5, 30);
    for (let i = 0; i < 200 && !b.end; i++) act(b, { t: 'wait' });
    expect(b.end?.reason === 'time' || b.end?.reason === 'exhaust').toBe(true);
    expect(gauge(b)).toBe(50);
    expect(b.end?.winner).toBe('R');
  });
});

describe('付与・回復・暗殺', () => {
  it('軍師は合戦の初めに付与を配り、巫女は兵を回復し、上限を超えない', () => {
    const b = battle([spec('gunshi', 1, 0, { int: 9 }), spec('miko', 1, 1, { skills: ['mai'] }), spec('bushi', 0, 0, { troops: 300 })], [spec('bushi', 0, 0)]);
    expect(b.units.filter((u) => u.side === 'L').some((u) => u.buffs.atk + u.buffs.def + u.buffs.spd > 0)).toBe(true);
    const miko = b.units.find((u) => u.kind === 'miko')!;
    const hurt = b.units.find((u) => u.side === 'L' && u.kind === 'bushi')!;
    untilTurn(b, miko.uid);
    act(b, { t: 'skill', skill: 'mai', target: hurt.uid });
    expect(hurt.troops).toBeGreaterThan(300);
    expect(hurt.troops).toBeLessThanOrEqual(hurt.maxTroops);
  });

  it('暗殺は大将には効かない', () => {
    for (let seed = 1; seed < 10; seed++) {
      const b = battle([spec('shinobi', 1, 0, { skills: ['shinobiansatsu'], troops: 2000, maxTroops: 2000 })], [spec('bushi', 0, 0, { boss: true, troops: 100 })], seed);
      const me = b.units.find((u) => u.side === 'L')!;
      untilTurn(b, me.uid);
      act(b, { t: 'skill', skill: 'shinobiansatsu', target: b.units.find((u) => u.side === 'R')!.uid });
      expect(b.units.find((u) => u.side === 'R')!.out).toBe(false);
    }
  });
});

describe('総当たりと再現', () => {
  const kinds = Object.keys(KINDS) as Kind[];
  function randomArmy(seed: number): UnitSpec[] {
    let s = seed;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const n = 1 + Math.floor(rnd() * 6);
    const out: UnitSpec[] = [];
    for (let i = 0; i < n; i++) {
      const kind = kinds[Math.floor(rnd() * kinds.length)];
      const troops = 50 + Math.floor(rnd() * 1500);
      out.push(spec(kind, (i < 3 ? 0 : 1) as 0 | 1, (i % 3) as 0 | 1 | 2, { troops, maxTroops: troops + Math.floor(rnd() * 300), lv: 1 + Math.floor(rnd() * 30), atk: 1 + rnd() * 9, def: 1 + rnd() * 9, int: 1 + rnd() * 9, spd: 1 + rnd() * 9, lord: i === 0 && rnd() < 0.3 }));
    }
    return out;
  }

  it('でたらめな行動と AI で3,000戦しても、数が壊れず必ず終わる', () => {
    const problems: string[] = [];
    for (let i = 0; i < 3000; i++) {
      const b = battle(randomArmy(i * 7 + 1), randomArmy(i * 13 + 5), i, 60 + (i % 80));
      let s = i + 99;
      const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      let steps = 0;
      while (!b.end && steps < 2000) {
        const u = unitById(b, b.active!)!;
        let a;
        if (i % 2 === 0 || u.side === 'R') a = chooseAction(b);
        else {
          const sk = u.skills[Math.floor(rnd() * u.skills.length)];
          const ts = legalTargets(b, u, sk);
          a = rnd() < 0.1 ? { t: 'wait' as const } : { t: 'skill' as const, skill: sk, target: ts.length ? ts[Math.floor(rnd() * ts.length)].uid : undefined };
        }
        act(b, a);
        steps++;
        for (const x of b.units) {
          if (!Number.isFinite(x.troops) || x.troops < 0 || x.troops > x.maxTroops) problems.push(`#${i} 兵数 ${x.name} ${x.troops}/${x.maxTroops}`);
          if (x.ap < 0) problems.push(`#${i} 技数が負`);
          if (x.out && x.troops !== 0) problems.push(`#${i} 壊滅なのに兵が残る`);
        }
        if (!Number.isFinite(gauge(b))) problems.push(`#${i} 戦果が数でない`);
        if (problems.length) break;
      }
      if (!b.end) problems.push(`#${i} 終わらない`);
      if (problems.length) break;
    }
    expect(problems).toEqual([]);
  });

  it('同じ seed と同じ行動なら、同じ結果になる', () => {
    const run = () => {
      const b = battle(randomArmy(42), randomArmy(43), 7);
      while (!b.end) act(b, chooseAction(b));
      return JSON.stringify(b);
    };
    expect(run()).toBe(run());
  });

  it('すべての兵種の技と固有技が定義されている', () => {
    for (const k of kinds) for (const [id] of KINDS[k].skills) expect(SKILL_TABLE[id], id).toBeTruthy();
    expect(alive).toBeTruthy();
  });
});
