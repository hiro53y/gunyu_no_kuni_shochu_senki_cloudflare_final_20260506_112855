import { useEffect, useMemo, useState } from 'react';
import { ActionPanel } from './components/ActionPanel';
import { BattleResultModal } from './components/BattleResultModal';
import { EventLog } from './components/EventLog';
import { FactionStatus } from './components/FactionStatus';
import { GameHeader } from './components/GameHeader';
import { MapView } from './components/MapView';
import { OfficerCard } from './components/OfficerCard';
import { RegionDetail } from './components/RegionDetail';
import { SaveLoadPanel } from './components/SaveLoadPanel';
import { TutorialOverlay } from './components/TutorialOverlay';
import { createInitialGameState } from './data/initialGameData';
import { PLAYER_FACTION_ID } from './data/names';
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
import { getAvailableRonin, getFactionOfficers, getSelectedRegion } from './engine/selectors';
import { deleteSave, getTutorialSkipped, loadGame, saveGame, setTutorialSkipped } from './engine/save';
import type { ActionOutcome, Difficulty, DomesticFocus, GameState } from './types/game';
import './styles/global.css';
import './styles/mobile.css';

type TabKey = 'map' | 'officers' | 'domain' | 'logs';

function initialState(): GameState {
  const loaded = loadGame();
  if (loaded.ok && loaded.state) {
    return loaded.state;
  }
  return createInitialGameState('normal');
}

function App() {
  const [state, setState] = useState<GameState>(() => initialState());
  const [tab, setTab] = useState<TabKey>('map');
  const [focus, setFocus] = useState<DomesticFocus>('riceYield');
  const [notice, setNotice] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(state.difficulty);
  const [showTutorial, setShowTutorial] = useState(() => !getTutorialSkipped());
  const [visibleBattleId, setVisibleBattleId] = useState<string | null>(state.lastBattleResult?.id ?? null);

  const selectedRegion = getSelectedRegion(state);
  const playerOfficers = useMemo(() => getFactionOfficers(state, PLAYER_FACTION_ID), [state]);
  const availableRonin = useMemo(() => getAvailableRonin(state), [state]);

  useEffect(() => {
    if (state.lastBattleResult?.id) {
      setVisibleBattleId(state.lastBattleResult.id);
    }
  }, [state.lastBattleResult?.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveGame(state);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [state]);

  function runAction(action: (current: GameState) => ActionOutcome): void {
    setState((current) => {
      const outcome = action(current);
      window.setTimeout(() => setNotice(outcome.message), 0);
      return outcome.state;
    });
  }

  function handleSave(): void {
    const result = saveGame(state);
    setNotice(result.message);
  }

  function handleLoad(): void {
    const result = loadGame();
    if (result.ok && result.state) {
      setState(result.state);
      setDifficulty(result.state.difficulty);
      setNotice('ロードした。');
      return;
    }
    setNotice(result.error ?? 'ロードできなかった。');
  }

  function handleNewGame(): void {
    const next = createInitialGameState(difficulty);
    setState(next);
    setTab('map');
    setNotice('ニューゲームを開始した。');
  }

  function handleDeleteSave(): void {
    const result = deleteSave();
    setNotice(result.message);
  }

  function closeTutorial(): void {
    setTutorialSkipped();
    setShowTutorial(false);
  }

  const battleResult =
    state.lastBattleResult && visibleBattleId === state.lastBattleResult.id ? state.lastBattleResult : null;

  return (
    <div className="appShell">
      <GameHeader state={state} />

      <main className="mainArea">
        {notice && <div className="toastLine">{notice}</div>}

        <nav className="tabBar" aria-label="画面切替">
          {[
            ['map', '地図'],
            ['officers', '武将'],
            ['domain', '内政'],
            ['logs', 'ログ'],
          ].map(([key, label]) => (
            <button className={tab === key ? 'isSelected' : ''} key={key} onClick={() => setTab(key as TabKey)} type="button">
              {label}
            </button>
          ))}
        </nav>

        {tab === 'map' && (
          <div className="tabPanel">
            <MapView state={state} onSelectRegion={(regionId) => setState((current) => selectRegion(current, regionId))} />
            <RegionDetail
              state={state}
              onHire={(officerId) => runAction((current) => performHire(current, officerId))}
              onSelectRegion={(regionId) => setState((current) => selectRegion(current, regionId))}
            />
          </div>
        )}

        {tab === 'officers' && (
          <div className="tabPanel">
            <section className="panel">
              <div className="sectionTitle">
                <h2>武将</h2>
                <span>最大3人選択</span>
              </div>
              <div className="officerList">
                {playerOfficers.map((officer) => (
                  <OfficerCard
                    key={officer.id}
                    officer={officer}
                    selected={state.selectedOfficerIds.includes(officer.id)}
                    onToggle={(officerId) => setState((current) => toggleOfficerSelection(current, officerId))}
                  />
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === 'domain' && (
          <div className="tabPanel">
            <RegionDetail
              state={state}
              onHire={(officerId) => runAction((current) => performHire(current, officerId))}
              onSelectRegion={(regionId) => setState((current) => selectRegion(current, regionId))}
            />
            <FactionStatus state={state} />
            {availableRonin.length > 0 && (
              <section className="panel">
                <div className="sectionTitle">
                  <h2>登用</h2>
                  <span>{availableRonin.length}人</span>
                </div>
                <div className="hireList">
                  {availableRonin.map((officer) => (
                    <button key={officer.id} onClick={() => runAction((current) => performHire(current, officer.id))} type="button">
                      {officer.name}を登用
                    </button>
                  ))}
                </div>
              </section>
            )}
            <SaveLoadPanel
              difficulty={difficulty}
              notice={notice}
              onDelete={handleDeleteSave}
              onDifficultyChange={setDifficulty}
              onLoad={handleLoad}
              onNewGame={handleNewGame}
              onSave={handleSave}
              state={state}
            />
          </div>
        )}

        {tab === 'logs' && (
          <div className="tabPanel">
            <EventLog logs={state.logs} />
          </div>
        )}

        <aside className="currentTarget" aria-label="現在の選択">
          <span>選択</span>
          <strong>{selectedRegion.name}</strong>
          <small>{state.factions[selectedRegion.ownerFactionId].name}</small>
        </aside>
      </main>

      <ActionPanel
        focus={focus}
        onDomestic={() => runAction((current) => performDomestic(current, focus))}
        onEndTurn={() => runAction(endPlayerTurn)}
        onFocusChange={setFocus}
        onInvade={() => runAction(performInvade)}
        onRecruitTroops={() => runAction(performRecruitTroops)}
        onRest={() => runAction(performRest)}
        onSearch={() => runAction(performSearch)}
        onTrain={() => runAction(performTrain)}
        state={state}
      />

      <BattleResultModal result={battleResult} onClose={() => setVisibleBattleId(null)} />

      {state.result && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-labelledby="result-title">
          <section className={`resultModal ${state.gameStatus}`}>
            <p className="eyebrow">結果</p>
            <h2 id="result-title">{state.result.title}</h2>
            <p>{state.result.reason}</p>
            <dl className="battleStats">
              <div>
                <dt>到達月</dt>
                <dd>{state.result.reachedTurn}</dd>
              </div>
              <div>
                <dt>支配地域</dt>
                <dd>{state.result.controlledRegions}</dd>
              </div>
              <div>
                <dt>撃破勢力</dt>
                <dd>{state.result.defeatedMajorFactions}</dd>
              </div>
              <div>
                <dt>登用武将</dt>
                <dd>{state.result.recruitedOfficers}</dd>
              </div>
              <div>
                <dt>総戦闘</dt>
                <dd>{state.result.totalBattles}</dd>
              </div>
            </dl>
            <div className="battleBanner">{state.result.rating}</div>
            <button className="primaryButton" onClick={handleNewGame} type="button">
              再プレイ
            </button>
          </section>
        </div>
      )}

      {showTutorial && <TutorialOverlay onClose={closeTutorial} />}
    </div>
  );
}

export default App;
