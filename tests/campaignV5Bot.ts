// No resources or wins are injected: use the public campaign and battle commands.
import {newCampaign,readyGenerals,commandGenerals,doCommand,commandError,canAttack,isBorder,beginBattle,finishBattle,endTurn,refillAll,roninList,hire,recruit,release,doBond,bondError,genInfo,expandCapacity,expansionCost,maxTroops,autoDefend,takeInvasion,ownedCount} from '../src/campaign/campaign';
import {autoPlace,genPower} from '../src/campaign/army';
import {createBattle,act} from '../src/battle/engine';
import {chooseAction} from '../src/battle/ai';
import {advanceStory,allies,canAct,chooseRoute,claimReward,negotiate,diplomacyError,performSeal,relation,restoreAlly,rewardCount,routeStatus,sealError,strategy,type Route} from '../src/campaign/strategy';
import {REGIONS,type FactionId} from '../src/content/sengoku';
import {deserializeCampaign} from '../src/engine/save';
import type {BattleKind} from '../src/battle/types';
import type {Campaign,Invasion} from '../src/campaign/state';
export function playV5(seed:number,route:Route,maxTurns=300){
 let c=newCampaign(seed),battleNo=0,retries=0;let checkpoint=JSON.stringify(c);const retry=()=>{if(retries>=60)return false;c=deserializeCampaign(checkpoint)!;retries++;return true;};const errors:string[]=[],battles:{turn:number;kind:string;region:string;win:boolean}[]=[];
 const core=['g_genba','g_saku','g_suzuran','g_chikage'];
 const accept=()=>{for(const id of [...c.captives]){if(Object.values(c.gens).filter(g=>g.status==='ours').length<18)recruit(c,id);else release(c,id);}};
 const best=(n=5)=>commandGenerals(c).sort((a,b)=>genInfo(c,b.id).int-genInfo(c,a.id).int).slice(0,n).map(g=>g.id);
 const army=()=>{
 const list=readyGenerals(c).sort((a,b)=>{
  const score=(g:typeof a)=>g.troops*(1+(genPower(c,g.id).atk+genPower(c,g.id).def)/12)*(g.kind==='miko'?1.15:1);
  return score(b)-score(a);
 });
 const safe=list.filter(g=>g.id!=='g_saku');
 const chosen=(safe.length>=6?safe:list).slice(0,6);if(!chosen.some(g=>g.kind==='miko')){const healer=list.find(g=>g.kind==='miko');if(healer&&chosen.length===6)chosen[5]=healer;}
 return autoPlace(chosen.map(g=>({id:g.id,kind:g.kind})));
 };
 const fight=(mode:BattleKind,rid:string,inv?:Invasion)=>{
 const battleSeed=seed*10000+battleNo;
 const ready=readyGenerals(c).sort((a,b)=>b.troops*(1+genPower(c,b.id).atk/12)-a.troops*(1+genPower(c,a.id).atk/12));
 let p=army(),bestScore=Infinity;
 // Deterministic formation search uses cloned public state, never injects a win or resources.
 for(const size of [3,4,5,6])for(let variant=0;variant<3;variant++){
  const list=[...ready];
  if(variant===1)list.sort((a,b)=>(Number(b.kind==='ashigaru')+Number(b.kind==='miko'))-(Number(a.kind==='ashigaru')+Number(a.kind==='miko')));
  if(variant===2){const first=list.shift();if(first)list.push(first);}
  const picked=list.slice(0,size);if(picked.length<size)continue;
  const placement=autoPlace(picked.map(g=>({id:g.id,kind:g.kind})));
  const copy=deserializeCampaign(JSON.stringify(c))!;
  const trial=createBattle(beginBattle(copy,mode,rid,placement,battleSeed,inv));
  for(let i=0;i<300&&!trial.end;i++)act(trial,chooseAction(trial));
  if(trial.end?.winner!=='L'||trial.units.some(u=>u.lord&&u.out))continue;
  const lost=trial.units.filter(u=>u.side==='L').reduce((n,u)=>n+u.startTroops-u.troops,0);
  const score=size*10000+lost;
  if(score<bestScore){bestScore=score;p=placement;}
 }
 if(!Number.isFinite(bestScore)&&mode!=='defense')return false;
 if(!p.length)return false;
 if(inv)takeInvasion(c,inv);
 const b=createBattle(beginBattle(c,mode,rid,p,seed*10000+battleNo++,inv));
 for(let i=0;i<300&&!b.end;i++)act(b,chooseAction(b));
 if(!b.end){errors.push('battle did not end');return false;}
 const rep=finishBattle(c,b);battles.push({turn:c.turn,kind:mode,region:rid,win:rep.kind==='win'});accept();return true;
 };
 try{
 while(c.turn<=maxTurns&&!c.defeat&&!strategy(c).ending){
  c.scenes=[];accept();refillAll(c);
  for(const inv of [...c.invasions]){
   if(!c.invasions.includes(inv))continue;
   if(readyGenerals(c).length>=3)fight('defense',inv.to,inv);else autoDefend(c,inv,seed+battleNo++);
   accept();refillAll(c);if(c.defeat)break;
  }
  if(c.defeat){if(retry())continue;break;}
  checkpoint=JSON.stringify(c);
  // Hire a broad enough roster to leave a second army for the enemy phase.
  const count=Object.values(c.gens).filter(g=>g.status==='ours').length;
  if(count<14){const r=roninList(c).sort((a,b)=>(a.wage??0)-(b.wage??0))[0];if(r&&(r.wage??0)<c.gold-300)hire(c,r.id);}
  while(rewardCount(c)>0)claimReward(c,strategy(c).bonusFans<2?'fans':'gold');
  // Buy permanent troop capacity only from earned money.
  for(const id of [...core,...Object.values(c.gens).filter(g=>g.status==='ours'&&!core.includes(g.id)).sort((a,b)=>(a.capacityBonus??0)-(b.capacityBonus??0)).slice(0,8).map(g=>g.id)]){const g=c.gens[id];if(g.status==='ours'&&maxTroops(c,id)<2200&&c.gold>expansionCost(c,id)+600)expandCapacity(c,id);}
  refillAll(c);
  let actionGuard=0;
  while(c.fans>0&&!c.defeat&&!strategy(c).ending&&actionGuard++<8){
   advanceStory(c);
   if(battles.some(b=>b.turn===c.turn&&b.kind!=='defense'))break;
   if(!strategy(c).route&&routeStatus(c).find(x=>x.id===route)?.ready)chooseRoute(c,route);
   if(route==='seal'&&c.gens.g_suzuran.status==='ours'&&c.gens.g_suzuran.bond<2&&!bondError(c,'g_suzuran')){doBond(c,'g_suzuran');continue;}
   if(route==='seal'&&strategy(c).route){const rid=['12','10','13'].find(r=>!sealError(c,r));if(rid){performSeal(c,rid);continue;}}
   if(route==='pact'&&allies(c).length<3){const f=REGIONS.find(r=>r.capital&&r.owner!=='akatsuki'&&r.owner!=='youma'&&c.regions[r.id].owner==='akatsuki'&&!c.factions[r.owner].alive)?.owner;if(f){restoreAlly(c,f);continue;}}
   const hostile=Object.keys(c.factions).filter(f=>c.factions[f as FactionId].alive&&relation(c,f as FactionId)==='war').length;
   const reserveNeed=hostile>=2?8:4;
   const ours=Object.values(c.gens).filter(g=>g.status==='ours').length;
   if(ours<12&&best(3).length>=2&&!commandError(c,'search','01',best(3))){doCommand(c,'search','01',best(3));continue;}
   // Keep three friendly capitals for the pact; the seal needs the volcanic shrine.
   const wanted: FactionId[]=route==='pact'?['honoo','shirasagi','ronin']:route==='seal'?['honoo']:[];
   const ally=wanted.find(f=>c.factions[f].alive&&relation(c,f)!=='alliance'&&relation(c,f)!=='vassal');
   if(ally&&best(3).length>=2){const a=relation(c,ally)==='war'?'peace':'alliance';if(!diplomacyError(c,ally,a,best(3))){negotiate(c,ally,a,best(3));continue;}}
   if(route==='hado'&&ownedCount(c)>=3){const f=(['ronin','honoo','shirasagi','kurogane','shion','rengein'] as FactionId[]).find(f=>c.factions[f].alive&&relation(c,f)!=='vassal'&&!diplomacyError(c,f,'vassal',best(3)));if(f){negotiate(c,f,'vassal',best(3));continue;}}
   // Finish the closest human capital first, then the selected route objective.
   const borders=REGIONS.filter(r=>isBorder(c,r.id)&&!allies(c).includes(c.regions[r.id].owner));
   const activeWar=borders.find(r=>c.regions[r.id].owner!=='youma'&&relation(c,c.regions[r.id].owner)==='war');
   const restricted=activeWar?borders.filter(r=>c.regions[r.id].owner===c.regions[activeWar.id].owner):borders;
   const eligible=restricted.filter(r=>route==='hado'?true:!strategy(c).capitalTaken?r.owner!=='youma':c.regions[r.id].owner==='youma'||route==='seal'&&r.id==='10');
   const target=eligible.sort((a,b)=>{
    const priority=(r:typeof a)=>r.danger-(c.regions[r.id].taken?8:0)+(r.id==='12'?-4:0);
    return priority(a)-priority(b);
   })[0];
   if(target&&!canAttack(c,target.id)&&best(3).length>=2&&!commandError(c,'war',target.id,best(3))){doCommand(c,'war',target.id,best(3));continue;}
   if(target&&canAttack(c,target.id)&&readyGenerals(c).length>=reserveNeed+3){
    // Build up before a strong castle. This is a strategy decision, not an injected bonus.
    const power=army().reduce((n,p)=>n+c.gens[p.gen].troops,0);
    const threshold=1800;
    if(power>=threshold){if(fight('siege',target.id))continue;}
   }
   if(battles.some(b=>b.turn===c.turn&&b.kind!=='defense'))break;
   // Train with an easy hunt while preserving the other half of the roster.
   if(readyGenerals(c).length>=reserveNeed+3){fight('hunt','01');continue;}
   break;
  }
  if(c.defeat){if(retry())continue;break;}
  if(strategy(c).ending)break;
  c.scenes=[];accept();endTurn(c);
  const restored=deserializeCampaign(JSON.stringify(c));if(!restored)throw Error('save roundtrip failed');c=restored;
  if(c.gold<0||c.fans<0||c.fans>5)throw Error('resource invariant');
 }
 }catch(e){errors.push(String(e));}
 return {c,errors,battles,retries,ending:strategy(c).ending};
}
