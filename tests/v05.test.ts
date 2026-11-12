import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Flight, CONFIG, frame, gravityAt, dot, nearestPlanet } from '../src/physics';
import { LEVELS, validateLevels } from '../src/levels';
import { flyRoute, replay } from '../src/replay';
import { scoreFlight } from '../src/scoring';
import { CampaignProgress, SAVE_KEY, type StoragePort } from '../src/progress';
import { telemetry } from '../src/feedback';

class Memory implements StoragePort {
  values=new Map<string,string>();getItem(k:string){return this.values.get(k)??null;}setItem(k:string,v:string){this.values.set(k,v);}
}
function atTarget(index=0,height=CONFIG.legY-.2){
  const l=LEVELS[index],s=new Flight(l),p=l.platforms.find(p=>p.id===l.target)!,f=frame(l,p);
  s.state='flying';s.x=f.c.x+f.n.x*height;s.y=f.c.y+f.n.y*height;s.angle=p.angle+Math.PI/2;return s;
}
function settle(s:Flight){for(let i=0;i<1200&&s.state==='flying';i++)s.step(false,0);}

test('八关配置有效；非法星球、平台、解锁和安全中线被拒绝',()=>{
 assert.deepEqual(validateLevels(LEVELS),[]);
 const copy=structuredClone(LEVELS);copy[0].planets[0].gravity=-1;copy[1].platforms[1].width=12;copy[2].unlockNext='missing';copy.find(l=>l.id==='emergency')!.obstacles[0].along=0;
 assert.ok(validateLevels(copy).length>=4);
});
test('八关各停泊十分钟稳定、双腿完好且不耗燃料；同时点火与旋转可起飞',()=>{
 for(const l of LEVELS){const s=new Flight(l),before=[s.x,s.y,s.angle,s.fuel];for(let i=0;i<72000;i++)s.step(false,1);
 assert.deepEqual([s.x,s.y,s.angle,s.fuel],before);assert.equal(s.state,'docked');assert.ok(s.legs.every(l=>!l.broken));
 s.step(true,1);assert.equal(s.state,'flying');assert.ok(s.fuel<l.initialFuel);assert.ok(s.omega>0);}
});
test('引力采用反平方距离衰减，双星是两个加速度矢量之和',()=>{
 const l=LEVELS[5],q={x:350,y:80},total=gravityAt(l,q),a=gravityAt({...l,planets:[l.planets[0]]},q),b=gravityAt({...l,planets:[l.planets[1]]},q);
 assert.ok(Math.abs(total.x-a.x-b.x)<1e-10&&Math.abs(total.y-a.y-b.y)<1e-10);
 const p=LEVELS[0].planets[0],g=gravityAt(LEVELS[0],{x:p.x,y:p.y-p.radius});assert.equal(g.y,p.gravity);
 assert.equal(gravityAt(LEVELS[0],{x:p.x,y:p.y-2*p.radius}).y,p.gravity/4);
});
test('目标姿态与速度采用第二星球平台法线，离地高度选最近地表',()=>{
 const s=atTarget(5),f=frame(s.level,s.level.platforms[1]);s.vx=-f.n.x*6+f.t.x*3;s.vy=-f.n.y*6+f.t.y*3;
 const t=telemetry(s);assert.ok(Math.abs(t.targetDescent-6)<1e-9);assert.ok(Math.abs(t.targetLateral-3)<1e-9);assert.ok(Math.abs(t.targetTilt)<1e-9);assert.equal(nearestPlanet(s.level,s),s.level.planets[1]);
});
test('左缘检修桩真实撞断左腿，右腿保持完好，点火可无主体碰撞脱险',()=>{
 const l=LEVELS[7],s=atTarget(7,58),f=frame(l,l.platforms[1]);s.x+=f.t.x*-18;s.y+=f.t.y*-18;s.vx=-f.n.x*43;s.vy=-f.n.y*43;
 let broke=false;for(let i=0;i<400&&s.state==='flying';i++){s.step(broke,0);if(s.legs[0].broken)broke=true;}
 assert.equal(broke,true);assert.equal(s.state,'flying');assert.equal(s.legs[1].health,100);assert.equal(s.contacts[0],false);assert.equal(s.bodyImpact,0);assert.equal(s.recovered,true);
 assert.ok(dot({x:s.x-f.c.x,y:s.y-f.c.y},f.n)>100);
});
test('标准右腿的旋转接触冲击独立于左腿计算',()=>{
 const s=new Flight(LEVELS[6]);s.state='flying';s.angle=.08;s.y+=1;s.vy=43;s.omega=.3;s.step(false,0);
 assert.equal(s.legs[0].broken,false);assert.equal(s.legs[1].broken,true);assert.equal(s.state,'flying');
});
test('早期强化支架不能保护倒置主体免于高速损毁',()=>{
 const s=atTarget(0,14),f=frame(s.level,s.level.platforms[1]);s.angle+=Math.PI;s.vx=-f.n.x*30;s.vy=-f.n.y*30;s.step(false,0);
 assert.equal(s.state,'failed');assert.ok(s.bodyImpact>14);assert.ok(s.legs.every(l=>!l.broken));
});
test('接触不会立即通关，燃料为零也可等待完整稳定时间后通关',()=>{
 const s=atTarget();s.fuel=0;s.step(false,0);assert.equal(s.state,'flying');settle(s);assert.equal(s.state,'won');assert.ok(s.elapsed>=s.landing.hold);
 const result=scoreFlight(s,LEVELS[0]);assert.equal(result.stars,1);
});
test('持续推力、过大自转或平台外接触不计稳定着陆',()=>{
 const s=atTarget(6);s.step(true,0);assert.equal(s.landedTime,0);
 const spin=atTarget(6);spin.omega=1.5;spin.step(false,0);assert.equal(spin.landedTime,0);
 const off=atTarget(6),f=frame(off.level,off.level.platforms[1]);off.x+=f.t.x*80;off.y+=f.t.y*80;off.step(false,0);assert.equal(off.landedTime,0);
});
test('第八关单腿依靠真实主体接触稳定迫降，可通关但无三星',()=>{
 const s=atTarget(7,9);s.angle-=.78;s.legs[0].broken=true;s.legs[0].health=0;settle(s);
 assert.equal(s.state,'won');assert.equal(s.result,'recovered');assert.equal(s.contacts[0],false);assert.ok(s.bodyImpact<14);assert.ok(s.elapsed>=s.landing.emergencyHold);assert.ok(scoreFlight(s,LEVELS[7]).stars<3);
});
test('关卡切换完整重置损伤、速度、检查点、计时、救援和接触',()=>{
 const s=atTarget();s.rescued=true;s.rescueCount=2;s.bodyImpact=8;s.legs[0].broken=true;s.vx=20;s.elapsed=55;s.checkpoint={x:1,y:1,vx:0,vy:0,angle:0,omega:0,fuel:10};s.setLevel(LEVELS[5]);
 assert.equal(s.state,'docked');assert.equal(s.fuel,LEVELS[5].initialFuel);assert.equal(s.elapsed,0);assert.equal(s.vx,0);assert.equal(s.bodyImpact,0);assert.equal(s.rescueCount,0);assert.equal(s.checkpoint,undefined);assert.ok(s.legs.every(l=>!l.broken));
});
test('救援修复飞船但保留累计用时与辅助标记',()=>{
 const s=atTarget();s.elapsed=75;s.state='failed';s.rescue();assert.equal(s.elapsed,75);assert.equal(s.rescueCount,1);assert.equal(s.rescued,true);s.rescue();assert.equal(s.rescueCount,2);
});
test('评分至少一星，完好精确着陆三星，损坏和接触速度约束有效',()=>{
 const s=atTarget();settle(s);assert.equal(scoreFlight(s,LEVELS[0]).stars,3);
 s.touchdown.vertical=40;assert.ok(scoreFlight(s,LEVELS[0]).stars<3);
 s.elapsed=9999;s.fuel=0;assert.equal(scoreFlight(s,LEVELS[0]).stars,1);s.state='failed';assert.equal(scoreFlight(s,LEVELS[0]).stars,0);
});
test('空档、解锁、重读、最佳成绩和教学持久化；练习不能解锁',()=>{
 const memory=new Memory(),p=new CampaignProgress(memory),s=atTarget();settle(s);const run=scoreFlight(s,LEVELS[0]);
 assert.equal(p.data.highestUnlocked,1);p.complete(LEVELS[0].id,{...run,practice:true});assert.equal(p.data.highestUnlocked,1);
 p.seen(LEVELS[0].id);p.complete(LEVELS[0].id,run);p.complete(LEVELS[0].id,{...run,stars:1,score:1,time:999,fuel:0});
 const loaded=new CampaignProgress(memory);assert.equal(loaded.data.highestUnlocked,2);assert.equal(loaded.record(LEVELS[0].id).normal?.stars,3);assert.equal(loaded.record(LEVELS[0].id).tutorialSeen,true);
 assert.equal(loaded.record(LEVELS[0].id).normal?.score,run.score);assert.equal(loaded.record(LEVELS[0].id).normal?.time,run.time);
});
test('救援成绩与独立成绩分开保存，救援也能解锁下一关',()=>{
 const p=new CampaignProgress(new Memory()),s=atTarget();s.rescued=true;settle(s);p.complete(LEVELS[0].id,scoreFlight(s,LEVELS[0]));
 assert.equal(p.data.highestUnlocked,2);assert.ok(p.record(LEVELS[0].id).assisted);assert.equal(p.record(LEVELS[0].id).normal,undefined);
 s.rescued=false;p.complete(LEVELS[0].id,scoreFlight(s,LEVELS[0]));assert.ok(p.record(LEVELS[0].id).normal);assert.ok(p.record(LEVELS[0].id).assisted);
});
test('损坏和未来版本存档不覆盖；存储禁用不影响游戏内进度',()=>{
 for(const raw of ['{broken',JSON.stringify({version:99,levels:{}})]){const m=new Memory();m.setItem(SAVE_KEY,raw);const p=new CampaignProgress(m);p.seen(LEVELS[0].id);assert.ok(p.warning);assert.equal(m.getItem(SAVE_KEY),raw);assert.equal(p.data.highestUnlocked,1);}
 const p=new CampaignProgress({getItem:()=>null,setItem:()=>{throw Error('quota');}});p.seen(LEVELS[0].id);assert.ok(p.warning);assert.equal(p.record(LEVELS[0].id).tutorialSeen,true);
});
for(const level of LEVELS.slice(0,8))test(level.title+'：从停泊开始的完整输入航线、确定性回放、结算与解锁',()=>{
 const {flight,report}=flyRoute(level,true);assert.equal(report.state,'won',report.reason);assert.ok(report.time>15&&report.time<level.scoring.three.maxTime);assert.ok(report.fuel>level.initialFuel*.2);assert.ok(report.inputs.some(i=>i.thrust&&i.turn!==0));
 const replayed=replay(level,report.inputs);assert.deepEqual([replayed.x,replayed.y,replayed.fuel,replayed.state],[flight.x,flight.y,flight.fuel,flight.state]);
 const run=scoreFlight(flight,level);assert.ok(run.stars>=1);const p=new CampaignProgress(new Memory());
 for(const prior of LEVELS.filter(l=>l.order<level.order))p.complete(prior.id,{...run,practice:false});
 p.complete(level.id,run);assert.equal(p.record(level.id).completed,true);assert.equal(p.data.highestUnlocked,Math.min(LEVELS.length,level.order+1));
});

test('单星球起终点跨越四分之一至半周；救援关目标在正对面',()=>{
 for(const l of LEVELS.filter(l=>l.order>2&&l.order<=8&&l.planets.length===1)){
  const a=l.platforms.find(p=>p.id===l.start)!,b=l.platforms.find(p=>p.id===l.target)!;
  const delta=Math.abs(Math.atan2(Math.sin(b.angle-a.angle),Math.cos(b.angle-a.angle)));
  assert.ok(delta>=Math.PI/2&&delta<=Math.PI+1e-10);assert.ok(Math.sin(b.angle)>0);
 }
 const s=atTarget(7,150);s.step(true,0);assert.ok(s.vy>0,'南极点火必须朝屏幕下方远离地表');
});
test('低重力滑落显著更慢；推力、转向及耗油仍使用同一飞船参数',()=>{
 const regular=new Flight(LEVELS[0]),low=new Flight(LEVELS[4]);
 for(const s of [regular,low]){s.state='flying';s.y-=100;for(let i=0;i<120;i++)s.step(false,0);}
 assert.ok(low.vy<regular.vy*.25);assert.ok(low.y-(LEVELS[4].planets[0].y-LEVELS[4].planets[0].radius-CONFIG.legY-8-100)<4);
 for(const s of [regular,low]){const fuel=s.fuel;s.step(true,0);assert.ok(Math.abs(fuel-s.fuel-CONFIG.burn*CONFIG.step)<1e-9);}
});
test('行星与伴星拥有千米间隙、大小与重力差异，完整航程实际经历两种主导引力',()=>{
 const l=LEVELS[5],[a,b]=l.planets,gap=Math.hypot(b.x-a.x,b.y-a.y)-a.radius-b.radius;
 assert.ok(gap>1000);assert.ok(a.radius/b.radius>2);assert.ok(a.gravity/b.gravity>=3);assert.ok(l.platforms[1].angle>0);
 const sources=new Set<string>();const {flight}=flyRoute(l,false,s=>sources.add(telemetry(s).gravitySource));
 assert.equal(flight.state,'won');assert.ok(sources.has(a.name!));assert.ok(sources.has(b.name!));
});
test('短航线旧存档保留解锁与旧纪录，新航线成绩和首次教学独立开始',()=>{
 const memory=new Memory(),old={stars:3,score:4000,time:50,fuel:90};
 memory.setItem(SAVE_KEY,JSON.stringify({version:1,highestUnlocked:2,levels:{[LEVELS[0].id]:{completed:true,tutorialSeen:true,normal:old}}}));
 const p=new CampaignProgress(memory);assert.equal(p.data.highestUnlocked,2);assert.deepEqual(p.record(LEVELS[0].id).legacy?.normal,old);assert.equal(p.record(LEVELS[0].id).normal,undefined);assert.equal(p.record(LEVELS[0].id).tutorialSeen,false);
 p.seen(LEVELS[0].id);const again=new CampaignProgress(memory);assert.equal(again.data.highestUnlocked,2);assert.deepEqual(again.record(LEVELS[0].id).legacy?.normal,old);assert.equal(again.record(LEVELS[0].id).tutorialSeen,true);
});

test('两关近距训练依次解锁，再进入原长航线',()=>{
 assert.ok(LEVELS.length>=14);const progress=new CampaignProgress(new Memory());
 for(const [i,level] of LEVELS.slice(0,2).entries()){
  assert.equal(level.order,i+1);assert.equal(progress.unlocked(level.id),true);
  const start=frame(level,level.platforms[0]),target=frame(level,level.platforms[1]);
  const distance=Math.hypot(start.c.x-target.c.x,start.c.y-target.c.y);assert.ok(distance>150&&distance<350);assert.ok(level.platforms[1].width>=128);
  assert.equal(level.planets[0].gravity,30);assert.equal(level.contact.bodyFatalImpact,14);
  const {flight}=flyRoute(level);progress.complete(level.id,scoreFlight(flight,level));assert.equal(progress.data.highestUnlocked,i+2);
 }
 assert.equal(progress.unlocked('first-landing'),true);assert.equal(progress.unlocked('inertia'),false);
});
test('插入训练关后旧长航线成绩与解锁不丢失，也不伪造训练通关',()=>{
 const memory=new Memory(),best={stars:3,score:3700,time:110,fuel:80};
 memory.setItem(SAVE_KEY,JSON.stringify({version:1,highestUnlocked:2,levels:{'first-landing':{completed:true,tutorialSeen:true,routeRevision:2,normal:best}}}));
 const p=new CampaignProgress(memory);assert.equal(p.data.highestUnlocked,4);assert.deepEqual(p.record('first-landing').normal,best);
 assert.equal(p.record('training-launch').completed,false);assert.equal(p.record('training-brake').completed,false);
 p.seen('training-launch');const loaded=new CampaignProgress(memory);assert.equal(loaded.data.highestUnlocked,4);assert.deepEqual(loaded.record('first-landing').normal,best);
});
