import type Phaser from 'phaser';
import type {Vec,Platform} from './physics';

/** Offline-integrated null geodesics; loaded once by FlightScene.preload. */
export function ensureBlackHoleArt(scene:Phaser.Scene){
 if(!scene.textures.exists('black-hole'))throw new Error('Black-hole radiance texture was not loaded');
}

export function drawStation(g:Phaser.GameObjects.Graphics,pad:Platform,project:(x:number,y:number)=>Vec,z:number,age:number,won:boolean){
 if(!pad.station)return;const q=pad.station;
 const local=(x:number,y:number)=>project(q.x+x,q.y+y);
 const line=(x:number,y:number,u:number,v:number,color:number,width=1)=>{const a=local(x,y),b=local(u,v);g.lineStyle(Math.max(.6,width*z),color,.9);g.lineBetween(a.x,a.y,b.x,b.y);};
 const poly=(points:number[][],color:number)=>{g.fillStyle(color);g.fillPoints(points.map(([x,y])=>local(x,y)),true);};
 // Collision deck is the existing 100m pad. The aft hull and arrays are behind it.
 poly([[-42,8],[42,8],[32,35],[-32,35]],0x3c5260);
 poly([[-32,35],[32,35],[25,60],[-25,60]],0x142c3c);
 for(const side of [-1,1]){
  line(side*30,32,side*125,32,0x95b5ba,3);
  for(let k=0;k<3;k++){const x=side*(62+k*24);poly([[x-9,13],[x+9,13],[x+9,60],[x-9,60]],0x173b62);
   for(let j=0;j<5;j++)line(x-9,17+j*9,x+9,17+j*9,0x4a91b9);line(x,13,x,60,0x84c4d2);}
 }
 for(let i=-2;i<=2;i++){const p=local(i*11,22);g.fillStyle(won?0xc5ffe4:0x8ae1ee,.9);g.fillRect(p.x-3*z,p.y-3*z,6*z,5*z);}
 line(0,60,0,84,0x9bbac7,2);const dish=local(0,81);g.lineStyle(Math.max(1,2*z),0xb1c4c4);g.strokeEllipse(dish.x,dish.y,32*z,10*z);
 // Visible capture coils: within 60m, finite 2m/s² hold-down, no teleport.
 for(const x of [-38,38]){const p=local(x,-2);g.fillStyle(0x8ff4d9,.15+.08*Math.sin(age*2));g.fillCircle(p.x,p.y,12*z);}
 if(won){const p=local(0,-32);g.lineStyle(1,0xb5ffe4,.45);g.strokeCircle(p.x,p.y,(65+Math.sin(age)*4)*z);}
}

export function drawTidalDebris(g:Phaser.GameObjects.Graphics,hole:Vec&{radius:number},project:(x:number,y:number)=>Vec,z:number,time:number,reduced=false){
 // Inner plasma rotates faster (Kepler r^-3/2); lens geometry stays fixed.
 for(let i=0;!reduced&&i<24;i++){
  const radius=hole.radius*(3.2+(i%8)*.7),a=i*2.39996+time*.6*(hole.radius*3/radius)**1.5;
  const u=Math.cos(a)*radius,v=Math.sin(a)*radius*.235;
  if(v<0&&Math.hypot(u,v)<hole.radius*2.6)continue;
  const p=project(hole.x+u*Math.cos(-.075)-v*Math.sin(-.075),hole.y+u*Math.sin(-.075)+v*Math.cos(-.075));
  g.fillStyle(0xb8dbff,.12+.12*(1-Math.cos(a))/2);g.fillEllipse(p.x,p.y,Math.max(1,16*z),Math.max(.5,2*z));
 }
 // A deterministic stream: progressively stretched radial fragments, then dust.
 for(let i=0;i<18;i++){
  const phase=((time*.012+i/18)%1),r=hole.radius*(6.8-4*phase),a=-1.0+phase*.8+i*.045;
  // Newtonian tidal gradient grows as r^-3; radial elongation accompanies transverse thinning.
  const stretch=Math.min(22,1+400*(hole.radius/r)**3),base=hole.radius*(.075*(1-phase)+.012);
  const p=project(hole.x+Math.cos(a)*r,hole.y+Math.sin(a)*r);
  const dx=Math.cos(a)*base*stretch*z,dy=Math.sin(a)*base*stretch*z;
  g.lineStyle(Math.max(.7,base/Math.sqrt(stretch)*z),phase>.7?0xc4e5ff:0xa8a19a,.9-phase*.4);
  g.lineBetween(p.x-dx,p.y-dy,p.x+dx,p.y+dy);
  for(let j=1;!reduced&&j<=3;j++){const t=project(hole.x+Math.cos(a-j*.015)*(r+j*12),hole.y+Math.sin(a-j*.015)*(r+j*12));g.fillStyle(0x99c9ff,(1-j/4)*phase*.6);g.fillCircle(t.x,t.y,Math.max(.5,base*z*.3));}
 }
}
