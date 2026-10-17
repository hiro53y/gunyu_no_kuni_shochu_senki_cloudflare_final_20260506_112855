// 国盗り：国のデータ・扇と武名・宣戦布告・領地と戦場・合戦の結果（傷ついた兵・捕獲）・牢と説得・国の命令・ターン・敵の手番・城下・保存・通しの自動プレイ
import { claimReward, strategy } from '../src/campaign/strategy';
import { describe, expect, it } from 'vitest';
import { REGIONS, regionDef } from '../src/content/sengoku';
import { GENERALS, LORD } from '../src/content/generals';
import {
  autoDefend, beginBattle, canAttack, captureChance, commandError, commandNeed, doBond, doCommand, endTurn, finishBattle, healCost, healNow, hire, hireCost,
  hireTroops, income, landCount, maxFans, maxTroops, newCampaign, ownedCount, recruit, release, roninList, totalNp, totalUpkeep,
} from '../src/campaign/campaign';
import { autoPlace, landsOf, unitSkills } from '../src/campaign/army';
import { createBattle } from '../src/battle/engine';
import type { Battle } from '../src/battle/types';
import type { Campaign } from '../src/campaign/state';
import { deserializeCampaign } from '../src/engine/save';
import { playCampaign, botParty } from './campaignBot';

/** 合戦を勝ち（敵全滅）・負けで終わらせる */
function endBattle(b: Battle, win: boolean, opt: { mercy?: boolean } = {}): Battle {
  for (const u of b.units) {
    if (u.side === (win ? 'R' : 'L')) { u.troops = 0; u.out = true; if (opt.mercy) u.mercy = true; }
  }
  b.end = { winner: win ? 'L' : 'R', reason: 'wipe' };
  b.active = null;
  return b;
}

function fixtureSeason(c:Campaign) {c.turn++;strategy(c).enemyTurn=null;c.invasions=[];c.fans=2;}

function atWar(c: Campaign, rid: string) {
  c.factions[c.regions[rid].owner].war = true;
}

function siege(c: Campaign, rid: string, win: boolean, seed = 5, opt: { mercy?: boolean } = {}): ReturnType<typeof finishBattle> {
  fixtureSeason(c);
  c.fans = 3;
  atWar(c, rid);
  const b = createBattle(beginBattle(c, 'siege', rid, botParty(c, true), seed));
  return finishBattle(c, endBattle(b, win, opt));
}

/** 国をまるごと落とす（領地の数だけ勝つ）。将は手加減突撃で捕らえる */
function conquer(c: Campaign, rid: string, take = true) {
  for (let i = 0; i < 8 && c.regions[rid].owner !== 'akatsuki'; i++) {
    siege(c, rid, true, 10 + i, { mercy: true });
    if (take) for (const id of [...c.captives]) recruit(c, id);
    fixtureSeason(c);
    for (const g of Object.values(c.gens)) if (g.status === 'ours') { g.troops = maxTroops(c, g.id); g.injured = 0; }
  }
}

describe('国のデータ', () => {
  it('隣の国は互いに隣で、敵の国にはすべて城主がいる', () => {
    for (const r of REGIONS) {
      for (const a of r.adj) expect(regionDef(a).adj, `${r.id}-${a}`).toContain(r.id);
      if (r.owner !== 'akatsuki') expect(GENERALS.some((g) => g.id === r.boss)).toBe(true);
    }
  });

  it('領地は2〜5、最後は城、本拠は多い', () => {
    for (const r of REGIONS) {
      const lands = landsOf(r.id);
      expect(lands.length).toBe(landCount(r.id));
      expect(lands.length).toBeGreaterThanOrEqual(2);
      expect(lands.length).toBeLessThanOrEqual(5);
      expect(lands[lands.length - 1]).toBe('castle');
    }
    expect(landCount('13')).toBeGreaterThan(landCount('11'));
  });
});

describe('扇と宣戦布告', () => {
  it('初めの扇は2つ。武名の褒賞を選ぶと増える', () => {
    const c = newCampaign(1);
    expect(c.fans).toBe(2);
    c.fame = 20;
    expect(maxFans(c)).toBe(2);
    claimReward(c,'fans');
    expect(maxFans(c)).toBe(3);
    c.fame = 120;
    claimReward(c,'fans'); claimReward(c,'fans');
    expect(maxFans(c)).toBe(5);
  });

  it('宣戦布告するまで、人の家の国は攻められない（妖魔とは初めから戦っている）', () => {
    const c = newCampaign(2);
    expect(canAttack(c, '11')).toBe(false);
    expect(canAttack(c, '13')).toBe(true);
    expect(() => beginBattle(c, 'siege', '11', botParty(c, true), 1)).toThrow();
    // 知略の合計が足りなければ持ち越し、次の命令で成し遂げる
    const gens = ['g_chikage', 'g_suzuran'];
    const r1 = doCommand(c, 'war', '11', gens);
    if (!r1.done) {
      expect(c.progress['war:11']).toBe(r1.points);
      fixtureSeason(c);
      const r2 = doCommand(c, 'war', '11', gens);
      expect(r2.done).toBe(true);
    }
    expect(canAttack(c, '11')).toBe(true);
    expect(c.fans).toBeLessThan(2);
  });
});

describe('出陣と合戦の結果', () => {
  it('合戦は左に味方・右に敵。最初の領地は野か町、守る側に戦場の上乗せ', () => {
    const c = newCampaign(3);
    atWar(c, '11');
    const party = botParty(c, true);
    const b = createBattle(beginBattle(c, 'siege', '11', party, 3));
    expect(b.units.filter((u) => u.side === 'L').length).toBe(party.length);
    expect(b.units.filter((u) => u.side === 'R').length).toBeGreaterThanOrEqual(2);
    expect(['field', 'town']).toContain(b.ground);
    expect(b.defender).toBe('R');
    expect(b.adj.R).toBeGreaterThanOrEqual(10);
    expect(c.sortie?.land).toBe(0);
  });

  it('勝つと領地を1つ取り、すべて取ると国が手に入る。最後の城に城主がいる', () => {
    const c = newCampaign(4);
    const n = landCount('11');
    expect(siege(c, '11', true).kind).toBe('win');
    expect(c.regions['11'].taken).toBe(1);
    for (let i = 1; i < n - 1; i++) siege(c, '11', true, 20 + i);
    fixtureSeason(c);
    c.fans = 3;
    const b = createBattle(beginBattle(c, 'siege', '11', botParty(c, true), 99));
    expect(b.ground).toBe('castle');
    expect(b.units.some((u) => u.gen === 'g_tesshin' && u.boss)).toBe(true);
    finishBattle(c, endBattle(b, true, { mercy: true }));
    expect(c.regions['11'].owner).toBe('akatsuki');
    expect(c.captives).toContain('g_tesshin');
    expect(c.fame).toBeGreaterThanOrEqual(10);
  });

  it('減った兵は傷ついた兵になり、戦わなかった次の季節に戻る', () => {
    const c = newCampaign(5);
    atWar(c, '06');
    c.fans = 2;
    const b = createBattle(beginBattle(c, 'siege', '06', botParty(c, true), 5));
    const me = b.units.find((u) => u.side === 'L' && u.gen === 'g_genba')!;
    me.troops = Math.round(me.troops / 2);
    finishBattle(c, endBattle(b, true));
    const g = c.gens.g_genba;
    expect(g.wounded).toBeGreaterThan(0);
    const before = g.troops;
    endTurn(c);
    // この季節に戦ったので、まだ戻らない
    expect(g.troops).toBe(before);
    c.scenes = []; c.invasions = []; c.captives = [];
    endTurn(c);
    expect(g.wounded).toBe(0);
    expect(g.troops).toBeGreaterThan(before);
  });

  it('負けると領地は取れず、壊滅した家臣は2季節休む。朔の部隊が壊滅すると終わり', () => {
    const c = newCampaign(6);
    const rep = siege(c, '04', false);
    expect(rep.kind).toBe('lose');
    expect(c.regions['04'].taken).toBe(0);
    expect(c.gens.g_genba.injured).toBe(2);
    expect(c.defeat).toBe(c.turn);
    expect(c.defeatReason).toBe('lord');
  });

  it('捕獲は基本1/5、落ち武者狩りで1/2、手加減突撃なら必ず', () => {
    expect(captureChance(false, false)).toBe(0.2);
    expect(captureChance(true, false)).toBe(0.5);
    expect(captureChance(false, true)).toBe(1);
    let got = 0;
    for (let s = 1; s <= 40; s++) {
      const c = newCampaign(100 + s);
      const rep = siege(c, '06', true, s);
      got += rep.captured.length;
    }
    // 2部隊ほどの侍大将を、1/5で捕らえる
    expect(got).toBeGreaterThan(3);
    expect(got).toBeLessThan(40);
  });

  it('忠義の将は牢に入り、説得するか主家が滅ぶと家臣になる', () => {
    const c = newCampaign(7);
    conquer(c, '04');
    expect(c.gens.g_narukami.status).toBe('jail');
    fixtureSeason(c);
    expect(commandError(c, 'persuade', 'g_narukami', ['g_chikage'])).toBeNull();
    const gens = ['g_chikage', 'g_suzuran', 'g_genba', LORD];
    const fans = 2;
    let done = false;
    for (let i = 0; i < 10 && !done; i++) {fixtureSeason(c);done = doCommand(c, 'persuade', 'g_narukami', gens).done;}
    expect(done).toBe(true);
    expect(c.fans).toBe(fans);
    expect(c.gens.g_narukami.status).toBe('ours');
  });

  it('解き放った将は浪人になり、文で雇える', () => {
    const c = newCampaign(8);
    conquer(c, '11', false);
    release(c, 'g_tesshin');
    expect(roninList(c).some((g) => g.id === 'g_tesshin')).toBe(true);
    c.gold = 99999;
    expect(hire(c, 'g_tesshin')).toBeNull();
    expect(c.gens.g_tesshin.status).toBe('ours');
  });

  it('黒淵を討ったことを記録し、ルートの条件で結末になる（登用はできない）', () => {
    const c = newCampaign(9);
    c.regions['13'].taken = c.regions['13'].lands.length - 1;
    siege(c, '13', true);
    expect(strategy(c).demonDefeated).toBe(true);
    expect(c.victory).toBeUndefined();
    expect(c.gens.g_kurobuchi.status).toBe('gone');
  });

  it('妖魔討伐に勝つと文が入り、名のない妖怪は捕らえない', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const c = newCampaign(seed);
      const gold = c.gold;
      const b = createBattle(beginBattle(c, 'hunt', '01', botParty(c, true), seed));
      const rep = finishBattle(c, endBattle(b, true, { mercy: true }));
      expect(rep.kind).toBe('win');
      expect(c.gold).toBeGreaterThan(gold);
      expect(rep.captured).toEqual([]);
    }
  });
});

describe('国の命令', () => {
  it('建設で国力が上がり、収入が増える', () => {
    const c = newCampaign(10);
    const np = c.regions['01'].np;
    const inc = income(c);
    let done = false;
    for (let i = 0; i < 3 && !done; i++) { c.fans = 2; done = doCommand(c, 'build', '01', ['g_genba', 'g_chikage', LORD, 'g_suzuran']).done; }
    expect(done).toBe(true);
    expect(c.regions['01'].np).toBe(np + 1);
    expect(income(c)).toBeGreaterThanOrEqual(inc);
    expect(commandNeed(c, 'build', '01')).toBeGreaterThan(0);
  });

  it('戦の準備は次の合戦で味方の戦場補正になり、工作は敵の兵を減らす', () => {
    const c = newCampaign(11);
    atWar(c, '06');
    c.fans = 5;
    while (!doCommand(c, 'prepare', '06', ['g_genba', LORD, 'g_suzuran', 'g_chikage']).done) fixtureSeason(c);
    fixtureSeason(c);
    c.fans = 5;
    while (!doCommand(c, 'sabotage', '06', ['g_chikage', 'g_suzuran', LORD, 'g_genba']).done) fixtureSeason(c);
    fixtureSeason(c);
    expect(c.regions['06'].prep).toBeCloseTo(0.07);
    expect(c.regions['06'].sabotage).toBeCloseTo(0.2);
    c.fans = 2;
    const b = createBattle(beginBattle(c, 'siege', '06', botParty(c, true), 3));
    expect(b.field.L).toBeCloseTo(0.07);
    const e = b.units.find((u) => u.side === 'R')!;
    expect(e.troops).toBeLessThan(e.maxTroops);
    finishBattle(c, endBattle(b, true));
    expect(c.regions['06'].prep).toBe(0);
  });

  it('人材探索で名もなき武将が家臣になる', () => {
    const c = newCampaign(12);
    const n = Object.values(c.gens).filter((g) => g.status === 'ours').length;
    let done = false;
    for (let i = 0; i < 4 && !done; i++) { c.fans = 2; done = doCommand(c, 'search', '01', ['g_chikage', 'g_suzuran', LORD, 'g_genba']).done; }
    expect(done).toBe(true);
    expect(Object.values(c.gens).filter((g) => g.status === 'ours').length).toBe(n + 1);
  });
});

describe('ターンと敵の手番', () => {
  it('季節を進めると収入が入り、扇が戻る。維持費が国力を超えると収入は半分', () => {
    const c = newCampaign(13);
    c.fans = 0;
    const gold = c.gold;
    endTurn(c);
    expect(c.turn).toBe(2);
    expect(c.fans).toBe(2);
    expect(c.gold).toBeGreaterThan(gold);
    c.regions['01'].np = 1;
    expect(totalUpkeep(c)).toBeGreaterThan(totalNp(c));
    const half = income(c);
    c.regions['01'].np = 20;
    expect(half).toBeLessThan(income(c));
  });

  it('同じ勢力が1季節に重複して攻めてこない。おまかせの守りも同じ合戦で決まる', () => {
    const c = newCampaign(14);
    let seen = 0;
    for (let t = 0; t < 40 && !c.defeat; t++) {
      expect(new Set(c.invasions.map(x=>x.faction)).size).toBe(c.invasions.length);
      for (const inv of [...c.invasions]) {
        seen++;
        const { report, battle } = autoDefend(c, inv, t);
        if (battle) expect(battle.end).not.toBeNull();
        if (report) expect(['win', 'lose']).toContain(report.kind);
      }
      for (const id of [...c.captives]) recruit(c, id);
      c.scenes = [];
      endTurn(c);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('迎え撃つ合戦は扇を使わず、攻めてきた大将が敵にいる。守る側は味方', () => {
    const c = newCampaign(15);
    for (let t = 0; t < 40 && !c.invasions.length; t++) { c.scenes = []; endTurn(c); }
    const inv = c.invasions[0];
    if (!inv) return;
    const fans = c.fans;
    c.invasions.shift();
    const b = createBattle(beginBattle(c, 'defense', inv.to, botParty(c, true), 4, inv));
    expect(c.fans).toBe(fans);
    expect(b.units.some((u) => u.gen === inv.commander)).toBe(true);
    expect(b.defender).toBe('L');
  });

  it('妖魔は8季節目に目覚める', () => {
    const c = newCampaign(16);
    for (let t = 1; t < 8; t++) {
      for (const inv of [...c.invasions]) autoDefend(c, inv, t);
      for (const id of [...c.captives]) recruit(c, id);
      c.scenes = [];
      if (c.defeat) return;
      endTurn(c);
    }
    expect(c.flags.youma).toBe(true);
  });
});

describe('交流・城下', () => {
  it('交流で絆が深まり、2回目で2つ目の固有技を合戦で使える。武名も上がる', () => {
    const c = newCampaign(17);
    expect(unitSkills(c, 'g_suzuran', true)).not.toContain('kanagi');
    doBond(c, 'g_suzuran');
    fixtureSeason(c);
    doBond(c, 'g_suzuran');
    expect(unitSkills(c, 'g_suzuran', true)).toContain('kanagi');
    expect(c.fame).toBe(6);
  });

  it('傷ついた兵はすぐ戻すと文がかかり、上限までの増員にも文がかかる', () => {
    const c = newCampaign(18);
    c.gold = 99999;
    const g = c.gens.g_genba;
    g.troops = 100; g.wounded = 300;
    expect(healCost(c, 'g_genba')).toBe(30);
    expect(healNow(c, 'g_genba')).toBeNull();
    expect(g.troops).toBe(400);
    expect(hireCost(c, 'g_genba')).toBeGreaterThan(0);
    expect(hireTroops(c, 'g_genba')).toBeNull();
    expect(g.troops).toBe(maxTroops(c, 'g_genba'));
  });

  it('国が増えると兵数の上限も増える', () => {
    const c = newCampaign(19);
    const max = maxTroops(c, LORD);
    conquer(c, '11');
    expect(ownedCount(c)).toBe(2);
    expect(maxTroops(c, LORD)).toBe(max + 50 + (c.gens[LORD].capacityBonus ?? 0));
  });

  it('陣立ては兵種に合わせて前衛・後衛に分かれる', () => {
    const p = autoPlace([{ id: 'a', kind: 'ashigaru' }, { id: 'b', kind: 'yumi' }, { id: 'c', kind: 'bushi' }, { id: 'd', kind: 'miko' }]);
    expect(p.find((x) => x.gen === 'a')!.row).toBe(0);
    expect(p.find((x) => x.gen === 'b')!.row).toBe(1);
    expect(new Set(p.map((x) => `${x.row}${x.slot}`)).size).toBe(4);
  });
});

describe('保存', () => {
  it('本陣を保存して読み込むと同じ', () => {
    const c = newCampaign(20);
    const text = JSON.stringify(c);
    const back = deserializeCampaign(text)!;
    expect(JSON.stringify(back)).toBe(text);
    expect(deserializeCampaign('{')).toBeNull();
    expect(deserializeCampaign(JSON.stringify({ ...c, v: 2 }))).toBeNull();
  });
});

const FULL = Number(process.env.CAMPAIGN ?? 0);

describe('通しの自動プレイ', () => {
  it('序盤（12季節）を自動で遊んで壊れない', () => {
    const res = playCampaign(newCampaign(77), 77, 12, true);
    expect(res.errors).toEqual([]);
    expect(res.battles.length).toBeGreaterThan(3);
  });

  for (let i = 0; i < FULL; i++) {
    it(`最初から最後まで ${i + 1}回目`, () => {
      const seed = 500 + i * 37;
      const res = playCampaign(newCampaign(seed), seed, Number(process.env.MAX_TURNS ?? 100));
      const c = res.c;
      const sieges = res.battles.filter((b) => b.mode === 'siege');
      console.log(JSON.stringify({
        seed, errors: res.errors.slice(0, 2), victory: c.victory ?? null, defeat: c.defeat ?? null, reason: c.defeatReason, turn: c.turn, regions: ownedCount(c), lv: c.gens[LORD].lv, fame: c.fame,
        sieges: `${sieges.filter((b) => b.kind === 'win').length}/${sieges.length}`, defs: res.battles.filter((b) => b.mode === 'defense').map((b) => b.kind[0]).join(''),
      }));
      expect(res.errors).toEqual([]);
    });
  }
});
