import type { Flight } from './physics';
import type { CampaignLevel, StarThreshold } from './level-types';

export interface RunScore {
  stars:number; score:number; time:number; fuel:number; fuelRatio:number;
  assisted:boolean; practice:boolean; rescues:number; coins:number;
  result:string; legHealth:number[]; bodyIntegrity:number; touchdownSpeed:number; touchdownAngle:number;
}
export function scoreFlight(s:Flight,l:CampaignLevel,practice=false):RunScore {
  const fuelRatio=Math.min(1,s.fuel/l.initialFuel),speed=Math.hypot(s.touchdown.vertical,s.touchdown.lateral);
  const meets=(t:StarThreshold)=>fuelRatio>=t.minFuelRatio&&s.elapsed<=t.maxTime&&
    s.legs.filter(leg=>!leg.broken).every(leg=>leg.health>=t.minLegHealth)&&s.bodyIntegrity>=t.minBodyIntegrity&&
    speed<=t.maxTouchdownSpeed&&s.touchdown.angle<=t.maxTouchdownAngle&&(!t.requireBothLegs||s.legs.every(leg=>!leg.broken));
  const stars=s.state!=='won'?0:meets(l.scoring.three)?3:meets(l.scoring.two)?2:1;
  return {stars,score:stars?Math.round(stars*1000+fuelRatio*500+Math.max(0,300-s.elapsed)+s.bodyIntegrity*2+s.legs.reduce((a,b)=>a+b.health,0)):0,
    time:s.elapsed,fuel:s.fuel,fuelRatio,assisted:s.rescued||s.rescueCount>0,practice,rescues:s.rescueCount,
    coins:stars&&!practice?l.scoring.baseCoins+(stars-1)*25:0,result:s.result??'',legHealth:s.legs.map(leg=>leg.health),
    bodyIntegrity:s.bodyIntegrity,touchdownSpeed:speed,touchdownAngle:s.touchdown.angle};
}
