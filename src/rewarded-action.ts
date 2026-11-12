import type { RewardedAd } from './services';

export type AdOutcome='completed'|'cancelled'|'failed'|'stale'|'busy';
/** Owns only the pending request; per-run reward policy remains with the caller. */
export class RewardedAction {
  private serial=0;
  private pending?:number;
  private controller?:AbortController;
  get busy(){return this.pending!==undefined;}
  cancel(){const controller=this.controller;this.controller=undefined;this.pending=undefined;this.serial++;controller?.abort();}
  async run(ad:RewardedAd,placement:'rescue'|'double-coins'|'expedition-refit',grant:()=>void):Promise<AdOutcome>{
    if(this.busy)return 'busy';
    const token=++this.serial,controller=new AbortController();this.pending=token;this.controller=controller;
    try {
      const completed=await ad.show(placement,controller.signal);
      if(this.pending!==token)return 'stale';
      if(!completed)return 'cancelled';
      grant();return 'completed';
    }catch {return this.pending===token?'failed':'stale';}
    finally {if(this.pending===token){this.pending=undefined;this.controller=undefined;}}
  }
}
