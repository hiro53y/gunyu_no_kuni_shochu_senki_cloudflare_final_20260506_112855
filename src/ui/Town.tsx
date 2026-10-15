// 城下：兵の補充・増員・浪人宿（行動を使わない）
import { useState } from 'react';
import { LORD } from '../content/generals';
import { KINDS } from '../battle/kinds';
import type { Campaign } from '../campaign/state';
import { addExtra, extraCost, genInfo, hire, maxTroops, refill, refillAll, refillCost, roninList } from '../campaign/campaign';
import { KindMark, Modal, tokenUrl } from './common';
import { playSe } from '../audio/sound';

type Tab = 'refill' | 'extra' | 'ronin';

export function TownPanel({ c, onChange, onClose }: { c: Campaign; onChange: () => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('refill');
  const [msg, setMsg] = useState('');
  const done = (text: string) => { setMsg(text); onChange(); };
  const ours = Object.values(c.gens).filter((g) => g.status === 'ours').sort((a, b) => (a.id === LORD ? -1 : b.id === LORD ? 1 : b.lv - a.lv));
  const totalRefill = ours.reduce((s, g) => s + refillCost(c, g.id), 0);
  return (
    <Modal title="城下" onClose={onClose} className="inventory town">
      <div className="tabs seg">
        {([['refill', '兵の補充'], ['extra', '増員'], ['ronin', '浪人宿']] as [Tab, string][]).map(([k, t]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setMsg(''); }}>{t}</button>
        ))}
      </div>
      <p className="note">文 {c.gold.toLocaleString()}{msg ? `　${msg}` : ''}</p>
      {tab === 'refill' && (
        <>
          <div className="row-buttons">
            <button className="primary" disabled={totalRefill <= 0 || c.gold <= 0} onClick={() => { const n = refillAll(c); playSe('coin'); done(n ? `${n}部隊に兵を補充した` : '補充できなかった'); }}>
              全員を補充（{totalRefill.toLocaleString()}文）
            </button>
          </div>
          <p className="note">兵が減った部隊は弱くなり、0だと出陣できない。兵は季節ごとに上限の1割まで自然に戻る。補充の値段は兵種で違う（足軽が安く、鉄砲が高い）。</p>
          <div className="gen-pick">
            {ours.map((g) => {
              const info = genInfo(c, g.id);
              const max = maxTroops(c, g.id);
              const cost = refillCost(c, g.id);
              return (
                <button key={g.id} className="gen-card" disabled={cost <= 0 || c.gold <= 0} onClick={() => { const e = refill(c, g.id); if (!e) playSe('coin'); done(e ?? `${info.short}隊に兵を補充した`); }}>
                  <img src={tokenUrl(info.portrait)} alt="" width={40} height={40} />
                  <span className="gc-main">
                    <b>{info.name}</b> <small><KindMark kind={g.kind} size={14} /> {KINDS[g.kind].name}・Lv{g.lv}{g.injured > 0 ? `・傷 あと${g.injured}季節` : ''}</small>
                    <span className="troop-bar"><span style={{ width: `${(g.troops / max) * 100}%` }} /></span>
                    <small>兵 {g.troops}/{max}</small>
                  </span>
                  <span className="check">{cost > 0 ? `${cost.toLocaleString()}文` : '満'}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      {tab === 'extra' && (
        <>
          <p className="note">増員すると、その武将の兵数の上限が上がる（兵種によって上がり方が違う）。上限は国が増えても上がる。</p>
          <div className="gen-pick">
            {ours.map((g) => {
              const info = genInfo(c, g.id);
              const cost = extraCost(g);
              return (
                <button key={g.id} className="gen-card" disabled={c.gold < cost || g.extra >= 10} onClick={() => { const e = addExtra(c, g.id); if (!e) playSe('lvup'); done(e ?? `${info.short}隊の上限が${maxTroops(c, g.id)}になった`); }}>
                  <img src={tokenUrl(info.portrait)} alt="" width={40} height={40} />
                  <span className="gc-main">
                    <b>{info.name}</b> <small><KindMark kind={g.kind} size={14} /> {KINDS[g.kind].name}・上限 {maxTroops(c, g.id)}・増員 {g.extra}回</small>
                  </span>
                  <span className="check">{g.extra >= 10 ? '最大' : `${cost.toLocaleString()}文`}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      {tab === 'ronin' && (
        <div className="gen-pick">
          {roninList(c).length === 0 && <p className="empty">今は誰もいない。</p>}
          {roninList(c).map((g) => {
            const info = genInfo(c, g.id);
            return (
              <button key={g.id} className="gen-card" disabled={c.gold < (g.wage ?? 0)} onClick={() => { const e = hire(c, g.id); if (!e) playSe('coin'); done(e ?? `${info.name}を雇った`); }}>
                <img src={tokenUrl(info.portrait)} alt="" width={40} height={40} />
                <span className="gc-main">
                  <b>{info.name}</b> <small><KindMark kind={g.kind} size={14} /> {KINDS[g.kind].name}・Lv{g.lv}・{info.role}</small>
                  <small>統{info.cmd} 武{info.pow} 知{info.int}</small>
                </span>
                <span className="check">{(g.wage ?? 0).toLocaleString()}文</span>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
