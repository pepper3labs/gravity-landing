import {LEVELS} from './levels';
export const ECONOMY_RULES='economy-v1';
export const ECONOMY=Object.fromEntries(LEVELS.map(l=>{
 const first=80+Math.floor((l.order-1)/5)*20;
 return [l.id,{awards:[0,first,first+70,first+140],repeat:Math.ceil(first*.35),unlock:Math.ceil(first*1.6)}];
}));
// Fixed tank capacity for expedition only. Original per-level fuel and physics remain unchanged.
export const EXPEDITION_CAPACITY=240;
export const EXPEDITION_CONFIG=LEVELS.map(l=>({id:l.id,fuel:Math.ceil(l.initialFuel*.55),repair:12}));
export type Maintenance='fuel'|'repair'|'full'|'ad';
export const maintenancePrice=(kind:Maintenance,fuel:number,legs:{health:number;broken:boolean}[])=>{
 const gas=Math.ceil(Math.max(0,EXPEDITION_CAPACITY-fuel)*.7);
 const repair=legs.reduce((n,l)=>n+(l.broken?80:Math.ceil((100-l.health)*.5)),0);
 return kind==='ad'?0:kind==='fuel'?gas:kind==='repair'?repair:Math.ceil((gas+repair)*.85);
};
