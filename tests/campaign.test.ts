// 国盗り：国のデータ・出陣と合戦の結果・砦・捕縛と登用・牢・勢力の滅亡・侵攻と籠城・ターン・補充と増員・保存・通しの自動プレイ
import { describe, expect, it } from 'vitest';
import { REGIONS, regionDef } from '../src/content/sengoku';
import { GENERALS, LORD } from '../src/content/generals';
import {
  addExtra, beginBattle, canAttack, develop, doBond, endTurn, finishBattle, forts, hire, holdCastle, maxTroops, newCampaign, ownedCount, recruit,
  refill, refillCost, release, roninList,
} from '../src/campaign/campaign';
import { autoPlace, unitSkills } from '../src/campaign/army';
import { createBattle } from '../src/battle/engine';
import type { Battle } from '../src/battle/types';
import type { Campaign } from '../src/campaign/state';
import { deserializeCampaign } from '../src/engine/save';
import { playCampaign, botParty } from './campaignBot';

/** 合戦を勝ち（敵全滅）・負けで終わらせる */
function endBattle(b: Battle, win: boolean): Battle {
  for (const u of b.units) if (u.side === (win ? 'R' : 'L')) { u.troops = 0; u.out = true; }
  b.end = { winner: win ? 'L' : 'R', reason: 'wipe' };
  b.active = null;
  return b;
}

function siege(c: Campaign, rid: string, win: boolean, seed = 5): ReturnType<typeof finishBattle> {
  c.ap = 3;
  const b = createBattle(beginBattle(c, 'siege', rid, botParty(c), seed));
  return finishBattle(c, endBattle(b, win));
}

/** 国をまるごと落とす（砦の数だけ勝つ） */
function conquer(c: Campaign, rid: string, take = true) {
  for (let i = 0; i < forts(rid) && c.regions[rid].owner !== 'akatsuki'; i++) {
    siege(c, rid, true, 10 + i);
    if (take) for (const id of [...c.captives]) recruit(c, id);
  }
}

describe('国のデータ', () => {
  it('隣の国は互いに隣で、敵の国にはすべて城主がいる', () => {
    for (const r of REGIONS) {
      for (const a of r.adj) expect(regionDef(a).adj, `${r.id}-${a}`).toContain(r.id);
      if (r.owner !== 'akatsuki') expect(GENERALS.some((g) => g.id === r.boss)).toBe(true);
    }
  });

  it('固有の武将は、暁ノ家の4人以外どこかの国にちょうど1度ずついて、兵種を持つ', () => {
    for (const g of GENERALS) {
      const places = REGIONS.filter((r) => r.owner !== 'akatsuki' && (r.boss === g.id || r.mid === g.id)).length;
      expect(places, g.id).toBe(g.faction === 'akatsuki' ? 0 : 1);
      expect(g.kind).toBeTruthy();
    }
  });

  it('砦は2〜5、本拠は多い', () => {
    for (const r of REGIONS) {
      expect(forts(r.id)).toBeGreaterThanOrEqual(2);
      expect(forts(r.id)).toBeLessThanOrEqual(5);
    }
    expect(forts('13')).toBeGreaterThan(forts('11'));
  });
});

describe('出陣と合戦の結果', () => {
  it('陣立ては朔を含み、合戦は左に味方・右に敵で始まる', () => {
    const c = newCampaign(1);
    const party = botParty(c);
    expect(party.some((p) => p.gen === LORD)).toBe(true);
    const b = createBattle(beginBattle(c, 'siege', '11', party, 3));
    expect(b.units.filter((u) => u.side === 'L').length).toBe(party.length);
    expect(b.units.filter((u) => u.side === 'R').length).toBeGreaterThanOrEqual(2);
    expect(c.ap).toBe(2);
    expect(c.sortie?.fort).toBe(0);
  });

  it('勝つと砦を1つ落とし、すべて落とすと国が手に入り、城主を捕らえる', () => {
    const c = newCampaign(2);
    const n = forts('11');
    const rep = siege(c, '11', true);
    expect(rep.kind).toBe('win');
    expect(c.regions['11'].taken).toBe(1);
    // 本城の合戦に城主（鉄心）が出てくる
    for (let i = 1; i < n - 1; i++) siege(c, '11', true, 20 + i);
    c.ap = 3;
    const b = createBattle(beginBattle(c, 'siege', '11', botParty(c), 99));
    expect(b.units.some((u) => u.gen === 'g_tesshin' && u.boss)).toBe(true);
    finishBattle(c, endBattle(b, true));
    expect(c.regions['11'].owner).toBe('akatsuki');
    expect(c.captives).toContain('g_tesshin');
    recruit(c, 'g_tesshin');
    expect(c.gens.g_tesshin.status).toBe('ours');
    expect(c.gens.g_tesshin.troops).toBeGreaterThan(0);
  });

  it('負けると兵が減り、壊滅した武将は傷を負う。砦は落ちない', () => {
    const c = newCampaign(3);
    const rep = siege(c, '04', false);
    expect(rep.kind).toBe('lose');
    expect(c.regions['04'].taken).toBe(0);
    expect(c.gens.g_genba.injured).toBeGreaterThan(0);
    expect(c.gens[LORD].troops).toBe(0);
  });

  it('勝つと経験が入り、レベルが上がることがある', () => {
    const c = newCampaign(4);
    const before = c.gens[LORD].exp;
    siege(c, '06', true);
    expect(c.gens[LORD].exp).toBeGreaterThan(before);
  });

  it('忠義の将は主家がある間は牢に入り、主家が滅ぶと家臣になる', () => {
    const c = newCampaign(5);
    conquer(c, '04');
    expect(c.gens.g_narukami.status).toBe('jail');
    conquer(c, '03');
    conquer(c, '02');
    expect(c.factions.kurogane.alive).toBe(false);
    expect(c.gens.g_narukami.status).toBe('ours');
    expect(c.gens.g_genbu.status).toBe('ours');
  });

  it('解き放った将は浪人になり、文で雇える', () => {
    const c = newCampaign(6);
    conquer(c, '11', false);
    release(c, 'g_tesshin');
    expect(roninList(c).some((g) => g.id === 'g_tesshin')).toBe(true);
    c.gold = 99999;
    expect(hire(c, 'g_tesshin')).toBeNull();
    expect(c.gens.g_tesshin.status).toBe('ours');
  });

  it('黒淵を討つと結末になる（登用はできない）', () => {
    const c = newCampaign(7);
    c.regions['13'].taken = forts('13') - 1;
    siege(c, '13', true);
    expect(c.victory).toBe(c.turn);
    expect(c.gens.g_kurobuchi.status).toBe('gone');
  });

  it('妖魔討伐に勝つと文が入り、名のない妖怪は捕らえない', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const c = newCampaign(seed);
      const gold = c.gold;
      const b = createBattle(beginBattle(c, 'hunt', '01', botParty(c), seed));
      const rep = finishBattle(c, endBattle(b, true));
      expect(rep.kind).toBe('win');
      expect(c.gold).toBeGreaterThan(gold);
      expect(rep.captured).toEqual([]);
    }
  });
});

describe('ターンと敵の手番', () => {
  it('季節を進めると年貢が入り、行動が戻り、兵が少し戻る', () => {
    const c = newCampaign(8);
    c.ap = 0;
    c.gens[LORD].troops = 10;
    const gold = c.gold;
    endTurn(c);
    expect(c.turn).toBe(2);
    expect(c.ap).toBe(3);
    expect(c.gold).toBeGreaterThan(gold);
    expect(c.gens[LORD].troops).toBeGreaterThan(10);
  });

  it('いずれ敵が攻めてくる。籠城で負けると国を失い、暁原を失うと負け', () => {
    const c = newCampaign(9);
    let seen = 0;
    for (let t = 0; t < 30 && !c.defeat; t++) {
      for (const inv of [...c.invasions]) { seen++; c.regions[inv.to].troops = 0; c.regions[inv.to].wall = 1; holdCastle(c, inv); }
      for (const id of [...c.captives]) recruit(c, id);
      c.scenes = [];
      endTurn(c);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('迎え撃つ合戦は行動を使わず、攻めてきた大将が敵にいる', () => {
    const c = newCampaign(10);
    for (let t = 0; t < 30 && !c.invasions.length; t++) { c.scenes = []; endTurn(c); }
    const inv = c.invasions[0];
    if (!inv) return;
    const ap = c.ap;
    c.invasions.shift();
    const b = createBattle(beginBattle(c, 'defense', inv.to, botParty(c), 4, inv));
    expect(c.ap).toBe(ap);
    expect(b.units.some((u) => u.gen === inv.commander)).toBe(true);
    expect(b.defender).toBe('L');
  });

  it('妖魔は8季節目に目覚める', () => {
    const c = newCampaign(11);
    for (let t = 1; t < 8; t++) {
      for (const inv of [...c.invasions]) holdCastle(c, inv);
      c.scenes = [];
      endTurn(c);
    }
    expect(c.flags.youma).toBe(true);
  });
});

describe('内政・交流・城下', () => {
  it('開発・築城・徴兵で国が強くなる', () => {
    const c = newCampaign(12);
    c.gold = 99999;
    develop(c, '01', 'dev');
    develop(c, '01', 'wall');
    develop(c, '01', 'troops');
    expect(c.regions['01'].dev).toBe(2);
    expect(c.regions['01'].wall).toBe(3);
    expect(c.ap).toBe(0);
  });

  it('交流で絆が深まり、2回目で2つ目の固有技を合戦で使える', () => {
    const c = newCampaign(13);
    expect(unitSkills(c, 'g_suzuran', true)).not.toContain('kanagi');
    doBond(c, 'g_suzuran');
    doBond(c, 'g_suzuran');
    expect(unitSkills(c, 'g_suzuran', true)).toContain('kanagi');
  });

  it('兵の補充は文がかかり、増員で上限が上がる', () => {
    const c = newCampaign(14);
    c.gold = 99999;
    c.gens[LORD].troops = 100;
    const cost = refillCost(c, LORD);
    expect(cost).toBeGreaterThan(0);
    expect(refill(c, LORD)).toBeNull();
    expect(c.gens[LORD].troops).toBe(maxTroops(c, LORD));
    const max = maxTroops(c, LORD);
    expect(addExtra(c, LORD)).toBeNull();
    expect(maxTroops(c, LORD)).toBeGreaterThan(max);
  });

  it('国が増えると兵数の上限も増える', () => {
    const c = newCampaign(15);
    const max = maxTroops(c, LORD);
    conquer(c, '11');
    expect(ownedCount(c)).toBe(2);
    expect(maxTroops(c, LORD)).toBeGreaterThan(max);
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
    const c = newCampaign(16);
    const text = JSON.stringify(c);
    const back = deserializeCampaign(text)!;
    expect(JSON.stringify(back)).toBe(text);
    expect(deserializeCampaign('{')).toBeNull();
    expect(deserializeCampaign(JSON.stringify({ ...c, v: 1 }))).toBeNull();
  });
});

const FULL = Number(process.env.CAMPAIGN ?? 0);

describe('通しの自動プレイ', () => {
  it('序盤（12季節）を自動で遊んで壊れない', () => {
    const res = playCampaign(newCampaign(77), 77, 12, true);
    expect(res.errors).toEqual([]);
    expect(res.battles.length).toBeGreaterThan(5);
  });

  for (let i = 0; i < FULL; i++) {
    it(`最初から最後まで ${i + 1}回目`, () => {
      const seed = 500 + i * 37;
      const res = playCampaign(newCampaign(seed), seed, Number(process.env.MAX_TURNS ?? 100));
      const c = res.c;
      const sieges = res.battles.filter((b) => b.mode === 'siege');
      console.log(JSON.stringify({
        seed, errors: res.errors.slice(0, 2), victory: c.victory ?? null, defeat: c.defeat ?? null, turn: c.turn, regions: ownedCount(c), lv: c.gens[LORD].lv,
        sieges: `${sieges.filter((b) => b.kind === 'win').length}/${sieges.length}`, defs: res.battles.filter((b) => b.mode === 'defense').map((b) => b.kind[0]).join(''),
        lost: sieges.filter((b) => b.kind !== 'win').map((b) => `${b.region}@t${b.turn}(Lv${b.lv}/危${b.danger}/${b.reason})`).slice(0, 6),
      }));
      expect(res.errors).toEqual([]);
    });
  }
});
