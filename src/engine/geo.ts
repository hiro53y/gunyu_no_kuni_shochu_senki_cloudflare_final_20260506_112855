// 地図の判定：通れるか・角の抜け・見える範囲・距離
import { DX, DY, T_FLOOR, T_HARD, T_LAVA, T_WALL, T_WATER, type Dir, type Floor, type Monster, type Pos, type Run } from './types';
import { monDef } from '../content/monsters';

export const at = (f: Floor, x: number, y: number) => y * f.w + x;
export const inside = (f: Floor, x: number, y: number) => x >= 0 && y >= 0 && x < f.w && y < f.h;
export const tileAt = (f: Floor, x: number, y: number) => (inside(f, x, y) ? f.tiles[at(f, x, y)] : T_HARD);
export const isWall = (f: Floor, x: number, y: number) => {
  const t = tileAt(f, x, y);
  return t === T_WALL || t === T_HARD;
};
export const cheb = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export type MoveKind = 'walk' | 'swim' | 'fly' | 'phase';

/** その種類の者がそのマスに立てるか（ほかの者がいるかは見ない） */
export function canStand(f: Floor, x: number, y: number, kind: MoveKind): boolean {
  const t = tileAt(f, x, y);
  if (t === T_HARD) return false;
  if (t === T_FLOOR) return true;
  if (t === T_WALL) return kind === 'phase';
  if (t === T_WATER) return kind === 'swim' || kind === 'fly' || kind === 'phase';
  if (t === T_LAVA) return kind === 'fly' || kind === 'phase';
  return false;
}

/** 斜めの移動・攻撃は、両脇のどちらかが壁だと通れない（壁抜けは除く） */
export function cornerOk(f: Floor, x: number, y: number, dir: Dir, kind: MoveKind = 'walk'): boolean {
  if (kind === 'phase') return true;
  if (dir % 2 === 0) return true;
  return !isWall(f, x + DX[dir], y) && !isWall(f, x, y + DY[dir]);
}

export function dirTo(from: Pos, to: Pos): Dir | null {
  const dx = Math.sign(to.x - from.x), dy = Math.sign(to.y - from.y);
  if (dx === 0 && dy === 0) return null;
  for (let d = 0; d < 8; d++) if (DX[d] === dx && DY[d] === dy) return d as Dir;
  return null;
}

/** 一直線（縦・横・斜め）に並んでいるなら、その向きと距離 */
export function lineDir(from: Pos, to: Pos): { dir: Dir; dist: number } | null {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (dx === 0 && dy === 0) return null;
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return null;
  const dir = dirTo(from, to)!;
  return { dir, dist: Math.max(Math.abs(dx), Math.abs(dy)) };
}

export function roomAt(f: Floor, x: number, y: number) {
  if (!inside(f, x, y)) return null;
  const id = f.roomOf[at(f, x, y)];
  return id >= 0 ? f.rooms[id] : null;
}

/** 部屋に接する通路のマス（出入り口）なら、その部屋 */
export function doorRoom(f: Floor, x: number, y: number) {
  if (roomAt(f, x, y)) return null;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const room = roomAt(f, x + dx, y + dy);
    if (room) return room;
  }
  return null;
}

/** その位置から見えるマス（明るい部屋は全体、通路・暗い階は周り1マス、霧は周り2マス） */
export function visibleFrom(f: Floor, x: number, y: number): Set<number> {
  const out = new Set<number>();
  const radius = f.fog ? 2 : 1;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (inside(f, x + dx, y + dy)) out.add(at(f, x + dx, y + dy));
    }
  }
  if (f.fog) return out;
  const room = roomAt(f, x, y) ?? doorRoom(f, x, y);
  if (room && room.lit && !f.dark) {
    for (let yy = room.y - 1; yy <= room.y + room.h; yy++) {
      for (let xx = room.x - 1; xx <= room.x + room.w; xx++) if (inside(f, xx, yy)) out.add(at(f, xx, yy));
    }
  }
  return out;
}

/** プレイヤーから見えるマス（見たマスは記録する） */
export function updateSight(run: Run): Set<number> {
  const f = run.floor;
  const vis = visibleFrom(f, run.player.x, run.player.y);
  for (const i of vis) f.seen[i] = 1;
  return vis;
}

export function monsterAt(run: Run, x: number, y: number): Monster | null {
  for (const m of run.monsters) if (!m.dead && m.x === x && m.y === y) return m;
  return null;
}

/** 誰も（プレイヤーも敵も）いないか */
export function vacant(run: Run, x: number, y: number): boolean {
  if (run.player.x === x && run.player.y === y) return false;
  return !monsterAt(run, x, y);
}

export function moveKind(m: Monster): MoveKind {
  return monDef(m.id).move;
}

/** 歩いて到達できる距離（BFS）。kind に応じて水や溶岩も渡る */
export function distanceField(f: Floor, from: Pos, kind: MoveKind, limit = 9999): Int16Array {
  const dist = new Int16Array(f.w * f.h).fill(-1);
  const queue: number[] = [at(f, from.x, from.y)];
  dist[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const cx = cur % f.w, cy = Math.floor(cur / f.w);
    if (dist[cur] >= limit) continue;
    for (let d = 0; d < 8; d++) {
      const nx = cx + DX[d], ny = cy + DY[d];
      if (!inside(f, nx, ny)) continue;
      const ni = at(f, nx, ny);
      if (dist[ni] >= 0 || !canStand(f, nx, ny, kind) || !cornerOk(f, cx, cy, d as Dir, kind)) continue;
      dist[ni] = dist[cur] + 1;
      queue.push(ni);
    }
  }
  return dist;
}
