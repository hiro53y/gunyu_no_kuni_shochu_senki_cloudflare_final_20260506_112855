// 八洲の地図（Canvas）：国の中心からの距離で塗り分けた国境、勢力の色、街道、城、攻めてくる敵
import { useEffect, useMemo, useRef } from 'react';
import { FACTIONS, REGIONS, regionDef } from '../content/sengoku';
import type { Campaign } from '../campaign/state';
import { canAttack } from '../campaign/campaign';

const GRID = 180;

function noise(x: number, y: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function smooth(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const a = noise(xi, yi), b = noise(xi + 1, yi), c = noise(xi, yi + 1), d = noise(xi + 1, yi + 1);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

/** 各マス（120×120）がどの国か。海は -1 */
function buildCells(): Int8Array {
  const cells = new Int8Array(GRID * GRID).fill(-1);
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const x = (gx + 0.5) / GRID * 100, y = (gy + 0.5) / GRID * 100;
      let best = -1, bestD = 1e9;
      for (let i = 0; i < REGIONS.length; i++) {
        const r = REGIONS[i];
        // 少し揺らして、国境を自然な形にする
        const wob = (smooth(x * 0.12 + i, y * 0.12) - 0.5) * 6;
        const d = Math.hypot(x - r.x, (y - r.y) * 1.05) + wob;
        if (d < bestD) { bestD = d; best = i; }
      }
      const coast = 15 + (smooth(x * 0.09, y * 0.09) - 0.5) * 9 + (smooth(x * 0.3, y * 0.3) - 0.5) * 3;
      const island = REGIONS[best].terrain === 'islands' ? 9 : coast;
      if (bestD < island && x > 3 && x < 97 && y > 3 && y < 97) cells[gy * GRID + gx] = best;
    }
  }
  return cells;
}

let CELLS: Int8Array | null = null;

export interface MapProps {
  c: Campaign;
  selected: string | null;
  onSelect: (id: string) => void;
}

export function YashimaMap({ c, selected, onSelect }: MapProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const cells = useMemo(() => (CELLS ??= buildCells()), []);
  const owners = REGIONS.map((r) => c.regions[r.id].owner).join(',');
  const inv = c.invasions.map((i) => `${i.from}>${i.to}`).join(',');

  const drawLand = (w: number, h: number, dpr: number): HTMLCanvasElement => {
    const off = document.createElement('canvas');
    off.width = Math.round(w * dpr);
    off.height = Math.round(h * dpr);
    const b = off.getContext('2d')!;
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cw = w / GRID, ch = h / GRID;
      // 陸
      for (let gy = 0; gy < GRID; gy++) {
        for (let gx = 0; gx < GRID; gx++) {
          const i = cells[gy * GRID + gx];
          if (i < 0) continue;
          const r = REGIONS[i];
          const owner = c.regions[r.id].owner;
          const base = FACTIONS[owner].light;
          b.fillStyle = base;
          b.fillRect(gx * cw, gy * ch, cw + 0.6, ch + 0.6);
          const n = noise(gx, gy);
          if (n > 0.6) { b.fillStyle = 'rgba(80,60,30,0.10)'; b.fillRect(gx * cw, gy * ch, cw + 0.6, ch + 0.6); }
        }
      }
      // 和紙の陰り
      b.fillStyle = 'rgba(240,225,190,0.28)';
      for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) if (cells[gy * GRID + gx] >= 0 && noise(gx * 3, gy * 7) > 0.85) b.fillRect(gx * cw, gy * ch, cw, ch);
      // 国境
      for (let gy = 0; gy < GRID; gy++) {
        for (let gx = 0; gx < GRID; gx++) {
          const i = cells[gy * GRID + gx];
          const right = gx + 1 < GRID ? cells[gy * GRID + gx + 1] : -1;
          const down = gy + 1 < GRID ? cells[(gy + 1) * GRID + gx] : -1;
          for (const [j, horiz] of [[right, false], [down, true]] as [number, boolean][]) {
            if (i === j) continue;
            const coast = i < 0 || j < 0;
            const sameOwner = !coast && c.regions[REGIONS[i].id].owner === c.regions[REGIONS[j].id].owner;
            b.fillStyle = coast ? 'rgba(30,20,10,0.75)' : sameOwner ? 'rgba(60,40,20,0.35)' : 'rgba(30,15,10,0.85)';
            const t = coast ? 1.6 : sameOwner ? 0.8 : 1.8;
            if (horiz) b.fillRect(gx * cw, (gy + 1) * ch - t / 2, cw + 0.6, t);
            else b.fillRect((gx + 1) * cw - t / 2, gy * ch, t, ch + 0.6);
          }
        }
      }
    return off;
  };

  useEffect(() => {
    const canvas = ref.current!;
    const box = boxRef.current!;
    let raf = 0;
    let base: HTMLCanvasElement | null = null;
    const draw = (now: number) => {
      const w = box.clientWidth;
      const h = Math.round(w * 1.0);
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = `${w}px`; canvas.style.height = `${h}px`; }
      const g = canvas.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const px = (x: number) => x / 100 * w, py = (y: number) => y / 100 * h;
      // 海
      const sea = g.createLinearGradient(0, 0, 0, h);
      sea.addColorStop(0, '#1d3a4e');
      sea.addColorStop(1, '#14283a');
      g.fillStyle = sea;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(160,210,230,0.12)';
      g.lineWidth = 1;
      for (let i = 0; i < 14; i++) {
        const y0 = (i + 0.5) / 14 * h;
        const off = (now / 90 + i * 37) % 40;
        g.beginPath();
        for (let x = -40 + off; x < w; x += 40) { g.moveTo(x, y0); g.quadraticCurveTo(x + 10, y0 - 4, x + 20, y0); }
        g.stroke();
      }
      // 陸と国境（持ち主が変わった時だけ描き直す）
      if (!base || base.width !== canvas.width) base = drawLand(w, h, dpr);
      g.drawImage(base, 0, 0, w, h);
      // 街道
      g.setLineDash([4, 4]);
      g.strokeStyle = 'rgba(90,60,30,0.55)';
      g.lineWidth = 1.5;
      for (const r of REGIONS) for (const a of r.adj) {
        if (a < r.id) continue;
        const b = regionDef(a);
        g.beginPath(); g.moveTo(px(r.x), py(r.y)); g.lineTo(px(b.x), py(b.y)); g.stroke();
      }
      g.setLineDash([]);
      // 攻めてくる敵の矢印
      for (const iv of c.invasions) {
        const a = regionDef(iv.from), b = regionDef(iv.to);
        const k = (now % 1200) / 1200;
        g.strokeStyle = 'rgba(220,40,30,0.9)';
        g.lineWidth = 4;
        g.beginPath(); g.moveTo(px(a.x), py(a.y)); g.lineTo(px(a.x + (b.x - a.x) * 0.8), py(a.y + (b.y - a.y) * 0.8)); g.stroke();
        const ang = Math.atan2(py(b.y) - py(a.y), px(b.x) - px(a.x));
        const hx = px(a.x + (b.x - a.x) * (0.55 + k * 0.25)), hy = py(a.y + (b.y - a.y) * (0.55 + k * 0.25));
        g.fillStyle = '#ff3a2a';
        g.beginPath(); g.moveTo(hx + Math.cos(ang) * 10, hy + Math.sin(ang) * 10); g.lineTo(hx + Math.cos(ang + 2.5) * 8, hy + Math.sin(ang + 2.5) * 8); g.lineTo(hx + Math.cos(ang - 2.5) * 8, hy + Math.sin(ang - 2.5) * 8); g.fill();
      }
      // 城と名前
      const fs = Math.max(10, Math.round(w / 30));
      for (const r of REGIONS) {
        const st = c.regions[r.id];
        const f = FACTIONS[st.owner];
        const x = px(r.x), y = py(r.y);
        const attackable = canAttack(c, r.id);
        const sel = selected === r.id;
        const s = (r.capital ? 1.25 : 1) * fs * 0.9;
        if (attackable) {
          const pulse = 0.5 + 0.5 * Math.sin(now / 260);
          g.strokeStyle = `rgba(255,80,50,${0.4 + pulse * 0.5})`;
          g.lineWidth = 2.5;
          g.beginPath(); g.arc(x, y, s * 1.25, 0, Math.PI * 2); g.stroke();
        }
        if (sel) {
          g.strokeStyle = '#fff3c0';
          g.lineWidth = 3;
          g.beginPath(); g.arc(x, y, s * 1.45, 0, Math.PI * 2); g.stroke();
        }
        // 城（天守の形）
        g.fillStyle = f.color;
        g.strokeStyle = '#140c06';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x - s * 0.7, y + s * 0.5); g.lineTo(x + s * 0.7, y + s * 0.5); g.lineTo(x + s * 0.55, y);
        g.lineTo(x + s * 0.75, y); g.lineTo(x, y - s * 0.75); g.lineTo(x - s * 0.75, y); g.lineTo(x - s * 0.55, y); g.closePath();
        g.fill(); g.stroke();
        g.fillStyle = '#fff6e0';
        g.font = `bold ${Math.round(s * 0.62)}px serif`;
        g.textAlign = 'center';
        g.fillText(f.mon, x, y + s * 0.4);
        // 名前
        g.font = `bold ${fs}px "Hiragino Mincho ProN", "Yu Mincho", serif`;
        g.lineWidth = 3;
        g.strokeStyle = 'rgba(255,248,230,0.9)';
        g.strokeText(r.name, x, y + s * 0.5 + fs + 1);
        g.fillStyle = '#2a1a0e';
        g.fillText(r.name, x, y + s * 0.5 + fs + 1);
        if (st.taken > 0 && st.owner !== 'akatsuki') {
          g.font = `bold ${Math.round(fs * 0.8)}px sans-serif`;
          g.fillStyle = '#c8382a';
          g.fillText(`砦${st.taken}`, x + s * 1.2, y - s * 0.4);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, owners, inv, selected, c]);

  return (
    <div className="map-box" ref={boxRef}>
      <canvas
        ref={ref}
        className="map-canvas"
        onClick={(e) => {
          const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width * 100, y = (e.clientY - rect.top) / rect.height * 100;
          // いちばん近い城（遠すぎなければ）か、その国のマス
          let best = REGIONS[0], bestD = 1e9;
          for (const r of REGIONS) { const d = Math.hypot(r.x - x, r.y - y); if (d < bestD) { bestD = d; best = r; } }
          if (bestD < 9) { onSelect(best.id); return; }
          const gx = Math.floor(x / 100 * GRID), gy = Math.floor(y / 100 * GRID);
          const i = cells[gy * GRID + gx];
          if (i >= 0) onSelect(REGIONS[i].id);
        }}
      />
    </div>
  );
}
