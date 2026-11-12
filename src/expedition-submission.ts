import {GameEconomy,rankScore,type BoardKind,type Expedition} from './economy';
import {OnlinePreference} from './online-participation';
import type {StoragePort} from './progress';
export const EXPEDITION_CHOICE_KEY='gravity-expedition-online-choice';
type Port={submit:(kind:BoardKind,e:Expedition)=>Promise<number>};
type Attempt={id:string;state:'sending'|'submitted'|'failed';error?:string;pending?:Promise<void>};
/** Serial SDK requests; receipts remain independent and are only acknowledged after success. */
export class ExpeditionSubmission {
 readonly preference:OnlinePreference;
 readonly attempts:Partial<Record<BoardKind,Attempt>>={};
 changed=()=>{};
 private queue:Promise<void>=Promise.resolve();
 private observed=new Set<string>();
 constructor(private store:GameEconomy,private boards:Port,scope:string,storage?:StoragePort){
  this.preference=new OnlinePreference(scope,storage,EXPEDITION_CHOICE_KEY);
 }
 settled(){
  const e=this.store.data.expedition;
  if(!e?.ended||this.observed.has(e.id))return;
  this.observed.add(e.id);
  if(this.preference.choice!=='yes')return;
  for(const kind of ['overall','pure'] as const){
   const best=this.store.data.best[kind];
   if(best?.id===e.id&&this.attempts[kind]?.id!==best.id)void this.send(kind);
  }
 }
 send(kind:BoardKind):Promise<void>{
  if(this.preference.choice!=='yes')return Promise.resolve();
  const best=this.store.data.best[kind];
  if(!best||this.store.data.submitted[kind]===best.id)return Promise.resolve();
  try{rankScore(best,kind);}catch{return Promise.resolve();}
  const old=this.attempts[kind];if(old?.id===best.id&&old.pending)return old.pending;
  const snapshot=structuredClone(best),attempt:Attempt={id:best.id,state:'sending'};this.attempts[kind]=attempt;
  const pending=this.queue.then(async()=>{
   // Withdrawal and a newer best cancel queued work, not an already-issued platform request.
   if(this.preference.choice!=='yes'||this.store.data.best[kind]?.id!==snapshot.id){
    if(this.attempts[kind]===attempt)delete this.attempts[kind];return;
   }
   try{const score=await this.boards.submit(kind,snapshot);this.store.acknowledge(kind,snapshot.id,score);attempt.state='submitted';}
   catch(error){attempt.state='failed';attempt.error=error instanceof Error?error.message:'提交失败，请重试。';}
  }).finally(()=>{attempt.pending=undefined;this.changed();});
  attempt.pending=pending;this.queue=pending;this.changed();return pending;
 }
 status(kind:BoardKind){
  if(this.preference.choice!=='yes')return '仅本机记录';
  const best=this.store.data.best[kind];if(!best)return '暂无符合条件的成绩';
  if(this.store.data.submitted[kind]===best.id)return '平台已确认提交';
  const a=this.attempts[kind];
  return a?.id===best.id?(a.state==='sending'?'正在提交…':a.state==='failed'?'提交未成功，可重试':'平台已确认提交'):'本机最佳尚未提交';
 }
}
