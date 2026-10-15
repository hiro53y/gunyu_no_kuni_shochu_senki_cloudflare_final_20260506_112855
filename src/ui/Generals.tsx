// 武将の一覧と詳しい情報（技・絆・交流）
import { useState } from 'react';
import { skillDef } from '../content/skills';
import { FACTIONS } from '../content/sengoku';
import { GENERALS, GEN_BY_ID, LORD } from '../content/generals';
import type { Campaign, GenState, Scene } from '../campaign/state';
import { activeSkills, bondError, doBond, genInfo, specOf } from '../campaign/campaign';
import { genStats } from '../engine/generals';
import { expFor } from '../engine/core';
import { bustUrl, tokenUrl } from '../render/sprites';
import { Modal } from './common';
import { playSe } from '../audio/sound';

const STATUS: Record<GenState['status'], string> = { ours: '家臣', enemy: '敵', jail: '牢', ronin: '浪人', gone: '' };

export function GeneralsPanel({ c, onChange, onScene, onClose }: { c: Campaign; onChange: () => void; onScene: (s: Scene) => void; onClose: () => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<'ours' | 'book'>('ours');
  const ours = [LORD, ...Object.values(c.gens).filter((g) => g.status === 'ours' && g.id !== LORD).sort((a, b) => b.lv - a.lv).map((g) => g.id)];
  const jail = Object.values(c.gens).filter((g) => g.status === 'jail' && !c.captives.includes(g.id));
  if (sel) {
    return <GeneralDetail c={c} id={sel} onBack={() => setSel(null)} onBond={() => { const s = doBond(c, sel); onChange(); onScene(s); }} />;
  }
  return (
    <Modal title="武将" onClose={onClose} className="inventory">
      <div className="tabs seg">
        <button className={tab === 'ours' ? 'on' : ''} onClick={() => setTab('ours')}>家臣 {ours.length}</button>
        <button className={tab === 'book' ? 'on' : ''} onClick={() => setTab('book')}>名鑑</button>
      </div>
      {tab === 'ours' && (
        <>
          <div className="gen-pick">
            {ours.map((id) => {
              const info = genInfo(c, id);
              const g = c.gens[id];
              const lv = id === LORD ? c.lord.lv : g.lv;
              return (
                <button key={id} className="gen-card" onClick={() => { playSe('menu'); setSel(id); }}>
                  <img src={tokenUrl(info.portrait)} alt="" width={42} height={42} />
                  <span className="gc-main">
                    <b>{info.name}</b> <small>Lv{lv}・{info.role}</small>
                    <small>技 {activeSkills(c, id).map((s) => skillDef(s).name).join('・')}{id !== LORD && info.unique ? `・絆${'♥'.repeat(g.bond)}${'♡'.repeat(Math.max(0, 2 - g.bond))}` : ''}</small>
                    {g?.injured > 0 && <small className="bad">傷を癒やしている（あと{g.injured}ターン）</small>}
                  </span>
                </button>
              );
            })}
          </div>
          {jail.length > 0 && (
            <>
              <h4>牢</h4>
              <p className="note">主家が滅ぶと、家臣になる。</p>
              <div className="gen-pick">
                {jail.map((g) => {
                  const info = genInfo(c, g.id);
                  return (
                    <div key={g.id} className="gen-card static">
                      <img src={tokenUrl(info.portrait)} alt="" width={42} height={42} />
                      <span className="gc-main"><b>{info.name}</b><small>{FACTIONS[g.faction].name}・Lv{g.lv}</small></span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
      {tab === 'book' && (
        <div className="gen-book">
          {GENERALS.map((def) => {
            const g = c.gens[def.id];
            const met = g && (g.status !== 'enemy' || def.faction === 'akatsuki');
            return (
              <div key={def.id} className={`book-gen ${met ? '' : 'unknown'}`} title={def.name}>
                <img src={tokenUrl(def.portrait)} alt="" width={48} height={48} />
                <small>{def.short}</small>
                <small className="sub">{g ? STATUS[g.status] || '討伐' : ''}</small>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function GeneralDetail({ c, id, onBack, onBond }: { c: Campaign; id: string; onBack: () => void; onBond: () => void }) {
  const info = genInfo(c, id);
  const g = c.gens[id];
  const isLord = id === LORD;
  const lv = isLord ? c.lord.lv : g.lv;
  const st = isLord ? null : genStats(specOf(c, id, true));
  const active = activeSkills(c, id);
  const err = isLord ? '当主' : bondError(c, id);
  const def = GEN_BY_ID[id];
  return (
    <Modal title={info.name} onClose={onBack} className="inventory gen-detail">
      <div className="gd-top">
        <img className="gd-bust" src={bustUrl(info.portrait)} alt="" />
        <div className="gd-stats">
          <p className="gd-role">{info.role}</p>
          <p>Lv <b>{lv}</b>{isLord ? `（次まで ${Math.max(0, expFor(lv + 1) - c.lord.exp)}）` : `（次まで ${Math.max(0, expFor(lv + 1) - g.exp)}）`}</p>
          {isLord ? <p>HP {c.lord.maxHp}・力 {c.lord.maxStr}</p> : <p>HP {st!.maxHp}・攻 {Math.round(st!.atk)}・防 {Math.round(st!.def)}</p>}
          <p className="stats">統{info.cmd} 武{info.pow} 知{info.int}</p>
          <p className="stats">{info.style === 'reach' ? '槍：2マス先まで届く' : info.style === 'bow' ? '弓：離れた敵を射る' : info.style === 'gun' ? '鉄砲：離れた敵を撃つ' : '刀：隣の敵を斬る'}</p>
          {!isLord && info.unique && <p>絆 {'♥'.repeat(g.bond)}{'♡'.repeat(Math.max(0, (def?.bond.length ?? 2) - g.bond))}</p>}
        </div>
      </div>
      <p className="desc">{info.desc}</p>
      <h4>技</h4>
      {info.skills.map((sid, i) => {
        const s = skillDef(sid);
        const on = active.includes(sid);
        return (
          <div key={sid} className={`skill-row ${on ? '' : 'locked'}`}>
            <b style={{ color: on ? s.color : undefined }}>{s.name}</b>
            <small>{on ? s.desc : isLord ? '国を5つ取ると目覚める。' : i === 1 && info.unique ? '絆が深まると覚える。' : ''}</small>
            {on && <small className="sub">待ち {s.cd}ターン</small>}
          </div>
        );
      })}
      {!isLord && (
        <div className="row-buttons">
          <button onClick={onBack}>戻る</button>
          <button className="primary" disabled={!!err} onClick={() => { playSe('menu'); onBond(); }}>交流する（行動1）{err ? <small>{err}</small> : null}</button>
        </div>
      )}
    </Modal>
  );
}
