import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MockRewardedAd,type RewardedAd} from '../src/services';
import {RewardedAction} from '../src/rewarded-action';
function deferred(){
  let resolve!:(value:boolean)=>void,reject!:(reason:Error)=>void;
  const promise=new Promise<boolean>((yes,no)=>{resolve=yes;reject=no;});
  return {ad:{show:()=>promise} satisfies RewardedAd,resolve,reject};
}
test('只有有效完成才发奖，取消与异常后可重新请求',async()=>{
  const action=new RewardedAction();let rewards=0;
  for(const outcome of ['cancelled','failed','completed'] as const){
    assert.equal(await action.run(new MockRewardedAd(outcome,async()=>{}),'rescue',()=>rewards++),outcome);
    assert.equal(action.busy,false);
  }
  assert.equal(rewards,1);
});
test('重复点击不启动第二次展示，重复完成信号只结算一次',async()=>{
  const action=new RewardedAction(),pending=deferred();let rewards=0,calls=0;
  const ad:RewardedAd={show:()=>{calls++;return pending.ad.show();}};
  const first=action.run(ad,'double-coins',()=>rewards++);
  assert.equal(await action.run(ad,'double-coins',()=>rewards++),'busy');
  pending.resolve(true);pending.resolve(true);assert.equal(await first,'completed');
  assert.equal(calls,1);assert.equal(rewards,1);
});
test('主动取消或离开后，迟到的完成结果不发奖',async()=>{
  const action=new RewardedAction(),pending=deferred();let rewards=0;
  const task=action.run(pending.ad,'rescue',()=>rewards++);action.cancel();
  assert.equal(action.busy,false);pending.resolve(true);assert.equal(await task,'stale');assert.equal(rewards,0);
});
test('旧请求迟到不清除新请求的忙状态或误发奖励',async()=>{
  const action=new RewardedAction(),old=deferred(),current=deferred();let rewards=0;
  const oldTask=action.run(old.ad,'rescue',()=>rewards++);action.cancel();
  const currentTask=action.run(current.ad,'rescue',()=>rewards++);
  old.resolve(true);assert.equal(await oldTask,'stale');assert.equal(action.busy,true);assert.equal(rewards,0);
  current.resolve(true);assert.equal(await currentTask,'completed');assert.equal(action.busy,false);assert.equal(rewards,1);
});
test('同步抛错及取消后的异步拒绝均不会留下未处理异常或忙状态',async()=>{
  const action=new RewardedAction();let rewards=0;
  assert.equal(await action.run({show:()=>{throw new Error('offline');}},'rescue',()=>rewards++),'failed');
  const pending=deferred(),task=action.run(pending.ad,'rescue',()=>rewards++);action.cancel();pending.reject(new Error('late'));
  assert.equal(await task,'stale');assert.equal(action.busy,false);assert.equal(rewards,0);
});
