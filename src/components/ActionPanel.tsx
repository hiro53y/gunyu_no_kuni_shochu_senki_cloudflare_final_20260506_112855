import type { DomesticFocus, GameState } from '../types/game';

interface ActionPanelProps {
  state: GameState;
  focus: DomesticFocus;
  onFocusChange: (focus: DomesticFocus) => void;
  onDomestic: () => void;
  onRecruitTroops: () => void;
  onTrain: () => void;
  onSearch: () => void;
  onInvade: () => void;
  onRest: () => void;
  onEndTurn: () => void;
}

const focusOptions: { value: DomesticFocus; label: string }[] = [
  { value: 'riceYield', label: '石高' },
  { value: 'publicOrder', label: '治安' },
  { value: 'castleHp', label: '城' },
  { value: 'developmentLevel', label: '開発' },
];

export function ActionPanel({
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
}: ActionPanelProps) {
  const disabled = state.gameStatus !== 'playing';
  return (
    <footer className="actionPanel">
      <div className="focusSelect" aria-label="内政方針">
        {focusOptions.map((option) => (
          <button
            className={focus === option.value ? 'isSelected' : ''}
            key={option.value}
            onClick={() => onFocusChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="actionGrid">
        <button disabled={disabled} onClick={onDomestic} type="button">
          内政
        </button>
        <button disabled={disabled} onClick={onRecruitTroops} type="button">
          徴兵
        </button>
        <button disabled={disabled} onClick={onTrain} type="button">
          訓練
        </button>
        <button disabled={disabled} onClick={onSearch} type="button">
          探索
        </button>
        <button disabled={disabled} onClick={onInvade} type="button">
          進軍
        </button>
        <button disabled={disabled} onClick={onRest} type="button">
          休養
        </button>
        <button className="endTurnButton" disabled={disabled} onClick={onEndTurn} type="button">
          ターン終了
        </button>
      </div>
    </footer>
  );
}
