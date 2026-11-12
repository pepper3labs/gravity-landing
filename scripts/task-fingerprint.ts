import {readFileSync} from 'node:fs';
import {rulesFingerprint,sha256} from './replay-archive';
export function taskFingerprint(){
  return sha256(JSON.stringify({legacyRules:rulesFingerprint(),tasks:sha256(readFileSync('src/star-tasks.ts','utf8').replace(/\r\n/g,'\n'))}));
}
