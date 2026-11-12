import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Flight,CONFIG,LEVEL,frame} from '../src/physics';
test('停泊十分钟不坠毁、不耗油且不能靠旋转脱离',()=>{
 const s=new Flight(),x=s.x,y=s.y;
 for(let i=0;i<72000;i++)s.step(false,1);
 assert.equal(s.state,'docked');assert.equal(s.x,x);assert.equal(s.y,y);assert.equal(s.fuel,100);
});
test('主动点火才进入飞行并向外爬升',()=>{
 const s=new Flight(),y=s.y;for(let i=0;i<120;i++)s.step(true,0);
 assert.equal(s.state,'flying');assert.ok(s.y<y-10);assert.ok(s.fuel<100);
});
test('单支架断裂不结束任务，仍可点火与旋转',()=>{
 const s=new Flight();s.state='flying';s.y-=100;s.legs[0].broken=true;s.legs[0].health=0;
 s.step(true,1);assert.equal(s.state,'flying');assert.ok(s.vy<0);assert.ok(s.omega>0);
});
test('断裂支架移除真实接触点',()=>{
 const s=new Flight();s.state='flying';s.legs.forEach(l=>l.broken=true);s.y+=2;s.step(false,0);
 assert.deepEqual(s.contacts,[false,false]);assert.ok(s.vy>0);
});
test('主体在支架完好时也独立判定致命冲击',()=>{
 const s=new Flight();s.state='flying';s.angle=Math.PI;s.y=83;s.vy=30;
 s.step(false,0);assert.equal(s.state,'failed');assert.ok(s.bodyImpact>CONFIG.bodyFatalImpact);assert.ok(s.legs.every(l=>!l.broken));
});
test('目标平台稳定接触能够通关',()=>{
 const s=new Flight(),pad=LEVEL.platforms[1],f=frame(LEVEL,pad);s.state='flying';
 s.x=f.c.x+f.n.x*(CONFIG.legY-.2);s.y=f.c.y+f.n.y*(CONFIG.legY-.2);s.angle=pad.angle+Math.PI/2;
 for(let i=0;i<1000&&s.state==='flying';i++)s.step(false,0);
 assert.equal(s.state,'won');
});
test('高速撞击能使支架断裂且不会自动宣告失败',()=>{
 const s=new Flight();s.state='flying';s.y+=.1;s.vy=44;s.step(false,0);
 assert.ok(s.legs.some(l=>l.broken));assert.equal(s.state,'flying');
});
test('救援返回减速后的安全检查点且修复支架',()=>{
 const s=new Flight();s.checkpoint={x:0,y:-40,vx:3,vy:0,angle:0,omega:0,fuel:50};s.state='failed';s.legs[0].broken=true;
 s.rescue();assert.equal(s.state,'flying');assert.equal(s.y,-40);assert.equal(s.vx,3);assert.ok(s.legs.every(l=>!l.broken));
});
