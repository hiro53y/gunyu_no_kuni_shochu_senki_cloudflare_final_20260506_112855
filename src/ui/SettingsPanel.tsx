// 設定：音量・敵の動きの速さ・文字の大きさ
import type { Settings } from '../campaign/state';

export function SettingsBody({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  return (
    <div className="settings">
      <label className="setting-row">
        <span>BGMの音量</span>
        <input type="range" min={0} max={1} step={0.05} value={settings.bgm} onChange={(e) => set({ bgm: Number(e.target.value) })} />
        <span className="val">{Math.round(settings.bgm * 100)}</span>
      </label>
      <label className="setting-row">
        <span>効果音の音量</span>
        <input type="range" min={0} max={1} step={0.05} value={settings.se} onChange={(e) => set({ se: Number(e.target.value) })} />
        <span className="val">{Math.round(settings.se * 100)}</span>
      </label>
      <label className="setting-row">
        <span>動きを速く</span>
        <input type="checkbox" checked={settings.anim !== 0} onChange={(e) => set({ anim: e.target.checked ? 1 : 0 })} />
        <span className="val">{settings.anim !== 0 ? '速い' : 'ふつう'}</span>
      </label>
      <div className="setting-row">
        <span>文字の大きさ</span>
        <div className="seg">
          {(['s', 'm', 'l'] as const).map((t) => (
            <button key={t} className={settings.text === t ? 'on' : ''} onClick={() => set({ text: t })}>{t === 's' ? '小' : t === 'm' ? '中' : '大'}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
