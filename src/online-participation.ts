import type {StoragePort} from './progress';
export const ONLINE_CHOICE_KEY='gravity-online-choice';
export type OnlineState='idle'|'sending'|'submitted'|'failed';
export interface OnlineRun {raw:string;state:OnlineState;error?:string;pending?:Promise<void>}
/** Consent is device-local and scoped to a specific board/rule, never inferred from an SDK login. */
export class OnlinePreference {
 choice:'unset'|'yes'|'no'='unset';warning='';
 constructor(private scope:string,private storage?:StoragePort,private key=ONLINE_CHOICE_KEY){
  try{const raw=storage?.getItem(key);if(!raw)return;
   const value=JSON.parse(raw);if(value.version===1&&value.scope===scope&&(value.choice==='yes'||value.choice==='no'))this.choice=value.choice;
  }catch{this.warning='在线榜偏好读取失败，默认不提交。';}
 }
 choose(enabled:boolean){
  this.choice=enabled?'yes':'no';this.warning='';
  try{if(!this.storage)throw Error('storage');
   const raw=JSON.stringify({version:1,scope:this.scope,choice:this.choice});
   this.storage.setItem(this.key,raw);if(this.storage.getItem(this.key)!==raw)throw Error('write');
  }catch{this.warning='本次选择无法保存；下次打开请重新检查参与状态。关闭自动提交仅对本次打开立即生效。';}
 }
}
export class OnlineParticipation extends OnlinePreference {
 constructor(scope:string,private submit:(raw:string)=>Promise<void>,storage?:StoragePort){super(scope,storage);}
 createRun(raw:string):OnlineRun{return {raw,state:'idle'};}
 send(run:OnlineRun):Promise<void>{
  if(this.choice!=='yes'||run.state==='submitted')return Promise.resolve();
  if(run.pending)return run.pending;
  run.state='sending';
  run.pending=Promise.resolve().then(async()=>{try{if(this.choice!=='yes'){run.state='idle';return;}await this.submit(run.raw);run.state='submitted';}catch(error){run.state='failed';run.error=error instanceof Error?error.message:'提交失败，请稍后重试。';}finally{run.pending=undefined;}});
  return run.pending;
 }
}
