// 城下：蔵（装備・売る）・商人・鍛冶・浪人宿
import { useState } from 'react';
import { CAT_NAME, itemDef } from '../content/items';
import { skillDef } from '../content/skills';
import type { Campaign } from '../campaign/state';
import { buy, equipStore, genInfo, hire, isEquippedStore, MAX_STORE, roninList, sellStore, smith, smithCost, stockPrice } from '../campaign/campaign';
import { sellPrice } from '../engine/core';
import type { Item } from '../engine/types';
import { tokenUrl } from '../render/sprites';
import { ItemIcon, Modal, itemLabel, storeLabel } from './common';
import { playSe } from '../audio/sound';

type Tab = 'store' | 'shop' | 'smith' | 'ronin';

function describe(item: Item): string {
  const def = itemDef(item.id);
  let t = def.desc;
  if (def.cat === 'weapon' || def.cat === 'armor') t += `（${def.cat === 'weapon' ? '攻撃' : '防御'} ${def.power}${item.plus ? ` ${item.plus > 0 ? '+' : ''}${item.plus}` : ''}）`;
  if (item.cursed) t += '　呪われている。';
  return t;
}

export function TownPanel({ c, onChange, onClose }: { c: Campaign; onChange: () => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('store');
  const [msg, setMsg] = useState('');
  const [sel, setSel] = useState<number | null>(null);
  const done = (text: string) => { setMsg(text); onChange(); };
  const selected = sel !== null ? c.store.find((i) => i.uid === sel) ?? null : null;
  const known = (id: string) => !['grass', 'scroll', 'staff', 'pot', 'charm'].includes(itemDef(id).cat) || !!c.known[id];
  const label = (item: Item) => storeLabel(c, item);
  return (
    <Modal title="城下" onClose={onClose} className="inventory town">
      <div className="tabs seg">
        {([['store', '蔵'], ['shop', '商人'], ['smith', '鍛冶'], ['ronin', '浪人宿']] as [Tab, string][]).map(([k, t]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setMsg(''); setSel(null); }}>{t}</button>
        ))}
      </div>
      <p className="note">文 {c.gold.toLocaleString()}・蔵 {c.store.length}/{MAX_STORE}{msg ? `　${msg}` : ''}</p>
      {tab === 'store' && (
        <>
          {selected && (
            <div className="item-detail">
              <ItemIcon id={selected.id} size={44} />
              <div>
                <b>{label(selected)}</b>
                <p className="desc">{known(selected.id) ? describe(selected) : '正体の分からない道具。迷宮で使うか、識別すると分かる。'}</p>
                <div className="row-buttons">
                  {['weapon', 'armor', 'charm', 'arrow'].includes(itemDef(selected.id).cat) && (
                    <button onClick={() => { const e = equipStore(c, selected.uid); done(e ?? (isEquippedStore(c, selected.uid) ? '装備した' : '外した')); }}>{isEquippedStore(c, selected.uid) ? '外す' : '装備する'}</button>
                  )}
                  <button className="danger" disabled={isEquippedStore(c, selected.uid)} onClick={() => { const g = sellStore(c, selected.uid); setSel(null); done(`${g}文で売った`); playSe('coin'); }}>売る（{sellPrice(selected)}文）</button>
                </div>
              </div>
            </div>
          )}
          <div className="inv-list">
            {c.store.length === 0 && <p className="empty">蔵は空っぽ。</p>}
            {c.store.map((item) => (
              <button key={item.uid} className={`inv-row ${isEquippedStore(c, item.uid) ? 'equipped' : ''} ${sel === item.uid ? 'sel' : ''}`} onClick={() => { playSe('menu'); setSel(item.uid); }}>
                <ItemIcon id={item.id} size={28} />
                <span className="inv-name">{isEquippedStore(c, item.uid) && <b className="eq-mark">E</b>}{label(item)}</span>
                <small className="inv-extra">{CAT_NAME[itemDef(item.id).cat]}</small>
              </button>
            ))}
          </div>
        </>
      )}
      {tab === 'shop' && (
        <div className="inv-list">
          {c.stock.map((id) => (
            <button key={id} className="inv-row" disabled={c.gold < stockPrice(id)} onClick={() => { const e = buy(c, id); if (!e) playSe('coin'); done(e ?? `${itemDef(id).name}を買った`); }}>
              <ItemIcon id={id} size={28} />
              <span className="inv-name">{itemDef(id).name}<small className="sub">{itemDef(id).desc}</small></span>
              <small className="inv-extra">{stockPrice(id)}文</small>
            </button>
          ))}
          <p className="note">品ぞろえは季節ごとに変わり、国が増えると良い品が並ぶ。</p>
        </div>
      )}
      {tab === 'smith' && (
        <div className="inv-list">
          {c.store.filter((i) => ['weapon', 'armor'].includes(itemDef(i.id).cat)).map((item) => (
            <button key={item.uid} className={`inv-row ${isEquippedStore(c, item.uid) ? 'equipped' : ''}`} disabled={c.gold < smithCost(item)} onClick={() => { const e = smith(c, item.uid); if (!e) playSe('equip'); done(e ?? `${itemLabel(null, item)}に鍛えた`); }}>
              <ItemIcon id={item.id} size={28} />
              <span className="inv-name">{isEquippedStore(c, item.uid) && <b className="eq-mark">E</b>}{itemLabel(null, item)}</span>
              <small className="inv-extra">+1：{smithCost(item)}文</small>
            </button>
          ))}
          <p className="note">鍛えると呪いも解ける。</p>
        </div>
      )}
      {tab === 'ronin' && (
        <div className="gen-pick">
          {roninList(c).length === 0 && <p className="empty">今は誰もいない。</p>}
          {roninList(c).map((g) => {
            const info = genInfo(c, g.id);
            return (
              <button key={g.id} className="gen-card" disabled={c.gold < (g.wage ?? 0)} onClick={() => { const e = hire(c, g.id); if (!e) playSe('coin'); done(e ?? `${info.name}を雇った`); }}>
                <img src={tokenUrl(info.portrait)} alt="" width={42} height={42} />
                <span className="gc-main">
                  <b>{info.name}</b> <small>Lv{g.lv}・{info.role}</small>
                  <small>技 {info.skills.slice(0, 1).map((s) => skillDef(s).name).join('')}・統{info.cmd} 武{info.pow}</small>
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
