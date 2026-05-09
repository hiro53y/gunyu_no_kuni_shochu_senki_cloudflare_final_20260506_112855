// ===========================================================================
// 設定・アクセシビリティダイアログ
// 文字サイズ／アニメーション無効化／音量
// ===========================================================================

import type { GameConfig } from '../types/game';

interface Props {
  config: GameConfig;
  onChange: (next: GameConfig) => void;
  onClose: () => void;
}

export function SettingsDialog({ config, onChange, onClose }: Props) {
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="settingsDialog" onClick={(e) => e.stopPropagation()}>
        <button className="closeBtn" onClick={onClose} aria-label="閉じる">×</button>
        <h2 className="rdTitle">設定</h2>

        <section className="settingSection">
          <h3 className="settingLabel">文字サイズ</h3>
          <div className="settingRow">
            {(['small', 'medium', 'large'] as const).map((size) => (
              <button
                key={size}
                className={`settingChoice ${config.fontSize === size ? 'active' : ''}`}
                onClick={() => onChange({ ...config, fontSize: size })}
              >
                {size === 'small' ? '小' : size === 'medium' ? '中' : '大'}
              </button>
            ))}
          </div>
        </section>

        <section className="settingSection">
          <h3 className="settingLabel">演出</h3>
          <div className="settingRow">
            <label className="settingToggle">
              <input
                type="checkbox"
                checked={config.animationsDisabled}
                onChange={(e) => onChange({ ...config, animationsDisabled: e.target.checked })}
              />
              <span>アニメーションを抑制（カットイン・ダメージ表示を簡略化）</span>
            </label>
          </div>
        </section>

        <section className="settingSection">
          <h3 className="settingLabel">音量</h3>
          <div className="settingRow">
            <label className="settingSlider">
              <span>BGM</span>
              <input
                type="range" min={0} max={100}
                value={Math.round(config.musicVolume * 100)}
                onChange={(e) => onChange({ ...config, musicVolume: Number(e.target.value) / 100 })}
              />
              <span className="settingValue">{Math.round(config.musicVolume * 100)}</span>
            </label>
          </div>
          <div className="settingRow">
            <label className="settingSlider">
              <span>SE</span>
              <input
                type="range" min={0} max={100}
                value={Math.round(config.sfxVolume * 100)}
                onChange={(e) => onChange({ ...config, sfxVolume: Number(e.target.value) / 100 })}
              />
              <span className="settingValue">{Math.round(config.sfxVolume * 100)}</span>
            </label>
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            ※ 現バージョンは音声未実装。設定は次バージョンで反映されます。
          </div>
        </section>

        <div className="rdFooter">
          <button className="rdCloseBtn" onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}
