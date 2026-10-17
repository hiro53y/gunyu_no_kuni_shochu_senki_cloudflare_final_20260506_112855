import {useState} from 'react';
import type {Campaign,CommandId} from '../campaign/state';
import {FACTIONS,REGIONS,regionDef} from '../content/sengoku';
import {isBorder,commandKey,commandNeed,castleDanger,regionLeaders,genInfo} from '../campaign/campaign';
import {regionAction,relationLabel} from '../campaign/actionGuide';
import {relation} from '../campaign/strategy';
import {tokenUrl} from './common';
export function SelectedCountry({c,rid,onCommand,onAttack,onHunt,onDiplomacy,onSelect,notice}:{c:Campaign;rid:string;onCommand:(id:CommandId)=>void;onAttack:()=>void;onHunt:()=>void;onDiplomacy:()=>void;onSelect:(rid:string)=>void;notice:string}){
 const [more,setMore]=useState(false),r=regionDef(rid),state=c.regions[rid],a=regionAction(c,rid),ours=state.owner==='akatsuki',rel=relation(c,state.owner);
 const border=REGIONS.find(x=>c.regions[x.id].owner===state.owner&&isBorder(c,x.id));
 const progress=c.progress[commandKey('war',rid,c)]??0;
 return <section className="country-sheet" aria-label="選択国の操作">
 <header><span className="rp-mon" style={{background:FACTIONS[state.owner].color}}>{FACTIONS[state.owner].mon}</span><div><h2>{r.name}<small>{r.reading}</small></h2><span>{FACTIONS[state.owner].name} · <b className={`relation rel-${rel}`}>{relationLabel(c,rid)}</b></span></div><button className="small" aria-expanded={more} onClick={()=>setMore(!more)}>{more?'閉じる':'詳しく'}</button></header>
 {notice&&<p className="decision-result" role="status">{notice}</p>}
 {!ours&&<div className="country-stage">攻略 {state.taken}/{state.lands.length} <progress max={state.lands.length} value={state.taken}/><small>次は{({field:'野戦',town:'町',castle:'城'} as const)[state.lands[state.taken]]??'城'} · 強さ{castleDanger(c,rid)}</small></div>}
 {a.mode==='war'&&<p className="country-progress">知略 {progress}/{commandNeed(c,'war',rid)} · 達成後にこの勢力全体と開戦</p>}
 <div className="country-actions">
 {ours?<><button className="primary" disabled={!!a.reason||c.fans<1} onClick={()=>onCommand('build')}>内政・建設<small>行動1 · 収入を育てる</small></button><button disabled={!!a.reason||c.fans<1} onClick={()=>onCommand('search')}>人材探索<small>行動1 · 家臣を増やす</small></button><button disabled={!!a.reason||c.fans<1} onClick={onHunt}>妖魔討伐<small>行動1 · 経験と資金</small></button></>:
 <><button className="primary" disabled={!!a.reason&&a.mode!=='remote'} onClick={a.mode==='attack'?onAttack:a.mode==='war'?()=>onCommand('war'):onDiplomacy}>{a.label}<small>{a.mode==='attack'?'行動1 · 未行動の部隊を編成':a.mode==='war'?'行動1 · 武将を選んで確認':'関係と交渉を確認'}</small></button>{a.mode!=='friend'&&a.mode!=='remote'&&<button onClick={onDiplomacy}>外交へ<small>停戦・同盟・従属</small></button>}</>}
 </div>{a.reason&&<p className="action-reason">{a.reason}</p>}{a.mode==='remote'&&border&&<button className="border-route" onClick={()=>onSelect(border.id)}>隣接する{border.name}を選ぶ ›<small>ここから{FACTIONS[state.owner].name}への開戦・進軍を準備できます</small></button>}
 {more&&<div className="country-more"><p>国力 {state.np} · 基礎収入 {r.income}文/季 · {r.capital?'本拠':'地方国'}</p><div className="country-leaders">{regionLeaders(c,rid).map(id=><span key={id}><img src={tokenUrl(genInfo(c,id).portrait)} width={28} height={28} alt=""/>{genInfo(c,id).short}</span>)}</div>{!ours&&a.mode!=='friend'&&<div className="row-buttons"><button disabled={!!a.reason} onClick={()=>onCommand('prepare')}>戦の準備<small>行動1 · 味方を強化</small></button><button disabled={!!a.reason} onClick={()=>onCommand('sabotage')}>工作<small>行動1 · 敵兵を減らす</small></button></div>}</div>}
 </section>;
}
