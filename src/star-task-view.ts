import type {StarTask} from './star-tasks';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function starTaskMarkup(tasks:readonly StarTask[],results=false){
  return '<section class="star-tasks" aria-label="'+(results?'本次获星明细':'本关三星目标')+'"><h3>'+(results?'本次获星明细':'本关三星目标')+'</h3><ul>'+tasks.map((task,i)=>
    '<li class="'+(results?(task.met?'task-met':'task-missed'):'task-pending')+'"><span class="task-symbol" aria-hidden="true">'+(results?(task.met?'★':'☆'):'☆')+'</span><div><b>'+escape(task.title)+'</b><span class="task-status">'+(results?(task.met?'已获得':'未获得'):'目标 '+(i+1))+'</span><p>'+escape(task.requirement)+'</p>'+(results?'<p class="task-detail">'+escape(task.detail)+'</p>':'')+'</div></li>').join('')+'</ul><small>成功着陆后，另外两项目标独立计星。</small></section>';
}
