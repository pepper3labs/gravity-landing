import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LEVELS,validateLevels} from '../src/levels';
import {asteroidAt} from '../src/environment';
import {nextCampaignLevel} from '../src/campaign';
import {CampaignProgress,SAVE_KEY} from '../src/progress';
import {flyRoute} from '../src/replay';
import {scoreFlight} from '../src/scoring';
test('v0.6 十四关通关结果与评分严格不变',()=>{
 const old=JSON.parse(readFileSync('docs/v06-route-results.json','utf8'));
 for(const row of old.results){const level=LEVELS.find(l=>l.id===row.levelId)!,{flight,report}=flyRoute(level);
  for(const key of ['state','time','fuel','damage','bodyImpact','steps'] as const)assert.deepEqual(report[key],row[key]);
  assert.deepEqual(scoreFlight(flight,level),row.score);
 }
});
test('十五关旧存档逐关解锁16–20，新关正常与救援成绩分开',()=>{
 const best={stars:3,score:3500,time:100,fuel:30};
 let raw=JSON.stringify({version:1,catalogRevision:2,unlockedFloor:1,levels:Object.fromEntries(LEVELS.slice(0,15).map(l=>[l.id,{routeRevision:2,tutorialSeen:true,normal:best}]))});
 const storage={getItem:()=>raw,setItem:(_k:string,v:string)=>{raw=v;}};
 let p=new CampaignProgress(storage);assert.equal(p.data.highestUnlocked,16);
 for(const level of LEVELS.slice(15,20)){
  assert.equal(p.unlocked(level.id),true);
  const run=scoreFlight(flyRoute(level).flight,level);
  p.complete(level.id,{...run,assisted:true,rescues:1});assert.equal(p.record(level.id).normal,undefined);
  p.complete(level.id,run);p=new CampaignProgress(storage);
  assert.equal(p.record(level.id).normal?.stars,3);assert.equal(p.record(level.id).assisted?.stars,3);
  assert.equal(p.data.highestUnlocked,Math.min(level.order+1,LEVELS.length));
 }
 for(const l of LEVELS.slice(0,15))assert.deepEqual(p.record(l.id).normal,best);
 assert.equal(new CampaignProgress().data.highestUnlocked,1);
});
test('进阶五关具有不同学习条件，巡游范围安全且留有燃料余量',()=>{
 assert.deepEqual(validateLevels(LEVELS),[]);
 const [cross,moon,air,reserve,finale]=LEVELS.slice(15);
 assert.equal(cross.asteroids?.filter(a=>a.motion).length,2);
 const [a,b]=cross.asteroids!;assert.equal(asteroidAt(a,0).vy,0);assert.ok(Math.abs(asteroidAt(b,0).vy)<1e-8);
 assert.ok(asteroidAt(a,0).vx>0);assert.ok(asteroidAt(b,6).vy<0);
 assert.equal(moon.platforms.find(p=>p.id===moon.start)?.planet,1);
 assert.equal(moon.platforms.find(p=>p.id===moon.target)?.planet,0);
 assert.ok(air.planets[0].atmosphere);assert.equal(air.asteroids?.length,0);
 assert.equal(reserve.platforms[1].width,60);assert.equal(reserve.initialFuel,40);
 assert.ok(finale.planets[0].atmosphere);assert.equal(finale.asteroids?.length,2);
 for(const l of LEVELS.slice(15,20)){const {flight}=flyRoute(l);assert.equal(flight.state,'won');assert.equal(flight.bodyImpact,0);assert.ok(flight.fuel/l.initialFuel>.2);}
});
test('旧十四关存档自然解锁15，正常/辅助/教学记录保留并可重读',()=>{
 const best={stars:3,score:3500,time:100,fuel:30};
 const records=Object.fromEntries(LEVELS.slice(0,14).map(l=>[l.id,{routeRevision:2,tutorialSeen:true,normal:best,assisted:{...best,score:3000}}]));
 let raw=JSON.stringify({version:1,catalogRevision:2,unlockedFloor:1,levels:records});
 const storage={getItem:(k:string)=>k===SAVE_KEY?raw:null,setItem:(_k:string,v:string)=>{raw=v;}};
 const p=new CampaignProgress(storage);assert.equal(p.data.highestUnlocked,15);assert.equal(p.record('reverse-arc').completed,false);
 for(const l of LEVELS.slice(0,14)){assert.deepEqual(p.record(l.id).normal,best);assert.equal(p.record(l.id).assisted?.score,3000);assert.equal(p.record(l.id).tutorialSeen,true);}
 const level=LEVELS[14];p.complete(level.id,scoreFlight(flyRoute(level).flight,level));assert.equal(new CampaignProgress(storage).record(level.id).normal?.stars,3);
 const fresh=new CampaignProgress();assert.equal(fresh.unlocked(level.id),false);
});
test('章节衔接完整且不改第十四关归档配置',()=>{
 assert.equal(LEVELS[13].unlockNext,null);assert.equal(nextCampaignLevel(LEVELS[13])?.id,'reverse-arc');
 for(let i=0;i<LEVELS.length-1;i++)assert.equal(nextCampaignLevel(LEVELS[i])?.id,LEVELS[i+1].id);
 assert.equal(nextCampaignLevel(LEVELS.at(-1)!),undefined);
 assert.ok(LEVELS[14].verificationRoute.some(p=>p.x < -700));assert.ok(LEVELS[14].asteroids?.some(a=>a.motion));
});
