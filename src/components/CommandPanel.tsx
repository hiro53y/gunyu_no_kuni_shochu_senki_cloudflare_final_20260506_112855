import type { DomesticFocus, GameState } from '../types/game';

interface CommandPanelProps {
  state: GameState;
  focus: DomesticFocus;
  onFocusChange: (f: DomesticFocus) => void;
  onDomestic: () => void;
  onRecruitTroops: () => void;
  onTrain: () => void;
  onSearch: () => void;
  onInvade: () => void;
  onRest: () => void;
  onEndTurn: () => void;
}

const focusOptions: { value: DomesticFocus; label: string; icon: string }[] = [
  { value: 'riceYield',        label: '石高',  icon: '🌾' },
  { value: 'publicOrder',      label: '治安',  icon: '⚖' },
  { value: 'castleHp',         label: '城',    icon: '🏯' },
  { value: 'developmentLevel', label: '開発',  icon: '⚒' },
];

const civilCommands = [
  { key: 'domestic',     label: '内政', icon: '🌾', apCost: 1 },
  { key: 'recruit',      label: '徴兵', icon: '🪖', apCost: 1 },
  { key: 'train',        label: '訓練', icon: '⚔',  apCost: 1 },
  { key: 'search',       label: '探索', icon: '🔍', apCost: 1 },
] as const;

const militaryCommands = [
  { key: 'invade', label: '進軍', icon: '⚔', apCost: 1, isRed: true },
  { key: 'rest',   label: '休養', icon: '🌙', apCost: 1, isRed: false },
] as const;

export function CommandPanel({
  state,
  focus,
  onFocusChange,
  onDomestic,
  onRecruitTroops,
  onTrain,
  onSearch,
  onInvade,
  onRest,
  onEndTurn,
}: CommandPanelProps) {
  const disabled = state.gameStatus !== 'playing';
  const ap = state.actionPoints;

  const handlers: Record<string, () => void> = {
    domestic: onDomestic,
    recruit:  onRecruitTroops,
    train:    onTrain,
    search:   onSearch,
    invade:   onInvade,
    rest:     onRest,
  };

  return (
    <footer className="commandPanel">
      {/* 内政フォーカス選択 */}
      <div className="focusRow">
        {focusOptions.map((opt) => (
          <button
            key={opt.value}
            className={`focusBtn ${focus === opt.value ? 'isSelected' : ''}`}
            onClick={() => onFocusChange(opt.value)}
            type="button"
            aria-pressed={focus === opt.value}
          >
            {opt.icon} {opt.label}
          </button>
        ))}
      </div>

      {/* 政務コマンド */}
      <div className="commandSection">
        <div className="commandLabel">政 務</div>
        <div className="commandGrid">
          {civilCommands.map((cmd) => (
            <button
              key={cmd.key}
              className="cmdBtn"
              disabled={disabled || ap < cmd.apCost}
              onClick={handlers[cmd.key]}
              type="button"
            >
              <span className="cmdIcon">{cmd.icon}</span>
              <span>{cmd.label}</span>
              <span className="cmdAp">AP {cmd.apCost}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 軍事コマンド */}
      <div className="commandSection">
        <div className="commandLabel">軍 事</div>
        <div className="commandGrid">
          {militaryCommands.map((cmd) => (
            <button
              key={cmd.key}
              className={`cmdBtn${cmd.isRed ? ' invade' : ''}`}
              disabled={disabled || ap < cmd.apCost}
              onClick={handlers[cmd.key]}
              type="button"
            >
              <span className="cmdIcon">{cmd.icon}</span>
              <span>{cmd.label}</span>
              <span className="cmdAp">AP {cmd.apCost}</span>
            </button>
          ))}
          {/* ターン終了は軍事グリッドに収まらないので下に配置 */}
        </div>
      </div>

      {/* ターン終了 */}
      <button
        className="endTurnBtn"
        disabled={disabled}
        onClick={onEndTurn}
        type="button"
      >
        ターン終了（AP {ap}/{state.maxActionPoints}）
      </button>
    </footer>
  );
}
