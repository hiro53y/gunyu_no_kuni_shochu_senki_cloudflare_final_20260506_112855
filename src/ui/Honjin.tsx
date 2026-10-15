// 本陣：八洲の地図・国の情報・出陣／妖魔討伐／内政／交流・城下・武将・ターンの終わり・攻めてきた敵・捕らえた将
import { useState } from 'react';
import { FACTIONS, TERRAIN_NAME, regionDef, turnLabel } from '../content/sengoku';
import type { Campaign, Invasion, Placement, Scene, Settings } from '../campaign/state';
import {
  MAX_AP, TITLES, canAttack, castleDanger, defensePower, devCost, devError, develop, endTurn, forts, genInfo, holdCastle, holdOdds, income, lordLv, ownedCount,
  readyGenerals, recruit, regionLeaders, release, takeInvasion, type DevKind,
} from '../campaign/campaign';
import type { BattleKind } from '../battle/types';
import { KINDS } from '../battle/kinds';
import { bustUrl, tokenUrl } from './common';
import { YashimaMap } from './YashimaMap';
import { Formation } from './Formation';
import { GeneralsPanel } from './Generals';
import { TownPanel } from './Town';
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
  onTitle: () => void;
}

/** 城の強さと朔の Lv の比べ（目安） */
function threat(c: Campaign, rid: string): { label: string; cls: string } {
  const d = castleDanger(c, rid) + Math.floor(c.regions[rid].taken / 2);
  const others = readyGenerals(c).filter((g) => g.id !== 'g_saku').sort((a, b) => b.lv - a.lv).slice(0, 5);
  const power = lordLv(c) + others.reduce((s, g) => s + g.lv, 0) / 8;
  const k = power - d;
  if (k >= 4) return { label: '楽', cls: 'easy' };
  if (k >= 0) return { label: '互角', cls: 'even' };
  if (k >= -4) return { label: '手強い', cls: 'hard' };
  return { label: '危険', cls: 'deadly' };
}

export function Honjin({ c, settings, onSettings, onChange, onScene, onDepart, onTitle }: HonjinProps) {
  const [sel, setSel] = useState<string | null>('01');
  const [modal, setModal] = useState<null | 'gens' | 'town' | 'news' | 'menu' | 'help' | 'settings' | 'titles' | 'dev' | 'end'>(null);
  const [form, setForm] = useState<{ mode: BattleKind; region: string; inv?: Invasion; seed: number } | null>(null);
  const newSeed = () => (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) | 0;
  const [toast, setToast] = useState('');
  const r = sel ? regionDef(sel) : null;
  const rs = sel ? c.regions[sel] : null;
  const ours = rs?.owner === 'akatsuki';
  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast(''), 2200); };

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

  return (
    <div className={`honjin text-${settings.text}`}>
      <header className="hj-head">
        <div className="hj-turn">{turnLabel(c.turn)}</div>
        <div className="hj-ap" aria-label={`行動 残り${c.ap}`}>{Array.from({ length: MAX_AP }, (_, i) => <span key={i} className={i < c.ap ? 'on' : ''}>◆</span>)}</div>
        <div className="hj-gold">{c.gold.toLocaleString()}<small>文</small></div>
        <div className="hj-land">{ownedCount(c)}<small>/15国</small></div>
        <button className="menu-btn" onClick={() => setModal('menu')} aria-label="メニュー">≡</button>
      </header>
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
              <div className="rp-owner">{FACTIONS[rs.owner].name}{r.capital ? '・本拠' : ''}</div>
            </div>
          </div>
          {ours ? (
            <>
              <p className="rp-stats">年貢 {Math.round(r.income * (1 + 0.3 * (rs.dev - 1)))}文・開発{rs.dev}・城{rs.wall}・兵{rs.troops}（守り{defensePower(c, r.id)}）</p>
              <div className="row-buttons">
                <button disabled={c.ap <= 0} onClick={() => { playSe('menu'); setForm({ mode: 'hunt', region: r.id, seed: newSeed() }); }}>妖魔討伐<small>経験と文</small></button>
                <button disabled={c.ap <= 0} onClick={() => { playSe('menu'); setModal('dev'); }}>内政<small>開発・城・兵</small></button>
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
                      <span><b>{info.short}</b><small>{id === rs.boss ? '城主' : '中の階'}・Lv{c.gens[id].lv}</small></span>
                    </div>
                  );
                })}
              </div>
              <p className="rp-stats">砦 {rs.taken}/{forts(r.id)} を落とした・強さ{castleDanger(c, r.id)}　<span className={`threat ${threat(c, r.id).cls}`}>{threat(c, r.id).label}</span></p>
              <p className="rp-desc">兵種：{FACTIONS[rs.owner].troops.map(([k]) => KINDS[k].name).join('・')}{rs.taken + 1 >= forts(r.id) ? '　次は本城（城主が出る）' : ''}</p>
              <p className="rp-desc">{r.desc}</p>
              <div className="row-buttons">
                <button className="primary" disabled={!canAttack(c, r.id) || c.ap <= 0} onClick={() => { playSe('menu'); setForm({ mode: 'siege', region: r.id, seed: newSeed() }); }}>
                  攻める（行動1）{!canAttack(c, r.id) ? <small>自分の国の隣ではない</small> : c.ap <= 0 ? <small>行動が残っていない</small> : null}
                </button>
              </div>
            </>
          )}
        </section>
      )}
      <nav className="hj-commands">
        <button onClick={() => { playSe('menu'); setModal('gens'); }}>武将<small>{readyGenerals(c).length}人</small></button>
        <button onClick={() => { playSe('menu'); setModal('town'); }}>城下<small>補充・浪人</small></button>
        <button onClick={() => { playSe('menu'); setModal('news'); }}>記録</button>
        <button className={`end-turn ${c.ap === 0 ? 'pulse' : ''}`} onClick={() => { playSe('menu'); setModal('end'); }}>季節を<br />進める</button>
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
      {modal === 'gens' && <GeneralsPanel c={c} onChange={onChange} onScene={onScene} onClose={() => setModal(null)} />}
      {modal === 'town' && <TownPanel c={c} onChange={onChange} onClose={() => setModal(null)} />}
      {modal === 'dev' && rs && r && (
        <Modal title={`内政：${r.name}`} onClose={() => setModal(null)}>
          <p className="note">文 {c.gold.toLocaleString()}・行動 残り{c.ap}</p>
          <div className="menu-list">
            {([['dev', `田畑を開く（開発${rs.dev}→${rs.dev + 1}）`, '年貢が増える'], ['wall', `城を固める（城${rs.wall}→${rs.wall + 1}）`, '籠城の守りが上がる'], ['troops', `兵を集める（兵${rs.troops}→${Math.min(1500, rs.troops + 300)}）`, '籠城の守りが上がる']] as [DevKind, string, string][]).map(([k, t, d]) => {
              const err = devError(c, r.id, k);
              return (
                <button key={k} disabled={!!err} onClick={() => { playSe('coin'); flash(develop(c, r.id, k)); onChange(); setModal(null); }}>
                  {t}（{devCost(c, r.id, k)}文）<small>{err ?? d}</small>
                </button>
              );
            })}
          </div>
        </Modal>
      )}
      {modal === 'news' && (
        <Modal title="記録" onClose={() => setModal(null)} className="log-modal">
          <p className="note">年貢 毎季 {income(c).toLocaleString()}文・戦 {c.stats.battles}（勝ち{c.stats.wins}）・捕らえた将 {c.stats.captured}・討った敵兵 {c.stats.kills.toLocaleString()}・朔 Lv{lordLv(c)}</p>
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
          {c.ap > 0 && <p>まだ行動が{c.ap}回残っています。</p>}
          <p className="note">年貢が入り、敵の勢力が動きます。{c.turn + 1 >= 8 && !c.flags.youma ? '不穏な気配がする……' : ''}</p>
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
            <span><b>{genInfo(c, inv.commander).name}</b><small>大将・Lv{c.gens[inv.commander].lv}</small></span>
          </div>
          <p className="rp-stats">敵の攻め {inv.power}　対　守り {defensePower(c, inv.to)}（籠城で守れる見込み {Math.round(holdOdds(c, inv) * 100)}%）</p>
          {inv.to === '01' && <p className="bad">暁原を失うと、暁ノ家は滅びます。</p>}
          <div className="row-buttons col">
            <button className="primary" onClick={() => { playSe('menu'); setForm({ mode: 'defense', region: inv.to, inv, seed: newSeed() }); }}>自ら迎え撃つ<small>合戦に勝てば守れる（行動は使わない）</small></button>
            <button onClick={() => { playSe('menu'); const res = holdCastle(c, inv); onChange(); flash(res.text); }}>籠城して守将に任せる<small>見込み {Math.round(holdOdds(c, inv) * 100)}%</small></button>
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
