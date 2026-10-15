// 出陣の編成：連れていく武将（2人まで）と持ち物（10個まで）
import { useMemo, useState } from 'react';
import { itemDef } from '../content/items';
import { skillDef } from '../content/skills';
import { regionDef } from '../content/sengoku';
import type { Campaign } from '../campaign/state';
import { activeSkills, castleDanger, genInfo, MAX_CARRY, MAX_PARTY, ourGenerals, specOf } from '../campaign/campaign';
import { genStats } from '../engine/generals';
import type { RunMode } from '../engine/types';
import { tokenUrl } from '../render/sprites';
import { ItemIcon, Modal, itemLabel, storeLabel } from './common';
import { playSe } from '../audio/sound';

const MODE_TITLE: Record<RunMode, string> = { siege: '出陣', defense: '迎え撃つ', hunt: '修行（妖魔の巣）', practice: '道場' };

/** 持っていくと良さそうな物を最初から選んでおく */
function defaultCarry(c: Campaign): number[] {
  const eq = new Set(Object.values(c.eq));
  const score = (id: string) => {
    const cat = itemDef(id).cat;
    if (['g_yakusou', 'g_daiyakusou', 'g_fukkatsu'].includes(id)) return 10;
    if (cat === 'food') return 8;
    if (id === 's_kikan') return 7;
    return 0;
  };
  return c.store.filter((i) => !eq.has(i.uid) && score(i.id) > 0).sort((a, b) => score(b.id) - score(a.id)).slice(0, MAX_CARRY).map((i) => i.uid);
}

export function Formation({ c, mode, region, onGo, onClose }: { c: Campaign; mode: RunMode; region: string; onGo: (party: string[], carry: number[]) => void; onClose?: () => void }) {
  const gens = ourGenerals(c).sort((a, b) => (a.injured > 0 ? 1 : 0) - (b.injured > 0 ? 1 : 0) || b.lv - a.lv);
  const [party, setParty] = useState<string[]>(() => gens.filter((g) => g.injured <= 0).slice(0, MAX_PARTY).map((g) => g.id));
  const [carry, setCarry] = useState<number[]>(() => defaultCarry(c));
  const [tab, setTab] = useState<'party' | 'items'>('party');
  const eq = new Set(Object.values(c.eq));
  const items = useMemo(() => c.store.filter((i) => !eq.has(i.uid)), [c.store, eq]);
  const r = regionDef(region);
  const toggleGen = (id: string) => {
    playSe('menu');
    setParty((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_PARTY ? [...p.slice(1), id] : [...p, id]));
  };
  const toggleItem = (uid: number) => {
    playSe('menu');
    setCarry((list) => (list.includes(uid) ? list.filter((x) => x !== uid) : list.length >= MAX_CARRY ? list : [...list, uid]));
  };
  const danger = mode === 'siege' ? castleDanger(c, region) : null;
  return (
    <Modal title={`${MODE_TITLE[mode]}：${r.name}`} onClose={onClose} className="inventory formation">
      {mode === 'siege' && <p className="note">{r.floors}階の城（強さ{danger}・朔 Lv{c.lord.lv}）。{c.regions[region].breach > 0 ? `城門は${c.regions[region].breach}階まで破ってある。` : ''}</p>}
      {mode === 'defense' && <p className="note">野戦で敵の大将を討てば勝ち。負けるとこの国を失う。</p>}
      {mode === 'hunt' && <p className="note">3階の妖魔の巣。奥まで祓えば、経験と文が手に入る。</p>}
      <div className="tabs seg">
        <button className={tab === 'party' ? 'on' : ''} onClick={() => setTab('party')}>武将 {party.length}/{MAX_PARTY}</button>
        <button className={tab === 'items' ? 'on' : ''} onClick={() => setTab('items')}>持ち物 {carry.length}/{MAX_CARRY}</button>
      </div>
      {tab === 'party' && (
        <div className="gen-pick">
          {gens.length === 0 && <p className="empty">まだ家臣がいない。</p>}
          {gens.map((g) => {
            const info = genInfo(c, g.id);
            const st = genStats(specOf(c, g.id, true));
            const on = party.includes(g.id);
            return (
              <button key={g.id} className={`gen-card ${on ? 'on' : ''}`} disabled={g.injured > 0} onClick={() => toggleGen(g.id)}>
                <img src={tokenUrl(info.portrait)} alt="" width={42} height={42} />
                <span className="gc-main">
                  <b>{info.name}</b> <small>Lv{g.lv}・{info.role}</small>
                  <small>HP{st.maxHp} 攻{Math.round(st.atk)}・技 {activeSkills(c, g.id).map((s) => skillDef(s).name).join('・')}</small>
                  {g.injured > 0 && <small className="bad">傷を癒やしている（あと{g.injured}ターン）</small>}
                </span>
                {on && <span className="check">出陣</span>}
              </button>
            );
          })}
        </div>
      )}
      {tab === 'items' && (
        <>
          <p className="note">装備（{['weapon', 'armor', 'charm', 'arrow'].map((s) => { const it = c.store.find((i) => i.uid === c.eq[s as 'weapon']); return it ? itemLabel(null, it) : null; }).filter(Boolean).join('・') || 'なし'}）は必ず持っていく。負けると装備以外は失う。</p>
          <div className="inv-list">
            {items.length === 0 && <p className="empty">蔵は空っぽ。</p>}
            {items.map((item) => (
              <button key={item.uid} className={`inv-row ${carry.includes(item.uid) ? 'equipped' : ''}`} onClick={() => toggleItem(item.uid)}>
                <ItemIcon id={item.id} size={28} />
                <span className="inv-name">{storeLabel(c, item)}</span>
                {carry.includes(item.uid) && <small className="inv-extra">持つ</small>}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="row-buttons">
        {onClose && <button onClick={onClose}>やめる</button>}
        <button className="primary" onClick={() => { playSe('menu'); onGo(party, carry); }}>{mode === 'defense' ? '迎え撃つ！' : '出陣！'}</button>
      </div>
    </Modal>
  );
}
