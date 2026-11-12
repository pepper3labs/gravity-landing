import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {levelById} from '../src/levels';
import {flyRoute} from '../src/replay';
import {createArchive,decodeArchive,encodeArchive,rulesFingerprint,verifyArchive} from './replay-archive';
import {scoreFlight} from '../src/scoring';
const level=levelById('binary-reef')!,path='docs/replays/binary-reef-mastery.json.gz',rules=rulesFingerprint();
if(!existsSync(path)){
 const {flight,report}=flyRoute(level,true,undefined,{height:26,angleOffset:0});
 if(scoreFlight(flight,level).stars!==3)throw Error('三星验证失败，不保存档案');
 writeFileSync(path,encodeArchive(createArchive(level,report.inputs,flight,{gameVersion:JSON.parse(readFileSync('package.json','utf8')).version,
 commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),rules})));
}
// verifyArchive replays disk inputs and checks the archived score against the actual solver.
const result=verifyArchive(readFileSync(path),level,rules);
const archived=decodeArchive(readFileSync(path),level,rules);
if(archived.expected.score.stars!==3)throw Error('磁盘回放不是三星档案');
const {flight}=flyRoute(level,false,undefined,{height:26,angleOffset:0});
const score=scoreFlight(flight,level);if(score.stars!==3)throw Error('当前验证飞行未达到三星');
console.log(JSON.stringify({archive:result,currentPilotScore:score,note:'自动输入验证，不代表真人验收；原通关档案未替换'},null,2));
