import type { Flight } from './physics';
import type { CampaignLevel } from './level-types';
import { scoreFlight, type RunScore } from './scoring';

export const STAR_RULES='tasks-v1' as const;
type Specialty='fuel'|'speed'|'time';
// Explicit stable IDs: adding a level requires choosing its challenge deliberately.
export const SPECIALTIES:Readonly<Record<string,Specialty>>={
  'training-launch':'fuel','training-brake':'speed','first-landing':'fuel','inertia':'time',
  'low-gravity':'fuel','binary-crossing':'fuel','precision':'speed','emergency':'fuel',
  'heavy-world':'speed','static-field':'fuel','moving-gate':'fuel','binary-debris':'fuel',
  'fuel-budget':'fuel','environment-finale':'speed','reverse-arc':'time','crossing-patrol':'fuel',
  'moon-return':'speed','atmosphere-edge':'speed','reserve-landing':'fuel','advanced-finale':'speed',
  'outer-corridor':'speed','patrol-approach':'speed','binary-reef':'speed','atmosphere-reef':'fuel',
  'narrow-harbor':'speed','twin-atmosphere':'fuel','silent-reserve':'fuel','polar-storm':'speed',
  'homeward-needle':'speed','l1-observatory':'fuel',
};
export interface StarTask {id:'landing'|'legs'|'specialty';title:string;requirement:string;met:boolean;detail:string}
export interface TaskScore extends RunScore {starRules:typeof STAR_RULES;tasks:StarTask[]}
const decimal=(n:number)=>n.toFixed(2);
// Directional rounding never displays a failed value as if it met the boundary.
const below=(n:number)=>decimal(Math.floor(n*100)/100);
const above=(n:number)=>decimal(Math.ceil(n*100)/100);
export function starTasks(level:CampaignLevel,flight?:Flight):StarTask[]{
  const kind=SPECIALTIES[level.id];if(!kind)throw new Error('缺少星级专项：'+level.id);
  const won=flight?.state==='won',limit=level.scoring.three;
  const intact=flight?.legs.every(leg=>!leg.broken)??false;
  const target=kind==='fuel'?limit.minFuelRatio*100:kind==='speed'?limit.maxTouchdownSpeed:limit.maxTime;
  const actual=flight?(kind==='fuel'?Math.min(1,flight.fuel/level.initialFuel)*100:kind==='speed'?Math.hypot(flight.touchdown.vertical,flight.touchdown.lateral):flight.elapsed):0;
  const meets=kind==='fuel'?actual>=target:actual<=target;
  const unit=kind==='fuel'?'%':kind==='speed'?' m/s':' 秒';
  const title=kind==='fuel'?'保留燃料':kind==='speed'?'轻柔触地':'及时抵达';
  const requirement=(kind==='fuel'?'剩余燃料 ≥ ':kind==='speed'?'触地合速度 ≤ ':'航行用时 ≤ ')+target+unit;
  const difference=kind==='fuel'?'还差 '+above(target-actual)+' 个百分点':'超出 '+above(actual-target)+unit;
  return [
    {id:'landing',title:'成功着陆',requirement:'抵达目标平台，单腿抢救也算完成',met:!!won,detail:won?'已抵达目标平台':'尚未完成着陆'},
    {id:'legs',title:'双腿完整',requirement:'着陆时两侧起落架均未断裂',met:!!won&&intact,
      detail:!flight?'':flight.legs.map((leg,i)=>(i===0?'左':'右')+'支架'+(leg.broken?'已断裂':'未断裂')).join(' · ')},
    {id:'specialty',title,requirement,met:!!won&&meets,
      detail:!flight?'':!won?'成功着陆后判定':'本次 '+(kind==='fuel'?below(actual):above(actual))+unit+' · '+(meets?'已达标':difference)},
  ];
}
/** Legacy scorer remains frozen for historical input archives. Live play uses this scorer. */
export function scoreTaskFlight(flight:Flight,level:CampaignLevel,practice=false):TaskScore{
  const previous=scoreFlight(flight,level,practice),tasks=starTasks(level,flight);
  const stars=tasks.filter(task=>task.met).length;
  return {...previous,starRules:STAR_RULES,tasks,stars,
    score:stars?previous.score+(stars-previous.stars)*1000:0,
    coins:stars&&!practice?level.scoring.baseCoins+(stars-1)*25:0};
}
