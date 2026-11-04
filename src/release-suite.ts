import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import path from 'node:path';
const jobs=[
 ['pipeline-benchmark','10,50,100,200,500,1000,2000'],
 ['multi-node-pipeline-benchmark','10,100,400'],
 ['mixed-pipeline-benchmark','40,100,200,500,1000'],
 ['multi-node-mixed-pipeline-benchmark','60,150,300,600,1000'],
 ['authorized-domain-isolation'],['service-registration-vc'],['trusted-negative'],
];
const dir=process.env.OAN_RESUME_SUITE?path.resolve(process.env.OAN_RESUME_SUITE):path.resolve('runs',`release-suite-${Date.now()}`);
await mkdir(dir,{recursive:true});
const prior=process.env.OAN_RESUME_SUITE?JSON.parse(await readFile(path.join(dir,'status.json'),'utf8')):[];
const results:any[]=prior.filter((r:any)=>r.exitCode===0);
if(prior.length)await writeFile(path.join(dir,`attempt-history-${Date.now()}.json`),JSON.stringify(prior,null,2),'utf8');
for(const [scenario,scales] of jobs){
 if(results.some(r=>r.scenario===scenario))continue;
 const startedAt=new Date().toISOString();
 const log=createWriteStream(path.join(dir,`${scenario}.log`),{encoding:'utf8',flags:'a'});
 const child=spawn(process.execPath,[path.resolve('dist/src/harness.js'),scenario,'postgres',...(scales?[scales]:[])],{env:{...process.env,OAN_BENCH_BUILD_PROFILE:'release'},windowsHide:true});
 child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
 const code=await new Promise<number>((resolve,reject)=>{child.once('error',reject);child.once('close',code=>resolve(code??1));});
 await new Promise<void>(resolve=>log.end(resolve));
 results.push({scenario,scales,buildProfile:'release',startedAt,finishedAt:new Date().toISOString(),exitCode:code});
 await writeFile(path.join(dir,'status.json'),JSON.stringify(results,null,2),'utf8');
 console.log(JSON.stringify({scenario,exitCode:code,dir}));
 if(code!==0){process.exitCode=code;break;}
}
