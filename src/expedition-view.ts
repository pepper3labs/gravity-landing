import {GameEconomy,type BoardKind} from './economy';
import {EXPEDITION_CAPACITY,EXPEDITION_CONFIG,maintenancePrice,type Maintenance} from './economy-config';
import {LEVELS} from './levels';
import type {RewardedAd} from './services';
import {RewardedAction} from './rewarded-action';
const duration=(ticks:number)=>{const seconds=ticks/120;return Math.floor(seconds/3600)+'时 '+Math.floor(seconds/60)%60+'分 '+(seconds%60).toFixed(2)+'秒';};
export function expeditionPanel(root:HTMLElement,store:GameEconomy,options:{launch:()=>void;back:()=>void;beforeStart?:(proceed:()=>void)=>void;settled?:(parent:HTMLElement)=>void;busyChanged?:(busy:boolean)=>void;ad:RewardedAd;adAvailable:boolean;adLabel:string;ranking?:(kind:BoardKind)=>void;changed:()=>void}){
 const action=new RewardedAction();let busy=false;let page:'home'|'refit'|'confirm-refit'|'details'|'settle'='home';
 let pending:{kind:Maintenance;token:string;label:string}|undefined;
 const navigate=(next:typeof page)=>{page=next;root.scrollTop=0;render();};
 const button=(parent:HTMLElement,text:string,fn:()=>unknown,disabled=false)=>{const b=document.createElement('button');b.className='secondary-button';b.textContent=text;b.disabled=disabled;b.onclick=()=>{try{fn();}catch(e){message(e);}};parent.append(b);return b;};
 const message=(e:unknown)=>{const p=root.querySelector('[role=status]');if(p)p.textContent=e instanceof Error?e.message:String(e);};
 const mutate=(fn:()=>unknown)=>{fn();options.changed();render();};
 const requestRefit=(kind:Maintenance,token:string,label:string,card:HTMLElement)=>{
  if(store.data.expedition?.pure){pending={kind,token,label};navigate('confirm-refit');}
  else void refit(kind,token,card);
 };
 async function refit(kind:Maintenance,token:string,card:HTMLElement){
  if(busy||!card.isConnected)return;
  try{
   const e=store.data.expedition;
   if(!e||e.phase!=='station'||token!==e.id+':'+e.completed+':'+e.attempt)throw Error('整备站已失效，请返回远征。');
   if(kind!=='ad'){store.maintain(kind,token);pending=undefined;options.changed();navigate('refit');return;}
   busy=true;options.busyChanged?.(true);card.querySelectorAll('button').forEach(b=>b.disabled=true);
   const outcome=await action.run(options.ad,'expedition-refit',()=>{if(!card.isConnected)throw Error('整备页面已离开');store.maintain('ad',token);});
   busy=false;options.busyChanged?.(false);if(!card.isConnected)return;
   pending=undefined;options.changed();navigate('refit');message(outcome==='completed'?'整备完成，纯净资格已取消。':'广告未完成或保存失败，未确认整备；可免费继续出航。');
  }catch(error){busy=false;options.busyChanged?.(false);if(card.isConnected){render();message(error);}}
 }
 function render(){
  root.replaceChildren();const card=document.createElement('div');card.className='result-card briefing-card expedition-card';root.append(card);
  const e=store.data.expedition;
  const h=document.createElement('h2');h.textContent=({home:'连续远征 · 30条航线',refit:'资源整备','confirm-refit':'确认使用整备',details:'远征记录与规则',settle:'结束本次远征'})[page];card.append(h);
  if(page==='home'&&!e?.ended){const rule=document.createElement('p');rule.className='expedition-rule';rule.textContent='死亡即结算，不能重试。仅未发射时可保存退出。';card.append(rule);}
  if(page==='home'&&e?.ended){card.className+=' compact-expedition';h.textContent='远征结算';}
  const info=document.createElement('p');info.textContent='独立顺序挑战，不解锁主线、不领取金币。燃料与双腿状态跨关继承；死亡立即结算，不能重试；仅未发射时可保存退出，飞行中退出将结束本次远征。累计有效飞行超过约115.7小时后仅保留本机记录。';if(page==='details')card.append(info);
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent=store.warning;card.append(status);
  if(e){
   const p=document.createElement('p');p.textContent=(e.ended?'已结算':'进行中')+' · 已完成 '+e.completed+'/30 · '+duration(e.ticks)+(page==='details'?' · 累计耗油 '+e.fuelUsed.toFixed(1)+' · 损伤 '+e.damage.toFixed(1):'');card.append(p);
   const q=document.createElement('p');q.textContent=!e.eligible?'不可上榜：'+e.reason:e.pure?'纯净资格保留；完成30关后可参加两榜。':'已使用整备，仅可参加综合榜。';card.append(q);
   const service=document.createElement('p');service.textContent='加油 '+e.services.fuel+' / 维修 '+e.services.repair+' / 全面整备 '+e.services.full+' / 广告整备 '+e.services.ad;if(page==='details')card.append(service);
   if(!e.ended){
    const l=LEVELS[e.completed],resources=e.resources;
    const title=document.createElement('h3');title.textContent='下一段 '+l.order+' · '+l.title;card.append(title);
    const r=document.createElement('p');r.textContent='燃料 '+resources.fuel.toFixed(1)+' / '+EXPEDITION_CAPACITY+' · '+resources.legs.map((l,i)=>(i?'右':'左')+'支架 '+(l.broken?'已断裂':l.health.toFixed(0)+'%')).join(' · ');card.append(r);
    const supply=document.createElement('p');supply.textContent=e.completed?'本站固定补给已计入：燃料 +'+EXPEDITION_CONFIG[e.completed].fuel+'（不超过容量），未断支架各 +12。':'首次出航，完整飞船。';if(page==='refit'||page==='details')card.append(supply);
    const risk=document.createElement('p');risk.textContent=resources.fuel<l.initialFuel*.5||resources.legs.some(l=>l.broken)?'资源偏低，建议整备。也可免费结束远征并重新开始；广告不是必选。':'停靠时机不会计入飞行时间。';if(page==='home'||page==='refit')card.append(risk);
    if(page==='home'){
     const launch=button(card,'继续出航',options.launch,busy);launch.className='primary-button';
     button(card,'资源整备 ›',()=>navigate('refit'),busy);
    }
    if(page==='refit'){
    const token=e.id+':'+e.completed+':'+e.attempt;
    const note=document.createElement('p');note.textContent='钱包：'+store.data.coins+' 金币。任何金币或广告整备都会失去本次纯净榜资格。';card.append(note);
    for(const kind of ['fuel','repair','full'] as const){const cost=maintenancePrice(kind,resources.fuel,resources.legs),label=({fuel:'加满燃料',repair:'修复双腿（含断腿重建）',full:'全面整备'}[kind])+' · '+cost+' 金币';button(card,label,()=>requestRefit(kind,token,label,card),busy||cost===0||cost>store.data.coins);}
    const label=options.adLabel+' · 全面整备';
    button(card,label,()=>requestRefit('ad',token,label,card),busy||!options.adAvailable||(resources.fuel===EXPEDITION_CAPACITY&&resources.legs.every(l=>l.health===100&&!l.broken)));
    }
    if(page==='confirm-refit'&&pending){
     const choice=pending;
     const note=document.createElement('p');note.textContent=choice.label+'。整备成功后，本次远征将失去纯净榜资格；满足其余上榜条件时仍可参加综合榜。历史纯净最佳不会受影响。';card.append(note);
     const confirm=button(card,choice.kind==='ad'?'确认并观看广告':'确认使用金币整备',()=>void refit(choice.kind,choice.token,card),busy);confirm.className='primary-button';
     button(card,'保留纯净资格，返回整备',()=>{pending=undefined;navigate('refit');},busy);
    }
    if(page==='details')button(card,'结束并结算本次远征 ›',()=>navigate('settle'),busy);
    if(page==='settle'){
     const confirm=document.createElement('p');confirm.textContent='结算后不能继续这次远征。历史最佳保留，可免费重新开始。';card.append(confirm);
     button(card,'确认结束并结算',()=>{store.end();options.changed();navigate('home');},busy);
     button(card,'暂不结束，返回远征',()=>navigate('home'),busy);
    }
   }
  }
  if(page==='home'){
   if(!e||e.ended){const start=button(card,'满状态开始新远征',()=>{const begin=()=>mutate(()=>store.newExpedition());options.beforeStart?options.beforeStart(begin):begin();},busy);start.className='primary-button';}
   if(e?.ended&&options.ranking)button(card,'查看排名',()=>options.ranking!(e.pure&&e.completed===30?'pure':'overall'),busy);
   button(card,'记录与规则 ›',()=>navigate('details'),busy);
   button(card,e?.ended?'返回主菜单':'保存并返回主菜单',options.back,busy);
  }else if(page!=='settle'&&page!=='confirm-refit')button(card,'‹ 返回远征',()=>navigate('home'),busy);
  if(page==='details'&&e?.ended)options.settled?.(card);
 }
 render();
}
