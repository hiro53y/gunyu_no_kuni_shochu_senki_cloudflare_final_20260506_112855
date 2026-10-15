// 地形の絵：帯（城の見た目）ごとの床・壁・水・溶岩を手続きで描き、使い回す
import { BANDS } from '../content/world';

export const TILE_PX = 64;
const cache = new Map<string, HTMLCanvasElement>();

function hash(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = TILE_PX;
  return [c, c.getContext('2d')!];
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * k)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * k)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * k)));
  return `rgb(${r},${g},${b})`;
}

/** まだら模様（土・岩の地） */
function mottle(g: CanvasRenderingContext2D, base: string, seed: number, n = 40) {
  const S = TILE_PX;
  for (let i = 0; i < n; i++) {
    const x = hash(seed, i, 1) * S, y = hash(i, seed, 2) * S, r = 2 + hash(i, 3, seed) * 5;
    g.fillStyle = hash(i, i, seed) > 0.5 ? shade(base, 1.08) : shade(base, 0.9);
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
}

export function floorTile(band: number, variant: number): HTMLCanvasElement {
  const key = `f${band}-${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const b = BANDS[band];
  const [c, g] = canvas();
  const S = TILE_PX;
  const seed = band * 31 + variant;
  g.fillStyle = b.floor;
  g.fillRect(0, 0, S, S);
  g.lineWidth = 2;
  switch (b.fstyle) {
    case 'earth':
    case 'rock':
    case 'cave':
    case 'ember': {
      mottle(g, b.floor, seed);
      for (let i = 0; i < 5; i++) {
        const x = hash(variant, i, 3) * S, y = hash(i, variant, 5) * S;
        g.fillStyle = shade(b.floor, 0.72);
        g.beginPath(); g.ellipse(x, y, 3 + hash(i, 1, variant) * 3, 2 + hash(i, 2, variant) * 2, 0, 0, Math.PI * 2); g.fill();
      }
      if (b.fstyle === 'ember') {
        g.strokeStyle = 'rgba(255,120,40,0.35)';
        g.beginPath(); g.moveTo(hash(variant, 1, 1) * S, 0); g.lineTo(S / 2, S / 2); g.lineTo(hash(variant, 2, 2) * S, S); g.stroke();
      }
      if (b.fstyle === 'cave') {
        g.fillStyle = 'rgba(160,140,200,0.12)';
        g.beginPath(); g.arc(hash(variant, 7, 7) * S, hash(7, variant, 7) * S, 9, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case 'flag':
    case 'swamp': {
      mottle(g, b.floor, seed, 20);
      g.strokeStyle = shade(b.floor, 0.7);
      g.strokeRect(1, 1, S / 2 - 2, S / 2 - 2); g.strokeRect(S / 2 + 1, 1, S / 2 - 2, S / 2 - 2);
      g.strokeRect(1 + (variant % 2) * 8, S / 2 + 1, S / 2 - 2, S / 2 - 2); g.strokeRect(S / 2 + 1, S / 2 + 1, S / 2 - 2, S / 2 - 2);
      if (b.fstyle === 'swamp') {
        g.fillStyle = 'rgba(120,80,160,0.25)';
        g.beginPath(); g.ellipse(hash(variant, 3, 9) * S, hash(9, variant, 3) * S, 12, 6, 0, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case 'snow': {
      mottle(g, b.floor, seed, 30);
      g.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(hash(i, variant, 4) * S, hash(variant, i, 6) * S, 1.5, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = 'rgba(120,140,170,0.35)';
      g.beginPath(); g.moveTo(0, hash(variant, 9, 1) * S); g.quadraticCurveTo(S / 2, S / 2, S, hash(variant, 9, 2) * S); g.stroke();
      break;
    }
    case 'moss':
    case 'grass': {
      mottle(g, b.floor, seed, 30);
      for (let i = 0; i < (b.fstyle === 'grass' ? 7 : 4); i++) {
        const x = 6 + hash(variant, i, 7) * (S - 12), y = 10 + hash(i, variant, 9) * (S - 14);
        g.strokeStyle = b.accent;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y - 7); g.moveTo(x, y); g.lineTo(x + 1, y - 9); g.moveTo(x, y); g.lineTo(x + 4, y - 6); g.stroke();
      }
      if (b.fstyle === 'grass' && variant === 2) {
        g.fillStyle = '#e8d070';
        g.beginPath(); g.arc(20, 40, 2.5, 0, Math.PI * 2); g.arc(44, 18, 2.5, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case 'plank': {
      for (let i = 0; i < 4; i++) {
        g.fillStyle = shade(b.floor, 0.92 + hash(i, variant, 2) * 0.16);
        g.fillRect(0, i * 16, S, 16);
        g.strokeStyle = shade(b.floor, 0.7);
        g.beginPath(); g.moveTo(0, i * 16 + 1); g.lineTo(S, i * 16 + 1); g.stroke();
        const x = ((i + variant) % 3) * 22 + 8;
        g.beginPath(); g.moveTo(x, i * 16 + 1); g.lineTo(x, i * 16 + 17); g.stroke();
      }
      g.fillStyle = 'rgba(120,150,80,0.18)';
      g.beginPath(); g.arc(hash(variant, 2, 3) * S, hash(3, variant, 2) * S, 8, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'tatami': {
      // 畳：縁（へり）と目
      const horiz = variant % 2 === 0;
      g.fillStyle = '#a89a5a';
      g.fillRect(0, 0, S, S);
      g.strokeStyle = 'rgba(80,70,30,0.25)';
      g.lineWidth = 1;
      for (let i = 2; i < S; i += 4) {
        g.beginPath();
        if (horiz) { g.moveTo(0, i); g.lineTo(S, i); } else { g.moveTo(i, 0); g.lineTo(i, S); }
        g.stroke();
      }
      g.fillStyle = '#2a2a38';
      if (horiz) { g.fillRect(0, 0, S, 4); g.fillRect(0, S - 4, S, 4); } else { g.fillRect(0, 0, 4, S); g.fillRect(S - 4, 0, 4, S); }
      g.fillStyle = 'rgba(232,192,112,0.6)';
      if (horiz) { g.fillRect(0, 1, S, 1); g.fillRect(0, S - 3, S, 1); } else { g.fillRect(1, 0, 1, S); g.fillRect(S - 3, 0, 1, S); }
      break;
    }
    default:
      mottle(g, b.floor, seed);
  }
  // 縁を少し暗く（マス目が分かるように）
  g.strokeStyle = 'rgba(0,0,0,0.12)';
  g.lineWidth = 1;
  g.strokeRect(0.5, 0.5, S - 1, S - 1);
  cache.set(key, c);
  return c;
}

/** 壁。front は下が床の壁（正面が見える） */
export function wallTile(band: number, front: boolean, variant: number): HTMLCanvasElement {
  const key = `w${band}-${front ? 1 : 0}-${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const b = BANDS[band];
  const [c, g] = canvas();
  const S = TILE_PX;
  g.fillStyle = b.wall;
  g.fillRect(0, 0, S, S);
  switch (b.wstyle) {
    case 'bamboo': {
      for (let i = 0; i < 4; i++) {
        const x = 4 + i * 16 + hash(variant, i, 1) * 4;
        g.fillStyle = shade(b.wallTop, 0.9 + hash(i, variant, 2) * 0.3);
        g.fillRect(x, 0, 9, S);
        g.fillStyle = shade(b.wallTop, 1.35);
        g.fillRect(x + 1, 0, 2, S);
        g.fillStyle = shade(b.wall, 0.7);
        for (let k = 0; k < 3; k++) g.fillRect(x, ((k * 22 + i * 7 + variant * 5) % S), 9, 2);
      }
      break;
    }
    case 'hedge': {
      for (let i = 0; i < 9; i++) {
        g.fillStyle = shade(b.wallTop, 0.75 + hash(i, variant, 4) * 0.5);
        g.beginPath(); g.arc(hash(i, variant, 5) * S, hash(variant, i, 6) * S, 10 + hash(i, 2, variant) * 8, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case 'wood':
    case 'castle': {
      // 板壁と柱。天守は白漆喰と黒い腰板
      if (b.wstyle === 'castle') {
        g.fillStyle = '#e8e0cc';
        g.fillRect(0, 0, S, S * 0.55);
        g.fillStyle = '#2a2420';
        g.fillRect(0, S * 0.55, S, S * 0.45);
        g.strokeStyle = 'rgba(0,0,0,0.35)';
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(0, S * 0.6 + i * 7); g.lineTo(S, S * 0.6 + i * 7); g.stroke(); }
        g.fillStyle = '#5a3a22';
        g.fillRect(variant % 2 ? 0 : S - 8, 0, 8, S);
      } else {
        for (let i = 0; i < 4; i++) {
          g.fillStyle = shade(b.wallTop, 0.75 + hash(i, variant, 9) * 0.35);
          g.fillRect(i * 16, 0, 15, S);
        }
        g.fillStyle = shade(b.wall, 0.8);
        g.fillRect(0, S / 2 - 3, S, 6);
      }
      break;
    }
    case 'snowrock':
    case 'rock':
    case 'swamp':
    case 'ishigaki':
    default: {
      // 岩・石垣（石垣は長方形の石を互い違いに）
      const rows = b.wstyle === 'ishigaki' ? 5 : 4;
      const rh = S / rows;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < 3; col++) {
          const x = col * 24 - (row % 2) * 12, y = row * rh;
          g.fillStyle = shade(b.wallTop, 0.72 + hash(row, col, variant + band) * 0.42);
          if (b.wstyle === 'rock' || b.wstyle === 'swamp') {
            g.beginPath(); g.ellipse(x + 12, y + rh / 2, 12, rh / 2 - 1, 0, 0, Math.PI * 2); g.fill();
          } else g.fillRect(x + 1, y + 1, 22, rh - 2);
          g.fillStyle = 'rgba(255,255,255,0.08)';
          g.fillRect(x + 2, y + 1, 20, 2);
        }
      }
      if (b.wstyle === 'snowrock') {
        g.fillStyle = 'rgba(250,252,255,0.9)';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(S, 0); g.lineTo(S, 8); g.quadraticCurveTo(S / 2, 14, 0, 9); g.fill();
      }
      if (b.wstyle === 'swamp') {
        g.fillStyle = 'rgba(80,40,110,0.3)';
        g.fillRect(0, 0, S, S);
      }
    }
  }
  if (front) {
    // 正面：下側を暗く、上端に光
    const grad = g.createLinearGradient(0, S * 0.45, 0, S);
    grad.addColorStop(0, 'rgba(0,0,0,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = grad;
    g.fillRect(0, S * 0.45, S, S * 0.55);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, S - 4, S, 4);
  } else {
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(0, 0, S, S);
  }
  cache.set(key, c);
  return c;
}

/** 水・溶岩（4コマのゆらぎ） */
export function liquidTile(kind: 'water' | 'lava', frame: number): HTMLCanvasElement {
  const key = `${kind}-${frame}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = canvas();
  const S = TILE_PX;
  if (kind === 'water') {
    const grad = g.createLinearGradient(0, 0, 0, S);
    grad.addColorStop(0, '#2f6f96');
    grad.addColorStop(1, '#1d4a6c');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(200,240,255,0.45)';
    g.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const y = 12 + i * 20, off = (frame * 8 + i * 13) % S;
      g.beginPath();
      g.moveTo(off - 14, y); g.quadraticCurveTo(off - 7, y - 5, off, y); g.quadraticCurveTo(off + 7, y + 5, off + 14, y);
      g.stroke();
    }
  } else {
    const grad = g.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S * 0.75);
    grad.addColorStop(0, frame % 2 ? '#ffb347' : '#ff9a2e');
    grad.addColorStop(1, '#a3260e');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(60,10,0,0.55)';
    g.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(hash(i, frame, 1) * S, hash(i, 2, frame) * S);
      g.lineTo(hash(i, frame, 3) * S, hash(i, 4, frame) * S);
      g.stroke();
    }
  }
  cache.set(key, c);
  return c;
}
