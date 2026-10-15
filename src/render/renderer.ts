// 迷宮の描画（Canvas 2D）：地形・道具・罠・キャラ・演出・ミニマップ。出来事を順に再生して動きを見せる
import { monDef } from '../content/monsters';
import { at, visibleFrom } from '../engine/geo';
import { charmIs } from '../engine/core';
import { DX, DY, T_FLOOR, T_HARD, T_LAVA, T_WALL, T_WATER, type GameEvent, type Run } from '../engine/types';
import { itemSprite, monsterSprite, playerSprite, sprite, tokenSprite, trapSprite } from './sprites';
import { FACTIONS } from '../content/sengoku';
import { floorTile, liquidTile, wallTile } from './tiles';
import { playSe } from '../audio/sound';
import { BANDS } from '../content/world';

interface Ent {
  uid: number;
  id: string;
  x: number; y: number;
  fx: number; fy: number; tx: number; ty: number;
  t0: number; dur: number;
  dir: number;
  lunge: { dir: number; t0: number } | null;
  flash: number;
  dying: number;
  alpha: number;
}

interface Popup { x: number; y: number; text: string; color: string; t0: number; big?: boolean }
interface Proj { fx: number; fy: number; tx: number; ty: number; t0: number; dur: number; kind: string }
interface Beam { fx: number; fy: number; tx: number; ty: number; t0: number; color: string }
interface Boom { x: number; y: number; r: number; t0: number }
interface Cutin { name: string; color: string; who: string; portrait: string | null; t0: number; enemy: boolean }

type Step = { dur: number; start: () => void };

export interface ViewOptions {
  fast: boolean;
}

export class Renderer {
  private g: CanvasRenderingContext2D;
  private run: Run | null = null;
  private ents = new Map<number, Ent>();
  private steps: Step[] = [];
  private stepEnd = 0;
  private popups: Popup[] = [];
  private projs: Proj[] = [];
  private beams: Beam[] = [];
  private booms: Boom[] = [];
  private flashColor = '';
  private flashT0 = 0;
  private fadeT0 = 0;
  private waiters: (() => void)[] = [];
  private raf = 0;
  private timer: number | null = null;
  private cssW = 360;
  private cssH = 400;
  private dpr = 1;
  tile = 40;
  /** ミニマップ：0=非表示、1=重ねて表示、2=全面 */
  mini: 0 | 1 | 2 = 1;
  opts: ViewOptions = { fast: false };
  private quick = false;
  private banner: { title: string; sub: string; t0: number; boss: boolean; town: boolean } | null = null;
  private cutin: Cutin | null = null;
  private shakeT0 = 0;
  private shakeDur = 0;
  private shakePow = 0;

  private shake(t0: number, dur: number, pow: number) {
    this.shakeT0 = t0;
    this.shakeDur = dur;
    this.shakePow = pow;
  }

  private camX = 0;
  private origin = { x: 0, y: 0 };

  /** 画面上の点 → 迷宮のマス */
  tileAtPoint(px: number, py: number): { x: number; y: number } | null {
    if (!this.run) return null;
    const x = Math.floor((px - this.origin.x) / this.tile), y = Math.floor((py - this.origin.y) / this.tile);
    if (x < 0 || y < 0 || x >= this.run.floor.w || y >= this.run.floor.h) return null;
    return { x, y };
  }
  private camY = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.g = canvas.getContext('2d')!;
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    if (this.timer !== null) window.clearInterval(this.timer);
    this.waiters.forEach((w) => w());
    this.waiters = [];
  }

  resize(w: number, h: number) {
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.cssW = w;
    this.cssH = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    // 横に9マス見えるように
    this.tile = Math.max(28, Math.floor(w / 9));
  }

  get busy() {
    return this.steps.length > 0 || performance.now() < this.stepEnd;
  }

  /** 状態をそのまま映す（読み込み・階の移動のあと） */
  sync(run: Run) {
    this.run = run;
    const keep = new Map<number, Ent>();
    const make = (uid: number, id: string, x: number, y: number, dir: number): Ent => {
      const old = this.ents.get(uid);
      return { uid, id, x, y, fx: x, fy: y, tx: x, ty: y, t0: 0, dur: 0, dir, lunge: null, flash: old?.flash ?? 0, dying: 0, alpha: 1 };
    };
    keep.set(0, make(0, 'player', run.player.x, run.player.y, run.player.dir));
    for (const m of run.monsters) keep.set(m.uid, make(m.uid, m.id, m.x, m.y, m.dir));
    this.ents = keep;
    this.camX = run.player.x;
    this.camY = run.player.y;
  }

  /** 1手分の出来事を再生する。終わったら解決 */
  play(run: Run, events: GameEvent[], quick = false): Promise<void> {
    this.run = run;
    this.quick = quick;
    // 画面が隠れている間は動きを省く（描画が止まっても手番が止まらないように）
    if (typeof document !== 'undefined' && document.hidden) {
      this.steps = [];
      this.sync(run);
      return Promise.resolve();
    }
    // 新しく現れた敵（まだ表に無い）は、その場に置いておく
    for (const m of run.monsters) {
      if (!this.ents.has(m.uid)) {
        const first = events.find((e) => e.k === 'move' && e.uid === m.uid) as Extract<GameEvent, { k: 'move' }> | undefined;
        const x = first ? first.fx : m.x, y = first ? first.fy : m.y;
        this.ents.set(m.uid, { uid: m.uid, id: m.id, x, y, fx: x, fy: y, tx: x, ty: y, t0: 0, dur: 0, dir: m.dir, lunge: null, flash: 0, dying: 0, alpha: 1 });
      }
    }
    this.buildSteps(events);
    this.steps.push({ dur: 0, start: () => this.finishSync() });
    // 描画（rAF）が間引かれても手番が進むよう、時計でも進める
    if (this.timer === null) {
      this.timer = window.setInterval(() => {
        this.advance(performance.now());
        if (!this.steps.length && !this.waiters.length && this.timer !== null) { window.clearInterval(this.timer); this.timer = null; }
      }, 40);
    }
    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }

  private speed(ms: number) {
    let k = this.opts.fast ? 0.55 : 1;
    if (this.quick) k *= 0.4;
    return ms * k;
  }

  private buildSteps(events: GameEvent[]) {
    let moves: Extract<GameEvent, { k: 'move' }>[] = [];
    const flushMoves = () => {
      if (!moves.length) return;
      const group = moves;
      moves = [];
      this.steps.push({
        dur: this.speed(110),
        start: () => {
          const now = performance.now();
          for (const e of group) {
            const ent = this.ents.get(e.uid);
            if (!ent) continue;
            ent.fx = e.fx; ent.fy = e.fy; ent.tx = e.tx; ent.ty = e.ty; ent.t0 = now; ent.dur = this.speed(110);
            const d = DIR_OF(e.tx - e.fx, e.ty - e.fy);
            if (d >= 0) ent.dir = d;
          }
        },
      });
    };
    for (const e of events) {
      if (e.k === 'move') {
        if (moves.some((m) => m.uid === e.uid)) flushMoves();
        moves.push(e);
        continue;
      }
      flushMoves();
      this.steps.push(this.stepFor(e));
    }
    flushMoves();
  }

  private stepFor(e: GameEvent): Step {
    const now = () => performance.now();
    switch (e.k) {
      case 'atk':
        return { dur: this.speed(120), start: () => { const ent = this.ents.get(e.uid); if (ent) { ent.lunge = { dir: e.dir, t0: now() }; ent.dir = e.dir; } } };
      case 'hit':
        return {
          dur: this.speed(90),
          start: () => {
            const ent = this.ents.get(e.uid);
            if (ent) ent.flash = now();
            this.popups.push({ x: e.x, y: e.y, text: String(e.n), color: e.uid === 0 ? '#ff6a5a' : e.crit ? '#ffe14a' : '#ffffff', t0: now(), big: e.crit });
            const big = e.uid === 0 && this.run ? e.n >= this.run.player.maxHp * 0.2 : !!e.crit;
            if (big) this.shake(now(), 260, e.crit ? 4 : 6);
          },
        };
      case 'heal':
        return { dur: 0, start: () => this.popups.push({ x: e.x, y: e.y, text: `+${e.n}`, color: '#7dff9a', t0: now() }) };
      case 'miss':
        return { dur: this.speed(60), start: () => this.popups.push({ x: e.x, y: e.y, text: 'ミス', color: '#c8d0e0', t0: now() }) };
      case 'popup':
        return { dur: 0, start: () => this.popups.push({ x: e.x, y: e.y, text: e.text, color: e.color, t0: now() }) };
      case 'die':
        return { dur: this.speed(220), start: () => { const ent = this.ents.get(e.uid); if (ent) ent.dying = now(); } };
      case 'proj': {
        const dist = Math.max(Math.abs(e.tx - e.fx), Math.abs(e.ty - e.fy));
        const dur = this.speed(Math.max(90, dist * 38));
        return { dur, start: () => this.projs.push({ fx: e.fx, fy: e.fy, tx: e.tx, ty: e.ty, t0: now(), dur, kind: e.sprite }) };
      }
      case 'beam':
        return { dur: this.speed(200), start: () => this.beams.push({ fx: e.fx, fy: e.fy, tx: e.tx, ty: e.ty, t0: now(), color: e.color }) };
      case 'boom':
        return { dur: this.speed(300), start: () => this.booms.push({ x: e.x, y: e.y, r: e.r, t0: now() }) };
      case 'warp':
        return {
          dur: this.speed(160),
          start: () => {
            const ent = this.ents.get(e.uid);
            if (ent) { ent.x = ent.fx = ent.tx = e.x; ent.y = ent.fy = ent.ty = e.y; ent.dur = 0; ent.flash = now(); }
          },
        };
      case 'flash':
        return { dur: this.speed(120), start: () => { this.flashColor = e.color; this.flashT0 = now(); } };
      case 'lvup':
        return { dur: 0, start: () => { const p = this.ents.get(0); if (p) this.popups.push({ x: p.tx, y: p.ty, text: 'レベルアップ！', color: '#ffe14a', t0: now(), big: true }); } };
      case 'se':
        return { dur: 0, start: () => playSe(e.name) };
      case 'skill':
        return {
          dur: this.speed(560),
          start: () => {
            const run = this.run;
            const g = run && e.gen ? run.gens[e.gen] : null;
            const portrait = e.gen === 'g_saku' ? 'akatsuki_saku' : g?.portrait ?? null;
            const enemy = !!g && !g.ally;
            this.cutin = { name: e.name, color: e.color, who: e.gen === 'g_saku' ? '風間 朔' : g?.name ?? '', portrait, t0: now(), enemy };
            this.shake(now(), 240, 3);
          },
        };
      case 'floor':
        return {
          dur: this.speed(260),
          start: () => {
            if (this.run) {
              this.sync(this.run);
              const f = this.run.floor;
              const name = f.kind === 'boss' ? '天守' : f.kind === 'field' ? '野戦' : BANDS[f.band].name;
              const title = f.kind === 'field' ? '合戦' : this.run.mode === 'hunt' ? `巣 ${this.run.floorNo}F` : `${this.run.floorNo}F`;
              this.banner = { title, sub: name, t0: now(), boss: f.kind === 'boss' || f.kind === 'field', town: false };
              if (f.kind === 'boss') this.shake(now(), 900, 7);
            }
            this.fadeT0 = now();
          },
        };
      default:
        return { dur: 0, start: () => undefined };
    }
  }

  private finishSync() {
    if (!this.run) return;
    const run = this.run;
    // 表と状態をそろえる（倒れた敵を消し、位置を合わせる）
    const alive = new Set(run.monsters.map((m) => m.uid));
    for (const uid of [...this.ents.keys()]) if (uid !== 0 && !alive.has(uid)) this.ents.delete(uid);
    for (const m of run.monsters) {
      const ent = this.ents.get(m.uid);
      if (!ent) continue;
      ent.id = m.id;
      if (ent.tx !== m.x || ent.ty !== m.y) { ent.x = ent.fx = ent.tx = m.x; ent.y = ent.fy = ent.ty = m.y; ent.dur = 0; }
      ent.dying = 0;
    }
    const p = this.ents.get(0);
    if (p) {
      if (p.tx !== run.player.x || p.ty !== run.player.y) { p.x = p.fx = p.tx = run.player.x; p.y = p.fy = p.ty = run.player.y; p.dur = 0; }
      p.dir = run.player.dir;
      p.dying = run.end?.kind === 'dead' ? p.dying : 0;
    }
  }

  private advance(now: number) {
    while (now >= this.stepEnd && this.steps.length) {
      const s = this.steps.shift()!;
      s.start();
      this.stepEnd = now + s.dur;
    }
    if (!this.steps.length && now >= this.stepEnd && this.waiters.length) {
      const list = this.waiters;
      this.waiters = [];
      list.forEach((w) => w());
    }
  }

  private loop(now: number) {
    this.raf = requestAnimationFrame(this.loop);
    this.advance(now);
    this.draw(now);
  }

  // ── 描画 ──

  private entPos(ent: Ent, now: number) {
    if (ent.dur > 0 && now < ent.t0 + ent.dur) {
      const k = Math.max(0, (now - ent.t0) / ent.dur);
      const e = k * (2 - k);
      ent.x = ent.fx + (ent.tx - ent.fx) * e;
      ent.y = ent.fy + (ent.ty - ent.fy) * e;
    } else {
      ent.x = ent.tx;
      ent.y = ent.ty;
    }
    let ox = 0, oy = 0;
    if (ent.lunge) {
      const k = (now - ent.lunge.t0) / this.speed(120);
      if (k >= 1) ent.lunge = null;
      else {
        const s = Math.sin(k * Math.PI) * 0.32;
        ox = DX[ent.lunge.dir] * s;
        oy = DY[ent.lunge.dir] * s;
      }
    }
    return { x: ent.x + ox, y: ent.y + oy };
  }

  private draw(now: number) {
    const g = this.g;
    const run = this.run;
    // 画面の揺れ
    const sk = this.shakeDur ? 1 - (now - this.shakeT0) / this.shakeDur : 0;
    const sx0 = sk > 0 ? (Math.sin(now * 0.09) * this.shakePow * sk) : 0;
    const sy0 = sk > 0 ? (Math.cos(now * 0.11) * this.shakePow * sk) : 0;
    g.setTransform(this.dpr, 0, 0, this.dpr, sx0 * this.dpr, sy0 * this.dpr);
    g.fillStyle = '#07060a';
    g.fillRect(0, 0, this.cssW, this.cssH);
    if (!run) return;
    const f = run.floor;
    const T = this.tile;
    const player = this.ents.get(0);
    if (player) {
      const pp = this.entPos(player, now);
      // カメラはなめらかに追う
      this.camX += (pp.x - this.camX) * 0.35;
      this.camY += (pp.y - this.camY) * 0.35;
      if (Math.abs(pp.x - this.camX) > 6 || Math.abs(pp.y - this.camY) > 6) { this.camX = pp.x; this.camY = pp.y; }
    }
    const originX = this.cssW / 2 - (this.camX + 0.5) * T;
    const originY = this.cssH / 2 - (this.camY + 0.5) * T;
    this.origin = { x: originX, y: originY };
    const x0 = Math.max(0, Math.floor(-originX / T) - 1), x1 = Math.min(f.w - 1, Math.ceil((this.cssW - originX) / T));
    const y0 = Math.max(0, Math.floor(-originY / T) - 1), y1 = Math.min(f.h - 1, Math.ceil((this.cssH - originY) / T) + 1);
    const vis = visibleFrom(f, run.player.x, run.player.y);
    const frame = Math.floor(now / 350) % 4;
    g.imageSmoothingEnabled = true;
    // 地形
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = at(f, x, y);
        if (!f.seen[i]) continue;
        const sx = originX + x * T, sy = originY + y * T;
        const t = f.tiles[i];
        let img: HTMLCanvasElement;
        if (t === T_FLOOR) img = floorTile(f.band, (x * 7 + y * 13) % 4);
        else if (t === T_WATER) img = liquidTile('water', frame);
        else if (t === T_LAVA) img = liquidTile('lava', frame);
        else {
          const below = y + 1 < f.h ? f.tiles[at(f, x, y + 1)] : T_HARD;
          img = wallTile(f.band, below !== T_WALL && below !== T_HARD, (x * 3 + y) % 3);
        }
        g.drawImage(img, sx, sy, T + 0.5, T + 0.5);
      }
    }
    const seeAll = charmIs(run, 'c_toushi') || !!f.clairvoyant;
    const trapsVisible = charmIs(run, 'c_wanami');
    // 階段・罠・道具
    if (f.stairs && f.seen[at(f, f.stairs.x, f.stairs.y)]) {
      const s = sprite('stairs');
      if (s) g.drawImage(s, originX + f.stairs.x * T, originY + f.stairs.y * T, T, T);
    }
    for (const trap of f.traps) {
      if (!trap.found && !trapsVisible) continue;
      if (!f.seen[at(f, trap.x, trap.y)]) continue;
      const s = trapSprite(trap.id);
      if (s) { g.globalAlpha = trap.found ? 1 : 0.6; g.drawImage(s, originX + trap.x * T + T * 0.08, originY + trap.y * T + T * 0.1, T * 0.84, T * 0.84); g.globalAlpha = 1; }
    }
    for (const fi of f.items) {
      const i = at(f, fi.x, fi.y);
      if (!vis.has(i) && !seeAll) continue;
      const s = itemSprite(fi.item.id);
      if (!s) continue;
      const sx = originX + fi.x * T, sy = originY + fi.y * T;
      g.globalAlpha = vis.has(i) ? 1 : 0.55;
      g.drawImage(s, sx + T * 0.12, sy + T * 0.12, T * 0.76, T * 0.76);
      g.globalAlpha = 1;
      if (fi.item.shop) {
        g.fillStyle = '#ffd84a';
        g.beginPath(); g.arc(sx + T * 0.82, sy + T * 0.2, T * 0.1, 0, Math.PI * 2); g.fill();
      }
    }
    // 見えていないマスを暗く
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = at(f, x, y);
        if (!f.seen[i] || vis.has(i)) continue;
        g.fillStyle = 'rgba(4,4,10,0.55)';
        g.fillRect(originX + x * T, originY + y * T, T + 0.5, T + 0.5);
      }
    }
    // キャラ（下にいる者を後に描く）
    const ents = [...this.ents.values()].sort((a, b) => a.ty - b.ty);
    for (const ent of ents) {
      const isPlayer = ent.uid === 0;
      const m = isPlayer ? null : run.monsters.find((x) => x.uid === ent.uid) ?? null;
      const pos = this.entPos(ent, now);
      const tileIndex = at(f, Math.round(pos.x), Math.round(pos.y));
      const visible = isPlayer || vis.has(tileIndex) || (m?.ally ?? false) || seeAll || ent.dying > 0;
      if (!visible) continue;
      let alpha = 1;
      if (ent.dying) {
        const k = (now - ent.dying) / this.speed(220);
        if (k >= 1 && !isPlayer) continue;
        alpha = Math.max(0, 1 - k);
      }
      const def = isPlayer ? null : MON_SAFE(ent.id);
      if (def?.invisible && !seeAll) alpha *= 0.28;
      if (!vis.has(tileIndex) && !isPlayer) alpha *= 0.6;
      if (m?.disguise) {
        const s = itemSprite(m.disguise);
        if (s) g.drawImage(s, originX + pos.x * T + T * 0.12, originY + pos.y * T + T * 0.12, T * 0.76, T * 0.76);
        continue;
      }
      const gen = m?.gen ? run.gens[m.gen] : null;
      const isToken = isPlayer || !!gen;
      const factionColor = FACTIONS[run.faction]?.color ?? '#6a5a4a';
      let img: HTMLCanvasElement | null;
      let size: number;
      if (isPlayer) { img = playerSprite(); size = T * 1.0; }
      else if (gen) {
        const boss = !m!.ally && m!.gen === run.bossGen;
        img = tokenSprite(gen.portrait, m!.ally ? '#c84a4a' : FACTIONS[gen.faction]?.color ?? factionColor, m!.ally ? 'ally' : boss ? 'boss' : 'enemy');
        size = boss ? T * 1.22 : T * 0.98;
      } else {
        img = monsterSprite(ent.id, m?.ally ? '#c84a4a' : factionColor, m?.ally ? '暁' : FACTIONS[run.faction]?.mon ?? '兵');
        size = ent.id === 'boss' ? T * 1.6 : T * 1.12;
      }
      const sx = originX + (pos.x + 0.5) * T - size / 2;
      const sy = isToken ? originY + (pos.y + 0.5) * T - size / 2 - T * 0.06 : originY + (pos.y + 1) * T - size - T * 0.04;
      // 影
      g.fillStyle = 'rgba(0,0,0,0.32)';
      g.beginPath(); g.ellipse(originX + (pos.x + 0.5) * T, originY + (pos.y + 0.9) * T, T * 0.32, T * 0.11, 0, 0, Math.PI * 2); g.fill();
      if (m?.ally) {
        g.strokeStyle = '#6dff9a';
        g.lineWidth = 2;
        g.beginPath(); g.ellipse(originX + (pos.x + 0.5) * T, originY + (pos.y + 0.9) * T, T * 0.36, T * 0.13, 0, 0, Math.PI * 2); g.stroke();
      }
      g.globalAlpha = alpha;
      const flashing = now - ent.flash < 140;
      if (img && isToken) {
        if (flashing) g.filter = 'brightness(2.4)';
        g.drawImage(img, sx, sy, size, size);
        g.filter = 'none';
        // 向きの印
        const ang = Math.atan2(DY[ent.dir], DX[ent.dir]);
        const cxT = sx + size / 2, cyT = sy + size / 2, rr = size * 0.5;
        g.fillStyle = isPlayer ? '#ffe08a' : m?.ally ? '#ffb0a0' : '#ff5a4a';
        g.strokeStyle = '#120c08';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(cxT + Math.cos(ang) * (rr + 5), cyT + Math.sin(ang) * (rr + 5));
        g.lineTo(cxT + Math.cos(ang + 0.32) * (rr - 3), cyT + Math.sin(ang + 0.32) * (rr - 3));
        g.lineTo(cxT + Math.cos(ang - 0.32) * (rr - 3), cyT + Math.sin(ang - 0.32) * (rr - 3));
        g.closePath(); g.fill(); g.stroke();
      } else if (img) {
        const flip = !isPlayer && run.player.x > (m?.x ?? ent.tx);
        if (flashing) g.filter = 'brightness(2.6)';
        if (flip) {
          g.save();
          g.translate(sx + size, sy);
          g.scale(-1, 1);
          g.drawImage(img, 0, 0, size, size);
          g.restore();
        } else {
          g.drawImage(img, sx, sy, size, size);
        }
        g.filter = 'none';
      }
      g.globalAlpha = 1;
      // HPの棒・状態の印
      if (m && !ent.dying && vis.has(tileIndex)) {
        if (m.hp < m.maxHp) {
          const w = T * 0.7, bx = originX + (pos.x + 0.15) * T, by = originY + pos.y * T - T * 0.08;
          g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(bx - 1, by - 1, w + 2, 5);
          g.fillStyle = m.ally ? '#6dff9a' : '#ff5a4a'; g.fillRect(bx, by, w * Math.max(0, m.hp / m.maxHp), 3);
        }
        const mark = m.st.sleep || !m.awake ? 'Zz' : m.st.paralyze ? '…' : m.st.confuse ? '?' : m.st.sealed ? '封' : m.role === 'keeper' && m.angry ? '怒' : '';
        if (mark) {
          g.font = `bold ${Math.round(T * 0.3)}px sans-serif`;
          g.fillStyle = '#fff';
          g.strokeStyle = '#000';
          g.lineWidth = 3;
          g.strokeText(mark, originX + (pos.x + 0.72) * T, originY + (pos.y + 0.12) * T);
          g.fillText(mark, originX + (pos.x + 0.72) * T, originY + (pos.y + 0.12) * T);
        }
      }
    }
    // 暗闇の階：周りだけ明るい
    if (f.dark || f.fog) {
      const p = this.ents.get(0);
      if (p) {
        const cx = originX + (p.x + 0.5) * T, cy = originY + (p.y + 0.5) * T;
        const grad = g.createRadialGradient(cx, cy, T * (f.fog ? 1.6 : 1), cx, cy, T * (f.fog ? 3.4 : 2.4));
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, f.fog ? 'rgba(180,190,200,0.55)' : 'rgba(0,0,0,0.75)');
        g.fillStyle = grad;
        g.fillRect(0, 0, this.cssW, this.cssH);
      }
    }
    this.drawEffects(now, originX, originY);
    if (this.mini && !this.bannerOn(now)) this.drawMinimap(now);
    this.drawBanner(now);
    this.drawCutin(now);
    // 階の移動のフェード
    const fade = 1 - (now - this.fadeT0) / this.speed(420);
    if (fade > 0) { g.fillStyle = `rgba(0,0,0,${fade})`; g.fillRect(0, 0, this.cssW, this.cssH); }
    const fl = 1 - (now - this.flashT0) / 260;
    if (fl > 0 && this.flashColor) { g.globalAlpha = fl * 0.45; g.fillStyle = this.flashColor; g.fillRect(0, 0, this.cssW, this.cssH); g.globalAlpha = 1; }
  }

  private drawEffects(now: number, ox: number, oy: number) {
    const g = this.g;
    const T = this.tile;
    const cx = (x: number) => ox + (x + 0.5) * T;
    const cy = (y: number) => oy + (y + 0.5) * T;
    this.projs = this.projs.filter((p) => now - p.t0 < p.dur);
    for (const p of this.projs) {
      const k = Math.min(1, (now - p.t0) / p.dur);
      const x = cx(p.fx + (p.tx - p.fx) * k), y = cy(p.fy + (p.ty - p.fy) * k) - Math.sin(k * Math.PI) * T * 0.25;
      if (p.kind === 'stone') {
        g.fillStyle = '#8a8070';
        g.beginPath(); g.arc(x, y, T * 0.12, 0, Math.PI * 2); g.fill();
      } else if (p.kind === 'arrow') {
        const ang = Math.atan2(p.ty - p.fy, p.tx - p.fx);
        g.save(); g.translate(x, y); g.rotate(ang);
        g.strokeStyle = '#e8d0a0'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(-T * 0.3, 0); g.lineTo(T * 0.3, 0); g.stroke();
        g.fillStyle = '#d0d8e0'; g.beginPath(); g.moveTo(T * 0.38, 0); g.lineTo(T * 0.24, -5); g.lineTo(T * 0.24, 5); g.fill();
        g.restore();
      } else {
        const s = sprite(`item-${p.kind}`) ?? sprite(KIND_SPRITE[p.kind] ?? 'item-support');
        if (s) g.drawImage(s, x - T * 0.3, y - T * 0.3, T * 0.6, T * 0.6);
      }
    }
    this.beams = this.beams.filter((b) => now - b.t0 < this.speed(240));
    for (const b of this.beams) {
      const k = (now - b.t0) / this.speed(240);
      g.globalAlpha = 1 - k;
      g.strokeStyle = b.color;
      g.lineWidth = T * 0.22 * (1 - k * 0.5);
      g.lineCap = 'round';
      g.shadowColor = b.color; g.shadowBlur = 12;
      g.beginPath(); g.moveTo(cx(b.fx), cy(b.fy)); g.lineTo(cx(b.tx), cy(b.ty)); g.stroke();
      g.shadowBlur = 0;
      g.globalAlpha = 1;
    }
    this.booms = this.booms.filter((b) => now - b.t0 < this.speed(380));
    for (const b of this.booms) {
      const k = (now - b.t0) / this.speed(380);
      const r = T * (0.5 + b.r + 0.4) * k + T * 0.3;
      const grad = g.createRadialGradient(cx(b.x), cy(b.y), 0, cx(b.x), cy(b.y), r);
      grad.addColorStop(0, `rgba(255,240,160,${1 - k})`);
      grad.addColorStop(0.5, `rgba(255,120,40,${0.8 * (1 - k)})`);
      grad.addColorStop(1, 'rgba(120,20,0,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(cx(b.x), cy(b.y), r, 0, Math.PI * 2); g.fill();
    }
    this.popups = this.popups.filter((p) => now - p.t0 < 800);
    for (const p of this.popups) {
      const k = (now - p.t0) / 800;
      const size = Math.round(T * (p.big ? 0.42 : 0.34));
      g.font = `900 ${size}px "M PLUS Rounded 1c", system-ui, sans-serif`;
      g.textAlign = 'center';
      g.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const x = cx(p.x), y = cy(p.y) - T * 0.45 - k * T * 0.5;
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.85)';
      g.strokeText(p.text, x, y);
      g.fillStyle = p.color;
      g.fillText(p.text, x, y);
      g.globalAlpha = 1;
      g.textAlign = 'left';
    }
  }

  private bannerOn(now: number) {
    return !!this.banner && now - this.banner.t0 < 1700;
  }

  /** 階に着いた時の題字 */
  private drawBanner(now: number) {
    const b = this.banner;
    if (!b) return;
    const t = now - b.t0;
    const life = b.boss ? 2600 : 1700;
    if (t > life) { this.banner = null; return; }
    const g = this.g;
    const a = t < 250 ? t / 250 : t > life - 400 ? (life - t) / 400 : 1;
    const cy = this.cssH * 0.38;
    g.save();
    g.globalAlpha = a * 0.75;
    const grad = g.createLinearGradient(0, cy - 50, 0, cy + 50);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, b.boss ? 'rgba(70,0,0,0.95)' : 'rgba(10,8,20,0.9)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, cy - 50, this.cssW, 100);
    g.globalAlpha = a;
    g.textAlign = 'center';
    g.font = `900 ${Math.round(this.tile * 0.95)}px "Hiragino Mincho ProN", "Yu Mincho", serif`;
    g.lineWidth = 5;
    g.strokeStyle = '#000';
    g.fillStyle = b.boss ? '#ff6a4a' : b.town ? '#ffe6a0' : '#f3ece0';
    const slide = (1 - Math.min(1, t / 400)) * 20;
    g.strokeText(b.title, this.cssW / 2 - slide, cy - 4);
    g.fillText(b.title, this.cssW / 2 - slide, cy - 4);
    g.font = `700 ${Math.round(this.tile * 0.42)}px "Hiragino Mincho ProN", "Yu Mincho", serif`;
    g.fillStyle = b.boss ? '#ffc0a0' : '#e9c46a';
    g.strokeText(b.sub, this.cssW / 2 + slide, cy + this.tile * 0.55);
    g.fillText(b.sub, this.cssW / 2 + slide, cy + this.tile * 0.55);
    if (b.boss) {
      g.font = `700 ${Math.round(this.tile * 0.34)}px sans-serif`;
      g.fillStyle = '#ffd0c0';
      const run = this.run;
      const boss = run?.bossGen ? run.gens[run.bossGen] : null;
      if (boss) g.fillText(`― ${boss.name} ${run!.mode === 'defense' ? 'の軍勢' : 'が待ち受ける'} ―`, this.cssW / 2, cy + this.tile * 1.05);
    }
    g.restore();
  }

  /** 技の名前の大きな表示 */
  private drawCutin(now: number) {
    const c = this.cutin;
    if (!c) return;
    const life = this.speed(900);
    const t = now - c.t0;
    if (t > life) { this.cutin = null; return; }
    const g = this.g;
    const a = t < 120 ? t / 120 : t > life - 220 ? (life - t) / 220 : 1;
    const cy = this.cssH * 0.3;
    const h = Math.max(54, this.tile * 1.5);
    g.save();
    g.globalAlpha = a;
    const grad = g.createLinearGradient(0, 0, this.cssW, 0);
    grad.addColorStop(0, c.enemy ? 'rgba(90,0,0,0.92)' : 'rgba(10,8,20,0.92)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    const slide = (1 - Math.min(1, t / 180)) * -60;
    g.fillRect(slide, cy - h / 2, this.cssW, h);
    g.fillStyle = c.color;
    g.fillRect(slide, cy - h / 2, this.cssW * 0.8, 3);
    g.fillRect(slide, cy + h / 2 - 3, this.cssW * 0.8, 3);
    let tx = 14 + slide;
    if (c.portrait) {
      const tok = tokenSprite(c.portrait, c.enemy ? '#8a1a1a' : '#c84a4a', 'lord');
      if (tok) { g.drawImage(tok, tx, cy - h / 2 - 4, h + 8, h + 8); tx += h + 16; }
    }
    g.textAlign = 'left';
    g.font = `700 ${Math.round(h * 0.24)}px "Hiragino Mincho ProN", "Yu Mincho", serif`;
    g.fillStyle = '#e9dcc4';
    g.fillText(c.who, tx, cy - h * 0.12);
    g.font = `900 ${Math.round(h * 0.46)}px "Hiragino Mincho ProN", "Yu Mincho", serif`;
    g.lineWidth = 5;
    g.strokeStyle = '#000';
    g.strokeText(c.name, tx, cy + h * 0.32);
    g.fillStyle = c.color;
    g.fillText(c.name, tx, cy + h * 0.32);
    g.restore();
  }

  /** 迷宮全体の地図（重ねる・全面） */
  private drawMinimap(now: number) {
    const run = this.run!;
    const f = run.floor;
    const g = this.g;
    const full = this.mini === 2;
    const cell = Math.max(2, Math.floor(Math.min((this.cssW - 16) / f.w, (full ? this.cssH - 16 : this.cssH * 0.42) / f.h)));
    const w = cell * f.w, h = cell * f.h;
    const ox = Math.floor((this.cssW - w) / 2), oy = full ? Math.floor((this.cssH - h) / 2) : 8;
    if (full) { g.fillStyle = 'rgba(3,6,14,0.82)'; g.fillRect(0, 0, this.cssW, this.cssH); }
    g.globalAlpha = full ? 1 : 0.78;
    const seeAll = charmIs(run, 'c_toushi') || !!f.clairvoyant;
    for (let y = 0; y < f.h; y++) {
      for (let x = 0; x < f.w; x++) {
        const i = at(f, x, y);
        if (!f.seen[i]) continue;
        const t = f.tiles[i];
        if (t === T_WALL || t === T_HARD) continue;
        g.fillStyle = t === T_WATER ? 'rgba(80,160,230,0.75)' : t === T_LAVA ? 'rgba(255,110,40,0.75)' : f.roomOf[i] >= 0 ? 'rgba(90,140,255,0.55)' : 'rgba(90,140,255,0.38)';
        g.fillRect(ox + x * cell, oy + y * cell, cell, cell);
      }
    }
    const vis = visibleFrom(f, run.player.x, run.player.y);
    const dot = (x: number, y: number, color: string, r = 0.5) => {
      g.fillStyle = color;
      g.beginPath(); g.arc(ox + (x + 0.5) * cell, oy + (y + 0.5) * cell, Math.max(1.5, cell * r), 0, Math.PI * 2); g.fill();
    };
    if (f.stairs && f.seen[at(f, f.stairs.x, f.stairs.y)]) {
      g.strokeStyle = '#fff'; g.lineWidth = 1.5;
      g.strokeRect(ox + f.stairs.x * cell + 0.5, oy + f.stairs.y * cell + 0.5, cell - 1, cell - 1);
    }
    for (const fi of f.items) if (vis.has(at(f, fi.x, fi.y)) || seeAll) dot(fi.x, fi.y, fi.item.shop ? '#ffd84a' : '#5ad2ff', 0.38);
    for (const t of f.traps) if ((t.found || charmIs(run, 'c_wanami')) && f.seen[at(f, t.x, t.y)]) dot(t.x, t.y, '#c070ff', 0.32);
    for (const m of run.monsters) {
      if (!(vis.has(at(f, m.x, m.y)) || seeAll || m.ally)) continue;
      if (m.disguise) { dot(m.x, m.y, '#5ad2ff', 0.38); continue; }
      dot(m.x, m.y, m.ally ? '#6dff9a' : m.role === 'npc' ? '#ffffff' : m.role === 'keeper' && !m.angry ? '#ffd84a' : m.gen ? '#ff9a2a' : '#ff4a3a', m.gen ? 0.7 : 0.5);
    }
    const blink = Math.floor(now / 400) % 2 === 0;
    dot(run.player.x, run.player.y, blink ? '#ffffff' : '#ffe14a', 0.62);
    g.globalAlpha = 1;
  }
}

const KIND_SPRITE: Record<string, string> = {
  weapon: 'item-weapon', armor: 'item-armor', grass: 'item-herb', food: 'item-food', scroll: 'item-offense', charm: 'item-support',
  staff: 'item-staff', pot: 'item-pot', gold: 'item-gold',
};

function DIR_OF(dx: number, dy: number): number {
  const sx = Math.sign(dx), sy = Math.sign(dy);
  for (let d = 0; d < 8; d++) if (DX[d] === sx && DY[d] === sy) return d;
  return -1;
}

function MON_SAFE(id: string) {
  try {
    return { ...monDef(id), role: id === 'boss' ? 'boss' : undefined };
  } catch {
    return null;
  }
}
