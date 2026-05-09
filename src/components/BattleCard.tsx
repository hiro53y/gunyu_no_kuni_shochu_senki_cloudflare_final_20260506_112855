// ===========================================================================
// 合戦画面の指揮官カード
// HPバー・ガード％・コスト・スキル2・状態異常マーカー・名前を表示
// ===========================================================================

import type { BattleSlot, GameState, StatusEffectType } from '../types/game';
import { GeneralPortrait } from './GeneralPortrait';

interface Props {
  state: GameState;
  slot: BattleSlot;
  side: 'player' | 'enemy';
  isActive: boolean;
  isTargetable: boolean;
  isSelectedTarget: boolean;
  damageFlash?: number; // 直近のダメージ数値（一瞬表示）
  onClick?: () => void;
}

const STATUS_GLYPH: Record<StatusEffectType, { glyph: string; color: string; label: string }> = {
  burn:     { glyph: '焔', color: '#FF6B3A', label: '火傷' },
  poison:   { glyph: '毒', color: '#9F7BC4', label: '毒' },
  stun:     { glyph: '麻', color: '#E9C75A', label: '麻痺' },
  fear:     { glyph: '恐', color: '#7C5C8C', label: '恐怖' },
  rage:     { glyph: '怒', color: '#C84A4A', label: '暴走' },
  guard_up: { glyph: '盾', color: '#6FAEDB', label: '守強' },
  atk_up:   { glyph: '攻', color: '#E27F4A', label: '攻強' },
  sealed:   { glyph: '封', color: '#888', label: '封印' },
};

export function BattleCard({ state, slot, side, isActive, isTargetable, isSelectedTarget, damageFlash, onClick }: Props) {
  if (!slot.generalId) {
    return <div className={`battleCard empty ${side}`} aria-hidden="true" />;
  }
  const g = state.generals[slot.generalId];
  if (!g) return <div className={`battleCard empty ${side}`} />;

  const hpPct = slot.hpMax > 0 ? Math.max(0, Math.min(100, (slot.hp / slot.hpMax) * 100)) : 0;
  const dead = slot.hp <= 0 || slot.retreated;

  const cls = [
    'battleCard',
    side,
    isActive && 'active',
    isTargetable && 'targetable',
    isSelectedTarget && 'selectedTarget',
    dead && 'dead',
  ].filter(Boolean).join(' ');

  return (
    <button type="button" className={cls} onClick={onClick} disabled={!isTargetable && !isActive}>
      <div className="cardName">{g.name.replace(/^.*\s/, '')}</div>
      <div className="cardBody">
        <GeneralPortrait general={g} size={48} showLabel={false} />
        <div className="cardStats">
          <div className="hpRow">
            <span className="hpNum">{slot.hp.toLocaleString()}</span>
            <span className="hpSlash">/</span>
            <span className="hpMax">{slot.hpMax.toLocaleString()}</span>
          </div>
          <div className="hpBar">
            <div
              className="hpFill"
              style={{
                width: `${hpPct}%`,
                background: hpPct > 50 ? 'linear-gradient(90deg, #6FB17C, #3F8060)'
                  : hpPct > 25 ? 'linear-gradient(90deg, #E9C75A, #C9A24A)'
                  : 'linear-gradient(90deg, #C84A4A, #8C2828)',
              }}
            />
          </div>
          <div className="cardMeta">
            <span className="guardBadge">守{slot.guard}%</span>
            <span className="costBadge">兵{Math.round(slot.hp / 10)}</span>
          </div>
        </div>
      </div>
      <div className="skillRow">
        {g.skillIds.slice(0, 2).map((id, i) => (
          <span key={id} className="skillIcon" title={id}>
            {i === 0 ? '⚔' : '✦'}
          </span>
        ))}
      </div>
      <div className="statusRow">
        {slot.statusEffects.map((e, i) => {
          const def = STATUS_GLYPH[e.type];
          return (
            <span key={i} className="statusBadge" style={{ color: def.color, borderColor: def.color }}
                  title={`${def.label} 残${e.turnsLeft}T`}>
              {def.glyph}
            </span>
          );
        })}
      </div>
      {damageFlash !== undefined && (
        <div className="damageFlash">-{damageFlash.toLocaleString()}</div>
      )}
      {dead && <div className="deadOverlay">敗走</div>}
    </button>
  );
}
