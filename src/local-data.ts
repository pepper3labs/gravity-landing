/** Exact allowlist: never clear another application sharing the same origin. */
export const LOCAL_DATA_KEYS=['gravity-campaign','gravity-coins','gravity-settings','gravity-playtest','gravity-daily','gravity-daily-replays','gravity-online-choice','gravity-expedition-online-choice','gravity-economy-v1','gravity-economy-backup','gravity-expedition-journal'] as const;
type DataStorage=Pick<Storage,'getItem'|'removeItem'>;
export function exportLocalData(storage:DataStorage|undefined,gameVersion:string):string {
 if(!storage)throw new Error('浏览器存储不可用，无法导出持久数据');
 const entries=Object.fromEntries(LOCAL_DATA_KEYS.map(key=>[key,storage.getItem(key)]));
 return JSON.stringify({format:'gravity-local-backup',version:1,gameVersion,createdAt:new Date().toISOString(),entries},null,2);
}
/** Caller must first stop all writers and obtain explicit player confirmation. */
export function clearLocalData(storage:DataStorage|undefined):{ok:boolean;remaining:string[]} {
 if(!storage)return {ok:false,remaining:[...LOCAL_DATA_KEYS]};
 const remaining:string[]=[];
 for(const key of LOCAL_DATA_KEYS){
  try{storage.removeItem(key);if(storage.getItem(key)!==null)remaining.push(key);}catch{remaining.push(key);}
 }
 return {ok:remaining.length===0,remaining};
}
