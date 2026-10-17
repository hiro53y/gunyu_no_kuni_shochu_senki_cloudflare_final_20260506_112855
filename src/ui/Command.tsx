import {useRef,useState} from 'react';
import {FACTIONS,regionDef} from '../content/sengoku';
import type {Campaign,CommandId,Scene} from '../campaign/state';
import {activity,canAct} from '../campaign/strategy';
import {reserve,WAR_STEPS} from '../campaign/actionGuide';
import {COMMANDS,commandError,commandGenerals,commandKey,commandNeed,doCommand,genInfo,statOf} from '../campaign/campaign';
import {Modal,tokenUrl} from './common';
export function CommandPanel({c,cmd,target,onDone,onClose}:{c:Campaign;cmd:CommandId;target:string;onDone:(text:string,scene?:Scene)=>void;onClose:()=>void}){
 const def=COMMANDS[cmd],available=commandGenerals(c).sort((a,b)=>statOf(c,b.id,def.stat)-statOf(c,a.id,def.stat));
 const [picked,setPicked]=useState<string[]>(()=>available.slice(0,1).map(g=>g.id));const lock=useRef(false);
 const need=commandNeed(c,cmd,target),carried=c.progress[commandKey(cmd,target,c)]??0;
 const gain=picked.reduce((n,id)=>n+statOf(c,id,def.stat),0),sum=carried+gain,err=commandError(c,cmd,target,picked),remaining=reserve(c,picked);
 const what=cmd==='persuade'?genInfo(c,target).name:cmd==='war'?FACTIONS[c.regions[target].owner].name:regionDef(target).name;
 const complete=()=>{let n=carried;const ids:string[]=[];for(const g of available.slice(0,5)){ids.push(g.id);n+=statOf(c,g.id,def.stat);if(n>=need)break;}setPicked(ids);};
 const [failure,setFailure]=useState('');
 const execute=()=>{if(lock.current||err)return;lock.current=true;try{const r=doCommand(c,cmd,target,picked);onDone(r.text,r.scene);}catch(e){setFailure(e instanceof Error?e.message:String(e));lock.current=false;}};
 return <Modal title={`${cmd==='war'?'開戦の軍議':def.name}：${what}`} onClose={onClose} className="command">
 {cmd==='war'&&<><ol className="war-steps">{WAR_STEPS.map((x,i)=><li key={x} className={i===1?'current':''}>{x}</li>)}</ol><p>知略を積み上げ、{what}全体との開戦を決めます。宣戦布告後は、この勢力からも侵攻されます。</p></>}
 <div className="command-preview"><b>{carried} → {Math.min(sum,need)} / {need}</b><progress max={need} value={Math.min(sum,need)}/><span>今回の{def.stat==='cmd'?'統率':def.stat==='pow'?'武力':'知略'} +{gain} · {sum>=need?'今回で達成':`残り${Math.max(0,need-sum)}。同じ人数・能力ならあと${gain?Math.ceil((need-sum)/gain):'—'}回が目安`}</span><small>国の状況や武将の成長で必要回数は変わります。</small></div>
 <div className="command-cost">行動 {def.fan?1:0}回 · 武将 {picked.length}人を使用<br/>残る防衛要員 <b>{remaining.count}人 / 兵{remaining.troops.toLocaleString()}</b>{remaining.count===0&&<strong>このままでは敵襲に出せる部隊が残りません</strong>}</div>
 <div className="row-buttons"><button onClick={()=>setPicked(available.slice(0,1).map(g=>g.id))}>少人数で進める</button><button onClick={complete}>今回の達成を優先</button></div>
 <div className="gen-pick">{Object.values(c.gens).filter(g=>g.status==='ours').sort((a,b)=>statOf(c,b.id,def.stat)-statOf(c,a.id,def.stat)).map(g=><button key={g.id} disabled={!canAct(c,g.id)} className={`gen-card ${picked.includes(g.id)?'on':''}`} aria-pressed={picked.includes(g.id)} onClick={()=>setPicked(p=>p.includes(g.id)?p.filter(x=>x!==g.id):p.length<5?[...p,g.id]:p)}><img src={tokenUrl(genInfo(c,g.id).portrait)} alt="" width={36} height={36}/><span className="gc-main"><b>{genInfo(c,g.id).name}</b><small>{activity(c,g.id)} · 能力 {statOf(c,g.id,def.stat)}</small></span></button>)}</div>
 {(err||failure)&&<p className="bad" role="status">{err||failure}</p>}
 <div className="row-buttons command-confirm"><button onClick={onClose}>戻る</button><button className="primary" disabled={!!err} onClick={execute}>{cmd==='war'?(sum>=need?'宣戦布告する':'開戦準備を進める'):'命令を実行'}<small>行動{def.fan?1:0}・武将{picked.length}人</small></button></div>
 </Modal>;
}
