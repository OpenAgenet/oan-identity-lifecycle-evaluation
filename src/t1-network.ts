import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execute,type Host} from './cross-host.js';

async function main(){
 const [id,countText='180']=process.argv.slice(2),count=Number(countText);
 if(!id||!/^network-[a-z0-9-]+$/.test(id)||!Number.isInteger(count)||count<1||count>180)throw Error('Usage: t1-network network-ID [1..180]');
 const output=path.resolve('runs/t1',id);await fs.mkdir(output);
 const inventory=JSON.parse(await fs.readFile('.local/three-host.inventory.json','utf8')) as {hosts:Host[]};
 const peers={a:['100.69.96.59','100.67.12.66'],b:['100.126.2.41','100.67.12.66'],c:['100.126.2.41','100.69.96.59']};
 const windows=(targets:string[])=>`$ProgressPreference='SilentlyContinue'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$ts='C:/Program Files/Tailscale/tailscale.exe'
for($i=0;$i -lt ${count};$i++){
 foreach($peer in @('${targets.join("','")}')){
  $at=[DateTime]::UtcNow.ToString('o'); $sw=[Diagnostics.Stopwatch]::StartNew()
  $raw=(& $ts ping --c 1 --timeout 3s $peer 2>&1 | Out-String);$code=$LASTEXITCODE
  @{sequence=$i;peer=$peer;at=$at;probeElapsedMs=$sw.Elapsed.TotalMilliseconds;exitCode=$code;raw=$raw}|ConvertTo-Json -Compress
 }
 Start-Sleep -Milliseconds 1000
}`;
 const linux=`python3 - <<'PY'
import json,subprocess,time,datetime
for i in range(${count}):
 for peer in ${JSON.stringify(peers.c)}:
  at=datetime.datetime.now(datetime.timezone.utc).isoformat(); start=time.monotonic()
  try:
   p=subprocess.run(['tailscale','ping','--c','1','--timeout','3s',peer],capture_output=True,text=True,timeout=5)
   print(json.dumps(dict(sequence=i,peer=peer,at=at,probeElapsedMs=(time.monotonic()-start)*1000,exitCode=p.returncode,raw=p.stdout+p.stderr)),flush=True)
  except subprocess.TimeoutExpired:
   print(json.dumps(dict(sequence=i,peer=peer,at=at,exitCode=None,timedOut=True)),flush=True)
 time.sleep(1)
PY`;
 const jobs=inventory.hosts.map(async h=>{
  const result=await execute(h,h.os==='linux'?linux:windows(peers.b),count*12000+60000);
  await fs.writeFile(path.join(output,`${h.id}.json`),JSON.stringify(result,null,2),'utf8');
  console.log(`${h.id}: network baseline captured, exit=${result.exitCode}`);
 });
 jobs.push((async()=>{
  const script=windows(peers.a),enc=Buffer.from(script,'utf16le').toString('base64');
  const result=await new Promise<{exitCode:number|null;stdout:string;stderr:string}>((resolve,reject)=>{
   const p=spawn('powershell',['-NoProfile','-NonInteractive','-EncodedCommand',enc],{windowsHide:true});let stdout='',stderr='';
   p.stdout.on('data',d=>stdout+=d);p.stderr.on('data',d=>stderr+=d);p.on('error',reject);p.on('close',exitCode=>resolve({exitCode,stdout,stderr}));
  });
  await fs.writeFile(path.join(output,'laptop-a.json'),JSON.stringify(result,null,2),'utf8');console.log('laptop-a: network baseline captured');
 })());
 await Promise.all(jobs);
 await fs.writeFile(path.join(output,'scope.json'),JSON.stringify({count,scope:'six-direction-tailnet-probes',interval:'1s sleep after each two-peer cycle; plus actual probe duration',qualification:'not OAN latency; may be collected during preparation, record build/background state separately'},null,2),'utf8');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
