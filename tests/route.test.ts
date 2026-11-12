import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Flight,LEVEL,CONFIG,frame,wrap} from '../src/physics';
test('完整航线：从停泊起飞，飞向目标，减速并稳定着陆',()=>{
const s=new Flight(),pad=LEVEL.platforms[1],f=frame(LEVEL,pad);
let stage=0, throttle=0;
for(let i=0;i<24000&&s.state!=='failed'&&s.state!=='won';i++){
 if(stage===2&&s.contacts.some(Boolean)&&Math.hypot(s.vx,s.vy)<14)stage=3;
 if(stage===3){s.step(false,0);continue;}
 const clearance=Math.hypot(s.x,s.y-700)-600;
 if(stage===0&&clearance>115)stage=1;
 const height=stage===0?150:stage===1?145:CONFIG.legY-0.4;
 const goal=stage===0?{x:0,y:100-height}:{x:f.c.x+f.n.x*height,y:f.c.y+f.n.y*height};
 const dx=goal.x-s.x,dy=goal.y-s.y;
 if(stage===1&&Math.hypot(dx,dy)<12&&Math.hypot(s.vx,s.vy)<9)stage=2;
 const radius=Math.hypot(s.x,s.y-700),g=30*600*600/(radius*radius);
 const ax=Math.max(-28,Math.min(28,dx*.13-s.vx*.85))+s.x/radius*g;
 const ay=Math.max(-28,Math.min(28,dy*.13-s.vy*.85))+(s.y-700)/radius*g;
 const desired=Math.atan2(ax,-ay),error=wrap(desired-s.angle);
 const turn=Math.max(-1,Math.min(1,error*6-s.omega*3));
 throttle+=Math.min(1,Math.hypot(ax,ay)/72);
 const thrust=Math.abs(error)<.25&&throttle>=1;if(thrust)throttle-=1;else throttle=Math.min(throttle,1);
 const settled=stage===2&&s.contacts.some(Boolean)&&Math.hypot(s.vx,s.vy)<9&&Math.abs(wrap(s.angle-pad.angle-Math.PI/2))<.2;
 s.step(settled?false:thrust,settled?0:turn);

}
assert.equal(s.state,'won');assert.ok(s.fuel>40);assert.ok(s.legs.every(l=>l.health===100));
});






