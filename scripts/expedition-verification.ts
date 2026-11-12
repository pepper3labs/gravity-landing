import {GameEconomy} from '../src/economy';
import {EXPEDITION_CONFIG,EXPEDITION_CAPACITY} from '../src/economy-config';
import {Flight} from '../src/physics';import {LEVELS} from '../src/levels';import {flyRoute} from '../src/replay';
export interface Profile {name:string;extraFuel:number;damagePerLeg:number;service?:'full'|'ad'}
export function verifyExpedition(profile:Profile){
 const data=new Map<string,string>(),storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
 let store=new GameEconomy(storage);store.data.coins=100000;store.newExpedition();const rows=[];
 for(const [index,level] of LEVELS.entries()){
  if(index&&profile.service&&(store.data.expedition!.resources.fuel<Math.min(235,level.initialFuel*1.15)||store.data.expedition!.resources.legs.some(l=>l.health<70))){const e=store.data.expedition!;store.maintain(profile.service,e.id+':'+e.completed+':'+e.attempt);}
  // Reopen persisted state between segments: never construct each segment with its original full fuel.
  store=new GameEconomy(storage);const flight=new Flight();store.prepareFlight(flight);
  const startFuel=flight.fuel,startLegs=flight.legs.map(l=>({...l}));
  const pilot=flyRoute(level,true,undefined,undefined,f=>{f.fuel=startFuel;f.legs=structuredClone(startLegs);});
  for(const input of pilot.report.inputs){
   const before={time:flight.elapsed,fuel:flight.fuel,health:flight.legs.map(l=>l.health)};
   flight.step(input.thrust,input.turn);flight.fuel=Math.max(0,flight.fuel-Math.max(0,before.fuel-flight.fuel)*profile.extraFuel);
   store.sample(before,flight);if(flight.state==='failed')break;
  }
  if(flight.state==='won'&&profile.damagePerLeg){const e=store.data.expedition!;for(const l of flight.legs){const damage=Math.min(l.health,profile.damagePerLeg);l.health-=damage;e.damage+=damage;if(l.health===0)l.broken=true;}}
  rows.push({order:level.order,id:level.id,state:flight.state,startFuel,remaining:flight.fuel,startLegs:startLegs.map(l=>l.health),endLegs:flight.legs.map(l=>l.health),supply:EXPEDITION_CONFIG[index].fuel});
  store.flush();if(flight.state!=='won'){store.park();return {profile,completed:index,rows,expedition:store.data.expedition,passed:false};}store.land(flight);
 }
 return {profile,completed:30,rows,expedition:store.data.expedition,passed:true};
}
