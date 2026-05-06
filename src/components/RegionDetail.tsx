import { terrainLabel } from '../data/names';
import { estimateRegionDefense, getAvailableRonin, getRegionOfficers } from '../engine/selectors';
import type { GameState } from '../types/game';

interface RegionDetailProps {
  state: GameState;
  onSelectRegion: (regionId: string) => void;
  onHire: (officerId: string) => void;
}

export function RegionDetail({ state, onSelectRegion, onHire }: RegionDetailProps) {
  const region = state.regions[state.selectedRegionId];
  const faction = state.factions[region.ownerFactionId];
  const officers = getRegionOfficers(state, region.id);
  const ronin = getAvailableRonin(state).filter((officer) => officer.locationRegionId === region.id);
  const defense = estimateRegionDefense(state, region.id);

  return (
    <section className="panel">
      <div className="sectionTitle">
        <h2>{region.name}</h2>
        <span style={{ color: faction.color }}>{faction.name}</span>
      </div>
      <div className="regionSummary">
        <span>{terrainLabel[region.terrain]}</span>
        <span>石高 {region.riceYield}</span>
        <span>治安 {region.publicOrder}</span>
        <span>
          城 {region.castleHp}/{region.maxCastleHp}
        </span>
        <span>守備兵 {region.localTroops}</span>
        <span>防衛目安 {defense}</span>
      </div>

      <details className="detailsBlock" open>
        <summary>隣接地域</summary>
        <div className="neighborList">
          {region.neighbors.map((neighborId) => {
            const neighbor = state.regions[neighborId];
            const owner = state.factions[neighbor.ownerFactionId];
            return (
              <button key={neighbor.id} onClick={() => onSelectRegion(neighbor.id)} type="button">
                <span className="colorDot" style={{ background: owner.color }} />
                {neighbor.name}
              </button>
            );
          })}
        </div>
      </details>

      <details className="detailsBlock">
        <summary>所在武将</summary>
        <div className="miniList">
          {officers.length === 0 ? <p>武将なし</p> : officers.map((officer) => <p key={officer.id}>{officer.name}</p>)}
        </div>
      </details>

      {ronin.length > 0 && (
        <div className="hireBox">
          <strong>登用候補</strong>
          {ronin.map((officer) => (
            <button key={officer.id} onClick={() => onHire(officer.id)} type="button">
              {officer.name}を登用
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
