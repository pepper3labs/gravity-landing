import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, Flight, LEVEL, frame } from '../src/physics';
import { guidance, telemetry } from '../src/feedback';
import { smooth } from '../src/camera';

function atTarget() {
  const s=new Flight(),pad=LEVEL.platforms[1],f=frame(LEVEL,pad);
  s.state='flying';s.x=f.c.x+f.n.x*(CONFIG.legY-.2);s.y=f.c.y+f.n.y*(CONFIG.legY-.2);s.angle=pad.angle+Math.PI/2;
  return s;
}
function settle(s:Flight) {for(let i=0;i<1200&&s.state==='flying';i++)s.step(false,0);}
test('松开旋转后自动抑制自转，保留当前朝向和固定步惯性',()=>{
  const s=new Flight();s.state='flying';s.y-=300;
  for(let i=0;i<60;i++)s.step(false,1);
  const omega=s.omega,angle=s.angle;
  for(let i=0;i<120;i++)s.step(false,0);
  assert.ok(Math.abs(s.omega)<omega*.1);assert.ok(s.angle>angle);
});
test('完美、受损、广告救援后的着陆具有不同结果',()=>{
  const perfect=atTarget();settle(perfect);assert.equal(perfect.result,'perfect');
  const damaged=atTarget();damaged.legs[0].health=65;settle(damaged);assert.equal(damaged.result,'damaged');
  const rescued=atTarget();rescued.rescued=true;settle(rescued);assert.equal(rescued.result,'recovered');
});
test('单腿断裂后可以依靠真实的轻微主体接触迫降，断腿不恢复碰撞',()=>{
  const s=atTarget(),pad=LEVEL.platforms[1],f=frame(LEVEL,pad);
  s.legs[0].broken=true;s.legs[0].health=0;s.angle-=.78;s.x=f.c.x+f.n.x*9;s.y=f.c.y+f.n.y*9;
  settle(s);assert.equal(s.state,'won');assert.equal(s.result,'recovered');
  assert.equal(s.legs[0].broken,true);assert.equal(s.contacts[0],false);assert.ok(s.bodyImpact<CONFIG.bodyFatalImpact);
});
test('断腿后仅剩一侧支撑产生实际倾倒，而不是立即失败',()=>{
  const s=new Flight();s.state='flying';s.legs[0].broken=true;s.y+=.5;
  for(let i=0;i<35;i++)s.step(false,0);
  assert.equal(s.state,'flying');assert.ok(Math.abs(s.angle)>.03);assert.equal(s.contacts[0],false);
});
test('严重主体碰撞提供独立冲击、下降速度、姿态和可执行建议',()=>{
  const s=new Flight();s.state='flying';s.angle=Math.PI;s.y=83;s.vy=30;s.step(false,0);
  assert.equal(s.state,'failed');assert.ok(s.failure!.impact>14);assert.ok(s.failure!.descent>20);assert.ok(s.failure!.advice.includes('提前点火'));
  assert.ok(s.drainEvents().some(e=>e.type==='failed'));
});
test('危险下降根据制动距离及时预警',()=>{
  const s=new Flight();s.state='flying';s.y=20;s.vy=40;
  assert.equal(guidance(s).id,'danger');assert.ok(telemetry(s).stoppingDistance>15);
});
test('视觉事件消费不改变物理状态，接触事件只在冲击时触发',()=>{
  const a=atTarget(),b=atTarget();a.vy=b.vy=8;
  for(let i=0;i<360;i++){a.step(false,0);a.drainEvents();b.step(false,0);}
  assert.deepEqual([a.x,a.y,a.vx,a.vy,a.state],[b.x,b.y,b.vx,b.vy,b.state]);
  assert.ok(b.events.length<20);
});
test('镜头指数平滑在30和120帧下达到相同位置',()=>{
  let a=0,b=0;
  for(let i=0;i<30;i++)a=smooth(a,100,4,1/30);
  for(let i=0;i<120;i++)b=smooth(b,100,4,1/120);
  assert.ok(Math.abs(a-b)<1e-8);
});
