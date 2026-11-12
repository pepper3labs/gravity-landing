import {readFileSync,existsSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
const data=JSON.parse(readFileSync('docs/release-readiness.json','utf8'));
const required=['device-playtest','content-scope','platform-project','rewarded-ad','online-leaderboard','release-materials','publish-approval'];
if(data.version!==1||!Array.isArray(data.gates)||data.gates.length!==required.length||new Set(data.gates.map((g:{id:string})=>g.id)).size!==required.length)throw new Error('发布门槛配置无效');
const blocked:string[]=[];
for(const id of required){const gate=data.gates.find((g:{id:string})=>g.id===id);if(!gate)throw new Error('缺少门槛 '+id);
 const evidence=typeof gate.evidence==='string'?gate.evidence:'',path=resolve(evidence),rel=relative(resolve('docs'),path);
 const validEvidence=!!evidence&&!isAbsolute(rel)&&!rel.startsWith('..')&&existsSync(path);
 if(gate.status!=='passed'||!validEvidence)blocked.push(id+': '+gate.detail);
}
console.log(JSON.stringify({target:data.target,ready:blocked.length===0,blocked,note:'只读检查，不部署、不修改验收结论；人工证据仍需审阅'},null,2));
if(blocked.length)process.exitCode=1;
