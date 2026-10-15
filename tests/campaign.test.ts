// 国盗り：国のデータ・出陣と結果・捕縛と登用・牢・勢力の滅亡・侵攻と籠城・ターン・保存・通しの自動プレイ
import { describe, expect, it } from 'vitest';
import { REGIONS, regionDef } from '../src/content/sengoku';
import { GENERALS } from '../src/content/generals';
import {
  canAttack, depart, develop, doBond, endTurn, finishSortie, holdCastle, newCampaign, ownedCount, recruit, release, specOf, activeSkills, buy, sellStore, smith, hire, roninList, equipStore,
} from '../src/campaign/campaign';
import { createRun } from '../src/engine/run';
import { deserializeCampaign } from '../src/engine/save';
import type { Run } from '../src/engine/types';
import { playCampaign } from './campaignBot';

/** 冒険をすぐ終わらせる（勝ち・撤退・負け） */
function endRun(run: Run, kind: 'clear' | 'return' | 'dead', capture = true) {
  if (kind === 'clear' && capture) {
    if (run.bossGen) run.captured.push(run.bossGen);
    if (run.midGen) run.captured.push(run.midGen);
  }
  run.end = { kind, cause: 'テスト', floor: run.floorNo };
}

describe('国のデータ', () => {
  it('隣の国は互いに隣で、敵の国にはすべて城主がいる', () => {
    for (const r of REGIONS) {
      for (const a of r.adj) expect(regionDef(a).adj, `${r.id}-${a}`).toContain(r.id);
      if (r.owner !== 'akatsuki') expect(GENERALS.some((g) => g.id === r.boss)).toBe(true);
    }
  });

  it('固有の武将は、暁ノ家の4人以外どこかの城にちょうど1度ずついる', () => {
    for (const g of GENERALS) {
      const places = REGIONS.filter((r) => r.owner !== 'akatsuki' && (r.boss === g.id || r.mid === g.id)).length;
      expect(places, g.id).toBe(g.faction === 'akatsuki' ? 0 : 1);
    }
  });
});

describe('出陣と結果', () => {
  it('城を落とすと国が手に入り、城主を捕らえて登用できる', () => {
    const c = newCampaign(1);
    expect(canAttack(c, '11')).toBe(true);
    const spec = depart(c, 'siege', '11', { party: ['g_suzuran', 'g_chikage'], carry: [] }, 5);
    expect(c.ap).toBe(2);
    expect(spec.gens.map((g) => g.id)).toEqual(expect.arrayContaining(['g_suzuran', 'g_chikage', 'g_tesshin']));
    const run = createRun(spec);
    endRun(run, 'clear');
    const rep = finishSortie(c, run);
    expect(rep.kind).toBe('win');
    expect(c.regions['11'].owner).toBe('akatsuki');
    expect(c.captives).toContain('g_tesshin');
    recruit(c, 'g_tesshin');
    expect(c.gens.g_tesshin.status).toBe('ours');
    expect(c.factions.rengein.alive).toBe(true);
    expect(c.scenes.length).toBeGreaterThan(0);
  });

  it('負けると装備以外の持ち物と文を失い、部隊は傷を負う。城門の破れが残る', () => {
    const c = newCampaign(2);
    const herb = c.store.find((i) => i.id === 'g_yakusou')!;
    const spec = depart(c, 'siege', '04', { party: ['g_genba'], carry: [herb.uid] }, 6);
    const run = createRun(spec);
    run.player.gold = 500;
    run.stats.maxFloor = 3;
    endRun(run, 'dead');
    const gold = c.gold;
    finishSortie(c, run);
    expect(c.gold).toBe(gold);
    expect(c.store.some((i) => i.uid === herb.uid || (i.id === 'g_yakusou' && c.store.filter((x) => x.id === 'g_yakusou').length > 2))).toBe(false);
    expect(c.eq.weapon).toBeDefined();
    expect(c.gens.g_genba.injured).toBeGreaterThan(0);
    expect(c.regions['04'].breach).toBe(1);
  });

  it('撤退の巻物なら持ち物と文を持ち帰り、登った分だけ城門が破れる', () => {
    const c = newCampaign(3);
    const spec = depart(c, 'siege', '06', { party: [], carry: [] }, 7);
    const run = createRun(spec);
    run.player.gold = 300;
    run.stats.maxFloor = 3;
    endRun(run, 'return');
    const gold = c.gold;
    finishSortie(c, run);
    expect(c.gold).toBe(gold + 300);
    expect(c.regions['06'].breach).toBe(2);
    // 次の城攻めは3階から
    const spec2 = depart(c, 'siege', '06', { party: [], carry: [] }, 8);
    expect(spec2.startFloor).toBe(3);
  });

  it('忠義の将は主家がある間は牢に入り、主家が滅ぶと家臣になる', () => {
    const c = newCampaign(4);
    // 紫苑家の国を2つ取ってから本拠を落とす
    for (const rid of ['06', '07', '05']) {
      c.ap = 3;
      const run = createRun(depart(c, 'siege', rid, { party: [], carry: [] }, 9));
      endRun(run, 'clear');
      finishSortie(c, run);
      for (const id of [...c.captives]) recruit(c, id);
    }
    expect(c.factions.shion.alive).toBe(false);
    expect(c.gens.g_hazuki.status).toBe('ours');
    expect(c.gens.g_souji.status).toBe('ours');
  });

  it('忠義の将を本拠より先に捕らえると牢に入る', () => {
    const c = newCampaign(5);
    // 雷鳴峠の鳴雷（忠義）
    const run = createRun(depart(c, 'siege', '04', { party: [], carry: [] }, 10));
    endRun(run, 'clear');
    finishSortie(c, run);
    expect(c.gens.g_narukami.status).toBe('jail');
    expect(c.captives).not.toContain('g_narukami');
  });

  it('解き放った将は浪人になり、文で雇える', () => {
    const c = newCampaign(6);
    const run = createRun(depart(c, 'siege', '11', { party: [], carry: [] }, 11));
    endRun(run, 'clear');
    finishSortie(c, run);
    release(c, 'g_tesshin');
    expect(roninList(c).some((g) => g.id === 'g_tesshin')).toBe(true);
    c.gold = 99999;
    expect(hire(c, 'g_tesshin')).toBeNull();
    expect(c.gens.g_tesshin.status).toBe('ours');
  });

  it('黒淵を討つと結末になる（登用はできない）', () => {
    const c = newCampaign(7);
    c.regions['11'].owner = 'akatsuki';
    delete c.regions['11'].boss;
    const run = createRun(depart(c, 'siege', '13', { party: [], carry: [] }, 12));
    endRun(run, 'clear');
    finishSortie(c, run);
    expect(c.victory).toBe(c.turn);
    expect(c.gens.g_kurobuchi.status).toBe('gone');
    expect(c.captives).toContain('g_guren');
  });
});

describe('ターンと敵の手番', () => {
  it('ターンを終えると年貢が入り、行動が戻る', () => {
    const c = newCampaign(8);
    c.ap = 0;
    const gold = c.gold;
    endTurn(c);
    expect(c.turn).toBe(2);
    expect(c.ap).toBe(3);
    expect(c.gold).toBeGreaterThan(gold);
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
    expect(ownedCount(c) === 0 || c.defeat !== undefined || Object.values(c.regions).some((r) => r.owner !== 'akatsuki' && r.id === '01') === false).toBe(true);
  });

  it('妖魔は8ターン目に目覚める', () => {
    const c = newCampaign(10);
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
    const c = newCampaign(11);
    c.gold = 99999;
    develop(c, '01', 'dev');
    develop(c, '01', 'wall');
    develop(c, '01', 'troops');
    expect(c.regions['01'].dev).toBe(2);
    expect(c.regions['01'].wall).toBe(3);
    expect(c.ap).toBe(0);
  });

  it('交流で絆が深まり、2回目で新しい技を覚える', () => {
    const c = newCampaign(12);
    expect(activeSkills(c, 'g_suzuran')).toEqual(['harai']);
    doBond(c, 'g_suzuran');
    doBond(c, 'g_suzuran');
    expect(activeSkills(c, 'g_suzuran')).toEqual(['harai', 'kanagi']);
    expect(specOf(c, 'g_suzuran', true).skills).toContain('kanagi');
  });

  it('買う・売る・鍛える・装備する', () => {
    const c = newCampaign(13);
    c.gold = 99999;
    const n = c.store.length;
    expect(buy(c, 'g_yakusou')).toBeNull();
    expect(c.store.length).toBe(n + 1);
    const herb = c.store[c.store.length - 1];
    expect(sellStore(c, herb.uid)).toBeGreaterThan(0);
    const w = c.store.find((i) => i.uid === c.eq.weapon)!;
    expect(smith(c, w.uid)).toBeNull();
    expect(w.plus).toBe(1);
    expect(equipStore(c, w.uid)).toBeNull();
    expect(c.eq.weapon).toBeUndefined();
  });
});

describe('保存', () => {
  it('本陣を保存して読み込むと同じ', () => {
    const c = newCampaign(14);
    const text = JSON.stringify(c);
    const back = deserializeCampaign(text)!;
    expect(JSON.stringify(back)).toBe(text);
    expect(deserializeCampaign('{')).toBeNull();
    expect(deserializeCampaign(JSON.stringify({ ...c, v: 99 }))).toBeNull();
  });
});

const FULL = Number(process.env.CAMPAIGN ?? 0);

describe('通しの自動プレイ', () => {
  it('序盤（12ターン）を自動で遊んで壊れない', () => {
    const res = playCampaign(newCampaign(77), 77, 12, true);
    expect(res.errors).toEqual([]);
    expect(res.battles.length).toBeGreaterThan(5);
  });

  it.runIf(FULL > 0)(`最初から最後まで ${FULL} 回`, () => {
    const out: string[] = [];
    for (let i = 0; i < FULL; i++) {
      const seed = 500 + i * 37;
      const res = playCampaign(newCampaign(seed), seed, Number(process.env.MAX_TURNS ?? 100));
      const c = res.c;
      const wins = res.battles.filter((b) => b.kind === 'win').length;
      const sieges = res.battles.filter((b) => b.mode === 'siege');
      out.push(JSON.stringify({
        seed, errors: res.errors.slice(0, 2), victory: c.victory ?? null, defeat: c.defeat ?? null, turn: c.turn, regions: ownedCount(c), lv: c.lord.lv,
        battles: res.battles.length, wins, sieges: `${sieges.filter((b) => b.kind === 'win').length}/${sieges.length}`,
        lost: sieges.filter((b) => b.kind !== 'win').map((b) => `${b.region}@t${b.turn}(Lv${b.lv}/危${b.danger})`).slice(0, 8),
      }));
      expect(res.errors).toEqual([]);
    }
    console.log(out.join('\n'));
  });
});
