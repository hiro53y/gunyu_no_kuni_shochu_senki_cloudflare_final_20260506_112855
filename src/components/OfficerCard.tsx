import { skillCatalog } from '../data/names';
import type { Officer } from '../types/game';

interface OfficerCardProps {
  officer: Officer;
  selected: boolean;
  disabled?: boolean;
  onToggle?: (officerId: string) => void;
}

export function OfficerCard({ officer, selected, disabled = false, onToggle }: OfficerCardProps) {
  const skillNames = officer.skills.map((id) => skillCatalog[id]?.name).filter(Boolean).join(' / ');
  return (
    <button
      className={`officerCard ${selected ? 'isSelected' : ''}`}
      disabled={disabled}
      onClick={() => onToggle?.(officer.id)}
      type="button"
    >
      <div className="officerTop">
        <strong>{officer.name}</strong>
        <span>Lv{officer.level}</span>
      </div>
      <div className="meterLine">
        <span>兵 {officer.troops}/{officer.maxTroops}</span>
        <span>気 {officer.stamina}/{officer.maxStamina}</span>
      </div>
      <div className="statGrid">
        <span>統 {officer.command}</span>
        <span>武 {officer.valor}</span>
        <span>知 {officer.wisdom}</span>
        <span>政 {officer.politics}</span>
        <span>魅 {officer.charisma}</span>
      </div>
      <small>{skillNames || '技能なし'}</small>
    </button>
  );
}
