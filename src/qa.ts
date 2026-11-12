import { asteroidAt } from './environment';
import { Flight, CONFIG, frame } from './physics';

/** Development-only reproducible setups. The regular fixed-step solver produces all outcomes. */
export function loadQaScenario(sim:Flight, name:string):boolean {
  if(name==='asteroid'&&sim.level.asteroids?.length){const a=sim.level.asteroids[0],p=asteroidAt(a,0);sim.state='flying';sim.x=p.x-a.radius-17;sim.y=p.y;sim.vx=55;sim.vy=0;sim.angle=Math.PI/2;return true;}
  if(!['perfect','damaged','recovered','crash','single-leg'].includes(name))return false;
  const pad=sim.level.platforms.find(p=>p.id===sim.level.target)!,f=frame(sim.level,pad);
  sim.state='flying';sim.angle=pad.angle+Math.PI/2;
  let height=CONFIG.legY-.2;
  if(name==='damaged')sim.legs[0].health=60;
  if(name==='recovered')sim.rescued=true;
  if(name==='single-leg'){sim.legs[0].health=0;sim.legs[0].broken=true;sim.angle-=.78;height=9;}
  if(name==='crash'){sim.angle+=Math.PI;height=14;sim.vx=-f.n.x*35;sim.vy=-f.n.y*35;}
  sim.x=f.c.x+f.n.x*height;sim.y=f.c.y+f.n.y*height;
  return true;
}
