import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TiltState,TiltControl,TiltSafety,tiltRateCommand,TILT_RATE} from '../src/tilt';
test('signal loss latches safety pause; fresh signal alone cannot resume, explicit recovery or buttons can',()=>{
 const state=new TiltState(),guard=new TiltSafety();state.sample(0,0,0,0);
 assert.equal(guard.check(true,state.fresh(999)),false);
 assert.equal(guard.check(true,state.fresh(1000)),true);
 assert.equal(guard.resume(true,state.fresh(1001)),false);
 state.sample(0,10,0,1100);
 assert.equal(guard.check(true,state.fresh(1101)),true);
 state.calibrate();assert.equal(guard.resume(true,state.fresh(1102)),false);
 state.sample(0,10,0,1103);assert.equal(state.targetRate(1103),0);
 assert.equal(guard.resume(true,state.fresh(1103)),true);
 assert.equal(guard.check(true,state.fresh(2103)),true);
 assert.equal(guard.resume(false,false),true);assert.equal(guard.check(false,false),false);
 guard.check(true,false);guard.reset();assert.equal(guard.interrupted,false);
});
test('倾斜以握姿为零点，死区抑制抖动、幅度决定目标转速；无效/过期信号不转向',()=>{
 const s=new TiltState();s.sample(30,12,0,0);assert.equal(s.targetRate(0),0);
 s.sample(30,22,0,10);assert.ok(s.targetRate(10)>0&&s.targetRate(10)<TILT_RATE.maxSpeed);
 s.sample(30,18,0,20);assert.ok(s.targetRate(20)>0&&s.targetRate(20)<.2);
 s.sample(30,14,0,30);assert.equal(s.targetRate(30),0);
 s.sample(30,0,0,40);assert.ok(s.targetRate(40)<0);
 s.sample(null,null,0,1000);assert.equal(s.targetRate(1040),0);
 s.sample(30,NaN,0,2000);assert.equal(s.fresh(2000),false);
 s.clear();assert.equal(s.targetRate(40),0);
});
test('校准和屏幕方向切换重新归零，横屏按屏幕方向映射',()=>{
 const s=new TiltState();s.sample(0,0,0,0);s.sample(0,15,0,1);assert.ok(s.targetRate(1)>0);
 s.calibrate();s.sample(0,15,0,2);assert.equal(s.targetRate(2),0);
 s.sample(20,15,90,3);assert.equal(s.targetRate(3),0);s.sample(31,15,90,4);assert.ok(s.targetRate(4)>0);
 s.sample(20,15,270,5);assert.equal(s.targetRate(5),0);s.sample(31,15,270,6);assert.ok(s.targetRate(6)<0);
});
test('传感器权限拒绝/不支持安全失败；收到有效数据才开启，关闭后不再采样',async()=>{
 const target=Object.assign(new EventTarget(),{DeviceOrientationEvent:{requestPermission:async()=>'denied'},screen:{orientation:{angle:0}}});
 const control=new TiltControl(target as unknown as Window);
 await assert.rejects(control.enable(),/权限/);assert.equal(control.enabled,false);
 target.DeviceOrientationEvent.requestPermission=async()=>'granted';
 const pending=control.enable();await Promise.resolve();
 const event=new Event('deviceorientation');Object.assign(event,{beta:30,gamma:0});target.dispatchEvent(event);
 await pending;assert.equal(control.enabled,true);control.disable();target.dispatchEvent(event);assert.equal(control.state.fresh(performance.now()),false);
 await assert.rejects(new TiltControl(new EventTarget() as unknown as Window).enable(),/不支持/);
});
test('授权尚未返回时切换按钮模式，不允许迟到授权重新启用',async()=>{
 let grant!:(s:string)=>void;
 const target=Object.assign(new EventTarget(),{DeviceOrientationEvent:{requestPermission:()=>new Promise<string>(r=>{grant=r;})}});
 const control=new TiltControl(target as unknown as Window),pending=control.enable();control.disable();grant('granted');await assert.rejects(pending);assert.equal(control.enabled,false);
});

import {Flight,CONFIG} from '../src/physics';
import {LEVELS} from '../src/levels';
import {replay,type ReplayInput} from '../src/replay';
import {GameSettings} from '../src/settings';
test('1.5倍倾斜目标可实际达到1.8，按钮上限和默认模式保持原值',()=>{
 assert.equal(new GameSettings().data.controlMode,'buttons');
 const state=new TiltState();state.sample(0,0,0,0);
 for(const angle of [-30,-17,4,17,30]){
  state.sample(0,angle,0,1);
  const old=Math.sign(angle)*Math.min(1,Math.max(0,(Math.abs(angle)-4)/26))*1.2;
  assert.ok(Math.abs(state.targetRate(1)-old*1.5)<1e-12);
 }
 for(const sign of [-1,1]){
  const flight=new Flight(LEVELS[0]);flight.state='flying';flight.y=-1000;
  for(let n=0;n<360;n++)flight.step(false,tiltRateCommand(sign*1.8,flight.omega),CONFIG.step,true);
  assert.ok(Math.abs(flight.omega-sign*1.8)<.01);
  const before=flight.omega;flight.step(false,tiltRateCommand(0,flight.omega),CONFIG.step,true);
  assert.ok(Math.abs(flight.omega)<Math.abs(before)&&Math.abs(flight.omega)>1.65);
 }
 const buttons=new Flight(LEVELS[0]);buttons.state='flying';buttons.y=-1000;
 for(let n=0;n<360;n++)buttons.step(false,1);
 assert.equal(buttons.omega,1.65);
 const live=new Flight(LEVELS[0]),inputs:ReplayInput[]=[];
 for(let n=0;n<120;n++){
  const i:ReplayInput={thrust:true,turn:tiltRateCommand(1.8,live.omega),tiltRate:true};inputs.push(i);
  live.step(i.thrust,i.turn,CONFIG.step,true);
 }
 assert.ok(live.omega>1.65);const played=replay(LEVELS[0],inputs);
 assert.equal(played.angle,live.angle);assert.equal(played.omega,live.omega);assert.equal(played.fuel,live.fuel);
});
test('倾斜目标转速连续单调、有死区和上限',()=>{
 const s=new TiltState();s.sample(0,0,0,0);let previous=0;
 for(const degrees of [0,3,4,5,10,20,30,45]){s.sample(0,degrees,0,1);const rate=s.targetRate(1);assert.ok(rate>=previous&&rate<=TILT_RATE.maxSpeed);previous=rate;}
 assert.equal(previous,TILT_RATE.maxSpeed);s.sample(0,-30,0,2);assert.equal(s.targetRate(2),-TILT_RATE.maxSpeed);
});
test('实际物理追踪不同目标转速，回中平滑停转且不回正，碰撞角速度不被覆盖',()=>{
 const flight=new Flight(LEVELS[0]);flight.state='flying';flight.y=-1000;flight.angle=.7;
 const advance=(target:number,steps:number)=>{for(let i=0;i<steps;i++){const command=tiltRateCommand(target,flight.omega);assert.ok(Math.abs(command)<=1);flight.step(false,command);}};
 advance(.3,240);assert.ok(Math.abs(flight.omega-.3)<.01);
 advance(.9,240);assert.ok(Math.abs(flight.omega-.9)<.01);
 const before=flight.angle,oldOmega=flight.omega;advance(0,1);assert.ok(flight.omega>0&&flight.omega<oldOmega);
 advance(0,360);assert.ok(Math.abs(flight.omega)<.001);assert.ok(Math.abs(flight.angle-before)>.01);
 const stopped=flight.angle;advance(0,120);assert.ok(Math.abs(flight.angle-stopped)<.001);
 flight.omega=-1.5;const collisionOmega=flight.omega;const command=tiltRateCommand(.9,flight.omega);assert.equal(flight.omega,collisionOmega);flight.step(false,command);assert.ok(flight.omega<0,'受扰后不能直接跳到目标转速');
 assert.ok(flight.vy>0,'引力仍生效');assert.ok(flight.fuel<LEVELS[0].initialFuel,'姿态喷口仍耗油');
});
test('最终转向指令可用原物理逐步回放，不需要传感器或角速度捷径',()=>{
 const a=new Flight(LEVELS[0]),b=new Flight(LEVELS[0]);
 for(let i=0;i<600;i++){const target=i<120?.2:i<240?-.4:0,turn=tiltRateCommand(target,a.omega);a.step(i<300,turn);b.step(i<300,turn);}
 assert.equal(a.angle,b.angle);assert.equal(a.omega,b.omega);assert.equal(a.x,b.x);assert.equal(a.fuel,b.fuel);
 assert.equal(tiltRateCommand(NaN,0),0);
});
