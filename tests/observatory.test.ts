import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LEVELS,RETIRED_FINALE} from '../src/levels';
import {Flight,gravityAt,frame} from '../src/physics';
import {rotatingSystem,blackHoleView,observationRoute} from '../src/observatory';
import {flyRoute} from '../src/replay';
import {CampaignProgress} from '../src/progress';
import {scoreFlight} from '../src/scoring';
const level=LEVELS[29],station=level.platforms[1].station!,hole=level.planets[1];

test('L1满足旋转参考系平衡，靠近较小行星且沿连线不稳定',()=>{
 const a=level.planets[0],b=hole,d=b.x-a.x,orbit=rotatingSystem(a.gravity*a.radius**2,b.gravity*b.radius**2,d);
 assert.ok(station.x>a.radius&&station.x<d/2);assert.equal(station.x,orbit.l1);
 assert.ok(Math.abs(gravityAt(level,station).x)<1e-12);assert.equal(gravityAt(level,station).y,0);
 assert.ok(gravityAt(level,{x:station.x-10,y:station.y}).x<0);
 assert.ok(gravityAt(level,{x:station.x+10,y:station.y}).x>0);
 assert.equal(frame(level,level.platforms[1]).c,station);
});
test('研究站捕获力有限且只在甲板上方，不移动飞船或强制姿态',()=>{
 const noDeck={...level,platforms:[]};
 for(const [dx,dy,expected] of [[0,-25,2],[0,-61,0],[70,-25,0],[0,5,0]]){
  const q={x:station.x+dx,y:station.y+dy},withDeck=gravityAt(level,q),without=gravityAt(noDeck,q);
  assert.ok(Math.abs(withDeck.y-without.y-expected)<1e-10);
 }
 const f=new Flight(level);f.state='flying';f.x=station.x;f.y=station.y-45;f.angle=.1;
 f.step(false,0);assert.equal(f.angle,.1);assert.ok(f.y<station.y-44.99);assert.equal(f.state,'flying');
});
test('实际输入可先观察完整黑洞再返回L1，三星无损，未越界或补油',()=>{
 const tour={...level,verificationRoute:observationRoute(level)};let observed=false;
 const {flight}=flyRoute(tour,false,f=>{if(f.x>3800)observed=true;});
 assert.equal(observed,true);assert.equal(flight.state,'won');assert.equal(scoreFlight(flight,level).stars,3);
 assert.ok(flight.fuel>level.initialFuel*.5);assert.equal(flight.bodyImpact,0);assert.ok(flight.legs.every(l=>l.health===100));
});
test('潮汐危险区真实终止飞行，高速掠入不会穿过，救援不返回内圈',()=>{
 const f=new Flight(level);f.state='flying';f.x=hole.x-hole.radius*4;f.y=hole.y;f.vx=60000;
 f.step(false,0);assert.equal(f.state,'failed');assert.match(f.reason,/潮汐/);
 assert.ok(Math.abs(Math.hypot(f.x-hole.x,f.y-hole.y)-hole.radius*2.8)<1e-6);
 f.checkpoint={x:hole.x-400,y:hole.y,vx:0,vy:0,angle:0,omega:0,fuel:100};f.rescue();
 assert.equal(f.state,'docked');assert.ok(f.x<station.x);
});
test('黑洞观测镜头包含吸积盘与飞船，远离黑洞保持原跟随',()=>{
 assert.equal(blackHoleView(level,station.x,station.y,390,700),undefined);
 for(const [w,h] of [[390,700],[320,568],[480,800]]){
  const view=blackHoleView(level,3900,-200,w,h)!;assert.ok(view);
  for(const x of [3900,hole.x-hole.radius*10,hole.x+hole.radius*10])assert.ok(Math.abs(x-view.x)*view.zoom<w/2);
  assert.ok(view.zoom<.3);
 }
});
test('旧终关成绩迁移为历史记录，新研究站不冒充已三星且可正常挑战',()=>{
 const best={stars:3,score:4000,time:214,fuel:106};let raw=JSON.stringify({version:1,catalogRevision:2,unlockedFloor:1,
 levels:Object.fromEntries([...LEVELS.slice(0,29),RETIRED_FINALE].map(l=>[l.id,{routeRevision:2,tutorialSeen:true,normal:best,assisted:{...best,score:3500}}]))});
 const storage={getItem:()=>raw,setItem:(_k:string,v:string)=>{raw=v;}},p=new CampaignProgress(storage);
 assert.equal(p.data.highestUnlocked,30);assert.equal(p.record(level.id).normal,undefined);assert.equal(p.record(level.id).tutorialSeen,false);
 assert.deepEqual(p.record(level.id).legacy?.normal,best);assert.equal(p.record(level.id).legacy?.assisted?.score,3500);
 p.complete(level.id,scoreFlight(flyRoute(level).flight,level));const restored=new CampaignProgress(storage);
 assert.equal(restored.record(level.id).normal?.stars,3);assert.deepEqual(restored.record(level.id).legacy?.normal,best);
 for(const l of LEVELS.slice(0,29))assert.deepEqual(restored.record(l.id).normal,best);
});
