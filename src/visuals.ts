import { asteroidAt, hazardNear } from './environment';
import Phaser from 'phaser';
import { Flight, FlightEvent, Vec, CONFIG, frame, obstacleFrame } from './physics';
import { createArt } from './art';
import { FlightCamera, smooth } from './camera';
import { telemetry, guidance } from './feedback';
import {ensureBlackHoleArt,drawStation,drawTidalDebris} from './black-hole-art';
import {createBlackHole,updateBlackHole} from './black-hole-pipeline';

type Particle={x:number;y:number;vx:number;vy:number;life:number;max:number;size:number;color:number;debris:boolean};
export class FlightView {
  camera=new FlightCamera();
  background:Phaser.GameObjects.Image; planets:Phaser.GameObjects.Image[];
  g:Phaser.GameObjects.Graphics; fx:Phaser.GameObjects.Graphics; ship:Phaser.GameObjects.Image;
  labels:Phaser.GameObjects.Text[]; targetLabel:Phaser.GameObjects.Text; velocityLabel:Phaser.GameObjects.Text;
  stars:{x:number;y:number;size:number;alpha:number}[]=[];
  particles:Particle[]=[]; kicks=[0,0]; kickAge=[0,0]; compression=[0,0]; shake=0; flash=0; engine=0; exhaustClock=0;
  age=0; observatoryAge=0; previous?:{x:number;y:number;angle:number}; renderX=0;renderY=0;renderAngle=0;
  constructor(private scene:Phaser.Scene, private sim:Flight){
    createArt(scene);this.camera.setLevel(sim.level);this.background=scene.add.image(0,0,'haze').setOrigin(0);
    this.g=scene.add.graphics();
    if(sim.level.planets.some(p=>p.blackHole))ensureBlackHoleArt(scene);
    this.planets=sim.level.planets.map(p=>p.blackHole?createBlackHole(scene):scene.add.image(0,0,p.appearance?'planet-'+p.appearance:'planet'));
    this.fx=scene.add.graphics();this.ship=scene.add.image(0,0,'lander');
    this.labels=sim.level.platforms.map(p=>scene.add.text(0,0,p.id===sim.level.target?'目标着陆区':'发射台',{fontSize:'10px',fontFamily:'system-ui',color:p.id===sim.level.target?'#8ce4ca':'#839cae',letterSpacing:1}).setOrigin(.5));
    this.targetLabel=scene.add.text(0,0,'',{fontSize:'10px',fontFamily:'system-ui',color:'#b6efd9',backgroundColor:'#0b1c2b',padding:{x:7,y:4}}).setOrigin(.5);
    this.velocityLabel=scene.add.text(0,0,'惯性',{fontSize:'9px',fontFamily:'system-ui',color:'#dcb576'}).setOrigin(.5);
    this.fx.setDepth(3);this.ship.setDepth(2);this.labels.forEach(l=>l.setDepth(4));this.targetLabel.setDepth(4);this.velocityLabel.setDepth(4);
    let seed=341;const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647;};
    for(let i=0;i<110;i++)this.stars.push({x:rand(),y:rand(),size:rand()>.95?1.5:.65,alpha:.2+rand()*.5});
  }
  setLevel(){
    this.planets.forEach(p=>p.destroy());this.labels.forEach(p=>p.destroy());
    if(this.sim.level.planets.some(p=>p.blackHole))ensureBlackHoleArt(this.scene);
    this.planets=this.sim.level.planets.map(p=>p.blackHole?createBlackHole(this.scene):this.scene.add.image(0,0,p.appearance?'planet-'+p.appearance:'planet'));
    this.labels=this.sim.level.platforms.map(p=>this.scene.add.text(0,0,p.id===this.sim.level.target?'目标着陆区':'发射台',{fontSize:'10px',fontFamily:'system-ui',color:'#8ce4ca'}).setOrigin(.5).setDepth(4));
    this.camera.setLevel(this.sim.level);this.reset();
  }
  reset(){this.particles=[];this.kicks=[0,0];this.kickAge=[0,0];this.compression=[0,0];this.engine=this.shake=this.flash=0;this.observatoryAge=0;this.previous=undefined;}
  snapshot(){this.previous={x:this.sim.x,y:this.sim.y,angle:this.sim.angle};}
  event(e:FlightEvent){
    if(e.type==='contact'){this.kicks[e.leg!]=Math.min(6,e.speed*.26);this.kickAge[e.leg!]=0;this.shake=Math.max(this.shake,Math.min(5,e.speed*.2));this.burst(e,12,0xb2c6b8,18,false);}
    if(e.type==='break'){this.shake=8;this.flash=.24;this.burst(e,22,0xf7b968,75,false);this.burst(e,5,0xaac1c7,35,true);}
    if(e.type==='hull'){this.shake=Math.max(this.shake,3);this.burst(e,5,0xffbb72,30,false);}
    if(e.type==='failed'){this.shake=12;this.flash=.7;this.burst(e,48,0xffb06f,95,false);this.burst(e,12,0xa4b6bc,65,true);}
    if(e.type==='won')this.burst(e,28,0x8df7ca,35,false);
  }
  burst(q:Vec,count:number,color:number,speed:number,debris:boolean){
    for(let i=0;i<count&&this.particles.length<150;i++){
      const a=Math.random()*Math.PI*2,v=speed*(.3+Math.random()*.7),life=debris?1.6:.3+Math.random()*.65;
      this.particles.push({x:q.x,y:q.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life,max:life,size:debris?2.3:1+Math.random()*1.5,color,debris});
    }
  }
  render(dt:number,alpha:number,on:boolean,turn:number,started:boolean,paused:boolean,reduced:boolean){
    const s=this.sim,scene=this.scene,w=scene.scale.width,h=scene.scale.height,t=telemetry(s),g=this.g,fx=this.fx;
    const fxdt=paused?0:dt;this.age+=fxdt;
    // Keep one continuous phase when pausing or changing reduced-motion settings.
    if(started&&!reduced)this.observatoryAge+=fxdt;
    this.engine=smooth(this.engine,on&&s.state==='flying'&&s.fuel>0&&!paused?1:0,13,dt);
    const review=!!s.level.showTrajectory&&(s.state==='won'||s.state==='failed');
    if(review)this.camera.fitTrajectory(s.level,s.trajectory);
    this.camera.update(s.x,s.y,s.vx,s.vy,!started||s.state==='docked'||review,t.altitude,w,h,dt);
    this.shake=smooth(this.shake,0,9,fxdt);this.flash=Math.max(0,this.flash-fxdt*2);
    const vibration=reduced||paused?0:this.shake;
    const offsetX=Math.sin(this.age*83)*vibration,offsetY=Math.cos(this.age*97)*vibration*.6;
    const z=this.camera.zoom;
    const project=(x:number,y:number):Vec=>({x:(x-this.camera.x)*z+w/2+offsetX,y:(y-this.camera.y)*z+h*.48+offsetY});
    this.background.setDisplaySize(w,h);g.clear();fx.clear();
    for(const star of this.stars){g.fillStyle(0xb1cbd8,star.alpha);g.fillCircle(star.x*w-this.camera.x*.012%10,star.y*h-this.camera.y*.008%8,star.size);}
    g.lineStyle(1,0x608b99,.07);for(let i=1;i<5;i++)g.lineBetween(w*i/5,160,w*i/5,h-180);
    s.level.planets.forEach((p,i)=>{
      const q=project(p.x,p.y);
      if(p.blackHole){updateBlackHole(this.planets[i],this.observatoryAge);this.planets[i].setVisible(started).setPosition(q.x,q.y).setDisplaySize(p.radius*20*z,p.radius*20*z*2/3);return;}
      this.planets[i].setVisible(started||i===0).setTint(p.tint??0xffffff).setPosition(started?q.x:w*.29,started?q.y:h+235).setDisplaySize(started?p.radius*1400/650*z:w*2.6,started?p.radius*1400/650*z:w*2.6);
    });
    this.labels.forEach(l=>l.setVisible(started));this.targetLabel.setVisible(false);this.velocityLabel.setVisible(false);
    if(started){
      for(const p of s.level.planets)if(p.blackHole){
        drawTidalDebris(fx,p,project,z,this.observatoryAge,reduced);
        const q=project(p.x,p.y);fx.lineStyle(1,0xf09a6c,.35);fx.strokeCircle(q.x,q.y,p.radius*2.8*z);
      }
      for(const p of s.level.planets)if(p.atmosphere){const q=project(p.x,p.y);fx.lineStyle(1,0x7cbbb9,.18);fx.strokeCircle(q.x,q.y,(p.radius+p.atmosphere.height)*z);}
      for(const pad of s.level.platforms){
        drawStation(fx,pad,project,z,this.observatoryAge,s.state==='won');
        const f=frame(s.level,pad),local=(x:number,y:number)=>project(f.c.x+f.t.x*x+f.n.x*y,f.c.y+f.t.y*x+f.n.y*y);
        const corners=[local(-pad.width/2,0),local(pad.width/2,0),local(pad.width/2,-7),local(-pad.width/2,-7)];
        fx.fillStyle(0x344b58);fx.fillPoints(corners,true);
        fx.lineStyle(1,0x69858b);fx.strokePoints(corners,true);
        const a=local(-pad.width/2,0),b=local(pad.width/2,0);fx.lineStyle(2*z,pad.id===s.level.target?0x8cdfb7:0xb3cad2);fx.lineBetween(a.x,a.y,b.x,b.y);
        for(let i=-pad.width/2+6;i<pad.width/2;i+=12){const a=local(i,-3),b=local(i+5,-6);fx.lineStyle(1.5*z,0xc7a56e,.7);fx.lineBetween(a.x,a.y,b.x,b.y);}
        for(const x of [-pad.width/2+4,pad.width/2-4]){const a=local(x,0),b=local(x,9);fx.lineStyle(1*z,0x7b939e);fx.lineBetween(a.x,a.y,b.x,b.y);fx.fillStyle(0x92edc6,.22);fx.fillCircle(b.x,b.y,6*z);fx.fillStyle(0xb8ffe0);fx.fillCircle(b.x,b.y,1.5*z);}
        if(pad.id===s.level.target){const c=local(0,1);fx.lineStyle(1,0x9be9c7,.2);fx.strokeEllipse(c.x,c.y,40*z,12*z);}
        const q=local(0,-21),label=this.labels[s.level.platforms.indexOf(pad)];if(pad.station)label.setText('L1 · 静界研究站');label.setPosition(q.x,q.y).setVisible(q.y>150&&q.y<h-190);
      }
    }
    if(started)for(const obstacle of s.level.obstacles??[]){
      const f=obstacleFrame(s.level,obstacle),a=project(f.base.x,f.base.y),b=project(f.top.x,f.top.y),r=obstacle.radius*z;
      fx.lineStyle(r*2,0x655950);fx.lineBetween(a.x,a.y,b.x,b.y);fx.fillStyle(0x655950);fx.fillCircle(a.x,a.y,r);fx.fillCircle(b.x,b.y,r);
      fx.lineStyle(Math.max(1,2*z),0xe6b470);fx.lineBetween(a.x,a.y,b.x,b.y);fx.strokeCircle(b.x,b.y,r);
      fx.fillStyle(0xffa171,.55+.25*Math.sin(this.age*5));fx.fillCircle(b.x,b.y,2*z);
    }
    if(started){
      const hazard=hazardNear(s.level,s,s.elapsed);
      for(const a of s.level.asteroids??[]){
        const pos=asteroidAt(a,s.elapsed),q=project(pos.x,pos.y),r=a.radius*z;
        if(a.motion){
          fx.lineStyle(1,0xe3b273,.4);
          for(let i=0;i<64;i+=2){const a0=asteroidAt(a,i/64*a.motion.period),a1=asteroidAt(a,(i+1)/64*a.motion.period),u=project(a0.x,a0.y),v=project(a1.x,a1.y);fx.lineBetween(u.x,u.y,v.x,v.y);}
          const v=project(pos.x+pos.vx*1.5,pos.y+pos.vy*1.5);fx.lineStyle(1.5,0xffce88,.8);fx.lineBetween(q.x,q.y,v.x,v.y);fx.fillStyle(0xffce88);fx.fillCircle(v.x,v.y,2);
        }
        const near=hazard?.asteroid===a&&hazard.distance<150;
        fx.lineStyle(1,near?0xff9276:0xb8a57f,near?.85:.4);fx.strokeCircle(q.x,q.y,r+4);
        // Visible circular silhouette matches the solid collision radius.
        fx.fillStyle(0x4c515a);fx.fillCircle(q.x,q.y,r);fx.lineStyle(Math.max(1,z),0x9a9b93,.8);fx.strokeCircle(q.x,q.y,r);
        for(let i=0;i<5;i++){const angle=i*2.4+a.radius,c=project(pos.x+Math.cos(angle)*a.radius*.55,pos.y+Math.sin(angle)*a.radius*.55);fx.fillStyle(0x273744,.8);fx.fillCircle(c.x,c.y,r*(.1+i*.018));fx.lineStyle(1,0xafa790,.3);fx.strokeCircle(c.x-1,c.y-1,r*(.1+i*.018));}
        if(near&&!review){const dx=q.x-w/2,dy=q.y-h*.48,k=Math.min(1,(w/2-22)/Math.max(1,Math.abs(dx)),(h*.3)/Math.max(1,Math.abs(dy)));const x=w/2+dx*k,y=h*.48+dy*k;fx.lineStyle(2,0xffab75,.85);fx.strokeCircle(x,y,9);}
      }
      if(review&&s.trajectory.length){
        fx.lineStyle(1.5,s.state==='won'?0x9de7cc:0xf0b176,.9);
        s.trajectory.forEach((p,i)=>{if(!i||p.break)return;const a=project(s.trajectory[i-1].x,s.trajectory[i-1].y),b=project(p.x,p.y);fx.lineBetween(a.x,a.y,b.x,b.y);});
        const first=s.trajectory[0],a=project(first.x,first.y),b=project(s.x,s.y);fx.fillStyle(0x9de7cc);fx.fillCircle(a.x,a.y,4);fx.lineStyle(2,s.state==='won'?0x9de7cc:0xff8979);fx.strokeCircle(b.x,b.y,6);
      }
    }
    const previous=this.previous??s;
    this.renderX=Phaser.Math.Linear(previous.x,s.x,alpha);this.renderY=Phaser.Math.Linear(previous.y,s.y,alpha);
    this.renderAngle=previous.angle+Math.atan2(Math.sin(s.angle-previous.angle),Math.cos(s.angle-previous.angle))*alpha;
    const center=started?project(this.renderX,this.renderY):{x:w/2,y:h*.435},scale=started?z:Math.min(w/100,h/(h<600?215:190),4.1),angle=started?this.renderAngle:-.12;
    const point=(x:number,y:number):Vec=>({x:center.x+(x*Math.cos(angle)-y*Math.sin(angle))*scale,y:center.y+(x*Math.sin(angle)+y*Math.cos(angle))*scale});
    if(!started){
      fx.lineStyle(1,0x77a6b3,.22);fx.strokeCircle(center.x,center.y,80);fx.strokeCircle(center.x,center.y,105);
      fx.lineStyle(1,0x93d5c4,.45);fx.lineBetween(center.x-120,center.y,center.x-95,center.y);fx.lineBetween(center.x+95,center.y,center.x+120,center.y);
    }
    // Plume light and particles are strictly visual.
    if(this.engine>.02){
      const glow=point(0,18);fx.fillStyle(0xf0b974,this.engine*.08);fx.fillCircle(glow.x,glow.y,28*scale);
      const length=18+this.engine*22+Math.sin(this.age*61)*4;
      fx.fillStyle(0xd37c48,.36);fx.fillPoints([point(-6,13),point(-3,25),point(0,length),point(4,26),point(6,13)],true);
      fx.fillStyle(0xffc279,.9);fx.fillPoints([point(-4,13),point(0,length*.82),point(4,13)],true);
      fx.fillStyle(0xf8f8d8);fx.fillPoints([point(-2.5,13),point(0,26),point(2.5,13)],true);
      this.exhaustClock+=fxdt;const interval=reduced?.07:.025;
      if(this.exhaustClock>=interval){this.exhaustClock=0;const q=s.point(0,17);this.burst(q,2,0xeeb880,9,false);const last=this.particles[this.particles.length-1];if(last){last.vx=s.vx-Math.sin(s.angle)*60;last.vy=s.vy+Math.cos(s.angle)*60;last.life=last.max=.5;}}
    }
    for(let i=this.particles.length-1;i>=0;i--){
      const p=this.particles[i];p.life-=fxdt;if(p.life<=0){this.particles.splice(i,1);continue;}
      p.x+=p.vx*fxdt;p.y+=p.vy*fxdt;if(p.debris)p.vy+=15*fxdt;
      const q=project(p.x,p.y);fx.fillStyle(p.color,Math.min(1,p.life/p.max));
      if(p.debris){fx.fillRect(q.x,q.y,p.size*z*2,p.size*z);}else fx.fillCircle(q.x,q.y,p.size*z);
    }
    this.ship.setPosition(center.x,center.y).setDisplaySize(32*scale,256/6*scale).setRotation(angle).setTint(s.state==='failed'?0x807773:0xffffff);
    for(let i=0;i<2;i++){
      this.kicks[i]=smooth(this.kicks[i],0,8,fxdt);
      this.kickAge[i]+=fxdt;
      this.compression[i]=smooth(this.compression[i],Math.max(-.5,Math.min(6,s.legs[i].compression*2+this.kicks[i]*Math.cos(this.kickAge[i]*22))),25,fxdt);
      const side=i===0?-1:1,broken=s.legs[i].broken;
      const hip=point(side*7,6),knee=point(side*11,14-this.compression[i]*.4),foot=point(side*CONFIG.legX,CONFIG.legY-this.compression[i]);
      fx.lineStyle(3*scale,0x203447);fx.lineBetween(hip.x,hip.y,knee.x,knee.y);
      fx.lineStyle(1.3*scale,broken?0xd98765:0xc5d7d3);fx.lineBetween(hip.x,hip.y,knee.x,knee.y);
      if(!broken){
        fx.lineStyle(2.7*scale,0x223642);fx.lineBetween(knee.x,knee.y,foot.x,foot.y);
        fx.lineStyle(1.1*scale,s.legs[i].health<70?0xd5a369:0x93c7bf);fx.lineBetween(knee.x,knee.y,foot.x,foot.y);
        const a=point(side*12-4,CONFIG.legY-this.compression[i]),b=point(side*12+4,CONFIG.legY-this.compression[i]);
        fx.lineStyle(2*scale,0x8ba3ac);fx.lineBetween(a.x,a.y,b.x,b.y);
        fx.fillStyle(s.contacts[i]?0xb7ffce:0xe4b56c);fx.fillCircle(knee.x,knee.y,1.4*scale);
      }else{fx.fillStyle(0xff9d65,.5+.3*Math.sin(this.age*16));fx.fillCircle(knee.x,knee.y,1.6*scale);}
    }
    if(turn!==0&&s.state==='flying'&&s.fuel>0&&!paused){
      const side=turn>0?-1:1,a=point(side*10,-3),b=point(side*19,-1),c=point(side*10,1);
      fx.fillStyle(0xa8e9ef,.8);fx.fillTriangle(a.x,a.y,b.x,b.y,c.x,c.y);
    }
    if(started&&s.state==='flying'){
      if(t.speed>4){
        const length=Math.min(78,t.speed*.85),end={x:center.x+s.vx/t.speed*length,y:center.y+s.vy/t.speed*length};
        fx.lineStyle(1,0xf0bd77,.6);fx.lineBetween(center.x,center.y,end.x,end.y);fx.strokeCircle(end.x,end.y,3);
        this.velocityLabel.setPosition(end.x,end.y+12).setVisible(end.y>160&&end.y<h-190);
      }
      const q=project(t.target.c.x,t.target.c.y),top=178,bottom=Math.max(top+40,h-210),mx=w/2,my=(top+bottom)/2;
      if(q.x<26||q.x>w-26||q.y<top||q.y>bottom){
        const dx=q.x-mx,dy=q.y-my,factor=Math.min((w/2-30)/Math.max(1,Math.abs(dx)),((bottom-top)/2)/Math.max(1,Math.abs(dy)));
        const x=mx+dx*factor,y=my+dy*factor,a=Math.atan2(dy,dx);
        fx.fillStyle(0xb1f0c9);fx.fillTriangle(x+Math.cos(a)*8,y+Math.sin(a)*8,x+Math.cos(a+2.4)*6,y+Math.sin(a+2.4)*6,x+Math.cos(a-2.4)*6,y+Math.sin(a-2.4)*6);
        this.targetLabel.setText('目标 '+Math.round(t.distance)+' m').setPosition(Phaser.Math.Clamp(x,55,w-55),y+(dy>0?-21:21)).setVisible(true);
      }
      if(guidance(s).id==='danger'){fx.lineStyle(2,0xef8876,.3+.12*Math.sin(this.age*7));fx.strokeRoundedRect(3,3,w-6,h-6,18);}
      if(s.landedTime>0){fx.lineStyle(2,0xa4f3c7,.8);fx.beginPath();fx.arc(center.x,center.y,39*scale,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,s.landedTime/(s.legs.some(l=>l.broken)?s.landing.emergencyHold:s.landing.hold)),false);fx.strokePath();}
    }
    if(this.flash>0&&!reduced){fx.fillStyle(0xe5906f,this.flash*.15);fx.fillRect(0,0,w,h);}
    if(started&&s.level.rotatingFrame&&z<.5&&s.state==='flying'){
      // Screen-sized nose marker, independent of velocity and world zoom.
      // Draw last with a dark outline so it stays legible over the bright disk.
      const nose=(x:number,y:number)=>({x:center.x+x*Math.cos(angle)-y*Math.sin(angle),y:center.y+x*Math.sin(angle)+y*Math.cos(angle)});
      const tip=nose(0,-20),left=nose(-5,-11),right=nose(5,-11);
      fx.lineStyle(4,0x07131f,.95);fx.strokeCircle(center.x,center.y,8);
      fx.lineStyle(1.5,0x98efdb,1);fx.strokeCircle(center.x,center.y,8);
      fx.fillStyle(0x98efdb,1);fx.fillTriangle(tip.x,tip.y,left.x,left.y,right.x,right.y);
      fx.lineStyle(2,0x07131f,1);fx.strokeTriangle(tip.x,tip.y,left.x,left.y,right.x,right.y);
    }
  }
}
