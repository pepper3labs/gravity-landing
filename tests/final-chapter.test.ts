import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LEVELS} from '../src/levels';
import {Flight} from '../src/physics';
import {flyRoute} from '../src/replay';
import {scoreFlight} from '../src/scoring';
import {CampaignProgress} from '../src/progress';
import {nextCampaignLevel} from '../src/campaign';
import {dragAt} from '../src/environment';

const chapter=LEVELS.filter(l=>l.order>=26);
test('完整战役30关、5章、90星，解锁链无断点且最终关无后继',()=>{
 assert.equal(LEVELS.length,30);assert.equal(new Set(LEVELS.map(l=>l.chapter)).size,5);
 assert.deepEqual(chapter.map(l=>l.order),[26,27,28,29,30]);
 for(let i=0;i<29;i++)assert.equal(nextCampaignLevel(LEVELS[i])?.id,LEVELS[i+1].id);
 assert.equal(nextCampaignLevel(LEVELS[29]),undefined);
 const fresh=new CampaignProgress();for(const level of chapter)assert.equal(fresh.unlocked(level.id),false);
});

for(const level of chapter.filter(l=>l.asteroids?.some(a=>a.motion)))test(level.title+'：相同输入覆盖巡游初相位，三星无损且有燃料余量',()=>{
 const {flight,report}=flyRoute(level,true);assert.equal(flight.state,'won');
 const moving=level.asteroids!.filter(a=>a.motion);
 // Eight samples for one moving rock; 4×4 independent combinations for two.
 const count=moving.length===2?16:8;
 for(let sample=0;sample<count;sample++){
  const shifted=structuredClone(level);const rocks=shifted.asteroids!.filter(a=>a.motion);
  rocks.forEach((rock,i)=>{rock.motion!.phase=moving.length===2?(i===0?sample%4:Math.floor(sample/4))*Math.PI/2:sample*Math.PI/4;});
  const replay=new Flight(shifted);for(const input of report.inputs)replay.step(input.thrust,input.turn);
  assert.equal(replay.state,'won','phase sample '+sample);assert.equal(scoreFlight(replay,shifted).stars,3);
  assert.equal(replay.bodyImpact,0);assert.ok(replay.legs.every(l=>l.health===100&&!l.broken));
  assert.ok(replay.fuel>level.initialFuel*.25);assert.equal(replay.rescueCount,0);
 }
});

test('旧25关存档逐关解锁终章，双轨成绩保留且30关后不越界',()=>{
 const best={stars:3,score:4000,time:100,fuel:30};
 let raw=JSON.stringify({version:1,catalogRevision:2,unlockedFloor:1,levels:Object.fromEntries(LEVELS.slice(0,25).map(l=>
  [l.id,{routeRevision:2,tutorialSeen:true,normal:best,assisted:{...best,score:3000}}]))});
 const storage={getItem:()=>raw,setItem:(_k:string,value:string)=>{raw=value;}};
 let progress=new CampaignProgress(storage);assert.equal(progress.data.highestUnlocked,26);
 for(const level of chapter){
  assert.equal(progress.data.highestUnlocked,level.order);
  if(level.order<30)assert.equal(progress.unlocked(LEVELS[level.order].id),false);
  const run=scoreFlight(flyRoute(level).flight,level);
  assert.equal(progress.complete(level.id,{...run,practice:true}),false);
  assert.equal(progress.record(level.id).completed,false);
  progress.complete(level.id,{...run,assisted:true,rescues:1});assert.equal(progress.record(level.id).normal,undefined);
  progress.complete(level.id,run);progress.seen(level.id);progress=new CampaignProgress(storage);
  assert.equal(progress.record(level.id).normal?.stars,3);assert.ok(progress.record(level.id).assisted);
 }
 assert.equal(progress.data.highestUnlocked,30);
 assert.equal(LEVELS.reduce((sum,l)=>sum+(progress.record(l.id).normal?.stars??0),0),90);
 for(const l of LEVELS.slice(0,25)){
  assert.deepEqual(progress.record(l.id).normal,best);assert.equal(progress.record(l.id).assisted?.score,3000);
  assert.equal(progress.record(l.id).tutorialSeen,true);
 }
});

test('终章气层边界与返航检修桩真实存在，停泊阶段不耗油或受伤',()=>{
 for(const level of chapter){
  for(const planet of level.planets.filter(p=>p.atmosphere)){
   assert.ok(dragAt(level,{x:planet.x,y:planet.y-planet.radius-10})>0);
   assert.equal(dragAt(level,{x:planet.x,y:planet.y-planet.radius-planet.atmosphere!.height-10}),0);
  }
  const flight=new Flight(level);for(let i=0;i<120*30;i++)flight.step(false,0);
  assert.equal(flight.state,'docked');assert.equal(flight.fuel,level.initialFuel);
  assert.equal(flight.bodyImpact,0);assert.ok(flight.legs.every(l=>l.health===100));
 }
 assert.equal(chapter[3].obstacles.length,1);
});
