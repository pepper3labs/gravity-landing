import type { CampaignLevel } from './level-types';
import type { CampaignProgress } from './progress';
export type GoalFilter='all'|'unassisted'|'mastery';
type Progress=Pick<CampaignProgress,'record'|'unlocked'>;
export function goalLevels(levels:CampaignLevel[],progress:Progress,filter:GoalFilter){
  if(filter==='all')return levels;
  return levels.filter(level=>progress.unlocked(level.id)&&(filter==='unassisted'?!progress.record(level.id).normal:(progress.record(level.id).starTasks?.normal?.stars??0)<3));
}
export function nextReplayGoal(levels:CampaignLevel[],progress:Progress){
  const ordered=[...levels].sort((a,b)=>a.order-b.order);
  const first=goalLevels(ordered,progress,'unassisted')[0];
  if(first)return {level:first,kind:'unassisted' as const};
  const mastery=goalLevels(ordered,progress,'mastery')[0];
  return mastery?{level:mastery,kind:'mastery' as const}:undefined;
}
