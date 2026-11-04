import {spawn} from 'node:child_process';
import {mkdir,writeFile,access} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import path from 'node:path';
import {scaleEnvironment} from './harness-config.js';
const allowed=new Set(['e2e','trusted-negative','multi-registrar-discovery','authorized-domain-isolation','service-registration-vc','resource-matrix','root-cdn-jetstream','pipeline-benchmark','mixed-pipeline-benchmark','multi-node-pipeline-benchmark','multi-node-mixed-pipeline-benchmark']);
async function main(){
 const [scenario,backend='sqlite',scales]=process.argv.slice(2);
 if(!allowed.has(scenario)||!['sqlite','postgres'].includes(backend))throw Error('invalid scenario/backend');
 const scaleEnv=scaleEnvironment(scales);
 const buildProfile=process.env.OAN_BENCH_BUILD_PROFILE??'release';
 if(!['debug','release'].includes(buildProfile))throw Error('invalid build profile');
 const workspace=path.resolve('..');
 const harness=path.join(workspace,'oan-official-skill/skills/oan-system-test-ops/fixtures/oan-ops-harness');
 const id=`harness-${scenario}-${Date.now()}`,dir=path.resolve('runs',id);await mkdir(dir,{recursive:true});
 const agent=process.env.OAN_AGENT_PY_ROOT ?? path.join(workspace,'oan-demos/runtime/agent-py');
 await access(path.join(agent,'agents/service-agent-python/pyproject.toml'));
 let password=process.env.OAN_BENCH_POSTGRES_PASSWORD;
 if(backend==='postgres'&&!password){const local=JSON.parse(await (await import('node:fs/promises')).readFile('.local/postgres.local.json','utf8'));password=local.password;}
 const uvPath = process.env.OAN_UV_PATH ?? (process.platform === 'win32' ? `${process.env.LOCALAPPDATA ?? ''}\\Programs\\Python\\Python312\\Scripts\\uv.exe` : 'uv');
 const env={...process.env,Path: process.platform === 'win32' && uvPath.includes('\\') ? `${path.dirname(uvPath)};${process.env.Path ?? ''}` : process.env.Path,OAN_UV_PATH:uvPath,OAN_BENCH_BUILD_PROFILE:buildProfile,OAN_BENCH_POSTGRES_PASSWORD:password,OAN_AGENT_PY_ROOT:agent,OAN_WORKSPACE_ROOT:workspace,OAN_BENCH_DB_BACKEND:backend,...scaleEnv};
 await writeFile(path.join(dir,'execution.json'),JSON.stringify({scenario,backend,buildProfile,state:'running',pid:process.pid,start:new Date().toISOString()}),'utf8');
 const child=spawn(process.execPath,[path.join(harness,'.bench-dist/ops/run-oan-ops-harness.js'),'--scenario',scenario],{cwd:harness,env,windowsHide:true});
 const log=createWriteStream(path.join(dir,'execution.log'),{encoding:'utf8'});
 child.stdout.on('data',data=>{log.write(data);process.stdout.write(data);});child.stderr.on('data',data=>{log.write(data);process.stderr.write(data);});
 const code=await new Promise<number>((resolve,reject)=>{child.on('error',reject);child.on('close',code=>resolve(code??1));});log.end();
 await writeFile(path.join(dir,'execution.json'),JSON.stringify({scenario,backend,buildProfile,scales:scales??'harness-default',exitCode:code,state:code===0?'harness-completed':'failed',measurementClass:'functional-or-pilot',officialReportRoot:path.join(harness,'.oan-benchmark-reports'),note:'Not the five-repeat independent paper experiment'},null,2),'utf8');
 process.exitCode=code;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
