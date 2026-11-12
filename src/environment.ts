import type { Level, Vec } from './physics';
export interface Asteroid {
  id:string; name:string; x:number; y:number; radius:number;
  motion?:{ kind:'shuttle'|'orbit'; x:number; y:number; period:number; phase:number };
}
/** Analytic positions and derivatives share the simulation clock; no random motion. */
export function asteroidAt(a:Asteroid,time:number){
  const m=a.motion;if(!m)return {x:a.x,y:a.y,vx:0,vy:0};
  const w=2*Math.PI/m.period,t=time*w+m.phase;
  return m.kind==='orbit'?{x:a.x+m.x*Math.cos(t),y:a.y+m.y*Math.sin(t),vx:-m.x*w*Math.sin(t),vy:m.y*w*Math.cos(t)}:
    {x:a.x+m.x*Math.sin(t),y:a.y+m.y*Math.sin(t),vx:m.x*w*Math.cos(t),vy:m.y*w*Math.cos(t)};
}
export function dragAt(level:Level,q:Vec){
  let drag=0;for(const p of level.planets){const a=p.atmosphere;if(a)drag+=a.drag*Math.max(0,1-Math.max(0,Math.hypot(q.x-p.x,q.y-p.y)-p.radius)/a.height);}
  return drag;
}
export function hazardNear(level:Level,q:Vec,time:number){
  let nearest:{asteroid:Asteroid;distance:number;position:ReturnType<typeof asteroidAt>}|undefined;
  for(const asteroid of level.asteroids??[]){const position=asteroidAt(asteroid,time),distance=Math.hypot(q.x-position.x,q.y-position.y)-asteroid.radius-25;
    if(!nearest||distance<nearest.distance)nearest={asteroid,distance,position};}
  return nearest;
}
/** Segment/circle intersection prevents tunnelling through a moving asteroid. */
export function sweepCircle(a:Vec,b:Vec,r:number):number|undefined{
  const dx=b.x-a.x,dy=b.y-a.y,c=a.x*a.x+a.y*a.y-r*r;
  if(c<=0)return 0;const aa=dx*dx+dy*dy;if(aa<1e-12)return;
  const bb=2*(a.x*dx+a.y*dy),disc=bb*bb-4*aa*c;if(disc<0)return;
  const t=(-bb-Math.sqrt(disc))/(2*aa);if(t>=0&&t<=1)return t;
}
