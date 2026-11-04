import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {execute,type Host} from './cross-host.js';
import {t1Policy} from './t1-policy.js';

export async function localPs(script:string){
 return new Promise<string>((resolve,reject)=>{
  const p=spawn('pwsh',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true});let stdout='',stderr='';
  const timer=setTimeout(()=>p.kill(),120000);
  p.stdout.on('data',d=>stdout+=d);p.stderr.on('data',d=>stderr+=d);p.once('error',reject);p.once('close',code=>{clearTimeout(timer);code===0?resolve(stdout):reject(Error(`Local deployment failed: ${stderr}`))});
 });
}
export async function deploy(id:string,previous:string){
 if(!/^g2-[a-z0-9-]+$/.test(id)||!/^g2-[a-z0-9-]+$/.test(previous)||id===previous)throw Error('Distinct isolated run IDs required');
 const root=path.resolve('.').replaceAll('\\','/');
 const {hosts}=JSON.parse(await fs.readFile('.local/three-host.inventory.json','utf8')) as {hosts:Host[]};
 const b=hosts.find(h=>h.os==='windows')!,c=hosts.find(h=>h.os==='linux')!;
 const log:string[]=[];
 async function remote(h:Host,script:string){const r=await execute(h,script,120000);log.push(JSON.stringify(r));if(r.exitCode!==0||r.timedOut)throw Error(`Deployment failed on ${h.id}: ${r.stderr || r.stdout}`);}
 const stopWindows=(run:string,roles:string[])=>`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
${roles.map(role=>`& '${root}/scripts/stop-t1-windows-node.ps1' -RunDirectory '${run}' -Role '${role}'`).join('\n')}`;
 try{
  await localPs(stopWindows(`${root}/runs/t1/${previous}/deployment`,['registrar-a']));
  await remote(b,stopWindows(`${root}/runs/t1/${previous}`,['registrar-b','discovery-a']));
  await remote(c,`set -euo pipefail
base=/data/oan/experiments/tetc-cross-host
for role in root registrar discovery cdn publisher nats; do
 unit=oan-tetc-$role-${previous}
 if [ "$(systemctl show "$unit" -p LoadState --value)" != not-found ]; then
  test "$(systemctl show "$unit" -p WorkingDirectory --value)" = "$base/runs/${previous}"
  test "$(systemctl show "$unit" -p User --value)" = oan-tetc
 fi
done
for role in registrar discovery publisher root cdn nats; do
 unit=oan-tetc-$role-${previous}
 if [ "$(systemctl show "$unit" -p LoadState --value)" != not-found ]; then systemctl stop "$unit"; fi
done
run=$base/runs/${id}
test -d "$run/config"
if ss -H -lnt | awk '{print $4}' | grep -Eq ':(28100|28101|28102|28103|28110|24222|28222)$'; then echo 'Experiment port still occupied'; exit 1; fi
export PGPASSWORD="$(cat "$base/postgres/password.local")"
for config in "$run"/config/*.toml; do
 database=$(sed -n 's/^database_url = "postgresql:.*\\/\\(oan_tetc_[a-z0-9_]*\\)"$/\\1/p' "$config")
 [ -n "$database" ] || continue
 exists=$(/usr/lib/postgresql/14/bin/psql -h 127.0.0.1 -p 25432 -U oan_tetc -d postgres -At -v ON_ERROR_STOP=1 -c "SELECT 1 FROM pg_database WHERE datname='$database'")
 test "$exists" != 1
 /usr/lib/postgresql/14/bin/createdb -h 127.0.0.1 -p 25432 -U oan_tetc "$database"
done
unset PGPASSWORD
install -d -m 0700 -o oan-tetc -g oan-tetc "$base/nats/${id}"
systemd-run --unit=oan-tetc-nats-${id} -p User=oan-tetc -p WorkingDirectory="$run" /usr/local/bin/nats-server -js -a 127.0.0.1 -p 24222 -m 28222 -sd "$base/nats/${id}"
deadline=$((SECONDS+1500))
until curl --noproxy '*' --max-time 3 --fail --silent http://127.0.0.1:28222/healthz >/dev/null; do
 test "$SECONDS" -lt "$deadline" || { echo 'Experiment NATS readiness timeout'; exit 1; }
 systemctl is-active --quiet oan-tetc-nats-${id} || exit 1
 sleep 1
done
for spec in 'root root-node root' 'cdn cdn-node cdn' 'publisher cdn-publisher cdn-publisher' 'registrar registrar-node registrar-c' 'discovery discovery-node discovery-b'; do
 read -r role binary config <<< "$spec"
 systemd-run --unit=oan-tetc-$role-${id} -p User=oan-tetc -p WorkingDirectory="$run" "$base/bin/$binary" "$run/config/$config.toml"
done`);
  const windowsStart=(run:string,roles:string[],address:string)=>`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
& '${root}/scripts/prepare-t1-run-databases.ps1' -RunDirectory '${run}' -InfrastructureDirectory '${root}/runs/t1/infrastructure-20261031'
${roles.map(role=>`& '${root}/scripts/start-t1-windows-node.ps1' -RunDirectory '${run}' -SourceBinary '${path.resolve('..',role==='discovery-a'?'oan-discovery-node/target/release/discovery-node.exe':'oan-registrar-node/target/release/registrar-node.exe').replaceAll('\\','/')}' -Role '${role}' -ListenAddress '${address}'`).join('\n')}`;
  log.push(await localPs(windowsStart(`${root}/runs/t1/${id}/deployment`,['registrar-a'],'100.126.2.41')));
  await remote(b,windowsStart(`${root}/runs/t1/${id}`,['registrar-b','discovery-a'],'100.69.96.59'));
  const endpoints=['http://100.126.2.41:28101/registrar/status','http://100.69.96.59:28101/registrar/status','http://100.69.96.59:28102/discovery/status','http://100.67.12.66:28100/health','http://100.67.12.66:28101/registrar/status','http://100.67.12.66:28102/discovery/status','http://100.67.12.66:28103/health','http://100.67.12.66:28110/health'];
  for(const url of endpoints){const deadline=Date.now()+t1Policy.readinessTimeoutMs;for(;;){try{const r=await fetch(url,{signal:AbortSignal.timeout(Math.min(t1Policy.readTimeoutMs,Math.max(1,deadline-Date.now())))});await r.arrayBuffer();if(r.ok)break;}catch{}if(Date.now()>deadline)throw Error(`Readiness timeout: ${url}`);await new Promise(r=>setTimeout(r,1000));}}
 }finally{await fs.writeFile(path.resolve('runs/t1',id,'deployment-receipts.json'),JSON.stringify(log,null,2),'utf8');}
}
