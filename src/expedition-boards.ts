import {decodeScore,rankScore,type BoardKind,type Expedition} from './economy';
import {onlineLeaderboardHost,type OnlineLeaderboardHost} from './online-provider';
export interface ExpeditionBoardConfig {pure?:string;overall?:string}
// 未配置在线榜时仅保存本机最佳；接入平台前不得填入真实榜单编号。
export const EXPEDITION_BOARDS:ExpeditionBoardConfig={};
type Callback={onSuccess:(value:unknown)=>void;onFailure:(code:unknown,message:unknown)=>void};
type Manager=OnlineLeaderboardHost;
export class ExpeditionBoards {
 private busy=false;
 constructor(private config=EXPEDITION_BOARDS,private host:()=>Manager|undefined=onlineLeaderboardHost,private timeout=15000){}
 configured(kind:BoardKind){return !!this.config[kind];}
 private async call(kind:BoardKind,action:(m:Manager,id:string,c:Callback)=>void):Promise<unknown>{
  const id=this.config[kind],m=this.host();if(!id)throw Error('远征在线榜尚未配置；本机成绩已保留');if(!m)throw Error('请在支持在线榜的平台内查看真实排名');if(this.busy)throw Error('排行榜请求进行中');this.busy=true;
  try{return await new Promise((resolve,reject)=>{let done=false;const timer=setTimeout(()=>finish(false,Error('排行榜请求超时，可稍后重试')),this.timeout);
   const finish=(ok:boolean,v:unknown)=>{if(done)return;done=true;clearTimeout(timer);ok?resolve(v):reject(v);};
   try{action(m,id,{onSuccess:v=>finish(true,v),onFailure:()=>finish(false,Error('平台请求失败'))});}catch(e){finish(false,e);}
  });}finally{this.busy=false;}
 }
 async submit(kind:BoardKind,e:Expedition){const score=rankScore(e,kind);
  const result=await this.call(kind,(m,id,callback)=>m.submitScores({scores:[{leaderboardId:id,score}],callback}));
  const rows=(result as {results?:{leaderboardId:string;scoreResult?:{rawScore:number}}[]})?.results;
  const receipt=rows?.find(r=>r.leaderboardId===this.config[kind])?.scoreResult?.rawScore;
  if(typeof receipt!=='number')throw Error('未收到有效提交回执');decodeScore(receipt,kind);
  if(kind==='pure'?receipt>score:receipt<score)throw Error('平台回执与最佳成绩规则不一致');return score;
 }
 async list(kind:BoardKind,cursor?:string){const result=await this.call(kind,(m,id,callback)=>{if(!m.loadLeaderboardScores)throw Error('当前平台版本不支持读取榜单');m.loadLeaderboardScores({leaderboardId:id,collection:'public',maxSize:20,continuationToken:cursor,callback});});
  const data=result as {scores?:{rank:number;score:number;user?:{name?:string}}[];nextContinuationToken?:string;isTruncated?:boolean};
  if(!Array.isArray(data?.scores))throw Error('榜单返回格式无效');
  const rows=data.scores.map(r=>{if(!Number.isInteger(r.rank)||r.rank<1)throw Error('排名格式无效');return {rank:r.rank,name:typeof r.user?.name==='string'?r.user.name.slice(0,80):'平台玩家',...decodeScore(r.score,kind)};});
  return {rows,next:data.isTruncated&&typeof data.nextContinuationToken==='string'?data.nextContinuationToken:undefined};
 }
}
