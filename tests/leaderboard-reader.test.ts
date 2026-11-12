import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LeaderboardReader,rankingDuration} from '../src/leaderboard-reader';
import {MAX_RANK_TICKS} from '../src/economy';
const now=new Date('2026-10-23T06:00:00Z');
const start=Date.parse('2026-10-23T00:00:00+08:00')/1000,period=start+'-'+(start+86399);
test('internal boards decode both expeditions, daily scores and personal rank without opening platform UI',async()=>{
 const requests:any[]=[];
 const host={loadLeaderboardScores:(o:any)=>{requests.push(o);o.callback.onSuccess({scores:[{rank:2,score:o.leaderboardId==='daily'?1500:o.leaderboardId==='pure'?12000:3*(MAX_RANK_TICKS+1)+MAX_RANK_TICKS-6992,user:{name:'<pilot>'}}],leaderboard:{period:{periodToken:o.leaderboardId==='daily'?period:''}},isTruncated:true,nextContinuationToken:'page2'});},
 loadCurrentPlayerLeaderboardScore:(o:any)=>o.callback.onSuccess({currentUserScore:{rank:99,score:o.leaderboardId==='daily'?1200:12000,user:{name:'Me'}},leaderboard:{period:{periodToken:o.periodToken}}})};
 const reader=new LeaderboardReader(()=>host,()=>now,100,{pure:'pure',overall:'overall',daily:'daily'});
 const overall=await reader.list('overall');assert.match(overall.rows[0].result,/3\/30 · 00:00:58.27/);assert.equal(overall.rows[0].name,'<pilot>');
 const pure=await reader.list('pure');assert.match(pure.rows[0].result,/30\/30 · 00:01:40.00/);assert.equal(pure.mine?.rank,99);
 const daily=await reader.list('daily');assert.equal(daily.rows[0].result,'1500 分');assert.equal(daily.mine?.result,'1200 分');assert.equal(daily.next,'page2');
 await assert.rejects(()=>reader.list('daily','page2',period),/分页/);assert.equal(requests.at(-1).periodToken,period);assert.equal(requests.at(-1).continuationToken,'page2');
 assert.ok(requests.every(r=>r.collection==='public'&&r.maxSize===20));assert.equal(rankingDuration(7199),'00:00:59.99');
});
test('daily requires current Beijing period, rejects cross-midnight and malformed ranks',async()=>{
 let time=now,token:string|undefined=period,row:unknown={rank:1,score:1000};
 const host={loadLeaderboardScores:(o:any)=>o.callback.onSuccess({scores:[row],leaderboard:{period:{periodToken:token}}}),loadCurrentPlayerLeaderboardScore:(o:any)=>o.callback.onSuccess({currentUserScore:null,leaderboard:{period:{periodToken:period}}})};
 const reader=new LeaderboardReader(()=>host,()=>time,100,{daily:'daily'});
 assert.equal((await reader.list('daily')).mineNotice,'当前账号暂无线上成绩。');
 token=undefined;await assert.rejects(()=>reader.list('daily'),/周期/);token=period;row={rank:0,score:1000};await assert.rejects(()=>reader.list('daily'),/排名/);
 row={rank:1,score:4701};await assert.rejects(()=>reader.list('daily'),/分数/);row={rank:1,score:1000};
 host.loadCurrentPlayerLeaderboardScore=o=>{time=new Date('2026-10-23T16:00:00Z');o.callback.onSuccess({currentUserScore:null,leaderboard:{period:{periodToken:period}}});};await assert.rejects(()=>reader.list('daily'),/零点/);
});
test('empty data, missing host, player lookup errors and timeouts are distinct',async()=>{
 await assert.rejects(()=>new LeaderboardReader().list('pure'),/未配置/);
 await assert.rejects(()=>new LeaderboardReader(()=>undefined,undefined,undefined,{pure:'pure'}).list('pure'),/浏览器/);
 const host={loadLeaderboardScores:(o:any)=>o.callback.onSuccess({scores:[]})};
 const result=await new LeaderboardReader(()=>host,undefined,undefined,{pure:'pure'}).list('pure');assert.deepEqual(result.rows,[]);assert.match(result.mineNotice,/不支持/);
 host.loadLeaderboardScores=o=>o.callback.onSuccess({});await assert.rejects(()=>new LeaderboardReader(()=>host,undefined,undefined,{pure:'pure'}).list('pure'),/格式/);
 let callback:any;host.loadLeaderboardScores=o=>{callback=o.callback;};const reader=new LeaderboardReader(()=>host,()=>now,5,{pure:'pure'});
 await assert.rejects(()=>reader.list('pure'),/超时/);callback.onSuccess({scores:[]});
 host.loadLeaderboardScores=o=>o.callback.onFailure(1,'offline');await assert.rejects(()=>reader.list('pure'),/失败/);
});
