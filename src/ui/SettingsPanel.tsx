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
      <div className="setting-row">
        <span>合戦の演出</span>
        <div className="seg" role="group" aria-label="合戦の演出速度">
          {([0, 1, 2] as const).map(anim => <button key={anim} aria-pressed={settings.anim === anim} className={settings.anim === anim ? 'on' : ''} onClick={() => set({ anim })}>{['ふつう', '速い', 'なし'][anim]}</button>)}
        </div>
      </div>
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
