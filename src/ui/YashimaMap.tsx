import { useEffect, useId, useRef, useState } from 'react';
import { FACTIONS, REGIONS, regionDef } from '../content/sengoku';
import type { Campaign } from '../campaign/state';
import { canAttack } from '../campaign/campaign';
import { relation } from '../campaign/strategy';
import { MAIN_COAST, polygonPath, regionPolygon } from '../campaign/mapGeometry';
import { ASSET_VERSION } from './common';

export interface MapProps { c:Campaign;selected:string|null;onSelect:(id:string)=>void; }
const shapes=Object.fromEntries(REGIONS.map(r=>[r.id,polygonPath(regionPolygon(r.id))]));
export function YashimaMap({c,selected,onSelect}:MapProps){
 const [zoom,setZoom]=useState(1),box=useRef<HTMLDivElement>(null),clip=useId().replace(/:/g,'');
 useEffect(()=>{const b=box.current,r=REGIONS.find(r=>r.id===selected);if(b&&r&&zoom>1)b.scrollTo({left:r.x/100*b.clientWidth*zoom-b.clientWidth/2,top:r.y/100*b.clientWidth*zoom-b.clientHeight/2,behavior:'smooth'});},[zoom,selected]);
 return <section className="map-box illustrated-map" aria-label="八洲十五国の地図">
 <div className="map-tools"><span>八洲全図</span><button aria-label="地図を縮小" disabled={zoom===1} onClick={()=>setZoom(Math.max(1,zoom-.5))}>−</button><button aria-label="地図を拡大" disabled={zoom===2.5} onClick={()=>setZoom(Math.min(2.5,zoom+.5))}>＋</button><button onClick={()=>{setZoom(1);box.current?.scrollTo(0,0);}}>全図</button></div>
 <div ref={box} className="map-viewport"><svg className="map-art" viewBox="0 0 100 100" style={{width:`${zoom*100}%`}} role="group" aria-label="国を選択">
 <defs><clipPath id={clip}><path d={MAIN_COAST}/><path d={shapes['15']}/></clipPath><filter id={`${clip}shadow`} x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy=".2" stdDeviation=".25" floodOpacity=".75"/></filter></defs>
 <image href={`/assets/v5/map.webp?v=${ASSET_VERSION}`} width="100" height="100" preserveAspectRatio="xMidYMid slice"/>
 <g clipPath={`url(#${clip})`}>{REGIONS.map(r=>{const owner=c.regions[r.id].owner,sel=selected===r.id;return <path key={r.id} d={shapes[r.id]} fill={FACTIONS[owner].color} fillOpacity={sel?.28:.12} stroke={sel?'#fff1ac':FACTIONS[owner].light} strokeWidth={sel?.65:.22} strokeOpacity={sel?1:.65} className="map-country" role="button" tabIndex={0} aria-label={`${r.name} ${FACTIONS[owner].name}`} aria-pressed={sel} onClick={()=>onSelect(r.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(r.id);}}}><title>{r.name} · {FACTIONS[owner].name}</title></path>})}</g>
 {selected&&regionDef(selected).adj.map(id=>{const a=regionDef(selected),b=regionDef(id);return <path key={id} d={`M${a.x},${a.y} L${b.x},${b.y}`} stroke="#f2dfa9" strokeWidth=".24" strokeDasharray=".65 .5" fill="none" pointerEvents="none"/>})}
 {c.invasions.map((iv,i)=>{const a=regionDef(iv.from),b=regionDef(iv.to);return <g key={i} pointerEvents="none"><path d={`M${a.x},${a.y}L${b.x},${b.y}`} stroke="#ff6851" strokeWidth=".7" strokeDasharray="1 .6"/><circle cx={b.x} cy={b.y} r="3.5" fill="none" stroke="#ff6851" strokeWidth=".5"/></g>})}
 {REGIONS.map(r=>{const owner=c.regions[r.id].owner,f=FACTIONS[owner],sel=selected===r.id,atk=canAttack(c,r.id),friendly=['alliance','vassal'].includes(relation(c,owner));return <g key={r.id} transform={`translate(${r.x},${r.y})`} role="button" tabIndex={0} aria-label={`${r.name}の城を選ぶ`} onClick={()=>onSelect(r.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(r.id);}}} className="map-castle">
 {(sel||atk)&&<circle r={sel?3.15:2.6} fill="#24180b88" stroke={sel?'#fff1a0':'#ff9b6a'} strokeWidth={sel?.45:.25}/>}
 <path d="M-1.7 1.1H1.7L1.35-.1H1.8L0-1.45-1.8-.1H-1.35Z" fill={f.color} stroke="#f4e2b5" strokeWidth=".2"/>
 <text y=".7" fill="#fff5dc" fontSize="1.8" textAnchor="middle">{friendly?'盟':f.mon}</text>
 <text y="4.45" className="map-name" textAnchor="middle" filter={`url(#${clip}shadow)`}>{r.name}</text>
 {c.regions[r.id].taken>0&&<text x="2.2" y="-.5" fontSize="1.4" fill="#ffe3ae" stroke="#271c12" strokeWidth=".15" paintOrder="stroke">{c.regions[r.id].taken}/{c.regions[r.id].lands.length}</text>}
 </g>})}
 </svg></div><p className="map-legend">金輪：選択中 · 朱輪：進軍可 · 盟：同盟・従属 · 拡大中は指で移動</p>
 </section>;
}
