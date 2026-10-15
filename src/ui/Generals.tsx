// 武将の一覧と詳しい情報（兵種・兵数・能力・技・絆・交流）
import { useState } from 'react';
import { FACTIONS } from '../content/sengoku';
import { GENERALS, GEN_BY_ID, LORD } from '../content/generals';
import { KINDS, RANGE_NAME, battleSkill } from '../battle/kinds';
import type { Campaign, GenState, Scene } from '../campaign/state';
import { bondError, doBond, expFor, genInfo, maxTroops } from '../campaign/campaign';
import { genPower, unitSkills } from '../campaign/army';
import { KindMark, Modal, bustUrl, tokenUrl } from './common';
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
              const max = maxTroops(c, id);
              return (
                <button key={id} className="gen-card" onClick={() => { playSe('menu'); setSel(id); }}>
                  <img src={tokenUrl(info.portrait)} alt="" width={42} height={42} />
                  <span className="gc-main">
                    <b>{info.name}</b> <small><KindMark kind={g.kind} size={14} /> {KINDS[g.kind].name}・Lv{g.lv}・{info.role}</small>
                    <span className="troop-bar"><span style={{ width: `${(g.troops / max) * 100}%` }} /></span>
                    <small>兵 {g.troops}/{max}{id !== LORD && info.unique ? `・絆${'♥'.repeat(g.bond)}${'♡'.repeat(Math.max(0, 2 - g.bond))}` : ''}</small>
                    {g.injured > 0 && <small className="bad">傷を癒やしている（あと{g.injured}季節）</small>}
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
                      <span className="gc-main"><b>{info.name}</b><small>{FACTIONS[g.faction].name}・{KINDS[g.kind].name}・Lv{g.lv}</small></span>
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
  const pw = genPower(c, id);
  const skills = unitSkills(c, id, true);
  const err = isLord ? '当主' : bondError(c, id);
  const def = GEN_BY_ID[id];
  const locked = info.skills.filter((s) => !skills.includes(s));
  return (
    <Modal title={info.name} onClose={onBack} className="inventory gen-detail">
      <div className="gd-top">
        <img className="gd-bust" src={bustUrl(info.portrait)} alt="" />
        <div className="gd-stats">
          <p className="gd-role">{info.role}</p>
          <p><KindMark kind={g.kind} /> {KINDS[g.kind].name}・Lv <b>{g.lv}</b>（次まで {Math.max(0, expFor(g.lv + 1) - g.exp)}）</p>
          <p>兵 {g.troops}/{maxTroops(c, id)}・技数 {KINDS[g.kind].ap + Math.floor(g.lv / 10)}</p>
          <p className="stats">攻{pw.atk} 防{pw.def} 知{pw.int} 速{pw.spd}</p>
          <p className="stats">統{info.cmd} 武{info.pow} 知{info.int}</p>
          {!isLord && info.unique && <p>絆 {'♥'.repeat(g.bond)}{'♡'.repeat(Math.max(0, (def?.bond.length ?? 2) - g.bond))}</p>}
        </div>
      </div>
      <p className="desc">{info.desc}</p>
      <p className="note">{KINDS[g.kind].desc}</p>
      <h4>合戦の技</h4>
      {skills.map((sid) => {
        const s = battleSkill(sid);
        return (
          <div key={sid} className="skill-row">
            <b style={{ color: s.color }}>{s.name}</b>
            <small>{RANGE_NAME[s.range]}・消費{s.cost === 'all' ? '全' : s.cost}・硬直{s.stiff}{s.prep ? '・要準備' : ''}　{s.desc}</small>
          </div>
        );
      })}
      {locked.map((sid) => (
        <div key={sid} className="skill-row locked">
          <b>{battleSkill(sid).name}</b>
          <small>{isLord ? '国を5つ取ると使える。' : '絆が深まると使える。'}</small>
        </div>
      ))}
      {KINDS[g.kind].skills.filter(([sid, lv]) => lv > g.lv && !skills.includes(sid)).map(([sid, lv]) => (
        <div key={sid} className="skill-row locked"><b>{battleSkill(sid).name}</b><small>Lv{lv}で覚える。</small></div>
      ))}
      {!isLord && (
        <div className="row-buttons">
          <button onClick={onBack}>戻る</button>
          <button className="primary" disabled={!!err} onClick={() => { playSe('menu'); onBond(); }}>交流する（行動1）{err ? <small>{err}</small> : null}</button>
        </div>
      )}
    </Modal>
  );
}
