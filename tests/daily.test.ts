import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dailyCourse,DAILY_POOL,DAILY_KEY,DAILY_MAX_STEPS,DailyRecorder,DailyRecords,validateDailyRun,compareDaily} from '../src/daily';
import {levelById} from '../src/levels';
import {flyRoute} from '../src/replay';
import {scoreTaskFlight as scoreFlight} from '../src/star-tasks';
const flags={practice:false,assisted:false,rescues:0};
const date=new Date('2026-10-15T00:00:00Z'),course=dailyCourse(date);
const route=flyRoute(levelById(course.levelId)!,true);
test('每日日期采用北京时间午夜，同日时区表达一致且关卡池完整轮换',()=>{
 assert.deepEqual(course,dailyCourse(new Date('2026-10-15T15:59:59Z')));
 assert.deepEqual(course,dailyCourse(new Date('2026-10-15T08:00:00+08:00')));
 assert.notEqual(course.id,dailyCourse(new Date('2026-10-14T15:59:59.999Z')).id);
 const seen=new Set(Array.from({length:7},(_,i)=>dailyCourse(new Date(date.getTime()+i*86400000)).levelId));
 assert.deepEqual(seen,new Set(DAILY_POOL));assert.throws(()=>dailyCourse(new Date(NaN)));
});

test('北京零点跨月跨年切换，旧UTC规则及存档保持可读且不混排',()=>{
 assert.equal(dailyCourse(new Date('2026-10-31T15:59:59.999Z')).day,'2026-10-31');
 assert.equal(dailyCourse(new Date('2026-10-31T16:00:00Z')).day,'2026-11-01');
 assert.equal(dailyCourse(new Date('2026-12-31T16:00:00Z')).day,'2027-01-01');
 const instant=new Date('2026-10-15T16:00:00Z');
 for(const rules of ['daily-v1','daily-v2'] as const){
  const old=dailyCourse(instant,rules);assert.equal(old.day,'2026-10-15');
  const validated=validateDailyRun(old,route.report.inputs,flags);assert.ok(validated.ok);
  if(!validated.ok)throw Error('invalid old run');
  const records=new DailyRecords({getItem:()=>JSON.stringify({version:1,records:[validated.best]}),setItem:()=>{}});
  assert.equal(records.warning,'');assert.ok(records.best(old.id));assert.equal(records.best(dailyCourse(instant).id),undefined);
 }
});
test('整个每日池有完整无救援输入通关，成绩由重放计算',()=>{
 for(let i=0;i<7;i++){
  const c=dailyCourse(new Date(date.getTime()+i*86400000)),l=levelById(c.levelId)!,{flight,report}=flyRoute(l,true);
  const checked=validateDailyRun(c,report.inputs,flags);assert.equal(checked.ok,true);
  if(checked.ok){assert.equal(checked.best.score,scoreFlight(flight,l).score);assert.equal(checked.best.time,flight.elapsed);}
 }
});
test('拒绝救援、练习、伪造日期/航线/版本和非通关输入',()=>{
 for(const f of [{...flags,practice:true},{...flags,assisted:true},{...flags,rescues:1}])assert.equal(validateDailyRun(course,route.report.inputs,f).ok,false);
 for(const c of [{...course,id:'forged'},{...course,day:'2026-02-30'},{...course,levelId:'advanced-finale'},{...course,rules:'daily-v1' as const}])assert.equal(validateDailyRun(c,route.report.inputs,flags).ok,false);
 assert.equal(validateDailyRun(course,route.report.inputs.slice(0,-1),flags).ok,false);
 assert.equal(validateDailyRun(course,[],flags).ok,false);
});
test('输入边界、结束后填充、过长记录被拒绝',()=>{
 for(const turn of [NaN,Infinity,1.01,-1.01])assert.equal(validateDailyRun(course,[{thrust:true,turn}],flags).ok,false);
 assert.equal(validateDailyRun(course,[...route.report.inputs,{thrust:false,turn:0}],flags).ok,false);
 assert.equal(validateDailyRun(course,new Array(DAILY_MAX_STEPS+1).fill({thrust:false,turn:0}),flags).ok,false);
 const recorder=new DailyRecorder(),command={thrust:true,turn:0};recorder.push(command);command.turn=1;assert.equal(recorder.inputs[0].turn,0);
 for(let i=1;i<=DAILY_MAX_STEPS;i++)recorder.push(command);
 assert.equal(recorder.inputs.length,DAILY_MAX_STEPS);assert.equal(recorder.overflow,true);
});
test('每日成绩只写独立键，刷新保留，同成绩不反复写入',()=>{
 const writes:string[]=[];let raw:string|null=null;
 const storage={getItem:(k:string)=>k===DAILY_KEY?raw:null,setItem:(k:string,v:string)=>{writes.push(k);raw=v;}};
 const records=new DailyRecords(storage);assert.equal(records.submit(course,route.report.inputs,flags).ok,true);
 records.submit(course,route.report.inputs,flags);assert.deepEqual(writes,[DAILY_KEY]);
 assert.deepEqual(records.best(course.id),new DailyRecords(storage).best(course.id));
 const copy=records.best(course.id)!;copy.score=1;assert.notEqual(records.best(course.id)?.score,1);
});
test('损坏/未来版本/超界存档保留原文，存储失败使用会话纪录',()=>{
 for(const raw of ['bad',JSON.stringify({version:2,records:[]}),JSON.stringify({version:1,records:[{score:Infinity}]})]){
  let writes=0;const records=new DailyRecords({getItem:()=>raw,setItem:()=>{writes++;}});
  assert.ok(records.warning);records.submit(course,route.report.inputs,flags);assert.equal(writes,0);assert.ok(records.best(course.id));
 }
 const failed=new DailyRecords({getItem:()=>null,setItem:()=>{throw new Error('quota');}});
 assert.equal(failed.submit(course,route.report.inputs,flags).ok,true);assert.ok(failed.warning);assert.ok(failed.best(course.id));
});
test('最近三十个挑战日有界保存，同分依次比较用时和余油',()=>{
 let raw='';const records=new DailyRecords({getItem:()=>null,setItem:(_k,v)=>{raw=v;}});
 const cache=new Map(DAILY_POOL.map(id=>[id,flyRoute(levelById(id)!,true).report.inputs]));
 for(let i=0;i<32;i++){const c=dailyCourse(new Date(date.getTime()+i*86400000));records.submit(c,cache.get(c.levelId)!,flags);}
 assert.equal(JSON.parse(raw).records.length,30);assert.equal(records.best(course.id),undefined);
 const b=JSON.parse(raw).records[0];assert.ok(compareDaily({...b,score:b.score+1},b)<0);assert.ok(compareDaily({...b,time:b.time-1},b)<0);assert.ok(compareDaily({...b,fuelRatio:b.fuelRatio+.01},b)<0);
});
