/** Keep the decision screen short; move existing detail nodes without losing their callbacks. */
export function compactCard(card:HTMLElement,nodes:Element[],label:string){
 const details=document.createElement('section');details.className='screen-details';details.hidden=true;
 const heading=document.createElement('h2');heading.textContent=label;
 const back=document.createElement('button');back.className='secondary-button';back.textContent='‹ 返回';
 details.append(back,heading);
 for(const node of nodes)details.append(node);
 const summary=document.createElement('section');summary.className='screen-summary';
 while(card.firstChild)summary.append(card.firstChild);
 const links=document.createElement('div');links.className='compact-links';
 for(const node of Array.from(summary.children))if(node instanceof HTMLButtonElement&&node.classList.contains('text-button'))links.append(node);
 const open=document.createElement('button');open.className='text-button';open.textContent=label;open.setAttribute('aria-expanded','false');links.append(open);
 summary.append(links);card.append(summary,details);card.classList.add('compact-card');
 const toggle=(expanded:boolean)=>{summary.hidden=expanded;details.hidden=!expanded;card.classList.toggle('details-open',expanded);open.setAttribute('aria-expanded',String(expanded));if(card.parentElement)card.parentElement.scrollTop=0;(expanded?back:open).focus();};
 open.onclick=()=>toggle(true);back.onclick=()=>toggle(false);
 return {summary,details,links};
}
