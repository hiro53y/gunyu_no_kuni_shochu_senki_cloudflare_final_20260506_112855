import type {Anim,Kind} from '../types';
import {SKILL_TABLE} from '../kinds';
export type Style='blade'|'spear'|'cavalry'|'bow'|'gun'|'ninja'|'banner'|'petal'|'monk'|'sigil'|'claw';
export const STYLES:Record<Kind,Style>={bushi:'blade',ashigaru:'spear',kiba:'cavalry',yumi:'bow',teppo:'gun',shinobi:'ninja',gunshi:'banner',miko:'petal',sohei:'monk',onmyo:'sigil',youkai:'claw'};
const hash=(s:string)=>[...s].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);
export const TECHNIQUES=Object.fromEntries(Object.values(SKILL_TABLE).map(s=>[s.id,{signature:hash(s.id),motif:hash(s.id)%5,color:s.color}]));
export function presentation(skill:string,kind:Kind,anim:Anim){const p=TECHNIQUES[skill]??{signature:hash(skill),motif:hash(skill)%5,color:'#f6d486'};return {...p,style:STYLES[kind],ranged:['arrow','gun','shuriken','magic','shiki','volley'].includes(anim),support:['heal','buff','guard','shout','none'].includes(anim)};}
export function motionAt(style:Style,k:number){const pulse=Math.sin(Math.PI*Math.min(1,Math.max(0,k)));return {lift:style==='ninja'?-18*pulse:style==='claw'?-12*pulse:style==='cavalry'?-3*Math.abs(Math.sin(k*22)):style==='monk'?-6*pulse:0,tilt:(style==='gun'?-.12:style==='blade'?.16:style==='spear'?.07:style==='bow'?-.06:0)*pulse,step:style==='cavalry'?9:style==='spear'?5:3};}
/** Local, deterministic geometry; no screen flash, camera transform, or game RNG. */
export class TechniqueFx {
 private t=0;readonly cost:number;
 constructor(private style:Style,private from:[number,number],private to:[number,number],private color:string,private dur:number,private motif:number,private special:boolean,reduced:boolean){this.cost=reduced?5:special?24:14;}
 update(dt:number){this.t+=dt;return this.t<this.dur;}
 draw(g:CanvasRenderingContext2D){
  const k=Math.min(1,this.t/Math.max(1,this.dur)),fade=Math.sin(Math.PI*k),[fx,fy]=this.from,[tx,ty]=this.to,dir=tx>=fx?1:-1;
  g.save();g.globalAlpha=fade;g.strokeStyle=this.color;g.fillStyle=this.color;g.lineCap='round';g.lineWidth=this.special?3:2;
  const stroke=()=>{const width=g.lineWidth,alpha=g.globalAlpha;g.shadowColor=this.color;g.shadowBlur=this.special?7:4;g.stroke();g.shadowBlur=0;g.lineWidth=Math.max(.7,width*.4);g.strokeStyle='#fff3c9';g.globalAlpha=alpha*.8;g.stroke();g.lineWidth=width;g.strokeStyle=this.color;g.globalAlpha=alpha;};
  const n=Math.min(this.cost-2,this.special?16:10);
  for(let i=0;i<n;i++){
   const delay=i/n*.25,p=Math.max(0,Math.min(1,(k-delay)/.75)),x=fx+(tx-fx)*p,y=fy+(ty-fy)*p,off=(i%5-2)*5,a=i*2.399+this.motif;
   g.globalAlpha=fade*(.35+.65*(i%3)/2);
   switch(this.style){
    case 'blade':case 'claw':{
     if(i<3){const r=22+i*8+(this.special?10:0);g.lineWidth=this.style==='claw'?2.5:4;g.beginPath();
      if(this.style==='blade'){g.ellipse(tx,ty,r,r*.28,-.65+this.motif*.25,-2.8+p*1.4,.1+p*1.4);}
      else {g.moveTo(tx-20+off,ty-24);g.quadraticCurveTo(tx+12+off,ty-3,tx+3+off,ty+23);}
      stroke();
     }else{g.lineWidth=1;const r=10+p*30;g.beginPath();g.moveTo(tx+Math.cos(a)*r*.65,ty+Math.sin(a)*r*.65);g.lineTo(tx+Math.cos(a)*r,ty+Math.sin(a)*r);stroke();}break;}
    case 'spear':{if(i<3){g.beginPath();g.moveTo(x-dir*28,y+off);g.lineTo(x+dir*12,y+off);g.lineTo(x+dir*5,y+off-4);g.moveTo(x+dir*12,y+off);g.lineTo(x+dir*5,y+off+4);stroke();}else{g.beginPath();g.moveTo(tx,ty);g.lineTo(tx+Math.cos(a)*20*p,ty+Math.sin(a)*20*p);stroke();}break;}
    case 'cavalry':{g.globalAlpha=fade*.3;g.beginPath();g.ellipse(x-off*dir,y+22+Math.sin(a)*5,8+p*13,3+p*5,0,0,Math.PI*2);g.fill();g.globalAlpha=fade;g.beginPath();g.moveTo(x-dir*30,y+off);g.lineTo(x,y+off);stroke();break;}
    case 'bow':{const arc=-Math.sin(p*Math.PI)*(25+i%4*7);g.beginPath();g.moveTo(x-dir*14,y+off+arc+2);g.lineTo(x,y+off+arc);g.lineTo(x-dir*5,y+off+arc-3);stroke();break;}
    case 'gun':{if(i%3===0){g.globalAlpha=fade*.18;g.beginPath();g.arc(fx-dir*i,fy-6-k*25,5+k*16,0,Math.PI*2);g.fill();}else{g.beginPath();g.moveTo(x-dir*34,y+off*.5);g.lineTo(x+dir*8,y+off*.5);stroke();}break;}
    case 'ninja':{g.beginPath();const spin=k*15+a;for(let j=0;j<8;j++){const r=j%2?2:7,xx=x+Math.cos(spin+j*Math.PI/4)*r,yy=y+off+Math.sin(spin+j*Math.PI/4)*r;if(!j)g.moveTo(xx,yy);else g.lineTo(xx,yy);}g.closePath();stroke();g.globalAlpha=fade*.2;g.fillRect(x-dir*24,y+off-12,9,22);break;}
    case 'banner':{g.lineWidth=1;g.beginPath();g.moveTo(fx,fy);g.lineTo(tx,ty);stroke();if(i<3){g.fillRect(x,y-14,2,22);g.beginPath();g.moveTo(x+2,y-14);g.lineTo(x+14,y-11);g.lineTo(x+2,y-5);g.fill();}else{g.beginPath();g.arc(tx+Math.cos(a)*25,ty+Math.sin(a)*15,2,0,Math.PI*2);g.fill();}break;}
    case 'petal':{const radius=8+(1-p)*35;g.beginPath();g.ellipse(tx+Math.cos(a+k*3)*radius,ty+18-k*45+Math.sin(a)*12,3,6,a+k,0,Math.PI*2);g.fill();break;}
    case 'monk':{g.lineWidth=i<3?2:1;if(i<3){g.beginPath();g.ellipse(tx,ty+24,(8+p*42)*(i+1)/3,3+p*9,0,0,Math.PI*2);stroke();}else{g.beginPath();g.moveTo(tx+Math.cos(a)*p*25,ty+24);g.lineTo(tx+Math.cos(a)*p*40,ty+18-Math.abs(Math.sin(a))*p*18);stroke();}break;}
    case 'sigil':{const radius=12+p*28;g.lineWidth=1;if(i<2){g.beginPath();g.ellipse(tx,ty+20,radius*(1-i*.25),radius*.38*(1-i*.25),0,0,Math.PI*2);stroke();g.globalAlpha=fade*.18;g.fillRect(tx-9-i*7,ty-55*k,18+i*14,75*k);}else{const angle=a+k*2;g.save();g.translate(tx+Math.cos(angle)*radius,ty+20+Math.sin(angle)*radius*.38);g.rotate(angle);g.strokeRect(-2,-3,4,7);g.restore();}break;}

   }
  }
  if(this.special){g.globalAlpha=fade;g.lineWidth=1;g.beginPath();const radius=18+k*36;for(let i=0;i<=6+this.motif;i++){const a=i*Math.PI*2/(6+this.motif)+k;const xx=tx+Math.cos(a)*radius,yy=ty+Math.sin(a)*radius*.55;if(!i)g.moveTo(xx,yy);else g.lineTo(xx,yy);}g.closePath();stroke();}
  g.restore();
 }
}
