// ===========================================================================
// タイトル画面
// 朱の朝日を背景に、ロゴと縦並びメニューを表示する。
// 設定ダイアログも統合。
// ===========================================================================

import { useState } from 'react';
import type { GameState, GameConfig } from '../types/game';
import { hasSave, hasAutoSave, loadGame, loadAutoSave, deleteSave } from '../engine';
import { createNewGame } from '../createGame';
import { SettingsDialog } from '../components/SettingsDialog';
import { audio } from '../audio/AudioManager';

interface Props {
  config: GameConfig;
  onConfigChange: (next: GameConfig) => void;
  onStartGame: (state: GameState) => void;
}

export function TitleScreen({ config, onConfigChange, onStartGame }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const continueAvailable = hasAutoSave();
  const saveAvailable = hasSave();

  function handleNew() {
    audio.play('click');
    const initial = createNewGame();
    onStartGame({ ...initial, config });
  }
  function handleContinue() {
    audio.play('click');
    const r = loadAutoSave();
    if (r.ok && r.state) onStartGame(r.state);
    else { audio.play('fail'); alert(r.error ?? 'コンティニューできません'); }
  }
  function handleLoad() {
    audio.play('click');
    const r = loadGame();
    if (r.ok && r.state) onStartGame(r.state);
    else { audio.play('fail'); alert(r.error ?? 'ロードできません'); }
  }
  function handleDelete() {
    audio.play('tap');
    if (window.confirm('セーブデータを削除しますか？')) {
      deleteSave();
      window.location.reload();
    }
  }

  return (
    <div className="titleScreen" role="main">
      <svg
        width="100%" height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, opacity: 0.55, pointerEvents: 'none' }}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="sun" cx="0.5" cy="0.4" r="0.25">
            <stop offset="0%" stopColor="#FFE5A0" />
            <stop offset="60%" stopColor="#C84A4A" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#C84A4A" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="40" r="22" fill="url(#sun)" />
        <path
          d="M-5 80 L8 68 L18 75 L28 60 L40 70 L55 55 L68 65 L82 50 L95 65 L105 80 L105 105 L-5 105 Z"
          fill="#0F0C0A"
          opacity="0.85"
        />
        <path
          d="M-5 88 L12 76 L25 82 L40 72 L55 80 L70 70 L85 78 L105 74 L105 105 L-5 105 Z"
          fill="#1F1A16"
          opacity="0.9"
        />
      </svg>

      <div className="titleLogo">群雄ノ國</div>
      <div className="titleSubLogo">掌中戦記</div>
      <div className="titleVer">v2.1 (2026)</div>

      <div className="titleMenu">
        {continueAvailable && (
          <button className="primary" onClick={handleContinue}>
            コンティニュー
          </button>
        )}
        <button className={continueAvailable ? '' : 'primary'} onClick={handleNew}>
          ニューゲーム
        </button>
        <button onClick={handleLoad} disabled={!saveAvailable}>
          ロード
        </button>
        <button onClick={() => setShowSettings(true)}>設定</button>
        {saveAvailable && (
          <button onClick={handleDelete} style={{ minWidth: 280, opacity: 0.6 }}>
            セーブ削除
          </button>
        )}
      </div>

      <div className="titleFooter">
        和風伝奇ファンタジー国盗りSLG ／ オリジナル創作
      </div>

      {showSettings && (
        <SettingsDialog
         config={config}
          onChange={onConfigChange}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
