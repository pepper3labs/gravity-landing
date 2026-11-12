import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LEVELS} from '../src/levels';
import {CampaignProgress,SAVE_KEY} from '../src/progress';
import {goalLevels,nextReplayGoal} from '../src/replay-goals';
const best={stars:3,score:3500,time:100,fuel:20};
function progress(records:Record<string,unknown>={}){
 const raw=JSON.stringify({version:1,catalogRevision:2,unlockedFloor:1,levels:records});
 return new CampaignProgress({getItem:key=>key===SAVE_KEY?raw:null,setItem:()=>{throw Error('goal view must not write');}});
}
test('新玩家只推荐首个已解锁关，全部筛选仍展示锁定关',()=>{
 const p=progress();assert.equal(nextReplayGoal(LEVELS,p)?.level.id,LEVELS[0].id);
 assert.deepEqual(goalLevels(LEVELS,p,'unassisted').map(l=>l.order),[1]);assert.equal(goalLevels(LEVELS,p,'all').length,LEVELS.length);
});
test('救援三星不充当独立通关或独立三星，旧航线成绩也不充当当前独立成绩',()=>{
 const p=progress({[LEVELS[0].id]:{routeRevision:2,assisted:best},[LEVELS[1].id]:{routeRevision:1,normal:best}});
 assert.equal(nextReplayGoal(LEVELS,p)?.level.order,1);
 assert.ok(goalLevels(LEVELS,p,'mastery').some(l=>l.order===1));assert.ok(goalLevels(LEVELS,p,'unassisted').some(l=>l.order===2));
});
test('优先未独立通关，其后按关卡顺序补独立三星，不改变存档',()=>{
 const rows=Object.fromEntries(LEVELS.map(l=>[l.id,{routeRevision:2,normal:{...best,stars:l.order===1?2:3}}]));
 const p=progress(rows),before=JSON.stringify(p.data);assert.equal(nextReplayGoal(LEVELS,p)?.kind,'mastery');assert.equal(nextReplayGoal(LEVELS,p)?.level.order,1);
 assert.deepEqual(goalLevels(LEVELS,p,'unassisted'),[]);assert.equal(JSON.stringify(p.data),before);
 const missing=progress({...rows,[LEVELS[1].id]:{routeRevision:2,assisted:best}});assert.equal(nextReplayGoal(LEVELS,missing)?.level.order,2);
});
test('全部独立三星时无推荐，筛选空态且正常/救援记录均保留',()=>{
 const p=progress(Object.fromEntries(LEVELS.map(l=>[l.id,{routeRevision:2,normal:best,assisted:best,starTasks:{rules:'tasks-v1',normal:best}}])));
 assert.equal(nextReplayGoal([...LEVELS].reverse(),p),undefined);assert.deepEqual(goalLevels(LEVELS,p,'mastery'),[]);
 assert.deepEqual(p.record(LEVELS[0].id).assisted,best);
});

test('历史三星保留解锁但不冒充三任务三星，推荐新规则目标',()=>{
 const p=progress(Object.fromEntries(LEVELS.map(l=>[l.id,{routeRevision:2,normal:best}])));
 assert.equal(p.data.highestUnlocked,LEVELS.length);assert.equal(nextReplayGoal(LEVELS,p)?.kind,'mastery');
 assert.equal(goalLevels(LEVELS,p,'mastery').length,LEVELS.length);
});
