import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DAILY_FINGERPRINTS} from '../src/daily-fingerprints';
import {rulesFingerprint,sha256} from '../scripts/replay-archive';
import {taskFingerprint} from '../scripts/task-fingerprint';
import {LEVELS,levelById} from '../src/levels';
import {dailyCourse} from '../src/daily';
import {flyRoute} from '../src/replay';
import {archiveDaily,verifyDailyArchive,DailyArchiveStore,DAILY_ARCHIVE_KEY,ARCHIVE_LIMIT} from '../src/daily-archive';
import {MockDailyLeaderboard} from '../src/daily-leaderboard';
import {LEGACY_BUTTON_RULES,compatibleButtonRules} from '../src/rules-compatibility';
const course=dailyCourse(new Date('2026-10-15T00:00:00Z'));
const inputs=flyRoute(levelById(course.levelId)!,true).report.inputs;
const archive=archiveDaily(course,inputs),raw=JSON.stringify(archive);
test('倾斜输入按步归档，拒绝旧协议混入新上限及未知模式，旧按钮规则继续复核',()=>{
 const mixed=inputs.map((i,n)=>n<2?{...i,tiltRate:true as const}:i);
 const a=archiveDaily(course,mixed);assert.equal(a.version,2);assert.equal(a.inputs[0][3],1);
 assert.deepEqual(verifyDailyArchive(JSON.stringify(a)),a);
 const old=archiveDaily(dailyCourse(new Date('2026-10-15T00:00:00Z'),'daily-v1'),inputs);old.rulesHash=LEGACY_BUTTON_RULES;
 assert.equal(verifyDailyArchive(JSON.stringify(old)).rulesHash,LEGACY_BUTTON_RULES);
 for(const mutate of [(v:typeof a)=>v.version=1,(v:typeof a)=>v.rulesHash=LEGACY_BUTTON_RULES,(v:typeof a)=>{(v.inputs[0] as unknown[])[3]=2;}]){
  const bad=structuredClone(a);mutate(bad);assert.throws(()=>verifyDailyArchive(JSON.stringify(bad)));
 }
 assert.equal(compatibleButtonRules(LEGACY_BUTTON_RULES,'unknown-future-rules'),false);
});
test('启动不重放历史输入，首次访问只复核一次，延迟损坏仍保留原文',()=>{
 let calls=0,writes=0;const saved=JSON.stringify({version:1,archives:[archive]});
 const store=new DailyArchiveStore({getItem:()=>saved,setItem:()=>{writes++;}},text=>{calls++;return verifyDailyArchive(text);});
 assert.equal(calls,0);assert.ok(store.export(course.id));assert.equal(calls,1);store.export(course.id);assert.equal(calls,1);assert.equal(writes,0);
 const bad=structuredClone(archive);bad.best.score++;
 const broken=new DailyArchiveStore({getItem:()=>JSON.stringify({version:1,archives:[bad]}),setItem:()=>{writes++;}});
 assert.equal(broken.export(course.id),undefined);assert.ok(broken.warning);broken.save(archive);assert.equal(writes,0);assert.ok(broken.export(course.id));
});
test('每日规则和关卡SHA256指纹与源码一致',()=>{
 assert.equal(DAILY_FINGERPRINTS.rules,rulesFingerprint());
 assert.equal(DAILY_FINGERPRINTS.tasks,taskFingerprint());
 for(const l of LEVELS)assert.equal(DAILY_FINGERPRINTS.levels[l.id as keyof typeof DAILY_FINGERPRINTS.levels],sha256(JSON.stringify(l)));
});
test('每日回放独立重放，拒绝分数篡改、错误规则、输入截断和膨胀',()=>{
 assert.deepEqual(verifyDailyArchive(raw),archive);
 for(const mutate of [(a:typeof archive)=>a.best.score++,(a:typeof archive)=>a.rulesHash='bad',(a:typeof archive)=>a.levelHash='bad',(a:typeof archive)=>a.inputs.pop(),(a:typeof archive)=>a.inputs[0][0]=57601]){
  const a=structuredClone(archive);mutate(a);assert.throws(()=>verifyDailyArchive(JSON.stringify(a)));
 }
 assert.throws(()=>verifyDailyArchive(' '.repeat(ARCHIVE_LIMIT+1)));
 assert.throws(()=>archiveDaily(course,inputs,{practice:true,assisted:false,rescues:0}));
});
test('每日回放刷新后仍可复核，独立存储与三日/总容量限制',()=>{
 let saved='';const keys:string[]=[];const storage={getItem:()=>saved||null,setItem:(k:string,v:string)=>{keys.push(k);saved=v;}};
 const store=new DailyArchiveStore(storage);store.save(archive);assert.deepEqual(verifyDailyArchive(new DailyArchiveStore(storage).export(course.id)!),archive);
 for(let i=1;i<=4;i++){const c=dailyCourse(new Date(Date.UTC(2026,9,15+i)));store.save(archiveDaily(c,flyRoute(levelById(c.levelId)!,true).report.inputs));}
 assert.equal(store.export(course.id),undefined);assert.ok(saved.length<=ARCHIVE_LIMIT);assert.ok(JSON.parse(saved).archives.length<=3);assert.ok(keys.every(k=>k===DAILY_ARCHIVE_KEY));
});
test('损坏回放不覆盖原文，配额失败仍可导出',()=>{
 let writes=0;const broken=new DailyArchiveStore({getItem:()=>'{bad',setItem:()=>{writes++;}});broken.save(archive);assert.equal(writes,0);assert.ok(broken.warning);assert.ok(broken.export(course.id));
 const full=new DailyArchiveStore({getItem:()=>null,setItem:()=>{throw new Error('quota');}});full.save(archive);assert.ok(full.warning);assert.ok(full.export(course.id));
});
test('模拟榜重放准入、重复提交幂等、并列排名与日期隔离',async()=>{
 const board=new MockDailyLeaderboard();await Promise.all([board.submit('alpha',raw),board.submit('beta',raw),board.submit('alpha',raw)]);
 const rows=await board.list(course.id);assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.rank),[1,1]);
 rows[0].best.score=0;assert.ok((await board.list(course.id))[0].best.score>0);
 assert.deepEqual(await board.list('daily-v1:2026-10-16'),[]);
 const forged=structuredClone(archive);forged.best.score=99999;await assert.rejects(()=>board.submit('gamma',JSON.stringify(forged)));
 assert.equal((await board.list(course.id)).length,2);
});
test('模拟榜不可用、非法玩家和异常等待被拒绝，无伪成功',async()=>{
 await assert.rejects(()=>new MockDailyLeaderboard(async()=>{},true).submit('alpha',raw));
 await assert.rejects(()=>new MockDailyLeaderboard(async()=>{throw new Error('offline');}).list(course.id));
 await assert.rejects(()=>new MockDailyLeaderboard().submit('<script>',raw));
});
