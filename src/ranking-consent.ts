import type {OnlinePreference} from './online-participation';
export type ConsentMode='daily'|'expedition';
export const consentDescription=(mode:ConsentMode)=>mode==='daily'
 ?'参与后，每日挑战通关时自动提交有效分数。排行榜会展示当前平台账号的昵称、排名和成绩。'
 :'参与后，远征完成或结束时自动提交符合条件的个人最佳到综合榜；无金币或广告整备且完成30关的成绩也会提交纯净榜。排行榜会展示当前平台账号的昵称、排名和成绩。';
/** Native modal owns focus; dismissing cancels this start and never implies consent. */
export function rankingConsent(dialog:HTMLDialogElement,mode:ConsentMode,preference:OnlinePreference,proceed:()=>void,force=false){
 if(!force&&preference.choice!=='unset'){proceed();return;}
 if(dialog.open)return;
 const previous=document.activeElement as HTMLElement|null;
 const title=mode==='daily'?'参与每日排行榜？':'参与远征排行榜？';
 dialog.replaceChildren();dialog.setAttribute('aria-label',title);
 const add=(tag:string,text:string)=>{const n=document.createElement(tag);n.textContent=text;dialog.append(n);return n;};
 add('h2',title);add('p',consentDescription(mode));
 add('p','在线榜仅在支持该功能的平台内可用。只提交分数，不上传飞行回放。选择仅保存在本机，可在设置中分别修改；不参与也能正常游玩。');
 const finish=(yes:boolean)=>{preference.choose(yes);dialog.close();proceed();};
 const yes=add('button','参与排行') as HTMLButtonElement;yes.className='primary-button';yes.onclick=()=>finish(true);
 const no=add('button','仅本机记录') as HTMLButtonElement;no.className='secondary-button';no.onclick=()=>finish(false);
 const back=add('button','返回') as HTMLButtonElement;back.className='text-button';back.onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{if(previous?.isConnected)previous.focus();},{once:true});
 dialog.showModal();no.focus();
}
