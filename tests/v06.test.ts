import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Flight,CONFIG} from '../src/physics';
import {LEVELS,validateLevels} from '../src/levels';
import {flyRoute,replay} from '../src/replay';
import {asteroidAt,dragAt,sweepCircle} from '../src/environment';
import {CampaignProgress,SAVE_KEY} from '../src/progress';
import {scoreFlight} from '../src/scoring';
import {guidance} from '../src/feedback';
import {loadQaScenario} from '../src/qa';

const baseline=JSON.parse(readFileSync('docs/v052-route-baseline.json','utf8'));
test('旧八关通关时间、燃料、损伤、评分与 v0.5.2 基线逐项一致',()=>{
 for(const old of baseline.results){const level=LEVELS.find(l=>l.id===old.levelId)!,{flight,report}=flyRoute(level);
  for(const key of ['state','time','fuel','damage','bodyImpact','steps'] as const)assert.deepEqual(report[key],old[key],level.id+' '+key);
  assert.deepEqual(scoreFlight(flight,level),old.score);}
});
for(const level of LEVELS)test(level.title+'：真实输入通关、确定性回放与成功/失败完整航迹',()=>{
 const {flight,report}=flyRoute(level,true);assert.equal(report.state,'won',report.reason);assert.ok(report.fuel>0);assert.ok(report.time<300);
 const again=replay(level,report.inputs);assert.deepEqual([again.x,again.y,again.fuel,again.bodyImpact,again.trajectory],[flight.x,flight.y,flight.fuel,flight.bodyImpact,flight.trajectory]);
 assert.equal(level.showTrajectory,true);
 const crashed=new Flight(level);loadQaScenario(crashed,'crash');crashed.trajectory=[{x:crashed.x,y:crashed.y}];const start={...crashed.trajectory[0]};
 for(let i=0;i<240&&crashed.state==='flying';i++)crashed.step(false,0);
 assert.equal(crashed.state,'failed');assert.deepEqual(crashed.trajectory[0],start);assert.deepEqual(crashed.trajectory.at(-1),{x:crashed.x,y:crashed.y});assert.ok(crashed.trajectory.length>=2);
 assert.ok(flight.trajectory.length>100);assert.deepEqual(flight.trajectory.at(-1),{x:flight.x,y:flight.y});
});
test('运动轨迹周期闭合，解析速度符合位置导数，静态岩体不移动',()=>{
 for(const a of LEVELS.flatMap(l=>l.asteroids??[])){
  const p=asteroidAt(a,7),q=asteroidAt(a,7+1e-5);
  assert.ok(Math.abs((q.x-p.x)/1e-5-p.vx)<.001);assert.ok(Math.abs((q.y-p.y)/1e-5-p.vy)<.001);
  if(a.motion){const end=asteroidAt(a,7+a.motion.period);assert.ok(Math.hypot(end.x-p.x,end.y-p.y)<1e-8);}else assert.deepEqual(p,{x:a.x,y:a.y,vx:0,vy:0});
 }
});
function collision(){const level=structuredClone(LEVELS[9]);level.asteroids=[{id:'test',name:'测试岩体',x:100,y:0,radius:20}];const s=new Flight(level);s.state='flying';s.x=73;s.y=8;s.vx=10;return s;}
test('轻擦改变线速度与角速度，损伤主体但不会自动断腿或失败',()=>{
 const s=collision();s.step(false,0);assert.equal(s.state,'flying');assert.ok(s.bodyImpact>2&&s.bodyImpact<14);assert.ok(s.bodyIntegrity<100);assert.ok(Math.abs(s.omega)>.01);assert.ok(s.vx<10);assert.ok(s.legs.every(l=>!l.broken));
});
test('高速穿越不能穿透小行星；完整支架不保护主体，原因明确',()=>{
 const s=collision();s.x=0;s.y=0;s.vx=24000;s.step(false,0);assert.equal(s.state,'failed');assert.match(s.reason,/测试岩体/);assert.ok(s.failure!.impact>14);assert.ok(s.legs.every(l=>!l.broken));assert.deepEqual(s.trajectory.at(-1),{x:s.x,y:s.y});
 assert.ok(sweepCircle({x:-100,y:0},{x:100,y:0},20)!<.5);
});
test('动态小行星采用相对撞击速度，主动撞向静止飞船也会损毁',()=>{
 const s=collision();s.y=0;s.vx=0;s.level.asteroids![0].motion={kind:'shuttle',x:50,y:0,period:10,phase:Math.PI};s.step(false,0);assert.equal(s.state,'failed');assert.ok(s.bodyImpact>25);
 const moving=collision();moving.y=0;moving.level.asteroids![0].motion={kind:'shuttle',x:50,y:0,period:10,phase:Math.PI};moving.vx=-Math.PI*10;moving.step(false,0);assert.equal(moving.state,'flying');assert.ok(moving.bodyImpact<1);
});
test('接近提示覆盖小行星，停泊时轨迹时钟和油量不前进',()=>{
 const s=collision();assert.equal(guidance(s).id,'danger');s.reset();const before=[s.elapsed,s.fuel,s.x,s.y];for(let i=0;i<1000;i++)s.step(false,1);assert.deepEqual([s.elapsed,s.fuel,s.x,s.y],before);
});
test('大气只在配置高度内阻碍实际速度，真空与旧关卡没有阻力',()=>{
 const level=structuredClone(LEVELS[13]),p=level.planets[0];assert.equal(dragAt(level,{x:p.x,y:p.y-p.radius-200}),0);assert.ok(dragAt(level,{x:p.x,y:p.y-p.radius-50})>0);assert.equal(dragAt(LEVELS[0],{x:0,y:0}),0);
 const air=new Flight(level),vacuum=new Flight({...level,planets:level.planets.map(p=>({...p,atmosphere:undefined}))});
 for(const s of [air,vacuum]){s.state='flying';s.y-=55;s.vx=30;s.step(false,0);}assert.ok(air.vx<vacuum.vx);assert.equal(air.fuel,vacuum.fuel);
});
test('小行星扫过旧检查点时救援回发射台，航迹不伪造瞬移连线',()=>{
 const s=collision();s.checkpoint={x:100,y:0,vx:0,vy:0,angle:0,omega:0,fuel:50};s.recordTrace(true);const old=s.trajectory.length;s.rescue();assert.equal(s.state,'docked');assert.ok(s.trajectory.length>old);assert.equal(s.trajectory.at(-1)?.break,true);
});
test('航迹超过上限后保留起点和整个航程，终点不会丢失',()=>{
 const s=new Flight(LEVELS[8]),first=s.trajectory[0];for(let i=0;i<20000;i++){s.x=i;s.elapsed+=.1;s.recordTrace();}s.fail('测试','测试');assert.deepEqual(s.trajectory[0],first);assert.ok(s.trajectory.length<=4097);assert.equal(s.trajectory.at(-1)?.x,19999);
});
test('非法障碍周期、大气与平台侵入被配置验证拒绝',()=>{
 const levels=structuredClone(LEVELS);levels[10].asteroids![0].motion!.period=0;levels[13].planets[0].atmosphere!.height=NaN;levels[9].asteroids![0]={id:'unsafe',name:'unsafe',x:0,y:272,radius:30};assert.ok(validateLevels(levels).length>=3);
});
test('完整旧八关存档保留正常/救援成绩和教学，自然解锁9并逐关走到14',()=>{
 const best={stars:3,score:3000,time:100,fuel:20};const records=Object.fromEntries(LEVELS.slice(0,8).map(l=>[l.id,{completed:true,tutorialSeen:true,routeRevision:2,normal:best,assisted:{...best,score:2000}}]));
 let raw=JSON.stringify({version:1,catalogRevision:2,unlockedFloor:1,highestUnlocked:8,levels:records});const storage={getItem:(key:string)=>key===SAVE_KEY?raw:null,setItem:(_key:string,value:string)=>{raw=value;}};
 const progress=new CampaignProgress(storage);assert.equal(progress.data.highestUnlocked,9);assert.equal(progress.unlocked(LEVELS[9].id),false);
 for(const l of LEVELS.slice(0,8)){assert.deepEqual(progress.record(l.id).normal,best);assert.equal(progress.record(l.id).assisted?.score,2000);assert.equal(progress.record(l.id).tutorialSeen,true);}
 for(const l of LEVELS.slice(8,14)){progress.complete(l.id,scoreFlight(flyRoute(l).flight,l));assert.equal(progress.data.highestUnlocked,Math.min(LEVELS.length,l.order+1));}
 const reloaded=new CampaignProgress(storage);assert.equal(reloaded.data.highestUnlocked,15);assert.deepEqual(reloaded.record(LEVELS[0].id).normal,best);
});
test('低燃料关确有紧张预算，但验证航线保留少量制动余量',()=>{
 const level=LEVELS[12],{flight}=flyRoute(level);assert.equal(flight.state,'won');assert.ok(flight.fuel>3&&flight.fuel/level.initialFuel<.25);assert.ok(flight.checkpoint!.fuel<=level.initialFuel);assert.equal(CONFIG.thrust,72);assert.equal(CONFIG.rotation,3.8);
});
