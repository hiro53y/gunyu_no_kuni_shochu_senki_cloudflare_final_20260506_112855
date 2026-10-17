import type {Campaign,CommandId} from './state';
/** Legacy country progress is retained as evidence, imported only once. Never starts a war. */
export function migrateWarProgress(c:Campaign){
 if(c.flags.warProgressFaction)return;
 for(const [key,value] of Object.entries(c.progress)){
  const match=/^war:(\d+)$/.exec(key);if(!match||!Number.isFinite(value)||value<=0)continue;
  const f=c.regions[match[1]]?.owner;
  if(!f||f==='akatsuki'||c.factions[f].war)continue;
  const target=`war:faction:${f}`;c.progress[target]=(c.progress[target]??0)+value;
 }
 c.flags.warProgressFaction=true;
}
export function progressKey(c:Campaign,cmd:CommandId,target:string){return cmd==='war'?`war:faction:${c.regions[target].owner}`:`${cmd}:${target}`;}
