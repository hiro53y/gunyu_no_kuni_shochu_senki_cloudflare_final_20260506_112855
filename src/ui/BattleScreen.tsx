// 合戦の画面：左に味方・右に敵。上に戦果ゲージと行動順、下に手番の部隊の技。出来事を順に再生して演出する
import { useCallback, useEffect, useRef, useState } from 'react';
import { regionDef } from '../content/sengoku';
import { KINDS, RANGE_NAME, battleSkill } from '../battle/kinds';
import { act, activeUnit, canUse, gauge, legalTargets, needsTarget, retreat, unitById, upcoming } from '../battle/engine';
import { chooseAction } from '../battle/ai';
import type { Action, BEvent, Battle, Unit } from '../battle/types';
import type { Settings } from '../campaign/state';
import { saveBattle } from '../engine/save';
import { KindMark, Modal, bustUrl, tokenUrl } from './common';
import { playSe } from '../audio/sound';

interface Fx { id: number; uid: number; text: string; cls: string }

const SE: Partial<Record<BEvent['k'], string>> = { hit: 'hit', counter: 'hurt', heal: 'revive', down: 'death', block: 'equip', prep: 'magic', cancel: 'break', miss: 'miss' };

export interface BattleScreenProps {
  b: Battle;
  title: string;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onEnd: () => void;
}

let fxSeq = 1;

export function BattleScreen({ b, title, settings, onSettings, onEnd }: BattleScreenProps) {
  const [, setVer] = useState(0);
  const bump = () => setVer((v) => v + 1);
  const [busy, setBusy] = useState(false);
  const [fx, setFx] = useState<Fx[]>([]);
  const [banner, setBanner] = useState<{ text: string; color: string; side: 'L' | 'R' } | null>(null);
  const [anim, setAnim] = useState<Record<number, string>>({});
  const [picking, setPicking] = useState<string | null>(null);
  const [menu, setMenu] = useState<null | 'menu' | 'log' | 'retreat' | 'info'>(null);
  const [info, setInfo] = useState<number | null>(null);
  const alive = useRef(true);
  const speed = settings.fast ? 0.55 : 1;
  const wait = (ms: number) => new Promise<void>((res) => window.setTimeout(res, ms * speed));
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  /** 出来事を順に見せる */
  const playEvents = useCallback(async (events: BEvent[]) => {
    for (const e of events) {
      if (!alive.current) return;
      const se = SE[e.k];
      if (se) playSe(se);
      switch (e.k) {
        case 'skill': {
          const u = unitById(b, e.uid);
          setBanner({ text: e.name, color: e.color, side: u?.side ?? 'L' });
          setAnim((a) => ({ ...a, [e.uid]: u?.side === 'L' ? 'lunge-r' : 'lunge-l' }));
          playSe(e.range === 'all' ? 'thunder' : e.range === 'far' || e.range === 'pierce' ? 'arrow' : e.range === 'ally' || e.range === 'allies' || e.range === 'self' ? 'magic' : 'slash');
          await wait(420);
          setAnim((a) => { const n = { ...a }; delete n[e.uid]; return n; });
          setBanner(null);
          break;
        }
        case 'hit':
        case 'counter': {
          const big = e.k === 'hit' && e.big;
          setFx((f) => [...f, { id: fxSeq++, uid: e.uid, text: e.k === 'hit' && e.n === 0 ? '' : `-${e.n}`, cls: e.k === 'counter' ? 'counter' : big ? 'big' : '' }]);
          setAnim((a) => ({ ...a, [e.uid]: 'shake' }));
          if (e.k === 'hit' && e.guardBy) setFx((f) => [...f, { id: fxSeq++, uid: e.guardBy!, text: 'かばう', cls: 'guard' }]);
          await wait(e.k === 'counter' ? 200 : 260);
          setAnim((a) => { const n = { ...a }; delete n[e.uid]; return n; });
          break;
        }
        case 'heal':
          setFx((f) => [...f, { id: fxSeq++, uid: e.uid, text: `+${e.n}`, cls: 'heal' }]);
          await wait(180);
          break;
        case 'buff':
          setFx((f) => [...f, { id: fxSeq++, uid: e.uid, text: e.text, cls: e.good ? 'buff' : 'debuff' }]);
          await wait(120);
          break;
        case 'prep':
          setFx((f) => [...f, { id: fxSeq++, uid: e.uid, text: `${e.name}の準備`, cls: 'prep' }]);
          await wait(320);
          break;
        case 'cancel':
          setFx((f) => [...f, { id: fxSeq++, uid: e.uid, text: '準備崩れ', cls: 'debuff' }]);
          await wait(220);
          break;
        case 'block':
          setFx((f) => [...f, { id: fxSeq++, uid: e.uid, text: '防いだ', cls: 'guard' }]);
          await wait(200);
          break;
        case 'miss':
          setFx((f) => [...f, { id: fxSeq++, uid: e.uid, text: 'しくじり', cls: 'debuff' }]);
          await wait(200);
          break;
        case 'down':
          setAnim((a) => ({ ...a, [e.uid]: 'down' }));
          await wait(380);
          break;
        case 'wait':
          setFx((f) => [...f, { id: fxSeq++, uid: e.uid, text: '待機', cls: 'wait' }]);
          await wait(140);
          break;
        case 'end':
          playSe(e.winner === 'L' ? 'clear' : 'death');
          break;
        default:
      }
      bump();
    }
    window.setTimeout(() => setFx((f) => f.slice(-12)), 900);
  }, [b, speed]);

  const doAction = useCallback(async (a: Action) => {
    if (b.end) return;
    setBusy(true);
    setPicking(null);
    const events = act(b, a);
    saveBattle(b);
    bump();
    await playEvents(events);
    setBusy(false);
    bump();
  }, [b, playEvents]);

  // 敵の手番・おまかせは自動で進める
  const u = activeUnit(b);
  const playerTurn = !!u && u.side === 'L' && !settings.auto;
  useEffect(() => {
    if (busy || b.end || !u || playerTurn) return undefined;
    const id = window.setTimeout(() => { if (alive.current) void doAction(chooseAction(b)); }, 260 * speed);
    return () => window.clearTimeout(id);
  }, [busy, b, u, playerTurn, doAction, speed]);

  // 開発中の確認用（本番のビルドには入らない）
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __battle: unknown }).__battle = { b, act: (a: Action) => doAction(a), ai: () => doAction(chooseAction(b)) };
  }, [b, doAction]);

  const g = gauge(b);
  const left = Math.max(0, Math.round(b.limit - b.time));
  const order = upcoming(b, 7);
  const targets = picking && u ? legalTargets(b, u, picking).map((t) => t.uid) : [];

  const card = (x: Unit) => {
    const k = KINDS[x.kind];
    const isTarget = targets.includes(x.uid);
    const rate = x.troops / x.maxTroops;
    return (
      <button
        key={x.uid}
        className={`bcard side-${x.side} ${x.out ? 'out' : ''} ${u?.uid === x.uid ? 'active' : ''} ${isTarget ? 'target' : ''} ${anim[x.uid] ?? ''} ${x.boss ? 'boss' : ''} ${x.lord ? 'lord' : ''}`}
        style={{ gridRow: x.slot + 1 }}
        onClick={() => {
          if (isTarget && picking) { void doAction({ t: 'skill', skill: picking, target: x.uid }); return; }
          setInfo(x.uid);
          setMenu('info');
        }}
        aria-label={`${x.name} ${k.name} 兵${x.troops}`}
      >
        <img className="bc-face" src={bustUrl(x.portrait)} alt="" loading="lazy" />
        <span className="bc-top"><KindMark kind={x.kind} size={16} />{x.boss && <span className="bc-boss">将</span>}{x.lord && <span className="bc-boss lord">大将</span>}</span>
        <span className="bc-icons">
          {x.guarding && <span className="ic guard" title="ガード">盾{Math.round(x.guard * 100)}</span>}
          {x.barrier && <span className="ic barrier" title="守り式神">結</span>}
          {x.prep && <span className="ic prep" title="準備中">備</span>}
          {(x.buffs.atk > 0 || x.buffs.def > 0 || x.buffs.spd > 0) && <span className="ic buff" title="付与">↑</span>}
          {x.buffs.atk < 0 && <span className="ic debuff" title="攻撃低下">↓</span>}
        </span>
        <span className="bc-name">{x.short}</span>
        <span className="bc-troops">
          <span className="bc-bar"><span className={`bc-fill ${rate < 0.3 ? 'low' : ''}`} style={{ width: `${rate * 100}%` }} /></span>
          <span className="bc-num">{x.troops}</span>
        </span>
        <span className="bc-ap">{Array.from({ length: Math.min(8, x.apMax) }, (_, i) => <i key={i} className={i < x.ap ? 'on' : ''} />)}</span>
        {x.out && <span className="bc-out">壊滅</span>}
        {fx.filter((f) => f.uid === x.uid).slice(-2).map((f) => <span key={f.id} className={`bc-fx ${f.cls}`}>{f.text}</span>)}
      </button>
    );
  };

  const side = (s: 'L' | 'R') => {
    const list = b.units.filter((x) => x.side === s);
    const front = list.filter((x) => x.row === 0);
    const back = list.filter((x) => x.row === 1);
    const col = (units: Unit[], cls: string) => <div className={`bcol ${cls}`}>{units.map(card)}</div>;
    return (
      <div className={`bside side-${s}`}>
        {s === 'L' ? <>{col(back, 'back')}{col(front, 'front')}</> : <>{col(front, 'front')}{col(back, 'back')}</>}
      </div>
    );
  };

  const infoUnit = info !== null ? unitById(b, info) : null;

  return (
    <div className={`battle-screen text-${settings.text}`}>
      <header className="bhead">
        <div className="bh-row">
          <span className="bh-title">{title}</span>
          <span className="bh-time">残り<b>{left}</b></span>
          <button className="menu-btn" onClick={() => setMenu('menu')} aria-label="メニュー">≡</button>
        </div>
        <div className="gauge" aria-label={`戦果 ${Math.round(g)}`}>
          <span className="g-l" style={{ width: `${g}%` }} />
          <span className="g-mid" />
          <span className="g-val">戦果 {Math.round(g)}：{Math.round(100 - g)}</span>
        </div>
        <div className="order">
          {order.map((x, i) => (
            <span key={x.uid} className={`ord side-${x.side} ${i === 0 ? 'now' : ''}`} title={x.name}>
              <img src={tokenUrl(x.portrait)} alt="" />
              {x.prep && <i>備</i>}
            </span>
          ))}
          <span className="ord-label">行動順</span>
        </div>
      </header>
      <div className="bfield">
        {side('L')}
        <div className="bvs">VS</div>
        {side('R')}
        {banner && <div className={`bbanner from-${banner.side}`} style={{ borderColor: banner.color }}><span style={{ color: banner.color }}>{banner.text}</span></div>}
        {b.end && (
          <div className={`bend ${b.end.winner === 'L' ? 'win' : 'lose'}`}>
            <b>{b.end.winner === 'L' ? '勝利！' : '敗北……'}</b>
            <small>{b.end.reason === 'wipe' ? '敵を全滅させた' : b.end.reason === 'lord' ? '朔の部隊が壊滅した' : b.end.reason === 'retreat' ? '退却した' : `戦果 ${Math.round(g)}：${Math.round(100 - g)} で決着`}</small>
            <button className="primary" onClick={() => { playSe('menu'); onEnd(); }}>結果へ</button>
          </div>
        )}
      </div>
      <div className="blog" onClick={() => setMenu('log')}>{b.log.slice(-2).map((t, i) => <div key={i} className={i === 0 ? 'old' : ''}>{t}</div>)}</div>
      <footer className="bpanel">
        {!b.end && u && playerTurn && !busy && (
          <>
            <div className="bp-head">
              <img src={tokenUrl(u.portrait)} alt="" />
              <b>{u.name}</b><small>{KINDS[u.kind].name}・{u.row === 0 ? '前衛' : '後衛'}・技数 {u.ap}/{u.apMax}</small>
            </div>
            {picking ? (
              <div className="bp-pick">
                <span>「{battleSkill(picking).name}」の標的を選んでください（光っている部隊）</span>
                <button onClick={() => setPicking(null)}>やめる</button>
              </div>
            ) : (
              <div className="bp-skills">
                {u.skills.map((sid) => {
                  const s = battleSkill(sid);
                  const can = canUse(b, u, sid);
                  return (
                    <button
                      key={sid}
                      className="bskill"
                      disabled={!can.ok}
                      style={{ borderColor: can.ok ? s.color : undefined }}
                      onClick={() => {
                        playSe('menu');
                        if (needsTarget(sid)) {
                          const list = legalTargets(b, u, sid);
                          if (list.length === 1) void doAction({ t: 'skill', skill: sid, target: list[0].uid });
                          else setPicking(sid);
                        } else void doAction({ t: 'skill', skill: sid });
                      }}
                    >
                      <span className="bs-name" style={{ color: can.ok ? s.color : undefined }}>{s.name}</span>
                      <span className="bs-meta">{RANGE_NAME[s.range]}・消費{s.cost === 'all' ? '全' : s.cost}{s.mult > 0 && s.effect !== 'heal' ? `・×${s.mult.toFixed(1)}` : ''}{s.prep ? '・要準備' : ''}</span>
                      <span className="bs-desc">{can.ok ? s.desc : can.reason}</span>
                    </button>
                  );
                })}
                <button className="bskill wait" onClick={() => { playSe('menu'); void doAction({ t: 'wait' }); }}>
                  <span className="bs-name">待機</span><span className="bs-meta">技数を使わない</span><span className="bs-desc">少しだけ手番を遅らせる。</span>
                </button>
              </div>
            )}
          </>
        )}
        {!b.end && (!playerTurn || busy) && <div className="bp-wait">{u?.side === 'R' ? `${u.name}隊の手番……` : settings.auto ? 'おまかせで戦っています……' : '……'}</div>}
        <div className="bp-tools">
          <button className={settings.auto ? 'on' : ''} onClick={() => { playSe('menu'); onSettings({ ...settings, auto: !settings.auto }); }}>おまかせ{settings.auto ? '中' : ''}</button>
          <button className={settings.fast ? 'on' : ''} onClick={() => { playSe('menu'); onSettings({ ...settings, fast: !settings.fast }); }}>速さ×{settings.fast ? 2 : 1}</button>
          <button onClick={() => setMenu('log')}>記録</button>
        </div>
      </footer>

      {menu === 'menu' && (
        <Modal title={title} onClose={() => setMenu(null)}>
          <div className="menu-list">
            <button onClick={() => setMenu('log')}>合戦の記録</button>
            {!b.end && <button className="danger" onClick={() => setMenu('retreat')}>退却する</button>}
          </div>
          <p className="note">{regionDef(b.region).name}・制限時間 {b.limit}・{b.turns}手目</p>
        </Modal>
      )}
      {menu === 'retreat' && (
        <Modal title="退却しますか？" onClose={() => setMenu('menu')}>
          <p>{b.kind === 'defense' ? '合戦から退くと、この国は敵に奪われます。' : '負けとして合戦を終えます。'}今の兵数はそのまま本陣に戻ります。</p>
          <div className="row-buttons">
            <button onClick={() => setMenu('menu')}>やめておく</button>
            <button className="danger" onClick={() => { setMenu(null); const ev = retreat(b); saveBattle(b); void playEvents(ev); bump(); }}>退却する</button>
          </div>
        </Modal>
      )}
      {menu === 'log' && (
        <Modal title="合戦の記録" onClose={() => setMenu(null)} className="log-modal">
          <div className="log-list">{[...b.log].reverse().map((t, i) => <div key={i} className="msg">{t}</div>)}</div>
        </Modal>
      )}
      {menu === 'info' && infoUnit && (
        <Modal title={infoUnit.name} onClose={() => { setMenu(null); setInfo(null); }}>
          <div className="unit-info">
            <img src={bustUrl(infoUnit.portrait)} alt="" />
            <div>
              <p><KindMark kind={infoUnit.kind} /> {KINDS[infoUnit.kind].name}・Lv{infoUnit.lv}・{infoUnit.side === 'L' ? '味方' : '敵'}・{infoUnit.row === 0 ? '前衛' : '後衛'}</p>
              <p>兵 {infoUnit.troops}/{infoUnit.maxTroops}・技数 {infoUnit.ap}/{infoUnit.apMax}</p>
              <p className="stats">攻{infoUnit.atk} 防{infoUnit.def} 知{infoUnit.int} 速{infoUnit.spd}</p>
              {infoUnit.guarding && <p className="stats">ガード {Math.round(infoUnit.guard * 100)}%（{infoUnit.guardAll ? '全員をかばう' : '同じ列をかばう'}）</p>}
              {(infoUnit.buffs.atk !== 0 || infoUnit.buffs.def > 0 || infoUnit.buffs.spd > 0) && <p className="stats">付与：攻{Math.round(infoUnit.buffs.atk * 100)}% 防{Math.round(infoUnit.buffs.def * 100)}% 速{Math.round(infoUnit.buffs.spd * 100)}%</p>}
              {infoUnit.prep && <p className="stats">「{battleSkill(infoUnit.prep.skill).name}」の準備中</p>}
            </div>
          </div>
          <h4>技</h4>
          {infoUnit.skills.map((sid) => { const s = battleSkill(sid); return <p key={sid} className="stats"><b style={{ color: s.color }}>{s.name}</b>（{RANGE_NAME[s.range]}・消費{s.cost === 'all' ? '全' : s.cost}）{s.desc}</p>; })}
          <p className="note">{KINDS[infoUnit.kind].desc}</p>
        </Modal>
      )}
    </div>
  );
}
