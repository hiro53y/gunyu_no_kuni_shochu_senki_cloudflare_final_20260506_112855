import {SelectedCountry} from './SelectedCountry';
import {nextObjective,reserve} from '../campaign/actionGuide';
import {rewardCount} from '../campaign/strategy';
import type {FactionId} from '../content/sengoku';
// 本陣：八洲の地図・国の情報（領地・国力）・出陣／国の命令／妖魔討伐・交流・城下・武将・季節を進める・攻めてきた敵・捕らえた将
import { WarCouncil } from './WarCouncil';
import { canAct, recordEnding } from '../campaign/strategy';
import { useState } from 'react';
import { FACTIONS,  regionDef, turnLabel } from '../content/sengoku';
import type { Campaign, CommandId, Invasion, Placement, Scene, Settings } from '../campaign/state';
import {
  TITLES, autoDefend,  endTurn, genInfo, grossIncome, income,  lordLv, maxFans, nextFameStep, ownedCount,
  recruit,  release, takeInvasion, totalNp, totalUpkeep, type Report,
} from '../campaign/campaign';
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

export function Honjin({ c, settings, onSettings, onChange, onScene, onDepart, onReport, onTitle }: HonjinProps) {
  const [council,setCouncil]=useState<string|null>(null);
  const [diplomaticTarget,setDiplomaticTarget]=useState<FactionId>('rengein');
  const [decision,setDecision]=useState('');
  const [sel, setSel] = useState<string | null>('01');
  const [modal, setModal] = useState<null | 'gens' | 'town' | 'news' | 'menu' | 'help' | 'settings' | 'titles' | 'end'>(null);
  const [form, setForm] = useState<{ mode: BattleKind; region: string; inv?: Invasion; seed: number } | null>(null);
  const [cmd, setCmd] = useState<{ id: CommandId; target: string } | null>(null);
  const [toast, setToast] = useState('');
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

  const remaining=reserve(c);
  const urgent=!!inv||!!captive;
  const openCouncil=(tab:string,f?:FactionId)=>{setModal(null);setCmd(null);setForm(null);if(f)setDiplomaticTarget(f);setCouncil(tab);};
  const openCommand=(id:CommandId,target:string)=>{setCouncil(null);setModal(null);setDecision('');setCmd({id,target});};
  const openForm=(mode:BattleKind,region:string)=>{setCouncil(null);setModal(null);setDecision('');setForm({mode,region,seed:newSeed()});};
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
      <div className="strategy-resources"><span>行動 <b>{c.fans}/{maxFans(c)}</b></span><span>未行動 <b>{remaining.count}人</b></span><span>防衛兵力 <b>{remaining.troops.toLocaleString()}</b></span></div>
      <button className="strategy-objective" onClick={()=>openCouncil('story')}><small>今の目標</small>{nextObjective(c)}<span>軍議 ›</span></button>
      <div className="strategy-alerts">{inv&&<span className="bad">敵襲 {c.invasions.length}件 · {regionDef(inv.to).name}を守れ</span>}{captive&&<span>捕らえた将 {c.captives.length}人</span>}{rewardCount(c)>0&&<button onClick={()=>openCouncil('army')}>受け取れる褒賞 {rewardCount(c)}件 ›</button>}</div>
      {!settings.guideSeen&&<aside className="conquest-guide"><b>国取りの流れ</b><p>国を選ぶ → 知略で開戦準備 → 宣戦布告 → 陣立て・出陣。武将は1季節1回。防衛に残す仲間も考えよう。</p><button onClick={()=>onSettings({...settings,guideSeen:true})}>わかった・案内を閉じる</button></aside>}
      <div className="next-choices"><small>次にできること</small>{c.fans<1||remaining.count===0?<button onClick={()=>{setCouncil(null);setModal('end');}}>季節を進めて活動を回復 ›</button>:<><button onClick={()=>{setSel(Object.values(c.regions).find(r=>r.owner==='akatsuki')?.id??'01');setDecision('人材探索で家臣を増やすと、攻撃と防衛の分担がしやすくなります。');}}>自領で戦力を整える ›</button><button onClick={()=>{const r=Object.values(c.regions).find(r=>r.owner!=='akatsuki'&&regionDef(r.id).adj.some(id=>c.regions[id].owner==='akatsuki'));if(r){setSel(r.id);setDecision('関係と開戦準備を確認し、使う武将を選びましょう。');}}}>隣国の状況を見る ›</button></>}</div>
      <main className="conquest-layout">
      <YashimaMap c={c} selected={sel} onSelect={id=>{playSe('menu');setSel(id);setDecision('');}}/>
      {sel&&<SelectedCountry key={sel} c={c} rid={sel} notice={decision} onSelect={rid=>{setSel(rid);setDecision('');}} onCommand={id=>openCommand(id,sel)} onAttack={()=>openForm('siege',sel)} onHunt={()=>openForm('hunt',sel)} onDiplomacy={()=>openCouncil('diplomacy',c.regions[sel].owner)}/>}
      </main>
      {!urgent&&<WarCouncil c={c} section={council} onSection={setCouncil} initialFaction={diplomaticTarget} onChange={()=>{recordEnding(c);onChange();}}/>}
      <nav className="hj-commands">
        <button onClick={()=>{setCouncil(null);setModal(null);setCmd(null);}}>地図<small>国を選ぶ</small></button>
        <button onClick={()=>{setCouncil(null);setModal('gens');}}>軍団<small>武将と活動</small></button>
        <button onClick={()=>{setCouncil(null);setModal('town');}}>城下<small>補充・浪人</small></button>
        <button onClick={()=>openCouncil('story')}>軍議<small>外交・褒賞</small></button>
        <button className="end-turn" onClick={()=>{setCouncil(null);setModal('end');}}>季節を<small>進める</small></button>
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
      {!urgent&&cmd && (
        <CommandPanel
          c={c}
          cmd={cmd.id}
          target={cmd.target}
          onClose={() => setCmd(null)}
          onDone={(text, scene) => { setCmd(null);setDecision(text); onChange(); flash(text); if (scene) onScene(scene); }}
        />
      )}
      {!urgent&&modal === 'gens' && <GeneralsPanel c={c} onChange={onChange} onScene={onScene} onPersuade={(id) => { setModal(null); setCmd({ id: 'persuade', target: id }); }} onClose={() => setModal(null)} />}
      {!urgent&&modal === 'town' && <TownPanel c={c} onChange={onChange} onClose={() => setModal(null)} />}
      {!urgent&&modal === 'news' && (
        <Modal title="記録" onClose={() => setModal(null)} className="log-modal">
          <p className="note">
            収入 毎季 {income(c).toLocaleString()}文{upkeepOver ? `（維持費${totalUpkeep(c)}が国力${totalNp(c)}を超え、本来の${grossIncome(c)}文の半分）` : `（国力${totalNp(c)}・維持費${totalUpkeep(c)}）`}・
            武名 {c.fame}{fame ? `（${fame}で褒賞）` : ''}・戦 {c.stats.battles}（勝ち{c.stats.wins}）・捕らえた将 {c.stats.captured}・討った敵兵 {c.stats.kills.toLocaleString()}・朔 Lv{lordLv(c)}
          </p>
          <button className="small" onClick={() => setModal('titles')}>称号を見る</button>
          <div className="log-list">{[...c.news].reverse().map((n, i) => <div key={i} className={`msg ${n.c ?? ''}`}><small>{turnLabel(n.turn)}</small> {n.t}</div>)}</div>
        </Modal>
      )}
      {!urgent&&modal === 'titles' && (
        <Modal title="称号" onClose={() => setModal('news')}>
          <div className="title-list">
            {TITLES.map((t) => <div key={t.id} className={`title-row ${c.titles[t.id] ? 'got' : ''}`}><b>{c.titles[t.id] ? t.name : '？？？'}</b><small>{t.desc}</small></div>)}
          </div>
        </Modal>
      )}
      {!urgent&&modal === 'menu' && (
        <Modal title="本陣" onClose={() => setModal(null)}>
          <div className="menu-list">
            <button onClick={() => setModal('help')}>遊び方</button>
            <button onClick={() => setModal('settings')}>設定</button>
            <button onClick={() => setModal('news')}>戦いと国取りの記録</button>
            <button onClick={() => {onSettings({...settings,guideSeen:false});setModal(null);}}>国取りの案内をもう一度見る</button>
            <button onClick={() => { setModal(null); onTitle(); }}>タイトルへ（自動で保存されています）</button>
          </div>
        </Modal>
      )}
      {!urgent&&modal === 'help' && <Modal title="遊び方" onClose={() => setModal('menu')} wide><HelpBody /></Modal>}
      {!urgent&&modal === 'settings' && <Modal title="設定" onClose={() => setModal('menu')}><SettingsBody settings={settings} onChange={onSettings} /></Modal>}
      {!urgent&&modal === 'end' && (
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
