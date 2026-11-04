import {execFile} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execute,type Host} from './cross-host.js';

async function main(){
 const [id]=process.argv.slice(2);if(!id||!/^g2-[a-z0-9-]+$/.test(id))throw Error('Usage: t1-status g2-RUN-ID');
 const output=path.resolve('runs/t1',id,'snapshots',new Date().toISOString().replace(/[:.]/g,'-'));await fs.mkdir(output,{recursive:true});
 const windows=`$ProgressPreference='SilentlyContinue'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$ports=@(25432,28101,28102)
$listeners=@(Get-NetTCPConnection -State Listen | Where-Object LocalPort -In $ports | Select-Object LocalAddress,LocalPort,OwningProcess)
$processes=@(Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -in $listeners.OwningProcess } | Select-Object ProcessId,ParentProcessId,ExecutablePath,CreationDate)
$tasks=@(Get-ScheduledTask | Where-Object TaskName -Like 'OAN-TETC-*' | Select-Object TaskName,State)
@{at=[DateTime]::UtcNow.ToString('o');listeners=$listeners;processes=$processes;tasks=$tasks}|ConvertTo-Json -Depth 5`;
 const inventory=JSON.parse(await fs.readFile('.local/three-host.inventory.json','utf8')) as {hosts:Host[]};
 for(const h of inventory.hosts){
  const script=h.os==='windows'?windows:`date --iso-8601=seconds
systemctl show oan-tetc-{root,cdn,publisher,registrar,discovery}-${id} -p Id -p ActiveState -p MainPID -p CPUUsageNSec -p MemoryCurrent -p MemoryMax -p CPUQuotaPerSecUSec
ss -lnt | grep -E ':(25432|24222|28222|28100|28101|28102|28103|28110) '
systemctl is-active oan-root-node oan-registrar-node oan-discovery-node`;
  const result=await execute(h,script);await fs.writeFile(path.join(output,`${h.id}.json`),JSON.stringify(result,null,2),'utf8');
 }
 const local=await new Promise<string>((resolve,reject)=>execFile('powershell',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(windows,'utf16le').toString('base64')],{windowsHide:true,timeout:60000},(err,out)=>err?reject(err):resolve(out)));
 await fs.writeFile(path.join(output,'laptop-a.json'),local,'utf8');
 console.log('Experiment listeners, PID ownership and unit states saved; no configuration secrets collected');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
