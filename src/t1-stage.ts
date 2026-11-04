import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execute, type Host,validateHost} from './cross-host.js';

async function scp(h:Host,source:string,target:string){
 validateHost(h);
 const args=['-r','-o','BatchMode=yes','-o','ConnectTimeout=12','-o','StrictHostKeyChecking=yes','-o',`HostKeyAlias=${h.hostKeyAlias}`,'-o',`UserKnownHostsFile=${h.knownHosts}`,'-o','IdentitiesOnly=yes','-i',h.key,source,`${h.user}@${h.address}:${target}`];
 await new Promise<void>((resolve,reject)=>{
  const p=spawn('scp',args,{windowsHide:true,stdio:['ignore','ignore','pipe']});let stderr='';
  const timer=setTimeout(()=>p.kill(),120000);p.stderr.on('data',d=>stderr+=d);
  p.on('error',reject);p.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error(`SCP failed for ${h.id}: ${stderr}`));});
 });
}
async function main(){
 const [id]=process.argv.slice(2);if(!id||!/^g2-[a-z0-9-]+$/.test(id))throw Error('Usage: t1-stage g2-RUN-ID');
 const base=path.resolve('runs/t1',id),stage=path.join(base,'private-stage');
 const inventory=JSON.parse(await fs.readFile('.local/three-host.inventory.json','utf8')) as {hosts:Host[]};
 const record:any[]=[];
 const local=path.join(base,'deployment');await fs.mkdir(local);await fs.cp(path.join(stage,'a'),local,{recursive:true});
 for(const h of inventory.hosts){
  const cloud=h.os==='linux';const target=cloud?`/data/oan/experiments/tetc-cross-host/runs/${id}`:`D:/Works/VscodeProject/OAN/oan-identity-lifecycle-evaluation/runs/t1/${id}`;
  const setup=cloud?`set -e; test ! -e '${target}'; install -d -m 0700 -o oan-tetc -g oan-tetc '${target}'`:`$ErrorActionPreference='Stop'; if(Test-Path -LiteralPath '${target}'){throw 'Run already exists'}; New-Item -ItemType Directory -Path '${target}' | Out-Null; & icacls.exe '${target}' /inheritance:r /grant:r 'jlxuf:(OI)(CI)(F)' '*S-1-5-18:(OI)(CI)(F)' '*S-1-5-32-544:(OI)(CI)(F)' | Out-Null; if($LASTEXITCODE -ne 0){throw 'ACL failure'}`;
  const r=await execute(h,setup);if(r.exitCode!==0||r.timedOut)throw Error(`Run setup failed ${h.id}`);
  const src=path.join(stage,cloud?'c':'b');
  for(const entry of await fs.readdir(src))await scp(h,path.join(src,entry),`${target}/`);
  if(cloud){const r=await execute(h,`set -e; chown -R oan-tetc:oan-tetc '${target}'; chmod -R go-rwx '${target}'; find '${target}/config' -type f -name '*.toml' | wc -l`);if(r.exitCode!==0)throw Error('Cloud permissions failed');}
  record.push({host:h.id,target,state:'inputs-staged-not-started'});
  console.log(`${h.id}: scoped run inputs staged`);
 }
 await fs.writeFile(path.join(base,'staging.json'),JSON.stringify({id,record},null,2),'utf8');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
