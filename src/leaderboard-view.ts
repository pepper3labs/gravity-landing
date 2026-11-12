import {type RankingKind,type RankingPage,type RankingRow} from './leaderboard-reader';
export interface RankingSource {
 title:string;rule:string|(()=>string);local:()=>string;
 list:(cursor?:string,period?:string)=>Promise<RankingPage>;
 submit?:()=>Promise<void>;submitLabel?:()=>string;canSubmit?:()=>boolean;
}
export function leaderboardPanel(root:HTMLElement,sources:Record<RankingKind,RankingSource>,initial:RankingKind,onSelect:(kind:RankingKind)=>void){
 let serial=0,selected=initial;
 function render(){
  const version=++serial,source=sources[selected];onSelect(selected);root.replaceChildren();root.scrollTop=0;
  const panel=document.createElement('section');panel.className='ranking-panel';root.append(panel);
  const add=(tag:string,text:string,parent:HTMLElement=panel)=>{const node=document.createElement(tag);node.textContent=text;parent.append(node);return node;};
  add('h2','排行榜');const tabs=add('div','');tabs.className='ranking-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','选择排行榜');
  const button=(parent:HTMLElement,text:string,action:()=>void)=>{const b=document.createElement('button');b.className='secondary-button';b.textContent=text;b.onclick=action;parent.append(b);return b;};
  for(const kind of ['overall','pure','daily'] as const){const b=button(tabs,sources[kind].title,()=>{selected=kind;render();});b.setAttribute('aria-pressed',String(kind===selected));if(kind===selected)b.focus();}
  const rule=add('p',typeof source.rule==='function'?source.rule():source.rule);const local=add('p',source.local());local.className='ranking-local';
  const mine=add('p','正在读取我的线上排名…');mine.className='ranking-mine';
  const submission=add('p','');submission.setAttribute('role','status');
  let submitting=false,syncSubmit=()=>{};
  if(source.submit){
   add('small','自愿提交：仅发送本榜分数并关联当前平台账号，不上传回放。');
   const send=button(panel,source.submitLabel?.()??'同意提交本机最佳到此榜',()=>{
    if(submitting)return;submitting=true;send.disabled=true;submission.textContent='正在提交…';
    void source.submit!().then(()=>{if(!alive())return;local.textContent=source.local();submission.textContent='平台已确认提交。请刷新查看线上排名。';}).catch(error=>{if(alive())submission.textContent=error instanceof Error?error.message:'提交失败，可重试。';}).finally(()=>{submitting=false;if(alive()){send.disabled=!source.canSubmit?.();send.textContent=source.submitLabel?.()??'同意提交本机最佳到此榜';}});
   });syncSubmit=()=>{send.disabled=submitting||!source.canSubmit?.();send.textContent=source.submitLabel?.()??'同意提交本机最佳到此榜';};syncSubmit();
  }
  const status=add('p','');status.setAttribute('role','status');
  const list=add('ol','');list.className='ranking-list';list.setAttribute('aria-label',source.title+'在线成绩');
  let loading=false,next:string|undefined,period:string|undefined;const cursors=new Set<string>();
  const alive=()=>version===serial&&panel.isConnected;
  const refresh=button(panel,'刷新排行榜',()=>void load());
  const more=button(panel,'加载更多',()=>void load(next));more.hidden=true;
  function append(row:RankingRow){const li=add('li','',list);add('span','#'+row.rank,li).className='ranking-position';const detail=add('div','',li);add('b',row.name,detail);add('span',row.result,detail);}
  async function load(cursor?:string){
   if(loading)return;loading=true;refresh.disabled=more.disabled=true;status.textContent='正在读取真实在线成绩…';
   if(!cursor){list.replaceChildren();next=period=undefined;cursors.clear();more.hidden=true;local.textContent=source.local();rule.textContent=typeof source.rule==='function'?source.rule():source.rule;mine.textContent='正在读取我的线上排名…';}
   try{
    const result=await source.list(cursor,period);if(!alive())return;
    if(result.next&&cursors.has(result.next))throw Error('分页标识重复，请刷新榜单。');
    if(cursor)cursors.add(cursor);
    result.rows.forEach(append);next=result.next;period=result.period;
    if(!cursor)mine.textContent=result.mine?'我的线上排名 #'+result.mine.rank+' · '+result.mine.result:result.mineNotice;
    status.textContent=list.children.length?'已读取真实平台成绩；同分顺序以平台为准。':'当前榜单暂无成绩。';more.hidden=!next;
   }catch(error){if(alive()){status.textContent=error instanceof Error?error.message:'读取失败，请重试。';if(!cursor)mine.textContent='我的线上排名暂不可用；本机纪录不代表线上成绩。';}}
   finally{loading=false;if(alive()){refresh.disabled=more.disabled=false;syncSubmit();}}
  }
  void load();
 }
 render();
}
