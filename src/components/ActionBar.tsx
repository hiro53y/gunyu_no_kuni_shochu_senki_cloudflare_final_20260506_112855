// ===========================================================================
// 下部アクションバー（8コマンド）
// 選択地域に応じてボタンの活性が変わる。
// ===========================================================================

import type { GameState, RegionId } from '../types/game';

export type ActionKind = 'battle' | 'sabotage' | 'build' | 'collect' | 'scout' | 'recruit' | 'rest' | 'endTurn';

interface Props {
  state: GameState;
  selectedRegionId: RegionId | null;
  onAction: (action: ActionKind) => void;
}

interface BtnDef {
  kind: ActionKind;
  label: string;
  icon: string;
  primary?: boolean;
}

const BUTTONS: BtnDef[] = [
  { kind: 'battle',   label: '合戦',   icon: '⚔' },
  { kind: 'sabotage', label: '調略',   icon: '◈' },
  { kind: 'build',    label: '建設',   icon: '⌂' },
  { kind: 'collect',  label: '徴収',   icon: '$' },
  { kind: 'scout',    label: '探索',   icon: '◉' },
  { kind: 'recruit',  label: '登用',   icon: '人' },
  { kind: 'rest',     label: '休養',   icon: '寝' },
  { kind: 'endTurn',  label: 'ターン終', icon: '⏭', primary: true },
];

/** 各コマンドの活性条件 */
function isEnabled(kind: ActionKind, state: GameState, regionId: RegionId | null): boolean {
  if (state.victory !== 'none') return false;
  if (kind === 'endTurn') return true;
  if (kind === 'rest') return true;
  if (kind === 'recruit') return state.prisoners.length > 0 || state.roninPool.length > 0;
  if (!regionId) return false;
  const r = state.regions[regionId];
  if (!r) return false;
  const isOwn = r.factionId === 'akatsuki';
  const isAdjacent = r.adjacentIds.some((aid) => state.regions[aid]?.factionId === 'akatsuki');

  if (kind === 'battle') {
    if (isOwn || !isAdjacent) return false;
    if (state.ap < 1) return false;
    return true;
  }
  if (kind === 'sabotage') return !isOwn && isAdjacent && state.ap >= 1;
  if (kind === 'build')   return isOwn && state.ap >= 1;
  if (kind === 'collect') return isOwn && state.ap >= 1;
  if (kind === 'scout')   return state.ap >= 1;
  return false;
}

export function ActionBar({ state, selectedRegionId, onAction }: Props) {
  return (
    <nav className="actionBar" role="toolbar" aria-label="行動コマンド">
      {BUTTONS.map((b) => (
        <button
          key={b.kind}
          className={b.primary ? 'endTurn' : ''}
          disabled={!isEnabled(b.kind, state, selectedRegionId)}
          onClick={() => onAction(b.kind)}
          title={b.label}
          aria-label={b.label}
        >
          <span className="actIcon" aria-hidden="true">{b.icon}</span>
          <span>{b.label}</span>
        </button>
      ))}
    </nav>
  );
}
