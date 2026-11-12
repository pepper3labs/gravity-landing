import {mkdirSync,writeFileSync} from 'node:fs';import {verifyExpedition} from './expedition-verification';
const profiles=[{name:'efficient',extraFuel:0,damagePerLeg:0},{name:'ordinary-model',extraFuel:.25,damagePerLeg:8},{name:'strained',extraFuel:.6,damagePerLeg:18},{name:'coin-refit',extraFuel:.6,damagePerLeg:18,service:'full' as const},{name:'ad-refit',extraFuel:.6,damagePerLeg:18,service:'ad' as const}];
const results=profiles.map(verifyExpedition);mkdirSync('artifacts/expedition',{recursive:true});writeFileSync('artifacts/expedition/balance.json',JSON.stringify({note:'真实物理/跨关资源继承；ordinary与strained额外耗油和损伤为明确模型假设，不是真人验证。整备组初始100000金币为测试夹具。',results},null,2));
for(const r of results)console.log(r.profile.name,r.completed+'/30',r.passed?'PASS':'RESOURCE PRESSURE',Math.min(...r.rows.map(x=>x.remaining)).toFixed(1)+' minimum fuel');
if(!results[0].passed||!results[1].passed||!results[3].passed||!results[4].passed)process.exitCode=1;
