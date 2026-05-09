// ===========================================================================
// 上部HUDバー
// ターン・年月・AP・金・兵糧・満足度・得点・支配数を表示する。
// ===========================================================================

import type { GameState } from '../types/game';
import { useMemo } from 'react';

interface Props {
  state: GameState;
  onOpenMenu?: () => void;
}

export function Hud({ state, onOpenMenu }: Props) {
  const akatsuki = state.factions.akatsuki;
  const playerRegions = useMemo(
    () => Object.values(state.regions).filter((r) => r.factionId === 'akatsuki').length,
    [state.regions],
  );

  return (
    <header className="hud" role="banner">
      <div className="hudGroup turn">
        <span className="value">第{state.turn}月</span>
      </div>
      <div className="hudGroup">
        <span className="label">天</span>
        <span className="value" style={{ fontSize: 12 }}>{state.yearMonth.year}年{state.yearMonth.month}月</span>
      </div>

      <div className="hudGroup ap" aria-label={`残り行動 ${state.ap}/${state.apMax}`}>
        <span className="label">行動</span>
        <span className="dots">
          {Array.from({ length: state.apMax }).map((_, i) => (
            <span key={i} className={`dot ${i < state.ap ? 'on' : ''}`} />
          ))}
        </span>
      </div>

      <div className="hudGroup">
        <span className="label">金</span>
        <span className="value">{akatsuki.treasury.toLocaleString()}</span>
      </div>
      <div className="hudGroup">
        <span className="label">兵糧</span>
        <span className="value">{akatsuki.food.toLocaleString()}</span>
      </div>
      <div className="hudGroup">
        <span className="label">満足</span>
        <span className="value">{state.satisfaction}</span>
      </div>
      <div className="hudGroup">
        <span className="label">得点</span>
        <span className="value">{state.score}</span>
      </div>
      <div className="hudGroup">
        <span className="label">支配</span>
        <span className="value">{playerRegions}/15</span>
      </div>

      {onOpenMenu && (
        <button
          onClick={onOpenMenu}
          style={{
            marginLeft: 'auto',
            padding: '4px 10px',
            border: '1px solid var(--c-sumi-line)',
            borderRadius: 'var(--radius-s)',
            color: 'var(--c-kinari-d)',
            fontSize: 12,
          }}
          aria-label="メニュー"
        >
          ≡
        </button>
      )}
    </header>
  );
}
