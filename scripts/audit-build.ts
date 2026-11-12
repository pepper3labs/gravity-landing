import {readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
const hash=(data:string|Buffer)=>createHash('sha256').update(data).digest('hex');
const files=(root:string):string[]=>readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(root,e.name)):e.isFile()?[join(root,e.name)]:[]);
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const root=process.argv[2]??'dist';if(!['dist','dist-candidate'].includes(root))throw new Error('只允许审计本地构建目录');
const index=readFileSync(join(root,'index.html'),'utf8');
if(!index.includes(pkg.version))throw new Error('构建版本与package不一致，请重新构建');
const artifacts=files(root).filter(p=>relative(root,p)!=='build-manifest.json').sort().map(p=>{
 const bytes=readFileSync(p);return {path:relative(root,p).replaceAll('\\','/'),bytes:bytes.length,gzipBytes:gzipSync(bytes).length,sha256:hash(bytes)};
});
for(const match of index.matchAll(/(?:src|href)="((?:\/|\.\/)?assets\/[^"?]+)"/g))if(!artifacts.some(a=>a.path===match[1].replace(/^\.?\//,'')))throw new Error('缺失构建资源：'+match[1]);
const sources=[...files('src'),...files('public'),'index.html','vite.config.ts','package.json','package-lock.json'].sort().map(p=>[p.replaceAll('\\','/'),hash(p.endsWith('.png')?readFileSync(p):readFileSync(p,'utf8').replaceAll('\r\n','\n'))]);
const manifest={format:'gravity-local-build',version:1,gameVersion:pkg.version,createdAt:new Date().toISOString(),
 commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTreeDirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),
 sourceFingerprint:hash(JSON.stringify(sources)),lockfileSha256:hash(readFileSync('package-lock.json')),node:process.version,
 scope:'Local playtest only; no human/device/platform acceptance implied',buildDirectory:root,artifacts,
 totalBytes:artifacts.reduce((n,a)=>n+a.bytes,0),totalGzipBytes:artifacts.reduce((n,a)=>n+a.gzipBytes,0),
 largeChunks:artifacts.filter(a=>a.path.endsWith('.js')&&a.bytes>500_000).map(a=>a.path)};
if(!statSync(root).isDirectory())throw new Error('Missing dist');
writeFileSync(join(root,'build-manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest,null,2));
