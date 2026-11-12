import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FrameDiagnostics,MAX_PERFORMANCE_RUNS} from '../src/performance';
test('帧间隔保留长帧及分布，不使用物理截断值',()=>{
 const d=new FrameDiagnostics();d.begin('a',true);for(const t of [0,16,36,96,396])d.sample(t,true,false);
 const g=d.exportReport().runs[0].groups[0];assert.equal(g.samples,4);assert.equal(g.totalMs,396);assert.equal(g.maxMs,300);assert.deepEqual(g.buckets,[1,1,0,1,0,1]);
});
test('暂停、失焦和模式切换的第一帧不将间隙算作卡顿',()=>{
 const d=new FrameDiagnostics();d.begin('a',true);d.sample(0,true,false);d.sample(16,true,false);d.gap();d.sample(10000,true,false);d.sample(10016,true,false);
 d.sample(10020,false,false);d.sample(20000,true,true);d.sample(20020,true,true);d.sample(30000,true,false);d.sample(30016,true,false);
 const groups=d.exportReport().runs[0].groups;assert.equal(groups[0].totalMs,48);assert.equal(groups[1].totalMs,20);
});
test('练习与 QA 排除、最近二十次有界、导出不暴露内部引用',()=>{
 const d=new FrameDiagnostics();d.begin('practice',false);d.sample(0,true,false);d.sample(16,true,false);assert.equal(d.exportReport().runs.length,0);
 for(let i=0;i<25;i++){d.begin(String(i),true);d.sample(0,true,false);d.sample(16,true,false);}
 const report=d.exportReport();assert.equal(report.runs.length,MAX_PERFORMANCE_RUNS);assert.equal(report.runs[0].levelId,'5');report.runs[0].groups[0].buckets[0]=999;assert.equal(d.exportReport().runs[0].groups[0].buckets[0],1);
});
test('非法时钟和重新开始不跨任务累计',()=>{
 const d=new FrameDiagnostics();d.begin('a',true);d.sample(0,true,false);d.sample(NaN,true,false);d.sample(1000,true,false);d.sample(1016,true,false);
 d.begin('b',true);d.sample(5000,true,false);assert.equal(d.exportReport().runs[0].groups[0].samples,1);assert.deepEqual(d.exportReport().runs[1].groups,[]);
});
