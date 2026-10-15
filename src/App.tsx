// 画面の切り替え：タイトル → 本陣（国盗り） → 冒険（城攻め・合戦・修行） → 結果 → 本陣
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Campaign, Invasion, Scene, Settings } from './campaign/state';
import { abortSortie, depart, finishSortie, newCampaign, type Report } from './campaign/campaign';
import { createRun } from './engine/run';
import { loadCampaign, loadRun, loadSettings, loadSnapshot, saveCampaign, saveRun, saveSettings, saveSnapshot } from './engine/save';
import type { Run, RunMode } from './engine/types';
import { setBgmVolume, trackUrl, useBgm, type Track } from './audio/bgm';
import { setSeVolume } from './audio/sound';
import { GameScreen } from './ui/GameScreen';
import { Honjin } from './ui/Honjin';
import { SceneView } from './ui/SceneView';
import { ResultScreen, TitleScreen } from './ui/TitleResult';
import { HelpBody } from './ui/Help';
import { SettingsBody } from './ui/SettingsPanel';
import { Modal, useSpritesReady } from './ui/common';

type Screen = 'title' | 'honjin' | 'game' | 'result';

// 開発用の絵の一覧（本番のビルドでは読み込まない）
const Gallery = import.meta.env.DEV ? lazy(() => import('./ui/Gallery')) : null;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export default function App() {
  const ready = useSpritesReady();
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings());
  const [c, setC] = useState<Campaign | null>(() => loadCampaign());
  const [run, setRun] = useState<Run | null>(() => loadRun());
  const [screen, setScreen] = useState<Screen>('title');
  const [report, setReport] = useState<Report | null>(null);
  const [panel, setPanel] = useState<null | 'help' | 'settings'>(null);
  const [, setVersion] = useState(0);
  const snapTurn = useRef<number>(c?.turn ?? 0);

  const setSettings = useCallback((s: Settings) => { setSettingsState(s); saveSettings(s); }, []);
  useEffect(() => { setSeVolume(settings.se); setBgmVolume(settings.bgm); }, [settings.se, settings.bgm]);

  /** 本陣が変わった：保存し、季節が変わっていれば写しも取る */
  const changed = useCallback(() => {
    if (!c) return;
    saveCampaign(c);
    if (c.turn !== snapTurn.current && !c.sortie) {
      snapTurn.current = c.turn;
      saveSnapshot(clone(c));
    }
    setVersion((v) => v + 1);
  }, [c]);

  const bgm: Track | null = useMemo(() => {
    if (screen === 'title') return 'title';
    if (screen === 'game') return 'battle';
    if (screen === 'result') return report?.kind === 'win' ? 'victory' : report?.kind === 'lose' ? 'defeat' : 'map';
    if (c?.defeat) return 'defeat';
    return 'map';
  }, [screen, report, c?.defeat]);
  useBgm(bgm ? trackUrl(bgm) : null, settings.bgm);

  // 開発中の確認用
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __camp: unknown }).__camp = { get: () => c, refresh: () => setVersion((v) => v + 1), save: () => c && saveCampaign(c) };
  }, [c]);

  const startNew = () => {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) | 0;
    const next = newCampaign(seed);
    saveRun(null);
    setRun(null);
    saveCampaign(next);
    saveSnapshot(clone(next));
    snapTurn.current = next.turn;
    setC(next);
    setScreen('honjin');
  };

  const onContinue = () => {
    if (!c) return;
    if (c.sortie) {
      if (run && !run.end) { setScreen('game'); return; }
      if (run && run.end) { endRun(run); return; }
      abortSortie(c);
      saveCampaign(c);
    }
    setScreen('honjin');
  };

  const onDepart = (mode: RunMode, region: string, party: string[], carry: number[], inv?: Invasion) => {
    if (!c) return;
    const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) | 0;
    const spec = depart(c, mode, region, { party, carry }, seed, inv);
    const next = createRun(spec);
    saveCampaign(c);
    saveRun(next);
    setRun(next);
    setScreen('game');
  };

  const endRun = useCallback((r: Run) => {
    if (!c) return;
    const rep = finishSortie(c, r);
    saveRun(null);
    setRun(null);
    saveCampaign(c);
    setReport(rep);
    setScreen('result');
  }, [c]);

  const giveUp = useCallback(() => {
    if (!run) return;
    run.end = { kind: 'quit', cause: '退却', floor: run.floorNo };
    endRun(run);
  }, [run, endRun]);

  const onScene = (s: Scene) => {
    if (!c) return;
    c.scenes.push(s);
    changed();
  };

  if (!ready) return <div className="loading">陣を敷いています……</div>;
  if (Gallery && location.search.includes('gallery')) return <Suspense fallback={null}><Gallery /></Suspense>;

  // できごと（会話）は、本陣と結果の上に重ねて順に見せる
  const scene = c && (screen === 'honjin') && c.scenes.length ? c.scenes[0] : null;

  let body: React.ReactNode;
  if (screen === 'game' && run && c) {
    body = <GameScreen key={run.seed} run={run} settings={settings} onSettings={setSettings} onEnd={() => endRun(run)} onSuspend={() => setScreen('title')} onGiveUp={giveUp} />;
  } else if (screen === 'result' && report && c) {
    body = <ResultScreen c={c} rep={report} onBack={() => { setReport(null); setScreen('honjin'); changed(); }} />;
  } else if (screen === 'honjin' && c) {
    body = (
      <Honjin c={c} settings={settings} onSettings={setSettings} onChange={changed} onScene={onScene} onDepart={onDepart} onTitle={() => setScreen('title')} />
    );
  } else {
    body = (
      <TitleScreen c={c} running={!!c?.sortie} onContinue={onContinue} onNew={startNew} onHelp={() => setPanel('help')} onSettings={() => setPanel('settings')} />
    );
  }

  return (
    <>
      {body}
      {scene && c && <SceneView c={c} scene={scene} onDone={() => { c.scenes.shift(); changed(); }} />}
      {!scene && screen === 'honjin' && c?.defeat && (
        <Modal title="落城">
          <p>本拠の暁原を失い、暁ノ家は滅びた……</p>
          <div className="row-buttons col">
            <button className="primary" onClick={() => {
              const snap = loadSnapshot();
              if (snap && !snap.defeat) { saveCampaign(snap); snapTurn.current = snap.turn; setC(snap); }
            }}>この季節の始めからやり直す</button>
            <button onClick={() => setScreen('title')}>タイトルへ</button>
          </div>
        </Modal>
      )}
      {panel === 'help' && <Modal title="遊び方" onClose={() => setPanel(null)} wide><HelpBody /></Modal>}
      {panel === 'settings' && <Modal title="設定" onClose={() => setPanel(null)}><SettingsBody settings={settings} onChange={setSettings} /></Modal>}
    </>
  );
}
