import { useEffect,useRef,useState } from 'react';
import type { Campaign } from '../campaign/state';
import { FACTIONS, FACTION_IDS, REGIONS, type FactionId } from '../content/sengoku';
import { genInfo } from '../campaign/campaign';
import { ROUTE_NAME, RELATION_NAME, activity, advanceStory, allies, canAct, claimReward, commandAllowed, decideOccupation, diplomacyError, dismiss, negotiate, performSeal, relation, restoreAlly, rewardCount, routeStatus, sealError, strategy, chooseRoute, type DiplomaticAction } from '../campaign/strategy';
import { Modal } from './common';

export function WarCouncil({c,onChange,section,onSection,initialFaction}:{c:Campaign;onChange:()=>void;section:string|null;onSection:(s:string|null)=>void;initialFaction:FactionId}) {
 const open=section!==null,tab=section??'story';const setTab=(s:string)=>onSection(s);
 const [f,setF]=useState<FactionId>(initialFaction);
 useEffect(()=>{setF(initialFaction);setSelected([]);setMessage('');},[initialFaction,section]);
 const [selected,setSelected]=useState<string[]>([]),[message,setMessage]=useState('');
 const [trainee,setTrainee]=useState('g_saku');
 const s=strategy(c),allowed=commandAllowed(c);
 const candidates=Object.values(c.gens).filter(g=>g.status==='ours');
 const team=selected.filter(id=>canAct(c,id));
 const lastDecision=useRef(0);
 const run=(fn:()=>unknown)=>{const now=Date.now();if(now-lastDecision.current<250)return;lastDecision.current=now;try{const r=fn();setMessage(typeof r==='string'?r:'軍議の決定を記録しました。');advanceStory(c);onChange();}catch(e){setMessage(e instanceof Error?e.message:String(e));}};
 const pending=Object.entries(s.choices).filter(([k,v])=>k.startsWith('occupation:')&&v==='pending');
 return <>
 <button className="council-open" onClick={()=>onSection('story')}>軍議 · {s.route?ROUTE_NAME[s.route]:'進む道を選ぶ'}<small>外交・褒賞{rewardCount(c)>0?` ${rewardCount(c)}件`:''}・物語</small></button>
 {open&&<Modal title="軍議 ── 八洲の行方" onClose={()=>onSection(null)} wide>
 <div className="tabs seg">{[['story','方針と物語'],['diplomacy','外交'],['army','人員と褒賞']].map(([id,n])=><button key={id} className={tab===id?'on':''} onClick={()=>setTab(id)}>{n}</button>)}</div>
 {!allowed&&<p className="note">敵襲または出陣を解決してから決定できます。</p>}
 {message&&<p role="status" className="council-message">{message}</p>}
 {tab==='story'&&<>
 <p>まず人間勢力の本拠を1つ攻略すると、進む道を選べます。条件を満たすまで決定を保留できます。</p>
 {routeStatus(c).map(x=><div className="council-card" key={x.id}><b>{ROUTE_NAME[x.id]} {s.route===x.id?'─ 選択中':''}</b><p>{x.reason} {x.ready?'✓':'未達成'}</p><p>{x.id==='hado'?'人間の全領土を征服・従属させ、黒淵を討つ。':x.id==='pact'?'本拠を保持する盟友を3勢力以上確保し、黒淵を討つ。':'鈴音山・焔ノ郷・黄泉沼を封印し、黒淵を討つ。'}</p>{!s.route&&<button disabled={!x.ready||!allowed} onClick={()=>run(()=>chooseRoute(c,x.id))}>この道に進む</button>}</div>)}
 {s.route==='seal'&&['12','10','13'].map(rid=><div className="council-card" key={rid}><b>{REGIONS.find(r=>r.id===rid)!.name}</b><p>{s.seals.includes(rid)?'封印済み':sealError(c,rid)??'祈り手1名と行動1回で封印できる'}</p><button disabled={!!sealError(c,rid)} onClick={()=>run(()=>performSeal(c,rid))}>封印の儀</button></div>)}
 {pending.map(([key])=>{const rid=key.split(':')[1];return <div className="council-card" key={key}><b>{REGIONS.find(r=>r.id===rid)!.name}の戦後処置</b><p>国力と友好を育てるか、今必要な軍資金を得るか。</p><div className="row-buttons"><button disabled={!allowed} onClick={()=>run(()=>decideOccupation(c,rid,'mercy'))}>民を安堵する<small>国力+1・旧主との友好+30</small></button><button disabled={!allowed} onClick={()=>run(()=>decideOccupation(c,rid,'levy'))}>軍資金を徴収<small>500文・旧主との友好−30</small></button></div></div>})}
 <p className="note">黒淵 {s.demonDefeated?'討伐済み':'健在'} · 盟友 {allies(c).length}勢力 · 封印 {s.seals.length}/3</p>
 {s.ending&&<div className="council-card"><h3>{ROUTE_NAME[s.ending]}の結末に到達</h3><p>周回ポイント3を獲得。タイトルの「はじめから」で周回特典を選べます。</p></div>}
 </>}
 {tab==='diplomacy'&&<>
 <label>交渉先 <select value={f} onChange={e=>setF(e.target.value as FactionId)}>{FACTION_IDS.filter(x=>!['akatsuki','youma'].includes(x)).map(id=><option key={id} value={id}>{FACTIONS[id].name}・{c.factions[id].alive?RELATION_NAME[relation(c,id)]:'滅亡'}</option>)}</select></label>
 <button disabled={!allowed||c.fans<1||!REGIONS.some(r=>r.capital&&r.owner===f&&c.regions[r.id].owner==='akatsuki')} onClick={()=>run(()=>restoreAlly(c,f))}>旧本拠を返還して復興支援（行動1）</button>
 <p>友好 {s.favor[f]??0} · 交渉は知略の合計。未達分は次季へ持ち越します。</p>
 <div className="council-team">{candidates.map(g=><label key={g.id}><input type="checkbox" checked={team.includes(g.id)} disabled={!canAct(c,g.id)||!allowed} onChange={e=>setSelected(e.target.checked?[...team,g.id].slice(0,5):team.filter(id=>id!==g.id))}/>{genInfo(c,g.id).short} · {activity(c,g.id)}</label>)}</div>
 {([['gift','贈答（300文）'],['peace','停戦（知略100）'],['alliance','同盟（知略160）'],['vassal','従属を勧告（知略230）']] as [DiplomaticAction,string][]).map(([a,label])=>{const err=diplomacyError(c,f,a,team);return <div className="council-card" key={a}><button disabled={!!err} onClick={()=>run(()=>negotiate(c,f,a,team))}>{label}</button><small>{err??'行動1回・選んだ武将を使用'}</small></div>})}
 </>}
 {tab==='army'&&<>
 <p>未行動の武将 {candidates.filter(g=>canAct(c,g.id)).length} / 家臣 {candidates.length}（上限30）。攻撃に使った武将は、この季節の敵襲では守れません。</p>
 <h3>武名の褒賞：残り{rewardCount(c)}回</h3><p>武名20ごとに一つ選べます。</p>
 <div className="row-buttons wrap"><button disabled={!allowed||!rewardCount(c)||s.bonusFans>=3} onClick={()=>run(()=>claimReward(c,'fans'))}>行動+1<small>毎季最大5回</small></button><button disabled={!allowed||!rewardCount(c)} onClick={()=>run(()=>claimReward(c,'gold'))}>軍資金1500文</button></div>
 <label>育成する武将 <select value={trainee} onChange={e=>setTrainee(e.target.value)}>{candidates.map(g=><option key={g.id} value={g.id}>{genInfo(c,g.id).name}</option>)}</select></label><button disabled={!allowed||!rewardCount(c)} onClick={()=>run(()=>claimReward(c,'training',trainee))}>褒賞でレベル+2</button>
 <h3>家臣の運用</h3>{candidates.map(g=><div className="council-card council-person" key={g.id}><span>{genInfo(c,g.id).name} · {activity(c,g.id)} · 兵{g.troops}</span>{g.id!=='g_saku'&&<button disabled={!allowed} onClick={()=>run(()=>dismiss(c,g.id))}>解雇して浪人へ</button>}</div>)}
 </>}
 </Modal>}
 </>;
}
