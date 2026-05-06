import { getFactionRegions, getFactionTroops } from '../engine/selectors';
import type { GameState } from '../types/game';

interface FactionStatusProps {
  state: GameState;
}

export function FactionStatus({ state }: FactionStatusProps) {
  const factions = Object.values(state.factions)
    .filter((f) => f.isMajor)
    .sort((a, b) => {
      if (a.isPlayer) return -1;
      if (b.isPlayer) return 1;
      return getFactionRegions(state, b.id).length - getFactionRegions(state, a.id).length;
    });

  return (
    <section className="panel">
      <div className="sectionTitle">
        <h2>天下情勢</h2>
        <span>全勢力</span>
      </div>
      <div className="factionList">
        {factions.map((faction) => {
          const regions  = getFactionRegions(state, faction.id);
          const troops   = getFactionTroops(state, faction.id);
          const defeated = regions.length === 0;
          return (
            <article key={faction.id} className={`factionRow${defeated ? ' isDefeated' : ''}`}>
              <div className="factionDot" style={{ background: faction.color, color: faction.color }} />
              <div className="fName" style={{ color: faction.isPlayer ? 'var(--gold-light)' : undefined }}>
                {faction.name}
                {faction.isPlayer && (
                  <span style={{ fontSize: '0.62rem', marginLeft: 6, color: 'var(--muted)' }}>（我が家）</span>
                )}
              </div>
              <div className="fInfo">
                {defeated ? (
                  <span style={{ color: 'var(--muted)' }}>滅亡</span>
                ) : (
                  <>
                    <div>{regions.length} 地域</div>
                    <div>兵 {troops.toLocaleString()}</div>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
