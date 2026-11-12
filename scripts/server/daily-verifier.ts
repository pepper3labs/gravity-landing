import {createHash,randomBytes} from 'node:crypto';
import {ARCHIVE_LIMIT,verifyDailyArchive} from '../../src/daily-archive';
import {compareDaily,dailyCourse,type DailyBest,type DailyCourse} from '../../src/daily';
import type {DailyRank} from '../../src/daily-leaderboard';

interface Ticket {
 pilot:string;course:DailyCourse;issuedAt:number;expiresAt:number;
 receipt?:{digest:string;best:DailyBest};
}
export interface ChallengeTicket {token:string;course:DailyCourse;expiresAt:number}
/** Server-only, single-process test core. Caller MUST authenticate pilot upstream.
 * No HTTP listener, platform identity verification or persistent storage is provided.
 * Never import this module into the browser or treat its pilot argument as authentication.
 */
export class DailyVerifier {
 private tickets=new Map<string,Ticket>();
 private rows=new Map<string,{pilot:string;best:DailyBest}>();
 constructor(private clock=()=>Date.now(),private capacity=1000){
  if(!Number.isInteger(capacity)||capacity<1)throw Error('Invalid capacity');
 }
 private now(){
  const now=this.clock();dailyCourse(new Date(now));return now;
 }
 private pilot(pilot:string){
  if(typeof pilot!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(pilot))throw Error('Invalid authenticated subject');
 }
 private prune(now:number){
  for(const [token,ticket] of this.tickets)if(now>=ticket.expiresAt)this.tickets.delete(token);
  // Local test retention only; production retention must be reviewed before deployment.
  const oldest=new Date(now-86400000).toISOString().slice(0,10);
  for(const [key,row] of this.rows)if(row.best.day<oldest)this.rows.delete(key);
 }
 issue(pilot:string):ChallengeTicket {
  this.pilot(pilot);const now=this.now();this.prune(now);
  if(this.tickets.size>=this.capacity)throw Error('Challenge capacity reached');
  let active=0;for(const ticket of this.tickets.values())if(ticket.pilot===pilot&&!ticket.receipt)active++;
  if(active>=3)throw Error('Too many active challenges');
  const course=dailyCourse(new Date(now));
  // Conservative local policy: 10 minutes, no next-day grace until approved.
  const expiresAt=Math.min(now+600000,Date.parse(course.day+'T00:00:00+08:00')+86400000);
  const token=randomBytes(32).toString('base64url');
  this.tickets.set(token,{pilot,course,issuedAt:now,expiresAt});
  return {token,course:{...course},expiresAt};
 }
 submit(pilot:string,token:string,raw:string):DailyBest {
  this.pilot(pilot);const now=this.now();this.prune(now);
  if(typeof token!=='string'||token.length!==43)throw Error('Invalid challenge');
  const ticket=this.tickets.get(token);
  if(!ticket||ticket.pilot!==pilot||now<ticket.issuedAt)throw Error('Invalid or expired challenge');
  if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>ARCHIVE_LIMIT)throw Error('Replay too large');
  const digest=createHash('sha256').update(raw).digest('hex');
  if(ticket.receipt){
   if(ticket.receipt.digest!==digest)throw Error('Challenge already used with different input');
   return {...ticket.receipt.best};
  }
  // Cheap envelope checks before the bounded deterministic physics replay.
  const envelope=JSON.parse(raw);
  if(!envelope?.course||['id','day','levelId','rules'].some(key=>
   envelope.course[key]!==ticket.course[key as keyof DailyCourse]))throw Error('Challenge course mismatch');
  const {best}=verifyDailyArchive(raw);
  if(best.time*1000>now-ticket.issuedAt)throw Error('Run predates challenge');
  const key=JSON.stringify([pilot,best.id]),old=this.rows.get(key);
  if(!old&&this.rows.size>=this.capacity)throw Error('Leaderboard capacity reached');
  if(!old||compareDaily(best,old.best)<0)this.rows.set(key,{pilot,best:{...best}});
  ticket.receipt={digest,best:{...best}};
  return {...best};
 }
 list(challengeId:string):DailyRank[]{
  this.prune(this.now());
  const rows=[...this.rows.values()].filter(row=>row.best.id===challengeId)
   .sort((a,b)=>compareDaily(a.best,b.best)||(a.pilot<b.pilot?-1:a.pilot>b.pilot?1:0));
  let rank=0;
  return rows.map((row,index)=>{
   if(!index||compareDaily(row.best,rows[index-1].best)!==0)rank=index+1;
   return {pilot:row.pilot,best:{...row.best},rank};
  });
 }
}
