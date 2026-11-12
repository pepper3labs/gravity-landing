import { writeFileSync } from 'node:fs';
import { LEVELS, ROUTE_REVISION } from '../src/levels';
import { flyRoute } from '../src/replay';
import { scoreFlight } from '../src/scoring';
const chosen=process.argv.includes('--stage-one')?LEVELS.filter(l=>l.order>=9&&l.order<=11):LEVELS;
const results=chosen.map(level=>{
  const {flight,report}=flyRoute(level);
  const {inputs,...summary}=report;
  return {...summary,initialFuel:level.initialFuel,fuelPercent:Math.round(report.fuel/level.initialFuel*1000)/10,score:scoreFlight(flight,level)};
});
writeFileSync(process.argv.includes('--stage-one')?'docs/v06-stage-one-results.json':'docs/v07-route-results.json',JSON.stringify({routeRevision:ROUTE_REVISION,method:'120 Hz fixed step, input only; no teleport, no damage overrides, no rescue',results},null,2));
for(const result of results)console.log(result.levelId,result.state,result.time.toFixed(2)+'s',result.fuelPercent+'%',result.score.stars+' stars');
if(results.some(r=>r.state!=='won'))process.exitCode=1;
