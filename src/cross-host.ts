import {spawn} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export interface Host {
 id:string; os:'windows'|'linux'; address:string; user:string;
 key:string; hostKeyAlias:string; knownHosts:string; workspace:string;
}
export function validateHost(h:Host):void {
 if(!['windows','linux'].includes(h.os)||!/^\d{1,3}(\.\d{1,3}){3}$/.test(h.address)
   ||!/^[-a-zA-Z0-9_]+$/.test(h.user)||!/^[-a-zA-Z0-9_]+$/.test(h.id))throw Error('Invalid host identity');
 if(!h.key||!h.knownHosts||!h.hostKeyAlias||!h.workspace)throw Error('Missing pinned SSH configuration');
 if(h.os==='linux'&&!h.workspace.startsWith('/data/oan/experiments/tetc-cross-host/'))throw Error('Cloud path must be experiment-only');
}
export function remoteCommand(os:Host['os'],script:string):string {
 if(os==='windows')return `powershell -NoProfile -NonInteractive -EncodedCommand ${Buffer.from(script,'utf16le').toString('base64')}`;
 return `printf %s '${Buffer.from(script,'utf8').toString('base64')}' | base64 -d | bash`;
}
export function sshArgs(h:Host,script:string):string[] {
 validateHost(h);
 return ['-o','BatchMode=yes','-o','ConnectTimeout=12','-o','StrictHostKeyChecking=yes',
  '-o',`HostKeyAlias=${h.hostKeyAlias}`,'-o',`UserKnownHostsFile=${h.knownHosts}`,
  '-o','IdentitiesOnly=yes','-i',h.key,`${h.user}@${h.address}`,remoteCommand(h.os,script)];
}
export async function execute(h:Host,script:string,timeoutMs=60000){
 const start=new Date().toISOString();
 return await new Promise<{host:string;start:string;exitCode:number|null;timedOut:boolean;stdout:string;stderr:string}>((resolve,reject)=>{
  const child=spawn('ssh',sshArgs(h,script),{windowsHide:true});let stdout='',stderr='',timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;child.kill();},timeoutMs);
  child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);
  child.once('error',e=>{clearTimeout(timer);reject(e);});
  child.once('close',code=>{clearTimeout(timer);resolve({host:h.id,start,exitCode:code,timedOut,stdout,stderr});});
 });
}
export function preflightScript(h:Host):string {
 validateHost(h);
 if(h.os==='windows')return `
$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
whoami
node --version
rustc --version
cargo --version
Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors | ConvertTo-Json
Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,TotalVisibleMemorySize | ConvertTo-Json
Get-CimInstance Win32_Service | Where-Object Name -Match 'postgres' | Select-Object Name,PathName,State | ConvertTo-Json
Get-NetTCPConnection -State Listen | Where-Object LocalPort -In 25432,28101,28102 | Select-Object LocalAddress,LocalPort | ConvertTo-Json
Get-PSDrive D | Select-Object Free,Used | ConvertTo-Json
`;
 return `set -e\nhostname\nsource /root/.cargo/env\nrustc --version\ncargo --version\nnode --version\nfree -m\ndf -h /data\nls /usr/lib/postgresql\nss -lnt\ntailscale status\n`;
}
async function main(){
 const [mode,inventoryPath,outputPath]=process.argv.slice(2);
 if(mode!=='preflight'||!inventoryPath||!outputPath)throw Error('Usage: cross-host preflight PRIVATE_INVENTORY OUTPUT_DIR');
 const inventory=JSON.parse(await readFile(inventoryPath,'utf8')) as {hosts:Host[]};
 if(!Array.isArray(inventory.hosts)||inventory.hosts.length!==2)throw Error('Expected remote B and C');
 inventory.hosts.forEach(validateHost);
 const output=path.resolve(outputPath);await mkdir(output,{recursive:true});
 for(const h of inventory.hosts){
  const result=await execute(h,preflightScript(h));
  await writeFile(path.join(output,`${h.id}.json`),JSON.stringify(result,null,2),'utf8');
  console.log(`${h.id}: exit=${result.exitCode} timedOut=${result.timedOut}`);
  if(result.exitCode!==0||result.timedOut)throw Error(`Preflight transport failed: ${h.id}`);
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
