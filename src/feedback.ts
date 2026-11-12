import { hazardNear } from './environment';
import { CONFIG, Flight, dot, frame, wrap, nearestPlanet, gravityAt } from './physics';

export function telemetry(s: Flight) {
  const planet = nearestPlanet(s.level,s);
  const dx = s.x - planet.x, dy = s.y - planet.y, radius = Math.hypot(dx, dy);
  const normal = { x: dx / radius, y: dy / radius }, tangent = { x: -normal.y, y: normal.x };
  const pad = s.level.platforms.find(p => p.id === s.level.target)!;
  const target = frame(s.level, pad);
  const velocity = { x: s.vx, y: s.vy };
  const distance = Math.hypot(target.c.x - s.x, target.c.y - s.y);
  const descent = -dot(velocity, normal);
  const gravity=gravityAt(s.level,s);
  const dominant=s.level.planets.reduce((best,p)=>{
    const pull=(q:typeof p)=>q.gravity*q.radius*q.radius/Math.max(2500,(s.x-q.x)**2+(s.y-q.y)**2);
    return pull(p)>pull(best)?p:best;
  });
  return {
    gravity:Math.hypot(gravity.x,gravity.y),gravitySource:dominant.name??'星球',
    altitude: Math.max(0, radius - planet.radius - CONFIG.legY),
    speed: Math.hypot(s.vx, s.vy), descent, lateral: dot(velocity, tangent),
    tilt: wrap(s.angle - Math.atan2(dy, dx) - Math.PI / 2) * 180 / Math.PI,
    targetTilt: wrap(s.angle - pad.angle - Math.PI / 2) * 180 / Math.PI,
    targetDescent: -dot(velocity, target.n), targetLateral: dot(velocity, target.t),
    distance, target, stoppingDistance: Math.max(0, descent) ** 2 / (2 * Math.max(1,CONFIG.thrust-Math.hypot(gravityAt(s.level,s).x,gravityAt(s.level,s).y))),
  };
}
export type Guidance = { id: string; title: string; detail: string; tone: 'calm' | 'good' | 'warning' | 'danger'; step: number };
export function guidance(s: Flight): Guidance {
  const t = telemetry(s), lesson=s.level.tutorial, limits=s.landing;
  const hole=s.level.planets.find(p=>p.blackHole);
  if(hole&&s.state==='flying'&&Math.hypot(s.x-hole.x,s.y-hole.y)<hole.radius*28)return {id:'observe',title:'黑洞观测 · 保持外围距离',detail:'吸积盘内侧有致命潮汐力。镜头已拉远，薄荷色圆圈是飞船；观察后沿目标箭头返回研究站。',tone:'warning',step:2};
  if(s.level.rotatingFrame&&s.state==='docked')return {id:'ready',title:'终航 / 前往L1研究站',detail:'先沿发射台朝向短喷离地，再向右转移。研究站位于行星与黑洞之间。',tone:'calm',step:0};
  if (s.state === 'docked') return { id:'ready', title:'01 / 点火离港', detail:'右手按住推进，爬升到 '+(lesson?.climbHeight??80)+' m 左右，再短喷转向。', tone:'calm', step:0 };
  if (s.landedTime > 0) return { id:'settle', title:'保持静止 · 正在确认着陆', detail:'松开所有按键，让缓冲支架吸收余震。', tone:'good', step:3 };
  if (s.legs.some(l => l.broken)) return { id:'damage', title:s.recovered?'已脱离危险 · 准备迫降':'支架断裂 · 立即补救', detail:'点火抬升，反向旋转抑制倾倒；法向与横移速度均低于 '+limits.emergencySpeed+' 可轻触迫降。', tone:'danger', step:3 };
  const hazard=hazardNear(s.level,s,s.elapsed);
  if(hazard&&hazard.distance<150)return {id:'danger',title:'小行星接近 · '+Math.max(0,Math.round(hazard.distance))+' m',detail:hazard.asteroid.name+'：先减速，避开琥珀色轨迹；机身擦碰也会改变姿态。',tone:'danger',step:2};
  if (t.descent > limits.vertical && (t.altitude < Math.max(65,t.stoppingDistance+28))) return { id:'danger', title:'下降过快 · 立即制动', detail:'机头朝离开地表的方向，长按点火减速。', tone:'danger', step:2 };
  if (t.distance < (lesson?.approachRange??150)) {
    if (Math.abs(t.targetLateral)>limits.horizontal) return { id:'brake', title:'03 / 抵消横向速度', detail:'以平台外侧为机头基准，逆着横移方向短喷；不要按屏幕左右判断。', tone:'warning', step:2 };
    return { id:'approach', title:'04 / 对准平台，轻柔落下', detail:'法向 < '+limits.vertical+' · 横移 < '+limits.horizontal+' · 姿态 ±'+Math.round(limits.angle*180/Math.PI)+'°；触地后松开推进。', tone:'good', step:3 };
  }
  if (s.elapsed < 4 && t.altitude < (lesson?.climbHeight??80)) return { id:'climb', title:'01 / 感受推力，稳定爬升', detail:'保持直立，右手点火；松开推进后仍会惯性上升。', tone:'calm', step:0 };
  if (Math.abs(t.lateral)>(lesson?.speedGuide??32)) return { id:'coast', title:'02 / 速度足够，准备减速', detail:lesson?.brake??'松开推进器，轻点左旋让机头朝速度反方向。', tone:'warning', step:1 };
  return { id:'transfer', title:'02 / 沿地表绕行，保持高度', detail:lesson?.transfer??'左手控制朝向，右手短喷射；松开旋转会抑制自转。', tone:'calm', step:1 };
}
export const RESULT = {
  perfect:{ title:'完美着陆', subtitle:'精准、平稳，双支架完整。', rank:'S', coins:150, color:'mint' },
  damaged:{ title:'受损着陆', subtitle:'有惊无险，飞船安全抵达。', rank:'B', coins:100, color:'amber' },
  recovered:{ title:'抢救成功', subtitle:'重新夺回控制，带着飞船回家。', rank:'R', coins:120, color:'amber' },
};
