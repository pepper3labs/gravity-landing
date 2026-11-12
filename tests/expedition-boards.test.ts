import {test} from 'node:test';import assert from 'node:assert/strict';
import {ExpeditionBoards} from '../src/expedition-boards';import {rankScore,type Expedition,MAX_RANK_TICKS} from '../src/economy';
const exp:Expedition={id:'unit',completed:30,phase:'ended',resources:{fuel:120,legs:[{health:100,broken:false},{health:100,broken:false}]},ticks:500000,fuelUsed:2000,damage:0,pure:true,eligible:true,reason:'',services:{fuel:0,repair:0,full:0,ad:0},attempt:30,ended:true};
test('two independent real API payloads use pure ticks and encoded overall score with valid receipts',async()=>{
 const sent:{leaderboardId:string;score:number}[]=[];const host={submitScores:(o:any)=>{sent.push(...o.scores);o.callback.onSuccess({results:o.scores.map((s:any)=>({leaderboardId:s.leaderboardId,scoreResult:{rawScore:s.score}}))});},openLeaderboard:()=>{}};
 const boards=new ExpeditionBoards({pure:'pure',overall:'overall'},()=>host);
 await boards.submit('pure',exp);await boards.submit('overall',exp);
 assert.deepEqual(sent,[{leaderboardId:'pure',score:500000},{leaderboardId:'overall',score:30*(MAX_RANK_TICKS+1)+MAX_RANK_TICKS-500000}]);
});
test('partial pure, assisted pure, live runs, invalid totals and absent configs never call SDK',async()=>{
 let calls=0;const host={submitScores:()=>{calls++;},openLeaderboard:()=>{}};const boards=new ExpeditionBoards({pure:'pure',overall:'overall'},()=>host);
 for(const e of [{...exp,completed:29},{...exp,pure:false,services:{...exp.services,ad:1}},{...exp,phase:'flight' as const,ended:false},{...exp,ticks:-1},{...exp,eligible:false}])await assert.rejects(()=>boards.submit('pure',e));
 await assert.rejects(()=>new ExpeditionBoards({},()=>host).submit('overall',exp),/未配置/);assert.equal(calls,0);
});
test('real score list is decoded, supports pagination, rejects invalid rows and never invents players',async()=>{
 const host={submitScores:()=>{},openLeaderboard:()=>{},loadLeaderboardScores:(o:any)=>o.callback.onSuccess({scores:[{rank:1,score:rankScore(exp,'overall'),user:{name:'<pilot>'}}],isTruncated:true,nextContinuationToken:'next'})};
 const boards=new ExpeditionBoards({overall:'overall'},()=>host);assert.deepEqual(await boards.list('overall'),{rows:[{rank:1,name:'<pilot>',completed:30,ticks:500000}],next:'next'});
 host.loadLeaderboardScores=o=>o.callback.onSuccess({scores:[{rank:1,score:-1}]});await assert.rejects(()=>boards.list('overall'));
});
test('wrong receipt and timeout cannot confirm submission; late callback is isolated',async()=>{
 let callback:any;const host={submitScores:(o:any)=>{callback=o.callback;},openLeaderboard:()=>{}};const boards=new ExpeditionBoards({pure:'pure'},()=>host,5);
 const pending=boards.submit('pure',exp);await assert.rejects(()=>boards.submit('pure',exp),/进行中/);await assert.rejects(()=>pending,/超时/);
 const old=callback,retry=boards.submit('pure',exp);old.onSuccess({results:[{leaderboardId:'pure',scoreResult:{rawScore:500000}}]});callback.onSuccess({results:[{leaderboardId:'wrong',scoreResult:{rawScore:500000}}]});await assert.rejects(()=>retry,/回执/);
});
