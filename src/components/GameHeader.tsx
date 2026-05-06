import { getPlayerFaction, getPlayerRegions } from '../engine/selectors';
import type { GameState } from '../types/game';

interface GameHeaderProps {
  state: GameState;
}

const TOTAL_REGIONS = 12;

export function GameHeader({ state }: GameHeaderProps) {
  const faction = getPlayerFaction(state);
  const regions = getPlayerRegions(state);
  const ap = state.actionPoints;
  const maxAp = state.maxActionPoints;
  const goldLow = faction.gold < 100;
  const foodLow = faction.food < 150;

  return (
    <header className="gameHeader">
      <div className="headerTop">
        <div className="headerTitle">
          <h1>群雄ノ國</h1>
          <span className="turnBadge">第 {state.turn} 月</span>
        </div>
        <div className="headerPhase">
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontFamily: 'var(--font-serif)', marginRight: 4 }}>
            AP
          </span>
          <div className="apDots" aria-label={`行動力 ${ap}/${maxAp}`}>
            {Array.from({ length: maxAp }).map((_, i) => (
              <div key={i} className={`apDot${i < ap ? ' filled' : ''}`} />
            ))}
          </div>
        </div>
      </div>
      <div className="headerResources" aria-label="勢力情報">
        <div className="resourceItem">
          <span className="resIcon">領地</span>
          <span className="resVal">
            {regions.length}
            <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>/{TOTAL_REGIONS}</span>
          </span>
        </div>
        <div className={`resourceItem${goldLow ? ' resLow' : ''}`}>
          <span className="resIcon">金</span>
          <span className="resVal">{faction.gold.toLocaleString()}</span>
        </div>
        <div className={`resourceItem${foodLow ? ' resLow' : ''}`}>
          <span className="resIcon">兵糧</span>
          <span className="resVal">{faction.food.toLocaleString()}</span>
        </div>
        <div className="resourceItem">
          <span className="resIcon">士気</span>
          <span className="resVal">{faction.morale}</span>
        </div>
        <div className="resourceItem">
          <span className="resIcon">戦</span>
          <span className="resVal">{state.stats.totalBattles}</span>
        </div>
      </div>
    </header>
  );
}
