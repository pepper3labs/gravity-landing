import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OnlineParticipation,ONLINE_CHOICE_KEY} from '../src/online-participation';
function memory(){const data=new Map<string,string>();return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};}
test('participation defaults off, persists consent and withdrawal, and is board scoped',async()=>{
 const store=memory();let calls=0;const send=async()=>{calls++;};
 const p=new OnlineParticipation('a',send,store),run=p.createRun('score');
 await p.send(run);assert.equal(calls,0);p.choose(true);
 assert.equal(new OnlineParticipation('a',send,store).choice,'yes');
 assert.equal(new OnlineParticipation('b',send,store).choice,'unset');
 p.choose(false);await p.send(run);assert.equal(calls,0);
 assert.equal(new OnlineParticipation('a',send,store).choice,'no');
 store.setItem(ONLINE_CHOICE_KEY,'broken');assert.equal(new OnlineParticipation('a',send,store).choice,'unset');
});
test('in-flight and successful runs are not submitted twice; newer runs stay independent',async()=>{
 let finish!:()=>void;const sent:string[]=[];
 const p=new OnlineParticipation('a',raw=>{sent.push(raw);return new Promise<void>(resolve=>{finish=resolve;});},memory());p.choose(true);
 const first=p.createRun('first'),next=p.createRun('next');
 const pending=p.send(first);assert.equal(p.send(first),pending);await Promise.resolve();
 assert.deepEqual(sent,['first']);assert.equal(first.state,'sending');
 finish();await pending;await p.send(first);assert.equal(first.state,'submitted');assert.equal(next.state,'idle');assert.equal(sent.length,1);
});
test('both synchronous and asynchronous errors allow explicit retry without background retry',async()=>{
 let calls=0;const p=new OnlineParticipation('a',()=>{calls++;if(calls===1)throw Error('sync');if(calls===2)return Promise.reject(Error('offline'));return Promise.resolve();},memory());
 p.choose(true);const run=p.createRun('score');await p.send(run);assert.equal(run.state,'failed');assert.equal(run.pending,undefined);
 await p.send(run);assert.equal(run.state,'failed');assert.equal(calls,2);
 await p.send(run);assert.equal(run.state,'submitted');assert.equal(calls,3);
});
test('withdrawal blocks new runs and retries without falsely cancelling an issued request',async()=>{
 let finish!:()=>void;let calls=0;const p=new OnlineParticipation('a',()=>{calls++;return new Promise<void>(resolve=>{finish=resolve;});},memory());
 p.choose(true);const run=p.createRun('old');const pending=p.send(run);await Promise.resolve();p.choose(false);
 await p.send(p.createRun('new'));finish();await pending;assert.equal(calls,1);assert.equal(run.state,'submitted');assert.equal(p.choice,'no');
});
test('silent storage failures are visible and consent is never inferred from malformed storage',()=>{
 const p=new OnlineParticipation('a',async()=>{},{getItem:()=>null,setItem:()=>{}});p.choose(true);assert.ok(p.warning);p.choose(false);assert.equal(p.choice,'no');assert.ok(p.warning);
 for(const raw of ['null','{}','{"version":2,"scope":"a","choice":"yes"}']){
  const store=memory();store.setItem(ONLINE_CHOICE_KEY,raw);assert.equal(new OnlineParticipation('a',async()=>{},store).choice,'unset');
 }
});

test('withdrawal before dispatch prevents sending an already queued daily run',async()=>{
 let calls=0;const p=new OnlineParticipation('a',async()=>{calls++;},memory());p.choose(true);
 const run=p.createRun('score'),pending=p.send(run);p.choose(false);await pending;
 assert.equal(calls,0);assert.equal(run.state,'idle');
});
