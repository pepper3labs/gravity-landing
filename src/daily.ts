import {levelById} from './levels';
import {Flight,CONFIG} from './physics';
import {scoreFlight} from './scoring';
import {scoreTaskFlight} from './star-tasks';
import type {ReplayInput} from './replay';
import type {StoragePort} from './progress';

// Explicit order is part of daily-v1. Campaign additions must not reshuffle dates.
export const DAILY_POOL=Object.freeze(['training-brake','low-gravity','static-field','moving-gate','reverse-arc','crossing-patrol','atmosphere-edge']);
export const DAILY_KEY='gravity-daily';
export const DAILY_MAX_STEPS=120*480;
export interface DailyCourse {id:string;day:string;levelId:string;rules:'daily-v1'|'daily-v2'|'daily-v3'}
export interface DailyBest {id:string;day:string;levelId:string;score:number;stars:number;time:number;fuelRatio:number}
export function dailyCourse(now=new Date(),rules:DailyCourse['rules']='daily-v3'):DailyCourse {
  // v1/v2 archives keep their UTC dates. v3 uses a fixed UTC+8 day on every device.
  if(rules==='daily-v3')now=new Date(now.getTime()+8*3600000);
  if(!Number.isFinite(now.getTime())||now.getUTCFullYear()<2026||now.getUTCFullYear()>9999)throw new Error('挑战日期无效');
  const day=now.toISOString().slice(0,10),index=Math.floor(now.getTime()/86400000)%DAILY_POOL.length;
  return {id:rules+':'+day,day,levelId:DAILY_POOL[index],rules};
}
function validCourse(c:DailyCourse){
  try{return ['daily-v1','daily-v2','daily-v3'].includes(c.rules)&&JSON.stringify(dailyCourse(new Date(c.day+'T00:00:00Z'),c.rules))===JSON.stringify({id:c.id,day:c.day,levelId:c.levelId,rules:c.rules});}catch{return false;}
}
export type DailyValidation={ok:true;best:DailyBest}|{ok:false;reason:string};
/** Recompute from a fresh, unassisted launch. No posted score or terminal state is trusted. */
export function validateDailyRun(course:DailyCourse,inputs:readonly ReplayInput[],flags:{practice:boolean;assisted:boolean;rescues:number}):DailyValidation {
  const reject=(reason:string):DailyValidation=>({ok:false,reason});
  if(!validCourse(course))return reject('挑战日期或规则不匹配');
  if(flags.practice!==false||flags.assisted!==false||flags.rescues!==0)return reject('练习或救援成绩不计每日纪录');
  if(!Array.isArray(inputs)||!inputs.length||inputs.length>DAILY_MAX_STEPS)return reject('航行记录为空或超过八分钟上限');
  const level=levelById(course.levelId);if(!level)return reject('挑战航线不可用');
  const flight=new Flight(level);
  for(const input of inputs){
    if(!input||typeof input.thrust!=='boolean'||!Number.isFinite(input.turn)||Math.abs(input.turn)>1||(input.tiltRate!==undefined&&input.tiltRate!==true))return reject('航行输入无效');
    if(flight.state==='won'||flight.state==='failed')return reject('结束后仍存在输入');
    flight.step(input.thrust,input.turn,CONFIG.step,input.tiltRate===true);
  }
  if(flight.state!=='won')return reject('输入未能复现完整通关');
  const run=course.rules!=='daily-v1'?scoreTaskFlight(flight,level):scoreFlight(flight,level);
  return {ok:true,best:{id:course.id,day:course.day,levelId:level.id,score:run.score,stars:run.stars,time:run.time,fuelRatio:run.fuelRatio}};
}
export function compareDaily(a:DailyBest,b:DailyBest){return b.score-a.score||a.time-b.time||b.fuelRatio-a.fuelRatio;}
function validBest(b:DailyBest){
  if(!b||typeof b!=='object'||!validCourse({...b,rules:b.id?.startsWith('daily-v3:')?'daily-v3':b.id?.startsWith('daily-v2:')?'daily-v2':'daily-v1'}))return false;
  return Number.isInteger(b.stars)&&b.stars>=1&&b.stars<=3&&Number.isInteger(b.score)&&b.score>0&&b.score<=4700&&
    Number.isFinite(b.time)&&b.time>0&&b.time<=480&&Number.isFinite(b.fuelRatio)&&b.fuelRatio>=0&&b.fuelRatio<=1;
}
export class DailyRecords {
  private rows:DailyBest[]=[];private readOnly=false;warning='';
  constructor(private storage?:StoragePort){
    try{const raw=storage?.getItem(DAILY_KEY);if(!raw)return;const data=JSON.parse(raw);
      if(data.version!==1||!Array.isArray(data.records)||data.records.length>30||!data.records.every(validBest)||new Set(data.records.map((r:DailyBest)=>r.id)).size!==data.records.length)throw new Error('invalid');
      this.rows=data.records.map((r:DailyBest)=>({...r}));
    }catch{this.readOnly=true;this.warning='每日纪录无法读取，原数据已保留；本次使用临时纪录。';}
  }
  best(id:string){const row=this.rows.find(r=>r.id===id);return row?{...row}:undefined;}
  submit(course:DailyCourse,inputs:readonly ReplayInput[],flags:{practice:boolean;assisted:boolean;rescues:number}):DailyValidation {
    const result=validateDailyRun(course,inputs,flags);if(!result.ok)return result;
    const old=this.best(course.id);if(old&&compareDaily(result.best,old)>=0)return result;
    this.rows=[...this.rows.filter(r=>r.id!==course.id),result.best].sort((a,b)=>b.day.localeCompare(a.day)).slice(0,30);
    if(!this.readOnly)try{if(!this.storage)throw new Error('unavailable');this.storage.setItem(DAILY_KEY,JSON.stringify({version:1,records:this.rows}));this.warning='';}
    catch{this.warning='每日纪录暂时无法保存，本次打开期间仍可查看。';}
    return result;
  }
}
/** Bounded input recorder: paused frames and terminal padding are not recorded by the caller. */
export class DailyRecorder {
  inputs:ReplayInput[]=[];overflow=false;
  push(input:ReplayInput){if(this.inputs.length>=DAILY_MAX_STEPS){this.overflow=true;return;}this.inputs.push({...input});}
}
