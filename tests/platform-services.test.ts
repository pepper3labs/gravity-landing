import {test} from 'node:test';
import assert from 'node:assert/strict';
import {platformServices,serviceMode,CallbackRewardedAd,noopRewardedPort,type AdSignal} from '../src/platform-services';
import {RewardedAction} from '../src/rewarded-action';
test('取消立即释放广告请求，通知端口清理，旧回调不污染下一次',async()=>{
 const callbacks:((r:AdSignal)=>void)[]=[],lifetimes:AbortSignal[]=[];let cleaned=0,rewards=0;
 const ad=new CallbackRewardedAd({open:(_p,cb,life)=>{callbacks.push(cb);lifetimes.push(life);life.addEventListener('abort',()=>cleaned++);}});
 const action=new RewardedAction(),first=action.run(ad,'rescue',()=>rewards++);
 action.cancel();assert.equal(lifetimes[0].aborted,true);assert.equal(await first,'stale');
 const next=action.run(ad,'double-coins',()=>rewards++);callbacks[0]('completed');assert.equal(rewards,0);
 callbacks[1]('completed');assert.equal(await next,'completed');assert.equal(rewards,1);assert.equal(cleaned,2);
});
test('广告超时/失败/取消/正常结束都清理端口，预取消不展示',async()=>{
 for(const result of ['completed','cancelled','failed','timeout'] as const){
  let lifetime!:AbortSignal;
  const ad=new CallbackRewardedAd({open:(_p,cb,life)=>{lifetime=life;if(result!=='timeout')cb(result);}},5);
  if(result==='failed'||result==='timeout')await assert.rejects(()=>ad.show('rescue'));
  else assert.equal(await ad.show('rescue'),result==='completed');
  assert.equal(lifetime.aborted,true);
 }
 let opened=0;const abort=new AbortController();abort.abort();
 await assert.rejects(()=>new CallbackRewardedAd({open:()=>{opened++;}}).show('rescue',abort.signal));assert.equal(opened,0);
});
test('默认仅本地模式；未知服务模式拒绝启动；无在线提供方时失败关闭',async()=>{
 assert.equal(serviceMode(undefined),'local');assert.equal(serviceMode(''),'local');assert.throws(()=>serviceMode('online'));assert.throws(()=>serviceMode('typo'));
 const local=platformServices('local');assert.equal(local.adAvailable,true);assert.equal(local.online,false);
 await assert.rejects(()=>new CallbackRewardedAd(noopRewardedPort).show('rescue'),/广告未完成或不可用/);
});
test('广告显示成功不是完成，只有有效完成信号才发奖，重复信号忽略',async()=>{
 let signal!:(r:AdSignal)=>void,rewards=0;const action=new RewardedAction();
 const ad=new CallbackRewardedAd({open:(_p,cb)=>{signal=cb;return Promise.resolve();}});
 const pending=action.run(ad,'rescue',()=>rewards++);await Promise.resolve();assert.equal(rewards,0);
 signal('completed');signal('completed');signal('failed');assert.equal(await pending,'completed');assert.equal(rewards,1);
});
test('取消、抛错、拒绝与超时不发奖；迟到完成无效',async()=>{
 let late!:(r:AdSignal)=>void;let rewards=0;const action=new RewardedAction();
 for(const port of [{open:(_p:unknown,cb:(r:AdSignal)=>void)=>cb('cancelled')},{open:()=>{throw new Error('offline');}},{open:()=>Promise.reject(new Error('offline'))},{open:(_p:unknown,cb:(r:AdSignal)=>void)=>{late=cb;}}]){
  const r=await action.run(new CallbackRewardedAd(port,5),'rescue',()=>rewards++);assert.notEqual(r,'completed');
 }
 late('completed');assert.equal(rewards,0);
});
test('离开后完成不发奖，旧回调不会影响下一次展示',async()=>{
 const signals:((r:AdSignal)=>void)[]=[];const ad=new CallbackRewardedAd({open:(_p,cb)=>{signals.push(cb);}}),action=new RewardedAction();let rewards=0;
 const first=action.run(ad,'rescue',()=>rewards++);action.cancel();signals[0]('completed');assert.equal(await first,'stale');
 const next=action.run(ad,'rescue',()=>rewards++);signals[0]('completed');assert.equal(rewards,0);signals[1]('completed');assert.equal(await next,'completed');assert.equal(rewards,1);
});
