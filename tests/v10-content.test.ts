import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LEVELS,levelById} from '../src/levels';
import {flyRoute} from '../src/replay';
import {scoreFlight} from '../src/scoring';
import {CampaignProgress} from '../src/progress';
import {Flight} from '../src/physics';
import {dragAt} from '../src/environment';

test('窄口归港八种巡游相位共用输入三星无损，双脚落在窄台内',()=>{
 const level=levelById('narrow-harbor')!,{report}=flyRoute(level,true);
 for(let phase=0;phase<8;phase++){
  const shifted=structuredClone(level);shifted.asteroids![0].motion!.phase=phase*Math.PI/4;
  const flight=new Flight(shifted);for(const input of report.inputs)flight.step(input.thrust,input.turn);
  assert.equal(flight.state,'won','phase '+phase);assert.equal(scoreFlight(flight,shifted).stars,3);
  assert.equal(flight.bodyImpact,0);assert.ok(flight.legs.every(l=>l.health===100&&!l.broken));
  assert.ok(flight.contacts.every(Boolean));assert.ok(flight.fuel>level.initialFuel*.25);
 }
});

test('大气绕礁在八种巡游相位下同一输入三星无损通关',()=>{
 const level=levelById('atmosphere-reef')!,{report}=flyRoute(level,true);
 assert.equal(dragAt(level,{x:-950,y:700}),0);assert.ok(dragAt(level,{x:-650,y:700})>0);
 for(let phase=0;phase<8;phase++){
  const shifted=structuredClone(level);shifted.asteroids![0].motion!.phase=phase*Math.PI/4;
  const flight=new Flight(shifted);for(const input of report.inputs)flight.step(input.thrust,input.turn);
  assert.equal(flight.state,'won','phase '+phase);assert.equal(scoreFlight(flight,shifted).stars,3);
  assert.equal(flight.bodyImpact,0);assert.ok(flight.legs.every(l=>l.health===100&&!l.broken));
  assert.ok(flight.fuel>level.initialFuel*.25);
 }
});

test('旧23关存档衔接24，保留双轨成绩且新存档仍锁定新关',()=>{
 const best={stars:3,score:3500,time:100,fuel:30};let raw=JSON.stringify({version:1,catalogRevision:2,unlockedFloor:1,
 levels:Object.fromEntries(LEVELS.slice(0,23).map(l=>[l.id,{routeRevision:2,tutorialSeen:true,normal:best,assisted:{...best,score:3000}}]))});
 const storage={getItem:()=>raw,setItem:(_k:string,v:string)=>{raw=v;}},p=new CampaignProgress(storage),level=levelById('atmosphere-reef')!;
 assert.equal(p.data.highestUnlocked,24);assert.equal(new CampaignProgress().unlocked(level.id),false);
 const run=scoreFlight(flyRoute(level).flight,level);p.complete(level.id,{...run,assisted:true,rescues:1});assert.equal(p.record(level.id).normal,undefined);p.complete(level.id,run);
 const restored=new CampaignProgress(storage);assert.ok(restored.record(level.id).normal);assert.ok(restored.record(level.id).assisted);
 for(const l of LEVELS.slice(0,23)){assert.deepEqual(restored.record(l.id).normal,best);assert.equal(restored.record(l.id).assisted?.score,3000);assert.equal(restored.record(l.id).tutorialSeen,true);}
});

test('双星绕礁可通过末段回正获得三星，评分与物理不变',()=>{
 const level=levelById('binary-reef')!,{flight}=flyRoute(level,false,undefined,{height:26,angleOffset:0});
 const score=scoreFlight(flight,level);assert.equal(flight.state,'won');assert.equal(score.stars,3);
 assert.equal(flight.bodyImpact,0);assert.ok(score.touchdownAngle<level.scoring.three.maxTouchdownAngle);
});

test('双星绕礁同一输入覆盖两组巡游的16种初相位组合',()=>{
 const level=levelById('binary-reef')!,{report}=flyRoute(level,true);assert.equal(report.state,'won');
 for(let a=0;a<4;a++)for(let b=0;b<4;b++){
  const shifted=structuredClone(level);shifted.asteroids![0].motion!.phase=a*Math.PI/2;shifted.asteroids![1].motion!.phase=b*Math.PI/2;
  const flight=new Flight(shifted);for(const input of report.inputs)flight.step(input.thrust,input.turn);
  assert.equal(flight.state,'won',a+','+b);assert.equal(flight.bodyImpact,0);assert.ok(flight.legs.every(l=>l.health===100&&!l.broken));
 }
});

test('旧22关存档衔接23且保留原成绩',()=>{
 const best={stars:3,score:3500,time:100,fuel:30};let raw=JSON.stringify({version:1,catalogRevision:2,unlockedFloor:1,
 levels:Object.fromEntries(LEVELS.slice(0,22).map(l=>[l.id,{routeRevision:2,tutorialSeen:true,normal:best,assisted:{...best,score:3000}}]))});
 const storage={getItem:()=>raw,setItem:(_k:string,v:string)=>{raw=v;}},p=new CampaignProgress(storage),level=levelById('binary-reef')!;
 assert.equal(p.data.highestUnlocked,23);assert.equal(new CampaignProgress().unlocked(level.id),false);
 const run=scoreFlight(flyRoute(level).flight,level);p.complete(level.id,{...run,assisted:true,rescues:1});assert.equal(p.record(level.id).normal,undefined);p.complete(level.id,run);
 const restored=new CampaignProgress(storage);assert.ok(restored.record(level.id).normal);assert.ok(restored.record(level.id).assisted);
 for(const l of LEVELS.slice(0,22)){assert.deepEqual(restored.record(l.id).normal,best);assert.equal(restored.record(l.id).assisted?.score,3000);assert.equal(restored.record(l.id).tutorialSeen,true);}
});

test('正式版扩关保留旧二十关通关结果与评分',()=>{
 const old=JSON.parse(readFileSync('docs/v07-route-results.json','utf8'));
 assert.equal(old.results.length,20);
 for(const row of old.results){const level=levelById(row.levelId)!,{flight,report}=flyRoute(level);
  for(const key of ['state','time','fuel','damage','bodyImpact','steps'] as const)assert.deepEqual(report[key],row[key]);
  assert.deepEqual(scoreFlight(flight,level),row.score);
 }
});

test('巡游后进场的同一输入在八个巡游相位均可无损通过',()=>{
 const level=levelById('patrol-approach')!,{report}=flyRoute(level,true);
 assert.equal(report.state,'won');
 for(let phase=0;phase<8;phase++){
  const shifted=structuredClone(level);shifted.asteroids![0].motion!.phase=phase*Math.PI/4;
  const flight=new Flight(shifted);
  for(const input of report.inputs)flight.step(input.thrust,input.turn);
  assert.equal(flight.state,'won','phase '+phase);assert.equal(flight.bodyImpact,0);
  assert.ok(flight.legs.every(leg=>!leg.broken&&leg.health===100));assert.ok(flight.fuel>level.initialFuel*.25);
 }
});

test('旧21关存档解锁22且新关成绩不会覆盖旧记录',()=>{
 const best={stars:3,score:3500,time:100,fuel:30};
 let raw=JSON.stringify({version:1,catalogRevision:2,unlockedFloor:1,levels:Object.fromEntries(LEVELS.slice(0,21).map(l=>[l.id,{routeRevision:2,tutorialSeen:true,normal:best,assisted:{...best,score:3000}}]))});
 const storage={getItem:()=>raw,setItem:(_k:string,v:string)=>{raw=v;}};
 const progress=new CampaignProgress(storage),level=levelById('patrol-approach')!;
 assert.equal(progress.data.highestUnlocked,22);assert.equal(new CampaignProgress().unlocked(level.id),false);
 const run=scoreFlight(flyRoute(level).flight,level);
 progress.complete(level.id,{...run,assisted:true,rescues:1});assert.equal(progress.record(level.id).normal,undefined);
 progress.complete(level.id,run);const restored=new CampaignProgress(storage);
 assert.ok(restored.record(level.id).normal);assert.ok(restored.record(level.id).assisted);
 for(const l of LEVELS.slice(0,21)){assert.deepEqual(restored.record(l.id).normal,best);assert.equal(restored.record(l.id).assisted?.score,3000);assert.equal(restored.record(l.id).tutorialSeen,true);}
});

test('旧二十关进度自然衔接第四章，保留双轨成绩与教学记录',()=>{
 const best={stars:3,score:3500,time:100,fuel:30};
 let raw=JSON.stringify({version:1,catalogRevision:2,unlockedFloor:1,levels:Object.fromEntries(LEVELS.slice(0,20).map(l=>[l.id,{routeRevision:2,tutorialSeen:true,normal:best,assisted:{...best,score:3000}}]))});
 const storage={getItem:()=>raw,setItem:(_k:string,v:string)=>{raw=v;}};
 const progress=new CampaignProgress(storage),level=levelById('outer-corridor')!;
 assert.equal(progress.data.highestUnlocked,21);assert.equal(progress.record(level.id).completed,false);
 assert.equal(new CampaignProgress().unlocked(level.id),false);
 const {flight}=flyRoute(level);assert.equal(flight.state,'won');assert.equal(flight.bodyImpact,0);assert.ok(flight.fuel>level.initialFuel*.25);
 const run=scoreFlight(flight,level);progress.complete(level.id,{...run,assisted:true,rescues:1});assert.equal(progress.record(level.id).normal,undefined);
 progress.complete(level.id,run);const restored=new CampaignProgress(storage);
 assert.ok(restored.record(level.id).normal);assert.ok(restored.record(level.id).assisted);
 for(const l of LEVELS.slice(0,20)){assert.deepEqual(restored.record(l.id).normal,best);assert.equal(restored.record(l.id).assisted?.score,3000);assert.equal(restored.record(l.id).tutorialSeen,true);}
});

test('旧24关存档衔接25，保留双轨成绩且新存档仍锁定新关',()=>{
 const best={stars:3,score:3500,time:100,fuel:30};let raw=JSON.stringify({version:1,catalogRevision:2,unlockedFloor:1,
 levels:Object.fromEntries(LEVELS.slice(0,24).map(l=>[l.id,{routeRevision:2,tutorialSeen:true,normal:best,assisted:{...best,score:3000}}]))});
 const storage={getItem:()=>raw,setItem:(_k:string,v:string)=>{raw=v;}},p=new CampaignProgress(storage),level=levelById('narrow-harbor')!;
 assert.equal(p.data.highestUnlocked,25);assert.equal(new CampaignProgress().unlocked(level.id),false);
 const run=scoreFlight(flyRoute(level).flight,level);p.complete(level.id,{...run,assisted:true,rescues:1});assert.equal(p.record(level.id).normal,undefined);p.complete(level.id,run);
 const restored=new CampaignProgress(storage);assert.ok(restored.record(level.id).normal);assert.ok(restored.record(level.id).assisted);
 for(const l of LEVELS.slice(0,24)){assert.deepEqual(restored.record(l.id).normal,best);assert.equal(restored.record(l.id).assisted?.score,3000);assert.equal(restored.record(l.id).tutorialSeen,true);}
});
