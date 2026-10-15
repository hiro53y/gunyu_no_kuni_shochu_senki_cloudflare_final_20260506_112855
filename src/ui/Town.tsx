// 城下：傷ついた兵の手当て・増員（上限まで雇う）・浪人宿（扇を使わない）
import { useState } from 'react';
import { LORD } from '../content/generals';
import { KINDS } from '../battle/kinds';
import type { Campaign } from '../campaign/state';
import { genInfo, healCost, healNow, hire, hireCost, hireTroops, maxTroops, refillAll, roninList, upkeepOf } from '../campaign/campaign';
import { KindMark, Modal, tokenUrl } from './common';
import { playSe } from '../audio/sound';

type Tab = 'troops' | 'ronin';

export function TownPanel({ c, onChange, onClose }: { c: Campaign; onChange: () => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('troops');
  const [msg, setMsg] = useState('');
  const done = (text: string) => { setMsg(text); onChange(); };
  const ours = Object.values(c.gens).filter((g) => g.status === 'ours').sort((a, b) => (a.id === LORD ? -1 : b.id === LORD ? 1 : b.lv - a.lv));
  const total = ours.reduce((s, g) => s + healCost(c, g.id) + hireCost(c, g.id), 0);
  return (
    <Modal title="城下" onClose={onClose} className="inventory town">
      <div className="tabs seg">
        {([['troops', '兵の手当て・増員'], ['ronin', '浪人宿']] as [Tab, string][]).map(([k, t]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setMsg(''); }}>{t}</button>
        ))}
      </div>
      <p className="note">文 {c.gold.toLocaleString()}{msg ? `　${msg}` : ''}</p>
      {tab === 'troops' && (
        <>
          <div className="row-buttons">
            <button className="primary" disabled={total <= 0 || c.gold <= 0} onClick={() => { const n = refillAll(c); playSe('coin'); done(n ? `${n}部隊の兵を整えた` : '整えられなかった'); }}>
              全員を整える（{total.toLocaleString()}文）
            </button>
          </div>
          <p className="note">合戦で減った兵は「傷ついた兵」になり、その季節に戦わなければ次の季節に戻る。すぐ戻すなら手当て（10人あたり足軽1文・他4文）。上限まで新しく雇うのは増員（兵種で値段が違い、鉄砲が高い）。僧兵は季節ごとに兵がすべて戻る。</p>
          <div className="gen-pick">
            {ours.map((g) => {
              const info = genInfo(c, g.id);
              const max = maxTroops(c, g.id);
              const hc = healCost(c, g.id);
              const ic = hireCost(c, g.id);
              return (
                <div key={g.id} className="gen-card static town-row">
                  <img src={tokenUrl(info.portrait)} alt="" width={40} height={40} />
                  <span className="gc-main">
                    <b>{info.name}</b> <small><KindMark kind={g.kind} size={14} /> {KINDS[g.kind].name}・Lv{g.lv}{g.injured > 0 ? `・壊滅 あと${g.injured}季節` : ''}</small>
                    <span className="troop-bar">
                      <span style={{ width: `${(g.troops / max) * 100}%` }} />
                      <span className="wounded" style={{ width: `${(Math.min(g.wounded, max - g.troops) / max) * 100}%` }} />
                    </span>
                    <small>兵 {g.troops}/{max}{g.wounded ? `・傷 ${g.wounded}` : ''}・維持費{upkeepOf(g)}</small>
                  </span>
                  <span className="town-btns">
                    <button className="small" disabled={hc <= 0 || c.gold <= 0} onClick={() => { const e = healNow(c, g.id); if (!e) playSe('revive'); done(e ?? `${info.short}隊を手当てした`); }}>手当て<small>{hc > 0 ? `${hc}文` : '―'}</small></button>
                    <button className="small" disabled={ic <= 0 || c.gold <= 0} onClick={() => { const e = hireTroops(c, g.id); if (!e) playSe('coin'); done(e ?? `${info.short}隊を増員した`); }}>増員<small>{ic > 0 ? `${ic}文` : '満'}</small></button>
                  </span>
                </div>
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
