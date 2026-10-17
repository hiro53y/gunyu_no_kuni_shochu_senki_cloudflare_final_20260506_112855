import type {Campaign} from './state';
import {regionDef} from '../content/sengoku';
import {canAct,commandAllowed,relation,RELATION_NAME} from './strategy';
import {commandGenerals,commandKey,isBorder,sortieError} from './campaign';
export function reserve(c:Campaign,used:string[]=[]){const gens=Object.values(c.gens).filter(g=>canAct(c,g.id)&&g.troops>0&&!used.includes(g.id));return {count:gens.length,troops:gens.reduce((n,g)=>n+g.troops,0)};}
export function relationLabel(c:Campaign,rid:string){const f=c.regions[rid].owner;if(f==='akatsuki')return '自領';const r=relation(c,f);return r==='peace'&&(c.progress[commandKey('war',rid,c)]??0)>0?'開戦準備中':RELATION_NAME[r];}
export function regionAction(c:Campaign,rid:string){
 const owner=c.regions[rid].owner,r=relation(c,owner);
 const blocked=!commandAllowed(c)?'敵襲・出陣を先に解決してください':c.fans<1?'行動がありません。季節を進めると回復します':commandGenerals(c).length===0?'未行動の武将がいません。次の季節を待ちましょう':'';
 if(owner==='akatsuki')return {mode:'home',label:'内政と人材を整える',reason:blocked};
 if(r==='alliance'||r==='vassal')return {mode:'friend',label:'盟友と交渉する',reason:''};
 if(!isBorder(c,rid))return {mode:'remote',label:'外交へ',reason:'隣接する国を自領にすると進軍できます'};
 let reason=!commandAllowed(c)?'敵襲・出陣を先に解決してください':c.fans<1?'行動がありません。季節を進めると回復します':commandGenerals(c).length===0?'未行動の武将がいません。次の季節を待ちましょう':'';
 if(r==='war')reason=reason||sortieError(c,'siege',rid)||'';
 return {mode:r==='war'?'attack':'war',label:r==='war'?'陣立てへ':(c.progress[commandKey('war',rid,c)]??0)>0?'開戦準備の続きへ':'開戦準備を始める',reason};
}
export function nextObjective(c:Campaign){
 if(c.invasions.length)return '敵襲を迎撃し、領国を守りましょう';
 if(c.captives.length)return '捕らえた将の登用・解放を決めましょう';
 const route=c.strategy?.route;
 if(route==='seal')return `霊地の封印 ${c.strategy?.seals.length??0}/3。軍議で次の霊地を確認`;
 if(route==='pact')return '盟友の本拠を守り、黒淵の討伐へ';
 if(route==='hado')return '人間勢力を征服・従属させ、黒淵を討つ';
 return '人間勢力の本拠を攻略すると、進む道を選べます';
}
export const WAR_STEPS=['相手を選ぶ','開戦準備','宣戦布告','陣立て','出陣'];
export function countryName(id:string){return regionDef(id).name;}
