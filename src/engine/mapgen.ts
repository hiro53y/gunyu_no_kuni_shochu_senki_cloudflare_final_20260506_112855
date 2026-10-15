// 階の生成：区画ごとに部屋か通路の分岐点を置き、木構造＋αでつなぐ
import { pickMonster } from '../content/monsters';
import type { FactionId } from '../content/sengoku';
import { ITEMS, itemDef, type ItemDef } from '../content/items';
import { TRAPS } from '../content/world';
import { chance, int, range, shuffle, weighted, type Rng } from './rng';
import { distanceField } from './geo';
import { T_FLOOR, T_HARD, T_LAVA, T_WALL, T_WATER, type Floor, type Item, type ItemCat, type Pos, type Room, type RunMode, type Trap } from './types';

export const MAP_W = 56;
export const MAP_H = 32;

export interface MonsterSpawn { id: string; x: number; y: number; asleep: boolean; role?: 'keeper' | 'boss' | 'npc'; gen?: string }

export interface GenResult { floor: Floor; spawns: MonsterSpawn[]; start: Pos }

export interface GenOptions {
  mode: RunMode;
  no: number;
  /** 敵や道具の強さの基準になる階 */
  danger: number;
  band: number;
  liquid: 'water' | 'lava' | null;
  /** 最上階（天守の大広間） */
  boss: boolean;
  /** 合戦の野 */
  field?: boolean;
  /** 兵の顔ぶれ */
  faction: FactionId;
  /** 根切りの巻物で消した敵 */
  banned?: Record<string, true>;
  newUid: () => number;
  /** この階に置く将 */
  bossGen?: string;
  midGen?: string;
}

const idx = (x: number, y: number) => y * MAP_W + x;

interface Sector { gx: number; gy: number; x: number; y: number; w: number; h: number; room: Room | null; point: Pos }

function emptyFloor(no: number, band: number): Floor {
  const tiles = new Array(MAP_W * MAP_H).fill(T_WALL);
  for (let x = 0; x < MAP_W; x++) { tiles[idx(x, 0)] = T_HARD; tiles[idx(x, MAP_H - 1)] = T_HARD; }
  for (let y = 0; y < MAP_H; y++) { tiles[idx(0, y)] = T_HARD; tiles[idx(MAP_W - 1, y)] = T_HARD; }
  return {
    no, w: MAP_W, h: MAP_H, tiles, roomOf: new Array(MAP_W * MAP_H).fill(-1), rooms: [], stairs: null, items: [], traps: [],
    seen: new Array(MAP_W * MAP_H).fill(0), dark: false, fog: false, kind: 'normal', shop: null, house: -1, houseAwake: false, turns: 0, band,
  };
}

function carveRoom(floor: Floor, room: Room) {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      floor.tiles[idx(x, y)] = T_FLOOR;
      floor.roomOf[idx(x, y)] = room.id;
    }
  }
  floor.rooms.push(room);
}

function carve(floor: Floor, x: number, y: number) {
  if (x <= 0 || y <= 0 || x >= MAP_W - 1 || y >= MAP_H - 1) return;
  if (floor.tiles[idx(x, y)] === T_WALL) floor.tiles[idx(x, y)] = T_FLOOR;
}

/** 区画の出入り口：部屋なら辺の外側の1マス、分岐点ならその点 */
function doorOf(r: Rng, s: Sector, side: 'L' | 'R' | 'U' | 'D'): Pos {
  if (!s.room) return { ...s.point };
  const room = s.room;
  if (side === 'R') return { x: room.x + room.w, y: range(r, room.y, room.y + room.h - 1) };
  if (side === 'L') return { x: room.x - 1, y: range(r, room.y, room.y + room.h - 1) };
  if (side === 'D') return { x: range(r, room.x, room.x + room.w - 1), y: room.y + room.h };
  return { x: range(r, room.x, room.x + room.w - 1), y: room.y - 1 };
}

function connect(floor: Floor, r: Rng, a: Sector, b: Sector) {
  if (a.gx !== b.gx) {
    const [left, right] = a.gx < b.gx ? [a, b] : [b, a];
    const p = doorOf(r, left, 'R');
    const q = doorOf(r, right, 'L');
    // 左右の区画の境目付近で縦に折れる
    const lo = Math.min(p.x, q.x), hi = Math.max(p.x, q.x);
    const boundary = right.x - 1;
    const mid = Math.max(lo, Math.min(hi, boundary + range(r, -1, 1)));
    for (let x = p.x; x <= mid; x++) carve(floor, x, p.y);
    for (let y = Math.min(p.y, q.y); y <= Math.max(p.y, q.y); y++) carve(floor, mid, y);
    for (let x = mid; x <= q.x; x++) carve(floor, x, q.y);
  } else {
    const [top, bottom] = a.gy < b.gy ? [a, b] : [b, a];
    const p = doorOf(r, top, 'D');
    const q = doorOf(r, bottom, 'U');
    const lo = Math.min(p.y, q.y), hi = Math.max(p.y, q.y);
    const boundary = bottom.y - 1;
    const mid = Math.max(lo, Math.min(hi, boundary + range(r, -1, 1)));
    for (let y = p.y; y <= mid; y++) carve(floor, p.x, y);
    for (let x = Math.min(p.x, q.x); x <= Math.max(p.x, q.x); x++) carve(floor, x, mid);
    for (let y = mid; y <= q.y; y++) carve(floor, q.x, y);
  }
}

function layoutRooms(floor: Floor, r: Rng) {
  const cols = chance(r, 0.5) ? 3 : 4;
  const rows = chance(r, 0.35) ? 2 : 3;
  const sw = Math.floor((MAP_W - 2) / cols);
  const sh = Math.floor((MAP_H - 2) / rows);
  const sectors: Sector[] = [];
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const x = 1 + gx * sw, y = 1 + gy * sh;
      sectors.push({ gx, gy, x, y, w: sw, h: sh, room: null, point: { x: x + Math.floor(sw / 2), y: y + Math.floor(sh / 2) } });
    }
  }
  // 部屋を置く区画（最低3部屋）
  const order = shuffle(r, sectors.map((_, i) => i));
  const roomCount = Math.max(3, sectors.filter(() => chance(r, 0.82)).length);
  const withRoom = new Set(order.slice(0, roomCount));
  for (const [i, s] of sectors.entries()) {
    if (withRoom.has(i)) {
      const maxW = s.w - 4, maxH = s.h - 4;
      const w = range(r, Math.min(4, maxW), Math.max(4, maxW));
      const h = range(r, Math.min(3, maxH), Math.max(3, maxH));
      const rx = s.x + 2 + int(r, Math.max(1, s.w - 3 - w));
      const ry = s.y + 2 + int(r, Math.max(1, s.h - 3 - h));
      const room: Room = { id: floor.rooms.length, x: rx, y: ry, w: Math.min(w, s.x + s.w - 2 - rx), h: Math.min(h, s.y + s.h - 2 - ry), kind: 'normal', lit: true };
      s.room = room;
      carveRoom(floor, room);
    } else {
      s.point = { x: s.x + 2 + int(r, Math.max(1, s.w - 4)), y: s.y + 2 + int(r, Math.max(1, s.h - 4)) };
      carve(floor, s.point.x, s.point.y);
    }
  }
  // 木構造でつなぎ、さらにいくつか輪を作る
  const at = (gx: number, gy: number) => sectors[gy * cols + gx];
  const linked = new Set<string>();
  const key = (a: Sector, b: Sector) => [a.gx, a.gy, b.gx, b.gy].join(',');
  const visited = new Set<Sector>([sectors[int(r, sectors.length)]]);
  const edges: [Sector, Sector][] = [];
  while (visited.size < sectors.length) {
    const frontier: [Sector, Sector][] = [];
    for (const s of visited) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const gx = s.gx + dx, gy = s.gy + dy;
        if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
        const n = at(gx, gy);
        if (!visited.has(n)) frontier.push([s, n]);
      }
    }
    const [a, b] = frontier[int(r, frontier.length)];
    visited.add(b);
    edges.push([a, b]);
    linked.add(key(a, b)); linked.add(key(b, a));
  }
  for (const s of sectors) {
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const gx = s.gx + dx, gy = s.gy + dy;
      if (gx >= cols || gy >= rows) continue;
      const n = at(gx, gy);
      if (!linked.has(key(s, n)) && chance(r, 0.22)) edges.push([s, n]);
    }
  }
  for (const [a, b] of edges) connect(floor, r, a, b);
}

function bigRoom(floor: Floor) {
  carveRoom(floor, { id: 0, x: 1, y: 1, w: MAP_W - 2, h: MAP_H - 2, kind: 'normal', lit: true });
}

function bossArena(floor: Floor) {
  const w = 26, h = 16;
  carveRoom(floor, { id: 0, x: Math.floor((MAP_W - w) / 2), y: Math.floor((MAP_H - h) / 2), w, h, kind: 'boss', lit: true });
}

/** 部屋の中の空いたマス */
export function freeTilesInRoom(floor: Floor, room: Room, taken: Set<number>): Pos[] {
  const out: Pos[] = [];
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      const i = idx(x, y);
      if (floor.tiles[i] === T_FLOOR && !taken.has(i)) out.push({ x, y });
    }
  }
  return out;
}

/** 部屋の内側に水・溶岩の池を作る（部屋の縁は歩けるまま残すので、つながりは壊れない） */
function addLiquid(floor: Floor, r: Rng, kind: 'water' | 'lava') {
  const tile = kind === 'water' ? T_WATER : T_LAVA;
  for (const room of floor.rooms) {
    if (room.kind !== 'normal' || room.w < 6 || room.h < 5 || !chance(r, 0.55)) continue;
    const cx = range(r, room.x + 2, room.x + room.w - 3);
    const cy = range(r, room.y + 2, room.y + room.h - 3);
    const rx = range(r, 1, Math.max(1, Math.floor((room.w - 4) / 2)));
    const ry = range(r, 1, Math.max(1, Math.floor((room.h - 4) / 2)));
    for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
      for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
        const d = ((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2;
        if (d <= 1 + (chance(r, 0.3) ? 0.3 : 0)) floor.tiles[idx(x, y)] = tile;
      }
    }
  }
}

/** 階の強さに合った道具の種類 */
export function randomItemDef(r: Rng, danger: number, cats?: ItemCat[]): ItemDef {
  const catWeights: [ItemCat, number][] = [
    ['grass', 22], ['scroll', 19], ['food', 15], ['weapon', 7], ['armor', 7], ['staff', 8], ['pot', 7], ['charm', 4], ['arrow', 6],
  ];
  const usable = cats ? catWeights.filter(([c]) => cats.includes(c)) : catWeights;
  const cat = weighted(r, usable, ([, w]) => w)![0];
  const pool = ITEMS.filter((d) => d.cat === cat && d.weight > 0 && d.minFloor <= Math.max(1, danger));
  return weighted(r, pool, (d) => d.weight) ?? itemDef('g_yakusou');
}

/** 道具1つを作る（強化値・呪い・回数・容量） */
export function makeItem(r: Rng, def: ItemDef, uid: number, danger: number): Item {
  const item: Item = { uid, id: def.id };
  if (def.cat === 'weapon' || def.cat === 'armor') {
    const roll = r ? int(r, 100) : 99;
    let plus = 0;
    if (roll < 14) plus = range(r, 1, danger > 15 ? 4 : 3);
    else if (roll < 22) plus = -range(r, 1, 2);
    item.plus = plus;
    item.seals = [];
    item.cursed = def.alwaysCursed || (plus < 0 ? chance(r, 0.55) : chance(r, 0.06));
  }
  if (def.cat === 'charm') item.cursed = def.alwaysCursed || chance(r, 0.08);
  if (def.cat === 'staff' && def.charges) item.charges = range(r, def.charges[0], def.charges[1]);
  if (def.cat === 'pot' && def.cap) { item.cap = range(r, def.cap[0], def.cap[1]); item.contents = []; }
  if (def.cat === 'arrow') item.count = range(r, 5, 15);
  if (def.cat === 'gold') item.count = range(r, 20, 60) + danger * range(r, 6, 14);
  return item;
}

export function randomMonsterId(r: Rng, danger: number, banned: Record<string, true> = {}, faction: FactionId = 'youma'): string {
  return pickMonster(r, danger, faction, banned);
}

export function generateFloor(r: Rng, o: GenOptions): GenResult {
  const floor = emptyFloor(o.no, o.band);
  const spawns: MonsterSpawn[] = [];
  const taken = new Set<number>();

  if (o.field) return fieldFloor(floor, r, o, taken, spawns);

  if (o.boss) {
    floor.kind = 'boss';
    bossArena(floor);
    const room = floor.rooms[0];
    const start = { x: room.x + Math.floor(room.w / 2), y: room.y + room.h - 2 };
    taken.add(idx(start.x, start.y));
    const cx = room.x + Math.floor(room.w / 2);
    if (o.bossGen) { spawns.push({ id: 'general', x: cx, y: room.y + 2, asleep: false, role: 'boss', gen: o.bossGen }); taken.add(idx(cx, room.y + 2)); }
    if (o.midGen) { spawns.push({ id: 'general', x: cx - 3, y: room.y + 3, asleep: false, role: 'boss', gen: o.midGen }); taken.add(idx(cx - 3, room.y + 3)); }
    const guards = Math.min(5, 2 + Math.floor(o.danger / 6) + int(r, 2));
    for (let i = 0; i < guards; i++) {
      const spot = freeTilesInRoom(floor, room, taken).filter((p) => p.y < room.y + 7);
      const p = spot[int(r, spot.length)];
      taken.add(idx(p.x, p.y));
      spawns.push({ id: randomMonsterId(r, o.danger, o.banned, o.faction), x: p.x, y: p.y, asleep: false });
    }
    // 回復の足しになる道具を少し
    for (let i = 0; i < 3; i++) {
      const spot = freeTilesInRoom(floor, room, taken).filter((p) => p.y > room.y + room.h - 5);
      const p = spot[int(r, spot.length)];
      taken.add(idx(p.x, p.y));
      floor.items.push({ x: p.x, y: p.y, item: makeItem(r, randomItemDef(r, o.danger, ['grass', 'scroll']), o.newUid(), o.danger) });
    }
    return { floor, spawns, start };
  }


  const big = o.mode !== 'practice' && o.danger > 4 && !o.midGen && chance(r, 0.05);
  if (big) { floor.kind = 'big'; bigRoom(floor); } else layoutRooms(floor, r);
  if (o.liquid && !big) addLiquid(floor, r, o.liquid);
  if (o.danger >= 6 && o.mode !== 'practice' && chance(r, 0.07)) floor.dark = true;
  else if (o.danger >= 9 && chance(r, 0.06)) floor.fog = true;
  if (floor.dark) floor.rooms.forEach((room) => { room.lit = false; });

  const rooms = floor.rooms;
  const startRoom = rooms[int(r, rooms.length)];
  const startSpots = freeTilesInRoom(floor, startRoom, taken);
  const start = startSpots[int(r, startSpots.length)];
  taken.add(idx(start.x, start.y));

  // 店とモンスターハウス（スタートの部屋以外）
  const others = shuffle(r, rooms.filter((room) => room !== startRoom && room.w >= 4 && room.h >= 3));
  const shopChance = o.mode === 'practice' ? 0 : o.mode === 'hunt' ? 0.18 : 0.14;
  if (!big && others.length >= 2 && chance(r, shopChance)) {
    const room = others.shift()!;
    makeShop(floor, r, room, o, taken, spawns);
  }
  const houseChance = o.mode === 'practice' ? 0 : o.danger >= 3 ? 0.08 : 0;
  if (!big && others.length >= 2 && chance(r, houseChance)) {
    const room = others.shift()!;
    room.kind = 'house';
    floor.house = room.id;
    const spots = shuffle(r, freeTilesInRoom(floor, room, taken));
    const count = Math.min(spots.length - 2, range(r, 7, 12));
    for (let i = 0; i < count; i++) {
      const p = spots.pop()!;
      taken.add(idx(p.x, p.y));
      spawns.push({ id: randomMonsterId(r, o.danger, o.banned, o.faction), x: p.x, y: p.y, asleep: true });
    }
    for (let i = 0; i < range(r, 3, 6) && spots.length; i++) {
      const p = spots.pop()!;
      taken.add(idx(p.x, p.y));
      floor.items.push({ x: p.x, y: p.y, item: makeItem(r, randomItemDef(r, o.danger), o.newUid(), o.danger) });
    }
  }

  // 階段（店とモンスターハウス以外の部屋）
  const stairRooms = rooms.filter((room) => room.kind === 'normal' && (room !== startRoom || rooms.length === 1));
  const stairRoom = stairRooms.length ? stairRooms[int(r, stairRooms.length)] : startRoom;
  const stairSpots = freeTilesInRoom(floor, stairRoom, taken);
  floor.stairs = stairSpots[int(r, stairSpots.length)];
  taken.add(idx(floor.stairs.x, floor.stairs.y));

  const normalRooms = rooms.filter((room) => room.kind === 'normal');
  const randomSpot = (exclude?: Room): Pos | null => {
    const candidates = normalRooms.filter((room) => room !== exclude);
    for (let tries = 0; tries < 20; tries++) {
      const room = candidates.length ? candidates[int(r, candidates.length)] : normalRooms[0];
      const spots = freeTilesInRoom(floor, room, taken);
      if (spots.length) return spots[int(r, spots.length)];
    }
    return null;
  };

  // 罠
  const trapCount = o.mode === 'practice' ? 1 : Math.min(10, 2 + Math.floor(o.danger / 5) + int(r, 3));
  for (let i = 0; i < trapCount; i++) {
    const p = randomSpot();
    if (!p) break;
    taken.add(idx(p.x, p.y));
    const def = weighted(r, TRAPS.filter((t) => t.minFloor <= o.danger), (t) => t.weight)!;
    const trap: Trap = { x: p.x, y: p.y, id: def.id, found: false };
    floor.traps.push(trap);
  }

  // 店のある階には、壁を掘る道具を1つずつ（店の外に置く）
  if (floor.shop) {
    for (const id of ['w_tsuruhashi', 't_kussaku']) {
      const p = randomSpot();
      if (!p) break;
      taken.add(idx(p.x, p.y));
      floor.items.push({ x: p.x, y: p.y, item: makeItem(r, itemDef(id), o.newUid(), o.danger) });
    }
  }

  // 道具とお金
  const itemCount = range(r, 4, 7) + (o.mode === 'practice' ? 2 : 0);
  for (let i = 0; i < itemCount; i++) {
    const p = randomSpot();
    if (!p) break;
    taken.add(idx(p.x, p.y));
    floor.items.push({ x: p.x, y: p.y, item: makeItem(r, randomItemDef(r, o.danger), o.newUid(), o.danger) });
  }
  for (let i = 0; i < range(r, 1, 2); i++) {
    const p = randomSpot();
    if (!p) break;
    taken.add(idx(p.x, p.y));
    floor.items.push({ x: p.x, y: p.y, item: makeItem(r, itemDef('gold'), o.newUid(), o.danger) });
  }

  // 敵（スタートの部屋には置かない）
  const monCount = o.mode === 'practice' ? 2 : range(r, 4, 6) + Math.floor(o.danger / 12);
  for (let i = 0; i < monCount; i++) {
    const p = randomSpot(startRoom);
    if (!p) break;
    taken.add(idx(p.x, p.y));
    spawns.push({ id: randomMonsterId(r, o.danger, o.banned, o.faction), x: p.x, y: p.y, asleep: chance(r, 0.4) });
  }

  // 中の階の将：階段の部屋で、護衛と一緒に守っている
  if (o.midGen && floor.stairs) {
    const room = stairRoom;
    const near = freeTilesInRoom(floor, room, taken).sort((a, b) => cheb2(a, floor.stairs!) - cheb2(b, floor.stairs!));
    const g = near.shift();
    if (g) {
      taken.add(idx(g.x, g.y));
      spawns.push({ id: 'general', x: g.x, y: g.y, asleep: false, role: 'boss', gen: o.midGen });
      for (let i = 0; i < 2 && near.length; i++) {
        const q = near.splice(int(r, Math.min(near.length, 6)), 1)[0];
        taken.add(idx(q.x, q.y));
        spawns.push({ id: randomMonsterId(r, o.danger, o.banned, o.faction), x: q.x, y: q.y, asleep: false });
      }
    }
  }
  return { floor, spawns, start };
}

const cheb2 = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** 合戦の野：大きな原に林と岩。味方は南、敵は北に陣を敷く */
function fieldFloor(floor: Floor, r: Rng, o: GenOptions, taken: Set<number>, spawns: MonsterSpawn[]): GenResult {
  floor.kind = 'field';
  const room: Room = { id: 0, x: 3, y: 2, w: MAP_W - 6, h: 22, kind: 'normal', lit: true };
  carveRoom(floor, room);
  // 林と岩（小さな塊）。つながりは周りの通り道で保つ
  for (let i = 0; i < 9; i++) {
    const cx = range(r, room.x + 4, room.x + room.w - 5);
    const cy = range(r, room.y + 5, room.y + room.h - 7);
    const size = range(r, 1, 3);
    for (let k = 0; k < size + 2; k++) {
      const x = cx + range(r, -1, 1), y = cy + range(r, -1, 1);
      if (x > room.x && y > room.y && x < room.x + room.w - 1 && y < room.y + room.h - 1) {
        floor.tiles[idx(x, y)] = T_WALL;
        floor.roomOf[idx(x, y)] = -1;
      }
    }
  }
  // 小川
  if (chance(r, 0.5)) {
    const y = range(r, room.y + 8, room.y + 12);
    for (let x = room.x; x < room.x + room.w; x++) if (x % 9 !== 4 && floor.tiles[idx(x, y)] === T_FLOOR) floor.tiles[idx(x, y)] = T_WATER;
  }
  const cx = room.x + Math.floor(room.w / 2);
  const start = { x: cx, y: room.y + room.h - 2 };
  clearAround(floor, start);
  taken.add(idx(start.x, start.y));
  const boss = { x: cx + range(r, -6, 6), y: room.y + 2 };
  clearAround(floor, boss);
  // 大将までの道を必ず通し、囲まれて行けない所は林にする
  for (let y = boss.y; y <= start.y; y++) { floor.tiles[idx(boss.x, y)] = T_FLOOR; floor.roomOf[idx(boss.x, y)] = 0; }
  for (let x = Math.min(boss.x, start.x); x <= Math.max(boss.x, start.x); x++) { floor.tiles[idx(x, start.y)] = T_FLOOR; floor.roomOf[idx(x, start.y)] = 0; }
  const reach = distanceField(floor, start, 'walk');
  for (let i = 0; i < floor.tiles.length; i++) if (floor.tiles[i] === T_FLOOR && reach[i] < 0) { floor.tiles[i] = T_WALL; floor.roomOf[i] = -1; }
  if (o.bossGen) { spawns.push({ id: 'general', x: boss.x, y: boss.y, asleep: false, role: 'boss', gen: o.bossGen }); taken.add(idx(boss.x, boss.y)); }
  const count = range(r, 9, 12);
  for (let i = 0; i < count; i++) {
    for (let tries = 0; tries < 30; tries++) {
      const x = range(r, room.x + 1, room.x + room.w - 2), y = range(r, room.y + 1, room.y + 9);
      if (floor.tiles[idx(x, y)] !== T_FLOOR || taken.has(idx(x, y))) continue;
      taken.add(idx(x, y));
      spawns.push({ id: randomMonsterId(r, o.danger, o.banned, o.faction), x, y, asleep: false });
      break;
    }
  }
  for (let i = 0; i < 4; i++) {
    const x = range(r, room.x + 2, room.x + room.w - 3), y = range(r, room.y + 13, room.y + room.h - 3);
    if (floor.tiles[idx(x, y)] !== T_FLOOR || taken.has(idx(x, y))) continue;
    taken.add(idx(x, y));
    floor.items.push({ x, y, item: makeItem(r, randomItemDef(r, o.danger, ['grass', 'scroll', 'food']), o.newUid(), o.danger) });
  }
  floor.stairs = null;
  return { floor, spawns, start };
}

function clearAround(floor: Floor, p: Pos) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = p.x + dx, y = p.y + dy;
    if (x > 0 && y > 0 && x < MAP_W - 1 && y < MAP_H - 1 && floor.tiles[idx(x, y)] !== T_HARD) { floor.tiles[idx(x, y)] = T_FLOOR; floor.roomOf[idx(x, y)] = 0; }
  }
}

function makeShop(floor: Floor, r: Rng, room: Room, o: GenOptions, taken: Set<number>, spawns: MonsterSpawn[]) {
  room.kind = 'shop';
  floor.shop = { room: room.id, keeper: -1 };
  // 店主は入口の脇に立つ（入口の正面はふさがない）
  const doors = roomDoors(floor, room);
  const inner = doors.map((d) => ({ x: Math.max(room.x, Math.min(room.x + room.w - 1, d.x)), y: Math.max(room.y, Math.min(room.y + room.h - 1, d.y)) }));
  const isInner = (p: Pos) => inner.some((q) => q.x === p.x && q.y === p.y);
  let keeperPos: Pos = freeTilesInRoom(floor, room, taken).find((p) => !isInner(p)) ?? { x: room.x, y: room.y };
  const first = inner.length ? inner[int(r, inner.length)] : null;
  if (first) {
    const around: Pos[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const p = { x: first.x + dx, y: first.y + dy };
      if ((dx || dy) && p.x >= room.x && p.y >= room.y && p.x < room.x + room.w && p.y < room.y + room.h && !isInner(p) && floor.tiles[idx(p.x, p.y)] === T_FLOOR) around.push(p);
    }
    if (around.length) keeperPos = around[int(r, around.length)];
  }
  taken.add(idx(keeperPos.x, keeperPos.y));
  spawns.push({ id: 'keeper', x: keeperPos.x, y: keeperPos.y, asleep: false, role: 'keeper' });
  const spots = freeTilesInRoom(floor, room, taken).filter((p) => (p.x + p.y) % 2 === 0 && !doors.some((d) => Math.abs(d.x - p.x) + Math.abs(d.y - p.y) <= 1));
  shuffle(r, spots);
  const count = Math.min(spots.length, range(r, 6, 11));
  for (let i = 0; i < count; i++) {
    const p = spots[i];
    taken.add(idx(p.x, p.y));
    const item = makeItem(r, randomItemDef(r, o.danger + 2), o.newUid(), o.danger);
    item.shop = true;
    floor.items.push({ x: p.x, y: p.y, item });
  }
  // 店の中には罠を置かない（taken で除外）
  for (const p of freeTilesInRoom(floor, room, taken)) taken.add(idx(p.x, p.y));
}

/** 部屋の出入り口（部屋に接する通路のマス） */
export function roomDoors(floor: Floor, room: Room): Pos[] {
  const out: Pos[] = [];
  for (let x = room.x; x < room.x + room.w; x++) {
    for (const y of [room.y - 1, room.y + room.h]) if (floor.tiles[idx(x, y)] === T_FLOOR && floor.roomOf[idx(x, y)] < 0) out.push({ x, y });
  }
  for (let y = room.y; y < room.y + room.h; y++) {
    for (const x of [room.x - 1, room.x + room.w]) if (floor.tiles[idx(x, y)] === T_FLOOR && floor.roomOf[idx(x, y)] < 0) out.push({ x, y });
  }
  return out;
}
