export interface RewardedAd { show(placement: 'rescue' | 'double-coins' | 'expedition-refit', signal?:AbortSignal): Promise<boolean> }
export class MockRewardedAd implements RewardedAd {
  constructor(private outcome:'completed'|'cancelled'|'failed'='completed',private wait=()=>new Promise<void>(resolve=>setTimeout(resolve,1800))){}
  async show(_placement: 'rescue' | 'double-coins' | 'expedition-refit') {
    await this.wait();
    if(this.outcome==='failed')throw new Error('模拟广告展示失败');
    return this.outcome==='completed';
  }
}
export interface LeaderboardEntry { levelId:string; rulesVersion:1; stars:number; score:number; seconds:number; fuelRatio:number; assisted:boolean; rescueCount:number }
export interface Leaderboard { submit(entry:LeaderboardEntry):Promise<void> }
export interface DailyChallenge { seed: string; levelId: string }
let fallbackCoins=0;
export const getCoins=()=>{
  try {const amount=Number(localStorage.getItem('gravity-coins')||0);return Number.isFinite(amount)?Math.max(0,amount):0;}
  catch {return fallbackCoins;}
};
export const saveCoins=(amount:number)=>{
  fallbackCoins=getCoins()+amount;
  try {localStorage.setItem('gravity-coins',String(fallbackCoins));} catch { /* Storage can be unavailable; keep this session playable. */ }
  return fallbackCoins;
};
