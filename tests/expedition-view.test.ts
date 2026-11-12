import {test} from 'node:test';
import assert from 'node:assert/strict';
import {expeditionPanel} from '../src/expedition-view';
import {GameEconomy} from '../src/economy';
// Minimal DOM port for callback lifetime checks; not a browser/layout acceptance test.
class Element {
 children:Element[]=[];parent?:Element;className='';textContent='';disabled=false;onclick?:()=>unknown;attributes=new Map<string,string>();
 constructor(public tag:string,private attached=false){}
 get isConnected():boolean{return this.attached||!!this.parent?.isConnected;}
 append(...items:Element[]){for(const item of items){item.parent=this;this.children.push(item);}}
 replaceChildren(){for(const child of this.children)child.parent=undefined;this.children=[];}
 setAttribute(k:string,v:string){this.attributes.set(k,v);}
 querySelectorAll(selector:string):Element[]{return this.children.flatMap(c=>[...(selector==='button'?c.tag==='button':c.attributes.get('role')==='status')?[c]:[],...c.querySelectorAll(selector)]);}
 querySelector(selector:string){return this.querySelectorAll(selector)[0];}
}
function setup(){
 const data=new Map<string,string>();const store=new GameEconomy({getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);}});store.newExpedition();
 store.data.expedition!.resources.fuel=100;
 const root=new Element('root',true);let resolve!:(value:boolean)=>void;let calls=0;const rankings:string[]=[];
 const old=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:(tag:string)=>new Element(tag)}});
 expeditionPanel(root as unknown as HTMLElement,store,{launch:()=>{},back:()=>{},changed:()=>{},ranking:kind=>rankings.push(kind),adAvailable:true,adLabel:'观看广告',ad:{show:()=>{calls++;return new Promise<boolean>(r=>{resolve=r;});}}});
 return {root,store,rankings,resolve:(value:boolean)=>resolve(value),calls:()=>calls,restore:()=>{if(old)Object.defineProperty(globalThis,'document',old);else Reflect.deleteProperty(globalThis,'document');}};
}
function click(root:Element,label:string){const b=root.querySelectorAll('button').find(b=>b.textContent===label);assert.ok(b,label);assert.equal(b.disabled,false);b.onclick!();}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('first refit cancellation spends nothing and does not open an ad; gold confirmation charges only once',()=>{
 const f=setup();try{
  f.store.data.coins=1000;
  click(f.root,'资源整备 ›');click(f.root,'观看广告 · 全面整备');
  assert.equal(f.calls(),0);click(f.root,'保留纯净资格，返回整备');
  const gold=f.root.querySelectorAll('button').find(b=>b.textContent.startsWith('加满燃料'))!;
  const cost=Number(gold.textContent.match(/· (\d+) 金币/)![1]);
  click(f.root,gold.textContent);assert.equal(f.store.data.coins,1000);assert.equal(f.store.data.expedition!.pure,true);
  const confirm=f.root.querySelectorAll('button').find(b=>b.textContent==='确认使用金币整备')!;
  confirm.onclick!();confirm.onclick!();
  assert.equal(f.store.data.coins,1000-cost);assert.equal(f.store.data.expedition!.services.fuel,1);assert.equal(f.store.data.expedition!.pure,false);
 }finally{f.restore();}
});
test('already assisted refit skips pure confirmation, while stale confirmation cannot start an ad',async()=>{
 const f=setup();try{
  click(f.root,'资源整备 ›');click(f.root,'观看广告 · 全面整备');
  f.store.data.expedition!.attempt++;
  click(f.root,'确认并观看广告');await flush();assert.equal(f.calls(),0);assert.equal(f.store.data.expedition!.pure,true);
  click(f.root,'保留纯净资格，返回整备');f.store.data.expedition!.pure=false;
  click(f.root,'观看广告 · 全面整备');assert.equal(f.calls(),1);f.resolve(false);await flush();
 }finally{f.restore();}
});
test('refit ad keeps page alive, blocks duplicate actions and durably grants once',async()=>{
 const f=setup();try{
  assert.ok(!f.root.querySelectorAll('button').some(b=>b.textContent.startsWith('加满燃料')));
  click(f.root,'资源整备 ›');click(f.root,'观看广告 · 全面整备');click(f.root,'确认并观看广告');
  assert.ok(f.root.querySelectorAll('button').every(b=>b.disabled));assert.equal(f.calls(),1);
  f.resolve(true);await flush();assert.equal(f.store.data.expedition!.resources.fuel,240);assert.equal(f.store.data.expedition!.services.ad,1);assert.equal(f.store.data.expedition!.pure,false);
  click(f.root,'‹ 返回远征');click(f.root,'记录与规则 ›');click(f.root,'结束并结算本次远征 ›');
  assert.equal(f.store.data.expedition!.ended,false);click(f.root,'暂不结束，返回远征');assert.equal(f.store.data.expedition!.ended,false);
 }finally{f.restore();}
});
test('cancelled ad leaves resources and pure eligibility intact and unlocks navigation',async()=>{
 const f=setup();try{click(f.root,'资源整备 ›');click(f.root,'观看广告 · 全面整备');click(f.root,'确认并观看广告');f.resolve(false);await flush();assert.equal(f.store.data.expedition!.resources.fuel,100);assert.equal(f.store.data.expedition!.pure,true);click(f.root,'‹ 返回远征');}finally{f.restore();}
});
test('ad completion after panel removal does not grant refit',async()=>{
 const f=setup();try{click(f.root,'资源整备 ›');click(f.root,'观看广告 · 全面整备');click(f.root,'确认并观看广告');f.root.replaceChildren();f.resolve(true);await flush();assert.equal(f.store.data.expedition!.resources.fuel,100);assert.equal(f.store.data.expedition!.services.ad,0);}finally{f.restore();}
});

test('expedition ranking shortcut only appears after settlement and selects the appropriate board',()=>{
 const f=setup();try{
  assert.ok(!f.root.querySelectorAll('button').some(b=>b.textContent.includes('排名')||b.textContent.includes('排行榜')));
  click(f.root,'记录与规则 ›');click(f.root,'结束并结算本次远征 ›');click(f.root,'确认结束并结算');
  click(f.root,'查看排名');assert.deepEqual(f.rankings,['overall']);
  // UI routing fixture only: scoring eligibility itself is covered by economy/board tests.
  f.store.data.expedition!.completed=30;f.store.data.expedition!.pure=true;
  click(f.root,'记录与规则 ›');click(f.root,'‹ 返回远征');click(f.root,'查看排名');assert.deepEqual(f.rankings,['overall','pure']);
 }finally{f.restore();}
});
