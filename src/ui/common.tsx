// 画面の共通部品：枠・絵・道具の説明
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CAT_NAME, itemDef } from '../content/items';
import { buyPrice, itemName, sealDesc, sealsOf, typeKnown } from '../engine/core';
import type { Item, Run } from '../engine/types';
import { itemSprite, loadSprites, monsterSprite, sprite } from '../render/sprites';
import { playSe } from '../audio/sound';

export function Modal(props: { title?: string; onClose?: () => void; children: ReactNode; wide?: boolean; className?: string }) {
  useEffect(() => {
    if (!props.onClose) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); props.onClose?.(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [props.onClose]);
  return (
    <div className="modal-back" onClick={() => props.onClose?.()}>
      <div className={`modal ${props.wide ? 'wide' : ''} ${props.className ?? ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={props.title}>
        {props.title && (
          <div className="modal-head">
            <h2>{props.title}</h2>
            {props.onClose && <button className="close" onClick={props.onClose} aria-label="閉じる">×</button>}
          </div>
        )}
        <div className="modal-body">{props.children}</div>
      </div>
    </div>
  );
}

/** 絵の読み込みを待つ */
export function useSpritesReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    loadSprites().then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);
  return ready;
}

function CanvasImg({ canvas, size, className, dim }: { canvas: HTMLCanvasElement | null; size: number; className?: string; dim?: boolean }) {
  const url = useMemo(() => (canvas ? canvas.toDataURL('image/png') : ''), [canvas]);
  if (!url) return <span className={`sprite-img ${className ?? ''}`} style={{ width: size, height: size }} />;
  return <img className={`sprite-img ${className ?? ''} ${dim ? 'dim' : ''}`} src={url} width={size} height={size} alt="" draggable={false} />;
}

export function ItemIcon({ id, size = 36 }: { id: string; size?: number }) {
  return <CanvasImg canvas={itemSprite(id)} size={size} />;
}

export function MonsterIcon({ id, size = 48, dim, color }: { id: string; size?: number; dim?: boolean; color?: string }) {
  return <CanvasImg canvas={monsterSprite(id, color)} size={size} dim={dim} />;
}

export function SpriteIcon({ name, size = 48 }: { name: string; size?: number }) {
  return <CanvasImg canvas={sprite(name)} size={size} />;
}

export function itemDescription(run: Run | null, item: Item): string {
  const def = itemDef(item.id);
  const known = run ? typeKnown(run, item.id) : true;
  if (!known) return `正体の分からない${CAT_NAME[def.cat]}。使うか、識別すると正体が分かる。`;
  let text = def.desc;
  const seals = sealsOf(item);
  if (seals.length) text += `\n印：${seals.map(sealDesc).join('／')}`;
  if ((def.cat === 'weapon' || def.cat === 'armor')) text += `\n${def.cat === 'weapon' ? '攻撃力' : '防御力'} ${def.power}${item.known && item.plus ? `（${item.plus > 0 ? '+' : ''}${item.plus}）` : ''}・印の枠 ${def.slots}`;
  if (item.known && item.cursed) text += '\n呪われている。';
  return text;
}

export function itemLabel(run: Run | null, item: Item): string {
  if (!run) {
    // 村では正体が分かっている扱い
    const def = itemDef(item.id);
    let name = def.cat === 'gold' ? `${item.count}文` : def.cat === 'arrow' ? `${item.count}本の${def.name}` : def.name;
    if ((def.cat === 'weapon' || def.cat === 'armor') && item.plus) name += item.plus > 0 ? `+${item.plus}` : `${item.plus}`;
    if (def.cat === 'staff' && item.charges !== undefined) name += `[${item.charges}]`;
    if (def.cat === 'pot') name += `[${Math.max(0, (item.cap ?? 0) - (item.contents?.length ?? 0))}]`;
    const seals = sealsOf(item);
    if (seals.length) name += ` ［${seals.join('')}］`;
    return name;
  }
  const seals = sealsOf(item);
  return itemName(run, item) + (seals.length && item.known ? ` ［${seals.join('')}］` : '');
}

/** 蔵の品の名前（正体の分からない物は仮の名前で） */
export function storeLabel(c: { known: Record<string, true>; fake: Record<string, string>; named: Record<string, string> }, item: Item): string {
  const def = itemDef(item.id);
  const unid = ['grass', 'scroll', 'staff', 'pot', 'charm'].includes(def.cat) && !c.known[item.id];
  if (!unid) return itemLabel(null, item);
  const fake = c.fake[item.id] ?? def.name;
  return c.named[item.id] ? `${c.named[item.id]}（${fake}）` : fake;
}

export function priceOf(item: Item) {
  return buyPrice(item);
}

export function click(fn: () => void) {
  return () => {
    playSe('menu');
    fn();
  };
}
