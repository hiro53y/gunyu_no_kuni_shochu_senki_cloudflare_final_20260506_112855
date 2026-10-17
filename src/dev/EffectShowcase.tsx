// Development-only visual acceptance bench. Never included in the production bundle.
import {useEffect,useMemo,useRef,useState} from 'react';
import {Field} from '../battle/view/field';
import {createBattle} from '../battle/engine';
import {newCampaign,beginBattle} from '../campaign/campaign';
import {KINDS,battleSkill} from '../battle/kinds';
import {preloadBattleArt} from '../battle/view/sprites';
import type {Kind,Anim} from '../battle/types';
import {bustUrl,tokenUrl} from '../ui/common';
import {playSe} from '../audio/sound';
export function EffectShowcase(){
 const [kind,setKind]=useState<Kind>('bushi'),[busy,setBusy]=useState(false),[speed,setSpeed]=useState(1),[reduced,setReduced]=useState(false);
 const ref=useRef<HTMLCanvasElement>(null),field=useRef<Field|null>(null);
 const b=useMemo(()=>{const c=newCampaign(891);c.gens.g_saku.kind=kind;const spec=beginBattle(c,'hunt','01',[{gen:'g_saku',row:0,slot:1}],891);spec.L[0].portrait='generic_preview';spec.L[0].short=KINDS[kind].name;return createBattle(spec);},[kind]);
 useEffect(()=>{const cv=ref.current;if(!cv)return;const f=new Field(cv,{colors:{L:'#c34735',R:'#6944a8'},headUrl:tokenUrl,bustUrl});field.current=f;f.setBattle(b,'field');void preloadBattleArt(b.units);const resize=()=>{const r=cv.getBoundingClientRect();f.resize(r.width,r.height,devicePixelRatio);};resize();const ro=new ResizeObserver(resize);ro.observe(cv);return()=>{ro.disconnect();f.destroy();field.current=null;};},[b]);
 useEffect(()=>{if(field.current){field.current.speed=speed;field.current.reduced=reduced;}},[speed,reduced,b]);
 const play=async(special:boolean)=>{const f=field.current;if(!f||busy)return;setBusy(true);const u=b.units.find(u=>u.side==='L')!,targets=b.units.filter(u=>u.side==='R').map(u=>u.uid),skill=battleSkill(KINDS[kind].skills[0][0]);const anim:Anim=kind==='miko'?'heal':kind==='gunshi'?'buff':skill.anim;
 try{await f.performTechnique({k:'skill',uid:u.uid,skill:skill.id,name:`${KINDS[kind].name}・${special?'大技':'通常'}`,color:KINDS[kind].color,range:skill.range,anim,special,targets:anim==='heal'||anim==='buff'?[u.uid]:targets},null,anim==='heal'||anim==='buff'?[]:targets,()=>playSe(anim==='gun'?'gun':'slash'));}finally{if(field.current===f)setBusy(false);}};
 return <div style={{height:'100dvh',display:'flex',flexDirection:'column',background:'#1f1915',padding:8}}><h3 style={{margin:4}}>演出検証</h3><div style={{display:'flex',gap:4,flexWrap:'wrap'}}>{(Object.keys(KINDS) as Kind[]).map(k=><button disabled={busy} aria-pressed={kind===k} key={k} onClick={()=>setKind(k)}>{KINDS[k].name}</button>)}</div><div style={{position:'relative',flex:1,minHeight:220}}><canvas ref={ref} style={{width:'100%',height:'100%',position:'absolute',inset:0}}/></div><div style={{display:'flex',gap:6}}><button disabled={busy} onClick={()=>void play(false)}>通常演出</button><button disabled={busy} onClick={()=>void play(true)}>大技演出</button><button onClick={()=>setSpeed(speed===1?.5:speed===.5?0:1)}>速度 {speed}</button><button onClick={()=>setReduced(!reduced)}>{reduced?'控えめ':'標準'}</button></div><p role="status">{busy?'再生中':`${KINDS[kind].name} 待機`}</p></div>;
}
