import {LEVELS} from './levels';
import {CampaignProgress,type Save,type StoragePort} from './progress';
import type {TaskScore} from './star-tasks';
import {ECONOMY,EXPEDITION_CAPACITY,EXPEDITION_CONFIG,maintenancePrice,type Maintenance} from './economy-config';
import {Flight,CONFIG} from './physics';
export const ECONOMY_KEY='gravity-economy-v1',JOURNAL_KEY='gravity-expedition-journal',BACKUP_KEY='gravity-economy-backup';
export const MAX_RANK_TICKS=50_000_000;
export type BoardKind='pure'|'overall';
export interface Resources {fuel:number;legs:{health:number;broken:boolean}[]}
export interface Expedition {
 id:string;completed:number;phase:'station'|'ready'|'flight'|'retry'|'ended';resources:Resources;snapshot?:Resources;
 ticks:number;fuelUsed:number;damage:number;eligible:boolean;pure:boolean;reason:string;
 services:Record<Maintenance,number>;attempt:number;ended:boolean;
}
export interface Receipt {id:string;levelId:string;amount:number;first:number;repeat:number;doubled:boolean}
interface State {version:1;revision:number;coins:number;claimed:Record<string,number>;unlocked:string[];campaign:Save;sequence:number;active?:{id:string;levelId:string};receipt?:Receipt;expedition?:Expedition;best:Partial<Record<BoardKind,Expedition>>;farthest:number;submitted:Record<string,string>}
const full=():Resources=>({fuel:EXPEDITION_CAPACITY,legs:[{health:100,broken:false},{health:100,broken:false}]});
const clone=<T>(v:T):T=>structuredClone(v);
const num=(v:unknown,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
function validResources(r:Resources){return r&&num(r.fuel,EXPEDITION_CAPACITY)&&Array.isArray(r.legs)&&r.legs.length===2&&r.legs.every(l=>num(l.health,100)&&typeof l.broken==='boolean'&&(!l.broken||l.health===0));}
export function validExpedition(e:Expedition):boolean {
 return !!e&&typeof e.id==='string'&&e.id.length<120&&Number.isInteger(e.completed)&&num(e.completed,30)&&['station','ready','flight','retry','ended'].includes(e.phase)&&validResources(e.resources)&&(!e.snapshot||validResources(e.snapshot))&&(!['ready','flight','retry'].includes(e.phase)||!!e.snapshot)&&
 Number.isSafeInteger(e.ticks)&&num(e.ticks)&&num(e.fuelUsed)&&num(e.damage)&&typeof e.pure==='boolean'&&typeof e.eligible==='boolean'&&typeof e.reason==='string'&&Number.isSafeInteger(e.attempt)&&num(e.attempt)&&
 !!e.services&&(['fuel','repair','full','ad'] as const).every(k=>Number.isSafeInteger(e.services[k])&&num(e.services[k]))&&(!e.pure||Object.values(e.services).every(n=>n===0))&&e.ended===(e.phase==='ended')&&(e.completed<30||e.ended);
}
export function rankScore(e:Expedition,kind:BoardKind){
 if(!validExpedition(e)||!e.ended||!e.eligible||!e.completed||e.ticks<1||e.ticks>MAX_RANK_TICKS||e.ticks<e.completed*120)throw Error('本次远征未结算或成绩不具备排行榜资格');
 if(kind==='pure'&&(!e.pure||e.completed!==30))throw Error('纯净榜仅接受未整备的30关完整远征');
 return kind==='pure'?e.ticks:e.completed*(MAX_RANK_TICKS+1)+(MAX_RANK_TICKS-e.ticks);
}
export function decodeScore(score:number,kind:BoardKind){
 if(!Number.isSafeInteger(score)||score<1)throw Error('榜单分数格式无效');
 const completed=kind==='pure'?30:Math.floor(score/(MAX_RANK_TICKS+1));
 const ticks=kind==='pure'?score:MAX_RANK_TICKS-score%(MAX_RANK_TICKS+1);
 if(completed<1||completed>30||ticks<1||ticks>MAX_RANK_TICKS)throw Error('榜单分数越界');
 return {completed,ticks};
}
export class GameEconomy {
 data:State;warning='';private raw:string|null=null;private readOnly=false;
 constructor(private storage?:StoragePort){
  const legacy=new CampaignProgress(storage);let coins=0;
  try{const n=Number(storage?.getItem('gravity-coins')??0);if(num(n))coins=Math.floor(n);}catch{}
  this.data={version:1,revision:0,coins,claimed:{},unlocked:LEVELS.filter(l=>l.order<=Math.max(2,legacy.data.highestUnlocked)).map(l=>l.id),campaign:clone(legacy.data),sequence:0,best:{},farthest:0,submitted:{}};
  for(const l of LEVELS){const r=legacy.record(l.id);this.data.claimed[l.id]=Math.max(r.normal?.stars??0,r.assisted?.stars??0,r.legacy?.normal?.stars??0,r.legacy?.assisted?.stars??0,r.completed?3:0);}
  // Completed-but-missing-star legacy records conservatively count as fully claimed.
  for(const l of LEVELS){const r=legacy.record(l.id),stars=Math.max(r.normal?.stars??0,r.assisted?.stars??0,r.legacy?.normal?.stars??0,r.legacy?.assisted?.stars??0);if(stars)this.data.claimed[l.id]=stars;}
  // Preserve an explicit legacy unlock floor even when an old completed record lost its stars.
  try{const old=JSON.parse(storage?.getItem('gravity-campaign')??'null');
   if(old?.version===1){
    if(Number.isInteger(old.highestUnlocked)&&old.highestUnlocked>=1&&old.highestUnlocked<=30)
     this.data.unlocked=LEVELS.filter(l=>l.order<=Math.max(2,legacy.data.highestUnlocked,old.highestUnlocked)).map(l=>l.id);
    for(const l of LEVELS)if(old.levels?.[l.id]?.completed===true&&!this.data.claimed[l.id])this.data.claimed[l.id]=3;
   }
  }catch{/* Legacy parser warning below prevents silently replacing malformed saves. */}
  try{
   this.raw=storage?.getItem(ECONOMY_KEY)??null;
   if(this.raw){const d=JSON.parse(this.raw);this.validate(d);this.data=d;}
   else{if(legacy.warning)throw Error('旧存档异常');this.persist(this.data);}
   const journal=storage?.getItem(JOURNAL_KEY);
   if(journal){const j=JSON.parse(journal);if(j.revision===this.data.revision&&j.expedition?.id===this.data.expedition?.id){
    if(!validExpedition(j.expedition))throw Error('远征日志损坏');
    const current=this.data.expedition!;
    if(j.expedition.ticks<current.ticks||j.expedition.fuelUsed<current.fuelUsed||j.expedition.damage<current.damage)throw Error('远征日志回退');
    this.data.expedition=j.expedition;
    if(j.reserved)this.data.expedition!.reason='中断发生在飞行帧内，统计含保守补计；本次不可上榜';
   }}
   if(this.data.expedition?.phase==='ready'){this.data.expedition.phase='station';this.data.expedition.snapshot=undefined;this.persist(this.data);}
   if(this.data.expedition&&['flight','retry'].includes(this.data.expedition.phase)){
    this.data.expedition.eligible=false;this.data.expedition.reason||='上次航行中断或为旧版重试存档，已结算；本次仅本机记录';this.finish(this.data);this.persist(this.data);
   }
  }catch{
   this.readOnly=true;this.warning='存档或日志异常，原文已保留；本次使用临时进度，交易不可持久化，远征不能上榜。';
   if(this.raw){try{const backup=storage?.getItem(BACKUP_KEY);if(backup){const d=JSON.parse(backup);this.validate(d);this.data=d;}}catch{}}
   if(this.data.expedition){this.data.expedition.eligible=false;this.data.expedition.reason=this.warning;if(['flight','retry'].includes(this.data.expedition.phase))this.finish(this.data);else if(this.data.expedition.phase==='ready')this.data.expedition.phase='station';}
  }
 }
 private validate(d:State){
  if(d.version!==1||!Number.isSafeInteger(d.revision)||!Number.isSafeInteger(d.coins)||!num(d.coins)||!Number.isSafeInteger(d.sequence)||!num(d.sequence)||!d.campaign?.levels||!Array.isArray(d.unlocked)||!d.unlocked.every(id=>LEVELS.some(l=>l.id===id))||!d.claimed||!Object.values(d.claimed).every(n=>Number.isInteger(n)&&num(n,3))||!d.best||!d.submitted||!num(d.farthest,30)||d.expedition&&!validExpedition(d.expedition))throw Error('Invalid save');
  for(const [kind,e] of Object.entries(d.best))rankScore(e,kind as BoardKind);
  if(d.receipt&&(!Number.isSafeInteger(d.receipt.amount)||!num(d.receipt.amount)||typeof d.receipt.doubled!=='boolean'))throw Error('Invalid receipt');
 }
 private persist(next:State){
  if(this.readOnly){if(next.expedition){next.expedition.eligible=false;next.expedition.reason=this.warning;}this.data=next;return;}
  if(!this.storage)throw Error('存储不可用，无法保存交易');
  const current=this.storage.getItem(ECONOMY_KEY);if(current!==this.raw)throw Error('另一个页面已更新存档，请重新打开游戏');
  const text=JSON.stringify(next);
  this.storage.setItem(ECONOMY_KEY,text);if(this.storage.getItem(ECONOMY_KEY)!==text)throw Error('存档未写入，操作未确认');
  this.raw=text;this.data=next;
  try{this.storage.setItem(BACKUP_KEY,text);}catch{/* Primary commit is already durable. */}
 }
 private change<T>(fn:(d:State)=>T):T{const d=clone(this.data);const result=fn(d);d.revision++;this.persist(d);return result;}
 unlocked(id:string){return this.data.unlocked.includes(id);}
 highest(){return Math.max(2,...LEVELS.filter(l=>this.unlocked(l.id)).map(l=>l.order));}
 get campaignStorage():StoragePort{return {getItem:()=>JSON.stringify(this.data.campaign),setItem:(_key,raw)=>this.change(d=>{d.campaign=JSON.parse(raw);})};}
 beginCampaign(id:string){return this.change(d=>{if(!this.unlocked(id))throw Error('航线尚未解锁');const run={id:'flight-'+(++d.sequence),levelId:id};d.active=run;return run.id;});}
 claim(id:string,run:TaskScore){
  if(this.data.receipt?.id===id)return clone(this.data.receipt);
  return this.change(d=>{
   const a=d.active;if(!a||a.id!==id||run.practice||run.stars<1)throw Error('无效通关结算');
   const level=LEVELS.find(l=>l.id===a.levelId)!;const config=ECONOMY[level.id],old=d.claimed[level.id]??0;
   const first=Math.max(0,config.awards[run.stars]-config.awards[old]),repeat=first?0:config.repeat;
   const receipt={id,levelId:level.id,amount:first+repeat,first,repeat,doubled:false};
   if(!Number.isSafeInteger(d.coins+receipt.amount))throw Error('金币超出范围');
   d.coins+=receipt.amount;d.claimed[level.id]=Math.max(old,run.stars);d.receipt=receipt;d.active=undefined;
   if((level.order<=2||run.stars>=2)&&LEVELS[level.order]&&!d.unlocked.includes(LEVELS[level.order].id))d.unlocked.push(LEVELS[level.order].id);
   const p=new CampaignProgress(undefined,{unlocked:x=>d.unlocked.includes(x),highest:()=>Math.max(...LEVELS.filter(l=>d.unlocked.includes(l.id)).map(l=>l.order))});p.data=d.campaign;p.complete(level.id,run);d.campaign=p.data;return clone(receipt);
  });
 }
 double(id:string){return this.change(d=>{const r=d.receipt;if(!r||r.id!==id)throw Error('结算已失效');if(r.doubled)return;if(!Number.isSafeInteger(d.coins+r.amount))throw Error('金币超出范围');d.coins+=r.amount;r.doubled=true;});}
 unlock(id:string){return this.change(d=>{if(d.unlocked.includes(id))return;const level=LEVELS.find(l=>l.id===id);if(!level||level.order<2)throw Error('航线无效');const previous=LEVELS[level.order-2];if(!d.campaign.levels[previous.id]?.completed)throw Error('请先完成上一关');const cost=ECONOMY[previous.id].unlock;if(d.coins<cost)throw Error('金币不足，可提升到两星免费解锁');d.coins-=cost;d.unlocked.push(id);});}
 newExpedition(){return this.change(d=>{if(d.expedition&&!d.expedition.ended)throw Error('请先结束当前远征');d.expedition={id:'exp-'+(++d.sequence),completed:0,phase:'station',resources:full(),ticks:0,fuelUsed:0,damage:0,eligible:!this.readOnly,pure:true,reason:'',services:{fuel:0,repair:0,full:0,ad:0},attempt:0,ended:false};});}
 prepareFlight(flight:Flight){
  this.change(d=>{const e=d.expedition;if(!e||e.ended||e.phase!=='station')throw Error('远征不能出航');
   e.snapshot=clone(e.resources);e.phase='ready';e.attempt++;
  });
  const e=this.data.expedition!;flight.setLevel(LEVELS[e.completed]);this.apply(flight,e.snapshot!);
 }
 private apply(f:Flight,r:Resources){f.fuel=r.fuel;f.legs=r.legs.map(l=>({...l,compression:0}));}
 sample(before:{time:number;fuel:number;health:number[]},f:Flight){const e=this.data.expedition;if(!e||!['ready','flight'].includes(e.phase))return;
  if(f.elapsed>before.time){e.phase='flight';e.resources={fuel:f.fuel,legs:f.legs.map(l=>({health:l.broken?0:l.health,broken:l.broken}))};}
  if(f.elapsed>before.time){e.ticks++;if(e.ticks>MAX_RANK_TICKS){e.eligible=false;e.reason='累计有效飞行超过榜单编码上限（约115.7小时），保留本机记录';}e.fuelUsed+=Math.max(0,before.fuel-f.fuel);e.damage+=f.legs.reduce((n,l,i)=>n+Math.max(0,before.health[i]-l.health),0);}
 }
 /** Write-ahead upper bounds prevent a hard kill mid-frame from erasing attempted work.
  * A recovered reservation is explicitly unranked, not represented as exact flight statistics. */
 reserve(steps:number,f:Flight,launch=false){let e=this.data.expedition;if(!e||steps<1||!['docked','flying'].includes(f.state))return;
  if(e.phase==='ready'&&(launch&&f.fuel>0||f.state==='flying')){this.change(d=>{d.expedition!.phase='flight';});e=this.data.expedition!;}
  if(e.phase!=='flight')return;
  const reserved=clone(e);reserved.ticks+=steps;reserved.fuelUsed+=Math.min(f.fuel,steps*CONFIG.step*(CONFIG.burn+CONFIG.attitudeBurn));reserved.damage+=f.legs.reduce((n,l)=>n+l.health,0);
  this.writeJournal(reserved,true);
 }
 private writeJournal(e:Expedition,reserved=false){try{
  if(!this.storage||this.readOnly||this.storage.getItem(ECONOMY_KEY)!==this.raw)throw Error('save');
  const raw=JSON.stringify({revision:this.data.revision,expedition:e,reserved});this.storage.setItem(JOURNAL_KEY,raw);if(this.storage.getItem(JOURNAL_KEY)!==raw)throw Error('write');
 }catch{const current=this.data.expedition;if(current){current.eligible=false;current.reason='飞行统计保存失败，本次仅本机记录';this.warning=current.reason;}}}
 flush(){const e=this.data.expedition;if(!e||e.phase!=='flight')return;this.writeJournal(e);}
 park(){const phase=this.data.expedition?.phase;if(phase==='ready'){this.change(d=>{d.expedition!.phase='station';d.expedition!.snapshot=undefined;});}else if(phase==='flight'){this.end();}}
 fail(f:Flight){if(f.state!=='failed')throw Error('航行尚未失败');this.end();}
 land(f:Flight){return this.change(d=>{const e=d.expedition;if(!e||e.phase!=='flight'||f.state!=='won'||f.level.id!==LEVELS[e.completed].id)throw Error('远征未完成当前航线');
  e.resources={fuel:f.fuel,legs:f.legs.map(l=>({health:l.broken?0:l.health,broken:l.broken}))};e.completed++;d.farthest=Math.max(d.farthest,e.completed);
  if(e.completed===30){this.finish(d);return;}
  const supply=EXPEDITION_CONFIG[e.completed];e.resources.fuel=Math.min(EXPEDITION_CAPACITY,e.resources.fuel+supply.fuel);for(const l of e.resources.legs)if(!l.broken)l.health=Math.min(100,l.health+supply.repair);
  e.phase='station';e.snapshot=undefined;
 });}
 maintain(kind:Maintenance,token:string){return this.change(d=>{const e=d.expedition;if(!e||e.phase!=='station'||token!==e.id+':'+e.completed+':'+e.attempt)throw Error('整备站已失效');
  const price=maintenancePrice(kind,e.resources.fuel,e.resources.legs),missing=e.resources.fuel<EXPEDITION_CAPACITY||e.resources.legs.some(l=>l.health<100||l.broken);
  if(!missing||kind==='fuel'&&e.resources.fuel===EXPEDITION_CAPACITY||kind==='repair'&&e.resources.legs.every(l=>l.health===100&&!l.broken))throw Error('无需整备');
  if(d.coins<price)throw Error('金币不足');d.coins-=price;
  if(kind!=='repair')e.resources.fuel=EXPEDITION_CAPACITY;if(kind!=='fuel')e.resources.legs=full().legs;e.services[kind]++;e.pure=false;
 });}
 private finish(d:State){const e=d.expedition!;e.ended=true;e.phase='ended';d.farthest=Math.max(d.farthest,e.completed);
  for(const kind of ['pure','overall'] as const){try{const score=rankScore(e,kind),old=d.best[kind];if(!old||(kind==='pure'?score<rankScore(old,kind):score>rankScore(old,kind)))d.best[kind]=clone(e);}catch{}}
 }
 end(){this.change(d=>{if(!d.expedition||d.expedition.ended)return;this.finish(d);});}
 acknowledge(kind:BoardKind,id:string,score:number){this.change(d=>{const e=d.best[kind];if(!e||e.id!==id||rankScore(e,kind)!==score)return;d.submitted[kind]=id;});}
}
