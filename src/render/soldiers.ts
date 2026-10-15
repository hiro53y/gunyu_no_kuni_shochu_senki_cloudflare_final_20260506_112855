// 城の兵の絵：系統（10）×段階（3）を Canvas で描き、勢力の色で塗る（128px）
const S = 128;
const cache = new Map<string, HTMLCanvasElement>();

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.min(255, Math.max(0, Math.round(v * k)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

const SKIN = '#e8c39a';
const SKIN_D = '#c89a72';
const INK = '#1b1612';
const GOLD = '#e8c060';

type G = CanvasRenderingContext2D;

function line(g: G, pts: number[], w: number, color: string) {
  g.strokeStyle = color;
  g.lineWidth = w;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
}

function poly(g: G, pts: number[], fill: string, stroke = INK, w = 2.5) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  if (w > 0) { g.strokeStyle = stroke; g.lineWidth = w; g.lineJoin = 'round'; g.stroke(); }
}

function circle(g: G, x: number, y: number, r: number, fill: string, stroke = INK, w = 2.5) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
  if (w > 0) { g.strokeStyle = stroke; g.lineWidth = w; g.stroke(); }
}

function ellipse(g: G, x: number, y: number, rx: number, ry: number, fill: string, stroke = INK, w = 2.5) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
  if (w > 0) { g.strokeStyle = stroke; g.lineWidth = w; g.stroke(); }
}

/** 顔（正面やや左向き） */
function face(g: G, x: number, y: number, mood: 'normal' | 'fierce' | 'mask' = 'normal') {
  circle(g, x, y, 14, SKIN);
  g.fillStyle = SKIN_D;
  g.beginPath(); g.arc(x + 4, y + 4, 10, 0, Math.PI); g.fill();
  if (mood === 'mask') {
    poly(g, [x - 14, y - 1, x + 14, y - 1, x + 13, y + 12, x - 13, y + 12], '#23252c', INK, 2);
  }
  // 目
  g.fillStyle = INK;
  const ey = y - 2;
  if (mood === 'fierce') {
    line(g, [x - 9, ey - 5, x - 3, ey - 2], 2.5, INK);
    line(g, [x + 9, ey - 5, x + 3, ey - 2], 2.5, INK);
  }
  g.beginPath(); g.ellipse(x - 5, ey, 2, 2.6, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(x + 5, ey, 2, 2.6, 0, 0, Math.PI * 2); g.fill();
  if (mood !== 'mask') line(g, [x - 3, y + 7, x + 3, y + 7], 2, '#7a3a2a');
}

/** 陣笠 */
function jingasa(g: G, x: number, y: number, color: string, mon: boolean) {
  poly(g, [x - 24, y + 4, x, y - 12, x + 24, y + 4, x + 18, y + 7, x - 18, y + 7], shade(color, 0.55));
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.beginPath(); g.moveTo(x - 20, y + 3); g.lineTo(x, y - 9); g.lineTo(x - 4, y + 4); g.fill();
  if (mon) circle(g, x, y - 1, 4, GOLD, INK, 1.5);
}

/** 兜（吹き返しと前立て） */
function kabuto(g: G, x: number, y: number, color: string, crest: 'moon' | 'horn' | 'none') {
  poly(g, [x - 18, y + 6, x - 16, y - 8, x, y - 16, x + 16, y - 8, x + 18, y + 6], shade(color, 0.45));
  poly(g, [x - 22, y + 4, x - 12, y + 2, x - 12, y + 12, x - 22, y + 10], shade(color, 0.7), INK, 2);
  poly(g, [x + 22, y + 4, x + 12, y + 2, x + 12, y + 12, x + 22, y + 10], shade(color, 0.7), INK, 2);
  line(g, [x - 16, y + 3, x + 16, y + 3], 2, GOLD);
  if (crest === 'moon') {
    g.strokeStyle = GOLD; g.lineWidth = 4; g.beginPath(); g.arc(x, y - 22, 12, Math.PI * 0.15, Math.PI * 0.85, true); g.stroke();
  } else if (crest === 'horn') {
    line(g, [x - 6, y - 14, x - 16, y - 30, x - 20, y - 34], 4, GOLD);
    line(g, [x + 6, y - 14, x + 16, y - 30, x + 20, y - 34], 4, GOLD);
  }
}

/** 胴（勢力の色）と腕 */
function body(g: G, x: number, y: number, color: string, opts: { robe?: boolean; light?: boolean; gold?: boolean } = {}) {
  const dark = shade(color, 0.7);
  // 袴と脚
  poly(g, [x - 16, y + 18, x + 16, y + 18, x + 20, y + 40, x + 4, y + 40, x, y + 28, x - 4, y + 40, x - 20, y + 40], opts.robe ? '#e8e2d4' : '#3a3550');
  // 胴
  if (opts.robe) {
    poly(g, [x - 18, y - 6, x + 18, y - 6, x + 22, y + 22, x - 22, y + 22], '#f2ede2');
    poly(g, [x - 4, y - 6, x + 4, y - 6, x + 3, y + 20, x - 3, y + 20], color, INK, 1.5);
  } else {
    poly(g, [x - 18, y - 6, x + 18, y - 6, x + 20, y + 20, x - 20, y + 20], color);
    for (let i = 0; i < 3; i++) line(g, [x - 17, y + 1 + i * 6, x + 17, y + 1 + i * 6], 1.5, dark);
    if (!opts.light) {
      // 草摺
      poly(g, [x - 20, y + 18, x - 6, y + 18, x - 7, y + 30, x - 21, y + 28], dark, INK, 2);
      poly(g, [x + 20, y + 18, x + 6, y + 18, x + 7, y + 30, x + 21, y + 28], dark, INK, 2);
    }
    if (opts.gold) { line(g, [x - 18, y - 5, x + 18, y - 5], 3, GOLD); line(g, [x, y - 5, x, y + 19], 2, GOLD); }
  }
  // 肩
  ellipse(g, x - 20, y - 2, 7, 6, opts.robe ? '#f2ede2' : dark);
  ellipse(g, x + 20, y - 2, 7, 6, opts.robe ? '#f2ede2' : dark);
}

function hand(g: G, x: number, y: number) {
  circle(g, x, y, 4.5, SKIN, INK, 2);
}

function spear(g: G, x: number, y: number, long: boolean) {
  line(g, [x, y + 34, x, y - (long ? 70 : 52)], 4, '#6a4a2a');
  poly(g, [x - 3, y - (long ? 70 : 52), x + 3, y - (long ? 70 : 52), x, y - (long ? 84 : 66)], '#dfe6ee', INK, 1.5);
}

function katana(g: G, x1: number, y1: number, x2: number, y2: number) {
  line(g, [x1, y1, x2, y2], 4, '#dfe6ee');
  line(g, [x1, y1, x1 + (x1 - x2) * 0.25, y1 + (y1 - y2) * 0.25], 4.5, '#3a2a20');
}

function sashimono(g: G, x: number, y: number, color: string, mon: string) {
  line(g, [x + 12, y + 10, x + 12, y - 44], 3, '#3a2a20');
  poly(g, [x + 13, y - 44, x + 34, y - 44, x + 34, y - 14, x + 13, y - 14], color, INK, 2);
  g.fillStyle = '#fff';
  g.font = 'bold 14px serif';
  g.textAlign = 'center';
  g.fillText(mon, x + 24, y - 24);
}

function horse(g: G, x: number, y: number, armored: boolean) {
  const c = armored ? '#5a2a20' : '#7a5232';
  ellipse(g, x, y + 30, 34, 14, c);
  // 脚
  for (const dx of [-24, -12, 12, 24]) line(g, [x + dx, y + 38, x + dx + (dx < 0 ? -2 : 2), y + 58], 5, shade(c.replace('#', '#'), 0.8));
  // 首と頭
  poly(g, [x - 26, y + 26, x - 36, y + 6, x - 46, y + 4, x - 50, y + 12, x - 38, y + 20, x - 30, y + 34], c);
  line(g, [x - 36, y + 4, x - 28, y + 18], 3, '#2a1a10');
  circle(g, x - 42, y + 8, 1.6, INK, INK, 0);
  if (armored) line(g, [x - 30, y + 22, x + 30, y + 22], 3, GOLD);
}

/** 1体ぶんの絵を描く */
function draw(g: G, fam: string, tier: number, color: string, mon: string) {
  const x = 64;
  const gold = tier === 3;
  const flag = tier >= 2;
  switch (fam) {
    case 'ashigaru': {
      if (flag) sashimono(g, x, 70, color, mon);
      body(g, x, 70, color, { light: tier === 1, gold });
      if (tier === 1) { katana(g, x + 22, 74, x + 40, 46); hand(g, x + 22, 74); }
      else { spear(g, x + 24, 70, true); hand(g, x + 24, 72); }
      hand(g, x - 22, 78);
      face(g, x, 48, tier === 3 ? 'fierce' : 'normal');
      if (tier === 3) kabuto(g, x, 38, color, 'moon'); else jingasa(g, x, 38, color, flag);
      break;
    }
    case 'teppo': {
      if (flag) sashimono(g, x, 70, color, mon);
      body(g, x, 70, color, { light: true, gold });
      // 鉄砲（横に構える）
      line(g, [x - 40, 66, x + 30, 74], 5, '#4a3a2a');
      line(g, [x - 44, 65, x - 10, 69], 3, '#8a8f98');
      hand(g, x - 12, 70); hand(g, x + 16, 74);
      if (tier >= 2) { g.fillStyle = 'rgba(200,200,200,0.5)'; g.beginPath(); g.arc(x - 48, 62, 6, 0, Math.PI * 2); g.fill(); }
      face(g, x, 48, 'normal');
      if (tier === 3) kabuto(g, x, 38, color, 'none'); else jingasa(g, x, 38, color, flag);
      break;
    }
    case 'yumi': {
      if (flag) sashimono(g, x, 70, color, mon);
      body(g, x, 70, color, { light: true, gold });
      // 弓
      g.strokeStyle = '#6a3a1a'; g.lineWidth = 4; g.beginPath(); g.arc(x - 18, 64, 34, -Math.PI * 0.45, Math.PI * 0.45, false); g.stroke();
      line(g, [x - 8, 32, x - 8, 96], 1.2, '#eee');
      line(g, [x - 8, 64, x + 24, 64], 2, '#c8b080');
      hand(g, x - 2, 64); hand(g, x + 20, 66);
      face(g, x, 48, 'normal');
      if (tier === 3) kabuto(g, x, 38, color, 'moon'); else jingasa(g, x, 38, color, flag);
      break;
    }
    case 'kiba': {
      horse(g, x + 4, 66, tier === 3);
      if (flag) sashimono(g, x + 8, 50, color, mon);
      body(g, x + 8, 50, tier === 3 ? '#c8382a' : color, { gold });
      spear(g, x + 32, 50, true);
      hand(g, x + 32, 54);
      face(g, x + 8, 28, 'fierce');
      kabuto(g, x + 8, 18, tier === 3 ? '#c8382a' : color, tier === 1 ? 'none' : 'moon');
      break;
    }
    case 'sohei': {
      body(g, x, 70, color, { robe: true });
      // 薙刀
      line(g, [x + 24, 104, x + 24, 18], 4, '#6a4a2a');
      g.fillStyle = '#dfe6ee'; g.beginPath(); g.moveTo(x + 22, 20); g.quadraticCurveTo(x + 34, 4, x + 30, -4); g.lineTo(x + 26, 20); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke();
      hand(g, x + 24, 70); hand(g, x - 22, 78);
      face(g, x, 48, tier >= 2 ? 'fierce' : 'normal');
      // 裹頭（白い頭巾）
      poly(g, [x - 16, 52, x - 16, 36, x, 30, x + 16, 36, x + 16, 52, x + 10, 44, x - 10, 44], '#f4f0e6');
      if (tier === 3) circle(g, x, 34, 3, GOLD, INK, 1.5);
      break;
    }
    case 'shinobi': {
      body(g, x, 70, '#2a2d38', { light: true });
      line(g, [x - 18, 72, x + 18, 72], 3, color);
      // 小太刀
      katana(g, x + 22, 76, x + 36, 58);
      hand(g, x + 22, 76); hand(g, x - 22, 76);
      face(g, x, 48, 'mask');
      // 頭巾
      poly(g, [x - 15, 46, x - 14, 36, x, 32, x + 14, 36, x + 15, 46, x + 10, 40, x - 10, 40], '#23252c');
      if (tier >= 2) line(g, [x + 14, 40, x + 30, 34], 3, color);
      break;
    }
    case 'kaizoku': {
      body(g, x, 70, color, { light: true, gold });
      // 縞の着物
      for (let i = 0; i < 4; i++) line(g, [x - 14 + i * 9, 66, x - 14 + i * 9, 88], 2, 'rgba(255,255,255,0.5)');
      // 曲刀
      g.strokeStyle = '#dfe6ee'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 22, 76); g.quadraticCurveTo(x + 42, 64, x + 38, 44); g.stroke();
      hand(g, x + 22, 76); hand(g, x - 22, 76);
      face(g, x, 48, 'fierce');
      // 鉢巻
      line(g, [x - 14, 40, x + 14, 40], 5, tier === 3 ? '#c8382a' : '#e8e2d4');
      line(g, [x + 13, 40, x + 22, 46], 3, tier === 3 ? '#c8382a' : '#e8e2d4');
      // 乱れ髪
      poly(g, [x - 14, 38, x - 10, 28, x - 2, 32, x + 4, 26, x + 10, 32, x + 15, 30, x + 14, 38], INK, INK, 1);
      break;
    }
    case 'musha': {
      const big = tier === 3;
      body(g, x, 70, color, { gold: tier >= 2 });
      if (big) { ellipse(g, x - 22, 68, 9, 8, shade(color, 0.6)); ellipse(g, x + 22, 68, 9, 8, shade(color, 0.6)); }
      // 金棒・大太刀
      if (tier === 3) { line(g, [x + 26, 96, x + 30, 30], 9, '#2a2a30'); for (let i = 0; i < 4; i++) circle(g, x + 28, 40 + i * 12, 2, '#9aa0a8', INK, 1); }
      else katana(g, x + 24, 78, x + 44, 36);
      hand(g, x + 25, 78); hand(g, x - 22, 78);
      face(g, x, 48, 'fierce');
      // 面頬
      poly(g, [x - 12, 50, x + 12, 50, x + 10, 60, x - 10, 60], shade(color, 0.4), INK, 2);
      kabuto(g, x, 38, color, tier === 1 ? 'none' : 'horn');
      break;
    }
    case 'jutsu': {
      body(g, x, 70, color, { robe: true });
      // 札
      for (let i = 0; i < 3; i++) poly(g, [x + 24 + i * 6, 58 - i * 8, x + 30 + i * 6, 58 - i * 8, x + 30 + i * 6, 72 - i * 8, x + 24 + i * 6, 72 - i * 8], '#f8f0c8', INK, 1);
      hand(g, x + 22, 70);
      // 錫杖
      line(g, [x - 24, 104, x - 24, 30], 3, '#8a7a50');
      g.strokeStyle = GOLD; g.lineWidth = 2; g.beginPath(); g.arc(x - 24, 26, 6, 0, Math.PI * 2); g.stroke();
      hand(g, x - 24, 74);
      face(g, x, 48, 'normal');
      // 烏帽子
      poly(g, [x - 12, 40, x - 8, 14, x + 6, 8, x + 12, 40], '#18181c');
      if (tier >= 2) line(g, [x - 12, 40, x + 12, 40], 3, color);
      if (tier === 3) { g.strokeStyle = 'rgba(180,140,255,0.7)'; g.lineWidth = 3; g.beginPath(); g.arc(x, 48, 30, 0, Math.PI * 2); g.stroke(); }
      break;
    }
    case 'hiya': {
      if (flag) sashimono(g, x, 70, color, mon);
      body(g, x, 70, color, { light: true, gold });
      if (tier === 2) {
        // 焙烙玉
        circle(g, x - 24, 80, 11, '#3a3030');
        line(g, [x - 24, 69, x - 20, 60], 2, '#c8a060');
        circle(g, x - 19, 58, 3, '#ffb040', '#ff6a20', 1);
        hand(g, x - 22, 74);
      } else {
        // 火の付いた矢と弓
        g.strokeStyle = '#6a3a1a'; g.lineWidth = 4; g.beginPath(); g.arc(x - 18, 64, 30, -Math.PI * 0.45, Math.PI * 0.45); g.stroke();
        line(g, [x - 6, 64, x + 26, 60], 2, '#c8b080');
        circle(g, x + 28, 59, 5, '#ffb040', '#ff5a10', 1.5);
        hand(g, x - 4, 64);
      }
      hand(g, x + 20, 72);
      face(g, x, 48, tier === 3 ? 'fierce' : 'normal');
      if (tier === 3) kabuto(g, x, 38, '#c8382a', 'horn'); else jingasa(g, x, 38, color, flag);
      break;
    }
    default:
      circle(g, x, 64, 30, color);
  }
}

/** 兵の絵（勢力の色で塗る）。sprite は 'soldier-<系統>' */
export function soldierSprite(sprite: string, tier: number, color: string, mon: string): HTMLCanvasElement {
  const fam = sprite.replace('soldier-', '');
  const key = `${fam}|${tier}|${color}|${mon}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.save();
  // 足元を下にそろえ、駒と並んでも小さすぎない大きさに
  g.translate(0, 2);
  draw(g, fam, tier, color, mon);
  g.restore();
  // 墨の陰影
  g.globalCompositeOperation = 'source-atop';
  const grad = g.createLinearGradient(0, 0, S * 0.4, S);
  grad.addColorStop(0, 'rgba(255,240,210,0.12)');
  grad.addColorStop(1, 'rgba(20,10,30,0.28)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'source-over';
  cache.set(key, c);
  return c;
}
