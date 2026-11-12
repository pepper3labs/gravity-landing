// Deliberately isolated: in-memory design scenarios, no game imports, storage or SDK.
const app = document.querySelector('#app');
const dialog = document.querySelector('#confirm');
let state, stack, pending, restoreFocus;
const button = (text, action, style = '') => `<button class="${style}" data-action="${action}">${text}</button>`;
const card = (title, content) => `<section class="card"><h2>${title}</h2>${content}</section>`;
function reset() { state = { mode:'main', level:1, coins:0, cleared:0, doubled:false, expedition:null, board:'overall', controls:'按键', consent:false }; stack=[{page:'home'}]; render(); }
function go(page) { stack.at(-1).focus = document.activeElement?.dataset.action; stack.push({page}); render(); }
function root(page) { stack=[{page:'home'}]; if(page!=='home') stack.push({page}); render(); }
function back() { if(stack.length>1) { stack.pop(); render(stack.at(-1).focus); } }
function ask(title, copy, action) { restoreFocus=document.activeElement; document.querySelector('#confirm-title').textContent=title; document.querySelector('#confirm-copy').textContent=copy; pending=action; dialog.showModal(); }
function close() { dialog.close(); pending=null; restoreFocus?.focus(); }
document.querySelector('#cancel').onclick=close;
document.querySelector('#accept').onclick=()=>{ const action=pending; close(); action?.(); };
dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
document.querySelector('#reset').onclick=reset;
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!dialog.open){event.preventDefault();if(stack.at(-1).page==='flight')go('pause');else if(stack.at(-1).page!=='result')back();}});
function render(focus) {
 const page=stack.at(-1).page, exp=state.expedition;
 const names={home:'引力盲航',levels:'星际航线',brief:'出发前',flight:'飞行体验边界',pause:'已暂停',result:'航行结算',expedition:'连续远征',refit:'资源整备',boards:'远征排行榜',daily:'每日盲航',settings:'设置'};
 const canBack=!['home','flight','result'].includes(page);
 let content='';
 if(page==='home') content=`<div class="grid"><section><div class="eyebrow">GRAVITY LANDING / DEEP SPACE</div><h2 class="hero">在引力之间<br>找到落脚之地。</h2><p>${state.cleared?'下一站，继续向未知出发。':'从第 1 关开始，学习点火与安全着陆。'}</p><div class="actions">${button(state.cleared?'继续主线':'开始航行','start','primary')}${button('选择关卡','levels')}</div></section><div class="stack">${card('另一种航行',`<div class="stack">${button(exp&&!exp.ended?'继续远征 · 未发射':'连续远征 · 30 站','expedition')}${button('每日挑战','daily')}${button('设置','settings')}</div>`)}</div></div>`;
 if(page==='levels') content=`<p>示例进度 ${state.cleared}/30 · 钱包 ${state.coins} 金币。此原型仅开放前两关流程。</p><div class="route">${Array.from({length:30},(_,i)=>i<2?button(`${String(i+1).padStart(2,'0')} · ${i?'减速训练':'起飞训练'}<small>${i<state.cleared?'已完成':'可出发'}</small>`,`level:${i+1}`):`<button disabled>${String(i+1).padStart(2,'0')}<small>后续航线 · 原型未展开</small></button>`).join('')}</div>`;
 if(page==='brief') content=card(`${state.level===1?'01 · 起飞训练':'02 · 减速训练'}`,`<p>先观察目的地。转向调整船头，点火产生推力；松开后飞船仍有惯性。</p><p>安全着陆、着陆质量、本关专项：三个任务分别计星。</p><div class="actions">${button('前往发射台','ready','primary')}</div>`);
 if(page==='flight') content=`<section class="flight"><h2>保留当前游戏场景与 HUD</h2><p>本页只演示菜单转场，不模拟物理或重新设计操控。</p><p>${state.mode==='expedition'?(exp.launched?'远征飞行中 · 退出将结算':'远征发射台 · 尚未点火，可保存退出'):'主线 / 每日的原飞行界面保持现状'}</p>${button('暂停','pause')}<div class="actions">${state.mode==='expedition'&&!exp.launched?button('模拟首次点火','ignite'):button('模拟成功着陆','win')}${button('模拟碰撞失败','lose')}</div></section>`;
 if(page==='pause') content=card('航行已暂停',`<div class="stack">${button('继续飞行','back','primary')}${button('设置','settings')}${state.mode==='expedition'?button(exp.launched?'结束本次远征':'保存退出（原型内）',exp.launched?'end':'save',exp.launched?'danger':''):button('重新开始','retry')}${state.mode!=='expedition'?button('返回模式入口','modehome'):''}</div>`);
 if(page==='expedition') content=`<div class="grid">${card(exp&&!exp.ended?'下一站，准备出发':'三十站，一次远征',`<div class="badge">${exp&&!exp.ended?(exp.pure?'纯净资格保留':'综合远征 · 已整备'):'独立于主线解锁'}</div><p>按顺序完成 30 关，继承燃料与损伤。死亡直接结算；仅未发射时可以保存退出。</p>${exp&&!exp.ended?`<p>已完成 ${exp.completed}/30 · 示例剩余燃料 ${exp.fuel}</p>`:''}<div class="actions">${button(exp&&!exp.ended?'前往发射台':'开始新远征','expstart','primary')}</div>`)}${card('航站服务',`<div class="stack">${exp&&!exp.ended?button('资源整备','refit'):''}${button('排行榜与个人最佳','boards')}${exp&&!exp.ended?button('主动结束远征','end','danger'):''}</div><p>远征不发金币，也不解锁主线。整备会失去纯净榜资格，仍可参与综合榜。</p>`)}</div>`;
 if(page==='refit') content=card('出发前补给',`<p>示例燃料 ${exp.fuel} / 240 · ${exp.pure?'尚未使用整备':'已使用整备，仅可参与综合榜'}</p><p>这里演示首次整备的资格确认。具体价格和效果沿用游戏规则。</p><div class="actions">${button('模拟广告整备','refit-ad')}${button('模拟金币整备','refit-coin')}</div>`);
 if(page==='daily') content=card('今天的同一条航线',`<p>北京时间每天 00:00 更新。无金币奖励、无救援整备。</p><label><span>参与每日榜，完成后自动提交<br><small>原型只切换说明，不实际提交</small></span><input id="consent" type="checkbox" ${state.consent?'checked':''}></label><div class="actions">${button('出发','dailyflight','primary')}</div>`);
 if(page==='result') {
  const isExp=state.mode==='expedition', success=state.success;
  content=`<div class="grid">${card(isExp?'远征已结算':success?'安全着陆':'本次航行结束',`<div class="stat">${isExp?`${exp.completed} / 30`:(success?'★ ☆ ☆':'未能着陆')}</div><p>${isExp?`累计有效飞行时间（示例）00:58.27<br>${exp.pure?(exp.completed===30?'完整纯净远征，可参与两榜':'纯净资格保留，但未完成 30 关不进纯净榜'):'已整备，仅可参加综合榜'}<br>本次远征已结束，不能继续。`:success?(state.mode==='main'?`示例奖励 +10 金币已自动到账 · 钱包 ${state.coins}`:`${state.consent?'已同意自动提交（原型未发送）':'仅记录本机（原型不保存）'}`):'可以重新出发，再试一次。'}</p>`)}${card('下一步',`<div class="stack">${isExp?button('查看综合榜','boards','primary'):success?(state.mode==='main'?button('继续下一关','next','primary'):button('再挑战一次','retry','primary')):button('立即重试','retry','primary')}${state.mode==='main'?(success?button(state.doubled?'双倍示例已领取':'模拟广告双倍金币','double'):button('模拟广告救援','rescue')):''}${button('返回模式入口','modehome')}</div>`)}</div>`;
 }
 if(page==='boards') content=card('榜单展示示例',`<div class="tabs">${button('综合榜','board:overall')}${button('纯净榜','board:pure')}</div><p><strong>仅为排版示例，不是线上成绩，不提供提交。</strong></p>${state.board==='overall'?'<p>按完成关数优先，再按用时排序。</p><p>示例飞行员　3/30 · 部分远征　00:58.27</p>':'<p>只接受未整备的完整 30/30 成绩，用时越短越靠前。</p><p>暂无示例完整成绩。未完成只记本机最远进度。</p>'}`);
 if(page==='settings') content=card('操控与体验',`<p>设置仅在本原型中演示。返回会回到来源页面。</p><label>操作方式<select id="controls"><option ${state.controls==='按键'?'selected':''}>按键</option><option ${state.controls==='倾斜'?'selected':''}>倾斜</option></select></label><p>${state.controls==='倾斜'?'实际游戏在用户主动授权后校准中立姿态。本页不请求传感器。':'默认使用按键。现有飞行按钮与手感保持。'}</p>${button('完成设置','back','primary')}`);
 app.innerHTML=`<header>${canBack?button('← 返回','back'):''}<h1>${names[page]}</h1>${!['home','settings','flight','pause'].includes(page)?button('设置','settings'):''}</header>${content}`;
 app.querySelectorAll('[data-action]').forEach(el=>el.onclick=()=>act(el.dataset.action));
 app.querySelectorAll('[data-action^="board:"]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.action===`board:${state.board}`)));
 const consent=app.querySelector('#consent');if(consent)consent.onchange=()=>state.consent=consent.checked;
 const controls=app.querySelector('#controls');if(controls)controls.onchange=()=>{state.controls=controls.value;render();};
 const target=[...app.querySelectorAll('button')].find(el=>el.dataset.action===focus)||app.querySelector('.primary')||app.querySelector('button'); target?.focus();
 document.querySelector('#status').textContent='';
}
function settle() { state.expedition.ended=true;root('result'); }
function act(action) {
 if(action.startsWith('board:')){state.board=action.split(':')[1];return render(action);}
 if(action==='back')return back();
 if(['levels','settings','refit','boards','pause'].includes(action)){if(action==='boards'&&stack.at(-1).page==='result')state.board='overall';return go(action);}
 if(action==='expedition'){state.mode='expedition';return go(action);}
 if(action==='daily'){state.mode='daily';return go(action);}
 if(action==='start'||action.startsWith('level:')){state.mode='main';state.level=action==='start'?Math.min(state.cleared+1,2):Number(action.split(':')[1]);return go(state.cleared>=state.level?'flight':'brief');}
 if(action==='ready'||action==='dailyflight')return go('flight');
 if(action==='expstart'){if(!state.expedition||state.expedition.ended)state.expedition={completed:0,pure:true,fuel:240,launched:false,ended:false};return go('flight');}
 if(action==='ignite'){state.expedition.launched=true;return render();}
 if(action==='save')return root('home');
 if(action==='end')return ask('结束本次远征？','保留累计统计并结算，之后不能继续本次远征。',settle);
 if(action.startsWith('refit-'))return ask('整备后将失去纯净榜资格','仍可参加综合榜。此处仅模拟成功回执，不扣真实金币、不播放广告。',()=>{state.expedition.pure=false;state.expedition.fuel=240;render();});
 if(action==='modehome')return root(state.mode==='main'?'home':state.mode==='daily'?'daily':'expedition');
 if(action==='retry') {root(state.mode==='daily'?'daily':'levels');return go('flight');}
 if(action==='rescue')return ask('模拟广告救援','确认代表模拟广告完成；取消不会恢复飞行。真实游戏救援成绩仍单独记录。',()=>{root('levels');go('flight');});
 if(action==='double'){if(state.doubled)return;return ask('模拟双倍奖励','确认代表一次广告完成回执；取消不增加示例金币。',()=>{state.coins+=10;state.doubled=true;render();});}
 if(action==='next'){if(state.level>=2){root('levels');document.querySelector('#status').textContent='后续关卡未在原型展开；正式解锁仍沿用游戏规则。';return;}state.level=2;root('levels');return go('flight');}
 if(action==='win'||action==='lose'){
  state.success=action==='win';state.doubled=false;
  if(state.mode==='expedition'){if(state.success){state.expedition.completed++;state.expedition.fuel-=20;state.expedition.launched=false;if(state.expedition.completed<30)return root('expedition');}return settle();}
  if(state.success&&state.mode==='main'){state.cleared=Math.max(state.cleared,state.level);state.coins+=10;}
  return root('result');
 }
}
reset();
