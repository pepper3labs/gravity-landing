import { CONFIG, DEFAULT_CONTACT, DEFAULT_LANDING, frame, obstacleFrame } from './physics';
import type { CampaignLevel, ContactTuning, LandingConditions, ScoringRules, Tutorial } from './level-types';
import {rotatingSystem} from './observatory';

export const ROUTE_REVISION=2;
const radians=(degrees:number)=>degrees*Math.PI/180;
const contact=(strength:number,buffer=1):ContactTuning=>({...DEFAULT_CONTACT,strength,springMultiplier:buffer,dampingMultiplier:buffer,damageMultiplier:1});
const landing=(angle:number,vertical=9,horizontal=7,hold=1.1):LandingConditions=>({...DEFAULT_LANDING,angle:radians(angle),vertical,horizontal,hold});
const scoring=(fuel:number,time:number,touch:number,angle:number):ScoringRules=>({
  baseCoins:100,
  two:{minFuelRatio:.08,maxTime:time*2,minLegHealth:35,minBodyIntegrity:60,maxTouchdownSpeed:touch*2,maxTouchdownAngle:radians(angle*2),requireBothLegs:false},
  three:{minFuelRatio:fuel,maxTime:time,minLegHealth:90,minBodyIntegrity:90,maxTouchdownSpeed:touch,maxTouchdownAngle:radians(angle),requireBothLegs:true},
});
const tutorial=(topic:string,paragraphs:string[],transfer:string,brake:string,approach:string,climbHeight=110):Tutorial=>({
  topic,paragraphs,transfer,brake,approach,climbHeight,approachRange:170,speedGuide:32,showLandingAssist:true,
});
const base={showTrajectory:true,chapter:'第一章 · 曙光航线',ship:{model:'GL-01' as const,initialState:'docked' as const},start:'start',target:'target',asteroidBelts:[]};
// Clearance waypoints describe an input-only verification route around the solid planet.
const arc=(x:number,y:number,radius:number,from:number,to:number)=>{
  const count=Math.ceil(Math.abs(to-from)/(Math.PI/4));
  return Array.from({length:count+1},(_,i)=>({x:x+Math.cos(from+(to-from)*i/count)*radius,y:y+Math.sin(from+(to-from)*i/count)*radius}));
};
export const LEVELS:CampaignLevel[]=[
  {...base,id:'training-launch',order:1,title:'起飞训练',description:'目标就在右侧，先学会点火、轻转和松手。',objectives:['按住推进离开平台','轻点右旋，短喷靠近目标','减速后松开推进，双脚轻触平台'],
    planets:[{x:0,y:700,radius:600,gravity:30,name:'曙光 · 训练基地',tint:0xffffff}],
    platforms:[{id:'start',planet:0,angle:-Math.PI/2,width:90},{id:'target',planet:0,angle:-Math.PI/2+radians(18),width:140}],
    initialFuel:110,contact:contact(1.8,1.15),landing:landing(20,12,9),obstacles:[],
    tutorial:{...tutorial('先学会短喷射',['右手按住推进起飞，升到约 60m 后松开；左手轻点右旋。','机头略向右时短按推进，向附近目标移动。松开推进仍会滑行。','靠近时轻点左旋、点火减速，再把支架朝向平台；触地后松开推进。'],'轻点右旋，再短按推进。目标就在右侧。','松开推进不会刹车。机头朝惯性反方向，短喷减速。','双脚朝向平台，慢慢落下。',60),approachRange:130,speedGuide:18},
    scoring:scoring(.3,100,12,15),unlockNext:'training-brake',verificationRoute:[{x:0,y:-10}]},
  {...base,id:'training-brake',order:2,title:'减速训练',description:'稍远一点的宽平台，练习提前制动与对准。',objectives:['用短喷射前往附近平台','在到达前抵消横移速度','对准平台法线后稳定着陆'],
    planets:[{x:0,y:700,radius:600,gravity:30,name:'曙光 · 训练基地',tint:0xffffff}],
    platforms:[{id:'start',planet:0,angle:-Math.PI/2,width:90},{id:'target',planet:0,angle:-Math.PI/2+radians(30),width:128}],
    initialFuel:120,contact:contact(1.8,1.15),landing:landing(20,10,8),obstacles:[],
    tutorial:{...tutorial('到达之前，先减速',['目标仍在同一侧，距离比上一关稍长。不要一直按住推进。','观察琥珀色惯性线；接近目标前，机头向速度反方向短喷制动。','下降、横移与姿态都进入绿色窗口，再松开按键让支架稳定。'],'轻点转向，用短喷射前进。','提前减小横移，再降低下降速度，给最后对准留出时间。','看着陆窗口，绿色代表进入安全范围。',80),speedGuide:24},
    scoring:scoring(.3,120,10,15),unlockNext:'first-landing',verificationRoute:[{x:0,y:-35}]},

  {...base,id:'first-landing',order:3,title:'远侧归航',description:'绕行 100°，在星球右下侧完成长途归航。',objectives:['从发射台主动起飞','到达宽阔的目标平台','松开推进器，保持稳定'],
    planets:[{x:0,y:700,radius:600,gravity:30,name:'曙光',tint:0xffffff}],
    platforms:[{id:'start',planet:0,angle:-Math.PI/2,width:90},{id:'target',planet:0,angle:radians(10),width:132}],
    initialFuel:170,contact:contact(1.8,1.15),landing:landing(20,12,9),obstacles:[],
    tutorial:tutorial('推力与朝向',['起飞后沿右侧绕行星球，不能直接穿过星球追目标箭头。','屏幕不会随重力旋转。抵达右下侧时，机头也要朝右下方远离地表。','双支架接触后松开推进，稳定 1.1 秒即可通关。'],'沿星球右侧绕行，保持离地高度；箭头仅指目标直线方向。','先抵消横移，再控制下降。宽平台允许多次修正。','支架朝向平台，轻柔触地。',100),
    scoring:scoring(.35,220,12,15),unlockNext:'inertia',verificationRoute:arc(0,700,800,-Math.PI/2,radians(10))},
  {...base,id:'inertia',order:4,title:'惯性控制',description:'绕行 130°，在南半球提前反向制动。',objectives:['跨越更长的地表弧线','提前反向推进减速','在宽平台内稳定着陆'],
    planets:[{x:0,y:700,radius:600,gravity:30,name:'曙光',tint:0xffffff}],
    platforms:[{id:'start',planet:0,angle:-Math.PI/2,width:90},{id:'target',planet:0,angle:radians(40),width:116}],
    initialFuel:190,contact:contact(1.8,1.15),landing:landing(20,10,8),obstacles:[],
    tutorial:tutorial('提前制动',['长距离飞行会积累速度，目标靠近不代表已经减速。','琥珀色线是惯性方向。机头朝相反方向，点火抵消它。'],'积累适当横向速度后松开推进。','不要冲过平台。反向短喷，降低横移速度。','看清下降与横移两个数值。'),
    scoring:scoring(.3,250,10,15),unlockNext:'low-gravity',verificationRoute:arc(0,700,800,-Math.PI/2,radians(40))},
  {...base,id:'low-gravity',order:5,title:'低重力飞行',description:'五分之一重力，绕行 150°，用短喷射控制漫长滑行。',objectives:['适应低重力环境','用更短的喷射修正速度','保持更准确的着陆姿态'],
    planets:[{x:0,y:620,radius:500,gravity:6,name:'灰月',tint:0xc2c7eb}],
    platforms:[{id:'start',planet:0,angle:-Math.PI/2,width:82},{id:'target',planet:0,angle:radians(60),width:94}],
    initialFuel:95,contact:contact(1.3,1.05),landing:landing(12,9,7),obstacles:[],
    tutorial:tutorial('低重力不等于低速度',['这里的表面重力只有 6，是曙光的五分之一，推进器仍与之前一样有力。','使用更短的喷射。失去重力的“刹车”，更要提前反向制动。'],'少量推力就够，留意不断增长的速度。','低重力不会替你减速。更早反向推进。','把机头对准平台法线。',100),
    scoring:scoring(.4,250,9,10),unlockNext:'binary-crossing',verificationRoute:arc(0,620,730,-Math.PI/2,radians(60))},
  {...base,id:'binary-crossing',order:6,title:'双星穿越',description:'跨越千米星际间隙，绕至远岸伴星的东南侧着陆。',objectives:['从第一颗星球起飞','跨越两颗星球的引力区','在第二颗星球着陆'],
    planets:[{x:0,y:700,radius:600,gravity:30,name:'曙光行星',tint:0xd9edeb},{x:1900,y:520,radius:240,gravity:10,name:'远岸伴星',tint:0xe7c8a9}],
    platforms:[{id:'start',planet:0,angle:-Math.PI/2,width:84},{id:'target',planet:1,angle:radians(40),width:96}],
    initialFuel:170,contact:contact(1.3,1.05),landing:landing(14,9,7),obstacles:[],
    tutorial:tutorial('两颗星球，同时牵引',['两颗星球的引力始终叠加，飞船不会瞬间切换“重力模式”。','跨越千米间隙后，先绕过伴星再接近东南平台；箭头不会替你避开星球。'],'爬升后向右飞离行星，从伴星上方绕至东南侧。','目标星会改变你的轨迹，持续观察惯性方向。','此处 HUD 已采用目标平台法线。',130),
    scoring:scoring(.3,330,9,12),unlockNext:'precision',verificationRoute:[...arc(0,700,850,-Math.PI/2,-Math.PI/4),{x:1200,y:-180},...arc(1900,520,490,-Math.PI/2,radians(40))]},
  {...base,id:'precision',order:7,title:'精准着陆',description:'绕行 165°，在几乎倒置的视角中对准窄平台。',objectives:['对准 58 m 宽的平台','让双支架分别安全接触','控制姿态与横移误差'],
    planets:[{x:0,y:700,radius:600,gravity:30,name:'曙光 · 极地',tint:0xc5d9f0}],
    platforms:[{id:'start',planet:0,angle:-Math.PI/2,width:82},{id:'target',planet:0,angle:radians(75),width:58}],
    initialFuel:175,contact:contact(1),landing:landing(8,7,4.5,1.4),obstacles:[],
    tutorial:tutorial('两条支架，两个接触点',['绕过 165° 后，机头朝向接近屏幕下方。58 m 窄台需要两脚都在台内。','倾斜和自转会让某一侧接触速度更高。靠近时轻点旋转，避免持续自转。'],'保留燃料，为最后的侧向修正留出余量。','减速到几乎没有横移，再调整到平台中心。','精准对齐，松开旋转与推进。',110),
    scoring:scoring(.3,280,7,6),unlockNext:'emergency',verificationRoute:arc(0,700,800,-Math.PI/2,radians(75))},
  {...base,id:'emergency',order:8,title:'紧急抢救',description:'飞至正对面的南极，避开检修桩；断腿后仍有生机。',objectives:['避开目标左缘的高检修桩','完整着陆同样可以完成任务','受损后可点火补救或低速迫降'],
    planets:[{x:0,y:700,radius:600,gravity:30,name:'曙光 · 检修站',tint:0xe6d2b2}],
    platforms:[{id:'start',planet:0,angle:-Math.PI/2,width:82},{id:'target',planet:0,angle:Math.PI/2,width:76}],
    initialFuel:195,contact:contact(1),landing:landing(8,7,4.5,1.4),
    obstacles:[{id:'service-pylon',kind:'pillar',platform:'target',along:-30,height:25,radius:10}],
    tutorial:tutorial('损伤不是终点',['目标位于正对面的南极，机头向下才是远离地面。检修桩位于平台局部左缘。','如果一条支架断裂，立即点火抬升，并反向旋转抑制倾倒。','单腿迫降需要真实主体接触、下降与横移均低于 4，并稳定 1.8 秒。'],'准备足够燃料，避开目标左缘。','对准中部；若撞断单腿，点火抬升后再尝试。','不必主动断腿，完整着陆同样通关。',110),
    scoring:scoring(.3,300,7,6),unlockNext:'heavy-world',verificationRoute:arc(0,700,800,-Math.PI/2,Math.PI/2)},
];


// Environment chapter: same GL-01 controls, independently configured worlds.
function environmentLevel(order:number,id:string,title:string,description:string,gravity:number,fuel:number):CampaignLevel {
  return {...base,id,order,title,description,chapter:'第二章 · 星际环境',
    objectives:['观察环境与障碍轨迹','保留制动燃料','安全抵达侧面着陆区'],
    planets:[{x:0,y:700,radius:420,gravity,name:title,appearance:'rock'}],
    platforms:[{id:'start',planet:0,angle:-Math.PI/2,width:90},{id:'target',planet:0,angle:radians(20),width:100}],
    initialFuel:fuel,contact:contact(1.3,1.05),landing:landing(14,9,7),obstacles:[],asteroids:[],
    tutorial:tutorial(title,[description,'小行星边缘有琥珀色警戒圈；虚线显示完整运动范围。先减速，再选择绕行或等待。','机身与小行星的相对撞击速度决定损伤。轻擦后仍可点火修正。'],description,'沿惯性反方向短喷制动，留意地表吸引。','支架朝向平台，先减横移。',130),
    scoring:scoring(.2,300,9,12),unlockNext:null,verificationRoute:arc(0,700,650,-Math.PI/2,radians(20))};
}
const heavy=environmentLevel(9,'heavy-world','高重力起降','表面重力 46：起飞更沉，下降更快，提前持续制动。',46,190);
heavy.planets[0].appearance='volcanic';heavy.unlockNext='static-field';
heavy.tutorial.paragraphs=['这里表面重力为 46，发动机推力仍是 72。起飞更慢，不能等到贴地才减速。','先竖直爬升到 130m，再沿右侧绕行。接近平台前预留一段完整制动距离。'];
const rocks=environmentLevel(10,'static-field','静态小行星穿越','固定岩群挡住低空捷径：先升高，从岩群外侧绕行。',18,115);
rocks.asteroids=[{id:'rock-a',name:'静态岩群 A',x:355,y:280,radius:38},{id:'rock-b',name:'静态岩群 B',x:525,y:620,radius:34}];rocks.unlockNext='moving-gate';
rocks.tutorial.paragraphs=['两块岩体的位置固定，不会突然出现。先观察全貌，升高后从它们的外侧绕行。','琥珀色圈标记岩体边缘；接近时会出现距离警告。机身擦碰会偏转，严重撞击会坠毁。'];
const moving=environmentLevel(11,'moving-gate','动态小行星避障','往返岩体按固定周期扫过低空通道：观察方向，绕外侧或等待空隙。',12,105);
moving.planets[0].appearance='ice';moving.asteroids=[{id:'gate-a',name:'巡游岩体',x:490,y:330,radius:30,motion:{kind:'shuttle',x:65,y:0,period:24,phase:0}}];
moving.verificationRoute=arc(0,700,750,-Math.PI/2,radians(20));
moving.unlockNext='binary-debris';
LEVELS.push(heavy,rocks,moving);
const binary:CampaignLevel={...structuredClone(LEVELS[5]),id:'binary-debris',order:12,title:'双星引力与障碍组合',chapter:heavy.chapter,
 description:'跨越双星引力区，在转移途中避开固定岩体，绕至伴星东南侧。',
 asteroids:[{id:'transfer-rock',name:'星际残岩',x:1280,y:30,radius:55},{id:'moon-guard',name:'伴星巡游岩',x:2280,y:330,radius:26,motion:{kind:'orbit',x:45,y:65,period:32,phase:0}}],unlockNext:'fuel-budget'};
binary.planets[1].appearance='ice';binary.tutorial={...binary.tutorial,topic:'引力转移中的避障',paragraphs:['两颗星球的引力同时作用；穿越间隙时仍需留意惯性方向。','从固定残岩上方通过，再观察伴星外侧的椭圆巡游轨迹。不要径直追目标箭头。'],transfer:'跨越间隙时从残岩上方通过，进入伴星引力区后再调整姿态。'};
const budget=environmentLevel(13,'fuel-budget','低燃料精准着陆','只有 32 单位燃料：利用低重力滑行，减少悬停，准确落在窄台。',8,32);
budget.planets[0].appearance='ice';budget.platforms[1].width=66;budget.landing=landing(9,7,5,1.3);budget.scoring=scoring(.18,220,7,8);budget.unlockNext='environment-finale';
budget.tutorial.paragraphs=['燃料只有 32，持续点火会耗尽储备。用短喷建立速度，随后滑行。','将余油留给最后制动；窄台需要提前消除横移，再慢慢下降。'];
const finale=environmentLevel(14,'environment-finale','复杂环境综合挑战','稀薄大气、高引力与两类岩体叠加：低空阻力明显，高空更适合转移。',35,190);
finale.planets[0].appearance='volcanic';finale.planets[0].atmosphere={height:170,drag:.085};
finale.asteroids=[{id:'ridge-rock',name:'高空残岩',x:340,y:310,radius:37},{id:'final-gate',name:'风暴巡游岩',x:535,y:640,radius:27,motion:{kind:'shuttle',x:45,y:60,period:30,phase:1}}];
finale.verificationRoute=arc(0,700,750,-Math.PI/2,radians(20));finale.platforms[1].width=80;finale.landing=landing(10,8,6,1.3);
finale.tutorial.paragraphs=['170m 以下的稀薄大气会逐渐削弱速度，但不能代替发动机制动。高空没有空气阻力。','爬升到岩群外侧，观察巡游岩体的虚线路径；最后下降时同时管理横移、姿态与燃料。'];
LEVELS.push(binary,budget,finale);

// v0.7: counter-clockwise transfer, then brake before the left-side moving gate.
const reverse=environmentLevel(15,'reverse-arc','逆向绕行','向左起航，绕过逆向岩脊；在巡游岩体外侧提前制动，落向左下窄台。',14,120);
reverse.chapter='第三章 · 进阶航行';reverse.planets[0].appearance='ice';
reverse.platforms[1].angle=radians(-200);reverse.platforms[1].width=76;
reverse.asteroids=[{id:'reverse-ridge',name:'逆向岩脊',x:-355,y:280,radius:38},
  {id:'reverse-gate',name:'逆向巡游岩',x:-525,y:620,radius:28,motion:{kind:'shuttle',x:0,y:40,period:26,phase:0}}];
reverse.objectives=['向左转移，辨认惯性方向','从岩脊和巡游范围外侧绕行','反向制动后对准左下窄台'];
reverse.tutorial=tutorial('反方向不等于反着按到底',[
  '这次目标在左下方。先向上爬升，轻点左旋，再短喷向左转移。',
  '高处岩脊挡住贴地捷径。巡游岩体沿竖直虚线往返，从外侧绕过它的运动范围。',
  '机头与惯性箭头可以朝不同方向。接近左下平台前，先朝惯性反方向短喷制动，再让支架朝向地面。'],
  '向左绕行，从岩体运动范围外侧通过。','不要追着目标一直点火；先抵消惯性，再转回平台法线。','左下平台宽 76m；先减横移，再回正支架。',130);
reverse.verificationRoute=arc(0,700,750,-Math.PI/2,radians(-200));
LEVELS.push(reverse);

const crossing=environmentLevel(16,'crossing-patrol','交错巡游','两组岩体交错巡游：逐段观察通行时机，也可从完整运动范围外侧绕行。',12,110);
crossing.chapter=reverse.chapter;crossing.planets[0].appearance='ice';
crossing.asteroids=[{id:'cross-upper',name:'横向巡游岩',x:425,y:270,radius:28,motion:{kind:'shuttle',x:75,y:0,period:24,phase:0}},
  {id:'cross-lower',name:'纵向巡游岩',x:540,y:500,radius:28,motion:{kind:'shuttle',x:0,y:80,period:24,phase:Math.PI/2}}];
crossing.verificationRoute=arc(0,700,800,-Math.PI/2,radians(20));
crossing.objectives=['分别观察横向与纵向巡游','逐段通过或选择外侧安全路线','保留下降前的制动空间'];
crossing.tutorial=tutorial('先看下一段，再决定推进',[
  '两块岩体周期相同，但转向时机不同。第一段安全不代表第二段也能直接通过。',
  '可以提前减速观察空隙，也可以升高后绕过两组虚线范围；不必贴着岩体抢时间。',
  '起点和终点不在巡游范围内。通过岩群后先减横移，再向平台下降。'],
  '逐段看清巡游方向；外侧绕行更稳妥。','离开第二组运动范围后，反向短喷制动。','目标区没有巡游岩体，安心对准双脚。',150);

const returnMoon:CampaignLevel={...structuredClone(binary),id:'moon-return',order:17,title:'双星回望',chapter:reverse.chapter,
  description:'从低重力伴星返航，进入主星更强的引力区，在迎面平台前减速。',unlockNext:null};
returnMoon.platforms=[{id:'start',planet:1,angle:-Math.PI/2,width:96},{id:'target',planet:0,angle:radians(-30),width:88}];
returnMoon.initialFuel=145;
returnMoon.asteroids=[{id:'return-rock',name:'返航残岩',x:1150,y:110,radius:50}];
returnMoon.verificationRoute=[{x:1900,y:0},{x:1350,y:-150},...arc(0,700,850,radians(-55),radians(-30))];
returnMoon.objectives=['从低重力伴星向左起飞','抵抗主星逐渐增强的引力','在主星迎面平台提前制动'];
returnMoon.tutorial=tutorial('返航时，引力越来越强',[
  '这次从右侧伴星出发，目标是左侧主星的右上平台。先爬升，再向左转移。',
  '从残岩上方通过。进入主星附近时，下落会越来越快，不能照搬离开主星时的喷射节奏。',
  '先在高处减速，再对准目标法线下降，不要一路追着目标箭头。'],
  '从残岩上方向左转移，观察惯性和主星吸引。','进入主星前提前制动，给下降留出余量。','机头朝右上方，支架朝向主星。',130);

const atmosphere=environmentLevel(18,'atmosphere-edge','大气边界','在大气外转移，再进入阻力层；空气会减速，也会改变下降节奏。',26,125);
atmosphere.chapter=reverse.chapter;atmosphere.planets[0].atmosphere={height:190,drag:.07};
atmosphere.planets[0].appearance='volcanic';atmosphere.platforms[1].angle=radians(45);atmosphere.platforms[1].width=82;
atmosphere.verificationRoute=arc(0,700,760,-Math.PI/2,radians(45));
atmosphere.objectives=['爬升离开大气阻力层','在真空段控制惯性','入层后重新判断下降速度'];
atmosphere.tutorial=tutorial('空气帮你减速，但不能替你着陆',[
  '190m 以下有大气阻力，高处转移更省去反复加速。起飞先建立高度。',
  '再次进入大气层后，滑行速度会逐渐降低；避免过早耗光横向速度后长时间悬停。',
  '空气不会托住飞船，最后下降仍需推进器制动。'],
  '高处转移，留意进入大气层时速度的变化。','结合阻力调整短喷，别把空气当作自动刹车。','先消除横移，再控制下降速度。',150);

const reserve=environmentLevel(19,'reserve-landing','余量着陆','低重力、有限燃料与侧面窄台：少悬停，把最后一段修正留给着陆。',8,40);
reserve.chapter=reverse.chapter;reserve.planets[0].appearance='ice';reserve.platforms[1].angle=radians(-200);reserve.platforms[1].width=60;
reserve.landing=landing(8,7,4.5,1.4);reserve.scoring=scoring(.2,240,7,6);
reserve.verificationRoute=arc(0,700,650,-Math.PI/2,radians(-200));
reserve.objectives=['用短喷向左转移','避免在低重力下反复悬停','用预留燃料修正窄台落点'];
reserve.tutorial=tutorial('省下的是最后一次修正',[
  '燃料只有 40，目标窄台在左下方。用短喷建立速度，再利用低重力滑行。',
  '不要为了盯住箭头反复悬停；过早减速同样会消耗下降阶段的燃料。',
  '平台只有 60m 宽。留出燃料，在最后下降前消除横移并对准中心。'],
  '向左滑行，减少无效加速与反向修正。','保留最后下降的燃料，提前消除横移。','窄台需要两脚都在范围内，先对准再下降。',110);

const advanced=environmentLevel(20,'advanced-finale','进阶终航','绕过巡游岩群，进入大气层，在南侧窄台完成综合着陆。',22,150);
advanced.chapter=reverse.chapter;advanced.planets[0].appearance='volcanic';advanced.planets[0].atmosphere={height:140,drag:.055};
advanced.platforms[1].angle=radians(80);advanced.platforms[1].width=70;advanced.landing=landing(9,7,5,1.4);
advanced.asteroids=[{id:'final-upper',name:'上层巡游岩',x:430,y:250,radius:30,motion:{kind:'shuttle',x:50,y:35,period:28,phase:0}},
  {id:'final-side',name:'侧翼巡游岩',x:565,y:650,radius:30,motion:{kind:'orbit',x:35,y:65,period:32,phase:1}}];
advanced.verificationRoute=arc(0,700,800,-Math.PI/2,radians(80));
advanced.objectives=['从两组岩体运动范围外侧通过','在大气边界重新评估惯性','机头朝下对准南侧窄台'];
advanced.tutorial=tutorial('把整段航线拆成三步',[
  '先建立高度，从右侧绕过巡游岩群；不要在避障时就急着对准终点。',
  '离开岩群后制动，再进入 140m 高的大气层。阻力会改变速度，但落地仍需控制。',
  '终点接近南极，机头向下才是远离地面。以平台法线和横移读数为准。'],
  '先绕过巡游范围，再准备下一段。','进入大气层前消除多余速度，留足姿态调整时间。','机头朝下，双脚朝向南侧平台。',150);
LEVELS.push(crossing,returnMoon,atmosphere,reserve,advanced);

const corridor=environmentLevel(21,'outer-corridor','外环切入','先绕到岩体外侧，再沿两块岩体之间的横向通道进入东侧平台。',18,120);
corridor.chapter='第四章 · 危险航道';corridor.planets[0].appearance='ice';
corridor.platforms[1].angle=0;corridor.platforms[1].width=76;
corridor.landing=landing(10,8,5,1.4);corridor.scoring=scoring(.25,220,7,8);
corridor.asteroids=[{id:'corridor-north',name:'北侧岩壁',x:740,y:580,radius:42},{id:'corridor-south',name:'南侧岩壁',x:740,y:820,radius:42}];
corridor.verificationRoute=arc(0,700,920,-Math.PI/2,0);
corridor.objectives=['从岩壁外侧绕到平台正前方','消除横移后进入两岩之间','沿平台法线慢速下降'];
corridor.tutorial=tutorial('先对准通道，再向内下降',[
  '平台在星球右侧，两块静止岩体夹住进场路线。追着目标箭头斜切，会撞上北侧岩壁。',
  '先升高并从岩体外侧绕行，来到目标平台的正前方；在进入岩壁之间以前消除上下方向的横移。',
  '机头朝右、双脚朝左。沿平台法线缓慢靠近，观察横移读数，不要在通道内大幅转向。'],
  '绕到两块岩体外侧，不从上方斜切平台。','先抵消横移，对准两岩之间的通道。','机头朝右，双脚朝左，低速向内靠近。',180);
LEVELS.push(corridor);

const patrolApproach:CampaignLevel={...structuredClone(corridor),id:'patrol-approach',order:22,title:'巡游后进场',
  description:'绕开外侧巡游岩的完整运动范围，再沿中央通道进入东侧平台。',initialFuel:140};
patrolApproach.platforms[0].angle=radians(-120);
patrolApproach.asteroids=[
  {id:'approach-patrol',name:'外侧巡游岩',x:760,y:500,radius:36,motion:{kind:'orbit',x:85,y:60,period:30,phase:0}},
  {id:'approach-south',name:'南侧岩壁',x:740,y:840,radius:40}];
patrolApproach.verificationRoute=arc(0,700,1040,radians(-120),0);
patrolApproach.objectives=['观察巡游岩的完整轨迹范围','从运动范围外侧绕到东侧','离开巡游区后对准中央进场通道'];
patrolApproach.tutorial=tutorial('先离开巡游区，再处理着陆',[
  '北侧岩体沿固定椭圆巡游，虚线表示完整范围。不要只看它现在的位置就斜切目标。',
  '从巡游范围的外侧绕行，到达东侧后再制动。这条路线不要求等待岩体恰好让路。',
  '巡游岩不会进入平台正前方的中央通道。离开运动区后消除横移，机头朝右、双脚朝左，慢慢靠近。'],
  '绕过整圈虚线范围，给转向留足空间。','先离开巡游区，再对准中央进场通道。','机头朝右，保持中央进场方向，低速向内靠近。',200);
LEVELS.push(patrolApproach);

const binaryReef:CampaignLevel={...structuredClone(binary),id:'binary-reef',order:23,title:'双星绕礁',chapter:corridor.chapter,
  description:'从转移岩群上方跨越双星，在伴星迎面平台前完成制动，避开上缘巡游岩。',unlockNext:null,initialFuel:170};
binaryReef.platforms[1].angle=radians(-150);binaryReef.platforms[1].width=80;
binaryReef.asteroids=[
  {id:'transfer-patrol',name:'间隙巡游礁',x:1250,y:180,radius:48,motion:{kind:'shuttle',x:0,y:85,period:34,phase:0}},
  {id:'upper-reef',name:'伴星上缘礁',x:1800,y:180,radius:28,motion:{kind:'orbit',x:40,y:35,period:26,phase:1}}];
binaryReef.verificationRoute=[...arc(0,700,900,-Math.PI/2,-Math.PI/4),{x:1200,y:-230},...arc(1900,520,560,-Math.PI/2,radians(-150))];
binaryReef.objectives=['从间隙巡游礁上方跨越双星','绕开伴星上缘礁的完整轨迹','提前制动并落向迎面平台'];
binaryReef.tutorial=tutorial('目标在迎面，制动要更早',[
  '两颗星球始终同时牵引。先建立高度，从间隙岩体完整巡游范围的上方通过。',
  '目标位于伴星左上侧，不能直接带着转移速度冲向平台。先从上方绕开第二组巡游轨迹，再向左上平台靠近。',
  '抵消横移后，让机头朝左上、双脚朝右下。离开岩群后再专注着陆，别把避障和落地挤在一起。'],
  '高处通过双星间隙，观察两组巡游范围。','抵达伴星之前减速，再绕向迎面平台。','机头朝左上，双脚朝向平台，控制法向下降。',180);
LEVELS.push(binaryReef);

const atmosphereReef=environmentLevel(24,'atmosphere-reef','大气绕礁','从大气外向左绕行，在岩礁通道前减速；入层后重新调整推力，落向西侧平台。',26,150);
atmosphereReef.chapter=corridor.chapter;atmosphereReef.planets[0].appearance='volcanic';
atmosphereReef.planets[0].atmosphere={height:330,drag:.085};
atmosphereReef.platforms[1].angle=-Math.PI;atmosphereReef.platforms[1].width=76;
atmosphereReef.landing=landing(10,8,5,1.4);atmosphereReef.scoring=scoring(.25,240,7,8);
atmosphereReef.asteroids=[
 {id:'air-upper-reef',name:'气层上缘巡游礁',x:-700,y:510,radius:36,motion:{kind:'shuttle',x:0,y:40,period:28,phase:0}},
 {id:'air-lower-reef',name:'气层下缘岩礁',x:-690,y:860,radius:40}];
atmosphereReef.verificationRoute=arc(0,700,950,-Math.PI/2,-Math.PI);
atmosphereReef.objectives=['离开330m大气层后向左绕礁','先对准西侧通道，再进入阻力层','根据实际下降速度调整短喷，双脚朝右着陆'];
atmosphereReef.tutorial=tutorial('进入气层后，重新判断制动',[
 '先爬升到330m阻力层之外，向左绕到两块岩礁外侧。上方岩礁沿竖直虚线巡游，不要贴着当前岩体位置抄近路。',
 '来到西侧平台正前方后先消除横移，再沿两礁中央向内靠近。进入大气层时速度会减小，照搬真空中的制动时长可能停得太早。',
 '机头朝左、双脚朝右。空气不能托住飞船，最后仍需根据下降读数短喷，别在通道里长时间悬停。'],
 '先出气层，再向左绕过完整巡游范围。','进入通道前抵消横移，入层后重新观察下降速度。','机头朝左，双脚朝右，控制向内的法向下降。',360);
LEVELS.push(atmosphereReef);

const narrowHarbor=environmentLevel(25,'narrow-harbor','窄口归港','从岩礁外侧绕向右下方，在斜向通道外完成制动，再对准窄台归港。',22,130);
narrowHarbor.chapter=corridor.chapter;narrowHarbor.planets[0].appearance='ice';
narrowHarbor.platforms[1].angle=radians(35);narrowHarbor.platforms[1].width=52;
narrowHarbor.landing=landing(8,7,4,1.4);narrowHarbor.scoring=scoring(.25,240,7,7);
// Offset rocks along the approach tangent: the central corridor stays clear at every phase.
const harborNormal={x:Math.cos(radians(35)),y:Math.sin(radians(35))};
const harborTangent={x:-harborNormal.y,y:harborNormal.x};
narrowHarbor.asteroids=[-1,1].map((side,i)=>({id:'harbor-reef-'+i,name:i?'港口下缘礁':'港口上缘巡游礁',
 x:harborNormal.x*710+harborTangent.x*side*125,y:700+harborNormal.y*710+harborTangent.y*side*125,radius:38,
 ...(i===0?{motion:{kind:'shuttle' as const,x:harborTangent.x*25,y:harborTangent.y*25,period:30,phase:0}}:{})}));
narrowHarbor.verificationRoute=arc(0,700,1000,-Math.PI/2,radians(35));
narrowHarbor.objectives=['从两礁完整运动范围外侧绕行','在斜向通道外抵消横移','对准52m窄台，让双脚同时落在范围内'];
narrowHarbor.tutorial=tutorial('把转向留在通道外',[
 '港口在右下方，两块岩礁夹着斜向进场通道。先从完整巡游范围外侧绕行，不要追着目标箭头切过岩体。',
 '到平台正前方后先减速、抵消横移，再向内下降。通道是斜的，以平台法线和横移读数判断方向，不要按屏幕上下对齐。',
 '机头朝右下，双脚朝左上。平台只有52m宽，先对准中心，低速短喷修正，让双脚都落在平台内。'],
 '从岩礁外侧绕向右下，不切过巡游范围。','在通道外抵消横移，再沿斜向法线进场。','机头朝右下、双脚朝左上，对准窄台中心。',210);
LEVELS.push(narrowHarbor);

const finalChapter='第五章 · 极限盲航';
const twinAtmosphere:CampaignLevel={...structuredClone(binary),id:'twin-atmosphere',order:26,title:'双星入层',chapter:finalChapter,
 description:'穿过双星间隙，绕至伴星背面；进入大气层后重新判断惯性与制动。',unlockNext:null,initialFuel:165};
twinAtmosphere.planets[1].gravity=14;twinAtmosphere.planets[1].atmosphere={height:160,drag:.065};
twinAtmosphere.platforms[1].width=70;twinAtmosphere.landing=landing(10,8,5,1.4);twinAtmosphere.scoring=scoring(.25,300,7,8);
twinAtmosphere.verificationRoute=[...arc(0,700,900,-Math.PI/2,-Math.PI/4),{x:1200,y:-230},...arc(1900,520,570,-Math.PI/2,radians(40))];
twinAtmosphere.objectives=['从残岩上方跨越双星','绕过伴星外侧巡游区','入层后重新调整制动，落向东南平台'];
twinAtmosphere.tutorial=tutorial('转移结束，不代表制动结束',[
 '主星与伴星始终同时牵引。先从间隙残岩上方通过，再绕到伴星右下侧，不追着箭头切过星球。',
 '伴星外侧有巡游岩，先从完整虚线范围外侧绕行；进入160m大气层后，滑行速度会比真空中更快衰减。',
 '机头朝右下、双脚朝左上。入层后观察真实下降与横移，短喷修正，空气不能代替最后着陆。'],
 '先跨越间隙，再从伴星巡游范围外侧绕行。','入层时重新观察速度，避免照搬真空制动时长。','对准东南平台，留意双星造成的侧向牵引。',180);

const silentReserve=environmentLevel(27,'silent-reserve','静默余量','有限燃料下向左绕礁，用滑行完成转移，把推力留给窄台进场。',9,55);
silentReserve.chapter=finalChapter;silentReserve.planets[0].appearance='ice';
silentReserve.platforms[1].angle=radians(-200);silentReserve.platforms[1].width=52;
silentReserve.landing=landing(8,7,4,1.4);silentReserve.scoring=scoring(.2,240,7,7);
silentReserve.asteroids=[{id:'reserve-ridge',name:'逆行残礁',x:-360,y:300,radius:35},
 {id:'reserve-patrol',name:'余量巡游礁',x:-540,y:580,radius:28,motion:{kind:'shuttle',x:0,y:35,period:28,phase:0}}];
silentReserve.verificationRoute=arc(0,700,790,-Math.PI/2,radians(-200));
silentReserve.objectives=['用短喷建立左向速度','从巡游完整范围外侧滑行','保留燃料对准52m窄台'];
silentReserve.tutorial=tutorial('把燃料留给最后一次修正',[
 '燃料55，重力9。先向左建立速度，再松开推进滑行；持续悬停会消耗着陆余量。',
 '两块岩礁挡住贴地捷径，从完整巡游范围外侧通过。低重力不会消除横移，接近目标前仍要反向短喷。',
 '目标在左下侧，机头朝左下、双脚朝右上。52m窄台要先对准中心，不必追求一口气直达。'],
 '短喷向左，从岩礁外侧滑行。','少做来回修正，留油给最后制动。','先对准中心，再低速落向左下窄台。',180);

const polarStorm=environmentLevel(28,'polar-storm','极地制动','离开强引力大气层，绕过南向双礁，再以倒置朝向落向极地平台。',34,160);
polarStorm.chapter=finalChapter;polarStorm.planets[0].appearance='volcanic';polarStorm.planets[0].atmosphere={height:230,drag:.075};
polarStorm.platforms[1].angle=Math.PI/2;polarStorm.platforms[1].width=62;
polarStorm.landing=landing(9,7,4.5,1.4);polarStorm.scoring=scoring(.25,270,7,7);
polarStorm.asteroids=[{id:'polar-east',name:'东侧巡游礁',x:560,y:650,radius:34,motion:{kind:'shuttle',x:35,y:0,period:28,phase:0}},
 {id:'polar-south',name:'南侧残礁',x:260,y:1300,radius:40}];
polarStorm.verificationRoute=arc(0,700,930,-Math.PI/2,Math.PI/2);
polarStorm.objectives=['爬升离开230m大气层','在岩礁外侧绕向南极','提前制动，机头朝下完成着陆'];
polarStorm.tutorial=tutorial('倒置朝向，仍按法线制动',[
 '重力34，低空还有230m阻力层。先建立高度，从右侧岩礁的完整范围外绕向南极。',
 '接近南极前先消除横移，再进入大气层。强引力会持续加快向内下降，不要等到平台很近才制动。',
 '南极的机头朝下、双脚朝上。用法向下降和横移读数控制短喷，不把屏幕朝下当成坠落方向。'],
 '先升高，再从右侧外环绕向南极。','进气层前减横移，强引力下提前制动。','机头朝下、双脚朝上，低速落向极地。',260);

const homewardNeedle:CampaignLevel={...structuredClone(returnMoon),id:'homeward-needle',order:29,title:'返航针尖',chapter:finalChapter,
 description:'从低重力伴星返回主星，在逐渐增强的牵引下避开进场残礁，对准窄台中央。',unlockNext:null,initialFuel:125};
homewardNeedle.platforms[1].width=52;homewardNeedle.landing=landing(8,7,4,1.4);homewardNeedle.scoring=scoring(.25,270,7,7);
homewardNeedle.asteroids=[{id:'home-transfer',name:'返航巡游礁',x:1150,y:110,radius:45,motion:{kind:'shuttle',x:0,y:55,period:32,phase:0}},
 {id:'home-lower',name:'港外残礁',x:750,y:500,radius:32}];
homewardNeedle.obstacles=[{id:'home-pylon',kind:'pillar',platform:'target',along:-25,height:18,radius:6}];
homewardNeedle.objectives=['从伴星向左跨过巡游区','进入主星引力区前制动','避开平台边缘检修桩，双脚对准中心'];
homewardNeedle.tutorial=tutorial('在强引力到来前减速',[
 '从右侧伴星向左返航，从间隙巡游岩的完整范围上方通过。主星越来越强的牵引会改变原来的滑行速度。',
 '先在高处减速，再从港外残礁上方进入右上平台；不要沿目标箭头直接切入。',
 '平台52m宽，局部左缘有检修桩。机头朝右上、双脚朝左下，对准中心低速着陆；无需主动损伤支架。'],
 '从完整巡游范围上方向左返航。','进入主星前制动，从港外残礁上方进场。','避开平台左缘检修桩，对准中线。',130);

const finalHome:CampaignLevel={...structuredClone(twinAtmosphere),id:'last-horizon',order:30,title:'最后的地平线',chapter:finalChapter,
 description:'离开主星大气，跨越双星岩群，在伴星南极的窄台完成最后一次归航。',unlockNext:null,initialFuel:180};
finalHome.planets[0].atmosphere={height:150,drag:.055};finalHome.planets[1].gravity=10;finalHome.planets[1].atmosphere={height:180,drag:.075};
finalHome.platforms[1].angle=Math.PI/2;finalHome.platforms[1].width=56;
finalHome.landing=landing(8,7,4,1.4);finalHome.scoring=scoring(.25,330,7,7);
finalHome.asteroids=[{id:'horizon-transfer',name:'间隙巡游礁',x:1250,y:120,radius:45,motion:{kind:'shuttle',x:0,y:65,period:34,phase:0}},
 {id:'horizon-east',name:'伴星外缘礁',x:2280,y:440,radius:30,motion:{kind:'orbit',x:30,y:45,period:30,phase:1}}];
finalHome.verificationRoute=[...arc(0,700,930,-Math.PI/2,-Math.PI/4),{x:1250,y:-250},...arc(1900,520,620,-Math.PI/2,Math.PI/2)];
finalHome.objectives=['离开主星大气后跨越双星间隙','从伴星巡游范围外侧绕向南极','入层后保留制动余量，双脚落入56m终点'];
finalHome.tutorial=tutorial('把最后一程拆成三个决定',[
 '先爬出主星150m大气层，从间隙巡游礁上方跨越双星。离开大气后惯性更持久，别持续加速。',
 '从伴星外侧完整巡游范围绕向南极，先减横移，再进入180m大气层。避障、制动、着陆分段完成。',
 '最后的平台56m宽。机头朝下、双脚朝上，留下燃料做最后微调；完整着陆即可完成全部航线。'],
 '先出大气，再从巡游礁上方转移。','绕到伴星南极后减速，再进入气层。','机头朝下、双脚朝上，平稳完成最后归航。',180);
// Retained verbatim for historical input archives and score provenance.
export const RETIRED_FINALE=finalHome;
const primaryMu=18*320**2,holeMu=primaryMu*20,orbit=rotatingSystem(primaryMu,holeMu,5000);
const observatory:CampaignLevel={...environmentLevel(30,'l1-observatory','静界 · L1研究站','从左侧行星启航，在行星与微型黑洞之间的L1研究站完成最后一次着陆。',18,220),chapter:finalChapter,
 planets:[{x:0,y:700,radius:320,gravity:18,name:'远航行星',appearance:'ice'},
 {x:5000,y:700,radius:85,gravity:holeMu/85**2,name:'静界 · 微型黑洞',blackHole:true}],
 platforms:[{id:'start',planet:0,angle:-Math.PI/4,width:90},{id:'target',planet:0,angle:-Math.PI/2,width:100,station:{x:orbit.l1,y:700}}],
 rotatingFrame:{x:orbit.barycenter,y:700,omega:orbit.omega},missionClearance:6000,
 asteroids:[],verificationRoute:[{x:420,y:180},{x:orbit.l1,y:330}],
 landing:landing(10,5,4,1.6),scoring:scoring(.2,300,5,8),
 objectives:['从左侧行星起飞，向右转移','提前制动，从上方接近L1研究站','双支架低速着陆；也可先去黑洞外围观察再返回'],
 tutorial:tutorial('在两种引力之间，留下一盏灯',[
 '左侧是发射行星，中间偏左是L1研究站，右侧远处是微型黑洞。研究站在两天体共同旋转的参考系中维持位置，L1不是稳定的零引力避风港。',
 '向右转移，在研究站上方提前减速。机头朝上、双脚朝下；甲板上方60m内有弱磁性捕获场，仍需自己对准。轻触平台后松开推进，等待双支架确认着陆。',
 '可以先飞向右侧观察吸积盘；接近时镜头会拉远。越往内引力差越强，红色潮汐危险区不可进入。观察后返回研究站即可完成终航。'],
 '向右驶向研究站，留意惯性方向。','在研究站上方抵消横移，缓慢下降。','机头朝上，双脚轻触研究站平台。',170)};
LEVELS.push(twinAtmosphere,silentReserve,polarStorm,homewardNeedle,observatory);

export function validateLevels(levels:CampaignLevel[]):string[] {
  const errors:string[]=[];const ids=new Set<string>();
  for(const l of levels){
    const fail=(message:string)=>errors.push(l.id+': '+message);
    if(!l.id||ids.has(l.id))fail('关卡 ID 重复或为空');ids.add(l.id);
    if(l.order<1||!Number.isInteger(l.order)||!l.title||!l.chapter)fail('章节或顺序不合法');
    if(!l.planets.length)fail('必须存在星球');
    l.planets.forEach((p,i)=>{
      if(![p.x,p.y,p.radius,p.gravity].every(Number.isFinite)||p.radius<80||p.gravity<=0)fail('星球参数无效');
      for(const q of l.planets.slice(i+1))if(Math.hypot(p.x-q.x,p.y-q.y)<p.radius+q.radius+24)fail('星球重叠或间隙不足');
    });
    const asteroidIds=new Set<string>();
    for(const a of l.asteroids??[]){
      if(!a.id||asteroidIds.has(a.id)||![a.x,a.y,a.radius].every(Number.isFinite)||a.radius<4)fail('小行星参数无效');asteroidIds.add(a.id);
      const m=a.motion;
      if(m&&(!['shuttle','orbit'].includes(m.kind)||![m.x,m.y,m.period,m.phase].every(Number.isFinite)||m.period<4))fail('小行星轨迹无效');
      for(const pad of l.platforms){if(!l.planets[pad.planet])continue;const f=frame(l,pad);
        // Conservative motion envelope must leave launch and touchdown zones clear.
        if(Math.hypot(a.x-f.c.x,a.y-f.c.y)<a.radius+Math.hypot(m?.x??0,m?.y??0)+80)fail('小行星轨迹侵入平台安全区');}
    }
    for(const p of l.planets)if(p.atmosphere&&(!Number.isFinite(p.atmosphere.height)||!Number.isFinite(p.atmosphere.drag)||p.atmosphere.height<=0||p.atmosphere.drag<0))fail('大气参数无效');
    const padIds=new Set<string>();
    for(const pad of l.platforms){
      if(padIds.has(pad.id))fail('平台 ID 重复');padIds.add(pad.id);
      if(!l.planets[pad.planet]||!Number.isFinite(pad.angle)||!Number.isFinite(pad.width)||pad.width<CONFIG.legX*2+8){fail('平台参数无效');continue;}
      const f=frame(l,pad);
      if(pad.station&&(![pad.station.x,pad.station.y].every(Number.isFinite)||!l.rotatingFrame||l.planets.some(p=>Math.hypot(f.c.x-p.x,f.c.y-p.y)<p.radius+100)))fail('研究站位置或参考系无效');
      l.planets.forEach((p,i)=>{if(i!==pad.planet&&Math.hypot(f.c.x-p.x,f.c.y-p.y)<p.radius+35)fail('平台被另一星球遮挡');});
    }
    if(!padIds.has(l.start)||!padIds.has(l.target)||l.start===l.target)fail('起终点无效');
    for(let i=0;i<l.platforms.length;i++)for(let j=i+1;j<l.platforms.length;j++){
      const a=l.platforms[i],b=l.platforms[j];if(!l.planets[a.planet]||!l.planets[b.planet])continue;
      if(Math.hypot(frame(l,a).c.x-frame(l,b).c.x,frame(l,a).c.y-frame(l,b).c.y)<(a.width+b.width)/2+12)fail('平台间距不足');
    }
    if(l.ship.model!=='GL-01'||l.ship.initialState!=='docked')fail('初始飞船必须双支架停泊');
    if(!Number.isFinite(l.initialFuel)||l.initialFuel<=0)fail('燃料无效');
    if(!Object.values(l.contact).every(v=>Number.isFinite(v)&&v>0)||l.contact.bodyFatalImpact>=CONFIG.legSafeImpact*l.contact.strength)fail('损伤参数不合法');
    const limits=l.landing;
    if(![limits.vertical,limits.horizontal,limits.angle,limits.angularSpeed,limits.hold,limits.emergencySpeed,limits.emergencyAngle,limits.emergencyAngularSpeed,limits.emergencyHold].every(v=>Number.isFinite(v)&&v>0)||limits.angle>Math.PI/3)fail('着陆条件不合法');
    if(l.unlockNext&&!levels.some(n=>n.id===l.unlockNext&&n.order===l.order+1))fail('解锁目标不合法');
    for(const o of l.obstacles){
      if(!l.platforms.some(p=>p.id===o.platform&&l.planets[p.planet])||![o.along,o.height,o.radius].every(Number.isFinite)||o.radius<=0||o.height<0){fail('障碍物无效');continue;}
      if(Math.abs(o.along)-o.radius<CONFIG.legX+4)fail('障碍物占据整条安全着陆中线');
      if(o.platform===l.start)fail('发射平台不能放置障碍物');
      const f=obstacleFrame(l,o);if(!Number.isFinite(f.top.x))fail('障碍物锚点无效');
    }
    if(!l.verificationRoute.length||l.verificationRoute.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))fail('验证航路无效');
    for(const threshold of [l.scoring.two,l.scoring.three]){
      if(!Object.entries(threshold).filter(([k])=>k!=='requireBothLegs').every(([,v])=>typeof v==='number'&&Number.isFinite(v)&&v>=0)||threshold.minFuelRatio>1||threshold.minLegHealth>100||threshold.minBodyIntegrity>100)fail('评分阈值无效');
    }
  }
  if(new Set(levels.map(l=>l.order)).size!==levels.length)errors.push('关卡顺序重复');
  return errors;
}
const errors=validateLevels(LEVELS);
if(errors.length)throw new Error(errors.join('\n'));
export const levelById=(id:string)=>LEVELS.find(level=>level.id===id);
