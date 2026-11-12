import { asteroidAt, dragAt, hazardNear, sweepCircle } from './environment';
import type { Asteroid } from './environment';
import type { ContactTuning, LandingConditions, Obstacle, Tutorial } from './level-types';
import {frameAcceleration} from './observatory';

export const CONFIG = {
  step: 1 / 120, gravity: 30, thrust: 72, rotation: 3.8, angularDamping: 0.7,
  idleAngularDamping: 2.8, maxAngularSpeed: 1.65,
  fuel: 100, burn: 2.8, attitudeBurn: 0.18, mass: 1, inertia: 210,
  legX: 12, legY: 23, bodyRadius: 10, spring: 260, damping: 23,
  legSafeImpact: 18, legBreakImpact: 42, bodyFatalImpact: 14,
  landingVertical: 9, landingHorizontal: 7, landingAngle: 0.2, landingHold: 1.1,
  landingAngularSpeed: 0.25, emergencySpeed: 4, emergencyAngle: 0.85, emergencyAngularSpeed: 0.35, emergencyHold: 1.8
};
export type Vec = { x: number; y: number };
export type Planet = Vec & { radius: number; gravity: number; name?: string; tint?: number; appearance?: 'rock'|'ice'|'volcanic'; atmosphere?: {height:number;drag:number}; blackHole?:true };
export type Platform = { id: string; angle: number; width: number; planet: number; station?:Vec };
export interface Level {
  id: string; title: string; planets: Planet[]; platforms: Platform[]; start: string; target: string; asteroidBelts: unknown[];
  asteroids?: Asteroid[]; showTrajectory?: boolean;
  initialFuel?: number; contact?: ContactTuning; landing?: LandingConditions; obstacles?: Obstacle[]; tutorial?: Tutorial;
  rotatingFrame?:Vec & {omega:number}; missionClearance?:number;
}
export const LEVEL: Level = {
  id: 'first-light', title: '01 / 晨光弧线',
  planets: [{ x: 0, y: 700, radius: 600, gravity: CONFIG.gravity }],
  platforms: [{ id: 'start', angle: -Math.PI / 2, width: 84, planet: 0 }, { id: 'target', angle: -1.04, width: 100, planet: 0 }],
  start: 'start', target: 'target', asteroidBelts: []
};
export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
export const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
export function frame(level: Level, pad: Platform) {
  const p = level.planets[pad.planet], n = { x: Math.cos(pad.angle), y: Math.sin(pad.angle) };
  return { n, t: { x: -n.y, y: n.x }, c: pad.station??{ x: p.x + n.x * (p.radius + 8), y: p.y + n.y * (p.radius + 8) } };
}
export const DEFAULT_CONTACT: ContactTuning = { strength:1, springMultiplier:1, dampingMultiplier:1, damageMultiplier:1, bodyFatalImpact:CONFIG.bodyFatalImpact };
export const DEFAULT_LANDING: LandingConditions = { vertical:CONFIG.landingVertical,horizontal:CONFIG.landingHorizontal,angle:CONFIG.landingAngle,angularSpeed:CONFIG.landingAngularSpeed,hold:CONFIG.landingHold,allowEmergency:true,emergencySpeed:CONFIG.emergencySpeed,emergencyAngle:CONFIG.emergencyAngle,emergencyAngularSpeed:CONFIG.emergencyAngularSpeed,emergencyHold:CONFIG.emergencyHold };
export function gravityAt(level:Level, q:Vec):Vec {
  const acceleration={x:0,y:0};
  for(const p of level.planets){const dx=p.x-q.x,dy=p.y-q.y,r=Math.max(50,Math.hypot(dx,dy)),g=p.gravity*p.radius*p.radius/(r*r);acceleration.x+=dx/r*g;acceleration.y+=dy/r*g;}
  if(level.rotatingFrame){const inertial=frameAcceleration(level,q);acceleration.x+=inertial.x;acceleration.y+=inertial.y;}
  // A powered docking deck, not an invented planet: a short-range magnetic hold-down field.
  for(const pad of level.platforms)if(pad.station){const f=frame(level,pad),d={x:q.x-f.c.x,y:q.y-f.c.y},height=dot(d,f.n);
    if(height>0&&height<60&&Math.abs(dot(d,f.t))<pad.width/2-CONFIG.legX){acceleration.x-=f.n.x*2;acceleration.y-=f.n.y*2;}}
  return acceleration;
}
export function nearestPlanet(level:Level,q:Vec) {
  return level.planets.reduce((best,p)=>Math.hypot(q.x-p.x,q.y-p.y)-p.radius<Math.hypot(q.x-best.x,q.y-best.y)-best.radius?p:best);
}
export function obstacleFrame(level:Level, obstacle:Obstacle) {
  const f=frame(level,level.platforms.find(p=>p.id===obstacle.platform)!);
  const base={x:f.c.x+f.t.x*obstacle.along,y:f.c.y+f.t.y*obstacle.along};
  return {base,top:{x:base.x+f.n.x*obstacle.height,y:base.y+f.n.y*obstacle.height},n:f.n,t:f.t};
}
export type Checkpoint = { x: number; y: number; vx: number; vy: number; angle: number; omega: number; fuel: number };
export type FlightEvent = { type: 'launch' | 'contact' | 'break' | 'hull' | 'recovery' | 'won' | 'failed'; x: number; y: number; speed: number; leg?: number };
export type LandingResult = 'perfect' | 'damaged' | 'recovered';
export type FailureReport = { cause: string; advice: string; impact: number; descent: number; lateral: number; tilt: number };
export class Flight {
  x = 0; y = 0; vx = 0; vy = 0; angle = 0; omega = 0; fuel = CONFIG.fuel;
  legs = [{ health: 100, broken: false, compression: 0 }, { health: 100, broken: false, compression: 0 }];
  state: 'docked' | 'flying' | 'won' | 'failed' = 'docked';
  reason = ''; landedTime = 0; elapsed = 0; checkpoint?: Checkpoint; checkpointClock = 0;
  bodyImpact = 0; legImpacts = [0, 0]; contacts = [false, false];
  events: FlightEvent[] = []; contactCooldown = [0, 0];
  recovered = false; rescued = false; damagedAt = -1; result?: LandingResult; failure?: FailureReport;
  rescueCount=0; touchdown={vertical:0,lateral:0,angle:0}; lastTargetContact=-100;
  trajectory: (Vec & {break?:boolean})[]=[]; traceClock=0; traceInterval=.1;
  contact=DEFAULT_CONTACT; landing=DEFAULT_LANDING;
  get bodyIntegrity(){return Math.max(0,100-70*this.bodyImpact/this.contact.bodyFatalImpact);}
  constructor(public level: Level = LEVEL) { this.reset(); }
  setLevel(level:Level){this.level=level;this.reset();}
  reset() {
    this.contact={...DEFAULT_CONTACT,...this.level.contact};this.landing={...DEFAULT_LANDING,...this.level.landing};
    const pad = this.level.platforms.find(p => p.id === this.level.start)!;
    const f = frame(this.level, pad);
    this.x = f.c.x + f.n.x * CONFIG.legY; this.y = f.c.y + f.n.y * CONFIG.legY;
    this.angle = pad.angle + Math.PI / 2; this.vx = this.vy = this.omega = 0;
    this.fuel = this.level.initialFuel??CONFIG.fuel; this.state = 'docked'; this.reason = ''; this.elapsed = this.landedTime = 0;
    this.legs = [{health:100,broken:false,compression:0},{health:100,broken:false,compression:0}];
    this.checkpoint = undefined; this.checkpointClock = 0; this.bodyImpact = 0; this.legImpacts = [0,0]; this.contacts = [false,false];
    this.events = []; this.contactCooldown = [0, 0]; this.recovered = this.rescued = false;
    this.damagedAt = -1; this.result = undefined; this.failure = undefined;
    this.trajectory=[{x:this.x,y:this.y}];this.traceClock=0;this.traceInterval=.1;
    this.rescueCount=0;this.touchdown={vertical:0,lateral:0,angle:0};this.lastTargetContact=-100;
  }
  emit(type: FlightEvent['type'], speed = 0, q: Vec = this, leg?: number) {
    if(type==='won'||type==='failed')this.recordTrace(true);
    if (this.events.length === 64) this.events.shift();
    this.events.push({ type, x: q.x, y: q.y, speed, leg });
  }
  recordTrace(force=false){
    if(!this.level.showTrajectory)return;
    if(force||this.elapsed-this.traceClock>=this.traceInterval){
      this.trajectory.push({x:this.x,y:this.y});this.traceClock=this.elapsed;
      if(this.trajectory.length>4096){this.trajectory=this.trajectory.filter((p,i)=>i%2===0||p.break||this.trajectory[i+1]?.break);this.traceInterval*=2;}
    }
  }
  collideAsteroids(previous:Vec,oldAngle:number,dt:number){
    for(const a of this.level.asteroids??[]){
      const before=asteroidAt(a,this.elapsed-dt),now=asteroidAt(a,this.elapsed);
      // Cover the hull by overlapping circles, with off-centre contact torque.
      for(const local of [{x:0,y:-10,r:6},{x:-5,y:0,r:6},{x:5,y:0,r:6},{x:0,y:7,r:5}]){
        const q=this.point(local.x,local.y),old={x:previous.x+local.x*Math.cos(oldAngle)-local.y*Math.sin(oldAngle),y:previous.y+local.x*Math.sin(oldAngle)+local.y*Math.cos(oldAngle)};
        const from={x:old.x-before.x,y:old.y-before.y},to={x:q.x-now.x,y:q.y-now.y},radius=a.radius+local.r;
        const hit=sweepCircle(from,to,radius);if(hit===undefined)continue;
        const dx=from.x+(to.x-from.x)*hit,dy=from.y+(to.y-from.y)*hit,len=Math.hypot(dx,dy)||1,n={x:dx/len,y:dy/len};
        const contact={x:q.x-n.x*local.r,y:q.y-n.y*local.r},arm={x:contact.x-this.x,y:contact.y-this.y};
        const speed=Math.max(0,-((this.vx-this.omega*arm.y-now.vx)*n.x+(this.vy+this.omega*arm.x-now.vy)*n.y));
        this.bodyImpact=Math.max(this.bodyImpact,speed);
        if(speed>this.contact.bodyFatalImpact){this.x=previous.x+(this.x-previous.x)*hit;this.y=previous.y+(this.y-previous.y)*hit;this.fail('主体撞上'+a.name,a.motion?'琥珀色虚线是小行星轨迹。提前减速，等它通过或从轨迹外侧绕行。':'固定岩体不会移动。提前减速，爬升后从岩体外侧绕行；不要径直追目标箭头。',speed);return true;}
        const torque=arm.x*n.y-arm.y*n.x;this.impulse(contact,n,1.15*speed/(1+torque*torque/CONFIG.inertia));
        const correction=Math.max(0,radius-(to.x*n.x+to.y*n.y))+.01;this.x+=n.x*correction;this.y+=n.y*correction;
        if(speed>2)this.emit('hull',speed,contact);
      }
    }
    return false;
  }
  drainEvents() { return this.events.splice(0); }
  fail(cause: string, advice: string, impact = 0) {
    const p = nearestPlanet(this.level,this), a = Math.atan2(this.y-p.y, this.x-p.x);
    this.failure = { cause, advice, impact, descent: Math.max(0,-this.vx*Math.cos(a)-this.vy*Math.sin(a)),
      lateral: Math.abs(-this.vx*Math.sin(a)+this.vy*Math.cos(a)), tilt: Math.abs(wrap(this.angle-a-Math.PI/2))*180/Math.PI };
    this.state = 'failed'; this.reason = cause; this.emit('failed', impact);
  }
  point(lx: number, ly: number): Vec {
    return { x: this.x + lx * Math.cos(this.angle) - ly * Math.sin(this.angle), y: this.y + lx * Math.sin(this.angle) + ly * Math.cos(this.angle) };
  }
  surface(q: Vec): {depth:number;n:Vec;pad?:string;obstacle?:string} | undefined {
    for(const obstacle of this.level.obstacles??[]){
      const f=obstacleFrame(this.level,obstacle),d={x:q.x-f.base.x,y:q.y-f.base.y},height=Math.max(0,Math.min(obstacle.height,dot(d,f.n)));
      const dx=q.x-f.base.x-f.n.x*height,dy=q.y-f.base.y-f.n.y*height,r=Math.hypot(dx,dy);
      if(r<obstacle.radius)return {depth:obstacle.radius-r,n:r>1e-6?{x:dx/r,y:dy/r}:f.n,obstacle:obstacle.id};
    }
    for (const pad of this.level.platforms) {
      const f = frame(this.level, pad), d = { x:q.x-f.c.x,y:q.y-f.c.y };
      const height = dot(d,f.n);
      if (Math.abs(dot(d,f.t)) <= pad.width/2 && height < 0 && height > -45) return {depth:-height,n:f.n,pad:pad.id};
    }
    for (const p of this.level.planets) {
      if(p.blackHole)continue;
      const dx=q.x-p.x,dy=q.y-p.y,r=Math.hypot(dx,dy);
      if(r<p.radius) return {depth:p.radius-r,n:{x:dx/r,y:dy/r}};
    }
  }
  impact(q:Vec,n:Vec) {
    const r={x:q.x-this.x,y:q.y-this.y};
    return Math.max(0,-dot({x:this.vx-this.omega*r.y,y:this.vy+this.omega*r.x},n));
  }
  impulse(q:Vec,n:Vec,j:number) {
    this.vx+=n.x*j; this.vy+=n.y*j;
    this.omega+=((q.x-this.x)*n.y-(q.y-this.y)*n.x)*j/CONFIG.inertia;
  }
  step(thrust:boolean, turn:number, dt=CONFIG.step, tiltRate=false) {
    if(this.state==='failed'||this.state==='won') return;
    if(this.state==='docked') { if(!thrust||this.fuel<=0)return; this.state='flying'; this.emit('launch'); }
    const previous={x:this.x,y:this.y},oldAngle=this.angle;
    this.elapsed+=dt; this.contacts=[false,false];
    this.contactCooldown = this.contactCooldown.map(t=>Math.max(0,t-dt));
    const gravity=gravityAt(this.level,this);this.vx+=gravity.x*dt;this.vy+=gravity.y*dt;
    if(this.level.rotatingFrame){const w=this.level.rotatingFrame.omega,angle=-2*w*dt,c=Math.cos(angle),s=Math.sin(angle),vx=this.vx;
      this.vx=vx*c-this.vy*s;this.vy=vx*s+this.vy*c;}
    if(this.fuel>0) {
      if(thrust) {this.vx+=Math.sin(this.angle)*CONFIG.thrust*dt;this.vy-=Math.cos(this.angle)*CONFIG.thrust*dt;this.fuel-=CONFIG.burn*dt;}
      this.omega+=turn*CONFIG.rotation*dt;this.fuel-=Math.abs(turn)*CONFIG.attitudeBurn*dt;
    }
    const drag=dragAt(this.level,this);if(drag>0){const damping=Math.exp(-drag*dt);this.vx*=damping;this.vy*=damping;}
    this.fuel=Math.max(0,this.fuel);
    // Beginner rate damping stops residual spin; it never levels the craft or changes collision impulses.
    this.omega*=Math.exp(-(Math.abs(turn)<0.01?CONFIG.idleAngularDamping:CONFIG.angularDamping)*dt);
    const angularLimit=tiltRate?1.8:CONFIG.maxAngularSpeed;
    this.omega=Math.max(-angularLimit,Math.min(angularLimit,this.omega));
    this.x+=this.vx*dt;this.y+=this.vy*dt;this.angle=wrap(this.angle+this.omega*dt);
    for(const p of this.level.planets)if(p.blackHole){
      const hit=sweepCircle({x:previous.x-p.x,y:previous.y-p.y},{x:this.x-p.x,y:this.y-p.y},p.radius*2.8);
      if(hit!==undefined){this.x=previous.x+(this.x-previous.x)*hit;this.y=previous.y+(this.y-previous.y)*hit;
        this.fail('潮汐力撕裂飞船','黑洞附近的引力差超过船体承载极限。在吸积盘外围观察，远离内侧潮汐危险区。');return;}
    }
    if(this.collideAsteroids(previous,oldAngle,dt))return;this.recordTrace();
    const target=this.level.platforms.find(p=>p.id===this.level.target)!,f=frame(this.level,target);
    const approach={vertical:Math.abs(dot({x:this.vx,y:this.vy},f.n)),lateral:Math.abs(dot({x:this.vx,y:this.vy},f.t)),angle:Math.abs(wrap(this.angle-target.angle-Math.PI/2))};
    let targetContacts=0;
    for(let i=0;i<2;i++) {
      const leg=this.legs[i];leg.compression=0;
      if(leg.broken)continue;
      const q=this.point(i===0?-CONFIG.legX:CONFIG.legX,CONFIG.legY),s=this.surface(q);
      if(!s)continue;
      const speed=this.impact(q,s.n);this.legImpacts[i]=Math.max(this.legImpacts[i],speed);
      if(speed>2 && this.contactCooldown[i]===0) {this.emit('contact',speed,q,i);this.contactCooldown[i]=0.18;}
      if(speed>CONFIG.legSafeImpact*this.contact.strength)leg.health-=Math.max(0,speed-CONFIG.legSafeImpact*this.contact.strength)*3*this.contact.damageMultiplier;
      if(speed>=CONFIG.legBreakImpact*this.contact.strength||leg.health<=0) {leg.broken=true;leg.health=0;this.damagedAt=this.elapsed;this.emit('break',speed,q,i);continue;}
      this.contacts[i]=true;leg.compression=Math.min(7,s.depth);
      const arm=(q.x-this.x)*s.n.y-(q.y-this.y)*s.n.x;
      const j=Math.min((s.depth*CONFIG.spring*this.contact.springMultiplier+speed*CONFIG.damping*this.contact.dampingMultiplier)*dt, (speed+s.depth*12)/(1+arm*arm/CONFIG.inertia));
      this.impulse(q,s.n,j);
      if(s.depth>5) {this.x+=s.n.x*(s.depth-5)*0.4;this.y+=s.n.y*(s.depth-5)*0.4;}
      const t={x:-s.n.y,y:s.n.x};const lateral=dot({x:this.vx,y:this.vy},t);
      this.impulse(q,t,-lateral*Math.min(0.08,dt*3));
      if(s.pad===this.level.target)targetContacts++;
    }
    // Hull samples never depend on leg health: broken legs have no collision points.
    let bodyTargetContact=false;
    for(const local of [{x:0,y:-15},{x:-10,y:0},{x:10,y:0},{x:0,y:11}]) {
      const q=this.point(local.x,local.y),s=this.surface(q);if(!s)continue;
      const speed=this.impact(q,s.n);this.bodyImpact=Math.max(this.bodyImpact,speed);
      if(speed>this.contact.bodyFatalImpact||s.depth>9) {
        this.fail(s.obstacle?'主体撞上障碍物':s.depth>9?'主体陷入地表':'主体严重撞击', s.obstacle?'避开平台边缘的检修桩，点火抬升后对准平台中部。':'机身比支架脆弱。提前点火降低下降速度，让支架先接触平台。',speed);return;
      }
      if(speed>2)this.emit('hull',speed,q);
      if(s.pad===this.level.target)bodyTargetContact=true;
      this.impulse(q,s.n,speed*0.8);this.x+=s.n.x*s.depth*0.65;this.y+=s.n.y*s.depth*0.65;
    }
    if(targetContacts>0||bodyTargetContact){if(this.elapsed-this.lastTargetContact>.35)this.touchdown=approach;this.lastTargetContact=this.elapsed;}
    const vertical=Math.abs(dot({x:this.vx,y:this.vy},f.n)),horizontal=Math.abs(dot({x:this.vx,y:this.vy},f.t));
    const normalLanding=targetContacts===2 && vertical<this.landing.vertical && horizontal<this.landing.horizontal && Math.abs(wrap(this.angle-target.angle-Math.PI/2))<this.landing.angle && Math.abs(this.omega)<this.landing.angularSpeed;
    // A broken-leg craft can rest gently on its real hull contacts. No replacement support is added.
    const emergencyLanding=this.landing.allowEmergency && this.legs.filter(l=>l.broken).length===1 && bodyTargetContact && vertical<this.landing.emergencySpeed && horizontal<this.landing.emergencySpeed && Math.abs(wrap(this.angle-target.angle-Math.PI/2))<this.landing.emergencyAngle && Math.abs(this.omega)<this.landing.emergencyAngularSpeed;
    if((normalLanding||emergencyLanding) && !thrust) this.landedTime+=dt;
    else this.landedTime=0;
    if(this.landedTime>=(emergencyLanding?this.landing.emergencyHold:this.landing.hold)){
      this.result=this.rescued||this.recovered||this.legs.some(l=>l.broken)?'recovered':this.legs.every(l=>l.health>=95)&&this.bodyImpact<4&&Math.max(...this.legImpacts)<CONFIG.legSafeImpact?'perfect':'damaged';
      this.state='won';this.vx=this.vy=this.omega=0;this.emit('won');return;
    }
    const clearance=Math.min(...this.level.planets.map(p=>Math.hypot(this.x-p.x,this.y-p.y)-p.radius));
    if(this.damagedAt>=0&&!this.recovered&&this.elapsed-this.damagedAt>0.6&&clearance>60&&thrust){this.recovered=true;this.emit('recovery');}
    this.checkpointClock+=dt;
    if(this.level.planets.every(p=>!p.blackHole||Math.hypot(this.x-p.x,this.y-p.y)>p.radius*12)&&(hazardNear(this.level,this,this.elapsed)?.distance??Infinity)>180 && clearance>85 && Math.hypot(this.vx,this.vy)<75 && this.legs.every(l=>!l.broken) && this.checkpointClock>2) {
      this.checkpoint={x:this.x,y:this.y,vx:this.vx*0.25,vy:this.vy*0.25,angle:this.angle,omega:0,fuel:Math.min(this.level.initialFuel??CONFIG.fuel,Math.max(45,this.fuel))};this.checkpointClock=0;
    }
    if(clearance>(this.level.missionClearance??1500))this.fail('飞船离开任务空域','松开推进器，沿目标箭头返回；短喷射比持续点火更省燃料。');
    if(this.fuel===0&&this.landedTime===0&&Math.hypot(this.vx,this.vy)<1&&this.contacts.some(Boolean))this.fail('燃料耗尽','起飞后短喷射修正速度，避免持续加速。');
  }
  rescue() {
    const cp=this.checkpoint,elapsed=this.elapsed,rescues=this.rescueCount,trace=this.trajectory;
    this.reset();
    this.rescued=true;this.rescueCount=rescues+1;this.elapsed=elapsed;
    if(cp&&this.level.planets.every(p=>!p.blackHole||Math.hypot(cp.x-p.x,cp.y-p.y)>p.radius*12)&&(hazardNear(this.level,cp,elapsed)?.distance??Infinity)>180) {Object.assign(this,cp);this.state='flying';}
    this.trajectory=trace;this.trajectory.push({x:this.x,y:this.y,break:true});this.traceClock=elapsed;
  }
}
