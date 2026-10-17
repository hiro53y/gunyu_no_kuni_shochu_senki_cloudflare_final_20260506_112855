// Imported only behind import.meta.env.DEV; removed by the production build.
import { newCampaign, beginBattle } from '../campaign/campaign';
import { autoPlace } from '../campaign/army';
import { createBattle } from '../battle/engine';
import type { Battle } from '../battle/types';
import { advanceStory, strategy } from '../campaign/strategy';
export function qaFixture(){
 if(!import.meta.env.DEV)return null;
 const mode=new URLSearchParams(location.search).get('qa');if(!mode)return null;
 const c=newCampaign(5050);c.scenes=[];c.gold=50000;c.fans=5;c.fame=80;const s=strategy(c);s.bonusFans=3;s.capitalTaken=true;c.gens.g_suzuran.bond=2;
 for(const f of ['honoo','shirasagi','ronin'] as const){s.relations[f]='alliance';c.factions[f].war=false;}
 c.regions['11'].owner='akatsuki';delete c.regions['11'].boss;delete c.regions['11'].mid;
 c.regions['12'].owner='akatsuki';delete c.regions['12'].boss;delete c.regions['12'].mid;
 const ids=['g_saku','g_genba','g_suzuran','g_chikage','g_hayato','g_kagemaru'];
 for(const id of ids){const g=c.gens[id];g.status='ours';g.capacityBonus=600;g.troops=1100;g.lv=12;}
 let b:Battle|null=null;
 if(mode==='battle'){c.regions['13'].taken=c.regions['13'].lands.length-1;b=createBattle(beginBattle(c,'siege','13',autoPlace(ids.map(id=>({id,kind:c.gens[id].kind}))),5050));}
 if(mode==='ending'){s.route='pact';s.demonDefeated=true;advanceStory(c);}
 return {c,b};
}
