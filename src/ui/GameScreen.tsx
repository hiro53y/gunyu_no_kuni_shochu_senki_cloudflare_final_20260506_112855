// 冒険（城攻め・合戦・修行）の画面：迷宮・部隊・メッセージ・操作盤・持ち物・技・メニュー
import { useCallback, useEffect, useRef, useState } from 'react';
import { BANDS } from '../content/world';
import { itemDef } from '../content/items';
import { regionDef } from '../content/sengoku';
import { at, dirTo, visibleFrom } from '../engine/geo';
import { buyPrice, equipped, itemName } from '../engine/core';
import { hostile } from '../engine/actors';
import { step } from '../engine/step';
import { saveRun } from '../engine/save';
import type { Action, Dir, GameEvent, Run } from '../engine/types';
import type { Settings } from '../campaign/state';
import { Renderer } from '../render/renderer';
import { bustUrl } from '../render/sprites';
import { Inventory } from './Inventory';
import { Pad } from './Pad';
import { Modal, itemLabel } from './common';
import { PriceHint, StatusPanel, TileInfo } from './Panels';
import { PartyBar, SkillPanel } from './Party';
import { HelpBody } from './Help';
import { SettingsBody } from './SettingsPanel';
import { playSe } from '../audio/sound';

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 0, ArrowRight: 2, ArrowDown: 4, ArrowLeft: 6, w: 0, d: 2, s: 4, a: 6, q: 7, e: 1, z: 5, c: 3,
  Numpad8: 0, Numpad9: 1, Numpad6: 2, Numpad3: 3, Numpad2: 4, Numpad1: 5, Numpad4: 6, Numpad7: 7,
};

const DIR_ARROW = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

/** 見えている一番近い敵の方向 */
function nearestEnemyDir(run: Run): Dir | null {
  const p = run.player;
  const vis = visibleFrom(run.floor, p.x, p.y);
  let best: { d: Dir; dist: number } | null = null;
  for (const m of run.monsters) {
    if (!hostile(m) || m.disguise || !vis.has(at(run.floor, m.x, m.y))) continue;
    const dist = Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y));
    const d = dirTo(p, m);
    if (d !== null && (!best || dist < best.dist)) best = { d, dist };
  }
  return best?.d ?? null;
}

/** 直線上にいるいちばん近い敵の方向（投げる・振る時の目安） */
function aimDir(run: Run): Dir | null {
  const p = run.player;
  const vis = visibleFrom(run.floor, p.x, p.y);
  let best: { d: Dir; dist: number } | null = null;
  for (const m of run.monsters) {
    if (!hostile(m) || m.disguise || !vis.has(at(run.floor, m.x, m.y))) continue;
    const dx = m.x - p.x, dy = m.y - p.y;
    if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) continue;
    const dist = Math.max(Math.abs(dx), Math.abs(dy));
    const d = dirTo(p, m);
    if (d !== null && (!best || dist < best.dist)) best = { d, dist };
  }
  return best?.d ?? null;
}

/** 冒険の名前（上の帯） */
export function placeName(run: Run): string {
  const name = run.region ? regionDef(run.region).name : '道場';
  if (run.mode === 'defense') return `${name}の合戦`;
  if (run.mode === 'hunt') return `${name}・妖魔の巣`;
  if (run.mode === 'practice') return '道場';
  return `${name}城`;
}

interface Say { gen: string; text: string; t: number }

export interface GameScreenProps {
  run: Run;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onEnd: () => void;
  onSuspend: () => void;
  onGiveUp: () => void;
}

export function GameScreen({ run, settings, onSettings, onEnd, onSuspend, onGiveUp }: GameScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const busy = useRef(false);
  const queued = useRef<{ a: Action; quick: boolean } | null>(null);
  const [, setVersion] = useState(0);
  const [panel, setPanel] = useState<'none' | 'inv' | 'log' | 'menu' | 'help' | 'settings' | 'giveup' | 'status' | 'skill'>('none');
  const [info, setInfo] = useState<{ x: number; y: number } | null>(null);
  const [dirPick, setDirPick] = useState<{ title: string; action: Action } | null>(null);
  const [dashArmed, setDashArmed] = useState(false);
  const [faceMode, setFaceMode] = useState(false);
  const [say, setSay] = useState<Say | null>(null);
  const ended = useRef(false);
  const bump = () => setVersion((v) => v + 1);

  // 描画の準備
  useEffect(() => {
    const canvas = canvasRef.current!;
    const r = new Renderer(canvas);
    rendererRef.current = r;
    r.sync(run);
    const box = boxRef.current!;
    const fit = () => r.resize(box.clientWidth, box.clientHeight);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => { ro.disconnect(); r.destroy(); rendererRef.current = null; };
  }, [run]);

  useEffect(() => {
    if (rendererRef.current) rendererRef.current.opts.fast = settings.fast;
  }, [settings.fast]);

  /** 将の台詞（名乗り・敗北）を出す */
  const showSay = useCallback((events: GameEvent[]) => {
    for (const e of events) {
      if (e.k === 'say') setSay({ gen: e.gen, text: e.text, t: Date.now() });
      if (e.k === 'floor' && (run.floor.kind === 'boss' || run.floor.kind === 'field') && run.bossGen) {
        const g = run.gens[run.bossGen];
        if (g?.intro) setSay({ gen: g.id, text: g.intro, t: Date.now() });
      }
    }
  }, [run]);

  // 開始時：天守・合戦なら名乗りを出す
  useEffect(() => {
    if ((run.floor.kind === 'boss' || run.floor.kind === 'field') && run.bossGen && run.turn === 0) {
      const g = run.gens[run.bossGen];
      if (g?.intro) setSay({ gen: g.id, text: g.intro, t: Date.now() });
    }
  }, [run]);

  useEffect(() => {
    if (!say) return undefined;
    const id = window.setTimeout(() => setSay(null), 3600);
    return () => window.clearTimeout(id);
  }, [say]);

  const act = useCallback((a: Action, quick = false) => {
    if (run.end || ended.current) return;
    if (busy.current) { queued.current = { a, quick }; return; }
    const r = rendererRef.current;
    if (!r) return;
    busy.current = true;
    const events = step(run, a);
    saveRun(run);
    showSay(events);
    bump();
    r.play(run, events, quick || a.t === 'dash' || a.t === 'rest').then(() => {
      busy.current = false;
      bump();
      if (run.end && !ended.current) {
        ended.current = true;
        window.setTimeout(onEnd, run.end.kind === 'dead' ? 1300 : run.end.kind === 'clear' ? 1600 : 700);
        return;
      }
      const next = queued.current;
      queued.current = null;
      if (next) act(next.a, next.quick);
    });
  }, [run, onEnd, showSay]);

  // 開発中の確認用（本番のビルドには入らない）。?bot=1 で自動プレイ
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    (window as unknown as { __game: unknown }).__game = {
      run, act: (a: Action) => act(a), renderer: () => rendererRef.current,
      goto: async (no: number) => {
        const { enterFloor } = await import('../engine/run');
        const { makeCtx, closeCtx } = await import('../engine/core');
        const ctx = makeCtx(run);
        enterFloor(ctx, no, run.monsters.filter((m) => m.ally));
        closeCtx(ctx);
        rendererRef.current?.sync(run);
        bump();
      },
    };
    if (!location.search.includes('bot')) return undefined;
    let alive = true;
    import('../../tests/bot').then(({ smartAction, mulberry }) => {
      const rand = mulberry(run.seed);
      const tick = () => {
        if (!alive || run.end) return;
        if (!busy.current) act(smartAction(run, rand));
        window.setTimeout(tick, 60);
      };
      tick();
    });
    return () => { alive = false; };
  }, [run, act]);

  const onDir = useCallback((dir: Dir) => {
    if (faceMode) { act({ t: 'face', dir }); setFaceMode(false); return; }
    if (dashArmed) { act({ t: 'dash', dir }, true); setDashArmed(false); return; }
    act({ t: 'move', dir });
  }, [act, dashArmed, faceMode]);

  /** 投げる・振る・撃つは方向を選んでから */
  const onItemAction = useCallback((a: Action) => {
    const needsDir = a.t === 'shoot' || (a.t === 'item' && (a.verb === 'throw' || (a.verb === 'use' && itemDef(run.player.inv.find((i) => i.uid === a.uid)?.id ?? 'gold').cat === 'staff')));
    if (needsDir) {
      const item = a.t === 'item' ? run.player.inv.find((i) => i.uid === a.uid) : equipped(run, 'arrow');
      const verb = a.t === 'shoot' ? '撃つ' : a.t === 'item' && a.verb === 'throw' ? '投げる' : '振る';
      setDirPick({ title: `${item ? itemName(run, item) : ''}を${verb}方向`, action: a });
      return;
    }
    act(a);
  }, [act, run]);

  // キーボード
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (panel !== 'none' || dirPick || run.prompt) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const dir = KEY_DIRS[e.code] ?? KEY_DIRS[k];
      if (dir !== undefined) {
        e.preventDefault();
        if (e.shiftKey) act({ t: 'dash', dir }, true);
        else onDir(dir);
        return;
      }
      if (k === ' ' || k === 'Enter') { e.preventDefault(); act({ t: 'attack' }); }
      else if (k === 'x' || e.code === 'Numpad5') act({ t: 'wait' });
      else if (k === 'r') act({ t: 'rest' }, true);
      else if (k === 'i') setPanel('inv');
      else if (k === 't') setPanel('skill');
      else if (k === 'g' || k === '>') act({ t: 'stairs' });
      else if (k === 'v') onItemAction({ t: 'shoot' });
      else if (k === 'm') { const r = rendererRef.current; if (r) r.mini = ((r.mini + 1) % 3) as 0 | 1 | 2; }
      else if (k === 'l') setPanel('log');
      else if (k === 'f') setFaceMode((v) => !v);
      else if (k === ',') act({ t: 'pickup' });
      else if (k === 'Escape') setPanel('menu');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act, onDir, onItemAction, panel, dirPick, run]);

  const p = run.player;
  const f = run.floor;
  const onStairs = !!f.stairs && f.stairs.x === p.x && f.stairs.y === p.y;
  const foot = f.items.find((fi) => fi.x === p.x && fi.y === p.y);
  const hpRate = p.hp / p.maxHp;
  const lines = run.log.slice(-3);
  const st = p.st;
  const chips: [string, string][] = [];
  if (st.sleep) chips.push(['睡眠', 'bad']);
  if (st.confuse) chips.push(['混乱', 'bad']);
  if (st.paralyze) chips.push(['金縛り', 'bad']);
  if (st.slow) chips.push(['鈍足', 'bad']);
  if (st.stuck) chips.push(['足止め', 'bad']);
  if (st.fast) chips.push(['倍速', 'good']);
  if (st.invincible) chips.push(['無敵', 'good']);
  if (st.guard) chips.push(['守り', 'good']);
  if (st.power) chips.push(['攻め', 'good']);
  if (run.thief) chips.push(['泥棒', 'bad']);
  if (p.str < p.maxStr) chips.push([`力${p.str}/${p.maxStr}`, 'bad']);
  if (p.hunger <= 20) chips.push([p.hunger === 0 ? '飢え' : '空腹', 'bad']);
  const turned = run.monsters.filter((m) => m.ally && !m.gen);
  const aim = dirPick ? aimDir(run) : null;
  const floorLabel = run.mode === 'defense' ? '野戦' : `${run.floorNo}/${run.lastFloor}F`;
  const bandName = f.kind === 'boss' ? '天守' : f.kind === 'field' ? '合戦場' : BANDS[f.band].name;
  const sayGen = say ? run.gens[say.gen] : null;
  const bossAlive = run.bossGen ? run.monsters.find((m) => m.gen === run.bossGen && !m.dead) : null;

  return (
    <div className={`game-screen text-${settings.text}`}>
      <header className="hud">
        <div className="hud-row">
          <span className="floor-chip">{floorLabel}</span>
          <span className="band-name">{placeName(run)}<small>・{bandName}</small></span>
          <span className="lv">Lv{p.lv}</span>
          <span className="gold">{p.gold.toLocaleString()}文</span>
          <button className="menu-btn" onClick={() => setPanel('menu')} aria-label="メニュー">≡</button>
        </div>
        <div className="hud-row">
          <span className="hp-label">HP</span>
          <div className="hp-bar"><div className={`hp-fill ${hpRate < 0.25 ? 'danger' : hpRate < 0.5 ? 'warn' : ''}`} style={{ width: `${Math.max(0, hpRate) * 100}%` }} /></div>
          <span className="hp-num">{p.hp}/{p.maxHp}</span>
          <span className={`hunger ${p.hunger <= 20 ? 'low' : ''}`}>腹{Math.round((p.hunger / p.maxHunger) * 100)}%</span>
        </div>
        <PartyBar run={run} onOpen={() => setPanel('skill')} />
        {bossAlive && (f.kind === 'boss' || f.kind === 'field') && (
          <div className="hud-row boss-row">
            <span className="boss-name">{run.gens[run.bossGen!].name}</span>
            <div className="hp-bar boss"><div className="hp-fill danger" style={{ width: `${Math.max(0, bossAlive.hp / bossAlive.maxHp) * 100}%` }} /></div>
          </div>
        )}
        {(chips.length > 0 || turned.length > 0) && (
          <div className="hud-row chips">
            {chips.map(([t, c]) => <span key={t} className={`chip ${c}`}>{t}</span>)}
            {turned.map((m) => <span key={m.uid} className="chip good">寝返り {m.hp}/{m.maxHp}</span>)}
          </div>
        )}
      </header>
      <div className="field" ref={boxRef}>
        <canvas ref={canvasRef} className="field-canvas" onClick={(e) => {
          const r = rendererRef.current;
          if (!r || busy.current) return;
          const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
          const t = r.tileAtPoint(e.clientX - rect.left, e.clientY - rect.top);
          if (t) setInfo(t);
        }} />
        {say && sayGen && (
          <div className="say-box" onClick={() => setSay(null)}>
            <img src={bustUrl(sayGen.portrait)} alt="" />
            <div><b>{sayGen.name}</b><p>{say.text.replace(/^[^「]*「/, '「')}</p></div>
          </div>
        )}
        <div className="msg-box" onClick={() => setPanel('log')}>
          {lines.map((l, i) => <div key={`${run.log.length}-${i}`} className={`msg ${l.c ?? ''} ${i < lines.length - 1 ? 'old' : ''}`}>{l.t}</div>)}
        </div>
        {(onStairs || foot) && !run.prompt && (
          <div className="field-actions">
            {foot && !onStairs && (foot.item.shop
              ? <button className="float-btn shop" onClick={() => act({ t: 'pickup' })}>拾う：{itemLabel(run, foot.item)}（{buyPrice(foot.item)}文）</button>
              : <button className="float-btn" onClick={() => setPanel('inv')}>足元：{itemLabel(run, foot.item)}</button>)}
            {onStairs && <button className="float-btn stairs" onClick={() => act({ t: 'stairs' })}>{run.mode === 'hunt' || run.mode === 'practice' ? '▼ 奥へ進む' : '▲ 階段を上る'}</button>}
          </div>
        )}
      </div>
      <div className="toolbar">
        <button onClick={() => setPanel('inv')}>道具</button>
        <button className="skill-tool" onClick={() => setPanel('skill')}>技</button>
        <button onClick={() => onItemAction({ t: 'shoot' })} disabled={!equipped(run, 'arrow')}>矢</button>
        <button className={faceMode ? 'on' : ''} onClick={() => {
          if (!faceMode) {
            const d = nearestEnemyDir(run);
            if (d !== null) act({ t: 'face', dir: d });
          }
          setFaceMode((v) => !v);
        }}>向き</button>
        <button onClick={() => { const r = rendererRef.current; if (r) { r.mini = ((r.mini + 1) % 3) as 0 | 1 | 2; bump(); } }}>地図</button>
        <button onClick={() => setPanel('status')}>状態</button>
      </div>
      <Pad
        onDir={onDir}
        onWait={() => act({ t: 'wait' })}
        onRest={() => act({ t: 'rest' }, true)}
        onA={() => act({ t: 'attack' })}
        onB={() => setDashArmed((v) => !v)}
        dashArmed={dashArmed}
        faceMode={faceMode}
      />

      {panel === 'inv' && <Inventory run={run} onAction={onItemAction} onClose={() => setPanel('none')} />}
      {panel === 'skill' && <SkillPanel run={run} onClose={() => setPanel('none')} onUse={(who, skill) => { setPanel('none'); act({ t: 'skill', who, skill }); }} />}
      {panel === 'log' && (
        <Modal title="これまでの出来事" onClose={() => setPanel('none')} className="log-modal">
          <div className="log-list">{[...run.log].reverse().map((l, i) => <div key={i} className={`msg ${l.c ?? ''}`}>{l.t}</div>)}</div>
        </Modal>
      )}
      {panel === 'menu' && (
        <Modal title={placeName(run)} onClose={() => setPanel('none')}>
          <div className="menu-list">
            <button onClick={() => setPanel('log')}>これまでの出来事</button>
            <button onClick={() => setPanel('help')}>遊び方</button>
            <button onClick={() => setPanel('settings')}>設定</button>
            <button onClick={() => { saveRun(run); onSuspend(); }}>中断してタイトルへ（続きから遊べる）</button>
            {run.mode !== 'practice' && <button className="danger" onClick={() => setPanel('giveup')}>退却する</button>}
          </div>
          <p className="note">ターン {run.turn}・倒した敵 {run.stats.kills}・この階 {f.turns} ターン</p>
        </Modal>
      )}
      {panel === 'help' && <Modal title="遊び方" onClose={() => setPanel('menu')} wide><HelpBody /></Modal>}
      {panel === 'settings' && <Modal title="設定" onClose={() => setPanel('menu')}><SettingsBody settings={settings} onChange={onSettings} /></Modal>}
      {panel === 'giveup' && (
        <Modal title="退却しますか？" onClose={() => setPanel('menu')}>
          <p>{run.mode === 'defense' ? '合戦から退くと、この国は敵に奪われます。' : '負けと同じ扱いです。'}装備以外の持ち物と、拾った文を失い、部隊の武将は傷を負います。</p>
          <p className="note">持ち物を失わずに退くには「撤退の巻物」を読みます。</p>
          <div className="row-buttons">
            <button onClick={() => setPanel('menu')}>やめておく</button>
            <button className="danger" onClick={() => { setPanel('none'); onGiveUp(); }}>退却する</button>
          </div>
        </Modal>
      )}
      {dirPick && (
        <Modal title={dirPick.title} onClose={() => setDirPick(null)} className="dir-modal">
          <div className="dir-grid">
            {[7, 0, 1, 6, -1, 2, 5, 4, 3].map((d) => d === -1
              ? <button key="now" className="now" onClick={() => { const a = dirPick.action; setDirPick(null); act(a); }}>今の向き<br />{DIR_ARROW[p.dir]}</button>
              : <button key={d} className={aim === d ? 'aim' : ''} onClick={() => { const a = dirPick.action; setDirPick(null); act({ t: 'face', dir: d as Dir }); act(a); }}>{DIR_ARROW[d]}</button>)}
          </div>
          {aim !== null && <p className="note">光っている方向に敵がいます。</p>}
        </Modal>
      )}
      {panel === 'status' && <StatusPanel run={run} onClose={() => setPanel('none')} />}
      {info && <TileInfo run={run} x={info.x} y={info.y} onClose={() => setInfo(null)} />}
      {run.prompt && run.prompt.kind !== 'npc' && (
        <Modal title={run.prompt.kind === 'pay' ? 'お支払い' : '買い取り'}>
          <p>{run.prompt.kind === 'pay' ? `商人「お代は${run.prompt.amount}文になります。お支払いになりますか？」（所持金 ${p.gold}文）` : `商人「${run.prompt.amount}文で買い取りましょう。よろしいですか？」`}</p>
          {run.prompt.kind === 'sell' && (() => { const uid = (run.prompt as { itemUid: number }).itemUid; const fi = f.items.find((x) => x.item.uid === uid); return fi ? <PriceHint run={run} item={fi.item} mode="sell" /> : null; })()}
          {run.prompt.kind === 'pay' && <p className="note">払わずに逃げると、商人が追ってくる。次の階へ進めば逃げ切れる。</p>}
          <div className="row-buttons">
            {run.prompt.kind === 'pay' && <button className="danger" onClick={() => { playSe('menu'); act({ t: 'answer', yes: false, steal: true }); }}>払わずに逃げる</button>}
            <button onClick={() => { playSe('menu'); act({ t: 'answer', yes: false }); }}>{run.prompt.kind === 'pay' ? 'やめる' : 'いいえ'}</button>
            <button className="primary" onClick={() => { playSe('menu'); act({ t: 'answer', yes: true }); }}>{run.prompt.kind === 'pay' ? '払う' : 'はい'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
