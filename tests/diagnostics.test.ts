import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PlaytestDiagnostics,DIAGNOSTICS_KEY,MAX_ATTEMPTS} from '../src/diagnostics';
import {SAVE_KEY,type StoragePort} from '../src/progress';
class Memory implements StoragePort {
  data=new Map<string,string>();writes=0;
  getItem(k:string){return this.data.get(k)??null;}
  setItem(k:string,v:string){this.writes++;this.data.set(k,v);}
}
const snapshot={seconds:20,fuel:70,assisted:false,rescues:0,reason:''};
const now=()=> '2026-10-14T04:00:00.000Z';
test('试玩失败、重试、首次独立成功及退出分别记录，结果重绘不重复',()=>{
  const d=new PlaytestDiagnostics(new Memory(),now);
  d.begin('training-launch','manual');d.result('failed',{...snapshot,reason:'主体撞击'});d.result('failed',snapshot);d.leave('retry',snapshot);
  d.begin('training-launch','manual');d.result('won',snapshot);d.leave('menu',{...snapshot,seconds:999});
  const report=d.exportReport(),summary=report.levels[0];
  assert.equal(report.attempts.length,2);assert.equal(report.attempts[0].failures[0].reason,'主体撞击');
  assert.equal(summary.failures,1);assert.equal(summary.retries,1);assert.equal(summary.attemptsToFirstUnassistedWin,2);
  assert.equal(report.attempts[1].seconds,20);assert.equal(summary.unassistedWins,1);
  assert.equal(summary.activeSecondsToFirstUnassistedWin,40);
});
test('浏览器往返缓存恢复同次尝试，初始燃料与结果不丢失',()=>{
  const d=new PlaytestDiagnostics(new Memory(),now);d.begin('precision','manual',snapshot);
  assert.equal(d.exportReport().attempts[0].fuel,70);
  d.leave('pagehide',snapshot);d.resumePage();d.resumePage();d.result('won',snapshot);
  assert.equal(d.exportReport().attempts.length,1);assert.equal(d.exportReport().levels[0].interrupted,0);
  assert.equal(d.exportReport().levels[0].unassistedWins,1);
  d.leave('retry',snapshot);d.begin('precision','manual');d.result('failed',{...snapshot,reason:'冲击'});
  d.leave('pagehide',snapshot);d.resumePage();d.rescue({...snapshot,assisted:true,rescues:1});
  d.result('won',{...snapshot,assisted:true,rescues:1});
  assert.equal(d.exportReport().levels[0].assistedWins,1);assert.equal(d.exportReport().levels[0].failures,1);
});
test('练习与QA排除，开始后取消或重试计为放弃',()=>{
  const store=new Memory(),d=new PlaytestDiagnostics(store,now);
  for(const mode of ['practice','qa'] as const){d.begin('training-launch',mode);d.result('won',snapshot);d.leave('retry',snapshot);}
  assert.equal(store.writes,0);assert.equal(d.exportReport().attempts.length,0);
  d.begin('training-launch','manual');d.leave('retry',snapshot);
  assert.equal(d.exportReport().levels[0].abandoned,1);assert.equal(d.exportReport().levels[0].retries,1);
});
test('失败后救援继续同次尝试，保留失败原因和辅助状态',()=>{
  const d=new PlaytestDiagnostics(new Memory(),now);d.begin('moving-gate','manual');
  d.result('failed',{...snapshot,reason:'巡游岩体'});
  d.rescue({...snapshot,assisted:true,rescues:1});d.result('won',{...snapshot,seconds:50,assisted:true,rescues:1});
  const report=d.exportReport();assert.equal(report.attempts.length,1);assert.equal(report.attempts[0].failures.length,1);
  assert.equal(report.levels[0].assistedWins,1);assert.equal(report.levels[0].unassistedWins,0);
  assert.equal(report.levels[0].attemptsToFirstUnassistedWin,null);
});
test('页面关闭与未结束后重新加载不伪装成失败或成功',()=>{
  const store=new Memory(),d=new PlaytestDiagnostics(store,now);d.begin('precision','manual');d.leave('pagehide',snapshot);
  const again=new PlaytestDiagnostics(store,now);again.begin('precision','manual');
  const loaded=new PlaytestDiagnostics(store,now).exportReport();
  assert.equal(loaded.levels[0].interrupted,2);assert.equal(loaded.levels[0].failures,0);
  assert.equal(loaded.attempts[0].departure,'pagehide');assert.equal(loaded.attempts[1].departure,'reload');
});
test('记录有界、独立存储、不改战役进度，导出为副本',()=>{
  const store=new Memory();store.data.set(SAVE_KEY,'original save');const d=new PlaytestDiagnostics(store,now);
  for(let i=0;i<MAX_ATTEMPTS+3;i++){d.begin('precision','manual');d.result('failed',{...snapshot,reason:'冲击'});d.leave('retry',snapshot);}
  const report=d.exportReport();assert.equal(report.attempts.length,MAX_ATTEMPTS);assert.equal(report.attempts[0].id,4);
  report.attempts[0].failures[0].reason='modified';assert.equal(d.exportReport().attempts[0].failures[0].reason,'冲击');
  assert.equal(store.data.get(SAVE_KEY),'original save');assert.equal(new PlaytestDiagnostics(store,now).exportReport().attempts.length,MAX_ATTEMPTS);
});
test('损坏、未知版本与非法记录保留原值，新记录仍可导出',()=>{
  for(const raw of ['{broken',JSON.stringify({version:2}),JSON.stringify({version:1,nextId:2,attempts:[{id:1}]})]){
    const store=new Memory();store.data.set(DIAGNOSTICS_KEY,raw);const d=new PlaytestDiagnostics(store,now);
    d.begin('precision','manual');d.result('won',snapshot);assert.equal(store.data.get(DIAGNOSTICS_KEY),raw);
    assert.ok(d.warning);assert.equal(d.exportReport().attempts.length,1);
  }
});
test('存储禁用或写入失败不阻止游玩与导出',()=>{
  for(const store of [undefined,{getItem:()=>null,setItem:()=>{throw new Error('quota');}}]){
    const d=new PlaytestDiagnostics(store,now);d.begin('precision','manual');d.result('won',snapshot);
    assert.ok(d.warning);assert.equal(d.exportReport().levels[0].unassistedWins,1);
  }
});
