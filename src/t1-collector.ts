import fs from 'node:fs/promises';
import path from 'node:path';
import {execute,type Host} from './cross-host.js';
import {localPs} from './t1-deploy.js';
export async function startCollector(id:string){
 const output=path.resolve('runs/t1',id,'resource-usage.jsonl');
 const {hosts}=JSON.parse(await fs.readFile('.local/three-host.inventory.json','utf8')) as {hosts:Host[]};
 const windows=`$ProgressPreference='SilentlyContinue';[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
@{at=[DateTime]::UtcNow.ToString('o');processes=@(Get-Process | Where-Object { $_.ProcessName -in @('postgres','registrar-node','discovery-node') } | Select-Object Id,ProcessName,CPU,WorkingSet64,Path)}|ConvertTo-Json -Depth 4 -Compress`;
 const linux=`python3 - <<'PY'
import json,os,datetime
rows=[]
for pid in os.listdir('/proc'):
 if not pid.isdigit(): continue
 try:
  raw=open('/proc/'+pid+'/stat',encoding='utf-8').read();end=raw.rfind(')');name=raw[raw.find('(')+1:end];s=raw[end+2:].split()
  if name not in ['postgres','root-node','registrar-node','discovery-node','cdn-node','cdn-publisher','nats-server']: continue
  rows.append(dict(pid=int(pid),name=name,cpuSeconds=(int(s[11])+int(s[12]))/os.sysconf('SC_CLK_TCK'),rssBytes=int(s[21])*os.sysconf('SC_PAGE_SIZE'),startTicks=int(s[19]),executable=os.readlink('/proc/'+pid+'/exe'),cgroup=open('/proc/'+pid+'/cgroup',encoding='utf-8').read().strip()))
 except (OSError,ValueError,IndexError): pass
print(json.dumps(dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),processes=rows,hostCpu=open('/proc/stat',encoding='utf-8').readline().strip())))
PY`;
 let stopped=false;let wake:()=>void=()=>{};
 const sample=async()=>{
  const results=await Promise.all([
   localPs(windows).then(stdout=>({host:'laptop-a',stdout})).catch(e=>({host:'laptop-a',error:String(e)})),
   ...hosts.map(h=>execute(h,h.os==='linux'?linux:windows,30000).catch(e=>({host:h.id,error:String(e)}))),
  ]);
  await fs.appendFile(output,JSON.stringify({at:new Date().toISOString(),scope:'all-matching-processes-filter-by-path-and-cgroup-before-aggregation',results})+'\n','utf8');
 };
 await sample();
 const task=(async()=>{while(!stopped){await new Promise<void>(r=>{const timer=setTimeout(r,10000);wake=()=>{clearTimeout(timer);r()}});if(!stopped)await sample();}})();
 return async()=>{stopped=true;wake();await task;await sample();};
}
