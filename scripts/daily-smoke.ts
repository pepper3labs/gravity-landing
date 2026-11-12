import {writeFileSync} from 'node:fs';
import {dailyCourse} from '../src/daily';
import {levelById} from '../src/levels';
import {flyRoute} from '../src/replay';
import {archiveDaily,DailyArchiveStore} from '../src/daily-archive';
import {MockDailyLeaderboard} from '../src/daily-leaderboard';
// Synthetic fixture only; never writes browser storage or pretends to be a human run.
const c=dailyCourse(new Date('2026-10-15T00:00:00Z'));
let raw='';const storage={getItem:()=>raw||null,setItem:(_k:string,v:string)=>{raw=v;}};
const store=new DailyArchiveStore(storage);store.save(archiveDaily(c,flyRoute(levelById(c.levelId)!,true).report.inputs));
const exported=new DailyArchiveStore(storage).export(c.id)!;
writeFileSync('docs/evidence/daily-automated-fixture.json',exported);
const board=new MockDailyLeaderboard();await board.submit('automated-fixture',exported);
console.log(JSON.stringify({source:'automated fixture, not human',roundTrip:'save/reload/export/replay/submit',rows:await board.list(c.id)},null,2));
