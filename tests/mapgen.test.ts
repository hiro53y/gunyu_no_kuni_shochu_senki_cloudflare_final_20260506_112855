// 地図の生成：2,000通りの seed で、つながり・階段・店・敵の配置を確かめる
import { describe, expect, it } from 'vitest';
import { generateFloor, roomDoors } from '../src/engine/mapgen';
import { at, canStand, distanceField } from '../src/engine/geo';
import { BANDS } from '../src/content/world';
import { FACTION_IDS, REGIONS, TERRAIN_BAND } from '../src/content/sengoku';
import { T_FLOOR, T_HARD, type RunMode } from '../src/engine/types';

describe('地図の生成', () => {
  it('2,000通りの階で、歩ける床がすべて階段とスタートにつながっている', () => {
    const problems: string[] = [];
    let uid = 1;
    let shops = 0, houses = 0, bigs = 0, darks = 0;
    for (let i = 0; i < 2000; i++) {
      const mode: RunMode = (['siege', 'siege', 'hunt', 'practice'] as RunMode[])[i % 4];
      const region = REGIONS[i % REGIONS.length];
      const no = 1 + (i % 6);
      const band = mode === 'hunt' ? 10 : TERRAIN_BAND[region.terrain];
      const faction = mode === 'hunt' ? 'youma' : FACTION_IDS[i % FACTION_IDS.length];
      const r = { s: i * 7919 + 13 };
      const danger = mode === 'practice' ? 1 : Math.min(30, region.danger + no + (i % 7));
      const midGen = mode === 'siege' && i % 5 === 0 ? 'g_test' : undefined;
      const { floor: f, spawns, start } = generateFloor(r, { mode, no, danger, band, liquid: BANDS[band].liquid, boss: false, faction, midGen, newUid: () => uid++ });
      const tag = `seed${i} ${mode}${no}F`;
      if (f.shop) shops++;
      if (f.house >= 0) houses++;
      if (f.kind === 'big') bigs++;
      if (f.dark) darks++;
      // 外周は壊せない壁
      for (let x = 0; x < f.w; x++) if (f.tiles[at(f, x, 0)] !== T_HARD || f.tiles[at(f, x, f.h - 1)] !== T_HARD) problems.push(`${tag} 外壁が欠けている`);
      const dist = distanceField(f, start, 'walk');
      if (!f.stairs) { problems.push(`${tag} 階段が無い`); continue; }
      if (dist[at(f, f.stairs.x, f.stairs.y)] < 0) problems.push(`${tag} 階段に行けない`);
      for (let k = 0; k < f.tiles.length; k++) if (f.tiles[k] === T_FLOOR && dist[k] < 0) { problems.push(`${tag} 行けない床がある`); break; }
      for (const fi of f.items) if (f.tiles[at(f, fi.x, fi.y)] !== T_FLOOR || dist[at(f, fi.x, fi.y)] < 0) problems.push(`${tag} 道具が行けない所にある`);
      const spots = new Set<number>();
      for (const s of spawns) {
        const k = at(f, s.x, s.y);
        if (spots.has(k) || (s.x === start.x && s.y === start.y)) problems.push(`${tag} 敵が重なる`);
        spots.add(k);
        if (!canStand(f, s.x, s.y, 'fly')) problems.push(`${tag} 敵が壁の中`);
      }
      if (f.shop) {
        const room = f.rooms[f.shop.room];
        const keeper = spawns.find((s) => s.role === 'keeper');
        if (!keeper) problems.push(`${tag} 店主がいない`);
        if (keeper && f.tiles[at(f, keeper.x, keeper.y)] !== T_FLOOR) problems.push(`${tag} 店主が床の外`);
        if (f.traps.some((t) => f.roomOf[at(f, t.x, t.y)] === room.id)) problems.push(`${tag} 店の中に罠`);
        // 店主は入口の正面をふさがない
        for (const d of roomDoors(f, room)) {
          const ix = Math.max(room.x, Math.min(room.x + room.w - 1, d.x)), iy = Math.max(room.y, Math.min(room.y + room.h - 1, d.y));
          if (keeper && keeper.x === ix && keeper.y === iy) problems.push(`${tag} 店主が入口をふさいでいる`);
        }
        if (!f.items.some((fi) => fi.item.shop)) problems.push(`${tag} 店に品物が無い`);
        for (const id of ['w_tsuruhashi', 't_kussaku']) {
          const tool = f.items.filter((fi) => fi.item.id === id && !fi.item.shop);
          if (tool.length < 1) problems.push(`${tag} 店の階に${id}が無い`);
          if (tool.some((fi) => f.roomOf[at(f, fi.x, fi.y)] === room.id)) problems.push(`${tag} ${id}が店の中にある`);
        }
      }
      if (problems.length > 10) break;
    }
    expect(problems).toEqual([]);
    // 特別な階もそれなりに出る
    expect(shops).toBeGreaterThan(100);
    expect(houses).toBeGreaterThan(40);
    expect(bigs).toBeGreaterThan(20);
    expect(darks).toBeGreaterThan(20);
  });

  it('天守は大広間で、城主と中の階の将、護衛がいる。階段は無い', () => {
    let uid = 1;
    const { floor, spawns } = generateFloor({ s: 5 }, { mode: 'siege', no: 5, danger: 12, band: 8, liquid: null, boss: true, faction: 'kurogane', bossGen: 'g_a', midGen: 'g_b', newUid: () => uid++ });
    expect(floor.kind).toBe('boss');
    expect(floor.stairs).toBeNull();
    expect(spawns.filter((s) => s.gen).map((s) => s.gen).sort()).toEqual(['g_a', 'g_b']);
    expect(spawns.filter((s) => !s.gen).length).toBeGreaterThanOrEqual(4);
  });

  it('合戦の野：味方は南、敵の大将は北。歩ける所はすべてつながっている', () => {
    for (let i = 0; i < 300; i++) {
      let uid = 1;
      const { floor: f, spawns, start } = generateFloor({ s: i * 31 + 7 }, { mode: 'defense', no: 1, danger: 8, band: 9, liquid: null, boss: false, field: true, faction: 'kurogane', bossGen: 'g_c', newUid: () => uid++ });
      expect(f.kind).toBe('field');
      const boss = spawns.find((s) => s.gen === 'g_c')!;
      expect(boss.y).toBeLessThan(start.y);
      const dist = distanceField(f, start, 'walk');
      expect(dist[at(f, boss.x, boss.y)]).toBeGreaterThan(0);
      for (let k = 0; k < f.tiles.length; k++) if (f.tiles[k] === T_FLOOR) expect(dist[k]).toBeGreaterThanOrEqual(0);
      for (const s of spawns) expect(canStand(f, s.x, s.y, 'fly')).toBe(true);
    }
  });

  it('勢力ごとに兵の顔ぶれが違う（妖魔の巣は妖怪だけ）', () => {
    let uid = 1;
    const ids = (faction: 'kurogane' | 'youma') => {
      const out: string[] = [];
      for (let i = 0; i < 60; i++) out.push(...generateFloor({ s: i }, { mode: 'siege', no: 2, danger: 12, band: 1, liquid: null, boss: false, faction, newUid: () => uid++ }).spawns.filter((s) => !s.role).map((s) => s.id));
      return out;
    };
    const kuro = ids('kurogane');
    const youma = ids('youma');
    expect(kuro.some((id) => id.startsWith('teppo'))).toBe(true);
    expect(youma.every((id) => !['ashigaru', 'teppo', 'yumi', 'kiba', 'sohei', 'shinobi', 'kaizoku', 'musha', 'jutsu', 'hiya'].some((f) => id.startsWith(f)))).toBe(true);
  });

  it('同じ seed なら同じ地図', () => {
    const gen = () => {
      let uid = 1;
      return JSON.stringify(generateFloor({ s: 42 }, { mode: 'siege', no: 3, danger: 7, band: 1, liquid: null, boss: false, faction: 'shion', newUid: () => uid++ }));
    };
    expect(gen()).toBe(gen());
  });
});
