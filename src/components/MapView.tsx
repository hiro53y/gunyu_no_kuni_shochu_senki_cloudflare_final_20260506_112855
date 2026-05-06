import { terrainLabel } from '../data/names';
import { estimateRegionDefense } from '../engine/selectors';
import type { GameState, Region } from '../types/game';

interface MapViewProps {
  state: GameState;
  onSelectRegion: (regionId: string) => void;
}

function dangerLabel(state: GameState, region: Region): string {
  if (region.ownerFactionId === 'f_akebono') {
    const enemyBorder = region.neighbors.some((neighborId) => state.regions[neighborId]?.ownerFactionId !== 'f_akebono');
    return enemyBorder ? '国境' : '後方';
  }
  const defense = estimateRegionDefense(state, region.id);
  if (defense < 950) {
    return '好機';
  }
  if (defense < 1400) {
    return '互角';
  }
  return '危険';
}

export function MapView({ state, onSelectRegion }: MapViewProps) {
  const regions = Object.values(state.regions).sort((a, b) => a.mapY - b.mapY || a.mapX - b.mapX);

  return (
    <section className="mapGrid" aria-label="地域一覧">
      {regions.map((region) => {
        const faction = state.factions[region.ownerFactionId];
        const selected = state.selectedRegionId === region.id;
        return (
          <button
            className={`regionCard ${selected ? 'isSelected' : ''}`}
            key={region.id}
            onClick={() => onSelectRegion(region.id)}
            style={{ '--faction-color': faction.color } as React.CSSProperties}
            type="button"
          >
            <span className="regionOwner" />
            <strong>{region.name}</strong>
            <small>{faction.name}</small>
            <span className="regionMeta">
              {terrainLabel[region.terrain]} / 城{region.castleHp}
            </span>
            <em>{dangerLabel(state, region)}</em>
          </button>
        );
      })}
    </section>
  );
}
