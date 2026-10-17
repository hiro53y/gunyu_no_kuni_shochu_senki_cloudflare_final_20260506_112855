import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {Field} from '../src/battle/view/field';
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
