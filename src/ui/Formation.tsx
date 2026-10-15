// 陣立て：出す武将（朔を含め6部隊まで）を前衛・後衛の枠に置く。敵の顔ぶれも見える
import { useMemo, useState } from 'react';
import { regionDef } from '../content/sengoku';
import { LORD } from '../content/generals';
import { KINDS, battleSkill } from '../battle/kinds';
import type { UnitSpec } from '../battle/engine';
import type { BattleKind } from '../battle/types';
import type { Campaign, Invasion, Placement, Sortie } from '../campaign/state';
import { MAX_PARTY, forts, genInfo, huntDanger, invasionDanger, maxTroops } from '../campaign/campaign';
import { autoPlace, genPower, huntArmy, invasionArmy, siegeArmy, unitSkills } from '../campaign/army';
import { KindMark, Modal, bustUrl, tokenUrl } from './common';
import { playSe } from '../audio/sound';

const MODE_TITLE: Record<BattleKind, string> = { siege: '出陣', defense: '迎え撃つ', hunt: '妖魔討伐', field: '合戦' };

/** 出陣前に、敵の部隊を作ってみる（同じ seed なら本番も同じ） */
export function previewEnemy(c: Campaign, mode: BattleKind, rid: string, seed: number, inv?: Invasion): UnitSpec[] {
  const so: Sortie = { mode, region: rid, party: [], invasion: inv, fort: mode === 'siege' ? c.regions[rid].taken : undefined, temps: {} };
  if (mode === 'siege') return siegeArmy(c, so, seed);
  if (mode === 'defense' && inv) return invasionArmy(c, so, inv, seed, invasionDanger(c, inv.from));
  return huntArmy(c, so, seed, huntDanger(c, rid));
}

const key = (row: number, slot: number) => `${row}${slot}`;

export function Formation({ c, mode, region, seed, inv, onGo, onClose }: { c: Campaign; mode: BattleKind; region: string; seed: number; inv?: Invasion; onGo: (party: Placement[]) => void; onClose?: () => void }) {
  const ready = Object.values(c.gens).filter((g) => g.status === 'ours');
  const usable = (id: string) => c.gens[id].injured <= 0 && c.gens[id].troops > 0;
  const [slots, setSlots] = useState<Record<string, string>>(() => {
    const score = (id: string) => { const p = genPower(c, id); return (p.atk + p.def + p.int) * Math.sqrt(c.gens[id].troops); };
    const list = ready.filter((g) => g.id !== LORD && usable(g.id)).sort((a, b) => score(b.id) - score(a.id)).slice(0, MAX_PARTY - 1);
    const out: Record<string, string> = {};
    for (const p of autoPlace([c.gens[LORD], ...list].filter((g) => usable(g.id)).map((g) => ({ id: g.id, kind: g.kind })))) out[key(p.row, p.slot)] = p.gen;
    return out;
  });
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<'army' | 'enemy'>('army');
  const enemy = useMemo(() => previewEnemy(c, mode, region, seed, inv), [c, mode, region, seed, inv]);
  const placedIds = new Set(Object.values(slots));
  const r = regionDef(region);
  const lordPlaced = placedIds.has(LORD);

  const assign = (id: string) => {
    playSe('menu');
    const next = { ...slots };
    const cur = Object.keys(next).find((k) => next[k] === id);
    if (sel) {
      const prev = next[sel];
      if (cur) { if (prev) next[cur] = prev; else delete next[cur]; }
      next[sel] = id;
      setSel(null);
    } else if (cur) {
      if (id === LORD) return;
      delete next[cur];
    } else {
      const empty = ['00', '01', '02', '10', '11', '12'].filter((k) => !next[k]);
      const want = KINDS[c.gens[id].kind].front ? empty.find((k) => k[0] === '0') ?? empty[0] : empty.find((k) => k[0] === '1') ?? empty[0];
      if (!want) return;
      next[want] = id;
    }
    setSlots(next);
  };
  const tapSlot = (k: string) => {
    playSe('menu');
    if (sel === k) { setSel(null); return; }
    if (sel && (slots[sel] || slots[k])) {
      const next = { ...slots };
      const a = next[sel], b = next[k];
      if (a) next[k] = a; else delete next[k];
      if (b) next[sel] = b; else delete next[sel];
      setSlots(next);
      setSel(null);
      return;
    }
    setSel(k);
  };
  const go = () => {
    const party: Placement[] = Object.entries(slots).map(([k, gen]) => ({ gen, row: Number(k[0]) as 0 | 1, slot: Number(k[1]) as 0 | 1 | 2 }));
    playSe('menu');
    onGo(party);
  };
  const cell = (k: string) => {
    const id = slots[k];
    const g = id ? c.gens[id] : null;
    const info = id ? genInfo(c, id) : null;
    return (
      <button key={k} className={`form-slot ${sel === k ? 'sel' : ''} ${id ? '' : 'empty'}`} onClick={() => tapSlot(k)}>
        {info && g ? (
          <>
            <img src={tokenUrl(info.portrait)} alt="" />
            <span className="fs-name">{info.short}</span>
            <span className="fs-kind"><KindMark kind={g.kind} size={14} />{g.troops}</span>
          </>
        ) : <span className="fs-empty">{k[0] === '0' ? '前衛' : '後衛'}</span>}
      </button>
    );
  };
  const title = mode === 'siege' ? `${MODE_TITLE[mode]}：${r.name}（砦 ${c.regions[region].taken + 1}/${forts(region)}）` : `${MODE_TITLE[mode]}：${r.name}`;
  return (
    <Modal title={title} onClose={onClose} className="inventory formation">
      <div className="tabs seg">
        <button className={tab === 'army' ? 'on' : ''} onClick={() => setTab('army')}>陣立て {placedIds.size}/{MAX_PARTY}</button>
        <button className={tab === 'enemy' ? 'on' : ''} onClick={() => setTab('enemy')}>敵の部隊 {enemy.length}</button>
      </div>
      {tab === 'army' && (
        <>
          <div className="form-grid">
            <div className="fg-col"><small>後衛</small>{[0, 1, 2].map((s) => cell(key(1, s)))}</div>
            <div className="fg-col"><small>前衛</small>{[0, 1, 2].map((s) => cell(key(0, s)))}</div>
            <div className="fg-arrow">▶<small>敵</small></div>
          </div>
          <p className="note">{sel ? '置く武将を下から選ぶか、入れ替える枠を押してください。' : '枠を押して選び、武将を置く・入れ替える。前衛は近距離の技が使え、狙われやすい。足軽は同じ列の味方をかばう。'}</p>
          <div className="gen-pick">
            {ready.sort((a, b) => (a.id === LORD ? -1 : b.id === LORD ? 1 : b.lv - a.lv)).map((g) => {
              const info = genInfo(c, g.id);
              const ok = usable(g.id);
              const on = placedIds.has(g.id);
              return (
                <button key={g.id} className={`gen-card ${on ? 'on' : ''}`} disabled={!ok} onClick={() => assign(g.id)}>
                  <img src={tokenUrl(info.portrait)} alt="" width={40} height={40} />
                  <span className="gc-main">
                    <b>{info.name}</b> <small><KindMark kind={g.kind} size={14} /> {KINDS[g.kind].name}・Lv{g.lv}・兵{g.troops}/{maxTroops(c, g.id)}</small>
                    <small>技 {unitSkills(c, g.id, true).map((s) => battleSkill(s).name).join('・')}</small>
                    {!ok && <small className="bad">{g.injured > 0 ? `傷を癒やしている（あと${g.injured}季節）` : '兵がいない（城下で補充）'}</small>}
                  </span>
                  {on && <span className="check">{g.id === LORD ? '大将' : '出陣'}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
      {tab === 'enemy' && (
        <div className="gen-pick">
          {enemy.map((u) => (
            <div key={u.gen} className="gen-card static">
              <img src={tokenUrl(u.portrait)} alt="" width={40} height={40} className={u.boss ? 'boss' : ''} />
              <span className="gc-main">
                <b>{u.name}</b>{u.boss && <small className="bad"> 大将</small>} <small><KindMark kind={u.kind} size={14} /> {KINDS[u.kind].name}・Lv{u.lv}・兵{u.troops}・{u.row === 0 ? '前衛' : '後衛'}</small>
                <small>技 {u.skills.map((s) => battleSkill(s).name).join('・')}</small>
              </span>
            </div>
          ))}
          {mode === 'siege' && <p className="note">{c.regions[region].taken + 1 >= forts(region) ? '本城の合戦。勝てば国が手に入る。' : `勝つと砦を1つ落とす。すべて落とすと国が手に入る。`}</p>}
          <img className="enemy-bust" src={bustUrl(enemy.find((u) => u.boss)?.portrait ?? enemy[0]?.portrait ?? 'generic_normal')} alt="" />
        </div>
      )}
      <div className="row-buttons">
        {onClose && <button onClick={onClose}>やめる</button>}
        <button className="primary" disabled={!lordPlaced} onClick={go}>{mode === 'defense' ? '迎え撃つ！' : '出陣！'}{!lordPlaced && <small>朔を置いてください</small>}</button>
      </div>
    </Modal>
  );
}
