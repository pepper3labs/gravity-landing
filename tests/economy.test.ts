import {test} from 'node:test';import assert from 'node:assert/strict';
import {GameEconomy,ECONOMY_KEY,JOURNAL_KEY,rankScore,decodeScore,MAX_RANK_TICKS} from '../src/economy';
import {ECONOMY,EXPEDITION_CONFIG,EXPEDITION_CAPACITY} from '../src/economy-config';
import {LEVELS} from '../src/levels';import {Flight,CONFIG} from '../src/physics';import {flyRoute} from '../src/replay';import {scoreTaskFlight} from '../src/star-tasks';
const memory=()=>{const data=new Map<string,string>();return {data,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};};
const base=scoreTaskFlight(flyRoute(LEVELS[0]).flight,LEVELS[0]);
const score=(stars:number,assisted=false)=>({...base,stars,score:stars*1000,assisted});
test('all 30 economic configurations satisfy zero-wallet one-star ad or two-repeat unlock paths',()=>{
 for(const l of LEVELS){const c=ECONOMY[l.id];assert.ok(c.awards[1]*2>=c.unlock,l.id);assert.ok(c.awards[1]+2*c.repeat>=c.unlock,l.id);assert.ok(c.repeat<c.awards[1]);assert.ok(c.awards[3]>c.awards[2]);}
 for(const stars of [1,2,3]){const s=new GameEconomy(memory());for(const l of LEVELS){
  const id=s.beginCampaign(l.id);const r=s.claim(id,score(stars));assert.equal(r.first,ECONOMY[l.id].awards[stars]);const balance=s.data.coins;s.claim(id,score(stars));assert.equal(s.data.coins,balance);
  const next=LEVELS[l.order];if(next&&!s.unlocked(next.id)){while(s.data.coins<ECONOMY[l.id].unlock)s.claim(s.beginCampaign(l.id),score(1));s.unlock(next.id);}if(next)assert.ok(s.unlocked(next.id));
 }}
});
test('shared first reward, deltas, duplicate ad receipts and migration are durable',()=>{
 const m=memory(),s=new GameEconomy(m),l=LEVELS[0];let id=s.beginCampaign(l.id);s.claim(id,score(1));s.double(id);s.double(id);assert.equal(s.data.coins,ECONOMY[l.id].awards[1]*2);
 id=s.beginCampaign(l.id);const r=s.claim(id,score(2,true));assert.equal(r.first,70);assert.equal(r.repeat,0);
 const restored=new GameEconomy(m);assert.equal(restored.data.coins,s.data.coins);assert.equal(restored.claim(id,score(2)).amount,70);restored.double(id);const coins=restored.data.coins;new GameEconomy(m).double(id);assert.equal(new GameEconomy(m).data.coins,coins);
 const old=memory();old.setItem('gravity-coins','123');old.setItem('gravity-campaign',JSON.stringify(s.data.campaign));const migrated=new GameEconomy(old);assert.equal(migrated.data.coins,123);assert.ok(migrated.unlocked(LEVELS[1].id));const raised=migrated.claim(migrated.beginCampaign(l.id),score(3));assert.equal(raised.first,70);assert.equal(new GameEconomy(old).data.coins,193);
});
test('failed writes and stale tabs never debit without unlock or grant a stale settlement',()=>{
 const m=memory(),s=new GameEconomy(m);s.claim(s.beginCampaign(LEVELS[1].id),score(1));s.claim(s.beginCampaign(LEVELS[2].id),score(1));
 const other=new GameEconomy(m),before=s.data.coins;m.setItem=(k,v)=>{if(k===ECONOMY_KEY)throw Error('full');m.data.set(k,v);};
 assert.throws(()=>s.unlock(LEVELS[3].id));assert.equal(s.data.coins,before);assert.equal(s.unlocked(LEVELS[3].id),false);
 m.setItem=(k,v)=>{m.data.set(k,v);};s.unlock(LEVELS[3].id);assert.throws(()=>other.beginCampaign(LEVELS[0].id),/另一个/);
 assert.throws(()=>s.claim('old-flight',score(3)));assert.throws(()=>s.unlock(LEVELS[9].id),/上一关/);
});
function step(s:GameEconomy,f:Flight,thrust=true){const before={time:f.elapsed,fuel:f.fuel,health:f.legs.map(l=>l.health)};f.step(thrust,0);s.sample(before,f);}
test('only unlaunched expeditions can save and resume; flight exit settles without resetting totals',()=>{
 const m=memory(),s=new GameEconomy(m);s.newExpedition();const f=new Flight();s.prepareFlight(f);s.reserve(2,f);s.park();
 let resumed=new GameEconomy(m);assert.equal(resumed.data.expedition!.phase,'station');assert.equal(resumed.data.expedition!.ticks,0);assert.equal(resumed.data.expedition!.eligible,true);
 resumed.prepareFlight(f);resumed=new GameEconomy(m);assert.equal(resumed.data.expedition!.phase,'station');resumed.prepareFlight(f);
 for(let i=0;i<120;i++)step(resumed,f);resumed.flush();const ticks=resumed.data.expedition!.ticks,used=resumed.data.expedition!.fuelUsed;resumed.park();
 resumed=new GameEconomy(m);assert.equal(resumed.data.expedition!.ended,true);assert.equal(resumed.data.expedition!.ticks,ticks);assert.equal(resumed.data.expedition!.fuelUsed,used);assert.throws(()=>resumed.prepareFlight(f));
});
test('death settles partial score once; no retry or maintenance can revive it',()=>{
 const m=memory(),s=new GameEconomy(m);s.newExpedition();const f=new Flight();s.prepareFlight(f);
 for(const input of flyRoute(LEVELS[0],true).report.inputs){const b={time:f.elapsed,fuel:f.fuel,health:f.legs.map(l=>l.health)};f.step(input.thrust,input.turn);s.sample(b,f);}s.land(f);s.prepareFlight(f);
 step(s,f);f.state='failed';const ticks=s.data.expedition!.ticks,used=s.data.expedition!.fuelUsed;s.fail(f);s.fail(f);
 const e=s.data.expedition!;assert.equal(e.ended,true);assert.equal(e.completed,1);assert.equal(e.ticks,ticks);assert.equal(e.fuelUsed,used);assert.equal(s.data.best.overall!.id,e.id);assert.equal(s.data.best.pure,undefined);
 assert.throws(()=>s.prepareFlight(f));assert.throws(()=>s.maintain('ad',e.id+':1:'+e.attempt));assert.equal(new GameEconomy(m).data.expedition!.ended,true);
 s.newExpedition();assert.equal(s.data.expedition!.completed,0);
});
test('abnormal flying reload and legacy retry saves settle unranked instead of restoring launch resources',()=>{
 for(const legacy of [false,true]){const m=memory(),s=new GameEconomy(m);s.newExpedition();const f=new Flight();s.prepareFlight(f);step(s,f);s.flush();
 if(legacy){const d=JSON.parse(m.getItem(ECONOMY_KEY)!);d.expedition.phase='retry';d.expedition.ticks=1;m.setItem(ECONOMY_KEY,JSON.stringify(d));m.data.delete(JOURNAL_KEY);}
 const restored=new GameEconomy(m);assert.equal(restored.data.expedition!.ended,true);assert.equal(restored.data.expedition!.eligible,false);assert.ok(restored.data.expedition!.ticks>=1);assert.throws(()=>restored.prepareFlight(f));}
});
test('supplies, maintenance and ended expedition cannot be duplicated; expedition never grants campaign coins',()=>{
 const m=memory(),s=new GameEconomy(m);s.data.coins=1000;s.newExpedition();let f=new Flight();s.prepareFlight(f);const flown=flyRoute(LEVELS[0],true);for(const input of flown.report.inputs){const b={time:f.elapsed,fuel:f.fuel,health:f.legs.map(l=>l.health)};f.step(input.thrust,input.turn);s.sample(b,f);}
 f.legs[0]={health:0,broken:true,compression:0};const coins=s.data.coins;s.land(f);const e=s.data.expedition!;assert.equal(e.resources.legs[0].broken,true);const fuel=e.resources.fuel;assert.throws(()=>s.land(f));assert.equal(s.data.expedition!.resources.fuel,fuel);
 const token=e.id+':'+e.completed+':'+e.attempt;s.maintain('repair',token);assert.equal(s.data.expedition!.resources.legs[0].broken,false);const after=s.data.coins;assert.ok(after<coins);assert.throws(()=>s.maintain('repair',token));assert.equal(s.data.coins,after);assert.equal(s.data.expedition!.pure,false);
 s.end();assert.throws(()=>s.prepareFlight(f));assert.throws(()=>rankScore(s.data.expedition!,'pure'));assert.ok(rankScore(s.data.expedition!,'overall'));assert.deepEqual(s.data.claimed,Object.fromEntries(LEVELS.map(l=>[l.id,0])));
});
test('integer ranking preserves all progress boundaries and independent bests',()=>{
 for(let n=1;n<=30;n++)for(const ticks of [n*120,MAX_RANK_TICKS]){const score=n*(MAX_RANK_TICKS+1)+MAX_RANK_TICKS-ticks;assert.deepEqual(decodeScore(score,'overall'),{completed:n,ticks});if(n<30)assert.ok(score<(n+1)*(MAX_RANK_TICKS+1));}
 assert.throws(()=>decodeScore(1,'overall'));assert.throws(()=>decodeScore(NaN,'pure'));
});
test('corrupt core or journal preserves original bytes and allows only unranked recovery',()=>{
 const m=memory(),s=new GameEconomy(m);s.newExpedition();s.prepareFlight(new Flight());m.setItem(JOURNAL_KEY,'corrupt');const recovered=new GameEconomy(m);assert.equal(recovered.data.expedition!.eligible,false);assert.equal(m.getItem(JOURNAL_KEY),'corrupt');recovered.prepareFlight(new Flight());assert.equal(recovered.data.expedition!.eligible,false);
});
test('write-ahead interruption retains conservative totals and disqualifies ranking; clean flush stores exact totals',()=>{
 const m=memory(),s=new GameEconomy(m);s.newExpedition();const f=new Flight();s.prepareFlight(f);s.reserve(2,f,true);step(s,f);
 const interrupted=new GameEconomy(m);assert.equal(interrupted.data.expedition!.ticks,2);assert.ok(interrupted.data.expedition!.fuelUsed>=s.data.expedition!.fuelUsed);assert.equal(interrupted.data.expedition!.eligible,false);assert.match(interrupted.data.expedition!.reason,/保守补计/);
 const n=memory(),clean=new GameEconomy(n);clean.newExpedition();clean.prepareFlight(f);clean.reserve(2,f,true);step(clean,f);clean.flush();clean.park();const restored=new GameEconomy(n);assert.equal(restored.data.expedition!.ticks,1);assert.equal(restored.data.expedition!.eligible,true);
});
test('ended bests are independent, ties retain earlier result and refitted runs cannot replace pure best',()=>{
 const s=new GameEconomy(memory());s.newExpedition();let e=s.data.expedition!;e.completed=30;e.ticks=500000;s.end();const pure=s.data.best.pure!.id,overall=s.data.best.overall!.id;
 s.newExpedition();e=s.data.expedition!;e.completed=30;e.ticks=400000;e.pure=false;e.services.ad=1;s.end();assert.equal(s.data.best.pure!.id,pure);assert.notEqual(s.data.best.overall!.id,overall);
 const saved=s.data.best.overall!.id;s.newExpedition();e=s.data.expedition!;e.completed=30;e.ticks=400000;e.pure=false;e.services.full=1;s.end();assert.equal(s.data.best.overall!.id,saved);
 s.newExpedition();e=s.data.expedition!;e.completed=29;e.ticks=300000;s.end();assert.equal(s.data.best.pure!.id,pure);assert.equal(s.data.best.overall!.id,saved);
});
test('legacy explicit unlocked floor survives missing stars without issuing historical compensation',()=>{
 const m=memory();m.setItem('gravity-coins','70');m.setItem('gravity-campaign',JSON.stringify({version:1,catalogRevision:2,unlockedFloor:1,highestUnlocked:12,levels:{[LEVELS[0].id]:{completed:true}}}));const s=new GameEconomy(m);assert.ok(s.unlocked(LEVELS[11].id));assert.equal(s.data.claimed[LEVELS[0].id],3);assert.equal(s.data.coins,70);assert.equal(new GameEconomy(m).data.coins,70);
});
test('failed maintenance commit leaves wallet and resources unchanged; insufficient funds cannot go negative',()=>{
 const m=memory(),s=new GameEconomy(m);s.newExpedition();s.data.expedition!.resources.fuel=10;let e=s.data.expedition!,token=e.id+':0:0';assert.throws(()=>s.maintain('full',token),/不足/);assert.equal(s.data.coins,0);
 s.data.coins=1000;m.setItem=()=>{throw Error('quota');};assert.throws(()=>s.maintain('full',token));assert.equal(s.data.coins,1000);assert.equal(s.data.expedition!.resources.fuel,10);assert.equal(s.data.expedition!.pure,true);
});
