// 合戦のドット絵：2頭身のちび武将（顔は立ち絵から縮めたドット）と、兵種ごとの小さな兵。すべて Canvas で描いてキャッシュする
// 向きは右向き（左の陣）。右の陣は描く時に左右を反転する
import type { Kind } from '../types';

export type Pose = 'idle0' | 'idle1' | 'run0' | 'run1' | 'atk0' | 'atk1' | 'special' | 'hurt' | 'down';

/** 武将の絵の大きさ（ドット）。顔の位置も返す */
export interface GenSprite { canvas: HTMLCanvasElement; w: number; h: number; headX: number; headY: number; footX: number }

const OUT = '#1a1210';
const SKIN = '#f2c9a0';
const SKIN_D = '#c99470';
const METAL = '#d8dde6';
const METAL_D = '#8a929e';
const WOOD = '#8a5a2a';
const WOOD_D = '#5a3a1a';
const BLACK = '#26201e';
const WHITE = '#f4f0e8';
const RED = '#c83a3a';
const GOLD = '#e8c060';

type G = CanvasRenderingContext2D;

export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.min(255, Math.max(0, Math.round(v * k)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('')}`;
}

function mk(w: number, h: number): [HTMLCanvasElement, G] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return [c, g];
}

const p = (g: G, x: number, y: number, c: string) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
const r = (g: G, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
/** 線（整数の点で） */
function ln(g: G, x0: number, y0: number, x1: number, y1: number, c: string) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const n = Math.max(dx, dy);
  for (let i = 0; i <= n; i++) p(g, Math.round(x0 + ((x1 - x0) * i) / Math.max(1, n)), Math.round(y0 + ((y1 - y0) * i) / Math.max(1, n)), c);
}

/** 兵種ごとの衣の色（勢力の色を基本に） */
function clothes(kind: Kind, faction: string): { body: string; dark: string; light: string; legs: string } {
  switch (kind) {
    case 'miko': return { body: WHITE, dark: '#c8c0b8', light: '#ffffff', legs: RED };
    case 'sohei': return { body: '#d8d4cc', dark: '#a8a49c', light: '#f0ece4', legs: '#5a5a62' };
    case 'onmyo': return { body: '#e8e0f0', dark: '#b0a8c8', light: '#ffffff', legs: shade(faction, 0.6) };
    case 'shinobi': return { body: '#2e3040', dark: '#1c1d28', light: '#454860', legs: '#22232e' };
    case 'youkai': return { body: '#5a2e66', dark: '#3a1a44', light: '#7a4a88', legs: '#3a1a1a' };
    default: return { body: faction, dark: shade(faction, 0.6), light: shade(faction, 1.35), legs: shade(faction, 0.45) };
  }
}

// ── 武将（2頭身） ──

const GEN_W = 24;
const GEN_H = 26;

/** 武将の体（頭は別に重ねる）。骨格：頭 y0〜11、胴 y12〜18、脚 y19〜25、体の中心 x=10 */
function drawGeneral(kind: Kind, faction: string, pose: Pose): GenSprite {
  if (kind === 'kiba') return drawRider(faction, pose);
  const [c, g] = mk(GEN_W, GEN_H);
  const cl = clothes(kind, faction);
  const run = pose === 'run0' ? 1 : pose === 'run1' ? -1 : 0;
  const atk = pose === 'atk1' || pose === 'special';
  const raise = pose === 'atk0' || pose === 'special';
  // 脚（袴）
  const legY = 19;
  if (kind === 'miko' || kind === 'onmyo' || kind === 'sohei') {
    r(g, 6, legY, 9, 6, cl.legs);
    r(g, 6, legY, 9, 1, shade(cl.legs, 1.2));
    p(g, 5, legY + 5, OUT); p(g, 15, legY + 5, OUT);
    r(g, 7 + run, legY + 6, 3, 1, BLACK);
    r(g, 11 - run, legY + 6, 3, 1, BLACK);
  } else {
    r(g, 6 + run, legY, 4, 5, cl.legs);
    r(g, 11 - run, legY, 4, 5, cl.legs);
    r(g, 6 + run, legY + 5, 4, 2, BLACK);
    r(g, 11 - run, legY + 5, 4, 2, BLACK);
    p(g, 10, legY, shade(cl.legs, 0.8));
  }
  // 胴
  r(g, 6, 12, 9, 7, cl.body);
  r(g, 6, 12, 9, 1, cl.light);
  r(g, 6, 17, 9, 1, kind === 'shinobi' ? RED : GOLD); // 帯
  r(g, 10, 13, 1, 4, cl.dark);
  // 袖・肩当て
  const sode = kind === 'bushi' || kind === 'ashigaru' || kind === 'teppo' || kind === 'youkai' ? cl.dark : cl.body;
  r(g, 4, 12, 2, 4, sode);
  r(g, 15, 12, 2, 4, sode);
  if (kind === 'bushi' || kind === 'ashigaru') { p(g, 4, 13, cl.light); p(g, 16, 13, cl.light); }
  // 輪郭
  ln(g, 5, 12, 5, 18, OUT);
  ln(g, 16, 12, 16, 18, OUT);
  // 手と武器
  const hx = raise ? 16 : atk ? 18 : 16;
  const hy = raise ? 10 : atk ? 14 : 16;
  p(g, 4, 16, SKIN);
  switch (kind) {
    case 'bushi':
      if (raise) { ln(g, 15, 11, 12, 1, METAL); ln(g, 16, 11, 13, 1, METAL_D); r(g, 15, 11, 2, 2, BLACK); }
      else if (atk) { ln(g, 17, 14, 23, 20, METAL); ln(g, 17, 13, 23, 19, METAL_D); r(g, 16, 13, 2, 2, BLACK); }
      else { ln(g, 17, 15, 22, 9, METAL); ln(g, 16, 15, 21, 9, METAL_D); r(g, 16, 15, 2, 2, BLACK); }
      break;
    case 'ashigaru':
    case 'sohei': {
      const blade = kind === 'sohei' ? METAL : METAL;
      if (atk) { ln(g, 6, 14, 23, 14, WOOD); r(g, 21, 13, 3, 3, blade); p(g, 23, 14, WHITE); }
      else if (raise) { ln(g, 14, 22, 19, 2, WOOD); r(g, 19, 0, 2, 3, blade); }
      else { ln(g, 18, 24, 18, 3, WOOD); r(g, 17, 0, 3, 3, blade); if (kind === 'sohei') { p(g, 20, 1, blade); p(g, 20, 2, METAL_D); } }
      break;
    }
    case 'yumi':
      // 弓（大きな弧）
      ln(g, 19, 6, 21, 12, WOOD); ln(g, 21, 12, 21, 16, WOOD); ln(g, 21, 16, 19, 22, WOOD);
      if (raise || atk) { ln(g, 19, 6, 15, 14, '#e8e0c8'); ln(g, 15, 14, 19, 22, '#e8e0c8'); if (raise) ln(g, 13, 14, 22, 14, '#d0b080'); }
      else ln(g, 19, 6, 19, 22, '#e8e0c8');
      break;
    case 'teppo':
      r(g, 11, 15, 12, 2, '#3a3c44');
      r(g, 9, 15, 4, 3, WOOD);
      p(g, 22, 15, METAL_D);
      if (atk) { r(g, 23, 14, 1, 4, '#fff080'); }
      break;
    case 'shinobi':
      if (atk) { ln(g, 16, 14, 21, 12, SKIN); p(g, 22, 11, METAL); }
      else { r(g, 16, 15, 3, 1, METAL); }
      r(g, 5, 11, 12, 1, RED); // 首の布
      break;
    case 'gunshi':
      // 軍配
      if (atk) { ln(g, 16, 14, 20, 12, WOOD); r(g, 20, 9, 4, 5, '#2a2a2a'); p(g, 21, 10, GOLD); }
      else { ln(g, 16, 16, 17, 10, WOOD); r(g, 15, 5, 5, 5, '#2a2a2a'); p(g, 17, 7, GOLD); }
      break;
    case 'miko':
      // 御幣
      if (raise || atk) { ln(g, 16, 14, 17, 2, WOOD); r(g, 15, 1, 4, 1, WHITE); r(g, 18, 2, 1, 3, WHITE); r(g, 15, 3, 1, 3, WHITE); }
      else { ln(g, 16, 17, 18, 8, WOOD); r(g, 17, 7, 3, 1, WHITE); r(g, 19, 8, 1, 3, WHITE); }
      break;
    case 'onmyo':
      if (raise || atk) { r(g, 18, 11, 3, 5, WHITE); p(g, 19, 13, RED); }
      else { r(g, 16, 15, 2, 3, WHITE); }
      break;
    case 'youkai':
      // 爪
      r(g, hx, hy, 2, 2, '#7a4a88');
      p(g, hx + 2, hy - 1, WHITE); p(g, hx + 2, hy + 1, WHITE); p(g, hx + 2, hy + 3, WHITE);
      break;
    default:
  }
  if (kind !== 'youkai') p(g, hx, hy, SKIN);
  if (pose === 'hurt') { g.globalCompositeOperation = 'source-atop'; r(g, 0, 0, GEN_W, GEN_H, 'rgba(255,255,255,0.55)'); g.globalCompositeOperation = 'source-over'; }
  return { canvas: c, w: GEN_W, h: GEN_H, headX: 4, headY: raise ? -1 : 0, footX: 10 };
}

/** 騎馬の武将（馬に乗る） */
function drawRider(faction: string, pose: Pose): GenSprite {
  const W = 30, H = 30;
  const [c, g] = mk(W, H);
  const cl = clothes('kiba', faction);
  const step = pose === 'run0' ? 1 : pose === 'run1' ? -1 : 0;
  const atk = pose === 'atk1' || pose === 'special';
  // 馬
  const HB = '#7a4a26', HD = '#52301a';
  r(g, 5, 18, 17, 6, HB);
  r(g, 5, 18, 17, 1, '#9a6a3a');
  r(g, 20, 13, 4, 7, HB); // 首
  r(g, 22, 11, 6, 4, HB); // 頭
  p(g, 26, 12, BLACK); p(g, 27, 14, HD);
  r(g, 19, 12, 3, 6, BLACK); // たてがみ
  r(g, 3, 19, 2, 5, BLACK); // 尾
  // 脚
  const legs = [[6, 24], [9, 24], [17, 24], [20, 24]];
  legs.forEach(([x, y], i) => { const o = (i % 2 === 0 ? step : -step); r(g, x + o, y, 2, 5, HD); r(g, x + o, y + 5, 2, 1, BLACK); });
  // 鞍
  r(g, 10, 16, 6, 2, shade(faction, 0.7));
  // 乗り手（胴）
  r(g, 10, 9, 7, 7, cl.body);
  r(g, 10, 9, 7, 1, cl.light);
  r(g, 9, 9, 2, 4, cl.dark);
  r(g, 16, 9, 2, 4, cl.dark);
  r(g, 11, 15, 5, 2, cl.legs);
  // 槍
  if (atk) { ln(g, 8, 12, 29, 12, WOOD); r(g, 27, 11, 3, 3, METAL); }
  else { ln(g, 18, 18, 24, -1, WOOD); r(g, 23, 0, 2, 3, METAL); }
  p(g, 17, 12, SKIN);
  if (pose === 'hurt') { g.globalCompositeOperation = 'source-atop'; r(g, 0, 0, W, H, 'rgba(255,255,255,0.55)'); g.globalCompositeOperation = 'source-over'; }
  // 頭は乗り手の上（y -3 から）
  return { canvas: c, w: W, h: H, headX: 8, headY: -3, footX: 13 };
}

// ── 兵（小さい） ──

const SOL_W = 14;
const SOL_H = 14;

function drawSoldier(kind: Kind, faction: string, pose: Pose): HTMLCanvasElement {
  if (kind === 'kiba') return drawSmallRider(faction, pose);
  const [c, g] = mk(SOL_W, SOL_H);
  const cl = clothes(kind, faction);
  const run = pose === 'run0' ? 1 : pose === 'run1' ? -1 : 0;
  const atk = pose === 'atk1' || pose === 'special';
  // 脚
  r(g, 3 + run, 10, 2, 3, cl.legs);
  r(g, 6 - run, 10, 2, 3, cl.legs);
  r(g, 3 + run, 13, 2, 1, BLACK);
  r(g, 6 - run, 13, 2, 1, BLACK);
  // 胴
  r(g, 3, 6, 5, 4, cl.body);
  r(g, 3, 6, 5, 1, cl.light);
  r(g, 3, 9, 5, 1, cl.dark);
  // 頭
  const face = kind === 'youkai' ? (faction.length % 2 ? '#c84a3a' : '#4a6ac8') : SKIN;
  r(g, 3, 2, 5, 4, face);
  p(g, 6, 3, BLACK); p(g, 7, 4, kind === 'youkai' ? GOLD : SKIN_D);
  switch (kind) {
    case 'miko': r(g, 2, 1, 6, 2, BLACK); r(g, 2, 3, 1, 5, BLACK); break;
    case 'sohei': r(g, 2, 1, 7, 2, WHITE); r(g, 2, 3, 2, 4, WHITE); break;
    case 'onmyo': r(g, 3, 0, 4, 2, BLACK); r(g, 4, 0, 2, 1, '#3a3a3a'); break;
    case 'shinobi': r(g, 2, 1, 7, 2, '#22232e'); r(g, 3, 4, 5, 2, '#22232e'); break;
    case 'youkai': p(g, 3, 1, '#e8e0c0'); p(g, 7, 1, '#e8e0c0'); p(g, 3, 0, '#e8e0c0'); p(g, 7, 0, '#e8e0c0'); break;
    default:
      // 陣笠
      r(g, 1, 2, 9, 1, cl.dark);
      r(g, 3, 1, 5, 1, cl.body);
      p(g, 5, 0, cl.light);
  }
  // 武器
  switch (kind) {
    case 'ashigaru':
    case 'sohei':
      if (atk) { ln(g, 3, 8, 13, 8, WOOD); p(g, 13, 7, METAL); p(g, 13, 8, WHITE); }
      else { ln(g, 9, 13, 9, 0, WOOD); p(g, 9, 0, METAL); }
      break;
    case 'bushi':
      if (atk) ln(g, 8, 8, 13, 11, METAL);
      else ln(g, 8, 8, 11, 4, METAL);
      break;
    case 'yumi':
      ln(g, 10, 3, 11, 7, WOOD); ln(g, 11, 7, 10, 11, WOOD);
      if (atk) ln(g, 7, 7, 13, 7, '#d0b080');
      break;
    case 'teppo':
      r(g, 6, 7, 7, 1, '#3a3c44'); r(g, 5, 7, 2, 2, WOOD);
      if (atk) p(g, 13, 7, '#fff080');
      break;
    case 'shinobi':
      if (atk) { p(g, 9, 6, SKIN); p(g, 11, 5, METAL); } else p(g, 8, 8, METAL);
      break;
    case 'gunshi':
    case 'onmyo':
      if (atk) r(g, 9, 5, 2, 3, WHITE); else p(g, 8, 8, WHITE);
      break;
    case 'miko':
      ln(g, 8, 9, 9, 3, WOOD); p(g, 10, 3, WHITE); p(g, 10, 4, WHITE);
      break;
    case 'youkai':
      if (atk) { ln(g, 8, 7, 12, 4, WOOD_D); r(g, 11, 2, 3, 3, WOOD); } else { ln(g, 8, 9, 10, 4, WOOD_D); r(g, 9, 2, 3, 3, WOOD); }
      break;
    default:
  }
  if (pose === 'hurt') { g.globalCompositeOperation = 'source-atop'; r(g, 0, 0, SOL_W, SOL_H, 'rgba(255,255,255,0.6)'); g.globalCompositeOperation = 'source-over'; }
  return c;
}

function drawSmallRider(faction: string, pose: Pose): HTMLCanvasElement {
  const [c, g] = mk(18, 15);
  const cl = clothes('kiba', faction);
  const step = pose === 'run0' ? 1 : pose === 'run1' ? -1 : 0;
  const atk = pose === 'atk1' || pose === 'special';
  r(g, 3, 8, 10, 4, '#7a4a26');
  r(g, 11, 5, 3, 4, '#7a4a26');
  r(g, 13, 4, 3, 2, '#7a4a26');
  r(g, 1, 9, 2, 3, BLACK);
  [[4, 12], [11, 12]].forEach(([x, y], i) => r(g, x + (i ? -step : step), y, 2, 3, '#52301a'));
  r(g, 6, 3, 4, 5, cl.body);
  r(g, 6, 1, 4, 3, SKIN);
  r(g, 5, 0, 6, 1, cl.dark);
  p(g, 9, 2, BLACK);
  if (atk) ln(g, 6, 5, 17, 5, WOOD); else ln(g, 10, 8, 13, 0, WOOD);
  if (pose === 'hurt') { g.globalCompositeOperation = 'source-atop'; r(g, 0, 0, 18, 15, 'rgba(255,255,255,0.6)'); g.globalCompositeOperation = 'source-over'; }
  return c;
}

// ── キャッシュ ──

const genCache = new Map<string, GenSprite>();
const solCache = new Map<string, HTMLCanvasElement>();

export function generalSprite(kind: Kind, faction: string, pose: Pose): GenSprite {
  const key = `${kind}|${faction}|${pose}`;
  let s = genCache.get(key);
  if (!s) { s = drawGeneral(kind, faction, pose === 'down' ? 'idle0' : pose); genCache.set(key, s); }
  return s;
}

export function soldierSprite(kind: Kind, faction: string, pose: Pose): HTMLCanvasElement {
  const key = `${kind}|${faction}|${pose}`;
  let s = solCache.get(key);
  if (!s) { s = drawSoldier(kind, faction, pose === 'down' ? 'idle0' : pose); solCache.set(key, s); }
  return s;
}

// ── 顔（立ち絵の丸い顔を縮めてドットにする） ──

const HEAD = 12;
const headCache = new Map<string, HTMLCanvasElement | 'loading' | 'error'>();
const waiters = new Set<() => void>();

/** 色の段を減らす（ドット絵らしく） */
function posterize(v: number): number {
  return Math.min(255, Math.round(v / 36) * 36 + 10);
}

function buildHead(img: HTMLImageElement): HTMLCanvasElement {
  // 顔の中ほどを、まず 24px に、さらに 12px に縮める（色が混ざりすぎないよう2段で）
  const [mid, mg] = mk(24, 24);
  mg.imageSmoothingEnabled = true;
  mg.imageSmoothingQuality = 'high';
  const s = img.width;
  mg.drawImage(img, s * 0.16, s * 0.1, s * 0.68, s * 0.68, 0, 0, 24, 24);
  const [c, g] = mk(HEAD, HEAD);
  g.imageSmoothingEnabled = true;
  g.drawImage(mid, 0, 0, 24, 24, 0, 0, HEAD, HEAD);
  const data = g.getImageData(0, 0, HEAD, HEAD);
  const R = HEAD / 2 - 0.3;
  for (let y = 0; y < HEAD; y++) {
    for (let x = 0; x < HEAD; x++) {
      const i = (y * HEAD + x) * 4;
      const d = Math.hypot(x + 0.5 - HEAD / 2, y + 0.5 - HEAD / 2);
      if (d > R) { data.data[i + 3] = 0; continue; }
      data.data[i] = posterize(data.data[i]);
      data.data[i + 1] = posterize(data.data[i + 1]);
      data.data[i + 2] = posterize(data.data[i + 2]);
      data.data[i + 3] = 255;
      if (d > R - 1) { data.data[i] *= 0.45; data.data[i + 1] *= 0.4; data.data[i + 2] *= 0.4; }
    }
  }
  g.putImageData(data, 0, 0);
  return c;
}

/** ドットの顔（まだ読み込み中なら null。読み込めたら onReady を呼ぶ） */
export function headSprite(url: string, onReady?: () => void): HTMLCanvasElement | null {
  const got = headCache.get(url);
  if (got instanceof HTMLCanvasElement) return got;
  if (onReady) waiters.add(onReady);
  if (got === 'loading' || got === 'error') return null;
  headCache.set(url, 'loading');
  const img = new Image();
  img.onload = () => {
    try { headCache.set(url, buildHead(img)); } catch { headCache.set(url, 'error'); }
    for (const w of [...waiters]) w();
    waiters.clear();
  };
  img.onerror = () => headCache.set(url, 'error');
  img.src = url;
  return null;
}

/** 顔が読めない時の代わり（兵種の色の丸） */
export function fallbackHead(color: string): HTMLCanvasElement {
  const key = `fb|${color}`;
  const got = headCache.get(key);
  if (got instanceof HTMLCanvasElement) return got;
  const [c, g] = mk(HEAD, HEAD);
  g.fillStyle = OUT;
  g.beginPath(); g.arc(6, 6, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = SKIN;
  g.beginPath(); g.arc(6, 6, 5, 0, Math.PI * 2); g.fill();
  r(g, 1, 1, 10, 4, color);
  p(g, 7, 6, BLACK); p(g, 4, 6, BLACK);
  headCache.set(key, c);
  return c;
}

export const HEAD_SIZE = HEAD;
