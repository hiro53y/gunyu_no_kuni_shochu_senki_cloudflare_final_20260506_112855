// 持ち物：一覧・説明・使う／装備／投げる／置く／壺に入れる・見る／名前を付ける
import { useState } from 'react';
import { CAT_NAME, ITEMS, itemDef } from '../content/items';
import { isEquipped, typeKnown } from '../engine/core';
import { MAX_INV } from '../engine/actors';
import type { Action, Item, Run } from '../engine/types';
import { ItemIcon, Modal, itemDescription, itemLabel, priceOf } from './common';
import { PriceHint } from './Panels';

type Sub =
  | { k: 'list' }
  | { k: 'detail'; uid: number }
  | { k: 'put'; potUid: number }
  | { k: 'pot'; uid: number }
  | { k: 'identify'; uid: number }
  | { k: 'write'; uid: number }
  | { k: 'name'; uid: number };

export function Inventory({ run, onAction, onClose }: { run: Run; onAction: (a: Action) => void; onClose: () => void }) {
  const [state, setSub] = useState<Sub>({ k: 'list' });
  const [name, setName] = useState('');
  const p = run.player;
  // 選んでいた物が無くなっていたら一覧に戻る
  const exists = (uid: number) => p.inv.some((i) => i.uid === uid);
  const sub: Sub = 'uid' in state && !exists(state.uid) ? { k: 'list' } : state.k === 'put' && !exists(state.potUid) ? { k: 'list' } : state;
  const items = [...p.inv];
  const find = (uid: number) => p.inv.find((i) => i.uid === uid) ?? null;
  const foot = run.floor.items.find((fi) => fi.x === p.x && fi.y === p.y);
  const act = (a: Action) => { onAction(a); onClose(); };

  const row = (item: Item, onClick: () => void, extra?: string) => (
    <button key={item.uid} className={`inv-row ${isEquipped(run, item) ? 'equipped' : ''} ${item.shop ? 'unpaid' : ''}`} onClick={onClick}>
      <ItemIcon id={item.id} size={30} />
      <span className="inv-name">
        {isEquipped(run, item) && <b className="eq-mark">E</b>}
        {itemLabel(run, item)}
        {item.shop && <small className="price-tag">{priceOf(item)}文</small>}
      </span>
      {extra && <small className="inv-extra">{extra}</small>}
    </button>
  );

  if (sub.k === 'list') {
    return (
      <Modal title={`持ち物 ${p.inv.length}/${MAX_INV}`} onClose={onClose} className="inventory">
        {items.length === 0 && <p className="empty">何も持っていない。</p>}
        {items.length > 1 && <div className="row-buttons top"><button className="small" onClick={() => onAction({ t: 'sort' })}>整頓</button></div>}
        <div className="inv-list">{items.map((item) => row(item, () => setSub({ k: 'detail', uid: item.uid })))}</div>
        {foot && (
          <div className="foot-box">
            <span>足元：</span>
            <ItemIcon id={foot.item.id} size={26} />
            <span className="foot-name">{itemLabel(run, foot.item)}{foot.item.shop ? `（${priceOf(foot.item)}文）` : ''}</span>
            <button className="small" onClick={() => act({ t: 'pickup' })}>拾う</button>
          </div>
        )}
      </Modal>
    );
  }

  if (sub.k === 'put') {
    const pot = find(sub.potUid);
    if (!pot) return null;
    return (
      <Modal title={`${itemLabel(run, pot)}に入れる物`} onClose={() => setSub({ k: 'detail', uid: pot.uid })} className="inventory">
        <div className="inv-list">{items.filter((i) => i !== pot).map((item) => row(item, () => act({ t: 'item', uid: item.uid, verb: 'put', target: pot.uid })))}</div>
      </Modal>
    );
  }

  if (sub.k === 'pot') {
    const pot = find(sub.uid);
    if (!pot) return null;
    const canTake = pot.id === 'p_hozon' && typeKnown(run, pot.id);
    return (
      <Modal title={`${itemLabel(run, pot)}の中身`} onClose={() => setSub({ k: 'detail', uid: pot.uid })} className="inventory">
        {(pot.contents ?? []).length === 0 && <p className="empty">何も入っていない。</p>}
        <div className="inv-list">
          {(pot.contents ?? []).map((inner) => row(inner, () => { if (canTake) act({ t: 'item', uid: pot.uid, verb: 'take', target: inner.uid }); }, canTake ? '取り出す' : undefined))}
        </div>
        {!canTake && (pot.contents ?? []).length > 0 && <p className="note">この壺からは取り出せない。割れば中身が出てくる。</p>}
      </Modal>
    );
  }

  if (sub.k === 'identify') {
    const scroll = find(sub.uid);
    if (!scroll) return null;
    const targets = items.filter((i) => i !== scroll && (!typeKnown(run, i.id) || !i.known));
    return (
      <Modal title="何を識別する？" onClose={() => setSub({ k: 'detail', uid: scroll.uid })} className="inventory">
        {targets.length === 0 && <p className="empty">識別が必要な物はない。</p>}
        <div className="inv-list">{targets.map((item) => row(item, () => act({ t: 'item', uid: scroll.uid, verb: 'use', target: item.uid })))}</div>
      </Modal>
    );
  }

  if (sub.k === 'write') {
    const blank = find(sub.uid);
    if (!blank) return null;
    const scrolls = ITEMS.filter((d) => d.cat === 'scroll' && d.id !== 's_hakushi' && run.known[d.id]);
    return (
      <Modal title="何と書く？" onClose={() => setSub({ k: 'detail', uid: blank.uid })} className="inventory">
        {scrolls.length === 0 && <p className="empty">書けるのは、正体の分かった巻物の名前だけ。</p>}
        <div className="inv-list">
          {scrolls.map((d) => (
            <button key={d.id} className="inv-row" onClick={() => act({ t: 'item', uid: blank.uid, verb: 'use', scroll: d.id })}>
              <ItemIcon id={d.id} size={30} /><span className="inv-name">{d.name}</span>
            </button>
          ))}
        </div>
      </Modal>
    );
  }

  if (sub.k === 'name') {
    const item = find(sub.uid);
    if (!item) return null;
    return (
      <Modal title="名前を付ける" onClose={() => setSub({ k: 'detail', uid: item.uid })}>
        <p className="note">同じ種類の物すべてに付きます（12文字まで）。空にすると消えます。</p>
        <input className="text-input" value={name} maxLength={12} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="row-buttons">
          <button onClick={() => { onAction({ t: 'item', uid: item.uid, verb: 'name', name }); setSub({ k: 'detail', uid: item.uid }); }}>決める</button>
        </div>
      </Modal>
    );
  }

  // 説明と操作
  const item = find(sub.uid);
  if (!item) return null;
  const def = itemDef(item.id);
  const known = typeKnown(run, item.id);
  const eq = isEquipped(run, item);
  const verbs: { label: string; run: () => void; primary?: boolean }[] = [];
  const use = (label: string) => verbs.push({ label, primary: true, run: () => act({ t: 'item', uid: item.uid, verb: 'use' }) });
  switch (def.cat) {
    case 'grass': use('飲む'); break;
    case 'food': use('食べる'); break;
    case 'scroll':
      if (known && item.id === 's_shikibetsu') verbs.push({ label: '読む', primary: true, run: () => setSub({ k: 'identify', uid: item.uid }) });
      else if (known && item.id === 's_hakushi') verbs.push({ label: '書いて読む', primary: true, run: () => setSub({ k: 'write', uid: item.uid }) });
      else use('読む');
      break;
    case 'staff': use('振る'); break;
    case 'pot':
      verbs.push({ label: '入れる', primary: true, run: () => setSub({ k: 'put', potUid: item.uid }) });
      verbs.push({ label: '中を見る', run: () => setSub({ k: 'pot', uid: item.uid }) });
      break;
    case 'weapon': case 'armor': case 'charm': case 'arrow':
      verbs.push({ label: eq ? '外す' : '装備する', primary: true, run: () => act({ t: 'item', uid: item.uid, verb: eq ? 'unequip' : 'equip' }) });
      if (def.cat === 'arrow' && eq) verbs.push({ label: '撃つ', run: () => act({ t: 'shoot' }) });
      break;
    default:
  }
  verbs.push({ label: '投げる', run: () => act({ t: 'item', uid: item.uid, verb: 'throw' }) });
  verbs.push({ label: foot ? '足元と交換' : '置く', run: () => act(foot ? { t: 'swapFoot', uid: item.uid } : { t: 'item', uid: item.uid, verb: 'drop' }) });
  if (!known) verbs.push({ label: '名前を付ける', run: () => { setName(run.named[item.id] ?? ''); setSub({ k: 'name', uid: item.uid }); } });
  return (
    <Modal title={itemLabel(run, item)} onClose={() => setSub({ k: 'list' })} className="inventory">
      <div className="item-detail">
        <ItemIcon id={item.id} size={64} />
        <div>
          <div className="cat-chip">{CAT_NAME[def.cat]}{eq ? '・装備中' : ''}</div>
          <p className="desc">{itemDescription(run, item)}</p>
          {item.shop && <p className="price">店の品：{priceOf(item)}文（まだ払っていない）</p>}
          {item.shop && <PriceHint run={run} item={item} />}
        </div>
      </div>
      <div className="verb-grid">
        {verbs.map((v) => <button key={v.label} className={v.primary ? 'primary' : ''} onClick={v.run}>{v.label}</button>)}
      </div>
      <p className="note">投げる・振るは、いま向いている方向へ飛びます。</p>
    </Modal>
  );
}
