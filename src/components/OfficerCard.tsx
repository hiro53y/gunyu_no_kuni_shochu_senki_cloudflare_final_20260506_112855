import { skillCatalog } from '../data/names';
import { officerTitles } from '../data/dialogue';
import type { Officer } from '../types/game';
import { getOfficerRole, getPortraitStyle, getStatColor, roleBadgeStyle } from './portraitUtils';

interface OfficerCardProps {
  officer: Officer;
  selected: boolean;
  disabled?: boolean;
  onToggle?: (officerId: string) => void;
}

const statDefs = [
  { key: 'command' as const,  label: '統' },
  { key: 'valor' as const,    label: '武' },
  { key: 'wisdom' as const,   label: '知' },
  { key: 'politics' as const, label: '政' },
  { key: 'charisma' as const, label: '魅' },
];

export function OfficerCard({ officer, selected, disabled = false, onToggle }: OfficerCardProps) {
  const { bg, kanji } = getPortraitStyle(officer);
  const role = getOfficerRole(officer);
  const title = officerTitles[officer.id] ?? '';
  const troopRatio   = officer.troops / officer.maxTroops;
  const staminaRatio = officer.stamina / officer.maxStamina;
  const isWounded    = officer.stamina < 30;

  return (
    <button
      className={`officerCard${selected ? ' isSelected' : ''}${isWounded ? ' isWounded' : ''}`}
      disabled={disabled}
      onClick={() => onToggle?.(officer.id)}
      type="button"
      aria-pressed={selected}
    >
      <div className="officerCardHeader">
        <div className="officerPortrait" style={{ '--portrait-bg': bg } as React.CSSProperties}>
          <span>{kanji}</span>
          <span className="roleTag" style={roleBadgeStyle[role]}>{role}</span>
        </div>
        <div className="officerInfo">
          <p className="officerName">{officer.name}</p>
          {title && <p className="officerTitle">{title}</p>}
          <p className="officerLevel">Lv {officer.level} / EXP {officer.exp}/100</p>
        </div>
      </div>

      <div className="officerCardBody">
        <div className="statRow">
          {statDefs.map(({ key, label }) => {
            const val = officer[key];
            const cls = getStatColor(val);
            return (
              <div key={key} className="statCell">
                <span className="statName">{label}</span>
                <span className={`statVal${cls ? ` ${cls}` : ''}`}>{val}</span>
              </div>
            );
          })}
        </div>

        <div className="troopMeter">
          <div className="troopBar">
            <div
              className={`troopFill${troopRatio < 0.35 ? ' low' : ''}`}
              style={{ width: `${troopRatio * 100}%` }}
            />
          </div>
          <span className="troopCount">兵 {officer.troops.toLocaleString()}/{officer.maxTroops.toLocaleString()}</span>
        </div>

        <div className="staminaBarWrap">
          <div className="staminaBar">
            <div
              className={`staminaFill${staminaRatio < 0.35 ? ' low' : ''}`}
              style={{ width: `${staminaRatio * 100}%` }}
            />
          </div>
          <span className="staminaLabel">気 {officer.stamina}/{officer.maxStamina}</span>
        </div>

        {officer.skills.length > 0 && (
          <div className="skillTags">
            {officer.skills.map((id) => {
              const skill = skillCatalog[id];
              return skill ? (
                <span key={id} className="skillTag" title={skill.description}>{skill.name}</span>
              ) : null;
            })}
          </div>
        )}
      </div>
    </button>
  );
}
