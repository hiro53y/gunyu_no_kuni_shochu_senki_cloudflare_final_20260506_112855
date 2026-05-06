import { getFactionRegions, getFactionTroops } from '../engine/selectors';
import type { GameState } from '../types/game';

interface FactionStatusProps {
  state: GameState;
}

export function FactionStatus({ state }: FactionStatusProps) {
  const factions = Object.values(state.factions).filter((faction) => faction.isMajor);

  return (
    <section className="panel">
      <div className="sectionTitle">
        <h2>勢力</h2>
        <span>情勢</span>
      </div>
      <div className="factionList">
        {factions.map((faction) => {
          const regions = getFactionRegions(state, faction.id);
          const troops = getFactionTroops(state, faction.id);
          const defeated = regions.length === 0;
          return (
            <article className={`factionRow ${defeated ? 'isDefeated' : ''}`} key={faction.id}>
              <span className="colorDot" style={{ background: faction.color }} />
              <div>
                <strong>{faction.name}</strong>
                <small>{defeated ? '滅亡' : `${regions.length}地域 / 兵${troops}`}</small>
              </div>
              <b>{faction.morale}</b>
            </article>
          );
        })}
      </div>
    </section>
  );
}
