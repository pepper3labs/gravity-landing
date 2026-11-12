import type {Level,Vec} from './physics';

/** Circular restricted three-body model, in the co-rotating mission frame. */
export function rotatingSystem(primaryMu:number,secondaryMu:number,distance:number){
 const omega=Math.sqrt((primaryMu+secondaryMu)/distance**3),barycenter=distance*secondaryMu/(primaryMu+secondaryMu);
 const force=(x:number)=>-primaryMu/x**2+secondaryMu/(distance-x)**2+omega**2*(x-barycenter);
 let lo=distance*.00001,hi=distance*.99999;
 for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(force(mid)>0)hi=mid;else lo=mid;}
 return {omega,barycenter,l1:(lo+hi)/2};
}
export function frameAcceleration(level:Level,q:Vec,velocity:Vec={x:0,y:0}){
 const r=level.rotatingFrame;if(!r)return {x:0,y:0};
 return {x:r.omega**2*(q.x-r.x)+2*r.omega*velocity.y,y:r.omega**2*(q.y-r.y)-2*r.omega*velocity.x};
}
export function blackHoleView(level:Level,x:number,y:number,width:number,height:number){
 const hole=level.planets.find(p=>p.blackHole);if(!hole)return;
 const distance=Math.hypot(x-hole.x,y-hole.y),outer=hole.radius*10;
 if(distance>outer*2.8)return;
 // Keep the whole disk AND the player's position within the flight viewport.
 const left=Math.min(x-120,hole.x-outer),right=Math.max(x+120,hole.x+outer);
 const top=Math.min(y-120,hole.y-outer*.65),bottom=Math.max(y+120,hole.y+outer*.65);
 return {x:(left+right)/2,y:(top+bottom)/2,zoom:Math.min((width-45)/(right-left),Math.max(100,height-350)/(bottom-top))};
}
export function observationRoute(level:Level){
 const station=level.platforms.find(p=>p.station)!.station!;
 return [{x:420,y:180},{x:1800,y:100},{x:3300,y:-200},{x:3900,y:-200},{x:3000,y:-300},{x:station.x,y:330}];
}
