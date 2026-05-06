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
        <h2>保存</h2>
        <span>{state.gameStatus === 'playing' ? '進行中' : '終了'}</span>
      </div>
      {notice && <p className="noticeText">{notice}</p>}
      <div className="difficultyRow">
        {(Object.keys(difficultyLabel) as Difficulty[]).map((item) => (
          <button
            className={difficulty === item ? 'isSelected' : ''}
            key={item}
            onClick={() => onDifficultyChange(item)}
            type="button"
          >
            {difficultyLabel[item]}
          </button>
        ))}
      </div>
      <div className="saveGrid">
        <button onClick={onSave} type="button">
          手動セーブ
        </button>
        <button onClick={onLoad} type="button">
          ロード
        </button>
        <button onClick={onNewGame} type="button">
          ニューゲーム
        </button>
        <button className="dangerButton" onClick={onDelete} type="button">
          セーブ削除
        </button>
      </div>
      <small>ターン進行時は自動セーブされます。</small>
    </section>
  );
}
