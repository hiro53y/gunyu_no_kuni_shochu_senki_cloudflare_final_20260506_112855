import { skillCatalog } from '../data/names';
import { officerTitles } from '../data/dialogue';
import type { Faction, Officer } from '../types/game';
import { getOfficerArtPosition, getOfficerRole, getStatColor, roleBadgeStyle } from './portraitUtils';
import { CharacterPortrait } from './CharacterPortrait';
import type { CSSProperties } from 'react';

interface OfficerCardProps {
  officer: Officer;
  faction: Faction;
  selected: boolean;
  disabled?: boolean;
  onToggle?: (officerId: string) => void;
}

const statDefs = [
  { key: 'command'  as const, label: '統' },
  { key: 'valor'    as const, label: '武' },
  { key: 'wisdom'   as const, label: '知' },
  { key: 'politics' as const, label: '政' },
  { key: 'charisma' as const, label: '魅' },
];

export function OfficerCard({ officer, faction, selected, disabled = false, onToggle }: OfficerCardProps) {
  const role         = getOfficerRole(officer);
  const title        = officerTitles[officer.id] ?? '';
  const troopRatio   = officer.troops / officer.maxTroops;
  const staminaRatio = officer.stamina / officer.maxStamina;
  const isWounded    = officer.stamina < 30;
  const artStyle = {
    '--officer-art-position': getOfficerArtPosition(officer),
    '--officer-color': faction.color,
  } as CSSProperties;

  return (
    <button
      className={`officerCard${selected ? ' isSelected' : ''}${isWounded ? ' isWounded' : ''}`}
      disabled={disabled}
      onClick={() => onToggle?.(officer.id)}
      type="button"
      aria-pressed={selected}
    >
      <div className="officerCardHeader">
        <div className="officerPortraitWrap">
          <div className="officerArtCrop" style={artStyle} />
          <div className="officerPortraitMedallion">
            <CharacterPortrait officer={officer} factionColor={faction.color} size={38} />
          </div>
          <span className="roleTagNew" style={roleBadgeStyle[role]}>{role}</span>
          {selected && <span className="selectedBadgeNew">{'出陣'}</span>}
        </div>

        <div className="officerInfo">
          <p className="officerName">{officer.name}</p>
          {title && <p className="officerTitle">{title}</p>}
          <p className="officerFaction" style={{ color: faction.color }}>{faction.name}</p>
          <p className="officerLevel">Lv {officer.level} / EXP {officer.exp}/100</p>

          <div className="statRow">
            {statDefs.map(({ key, label }) => {
              const val = officer[key];
              const cls = getStatColor(val);
              return (
                <div key={key} className="statCell">
                  <span className="statName">{label}</span>
                  <span className={`statVal${cls ? ' ' + cls : ''}`}>{val}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="officerCardBody">
        <div className="troopMeter">
          <div className="troopBar">
            <div
              className={`troopFill${troopRatio < 0.35 ? ' low' : ''}`}
              style={{ width: `${troopRatio * 100}%` }}
            />
          </div>
          <span className="troopCount">
            {'兵'} {officer.troops.toLocaleString()} / {officer.maxTroops.toLocaleString()}
          </span>
        </div>

        <div className="staminaBarWrap">
          <div className="staminaBar">
            <div
              className={`staminaFill${staminaRatio < 0.35 ? ' low' : ''}`}
              style={{ width: `${staminaRatio * 100}%` }}
            />
          </div>
          <span className="staminaLabel">
            {'気力'} {officer.stamina}/{officer.maxStamina}
          </span>
        </div>

        {officer.skills.length > 0 && (
          <div className="skillTags">
            {officer.skills.map((id) => {
              const skill = skillCatalog[id];
              return skill ? (
                <span key={id} className="skillTag" title={skill.description}>
                  {skill.name}
                </span>
              ) : null;
            })}
          </div>
        )}
      </div>
    </button>
  );
}
