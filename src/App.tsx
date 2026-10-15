// 画面の切り替え：タイトル → 本陣（国盗り） → 合戦（城攻め・迎撃・妖魔討伐） → 結果 → 本陣
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Campaign, Invasion, Placement, Scene, Settings } from './campaign/state';
import { abortSortie, beginBattle, finishBattle, forts, newCampaign, type Report } from './campaign/campaign';
import { createBattle } from './battle/engine';
import type { Battle, BattleKind } from './battle/types';
import { regionDef } from './content/sengoku';
import { loadBattle, loadCampaign, loadSettings, loadSnapshot, saveBattle, saveCampaign, saveSettings, saveSnapshot } from './engine/save';
import { setBgmVolume, trackUrl, useBgm, type Track } from './audio/bgm';
import { setSeVolume } from './audio/sound';
import { BattleScreen } from './ui/BattleScreen';
import { Honjin } from './ui/Honjin';
import { SceneView } from './ui/SceneView';
import { ResultScreen, TitleScreen } from './ui/TitleResult';
import { HelpBody } from './ui/Help';
import { SettingsBody } from './ui/SettingsPanel';
import { Modal } from './ui/common';

type Screen = 'title' | 'honjin' | 'battle' | 'result';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function battleTitle(c: Campaign, b: Battle): string {
  const r = regionDef(b.region);
  if (b.kind === 'siege') {
    const total = forts(b.region);
    const no = c.regions[b.region].taken + 1;
    return `${r.name}・${no >= total ? '本城' : `砦${no}/${total}`}`;
  }
  if (b.kind === 'defense') return `${r.name}・迎撃`;
  return `${r.name}・妖魔討伐`;
}

export default function App() {
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings());
  const [c, setC] = useState<Campaign | null>(() => loadCampaign());
  const [battle, setBattle] = useState<Battle | null>(() => loadBattle());
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
    if (screen === 'battle') return 'battle';
    if (screen === 'result') return report?.kind === 'win' ? 'victory' : 'defeat';
    if (c?.defeat) return 'defeat';
    return 'map';
  }, [screen, report, c?.defeat]);
  useBgm(bgm ? trackUrl(bgm) : null, settings.bgm);

  // 開発中の確認用
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __camp: unknown }).__camp = { get: () => c, battle: () => battle, refresh: () => setVersion((v) => v + 1), save: () => c && saveCampaign(c) };
  }, [c, battle]);

  const startNew = () => {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) | 0;
    const next = newCampaign(seed);
    saveBattle(null);
    setBattle(null);
    saveCampaign(next);
    saveSnapshot(clone(next));
    snapTurn.current = next.turn;
    setC(next);
    setScreen('honjin');
  };

  const endBattle = useCallback((b: Battle) => {
    if (!c) return;
    const rep = finishBattle(c, b);
    saveBattle(null);
    setBattle(null);
    saveCampaign(c);
    setReport(rep);
    setScreen('result');
  }, [c]);

  const onContinue = () => {
    if (!c) return;
    if (c.sortie) {
      if (battle && !battle.end) { setScreen('battle'); return; }
      if (battle && battle.end) { endBattle(battle); return; }
      abortSortie(c);
      saveCampaign(c);
    }
    setScreen('honjin');
  };

  const onDepart = (mode: BattleKind, region: string, party: Placement[], seed: number, inv?: Invasion) => {
    if (!c) return;
    const spec = beginBattle(c, mode, region, party, seed, inv);
    const next = createBattle(spec);
    saveCampaign(c);
    saveBattle(next);
    setBattle(next);
    setScreen('battle');
  };

  const onScene = (s: Scene) => {
    if (!c) return;
    c.scenes.push(s);
    changed();
  };

  // できごと（会話）は、本陣の上に重ねて順に見せる
  const scene = c && screen === 'honjin' && c.scenes.length ? c.scenes[0] : null;

  let body: React.ReactNode;
  if (screen === 'battle' && battle && c) {
    body = <BattleScreen key={battle.seed} b={battle} title={battleTitle(c, battle)} settings={settings} onSettings={setSettings} onEnd={() => endBattle(battle)} />;
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
