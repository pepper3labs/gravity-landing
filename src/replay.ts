import { CONFIG, Flight, frame, gravityAt, wrap } from './physics';
import type { CampaignLevel } from './level-types';

export interface ReplayInput { thrust: boolean; turn: number; tiltRate?:true }
export interface ReplayReport {
  levelId:string; state:Flight['state']; time:number; fuel:number; damage:number[]; bodyImpact:number;
  reason:string; steps:number; inputs:ReplayInput[];
}
/** Test pilot only: feeds normal thrust/rotation inputs to Flight.step; never moves the ship. */
export function flyRoute(level:CampaignLevel,retainInputs=false,onSample?:(flight:Flight,stage:number)=>void,alignFinal?:{height:number;angleOffset:number},prepare?:(flight:Flight)=>void):{flight:Flight;report:ReplayReport} {
  const flight=new Flight(level),pad=level.platforms.find(p=>p.id===level.target)!,f=frame(level,pad);
  const points=[...level.verificationRoute,{x:f.c.x+f.n.x*140,y:f.c.y+f.n.y*140},{x:f.c.x+f.n.x*(CONFIG.legY-1.5),y:f.c.y+f.n.y*(CONFIG.legY-1.5)}];
  prepare?.(flight);
  let stage=0,throttle=0,settling=false,steps=0;
  const inputs:ReplayInput[]=[];
  for(;steps<120*480&&flight.state!=='failed'&&flight.state!=='won';steps++){
    const final=stage===points.length-1,goal=points[stage],dx=goal.x-flight.x,dy=goal.y-flight.y;
    if(!final&&Math.hypot(dx,dy)<14&&Math.hypot(flight.vx,flight.vy)<11)stage++;
    if(final&&(pad.station?flight.contacts.every(Boolean):flight.contacts.some(Boolean))&&Math.hypot(flight.vx,flight.vy)<12&&Math.hypot(flight.x-f.c.x,flight.y-f.c.y)<50)settling=true;
    const gravity=gravityAt(level,flight);
    if(level.rotatingFrame){gravity.x+=2*level.rotatingFrame.omega*flight.vy;gravity.y-=2*level.rotatingFrame.omega*flight.vx;}
    const ax=Math.max(-28,Math.min(28,dx*.13-flight.vx*.85))-gravity.x;
    const ay=Math.max(-28,Math.min(28,dy*.13-flight.vy*.85))-gravity.y;
    // Optional test-pilot variant: align with the pad before contact even when a second planet pulls sideways.
    const height=(flight.x-f.c.x)*f.n.x+(flight.y-f.c.y)*f.n.y;
    const desired=pad.station&&final&&height<55?pad.angle+Math.PI/2:alignFinal&&final&&height<alignFinal.height?pad.angle+Math.PI/2+alignFinal.angleOffset:Math.atan2(ax,-ay),error=wrap(desired-flight.angle);
    const turn=Math.max(-1,Math.min(1,error*6-flight.omega*3));
    const projection=ax*Math.sin(flight.angle)-ay*Math.cos(flight.angle);
    throttle+=Math.min(1,Math.max(0,projection)/CONFIG.thrust);
    const thrust=Math.abs(error)<.25&&throttle>=1;
    if(thrust)throttle-=1;else throttle=Math.min(throttle,1);
    const input={thrust:settling?false:thrust,turn:settling?0:turn};
    if(retainInputs)inputs.push(input);
    flight.step(input.thrust,input.turn);
    if(steps%1200===0)onSample?.(flight,stage);
  }
  return {flight,report:{levelId:level.id,state:flight.state,time:flight.elapsed,fuel:flight.fuel,damage:flight.legs.map(l=>100-l.health),bodyImpact:flight.bodyImpact,reason:flight.reason,steps,inputs}};
}
export function replay(level:CampaignLevel,inputs:ReplayInput[]) {
  const flight=new Flight(level);for(const input of inputs)flight.step(input.thrust,input.turn,CONFIG.step,input.tiltRate===true);return flight;
}

