import {readFileSync,statSync} from 'node:fs';
import {verifyDailyArchive,ARCHIVE_LIMIT} from '../src/daily-archive';
const path=process.argv[2];
if(!path)throw new Error('用法：npm run verify:daily -- <每日回放.json>');
if(statSync(path).size>ARCHIVE_LIMIT*3)throw new Error('文件过大');
const a=verifyDailyArchive(readFileSync(path,'utf8'));
console.log(a.course.id,a.course.levelId,a.best.score+'分',a.best.time.toFixed(2)+'s','完整输入独立重放通过（不证明真人或在线榜可信）');
