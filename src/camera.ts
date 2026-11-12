import type { Level } from './physics';
import {blackHoleView} from './observatory';
export const smooth = (current:number,target:number,rate:number,dt:number) => current+(target-current)*(1-Math.exp(-rate*dt));
export class FlightCamera {
  x=145; y=160; zoom=.8;
  overview={x:145,y:170,width:550,height:400};
  level?:Level;
  setLevel(level:Level){
    this.level=level;
    const left=Math.min(...level.planets.map(p=>p.x-p.radius*(p.blackHole?10:1))),right=Math.max(...level.planets.map(p=>p.x+p.radius*(p.blackHole?10:1)));
    const top=Math.min(...level.planets.map(p=>p.y-p.radius))-100,bottom=Math.max(...level.planets.map(p=>p.y+p.radius));
    this.overview={x:(left+right)/2,y:(top+bottom)/2,width:right-left+70,height:bottom-top+70};
    this.x=this.overview.x;this.y=this.overview.y;
  }
  fitTrajectory(level:Level,points:{x:number;y:number}[]){
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    for(const p of level.planets){const r=p.radius*(p.blackHole?10:1);xs.push(p.x-r,p.x+r);ys.push(p.y-r,p.y+r);}
    const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
    this.overview={x:(left+right)/2,y:(top+bottom)/2,width:right-left+140,height:bottom-top+140};
  }
  update(x:number,y:number,vx:number,vy:number,overview:boolean,altitude:number,width:number,height:number,dt:number) {
    const vista=!overview&&this.level?blackHoleView(this.level,x,y,width,height):undefined;
    if(vista){this.zoom=smooth(this.zoom,vista.zoom,2,dt);this.x=smooth(this.x,vista.x,2,dt);this.y=smooth(this.y,vista.y,2,dt);return;}
    const zoom=overview?Math.max(this.level?.rotatingFrame?.025:.08,Math.min((width-30)/this.overview.width,(height-300)/this.overview.height)):Math.max(1.2,Math.min(2.2,width/190))*(altitude>180?.82:1);
    this.zoom=smooth(this.zoom,zoom,overview?3:1.8,dt);
    this.x=smooth(this.x,overview?this.overview.x:x+Math.max(-45,Math.min(45,vx*.35)),overview?3:4.5,dt);
    this.y=smooth(this.y,overview?this.overview.y:y+Math.max(-25,Math.min(45,vy*.2))+25/this.zoom,overview?3:4.5,dt);
  }
}
