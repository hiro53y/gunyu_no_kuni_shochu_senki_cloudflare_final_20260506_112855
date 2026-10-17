// v5: 季節全体の活動、外交、軍議、物語と周回。全てゲーム命令から更新する。
import { CHAPTERS } from '../content/chapters';
import type { Campaign, Scene } from './state';
import { FACTIONS, FACTION_IDS, REGIONS, type FactionId } from '../content/sengoku';
import { GEN_BY_ID, LORD } from '../content/generals';
import { expFor } from './army';

export type Route = 'hado' | 'pact' | 'seal';
export type Relation = 'peace' | 'war' | 'alliance' | 'vassal';
export const ROUTE_NAME: Record<Route, string> = { hado: '覇道', pact: '盟約', seal: '鎮霧' };
export const RELATION_NAME: Record<Relation,string> = {peace:'不戦',war:'交戦',alliance:'同盟',vassal:'従属'};
export interface Strategy {
  used: Record<string,number>; enemyTurn: number | null; enemyOrder: FactionId[];
  relations: Partial<Record<FactionId,Relation>>; favor: Partial<Record<FactionId,number>>;
  route: Route | null; capitalTaken: boolean; seals: string[]; events: Record<string,true>;
  choices: Record<string,string>; bonusFans: number; rewards: number; claimed: number;
  demonDefeated: boolean; ending: Route | null; endingTurn: number | null;
  pactPartners: FactionId[]; history: string[]; report: unknown;
}
export function initialStrategy(): Strategy {
 return {used:{},enemyTurn:null,enemyOrder:[],relations:{youma:'war'},favor:{},route:null,capitalTaken:false,seals:[],events:{},choices:{},bonusFans:0,rewards:0,claimed:0,demonDefeated:false,ending:null,endingTurn:null,pactPartners:[],history:[],report:null};
}
export function strategy(c:Campaign): Strategy { return c.strategy ??= initialStrategy(); }
export function currentRound(c:Campaign):number {return strategy(c).enemyTurn ?? c.turn;}
export function canAct(c:Campaign,id:string):boolean {
 const g=c.gens[id]; return !!g && g.status==='ours' && g.injured<=0 && strategy(c).used[id]!==currentRound(c);
}
export function markUsed(c:Campaign,ids:string[]) {for(const id of new Set(ids)) strategy(c).used[id]=currentRound(c);}
export function activity(c:Campaign,id:string):string {return c.gens[id]?.injured>0?'負傷':canAct(c,id)?'未行動':'行動済み';}
export function relation(c:Campaign,f:FactionId):Relation {
 const r=strategy(c).relations[f];
 return r==='alliance'||r==='vassal'?r:c.factions[f].war?'war':'peace';
}
export function allies(c:Campaign):FactionId[] {return FACTION_IDS.filter(f=>f!=='akatsuki'&&c.factions[f].alive&&['alliance','vassal'].includes(relation(c,f)));}
export function commandAllowed(c:Campaign):boolean {return !c.defeat&&!c.sortie&&!c.invasions.length&&strategy(c).enemyTurn===null;}
export function settleEnemy(c:Campaign) {if(!c.invasions.length) strategy(c).enemyTurn=null;}
export function rosterSize(c:Campaign) {return Object.values(c.gens).filter(g=>g.status==='ours').length;}
export function dismiss(c:Campaign,id:string):string|null {
 if(!commandAllowed(c)||id===LORD||c.gens[id]?.status!=='ours') return '今は解雇できない';
 c.gens[id].status='ronin';c.gens[id].wage=300+c.gens[id].lv*30;
 c.news.push({turn:c.turn,t:`${GEN_BY_ID[id]?.name??c.gens[id].custom?.name}を解雇した。`,c:'info'});return null;
}
export type DiplomaticAction='gift'|'peace'|'alliance'|'vassal';
export function diplomacyError(c:Campaign,f:FactionId,a:DiplomaticAction,ids:string[]):string|null {
 if(!commandAllowed(c))return '敵襲や出陣を先に解決してください';
 if(f==='akatsuki'||f==='youma'||!c.factions[f].alive)return '交渉できない勢力';
 if(c.fans<1)return '行動が残っていない';
 if(!ids.length||ids.length>5||new Set(ids).size!==ids.length||ids.some(id=>!canAct(c,id)))return '未行動の武将を1〜5人選んでください';
 if(a==='gift'&&c.gold<300)return '贈答には300文必要';
 if(a==='peace'&&relation(c,f)!=='war')return '交戦していない';
 if(a==='alliance'&&relation(c,f)!=='peace')return '不戦の勢力と結べる';
 if(a==='vassal') {
  const ours=Object.values(c.regions).filter(r=>r.owner==='akatsuki').length;
  const theirs=Object.values(c.regions).filter(r=>r.owner===f).length;
  if(ours<theirs*2||c.fame<20)return '領国が相手の2倍以上・武名20以上必要';
 }
 return null;
}
export function negotiate(c:Campaign,f:FactionId,a:DiplomaticAction,ids:string[]):string {
 const err=diplomacyError(c,f,a,ids);if(err)throw Error(err);
 const s=strategy(c);const power=ids.reduce((n,id)=>n+(GEN_BY_ID[id]?.int??c.gens[id].custom?.int??50)+c.gens[id].lv,0);
 c.fans--;markUsed(c,ids);
 if(a==='gift'){c.gold-=300;s.favor[f]=(s.favor[f]??0)+40;return `${FACTIONS[f].name}へ贈答。友好+40。`;}
 const need=a==='peace'?100:a==='alliance'?160:230;
 const key=`diplomacy:${f}:${a}`;
 const total=(c.progress[key]??0)+power+(s.favor[f]??0);
 if(total<need){c.progress[key]=total;return `交渉は${total}/${need}。次の季節へ引き継ぐ。`;}
 delete c.progress[key];s.relations[f]=a;c.factions[f].war=false;
 s.history.push(`${c.turn}季 ${FACTIONS[f].name}と${RELATION_NAME[a]}`);
 pushScene(c,`treaty:${f}:${a}`,'盟約の席',[[LORD,`${FACTIONS[f].name}との${RELATION_NAME[a]}、この約を違えぬ。`],['g_chikage','戦わず得るものもあるわ。ただし、盟友の城を見捨てないこと。']]);
 advanceStory(c);return `${FACTIONS[f].name}と${RELATION_NAME[a]}を結んだ。`;
}
export function rewardCount(c:Campaign):number {return Math.max(0,Math.floor(c.fame/20)-strategy(c).claimed);}
export function claimReward(c:Campaign,choice:'fans'|'gold'|'training',id=LORD):string {
 const s=strategy(c);if(!commandAllowed(c)||rewardCount(c)<1)throw Error('選べる褒賞がない');
 if(choice==='fans'&&s.bonusFans>=3)throw Error('行動は最大5回');
 if(choice==='training'&&c.gens[id]?.status!=='ours')throw Error('家臣を選んでください');
 s.claimed++;
 if(choice==='fans'){s.bonusFans++;c.fans++;return '毎季の行動が1回増えた。';}
 if(choice==='gold'){c.gold+=1500;return '褒賞1500文を受け取った。';}
 const g=c.gens[id];g.lv=Math.min(99,g.lv+2);g.exp=Math.max(g.exp,expFor(g.lv));return '武将のレベルが2上がった。';
}
export function routeStatus(c:Campaign):{id:Route;ready:boolean;reason:string}[] {
 const s=strategy(c);const cooperation=['honoo','rengein'].some(f=>allies(c).includes(f as FactionId)||!c.factions[f as FactionId].alive);
 return [
 {id:'hado',ready:s.capitalTaken,reason:'人間勢力の本拠を1つ攻略'},
 {id:'pact',ready:s.capitalTaken&&allies(c).length>=2,reason:'本拠攻略＋人間2勢力と同盟・従属'},
 {id:'seal',ready:s.capitalTaken&&(c.gens.g_suzuran?.bond??0)>=2&&cooperation,reason:'本拠攻略＋鈴蘭の絆2＋焔ノ家か蓮華院の協力・制圧'},
 ];
}
export function chooseRoute(c:Campaign,r:Route) {
 const s=strategy(c);if(!commandAllowed(c)||s.route||!routeStatus(c).find(x=>x.id===r)?.ready)throw Error('この道はまだ選べない');
 s.route=r;s.pactPartners=allies(c);
 pushScene(c,`route:${r}`,`${ROUTE_NAME[r]}の誓い`,r==='hado'?[[LORD,'戦乱を終わらせる。八洲を一つにして、黒淵を討つ。'],['g_genba','敵を追う軍と城を守る軍、両輪をお忘れなく。']]:r==='pact'?[['g_chikage','独りの強さでは救えない国がある。盟友を守り、霧を押し返しましょう。'],[LORD,'盟友の城は、俺たちの城と同じだ。']]:[['g_suzuran','三つの霊地を結び直します。森と火の祈りが届けば、沼の核を断てます。'],[LORD,'お前だけに背負わせるか。俺も行く。']]);
 advanceStory(c);
}
export function sealError(c:Campaign,rid:string):string|null {
 const s=strategy(c);if(!commandAllowed(c)||s.route!=='seal')return '鎮霧の道で行う儀式';
 if(!['12','10','13'].includes(rid)||s.seals.includes(rid))return '封印する霊地ではない';
 const owner=c.regions[rid]?.owner;if(owner!=='akatsuki'&&!allies(c).includes(owner))return '自領か盟友の霊地が必要';
 if(rid==='13'&&s.seals.length<2)return '先に鈴音山と焔ノ郷を封印する';
 if(c.fans<1)return '行動が残っていない';
 if(!Object.values(c.gens).some(g=>canAct(c,g.id)&&(g.kind==='miko'||g.kind==='onmyo'||g.kind==='sohei')))return '未行動の祈り手が必要（巫女・陰陽・僧兵）';
 return null;
}
export function performSeal(c:Campaign,rid:string) {
 const err=sealError(c,rid);if(err)throw Error(err);
 const priest=Object.values(c.gens).find(g=>canAct(c,g.id)&&['miko','onmyo','sohei'].includes(g.kind))!;
 markUsed(c,[priest.id]);c.fans--;strategy(c).seals.push(rid);
 pushScene(c,`seal:${rid}`,'霊脈の封印',[[priest.id,'この地に残る声よ、どうか道を照らして。'],['','霧の流れが変わった。八洲の空に、細い光が差す。']]);advanceStory(c);
}
export function pushScene(c:Campaign,key:string,title:string,lines:Scene['lines']) {
 const s=strategy(c);if(s.events[key])return;s.events[key]=true;c.scenes.push({key,title,lines:lines.map(([id,text])=>[c.gens[id]?.status==='gone'?'':id,text])});
}
export function onConquest(c:Campaign,rid:string,prev:FactionId) {
 const s=strategy(c);const original=REGIONS.find(r=>r.id===rid);if(original?.capital&&original.owner!=='youma'&&original.owner!=='akatsuki')s.capitalTaken=true;
 const first=Object.keys(s.events).filter(k=>k.startsWith('conquest:')).length===0;
 pushScene(c,`conquest:${rid}`,first?'最初の城、次の一手':'城に残る声',[[LORD,first?'城を落とした。だが、人の暮らしまで奪うつもりはない。':'勝った者が、この国の明日を引き受ける。'],['g_chikage',`${FACTIONS[prev].name}の者たちにも、それぞれ守るものがあった。帰順を受け入れるか、軍議で決めましょう。`]]);
 const chapter=CHAPTERS[prev];if(chapter)pushScene(c,`chapter:${prev}`,chapter.title,chapter.lines);
 if(first&&c.flags.youma)pushScene(c,'order:late','霧の後の初勝利',[['g_chikage','人同士の決着より先に、霧が来た。この城は征服ではなく、解放の最初の一つよ。']]);
 s.choices[`occupation:${rid}`]='pending';advanceStory(c);
}
export function decideOccupation(c:Campaign,rid:string,choice:'mercy'|'levy') {
 const s=strategy(c);if(!commandAllowed(c)||s.choices[`occupation:${rid}`]!=='pending')throw Error('決定済み');
 s.choices[`occupation:${rid}`]=choice;const former=REGIONS.find(r=>r.id===rid)!.owner;
 if(choice==='mercy'){s.favor[former]=(s.favor[former]??0)+30;c.regions[rid].np=Math.min(30,c.regions[rid].np+1);}
 else {c.gold+=500;s.favor[former]=(s.favor[former]??0)-30;}
}
export function advanceStory(c:Campaign) {
 const s=strategy(c);if(!s.route||s.ending||c.defeat)return;
 const allied=allies(c);const supported=Object.values(c.regions).filter(r=>r.owner==='akatsuki'||relation(c,r.owner)==='vassal').length;
 if(s.route==='pact'&&s.pactPartners.some(f=>!c.factions[f].alive))pushScene(c,'pact:fallen','失われた盟友',[['g_chikage','盟友の本拠が落ちた。別の家と結び直すか、その城を取り戻すしかない。']]);
 if((s.route==='hado'&&supported>=5)||(s.route==='pact'&&allied.length>=3)||(s.route==='seal'&&s.seals.length>=2)) {
  pushScene(c,`mid:${s.route}`,s.route==='hado'?'連合の檄':s.route==='pact'?'八洲の誓約':'封印の反動',[['g_kurobuchi','人の子よ、その道が何を犠牲にするか、最後まで見届けよう。'],[LORD,'ああ。だから仲間と進むんだ。']]);
 }
 const pactCapitals=allied.filter(f=>REGIONS.some(r=>r.capital&&r.owner===f&&c.regions[r.id].owner===f));
 const win=s.demonDefeated&&(s.route==='hado'?supported===REGIONS.length:s.route==='pact'?pactCapitals.length>=3:s.seals.length===3);
 if(!win)return;
 s.ending=s.route;s.endingTurn=c.turn;c.victory=c.turn;
 const endings:Record<Route,Scene['lines']>={
 hado:[[LORD,'八洲の戦は終わった。だが、明日からが俺たちの仕事だ。'],['g_genba','若の旗は、ようやく人々の帰る目印になりましたな。'],['','統一の旗の下で、かつての敵も田畑と街道を直していく。覇道の果てに、暮らしの朝が来た。']],
 pact:[['g_chikage','違う旗が、同じ空の下に立っている。これが私たちの答えね。'],[LORD,'約束は勝った時こそ守る。次は戦ではなく、祭りに招け。'],['','盟約は書面だけではなかった。国境を越えた商いと人の往来が、戦乱の傷を縫っていった。']],
 seal:[['g_suzuran','聞こえますか。もう、あの声はしません。'],[LORD,'ああ。今度こそ帰るぞ。飯を食いに。'],['','三つの霊地から光が結ばれ、沼はただの水辺に戻った。鈴の音は、亡き者を呼ぶ声から、生きる者を迎える音へ変わった。']],
 };
 pushScene(c,`ending:${s.route}`,`結 ── ${ROUTE_NAME[s.route]}`,endings[s.route]);
}
export interface Chronicle {v:1;endings:Partial<Record<Route,number>>;read:Record<string,true>;titles:Record<string,true>;points:number;credited:string[];}
const META='gunyu5:chronicle';
export function loadChronicle():Chronicle {try{const x=JSON.parse(localStorage.getItem(META)??'null');if(x?.v===1&&x.endings&&x.read&&x.titles&&Number.isFinite(x.points)&&Array.isArray(x.credited))return x;}catch{}return {v:1,endings:{},read:{},titles:{},points:0,credited:[]};}
export function saveChronicle(m:Chronicle){try{localStorage.setItem(META,JSON.stringify(m));}catch{}}
export function recordEnding(c:Campaign):Chronicle {
 const m=loadChronicle(),s=strategy(c);Object.assign(m.titles,c.titles);
 const id=`${c.seed}:${s.ending}:${s.endingTurn}`;
 if(s.ending&&!m.credited.includes(id)){m.endings[s.ending]=(m.endings[s.ending]??0)+1;m.points+=3;m.credited.push(id);}saveChronicle(m);return m;
}
export type LegacyBonus='gold'|'retainer'|'training';
export function spendLegacy(c:Campaign,m:Chronicle,bonus:LegacyBonus):boolean {
 if(m.points<1||strategy(c).choices.legacy)return false;
 m.points--;strategy(c).choices.legacy=bonus;
 if(bonus==='gold')c.gold+=1000;
 if(bonus==='training')for(const g of Object.values(c.gens).filter(g=>g.status==='ours')){g.lv++;g.exp=Math.max(g.exp,expFor(g.lv));}
 if(bonus==='retainer'){
 const g=Object.values(c.gens).find(g=>g.status==='ronin');if(g){g.status='ours';g.troops=Math.max(300,g.troops);}else{m.points++;return false;}
 }saveChronicle(m);return true;
}

export function restoreAlly(c:Campaign,f:FactionId):string {
 const home=REGIONS.find(r=>r.owner===f&&r.capital);
 if(!commandAllowed(c)||c.fans<1||!home||c.regions[home.id].owner!=='akatsuki'||f==='youma'||f==='akatsuki')throw Error('旧本拠を自領に取り戻すと復興を支援できる');
 const id=`x${c.nextGen++}`;
 c.gens[id]={id,status:'enemy',faction:f,lv:5,exp:expFor(5),bond:0,injured:0,kind:'ashigaru',troops:700,wounded:0,fought:0,custom:{name:`${FACTIONS[f].name}の守備将`,short:'守備将',portrait:'generic_defender',label:'復興の将',cmd:60,pow:55,int:50}};
 const r=c.regions[home.id];r.owner=f;r.boss=id;delete r.mid;r.taken=0;
 c.factions[f]={alive:true,war:false};strategy(c).relations[f]='alliance';c.fans--;
 pushScene(c,`restore:${f}`,'再び旗を立てる',[['g_chikage',`${FACTIONS[f].name}の旗が戻った。誰か一人が欠けても、約束は継げる。`]]);advanceStory(c);return '旧本拠を返還し、同盟国を復興した。';
}

export function sceneKey(s:Scene):string{return s.key??`${s.title??'会話'}:${s.lines[0]?.[1]??''}`;}
export function markRead(s:Scene){const m=loadChronicle();m.read[sceneKey(s)]=true;saveChronicle(m);}

