import { difficultyLabel } from '../data/names';
import type { Difficulty, GameState } from '../types/game';

interface SaveLoadPanelProps {
  state: GameState;
  notice: string;
  difficulty: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onSave: () => void;
  onLoad: () => void;
  onNewGame: () => void;
  onDelete: () => void;
}

export function SaveLoadPanel({
  state,
  notice,
  difficulty,
  onDifficultyChange,
  onSave,
  onLoad,
  onNewGame,
  onDelete,
}: SaveLoadPanelProps) {
  return (
    <section className="panel">
      <div className="sectionTitle">
        <h2>記録</h2>
        <span>{state.gameStatus === 'playing' ? `第 ${state.turn} 月 進行中` : '終了'}</span>
      </div>

      <div className="difficultyRow" style={{ marginBottom: 8 }}>
        {(Object.keys(difficultyLabel) as Difficulty[]).map((item) => (
          <button
            key={item}
            className={`diffBtn${difficulty === item ? ' isSelected' : ''}`}
            onClick={() => onDifficultyChange(item)}
            type="button"
          >
            {difficultyLabel[item]}
          </button>
        ))}
      </div>

      <div className="saveBtnRow" style={{ marginBottom: 6 }}>
        <button className="saveBtn" onClick={onSave} type="button">💾 手動セーブ</button>
        <button className="saveBtn" onClick={onLoad} type="button">📂 ロード</button>
      </div>
      <div className="saveBtnRow">
        <button className="saveBtn" onClick={onNewGame} type="button">✦ ニューゲーム</button>
        <button className="saveBtn dangerBtn" onClick={onDelete} type="button">🗑 セーブ削除</button>
      </div>

      <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 8, marginBottom: 0 }}>
        ターン進行時は自動セーブされます。
      </p>
    </section>
  );
}
