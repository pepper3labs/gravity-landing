import {spawnSync} from 'node:child_process';
import {mkdirSync,readdirSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
// Local only. Does not record/rewrite replay baselines or change release gates.
const directory=join('artifacts','v09-validation',new Date().toISOString().replaceAll(':','-'));
mkdirSync(directory,{recursive:true});
const tsx='node_modules/tsx/dist/cli.mjs';
const steps:[string,string[]][]=[
 ['typecheck',['node_modules/typescript/bin/tsc','--noEmit']],
 ['tests',[tsx,'--test',...readdirSync('tests').filter(p=>p.endsWith('.test.ts')).sort().map(p=>join('tests',p))]],
 ['expedition',[tsx,'scripts/verify-expedition.ts']],
 ['replays',[tsx,'scripts/replays.ts','verify']],
 ['mastery',[tsx,'scripts/verify-mastery.ts']],
 ['daily',[tsx,'scripts/verify-daily.ts','docs/evidence/daily-automated-fixture.json']],
 ['build-local',['node_modules/vite/bin/vite.js','build']],
 ['audit-local',[tsx,'scripts/audit-build.ts']],
 ['build-h5',['node_modules/vite/bin/vite.js','build','--base','./','--outDir','dist-candidate']],
 ['audit-h5',[tsx,'scripts/audit-build.ts','dist-candidate']],
];
if(!existsSync('docs/replays/binary-reef-mastery.json.gz'))throw Error('缺失三星基线；验收不会自动录制');
const results:{name:string;exitCode:number|null;passed:boolean;log:string}[]=[];
for(const [name,args] of steps){
 const result=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:16*1024*1024});
 const log=join(directory,name+'.txt');writeFileSync(log,(result.stdout??'')+(result.stderr??'')+(result.error?.message??''));
 results.push({name,exitCode:result.status,passed:result.status===0,log});console.log(name+': '+(result.status===0?'PASS':'FAIL')+' — '+log);
 if(result.status!==0)break;
}
const release=spawnSync(process.execPath,[tsx,'scripts/check-release.ts'],{encoding:'utf8'});
writeFileSync(join(directory,'release-gates.txt'),(release.stdout??'')+(release.stderr??''));
let releaseStatus:unknown;try{releaseStatus=JSON.parse(release.stdout);}catch{releaseStatus={error:'门槛检查未返回有效结果'};}
const passed=results.length===steps.length&&results.every(r=>r.passed);
writeFileSync(join(directory,'summary.json'),JSON.stringify({localEngineeringPassed:passed,results,releaseExitCode:release.status,releaseStatus,note:'本地自动验证，不代表真人、手机、SDK或发布批准'},null,2));
console.log('本地工程 '+(passed?'通过':'失败')+'；发布门槛单独见 '+join(directory,'release-gates.txt'));
if(!passed||![0,1].includes(release.status??-1)||typeof releaseStatus!=='object'||releaseStatus===null||!('ready' in releaseStatus))process.exitCode=1;
