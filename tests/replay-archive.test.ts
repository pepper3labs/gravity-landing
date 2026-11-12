import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {LEVELS} from '../src/levels';
import {flyRoute} from '../src/replay';
import {createArchive,decodeArchive,encodeArchive,MAX_ARCHIVE_BYTES,MAX_STEPS,packInputs,rulesFingerprint,unpackInputs,verifyArchive} from '../scripts/replay-archive';

const rules=rulesFingerprint(),level=LEVELS[0],{flight,report}=flyRoute(level,true);
const archive=createArchive(level,report.inputs,flight,{gameVersion:'0.6.0',commit:'b'.repeat(40),rules});
test('无损输入编码保留浮点转向、负零与重复推进，JSON往返可精确还原',()=>{
  const inputs=[{thrust:true,turn:-0},{thrust:true,turn:-0},{thrust:false,turn:0},{thrust:true,turn:.12345678901234567}];
  const packed=JSON.parse(JSON.stringify(packInputs(inputs)));
  assert.equal(packed.length,3);assert.deepEqual([...unpackInputs(packed)],inputs);
  assert.throws(()=>packInputs([{thrust:true,turn:NaN}]),/输入/);
  assert.throws(()=>packInputs([{thrust:true,turn:2}]),/输入/);
});
test('归档经过压缩与读取后复现真实终态、评分和完整航迹',()=>{
  const bytes=encodeArchive(archive),result=verifyArchive(bytes,level,rules);
  assert.equal(result.state,'won');assert.equal(result.steps,report.steps);assert.equal(result.fuel,flight.fuel);
  assert.equal(decodeArchive(bytes,level,rules).source,'automated-verification');
});
test('磁盘中全部关卡永久档案均可直接重放，不重新生成输入',()=>{
  for(const l of LEVELS){const result=verifyArchive(readFileSync('docs/replays/'+l.id+'.json.gz'),l,rules);assert.equal(result.state,'won',l.id);}
});
test('拒绝截断、损坏校验和与超限解压档案',()=>{
  const bytes=encodeArchive(archive);
  assert.throws(()=>decodeArchive(bytes.subarray(0,bytes.length-12),level,rules),/损坏/);
  assert.throws(()=>decodeArchive(gzipSync(JSON.stringify({sha256:'invalid',payload:archive})),level,rules),/校验和/);
  assert.throws(()=>decodeArchive(gzipSync(Buffer.alloc(MAX_ARCHIVE_BYTES+1,32)),level,rules),/超出限制/);
});
test('即便重算校验和也拒绝不兼容规则、关卡、来源和版本',()=>{
  for(const patch of [{version:2},{stepSeconds:1/60},{rulesSha256:'wrong'},{routeRevision:99},{levelId:'unknown'},
    {levelSha256:'wrong'},{source:'human'},{seed:7},{initialState:'flying'},{recordedFromCommit:'unknown'}]){
    const altered=Object.assign(structuredClone(archive),patch);
    assert.throws(()=>decodeArchive(encodeArchive(altered),level,rules));
  }
  const changed=structuredClone(level);changed.initialFuel++;
  assert.throws(()=>decodeArchive(encodeArchive(archive),changed,rules),/配置不兼容/);
});
test('拒绝非法推进、转向、重复次数、步数不符与超长输入',()=>{
  for(const input of [[0,1,0],[-1,1,0],[1.5,1,0],[1,true,0],[1,1,2],[1,1,null],[1,1,'bad'],[MAX_STEPS+1,0,0]]){
    const altered=structuredClone(archive);altered.inputs=[input as never];
    assert.throws(()=>decodeArchive(encodeArchive(altered),level,rules),/输入/);
  }
  const mismatch=structuredClone(archive);mismatch.steps--;
  assert.throws(()=>decodeArchive(encodeArchive(mismatch),level,rules),/步数/);
});
test('合法但被改变的动作、预期终态或航迹均不能通过复核',()=>{
  const changed=structuredClone(archive);changed.expected.fuel++;
  assert.throws(()=>verifyArchive(encodeArchive(changed),level,rules),/不一致/);
  changed.expected=structuredClone(archive.expected);changed.expected.trajectorySha256='0'.repeat(64);
  assert.throws(()=>verifyArchive(encodeArchive(changed),level,rules),/不一致/);
  changed.expected=structuredClone(archive.expected);changed.inputs=[[changed.steps,0,0]];
  assert.throws(()=>verifyArchive(encodeArchive(changed),level,rules),/不一致/);
});
test('终局后填充输入被拒绝，防止同一结果掩盖多余步数',()=>{
  const padded=structuredClone(archive);padded.steps++;padded.inputs.push([1,0,0]);
  assert.throws(()=>verifyArchive(encodeArchive(padded),level,rules),/多余输入/);
});
