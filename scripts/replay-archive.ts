import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { CONFIG, Flight } from '../src/physics';
import { ROUTE_REVISION } from '../src/levels';
import type { CampaignLevel } from '../src/level-types';
import type { ReplayInput } from '../src/replay';
import { scoreFlight } from '../src/scoring';
import {compatibleButtonRules} from '../src/rules-compatibility';

export const MAX_STEPS=120*480;
export const MAX_ARCHIVE_BYTES=8*1024*1024;
// Changes to the test pilot alone need not invalidate previously recorded inputs.
export const RULE_FILES=['src/physics.ts','src/environment.ts','src/level-types.ts','src/scoring.ts','src/observatory.ts'] as const;
export const sha256=(data:string|Uint8Array)=>createHash('sha256').update(data).digest('hex');
export function rulesFingerprint(){
  return sha256(JSON.stringify(RULE_FILES.map(path=>[path,sha256(readFileSync(path,'utf8').replace(/\r\n/g,'\n'))])));
}
type InputRun=[steps:number,thrust:0|1,turn:number|'-0'];
export function packInputs(inputs:ReplayInput[]):InputRun[]{
  if(!inputs.length||inputs.length>MAX_STEPS)throw new Error('输入步数超出允许范围');
  const runs:InputRun[]=[];
  for(const input of inputs){
    if(typeof input.thrust!=='boolean'||!Number.isFinite(input.turn)||Math.abs(input.turn)>1||input.tiltRate!==undefined)throw new Error('输入指令无效：历史战役档案仅支持原按钮规则');
    const thrust=input.thrust?1:0,turn=Object.is(input.turn,-0)?'-0':input.turn,last=runs.at(-1);
    if(last&&last[1]===thrust&&last[2]===turn)last[0]++;
    else runs.push([1,thrust,turn]);
  }
  return runs;
}
export function* unpackInputs(runs:InputRun[]):Generator<ReplayInput>{
  for(const [steps,thrust,turn] of runs)for(let i=0;i<steps;i++)yield {thrust:thrust===1,turn:turn==='-0'?-0:turn};
}
function terminalSnapshot(flight:Flight,level:CampaignLevel){
  return {state:flight.state,reason:flight.reason,result:flight.result??null,
    x:flight.x,y:flight.y,vx:flight.vx,vy:flight.vy,angle:flight.angle,omega:flight.omega,
    elapsed:flight.elapsed,fuel:flight.fuel,landedTime:flight.landedTime,
    legs:flight.legs.map(l=>({...l})),legImpacts:[...flight.legImpacts],bodyImpact:flight.bodyImpact,
    contacts:[...flight.contacts],recovered:flight.recovered,rescued:flight.rescued,rescueCount:flight.rescueCount,
    touchdown:{...flight.touchdown},trajectoryPoints:flight.trajectory.length,
    trajectorySha256:sha256(JSON.stringify(flight.trajectory)),score:scoreFlight(flight,level)};
}
export interface ReplayArchive {
  format:'gravity-landing-input-replay'; version:1; source:'automated-verification';
  gameVersion:string; recordedFromCommit:string; runtime:{node:string;platform:string;arch:string};
  levelId:string; levelSha256:string; rulesSha256:string; routeRevision:number; stepSeconds:number;
  initialState:'docked'; seed:null; steps:number; encoding:'rle-v1'; inputs:InputRun[];
  expected:ReturnType<typeof terminalSnapshot>;
}
export function createArchive(level:CampaignLevel,inputs:ReplayInput[],flight:Flight,metadata:{gameVersion:string;commit:string;rules:string}):ReplayArchive{
  if(flight.state!=='won'&&flight.state!=='failed')throw new Error('只归档已结束的完整航行');
  if(flight.rescued||flight.rescueCount)throw new Error('自动验证档案不允许救援');
  return {format:'gravity-landing-input-replay',version:1,source:'automated-verification',
    gameVersion:metadata.gameVersion,recordedFromCommit:metadata.commit,
    runtime:{node:process.version,platform:process.platform,arch:process.arch},
    levelId:level.id,levelSha256:sha256(JSON.stringify(level)),rulesSha256:metadata.rules,
    routeRevision:ROUTE_REVISION,stepSeconds:CONFIG.step,initialState:'docked',seed:null,
    steps:inputs.length,encoding:'rle-v1',inputs:packInputs(inputs),expected:terminalSnapshot(flight,level)};
}
// SHA-256 detects accidental alteration; it is not a signature or anti-cheat proof.
export function encodeArchive(payload:ReplayArchive):Buffer{
  const envelope=JSON.stringify({sha256:sha256(JSON.stringify(payload)),payload});
  if(Buffer.byteLength(envelope)>MAX_ARCHIVE_BYTES)throw new Error('回放档案过大');
  return gzipSync(envelope,{level:9});
}
function object(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
export function decodeArchive(bytes:Uint8Array,level:CampaignLevel,rules:string):ReplayArchive{
  if(bytes.length>MAX_ARCHIVE_BYTES)throw new Error('回放档案过大');
  let envelope:unknown;
  try {envelope=JSON.parse(gunzipSync(bytes,{maxOutputLength:MAX_ARCHIVE_BYTES}).toString('utf8'));}
  catch {throw new Error('回放档案损坏或解压超出限制');}
  if(!object(envelope)||!object(envelope.payload)||envelope.sha256!==sha256(JSON.stringify(envelope.payload)))throw new Error('回放档案校验和不匹配');
  const p=envelope.payload;
  if(p.format!=='gravity-landing-input-replay'||p.version!==1||p.encoding!=='rle-v1'||
    p.source!=='automated-verification'||p.initialState!=='docked'||p.seed!==null)throw new Error('不支持的回放格式或来源');
  if(p.levelId!==level.id||p.levelSha256!==sha256(JSON.stringify(level)))throw new Error('关卡 ID 或配置不兼容');
  if(typeof p.rulesSha256!=='string'||!compatibleButtonRules(p.rulesSha256,rules)||p.routeRevision!==ROUTE_REVISION||p.stepSeconds!==CONFIG.step)throw new Error('物理规则或固定步长不兼容');
  const runtime=p.runtime;
  if(typeof p.gameVersion!=='string'||!p.gameVersion||typeof p.recordedFromCommit!=='string'||!/^[a-f0-9]{40}$/.test(p.recordedFromCommit)||
    !object(runtime)||!['node','platform','arch'].every(k=>typeof runtime[k]==='string'))throw new Error('回放版本信息无效');
  if(!Number.isSafeInteger(p.steps)||(p.steps as number)<1||(p.steps as number)>MAX_STEPS||!Array.isArray(p.inputs)||
    p.inputs.length<1||p.inputs.length>MAX_STEPS)throw new Error('输入步数超出允许范围');
  let steps=0;
  for(const run of p.inputs){
    if(!Array.isArray(run)||run.length!==3||!Number.isSafeInteger(run[0])||run[0]<1||
      (run[1]!==0&&run[1]!==1)||(run[2]!=='-0'&&(typeof run[2]!=='number'||!Number.isFinite(run[2])||Math.abs(run[2])>1)))throw new Error('输入指令无效');
    steps+=run[0];if(steps>MAX_STEPS)throw new Error('输入步数超出允许范围');
  }
  if(steps!==p.steps)throw new Error('输入步数与档案不符');
  if(!object(p.expected)||(p.expected.state!=='won'&&p.expected.state!=='failed'))throw new Error('预期终态无效');
  return p as unknown as ReplayArchive;
}
export function verifyArchive(bytes:Uint8Array,level:CampaignLevel,rules:string){
  const archive=decodeArchive(bytes,level,rules),flight=new Flight(level);
  for(const input of unpackInputs(archive.inputs)){
    if(flight.state==='won'||flight.state==='failed')throw new Error('终局之后存在多余输入');
    flight.step(input.thrust,input.turn);
  }
  // JSON normalization uses the same representation as the on-disk snapshot (including -0).
  const actual=JSON.parse(JSON.stringify(terminalSnapshot(flight,level)));
  if(!isDeepStrictEqual(actual,archive.expected))throw new Error('回放终态、评分或完整航迹与档案不一致');
  return {levelId:level.id,state:flight.state,steps:archive.steps,time:flight.elapsed,fuel:flight.fuel,trajectoryPoints:flight.trajectory.length};
}
