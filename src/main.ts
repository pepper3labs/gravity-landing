import { nextCampaignLevel, recommendedCampaignLevel } from './campaign';
import blackHoleArtUrl from './assets/black-hole.png';
import blackHoleOrbitsUrl from './assets/black-hole-orbits.png';
import {observationRoute} from './observatory';
import {dailyCourse,DailyRecords,DailyRecorder,compareDaily,type DailyCourse} from './daily';
import {archiveDaily,DailyArchiveStore} from './daily-archive';
import {LeaderboardReader,rankingDuration,type RankingKind} from './leaderboard-reader';
import {leaderboardPanel,type RankingSource} from './leaderboard-view';
import {OnlineParticipation,type OnlineRun} from './online-participation';
import {noopDailyOnlineBoard,ONLINE_BOARDS} from './online-provider';
import { flyRoute, type ReplayInput } from './replay';
import { dragAt } from './environment';
import Phaser from 'phaser';
import { Flight, CONFIG, frame } from './physics';
import { guidance, telemetry, RESULT } from './feedback';
import { FlightAudio } from './audio';
import { FlightInput } from './input';
import { FlightView } from './visuals';
import { loadQaScenario } from './qa';
import {GameEconomy,type Receipt} from './economy';
import {ECONOMY,EXPEDITION_CAPACITY} from './economy-config';
import {ExpeditionBoards} from './expedition-boards';
import {ExpeditionSubmission} from './expedition-submission';
import {rankingConsent,consentDescription,type ConsentMode} from './ranking-consent';
import {expeditionPanel} from './expedition-view';
import {platformServices,serviceMode} from './platform-services';
import { RewardedAction } from './rewarded-action';
import { LEVELS, levelById } from './levels';
import type { CampaignLevel } from './level-types';
import { CampaignProgress } from './progress';
import { PlaytestDiagnostics } from './diagnostics';
import { scoreTaskFlight as scoreFlight, starTasks } from './star-tasks';
import { starTaskMarkup } from './star-task-view';
import {compactCard} from './compact-card';
import { GameSettings } from './settings';
import {TiltControl,TiltSafety,tiltRateCommand} from './tilt';
import {exportLocalData,clearLocalData} from './local-data';
import { FrameDiagnostics } from './performance';
import { goalLevels, nextReplayGoal, type GoalFilter } from './replay-goals';
import './style.css';

const icons:Record<string,string>={
  trophy:'<path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v6m-4 2h8m-6-2h4"/>',
  home:'<path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',
  sound:'<path d="m11 5-5 4H3v6h3l5 4zM15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
  muted:'<path d="m11 5-5 4H3v6h3l5 4zM16 9l5 6m0-6-5 6"/>',
  left:'<path d="M6 11a7 7 0 1 1 1 7M3 7l3 4 4-3"/>',
  right:'<path d="M18 11a7 7 0 1 0-1 7m4-11-3 4-4-3"/>',
  flame:'<path d="M12 3c0 6-7 8-7 13a7 7 0 0 0 14 0c0-3-2-6-3-7 0 4-3 5-3 5s2-6-1-11Z"/><path d="M12 16c-4 4-1 6 0 6s4-2 0-6Z"/>',
  retry:'<path d="M4 10a8 8 0 1 1 0 5M4 4v6h6"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  gear:'<path d="m5 5 4 4-4 10m14-14-4 4 4 10M2 19h6m8 0h6M9 9h6"/>',
};
const icon=(name:string)=>'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+icons[name]+'</svg>';
document.querySelector('#app')!.innerHTML=`
<div class="desktop-caption"><span>ORBITAL FLIGHT LAB</span><h2>飞向未知。<br>平稳归航。</h2><p>每一次短喷射，<br>都在改写你的航线。</p><small>引力盲航 / v1.0.0-rc.3</small></div>
<main id="shell" data-mode="intro">
<header><div class="brand-area"><button id="menu-home" class="icon-button" aria-label="返回主菜单" title="返回主菜单" hidden>${icon('home')}</button><a class="brand" href="#" aria-label="引力盲航">${icon('gear')}<span>引力盲航<small>GRAVITY LANDING</small></span></a></div><div class="top-actions"><button id="settings" class="icon-button" aria-label="设置">⚙</button><button id="sound" class="icon-button" aria-label="关闭声音">${icon('sound')}</button><button id="pause" class="icon-button" aria-label="暂停">${icon('pause')}</button></div></header>
<section id="game" aria-label="引力盲航游戏区域"><div id="canvas"></div>
<div class="hud" id="hud">
  <div class="mission"><span class="live-dot"></span><span id="mission-name">首次着陆</span><small id="sector">SECTOR 01</small><span id="flight-status">停泊</span></div>
  <div class="telemetry"><div><label id="vertical-label">下降速度</label><strong id="vertical">0.0<em>m/s</em></strong></div><div><label>离地高度</label><strong id="altitude">0<em>m</em></strong></div><div><label>燃料余量</label><strong id="fuel">100<em>%</em></strong></div></div>
  <div class="fuel-track"><i id="fuel-bar"></i></div>
  <div class="systems"><span id="leg-left">${icon('gear')} L <b>100</b></span><span id="leg-right">${icon('gear')} R <b>100</b></span><span class="attitude"><i id="attitude-needle"></i><span id="angle">0°</span></span><span id="speed">惯性 0.0 m/s</span></div>
</div>
<div class="landing-envelope" id="envelope" hidden><span>着陆窗口</span><b id="limit-v"></b><b id="limit-h"></b><b id="limit-a"></b></div>
<div id="toast" role="status"></div>
<div class="coach" id="coach"><div class="steps"><i></i><i></i><i></i><i></i></div><div class="coach-heading"><span id="coach-title"></span><span id="distance"></span></div><p id="coach-detail"></p></div>
<div class="controls"><div class="rotation-controls"><div class="control-caption">姿态控制 <span>A / D</span></div><div class="rotation-buttons"><button id="left" aria-label="向左旋转">${icon('left')}<span>左旋</span></button><button id="right" aria-label="向右旋转">${icon('right')}<span>右旋</span></button></div></div><div class="thrust-control"><div class="control-caption">主推进器 <span>W / ↑</span></div><button id="thrust" aria-label="主推进器"><div class="engine-rings"></div>${icon('flame')}<span>按住点火</span><i id="engine-meter"></i></button></div></div>
<div id="intro" class="intro">
  <div class="intro-title"><div class="eyebrow"><span></span> SINGLE PILOT / DEEP SPACE</div><h1>引力盲航</h1><p>保持冷静，让每一份推力恰到好处。</p></div>
  <div class="ship-caption"><span>GL–01 / 轻型着陆器</span><small>双缓冲支架 · 独立姿态喷口</small></div>
  <div class="launch-panel"><div class="mission-card"><div><span class="eyebrow" id="menu-chapter">第一章 · 曙光航线</span><h3 id="menu-mission">首次着陆 · 从这里启程。</h3></div><span class="mission-number" id="menu-number">01</span><div class="briefing"><span><b>01</b> 点火爬升</span><span><b>02</b> 短喷转向</span><span><b>03</b> 减速着陆</span></div></div><button id="start" class="primary-button">开始飞行 ${icon('arrow')}</button><button id="select-level" class="secondary-button">单关挑战 · 关卡与成绩</button><button id="practice" class="text-button">先练着陆 <span>从目标上空开始</span></button><div class="intro-meta"><span>建议佩戴耳机</span><span>V1.0 RC · PLAYTEST</span></div></div>
</div>
<div id="overlay" hidden></div>
</section>
<footer><span id="footer-status"><i></i> 飞行系统待命</span><button id="retry">${icon('retry')} 重试 <kbd>R</kbd></button><span id="coins">◈ 0</span></footer>
</main>
<div class="desktop-notes"><span class="eyebrow">FLIGHT MANUAL / 01</span><h3>朝向决定推力。<br>惯性决定航向。</h3><p><kbd>W</kbd> 按住点火，松开滑行</p><p><kbd>A</kbd><kbd>D</kbd> 调整机头朝向</p><p><kbd>P</kbd> 暂停 <kbd>R</kbd> 重新出发</p><div class="notes-line"></div><small>琥珀色箭线表示惯性方向。<br>靠近平台时，先减速，再回正。</small></div>`;
const el=(id:string)=>document.getElementById(id)!;
let storage:Storage|undefined;try{storage=window.localStorage;}catch{}
const economy=new GameEconomy(storage);
const progress=new CampaignProgress(economy.campaignStorage,{unlocked:id=>economy.unlocked(id),highest:()=>economy.highest()});
const expeditionBoards=new ExpeditionBoards();
const getCoins=()=>economy.data.coins;
let activeExpedition=false,campaignAttempt='';
let campaignReceipt:Receipt|undefined;
function syncEconomy(){progress.data=structuredClone(economy.data.campaign);progress.data.highestUnlocked=economy.highest();}
const dailyRecords=new DailyRecords(storage);
const dailyArchives=new DailyArchiveStore(storage);
const testMemory=new Map<string,string>();
const testStorage={getItem:(key:string)=>testMemory.get(key)??null,setItem:(key:string,value:string)=>{testMemory.set(key,value);}};
const testRecords=new DailyRecords(testStorage),testArchives=new DailyArchiveStore(testStorage);
const tapDailyBoard=noopDailyOnlineBoard();
const expeditionOnline=new ExpeditionSubmission(economy,expeditionBoards,'expedition-v1:'+(ONLINE_BOARDS.overall??'')+':'+(ONLINE_BOARDS.pure??''),storage);
const onlineChoice=new OnlineParticipation('daily-v3-score-v1:'+(ONLINE_BOARDS.daily??''),raw=>tapDailyBoard.submit(raw),storage);
let dailyOnlineRun:{courseId:string;run:OnlineRun}|undefined;
let refreshDailyChoice:(()=>void)|undefined;
let activeDailyTest=false;
let activeDaily:DailyCourse|undefined,dailyRecorder=new DailyRecorder(),dailyNotice='';
const diagnostics=new PlaytestDiagnostics(storage);
const frameDiagnostics=new FrameDiagnostics();
const settings=new GameSettings(storage);
const previewLevel=import.meta.env.DEV?levelById(new URLSearchParams(location.search).get('level')??''):undefined;
let selected:CampaignLevel=previewLevel??recommendedCampaignLevel(progress);
const adQa=import.meta.env.DEV&&new URLSearchParams(location.search).get('qa')==='ad';
const adQaResult=adQa?new URLSearchParams(location.search).get('ad'):null;
const services=platformServices(serviceMode(import.meta.env.VITE_SERVICE_MODE),adQaResult==='failed'||adQaResult==='cancelled'?adQaResult:'completed');
const adLabel=services.mode==='local'?'模拟广告':'观看广告';
const sim=new Flight(selected),audio=new FlightAudio(),ad=services.ad;
const rewardedAction=new RewardedAction();
let started=false,paused=false,accumulator=0,modal='',adBusy=false,rewarded=false,awarded=false,runId=0,practice=false;
let finishDelay=0,toastTimer=0,hudTimer=0,sceneView:FlightView|undefined;
let recoveryNotice=false,screen='',newRecord=false;
let trainingMode=false;
let dataResetting=false;
let qaInputs:ReplayInput[]|undefined,qaIndex=0,qaCommand:ReplayInput={thrust:false,turn:0};
let qaVistaHold=false;
const stars=(n:number)=>'★'.repeat(n)+'☆'.repeat(3-n);
function menuInfo(){el('menu-chapter').textContent=selected.chapter;el('menu-number').textContent=selected.order.toString().padStart(2,'0');el('menu-mission').textContent=selected.order.toString().padStart(2,'0')+' / '+selected.title;el('start').innerHTML=(progress.record(selected.id).tutorialSeen?'继续航行':'开始航行')+' '+icon('arrow');}
menuInfo();
const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
const settingsDialog=document.createElement('dialog');settingsDialog.className='settings-dialog';settingsDialog.setAttribute('aria-label','声音与显示设置');document.body.append(settingsDialog);
const consentDialog=document.createElement('dialog');consentDialog.className='settings-dialog consent-dialog';document.body.append(consentDialog);
function askRanking(mode:ConsentMode,proceed:()=>void,force=false){
 input.clear();audio.engine(0);rankingConsent(consentDialog,mode,mode==='daily'?onlineChoice:expeditionOnline.preference,()=>{input.clear();proceed();const warning=(mode==='daily'?onlineChoice:expeditionOnline.preference).warning;if(warning)notify(warning);},force);
}
consentDialog.addEventListener('close',()=>input.clear());
function applySettings(){
  audio.setEnabled(settings.data.sound);
  el('sound').innerHTML=icon(audio.enabled?'sound':'muted');el('sound').setAttribute('aria-label',audio.enabled?'关闭声音':'开启声音');
  document.documentElement.classList.toggle('low-effects',settings.reduced(motionPreference.matches));
}
applySettings();motionPreference.addEventListener('change',applySettings);
const tilt=new TiltControl();
const tiltSafety=new TiltSafety();
const input=new FlightInput(()=>!dataResetting&&started&&!paused&&!adBusy&&!screen&&!settingsDialog.open&&!consentDialog.open&&(sim.state==='docked'||sim.state==='flying'),()=>void audio.unlock(),key=>{
  if(settingsDialog.open||consentDialog.open)return;
  if(key==='r'&&started&&!screen&&!adBusy&&!activeExpedition)start(trainingMode);
  if(key==='p'||key==='escape')togglePause();
  if(key==='m')toggleSound();
},{active:()=>tilt.enabled,ready:()=>tilt.state.fresh(performance.now()),turn:()=>tilt.state.fresh(performance.now())?tiltRateCommand(tilt.state.targetRate(performance.now()),sim.omega):0,clear:()=>tilt.state.clear()});
const tiltHint=document.createElement('div');tiltHint.className='tilt-hint';el('game').append(tiltHint);
function notify(text:string){el('toast').textContent=text;el('toast').classList.add('visible');toastTimer=3;}
function vibrate(pattern:number|number[]){try{navigator.vibrate?.(pattern);}catch{/* Unsupported hosts must not interrupt flight. */}}
el('settings').onclick=()=>{
  if(dataResetting||consentDialog.open)return;
  settingsDialog.classList.remove('ranking-preferences');settingsDialog.setAttribute('aria-label','游戏设置');
  frameDiagnostics.gap();
  if(adBusy)return;
  input.clear();audio.engine(0);
  if(started&&!screen&&(sim.state==='flying'||sim.state==='docked')){paused=true;modal='';}
  settingsDialog.innerHTML='<h2>操作、声音与显示</h2><p>设置立即生效，仅保存在当前浏览器。</p>'+
    '<label for="control-mode">操作方式</label><select id="control-mode"><option value="buttons">按钮操作</option><option value="tilt">倾斜手机 + 按住屏幕喷射</option></select><p>倾斜操作：按正常姿势握稳手机后开启，向左倾斜左旋、向右倾斜右旋，倾斜越大转得越快；回中逐渐停转，保持当前朝向；按住游戏画面任意空白处喷射，松开停止。菜单按钮不触发喷射。传感器数据仅用于本次操作，不保存或上传。</p><button id="tilt-enable" class="secondary-button">开启倾斜操作 / 授权</button><button id="tilt-calibrate" class="text-button">以当前握姿重新校准</button><p id="control-status" role="status"></p>'+
    '<label><span>声音<small>引擎、提示与着陆音效</small></span><input id="setting-sound" type="checkbox"></label>'+
    '<label><span>震动<small>接触与支架断裂反馈，需设备支持</small></span><input id="setting-vibration" type="checkbox"></label>'+
    '<label><span>低特效<small>关闭闪光与镜头抖动，减少喷焰粒子</small></span><input id="setting-lowEffects" type="checkbox"></label>'+
    '<button id="ranking-settings" class="secondary-button">排行榜参与设置</button><button id="data-info" class="text-button">版本与本地数据说明</button><button id="data-manage" class="text-button">管理本地数据</button><p class="settings-note">系统开启减少动态效果时，会自动减少特效并关闭震动。危险提示和飞行规则保持一致。</p><p id="settings-warning" role="status"></p><button id="settings-close" class="primary-button">完成</button>';
  for(const key of ['sound','vibration','lowEffects'] as const){
    const control=el('setting-'+key) as HTMLInputElement;control.checked=settings.data[key];
    control.onchange=()=>{
      settings.set(key,control.checked);applySettings();
      if(key==='sound'&&control.checked)void audio.unlock();
      if(key==='vibration'&&!control.checked)vibrate(0);
      el('settings-warning').textContent=settings.warning;
    };
  }
  el('settings-warning').textContent=settings.warning;
  const mode=el('control-mode') as HTMLSelectElement;
  mode.value=settings.data.controlMode;
  const updateControl=()=>{
    el('tilt-enable').hidden=mode.value!=='tilt';el('tilt-calibrate').hidden=!tilt.enabled;
    el('shell').classList.toggle('tilt-controls',tilt.enabled);
    el('control-status').textContent=tilt.enabled?'倾斜操作已开启；关闭设置后继续飞行。':mode.value==='tilt'?'请点击开启并握稳手机；授权成功前仍可使用按钮。':'当前使用按钮操作。';
  };
  mode.onchange=()=>{tilt.disable();input.clear();settings.set('controlMode',mode.value as 'buttons'|'tilt');updateControl();};
  el('tilt-enable').onclick=async()=>{
    const button=el('tilt-enable') as HTMLButtonElement;button.disabled=true;
    el('control-status').textContent='请握稳手机，正在等待传感器…';
    try{await tilt.enable();if(!settingsDialog.open||!button.isConnected){tilt.disable();return;}input.clear();updateControl();}
    catch(error){if(button.isConnected){updateControl();el('control-status').textContent=(error as Error).message;}}
    finally{button.disabled=false;}
  };
  el('tilt-calibrate').onclick=()=>{input.clear();tilt.state.calibrate();el('control-status').textContent='请握稳手机，下一次传感器读数将作为中立姿势。';};
  updateControl();
  el('ranking-settings').onclick=showRankingSettings;
  el('data-manage').onclick=()=>{
    settingsDialog.innerHTML='<h2>管理本地数据</h2><p>仅管理当前浏览器的战役进度、金币、设置、试玩记录、每日成绩和远征进度。清除前请关闭其他游戏标签页，以免旧进度再次保存。</p><button id="data-backup" class="secondary-button">导出本地备份</button><p>备份保留存档原文，供留存与问题排查；当前不支持游戏内导入。不会自动上传。</p><button id="data-clear" class="secondary-button">清除本地游戏数据…</button><p id="data-status" role="status"></p><button id="data-back" class="primary-button">返回设置</button>';
    el('data-back').onclick=()=>el('settings').click();
    el('data-backup').onclick=()=>{
      try{
        const raw=exportLocalData(storage,'1.0.0-rc.3'),url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),link=document.createElement('a');
        link.href=url;link.download='gravity-local-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
        el('data-status').textContent='已请求下载，请确认文件已保存后再清除。';
      }catch{el('data-status').textContent='无法读取或导出本地数据，原数据未修改。';}
    };
    el('data-clear').onclick=()=>{
      settingsDialog.innerHTML='<h2>确认清除本地数据</h2><p>所有关卡成绩、解锁、金币、设置、试玩记录、每日记录和远征将被删除，无法在游戏内撤销。其他应用的数据不受影响。</p><label for="data-confirm">输入“清除”以确认</label><input id="data-confirm" type="text" autocomplete="off"><button id="data-confirm-clear" class="secondary-button" disabled>永久清除并重新载入</button><button id="data-cancel" class="primary-button">取消，保留数据</button>';
      const confirm=el('data-confirm') as HTMLInputElement,button=el('data-confirm-clear') as HTMLButtonElement;
      confirm.oninput=()=>{button.disabled=confirm.value!=='清除';};
      el('data-cancel').onclick=()=>el('settings').click();
      button.onclick=()=>{
        if(confirm.value!=='清除'||dataResetting)return;
        dataResetting=true;started=false;paused=true;input.clear();audio.engine(0);cancelAd(true);
        const result=clearLocalData(storage);
        if(result.ok){location.reload();return;}
        settingsDialog.innerHTML='<h2>清除未完成</h2><p>浏览器拒绝了部分数据操作，部分记录可能已清除。请重新载入后检查，或通过浏览器站点设置管理。为避免旧进度写回，当前游戏已停止。</p><button id="data-reload" class="primary-button">重新载入</button>';
        el('data-reload').onclick=()=>location.reload();
      };
      el('data-cancel').focus();
    };
  };
  el('data-info').onclick=()=>{
    settingsDialog.innerHTML='<h2>版本与本地数据说明</h2><iframe class="data-info-frame" title="本地数据与第三方软件说明" sandbox="allow-same-origin" src="'+import.meta.env.BASE_URL+'about-data.html"></iframe><button id="data-back" class="primary-button">返回设置</button>';
    el('data-back').onclick=()=>el('settings').click();el('data-back').focus();
  };
  el('settings-close').onclick=()=>settingsDialog.close();if(!settingsDialog.open&&!consentDialog.open)settingsDialog.showModal();
};
settingsDialog.addEventListener('close',()=>{if(!tilt.enabled)tilt.disable();input.clear();if(screen==='rankings')showRankings(lastRanking);});
settingsDialog.addEventListener('cancel',event=>{if(dataResetting)event.preventDefault();});
function cancelAd(silent=false){
  rewardedAction.cancel();
  if(adBusy){
    adBusy=false;modal='';
    if(!silent)restoreAdResult('已取消奖励请求 · 未发放奖励，可免费重新出发');
  }
}
function restoreAdResult(message:string){
  modal=sim.state;showModal(modal);el('shell').classList.remove('route-review');
  const note=document.createElement('p');note.className='debrief-tip';note.setAttribute('role','status');note.textContent=message;
  document.getElementById('ad')?.before(note);
}
const diagnosticSnapshot=()=>({seconds:sim.elapsed,fuel:sim.fuel,assisted:sim.rescued,rescues:sim.rescueCount,reason:sim.reason});
function start(training=false){
  if(activeExpedition&&economy.data.expedition?.phase!=='station'){notify('连续远征不能重试；死亡或结束航行后结算。');return;}
  if(!activeExpedition&&!activeDaily&&!training&&!previewLevel&&!progress.unlocked(selected.id)){selectLevels();return;}
  campaignReceipt=undefined;

  if(activeDaily&&!activeDailyTest&&dailyCourse().id!==activeDaily.id){showDaily();return;}
  dailyRecorder=new DailyRecorder();dailyNotice='';dailyOnlineRun=undefined;
  cancelAd(true);
  diagnostics.leave('retry',diagnosticSnapshot());
  trainingMode=training;
  el('shell').classList.remove('route-review');
  qaInputs=undefined;qaIndex=0;qaVistaHold=false;
  el('menu-home').hidden=true;screen='';runId++;practice=training||!!previewLevel;started=true;paused=adBusy=false;modal='';rewarded=awarded=false;finishDelay=accumulator=0;recoveryNotice=false;
  sim.setLevel(selected);
  try{if(activeExpedition){economy.prepareFlight(sim);if(import.meta.env.DEV&&new URLSearchParams(location.search).has('qa')){economy.data.expedition!.eligible=false;economy.data.expedition!.reason='开发验证航行，不提交平台';}}else if(!activeDaily&&!practice&&!adQa)campaignAttempt=economy.beginCampaign(selected.id);}catch(e){notify(String(e));started=false;return;}
  tiltSafety.reset();input.clear(false);sceneView?.setLevel();el('shell').classList.remove('modal-open');el('overlay').hidden=true;el('intro').hidden=true;el('shell').dataset.mode='flight';
  if(training){
    const pad=sim.level.platforms.find(p=>p.id===sim.level.target)!,f=frame(sim.level,pad);
    sim.x=f.c.x+f.n.x*130;sim.y=f.c.y+f.n.y*130;sim.angle=pad.angle+Math.PI/2;
    sim.vx=-f.n.x*4;sim.vy=-f.n.y*4;sim.state='flying';
    if(sceneView){sceneView.camera.x=sim.x;sceneView.camera.y=sim.y+15;sceneView.camera.zoom=1.9;}
    notify('着陆练习：短按点火，控制下降速度');
  } else notify('发射台锁定已解除 · 按住右侧推进器起飞');
  if(import.meta.env.DEV&&loadQaScenario(sim,adQa?'crash':new URLSearchParams(location.search).get('qa')??'')){
    practice=true;
    if(sceneView){sceneView.camera.x=sim.x;sceneView.camera.y=sim.y+15;sceneView.camera.zoom=1.9;}
    notify('开发验证场景 · 使用正式物理求解，不计金币');
  }
  if(import.meta.env.DEV&&['route','mastery','tour','vista'].includes(new URLSearchParams(location.search).get('qa')??'')&&!training){
    const tour=['tour','vista'].includes(new URLSearchParams(location.search).get('qa')??'')&&selected.rotatingFrame;
    qaInputs=flyRoute(tour?{...selected,verificationRoute:observationRoute(selected)}:selected,true,undefined,new URLSearchParams(location.search).get('qa')==='mastery'&&selected.id==='binary-reef'?{height:26,angleOffset:0}:undefined).report.inputs;practice=true;notify('开发航线回放 · 不保存成绩');}
  sim.trajectory=[{x:sim.x,y:sim.y}];
  frameDiagnostics.begin(selected.id,!practice&&!activeDaily&&!(import.meta.env.DEV&&new URLSearchParams(location.search).has('qa')));
  diagnostics.begin(selected.id,practice||activeDaily?'practice':import.meta.env.DEV&&new URLSearchParams(location.search).has('qa')?'qa':'manual',diagnosticSnapshot());
  void audio.unlock();audio.cue('click');refreshHud();
}
function togglePause(){
  frameDiagnostics.gap();
  if(settingsDialog.open||consentDialog.open||!started||screen||adBusy||sim.state==='failed'||sim.state==='won')return;
  if(paused&&!tiltSafety.resume(tilt.enabled,tilt.state.fresh(performance.now()))){modal='';notify('传感器仍无信号，请打开操作设置重新校准或改用按钮。');return;}
  paused=!paused;input.clear(paused);audio.engine(0);modal='';audio.cue('click');
}
function toggleSound(){settings.set('sound',!settings.data.sound);applySettings();if(settings.data.sound)void audio.unlock();if(settings.warning)notify(settings.warning);}
function toMenu(){el('menu-home').hidden=true;if(activeExpedition){try{economy.park();expeditionOnline.settled();}catch(e){notify(String(e));return false;}activeExpedition=false;selected=recommendedCampaignLevel(progress);sim.setLevel(selected);sceneView?.setLevel();}activeDailyTest=false;if(activeDaily){activeDaily=undefined;selected=recommendedCampaignLevel(progress);sim.setLevel(selected);sceneView?.setLevel();}cancelAd(true);diagnostics.leave('menu',diagnosticSnapshot());el('shell').classList.remove('route-review');screen='';el('shell').classList.remove('modal-open');menuInfo();runId++;started=paused=adBusy=practice=false;sim.reset();input.clear();sceneView?.reset();modal='';audio.engine(0);toastTimer=0;el('toast').classList.remove('visible');el('overlay').hidden=true;el('intro').hidden=false;el('shell').dataset.mode='intro';refreshHud();}
function enterLevel(level:CampaignLevel){
  if(activeExpedition){economy.park();activeExpedition=false;}
  if(!progress.unlocked(level.id)&&level!==previewLevel)return;
  activeDaily=undefined;
  cancelAd(true);
  diagnostics.leave('menu',diagnosticSnapshot());
  selected=level;sim.setLevel(level);sceneView?.setLevel();input.clear();audio.engine(0);menuInfo();
  el('menu-home').hidden=false;screen='brief';started=false;el('intro').hidden=true;el('overlay').hidden=false;el('shell').classList.add('modal-open');
  el('overlay').innerHTML='<div class="result-card briefing-card"><span class="eyebrow">MISSION '+level.order.toString().padStart(2,'0')+' / '+level.chapter+'</span><h2>'+level.title+'</h2><p>'+level.description+'</p><h3>'+level.tutorial.topic+'</h3>'+level.tutorial.paragraphs.map((p,i)=>'<p class="lesson"><b>0'+(i+1)+'</b>'+p+'</p>').join('')+'<div class="objectives">'+level.objectives.map(x=>'<span>◇ '+x+'</span>').join('')+'</div><button id="begin" class="primary-button">明白了，准备起飞 '+icon('arrow')+'</button><button id="skip" class="text-button">跳过教学，直接起飞</button><button id="back-levels" class="text-button">返回关卡选择</button></div>';
  el('begin').insertAdjacentHTML('beforebegin',starTaskMarkup(starTasks(level)));
  const briefing=el('overlay').querySelector<HTMLElement>('.result-card')!;
  const steps=document.createElement('ol');steps.className='brief-steps';
  const shortSteps=level.order===1?['按住推进起飞，约60米后松手。','轻点右旋，短喷前往目标；松手仍会滑行。','反向短喷减速，双脚朝向平台，触地松手。']:level.objectives;
  for(const text of shortSteps){const item=document.createElement('li');item.textContent=text;steps.append(item);}
  el('begin').before(steps);
  el('skip').remove();el('begin').textContent='准备起飞';
  compactCard(briefing,Array.from(briefing.querySelectorAll('.lesson,.objectives,.star-tasks,:scope > h3')),'教学与三星目标');
  briefing.classList.add('compact-briefing');
  el('overlay').scrollTop=0;
  const begin=()=>{if(!previewLevel&&!adQa)progress.seen(level.id);start();if(progress.warning)notify(progress.warning);};
  el('begin').onclick=begin;el('back-levels').onclick=selectLevels;
}
function onlineCourse(id:string){return tapDailyBoard.available()&&tapDailyBoard.accepts(id);}
function showRankingSettings(){
 settingsDialog.classList.add('ranking-preferences');settingsDialog.setAttribute('aria-label','排行榜参与设置');
 settingsDialog.innerHTML='<h2>排行榜参与设置</h2><p>每日与远征分别记住选择。成绩关联当前平台账号；切换账号前请检查。关闭只影响后续提交，无法撤回已发出的请求或平台成绩。</p>';
 for(const mode of ['daily','expedition'] as const){
  const preference=mode==='daily'?onlineChoice:expeditionOnline.preference;
  const label=document.createElement('label');label.htmlFor='ranking-choice-'+mode;label.textContent=mode==='daily'?'每日挑战':'连续远征';settingsDialog.append(label);
  const description=document.createElement('p');description.textContent=consentDescription(mode);settingsDialog.append(description);
  const select=document.createElement('select');select.id=label.htmlFor;
  for(const [value,text] of [['unset','尚未选择 · 开始时询问'],['yes','参与排行 · 自动提交'],['no','仅本机记录']] as const){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
  select.value=preference.choice;select.options[0].disabled=true;
  const warning=document.createElement('p');warning.setAttribute('role','status');warning.textContent=preference.warning;
  select.onchange=()=>{preference.choose(select.value==='yes');warning.textContent=preference.warning||'选择已保存；开启仅影响后续结算，不自动补传历史成绩。';updateExpeditionStatus();refreshDailyChoice?.();};
  settingsDialog.append(select,warning);
 }
 const back=document.createElement('button');back.className='primary-button';back.textContent='返回设置';back.onclick=()=>el('settings').click();settingsDialog.append(back);
 settingsDialog.querySelector('select')?.focus();
}
function mountExpeditionStatus(parent:HTMLElement){
 const panel=document.createElement('section');panel.dataset.expOnline='';panel.className='daily-tools';parent.append(panel);updateExpeditionStatus();
}
function updateExpeditionStatus(){
 for(const panel of Array.from(document.querySelectorAll<HTMLElement>('[data-exp-online]'))){
  panel.replaceChildren();
  const info=document.createElement('p');info.setAttribute('role','status');
  info.textContent='本机历史最佳提交状态 · 综合榜：'+expeditionOnline.status('overall')+'；纯净榜：'+expeditionOnline.status('pure')+'。'+expeditionOnline.preference.warning;panel.append(info);
  if(expeditionOnline.preference.choice==='yes')for(const kind of ['overall','pure'] as const){
   const best=economy.data.best[kind];
   if(!best||economy.data.submitted[kind]===best.id||expeditionOnline.attempts[kind]?.pending)continue;
   const retry=document.createElement('button');retry.className='secondary-button';retry.textContent=(kind==='overall'?'综合榜':'纯净榜')+' · 提交 / 重试本机最佳';retry.onclick=()=>void expeditionOnline.send(kind);panel.append(retry);
  }
  else{const note=document.createElement('p');note.textContent='可在设置 → 排行榜参与设置中开启，随后到排行榜提交本机最佳。';panel.append(note);}
 }
}
expeditionOnline.changed=updateExpeditionStatus;
function mountOnlineChoice(panel:HTMLElement,run?:OnlineRun){
  panel.className='daily-tools';
  const render=()=>{
    panel.replaceChildren();
    const note=document.createElement('p');note.textContent='参与在线排行榜后，通关复核成功会自动提交分数，并关联当前平台账号。只发送榜单编号和分数，不上传回放；本机纪录照常保留。本机记住此选择，切换账号前请检查。每日北京时间00:00刷新，在线榜按分数排名；同分顺序由平台决定。零点前30秒暂停提交，跨日完成仅保留本机成绩。';panel.append(note);
    const status=document.createElement('p');status.setAttribute('role','status');
    status.textContent=onlineChoice.choice==='yes'?(run?{idle:'本局尚未提交，可点击提交。',sending:'正在提交分数…',submitted:'平台已确认提交。',failed:run.error||'提交未确认成功，可重试；本机成绩保留。'}[run.state]:'已参与，通关后自动提交。'):'仅保存本机纪录，不自动提交。';
    if(onlineChoice.warning)status.textContent+=' '+onlineChoice.warning;panel.append(status);
    const button=(text:string,action:()=>void)=>{const b=document.createElement('button');b.className='secondary-button';b.textContent=text;b.onclick=action;panel.append(b);return b;};
    const send=()=>{const pending=run?onlineChoice.send(run):Promise.resolve();render();void pending.then(()=>{if(panel.isConnected)render();});};
    if(onlineChoice.choice!=='yes'){
      if(run)button('参与排行并提交本局',()=>askRanking('daily',send,true));
    }else{
      if(run&&(run.state==='failed'||run.state==='idle'))button(run.state==='failed'?'重试提交':'提交本局分数',send);
      button('关闭后续自动提交',()=>{onlineChoice.choose(false);render();});
      const hint=document.createElement('small');hint.textContent='关闭不撤回已经发出的请求或平台成绩。';panel.append(hint);
    }
  };
  refreshDailyChoice=()=>{if(panel.isConnected)render();};render();
  if(run?.pending)void run.pending.then(()=>{if(panel.isConnected)render();});
}
const dailyRecordsForMenu=()=>dailyRecords,dailyArchivesForMenu=()=>dailyArchives;
let goalFilter:GoalFilter='all';
function showDaily(testMode:unknown=false){
  toMenu();el('menu-home').hidden=false;screen='daily';el('intro').hidden=true;el('overlay').hidden=false;el('shell').classList.add('modal-open');
  const fixed=testMode===true&&tapDailyBoard.available()?tapDailyBoard.testCourse():undefined;
  const course=fixed??dailyCourse(),level=levelById(course.levelId)!;
  const dailyRecords=fixed?testRecords:dailyRecordsForMenu(),dailyArchives=fixed?testArchives:dailyArchivesForMenu();
  const best=dailyRecords.best(course.id);
  el('overlay').innerHTML='<div class="result-card briefing-card"><span class="eyebrow">DAILY FLIGHT · '+course.day+' 北京时间</span><h2>每日挑战 · '+level.title+'</h2><p>每天北京时间 00:00 更新。同一天、同一规则版本的航线与障碍时序一致。</p><p>免费重试，不提供救援或补给；不改变战役解锁、星数或金币。单次计分航行上限八分钟，暂停不计入。</p><p>'+level.description+'</p>'+level.tutorial.paragraphs.map(p=>'<p class="lesson">'+p+'</p>').join('')+'<h3>本机今日最佳</h3><p>'+(best?best.score+' 分 · '+stars(best.stars)+' · '+best.time.toFixed(1)+'s · 余油 '+Math.round(best.fuelRatio*100)+'%':'尚无纪录，完成一次独立航行吧。')+'</p><p>按分数优先，同分比较用时，再比较余油。仅保存本机最近30个挑战日的最佳成绩；这不是在线排行榜。</p><p id="daily-warning" role="status"></p><button id="daily-begin" class="primary-button">挑战今日航线</button><button id="daily-back" class="text-button">返回战役航线</button></div>';
  el('daily-begin').insertAdjacentHTML('beforebegin',starTaskMarkup(starTasks(level)));
  el('daily-warning').textContent=dailyRecords.warning+' 当前采用三任务判星；旧版每日纪录单独保留，不混排。';el('overlay').scrollTop=0;
  if(tapDailyBoard.available())el('daily-warning').textContent+=' 可在下方选择参与在线排行榜。';
  const archive=dailyArchives.export(course.id);
  const extras=document.createElement('section');extras.className='daily-tools';extras.innerHTML='<p>完整回放保留最近三个挑战日，可导出留存。</p><button id="daily-export" class="secondary-button" '+(!archive?'disabled':'')+'>导出今日完整回放</button>';
  el('daily-begin').before(extras);
  if(tapDailyBoard.available()&&tapDailyBoard.testCourse()&&!fixed){
    const test=document.createElement('button');test.className='secondary-button';test.textContent='排行榜联调 · 固定航线';test.onclick=()=>showDaily(true);extras.after(test);
  }
  if(fixed){
    el('overlay').querySelector('h2')!.textContent='排行榜联调 · '+level.title;
    el('overlay').querySelector('h2 + p')!.textContent='固定使用 '+course.day+' UTC 航线，可跨日重复测试；不参与今天的每日榜。';
    el('overlay').querySelector('h3')!.textContent='本次打开期间的联调最佳';extras.querySelector('p')!.textContent='联调成绩与回放仅保留在本次打开期间，不写入每日存档；关闭后需重新飞行。';el('daily-begin').textContent='开始固定联调航线';
  }
  if(onlineCourse(course.id)){
    const online=document.createElement('section');extras.after(online);
    mountOnlineChoice(online,dailyOnlineRun?.courseId===course.id?dailyOnlineRun.run:undefined);
    el('daily-warning').textContent=dailyRecords.warning+' 今日在线榜北京时间00:00刷新；旧规则纪录独立保留。';
  }
  if(dailyArchives.warning)el('daily-warning').textContent+=' '+dailyArchives.warning;
  el('daily-export').onclick=()=>{if(!archive)return;const url=URL.createObjectURL(new Blob([archive],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='gravity-daily-'+course.day+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  el('daily-back').onclick=selectLevels;
  el('daily-begin').onclick=()=>{const begin=()=>{if(!fixed&&dailyCourse().id!==course.id){showDaily();return;}activeDailyTest=!!fixed;activeDaily=course;selected=level;start();};fixed?begin():askRanking('daily',begin);};
  const card=el('overlay').querySelector<HTMLElement>('.result-card')!;
  const details=Array.from(card.children).filter(node=>!node.matches('.eyebrow,h2,#daily-begin,#daily-back'));
  const {summary}=compactCard(card,details,'规则与纪录');
  const intro=document.createElement('p');intro.textContent=level.description;
  const rules=document.createElement('p');rules.textContent=fixed?'联调航线 · 不参与今日榜，不写入每日存档。':'每日北京时间00:00更新 · 免费重试\n不提供救援或补给 · 单次限时8分钟';rules.className='daily-summary-rules';
  const record=document.createElement('p');record.className='daily-summary-best';record.textContent=(fixed?'联调最佳':'本机今日最佳')+'\n'+(best?best.score+' 分 · '+stars(best.stars)+' · '+best.time.toFixed(1)+'秒':'尚无纪录');
  const warning=document.createElement('p');warning.setAttribute('role','status');warning.className='save-warning';warning.textContent=[dailyRecords.warning,dailyArchives.warning].filter(Boolean).join('；');
  summary.querySelector('#daily-begin')!.before(intro,rules,record,warning);
  card.classList.add('compact-daily');
}
function selectLevels(){
  toMenu();screen='levels';el('intro').hidden=true;el('overlay').hidden=false;el('shell').classList.add('modal-open');
  const visible=goalLevels(LEVELS,progress,goalFilter),goal=nextReplayGoal(LEVELS,progress);
  el('overlay').innerHTML='<div class="level-panel"><span class="eyebrow">CAMPAIGN / '+LEVELS.length+' MISSIONS</span><h2>星际航线</h2><p>'+new Set(LEVELS.map(l=>l.chapter)).size+' 章 · '+LEVELS.length+' 条航线，从起飞训练逐步挑战复杂环境。</p><div class="campaign-progress">'+LEVELS.filter(l=>progress.record(l.id).normal||progress.record(l.id).assisted).length+' / '+LEVELS.length+' 已完成 · '+LEVELS.reduce((a,l)=>a+Math.max(progress.record(l.id).normal?.stars??0,progress.record(l.id).assisted?.stars??0),0)+' / '+(LEVELS.length*3)+' 星</div><section class="replay-goal"><span class="eyebrow">下一次航行</span><h3>'+(goal?(goal.kind==='unassisted'?'独立完成 · ':'独立三星 · ')+goal.level.title:'所有航线已独立三星')+'</h3><p>'+(goal?'从已解锁航线中选择目标，救援成绩单独保留。':'可以重返任意航线，挑战更快用时与更高余油。')+'</p>'+(goal?'<button id="goal-start" class="secondary-button">挑战这条航线</button>':'')+'</section><div class="goal-filters" role="group" aria-label="重玩目标筛选">'+(['all','unassisted','mastery'] as const).map(f=>'<button data-goal-filter="'+f+'" aria-pressed="'+(goalFilter===f)+'">'+({all:'全部航线',unassisted:'未独立通关',mastery:'冲独立三星'}[f])+' · '+goalLevels(LEVELS,progress,f).length+'</button>').join('')+'</div><p class="goal-note">独立目标不计救援成绩；总星数仍保留原有统计。</p><div class="level-list">'+visible.map(l=>{
    const r=progress.record(l.id),open=progress.unlocked(l.id),previous=LEVELS[l.order-2],buyable=!!previous&&progress.record(previous.id).completed,best=r.normal??r.assisted;
    return '<button class="level-card" data-level="'+l.id+'" '+(!open&&!buyable?'disabled':'')+'><span class="level-number">'+l.order.toString().padStart(2,'0')+'</span><span class="level-copy"><b>'+l.title+'</b><small>'+l.description+'</small><em>'+(best?(r.normal?'独立':'救援')+' · '+best.score+' 分 · 最快 '+best.time.toFixed(1)+'s · 最高余油 '+Math.round(best.fuel/l.initialFuel*100)+'%':open?(r.legacy?.normal||r.legacy?.assisted?'旧航线已通关 · 新航线待挑战':'已解锁 · 等待首次航行'):buyable?'解锁需 '+ECONOMY[previous.id].unlock+' 金币；上一关两星可免费解锁':'先完成上一关；两星免费解锁')+'</em><small>独立 '+stars(r.normal?.stars??0)+' · 救援 '+stars(r.assisted?.stars??0)+'</small></span><span class="level-stars">'+(open?stars(Math.max(r.normal?.stars??0,r.assisted?.stars??0)):'锁定')+'</span></button>';
  }).join('')+'</div>'+(!visible.length?'<div class="goal-empty" role="status"><p>这个目标已全部完成。</p><button id="goals-all" class="secondary-button">查看全部航线</button></div>':'')+(progress.warning?'<p class="save-warning">'+progress.warning+'</p>':'')+'</div>';
  el('overlay').scrollTop=0;
  document.querySelectorAll<HTMLButtonElement>('[data-level]').forEach(b=>b.onclick=()=>selectOrBuy(levelById(b.dataset.level!)!));
  el('menu-home').hidden=false;
  const dailyButton=document.createElement('button');dailyButton.className='secondary-button';dailyButton.textContent='每日挑战 · 本机纪录';dailyButton.id='daily';dailyButton.onclick=showDaily;document.querySelector('.campaign-progress')!.after(dailyButton);
  document.querySelectorAll<HTMLElement>('[data-level]').forEach(card=>{
    const record=progress.record(card.dataset.level!),copy=card.querySelector('.level-copy')!;
    const current=record.starTasks;
    const note=document.createElement('small');note.className='task-record';
    note.textContent='三任务 · 独立 '+stars(current?.normal?.stars??0)+' · 救援 '+stars(current?.assisted?.stars??0);
    copy.append(note);
    const stats=copy.querySelector('em');
    const best=current?.normal??current?.assisted;
    if(stats&&best)stats.textContent=(current?.normal?'独立':'救援')+' · '+best.score+' 分 · 最快 '+best.time.toFixed(1)+'s';
    else if(stats&&(record.normal||record.assisted))stats.textContent='已有历史成绩 · 三任务待挑战';
  });
  const goalNote=document.querySelector('.goal-note');if(goalNote)goalNote.textContent='钱包 '+getCoins()+' 金币 · 两星免费解锁下一关；一星可用金币解锁。已有解锁和历史成绩保留。';
  document.querySelectorAll<HTMLButtonElement>('[data-goal-filter]').forEach(b=>b.onclick=()=>{goalFilter=b.dataset.goalFilter as GoalFilter;selectLevels();});
  const all=document.getElementById('goals-all');if(all)all.onclick=()=>{goalFilter='all';selectLevels();};
  const goalStart=document.getElementById('goal-start');if(goalStart&&goal)goalStart.onclick=()=>enterLevel(goal.level);
}
el('start').onclick=()=>enterLevel(selected);el('select-level').onclick=selectLevels;el('practice').onclick=()=>start(true);el('retry').onclick=()=>{if(started&&!adBusy&&!screen&&!activeExpedition)start(trainingMode);};
el('menu-home').onclick=()=>{if(['levels','brief','daily','expedition','rankings'].includes(screen)&&!(el('menu-home') as HTMLButtonElement).disabled)toMenu();};
el('pause').onclick=togglePause;el('sound').onclick=toggleSound;
document.querySelector('.brand')!.addEventListener('click',e=>{e.preventDefault();if(started)togglePause();});
function suspend(){frameDiagnostics.gap();input.clear();audio.engine(0);if(started&&sim.state==='flying'){paused=true;modal='';}}
window.addEventListener('pageshow',()=>{if(activeExpedition&&economy.data.expedition?.phase!=='flight'&&economy.data.expedition?.phase!=='ready')showExpedition();});
window.addEventListener('blur',suspend);document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
window.addEventListener('pagehide',()=>{suspend();if(activeExpedition){try{economy.park();}catch{}}if(dataResetting)return;cancelAd(true);diagnostics.leave('pagehide',diagnosticSnapshot());});
window.addEventListener('pageshow',event=>{if(event.persisted)diagnostics.resumePage();});
function refreshHud(){
  el('retry').hidden=activeExpedition;
  const t=telemetry(sim),g=guidance(sim),near=t.distance<selected.tutorial.approachRange,descent=near?t.targetDescent:t.descent,climb=descent<-.5;
  el('mission-name').textContent=selected.title;el('sector').textContent='SECTOR '+selected.order.toString().padStart(2,'0');
  el('vertical-label').textContent=near?(climb?'法向离开速度':'平台下降速度'):climb?'上升速度':'下降速度';
  el('vertical').innerHTML=Math.abs(descent).toFixed(1)+'<em>m/s</em>';
  el('vertical').classList.toggle('danger',g.id==='danger');
  el('altitude').innerHTML=Math.round(t.altitude)+'<em>m</em>';el('fuel').innerHTML=Math.ceil(sim.fuel/(activeExpedition?EXPEDITION_CAPACITY:selected.initialFuel)*100)+'<em>%</em>';
  el('fuel-bar').style.width=Math.min(100,sim.fuel/(activeExpedition?EXPEDITION_CAPACITY:selected.initialFuel)*100)+'%';el('fuel-bar').classList.toggle('low',sim.fuel/(activeExpedition?EXPEDITION_CAPACITY:selected.initialFuel)<.25);
  for(const [i,id] of ['leg-left','leg-right'].entries()){
    const l=sim.legs[i];el(id).classList.toggle('broken',l.broken);el(id).classList.toggle('worn',!l.broken&&l.health<75);
    el(id).querySelector('b')!.textContent=l.broken?'断裂':Math.ceil(l.health)+'%';
  }
  el('angle').textContent=Math.round(near?t.targetTilt:t.tilt)+'°';el('attitude-needle').style.transform='rotate('+Math.max(-65,Math.min(65,near?t.targetTilt:t.tilt))+'deg)';
  el('speed').textContent=near?'横移 '+t.targetLateral.toFixed(1)+' m/s':'惯性 '+t.speed.toFixed(1)+' m/s';
  el('flight-status').textContent=activeExpedition?'连续远征':activeDaily?'每日挑战':practice?(previewLevel?'关卡验证':'着陆练习'):sim.state==='docked'?'停泊':sim.state==='flying'?'飞行中':sim.state==='won'?'已抵达':'信号中断';
  el('coach-title').textContent=g.title;el('coach-detail').textContent=g.detail;el('distance').textContent='直距 '+Math.round(t.distance)+' m';
  el('coach').dataset.tone=g.tone;
  document.querySelectorAll('.steps i').forEach((e,i)=>e.classList.toggle('active',i<=g.step));
  el('envelope').hidden=!(started&&sim.state==='flying'&&near&&selected.tutorial.showLandingAssist);
  const emergency=sim.legs.filter(l=>l.broken).length===1;
  el('envelope').querySelector('span')!.textContent=emergency?'迫降窗口':'着陆窗口';
  const metrics=[{id:'limit-v',label:'下降',value:Math.abs(t.targetDescent),limit:emergency?sim.landing.emergencySpeed:sim.landing.vertical},{id:'limit-h',label:'横移',value:Math.abs(t.targetLateral),limit:emergency?sim.landing.emergencySpeed:sim.landing.horizontal},{id:'limit-a',label:'姿态',value:Math.abs(t.targetTilt),limit:(emergency?sim.landing.emergencyAngle:sim.landing.angle)*180/Math.PI}];
  for(const m of metrics){el(m.id).textContent=m.label+' '+m.value.toFixed(1)+' / '+m.limit.toFixed(m.id==='limit-a'?0:1)+(m.id==='limit-a'?'°':'');el(m.id).classList.toggle('pass',m.value<m.limit);el(m.id).classList.toggle('danger',m.value>m.limit*1.5);}
  el('footer-status').innerHTML='<i></i> '+(practice?'练习 / 验证 · 不保存成绩':sim.state==='docked'?'稳定停泊 · 等待点火':t.gravitySource+'牵引 · '+t.gravity.toFixed(1)+' m/s²'+(dragAt(sim.level,sim)>0?' · 大气阻力区':''));
  el('coins').textContent='◈ '+getCoins();el('engine-meter').style.transform='scaleX('+ (sceneView?.engine??0)+')';
  if(started&&!paused&&!adBusy&&sim.state==='flying'&&g.id==='danger')audio.cue('warning');
}
function showModal(state:string){
  const overlay=el('overlay');overlay.scrollTop=0;el('shell').classList.remove('route-review');
  overlay.hidden=!['failed','won','pause','ad'].includes(state);
  el('shell').classList.toggle('modal-open',!overlay.hidden);
  if(overlay.hidden)return;
  if(state==='ad'){
    overlay.innerHTML='<div class="result-card ad-card"><div class="orbital-spinner"></div><span class="eyebrow">REWARDED AD</span><h2>'+(sim.state==='failed'?'正在呼叫救援':'正在确认奖励')+'</h2><p>'+ (services.mode==='local'?'模拟广告 · 1.8秒后自动完成':'请完整观看广告，关闭后确认奖励') +'</p><small>取消奖励请求不会关闭平台广告</small><button id="cancel-ad" class="secondary-button">放弃本次奖励</button></div>';
    el('cancel-ad').onclick=()=>cancelAd();return;
  }
  if(state==='pause'){
    overlay.innerHTML='<div class="result-card"><span class="eyebrow">FLIGHT ON HOLD</span><h2>让航行暂停片刻。</h2><p>松开旋转会抑制自转。<br>松开发动机后，飞船仍会继续滑行。</p><div class="pause-manual"><span>左手 · 调整朝向</span><span>右手 · 短喷制动</span></div><button id="primary" class="primary-button">继续航行 '+icon('arrow')+'</button><button id="restart-modal" class="secondary-button">重新出发</button><button id="menu" class="text-button">关卡选择</button></div>';
    el('primary').insertAdjacentHTML('beforebegin',starTaskMarkup(starTasks(selected)));
    if(tiltSafety.interrupted){
      overlay.querySelector('h2')!.textContent='倾斜信号中断，已安全暂停';
      overlay.querySelector('p')!.textContent='飞船与计时已暂停。请松开手指，在操作设置中重新校准或改用按钮，再点击继续航行。信号恢复不会自动继续。';
      const controls=document.createElement('button');controls.className='secondary-button';controls.textContent='操作设置 / 重新校准';controls.onclick=()=>el('settings').click();el('primary').before(controls);
    }
    el('primary').onclick=togglePause;el('restart-modal').onclick=()=>start(trainingMode);el('menu').onclick=selectLevels;if(activeExpedition){el('restart-modal').remove();el('menu').textContent=sim.state==='docked'?'保存并返回远征整备':'结束本次远征';el('menu').onclick=()=>{if(sim.state==='docked'){showExpedition();return;}el('overlay').innerHTML='<div class="result-card"><h2>结束本次远征？</h2><p>已发射的航段不能保存退出。结束后结算已完成关数，不能继续本次远征。</p><button id="exp-end" class="secondary-button">确认结束并结算</button><button id="exp-resume" class="primary-button">继续航行</button></div>';el('exp-end').onclick=()=>{try{economy.end();showExpedition();}catch(e){notify(String(e));}};el('exp-resume').onclick=togglePause;};}return;
  }
  if(activeExpedition&&(state==='won'||state==='failed')){
    if(state==='won'){
      try{if(economy.data.expedition?.phase==='flight')economy.land(sim);showExpedition();}catch(e){overlay.innerHTML='<div class="result-card"><h2>航段已抵达，进度保存未成功</h2><p id="exp-save-error"></p><button id="exp-save-retry" class="primary-button">重试保存航段</button></div>';el('exp-save-error').textContent=String(e);el('exp-save-retry').onclick=()=>showModal('won');}return;
    }
    try{economy.fail(sim);expeditionOnline.settled();}catch(e){overlay.innerHTML='<div class="result-card"><h2>远征已失败，结算保存未成功</h2><p id="exp-save-error"></p><button id="exp-save-retry" class="primary-button">重试保存结算</button></div>';el('exp-save-error').textContent=String(e);el('exp-save-retry').onclick=()=>showModal('failed');return;}
    overlay.innerHTML='<div class="result-card"><h2>本次远征已结束</h2><p>飞船损毁，已结算完成的 '+economy.data.expedition!.completed+'/30 关与累计飞行记录。本次远征不能重试。</p><button id="exp-ranking" class="secondary-button">查看排名</button><button id="exp-station" class="primary-button">查看远征结算</button></div>';
    const card=overlay.querySelector<HTMLElement>('.result-card')!;mountExpeditionStatus(card);compactCard(card,Array.from(card.querySelectorAll('.daily-tools')),'榜单提交状态');el('exp-station').onclick=showExpedition;el('exp-ranking').onclick=()=>showRankings('overall');return;
  }
  const won=state==='won',result=RESULT[sim.result??'damaged'];
  const run=scoreFlight(sim,selected,practice||!!activeDaily);let coins=campaignReceipt?.amount??0;
  if(won&&!awarded){
    if(activeDaily){
      const dailyRecords=activeDailyTest?testRecords:dailyRecordsForMenu(),dailyArchives=activeDailyTest?testArchives:dailyArchivesForMenu();
      const old=dailyRecords.best(activeDaily.id);
      const checked=dailyRecords.submit(activeDaily,dailyRecorder.overflow?[]:dailyRecorder.inputs,{practice,assisted:sim.rescued,rescues:sim.rescueCount});
      newRecord=checked.ok&&(!old||compareDaily(checked.best,old)<0);
      dailyNotice=checked.ok?'完整输入复核通过 · '+activeDaily.day+' 本机每日纪录'+(dailyRecords.warning?' · '+dailyRecords.warning:''):'未计入每日纪录：'+checked.reason;
      if(checked.ok&&!activeDailyTest&&activeDaily.id!==dailyCourse().id)dailyNotice+=' · 航线已跨日，本次仅保留本机成绩，请挑战今日航线。';
      if(checked.ok)try{
        const archive=archiveDaily(activeDaily,dailyRecorder.inputs,{practice,assisted:sim.rescued,rescues:sim.rescueCount});
        dailyArchives.save(archive);if(dailyArchives.warning)dailyNotice+=' · '+dailyArchives.warning;
        if(onlineCourse(activeDaily.id)){
          const entry=onlineChoice.createRun(JSON.stringify(archive));dailyOnlineRun={courseId:activeDaily.id,run:entry};
          if(onlineChoice.choice==='yes')void onlineChoice.send(entry);
        }
      }
      catch{dailyNotice+=' · 完整回放保存失败，本次成绩摘要仍保留';}
    }else if(!practice){
      try{const old=progress.record(selected.id).starTasks?.[run.assisted?'assisted':'normal'];campaignReceipt=economy.claim(campaignAttempt,run);coins=campaignReceipt.amount;newRecord=!old||run.score>old.score;syncEconomy();}
      catch(e){notify('金币结算未保存：'+String(e));}
    }
    awarded=true;refreshHud();
  }
  const report=sim.failure;
  const title=won?(sim.result==='perfect'&&run.stars<3?'完整着陆':result.title):'航行未能完成';
  if(campaignReceipt)rewarded=campaignReceipt.doubled;
  const candidate=nextCampaignLevel(selected),nextLevel=activeDaily||!candidate||!progress.unlocked(candidate.id)?undefined:candidate;
  const cause=won?(run.stars===3?'本次三个目标全部完成。':'本次获得 '+run.stars+' 颗星，未完成项见获星明细。'):report?.cause??sim.reason;
  const advice=won?(practice?'练习完成，星级仅供参考；不保存成绩。':run.stars===3?'三个目标全部完成，可以继续下一段航行。':'下次目标：'+run.tasks.filter(task=>!task.met).map(task=>task.requirement).join('；')):report?.advice??'提前减速，保持支架朝向平台。';
  overlay.innerHTML='<div class="result-card '+(won?'success':'failure')+'"><span class="eyebrow">'+(won?'MISSION COMPLETE':'FLIGHT DEBRIEF')+'</span><div class="result-seal">'+(won?result.rank:'!')+'</div>'+(won?'<div class="earned-stars">'+stars(run.stars)+'</div><div class="score-line">'+run.score+' 分 · '+(practice?'练习':run.assisted?'救援成绩':'独立成绩')+(newRecord?' · 新纪录':'')+'</div>':'')+'<h2>'+title+'</h2><p class="result-cause">'+cause+'</p><div class="result-stats">'+
    (won?'<div><b>'+sim.elapsed.toFixed(1)+'<em>s</em></b><span>航行时间</span></div><div><b>'+Math.round(run.fuelRatio*100)+'<em>%</em></b><span>剩余燃料</span></div><div><b>+'+coins+'</b><span>'+(practice?'练习不计金币':'任务金币')+'</span></div>':
    '<div><b>'+(report?.impact??0).toFixed(1)+'</b><span>主体冲击 m/s</span></div><div><b>'+(report?.descent??0).toFixed(1)+'</b><span>下降 m/s</span></div><div><b>'+Math.round(report?.tilt??0)+'°</b><span>姿态偏差</span></div>')+
    '</div>'+(won?'<div class="touchdown-report">主体 '+Math.round(run.bodyIntegrity)+'% · 触地 '+run.touchdownSpeed.toFixed(1)+' m/s · 偏差 '+Math.round(run.touchdownAngle*180/Math.PI)+'°</div>':'')+'<div class="debrief-tip">'+advice+'</div><div class="result-legs"><span>左支架 '+(sim.legs[0].broken?'已断裂':Math.round(sim.legs[0].health)+'%')+'</span><span>右支架 '+(sim.legs[1].broken?'已断裂':Math.round(sim.legs[1].health)+'%')+'</span></div><button id="primary" class="primary-button">'+(won&&!practice&&nextLevel?'下一关 · '+nextLevel.title:practice&&won?'挑战完整航线':'重新出发')+icon('arrow')+'</button>'+
    ((!practice||adQa)?'<button id="ad" class="secondary-button" '+(rewarded?'disabled':'')+'>'+(won?(rewarded?'双倍奖励已领取':adLabel+' · 再领 '+coins+' 金币'):adLabel+' · 安全检查点救援')+'</button>':'')+
    (won?'<button id="retry-result" class="text-button">再试一次 · 挑战更高星级</button>':'')+'<button id="menu" class="text-button">关卡选择</button><small class="result-note">'+(!won&&!practice?'救援回到安全空域；无检查点时回到发射台。':practice?'练习不计成绩与解锁':won&&selected.order===30?'全部关卡已完成 · 重返航线，挑战更高星级':'进度保存在当前浏览器；救援成绩单独记录')+'</small></div>';
  if(won&&!practice&&!activeDaily){
    const receipt=campaignReceipt,details=document.createElement('p');details.className='debrief-tip';details.textContent=receipt?'首次星级提升 +'+receipt.first+' · 重复通关 +'+receipt.repeat+' · 已入账 '+receipt.amount+' · 钱包 '+getCoins():'金币结算暂未保存，请勿关闭游戏。';
    overlay.querySelector('.result-card')!.append(details);
    if(!receipt){document.getElementById('ad')?.remove();const retry=document.createElement('button');retry.className='secondary-button';retry.textContent='重试保存通关奖励';retry.onclick=()=>{awarded=false;showModal('won');};details.after(retry);}
    if(candidate&&!progress.unlocked(candidate.id)){
      const unlock=document.createElement('button');unlock.className='text-button';unlock.textContent='解锁下一关 · '+ECONOMY[selected.id].unlock+' 金币';unlock.disabled=getCoins()<ECONOMY[selected.id].unlock;unlock.onclick=()=>{try{economy.unlock(candidate.id);syncEconomy();showModal('won');}catch(e){notify(String(e));}};details.after(unlock);
    }
  }
  if(won){
    const earned=overlay.querySelector('.earned-stars')!;
    earned.textContent=run.tasks.map(task=>task.met?'★':'☆').join('');
    earned.setAttribute('aria-label','本次获得 '+run.stars+' 颗星');
    earned.insertAdjacentHTML('afterend',starTaskMarkup(run.tasks,true));
  }
  el('primary').onclick=()=>{if(won&&!practice&&nextLevel)enterLevel(nextLevel);else start(trainingMode&&!won);};el('menu').onclick=selectLevels;
  const retryResult=document.getElementById('retry-result');if(retryResult)retryResult.onclick=()=>start(trainingMode);
  if(!services.adAvailable){document.getElementById('ad')?.remove();const note=overlay.querySelector('.result-note');if(note&&!practice&&!activeDaily)note.textContent=won?note.textContent+'；当前环境广告暂不可用。':'当前环境广告暂不可用，可以免费重新出发。';}
  if(activeDaily){
    document.getElementById('ad')?.remove();
    el('primary').innerHTML='再次挑战 · 免费重试 '+icon('arrow');
    const note=overlay.querySelector('.result-note')!;note.textContent=dailyNotice||'每日挑战不提供救援，免费重试；不影响战役进度。';
    const score=overlay.querySelector('.score-line');if(score)score.textContent=run.score+' 分 · 每日挑战'+(newRecord?' · 新纪录':'');
    const coinLabel=overlay.querySelector('.result-stats div:last-child span');if(won&&coinLabel)coinLabel.textContent='每日挑战不计金币';
    if(won&&onlineCourse(activeDaily.id)){const online=document.createElement('section');el('menu').before(online);mountOnlineChoice(online,dailyOnlineRun?.run);}
    const ranking=document.createElement('button');ranking.className='secondary-button';ranking.textContent='查看排名';ranking.onclick=()=>showRankings('daily');el('menu').before(ranking);
    const backDaily=document.createElement('button');backDaily.className='secondary-button';backDaily.textContent='返回每日挑战';const wasTest=activeDailyTest;backDaily.onclick=()=>showDaily(wasTest);el('menu').before(backDaily);
  }
  if(selected.showTrajectory){
    const card=document.createElement('div');card.className='route-summary';
    card.innerHTML='<span class="eyebrow">FLIGHT PATH / 全程航迹</span><h3>'+cause+'</h3><p>'+sim.elapsed.toFixed(1)+'s · '+Math.round(sim.fuel/(activeExpedition?EXPEDITION_CAPACITY:selected.initialFuel)*100)+'% 余油 · '+(won?stars(run.stars):'主体冲击 '+(report?.impact??0).toFixed(1)+' m/s')+'</p><div><button id="route-retry" class="secondary-button">立即重试</button><button id="route-details" class="secondary-button">查看结算 / '+(won?'继续':'原因')+'</button></div><small>实心点：起点　空心圈：终点　折线：完整飞行轨迹</small>';
    overlay.append(card);el('shell').classList.add('route-review');
    el('route-retry').onclick=()=>{
      // 玩家反馈v0.1第3条：航迹页立即重试先经二级确认，避免误触直接重开；结算页重试保持直达。
      const check=document.createElement('div');check.className='route-summary';
      check.innerHTML='<span class="eyebrow">RETRY CHECK</span><h3>确认重新出发？</h3><p>'+(activeDaily?'每日挑战免费重试，确认后开始一次新的飞行。':won?'本关成绩已保存，确认后从发射台开始新的飞行。':'本次结算已保留，确认后从发射台重新开始。')+'</p><div><button id="route-retry-confirm" class="primary-button">确认重试</button><button id="route-retry-back" class="secondary-button">返回航迹</button></div><small>防止误触：确认后立即重新出发</small>';
      card.hidden=true;card.after(check);
      el('route-retry-confirm').onclick=()=>start(trainingMode);
      el('route-retry-back').onclick=()=>{check.remove();card.hidden=false;};
    };
    el('route-details').onclick=()=>el('shell').classList.remove('route-review');
    const back=document.createElement('button');back.className='text-button';back.textContent='查看全程航迹';back.onclick=()=>{el('shell').classList.add('route-review');overlay.scrollTop=0;};overlay.querySelector('.result-card')!.append(back);
  }
  if(won&&selected.rotatingFrame){
    overlay.classList.add('finale-complete');
    overlay.querySelector('.result-card h2')!.textContent='在引力的尽头，点亮一盏灯。';
    overlay.querySelector('.result-cause')!.textContent='静界研究站已接收到你的抵达信号。三十条航线，最终汇聚于此。';
    const route=overlay.querySelector('.route-summary');
    if(route){route.classList.add('finale-route');route.querySelector('.eyebrow')!.textContent='THE LAST LIGHT / L1 OBSERVATORY';route.querySelector('h3')!.textContent='漫长的航行，终于有了归处。';}
  }else overlay.classList.remove('finale-complete');
  const resultCard=overlay.querySelector<HTMLElement>('.result-card')!;
  resultCard.querySelector('.result-seal')?.remove();
  if(!nextLevel||practice)document.getElementById('retry-result')?.remove();
  if(activeDaily){document.getElementById('retry-result')?.remove();el('menu').remove();for(const button of Array.from(resultCard.querySelectorAll<HTMLButtonElement>(':scope > button.secondary-button')))button.className='text-button';}
  // Save failures stay on the decision screen; diagnostic and reward breakdowns are optional.
  const detailNodes=Array.from(resultCard.querySelectorAll('.star-tasks,.touchdown-report,.result-legs,.result-note,.daily-tools,.debrief-tip')).filter(node=>!node.textContent?.includes('金币结算暂未保存'));
  if(won&&!selected.rotatingFrame){const cause=resultCard.querySelector('.result-cause');if(cause)detailNodes.push(cause);}
  compactCard(resultCard,detailNodes,won?'获星与奖励明细':'失败详情');
  resultCard.classList.add('compact-result');
  if(progress.warning)notify(progress.warning);
  const adButton=document.getElementById('ad');
  if(adButton)adButton.onclick=async()=>{
    if(adBusy||rewarded)return;adBusy=true;const attempt=runId;input.clear();audio.engine(0);
    const outcome=await rewardedAction.run(ad,won?'double-coins':'rescue',()=>{
      if(attempt!==runId)return;
      if(won){if(!campaignReceipt)throw Error('没有可翻倍的结算');economy.double(campaignReceipt.id);rewarded=true;campaignReceipt=structuredClone(economy.data.receipt);}
      else{sim.rescue();diagnostics.rescue(diagnosticSnapshot());}
    });
    if(attempt!==runId||outcome==='stale')return;adBusy=false;
    if(outcome==='failed'||outcome==='cancelled'){
      restoreAdResult(outcome==='failed'?'广告暂不可用 · 未发放奖励，可稍后再试或免费重新出发':'广告未完成 · 未发放奖励，可免费重新出发');
      refreshHud();return;
    }
    if(outcome==='completed'){
      if(won)audio.cue('won');
      else{sceneView?.reset();finishDelay=0;audio.cue('recovery');notify('救援完成 · 已修复支架并降低速度');}
    }
    modal='';refreshHud();
  };
}
class FlightScene extends Phaser.Scene {
  view!:FlightView;
  preload(){this.load.image('black-hole',blackHoleArtUrl);this.load.image('black-hole-orbits',blackHoleOrbitsUrl);}
  create(){this.view=new FlightView(this,sim);sceneView=this.view;refreshHud();}
  update(_time:number,delta:number){
    if(dataResetting)return;
    if(started&&!paused&&!adBusy&&!screen&&!settingsDialog.open&&!consentDialog.open&&sim.state==='flying'&&tiltSafety.check(tilt.enabled,tilt.state.fresh(performance.now()))){
      paused=true;accumulator=0;input.clear();audio.engine(0);modal='';frameDiagnostics.gap();
    }
    tiltHint.textContent=tilt.state.fresh(performance.now())?'倾斜手机控制方向 · 按住画面喷射':'传感器暂无信号 · 可在设置中改用按钮';
    const dt=Math.min(delta/1000,.05),running=started&&!paused&&!adBusy&&!screen&&!settingsDialog.open&&!consentDialog.open&&!qaVistaHold;
    frameDiagnostics.sample(performance.now(),running&&sim.state==='flying'&&!document.hidden,settings.reduced(motionPreference.matches));
    if(running){
      accumulator+=qaInputs?CONFIG.step*(import.meta.env.DEV&&new URLSearchParams(location.search).get('qa')==='tour'?24:1200):dt;
      if(activeExpedition){try{economy.reserve(Math.floor(accumulator/CONFIG.step),sim,qaInputs?qaInputs[qaIndex]?.thrust:input.thrust);}catch(e){paused=true;input.clear();notify('无法保存出航状态：'+String(e));return;}}
      while(accumulator>=CONFIG.step){this.view.snapshot();qaCommand=qaInputs?qaInputs[qaIndex++]??{thrust:false,turn:0}:{thrust:input.thrust,turn:input.turn};
        if(!qaInputs&&tilt.enabled&&!input.left&&!input.right)qaCommand={...qaCommand,tiltRate:true};
        if(activeDaily&&(sim.state==='flying'||sim.state==='docked'&&qaCommand.thrust))dailyRecorder.push(qaCommand);
        const before=activeExpedition?{time:sim.elapsed,fuel:sim.fuel,health:sim.legs.map(l=>l.health)}:undefined;
        sim.step(qaCommand.thrust,qaCommand.turn,CONFIG.step,qaCommand.tiltRate===true);if(before)economy.sample(before,sim);accumulator-=CONFIG.step;
        if(import.meta.env.DEV&&qaInputs&&selected.rotatingFrame&&new URLSearchParams(location.search).get('qa')==='vista'&&qaIndex>=10800){qaVistaHold=true;accumulator=0;notify('开发观测定格 · 实际输入飞行90秒 · 不保存成绩');break;}}
    }else accumulator=0;
    if(activeExpedition&&running)economy.flush();
    for(const event of sim.drainEvents()){
      this.view.event(event);
      if(event.type!=='hull')audio.cue(event.type,event.speed/35);
      else audio.cue('contact',event.speed/15);
      if(event.type==='break'){notify((event.leg===0?'左':'右')+'起落架断裂 · 点火抬升，反向旋转补救');if(settings.canVibrate(motionPreference.matches))vibrate([25,35,45]);}
      if(event.type==='contact'&&event.speed>7&&settings.canVibrate(motionPreference.matches))vibrate(Math.min(40,event.speed));
      if(event.type==='recovery'&&!recoveryNotice){recoveryNotice=true;notify('控制已恢复 · 你成功脱离了危险');}
      if(event.type==='won'&&activeExpedition){try{economy.land(sim);expeditionOnline.settled();}catch(e){notify('航段保存失败，请在结算页重试保存。');}}
      if(event.type==='failed'&&activeExpedition){try{economy.fail(sim);expeditionOnline.settled();}catch(e){notify('远征结算保存失败，请在结算页重试保存。');}}
      if(event.type==='failed'||event.type==='won'){diagnostics.result(event.type,diagnosticSnapshot());input.clear();finishDelay=import.meta.env.DEV&&new URLSearchParams(location.search).has('qa')?0:.8;}
    }
    this.view.render(dt,accumulator/CONFIG.step,running&&(qaInputs?qaCommand.thrust:input.thrust),running?(qaInputs?qaCommand.turn:input.turn):0,started,paused||adBusy||settingsDialog.open,settings.reduced(motionPreference.matches));
    audio.engine(running?this.view.engine:0);
    audio.attitude(running&&sim.state==='flying'&&sim.fuel>0?input.turn:0);
    if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)el('toast').classList.remove('visible');}
    if(finishDelay>0)finishDelay-=dt;
    hudTimer+=dt;if(hudTimer>.1){hudTimer=0;refreshHud();}
    const next=adBusy?'ad':paused?'pause':!started?'intro':finishDelay>0?'flying':sim.state;
    if(!screen&&next!==modal){modal=next;showModal(next);}
  }
}
new Phaser.Game({
  type:Phaser.AUTO,parent:'canvas',backgroundColor:'#091421',
  scale:{mode:Phaser.Scale.RESIZE,width:'100%',height:'100%'},
  scene:FlightScene,render:{antialias:true,roundPixels:false},
  input:{activePointers:4},fps:{target:60},
});

function selectOrBuy(level:CampaignLevel){
 if(progress.unlocked(level.id)){enterLevel(level);return;}
 const previous=LEVELS[level.order-2];if(!previous||!progress.record(previous.id).completed)return;
 const cost=ECONOMY[previous.id].unlock;
 el('overlay').innerHTML='<div class="result-card"><h2>解锁 '+level.title+'</h2><p>需要 '+cost+' 金币，当前余额 '+getCoins()+'。也可以返回上一关获得两星，免费解锁。</p><button id="buy-level" class="primary-button" '+(getCoins()<cost?'disabled':'')+'>确认花费 '+cost+' 金币</button><button id="buy-back" class="secondary-button">返回航线</button></div>';
 el('buy-level').onclick=()=>{try{economy.unlock(level.id);syncEconomy();enterLevel(level);}catch(e){notify(String(e));}};el('buy-back').onclick=selectLevels;
}
function showExpedition(){
 if(toMenu()===false)return;el('menu-home').hidden=false;screen='expedition';el('intro').hidden=true;el('overlay').hidden=false;el('shell').classList.add('modal-open');el('overlay').scrollTop=0;
 expeditionPanel(el('overlay'),economy,{launch:()=>askRanking('expedition',()=>{const e=economy.data.expedition;if(!e||e.ended)return;activeDaily=undefined;activeExpedition=true;selected=LEVELS[e.completed];start();}),beforeStart:next=>askRanking('expedition',next),settled:mountExpeditionStatus,back:toMenu,busyChanged:busy=>{(el('menu-home') as HTMLButtonElement).disabled=busy;},ad,adAvailable:services.adAvailable,adLabel,ranking:kind=>showRankings(kind),changed:()=>{syncEconomy();refreshHud();expeditionOnline.settled();}});
}
const expeditionEntry=document.createElement('button');expeditionEntry.className='secondary-button';expeditionEntry.textContent='连续远征 · 30关资源挑战';expeditionEntry.onclick=showExpedition;el('select-level').after(expeditionEntry);

// Shared, in-game online boards. Entry does not submit scores or change participation.
const rankingReader=new LeaderboardReader();
let lastRanking:RankingKind='overall';
function showRankings(kind:RankingKind=lastRanking){
 if(toMenu()===false)return;
 screen='rankings';el('menu-home').hidden=false;el('intro').hidden=true;el('overlay').hidden=false;el('shell').classList.add('modal-open');
 const expeditionSource=(board:'overall'|'pure'):RankingSource=>({
  title:board==='overall'?'综合远征':'纯净远征',
  rule:board==='overall'?'先比完成关数，再比累计有效飞行时间。完整30关优先，允许整备与部分远征。':'仅收录未用金币或广告整备的完整30关成绩；累计有效飞行时间越短越好。',
  local:()=>{const best=economy.data.best[board];return best?'本机最佳：'+best.completed+'/30 · '+rankingDuration(best.ticks):'本机暂无符合条件的最佳成绩；最远 '+economy.data.farthest+'/30。';},
  list:(cursor,period)=>rankingReader.list(board,cursor,period),
  canSubmit:()=>{const best=economy.data.best[board];return expeditionOnline.preference.choice==='yes'&&!!best&&expeditionBoards.configured(board)&&economy.data.submitted[board]!==best.id&&!expeditionOnline.attempts[board]?.pending;},
  submitLabel:()=>{const best=economy.data.best[board];return !best?'完成符合条件的远征后可提交':economy.data.submitted[board]===best.id?'此项本机最佳已有提交回执':expeditionOnline.preference.choice==='yes'?'提交 / 重试本机最佳':'先在设置中开启远征排行';},
  submit:async()=>{if(expeditionOnline.preference.choice!=='yes')throw Error('请先在设置中开启远征排行榜参与，再提交。');await expeditionOnline.send(board);const best=economy.data.best[board];if(!best||economy.data.submitted[board]!==best.id)throw Error(expeditionOnline.status(board));}
 });
 leaderboardPanel(el('overlay'),{
  overall:expeditionSource('overall'),pure:expeditionSource('pure'),
  daily:{title:'每日挑战',rule:()=>dailyCourse().day+' · 北京时间每日00:00刷新，分数越高排名越高。同意参与后通关自动提交。',
   local:()=>{const course=dailyCourse(),best=dailyRecords.best(course.id);return '本机 '+course.day+(best?' 最佳：'+best.score+' 分':' 暂无成绩。');},
   list:(cursor,period)=>rankingReader.list('daily',cursor,period)}
 },kind,selected=>{lastRanking=selected;});
}
const rankingEntry=document.createElement('button');rankingEntry.className='secondary-button ranking-entry';rankingEntry.innerHTML=icon('trophy')+'排行榜';rankingEntry.onclick=()=>showRankings();expeditionEntry.after(rankingEntry);
