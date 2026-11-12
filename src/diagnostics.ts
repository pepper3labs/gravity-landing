import type { StoragePort } from './progress';

export const DIAGNOSTICS_KEY='gravity-playtest';
export const MAX_ATTEMPTS=200;
type Outcome='ongoing'|'won'|'failed'|'abandoned'|'interrupted';
type Departure='retry'|'menu'|'pagehide'|'reload';
export interface RunSnapshot { seconds:number; fuel:number; assisted:boolean; rescues:number; reason:string }
interface Attempt extends RunSnapshot {
  id:number; levelId:string; startedAt:string; endedAt?:string;
  outcome:Outcome; departure?:Departure; failures:{seconds:number;reason:string}[];
}
const outcomes:Outcome[]=['ongoing','won','failed','abandoned','interrupted'];
const departures:Departure[]=['retry','menu','pagehide','reload'];
const nonnegative=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const timestamp=(s:unknown):s is string=>typeof s==='string'&&Number.isFinite(Date.parse(s));
function cleanAttempt(value:unknown):Attempt|undefined {
  if(!value||typeof value!=='object')return;
  const v=value as Attempt;
  if(!Number.isSafeInteger(v.id)||v.id<1||typeof v.levelId!=='string'||!v.levelId||v.levelId.length>80||
    !timestamp(v.startedAt)||(v.endedAt!==undefined&&!timestamp(v.endedAt))||!outcomes.includes(v.outcome)||
    (v.departure!==undefined&&!departures.includes(v.departure))||!nonnegative(v.seconds)||!nonnegative(v.fuel)||
    typeof v.assisted!=='boolean'||!Number.isSafeInteger(v.rescues)||v.rescues<0||typeof v.reason!=='string'||
    !Array.isArray(v.failures)||v.failures.length>10)return;
  if(v.failures.some(f=>!f||!nonnegative(f.seconds)||typeof f.reason!=='string'))return;
  return {id:v.id,levelId:v.levelId,startedAt:v.startedAt,endedAt:v.endedAt,outcome:v.outcome,departure:v.departure,
    seconds:v.seconds,fuel:v.fuel,assisted:v.assisted,rescues:v.rescues,reason:v.reason.slice(0,200),
    failures:v.failures.map(f=>({seconds:f.seconds,reason:f.reason.slice(0,200)}))};
}

/** Local manual-play observations, never a certificate of human/device acceptance. */
export class PlaytestDiagnostics {
  private attempts:Attempt[]=[];
  private active?:Attempt;
  private readOnly=false;
  private nextId=1;
  warning='';
  constructor(private storage?:StoragePort,private now=()=>new Date().toISOString()) {
    try {
      const raw=storage?.getItem(DIAGNOSTICS_KEY);
      if(raw){
        const parsed=JSON.parse(raw);
        if(parsed.version!==1||!Array.isArray(parsed.attempts)||parsed.attempts.length>MAX_ATTEMPTS||
          !Number.isSafeInteger(parsed.nextId)||parsed.nextId<1)throw new Error('Invalid diagnostics');
        const rows=parsed.attempts.map(cleanAttempt);
        if(rows.some((r:Attempt|undefined)=>!r)||new Set(rows.map((r:Attempt)=>r.id)).size!==rows.length||
          rows.some((r:Attempt)=>r.id>=parsed.nextId))throw new Error('Invalid attempts');
        this.attempts=rows;this.nextId=parsed.nextId;
        // A closed/reloaded page cannot be counted as a completed or live attempt.
        for(const row of this.attempts)if(row.outcome==='ongoing'){
          row.outcome='interrupted';row.departure='reload';row.endedAt=this.now();
        }
        this.persist();
      }
    }catch {this.readOnly=true;this.warning='试玩记录无法读取，原数据已保留；新记录仅在本次打开期间可导出。';}
  }
  private persist(){
    if(this.readOnly)return;
    try {
      if(!this.storage){this.warning='试玩记录仅在本次打开期间保留，请及时导出。';return;}
      this.storage.setItem(DIAGNOSTICS_KEY,JSON.stringify({version:1,nextId:this.nextId,attempts:this.attempts}));
    }catch {this.warning='试玩记录暂时无法保存，请在离开前导出。';}
  }
  begin(levelId:string,source:'manual'|'practice'|'qa',initial?:RunSnapshot){
    if(this.active)throw new Error('Close the previous attempt before starting another');
    if(source!=='manual')return;
    const row:Attempt={id:this.nextId++,levelId,startedAt:this.now(),outcome:'ongoing',seconds:0,fuel:0,
      assisted:false,rescues:0,reason:'',failures:[]};
    if(initial)Object.assign(row,initial);
    this.attempts.push(row);this.attempts=this.attempts.slice(-MAX_ATTEMPTS);this.active=row;this.persist();
  }
  result(outcome:'won'|'failed',snapshot:RunSnapshot){
    const row=this.active;if(!row||row.outcome===outcome)return;
    Object.assign(row,snapshot);row.outcome=outcome;row.endedAt=this.now();
    if(outcome==='failed')row.failures.push({seconds:snapshot.seconds,reason:snapshot.reason.slice(0,200)});
    row.failures=row.failures.slice(-10);this.persist();
  }
  rescue(snapshot:RunSnapshot){
    const row=this.active;if(!row||row.outcome!=='failed')return;
    Object.assign(row,snapshot);row.assisted=true;row.outcome='ongoing';delete row.endedAt;this.persist();
  }
  leave(departure:Departure,snapshot:RunSnapshot){
    const row=this.active;if(!row)return;
    // Preserve a finished attempt and its terminal metrics when leaving results.
    if(row.outcome==='ongoing'){
      Object.assign(row,snapshot);row.outcome=departure==='pagehide'?'interrupted':'abandoned';row.endedAt=this.now();
    }
    row.departure=departure;this.active=undefined;this.persist();
  }
  resumePage(){
    const row=this.attempts.at(-1);
    if(this.active||!row||row.departure!=='pagehide')return;
    if(row.outcome==='interrupted'){row.outcome='ongoing';delete row.endedAt;}
    delete row.departure;this.active=row;this.persist();
  }
  exportReport(){
    const attempts=this.attempts.map(r=>({...r,failures:r.failures.map(f=>({...f}))}));
    const levels=[...new Set(attempts.map(r=>r.levelId))].map(levelId=>{
      const rows=attempts.filter(r=>r.levelId===levelId),first=rows.findIndex(r=>r.outcome==='won'&&!r.assisted);
      return {levelId,attempts:rows.length,unassistedWins:rows.filter(r=>r.outcome==='won'&&!r.assisted).length,
        assistedWins:rows.filter(r=>r.outcome==='won'&&r.assisted).length,failures:rows.reduce((n,r)=>n+r.failures.length,0),
        abandoned:rows.filter(r=>r.outcome==='abandoned').length,interrupted:rows.filter(r=>r.outcome==='interrupted').length,
        retries:rows.filter(r=>r.departure==='retry').length,attemptsToFirstUnassistedWin:first<0?null:first+1,
        activeSecondsToFirstUnassistedWin:first<0?null:rows.slice(0,first+1).reduce((n,r)=>n+r.seconds,0)};
    });
    return {version:1,gameVersion:'0.9.0-dev.25',exportedAt:this.now(),source:'local-manual-play',
      scope:'Most recent 200 attempts only; excludes practice and QA. Not proof of human or device acceptance.',levels,attempts};
  }
}
