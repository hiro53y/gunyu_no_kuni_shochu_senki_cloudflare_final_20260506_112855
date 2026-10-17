import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {presentation,STYLES,TECHNIQUES,TechniqueFx,motionAt} from '../src/battle/view/presentation';
import {SKILL_TABLE} from '../src/battle/kinds';
import type {Kind} from '../src/battle/types';
import {Field,playEvents} from '../src/battle/view/field';
import type {BEvent} from '../src/battle/types';
import {newCampaign,beginBattle} from '../src/campaign/campaign';
import {createBattle} from '../src/battle/engine';

// Exercise renderer resolution and resize behavior without a GPU/browser dependency.
class CanvasProbe {
 width=300; height=150;
 context=new Proxy({drawImage:vi.fn(),setTransform:vi.fn(),clearRect:vi.fn(),
  createLinearGradient:()=>({addColorStop:vi.fn()}),createRadialGradient:()=>({addColorStop:vi.fn()}),
  measureText:()=>({width:20})}, {get(target,key){return key in target?Reflect.get(target,key):vi.fn();}});
 getContext(){return this.context;}
}
class ImageProbe {complete=true;naturalWidth=768;naturalHeight=512;src='';}
const canvas=()=>new CanvasProbe() as unknown as HTMLCanvasElement;
function renderer(){const target=canvas();const field=new Field(target,{colors:{L:'#c33',R:'#336'},headUrl:x=>x,bustUrl:x=>x});return {field,target};}
type Internals={world:CanvasProbe;wg:CanvasProbe['context'];bg:HTMLCanvasElement;bgKey:string;draw:()=>void;};
beforeEach(()=>{
 vi.stubGlobal('document',{hidden:false,createElement:()=>canvas(),addEventListener:vi.fn(),removeEventListener:vi.fn()});
 vi.stubGlobal('Image',ImageProbe);vi.stubGlobal('requestAnimationFrame',vi.fn(()=>1));vi.stubGlobal('cancelAnimationFrame',vi.fn());
});
afterEach(()=>vi.unstubAllGlobals());
describe('戦場の解像度と安定性',()=>{
 for(const dpr of [1,2,2.625,3])it(`DPR ${dpr} で中間画面も最終画面と同じ解像度を保持する`,()=>{
  const {field,target}=renderer();field.resize(390,420,dpr);const internals=field as unknown as Internals;
  expect(target.width).toBe(Math.round(390*dpr));expect(target.height).toBe(Math.round(420*dpr));
  expect(internals.world.width).toBe(target.width);expect(internals.world.height).toBe(target.height);
  internals.bg=canvas();internals.bgKey='390x420field';internals.draw();
  expect(internals.wg.setTransform).toHaveBeenCalledWith(dpr,0,0,dpr,0,0);
  const output=(target.getContext('2d') as unknown as CanvasProbe['context']).drawImage;
  expect(output).toHaveBeenCalledWith(internals.world,0,0);field.destroy();
 });
 it('同じサイズのResizeObserver通知でキャンバスを消去しない',()=>{
  const {field,target}=renderer();field.resize(390,420,3);
  let resets=0,w=target.width,h=target.height;
  Object.defineProperties(target,{width:{get:()=>w,set:v=>{resets++;w=v;}},height:{get:()=>h,set:v=>{resets++;h=v;}}});
  field.resize(390,420,3);expect(resets).toBe(0);
  field.resize(844,290,2);expect(resets).toBe(2);field.destroy();
 });
 it('元の256pxセルを保ったまま80pxの武将と40pxの兵を描く',()=>{
  const {field}=renderer();field.resize(390,420,3);
  const c=newCampaign(35),b=createBattle(beginBattle(c,'hunt','01',[{gen:'g_saku',row:0,slot:0}],35));field.setBattle(b,'field');
  const internals=field as unknown as Internals;internals.bg=canvas();internals.bgKey='390x420field';internals.draw();
  const draws=internals.wg.drawImage.mock.calls as unknown[][];
  expect(draws.some(a=>(a[0] as CanvasProbe)?.width===256&&a[3]===80&&a[4]===80)).toBe(true);
  expect(draws.some(a=>(a[0] as CanvasProbe)?.width===256&&a[3]===40&&a[4]===40)).toBe(true);field.destroy();
 });
});

describe('v5.1 兵種演出と待機の解放',()=>{
 it('全11兵種の動作型と全技の個別プロフィールを持つ',()=>{expect(new Set(Object.values(STYLES)).size).toBe(11);expect(Object.keys(TECHNIQUES).sort()).toEqual(Object.keys(SKILL_TABLE).sort());for(const kind of Object.keys(STYLES) as Kind[]){const p=presentation('b_atk',kind,'melee');const fx=new TechniqueFx(p.style,[10,40],[100,60],p.color,400,p.motif,true,false);expect(()=>fx.draw(new CanvasProbe().context as unknown as CanvasRenderingContext2D)).not.toThrow();expect(fx.update(401)).toBe(false);}expect(motionAt('ninja',.5).lift).toBeLessThan(motionAt('spear',.5).lift);});
 it('2,000連続描画イベントでもエフェクト上限と寿命を守る',()=>{const {field}=renderer();field.resize(390,420,3);const internals=field as unknown as {addFx:(...x:TechniqueFx[])=>void;update:(dt:number)=>void};let max=0;for(let i=0;i<2000;i++){internals.addFx(new TechniqueFx('gun',[0,0],[100,100],'#fc8',350,i%5,true,false));internals.update(16);max=Math.max(max,field.activeEffectCost);}expect(max).toBeLessThanOrEqual(160);field.reduced=true;internals.update(16);expect(field.activeEffectCost).toBeLessThanOrEqual(40);internals.update(1000);expect(field.activeEffectCost).toBe(0);field.destroy();});
 it('PCでは320まで許容し、速度なしへの切替で即時解放',()=>{const {field}=renderer();field.resize(1100,500,1);const internals=field as unknown as {addFx:(x:TechniqueFx)=>void};for(let i=0;i<50;i++)internals.addFx(new TechniqueFx('sigil',[0,0],[80,80],'#acf',900,0,true,false));expect(field.activeEffectCost).toBeGreaterThan(160);expect(field.activeEffectCost).toBeLessThanOrEqual(320);field.speed=0;expect(field.activeEffectCost).toBe(0);field.destroy();});
 it('画面破棄・非表示・演出なしで未完了の待機を解放する',async()=>{vi.useFakeTimers();vi.stubGlobal('window',globalThis);for(const mode of ['destroy','hidden','none']){const {field}=renderer();const pending=field.wait(5000);if(mode==='destroy')field.destroy();if(mode==='hidden'){(document as unknown as {hidden:boolean}).hidden=true;(field as unknown as {onVisibility:()=>void}).onVisibility();}if(mode==='none')field.speed=0;await pending;expect((field as unknown as {pending:Set<unknown>}).pending.size).toBe(0);field.destroy();(document as unknown as {hidden:boolean}).hidden=false;}vi.useRealTimers();});
});

describe('v5.1 連続イベントの反映',()=>{it('演出なしでも2,000イベントを一度ずつ適用して待機・効果を残さない',async()=>{const {field}=renderer();field.speed=0;const c=newCampaign(54),b=createBattle(beginBattle(c,'hunt','01',[{gen:'g_saku',row:0,slot:0}],54));field.setBattle(b,'field');const a=b.units.find(u=>u.side==='L')!,t=b.units.find(u=>u.side==='R')!;const cycle:BEvent[]=[{k:'skill',uid:a.uid,skill:'b_atk',name:'斬撃',color:'#fc8',range:'near',anim:'melee',special:false,targets:[t.uid]},{k:'hit',uid:t.uid,from:a.uid,n:1},{k:'counter',uid:a.uid,from:t.uid,n:1},{k:'cancel',uid:t.uid},{k:'down',uid:t.uid}];const events=Array.from({length:2000},(_,i)=>cycle[i%cycle.length]);const apply=vi.fn();await playEvents(field,events,{apply,se:vi.fn(),unit:id=>b.units.find(u=>u.uid===id)??null},()=>true);expect(apply).toHaveBeenCalledTimes(2000);expect(field.activeEffectCost).toBe(0);expect((field as unknown as {pending:Set<unknown>;floats:unknown[]}).pending.size).toBe(0);expect((field as unknown as {floats:unknown[]}).floats).toHaveLength(0);field.destroy();});});
