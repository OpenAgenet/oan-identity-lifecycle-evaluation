import fs from 'node:fs/promises';
import path from 'node:path';
import {execute,type Host} from './cross-host.js';
async function main(){
 const [id]=process.argv.slice(2);if(!id||!/^clock-[a-z0-9-]+$/.test(id))throw Error('Usage: t1-clock clock-ID');
 const output=path.resolve('runs/t1',id);await fs.mkdir(output);
 const inventory=JSON.parse(await fs.readFile('.local/three-host.inventory.json','utf8')) as {hosts:Host[]};
 const rows:any[]=[];
 for(const h of inventory.hosts){
  const script=h.os==='windows'?`$ProgressPreference='SilentlyContinue'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()`:`date +%s%3N`;
  for(let i=0;i<5;i++){
   const begin=Date.now(),start=performance.now(),result=await execute(h,script,20000),elapsed=performance.now()-start;
   const remote=Number(result.stdout.trim());
   rows.push({host:h.id,index:i,beginUtcMs:begin,elapsedMs:elapsed,remoteUtcMs:Number.isFinite(remote)?remote:null,offsetEstimateMs:Number.isFinite(remote)?remote-(begin+elapsed/2):null,uncertaintyAtLeastMs:elapsed/2,exitCode:result.exitCode,timedOut:result.timedOut});
  }
  const sync=await execute(h,h.os==='windows'?'w32tm /query /status':'timedatectl show -p NTPSynchronized -p NTP -p TimeUSec',20000);
  await fs.writeFile(path.join(output,`${h.id}-sync.json`),JSON.stringify(sync,null,2),'utf8');
 }
 await fs.writeFile(path.join(output,'clock.json'),JSON.stringify({method:'SSH UTC midpoint estimate includes process startup and transport; not precise clock synchronization',rows},null,2),'utf8');
 console.log('Remote UTC samples and synchronization status saved; uncertainty retained');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
