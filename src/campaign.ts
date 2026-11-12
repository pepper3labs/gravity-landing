import { LEVELS } from './levels';
import type { CampaignLevel } from './level-types';
/** Recommend the first unfinished unlocked route without changing unlocks or records. */
export function recommendedCampaignLevel(progress:{unlocked:(id:string)=>boolean;record:(id:string)=>{completed:boolean}}){
  const available=LEVELS.filter(level=>progress.unlocked(level.id));
  return available.find(level=>!progress.record(level.id).completed)??available[available.length-1]??LEVELS[0];
}
// Chapter continuations are progression metadata, keeping archived level configs intact.
const continuations:Record<string,string>={'environment-finale':'reverse-arc','reverse-arc':'crossing-patrol',
  'crossing-patrol':'moon-return','moon-return':'atmosphere-edge','atmosphere-edge':'reserve-landing','reserve-landing':'advanced-finale','advanced-finale':'outer-corridor','outer-corridor':'patrol-approach','patrol-approach':'binary-reef','binary-reef':'atmosphere-reef','atmosphere-reef':'narrow-harbor'};
export function nextCampaignLevel(level:CampaignLevel){
  const id=level.unlockNext??continuations[level.id]??finalContinuations[level.id];
  return LEVELS.find(candidate=>candidate.id===id&&candidate.order===level.order+1);
}
const finalContinuations:Record<string,string>={'narrow-harbor':'twin-atmosphere','twin-atmosphere':'silent-reserve',
  'silent-reserve':'polar-storm','polar-storm':'homeward-needle','homeward-needle':'l1-observatory'};
