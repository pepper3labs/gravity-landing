import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LEVELS,levelById} from '../src/levels';
import {Flight} from '../src/physics';
import {scoreFlight} from '../src/scoring';
import {scoreTaskFlight,starTasks,SPECIALTIES} from '../src/star-tasks';
import {starTaskMarkup} from '../src/star-task-view';
import {CampaignProgress,SAVE_KEY} from '../src/progress';
import {dailyCourse,DailyRecords,validateDailyRun} from '../src/daily';
import {archiveDaily,verifyDailyArchive} from '../src/daily-archive';
import {flyRoute,replay} from '../src/replay';
import {decodeArchive,unpackInputs,rulesFingerprint} from '../scripts/replay-archive';

function won(id='training-launch'){
  const level=levelById(id)!,flight=new Flight(level);flight.state='won';flight.result='perfect';
  flight.elapsed=50;flight.fuel=level.initialFuel;return {level,flight};
}
test('三目标独立计星：完整/断腿与达标/未达标四种组合；失败不发星或金币',()=>{
  for(const intact of [false,true])for(const enough of [false,true]){
    const {level,flight}=won();flight.legs[0].broken=!intact;flight.fuel=enough?level.initialFuel:0;
    const score=scoreTaskFlight(flight,level);
    assert.deepEqual(score.tasks.map(t=>t.met),[true,intact,enough]);assert.equal(score.stars,1+Number(intact)+Number(enough));
    assert.equal(score.coins,level.scoring.baseCoins+(score.stars-1)*25);
    assert.equal(score.score-scoreFlight(flight,level).score,(score.stars-scoreFlight(flight,level).stars)*1000);
    flight.state='failed';assert.equal(scoreTaskFlight(flight,level).stars,0);assert.equal(scoreTaskFlight(flight,level).score,0);assert.equal(scoreTaskFlight(flight,level).coins,0);
  }
});
test('着陆质量仅看断裂；不暗藏耐久/速度/时间条件，不新增救援惩罚',()=>{
  const {level,flight}=won();flight.legs[0].health=1;flight.bodyImpact=13;flight.elapsed=9999;flight.touchdown.vertical=99;
  flight.rescued=true;flight.rescueCount=1;
  const score=scoreTaskFlight(flight,level);assert.equal(score.stars,3);assert.equal(score.assisted,true);
  assert.equal(scoreTaskFlight(flight,level,true).coins,0);assert.equal(scoreTaskFlight(flight,level,true).practice,true);
  flight.legs[0].broken=true;flight.result='recovered';assert.equal(scoreTaskFlight(flight,level).stars,2);
});
test('专项边界包含等号；临界未达标显示差距，不能四舍五入伪装达标',()=>{
  for(const id of ['training-launch','training-brake','inertia']){
    const {level,flight}=won(id),kind=SPECIALTIES[id],threshold=level.scoring.three;
    const set=(offset:number)=>{
      if(kind==='fuel')flight.fuel=level.initialFuel*(threshold.minFuelRatio-offset);
      if(kind==='speed')flight.touchdown.vertical=threshold.maxTouchdownSpeed+offset;
      if(kind==='time')flight.elapsed=threshold.maxTime+offset;
    };
    set(0);assert.equal(scoreTaskFlight(flight,level).tasks[2].met,true,id);
    set(.00001);const task=scoreTaskFlight(flight,level).tasks[2];assert.equal(task.met,false,id);
    assert.match(task.detail,/还差|超出/);assert.doesNotMatch(task.detail,/已达标/);
  }
});
test('起飞与结算共用三个任务，未获得原因和状态不是只靠颜色；未知关卡拒绝默配',()=>{
  const {level,flight}=won();flight.legs[0].broken=true;
  const tasks=scoreTaskFlight(flight,level).tasks;
  assert.deepEqual(tasks.map(t=>t.requirement),starTasks(level).map(t=>t.requirement));
  const html=starTaskMarkup(tasks,true);assert.equal((html.match(/<li /g)??[]).length,3);
  assert.match(html,/左支架已断裂/);assert.match(html,/未获得/);assert.match(html,/已获得/);
  assert.match(starTaskMarkup(starTasks(level)),/本关三星目标/);
  assert.throws(()=>starTasks({...level,id:'unknown'}));
});
test('旧双轨成绩和解锁保留；三任务新纪录单独比较与持久化，练习不写入',()=>{
  const {level,flight}=won();const old={stars:3,score:4600,time:30,fuel:level.initialFuel};
  let raw=JSON.stringify({version:1,catalogRevision:2,unlockedFloor:1,levels:{[level.id]:{routeRevision:2,normal:old,assisted:old,tutorialSeen:true}}});
  const storage={getItem:(key:string)=>key===SAVE_KEY?raw:null,setItem:(_key:string,value:string)=>{raw=value;}};
  const progress=new CampaignProgress(storage);const before=raw;
  progress.complete(level.id,scoreTaskFlight(flight,level,true));assert.equal(raw,before);
  flight.fuel=0;const run=scoreTaskFlight(flight,level);assert.equal(run.stars,2);
  assert.equal(progress.complete(level.id,run),true);assert.equal(progress.complete(level.id,run),false);
  flight.rescued=true;progress.complete(level.id,scoreTaskFlight(flight,level));
  const loaded=new CampaignProgress(storage),record=loaded.record(level.id);
  assert.deepEqual(record.normal,old);assert.deepEqual(record.assisted,old);
  assert.equal(record.starTasks?.normal?.stars,2);assert.equal(record.starTasks?.assisted?.stars,2);
  assert.equal(loaded.data.highestUnlocked,2);assert.equal(record.tutorialSeen,true);
});
test('30关旧输入按原规则复核后重算三任务；三星路线均可达且物理档案不重录',()=>{
  assert.deepEqual(Object.keys(SPECIALTIES).sort(),LEVELS.map(l=>l.id).sort());
  for(const level of LEVELS){
    const path='docs/replays/'+(level.id==='binary-reef'?'binary-reef-mastery':level.id)+'.json.gz';
    const archive=decodeArchive(readFileSync(path),level,rulesFingerprint());
    const flight=replay(level,[...unpackInputs(archive.inputs)]),before=scoreFlight(flight,level),after=scoreTaskFlight(flight,level);
    assert.deepEqual(JSON.parse(JSON.stringify(before)),archive.expected.score,level.id+' 旧评分');
    assert.equal(after.stars,3,level.id+' 新规则三星');
    assert.equal(after.time,archive.expected.elapsed);assert.equal(after.fuel,archive.expected.fuel);
    console.log('任务评分对比',level.id,before.stars+'→'+after.stars,before.score+'→'+after.score,SPECIALTIES[level.id]);
  }
});
test('每日新旧规则分日ID隔离；旧回放可复核，篡改规则不能沿用旧指纹',()=>{
  const date=new Date('2026-10-15T00:00:00Z'),oldCourse=dailyCourse(date,'daily-v1'),course=dailyCourse(date);
  const level=levelById(course.levelId)!,inputs=flyRoute(level,true).report.inputs,flags={practice:false,assisted:false,rescues:0};
  assert.notEqual(course.id,oldCourse.id);
  const old=archiveDaily(oldCourse,inputs),current=archiveDaily(course,inputs);
  assert.deepEqual(verifyDailyArchive(JSON.stringify(old)),old);assert.deepEqual(verifyDailyArchive(JSON.stringify(current)),current);
  assert.notEqual(old.rulesHash,current.rulesHash);
  assert.throws(()=>verifyDailyArchive(JSON.stringify({...current,rulesHash:old.rulesHash})));
  let raw=JSON.stringify({version:1,records:[old.best]});
  const records=new DailyRecords({getItem:()=>raw,setItem:(_k,v)=>{raw=v;}});
  assert.deepEqual(records.best(oldCourse.id),old.best);assert.equal(records.best(course.id),undefined);
  assert.equal(records.submit(course,inputs,flags).ok,true);assert.deepEqual(records.best(oldCourse.id),old.best);
  assert.equal(validateDailyRun({...course,rules:'daily-v1'},inputs,flags).ok,false);
});
