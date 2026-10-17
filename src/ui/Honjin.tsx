// 本陣：八洲の地図・国の情報（領地・国力）・出陣／国の命令／妖魔討伐・交流・城下・武将・季節を進める・攻めてきた敵・捕らえた将
import { WarCouncil } from './WarCouncil';
import { canAct, recordEnding } from '../campaign/strategy';
import { useState } from 'react';
import { FACTIONS, TERRAIN_NAME, regionDef, turnLabel } from '../content/sengoku';
import type { Campaign, CommandId, Invasion, Placement, Scene, Settings } from '../campaign/state';
import {
  COMMANDS, LAND_NAME, TITLES, autoDefend, canAttack, castleDanger, commandKey, commandNeed, endTurn, genInfo, grossIncome, income, isBorder, lordLv, maxFans, nextFameStep, ownedCount,
  readyGenerals, recruit, regionLeaders, release, takeInvasion, totalNp, totalUpkeep, type Report,
} from '../campaign/campaign';
import { GROUND_NAME } from '../battle/engine';
import type { BattleKind } from '../battle/types';
import { KINDS } from '../battle/kinds';
import { bustUrl, tokenUrl } from './common';
import { YashimaMap } from './YashimaMap';
import { Formation } from './Formation';
import { GeneralsPanel } from './Generals';
import { TownPanel } from './Town';
import { CommandPanel } from './Command';
import { HelpBody } from './Help';
import { SettingsBody } from './SettingsPanel';
import { Modal } from './common';
import { playSe } from '../audio/sound';

export interface HonjinProps {
  c: Campaign;
  settings: Settings;
  onSettings: (s: Settings) => void;
  /** 本陣の状態が変わった（保存して描き直す） */
  onChange: () => void;
  onScene: (s: Scene) => void;
  onDepart: (mode: BattleKind, region: string, party: Placement[], seed: number, inv?: Invasion) => void;
  /** おまかせで終わった合戦の結果 */
  onReport: (rep: Report) => void;
  onTitle: () => void;
}

const newSeed = () => (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) | 0;

/** 領地の強さの目安（味方の兵と比べて） */
function threat(c: Campaign, rid: string): { label: string; cls: string } {
  const r = c.regions[rid];
  const d = castleDanger(c, rid) + Math.floor(r.taken / 2);
  const ours = readyGenerals(c).sort((a, b) => b.troops - a.troops).slice(0, 6).reduce((s, g) => s + g.troops, 0);
  const size = Math.min(6, 2 + Math.floor(d / 6) + (r.taken >= r.lands.length - 1 ? 1 : 0));
  const theirs = (280 + d * 32) * size * (1 + d / 40) * (1 - r.sabotage) * (r.lands[r.taken] === 'castle' ? 1.4 : r.lands[r.taken] === 'town' ? 1.15 : 1);
  const k = ours / Math.max(1, theirs);
  if (k >= 1.4) return { label: '楽', cls: 'easy' };
  if (k >= 0.95) return { label: '互角', cls: 'even' };
  if (k >= 0.65) return { label: '手強い', cls: 'hard' };
  return { label: '危険', cls: 'deadly' };
}

export function Honjin({ c, settings, onSettings, onChange, onScene, onDepart, onReport, onTitle }: HonjinProps) {
  const [sel, setSel] = useState<string | null>('01');
  const [modal, setModal] = useState<null | 'gens' | 'town' | 'news' | 'menu' | 'help' | 'settings' | 'titles' | 'end'>(null);
  const [form, setForm] = useState<{ mode: BattleKind; region: string; inv?: Invasion; seed: number } | null>(null);
  const [cmd, setCmd] = useState<{ id: CommandId; target: string } | null>(null);
  const [toast, setToast] = useState('');
  const r = sel ? regionDef(sel) : null;
  const rs = sel ? c.regions[sel] : null;
  const ours = rs?.owner === 'akatsuki';
  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast(''), 2600); };

  const doEndTurn = () => {
    playSe('stairs');
    const rep = endTurn(c);
    onChange();
    setModal(null);
    const bad = rep.lines.filter((l) => l.c === 'bad' || l.c === 'warn').length;
    flash(`${turnLabel(c.turn)}になった。${bad ? '敵が動いた！' : ''}`);
  };

  const inv = c.invasions[0];
  const captive = c.captives[0];
  const fame = nextFameStep(c);
  const upkeepOver = totalUpkeep(c) > totalNp(c);

  const cmdButton = (id: CommandId, target: string, label?: string) => {
    const key = c.progress[commandKey(id, target)];
    const need = commandNeed(c, id, target);
    return (
      <button key={id} disabled={COMMANDS[id].fan && c.fans <= 0} onClick={() => { playSe('menu'); setCmd({ id, target }); }}>
        {label ?? COMMANDS[id].name}<small>{key ? `${key}/${need}` : COMMANDS[id].stat === 'cmd' ? '統率' : COMMANDS[id].stat === 'pow' ? '武力' : '知略'}</small>
      </button>
    );
  };

  return (
    <div className={`honjin text-${settings.text}`}>
      <header className="hj-head">
        <div className="hj-turn">{turnLabel(c.turn)}</div>
        <div className="hj-ap" aria-label={`行動 残り${c.fans}`} title={fame ? `武名${c.fame}（${fame}で褒賞を選べる）` : `武名${c.fame}`}>
          {Array.from({ length: maxFans(c) }, (_, i) => <span key={i} className={i < c.fans ? 'on' : ''}>扇</span>)}
        </div>
        <div className="hj-gold">{c.gold.toLocaleString()}<small>文</small></div>
        <div className="hj-land">{ownedCount(c)}<small>/15国</small></div>
        <button className="menu-btn" onClick={() => setModal('menu')} aria-label="メニュー">≡</button>
      </header>
      <WarCouncil c={c} onChange={()=>{ recordEnding(c); onChange(); }} />
      <YashimaMap c={c} selected={sel} onSelect={(id) => { playSe('menu'); setSel(id); }} />
      <div className="hj-news" onClick={() => setModal('news')}>
        {c.news.slice(-2).map((n, i) => <div key={i} className={`msg ${n.c ?? ''}`}>{n.t}</div>)}
      </div>
      {r && rs && (
        <section className="region-panel">
          <div className="rp-head">
            <span className="rp-mon" style={{ background: FACTIONS[rs.owner].color }}>{FACTIONS[rs.owner].mon}</span>
            <div>
              <b className="rp-name">{r.name}</b><small>（{r.reading}）{TERRAIN_NAME[r.terrain]}・{r.product}</small>
              <div className="rp-owner">{FACTIONS[rs.owner].name}{r.capital ? '・本拠' : ''}{!ours && rs.owner !== 'akatsuki' ? (c.factions[rs.owner].war ? '・交戦中' : '・不戦') : ''}</div>
            </div>
          </div>
          {!ours && <div className="rp-lands" aria-label="領地">
            {rs.lands.map((g, i) => (
              <span key={i} className={`land l-${g} ${!ours && i < rs.taken ? 'taken' : ''} ${!ours && i === rs.taken ? 'next' : ''}`} title={GROUND_NAME[g]}>{LAND_NAME[g]}</span>
            ))}
            <small>国力 {rs.np}</small>
          </div>}
          {ours ? (
            <>
              <p className="rp-stats">国力 {rs.np}・収入 {Math.round(r.income * (0.6 + rs.np * 0.08))}文/季・守る時は{r.id === '01' ? '城' : '町'}の戦い</p>
              <div className="row-buttons wrap">
                {cmdButton('build', r.id)}
                {cmdButton('search', r.id)}
                <button disabled={c.fans <= 0} onClick={() => { playSe('menu'); setForm({ mode: 'hunt', region: r.id, seed: newSeed() }); }}>妖魔討伐<small>経験と文</small></button>
              </div>
            </>
          ) : (
            <>
              <div className="rp-leaders">
                {regionLeaders(c, r.id).map((id) => {
                  const info = genInfo(c, id);
                  return (
                    <div key={id} className="rp-leader">
                      <img src={tokenUrl(info.portrait)} alt="" width={36} height={36} />
                      <span><b>{info.short}</b><small>{id === rs.boss ? '城主' : '城の守り'}・{KINDS[c.gens[id].kind].name}・Lv{c.gens[id].lv}</small></span>
                    </div>
                  );
                })}
              </div>
              <p className="rp-stats">
                次は {GROUND_NAME[rs.lands[rs.taken]]}（{rs.taken + 1}/{rs.lands.length}）・強さ{castleDanger(c, r.id)}　<span className={`threat ${threat(c, r.id).cls}`}>{threat(c, r.id).label}</span>
                {rs.prep > 0 && <span className="tag good">準備+{Math.round(rs.prep * 100)}%</span>}
                {rs.sabotage > 0 && <span className="tag good">工作−{Math.round(rs.sabotage * 100)}%</span>}
              </p>
              <p className="rp-desc">兵種：{FACTIONS[rs.owner].troops.map(([k]) => KINDS[k].name).join('・')}{rs.taken + 1 >= rs.lands.length ? '　次は城（城主が出る）' : ''}</p>
              {isBorder(c, r.id) ? (
                <div className="row-buttons wrap">
                  {c.factions[rs.owner].war ? (
                    <button className="primary" disabled={!canAttack(c, r.id) || c.fans <= 0} onClick={() => { playSe('menu'); setForm({ mode: 'siege', region: r.id, seed: newSeed() }); }}>
                      攻める<small>{c.fans <= 0 ? '扇が残っていない' : '扇1'}</small>
                    </button>
                  ) : cmdButton('war', r.id)}
                  {cmdButton('prepare', r.id)}
                  {cmdButton('sabotage', r.id)}
                </div>
              ) : <p className="note">自分の国の隣ではない。</p>}
            </>
          )}
        </section>
      )}
      <nav className="hj-commands">
        <button onClick={() => { playSe('menu'); setModal('gens'); }}>武将<small>未行動{readyGenerals(c).length}人</small></button>
        <button onClick={() => { playSe('menu'); setModal('town'); }}>城下<small>補充・浪人</small></button>
        <button onClick={() => { playSe('menu'); setModal('news'); }}>記録<small>武名{c.fame}</small></button>
        <button className={`end-turn ${c.fans === 0 ? 'pulse' : ''}`} onClick={() => { playSe('menu'); setModal('end'); }}>季節を<br />進める</button>
      </nav>
      {toast && <div className="toast">{toast}</div>}

      {form && (
        <Formation
          c={c}
          mode={form.mode}
          region={form.region}
          seed={form.seed}
          inv={form.inv}
          onClose={() => setForm(null)}
          onGo={(party) => { const f = form; setForm(null); if (f.inv) takeInvasion(c, f.inv); onDepart(f.mode, f.region, party, f.seed, f.inv); }}
        />
      )}
      {cmd && (
        <CommandPanel
          c={c}
          cmd={cmd.id}
          target={cmd.target}
          onClose={() => setCmd(null)}
          onDone={(text, scene) => { setCmd(null); onChange(); flash(text); if (scene) onScene(scene); }}
        />
      )}
      {modal === 'gens' && <GeneralsPanel c={c} onChange={onChange} onScene={onScene} onPersuade={(id) => { setModal(null); setCmd({ id: 'persuade', target: id }); }} onClose={() => setModal(null)} />}
      {modal === 'town' && <TownPanel c={c} onChange={onChange} onClose={() => setModal(null)} />}
      {modal === 'news' && (
        <Modal title="記録" onClose={() => setModal(null)} className="log-modal">
          <p className="note">
            収入 毎季 {income(c).toLocaleString()}文{upkeepOver ? `（維持費${totalUpkeep(c)}が国力${totalNp(c)}を超え、本来の${grossIncome(c)}文の半分）` : `（国力${totalNp(c)}・維持費${totalUpkeep(c)}）`}・
            武名 {c.fame}{fame ? `（${fame}で行動+1）` : ''}・戦 {c.stats.battles}（勝ち{c.stats.wins}）・捕らえた将 {c.stats.captured}・討った敵兵 {c.stats.kills.toLocaleString()}・朔 Lv{lordLv(c)}
          </p>
          <button className="small" onClick={() => setModal('titles')}>称号を見る</button>
          <div className="log-list">{[...c.news].reverse().map((n, i) => <div key={i} className={`msg ${n.c ?? ''}`}><small>{turnLabel(n.turn)}</small> {n.t}</div>)}</div>
        </Modal>
      )}
      {modal === 'titles' && (
        <Modal title="称号" onClose={() => setModal('news')}>
          <div className="title-list">
            {TITLES.map((t) => <div key={t.id} className={`title-row ${c.titles[t.id] ? 'got' : ''}`}><b>{c.titles[t.id] ? t.name : '？？？'}</b><small>{t.desc}</small></div>)}
          </div>
        </Modal>
      )}
      {modal === 'menu' && (
        <Modal title="本陣" onClose={() => setModal(null)}>
          <div className="menu-list">
            <button onClick={() => setModal('help')}>遊び方</button>
            <button onClick={() => setModal('settings')}>設定</button>
            <button onClick={() => { setModal(null); onTitle(); }}>タイトルへ（自動で保存されています）</button>
          </div>
        </Modal>
      )}
      {modal === 'help' && <Modal title="遊び方" onClose={() => setModal('menu')} wide><HelpBody /></Modal>}
      {modal === 'settings' && <Modal title="設定" onClose={() => setModal('menu')}><SettingsBody settings={settings} onChange={onSettings} /></Modal>}
      {modal === 'end' && (
        <Modal title="季節を進めますか？" onClose={() => setModal(null)}>
          <p className="reserve">防衛に残せる武将 {Object.values(c.gens).filter(g=>canAct(c,g.id)&&g.troops>0).length}名・兵{Object.values(c.gens).filter(g=>canAct(c,g.id)&&g.troops>0).reduce((n,g)=>n+g.troops,0).toLocaleString()}。攻撃や内政で使った武将は敵の手番でも活動できません。</p>
          {c.fans > 0 && <p>まだ行動が{c.fans}回残っています。</p>}
          <p className="note">収入が入り（{income(c).toLocaleString()}文{upkeepOver ? '・維持費が国力を超えて半分' : ''}）、この季節に戦わなかった部隊の傷ついた兵が戻ります。敵の勢力も動きます。{c.turn + 1 >= 8 && !c.flags.youma ? '不穏な気配がする……' : ''}</p>
          <div className="row-buttons">
            <button onClick={() => setModal(null)}>やめる</button>
            <button className="primary" onClick={doEndTurn}>進める</button>
          </div>
        </Modal>
      )}
      {!form && inv && (
        <Modal title="敵襲！">
          <div className="invasion">
            <span className="rp-mon big" style={{ background: FACTIONS[inv.faction].color }}>{FACTIONS[inv.faction].mon}</span>
            <p><b>{FACTIONS[inv.faction].name}</b>が{regionDef(inv.from).name}から<b>{regionDef(inv.to).name}</b>へ攻めてきた！</p>
          </div>
          <div className="rp-leader">
            <img src={tokenUrl(genInfo(c, inv.commander).portrait)} alt="" width={40} height={40} />
            <span><b>{genInfo(c, inv.commander).name}</b><small>大将・{KINDS[c.gens[inv.commander].kind].name}・Lv{c.gens[inv.commander].lv}・強さ{inv.danger}</small></span>
          </div>
          <p className="note">守る側は{inv.to === '01' ? '城' : '町'}の戦い（戦果と打撃の上乗せあり）。負けると国を奪われる。</p>
          {inv.to === '01' && <p className="bad">暁原を失うと、暁ノ家は滅びます。</p>}
          <div className="row-buttons col">
            <button className="primary" onClick={() => { playSe('menu'); setForm({ mode: 'defense', region: inv.to, inv, seed: newSeed() }); }}>自ら迎え撃つ<small>陣立てをして合戦（扇は使わない）</small></button>
            <button onClick={() => {
              playSe('menu');
              const { report } = autoDefend(c, inv, newSeed());
              onChange();
              if (report) onReport(report);
              else flash(`${regionDef(inv.to).name}は守る部隊がおらず、奪われた……`);
            }}>家臣に任せる<small>おまかせで合戦（朔は出ない）</small></button>
          </div>
        </Modal>
      )}
      {!form && !inv && captive && (
        <CaptiveModal c={c} id={captive} onRecruit={() => { const s = recruit(c, captive); onChange(); if (s) onScene(s); }} onRelease={() => { release(c, captive); onChange(); }} />
      )}
    </div>
  );
}

function CaptiveModal({ c, id, onRecruit, onRelease }: { c: Campaign; id: string; onRecruit: () => void; onRelease: () => void }) {
  const info = genInfo(c, id);
  return (
    <Modal title="捕らえた将">
      <div className="captive">
        <img className="captive-bust" src={bustUrl(info.portrait)} alt="" />
        <div>
          <b>{info.name}</b>
          <p className="stats">{info.role}・{KINDS[c.gens[id].kind].name}・Lv{c.gens[id].lv}</p>
          <p className="stats">統{info.cmd} 武{info.pow} 知{info.int}</p>
          <p className="desc">{info.desc}</p>
        </div>
      </div>
      <div className="row-buttons">
        <button onClick={() => { playSe('menu'); onRelease(); }}>解き放つ<small>浪人宿で雇える</small></button>
        <button className="primary" onClick={() => { playSe('lvup'); onRecruit(); }}>家臣に迎える</button>
      </div>
    </Modal>
  );
}
