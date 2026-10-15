// ゲームの仕組みの単体テスト：移動・戦闘・道具・壺・店・罠・敵・仲間・空腹・保存
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/content/items';
import { MONSTERS } from '../src/content/monsters';
import { at } from '../src/engine/geo';
import { equipped, itemName, makeCtx, closeCtx } from '../src/engine/core';
import { step } from '../src/engine/step';
import { deserializeRun } from '../src/engine/save';
import { T_FLOOR, T_WALL, type Action } from '../src/engine/types';
import { act, arena, freeze, give, logText, serializeRun, siegeRun, spawn } from './helpers';
import { mulberry, randomAction } from './bot';
import { eatGrass } from '../src/engine/effects';
import { monsterHitsMonster } from '../src/engine/combat';

describe('移動と角', () => {
  it('8方向に動けて、壁にぶつかってもターンは進まない', () => {
    const run = arena();
    act(run, { t: 'move', dir: 3 });
    expect([run.player.x, run.player.y]).toEqual([11, 11]);
    const turn = run.turn;
    run.player.x = 5; run.player.y = 5;
    act(run, { t: 'move', dir: 7 });
    expect(run.turn).toBe(turn);
    expect([run.player.x, run.player.y]).toEqual([5, 5]);
  });

  it('壁の角をはさんだ斜めには動けず、攻撃も届かない', () => {
    const run = arena();
    const f = run.floor;
    f.tiles[at(f, 11, 10)] = T_WALL; // 右が壁
    act(run, { t: 'move', dir: 1 }); // 右上へ
    expect([run.player.x, run.player.y]).toEqual([10, 10]);
    const m = spawn(run, 'yoroi1', 11, 9);
    freeze(m);
    const hp = m.hp;
    run.player.dir = 1;
    for (let i = 0; i < 5; i++) act(run, { t: 'attack' });
    expect(m.hp).toBe(hp);
  });

  it('ダッシュは何かあるまで走り続ける', () => {
    const run = arena();
    act(run, { t: 'dash', dir: 2 });
    expect(run.player.x).toBe(24);
    expect(run.turn).toBeGreaterThan(10);
  });
});

describe('戦闘', () => {
  it('敵を叩くと減り、倒すと経験値でレベルが上がる', () => {
    const run = arena();
    const m = spawn(run, 'tanuki1', 11, 10);
    freeze(m);
    run.player.exp = 9;
    for (let i = 0; i < 20 && !m.dead; i++) act(run, { t: 'attack' });
    expect(m.dead).toBe(true);
    expect(run.monsters).not.toContain(m);
    expect(run.player.lv).toBeGreaterThanOrEqual(2);
    expect(run.stats.kills).toBe(1);
  });

  it('敵に叩かれるとHPが減り、0で倒れて冒険が終わる', () => {
    const run = arena();
    spawn(run, 'yoroi3', 11, 10);
    run.player.hp = 3;
    for (let i = 0; i < 30 && !run.end; i++) act(run, { t: 'wait' });
    expect(run.end?.kind).toBe('dead');
    expect(run.end?.cause).toBe('金剛鎧');
    expect(step(run, { t: 'wait' })).toEqual([]);
  });

  it('復活の草があれば一度だけ生き返る', () => {
    const run = arena();
    give(run, 'g_fukkatsu');
    spawn(run, 'yoroi3', 11, 10);
    run.player.hp = 1;
    for (let i = 0; i < 10 && run.player.inv.some((x) => x.id === 'g_fukkatsu'); i++) act(run, { t: 'wait' });
    expect(run.player.inv.some((x) => x.id === 'g_fukkatsu')).toBe(false);
    expect(logText(run)).toContain('生き返った');
  });

  it('倍速の敵は1ターンに2回動き、鈍足の敵は2ターンに1回', () => {
    const run = arena();
    const fast = spawn(run, 'neko1', 20, 6);
    const slow = spawn(run, 'tanuki1', 20, 13);
    slow.st.slow = 999;
    act(run, { t: 'wait' });
    act(run, { t: 'wait' });
    expect(Math.abs(fast.x - 20) + Math.abs(fast.y - 6)).toBeGreaterThanOrEqual(3);
    expect(Math.max(Math.abs(slow.x - 20), Math.abs(slow.y - 13))).toBeLessThanOrEqual(1);
  });

  it('敵が敵を倒すとレベルが上がる', () => {
    const run = arena();
    const a = spawn(run, 'kitsune1', 15, 10);
    const b = spawn(run, 'tanuki1', 16, 10);
    b.hp = 1;
    const ctx = makeCtx(run);
    for (let i = 0; i < 10 && !b.dead; i++) {
      // 混乱した狐が隣を叩く場面を直接作る
      monsterHitsMonster(ctx, a, b);
    }
    closeCtx(ctx);
    expect(b.dead).toBe(true);
    expect(a.id).toBe('kitsune2');
  });

  it('爆発する敵は弱ると周りを巻き込んで爆発する', () => {
    const run = arena();
    const m = spawn(run, 'chouchin1', 11, 10);
    freeze(m);
    run.floor.items.push({ x: 12, y: 11, item: { uid: run.nextUid++, id: 'g_yakusou' } });
    for (let i = 0; i < 20 && !m.dead; i++) act(run, { t: 'attack' });
    expect(logText(run)).toMatch(/爆発|倒した/);
    if (logText(run).includes('爆発')) expect(run.floor.items.length).toBe(0);
  });
});

describe('道具', () => {
  it('すべての道具の種類に、名前・値段・説明がある', () => {
    for (const d of ITEMS) {
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.desc.length).toBeGreaterThan(0);
      expect(d.price).toBeGreaterThanOrEqual(0);
    }
    expect(ITEMS.length).toBeGreaterThanOrEqual(100);
    expect(MONSTERS.filter((m) => !m.special)).toHaveLength(78);
  });

  it('未識別の道具は仮の名前で、使うと正体が分かる', () => {
    const run = arena(7);
    const herb = give(run, 'g_chikara');
    const name = itemName(run, herb);
    expect(name).not.toBe('力の草');
    expect(name).toBe(run.fake.g_chikara);
    act(run, { t: 'item', uid: herb.uid, verb: 'use' });
    expect(run.known.g_chikara).toBe(true);
    expect(run.player.str).toBe(9);
  });

  it('識別の巻物は選んだ道具の正体を明かす', () => {
    const run = arena(8);
    const scroll = give(run, 's_shikibetsu');
    run.known.s_shikibetsu = true;
    const staff = give(run, 't_ikazuchi', { charges: 4 });
    act(run, { t: 'item', uid: scroll.uid, verb: 'use', target: staff.uid });
    expect(run.known.t_ikazuchi).toBe(true);
    expect(itemName(run, staff)).toBe('雷の杖[4]');
  });

  it('草の効果（飲む）', () => {
    const cases: [string, (r: ReturnType<typeof arena>) => void][] = [
      ['g_yakusou', (r) => { r.player.hp = 5; }],
      ['g_inochi', () => undefined],
      ['g_baisoku', () => undefined],
      ['g_muteki', () => undefined],
      ['g_ten', () => undefined],
      ['g_dokukeshi', (r) => { r.player.str = 3; }],
    ];
    for (const [id, setup] of cases) {
      const run = arena();
      setup(run);
      const before = JSON.parse(JSON.stringify(run.player));
      const ctx = makeCtx(run);
      eatGrass(ctx, id);
      closeCtx(ctx);
      const p = run.player;
      if (id === 'g_yakusou') expect(p.hp).toBe(Math.min(before.maxHp, 30));
      if (id === 'g_inochi') expect(p.maxHp).toBe(before.maxHp + 5);
      if (id === 'g_baisoku') expect(p.st.fast).toBeGreaterThan(0);
      if (id === 'g_muteki') expect(p.st.invincible).toBeGreaterThan(0);
      if (id === 'g_ten') expect(p.lv).toBe(2);
      if (id === 'g_dokukeshi') expect(p.str).toBe(p.maxStr);
    }
  });

  it('倍速のプレイヤーは、敵が1回動く間に2回動ける', () => {
    const run = arena();
    run.player.st.fast = 10;
    const m = spawn(run, 'tanuki1', 20, 10);
    const t0 = run.turn;
    act(run, { t: 'wait' });
    expect(run.turn).toBe(t0);
    act(run, { t: 'wait' });
    expect(run.turn).toBe(t0 + 1);
    void m;
  });

  it('杖：ふきとばし・場所替え・金縛り・雷・契り（仲間になる）', () => {
    const zap = (id: string) => {
      const run = arena();
      const m = spawn(run, 'kappa1', 14, 10);
      freeze(m);
      const staff = give(run, id, { charges: 3 });
      run.player.dir = 2;
      act(run, { t: 'item', uid: staff.uid, verb: 'use' });
      return { run, m, staff };
    };
    let r = zap('t_fukitobashi');
    expect(r.m.x).toBeGreaterThan(14);
    expect(r.staff.charges).toBe(2);
    r = zap('t_bashogae');
    expect([r.run.player.x, r.m.x]).toEqual([14, 10]);
    r = zap('t_kanashibari');
    expect(r.m.st.paralyze).toBe(999);
    r = zap('t_ikazuchi');
    expect(r.m.hp < r.m.maxHp || r.m.dead).toBe(true);
    r = zap('t_chigiri');
    expect(r.m.ally).toBe(true);
    expect(logText(r.run)).toContain('寝返った');
  });

  it('掘削の杖は壁をまっすぐくり抜き、つるはしは叩いた壁を掘る', () => {
    const run = arena();
    run.player.x = 24; run.player.y = 10; run.player.dir = 2;
    const staff = give(run, 't_kussaku', { charges: 2 });
    act(run, { t: 'item', uid: staff.uid, verb: 'use' });
    const f = run.floor;
    for (let x = 25; x <= 34; x++) expect(f.tiles[at(f, x, 10)]).toBe(T_FLOOR);
    expect(f.tiles[at(f, 35, 10)]).toBe(T_WALL);
    const pick = give(run, 'w_tsuruhashi');
    act(run, { t: 'item', uid: pick.uid, verb: 'equip' });
    run.player.x = 24; run.player.y = 12; run.player.dir = 2;
    act(run, { t: 'attack' });
    expect(f.tiles[at(f, 25, 12)]).toBe(T_FLOOR);
  });

  it('呪われた装備は外せず、解呪の巻物で外せるようになる', () => {
    const run = arena();
    const blade = give(run, 'w_youtou', { cursed: true });
    act(run, { t: 'item', uid: blade.uid, verb: 'equip' });
    expect(equipped(run, 'weapon')?.uid).toBe(blade.uid);
    act(run, { t: 'item', uid: blade.uid, verb: 'unequip' });
    expect(equipped(run, 'weapon')?.uid).toBe(blade.uid);
    const scroll = give(run, 's_kaijuu');
    act(run, { t: 'item', uid: scroll.uid, verb: 'use' });
    act(run, { t: 'item', uid: blade.uid, verb: 'unequip' });
    expect(equipped(run, 'weapon')).toBeNull();
  });

  it('投げた物は敵に当たるか、止まった所に落ちる', () => {
    const run = arena();
    const herb = give(run, 'g_zassou');
    run.player.dir = 2;
    act(run, { t: 'item', uid: herb.uid, verb: 'throw' });
    expect(run.player.inv).not.toContain(herb);
    expect(run.floor.items.some((fi) => fi.item.uid === herb.uid)).toBe(true);
  });

  it('矢は1本ずつ減り、敵に当たる', () => {
    const run = arena();
    const arrows = give(run, 'r_ki', { count: 5 });
    act(run, { t: 'item', uid: arrows.uid, verb: 'equip' });
    const m = spawn(run, 'yoroi1', 14, 10);
    freeze(m);
    for (let i = 0; i < 5; i++) act(run, { t: 'shoot' });
    expect(run.player.inv).not.toContain(arrows);
    expect(m.hp < m.maxHp || m.dead).toBe(true);
  });
});

describe('壺と合成', () => {
  it('合成の壺：同じ種類の武器が1つになり、強化値と印が移る', () => {
    const run = arena();
    const pot = give(run, 'p_gousei', { cap: 3 });
    const a = give(run, 'w_tetsu', { plus: 2 });
    const b = give(run, 'w_kemono', { plus: 1 });
    act(run, { t: 'item', uid: a.uid, verb: 'put', target: pot.uid });
    act(run, { t: 'item', uid: b.uid, verb: 'put', target: pot.uid });
    expect(pot.contents).toHaveLength(1);
    expect(pot.contents![0].plus).toBe(3);
    expect(pot.contents![0].seals).toContain('獣');
  });

  it('保存の壺からは取り出せ、ほかの壺からは取り出せない', () => {
    const run = arena();
    const keep = give(run, 'p_hozon');
    const herb = give(run, 'g_yakusou');
    act(run, { t: 'item', uid: herb.uid, verb: 'put', target: keep.uid });
    expect(keep.contents).toHaveLength(1);
    act(run, { t: 'item', uid: keep.uid, verb: 'take', target: herb.uid });
    expect(run.player.inv).toContain(herb);
    const id = give(run, 'p_shikibetsu');
    const unknown = give(run, 's_tokitome');
    act(run, { t: 'item', uid: unknown.uid, verb: 'put', target: id.uid });
    expect(run.known.s_tokitome).toBe(true);
    act(run, { t: 'item', uid: id.uid, verb: 'take', target: unknown.uid });
    expect(run.player.inv).not.toContain(unknown);
  });

  it('壺を投げると割れて中身が散らばる', () => {
    const run = arena();
    const pot = give(run, 'p_hozon');
    const a = give(run, 'g_yakusou');
    act(run, { t: 'item', uid: a.uid, verb: 'put', target: pot.uid });
    act(run, { t: 'item', uid: pot.uid, verb: 'throw' });
    expect(run.floor.items.some((fi) => fi.item.uid === a.uid)).toBe(true);
    expect(run.floor.items.some((fi) => fi.item.uid === pot.uid)).toBe(false);
  });

  it('鍛え・換金・底抜けの壺', () => {
    const run = arena();
    const kitae = give(run, 'p_kitae');
    const sword = give(run, 'w_dou', { plus: 0 });
    act(run, { t: 'item', uid: sword.uid, verb: 'put', target: kitae.uid });
    expect(sword.plus).toBe(1);
    const kankin = give(run, 'p_kankin', { cap: 2 });
    const gold = run.player.gold;
    const junk = give(run, 'a_dou');
    act(run, { t: 'item', uid: junk.uid, verb: 'put', target: kankin.uid });
    expect(run.player.gold).toBeGreaterThan(gold);
    expect(kankin.cap).toBe(1);
    const soko = give(run, 'p_soko');
    const lost = give(run, 'g_zassou');
    act(run, { t: 'item', uid: lost.uid, verb: 'put', target: soko.uid });
    expect(run.player.inv).not.toContain(lost);
  });
});

describe('店', () => {
  const shopRun = () => {
    const run = arena(3);
    const f = run.floor;
    f.rooms[0].kind = 'shop';
    // 部屋の右に出口の通路
    for (let x = 25; x < 30; x++) f.tiles[at(f, x, 10)] = T_FLOOR;
    const keeper = spawn(run, 'keeper', 24, 9);
    keeper.role = 'keeper';
    f.shop = { room: 0, keeper: keeper.uid };
    const goods = { uid: run.nextUid++, id: 'g_daiyakusou', shop: true };
    f.items.push({ x: 23, y: 10, item: goods });
    run.player.x = 22; run.player.y = 10;
    return { run, keeper, goods };
  };

  it('店の品は乗っただけでは拾わず、「拾う」で手に取る', () => {
    const { run, goods } = shopRun();
    act(run, { t: 'move', dir: 2 });
    expect(run.player.inv).not.toContain(goods);
    expect(logText(run)).toContain('「拾う」で手に取る');
    act(run, { t: 'pickup' });
    expect(run.player.inv).toContain(goods);
  });

  it('品物を持って出ようとすると代金を求められ、払えば出られる', () => {
    const { run, goods } = shopRun();
    run.player.gold = 1000;
    act(run, { t: 'move', dir: 2 });
    act(run, { t: 'pickup' });
    act(run, { t: 'move', dir: 2 }); // 24,10
    act(run, { t: 'move', dir: 2 }); // 出口へ
    expect(run.prompt?.kind).toBe('pay');
    act(run, { t: 'answer', yes: true });
    expect(goods.shop).toBe(false);
    expect(run.player.gold).toBe(900);
    act(run, { t: 'move', dir: 2 });
    expect(run.player.x).toBe(25);
    expect(run.thief).toBe(false);
  });

  it('払わずに逃げると店主が等速で追ってくる。番人は出ず、次の階には来ない', () => {
    const { run, keeper, goods } = shopRun();
    act(run, { t: 'move', dir: 2 });
    act(run, { t: 'pickup' });
    act(run, { t: 'move', dir: 2 });
    act(run, { t: 'move', dir: 2 });
    expect(run.prompt?.kind).toBe('pay');
    act(run, { t: 'answer', yes: false, steal: true });
    expect(run.thief).toBe(true);
    expect(keeper.angry).toBe(true);
    expect(goods.shop).toBe(false);
    expect(run.player.x).toBe(25);
    expect(run.monsters.filter((m) => m.role !== 'keeper')).toHaveLength(0);
    // 等速：まっすぐ逃げ続けると距離は縮まらない
    const gap = () => Math.max(Math.abs(keeper.x - run.player.x), Math.abs(keeper.y - run.player.y));
    act(run, { t: 'move', dir: 2 });
    const g1 = gap();
    act(run, { t: 'move', dir: 2 });
    act(run, { t: 'move', dir: 2 });
    expect(gap()).toBeGreaterThanOrEqual(g1);
    // 階段を降りれば店主はいない
    run.floor.stairs = { x: run.player.x, y: run.player.y };
    act(run, { t: 'stairs' });
    expect(run.floorNo).toBe(2);
    expect(run.monsters.some((m) => m.role === 'keeper' && m.angry)).toBe(false);
  });

  it('敵は店の中に入ってこない（通路で待つ）', () => {
    const { run } = shopRun();
    const m = spawn(run, 'tanuki1', 28, 10);
    for (let i = 0; i < 15; i++) act(run, { t: 'wait' });
    expect(m.x).toBeGreaterThanOrEqual(25);
    const ghost = spawn(run, 'kage1', 27, 8);
    for (let i = 0; i < 15; i++) act(run, { t: 'wait' });
    expect(run.floor.roomOf[at(run.floor, ghost.x, ghost.y)]).not.toBe(0);
  });

  it('店の中で自分の物を置くと買い取ってもらえる', () => {
    const { run } = shopRun();
    const herb = give(run, 'g_yakusou');
    act(run, { t: 'item', uid: herb.uid, verb: 'drop' });
    expect(run.prompt?.kind).toBe('sell');
    act(run, { t: 'answer', yes: true });
    expect(run.player.gold).toBe(25);
    expect(herb.shop).toBe(true);
  });
});

describe('罠・空腹・突風', () => {
  it('落とし穴で次の階へ、地雷でHPが半分に', () => {
    const run = arena();
    run.floor.traps.push({ x: 11, y: 10, id: 'pit', found: false });
    act(run, { t: 'move', dir: 2 });
    expect(run.floorNo).toBe(2);
    const r2 = arena();
    r2.player.hp = 20;
    r2.floor.traps.push({ x: 11, y: 10, id: 'mine', found: false });
    act(r2, { t: 'move', dir: 2 });
    expect(r2.player.hp).toBe(10);
  });

  it('満腹度が0になるとHPが減っていく', () => {
    const run = arena();
    run.player.hunger = 0;
    const hp = run.player.hp;
    act(run, { t: 'wait' });
    expect(run.player.hp).toBe(hp - 1);
  });

  it('同じ階に長くいると突風で次の階へ飛ばされる', () => {
    const run = arena();
    run.floor.turns = 1249;
    act(run, { t: 'wait' });
    expect(run.floorNo).toBe(2);
  });
});

describe('仲間との入れ替わり', () => {
  it('壁の中にいる寝返った影とは入れ替われない', () => {
    const run = arena();
    const m = spawn(run, 'kage1', 10, 4);
    m.ally = true;
    m.turned = true;
    freeze(m);
    run.player.x = 10; run.player.y = 5;
    act(run, { t: 'move', dir: 0 });
    expect([run.player.x, run.player.y]).toEqual([10, 5]);
  });
});

describe('保存と再現', () => {
  it('保存して読み込むと完全に同じ', () => {
    const run = siegeRun(99);
    const rand = mulberry(3);
    for (let i = 0; i < 300 && !run.end; i++) step(run, randomAction(run, rand));
    const text = serializeRun(run);
    const back = deserializeRun(text)!;
    expect(back).not.toBeNull();
    expect(serializeRun(back)).toBe(text);
  });

  it('同じ seed で同じ操作なら、同じ結果になる', () => {
    const play = () => {
      const run = siegeRun(2026, { danger0: 8 });
      const rand = mulberry(11);
      const actions: Action[] = [];
      for (let i = 0; i < 400 && !run.end; i++) { const a = randomAction(run, rand); actions.push(a); step(run, a); }
      return serializeRun(run);
    };
    expect(play()).toBe(play());
  });

  it('壊れた保存データは読み込まない', () => {
    expect(deserializeRun('{')).toBeNull();
    expect(deserializeRun('{"v":1}')).toBeNull();
    const run = siegeRun(1);
    const broken = JSON.parse(serializeRun(run));
    broken.player.hp = null;
    expect(deserializeRun(JSON.stringify(broken))).toBeNull();
  });
});
