import { nextCampaignLevel } from './campaign';
import { LEVELS, ROUTE_REVISION } from './levels';
import type { RunScore } from './scoring';

export const SAVE_KEY='gravity-campaign';
export interface Best { stars:number; score:number; time:number; fuel:number }
export interface LevelRecord { completed:boolean; tutorialSeen:boolean; normal?:Best; assisted?:Best; routeRevision?:number; legacy?:{normal?:Best;assisted?:Best}; starTasks?:{rules:'tasks-v1';normal?:Best;assisted?:Best} }
export interface Save { version:1; catalogRevision:2; unlockedFloor:number; highestUnlocked:number; levels:Record<string,LevelRecord> }
export interface StoragePort { getItem(key:string):string|null; setItem(key:string,value:string):void }
const fresh=():Save=>({version:1,catalogRevision:2,unlockedFloor:1,highestUnlocked:1,levels:{}});
function cleanBest(value:unknown):Best|undefined {
  if(!value||typeof value!=='object')return;
  const v=value as Best;
  if(![v.stars,v.score,v.time,v.fuel].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0)||!Number.isInteger(v.stars)||v.stars<1||v.stars>3)return;
  return {stars:v.stars,score:v.score,time:v.time,fuel:v.fuel};
}
export class CampaignProgress {
  data:Save=fresh(); warning=''; private readOnly=false;
  constructor(private storage?:StoragePort,private access?:{unlocked:(id:string)=>boolean;highest:()=>number}){
    try {
      const raw=storage?.getItem(SAVE_KEY);if(!raw)return;
      const parsed=JSON.parse(raw);
      if(parsed.version!==1){this.warning='存档版本不兼容，本次使用临时进度；原存档已保留。';this.readOnly=true;return;}
      for(const l of LEVELS){const r=parsed.levels?.[l.id];if(!r||typeof r!=='object')continue;
        const sameRoute=r.routeRevision===ROUTE_REVISION;
        const normal=sameRoute?cleanBest(r.normal):undefined,assisted=sameRoute?cleanBest(r.assisted):undefined;
        const legacy=sameRoute?{normal:cleanBest(r.legacy?.normal),assisted:cleanBest(r.legacy?.assisted)}:{normal:cleanBest(r.normal),assisted:cleanBest(r.assisted)};
        const starTasks=sameRoute&&r.starTasks?.rules==='tasks-v1'?{rules:'tasks-v1' as const,normal:cleanBest(r.starTasks.normal),assisted:cleanBest(r.starTasks.assisted)}:undefined;
        this.data.levels[l.id]={completed:!!(normal||assisted||legacy.normal||legacy.assisted),tutorialSeen:sameRoute&&r.tutorialSeen===true,normal,assisted,legacy,starTasks,routeRevision:ROUTE_REVISION};}
      // A replaced finale is a different route: keep its scores as historical, never as new-route stars.
      const oldFinale=parsed.levels?.['last-horizon'];
      if(oldFinale&&!this.data.levels['l1-observatory']){
        const normal=cleanBest(oldFinale.normal),assisted=cleanBest(oldFinale.assisted);
        this.data.levels['l1-observatory']={completed:!!(normal||assisted),tutorialSeen:false,routeRevision:ROUTE_REVISION,legacy:{normal,assisted}};
      }
      if(parsed.catalogRevision===2){
        const floor=parsed.unlockedFloor;
        this.data.unlockedFloor=Number.isInteger(floor)&&floor>=1&&floor<=LEVELS.length?floor:1;
      }else if(Object.keys(parsed.levels??{}).some(id=>LEVELS.some(l=>l.id===id&&l.order>2))){
        // Inserted tutorials never relock previously available missions or award fake completions.
        this.data.unlockedFloor=3;
        for(const l of LEVELS.filter(l=>l.order>2)){
          if(!this.record(l.id).completed)break;
          this.data.unlockedFloor=Math.min(LEVELS.length,l.order+1);
        }
      }
      this.updateUnlock();
    }catch {this.warning='存档读取失败，本次使用临时进度；原存档已保留。';this.readOnly=true;}
  }
  record(id:string):LevelRecord {return this.data.levels[id]??{completed:false,tutorialSeen:false,routeRevision:ROUTE_REVISION};}
  unlocked(id:string){if(this.access)return this.access.unlocked(id);const l=LEVELS.find(l=>l.id===id);return !!l&&l.order<=this.data.highestUnlocked;}
  private updateUnlock(){
    if(this.access){this.data.highestUnlocked=this.access.highest();return;}
    let current=LEVELS[this.data.unlockedFloor-1];this.data.highestUnlocked=this.data.unlockedFloor;
    while(this.record(current.id).completed){const next=nextCampaignLevel(current);if(!next)break;this.data.highestUnlocked=next.order;current=next;}
  }
  private persist(){try{if(!this.readOnly&&this.storage)this.storage.setItem(SAVE_KEY,JSON.stringify(this.data));else if(!this.storage)this.warning='存储不可用，进度仅在本次打开期间保留。';}catch{this.warning='存储不可用，进度仅在本次打开期间保留。';}}
  seen(id:string){this.data.levels[id]={...this.record(id),tutorialSeen:true};this.persist();}
  complete(id:string,run:RunScore&{starRules?:'tasks-v1'}){
    if(run.practice||run.stars<1||!this.unlocked(id))return false;
    const r={...this.record(id)},key=run.assisted?'assisted':'normal',old=r[key];
    const current=run.starRules==='tasks-v1'?r.starTasks?.[key]:old;
    const improved=!current||run.score>current.score;r.completed=true;
    if(run.starRules==='tasks-v1')r.starTasks={...r.starTasks,rules:'tasks-v1',[key]:{
      stars:Math.max(current?.stars??0,run.stars),score:Math.max(current?.score??0,run.score),time:Math.min(current?.time??Infinity,run.time),fuel:Math.max(current?.fuel??0,run.fuel)}};
    r[key]={stars:Math.max(old?.stars??0,run.stars),score:Math.max(old?.score??0,run.score),time:Math.min(old?.time??Infinity,run.time),fuel:Math.max(old?.fuel??0,run.fuel)};
    this.data.levels[id]=r;this.updateUnlock();this.persist();return improved;
  }
}
