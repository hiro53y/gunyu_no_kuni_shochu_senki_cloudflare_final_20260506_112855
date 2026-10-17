import {describe,it,expect} from 'vitest';
import {playV5} from './campaignV5Bot';
import type {Route} from '../src/campaign/strategy';
const N=Number(process.env.V5_RUNS??0);
describe.runIf(N>0)('v5 新規開始からの通しプレイ',()=>{
 for(const route of ['hado','pact','seal'] as Route[])for(let i=0;i<N;i++)it(`${route} ${i}`,()=>{
  const r=playV5(7000+i*37,route,Number(process.env.MAX_TURNS??300));
  console.log(JSON.stringify({route,seed:7000+i*37,ending:r.ending,retries:r.retries,turn:r.c.turn,defeat:r.c.defeat,reason:r.c.defeatReason,gold:r.c.gold,lands:Object.values(r.c.regions).filter(r=>r.owner==='akatsuki').length,roster:Object.values(r.c.gens).filter(g=>g.status==='ours').length,capacity:r.c.gens.g_saku.capacityBonus,errors:r.errors,battles:r.battles.length,last:r.battles.slice(-3)}));
  expect(r.errors).toEqual([]);expect(r.ending).toBe(route);
 },60000);
});
