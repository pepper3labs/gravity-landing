import {dailyCourse} from './daily';
import {decodeScore} from './economy';
import {EXPEDITION_BOARDS} from './expedition-boards';
import {ONLINE_BOARDS,onlineLeaderboardHost,type OnlineLeaderboardHost} from './online-provider';

export type RankingKind='overall'|'pure'|'daily';
export interface RankingRow {rank:number;name:string;result:string}
export interface RankingPage {rows:RankingRow[];next?:string;period?:string;mine?:RankingRow;mineNotice:string}
type Callback={onSuccess:(value:unknown)=>void;onFailure:(code:unknown,message:unknown)=>void};
type ReadHost=Pick<OnlineLeaderboardHost,'loadLeaderboardScores'|'loadCurrentPlayerLeaderboardScore'>;
export function rankingDuration(ticks:number){
 const hundredths=Math.round(ticks/120*100),seconds=Math.floor(hundredths/100);
 return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':')+'.'+String(hundredths%100).padStart(2,'0');
}
export class LeaderboardReader {
 constructor(private host:()=>ReadHost|undefined=onlineLeaderboardHost,
  private now=()=>new Date(),private timeout=15000,
  private ids:Partial<Record<RankingKind,string>>={...EXPEDITION_BOARDS,daily:ONLINE_BOARDS.daily}){}
 private call(action:(host:ReadHost,callback:Callback)=>void):Promise<unknown>{
  return new Promise((resolve,reject)=>{
   const host=this.host();if(!host){reject(Error('当前浏览器无法读取在线榜；请在支持在线榜的平台内使用此页面。'));return;}
   let done=false;const finish=(ok:boolean,value:unknown)=>{if(done)return;done=true;clearTimeout(timer);ok?resolve(value):reject(value);};
   const timer=setTimeout(()=>finish(false,Error('读取超时，请重试。')),this.timeout);
   try{action(host,{onSuccess:v=>finish(true,v),onFailure:()=>finish(false,Error('平台读取失败，请重试。'))});}catch(e){finish(false,e);}
  });
 }
 private row(value:unknown,kind:RankingKind):RankingRow{
  const row=value as {rank:number;score:number;user?:{name?:string}};
  if(!row||!Number.isSafeInteger(row.rank)||row.rank<1)throw Error('平台排名格式无效。');
  let result:string;
  if(kind==='daily'){
   if(!Number.isSafeInteger(row.score)||row.score<1||row.score>4700)throw Error('平台每日分数格式无效。');
   result=row.score+' 分';
  }else{const score=decodeScore(row.score,kind);result=score.completed+'/30 · '+rankingDuration(score.ticks)+(score.completed===30?' · 完整通关':' · 部分远征');}
  return {rank:row.rank,name:typeof row.user?.name==='string'?row.user.name.slice(0,80):'平台玩家',result};
 }
 async list(kind:RankingKind,cursor?:string,period?:string):Promise<RankingPage>{
  const id=this.ids[kind];if(!id)throw Error('此在线榜尚未配置。');
  const day=dailyCourse(this.now()).day;
  const dayStart=Date.parse(day+'T00:00:00+08:00')/1000;
  const requestedPeriod=period??(kind==='daily'?dayStart+'-'+(dayStart+86399):undefined);
  const response=await this.call((host,callback)=>{
   if(!host.loadLeaderboardScores)throw Error('当前平台版本不支持游戏内榜单读取。');
   host.loadLeaderboardScores({leaderboardId:id,collection:'public',maxSize:20,continuationToken:cursor,periodToken:requestedPeriod,callback});
  });
  const data=response as {scores?:unknown[];isTruncated?:boolean;nextContinuationToken?:string;leaderboard?:{period?:{periodToken?:string}}};
  if(!Array.isArray(data?.scores))throw Error('平台榜单格式无效。');
  const activePeriod=data.leaderboard?.period?.periodToken;
  const checkDay=()=>{
   if(kind!=='daily')return;
   if(dailyCourse(this.now()).day!==day)throw Error('已跨过北京时间零点，请刷新今日榜单。');
   const expected=Date.parse(day+'T00:00:00+08:00')/1000;
   const match=/^(\d+)-(\d+)$/.exec(activePeriod??'');
   if(!match||Number(match[1])!==expected||Number(match[2])!==expected+86400-1||(period&&activePeriod!==period))throw Error('平台周期尚未确认为今日，请稍后刷新；不展示旧周期成绩。');
  };
  checkDay();
  const rows=data.scores.map(row=>this.row(row,kind));
  const next=data.isTruncated&&typeof data.nextContinuationToken==='string'?data.nextContinuationToken:undefined;
  if(data.isTruncated&&(!next||next===cursor))throw Error('平台分页标识无效，请刷新。');
  let mine:RankingRow|undefined,mineNotice='';
  if(!cursor){
   try{
    const personal=await this.call((host,callback)=>{
     if(!host.loadCurrentPlayerLeaderboardScore)throw Error('当前平台版本暂不支持读取我的排名。');
     host.loadCurrentPlayerLeaderboardScore({leaderboardId:id,collection:'public',periodToken:activePeriod,callback});
    }) as {currentUserScore?:unknown;leaderboard?:{period?:{periodToken?:string}}};
    if(!personal||!Object.hasOwn(personal,'currentUserScore'))throw Error('我的排名返回格式无效。');
    if(kind==='daily'&&personal.leaderboard?.period?.periodToken!==activePeriod)throw Error('我的排名周期尚未确认，请刷新。');
    if(personal.currentUserScore==null)mineNotice='当前账号暂无线上成绩。';else mine=this.row(personal.currentUserScore,kind);
   }catch(error){mineNotice=error instanceof Error?error.message:'我的排名读取失败。';}
  }
  checkDay();return {rows,next,period:activePeriod,mine,mineNotice};
 }
}
