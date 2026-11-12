type Callback={onSuccess:(value:unknown)=>void;onFailure:(code:unknown,message:unknown)=>void};
/** 在线榜宿主的最小契约。真实 SDK 适配必须由平台侧注入，不得在游戏内自行伪造。 */
export interface OnlineLeaderboardHost {
 submitScores(options:{scores:{leaderboardId:string;score:number}[];callback:Callback}):void;
 openLeaderboard(options:{leaderboardId:string;collection:'public';callback:Callback}):void;
 loadLeaderboardScores?:(options:{leaderboardId:string;collection:'public';maxSize:number;continuationToken?:string;periodToken?:string;callback:Callback})=>void;
 loadCurrentPlayerLeaderboardScore?:(options:{leaderboardId:string;collection:'public';periodToken?:string;callback:Callback})=>void;
}
export interface OnlineBoards {pure?:string;overall?:string;daily?:string}
/** 在线服务默认关闭：不联网、不上传，成绩仅保存在本机。接入任何平台前，必须配置已验证的宿主与榜单编号。 */
export const ONLINE_BOARDS:OnlineBoards={};
export function onlineLeaderboardHost():OnlineLeaderboardHost|undefined{return undefined;}
export interface DailyOnlineBoard {available():boolean;accepts(id:string):boolean;testCourse():undefined;submit(raw:string):Promise<void>;open():Promise<void>}
/** 未配置在线提供方时的空实现：界面按“仅本机成绩”降级，绝不伪报提交成功。 */
export const noopDailyOnlineBoard=():DailyOnlineBoard=>({available:()=>false,accepts:()=>false,testCourse:()=>undefined,
 async submit(_raw:string){throw Error('未配置在线排行榜提供方，成绩仅保存在本机。');},
 async open(){throw Error('未配置在线排行榜提供方。');}});
