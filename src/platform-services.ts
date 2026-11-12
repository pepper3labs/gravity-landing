import {MockRewardedAd,type RewardedAd} from './services';
export type ServiceMode='local';
export function serviceMode(value:unknown):ServiceMode {
 if(value===undefined||value===''||value==='local')return 'local';
 throw new Error('未知服务模式，拒绝静默回退模拟环境');
}
export function platformServices(mode:ServiceMode,localOutcome:'completed'|'cancelled'|'failed'='completed'){
 return {mode,adAvailable:true,ad:new MockRewardedAd(localOutcome) as RewardedAd,online:false};
}
export type AdSignal='completed'|'cancelled'|'failed';
/** Internal contract, not an invented platform API. Integration must map a verified SDK to this port. */
// The port must release SDK listeners/resources when lifetime is aborted, including after completion.
// This signal cancels our request ownership; it does not claim to close a native ad UI.
export interface RewardedPort {open(placement:'rescue'|'double-coins'|'expedition-refit',signal:(result:AdSignal)=>void,lifetime:AbortSignal):void|Promise<void>}
/** 未配置在线广告提供方时的空实现：失败关闭，绝不伪造完成信号。 */
export const noopRewardedPort:RewardedPort={open(_placement,signal){signal('failed');}};
export class CallbackRewardedAd implements RewardedAd {
 private busy=false;
 constructor(private port:RewardedPort,private timeoutMs=120000){}
 async show(placement:'rescue'|'double-coins'|'expedition-refit',signal?:AbortSignal):Promise<boolean>{
  if(signal?.aborted)throw new Error('广告请求已取消');
  if(this.busy)throw new Error('广告请求进行中');this.busy=true;
  try{return await new Promise<boolean>((resolve,reject)=>{
   const lifetime=new AbortController();
   let settled=false;const timer=setTimeout(()=>finish('failed'),this.timeoutMs);
   const abort=()=>finish('failed');
   const finish=(result:AdSignal)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);lifetime.abort();if(result==='completed')resolve(true);else if(result==='cancelled')resolve(false);else reject(new Error('广告未完成或不可用'));};
   signal?.addEventListener('abort',abort,{once:true});
   try{Promise.resolve(this.port.open(placement,finish,lifetime.signal)).catch(()=>finish('failed'));}catch{finish('failed');}
  });}finally{this.busy=false;}
 }
}
