// 操作盤：8方向パッド（押し続けると連続で歩く）、A・B、道具などのボタン
import { useEffect, useRef } from 'react';
import type { Dir } from '../engine/types';
import { unlockAudio } from '../audio/sound';

export interface PadHandlers {
  onDir: (dir: Dir) => void;
  onWait: () => void;
  onRest: () => void;
  onA: () => void;
  onB: () => void;
}

const ARROWS: { dir: Dir | -1; label: string; area: string }[] = [
  { dir: 7, label: '↖', area: 'a' }, { dir: 0, label: '↑', area: 'b' }, { dir: 1, label: '↗', area: 'c' },
  { dir: 6, label: '←', area: 'd' }, { dir: -1, label: '足踏み', area: 'e' }, { dir: 2, label: '→', area: 'f' },
  { dir: 5, label: '↙', area: 'g' }, { dir: 4, label: '↓', area: 'h' }, { dir: 3, label: '↘', area: 'i' },
];

/** 押している間くり返す（最初は少し待つ） */
function useRepeat() {
  const timer = useRef<number | null>(null);
  const stop = () => {
    if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; }
  };
  const start = (fn: () => void, first = 260, every = 120) => {
    stop();
    fn();
    const loop = () => { fn(); timer.current = window.setTimeout(loop, every); };
    timer.current = window.setTimeout(loop, first);
  };
  useEffect(() => stop, []);
  return { start, stop };
}

export function Pad(props: PadHandlers & { dashArmed: boolean; faceMode: boolean }) {
  const repeat = useRepeat();
  const restTimer = useRef<number | null>(null);
  const down = (dir: Dir | -1) => (e: React.PointerEvent) => {
    e.preventDefault();
    unlockAudio();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    if (dir === -1) {
      // 足踏み：長押しで休む
      props.onWait();
      restTimer.current = window.setTimeout(() => { restTimer.current = null; props.onRest(); }, 650);
      return;
    }
    if (props.dashArmed || props.faceMode) { props.onDir(dir); return; }
    repeat.start(() => props.onDir(dir));
  };
  const up = () => {
    repeat.stop();
    if (restTimer.current !== null) { window.clearTimeout(restTimer.current); restTimer.current = null; }
  };
  return (
    <div className="pad-wrap">
      <div className={`dpad ${props.faceMode ? 'face' : ''} ${props.dashArmed ? 'dash' : ''}`}>
        {ARROWS.map((a) => (
          <button
            key={a.area}
            className={`dkey ${a.dir === -1 ? 'center' : ''} ${typeof a.dir === 'number' && a.dir % 2 === 1 ? 'diag' : ''}`}
            style={{ gridArea: a.area }}
            onPointerDown={down(a.dir)}
            onPointerUp={up}
            onPointerCancel={up}
            onPointerLeave={up}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={a.dir === -1 ? '足踏み（長押しで休む）' : `${a.label}へ`}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="ab">
        <button className="btn-b" onPointerDown={(e) => { e.preventDefault(); unlockAudio(); props.onB(); }} aria-label="ダッシュ">
          B<small>{props.dashArmed ? 'ダッシュ中' : 'ダッシュ'}</small>
        </button>
        <button className="btn-a" onPointerDown={(e) => { e.preventDefault(); unlockAudio(); repeat.start(props.onA, 320, 220); }} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} aria-label="攻撃">
          A<small>攻撃</small>
        </button>
      </div>
    </div>
  );
}
