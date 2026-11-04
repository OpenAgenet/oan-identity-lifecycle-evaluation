import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const backend=process.argv[2]??'postgres';
const scenarios=['trusted-negative','authorized-domain-isolation','multi-registrar-discovery','pipeline-benchmark','mixed-pipeline-benchmark','multi-node-pipeline-benchmark','multi-node-mixed-pipeline-benchmark'];
await mkdir('runs',{recursive:true});const results:unknown[]=[];
for(const scenario of scenarios){
 const start=new Date().toISOString();
 const code=await new Promise<number>((resolve,reject)=>{const child=spawn(process.execPath,[path.resolve('dist/src/harness.js'),scenario,backend],{stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('close',code=>resolve(code??1));});
 results.push({scenario,start,exitCode:code});await writeFile('runs/suite-status.json',JSON.stringify(results,null,2),'utf8');
 if(code!==0){process.exitCode=code;break;}
}
