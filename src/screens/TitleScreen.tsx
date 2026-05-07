import type { Difficulty } from '../types/game';

interface Props {
  hasSave: boolean;
  difficulty: Difficulty;
  onDifficultyChange: (d: Difficulty) => void;
  onContinue: () => void;
  onNewGame: () => void;
}

const diffLabels: Record<Difficulty, string> = { easy: '易', normal: '普', hard: '難' };

export function TitleScreen({ hasSave, difficulty, onDifficultyChange, onContinue, onNewGame }: Props) {
  return (
    <div className="titleScreen">
      <div className="titleArtLayer" aria-hidden="true">
        <img className="titleMapArt" src="/assets/art/map-design-sheet.png" alt="" draggable={false} />
        <img className="titleCharArt" src="/assets/art/character-design-sheet.png" alt="" draggable={false} />
      </div>

      <div className="titleContent">
        <div className="titleEyebrow">和風国取りシミュレーション</div>
        <h1 className="titleLogo">群雄ノ國</h1>
        <div className="titleSub">掌　中　戦　記</div>
      </div>

      <div className="titleMenus">
        {hasSave && (
          <button className="titleBtn primary" onClick={onContinue}>
            ▶　続きから
          </button>
        )}
        <button
          className={hasSave ? 'titleBtn secondary' : 'titleBtn primary'}
          onClick={onNewGame}
        >
          {hasSave ? '✦　ニューゲーム' : '▶　はじめる'}
        </button>
      </div>

      <div className="titleDiffRow">
        {(Object.keys(diffLabels) as Difficulty[]).map((d) => (
          <button
            key={d}
            className={`diffBtn${difficulty === d ? ' active' : ''}`}
            onClick={() => onDifficultyChange(d)}
          >
            {diffLabels[d]}
          </button>
        ))}
      </div>

      <div className="titleVersion">v2.0 — Cloudflare Pages</div>
    </div>
  );
}
