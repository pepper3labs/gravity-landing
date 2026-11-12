import {test} from 'node:test';import assert from 'node:assert/strict';
import {leaderboardPanel,type RankingSource} from '../src/leaderboard-view';
import type {RankingPage} from '../src/leaderboard-reader';
class Node {
 children:Node[]=[];parent?:Node;className='';textContent='';hidden=false;disabled=false;scrollTop=0;onclick?:()=>void;
 constructor(public tag:string,private attached=false){}
 get isConnected():boolean{return this.attached||!!this.parent?.isConnected;}
 append(...nodes:Node[]){for(const n of nodes){n.parent=this;this.children.push(n);}}
 replaceChildren(){for(const n of this.children)n.parent=undefined;this.children=[];}
 setAttribute(){}
 focus(){}
 all():Node[]{return this.children.flatMap(n=>[n,...n.all()]);}
}
const flush=()=>new Promise(r=>setImmediate(r));
test('tab switching ignores late responses, pagination retries in place and names remain text',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:(tag:string)=>new Node(tag)}});
 try{
  const root=new Node('root',true);let late!:(p:RankingPage)=>void,fail=true,submits=0;
  const row={rank:1,name:'<img onerror=alert(1)>',result:'30/30'};
  const source=(title:string,list:RankingSource['list']):RankingSource=>({title,rule:'rule',local:()=>title+' 本机',list});
  const overall=source('综合',()=>new Promise(r=>{late=r;}));overall.submit=async()=>{submits++;};overall.canSubmit=()=>true;
  leaderboardPanel(root as unknown as HTMLElement,{overall,pure:source('纯净',async cursor=>{if(cursor&&fail){fail=false;throw Error('offline');}return {rows:[row],next:cursor?undefined:'next',mineNotice:'无线上成绩'};}),daily:source('每日',async()=>({rows:[],mineNotice:'无线上成绩'}))},'overall',()=>{});
  const click=(label:string)=>{const b=root.all().find(n=>n.tag==='button'&&n.textContent===label);assert.ok(b,label);assert.equal(b.disabled,false);b.onclick!();};
  click('纯净');await flush();late({rows:[{...row,name:'stale'}],mineNotice:''});await flush();assert.ok(!root.all().some(n=>n.textContent==='stale'));assert.equal(submits,0);
  assert.ok(root.all().some(n=>n.tag==='b'&&n.textContent===row.name));click('加载更多');await flush();assert.ok(root.all().some(n=>n.textContent==='offline'));click('加载更多');await flush();assert.equal(root.all().filter(n=>n.tag==='li').length,2);
  click('每日');await flush();assert.ok(root.all().some(n=>n.textContent==='当前榜单暂无成绩。'));
 }finally{if(old)Object.defineProperty(globalThis,'document',old);else Reflect.deleteProperty(globalThis,'document');}
});
