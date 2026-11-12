import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { LEVELS,RETIRED_FINALE } from '../src/levels';
import {compatibleButtonRules} from '../src/rules-compatibility';
import { flyRoute } from '../src/replay';
import { createArchive, encodeArchive, rulesFingerprint, sha256, verifyArchive } from './replay-archive';

const mode=process.argv[2];
if(!['record','append','verify'].includes(mode)||process.argv.length!==3)throw new Error('用法：record / append / verify');
const directory='docs/replays',rules=rulesFingerprint();
if(mode==='record'||mode==='append'){
  const old=mode==='append'?JSON.parse(readFileSync(directory+'/manifest.json','utf8')):undefined;
  if(old&&(old.version!==1||!compatibleButtonRules(old.rulesSha256,rules)||old.source!=='automated-verification'||!Array.isArray(old.archives)))throw new Error('旧清单不兼容，不追加');
  const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const gameVersion=JSON.parse(readFileSync('package.json','utf8')).version;
  // Generate and verify everything before replacing any of the existing evidence.
  const generated=LEVELS.map(level=>{
    const file=level.id+'.json.gz';
    if(old&&existsSync(directory+'/'+file)){
      const bytes=readFileSync(directory+'/'+file),result=verifyArchive(bytes,level,rules);
      const entries=old.archives.filter((entry:{file:string})=>entry.file===file);
      if(entries.length!==1||entries[0].sha256!==sha256(bytes)||entries[0].bytes!==bytes.length||Object.entries(result).some(([key,value])=>entries[0][key]!==value))throw new Error(file+' 旧档案与清单不一致');
      return {file,bytes,result,existing:true};
    }
    if(old?.archives.some((entry:{file:string})=>entry.file===file))throw new Error(file+' 旧档案缺失，禁止替代');
    const {flight,report}=flyRoute(level,true);
    if(flight.state!=='won')throw new Error(level.id+' 自动航线未通关，保留原档案');
    const bytes=encodeArchive(createArchive(level,report.inputs,flight,{gameVersion,commit,rules}));
    const result=verifyArchive(bytes,level,rules);
    return {file,bytes,result,existing:false};
  });
  const retired=old?.retiredArchive??old?.archives.find((entry:{levelId:string})=>entry.levelId===RETIRED_FINALE.id);
  if(retired){const bytes=readFileSync(directory+'/'+retired.file);if(sha256(bytes)!==retired.sha256)throw Error('历史终关校验失败');verifyArchive(bytes,RETIRED_FINALE,rules);}
  if(old?.archives.some((entry:{file:string})=>!generated.some(item=>item.file===entry.file)&&entry.file!==retired?.file))throw new Error('旧清单包含未识别档案，禁止丢弃');
  mkdirSync(directory,{recursive:true});
  for(const item of generated)if(!item.existing)writeFileSync(directory+'/'+item.file,item.bytes);
  writeFileSync(directory+'/manifest.json',JSON.stringify({version:1,source:'automated-verification',rulesSha256:rules,
    archives:generated.map(({file,bytes,result})=>({file,sha256:sha256(bytes),bytes:bytes.length,...result})),...(retired?{retiredArchive:retired}:{})},null,2)+'\n');
}
const manifest=JSON.parse(readFileSync(directory+'/manifest.json','utf8'));
if(manifest.version!==1||manifest.source!=='automated-verification'||!compatibleButtonRules(manifest.rulesSha256,rules)||
  !Array.isArray(manifest.archives)||manifest.archives.length!==LEVELS.length)throw new Error('回放清单版本、规则或关卡数量不兼容');
for(const level of LEVELS){
  const matches=manifest.archives.filter((entry:{levelId?:string})=>entry?.levelId===level.id);
  if(matches.length!==1)throw new Error(level.id+' 回放缺失或重复');
  const entry=matches[0],file=level.id+'.json.gz';
  if(entry.file!==file)throw new Error('回放文件名不匹配');
  const bytes=readFileSync(directory+'/'+file);
  if(entry.sha256!==sha256(bytes)||entry.bytes!==bytes.length)throw new Error(file+' 文件校验失败');
  const result=verifyArchive(bytes,level,rules);
  if(result.state!=='won'||['state','steps','time','fuel','trajectoryPoints'].some(k=>entry[k]!==result[k as keyof typeof result]))throw new Error(file+' 与清单结果不符');
  console.log(level.id,result.state,result.steps+' steps',result.time.toFixed(2)+'s',bytes.length+' bytes');
}
console.log(LEVELS.length+'/'+LEVELS.length+' 档案从磁盘读取并重放通过（自动验证，不是真人验收）');
if(manifest.retiredArchive){const entry=manifest.retiredArchive;
 if(entry.file!==RETIRED_FINALE.id+'.json.gz')throw Error('历史终关路径无效');
 const bytes=readFileSync(directory+'/'+entry.file);if(entry.sha256!==sha256(bytes)||entry.bytes!==bytes.length)throw Error('历史终关字节不符');
 verifyArchive(bytes,RETIRED_FINALE,rules);console.log('历史终关 '+RETIRED_FINALE.id+' 严格复核通过，未重录');}
