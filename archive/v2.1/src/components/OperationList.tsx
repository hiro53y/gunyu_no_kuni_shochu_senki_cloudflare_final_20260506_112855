// ===========================================================================
// 左サイドの操作・イベントログ常駐パネル
// 直近の出来事を上から並べる
// ===========================================================================

import type { GameState } from '../types/game';

interface Props {
  state: GameState;
  limit?: number;
}

export function OperationList({ state, limit = 12 }: Props) {
  const entries = state.log.slice(0, limit);

  return (
    <aside className="opList" aria-label="作戦リスト・イベントログ">
      <div className="opTitle">作戦記</div>
      {entries.length === 0 ? (
        <div className="opEntry" style={{ color: 'var(--c-kinari-d)', fontStyle: 'italic' }}>
          まだ何も起こっていない
        </div>
      ) : (
        entries.map((e, i) => (
          <div className="opEntry" key={`${e.turn}-${i}`}>
            <span className="opTurn">{e.turn}月</span>
            {e.message}
          </div>
        ))
      )}
    </aside>
  );
}
