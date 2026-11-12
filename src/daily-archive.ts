import {DAILY_MAX_STEPS,validateDailyRun,compareDaily,type DailyCourse,type DailyBest} from './daily';
import {DAILY_FINGERPRINTS} from './daily-fingerprints';
import {compatibleButtonRules} from './rules-compatibility';
import type {ReplayInput} from './replay';
import type {StoragePort} from './progress';
type Run=[number,0|1,number|'-0',1?];
export const DAILY_ARCHIVE_KEY='gravity-daily-replays';
export const ARCHIVE_LIMIT=2_000_000;
export interface DailyArchive {format:'gravity-daily-replay';version:1|2;course:DailyCourse;rulesHash:string;levelHash:string;inputs:Run[];best:DailyBest}
const flags={practice:false,assisted:false,rescues:0};
export function archiveDaily(course:DailyCourse,inputs:readonly ReplayInput[],eligibility=flags):DailyArchive {
 const result=validateDailyRun(course,inputs,eligibility);if(!result.ok)throw new Error(result.reason);
 const runs:Run[]=[];
 for(const i of inputs){const t=Object.is(i.turn,-0)?'-0':i.turn,last=runs.at(-1),thrust=i.thrust?1:0;
  if(last&&last[1]===thrust&&last[2]===t&&last[3]===(i.tiltRate?1:undefined))last[0]++;else runs.push(i.tiltRate?[1,thrust,t,1]:[1,thrust,t]);}
 return {format:'gravity-daily-replay',version:inputs.some(i=>i.tiltRate)?2:1,course:{...course},rulesHash:course.rules!=='daily-v1'?DAILY_FINGERPRINTS.tasks:DAILY_FINGERPRINTS.rules,
  levelHash:DAILY_FINGERPRINTS.levels[course.levelId as keyof typeof DAILY_FINGERPRINTS.levels],inputs:runs,best:result.best};
}
export function verifyDailyArchive(raw:string):DailyArchive {
 if(raw.length>ARCHIVE_LIMIT)throw new Error('每日回放文件过大');
 const a=JSON.parse(raw) as DailyArchive;
 if(!a||a.format!=='gravity-daily-replay'||![1,2].includes(a.version)||!a.course||!(a.course.rules!=='daily-v1'?a.rulesHash===DAILY_FINGERPRINTS.tasks:a.version===1?compatibleButtonRules(a.rulesHash,DAILY_FINGERPRINTS.rules):a.rulesHash===DAILY_FINGERPRINTS.rules)||a.levelHash!==DAILY_FINGERPRINTS.levels[a.course.levelId as keyof typeof DAILY_FINGERPRINTS.levels])throw new Error('回放版本或规则不兼容');
 if(!Array.isArray(a.inputs)||!a.inputs.length||a.inputs.length>DAILY_MAX_STEPS)throw new Error('回放输入无效');
 const inputs:ReplayInput[]=[];
 for(const run of a.inputs){
  if(!Array.isArray(run)||!(run.length===3||(a.version===2&&run.length===4&&run[3]===1)))throw new Error('输入段无效');
  const [n,thrust,turn]=run;
  if(!Number.isInteger(n)||n<1||inputs.length+n>DAILY_MAX_STEPS||(thrust!==0&&thrust!==1)||(turn!=='-0'&&(!Number.isFinite(turn)||Math.abs(turn)>1)))throw new Error('输入段越界');
  for(let i=0;i<n;i++)inputs.push({thrust:thrust===1,turn:turn==='-0'?-0:turn,...(run[3]===1?{tiltRate:true as const}:{})});
 }
 const result=validateDailyRun(a.course,inputs,flags);
 if(!result.ok)throw new Error(result.reason);
 if(!a.best||Object.keys(result.best).some(k=>result.best[k as keyof DailyBest]!==a.best[k as keyof DailyBest]))throw new Error('回放成绩不一致');
 // Canonical output contains only validated fields.
 return {format:a.format,version:a.version,course:{id:a.course.id,day:a.course.day,levelId:a.course.levelId,rules:a.course.rules},rulesHash:a.rulesHash,levelHash:a.levelHash,inputs:a.inputs,best:result.best};
}
/** At most three full best runs and 2M characters total; old summary saves remain untouched. */
export class DailyArchiveStore {
 private rows:DailyArchive[]=[];private pending:unknown[]|undefined;private readOnly=false;warning='';
 constructor(private storage?:StoragePort,private verify=verifyDailyArchive){
  try{const raw=storage?.getItem(DAILY_ARCHIVE_KEY);if(!raw)return;if(raw.length>ARCHIVE_LIMIT)throw new Error('size');
   const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.archives)||data.archives.length>3)throw new Error('schema');
   this.pending=data.archives;
  }catch{this.rows=[];this.readOnly=true;this.warning='每日回放不兼容或损坏，原数据已保留；本次使用临时回放。';}
 }
 private hydrate(){
  if(!this.pending)return;const pending=this.pending;this.pending=undefined;
  try{const rows=pending.map(a=>this.verify(JSON.stringify(a)));
   if(new Set(rows.map(a=>a.course.id)).size!==rows.length)throw new Error('duplicate');this.rows=rows;
  }catch{this.rows=[];this.readOnly=true;this.warning='每日回放不兼容或损坏，原数据已保留；本次使用临时回放。';}
 }
 export(id:string){this.hydrate();const a=this.rows.find(a=>a.course.id===id);return a?JSON.stringify(a):undefined;}
 save(archive:DailyArchive){
  this.hydrate();
  const a=verifyDailyArchive(JSON.stringify(archive)),old=this.rows.find(r=>r.course.id===a.course.id);
  if(old&&compareDaily(a.best,old.best)>=0)return;
  const rows=[...this.rows.filter(r=>r.course.id!==a.course.id),a].sort((a,b)=>b.course.day.localeCompare(a.course.day)).slice(0,3);
  while(JSON.stringify({version:1,archives:rows}).length>ARCHIVE_LIMIT&&rows.length>1)rows.pop();
  const raw=JSON.stringify({version:1,archives:rows});if(raw.length>ARCHIVE_LIMIT)throw new Error('回放超出保存容量');
  this.rows=rows;
  if(!this.readOnly)try{if(!this.storage)throw new Error('storage');this.storage.setItem(DAILY_ARCHIVE_KEY,raw);this.warning='';}
  catch{this.warning='每日回放暂时无法保存，可立即导出；刷新可能丢失。';}
 }
}
