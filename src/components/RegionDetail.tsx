import { terrainLabel } from '../data/names';
import { estimateRegionDefense, getAvailableRonin, getRegionOfficers } from '../engine/selectors';
import { getPortraitStyle } from './portraitUtils';
import type { GameState } from '../types/game';

interface RegionDetailProps {
  state: GameState;
  onSelectRegion: (regionId: string) => void;
  onHire: (officerId: string) => void;
}

export function RegionDetail({ state, onSelectRegion, onHire }: RegionDetailProps) {
  const region = state.regions[state.selectedRegionId];
  if (!region) return null;

  const faction  = state.factions[region.ownerFactionId];
  const officers = getRegionOfficers(state, region.id);
  const ronin    = getAvailableRonin(state).filter((o) => o.locationRegionId === region.id);
  const defense  = estimateRegionDefense(state, region.id);
  const hpRatio  = region.castleHp / region.maxCastleHp;
  const hpClass  = hpRatio > 0.6 ? 'high' : hpRatio > 0.3 ? 'mid' : '';

  return (
    <section className="regionDetail">
      <div className="regionDetailHeader">
        <div>
          <h2>{region.name}</h2>
          <p className="regionFaction" style={{ color: faction?.color, margin: 0 }}>{faction?.name}</p>
        </div>
        <span className="terrainBadge">{terrainLabel[region.terrain]}</span>
      </div>

      <div className="regionStats">
        {[
          { label: '石高',   val: String(region.riceYield), cls: '' },
          { label: '治安',   val: String(region.publicOrder), cls: region.publicOrder < 40 ? 'danger' : region.publicOrder >= 70 ? 'good' : '' },
          { label: '守備兵', val: region.localTroops.toLocaleString(), cls: '' },
          { label: '防衛力', val: defense.toLocaleString(), cls: '' },
          { label: '開発度', val: String(region.developmentLevel), cls: '' },
        ].map(({ label, val, cls }) => (
          <div key={label} className="regionStatItem">
            <span className="rLabel">{label}</span>
            <div className="rValWrap">
              <span className={`rVal${cls ? ' ' + cls : ''}`}>{val}</span>
            </div>
          </div>
        ))}
        <div className="regionStatItem">
          <span className="rLabel">城耐久</span>
          <div className="rValWrap">
            <span className={`rVal${hpRatio < 0.3 ? ' danger' : ''}`}>
              {region.castleHp}/{region.maxCastleHp}
            </span>
            <div className="castleHpBar">
              <div className={`castleHpFill ${hpClass}`} style={{ width: `${hpRatio * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      {officers.length > 0 && (
        <div className="regionOfficers">
          <h3>所在武将</h3>
          {officers.map((officer) => {
            const { bg, kanji } = getPortraitStyle(officer);
            return (
              <div key={officer.id} className="officerMiniRow">
                <div className="officerMiniPortrait" style={{ '--portrait-bg': bg } as React.CSSProperties}>
                  {kanji}
                </div>
                <span className="officerMiniName">{officer.name}</span>
                <span className="officerMiniTroops">兵 {officer.troops.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="regionActions" style={{ flexWrap: 'wrap' }}>
        {region.neighbors.map((nid) => {
          const n  = state.regions[nid];
          const nf = state.factions[n?.ownerFactionId];
          if (!n) return null;
          return (
            <button
              key={nid}
              className="hireButton"
              onClick={() => onSelectRegion(nid)}
              type="button"
              style={{
                borderColor: `${nf?.color ?? 'var(--border)'}55`,
                color: nf?.color ?? 'var(--text)',
                background: `${nf?.color ?? '#ffffff'}0a`,
              }}
            >
              {n.name}
            </button>
          );
        })}
      </div>

      {ronin.length > 0 && (
        <div className="regionActions">
          {ronin.map((o) => (
            <button key={o.id} className="hireButton" onClick={() => onHire(o.id)} type="button">
              {o.name}を登用
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
