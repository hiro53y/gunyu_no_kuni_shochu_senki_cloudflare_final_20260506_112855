import { describe,it,expect } from 'vitest';
import { newCampaign,beginBattle,finishBattle,doCommand,commandError,readyGenerals,endTurn,hire,doBond,checkParty,expandCapacity,expansionCost } from '../src/campaign/campaign';
import { activity,advanceStory,onConquest,allies,canAct,chooseRoute,claimReward,currentRound,decideOccupation,diplomacyError,initialStrategy,markUsed,negotiate,performSeal,relation,restoreAlly,rewardCount,routeStatus,settleEnemy,spendLegacy,strategy,type Chronicle,type Route } from '../src/campaign/strategy';
import { autoPlace } from '../src/campaign/army';
import { createBattle,act,canUse } from '../src/battle/engine';
import { chooseAction } from '../src/battle/ai';
import { deserializeCampaign,saveCampaign,loadCampaign,KEY_CAMPAIGN,type KV } from '../src/engine/save';
import { REGIONS } from '../src/content/sengoku';
import { contains,regionPolygon } from '../src/campaign/mapGeometry';

function party(c:ReturnType<typeof newCampaign>){return autoPlace(readyGenerals(c).map(g=>({id:g.id,kind:g.kind})));}
describe('v5 武将の活動と回帰',()=>{
 it('同じ武将を重複して内政へ投入できない',()=>{const c=newCampaign(1);expect(commandError(c,'build','01',Array(5).fill('g_genba'))).not.toBeNull();const before=JSON.stringify(c);expect(()=>doCommand(c,'build','01',Array(5).fill('g_genba'))).toThrow();expect(JSON.stringify(c)).toBe(before);});
 it('内政と交流の活動が合戦と防衛に共有される',()=>{const c=newCampaign(2);doCommand(c,'build','01',['g_genba']);expect(canAct(c,'g_genba')).toBe(false);expect(activity(c,'g_genba')).toBe('行動済み');expect(checkParty(c,[{gen:'g_genba',row:0,slot:0}])).toEqual([]);expect(()=>doCommand(c,'build','01',['g_genba'])).toThrow();});
 it('出陣時点で全員を活動済みにし、結果の二重反映を拒否',()=>{const c=newCampaign(3);const p=party(c),b=createBattle(beginBattle(c,'hunt','01',p,3));expect(readyGenerals(c)).toHaveLength(0);expect(()=>finishBattle(c,b)).toThrow();for(let i=0;i<300&&!b.end;i++)act(b,chooseAction(b));expect(b.end).not.toBeNull();finishBattle(c,b);expect(()=>finishBattle(c,b)).toThrow();});
 it('敵の手番は前季の活動状態を引き継ぐ。全侵攻解決後に戻る',()=>{const c=newCampaign(4);markUsed(c,['g_genba']);strategy(c).enemyTurn=c.turn;c.turn++;expect(currentRound(c)).toBe(1);expect(canAct(c,'g_genba')).toBe(false);settleEnemy(c);expect(currentRound(c)).toBe(2);expect(canAct(c,'g_genba')).toBe(true);});
 it('自動配置の朔が前衛で通常攻撃できる',()=>{const c=newCampaign(5),b=createBattle(beginBattle(c,'hunt','01',party(c),5));const u=b.units.find(u=>u.gen==='g_saku')!;expect(u.row).toBe(0);expect(canUse(b,u,'b_atk').ok).toBe(true);});
 it('補充や雇用で活動済み状態を消さない',()=>{const c=newCampaign(6);markUsed(c,['g_genba']);c.gens.g_genba.status='ronin';c.gens.g_genba.wage=0;hire(c,'g_genba');expect(canAct(c,'g_genba')).toBe(false);});
 it('不正な配置の行・枠を受け付けない',()=>{const c=newCampaign(1);expect(checkParty(c,[{gen:'g_saku',row:4 as 0,slot:9 as 0}])).toEqual([]);});
 it('同じ季節に交流を繰り返せない',()=>{const c=newCampaign(7);doBond(c,'g_suzuran');expect(()=>doBond(c,'g_suzuran')).toThrow();});
});
describe('v5 外交・成長・保存',()=>{
 it('外交は武将と行動を使い、同盟相手は侵攻しない',()=>{const c=newCampaign(8);negotiate(c,'rengein','alliance',['g_chikage','g_suzuran','g_saku']);expect(relation(c,'rengein')).toBe('alliance');expect(allies(c)).toContain('rengein');expect(c.fans).toBe(1);expect(canAct(c,'g_chikage')).toBe(false);expect(diplomacyError(c,'rengein','peace',['g_genba'])).not.toBeNull();for(let t=0;t<5;t++){c.scenes=[];c.invasions=[];strategy(c).enemyTurn=null;endTurn(c);expect(c.invasions.every(i=>i.faction!=='rengein')).toBe(true);}});
 it('武名は報酬を選ぶまで行動を増やさない',()=>{const c=newCampaign(9);c.fame=40;expect(rewardCount(c)).toBe(2);claimReward(c,'fans');expect(strategy(c).bonusFans).toBe(1);claimReward(c,'gold');expect(c.gold).toBe(3000);expect(()=>claimReward(c,'gold')).toThrow();});
 it('セーブを往復しても敵手番・活動・物語を保持',()=>{const c=newCampaign(10);markUsed(c,['g_genba']);strategy(c).enemyTurn=1;strategy(c).choices.example='mercy';const copy=deserializeCampaign(JSON.stringify(c))!;expect(copy).toEqual(c);expect(canAct(copy,'g_genba')).toBe(false);});
 it('localStorageが使えなくてもゲームの処理を止めない',()=>{const bad:KV={getItem(){throw Error('blocked')},setItem(){throw Error('quota')},removeItem(){throw Error('blocked')}};expect(()=>saveCampaign(newCampaign(1),bad)).not.toThrow();expect(loadCampaign(bad)).toBeNull();expect(KEY_CAMPAIGN).toBe('gunyu5:campaign');});
 it('戦後処置と成長報酬を二重に受け取れない',()=>{const c=newCampaign(11);strategy(c).choices['occupation:11']='pending';decideOccupation(c,'11','levy');expect(c.gold).toBe(2000);expect(()=>decideOccupation(c,'11','levy')).toThrow();});
 it('周回特典はポイントを使い、一度だけ適用する',()=>{for(const bonus of ['gold','retainer','training'] as const){const c=newCampaign(12);const meta:Chronicle={v:1,endings:{hado:1},read:{},titles:{},points:3,credited:[]};expect(spendLegacy(c,meta,bonus)).toBe(true);expect(meta.points).toBe(2);expect(spendLegacy(c,meta,bonus)).toBe(false);}});
});
describe('v5 地図の領域',()=>{
 it('15国すべての城が自分のタップ領域内にある',()=>{for(const r of REGIONS)expect(contains(regionPolygon(r.id),r.x,r.y),r.name).toBe(true);});
});
describe('v5 分岐シナリオ 固定seed20通りずつ',()=>{
 for(const route of ['hado','pact','seal'] as Route[])for(let seed=1;seed<=20;seed++)it(`${route} ${seed}`,()=>{
  // Chapter-boundary scenario fixture: engine-driven final battle and all ending conditions.
  const c=newCampaign(5000+seed);const s=strategy(c);s.capitalTaken=true;c.gens.g_suzuran.bond=2;
  for(const f of ['honoo','shirasagi','ronin'] as const){c.factions[f].war=false;s.relations[f]='alliance';}
  expect(routeStatus(c).find(x=>x.id===route)?.ready).toBe(true);chooseRoute(c,route);
  // Scenario preparation is explicit: this verifies all branches, not normal-play difficulty.
  c.gold=10000;c.turn=40;s.enemyTurn=null;c.fans=5;
  for(const g of Object.values(c.gens).filter(g=>g.status==='ours')){g.lv=45;g.troops=9000;}
  if(route==='hado')for(const r of Object.values(c.regions))if(r.id!=='13'){r.owner='akatsuki';delete r.boss;delete r.mid;}
  if(route==='seal'){for(const rid of ['12','10']){c.regions[rid].owner='akatsuki';performSeal(c,rid);c.turn++;c.fans=5;}}
  c.regions['01'].owner='akatsuki';c.regions['13'].taken=c.regions['13'].lands.length-1;c.factions.youma.war=true;
  const b=createBattle(beginBattle(c,'siege','13',party(c),seed));
  // Explicit completed-battle fixture; normal combat is exercised in playthrough-v5.test.ts.
  for(const u of b.units.filter(u=>u.side==='R')){u.out=true;u.troops=0;}b.end={winner:'L',reason:'wipe'};b.active=null;finishBattle(c,b);c.captives=[];
  if(route==='seal'){c.turn++;c.fans=5;performSeal(c,'13');}
  advanceStory(c);expect(s.ending).toBe(route);expect(c.victory).toBe(c.turn);const n=c.scenes.length;advanceStory(c);expect(c.scenes).toHaveLength(n);
  const next=newCampaign(seed+10000),meta:Chronicle={v:1,endings:{[route]:1},read:{...s.events},titles:{},points:3,credited:[]};expect(spendLegacy(next,meta,'training')).toBe(true);expect(strategy(next).route).toBeNull();expect(Object.values(next.regions).filter(r=>r.owner==='akatsuki')).toHaveLength(1);
 });
 it('固有武将が不在でも祈り手を代役に封印できる',()=>{const c=newCampaign(2);strategy(c).route='seal';c.gens.g_suzuran.status='gone';c.gens.g_kangetsu.status='ours';c.regions['12'].owner='akatsuki';expect(()=>performSeal(c,'12')).not.toThrow();});
 it('滅んだ盟友を取り戻した城から再興できる',()=>{const c=newCampaign(2);c.regions['10'].owner='akatsuki';c.factions.honoo.alive=false;restoreAlly(c,'honoo');expect(c.factions.honoo.alive).toBe(true);expect(relation(c,'honoo')).toBe('alliance');});
});

describe('v5 解放と活動の追加回帰',()=>{
 it('妖魔に奪われた人間本拠の解放でも分岐を開放する',()=>{const c=newCampaign(45);c.flags.youma=true;c.regions['10'].owner='akatsuki';onConquest(c,'10','youma');expect(strategy(c).capitalTaken).toBe(true);expect(routeStatus(c).find(r=>r.id==='hado')?.ready).toBe(true);const n=c.scenes.length;advanceStory(c);expect(c.scenes.length).toBeGreaterThanOrEqual(n);});
});

describe('v5 結果の照合と部隊拡張',()=>{
 it('同じ場所でも別seedの結果を反映しない',()=>{const c=newCampaign(66);const b=createBattle(beginBattle(c,'hunt','01',party(c),90));b.end={winner:'L',reason:'wipe'};b.seed=89;const before=JSON.stringify(c);expect(()=>finishBattle(c,b)).toThrow('別の合戦');expect(JSON.stringify(c)).toBe(before);});
 it('妖怪の拡張にも費用がかかり、上限を超える兵を加算しない',()=>{const c=newCampaign(67);const g=c.gens.g_genba;g.kind='youkai';c.gold=100000;g.capacityBonus=7999;const before=g.troops;expect(expansionCost(c,g.id)).toBeGreaterThan(0);expect(expandCapacity(c,g.id)).toBeNull();expect(g.capacityBonus).toBe(8000);expect(g.troops).toBe(before+1);expect(expandCapacity(c,g.id)).toBe('部隊の拡張は最大');});
});
