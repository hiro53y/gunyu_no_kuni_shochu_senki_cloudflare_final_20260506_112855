// 合戦の戦場：ちび武将と兵の集団を左右3段×2列に並べ、出来事に合わせて動かす（Canvas・ドット絵）
// 低い解像度の「世界」に描いてから整数倍に引き伸ばし、文字（打撃の数字・兵数・技名）は画面の解像度で重ねる
import type { Anim, BEvent, Battle, Ground, Kind, Side, Unit } from '../types';
import { fallbackHead, generalSprite, headSprite, shade, soldierSprite, HEAD_SIZE, type Pose } from './sprites';

export interface FieldOptions {
  /** 勢力の色（左・右） */
  colors: { L: string; R: string };
  headUrl: (portrait: string) => string;
  bustUrl: (portrait: string) => string;
}

const MAX_SOLDIERS = 6;

interface Squad {
  uid: number;
  side: Side;
  kind: Kind;
  color: string;
  portrait: string;
  short: string;
  hx: number;
  hy: number;
  x: number;
  y: number;
  pose: Pose;
  poseMs: number;
  flash: number;
  shake: number;
  soldiers: number;
  troops: number;
  maxTroops: number;
  out: boolean;
  kneel: number;
  prep: boolean;
  barrier: boolean;
  guard: boolean;
  buffs: { atk: boolean; def: boolean; int: boolean; spd: boolean };
  tween: { fx: number; fy: number; tx: number; ty: number; t: number; dur: number; done: () => void } | null;
  bob: number;
}

interface Fx {
  /** 残りの時間を進め、まだ続くなら true */
  update(dt: number): boolean;
  draw(g: CanvasRenderingContext2D): void;
}

interface Float { x: number; y: number; text: string; color: string; size: number; t: number; dur: number; rise: number }

type G = CanvasRenderingContext2D;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Field {
  private canvas: HTMLCanvasElement;
  private g: G;
  private world: HTMLCanvasElement;
  private wg: G;
  private bg: HTMLCanvasElement | null = null;
  private bgKey = '';
  private opt: FieldOptions;
  private squads = new Map<number, Squad>();
  private fx: Fx[] = [];
  private floats: Float[] = [];
  private banner: { text: string; color: string; side: Side; t: number; dur: number } | null = null;
  private cutin: { img: HTMLImageElement; side: Side; name: string; color: string; t: number; dur: number } | null = null;
  private flashA = 0;
  private shakeA = 0;
  private raf = 0;
  private last = 0;
  private S = 2;
  private W = 180;
  private H = 120;
  private cssW = 360;
  private cssH = 240;
  private dpr = 1;
  private ground: Ground = 'field';
  private active: number | null = null;
  private targets = new Set<number>();
  private picked: number | null = null;
  private time = 0;
  private bustCache = new Map<string, HTMLImageElement>();
  /** 演出の速さ（1=ふつう、0.5=速い、0=なし） */
  speed = 1;

  constructor(canvas: HTMLCanvasElement, opt: FieldOptions) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d')!;
    this.opt = opt;
    this.world = document.createElement('canvas');
    this.wg = this.world.getContext('2d')!;
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
  }

  // ── 配置 ──

  resize(cssW: number, cssH: number, dpr: number) {
    this.cssW = Math.max(200, cssW);
    this.cssH = Math.max(140, cssH);
    this.dpr = Math.max(1, Math.min(3, dpr));
    this.S = Math.max(2, Math.round(this.cssW / 200));
    this.W = Math.ceil(this.cssW / this.S);
    this.H = Math.ceil(this.cssH / this.S);
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.world.width = this.W;
    this.world.height = this.H;
    this.bg = null;
    for (const s of this.squads.values()) {
      const [x, y] = this.home(s.side, this.rowOf(s), this.slotOf(s));
      s.hx = x; s.hy = y;
      if (!s.tween) { s.x = x; s.y = y; }
    }
  }

  private rows = new Map<number, [0 | 1, 0 | 1 | 2]>();
  private rowOf(s: Squad) { return this.rows.get(s.uid)?.[0] ?? 0; }
  private slotOf(s: Squad) { return this.rows.get(s.uid)?.[1] ?? 0; }

  /** 部隊の居場所（足元） */
  home(side: Side, row: 0 | 1, slot: 0 | 1 | 2): [number, number] {
    const col = side === 'L' ? (row === 1 ? 0.15 : 0.37) : (row === 0 ? 0.63 : 0.85);
    const lanes = [0.4, 0.645, 0.89];
    // 段ごとに少しずらして奥行きを出す
    const skew = (slot - 1) * 0.015 * (side === 'L' ? -1 : 1);
    return [Math.round(this.W * (col + skew)), Math.round(this.H * lanes[slot])];
  }

  setBattle(b: Battle, ground: Ground) {
    this.ground = ground;
    this.bg = null;
    this.squads.clear();
    for (const u of b.units) {
      this.rows.set(u.uid, [u.row, u.slot]);
      const [x, y] = this.home(u.side, u.row, u.slot);
      this.squads.set(u.uid, {
        uid: u.uid, side: u.side, kind: u.kind, color: u.side === 'L' ? this.opt.colors.L : this.opt.colors.R, portrait: u.portrait, short: u.short,
        hx: x, hy: y, x, y, pose: 'idle0', poseMs: 0, flash: 0, shake: 0, soldiers: this.soldierCount(u.troops, u.maxTroops), troops: u.troops, maxTroops: u.maxTroops,
        out: u.out, kneel: u.out ? 1 : 0, prep: !!u.prep, barrier: u.barrier, guard: u.guarding, buffs: { atk: u.buffs.atk > 0, def: u.buffs.def > 0, int: u.buffs.int > 0, spd: u.buffs.spd > 0 },
        tween: null, bob: Math.random() * 1000,
      });
    }
  }

  /** 状態をそのまま映す（演出のあとのずれを直す） */
  sync(b: Battle) {
    for (const u of b.units) {
      const s = this.squads.get(u.uid);
      if (!s) continue;
      this.syncUnit(s, u);
    }
  }

  private syncUnit(s: Squad, u: Unit) {
    s.troops = u.troops;
    s.maxTroops = u.maxTroops;
    s.soldiers = this.soldierCount(u.troops, u.maxTroops);
    s.out = u.out;
    if (u.out) s.kneel = 1;
    s.prep = !!u.prep;
    s.barrier = u.barrier;
    s.guard = u.guarding;
    s.buffs = { atk: u.buffs.atk > 0, def: u.buffs.def > 0, int: u.buffs.int > 0, spd: u.buffs.spd > 0 };
  }

  private soldierCount(troops: number, max: number): number {
    if (troops <= 0) return 0;
    return Math.max(1, Math.min(MAX_SOLDIERS, Math.ceil((MAX_SOLDIERS * troops) / Math.max(1, max))));
  }

  setActive(uid: number | null) { this.active = uid; }
  setTargets(uids: number[], picked: number | null = null) { this.targets = new Set(uids); this.picked = picked; }

  /** 画面上の点にいる部隊 */
  squadAt(cssX: number, cssY: number): number | null {
    const x = cssX / this.S;
    const y = cssY / this.S;
    let best: { uid: number; d: number } | null = null;
    for (const s of this.squads.values()) {
      const back = s.side === 'L' ? -1 : 1;
      const x0 = Math.min(s.hx - 12, s.hx + back * 26), x1 = Math.max(s.hx + 12, s.hx + back * 26);
      if (x < x0 || x > x1 || y < s.hy - 30 || y > s.hy + 4) continue;
      const d = Math.abs(x - s.hx) + Math.abs(y - (s.hy - 12));
      if (!best || d < best.d) best = { uid: s.uid, d };
    }
    return best?.uid ?? null;
  }

  // ── 時間 ──

  private ms(n: number) { return n * this.speed; }

  wait(n: number): Promise<void> {
    const d = this.ms(n);
    if (d <= 0) return Promise.resolve();
    return new Promise((res) => window.setTimeout(res, d));
  }

  private loop(now: number) {
    const dt = this.last ? Math.min(60, now - this.last) : 16;
    this.last = now;
    this.time += dt;
    this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  }

  private update(dt: number) {
    for (const s of this.squads.values()) {
      s.bob += dt;
      if (s.poseMs > 0) { s.poseMs -= dt; if (s.poseMs <= 0) s.pose = 'idle0'; }
      if (s.flash > 0) s.flash = Math.max(0, s.flash - dt);
      if (s.shake > 0) s.shake = Math.max(0, s.shake - dt);
      if (s.tween) {
        const tw = s.tween;
        tw.t += dt;
        const k = Math.min(1, tw.t / Math.max(1, tw.dur));
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        s.x = tw.fx + (tw.tx - tw.fx) * e;
        s.y = tw.fy + (tw.ty - tw.fy) * e;
        if (s.pose === 'run0' || s.pose === 'run1') s.pose = Math.floor(tw.t / 90) % 2 ? 'run1' : 'run0';
        if (k >= 1) { s.tween = null; tw.done(); }
      }
    }
    this.fx = this.fx.filter((f) => f.update(dt));
    for (const f of this.floats) f.t += dt;
    this.floats = this.floats.filter((f) => f.t < f.dur);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.dur) this.banner = null; }
    if (this.cutin) { this.cutin.t += dt; if (this.cutin.t > this.cutin.dur) this.cutin = null; }
    this.flashA = Math.max(0, this.flashA - dt / 260);
    this.shakeA = Math.max(0, this.shakeA - dt / 300);
  }

  // ── 描画 ──

  private draw() {
    const g = this.wg;
    const W = this.W, H = this.H;
    g.imageSmoothingEnabled = false;
    if (!this.bg || this.bgKey !== `${W}x${H}${this.ground}`) { this.bg = this.makeBg(); this.bgKey = `${W}x${H}${this.ground}`; }
    g.drawImage(this.bg, 0, 0);
    // 部隊（奥から）
    const list = [...this.squads.values()].sort((a, b) => a.y - b.y);
    for (const s of list) this.drawSquad(g, s);
    for (const f of this.fx) f.draw(g);
    // 画面へ
    const m = this.g;
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.imageSmoothingEnabled = false;
    const sx = this.shakeA > 0 ? Math.round(rnd(-3, 3) * this.shakeA) : 0;
    const sy = this.shakeA > 0 ? Math.round(rnd(-2, 2) * this.shakeA) : 0;
    m.fillStyle = '#100c0a';
    m.fillRect(0, 0, this.canvas.width, this.canvas.height);
    m.drawImage(this.world, 0, 0, W, H, sx * this.dpr, sy * this.dpr, W * this.S * this.dpr, H * this.S * this.dpr);
    m.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawLabels(m);
    this.drawFloats(m);
    this.drawBanner(m);
    this.drawCutin(m);
    if (this.flashA > 0) { m.fillStyle = `rgba(255,250,235,${this.flashA * 0.75})`; m.fillRect(0, 0, this.cssW, this.cssH); }
  }

  private drawSquad(g: G, s: Squad) {
    const flip = s.side === 'R';
    const out = s.out;
    const shake = s.shake > 0 ? Math.round(Math.sin(s.shake / 18) * 1.5) : 0;
    const bob = !out && !s.tween && (s.pose === 'idle0' || s.pose === 'idle1') ? (Math.floor(s.bob / 420) % 2) : 0;
    const x = Math.round(s.x) + shake;
    const y = Math.round(s.y);
    // 手番・標的の印（足元）
    if (!out && this.active === s.uid) {
      g.fillStyle = `rgba(255,214,90,${0.35 + 0.25 * Math.sin(this.time / 120)})`;
      g.beginPath(); g.ellipse(x, y, 13, 3.5, 0, 0, Math.PI * 2); g.fill();
    }
    if (s.prep && !out) this.drawCircle(g, x, y);
    // 影
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath(); g.ellipse(x - (flip ? -10 : 10), y, 20, 3, 0, 0, Math.PI * 2); g.fill();
    // 兵（後ろから）
    const pose: Pose = out ? 'idle0' : s.pose === 'special' ? 'atk1' : s.pose;
    const sol = soldierSprite(s.kind, s.color, pose === 'hurt' ? 'hurt' : pose);
    const offs = [[-9, -5], [-9, 3], [-16, -6], [-16, 2], [-23, -5], [-23, 3]];
    const n = s.soldiers;
    for (let i = n - 1; i >= 0; i--) {
      const [ox, oy] = offs[i];
      const sx = x + (flip ? -ox : ox);
      const sy = y + oy + (i % 2 && bob ? 0 : bob);
      this.blit(g, sol, sx - Math.floor(sol.width / 2), sy - sol.height, flip, out ? 0.4 : 1);
    }
    // 武将
    const sp = generalSprite(s.kind, s.color, out ? 'idle0' : s.pose);
    const gx = x - sp.footX * (flip ? -1 : 1) - (flip ? sp.w : 0);
    const gy = y - sp.h + (out ? 6 : bob);
    const alpha = out ? 0.55 : 1;
    if (out) {
      // 膝をつく（下半身を隠して低く）
      g.save();
      g.beginPath(); g.rect(gx - 2, gy, sp.w + 4, sp.h - 6); g.clip();
      this.blit(g, sp.canvas, gx, gy, flip, alpha);
      g.restore();
    } else this.blit(g, sp.canvas, gx, gy, flip, alpha);
    // 顔
    const head = headSprite(this.opt.headUrl(s.portrait), () => {}) ?? fallbackHead(s.color);
    const hx = flip ? gx + sp.w - sp.headX - HEAD_SIZE : gx + sp.headX;
    const hy = gy + sp.headY;
    g.globalAlpha = alpha;
    g.drawImage(head, hx, hy);
    g.globalAlpha = 1;
    if (s.flash > 0) {
      g.globalAlpha = Math.min(1, s.flash / 120) * 0.8;
      g.fillStyle = '#ffffff';
      g.fillRect(gx + 2, gy, sp.w - 4, sp.h);
      g.globalAlpha = 1;
    }
    // 結界・ガード・付与の印
    if (s.barrier && !out) {
      g.strokeStyle = `rgba(200,170,255,${0.55 + 0.25 * Math.sin(this.time / 160)})`;
      g.lineWidth = 1;
      g.beginPath(); g.ellipse(x, y - 13, 15, 16, 0, 0, Math.PI * 2); g.stroke();
    }
    if (s.guard && !out) {
      const bx = x + (flip ? -13 : 9);
      g.fillStyle = '#6a8ab0'; g.fillRect(bx, y - 18, 5, 6);
      g.fillStyle = '#c8daf0'; g.fillRect(bx + 1, y - 17, 3, 4);
    }
    if (!out) {
      const marks: [boolean, string][] = [[s.buffs.atk, '#ff5040'], [s.buffs.def, '#4a90ff'], [s.buffs.int, '#e050e0'], [s.buffs.spd, '#40d070']];
      let i = 0;
      for (const [on, col] of marks) {
        if (!on) continue;
        const ax = hx + (flip ? -4 : HEAD_SIZE + 1) + (flip ? -i * 3 : i * 3);
        g.fillStyle = col;
        g.fillRect(ax + 1, hy + 2, 1, 4); g.fillRect(ax, hy + 3, 3, 1); g.fillRect(ax + 1, hy + 1, 1, 1);
        i++;
      }
    }
    // 狙える部隊の照準
    if (this.targets.has(s.uid) && !out) {
      const t = this.time / 140;
      const k = 2 + Math.round(Math.sin(t) * 1.5);
      const picked = this.picked === s.uid;
      g.fillStyle = picked ? '#ffe060' : '#ff6050';
      const x0 = x - 13 - k, x1 = x + 12 + k, y0 = y - 30 - k, y1 = y + 2 + k;
      for (const [cx, cy, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]] as const) {
        g.fillRect(cx, cy, 4 * dx || 1, 1); g.fillRect(cx, cy, 1, 4 * dy || 1);
        if (dx < 0) g.fillRect(cx - 3, cy, 4, 1);
        if (dy < 0) g.fillRect(cx, cy - 3, 1, 4);
      }
    }
    if (this.active === s.uid && !out) {
      const ty = gy - 6 + Math.round(Math.sin(this.time / 160) * 1.5);
      g.fillStyle = '#ffd650';
      g.fillRect(x - 2, ty, 5, 1); g.fillRect(x - 1, ty + 1, 3, 1); g.fillRect(x, ty + 2, 1, 1);
    }
  }

  private drawCircle(g: G, x: number, y: number) {
    const t = this.time / 400;
    g.strokeStyle = `rgba(190,120,255,${0.6 + 0.3 * Math.sin(t * 3)})`;
    g.lineWidth = 1;
    g.beginPath(); g.ellipse(x, y, 16, 4.5, 0, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 6; i++) {
      const a = t + (i * Math.PI) / 3;
      g.fillStyle = '#e0c0ff';
      g.fillRect(Math.round(x + Math.cos(a) * 16), Math.round(y + Math.sin(a) * 4.5), 1, 1);
    }
    g.fillStyle = `rgba(190,120,255,${0.25 + 0.15 * Math.sin(t * 4)})`;
    g.fillRect(x - 10, y - 26, 1, 20); g.fillRect(x + 9, y - 22, 1, 16); g.fillRect(x - 2, y - 30, 1, 22);
  }

  private blit(g: G, img: HTMLCanvasElement, x: number, y: number, flip: boolean, alpha: number) {
    g.globalAlpha = alpha;
    if (flip) {
      g.save();
      g.translate(x + img.width, y);
      g.scale(-1, 1);
      g.drawImage(img, 0, 0);
      g.restore();
    } else g.drawImage(img, x, y);
    g.globalAlpha = 1;
  }

  /** 兵数と名前（画面の解像度で） */
  private drawLabels(m: G) {
    m.textAlign = 'center';
    m.textBaseline = 'top';
    m.font = `bold ${Math.max(9, Math.round(this.S * 4.6))}px system-ui, sans-serif`;
    for (const s of this.squads.values()) {
      const cx = s.hx * this.S;
      const cy = (s.hy + 3) * this.S;
      const text = s.out ? '壊滅' : `${s.short} ${Math.max(0, Math.round(s.troops))}`;
      m.lineWidth = 3;
      m.strokeStyle = 'rgba(0,0,0,0.85)';
      m.strokeText(text, cx, cy);
      m.fillStyle = s.out ? '#ff8a7a' : s.side === 'L' ? '#bfe0ff' : '#ffd0c8';
      m.fillText(text, cx, cy);
    }
  }

  private drawFloats(m: G) {
    m.textAlign = 'center';
    m.textBaseline = 'middle';
    for (const f of this.floats) {
      const k = f.t / f.dur;
      const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.6 : k < 0.2 ? 1.2 - ((k - 0.12) / 0.08) * 0.2 : 1;
      const a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      const x = f.x * this.S;
      const y = f.y * this.S - f.rise * k;
      m.globalAlpha = a;
      m.font = `900 ${Math.round(f.size * pop)}px system-ui, sans-serif`;
      m.lineWidth = 4;
      m.strokeStyle = 'rgba(0,0,0,0.9)';
      m.strokeText(f.text, x, y);
      m.fillStyle = f.color;
      m.fillText(f.text, x, y);
      m.globalAlpha = 1;
    }
  }

  private drawBanner(m: G) {
    const b = this.banner;
    if (!b) return;
    const k = b.t / b.dur;
    const slide = k < 0.18 ? 1 - k / 0.18 : 0;
    const a = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
    const y = this.cssH * 0.13;
    const h = Math.max(26, this.cssH * 0.13);
    m.globalAlpha = a;
    const grad = m.createLinearGradient(0, 0, this.cssW, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.2, 'rgba(0,0,0,0.78)');
    grad.addColorStop(0.8, 'rgba(0,0,0,0.78)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    m.fillStyle = grad;
    m.fillRect(0, y - h / 2, this.cssW, h);
    m.fillStyle = b.side === 'L' ? '#4a90e8' : '#e0574a';
    m.fillRect(this.cssW * 0.1, y - h / 2, this.cssW * 0.8, 2);
    m.fillRect(this.cssW * 0.1, y + h / 2 - 2, this.cssW * 0.8, 2);
    const dx = (b.side === 'L' ? -1 : 1) * slide * this.cssW * 0.4;
    m.textAlign = 'center';
    m.textBaseline = 'middle';
    m.font = `900 ${Math.round(h * 0.62)}px 'Hiragino Mincho ProN','Yu Mincho',serif`;
    m.lineWidth = 4;
    m.strokeStyle = '#000';
    m.strokeText(b.text, this.cssW / 2 + dx, y + 1);
    m.fillStyle = b.color;
    m.fillText(b.text, this.cssW / 2 + dx, y + 1);
    m.globalAlpha = 1;
  }

  private drawCutin(m: G) {
    const c = this.cutin;
    if (!c || !c.img.complete || !c.img.naturalWidth) return;
    const k = c.t / c.dur;
    const inK = Math.min(1, k / 0.2);
    const outK = k > 0.82 ? (k - 0.82) / 0.18 : 0;
    const bandH = this.cssH * 0.62;
    const y0 = this.cssH * 0.5 - bandH / 2;
    m.globalAlpha = Math.min(1, inK * 1.2) * (1 - outK);
    m.fillStyle = 'rgba(0,0,0,0.72)';
    m.fillRect(0, y0, this.cssW, bandH);
    m.fillStyle = c.side === 'L' ? '#4a90e8' : '#e0574a';
    m.fillRect(0, y0, this.cssW, 3);
    m.fillRect(0, y0 + bandH - 3, this.cssW, 3);
    // 立ち絵が横から滑り込む
    const ih = bandH - 6;
    const iw = (c.img.naturalWidth / c.img.naturalHeight) * ih;
    const ease = 1 - Math.pow(1 - inK, 3);
    const from = c.side === 'L' ? -iw : this.cssW;
    const to = c.side === 'L' ? this.cssW * 0.04 : this.cssW * 0.96 - iw;
    const x = from + (to - from) * ease + (c.side === 'L' ? 1 : -1) * k * 12;
    m.save();
    m.beginPath(); m.rect(0, y0 + 3, this.cssW, bandH - 6); m.clip();
    m.drawImage(c.img, x, y0 + 3, iw, ih);
    m.restore();
    m.textAlign = c.side === 'L' ? 'right' : 'left';
    m.textBaseline = 'middle';
    m.font = `900 ${Math.round(bandH * 0.17)}px 'Hiragino Mincho ProN','Yu Mincho',serif`;
    const tx = c.side === 'L' ? this.cssW * 0.95 : this.cssW * 0.05;
    m.lineWidth = 5;
    m.strokeStyle = '#000';
    m.strokeText(c.name, tx, this.cssH * 0.5);
    m.fillStyle = c.color;
    m.fillText(c.name, tx, this.cssH * 0.5);
    m.globalAlpha = 1;
  }

  // ── 背景 ──

  private makeBg(): HTMLCanvasElement {
    const W = this.W, H = this.H;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    let seed = 7;
    const rr = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const horizon = Math.round(H * 0.2);
    // 空
    const sky = this.ground === 'castle' ? ['#3a3448', '#6a5a6a'] : this.ground === 'town' ? ['#2a3a5a', '#8a7a6a'] : ['#2a4a6a', '#9ab0a0'];
    const sg = g.createLinearGradient(0, 0, 0, horizon);
    sg.addColorStop(0, sky[0]); sg.addColorStop(1, sky[1]);
    g.fillStyle = sg; g.fillRect(0, 0, W, horizon);
    // 遠くの山
    g.fillStyle = this.ground === 'castle' ? '#4a4050' : '#4a6070';
    for (let x = 0; x < W; x++) {
      const h = Math.round(horizon - 6 - Math.abs(Math.sin(x / 23) * 8) - Math.abs(Math.sin(x / 9 + 1) * 3));
      g.fillRect(x, h, 1, horizon - h);
    }
    // 地面
    const grd = this.ground === 'castle' ? ['#6a5a44', '#5a4a38'] : this.ground === 'town' ? ['#7a6a50', '#6a5a42'] : ['#5a7a3a', '#4a6a30'];
    const gg = g.createLinearGradient(0, horizon, 0, H);
    gg.addColorStop(0, grd[0]); gg.addColorStop(1, grd[1]);
    g.fillStyle = gg; g.fillRect(0, horizon, W, H - horizon);
    // 草・小石
    for (let i = 0; i < W * H * 0.04; i++) {
      const x = Math.floor(rr() * W), y = horizon + Math.floor(rr() * (H - horizon));
      g.fillStyle = this.ground === 'field' ? (rr() < 0.5 ? '#6e9048' : '#3e5a28') : (rr() < 0.5 ? '#8a7a60' : '#4a3e30');
      g.fillRect(x, y, 1, rr() < 0.3 ? 2 : 1);
    }
    if (this.ground === 'castle') {
      // 右の奥に石垣と城門
      const wy = horizon - 4;
      g.fillStyle = '#7a7480'; g.fillRect(Math.round(W * 0.55), wy, Math.round(W * 0.45), 12);
      for (let x = Math.round(W * 0.55); x < W; x += 6) for (let y = wy; y < wy + 12; y += 3) { g.fillStyle = (x + y) % 2 ? '#8a8490' : '#6a6470'; g.fillRect(x + ((y / 3) % 2) * 3, y, 5, 2); }
      g.fillStyle = '#2a2024'; g.fillRect(Math.round(W * 0.74), wy + 3, 10, 9);
      g.fillStyle = '#e8e0d0'; g.fillRect(Math.round(W * 0.7), wy - 10, 18, 10);
      g.fillStyle = '#3a3440'; g.fillRect(Math.round(W * 0.68), wy - 13, 22, 3); g.fillRect(Math.round(W * 0.72), wy - 18, 14, 3);
    } else if (this.ground === 'town') {
      for (let x = 2; x < W; x += 22) {
        const hy = horizon - 7;
        g.fillStyle = '#5a4a3a'; g.fillRect(x, hy, 18, 8);
        g.fillStyle = '#3a3036'; g.fillRect(x - 2, hy - 3, 22, 3);
        g.fillStyle = '#d8c8a0'; g.fillRect(x + 3, hy + 2, 3, 3); g.fillRect(x + 11, hy + 2, 3, 3);
      }
      g.fillStyle = 'rgba(160,140,110,0.35)'; g.fillRect(0, Math.round(H * 0.55), W, Math.round(H * 0.18));
    } else {
      // 川
      g.fillStyle = 'rgba(90,140,170,0.5)';
      for (let x = 0; x < W; x++) g.fillRect(x, horizon + 4 + Math.round(Math.sin(x / 15) * 2), 1, 3);
    }
    // 旗（幟）：左右の陣の後ろ
    const banner = (x: number, col: string) => {
      g.fillStyle = '#3a2a1a'; g.fillRect(x, horizon - 14, 1, 22);
      g.fillStyle = col; g.fillRect(x + 1, horizon - 13, 4, 12);
      g.fillStyle = shade(col, 1.4); g.fillRect(x + 2, horizon - 11, 2, 2);
    };
    for (let i = 0; i < 4; i++) { banner(4 + i * 9, this.opt.colors.L); banner(W - 9 - i * 9, this.opt.colors.R); }
    return c;
  }

  // ── 演出の部品 ──

  private sq(uid: number) { return this.squads.get(uid) ?? null; }

  /** 部隊の真ん中あたり（打撃の当たる所） */
  center(uid: number): [number, number] {
    const s = this.sq(uid);
    if (!s) return [this.W / 2, this.H / 2];
    return [s.x + (s.side === 'L' ? -4 : 4), s.y - 12];
  }

  setPose(uid: number, pose: Pose, ms = 0) {
    const s = this.sq(uid);
    if (!s || s.out) return;
    s.pose = pose;
    s.poseMs = ms;
  }

  moveTo(uid: number, x: number, y: number, ms: number): Promise<void> {
    const s = this.sq(uid);
    const d = this.ms(ms);
    if (!s) return Promise.resolve();
    if (d <= 0) { s.x = x; s.y = y; return Promise.resolve(); }
    return new Promise((done) => {
      s.pose = 'run0';
      s.poseMs = 0;
      s.tween = { fx: s.x, fy: s.y, tx: x, ty: y, t: 0, dur: d, done: () => { s.pose = 'idle0'; done(); } };
    });
  }

  /** 標的の前まで駆け寄る */
  charge(uid: number, target: number, ms = 280): Promise<void> {
    const s = this.sq(uid), t = this.sq(target);
    if (!s || !t) return Promise.resolve();
    const dir = s.side === 'L' ? -1 : 1;
    return this.moveTo(uid, t.x + dir * 15, t.y + 1, ms);
  }

  back(uid: number, ms = 220): Promise<void> {
    const s = this.sq(uid);
    if (!s || (s.x === s.hx && s.y === s.hy)) return Promise.resolve();
    if (s.out) { s.x = s.hx; s.y = s.hy; return Promise.resolve(); }
    return this.moveTo(uid, s.hx, s.hy, ms);
  }

  flash(uid: number, ms = 160) { const s = this.sq(uid); if (s) { s.flash = this.ms(ms) || 1; s.shake = this.ms(ms * 1.4); } }

  screenFlash(a = 1) { if (this.speed > 0) this.flashA = Math.max(this.flashA, a); }
  screenShake(a = 1) { if (this.speed > 0) this.shakeA = Math.max(this.shakeA, a); }

  float(uid: number, text: string, color: string, size = 16, opts: { dy?: number; dur?: number } = {}) {
    if (this.speed <= 0) return;
    const [x, y] = this.center(uid);
    this.floats.push({ x: x + rnd(-2, 2), y: y + (opts.dy ?? -6), text, color, size, t: 0, dur: this.ms(opts.dur ?? 900) || 1, rise: 22 });
  }

  showBanner(text: string, color: string, side: Side, ms = 900) {
    if (this.speed <= 0) return;
    this.banner = { text, color, side, t: 0, dur: this.ms(ms) };
  }

  showCutin(portrait: string, side: Side, name: string, color: string, ms = 900): Promise<void> {
    if (this.speed <= 0) return Promise.resolve();
    let img = this.bustCache.get(portrait);
    if (!img) { img = new Image(); img.src = this.opt.bustUrl(portrait); this.bustCache.set(portrait, img); }
    this.cutin = { img, side, name, color, t: 0, dur: this.ms(ms) };
    return this.wait(ms * 0.8);
  }

  /** 兵数を映す（倒れる兵の演出つき） */
  setTroops(uid: number, troops: number) {
    const s = this.sq(uid);
    if (!s) return;
    const before = s.soldiers;
    s.troops = troops;
    s.soldiers = this.soldierCount(troops, s.maxTroops);
    const lost = before - s.soldiers;
    if (lost > 0 && this.speed > 0) {
      const flip = s.side === 'R';
      const offs = [[-9, -5], [-9, 3], [-16, -6], [-16, 2], [-23, -5], [-23, 3]];
      for (let i = s.soldiers; i < before; i++) {
        const [ox, oy] = offs[i];
        this.fx.push(new FallingSoldier(soldierSprite(s.kind, s.color, 'hurt'), s.x + (flip ? -ox : ox), s.y + oy, flip, this.ms(700)));
      }
    }
  }

  setOut(uid: number) {
    const s = this.sq(uid);
    if (!s) return;
    this.setTroops(uid, 0);
    s.out = true;
    s.kneel = 1;
    s.prep = false;
    s.guard = false;
    s.tween = null;
    s.x = s.hx; s.y = s.hy;
  }

  setFlags(uid: number, f: Partial<Pick<Squad, 'prep' | 'barrier' | 'guard'>> & { buffs?: Squad['buffs'] }) {
    const s = this.sq(uid);
    if (!s) return;
    Object.assign(s, f);
  }

  /** 飛び道具（着いたら解決） */
  shoot(from: number, to: number, kind: Anim, delay = 0): Promise<void> {
    if (this.speed <= 0) return Promise.resolve();
    const [fx, fy] = this.center(from);
    const [tx, ty] = this.center(to);
    const dur = this.ms(kind === 'gun' ? 160 : kind === 'arrow' ? 300 : kind === 'shuriken' ? 240 : 320);
    return new Promise((done) => {
      const start = () => this.fx.push(new Projectile(kind, fx + (from && this.sq(from)?.side === 'L' ? 8 : -8), fy - 2, tx, ty, dur, () => {
        this.fx.push(new Burst(tx, ty, kind === 'gun' ? '#ffd060' : kind === 'magic' ? '#c090ff' : '#ffffff', kind === 'gun' ? 7 : 5, this.ms(220)));
        done();
      }));
      if (delay > 0) window.setTimeout(start, this.ms(delay)); else start();
      if (kind === 'gun') this.fx.push(new Burst(fx + (this.sq(from)?.side === 'L' ? 12 : -12), fy - 2, '#fff0a0', 4, this.ms(140)));
    });
  }

  slash(uid: number, color = '#ffffff', big = false) {
    if (this.speed <= 0) return;
    const [x, y] = this.center(uid);
    const side = this.sq(uid)?.side ?? 'R';
    this.fx.push(new Slash(x, y, side === 'R' ? 1 : -1, color, big, this.ms(260)));
    this.fx.push(new Dust(x, y + 12, this.ms(500)));
  }

  /** 矢の雨（敵の側の全体） */
  rain(side: Side, color = '#e8d0a0'): Promise<void> {
    if (this.speed <= 0) return Promise.resolve();
    const list = [...this.squads.values()].filter((s) => s.side === side && !s.out);
    for (let i = 0; i < 28; i++) {
      const s = list[i % Math.max(1, list.length)];
      if (!s) break;
      this.fx.push(new FallingArrow(s.x + rnd(-24, 24) * (side === 'L' ? 1 : -1), s.y - rnd(0, 10), this.ms(rnd(200, 520)), color));
    }
    return this.wait(560);
  }

  /** 式神（紙の鳥）の群れ */
  birds(from: number, targets: number[], color: string): Promise<void> {
    if (this.speed <= 0) return Promise.resolve();
    const [fx, fy] = this.center(from);
    for (const t of targets) {
      const [tx, ty] = this.center(t);
      for (let i = 0; i < 4; i++) this.fx.push(new Bird(fx, fy - 6, tx + rnd(-6, 6), ty + rnd(-6, 4), this.ms(380 + i * 70), color));
    }
    return this.wait(460);
  }

  aura(uid: number, color: string, kind: 'heal' | 'buff' | 'guard' | 'shout') {
    if (this.speed <= 0) return;
    const [x, y] = this.center(uid);
    if (kind === 'heal') for (let i = 0; i < 10; i++) this.fx.push(new Sparkle(x + rnd(-14, 14), y + rnd(-6, 12), color, this.ms(rnd(400, 800))));
    else if (kind === 'shout') this.fx.push(new Ring(x, y, color, this.ms(420)));
    else this.fx.push(new Ring(x, y + 8, color, this.ms(360)));
  }

  arrowMark(uid: number, good: boolean, color: string) {
    if (this.speed <= 0) return;
    const [x, y] = this.center(uid);
    this.fx.push(new BuffArrow(x + rnd(-6, 6), y - 6, good, color, this.ms(700)));
  }

  shield(uid: number) {
    if (this.speed <= 0) return;
    const [x, y] = this.center(uid);
    this.fx.push(new Hex(x, y, this.ms(380)));
  }

  darkSlash(uid: number) {
    if (this.speed <= 0) return;
    const [x, y] = this.center(uid);
    this.fx.push(new Slash(x, y, 1, '#a080ff', true, this.ms(420)));
    this.fx.push(new Slash(x, y, -1, '#6040c0', true, this.ms(420)));
  }

  shatter(uid: number) {
    if (this.speed <= 0) return;
    const [x, y] = this.center(uid);
    for (let i = 0; i < 12; i++) this.fx.push(new Sparkle(x + rnd(-12, 12), y + rnd(0, 14), '#c090ff', this.ms(rnd(300, 600))));
  }

  /** 守りの足軽が割って入る */
  async cover(guardUid: number, coveredUid: number) {
    const gq = this.sq(guardUid), t = this.sq(coveredUid);
    if (!gq || !t || this.speed <= 0) return;
    const dir = t.side === 'L' ? 1 : -1;
    await this.moveTo(guardUid, t.x + dir * 10, t.y + 2, 150);
    this.shield(guardUid);
  }
}

// ── 効果 ──

class Projectile implements Fx {
  private t = 0;
  constructor(private kind: Anim, private fx: number, private fy: number, private tx: number, private ty: number, private dur: number, private onHit: () => void) {}
  update(dt: number) {
    this.t += dt;
    if (this.t >= this.dur) { this.onHit(); return false; }
    return true;
  }
  draw(g: G) {
    const k = Math.min(1, this.t / this.dur);
    const arc = this.kind === 'arrow' ? -Math.sin(k * Math.PI) * 14 : this.kind === 'magic' ? -Math.sin(k * Math.PI) * 6 : 0;
    const x = this.fx + (this.tx - this.fx) * k;
    const y = this.fy + (this.ty - this.fy) * k + arc;
    const dir = this.tx > this.fx ? 1 : -1;
    switch (this.kind) {
      case 'arrow': {
        const prevK = Math.max(0, k - 0.06);
        const px = this.fx + (this.tx - this.fx) * prevK;
        const py = this.fy + (this.ty - this.fy) * prevK - Math.sin(prevK * Math.PI) * 14;
        g.strokeStyle = '#e8d0a0'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(Math.round(px), Math.round(py)); g.lineTo(Math.round(x), Math.round(y)); g.stroke();
        g.fillStyle = '#ffffff'; g.fillRect(Math.round(x), Math.round(y), 1, 1);
        break;
      }
      case 'gun':
        g.fillStyle = '#fff4a0'; g.fillRect(Math.round(x), Math.round(y), 2, 1);
        g.fillStyle = 'rgba(255,240,160,0.5)'; g.fillRect(Math.round(x - dir * 3), Math.round(y), 3, 1);
        break;
      case 'shuriken': {
        const a = Math.floor(this.t / 40) % 2;
        g.fillStyle = '#c8d0e0';
        if (a) { g.fillRect(Math.round(x) - 1, Math.round(y), 3, 1); g.fillRect(Math.round(x), Math.round(y) - 1, 1, 3); }
        else { g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 1, 1); g.fillRect(Math.round(x) + 1, Math.round(y) - 1, 1, 1); g.fillRect(Math.round(x) - 1, Math.round(y) + 1, 1, 1); g.fillRect(Math.round(x) + 1, Math.round(y) + 1, 1, 1); g.fillRect(Math.round(x), Math.round(y), 1, 1); }
        break;
      }
      default:
        g.fillStyle = 'rgba(200,150,255,0.5)'; g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
        g.fillStyle = '#f0e0ff'; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
    }
  }
}

class Burst implements Fx {
  private t = 0;
  constructor(private x: number, private y: number, private color: string, private size: number, private dur: number) {}
  update(dt: number) { this.t += dt; return this.t < this.dur; }
  draw(g: G) {
    const k = this.t / this.dur;
    const r = Math.round(this.size * (0.4 + k));
    g.globalAlpha = 1 - k;
    g.fillStyle = this.color;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.fillRect(Math.round(this.x + Math.cos(a) * r), Math.round(this.y + Math.sin(a) * r), 1, 1);
    }
    g.fillRect(Math.round(this.x) - 1, Math.round(this.y) - 1, 3, 3);
    g.globalAlpha = 1;
  }
}

class Slash implements Fx {
  private t = 0;
  constructor(private x: number, private y: number, private dir: number, private color: string, private big: boolean, private dur: number) {}
  update(dt: number) { this.t += dt; return this.t < this.dur; }
  draw(g: G) {
    const k = this.t / this.dur;
    const R = this.big ? 16 : 11;
    g.globalAlpha = 1 - k * 0.8;
    g.fillStyle = this.color;
    const n = Math.round(14 * Math.min(1, k * 2.5));
    for (let i = 0; i < n; i++) {
      const a = -1.1 + (i / 14) * 2.2;
      const x = this.x + this.dir * Math.cos(a) * R * 0.5;
      const y = this.y + Math.sin(a) * R;
      g.fillRect(Math.round(x), Math.round(y), this.big ? 2 : 1, 1);
    }
    g.globalAlpha = 1;
  }
}

class Dust implements Fx {
  private t = 0;
  private parts: { x: number; y: number; vx: number; vy: number }[] = [];
  constructor(x: number, y: number, private dur: number) {
    for (let i = 0; i < 6; i++) this.parts.push({ x: x + rnd(-6, 6), y, vx: rnd(-0.02, 0.02), vy: rnd(-0.03, -0.01) });
  }
  update(dt: number) {
    this.t += dt;
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; }
    return this.t < this.dur;
  }
  draw(g: G) {
    g.fillStyle = `rgba(200,180,150,${0.6 * (1 - this.t / this.dur)})`;
    for (const p of this.parts) g.fillRect(Math.round(p.x), Math.round(p.y), 2, 1);
  }
}

class FallingSoldier implements Fx {
  private t = 0;
  constructor(private img: HTMLCanvasElement, private x: number, private y: number, private flip: boolean, private dur: number) {}
  update(dt: number) { this.t += dt; return this.t < this.dur; }
  draw(g: G) {
    const k = Math.min(1, this.t / (this.dur * 0.35));
    g.save();
    g.globalAlpha = 1 - Math.max(0, (this.t / this.dur - 0.5) * 2);
    g.translate(Math.round(this.x), Math.round(this.y));
    g.rotate((this.flip ? 1 : -1) * k * (Math.PI / 2));
    if (this.flip) g.scale(-1, 1);
    g.drawImage(this.img, -Math.floor(this.img.width / 2), -this.img.height);
    g.restore();
    g.globalAlpha = 1;
  }
}

class FallingArrow implements Fx {
  private t = 0;
  constructor(private x: number, private y: number, private delay: number, private color: string) {}
  update(dt: number) { this.t += dt; return this.t < this.delay + 260; }
  draw(g: G) {
    if (this.t < this.delay) return;
    const k = Math.min(1, (this.t - this.delay) / 200);
    const y = this.y - 40 + 40 * k;
    g.fillStyle = this.color;
    g.fillRect(Math.round(this.x + 6 - 6 * k), Math.round(y) - 4, 1, 4);
    if (k >= 1) { g.fillStyle = '#ffffff'; g.fillRect(Math.round(this.x), Math.round(this.y), 1, 1); }
  }
}

class Bird implements Fx {
  private t = 0;
  constructor(private fx: number, private fy: number, private tx: number, private ty: number, private dur: number, private color: string) {}
  update(dt: number) { this.t += dt; return this.t < this.dur + 120; }
  draw(g: G) {
    const k = Math.min(1, this.t / this.dur);
    const x = this.fx + (this.tx - this.fx) * k;
    const y = this.fy + (this.ty - this.fy) * k - Math.sin(k * Math.PI) * 18 + Math.sin(this.t / 40) * 2;
    if (k >= 1) {
      g.fillStyle = this.color;
      g.globalAlpha = 1 - (this.t - this.dur) / 120;
      g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
      g.globalAlpha = 1;
      return;
    }
    const wing = Math.floor(this.t / 60) % 2;
    g.fillStyle = '#f8f4ff';
    g.fillRect(Math.round(x), Math.round(y), 2, 1);
    g.fillRect(Math.round(x) - 1, Math.round(y) - wing, 1, 1);
    g.fillRect(Math.round(x) + 2, Math.round(y) - wing, 1, 1);
    g.fillStyle = this.color;
    g.fillRect(Math.round(x), Math.round(y) + 1, 1, 1);
  }
}

class Sparkle implements Fx {
  private t = 0;
  constructor(private x: number, private y: number, private color: string, private dur: number) {}
  update(dt: number) { this.t += dt; return this.t < this.dur; }
  draw(g: G) {
    const k = this.t / this.dur;
    const y = this.y - k * 14;
    g.globalAlpha = 1 - k;
    g.fillStyle = this.color;
    g.fillRect(Math.round(this.x), Math.round(y) - 1, 1, 3);
    g.fillRect(Math.round(this.x) - 1, Math.round(y), 3, 1);
    g.globalAlpha = 1;
  }
}

class Ring implements Fx {
  private t = 0;
  constructor(private x: number, private y: number, private color: string, private dur: number) {}
  update(dt: number) { this.t += dt; return this.t < this.dur; }
  draw(g: G) {
    const k = this.t / this.dur;
    g.globalAlpha = 1 - k;
    g.strokeStyle = this.color;
    g.lineWidth = 1;
    g.beginPath(); g.ellipse(this.x, this.y, 6 + k * 18, 2 + k * 6, 0, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 1;
  }
}

class BuffArrow implements Fx {
  private t = 0;
  constructor(private x: number, private y: number, private good: boolean, private color: string, private dur: number) {}
  update(dt: number) { this.t += dt; return this.t < this.dur; }
  draw(g: G) {
    const k = this.t / this.dur;
    const y = Math.round(this.y + (this.good ? -k * 12 : k * 10));
    const x = Math.round(this.x);
    g.globalAlpha = 1 - k * 0.7;
    g.fillStyle = this.color;
    if (this.good) { g.fillRect(x, y, 1, 5); g.fillRect(x - 1, y + 1, 3, 1); g.fillRect(x - 2, y + 2, 5, 1); }
    else { g.fillRect(x, y, 1, 5); g.fillRect(x - 1, y + 3, 3, 1); g.fillRect(x - 2, y + 2, 5, 1); }
    g.globalAlpha = 1;
  }
}

class Hex implements Fx {
  private t = 0;
  constructor(private x: number, private y: number, private dur: number) {}
  update(dt: number) { this.t += dt; return this.t < this.dur; }
  draw(g: G) {
    const k = this.t / this.dur;
    g.globalAlpha = 1 - k;
    g.strokeStyle = '#c8e0ff';
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = (i * Math.PI) / 3;
      const px = this.x + Math.cos(a) * (10 + k * 4), py = this.y + Math.sin(a) * (12 + k * 4);
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.stroke();
    g.globalAlpha = 1;
  }
}

// ── 出来事の再生 ──

export interface PlayHooks {
  /** 出来事を画面の表示（欄・時間・戦果）に反映する */
  apply: (e: BEvent) => void;
  se: (name: string) => void;
  unit: (uid: number) => Unit | null;
}

const SE_OF: Partial<Record<Anim, string>> = { melee: 'slash', spear: 'slash', charge: 'slash', claw: 'hit', arrow: 'arrow', gun: 'gun', shuriken: 'throw', magic: 'magic', shiki: 'magic', volley: 'arrow', heal: 'revive', buff: 'lvup', guard: 'equip', shout: 'roar' };

/** 出来事の列を順に演出する */
export async function playEvents(field: Field, events: BEvent[], hooks: PlayHooks, alive: () => boolean) {
  let away: number | null = null;
  let lastSkill: { uid: number; anim: Anim; color: string } | null = null;
  const comeBack = async () => {
    if (away !== null) { const u = away; away = null; await field.back(u); }
  };
  for (let i = 0; i < events.length; i++) {
    if (!alive()) return;
    const e = events[i];
    switch (e.k) {
      case 'turn':
        await comeBack();
        hooks.apply(e);
        field.setActive(e.uid);
        await field.wait(90);
        break;
      case 'skill': {
        await comeBack();
        hooks.apply(e);
        const u = hooks.unit(e.uid);
        const side = u?.side ?? 'L';
        lastSkill = { uid: e.uid, anim: e.anim, color: e.color };
        const se = SE_OF[e.anim];
        if (e.special && u) {
          field.screenFlash(0.8);
          hooks.se('crit');
          await field.showCutin(u.portrait, side, e.name, e.color, 950);
          field.setPose(e.uid, 'special', 600);
        } else field.showBanner(e.name, e.color, side, 820);
        const foes = e.targets.filter((t) => hooks.unit(t)?.side !== side);
        switch (e.anim) {
          case 'melee':
          case 'spear':
          case 'charge':
          case 'claw':
            if (foes.length) {
              await field.charge(e.uid, foes[0], e.anim === 'charge' ? 230 : 280);
              away = e.uid;
              field.setPose(e.uid, 'atk0', 90);
              await field.wait(90);
              field.setPose(e.uid, 'atk1', 260);
              if (se) hooks.se(se);
              for (const t of foes) field.slash(t, e.color, e.special);
              await field.wait(90);
            }
            break;
          case 'arrow':
          case 'gun':
          case 'shuriken':
          case 'magic':
            field.setPose(e.uid, 'atk0', 140);
            await field.wait(110);
            field.setPose(e.uid, 'atk1', 300);
            if (se) hooks.se(se);
            if (foes.length) {
              const shots = foes.map((t, k) => field.shoot(e.uid, t, e.anim, k * 60));
              await Promise.race(shots);
            }
            break;
          case 'volley':
            field.setPose(e.uid, 'atk1', 500);
            if (se) hooks.se(se);
            await field.rain(side === 'L' ? 'R' : 'L', e.color);
            break;
          case 'shiki':
            field.setPose(e.uid, 'atk1', 500);
            if (se) hooks.se(se);
            await field.birds(e.uid, foes, e.color);
            break;
          default:
            field.setPose(e.uid, 'atk0', 360);
            if (se) hooks.se(se);
            field.aura(e.uid, e.color, e.anim === 'heal' ? 'heal' : e.anim === 'guard' ? 'guard' : e.anim === 'shout' ? 'shout' : 'buff');
            await field.wait(220);
        }
        break;
      }
      case 'hit': {
        const covered = e.guardBy;
        if (covered !== undefined && covered !== e.uid) {
          await field.cover(e.uid, covered);
          field.float(e.uid, 'かばう', '#a8d0ff', 13, { dy: -18 });
          hooks.se('equip');
        }
        hooks.apply(e);
        field.flash(e.uid, e.big ? 220 : 160);
        if (e.n > 0) field.float(e.uid, `-${e.n}`, e.big ? '#ffd040' : '#ffffff', e.big ? 22 : 17);
        if (e.big) field.screenShake(0.8);
        hooks.se(e.big ? 'crit' : 'hit');
        field.setTroops(e.uid, hooks.unit(e.uid)?.troops ?? 0);
        await field.wait(e.big ? 220 : 160);
        if (covered !== undefined && covered !== e.uid) field.back(e.uid, 180);
        break;
      }
      case 'counter':
        hooks.apply(e);
        field.flash(e.uid, 140);
        field.float(e.uid, `-${e.n}`, '#ff9a6a', 13, { dy: -2 });
        hooks.se('hurt');
        field.setTroops(e.uid, hooks.unit(e.uid)?.troops ?? 0);
        await field.wait(150);
        break;
      case 'heal':
        hooks.apply(e);
        field.aura(e.uid, '#90ffb0', 'heal');
        field.float(e.uid, `+${e.n}`, '#8ef08a', 15);
        field.setTroops(e.uid, hooks.unit(e.uid)?.troops ?? 0);
        await field.wait(120);
        break;
      case 'buff': {
        hooks.apply(e);
        const col = e.stat === 'atk' ? '#ff6050' : e.stat === 'def' ? '#5a9aff' : e.stat === 'int' ? '#e060e0' : e.stat === 'spd' ? '#50e080' : e.stat === 'guard' ? '#a8c8ff' : e.stat === 'barrier' ? '#d0b0ff' : '#ffb0a0';
        field.arrowMark(e.uid, e.good, col);
        field.float(e.uid, e.text, e.good ? col : '#ff9a8a', 11, { dy: -20, dur: 800 });
        const u = hooks.unit(e.uid);
        if (u) field.setFlags(e.uid, { guard: u.guarding, barrier: u.barrier, buffs: { atk: u.buffs.atk > 0, def: u.buffs.def > 0, int: u.buffs.int > 0, spd: u.buffs.spd > 0 } });
        await field.wait(70);
        break;
      }
      case 'prep':
        await comeBack();
        hooks.apply(e);
        field.setPose(e.uid, 'atk0', 500);
        field.setFlags(e.uid, { prep: true });
        field.showBanner(`${e.name}の準備`, '#d0b0ff', hooks.unit(e.uid)?.side ?? 'L', 700);
        hooks.se('magic');
        await field.wait(380);
        break;
      case 'cancel':
        hooks.apply(e);
        field.setFlags(e.uid, { prep: false });
        field.shatter(e.uid);
        field.float(e.uid, '準備崩し！', '#d0a0ff', 14, { dy: -20 });
        hooks.se('break');
        await field.wait(220);
        break;
      case 'block':
        hooks.apply(e);
        field.setFlags(e.uid, { barrier: false });
        field.shield(e.uid);
        field.float(e.uid, '防いだ', '#c8e0ff', 14);
        hooks.se('equip');
        await field.wait(200);
        break;
      case 'miss':
        hooks.apply(e);
        field.float(e.uid, '失敗', '#c0b0a0', 13);
        hooks.se('miss');
        await field.wait(180);
        break;
      case 'kill':
        hooks.apply(e);
        field.darkSlash(e.uid);
        field.float(e.uid, '暗殺！', '#c0a0ff', 20, { dy: -16 });
        hooks.se('crit');
        field.screenShake(1);
        await field.wait(320);
        break;
      case 'down':
        hooks.apply(e);
        field.setOut(e.uid);
        field.float(e.uid, '壊滅', '#ff6a5a', 22, { dy: -18, dur: 1100 });
        hooks.se('death');
        field.screenShake(0.6);
        await field.wait(380);
        break;
      case 'wait':
        await comeBack();
        hooks.apply(e);
        field.float(e.uid, '待機', '#c8c0b0', 12, { dy: -22, dur: 700 });
        await field.wait(160);
        break;
      case 'gauge':
      case 'tick':
        hooks.apply(e);
        break;
      case 'end':
        await comeBack();
        hooks.apply(e);
        field.setActive(null);
        break;
      default:
        hooks.apply(e);
    }
  }
  await comeBack();
  void lastSkill;
}
