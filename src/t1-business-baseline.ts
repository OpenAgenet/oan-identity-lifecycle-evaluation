import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {execute,type Host} from './cross-host.js';

const windows=(targets:string[],cycles:number)=>`$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
for($i=0;$i -lt ${cycles};$i++){
 $at=[DateTime]::UtcNow.ToString('o')
 $processes=@(Get-Process | Where-Object { $_.ProcessName -in @('postgres','registrar-node','discovery-node','cargo','rustc') } | Select-Object Id,ProcessName,CPU,WorkingSet64,Path)
 @{kind='resources';sequence=$i;at=$at;processes=$processes}|ConvertTo-Json -Depth 4 -Compress
 foreach($url in @('${targets.join("','")}')){
  $sw=[Diagnostics.Stopwatch]::StartNew(); $status=$null; $errorType=$null
  try { $status=(Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 10).StatusCode } catch { $errorType=$_.Exception.GetType().Name }
  @{kind='http';sequence=$i;at=[DateTime]::UtcNow.ToString('o');url=$url;status=$status;elapsedMs=$sw.Elapsed.TotalMilliseconds;errorType=$errorType}|ConvertTo-Json -Compress
 }
 Start-Sleep -Seconds 5
}
exit 0`;

async function main(){
 const [id,cyclesText='36']=process.argv.slice(2),cycles=Number(cyclesText);
 if(!id||!/^baseline-[a-z0-9-]+$/.test(id)||!Number.isInteger(cycles)||cycles<1||cycles>60)throw Error('Usage: t1-business-baseline baseline-ID [1..60]');
 const output=path.resolve('runs/t1',id);await fs.mkdir(output);
 const {hosts}=JSON.parse(await fs.readFile('.local/three-host.inventory.json','utf8')) as {hosts:Host[]};
 const linux=`python3 - <<'PY'
import json,time,datetime,urllib.request,os
targets=['http://100.69.96.59:28102/discovery/status','http://100.69.96.59:28101/registrar/status','http://100.126.2.41:28101/registrar/status']
for i in range(${cycles}):
 processes=[]
 for pid in os.listdir('/proc'):
  if not pid.isdigit(): continue
  try:
   raw=open('/proc/'+pid+'/stat',encoding='utf-8').read();end=raw.rfind(')');name=raw[raw.find('(')+1:end];s=raw[end+2:].split()
   if name not in ['postgres','root-node','registrar-node','discovery-node','cdn-node','cdn-publisher','nats-server','cargo','rustc']: continue
   processes.append(dict(pid=int(pid),name=name,cpuSeconds=(int(s[11])+int(s[12]))/os.sysconf('SC_CLK_TCK'),rssBytes=int(s[21])*os.sysconf('SC_PAGE_SIZE'),startTicks=int(s[19]),executable=os.readlink('/proc/'+pid+'/exe')))
  except (OSError,ValueError,IndexError): pass
 print(json.dumps(dict(kind='resources',sequence=i,at=datetime.datetime.now(datetime.timezone.utc).isoformat(),processes=processes,hostCpu=open('/proc/stat',encoding='utf-8').readline().strip())),flush=True)
 for url in targets:
  start=time.monotonic();status=None;error=None
  try:
   with urllib.request.urlopen(url,timeout=10) as r: status=r.status;r.read()
  except Exception as e: error=type(e).__name__
  print(json.dumps(dict(kind='http',sequence=i,at=datetime.datetime.now(datetime.timezone.utc).isoformat(),url=url,status=status,elapsedMs=(time.monotonic()-start)*1000,errorType=error)),flush=True)
 time.sleep(5)
PY`;
 const jobs=hosts.map(async h=>{
  const script=h.os==='linux'?linux:windows(['http://100.67.12.66:28100/health','http://100.67.12.66:28103/health'],cycles);
  const result=await execute(h,script,cycles*40000+60000);
  await fs.writeFile(path.join(output,`${h.id}.json`),JSON.stringify(result,null,2),'utf8');
  console.log(`${h.id}: baseline saved; exit=${result.exitCode}`);
 });
 jobs.push((async()=>{
  const script=windows(['http://100.69.96.59:28101/registrar/status','http://100.69.96.59:28102/discovery/status','http://100.67.12.66:28100/health','http://100.67.12.66:28101/registrar/status','http://100.67.12.66:28102/discovery/status'],cycles);
  const result=await new Promise((resolve,reject)=>{
   const p=spawn('powershell',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true});let stdout='',stderr='';
   const timer=setTimeout(()=>p.kill(),cycles*60000+60000);
   p.stdout.on('data',d=>stdout+=d);p.stderr.on('data',d=>stderr+=d);p.once('error',e=>{clearTimeout(timer);reject(e)});p.once('close',exitCode=>{clearTimeout(timer);resolve({exitCode,stdout,stderr})});
  });
  await fs.writeFile(path.join(output,'laptop-a.json'),JSON.stringify(result,null,2),'utf8');console.log('laptop-a: baseline saved');
 })());
 await Promise.all(jobs);
 await fs.writeFile(path.join(output,'scope.json'),JSON.stringify({scope:'post-build-read-only-http-and-process-baseline-not-performance',cycles,interval:'5s sleep plus collection and requests; all response bodies discarded',processScope:'all matching processes; classify experiment by executable path, never add production CPU to experiment CPU'},null,2),'utf8');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
