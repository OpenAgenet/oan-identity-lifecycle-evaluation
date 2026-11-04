import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {execute,type Host} from './cross-host.js';
export async function provenance(id:string){
 const base=path.resolve('runs/t1',id),repos=['oan-root-services','oan-registrar-node','oan-discovery-node','oan-protocol-common','oan-sdk-ts','oan-official-skill','oan-identity-lifecycle-evaluation'];
 const sources=repos.map(repo=>{const cwd=path.resolve('..',repo);return {repo,head:execFileSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8'}).trim(),trackedDiffSha256:crypto.createHash('sha256').update(execFileSync('git',['diff','HEAD'],{cwd})).digest('hex')};});
 const files=(await fs.readdir('src')).filter(f=>f.startsWith('t1-')||f==='cross-host.ts');
 const driverHashes=await Promise.all(files.map(async file=>({file,sha256:crypto.createHash('sha256').update(await fs.readFile(path.join('src',file))).digest('hex')})));
 const {hosts}=JSON.parse(await fs.readFile('.local/three-host.inventory.json','utf8')) as {hosts:Host[]};
 const receipts=[];
 for(const h of hosts){
  const script=h.os==='linux'?`systemctl show oan-tetc-{root,registrar,discovery,cdn,publisher,nats}-${id} -p Id -p WorkingDirectory -p User -p ActiveState -p MemoryMax -p CPUQuotaPerSecUSec
sha256sum /data/oan/experiments/tetc-cross-host/bin/{root-node,registrar-node,discovery-node,cdn-node,cdn-publisher}
systemctl is-active oan-root-node oan-registrar-node oan-discovery-node`:`$ProgressPreference='SilentlyContinue';[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
Get-ChildItem 'D:/Works/VscodeProject/OAN/oan-identity-lifecycle-evaluation/runs/t1/${id}' -Filter '*-process.json' | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8 }`;
  receipts.push(await execute(h,script));
 }
 const local=JSON.parse(await fs.readFile(path.join(base,'deployment/registrar-a-process.json'),'utf8'));
 await fs.writeFile(path.join(base,'provenance.json'),JSON.stringify({id,at:new Date().toISOString(),node:process.version,sources,driverHashes,receipts,local},null,2),'utf8');
}
