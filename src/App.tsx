import { useCallback, useEffect, useRef, useState } from 'react';
import { TitleScreen } from './screens/TitleScreen';
import { MapScreen } from './screens/MapScreen';
import { BattleScene } from './screens/BattleScene';
import { createInitialGameState } from './data/initialGameData';
import {
  endPlayerTurn,
  performDomestic,
  performHire,
  performInvade,
  performRecruitTroops,
  performRest,
  performSearch,
  performTrain,
  selectRegion,
  toggleOfficerSelection,
} from './engine/actions';
import {
  deleteSave,
  hasSave as checkHasSave,
  loadGame,
  saveGame,
} from './engine/save';
import type {
  ActionOutcome,
  Difficulty,
  DomesticFocus,
  GameState,
} from './types/game';
import './styles/game.css';

type Screen = 'title' | 'map' | 'battle';

function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [state, setState] = useState<GameState>(() =>
    createInitialGameState('normal'),
  );
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [notice, setNotice] = useState('');
  const hasSave = checkHasSave();

  // 戦闘画面トリガー: lastBattleResult が更新されたら battle へ
  const lastBattleId = useRef<string | null>(null);
  useEffect(() => {
    const newId = state.lastBattleResult?.id ?? null;
    if (newId && newId !== lastBattleId.current) {
      lastBattleId.current = newId;
      setScreen('battle');
    }
  }, [state.lastBattleResult?.id]);

  // オートセーブ（map 画面中のみ）
  useEffect(() => {
    if (screen !== 'map') return;
    const t = window.setTimeout(() => saveGame(state), 350);
    return () => window.clearTimeout(t);
  }, [state, screen]);

  // ─── ナビゲーション ───────────────────────────────────
  function handleContinue() {
    const result = loadGame();
    if (result.ok && result.state) {
      setState(result.state);
      setDifficulty(result.state.difficulty);
      setScreen('map');
    } else {
      setNotice(result.error ?? 'ロードできなかった。');
    }
  }

  function handleNewGame() {
    setState(createInitialGameState(difficulty));
    lastBattleId.current = null;
    setNotice('新たな戦が始まった。');
    setScreen('map');
  }

  function handleBattleClose() {
    setScreen('map');
  }

  // ─── アクションラッパー ───────────────────────────────
  const runAction = useCallback(
    (action: (cur: GameState) => ActionOutcome) => {
      setState((cur) => {
        const outcome = action(cur);
        window.setTimeout(() => setNotice(outcome.message), 0);
        return outcome.state;
      });
    },
    [],
  );

  const [showNpc, setShowNpc] = useState(false);
  function handleEndTurn() {
    setShowNpc(true);
    setTimeout(() => {
      runAction(endPlayerTurn);
      setShowNpc(false);
    }, 500);
  }

  function handleSave() {
    setNotice(saveGame(state).message);
  }

  function handleLoad() {
    const result = loadGame();
    if (result.ok && result.state) {
      setState(result.state);
      setDifficulty(result.state.difficulty);
      setNotice('記録を読み込んだ。');
    } else {
      setNotice(result.error ?? 'ロードできなかった。');
    }
  }

  function handleDeleteSave() {
    setNotice(deleteSave().message);
  }

  // ─── 画面分岐 ────────────────────────────────────────
  if (screen === 'title') {
    return (
      <TitleScreen
        hasSave={hasSave}
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
        onContinue={handleContinue}
        onNewGame={handleNewGame}
      />
    );
  }

  if (screen === 'battle' && state.lastBattleResult) {
    return (
      <BattleScene
        result={state.lastBattleResult}
        state={state}
        onClose={handleBattleClose}
      />
    );
  }

  // ─── マップ画面（メインゲーム）────────────────────────
  return (
    <>
      <MapScreen
        state={state}
        notice={notice}
        onSelectRegion={(id) =>
          setState((cur) => selectRegion(cur, id))
        }
        onDomestic={(focus: DomesticFocus) =>
          runAction((cur) => performDomestic(cur, focus))
        }
        onRecruit={() => runAction(performRecruitTroops)}
        onTrain={() => runAction(performTrain)}
        onSearch={() => runAction(performSearch)}
        onInvade={() => runAction(performInvade)}
        onRest={() => runAction(performRest)}
        onEndTurn={handleEndTurn}
        onHire={(oid) => runAction((cur) => performHire(cur, oid))}
        onToggleOfficer={(id) =>
          setState((cur) => toggleOfficerSelection(cur, id))
        }
        onSave={handleSave}
        onLoad={handleLoad}
        onNewGame={handleNewGame}
        onDeleteSave={handleDeleteSave}
      />

      {state.result && (
        <div className="modalBackdrop" role="dialog" aria-modal="true">
          <section
            className={`resultModal ${
              state.gameStatus === 'victory' ? 'victory' : 'defeat'
            }`}
          >
            <p className="resultEyebrow">
              {state.gameStatus === 'victory' ? '天下統一' : '戦国の露と消えた'}
            </p>
            <h2 className="resultBanner">{state.result.title}</h2>
            <p className="resultReason">{state.result.reason}</p>
            <div className="resultGrid">
              {[
                ['到達月', `${state.result.reachedTurn} 月`],
                ['支配地域', `${state.result.controlledRegions} / 12`],
                ['撃破勢力', String(state.result.defeatedMajorFactions)],
                ['登用武将', String(state.result.recruitedOfficers)],
                ['総戦闘数', String(state.result.totalBattles)],
              ].map(([label, val]) => (
                <div key={label} className="resultItem">
                  <div className="riLabel">{label}</div>
                  <div className="riVal">{val}</div>
                </div>
              ))}
            </div>
            <div className="resultRating">{state.result.rating}</div>
            <button className="primaryBtn" onClick={handleNewGame} type="button">
              再び挑む
            </button>
          </section>
        </div>
      )}

      {showNpc && (
        <div className="npcOverlay" aria-live="polite">
          <div className="npcSpinner" />
          <p className="npcText">敵軍が動いている…</p>
        </div>
      )}
    </>
  );
}

export default App;
