// ===========================================================================
// 群雄ノ國：掌中戦記 v2.1 アプリエントリ
// タイトル画面 ↔ 地図画面のスクリーンルーター
// 設定（fontSize / animationsDisabled）を <html> に data 属性として反映
// ===========================================================================

import { useEffect, useState } from 'react';
import type { GameState, GameConfig } from './types/game';
import { TitleScreen } from './screens/TitleScreen';
import { MapScreen } from './screens/MapScreen';
import './styles/tokens.css';
import './styles/screens.css';

type Screen = 'title' | 'map';

const CONFIG_KEY = 'gunyu_no_kuni_config_v21';
const DEFAULT_CONFIG: GameConfig = {
  musicVolume: 0.6,
  sfxVolume: 0.7,
  fontSize: 'medium',
  animationsDisabled: false,
};

function loadConfig(): GameConfig {
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<GameConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}
function saveConfig(c: GameConfig): void {
  try { window.localStorage.setItem(CONFIG_KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

/** <html> に data-属性で反映 */
function applyConfigToRoot(c: GameConfig): void {
  const root = document.documentElement;
  root.setAttribute('data-font-size', c.fontSize);
  root.setAttribute('data-animations', c.animationsDisabled ? 'off' : 'on');
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [state, setState] = useState<GameState | null>(null);
  const [config, setConfig] = useState<GameConfig>(() => loadConfig());

  useEffect(() => {
    applyConfigToRoot(config);
    saveConfig(config);
  }, [config]);

  useEffect(() => {
    if (state && state.config) {
      setConfig(state.config);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.config]);

  function handleStartGame(s: GameState) {
    setState({ ...s, config });
    setScreen('map');
  }

  function handleReturnTitle() {
    if (state && state.victory === 'none' &&
        !window.confirm('地図画面を離れてタイトルに戻りますか？（自動セーブは保持されます）')) {
      return;
    }
    setScreen('title');
  }

  function updateState(updater: (s: GameState) => GameState) {
    setState((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      if (next.config !== prev.config) {
        setConfig(next.config);
      }
      return next;
    });
  }

  function handleConfigChange(next: GameConfig) {
    setConfig(next);
    if (state) {
      setState({ ...state, config: next });
    }
  }

  if (screen === 'title' || !state) {
    return (
      <TitleScreen
        config={config}
        onConfigChange={handleConfigChange}
        onStartGame={handleStartGame}
      />
    );
  }

  return (
    <MapScreen
      state={state}
      setState={updateState}
      onReturnTitle={handleReturnTitle}
    />
  );
}
