import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameEconomy,rankScore,type BoardKind} from '../src/economy';
import {ExpeditionSubmission} from '../src/expedition-submission';
import {OnlineParticipation} from '../src/online-participation';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup(complete=30){
 const data=new Map<string,string>(),storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
 const store=new GameEconomy(storage);store.newExpedition();
 // Settlement fixture; inherited flight physics is covered by continuous-expedition replay tests.
 store.data.expedition!.completed=complete;store.data.expedition!.ticks=7200;
 const calls:BoardKind[]=[];
 const flow=new ExpeditionSubmission(store,{submit:async(kind,e)=>{calls.push(kind);return rankScore(e,kind);}},'boards-v1',storage);
 return {store,storage,calls,flow};
}
test('daily legacy consent is preserved and expedition yes/no persist independently',()=>{
 const f=setup();const daily=new OnlineParticipation('daily',async()=>{},f.storage);daily.choose(true);
 assert.equal(f.flow.preference.choice,'unset');f.flow.preference.choose(false);
 assert.equal(new OnlineParticipation('daily',async()=>{},f.storage).choice,'yes');
 assert.equal(new ExpeditionSubmission(f.store,{submit:async()=>0},'boards-v1',f.storage).preference.choice,'no');
 assert.equal(new ExpeditionSubmission(f.store,{submit:async()=>0},'other-boards',f.storage).preference.choice,'unset');
});
test('no consent, active runs, invalid and zero progress never auto-submit',async()=>{
 const f=setup();f.flow.settled();f.store.end();f.flow.settled();await flush();assert.deepEqual(f.calls,[]);
 const g=setup();g.flow.preference.choose(true);g.flow.settled();await flush();assert.deepEqual(g.calls,[]);
 for(const invalid of [false,true]){const h=setup(invalid?3:0);h.flow.preference.choose(true);if(invalid)h.store.data.expedition!.eligible=false;h.store.end();h.flow.settled();await flush();assert.deepEqual(h.calls,[]);}
});
test('pure 30/30 submits serially to both boards once; receipts survive reload',async()=>{
 const f=setup();let release!:(n:number)=>void;let score=0;
 const flow=new ExpeditionSubmission(f.store,{submit:(kind,e)=>{f.calls.push(kind);score=rankScore(e,kind);return new Promise(r=>{release=r;});}},'boards-v1',f.storage);
 flow.preference.choose(true);f.store.end();flow.settled();flow.settled();await flush();assert.deepEqual(f.calls,['overall']);
 release(score);await flush();assert.deepEqual(f.calls,['overall','pure']);release(score);await flush();
 assert.equal(f.store.data.submitted.overall,f.store.data.expedition!.id);assert.equal(f.store.data.submitted.pure,f.store.data.expedition!.id);
 const loaded=new GameEconomy(f.storage);const next=new ExpeditionSubmission(loaded,{submit:async(k,e)=>{f.calls.push(k);return rankScore(e,k);}},'boards-v1',f.storage);next.settled();await flush();assert.equal(f.calls.length,2);
});
test('partial settled expedition only enters overall; failed request needs explicit retry',async()=>{
 const f=setup(3);let count=0;
 const flow=new ExpeditionSubmission(f.store,{submit:async(k,e)=>{f.calls.push(k);if(++count===1)throw Error('offline');return rankScore(e,k);}},'boards-v1',f.storage);
 flow.preference.choose(true);f.store.end();flow.settled();await flush();assert.match(flow.status('overall'),/未成功/);flow.settled();await flush();assert.equal(count,1);
 await flow.send('overall');assert.equal(count,2);assert.equal(f.store.data.submitted.pure,undefined);assert.match(flow.status('overall'),/确认/);
});
test('opting in after a declined settlement does not retroactively auto-submit it',async()=>{
 const f=setup(3);f.flow.preference.choose(false);f.store.end();f.flow.settled();
 f.flow.preference.choose(true);f.flow.settled();await flush();assert.equal(f.calls.length,0);
 await f.flow.send('overall');assert.deepEqual(f.calls,['overall']);
});
test('withdrawing cancels queued pure request while acknowledging already-issued overall',async()=>{
 const f=setup();let release!:(score:number)=>void,score=0;
 const flow=new ExpeditionSubmission(f.store,{submit:(kind,e)=>{f.calls.push(kind);score=rankScore(e,kind);return new Promise(r=>{release=r;});}},'boards-v1',f.storage);
 flow.preference.choose(true);f.store.end();flow.settled();await flush();flow.preference.choose(false);release(score);await flush();assert.deepEqual(f.calls,['overall']);assert.equal(f.store.data.submitted.pure,undefined);
});
test('late receipt cannot acknowledge newer best; assisted full run only enters overall',async()=>{
 const f=setup(3);let release!:(n:number)=>void,score=0;
 const flow=new ExpeditionSubmission(f.store,{submit:async(kind,e)=>{f.calls.push(kind);score=rankScore(e,kind);return new Promise(r=>{release=r;});}},'boards-v1',f.storage);
 flow.preference.choose(true);f.store.end();flow.settled();await flush();
 f.store.newExpedition();f.store.data.expedition!.completed=30;f.store.data.expedition!.ticks=8000;f.store.data.expedition!.pure=false;f.store.data.expedition!.services.ad=1;f.store.end();flow.settled();release(score);await flush();assert.equal(f.store.data.submitted.overall,undefined);assert.deepEqual(f.calls,['overall','overall']);release(score);await flush();assert.equal(f.store.data.submitted.overall,f.store.data.expedition!.id);assert.equal(f.store.data.best.pure,undefined);
});
