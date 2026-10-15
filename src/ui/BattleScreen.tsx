// 合戦の画面：上に戦果バーと行動順、まん中にちび武将の戦場（左に味方・右に敵、最大6対6）、
// 下に12部隊の欄と時間の目盛り。手番の部隊は、敵（味方・自分）に触れて技を選ぶ。出来事は戦場で順に再生する
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { regionDef } from '../content/sengoku';
import { KINDS, RANGE_NAME, battleSkill, costLabel } from '../battle/kinds';
import { GROUND_NAME, act, activeUnit, canUse, estimate, legalTargets, needsTarget, predictSlot, rating, retreat, unitById, upcoming } from '../battle/engine';
import { chooseAction } from '../battle/ai';
import type { Action, BEvent, Battle, Side, SkillDef, Unit } from '../battle/types';
import type { Settings } from '../campaign/state';
import { saveBattle } from '../engine/save';
import { Field, playEvents } from '../battle/view/field';
import { KindMark, Modal, bustUrl, tokenUrl } from './common';
import { playSe } from '../audio/sound';

export interface BattleScreenProps {
  b: Battle;
  title: string;
  colors: { L: string; R: string };
  settings: Settings;
  onSettings: (s: Settings) => void;
  onEnd: () => void;
}

const clone = (b: Battle): Battle => JSON.parse(JSON.stringify(b)) as Battle;
const SPEED = [1, 0.5, 0] as const;
const ANIM_LABEL = ['演出 ふつう', '演出 速い', '演出 なし'] as const;

/** その標的に使える技 */
function skillsFor(b: Battle, u: Unit, t: Unit): string[] {
  const out: string[] = [];
  for (const sid of u.skills) {
    const s = battleSkill(sid);
    if (t.uid === u.uid) {
      if (s.range === 'self' || s.range === 'none' || s.range === 'allies') out.push(sid);
      else if (s.range === 'ally') out.push(sid);
      continue;
    }
    if (t.side === u.side) {
      if (s.range === 'ally' || s.range === 'allies') out.push(sid);
      continue;
    }
    if (s.range === 'all') out.push(sid);
    else if ((s.range === 'near' || s.range === 'far' || s.range === 'pierce') && legalTargets(b, u, sid).some((x) => x.uid === t.uid)) out.push(sid);
  }
  return out;
}

export function BattleScreen({ b, title, colors, settings, onSettings, onEnd }: BattleScreenProps) {
  const [view, setView] = useState<Battle>(() => clone(b));
  const viewRef = useRef(view);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<null | 'menu' | 'log' | 'retreat'>(null);
  const [info, setInfo] = useState<number | null>(null);
  /** 標的を選んだあとの技の小窓 */
  const [pickTarget, setPickTarget] = useState<number | null>(null);
  /** 技を先に選んだ時（標的を選ぶ） */
  const [pickSkill, setPickSkill] = useState<string | null>(null);
  /** 緑の矢印に出す技 */
  const [preview, setPreview] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<Field | null>(null);
  const alive = useRef(true);
  const speed = SPEED[settings.anim ?? 0];

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // 戦場
  useEffect(() => {
    const cv = canvasRef.current;
    const box = boxRef.current;
    if (!cv || !box) return undefined;
    const f = new Field(cv, { colors, headUrl: tokenUrl, bustUrl });
    f.setBattle(b, b.ground);
    fieldRef.current = f;
    const resize = () => {
      const r = box.getBoundingClientRect();
      f.resize(r.width, r.height, window.devicePixelRatio || 1);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    return () => { ro.disconnect(); f.destroy(); fieldRef.current = null; };
    // b が変わる時は画面ごと作り直す（key で）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (fieldRef.current) fieldRef.current.speed = speed; }, [speed]);

  const commitView = (v: Battle) => { viewRef.current = v; setView(v); };

  /** 出来事を表示の写しに当てる */
  const apply = useCallback((e: BEvent) => {
    const v = viewRef.current;
    const u = 'uid' in e ? v.units.find((x) => x.uid === e.uid) : undefined;
    switch (e.k) {
      case 'turn': v.active = e.uid; break;
      case 'skill': { const real = unitById(b, e.uid); if (u && real) u.ap = Math.max(u.ap, real.ap); if (u && real) u.ap = real.ap; break; }
      case 'hit':
      case 'counter':
        if (u) u.troops = Math.max(0, u.troops - e.n);
        { const from = v.units.find((x) => x.uid === e.from); if (from) v.dmg[from.side] += e.n; }
        break;
      case 'heal': if (u) u.troops = Math.min(u.maxTroops, u.troops + e.n); break;
      case 'buff':
        if (!u) break;
        if (e.stat === 'atk' || e.stat === 'def' || e.stat === 'int' || e.stat === 'spd') u.buffs[e.stat] = Math.max(u.buffs[e.stat], 0.01);
        if (e.stat === 'dispel') u.buffs = { atk: 0, def: 0, int: 0, spd: 0 };
        if (e.stat === 'guard') { const n = Number(e.text.replace(/[^0-9]/g, '')); u.guard = (n || 0) / 100; u.guarding = e.good; }
        if (e.stat === 'barrier') u.barrier = true;
        if (e.stat === 'ap') u.ap = Math.max(0, u.ap - 1);
        break;
      case 'prep': if (u) { const real = unitById(b, e.uid); u.prep = real?.prep ?? { skill: '', target: null, hits: 0 }; u.ap = real?.ap ?? u.ap; } break;
      case 'cancel': if (u) u.prep = null; break;
      case 'block': if (u) u.barrier = false; break;
      case 'kill':
      case 'down': if (u) { u.out = true; u.troops = 0; u.prep = null; } break;
      case 'tick': v.ticks = e.v; break;
      case 'end': v.end = b.end; v.active = null; break;
      default:
    }
    commitView({ ...v, units: [...v.units] });
  }, [b]);

  const unitOfView = useCallback((uid: number) => viewRef.current.units.find((x) => x.uid === uid) ?? null, []);

  const doAction = useCallback(async (a: Action) => {
    if (b.end || busy) return;
    setBusy(true);
    setPickTarget(null);
    setPickSkill(null);
    setPreview(null);
    fieldRef.current?.setTargets([]);
    const before = clone(b);
    commitView(before);
    const events = act(b, a);
    saveBattle(b);
    const f = fieldRef.current;
    if (f) await playEvents(f, events, { apply, se: playSe, unit: unitOfView }, () => alive.current);
    if (!alive.current) return;
    commitView(clone(b));
    f?.sync(b);
    f?.setActive(b.active);
    setBusy(false);
  }, [b, busy, apply, unitOfView]);

  // 敵の手番・おまかせは自動で進める
  const u = activeUnit(b);
  const playerTurn = !!u && u.side === 'L' && !settings.auto && !b.end;
  useEffect(() => {
    if (busy || b.end || !u || playerTurn) return undefined;
    const id = window.setTimeout(() => { if (alive.current) void doAction(chooseAction(b)); }, speed === 0 ? 30 : 280 * speed);
    return () => window.clearTimeout(id);
  }, [busy, b, u, playerTurn, doAction, speed]);

  useEffect(() => { fieldRef.current?.setActive(busy ? viewRef.current.active : b.active); }, [busy, b.active]);

  // 狙える部隊の照準
  const targetUids = useMemo(() => {
    if (!playerTurn || !u || busy) return [] as number[];
    if (pickSkill) return needsTarget(pickSkill) ? legalTargets(b, u, pickSkill).map((x) => x.uid) : [];
    return [];
  }, [playerTurn, u, busy, pickSkill, b, view]);
  useEffect(() => { fieldRef.current?.setTargets(targetUids, pickTarget); }, [targetUids, pickTarget]);

  // 開発中の確認用（本番のビルドには入らない）
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __battle: unknown }).__battle = { b, act: (a: Action) => doAction(a), ai: () => doAction(chooseAction(b)), field: fieldRef.current };
  }, [b, doAction]);

  /** 部隊に触れた */
  const touchUnit = (uid: number) => {
    const t = unitById(b, uid);
    if (!t) return;
    if (!playerTurn || busy || !u) { setInfo(uid); return; }
    playSe('menu');
    if (pickSkill) {
      if (targetUids.includes(uid)) { void doAction({ t: 'skill', skill: pickSkill, target: uid }); return; }
      setPickSkill(null);
    }
    if (t.out) { setInfo(uid); return; }
    setPickTarget(uid);
  };

  const onCanvasClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const f = fieldRef.current;
    if (!f) return;
    const r = (ev.target as HTMLCanvasElement).getBoundingClientRect();
    const uid = f.squadAt(ev.clientX - r.left, ev.clientY - r.top);
    if (uid !== null) touchUnit(uid);
  };

  const g = 50 + rating(view) / 2;
  const gauge = Math.max(0, Math.min(100, g));
  const order = upcoming(busy ? view : b, 8);
  const slot = preview && u && playerTurn ? predictSlot(b, u.uid, preview === '__wait' ? null : preview, 8) : -1;
  const vu = (uid: number) => view.units.find((x) => x.uid === uid)!;

  const panel = (side: Side, row: 0 | 1, s: 0 | 1 | 2) => {
    const x = view.units.find((z) => z.side === side && z.row === row && z.slot === s);
    if (!x) return <div key={`${side}${row}${s}`} className="bp-cell empty" />;
    const k = KINDS[x.kind];
    const isActive = (busy ? view.active : b.active) === x.uid;
    const isTarget = targetUids.includes(x.uid);
    const pickedCost = playerTurn && u && x.uid === u.uid && preview && preview !== '__wait' ? (battleSkill(preview).cost === 'all' ? x.ap : Number(battleSkill(preview).cost)) : 0;
    return (
      <button
        key={x.uid}
        className={`bp-cell side-${side} ${x.out ? 'out' : ''} ${isActive ? 'active' : ''} ${isTarget ? 'target' : ''} ${pickTarget === x.uid ? 'picked' : ''}`}
        onClick={() => touchUnit(x.uid)}
        aria-label={`${x.name} ${k.name} 兵${x.troops}`}
      >
        <img className="bp-face" src={tokenUrl(x.portrait)} alt="" />
        <span className="bp-name"><KindMark kind={x.kind} size={12} />{x.short}</span>
        <span className="bp-troops">{x.out ? '壊滅' : x.troops}</span>
        <span className="bp-flags">
          {Array.from({ length: Math.min(7, x.apMax) }, (_, i) => (
            <i key={i} className={i < x.ap - pickedCost ? 'w' : i < x.ap ? 'y' : 'r'} />
          ))}
        </span>
        <span className="bp-st">
          {x.guarding && x.guard > 0 && <em className="gd">盾{Math.round(x.guard * 100)}</em>}
          {x.buffs.atk > 0 && <em className="ba">↑</em>}
          {x.buffs.def > 0 && <em className="bd">↑</em>}
          {x.buffs.int > 0 && <em className="bi">↑</em>}
          {x.buffs.spd > 0 && <em className="bs">↑</em>}
          {x.prep && <em className="pr">備</em>}
          {x.barrier && <em className="br">結</em>}
          {x.boss && <em className="bo">将</em>}
          {x.lord && <em className="lo">主</em>}
        </span>
        <span className="bp-bar"><span style={{ width: `${(x.troops / x.maxTroops) * 100}%` }} /></span>
      </button>
    );
  };

  const target = pickTarget !== null ? unitById(b, pickTarget) : null;
  const options = target && u ? skillsFor(b, u, target) : [];
  const skillRow = (sid: string, onUse: () => void) => {
    const s: SkillDef = battleSkill(sid);
    const can = canUse(b, u!, sid);
    const est = target && target.side !== u!.side && s.mult > 0 ? estimate(b, u!, target, sid) : 0;
    const nextSlot = predictSlot(b, u!.uid, sid, 8);
    return (
      <button
        key={sid}
        className="bskill"
        disabled={!can.ok}
        style={{ borderColor: can.ok ? s.color : undefined }}
        onPointerEnter={() => setPreview(sid)}
        onFocus={() => setPreview(sid)}
        onClick={() => { playSe('menu'); onUse(); }}
      >
        <span className="bs-name" style={{ color: can.ok ? s.color : undefined }}>{s.name}</span>
        <span className="bs-meta">
          <b className="cost">{Array.from({ length: s.cost === 'all' ? Math.max(1, u!.ap) : Number(s.cost) }, (_, i) => <i key={i} />)}{s.cost === 'all' ? '全' : ''}</b>
          {RANGE_NAME[s.range]}・硬直{s.prep ? `${s.prep}+準備` : s.stiff}{est ? `・打撃 約${est}` : ''}{s.counter > 0 && target && target.side !== u!.side && KINDS[target.kind].counter ? `・反撃${Math.round(s.counter * 100)}%` : ''}
        </span>
        <span className="bs-desc">{can.ok ? `${s.desc}${nextSlot >= 0 ? `（次の手番：${nextSlot + 1}番目）` : '（次の手番は先）'}` : can.reason}</span>
      </button>
    );
  };

  const endReason = view.end ? (view.end.reason === 'wipe' ? (view.end.winner === 'L' ? '敵を全滅させた' : '味方が全滅した') : view.end.reason === 'lord' ? '朔の部隊が壊滅した' : view.end.reason === 'retreat' ? '退却した' : view.end.reason === 'time' ? '時間切れ。戦果で決着' : '技が尽きた。戦果で決着') : '';

  return (
    <div className={`battle-screen text-${settings.text}`}>
      <header className="bhead">
        <div className="bh-row">
          <span className="bh-title">{title}<small>{GROUND_NAME[b.ground]}</small></span>
          <span className="bh-time">時間<b>{view.ticks}</b></span>
          <button className="menu-btn" onClick={() => setMenu('menu')} aria-label="メニュー">≡</button>
        </div>
        <div className="gauge" aria-label={`戦果 ${Math.round(gauge)}`}>
          <span className="g-l" style={{ width: `${gauge}%` }} />
          <span className="g-mid" />
          <span className="g-mark" style={{ left: `${gauge}%` }} />
          <span className="g-val">戦果 {Math.round(gauge)}：{Math.round(100 - gauge)}</span>
        </div>
        <div className="order" aria-label="行動順">
          {order.map((x, i) => (
            <span key={x.uid} className="ord-wrap">
              {slot === i && <span className="ord-arrow">▼</span>}
              <span className={`ord side-${x.side} ${i === 0 ? 'now' : ''}`} title={x.name} onClick={() => touchUnit(x.uid)}>
                <img src={tokenUrl(x.portrait)} alt="" />
                {x.prep && <i>備</i>}
              </span>
            </span>
          ))}
          {slot === order.length && <span className="ord-arrow">▼</span>}
        </div>
      </header>

      <div className="bfield-box" ref={boxRef}>
        <canvas ref={canvasRef} className="bfield-canvas" onClick={onCanvasClick} />
        {view.end && (
          <div className={`bend ${view.end.winner === 'L' ? 'win' : 'lose'}`}>
            <b>{view.end.winner === 'L' ? '勝利！' : '敗北……'}</b>
            <small>{endReason}・戦果 {Math.round(gauge)}：{Math.round(100 - gauge)}</small>
            <button className="primary" onClick={() => { playSe('menu'); onEnd(); }}>結果へ</button>
          </div>
        )}
      </div>

      <div className="bpanels">
        <div className="bp-side">
          {[0, 1, 2].map((s) => <div key={s} className="bp-row">{panel('L', 1, s as 0 | 1 | 2)}{panel('L', 0, s as 0 | 1 | 2)}</div>)}
        </div>
        <div className="bp-ticks" aria-label={`時間 ${view.ticks}`}>
          {Array.from({ length: Math.max(view.ticksMax, view.ticks) }, (_, i) => <i key={i} className={i < view.ticks ? 'on' : ''} />)}
        </div>
        <div className="bp-side">
          {[0, 1, 2].map((s) => <div key={s} className="bp-row">{panel('R', 0, s as 0 | 1 | 2)}{panel('R', 1, s as 0 | 1 | 2)}</div>)}
        </div>
      </div>

      <footer className="bfoot">
        {playerTurn && u && !busy && !target && (
          <div className="bf-turn">
            <span className="bf-who"><img src={tokenUrl(u.portrait)} alt="" /><b>{u.short}隊の手番</b><small>{KINDS[u.kind].name}・{u.row === 0 ? '前衛' : '後衛'}・技数{u.ap}</small></span>
            {pickSkill ? (
              <span className="bf-hint">「{battleSkill(pickSkill).name}」の標的を選ぶ（光っている部隊）<button className="small" onClick={() => { setPickSkill(null); setPreview(null); }}>やめる</button></span>
            ) : (
              <span className="bf-hint">敵の部隊に触れると、使える技が出ます</span>
            )}
            <div className="bf-chips">
              {u.skills.map((sid) => {
                const s = battleSkill(sid);
                const can = canUse(b, u, sid).ok;
                return (
                  <button key={sid} className={`chip ${pickSkill === sid ? 'on' : ''}`} disabled={!can} style={{ borderColor: can ? s.color : undefined }}
                    onPointerEnter={() => setPreview(sid)}
                    onClick={() => {
                      playSe('menu');
                      setPreview(sid);
                      if (needsTarget(sid)) {
                        const list = legalTargets(b, u, sid);
                        if (list.length === 1) void doAction({ t: 'skill', skill: sid, target: list[0].uid });
                        else setPickSkill(sid);
                      } else void doAction({ t: 'skill', skill: sid });
                    }}>
                    {s.name}<small>{costLabel(s)}</small>
                  </button>
                );
              })}
              <button className="chip wait" onPointerEnter={() => setPreview('__wait')} onClick={() => { playSe('menu'); void doAction({ t: 'wait' }); }}>待機<small>0</small></button>
            </div>
          </div>
        )}
        {(!playerTurn || busy) && !view.end && <div className="bf-wait">{u?.side === 'R' && !busy ? `${u.short}隊の手番……` : settings.auto ? 'おまかせで戦っています……' : '……'}</div>}
        <div className="bf-tools">
          <button className={settings.auto ? 'on' : ''} onClick={() => { playSe('menu'); onSettings({ ...settings, auto: !settings.auto }); }}>おまかせ{settings.auto ? '中' : ''}</button>
          <button className={settings.anim ? 'on' : ''} onClick={() => { playSe('menu'); onSettings({ ...settings, anim: (((settings.anim ?? 0) + 1) % 3) as 0 | 1 | 2 }); }}>{ANIM_LABEL[settings.anim ?? 0]}</button>
          <button onClick={() => setMenu('log')}>記録</button>
        </div>
      </footer>

      {target && u && playerTurn && !busy && (
        <div className="tmenu-back" onClick={() => { setPickTarget(null); setPreview(null); }}>
          <div className="tmenu" onClick={(e) => e.stopPropagation()}>
            <div className="tm-head">
              <img src={tokenUrl(target.portrait)} alt="" />
              <span>
                <b>{target.uid === u.uid ? `${u.short}隊（自分）` : `${target.name}隊`}</b>
                <small><KindMark kind={target.kind} size={12} /> {KINDS[target.kind].name}・兵{vu(target.uid).troops}・{target.row === 0 ? '前衛' : '後衛'}{target.guarding && target.guard > 0 ? `・ガード${Math.round(target.guard * 100)}%` : ''}{target.prep ? '・準備中' : ''}{target.barrier ? '・防御式神' : ''}</small>
              </span>
              <button className="close" onClick={() => { setPickTarget(null); setPreview(null); }} aria-label="閉じる">×</button>
            </div>
            <div className="tm-list">
              {options.length === 0 && target.uid !== u.uid && <p className="note">この部隊に使える技はない。{target.side !== u.side && u.row === 1 ? '（前衛の列からしか使えない技がある）' : ''}</p>}
              {options.map((sid) => skillRow(sid, () => void doAction({ t: 'skill', skill: sid, target: target.uid })))}
              {target.uid === u.uid && (
                <button className="bskill wait" onPointerEnter={() => setPreview('__wait')} onClick={() => { playSe('menu'); void doAction({ t: 'wait' }); }}>
                  <span className="bs-name">待機</span><span className="bs-meta">技数を使わない・硬直25</span><span className="bs-desc">何もせずに手番を送る（時間の目盛りは1つ減る）。</span>
                </button>
              )}
            </div>
            <button className="small tm-info" onClick={() => { setInfo(target.uid); setPickTarget(null); }}>この部隊を詳しく見る</button>
          </div>
        </div>
      )}

      {menu === 'menu' && (
        <Modal title={title} onClose={() => setMenu(null)}>
          <div className="menu-list">
            <button onClick={() => setMenu('log')}>合戦の記録</button>
            {!b.end && <button className="danger" onClick={() => setMenu('retreat')}>退却する</button>}
          </div>
          <p className="note">{regionDef(b.region).name}・{GROUND_NAME[b.ground]}・残りの時間 {view.ticks}・{b.turns}手目</p>
        </Modal>
      )}
      {menu === 'retreat' && (
        <Modal title="退却しますか？" onClose={() => setMenu('menu')}>
          <p>{b.kind === 'defense' ? '合戦から退くと、この国は敵に奪われます。' : '負けとして合戦を終えます。'}今の兵数はそのまま本陣に戻ります。</p>
          <div className="row-buttons">
            <button onClick={() => setMenu('menu')}>やめておく</button>
            <button className="danger" onClick={() => { setMenu(null); retreat(b); saveBattle(b); commitView(clone(b)); }}>退却する</button>
          </div>
        </Modal>
      )}
      {menu === 'log' && (
        <Modal title="合戦の記録" onClose={() => setMenu(null)} className="log-modal">
          <div className="log-list">{[...b.log].reverse().map((t, i) => <div key={i} className="msg">{t}</div>)}</div>
        </Modal>
      )}
      {info !== null && (() => {
        const x = unitById(b, info);
        if (!x) return null;
        return (
          <Modal title={x.name} onClose={() => setInfo(null)}>
            <div className="unit-info">
              <img src={bustUrl(x.portrait)} alt="" />
              <div>
                <p><KindMark kind={x.kind} /> {KINDS[x.kind].name}・Lv{x.lv}・{x.side === 'L' ? '味方' : '敵'}・{x.row === 0 ? '前衛' : '後衛'}</p>
                <p>兵 {x.troops}/{x.maxTroops}・技数 {x.ap}/{x.apMax}</p>
                <p className="stats">攻{x.atk} 防{x.def} 知{x.int} 速{x.spd}（兵種 攻{KINDS[x.kind].atk} 防{KINDS[x.kind].def}・遅れ{KINDS[x.kind].delay}）</p>
                {x.guarding && <p className="stats">ガード {Math.round(x.guard * 100)}%（{x.guardAll ? '全員をかばう' : '同じ列をかばう'}）</p>}
                {(x.buffs.atk > 0 || x.buffs.def > 0 || x.buffs.int > 0 || x.buffs.spd > 0) && <p className="stats">付与：攻{Math.round(x.buffs.atk * 100)}% 防{Math.round(x.buffs.def * 100)}% 知{Math.round(x.buffs.int * 100)}% 速{Math.round(x.buffs.spd * 100)}%</p>}
                {x.prep && <p className="stats">「{battleSkill(x.prep.skill).name}」の準備中</p>}
              </div>
            </div>
            <h4>技</h4>
            {x.skills.map((sid) => { const s = battleSkill(sid); return <p key={sid} className="stats"><b style={{ color: s.color }}>{s.name}</b>（{RANGE_NAME[s.range]}・消費{costLabel(s)}・硬直{s.stiff}）{s.desc}</p>; })}
            <p className="note">{KINDS[x.kind].desc}</p>
          </Modal>
        );
      })()}
    </div>
  );
}
