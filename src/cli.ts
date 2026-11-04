import {readFile,mkdir,writeFile,appendFile} from 'node:fs/promises';
import {appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {validate} from './config.js';
import type {Experiment,Result} from './contracts.js';
async function main():Promise<void> {
 const [action,file]=process.argv.slice(2);if(!file||!['validate','run'].includes(action)) throw Error('usage: cli validate|run CONFIG');
 const raw=await readFile(file,'utf8');const c=JSON.parse(raw) as Experiment;validate(c);
 if(action==='validate'){console.log('configuration valid; no requests sent');return;}
 if(c.module!=='query' && (c.repetitions!==1||c.warmup!==0)) throw Error('mutating workloads require repetitions=1,warmup=0; use fresh fixtures for independent runs');
 if(c.ablation){const build=JSON.parse(await readFile(c.ablation.buildManifest,'utf8'));if(build.variant!==c.ablation.variant||build.production!==false||!build.sourceSha||!build.binarySha256)throw Error('invalid experimental build evidence');}
 await mkdir('runs',{recursive:true});const dir=path.resolve('runs',c.runId);await mkdir(dir,{recursive:false});
 await writeFile(path.join(dir,'manifest.json'),JSON.stringify({runId:c.runId,state:'running',configSha256:createHash('sha256').update(raw).digest('hex'),node:process.version,start:new Date().toISOString()}),'utf8');
 const rows:Result[]=[];const module=await import(`./modules/${c.module}.js`);
 let passed=false;
 try{passed=await module.run(c,(r:Result)=>{rows.push(r);appendFileSync(path.join(dir,'requests.jsonl'),JSON.stringify(r)+'\n',{encoding:'utf8'});});}
 finally {await writeFile(path.join(dir,'summary.json'),JSON.stringify({runId:c.runId,state:passed?'observations-matched':'failed',requests:rows.length,warning:'HTTP assertions are not cryptographic verification; external signed-evidence validation is required'}),'utf8');}
 if(!passed)process.exitCode=1;
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
