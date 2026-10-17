// 一つのベクトル領域を表示と操作に共用。国の中心と進軍関係は既存の定義を使う。
import { REGIONS } from '../content/sengoku';
export type Point=[number,number];
export const MAIN_COAST='M 8 12 Q 19 2 31 5 L 48 5 Q 60 2 72 7 L 89 10 Q 96 18 93 29 L 94 45 Q 98 59 90 71 L 80 84 Q 69 93 56 94 L 36 91 Q 24 85 22 76 L 8 68 Q 3 57 8 43 L 6 27 Z';
function clip(poly:Point[],a:number,b:number,k:number):Point[] {
 const out:Point[]=[];
 for(let i=0;i<poly.length;i++){
 const p=poly[i],q=poly[(i+1)%poly.length],dp=a*p[0]+b*p[1]-k,dq=a*q[0]+b*q[1]-k;
 if(dp<=0)out.push(p);
 if((dp<0&&dq>0)||(dp>0&&dq<0)){const t=dp/(dp-dq);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}
 }return out;
}
export function regionPolygon(id:string):Point[] {
 if(id==='15')return [[9,82],[15,80],[21,84],[21,91],[15,95],[9,91]];
 const r=REGIONS.find(r=>r.id===id);if(!r)return [];
 let p:Point[]=[[3,3],[97,3],[97,97],[3,97]];
 for(const n of REGIONS.filter(x=>x.id!==id&&x.id!=='15'))p=clip(p,2*(n.x-r.x),2*(n.y-r.y),n.x*n.x+n.y*n.y-r.x*r.x-r.y*r.y);
 return p;
}
export function polygonPath(poly:Point[]):string {return poly.length?'M '+poly.map(p=>p.map(n=>n.toFixed(3)).join(' ')).join(' L ')+' Z':'';}
export function contains(poly:Point[],x:number,y:number):boolean {
 let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }return inside;
}
