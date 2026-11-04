import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const dir=process.env.OAN_REPEAT_MANIFEST?path.dirname(path.resolve(process.env.OAN_REPEAT_MANIFEST)):path.resolve('runs',`five-rounds-${Date.now()}`);
await mkdir(dir,{recursive:true});
const baseline='release-suite-1793150787005';
const {readFile}=await import('node:fs/promises');
const prior=process.env.OAN_REPEAT_MANIFEST?JSON.parse(await readFile(process.env.OAN_REPEAT_MANIFEST,'utf8')):{results:[]};
const results:any[]=prior.results.filter((r:any)=>r.exitCode===0);
for(let round=2;round<=5;round++){
 if(results.some(r=>r.round===round))continue;
 const start=new Date().toISOString();
 let output='';
 const resume=prior.results.find((r:any)=>r.round===round&&r.exitCode!==0)?.suite;
 const child=spawn(process.execPath,[path.resolve('dist/src/release-suite.js')],{windowsHide:true,env:{...process.env,OAN_BENCH_BUILD_PROFILE:'release',...(resume?{OAN_RESUME_SUITE:resume}:{})}});
 child.stdout.on('data',data=>{output+=data;process.stdout.write(data);});
 child.stderr.on('data',data=>process.stderr.write(data));
 const exitCode=await new Promise<number>((resolve,reject)=>{child.once('error',reject);child.once('close',c=>resolve(c??1));});
 const events=output.trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
 results.push({round,start,end:new Date().toISOString(),exitCode,suite:events[0]?.dir});
 await writeFile(path.join(dir,'status.json'),JSON.stringify({baseline,method:'independent scenario resets; cumulative scales within each scenario',results},null,2),'utf8');
 if(exitCode!==0){process.exitCode=exitCode;break;}
}
