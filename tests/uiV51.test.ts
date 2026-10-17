import {describe,it,expect} from 'vitest';
import {newCampaign,doCommand,commandKey,endTurn} from '../src/campaign/campaign';
import {migrateWarProgress} from '../src/campaign/warProgress';
import {deserializeCampaign,loadSettings} from '../src/engine/save';
import {relationLabel,regionAction,reserve} from '../src/campaign/actionGuide';
import {strategy,markUsed} from '../src/campaign/strategy';
describe('v5.1 開戦準備と保存互換',()=>{
 it('同じ勢力の別の国を選んでも知略を引き継ぐ',()=>{const c=newCampaign(1);const first=doCommand(c,'war','03',['g_chikage']);expect(first.done).toBe(false);c.scenes=[];endTurn(c);const second=doCommand(c,'war','04',['g_chikage']);expect(second.points).toBe(first.points*2);expect(commandKey('war','03',c)).toBe(commandKey('war','04',c));expect(relationLabel(c,'04')).toBe('開戦準備中');});
 it('旧進捗を一度だけ合算し、元値も保存する',()=>{const c=newCampaign(2);delete c.flags.warProgressFaction;c.progress={'war:03':120,'war:04':170,'war:01':50,'build:01':90};migrateWarProgress(c);expect(c.progress['war:faction:kurogane']).toBe(290);expect(c.progress['war:03']).toBe(120);expect(c.progress['war:01']).toBe(50);migrateWarProgress(c);expect(c.progress['war:faction:kurogane']).toBe(290);const copy=deserializeCampaign(JSON.stringify(c))!;expect(copy.progress).toEqual(c.progress);});
 it('必要値を超える旧進捗でも読み込みだけで開戦しない',()=>{const c=newCampaign(3);delete c.flags.warProgressFaction;c.progress={'war:03':350,'war:04':150};const copy=deserializeCampaign(JSON.stringify(c))!;expect(copy.progress['war:faction:kurogane']).toBe(500);expect(copy.factions.kurogane.war).toBe(false);expect(copy.fans).toBe(2);});
 it('交戦済みの旧進捗を追加反映しない',()=>{const c=newCampaign(4);delete c.flags.warProgressFaction;c.factions.kurogane.war=true;c.progress['war:03']=100;migrateWarProgress(c);expect(c.progress['war:03']).toBe(100);expect(c.progress['war:faction:kurogane']).toBeUndefined();});
 it('宣戦布告は一度だけ行動・武将を使う',()=>{const c=newCampaign(5);c.progress[commandKey('war','03',c)]=399;expect(doCommand(c,'war','03',['g_chikage']).done).toBe(true);expect(c.fans).toBe(1);expect(()=>doCommand(c,'war','04',['g_chikage'])).toThrow();expect(c.fans).toBe(1);expect(reserve(c).count).toBe(3);});
 it('旧設定へ演出量とガイドの既定値を補う',()=>{const s=loadSettings({getItem:()=>JSON.stringify({anim:1,bgm:.3}),setItem(){},removeItem(){}});expect(s.effects).toBe('standard');expect(s.guideSeen).toBe(false);expect(s.anim).toBe(1);});
});
describe('v5.1 地図の操作判定',()=>{
 it('同盟・従属を不戦と表示しない',()=>{const c=newCampaign(6);strategy(c).relations.kurogane='alliance';expect(relationLabel(c,'03')).toBe('同盟');expect(regionAction(c,'03').mode).toBe('friend');strategy(c).relations.kurogane='vassal';expect(relationLabel(c,'03')).toBe('従属');});
 it('隣接・行動不足・人員不足の理由を表示する',()=>{const c=newCampaign(7);expect(regionAction(c,'02').mode).toBe('remote');c.fans=0;expect(regionAction(c,'03').reason).toContain('行動');c.fans=2;markUsed(c,Object.keys(c.gens));expect(regionAction(c,'03').reason).toContain('武将');expect(regionAction(c,'01').reason).toContain('武将');});
 it('実行予定の武将を除いた防衛兵力を計算する',()=>{const c=newCampaign(8);const all=reserve(c);const after=reserve(c,['g_chikage']);expect(after.count).toBe(all.count-1);expect(after.troops).toBe(all.troops-c.gens.g_chikage.troops);});
});
