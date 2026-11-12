import {verifyDailyArchive} from './daily-archive';
import {compareDaily,type DailyBest} from './daily';
export interface DailyRank {pilot:string;best:DailyBest;rank:number}
export interface DailyLeaderboard {submit(pilot:string,raw:string):Promise<void>;list(challengeId:string):Promise<DailyRank[]>}
/** Local-only adapter: no accounts/network. Every submission is replayed, never a posted score. */
export class MockDailyLeaderboard implements DailyLeaderboard {
 private rows=new Map<string,{pilot:string;best:DailyBest}>();
 constructor(private wait=async()=>{},private unavailable=false){}
 async submit(pilot:string,raw:string){
  await this.wait();if(this.unavailable)throw new Error('模拟排行榜暂不可用');
  if(!/^[a-z0-9-]{1,32}$/.test(pilot))throw new Error('模拟玩家标识无效');
  const {best}=verifyDailyArchive(raw),key=best.id+':'+pilot,old=this.rows.get(key);
  if(old&&compareDaily(best,old.best)>=0)return;
  if(!old&&this.rows.size>=100)throw new Error('模拟榜容量已满');
  this.rows.set(key,{pilot,best});
 }
 async list(challengeId:string){
  await this.wait();if(this.unavailable)throw new Error('模拟排行榜暂不可用');
  const sorted=[...this.rows.values()].filter(r=>r.best.id===challengeId).sort((a,b)=>compareDaily(a.best,b.best)||a.pilot.localeCompare(b.pilot));
  let rank=0;return sorted.map((r,i)=>{if(!i||compareDaily(r.best,sorted[i-1].best)!==0)rank=i+1;return {pilot:r.pilot,best:{...r.best},rank};});
 }
}
