export const MAX_PERFORMANCE_RUNS=20;
const limits=[16.7,33.4,50,100,250,Infinity];
interface SampleGroup { lowEffects:boolean; samples:number; totalMs:number; maxMs:number; buckets:number[] }
interface Run { id:number; levelId:string; groups:SampleGroup[] }
/** Bounded, session-only frame intervals; no storage, device probing or network. */
export class FrameDiagnostics {
  private runs:Run[]=[];
  private active?:Run;
  private previous?:number;
  private previousMode?:boolean;
  private nextId=1;
  begin(levelId:string,eligible:boolean){
    this.gap();this.active=undefined;if(!eligible)return;
    this.active={id:this.nextId++,levelId,groups:[]};this.runs.push(this.active);
    if(this.runs.length>MAX_PERFORMANCE_RUNS)this.runs.shift();
  }
  gap(){this.previous=undefined;this.previousMode=undefined;}
  sample(now:number,eligible:boolean,lowEffects:boolean){
    if(!this.active||!eligible||!Number.isFinite(now)){this.gap();return;}
    const before=this.previous,mode=this.previousMode;this.previous=now;this.previousMode=lowEffects;
    if(before===undefined||mode!==lowEffects||now<=before)return;
    const ms=now-before;
    let group=this.active.groups.find(g=>g.lowEffects===lowEffects);
    if(!group){group={lowEffects,samples:0,totalMs:0,maxMs:0,buckets:limits.map(()=>0)};this.active.groups.push(group);}
    group.samples++;group.totalMs+=ms;group.maxMs=Math.max(group.maxMs,ms);group.buckets[limits.findIndex(limit=>ms<=limit)]++;
  }
  exportReport(){return {version:1,scope:'Session only; latest 20 manual runs. Visible active flight only; excludes practice, QA, pause and background. Frame intervals, not GPU time or human/device certification.',
    bucketUpperBoundsMs:[16.7,33.4,50,100,250,null],runs:this.runs.map(r=>({...r,groups:r.groups.map(g=>({...g,buckets:[...g.buckets],meanMs:g.samples?g.totalMs/g.samples:null,intervalFps:g.totalMs?1000*g.samples/g.totalMs:null}))}))};}
}
