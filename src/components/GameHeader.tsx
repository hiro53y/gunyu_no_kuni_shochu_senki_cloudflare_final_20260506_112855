import { getPlayerFaction, getPlayerRegions } from '../engine/selectors';
import type { GameState } from '../types/game';

interface GameHeaderProps {
  state: GameState;
}

export function GameHeader({ state }: GameHeaderProps) {
  const faction = getPlayerFaction(state);
  const regions = getPlayerRegions(state);

  return (
    <header className="gameHeader">
      <div>
        <p className="eyebrow">群雄ノ國</p>
        <h1>掌中戦記</h1>
      </div>
      <dl className="resourceGrid" aria-label="勢力資源">
        <div>
          <dt>月</dt>
          <dd>{state.turn}</dd>
        </div>
        <div>
          <dt>金</dt>
          <dd>{faction.gold}</dd>
        </div>
        <div>
          <dt>兵糧</dt>
          <dd>{faction.food}</dd>
        </div>
        <div>
          <dt>AP</dt>
          <dd>
            {state.actionPoints}/{state.maxActionPoints}
          </dd>
        </div>
        <div>
          <dt>領地</dt>
          <dd>{regions.length}/12</dd>
        </div>
      </dl>
    </header>
  );
}
