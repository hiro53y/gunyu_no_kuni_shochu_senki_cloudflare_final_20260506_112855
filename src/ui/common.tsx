// 画面の共通部品：枠・絵の場所・兵種の印
import { useEffect, type ReactNode } from 'react';
import { KINDS } from '../battle/kinds';
import type { Kind } from '../battle/types';
import { playSe } from '../audio/sound';

export const ASSET_VERSION = '20261016';

/** 会話・札に使う立ち絵（軽い WebP） */
export function bustUrl(portrait: string): string {
  return `/assets/busts/${portrait}.webp?v=${ASSET_VERSION}`;
}

/** 顔の丸い切り抜き（行動順の帯・一覧） */
export function tokenUrl(portrait: string): string {
  return `/assets/tokens/${portrait}.webp?v=${ASSET_VERSION}`;
}

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

/** 兵種の印（丸に一字） */
export function KindMark({ kind, size = 20 }: { kind: Kind; size?: number }) {
  const k = KINDS[kind];
  return (
    <span className="kind-mark" style={{ background: k.color, width: size, height: size, fontSize: size * 0.62 }} title={k.name} aria-label={k.name}>
      {k.mark}
    </span>
  );
}

export function click(fn: () => void) {
  return () => {
    playSe('menu');
    fn();
  };
}
