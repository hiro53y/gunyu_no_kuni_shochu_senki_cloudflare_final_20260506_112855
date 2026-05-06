import { useEffect, useMemo, useState } from 'react';
import { BattleScreen } from './components/BattleScreen';
import { CommandPanel } from './components/CommandPanel';
import { EventLog } from './components/EventLog';
import { EventModal } from './components/EventModal';
import { FactionStatus } from './components/FactionStatus';
import { GameHeader } from './components/GameHeader';
import { OfficerCard } from './components/OfficerCard';
import { RegionDetail } from './components/RegionDetail';
import { SaveLoadPanel } from './components/SaveLoadPanel';
import { SvgMap } from './components/SvgMap';
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
import {
  getAvailableRonin,
  getFactionOfficers,
  getSelectedRegion,
} from './engine/selectors';
import {
  deleteSave,
  getTutorialSkipped,
  loadGame,
  saveGame,
  setTutorialSkipped,
} from './engine/save';
import type {
  ActionOutcome,
  Difficulty,
  DomesticFocus,
  GameState,
  RandomEventKind,
} from './types/game';
import './styles/global.css';
import './styles/mobile.css';

type TabKey = 'map' | 'officers' | 'domain' | 'logs';

const shownEventIds = new Set<string>();

function initialState(): GameState {
  const loaded = loadGame();
  if (loaded.ok && loaded.state) return loaded.state;
  return createInitialGameState('normal');
}

function extractPendingEvent(
  next: GameState,
): { kind: RandomEventKind; effectText: string; logId: string } | null {
  const newLogs = next.logs.filter(
    (l) => l.type === 'event' && !shownEventIds.has(l.id),
  );
  if (newLogs.length === 0) return null;
  const log = newLogs[newLogs.length - 1];
  const kindMap: Record<string, RandomEventKind> = {
    豊作: 'goodHarvest',
    凶作: 'badHarvest',
    商人: 'merchant',
    浪人: 'ronin',
    一揆: 'uprising',
    名工: 'artisan',
    流言: 'rumor',
    祭礼: 'festival',
  };
  let kind: RandomEventKind = 'goodHarvest';
  for (const [keyword, k] of Object.entries(kindMap)) {
    if (log.message.includes(keyword)) {
      kind = k;
      break;
    }
  }
  return { kind, effectText: log.message, logId: log.id };
}

function App() {
  const [state, setState] = useState<GameState>(() => initialState());
  const [tab, setTab] = useState<TabKey>('map');
  const [focus, setFocus] = useState<DomesticFocus>('riceYield');
  const [notice, setNotice] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(state.difficulty);
  const [showTutorial, setShowTutorial] = useState(() => !getTutorialSkipped());
  const [visibleBattleId, setVisibleBattleId] = useState<string | null>(
    state.lastBattleResult?.id ?? null,
  );
  const [pendingEvent, setPendingEvent] = useState<{
    kind: RandomEventKind;
    effectText: string;
  } | null>(null);
  const [showNpcOverlay, setShowNpcOverlay] = useState(false);

  const selectedRegion = getSelectedRegion(state);
  const playerOfficers = useMemo(() => getFactionOfficers(state, PLAYER_FACTION_ID), [state]);
  const availableRonin = useMemo(() => getAvailableRonin(state), [state]);

  useEffect(() => {
    if (state.lastBattleResult?.id) {
      setVisibleBattleId(state.lastBattleResult.id);
    }
  }, [state.lastBattleResult?.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => saveGame(state), 350);
    return () => window.clearTimeout(timer);
  }, [state]);

  function runAction(action: (current: GameState) => ActionOutcome): void {
    setState((current) => {
      const outcome = action(current);
      window.setTimeout(() => setNotice(outcome.message), 0);
      const ev = extractPendingEvent(outcome.state);
      if (ev) {
        shownEventIds.add(ev.logId);
        window.setTimeout(
          () => setPendingEvent({ kind: ev.kind, effectText: ev.effectText }),
          120,
        );
      }
      return outcome.state;
    });
  }

  function handleEndTurn(): void {
    setShowNpcOverlay(true);
    setTimeout(() => {
      runAction(endPlayerTurn);
      setShowNpcOverlay(false);
    }, 450);
  }

  function handleSave(): void { setNotice(saveGame(state).message); }

  function handleLoad(): void {
    const result = loadGame();
    if (result.ok && result.state) {
      setState(result.state);
      setDifficulty(result.state.difficulty);
      setNotice('記録を読み込んだ。');
    } else {
      setNotice(result.error ?? 'ロードできなかった。');
    }
  }

  function handleNewGame(): void {
    setState(createInitialGameState(difficulty));
    setTab('map');
    setNotice('新たな戦が始まった。');
  }

  function handleDeleteSave(): void { setNotice(deleteSave().message); }

  const battleResult =
    state.lastBattleResult && visibleBattleId === state.lastBattleResult.id
      ? state.lastBattleResult
      : null;

  return (
    <div className="appShell">
      <GameHeader state={state} />

      <main className="mainArea">
        {notice && <div className="toastLine">{notice}</div>}

        {/* タブバー */}
        <nav className="tabBar" aria-label="画面切替">
          {(
            [
              ['map',     '地　図'],
              ['officers','武　将'],
              ['domain',  '内　政'],
              ['logs',    '軍　記'],
            ] as [TabKey, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? 'isSelected' : ''}
              onClick={() => setTab(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>

        {/* ── 地図タブ ── */}
        {tab === 'map' && (
          <div className="tabPanel">
            <SvgMap
              state={state}
              onSelectRegion={(rid) => setState((cur) => selectRegion(cur, rid))}
            />
            <RegionDetail
              state={state}
              onHire={(oid) => runAction((cur) => performHire(cur, oid))}
              onSelectRegion={(rid) => setState((cur) => selectRegion(cur, rid))}
            />
          </div>
        )}

        {/* ── 武将タブ ── */}
        {tab === 'officers' && (
          <div className="tabPanel">
            <section className="panel">
              <div className="sectionTitle">
                <h2>武　将</h2>
                <span>最大3人選択</span>
              </div>
              <div className="officerList">
                {playerOfficers.map((officer) => (
                  <OfficerCard
                    key={officer.id}
                    officer={officer}
                    selected={state.selectedOfficerIds.includes(officer.id)}
                    onToggle={(oid) =>
                      setState((cur) => toggleOfficerSelection(cur, oid))
                    }
                  />
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ── 内政タブ ── */}
        {tab === 'domain' && (
          <div className="tabPanel">
            <RegionDetail
              state={state}
              onHire={(oid) => runAction((cur) => performHire(cur, oid))}
              onSelectRegion={(rid) => setState((cur) => selectRegion(cur, rid))}
            />
            <FactionStatus state={state} />
            {availableRonin.length > 0 && (
              <section className="panel">
                <div className="sectionTitle">
                  <h2>登　用</h2>
                  <span>浪人 {availableRonin.length}人</span>
                </div>
                <div className="hireList">
                  {availableRonin.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => runAction((cur) => performHire(cur, o.id))}
                      type="button"
                    >
                      {o.name}を登用する
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

        {/* ── 軍記タブ ── */}
        {tab === 'logs' && (
          <div className="tabPanel">
            <EventLog logs={state.logs} />
          </div>
        )}

        {/* 現在の選択バー */}
        <div className="currentTarget" aria-label="現在の選択">
          <span className="ctLabel">選択</span>
          <strong className="ctName">{selectedRegion.name}</strong>
          <span
            className="ctFaction"
            style={{ color: state.factions[selectedRegion.ownerFactionId]?.color }}
          >
            {state.factions[selectedRegion.ownerFactionId]?.name}
          </span>
        </div>
      </main>

      {/* ━━ コマンドパネル ━━ */}
      <CommandPanel
        focus={focus}
        onDomestic={() => runAction((cur) => performDomestic(cur, focus))}
        onEndTurn={handleEndTurn}
        onFocusChange={setFocus}
        onInvade={() => runAction(performInvade)}
        onRecruitTroops={() => runAction(performRecruitTroops)}
        onRest={() => runAction(performRest)}
        onSearch={() => runAction(performSearch)}
        onTrain={() => runAction(performTrain)}
        state={state}
      />

      {/* ━━ 戦闘画面 ━━ */}
      {battleResult && (
        <BattleScreen
          result={battleResult}
          state={state}
          onClose={() => setVisibleBattleId(null)}
        />
      )}

      {/* ━━ イベントモーダル ━━ */}
      {pendingEvent && !battleResult && (
        <EventModal
          eventKind={pendingEvent.kind}
          effectText={pendingEvent.effectText}
          onClose={() => setPendingEvent(null)}
        />
      )}

      {/* ━━ ゲーム結果 ━━ */}
      {state.result && (
        <div
          className="modalBackdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="result-title"
        >
          <section
            className={`resultModal ${state.gameStatus === 'victory' ? 'victory' : 'defeat'}`}
          >
            <p className="resultEyebrow">
              {state.gameStatus === 'victory' ? '天下統一' : '戦国の露と消えた'}
            </p>
            <h2 id="result-title" className="resultBanner">
              {state.result.title}
            </h2>
            <p className="resultReason">{state.result.reason}</p>
            <div className="resultGrid">
              {[
                ['到達月',    `${state.result.reachedTurn} 月`],
                ['支配地域',  `${state.result.controlledRegions} / 12`],
                ['撃破勢力',  String(state.result.defeatedMajorFactions)],
                ['登用武将',  String(state.result.recruitedOfficers)],
                ['総戦闘数',  String(state.result.totalBattles)],
              ].map(([label, val]) => (
                <div key={label} className="resultItem">
                  <div className="riLabel">{label}</div>
                  <div className="riVal">{val}</div>
                </div>
              ))}
            </div>
            <div className="resultRating">{state.result.rating}</div>
            <button className="primaryButton" onClick={handleNewGame} type="button">
              再び挑む
            </button>
          </section>
        </div>
      )}

      {/* ━━ チュートリアル ━━ */}
      {showTutorial && (
        <TutorialOverlay
          onClose={() => {
            setTutorialSkipped();
            setShowTutorial(false);
          }}
        />
      )}

      {/* ━━ NPC処理中オーバーレイ ━━ */}
      {showNpcOverlay && (
        <div className="npcOverlay" aria-live="polite">
          <div className="npcSpinner" />
          <p className="npcText">敵軍が動いている…</p>
        </div>
      )}
    </div>
  );
}

export default App;
